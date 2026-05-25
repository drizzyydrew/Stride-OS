// ─── Athlete Profile & Calibration Types ──────────────────────────────────────
//
// ARCHITECTURE NOTE: AthleteProfile is keyed by athleteId to make future
// multi-athlete support a store-level concern only. All UI and utility code
// goes through the active-profile selector and never hard-codes a single athlete.
//
// AI REPLACEMENT HOOK: CalibrationOutput is the designated AI handoff boundary.
// The calibration engine produces this shape deterministically today. A future AI
// layer (Claude API) can produce the same shape from richer contextual inputs —
// natural-language race descriptions, subjective feedback, device sensor data —
// without any changes to the downstream consumers of CalibrationOutput.

import type { RaceDistance, TrainingPhase } from './training';

// ─── Demographic ──────────────────────────────────────────────────────────────

export type Sex = 'male' | 'female' | 'non_binary' | 'prefer_not_to_say';

export type TrainingDay = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';

// ─── Race history ─────────────────────────────────────────────────────────────

export const STANDARD_DISTANCE_METERS: Partial<Record<string, number>> = {
  marathon:      42195,
  half_marathon: 21097.5,
  '10k':         10000,
  '5k':          5000,
  '1_mile':      1609.344,
  '800m':        800,
};

export type StandardDistance = 'marathon' | 'half_marathon' | '10k' | '5k' | '1_mile' | '800m';

export type RacePR = {
  id:             string;
  distanceKey:    StandardDistance | 'custom';  // for VDOT lookup
  distanceLabel:  string;                        // "Marathon", "5K", custom string
  distanceMeters: number;
  timeSeconds:    number;
  date:           string;   // "YYYY-MM-DD"
  course?:        string;
  official:       boolean;  // race result vs. training time-trial
};

// ─── Injury history ───────────────────────────────────────────────────────────

export type InjuryBodyPart =
  | 'knee' | 'hip' | 'ankle' | 'foot' | 'shin' | 'calf'
  | 'hamstring' | 'quad' | 'achilles' | 'back' | 'it_band' | 'other';

export type InjurySeverity = 'minor' | 'moderate' | 'major';

export type InjuryRecord = {
  id:          string;
  bodyPart:    InjuryBodyPart;
  description: string;
  severity:    InjurySeverity;
  startDate:   string;   // "YYYY-MM-DD"
  resolved:    boolean;
  resolvedDate?: string;
};

// ─── Calibration output ───────────────────────────────────────────────────────

export type CalibrationSource = 'race_pr' | 'threshold_test' | 'estimated' | 'default';

export type CalibrationConfidence = 'high' | 'moderate' | 'low' | 'estimated';

// Pace zone with both pace bounds and the corresponding HR zone.
export type PaceZoneEntry = {
  label:       string;   // "Easy", "Threshold", etc.
  description: string;
  minSecPerMi: number;   // slower bound (higher number = slower)
  maxSecPerMi: number;   // faster bound
  hrZone:      number;   // 1–5
  rpeRange:    [number, number];  // [low, high] on 1–10 Borg scale
};

export type HRZoneEntry = {
  zone:     number;   // 1–5
  label:    string;   // "Recovery", "Aerobic", "Tempo", "Threshold", "VO2 Max"
  minBPM:   number | null;
  maxBPM:   number | null;
  minPct:   number;   // % of HRmax
  maxPct:   number;
  rpeRange: [number, number];
};

export type CalibrationOutput = {
  // Derived fitness
  vdot:             number;
  estimatedHRMax:   number | null;   // only set when computed from age/threshold

  // Zones
  paceZones:        Record<string, PaceZoneEntry>;
  hrZones:          HRZoneEntry[];

  // Calibration metadata
  confidenceScore:    number;            // 0–100
  confidenceLabel:    CalibrationConfidence;
  primarySource:      CalibrationSource;
  staleDays:          number;            // days since any calibration update
  missingInputs:      string[];          // items that would improve confidence
  lastCalibratedAt:   number;            // unix ms timestamp

  // Fitness state signals
  fitnessImprovements: string[];         // detected upward trends
  deconditioningFlags: string[];         // gaps, drops, risk signals

  // Sensitivity multipliers — applied by athleteStore / recommendation engine
  fatigueMultiplier:  number;   // 1.0 = baseline; >1.0 = more sensitive
  recoveryMultiplier: number;   // 1.0 = baseline; >1.0 = recovers faster
};

// ─── Readiness thresholds (calibration-adjusted) ──────────────────────────────
//
// Used by the recommendation engine to interpret fatigue/recovery signals.
// Athletes with higher fatigue sensitivity hit "high fatigue" at lower absolute
// values; athletes with faster recovery responsiveness need fewer rest days.

export type ReadinessThresholds = {
  highFatigue:     number;   // default 75
  criticalFatigue: number;   // default 85
  poorRecovery:    number;   // default 50
  criticalRecovery: number;  // default 35
};

// ─── Full athlete profile ─────────────────────────────────────────────────────

export type AthleteProfile = {
  // Identity (multi-athlete key)
  athleteId:   string;
  createdAt:   number;
  updatedAt:   number;

  // Demographics
  name:        string;
  age:         number;
  sex:         Sex;
  heightCm:    number;
  weightKg:    number;

  // Training background
  trainingAgeYears:      number;   // years of consistent running/training
  returningFromInjury:   boolean;
  injuryHistory:         InjuryRecord[];

  // Race history
  racePRs:            RacePR[];
  preferredDistances: RaceDistance[];

  // HR data (all nullable — fallback estimates used when missing)
  hrMax:        number | null;   // measured HRmax
  hrResting:    number | null;   // morning resting HR
  hrThreshold:  number | null;   // lactate threshold HR

  // Pace/fitness data
  thresholdPaceSecPerMi: number | null;  // lactate threshold pace
  vo2Estimate:           number;         // mL/kg/min (default: estimated)
  vdot:                  number;         // Jack Daniels VDOT (= VO2max estimate)

  // Physiological sensitivity (tuned over time from athlete feedback)
  fatigueSensitivity:     number;   // 0.5–2.0; 1.0 = baseline
  recoveryResponsiveness: number;   // 0.5–2.0; 1.0 = baseline
  heatSensitivity:        number;   // 0.5–2.0; 1.0 = baseline

  // Environmental context
  altitudeMeters: number;   // 0 = sea level; >1500 = altitude training

  // Scheduling preferences
  availableDays:  TrainingDay[];
  targetSessions: number;   // target sessions/week, 3–7

  // Current calibration (null until first calibration run)
  calibration: CalibrationOutput | null;
};

// ─── Calibration engine input ──────────────────────────────────────────────────
//
// All inputs for a single calibration run. Pure: no side effects, same input
// always produces the same CalibrationOutput.

export type CalibrationInput = {
  profile:            AthleteProfile;
  weeklyMileage:      number;
  currentPhase:       TrainingPhase;
  recentWorkoutCount: number;   // sessions in last 30 days
  lastWorkoutDaysAgo: number;   // 0 = today; for deconditioning detection
  currentFatigueScore:  number;
  currentRecoveryScore: number;
};

// ─── Multi-athlete selectors ──────────────────────────────────────────────────
//
// Helpers that enable multi-athlete support without coupling callers to the
// record structure. When StrideOS adds coach/team accounts, these selectors
// gain a `profileId` param — callers that already use them need no changes.

export type AthleteProfileMap = Record<string, AthleteProfile>;
