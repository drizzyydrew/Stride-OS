import type { TrainingPhase, ProgressionLevel, RaceDistance, PhaseBlock } from './training';

export type { TrainingPhase, ProgressionLevel, RaceDistance };

// ─── Mesocycle Position ────────────────────────────────────────────────────────

export type MesocyclePosition = {
  blockNumber:     number;   // 1-indexed: which 4-week mesocycle block
  weekInBlock:     number;   // 1–4 (4 is always deload)
  isDeload:        boolean;
  isLoadingPeak:   boolean;  // weekInBlock === 3
  blockMultiplier: number;   // 0.90/0.95/1.00/0.65 progressive oscillation
};

// ─── Load Targets ─────────────────────────────────────────────────────────────

export type IntensityTargets = {
  easy:     number;   // fraction (0–1) — includes very_easy
  moderate: number;
  hard:     number;   // includes threshold, vo2, intervals
};

export type LongRunTarget = {
  minMiles:    number;
  targetMiles: number;
  maxMiles:    number;
  pctOfWeekly: number;  // e.g. 0.28 = 28% of weekly mileage
};

export type WeeklyLoadTargets = {
  minMiles:        number;
  targetMiles:     number;
  maxMiles:        number;
  longRun:         LongRunTarget;
  intensity:       IntensityTargets;
  targetLoadRange: [number, number];  // TSS-analog min/max
  adaptiveCeiling: number;            // 0.0–1.0 multiplier (1.0 = no restriction)
  ceilingReason?:  string;
};

// ─── Safeguards ───────────────────────────────────────────────────────────────

export type ProgressionSafeguardType =
  | 'mileage_jump'
  | 'intensity_stacking'
  | 'long_run_cap'
  | 'insufficient_recovery';

export type ProgressionSafeguard = {
  type:           ProgressionSafeguardType;
  severity:       'warning' | 'critical';
  message:        string;
  recommendation: string;
};

// ─── Phase Integrity ──────────────────────────────────────────────────────────

export type PhaseIntegrityFlagType =
  | 'taper_preserved'
  | 'deload_enforced'
  | 'acwr_ceiling_applied'
  | 'fatigue_override'
  | 'long_run_capped';

export type PhaseIntegrityFlag = {
  type:      PhaseIntegrityFlagType;
  message:   string;
  protected: boolean;  // true = cannot be overridden
};

// ─── Phase Rationale ──────────────────────────────────────────────────────────

export type PhaseRationale = {
  whyThisPhase:     string;
  adaptationTarget: string;
  successCriteria:  string;
  keyFocus:         string;
};

// ─── Engine I/O ───────────────────────────────────────────────────────────────

export type PeriodizationInput = {
  weeklyMileage:      number;
  currentWeek:        number;
  trainingPhase:      TrainingPhase;
  progressionLevel:   ProgressionLevel;
  goalRace:           string;
  acwr:               number;
  fatigueScore:       number;
  recoveryScore:      number;
  adherenceRate:      number;
  weeksRemaining:     number;
  previousWeekMiles:  number;   // 0 when no history
  recentHardSessions: number;   // count of hard/threshold/vo2 sessions in last 7 days
};

export type PeriodizationOutput = {
  mesocycle:      MesocyclePosition;
  weeklyTargets:  WeeklyLoadTargets;
  safeguards:     ProgressionSafeguard[];
  integrityFlags: PhaseIntegrityFlag[];
  rationale:      PhaseRationale;
  raceDistance:   RaceDistance;
  totalWeeks:     number;
  planPhases:     PhaseBlock[];
};
