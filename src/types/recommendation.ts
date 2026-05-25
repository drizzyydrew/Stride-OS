import type {
  WorkoutIntensity,
  WorkoutType,
  TrainingPhase,
  ProgressionLevel,
  CompletedWorkoutRecord,
} from './training';

// ─── Input ────────────────────────────────────────────────────────────────────

export type RecommendationInput = {
  // Physiological signals (from athleteStore)
  recoveryScore:    number;           // 0–100
  fatigueScore:     number;           // 0–100
  weeklyMileage:    number;
  trainingPhase:    TrainingPhase;
  progressionLevel: ProgressionLevel;

  // Subjective signals (from today's check-in; null when athlete hasn't checked in yet)
  soreness:    number | null;         // 1–10
  motivation:  number | null;         // 1–10

  // Today's plan context (from workout generator)
  plannedType:      WorkoutType;
  plannedIntensity: WorkoutIntensity; // workout.intensity — more reliable than type alone
  plannedDuration:  number;           // minutes

  // Full completion history for ACWR and load-window calculations
  history: CompletedWorkoutRecord[];
};

// ─── Output sub-types ─────────────────────────────────────────────────────────

// Recommended intensity and duration adjustment relative to the day's plan.
export type IntensityRecommendation = {
  recommendedIntensity:       WorkoutIntensity;
  recommendedDurationMinutes: number;

  // How this recommendation relates to what's in the athlete's training plan.
  // 'as_planned'   — proceed as written
  // 'scale_down'   — reduce by ~10–25% (intensity or duration or both)
  // 'scale_up'     — athlete is fresh enough to push slightly harder
  // 'swap_to_easy' — replace a hard session with easy aerobic work
  // 'swap_to_rest' — conditions warrant a full rest day
  adjustmentFromPlan: 'as_planned' | 'scale_down' | 'scale_up' | 'swap_to_easy' | 'swap_to_rest';

  rationale: string;  // one-sentence explanation for the athlete
};

// Priority-ranked recovery guidance with discrete, actionable items.
export type RecoveryRecommendation = {
  priority: 'low' | 'moderate' | 'high' | 'critical';
  actions:  string[];   // ordered from most to least important; max 3
};

// Injury risk assessment. Triggers are always populated when level !== 'none'.
// Based on Gabbett (2016) ACWR thresholds and Meeusen (2013) overreaching markers.
export type InjuryRiskWarning = {
  level:    'none' | 'elevated' | 'high';
  triggers: string[];   // diagnostic strings for each tripped condition
  advice:   string;
};

// Deload recommendation. 'urgency' drives visual severity in the UI.
export type DeloadRecommendation = {
  shouldDeload: boolean;
  urgency:      'none' | 'suggested' | 'recommended' | 'mandatory';
  rationale:    string;
};

// ─── Top-level output ─────────────────────────────────────────────────────────

export type TrainingRecommendation = {
  // Composite readiness (0–100): weighted blend of recovery, inverse fatigue,
  // inverse soreness, and motivation. Drives intensity and deload decisions.
  readinessScore:   number;
  overallReadiness: 'peak' | 'good' | 'fair' | 'poor';

  intensity:  IntensityRecommendation;
  recovery:   RecoveryRecommendation;
  injuryRisk: InjuryRiskWarning;
  deload:     DeloadRecommendation;
};
