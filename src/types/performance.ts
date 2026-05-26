// ─── Performance System Types ───────────────────────────────────────────────
//
// Eight dynamic performance dimensions, each scored 0–100.
// Scores are deterministic, derived from local data only.
// Confidence degrades when training data is sparse.

export type PerformanceDimensionKey =
  | 'aerobic_power'
  | 'anaerobic_battery'
  | 'fatigue_resistance'
  | 'durability'
  | 'movement_capacity'
  | 'recovery_capacity'
  | 'threshold_efficiency'
  | 'running_economy';

export type PerformanceConfidence = 'high' | 'moderate' | 'low' | 'estimated';

export type PerformanceDimension = {
  key:           PerformanceDimensionKey;
  label:         string;
  score:         number;              // 0–100
  previousScore?: number;            // last computed value for delta display
  delta?:         number;            // score change (positive = improving)
  confidence:     PerformanceConfidence;
  source:         string;            // which data drove this score
  rationale:      string;            // "why this changed" explanation
  missingData?:   string[];          // what would improve confidence
  lastUpdatedAt:  number;            // timestamp
};

export type PerformanceProfile = {
  dimensions:       PerformanceDimension[];
  overallScore:     number;          // weighted average
  lastCalculatedAt: number;
  dataQuality:      'high' | 'moderate' | 'low' | 'insufficient';
};

// Input contract for the performance engine.
// All fields optional so the engine degrades gracefully.
export type PerformanceEngineInput = {
  history:           CompletedWorkoutSummary[];
  fatigueScore:      number;
  recoveryScore:     number;
  weeklyMileage:     number;
  vdot?:             number;
  lthr?:             number;
  thresholdPaceSec?: number;
  activeRiskFlags:   ActiveRiskFlagSummary[];
  checkInCount:      number;         // number of daily check-ins logged
  previousProfile?:  PerformanceProfile;
};

// Minimal workout summary for the engine (avoids importing full types)
export type CompletedWorkoutSummary = {
  type:       string;
  intensity:  string;
  estimatedLoad: number;
  timestamp:  number;
  completed:  boolean;
  week:       number;
};

// Minimal risk flag summary for the engine
export type ActiveRiskFlagSummary = {
  severity:      'low' | 'moderate' | 'high';
  affectsScores: string[];
};
