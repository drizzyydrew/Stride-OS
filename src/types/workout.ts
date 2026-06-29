// ─── Rich Workout Type System ─────────────────────────────────────────────────
//
// RichWorkout extends the base Workout type with:
//   • Calibration-derived pace ranges (VDOT-backed when profile is set)
//   • Full interval structures (sets, reps, work/rest timing)
//   • Physiological rationale with research citations
//   • Step-by-step execution instructions and real-time cues
//   • Adaptive modification guidance for common execution failures
//   • Workout scoring (load, fatigue cost, adaptation signal strength)
//   • Environmental adjustment layer (heat penalty, altitude penalty)
//
// AI REPLACEMENT HOOK: workoutEngine.generateRichWeek() is the designated
// boundary. It currently produces workouts deterministically from physiological
// constants and VDOT math. A Claude API layer can receive WorkoutEngineInput
// and return an identical RichWeek shape — adding personalized rationale,
// novel session variants, and conversational coaching — without any changes
// to downstream components or stores.

import type { Workout, TrainingPhase, ProgressionLevel, GeneratableWorkoutType, TrainingStyle } from './training';
import type { CalibrationOutput, TrainingDay } from './athlete';

// ─── Workout type taxonomy ────────────────────────────────────────────────────

export type RichWorkoutType =
  | 'easy_run'
  | 'recovery_run'
  | 'long_run'
  | 'progression_run'
  | 'threshold'
  | 'tempo'
  | 'marathon_pace'
  | 'vo2'
  | 'hill_repeats'
  | 'strides'
  | 'fartlek'
  | 'taper_session'
  | 'deload_session'
  | 'cross_training'
  | 'strength'
  | 'mobility'
  | 'rest';

// Maps each rich type to the legacy GeneratableWorkoutType used by adaptWeek.
export const RICH_TO_GENERATABLE: Record<RichWorkoutType, GeneratableWorkoutType> = {
  easy_run:        'easy_run',
  recovery_run:    'recovery_run',
  long_run:        'long_run',
  progression_run: 'threshold',
  threshold:       'threshold',
  tempo:           'threshold',
  marathon_pace:   'easy_run',
  vo2:             'vo2',
  hill_repeats:    'vo2',
  fartlek:         'threshold',
  strides:         'strides',
  taper_session:   'easy_run',
  deload_session:  'recovery_run',
  cross_training:  'recovery_run',
  strength:        'recovery_run',
  mobility:        'recovery_run',
  rest:            'rest',
};

// ─── Pace target ──────────────────────────────────────────────────────────────

// Naming follows PaceZoneEntry convention: min = slower (higher sec), max = faster (lower sec).
// Display order: formatPace(maxSecPerMi)–formatPace(minSecPerMi)/mi  (fast–slow)
export type PaceRange = {
  minSecPerMi: number;   // slower bound (minimum speed)
  maxSecPerMi: number;   // faster bound (maximum speed)
};

// ─── Session structure ────────────────────────────────────────────────────────

export type WorkoutSegment = {
  label:        string;            // "Warmup", "Main Set", "Cooldown"
  duration:     string;            // "15 min", "2 miles"
  paceGuide:    string;            // "9:00–10:00/mi", "Easy/conversational"
  hrZone:       number;            // 1–5
  rpe:          [number, number];  // [low, high] on 1–10 Borg scale
  instructions: string;
};

export type IntervalBlock = {
  setCount:      number;           // total number of intervals
  repsPerSet?:   number;           // for pyramid or ladder sets
  workLabel:     string;           // "4 min" | "800m" | "60s uphill"
  restLabel:     string;           // "3 min jog" | "walk down hill"
  workPaceGuide: string;           // formatted pace target
  workHRZone:    number;           // target HR zone during work interval
  workRPE:       [number, number]; // perceived exertion during work
  restType:      'walk' | 'jog' | 'complete_rest';
  totalWorkMin:  number;           // total minutes of work (excluding rest)
  progressionNote?: string;        // "Add 1 rep each week within this block"
};

// ─── Workout scoring ──────────────────────────────────────────────────────────
//
// AI REPLACEMENT HOOK: scoreWorkout() uses physiological constants today.
// A trained model with HRV, subjective feedback, and performance trajectory
// can produce more accurate fatigue cost and adaptation predictions.

export type WorkoutScore = {
  intendedLoad:         number;  // 0–100 TSS analog; training stress units
  estimatedFatigueCost: number;  // 0–100 expected fatigue score delta
  expectedAdaptation:   number;  // 0–100 strength of positive adaptation signal
  recoveryDemandHours:  number;  // 24 | 36 | 48 | 72
  confidenceScore:      number;  // 0–100 model prediction reliability
  executionDifficulty:  number;  // 0–100 how hard to execute correctly
};

