import type {
  GeneratableWorkoutType,
  TrainingPhase,
  ProgressionLevel,
  CompletedWorkoutRecord,
} from './training';

// ─── Trigger types ────────────────────────────────────────────────────────────

// Each trigger maps to one detectable signal from physiology or plan state.
// A trigger can have three severity levels; severity governs how aggressively
// the engine modifies the remaining week.
export type AdaptationTriggerType =
  | 'high_fatigue'          // accumulated training stress above threshold
  | 'low_recovery'          // recovery suppressed below optimal range
  | 'missed_workouts'       // planned sessions skipped without completion
  | 'high_acwr'             // acute/chronic load ratio above safe zone
  | 'high_soreness'         // reported soreness indicates musculoskeletal stress
  | 'overreaching_pattern'  // week's cumulative fatigue delta exceeds safe rate
  | 'plan_deload';           // training plan mandates a reduced-load week

export type AdaptationSeverity = 'mild' | 'moderate' | 'severe';

export type AdaptationTrigger = {
  type:        AdaptationTriggerType;
  severity:    AdaptationSeverity;
  description: string;   // one-line diagnostic shown in the summary card
};

// ─── Change types ─────────────────────────────────────────────────────────────

// Describes WHAT was done to a session. Drives the label and icon in the UI.
export type AdaptationChangeType =
  | 'as_planned'            // no modification
  | 'intensity_downgrade'   // same workout type, lower target intensity (e.g. VO2 → threshold)
  | 'converted_to_easy'     // hard session replaced with easy aerobic run
  | 'converted_to_recovery' // session replaced with very-easy recovery run
  | 'inserted_rest'         // session replaced with full rest
  | 'long_run_reduced'      // long run shortened (type changed to protect key stimulus)
  | 'quality_protected';    // engine considered modification but explicitly kept session intact

// ─── Per-day adaptation record ────────────────────────────────────────────────

export type AdaptationEntry = {
  dayIndex:     number;                  // 0 = Mon … 6 = Sun
  originalType: GeneratableWorkoutType;  // what the plan called for
  adaptedType:  GeneratableWorkoutType;  // what the engine recommends
  change:       AdaptationChangeType;
  reason:       string;                  // one-sentence physiological explanation
};

// ─── Engine input & output ────────────────────────────────────────────────────

// Every field the engine needs — all sourced from stores at call time in the screen.
// Pure in / pure out: no store imports inside adaptWeek.
export type AdaptationContext = {
  originalTypes:     GeneratableWorkoutType[];  // 7-element plan (from plannedWorkouts)
  completedWorkouts: string[];                  // week-scoped completion keys
  currentWeek:       number;
  fatigueScore:      number;   // 0–100
  recoveryScore:     number;   // 0–100
  soreness:          number | null;   // 1–10; null if athlete hasn't checked in
  acwr:              number;   // acute/chronic load ratio from calculateACWR
  trainingPhase:     TrainingPhase;
  progressionLevel:  ProgressionLevel;
  weekHistory:       CompletedWorkoutRecord[];  // filtered to currentWeek
};

export type AdaptationResult = {
  dayTypes:      GeneratableWorkoutType[];  // 7-element adapted plan
  originalTypes: GeneratableWorkoutType[];  // preserved for completion key generation
  entries:       AdaptationEntry[];         // one per day (0–6)
  triggers:      AdaptationTrigger[];       // all detected conditions
  summary:       string;                    // one-sentence human-readable outcome
  appliedCount:  number;                    // sessions whose type actually changed
  missedCount:   number;                    // sessions detected as skipped
};
