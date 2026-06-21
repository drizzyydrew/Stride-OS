// ─── Strength Training Type System ────────────────────────────────────────────
//
// Covers the full lifecycle: exercise library → session generation → execution
// → logging → analytics → coach integration.
//
// Movement patterns follow Boyle's Joint-by-Joint approach (2009) adapted
// for endurance athletes: compound lower-body patterns (squat, hinge, lunge)
// dominate; upper body and core serve injury resilience and running economy.
//
// AI REPLACEMENT HOOK: strengthEngine.generateStrengthWeek() is the designated
// boundary. A Claude call can receive StrengthEngineInput and return an identical
// StrengthWeek — adding periodized progressions, personalised loading, and
// athlete-specific rationale — without any changes to downstream stores or UI.

// ─── Movement patterns ────────────────────────────────────────────────────────

export type MovementPattern =
  | 'squat'
  | 'hinge'
  | 'lunge'
  | 'push'
  | 'pull'
  | 'carry'
  | 'trunk'
  | 'calf_ankle'
  | 'plyometric'
  | 'mobility';

// ─── Strength goals ───────────────────────────────────────────────────────────

export type StrengthGoal =
  | 'force_production'
  | 'hypertrophy'
  | 'tendon_capacity'
  | 'running_economy'
  | 'injury_resilience'
  | 'power'
  | 'maintenance'
  | 'deload'
  | 'taper_support';

// ─── Session type ─────────────────────────────────────────────────────────────

export type StrengthSessionType =
  | 'full_body'
  | 'lower_power'
  | 'running_economy'
  | 'prehab'
  | 'activation';

// ─── Exercise definition (static library entry) ───────────────────────────────

export type EquipmentOption = 'barbell' | 'dumbbell' | 'bodyweight' | 'machine' | 'band' | 'kettlebell';

export type Exercise = {
  id:               string;
  name:             string;
  pattern:          MovementPattern;
  equipment:        EquipmentOption[];
  unilateral:       boolean;   // true = single-leg / single-arm
  cnsLoad:          'low' | 'medium' | 'high';
  coachingCues:     string[];
  contraindications: string[];  // injury conditions making this exercise risky
  rationale:        string;    // running-specific benefit (1–2 sentences)
};

// ─── Planned exercise (within a session) ─────────────────────────────────────

export type PlannedExercise = {
  exerciseId:       string;
  exercise:         Exercise;
  sets:             number;
  repRange:         [number, number];  // [min, max]
  loadTarget:       string;           // "Bodyweight", "60–70% 1RM", "RPE 7"
  rpe:              number;
  rir:              number;           // reps in reserve
  tempo:            string;           // "3:1:1" = eccentric:pause:concentric
  restSeconds:      number;
  progressionRule:  string;           // "Add 1 rep/week; then add load when top of range achieved"
  regressionRule:   string;           // "Drop 1 set or reduce load by 10% if unable to maintain form"
  coachingCues:     string[];
  rationale:        string;
  notes?:           string;
};

// ─── Complete strength session ────────────────────────────────────────────────

export type StrengthSession = {
  id:               string;           // stable: "strength_{type}_{weekInBlock}_{index}"
  title:            string;
  goal:             StrengthGoal;
  sessionType:      StrengthSessionType;
  targetDuration:   number;           // minutes
  primaryPatterns:  MovementPattern[];
  exercises:        PlannedExercise[];
  warmupProtocol:   string;
  cooldownProtocol: string;
  purpose:          string;           // one-sentence what + why
  rationale:        string;           // physiological basis (2–3 sentences)
  progressionNote:  string;
};

// ─── Weekly strength plan ─────────────────────────────────────────────────────

export type StrengthWeek = {
  sessions:         StrengthSession[];
  sessionDays:      number[];          // day indices (0=Mon) where sessions are scheduled
  weeklyVolumeSets: number;
  primaryGoal:      StrengthGoal;
  phaseNote:        string;
  phaseRationale:   string;
  generatedAt:      number;
};

// ─── Completed set ────────────────────────────────────────────────────────────

export type CompletedSet = {
  reps:      number;
  load?:     string;    // "60kg", "BW", "RPE 7" — free text
  rpe?:      number;    // 1–10 actual
  completed: boolean;
};

// ─── Completed exercise within a session ─────────────────────────────────────

export type CompletedExercise = {
  exerciseId: string;
  sets:       CompletedSet[];
  notes?:     string;
};

// ─── Per-exercise detail captured during the active workout ──────────────────

export type ExerciseSessionDetail = {
  exerciseId: string;
  weightLb?:  number;   // weight used, stored in lb (convert for metric display)
  status:     'done' | 'skipped' | 'pending';
};

// ─── Strength log record (persisted) ─────────────────────────────────────────
//
// All fields are required. The `migrateStrengthRecord` function in strengthStore
// backfills defaults for records written before a field was added.

export type StrengthLogRecord = {
  id:              string;    // "sw${week}_${sessionId}_${index}"
  sessionId:       string;   // original session id
  sessionType:     StrengthSessionType;
  goal:            StrengthGoal;
  week:            number;
  timestamp:       number;
  completed:       true;     // discriminant — all persisted records are completed
  skipped?:        boolean;
  skippedReason?:  string;

  plannedDuration:  number;
  actualDuration?:  number;
  exercises:        CompletedExercise[];
  exerciseDetails?: ExerciseSessionDetail[];  // per-exercise weights + status
  overallRpe?:      number;
  notes?:           string;
  source:           'generated' | 'manual';

  fatigueBefore:   number;
  fatigueAfter:    number;
  fatigueDelta:    number;
  estimatedLoad:   number;  // sets × avg_reps × rpe_factor — strength TSS analog
};

// ─── Engine input ─────────────────────────────────────────────────────────────

export type StrengthEngineInput = {
  trainingPhase:    import('./training').TrainingPhase;
  progressionLevel: import('./training').ProgressionLevel;
  weeklyMileage:    number;
  currentWeek:      number;
  fatigueScore:     number;
  recoveryScore:    number;
  soreness:         number | null;  // 1–10
  injuryRisk:       boolean;
  acwr:             number;
  weeksToRace:      number;
  availableTimeMin: number;         // max session duration in minutes (default 60)
  strengthHistory:  StrengthLogRecord[];
};

// ─── Strength coach insight input ─────────────────────────────────────────────

export type StrengthCoachInput = {
  trainingPhase:           import('./training').TrainingPhase;
  fatigueScore:            number;
  recoveryScore:           number;
  soreness:                number | null;
  acwr:                    number;
  weeklyMileage:           number;
  strengthSessionsThisWeek: number;
  plannedStrengthSessions: number;
  weeksToRace:             number;
  strengthHistory:         StrengthLogRecord[];
};
