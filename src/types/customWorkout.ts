// ─── Custom Workout Logging Types ────────────────────────────────────────────
//
// Supports logging from any screen (Today, Training, Strength, Calendar).
// Integrates with athleteStore for fatigue/recovery updates.
// All business logic lives in src/utils/customWorkoutEngine.ts.

export type CustomWorkoutCategory =
  | 'running'
  | 'strength'
  | 'cross_training'
  | 'mobility'
  | 'other';

export type RunWorkoutType =
  | 'easy'
  | 'recovery'
  | 'long_run'
  | 'intervals'
  | 'tempo'
  | 'threshold'
  | 'marathon_pace'
  | 'vo2'
  | 'hills'
  | 'fartlek'
  | 'race'
  | 'time_trial';

export type StrengthFocus =
  | 'upper'
  | 'lower'
  | 'core'
  | 'full_body'
  | 'power'
  | 'tendon_capacity'
  | 'mobility_prehab';

export type CrossTrainingType =
  | 'bike'
  | 'swim'
  | 'ski'
  | 'row'
  | 'elliptical'
  | 'hike'
  | 'walk'
  | 'other';

// ─── Sub-structures ───────────────────────────────────────────────────────────

export type SetEntry = {
  reps?:     number;
  load?:     string;   // free text: "60 kg", "BW", "RPE 7"
  rpe?:      number;   // 1–10 actual RPE
  completed: boolean;
};

export type ExerciseLogEntry = {
  exerciseName: string;
  exerciseId?:  string;   // links to exercise library if available
  sets:         SetEntry[];
  notes?:       string;
};

export type IntervalEntry = {
  reps:                number;
  workDurationSec?:    number;
  workDistanceMi?:     number;
  recoveryDurationSec?: number;
  recoveryDistanceMi?: number;
  paceTarget?:         string;   // "7:30/mi", "5K pace"
  rpe?:                number;
};

// ─── Override record ─────────────────────────────────────────────────────────
//
// Stored when user explicitly trains against readiness recommendation.
// Used for coach insights and long-term readiness trend analysis.

export type OverrideRecord = {
  id:              string;
  date:            string;      // "YYYY-MM-DD"
  createdAt:       number;      // Date.now()
  acknowledged:    true;        // always true — requires explicit check
  readinessScore:  number;
  fatigueScore:    number;
  category:        CustomWorkoutCategory;
  runType?:        RunWorkoutType;
  reason?:         string;      // optional user-entered reason
  loggedWorkoutId?: string;     // links to resulting CustomWorkoutLog
};

// ─── Main log record ─────────────────────────────────────────────────────────

export type CustomWorkoutLog = {
  id:           string;
  category:     CustomWorkoutCategory;
  date:         string;         // "YYYY-MM-DD"
  completedAt:  number;         // Date.now()
  source:       'custom' | 'backdated' | 'override';
  overrideId?:  string;

  // ── Running ──────────────────────────────────────────────────────────────
  runType?:         RunWorkoutType;
  durationMinutes?: number;
  distanceMiles?:   number;
  rpe?:             number;
  notes?:           string;
  intervals?:       IntervalEntry[];

  // ── Strength ─────────────────────────────────────────────────────────────
  strengthFocus?:         StrengthFocus;
  exercises?:             ExerciseLogEntry[];
  strengthDurationMin?:   number;

  // ── Cross-training ───────────────────────────────────────────────────────
  crossTrainingType?:     CrossTrainingType;
  crossDurationMin?:      number;
  crossDistanceMiles?:    number;

  // ── Mobility / other ─────────────────────────────────────────────────────
  mobilityDurationMin?:   number;
  otherDurationMin?:      number;

  // ── Computed (set by engine) ──────────────────────────────────────────────
  estimatedLoad:  number;   // TSS-analog: 0–200+
  fatigueImpact:  number;   // fatigue score contribution: 0–20
};

export type CustomRunBuilderType = 'fartlek' | 'tempo' | 'intervals' | 'long_run_strides' | 'custom_segments';

export type CustomRunSegmentKind = 'run' | 'recovery' | 'warmup' | 'cooldown';
export type CustomRunSegmentTarget = 'time' | 'distance';

export type CustomRunSegment = {
  id: string;
  label: string;
  kind: CustomRunSegmentKind;
  target: CustomRunSegmentTarget;
  durationMinutes?: number;
  distanceMiles?: number;
  targetPaceSecPerMile?: number;
  targetHrZone?: 1 | 2 | 3 | 4 | 5;
};

export type CustomRunParameters = {
  fartlekMin: number;
  warmupMi: number;
  tempoMi: number;
  cooldownMi: number;
  ivWarmupMi: number;
  ivReps: number;
  ivWorkMi: number;
  ivRestMin: number;
  ivCooldownMi: number;
  lrDistanceMi: number;
  lrStrides: number;
};

/** A reusable planned workout. Unlike CustomWorkoutLog, saving this record does
 * not mark exercise complete or change fatigue/load history. */
export type CustomRunDefinition = {
  id: string;
  name: string;
  runType: CustomRunBuilderType;
  durationMinutes: number;
  distanceMiles: number;
  segmentSummary: string;
  parameters: CustomRunParameters;
  structuredSegments?: CustomRunSegment[];
  createdAt: number;
  updatedAt: number;
};
