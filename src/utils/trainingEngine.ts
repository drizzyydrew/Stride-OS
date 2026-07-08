// ─── Central Training Engine ────────────────────────────────────────────────────
//
// Single source of truth for ALL planned training data in StrideOS.
// Accepts a complete EngineInput (all store state collapsed into a plain object)
// and returns a WeekPlan containing:
//   - RichWeek   — running sessions with VDOT-backed pacing and rationale
//   - StrengthWeek — strength sessions matched to phase + mileage load
//   - calendarMap  — date-keyed entries for the current week
//
// Build 33: the plan is now date-anchored. `trainingPhase` and `currentWeek`
// come from the macro plan's current MacroWeek (src/utils/plan/macroPlanner.ts)
// — never from athleteStore.currentWeek, which no longer advances anything.
// Before the athlete's program start date, buildWeekPlan returns an empty plan
// so screens can render a supportive "starts on <date>" state.
//
// All logic is deterministic and pure. No side effects. No store access.
// One call = one plan. Same inputs → same outputs.
//
// AI REPLACEMENT HOOK: replace buildWeekPlan() body with a Claude call
// receiving EngineInput and returning an identical WeekPlan shape.

import type { WorkoutEngineInput, RichWeek, RichWorkout, RichWorkoutType } from '../types/workout';
import type { StrengthWeek, StrengthEngineInput, StrengthLogRecord } from '../types/strength';
import type { TrainingPhase, ProgressionLevel, TrainingStyle, GoalType, StrengthLevel } from '../types/training';
import type { CalibrationOutput, TrainingDay } from '../types/athlete';
import type { CalendarEntry } from './calendarEngine';
import type { TrainingGoalType, MacroWeek, Race } from '../types/plan';
import { generateRichWeek, getBaseTemplate } from './workoutEngine';
import { generateStrengthWeek }     from './strengthEngine';
import {
  mapWorkoutsToDates,
  mapStrengthToDates,
  mergePlans,
  sundayOf,
  toYMD,
  parseYMD,
} from './calendarEngine';
import { pickTargetRace } from './plan/macroPlanner';
import { reconcileMissedSessions } from './plan/missedWorkouts';

// ─── Engine input ─────────────────────────────────────────────────────────────

export type EngineInput = {
  // ── Athlete state (from athleteStore) ──────────────────────────────────────
  goalRace:            string;
  weeklyMileage:       number;
  fatigueScore:        number;
  recoveryScore:       number;
  currentWeek:         number;     // legacy — kept for compat, no longer used to derive the plan
  trainingPhase:       TrainingPhase; // legacy — kept for compat, no longer used to derive the plan
  progressionLevel:    ProgressionLevel;

  // ── Plan spine (from trainingPlanStore + macroPlanner) ──────────────────────
  goalType:            TrainingGoalType;
  macroWeek:            MacroWeek | null;
  beforeStart:          boolean;
  programStartDate:     string | null;
  races:                Race[];

  // ── Physiological profile (from profileStore) ───────────────────────────────
  calibration:             CalibrationOutput | null;
  fatigueSensitivity:      number;     // 0.5–2.0
  recoveryResponsiveness:  number;
  returningFromInjury:     boolean;

  // ── Onboarding preferences ──────────────────────────────────────────────────
  availableDays:    TrainingDay[];
  runDays?:         TrainingDay[];
  liftDays?:        TrainingDay[];
  trainingStyle:    TrainingStyle;
  primaryGoal:      GoalType;
  hasCurrentInjury: boolean;
  strengthLevel:    StrengthLevel;

  // ── Daily readiness (from checkInStore) ─────────────────────────────────────
  soreness:   number | null;   // 1–10; null = no check-in today
  motivation: number | null;   // 1–10

  // ── Rolling history signals (computed from workoutStore.history) ─────────────
  acwr:                number;     // Acute:Chronic workload ratio
  recentIntensityDist: { easy: number; moderate: number; hard: number };
  recentHardSessions:  number;     // hard/max sessions in last 7 days
  adherenceRate:       number;     // 0–1
  consistencyScore:    number;     // 0–100
  longRunConsistency:  number;     // 0–1

  // ── Completion keys (from workoutStore / strengthStore) ─────────────────────
  completedWorkoutKeys:  string[];
  completedStrengthKeys: string[];

  // ── Strength history (from strengthStore) ────────────────────────────────────
  strengthHistory: StrengthLogRecord[];

  // ── Environment (optional) ─────────────────────────────────────────────────
  temperatureCelsius?: number;
  altitudeMeters?:     number;
};

