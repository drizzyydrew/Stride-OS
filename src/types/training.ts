export type GoalType =
  | 'marathon'
  | 'half_marathon'
  | '10k'
  | '5k'
  | 'general_fitness'
  | 'health'
  | 'return_to_running';

export type StrengthLevel = 'none' | 'beginner' | 'intermediate' | 'advanced';
export type TrainingStyle  = 'polarized' | 'threshold' | 'mixed' | 'base_only';

export type TrainingZone =
  | 'recovery'
  | 'easy'
  | 'aerobic'
  | 'threshold'
  | 'vo2'
  | 'anaerobic';

export type WorkoutType =
  | 'easy_run'
  | 'recovery_run'
  | 'run_walk'
  | 'long_run'
  | 'progression_run'
  | 'tempo'
  | 'threshold'
  | 'marathon_pace'
  | 'vo2'
  | 'hill_repeats'
  | 'fartlek'
  | 'norwegian_4x4'
  | 'intervals'
  | 'strides'
  | 'sprint'
  | 'taper_session'
  | 'deload_session'
  | 'recovery'
  | 'strength'
  | 'cross_training'
  | 'mobility'
  | 'rest';

export type EnergySystem =
  | 'aerobic_power'
  | 'anaerobic_battery'
  | 'processing_power';

export type WorkoutIntensity =
  | 'rest'
  | 'very_easy'
  | 'easy'
  | 'moderate'
  | 'hard'
  | 'max';

// ─── Progression & Periodization Types ───────────────────────────────────────

export type TrainingPhase =
  | 'foundation'
  | 'base'
  | 'aerobic_development'
  | 'threshold'
  | 'vo2'
  | 'race_specific'
  | 'build'
  | 'peak'
  | 'deload'
  | 'taper'
  | 'transition'
  | 'recovery';

export type TrainingFocus =
  | 'Aerobic Capacity'
  | 'Threshold'
  | 'VO₂ Max'
  | 'Running Economy'
  | 'Strength'
  | 'Hypertrophy'
  | 'Power'
  | 'Durability'
  | 'Recovery'
  | 'Race Specific';

export type ProgressionLevel =
  | 'beginner'
  | 'intermediate'
  | 'advanced';

export type RaceDistance =
  | 'marathon'
  | 'half_marathon'
  | '10k'
  | '5k';

export type PhaseBlock = {
  phase: TrainingPhase;
  startWeek: number;
  endWeek: number;
};

export type PeriodizationPlan = {
  raceDistance: RaceDistance;
  totalWeeks: number;
  peakMileage: number;
  phases: PhaseBlock[];
};

// ─── Pace Types ───────────────────────────────────────────────────────────────

export type PaceGuidance = {
  label: string;
  description: string;
  targetPace: string;
};

export type PaceZones = {
  recovery: PaceGuidance;
  easy: PaceGuidance;
  threshold: PaceGuidance;
  vo2: PaceGuidance;
  strides: PaceGuidance;
};

export type GeneratableWorkoutType =
  | 'recovery_run'
  | 'easy_run'
  | 'long_run'
  | 'threshold'
  | 'vo2'
  | 'strides'
  | 'rest';

// ─── Core Workout & Week Types ────────────────────────────────────────────────

export type Workout = {
  id: string;

  title: string;
  description: string;

  type: WorkoutType;
  zone: TrainingZone;

  durationMinutes: number;
  targetDistance?: number;

  energySystem: EnergySystem;

  recoveryCost: number;
  fatigueScore: number;

  completed: boolean;

  intensity: WorkoutIntensity;
  paceGuidance: PaceGuidance;
};

export type TrainingWeek = {
  id: string;

  weekNumber: number;
  trainingPhase: TrainingPhase;

  totalMileage: number;

  plannedWorkouts: Workout[];

  isDeloadWeek: boolean;
};

export type ReadinessState = {
  recoveryScore: number;
  fatigueScore: number;

  readinessLabel:
    | 'high'
    | 'moderate'
    | 'low';

  recommendedIntensity:
    | 'hard'
    | 'moderate'
    | 'easy'
    | 'recovery';
};

// ─── Workout History ──────────────────────────────────────────────────────────

// One record per logged workout. Persisted in workoutStore history array.
// All fields are required — workoutStore.onRehydrateStorage backfills defaults
// for records written before this schema existed.
export type WorkoutLogSource = 'generated' | 'manual';

export type CompletedWorkoutRecord = {
  id:                     string;           // week-scoped key: "w1_easy_run_0"
  workoutId:              string;           // raw workout.id from generator: "easy_run"
  type:                   WorkoutType;
  intensity:              WorkoutIntensity;
  durationMinutes:        number;
  estimatedLoad:          number;           // TSS-analog: durationMinutes × intensity factor
  estimatedDistanceMiles: number;           // derived from duration + intensity pace table
  timestamp:              number;           // Date.now() at completion
  week:                   number;           // currentWeek at completion
  completed:              true;             // discriminant — all persisted records are complete
  fatigueBefore:          number;           // fatigueScore snapshot before this workout
  fatigueAfter:           number;           // fatigueScore snapshot after this workout
  fatigueDelta:           number;           // fatigueAfter − fatigueBefore (negative = recovery)
  recoveryBefore:         number;           // recoveryScore snapshot before this workout
  recoveryDelta:          number;           // workout's contribution to recovery change

  // Extended fields — optional for backward compatibility with existing stored records
  actualDurationMinutes?: number;           // what was actually done (may differ from planned)
  actualDistanceMiles?:   number;           // measured distance
  routeCoordinates?:      { lat: number; lng: number; timestamp: number }[];
  rpe?:                   number;           // 1–10 actual perceived exertion
  notes?:                 string;           // free-text athlete notes
  source?:                WorkoutLogSource; // how the record was created
  skipped?:               boolean;          // true when session was skipped (not a real completion)
  skippedReason?:         string;
};

export type WorkoutGeneratorInput = {
  weeklyMileage: number;
  recoveryScore: number;
  fatigueScore: number;
  goalRace: string;
  currentWeek: number;
  trainingPhase: TrainingPhase;
  progressionLevel: ProgressionLevel;
};
