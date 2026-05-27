// ─── Central Training Engine ────────────────────────────────────────────────────
//
// Single source of truth for ALL planned training data in StrideOS.
// Accepts a complete EngineInput (all store state collapsed into a plain object)
// and returns a WeekPlan containing:
//   - RichWeek   — running sessions with VDOT-backed pacing and rationale
//   - StrengthWeek — strength sessions matched to phase + mileage load
//   - calendarMap  — date-keyed entries for the current ISO week
//
// All logic is deterministic and pure. No side effects. No store access.
// One call = one plan. Same inputs → same outputs.
//
// AI REPLACEMENT HOOK: replace buildWeekPlan() body with a Claude call
// receiving EngineInput and returning an identical WeekPlan shape.

import type { WorkoutEngineInput, RichWeek }   from '../types/workout';
import type { StrengthWeek, StrengthEngineInput, StrengthLogRecord } from '../types/strength';
import type { TrainingPhase, ProgressionLevel, TrainingStyle, GoalType, StrengthLevel } from '../types/training';
import type { CalibrationOutput, TrainingDay } from '../types/athlete';
import type { CalendarEntry } from './calendarEngine';
import { generateRichWeek }         from './workoutEngine';
import { generateStrengthWeek }     from './strengthEngine';
import {
  mapWorkoutsToDates,
  mapStrengthToDates,
  mergePlans,
  sundayOf,
} from './calendarEngine';
import { buildPeriodizationPlan }   from './periodization';

// ─── Engine input ─────────────────────────────────────────────────────────────

export type EngineInput = {
  // ── Athlete state (from athleteStore) ──────────────────────────────────────
  goalRace:            string;
  weeklyMileage:       number;
  fatigueScore:        number;
  recoveryScore:       number;
  currentWeek:         number;
  trainingPhase:       TrainingPhase;
  progressionLevel:    ProgressionLevel;

  // ── Physiological profile (from profileStore) ───────────────────────────────
  calibration:             CalibrationOutput | null;
  fatigueSensitivity:      number;     // 0.5–2.0
  recoveryResponsiveness:  number;     // 0.5–2.0
  returningFromInjury:     boolean;

  // ── Onboarding preferences ──────────────────────────────────────────────────
  availableDays:    TrainingDay[];
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
  metadata: {
    trainingPhase:    TrainingPhase;
    progressionLevel: ProgressionLevel;
    weeklyMileage:    number;
    currentWeek:      number;
    weeksToRace:      number;
    generatedAt:      number;
  };
};

// ─── Engine ───────────────────────────────────────────────────────────────────

export function buildWeekPlan(input: EngineInput): WeekPlan {
  // Compute weeks to race from periodization plan
  const plan        = buildPeriodizationPlan(input.goalRace, input.weeklyMileage);
  const weeksToRace = Math.max(0, plan.totalWeeks - input.currentWeek + 1);

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
    trainingPhase:          input.trainingPhase,
    progressionLevel:       input.progressionLevel,
    weeklyMileage:          input.weeklyMileage,
    currentWeek:            input.currentWeek,
    goalRace:               input.goalRace,
    weeksToRace,
    recentIntensityDist:    input.recentIntensityDist,
    recentHardSessions:     input.recentHardSessions,
    adherenceRate:          input.adherenceRate,
    consistencyScore:       input.consistencyScore,
    longRunConsistency:     input.longRunConsistency,
    trainingStyle:          input.trainingStyle,
    availableDays:          input.availableDays,
    temperatureCelsius:     input.temperatureCelsius,
    altitudeMeters:         input.altitudeMeters,
  };

  const richWeek = generateRichWeek(workoutInput);

  // ── Strength sessions ─────────────────────────────────────────────────────
  const strengthInput: StrengthEngineInput = {
    trainingPhase:    input.trainingPhase,
    progressionLevel: input.progressionLevel,
    weeklyMileage:    input.weeklyMileage,
    currentWeek:      input.currentWeek,
    fatigueScore:     input.fatigueScore,
    recoveryScore:    input.recoveryScore,
    soreness:         input.soreness,
    injuryRisk:       input.hasCurrentInjury || input.returningFromInjury,
    acwr:             input.acwr,
    weeksToRace,
    availableTimeMin: 60,
    strengthHistory:  input.strengthHistory,
  };

  const strengthWeek = generateStrengthWeek(strengthInput);

  // ── Calendar mapping ──────────────────────────────────────────────────────
  const weekStartDate = sundayOf(new Date());

  // RichWorkout extends Workout — fully compatible with mapWorkoutsToDates
  const runPlans = mapWorkoutsToDates(
    richWeek.workouts,
    input.availableDays,
    weekStartDate,
    input.completedWorkoutKeys,
    input.currentWeek,
  );

  const runDates      = runPlans.map(p => p.date);
  const strengthPlans = mapStrengthToDates(
    strengthWeek.sessions,
    input.availableDays,
    runDates,
    weekStartDate,
    input.completedStrengthKeys,
    input.currentWeek,
  );

  const calendarMap = mergePlans(runPlans, strengthPlans);

  return {
    richWeek,
    strengthWeek,
    calendarMap,
    weekStartDate,
    weeksToRace,
    metadata: {
      trainingPhase:    input.trainingPhase,
      progressionLevel: input.progressionLevel,
      weeklyMileage:    input.weeklyMileage,
      currentWeek:      input.currentWeek,
      weeksToRace,
      generatedAt:      Date.now(),
    },
  };
}