// ─── Engine output ────────────────────────────────────────────────────────────

export type WeekPlan = {
  richWeek:      RichWeek;
  strengthWeek:  StrengthWeek;
  calendarMap:   Map<string, CalendarEntry[]>;
  weekStartDate: Date;    // Sunday of the current week
  weeksToRace:   number;
  adaptations:   string[]; // human-readable notes: readiness downgrades + missed-workout swaps
  metadata: {
    trainingPhase:    TrainingPhase;
    progressionLevel: ProgressionLevel;
    weeklyMileage:    number;
    currentWeek:      number;
    weeksToRace:      number;
    generatedAt:      number;
    startsOn?:        string;  // set when the plan hasn't started yet
    focus:            string;  // this week's macro-plan focus copy ('' before start)
  };
};

// ─── Empty plan (before program start) ────────────────────────────────────────

function emptyRichWeek(): RichWeek {
  return {
    workouts: [],
    weekScore: {
      totalIntendedLoad: 0, intendedFatigueDelta: 0,
      intensityBalance: { easy: 0, moderate: 0, hard: 0 },
      expectedAdaptations: [],
    },
    progressionNote: '',
    phaseRationale:  '',
    generatedAt:     Date.now(),
  };
}

function emptyStrengthWeek(): StrengthWeek {
  return {
    sessions: [], sessionDays: [], weeklyVolumeSets: 0,
    primaryGoal: 'maintenance', phaseNote: '', phaseRationale: '',
    generatedAt: Date.now(),
    progressionState: 'maintain', progressionReason: '',
  };
}

// ─── Adaptation explanations ──────────────────────────────────────────────────
//
// diffAdaptations() compares the phase/level baseline template against the
// final generated week (post adaptive-modifier + style + safety-filter passes)
// and surfaces a human-readable reason for each day that changed, using the
// same gate priority order as adaptiveModifier.ts.

export const RICH_TYPE_LABEL: Partial<Record<RichWorkoutType, string>> = {
  easy_run: 'Easy Run', recovery_run: 'Recovery Run', run_walk: 'Run/Walk', long_run: 'Long Run',
  progression_run: 'Progression Run', threshold: 'Threshold', tempo: 'Tempo', marathon_pace: 'Marathon Pace',
  vo2: 'VO2 Intervals', hill_repeats: 'Hill Repeats', strides: 'Strides', fartlek: 'Fartlek',
  taper_session: 'Taper Session', deload_session: 'Deload Session', cross_training: 'Cross Training',
  strength: 'Strength', mobility: 'Mobility', rest: 'Rest',
};

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function explainReadinessReason(input: EngineInput, trainingPhase: TrainingPhase): string {
  if (trainingPhase === 'taper') return 'taper — protecting race-day freshness';
  if (input.fatigueScore > 85) return `fatigue score ${input.fatigueScore} (critical)`;
  if (input.fatigueScore > 75) return `fatigue score ${input.fatigueScore}`;
  if (input.recoveryScore < 35) return `recovery score ${input.recoveryScore} (critical)`;
  if (input.recoveryScore < 50) return `recovery score ${input.recoveryScore}`;
  if (input.acwr > 1.5) return `training load spike (ACWR ${input.acwr.toFixed(2)})`;
  if (input.acwr > 1.3) return `rising training load (ACWR ${input.acwr.toFixed(2)})`;
  if (input.soreness !== null && input.soreness >= 8) return `soreness ${input.soreness}/10`;
  if (input.hasCurrentInjury || input.returningFromInjury) return 'injury risk';
  if (input.motivation !== null && input.motivation <= 3 && input.recoveryScore < 55) return 'low motivation and limited recovery';
  if (input.recentHardSessions >= 3) return `${input.recentHardSessions} hard sessions already logged this week`;
  if (input.adherenceRate < 0.4) return 'building consistency first';
  return "today's readiness signals";
}

