import type { TrainingPhase } from './training';

// ─── Per-week aggregate ───────────────────────────────────────────────────────

/** One row of derived signals per training week. Built from CompletedWorkoutRecord[]. */
export type WeeklySnapshot = {
  week:            number;
  // Readiness (averaged across all sessions that week)
  avgFatigue:      number;   // mean fatigueAfter
  avgRecovery:     number;   // mean recoveryBefore
  peakFatigue:     number;   // worst single-session fatigueAfter
  minRecovery:     number;   // worst single-session recoveryBefore
  // Load
  totalLoad:       number;   // Σ estimatedLoad (TSS-analog)
  totalMiles:      number;   // Σ estimatedDistanceMiles
  sessionCount:    number;
  adherence:       number;   // sessionCount / 6, capped 1.0 (target = 6 sessions/wk)
  // Effort perception
  avgFatigueDelta: number;   // mean |fatigueDelta| per session — proxy for per-session stress
  avgRPE:          number;   // mean RPE from postWorkoutNotes (0 when none logged)
  // Training load ratio
  acwr:            number;   // ATL(1wk) / CTL(6wk avg) computed at end of week
};

// ─── Per-metric longitudinal analysis ────────────────────────────────────────

export type TrendDirection = 'improving' | 'worsening' | 'stable';

export type TimelineMetric = {
  values:      number[];   // raw weekly values, oldest first
  rollingAvg:  number[];   // 3-week rolling average aligned to values
  slope:       number;     // OLS slope across all available points (units/week)
  slopeRecent: number;     // OLS slope of the last 4 points (near-term direction)
  hasSpike:    boolean;    // last point deviates > 1.5σ from its local rolling avg
  direction:   TrendDirection;
};

// ─── Detected patterns ────────────────────────────────────────────────────────

export type TimelineSignalType =
  | 'hidden_fatigue'         // fatigue rising while recovery appears acceptable
  | 'recovery_stagnation'    // recovery not rebounding despite falling fatigue
  | 'improving_adaptation'   // supercompensation: fatigue↓ + recovery↑ sustained
  | 'taper_freshness'        // taper phase: sharp fatigue drop + recovery rise
  | 'chronic_inconsistency'  // high adherence variance across ≥ 4 weeks
  | 'acwr_spike'             // sudden ACWR jump past 1.3 threshold
  | 'effort_creep';          // per-session fatigue delta rising week-over-week

export type TimelineSignalSeverity = 'positive' | 'warning' | 'critical' | 'info';

export type TimelineSignal = {
  type:         TimelineSignalType;
  severity:     TimelineSignalSeverity;
  title:        string;
  whatChanged:  string;
  whyItMatters: string;
  whatNext:     string;
  weeksActive:  number;
};

// ─── Overall interpretation ───────────────────────────────────────────────────

export type OverallState = 'thriving' | 'adapting' | 'stressed' | 'at_risk';

export type TimelineInterpretation = {
  headline:     string;
  whatChanged:  string;
  whyItMatters: string;
  whatNext:     string;
  overallState: OverallState;
};

// ─── Full analysis result ─────────────────────────────────────────────────────

export type TimelineAnalysis = {
  snapshots:      WeeklySnapshot[];
  fatigue:        TimelineMetric;
  recovery:       TimelineMetric;
  load:           TimelineMetric;
  adherence:      TimelineMetric;
  acwr:           TimelineMetric;
  signals:        TimelineSignal[];
  interpretation: TimelineInterpretation;
  hasEnoughData:  boolean;   // true when ≥ 3 weeks of history exist
};

export type TimelineInput = {
  trainingPhase: TrainingPhase;
  currentWeek:   number;
  fatigueScore:  number;
  recoveryScore: number;
};