// ─── Environmental adjustment ─────────────────────────────────────────────────
//
// Heat:     Cheuvront & Haymes (2001) — ~1% per °C above 20°C, capped at 6%
// Altitude: Daniels & Gilbert        — ~3% per 1000m above sea level

export type EnvironmentAdjustment = {
  applied:             boolean;
  heatFactor?:         number;     // pace multiplier (e.g. 1.04 = 4% slower)
  altitudeFactor?:     number;     // pace multiplier
  adjustedPaceRange?:  PaceRange;
  durationReduction?:  number;     // minutes removed for heat safety
  note:                string;
};

// ─── Modification guidance ────────────────────────────────────────────────────

export type ModificationGuidance = {
  condition: string;   // "If HR is 10+ bpm above target zone on easy segments"
  action:    string;   // "Reduce pace by 30 sec/mi, shorten to 40 min"
};

// ─── Physiological rationale ──────────────────────────────────────────────────

export type PhysiologicalRationale = {
  adaptation:   string;  // Primary outcome: "Mitochondrial biogenesis"
  mechanism:    string;  // How it works (2–3 sentences)
  timeframe:    string;  // When adaptation becomes measurable
  scienceBasis: string;  // Research citations or validated principles
};

// ─── Rich workout ─────────────────────────────────────────────────────────────

export type RichWorkout = Workout & {
  richType:      RichWorkoutType;
  dayIndex:      number;           // 0–6 position in the week

  // Targets
  paceRange:     PaceRange;
  hrZoneTarget:  number;           // 1–5
  rpeRange:      [number, number]; // [low, high]

  // Execution plan
  warmup:    WorkoutSegment;
  mainSet:   WorkoutSegment[];
  cooldown:  WorkoutSegment;
  intervals?: IntervalBlock;       // present only for structured interval sessions

  // Guidance
  purpose:           string;       // one-sentence what + why
  instructions:      string[];     // ordered execution steps
  executionCues:     string[];     // short real-time reminders
  failureConditions: string[];     // when to stop or abort
  modifications:     ModificationGuidance[];

  // Science
  rationale: PhysiologicalRationale;

  // Scoring and environment
  score:                  WorkoutScore;
  environmentAdjustment?: EnvironmentAdjustment;

  // Progression context within mesocycle block
  progressionNote?: string;        // "Week 2/3: peak threshold block — 2 × 20 min"
};

// ─── Engine input / output ────────────────────────────────────────────────────

export type WorkoutEngineInput = {
  // Calibration (null = use goalRace fallback paces)
  calibration:           CalibrationOutput | null;
  fatigueSensitivity:    number;         // 0.5–2.0 from AthleteProfile
  recoveryResponsiveness: number;
  injuryRisk:            boolean;        // returningFromInjury

  // Physiological state
  fatigueScore:          number;         // 0–100
  recoveryScore:         number;         // 0–100
  soreness:              number | null;  // 1–10
  motivation:            number | null;  // 1–10
  acwr:                  number;

  // Plan context
  trainingPhase:         TrainingPhase;
  progressionLevel:      ProgressionLevel;
  weeklyMileage:         number;
  currentWeek:           number;
  goalRace:              string;
  weeksToRace:           number;

  // History signals
  recentIntensityDist:   { easy: number; moderate: number; hard: number };
  recentHardSessions:    number;    // hard+max sessions in last 7 days
  adherenceRate:         number;    // 0–1
  consistencyScore:      number;    // 0–100
  longRunConsistency:    number;    // 0–1

  // Training preferences (from onboarding)
  trainingStyle?:        TrainingStyle;
  availableDays?:        TrainingDay[];
  runDays?:              TrainingDay[];

  // Environment (optional — omit if unknown)
  temperatureCelsius?:   number;
  altitudeMeters?:       number;
};

export type RichWeek = {
  workouts:     RichWorkout[];
  weekScore: {
    totalIntendedLoad:    number;
    intendedFatigueDelta: number;
    intensityBalance:     { easy: number; moderate: number; hard: number };
    expectedAdaptations:  string[];
  };
  progressionNote: string;
  phaseRationale:  string;
  generatedAt:     number;   // Date.now()
};

// ─── Multi-sport architecture hooks ──────────────────────────────────────────
//
// FUTURE: When StrideOS expands to cycling or triathlon, WorkoutEngineInput
// gains a `sport: 'run' | 'bike' | 'swim'` discriminant. RichWorkoutType
// becomes a tagged union. The builder and engine are split by sport with a
// shared scoring model. No downstream components need changes — they render
// any RichWorkout shape the same way.
//
// FUTURE: Coach review system — RichWorkout gets a `coachApproval?: boolean`
// and `coachNotes?: string` field. The session detail screen shows a badge
// when a coach has reviewed the workout. The engine's AI replacement hook
// can route through coach review before finalizing the week.