function diffAdaptations(
  baseline:      RichWorkoutType[],
  workouts:      RichWorkout[],
  input:         EngineInput,
  trainingPhase: TrainingPhase,
): string[] {
  const reason = explainReadinessReason(input, trainingPhase);
  const notes: string[] = [];
  workouts.forEach((w, i) => {
    const before = baseline[i];
    if (before && before !== w.richType) {
      const dayName = DAY_NAMES[i] ?? `Day ${i + 1}`;
      notes.push(`Downgraded ${dayName} from ${RICH_TYPE_LABEL[before] ?? before} to ${RICH_TYPE_LABEL[w.richType] ?? w.richType} — ${reason}`);
    }
  });
  return notes;
}

// ─── Engine ───────────────────────────────────────────────────────────────────

export function buildWeekPlan(input: EngineInput): WeekPlan {
  const today    = new Date();
  const todayYMD = toYMD(today);

  // ── Before the program has started: empty plan, no generation ─────────────
  if (input.beforeStart || !input.macroWeek) {
    return {
      richWeek:      emptyRichWeek(),
      strengthWeek:  emptyStrengthWeek(),
      calendarMap:   new Map(),
      weekStartDate: sundayOf(today),
      weeksToRace:   0,
      adaptations:   [],
      metadata: {
        trainingPhase:    'foundation',
        progressionLevel: input.progressionLevel,
        weeklyMileage:    input.weeklyMileage,
        currentWeek:      0,
        weeksToRace:      0,
        generatedAt:      Date.now(),
        startsOn:         input.programStartDate ?? undefined,
        focus:            '',
      },
    };
  }

  const macroWeek     = input.macroWeek;
  const trainingPhase = macroWeek.phase;
  const currentWeek   = macroWeek.weekNumber;

  // ── weeksToRace: weeks between today and the plan's target race ───────────
  let weeksToRace = 0;
  if (input.goalType === 'race_prep' && input.programStartDate) {
    const targetRace = pickTargetRace(input.races, input.programStartDate);
    if (targetRace) {
      const todayWeekStart = sundayOf(today);
      const raceWeekStart  = sundayOf(parseYMD(targetRace.date));
      weeksToRace = Math.max(0, Math.ceil(
        (raceWeekStart.getTime() - todayWeekStart.getTime()) / (7 * 24 * 60 * 60 * 1000),
      ));
    }
  }

  // ── Goal shaping ────────────────────────────────────────────────────────────
  let trainingStyle   = input.trainingStyle;
  let liftDays        = input.liftDays;
  let hybridBalance   = false;

  if (input.goalType === 'general_strength') {
    trainingStyle = 'base_only';
    if (!liftDays || liftDays.length === 0) liftDays = ['Mon', 'Wed', 'Fri'];
  } else if (input.goalType === 'hybrid') {
    hybridBalance = true;
  }
  // general_running: style stays the athlete's preference — the macro plan
  // already guarantees this goal never reaches a 'peak' phase.

  // ── Running sessions ──────────────────────────────────────────────────────
  const workoutInput: WorkoutEngineInput = {
    calibration:            input.calibration,
    fatigueSensitivity:     input.fatigueSensitivity,
    recoveryResponsiveness: input.recoveryResponsiveness,
    injuryRisk:             input.hasCurrentInjury || input.returningFromInjury,
    fatigueScore:           input.fatigueScore,
    recoveryScore:          input.recoveryScore,
    soreness:               input.soreness,
    motivation:             input.motivation,
    acwr:                   input.acwr,
    trainingPhase,
    progressionLevel:       input.progressionLevel,
    weeklyMileage:          input.weeklyMileage,
    currentWeek,
    goalRace:               input.goalRace,
    weeksToRace,
    recentIntensityDist:    input.recentIntensityDist,
    recentHardSessions:     input.recentHardSessions,
    adherenceRate:          input.adherenceRate,
    consistencyScore:       input.consistencyScore,
    longRunConsistency:     input.longRunConsistency,
    trainingStyle,
    availableDays:          input.availableDays,
    runDays:                input.runDays,
    temperatureCelsius:     input.temperatureCelsius,
    altitudeMeters:         input.altitudeMeters,
  };

  const richWeek = generateRichWeek(workoutInput);
  const baseline = getBaseTemplate(workoutInput);
  const adaptations = diffAdaptations(baseline, richWeek.workouts, input, trainingPhase);

  // ── Strength sessions ─────────────────────────────────────────────────────
  const strengthInput: StrengthEngineInput = {
    trainingPhase,
    progressionLevel: input.progressionLevel,
    weeklyMileage:    input.weeklyMileage,
    currentWeek,
    fatigueScore:     input.fatigueScore,
    recoveryScore:    input.recoveryScore,
    soreness:         input.soreness,
    injuryRisk:       input.hasCurrentInjury || input.returningFromInjury,
    acwr:             input.acwr,
    weeksToRace,
    availableTimeMin: 60,
    liftDays,
    strengthHistory:  input.strengthHistory,
    hybridBalance,
  };

  const strengthWeek = generateStrengthWeek(strengthInput);

  // ── Calendar mapping ──────────────────────────────────────────────────────
  const weekStartDate = parseYMD(macroWeek.startDate);

  // RichWorkout extends Workout — fully compatible with mapWorkoutsToDates
  const runPlans = mapWorkoutsToDates(
    richWeek.workouts,
    input.runDays?.length ? input.runDays : input.availableDays,
    weekStartDate,
    input.completedWorkoutKeys,
    currentWeek,
  );

  const runDates      = runPlans.map(p => p.date);
  const strengthPlans = mapStrengthToDates(
    strengthWeek.sessions,
    liftDays?.length ? liftDays : input.availableDays,
    runDates,
    weekStartDate,
    input.completedStrengthKeys,
    currentWeek,
  );

  let calendarMap = mergePlans(runPlans, strengthPlans);

  // ── Race day entry — clears any other entry that date, adds no workout ────
  if (macroWeek.isRaceWeek && macroWeek.raceId) {
    const race = input.races.find(r => r.id === macroWeek.raceId);
    if (race) {
      calendarMap.set(race.date, [{
        date:      race.date,
        type:      'race',
        label:     `Race Day: ${race.name}`,
        color:     '#DCC0A7',
        completed: false,
      }]);
    }
  }

  // ── Never plan anything before the program start date ─────────────────────
  // Week 1 spans its full Sunday–Saturday week, so a mid-week start date can
  // otherwise receive entries on the days before the athlete actually begins.
  if (input.programStartDate) {
    for (const date of [...calendarMap.keys()]) {
      if (date < input.programStartDate) calendarMap.delete(date);
    }
  }

  // ── Missed workout reconciliation ──────────────────────────────────────────
  const reconciled = reconcileMissedSessions({ calendarMap, todayYMD });
  calendarMap = reconciled.calendarMap;

  return {
    richWeek,
    strengthWeek,
    calendarMap,
    weekStartDate,
    weeksToRace,
    adaptations: [...adaptations, ...reconciled.notes],
    metadata: {
      trainingPhase,
      progressionLevel: input.progressionLevel,
      weeklyMileage:    input.weeklyMileage,
      currentWeek,
      weeksToRace,
      generatedAt:      Date.now(),
      focus:            macroWeek.focus,
    },
  };
}
