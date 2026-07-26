/** The short, daily check-in used to guide (not prescribe) today's training. */
export type ReadinessInputs = {
  sleepHours: number;
  sleepMinutes: number;
  /** 1 = very poor, 5 = excellent. */
  sleepQuality: number;
  /** 1 = very fatigued, 5 = fresh. */
  bodyStatus: number;
  /** 1 = very low energy, 5 = high energy. */
  energy: number;
  /** 1 = very high stress, 5 = very low stress. */
  stress: number;
  optionalFactor?: string;
};

/** Values retained from the original six-question check-in. Never backfilled. */
export type LegacyReadinessInputs = {
  sleepQuality?: number;
  energy?: number;
  stress?: number;
  soreness?: number;
  motivation?: number;
  trainingWillingness?: number;
};

export type ReadinessLabel =
  | 'Ready to Train'
  | 'Mostly Ready'
  | 'Take It Easier Today'
  | 'Recovery Recommended';

export type ReadinessDetails = {
  label: ReadinessLabel;
  message: string;
  reasons: string[];
  baselineSleepMinutes: number;
  baselineSource: 'personal_28_day' | 'starter_fallback';
  sleepContribution: number;
  sleepDurationContribution: number;
  sleepQualityContribution: number;
  bodyContribution: number;
  energyContribution: number;
  stressContribution: number;
  trainingRecoveryContribution: number;
  differenceFromBaselineMinutes: number;
  sleepDataConfidence: 'personalized' | 'limited_history';
  subjectiveCap?: number;
  overlapPenaltyCap?: number;
  recentTrainingAdjustment: number;
  priorDayAdjustment: number;
  priorDayIntensityAdjustment?: number;
};

export type DailyReadiness = ReadinessInputs & {
  schemaVersion: 4;
  date: string; // "YYYY-MM-DD" — matches todayDateKey() from types/checkin
  score: number; // 0-100, finite and derived from the check-in + available context
  sleepMinutesTotal: number;
  details: ReadinessDetails;
  /** Present only for a safely retained pre-v2 entry. */
  legacyInputs?: LegacyReadinessInputs;
};
