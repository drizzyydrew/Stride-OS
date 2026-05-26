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

// ─── Zone calculation method ──────────────────────────────────────────────────
//
// Controls which zone system is displayed and used for comparison mode.
//   tanaka_karvonen — estimated HRmax (Tanaka 2001) + Karvonen HRR method
//   manual_karvonen — user-entered HRmax + Karvonen HRR method
//   threshold       — 7-zone system from LTHR + threshold pace (Joe Friel)
//   vdot            — Jack Daniels VDOT pace zones
//   race_prediction — VDOT-derived race time predictions

export type ZoneMethod =
  | 'tanaka_karvonen'
  | 'manual_karvonen'
  | 'threshold'
  | 'vdot'
  | 'race_prediction';

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

// ─── Threshold field test ─────────────────────────────────────────────────────
//
// Joe Friel 30-minute threshold field test protocol:
//   Run as hard as possible for 30 minutes. Record average HR and pace
//   for the LAST 20 minutes (first 10 minutes are warm-up / settling).
//   Last-20-min avg HR = Lactate Threshold HR (LTHR).
//   Last-20-min avg pace = Functional Threshold Pace.

export type ThresholdTestData = {
  id:                        string;
  date:                      string;   // "YYYY-MM-DD"
  avgHRLastTwentyMin:        number;   // bpm — becomes LTHR
  avgPaceSecPerMiLastTwenty: number;   // sec/mi — becomes threshold pace
  notes?:                    string;
};

// ─── MAF test record ──────────────────────────────────────────────────────────
//
// MAF (Maximum Aerobic Function) is used ONLY for aerobic efficiency trending
// and base development tracking. It is NOT a primary prescription system.
// MAF HR = 180 − age (± adjustments per Maffetone protocol).

export type MAFTestRecord = {
  id:              string;
  date:            string;   // "YYYY-MM-DD"
  mafHR:           number;   // target MAF heart rate
  distanceMiles:   number;
  durationMin:     number;
  avgPaceSecPerMi: number;
  hrDriftBPM:      number;   // HR difference between first and second half (lower = better)
  notes?:          string;
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

// ─── Calibration output types ─────────────────────────────────────────────────

export type CalibrationSource = 'race_pr' | 'threshold_test' | 'estimated' | 'default';

export type CalibrationConfidence = 'high' | 'moderate' | 'low' | 'estimated';

// Pace zone with both pace bounds and the corresponding HR zone.
export type PaceZoneEntry = {
  label:       string;   // "Easy", "Threshold", etc.
  description: string;
  minSecPerMi: number;   // faster bound (lower value = faster)
  maxSecPerMi: number;   // slower bound (higher value = slower)
  hrZone:      number;   // 1–5
  rpeRange:    [number, number];  // [low, high] on 1–10 Borg scale
};

export type HRZoneEntry = {
  zone:     number;   // 1–5
  label:    string;   // "Recovery", "Aerobic", "Tempo", "Threshold", "VO2 Max"
  minBPM:   number | null;
  maxBPM:   number | null;
  minPct:   number;   // % of HRmax (for Friel) or % HRR (for Karvonen display)
  maxPct:   number;
  rpeRange: [number, number];
};

// Threshold-based zone entry (Friel 7-zone system for runners).
// Zones derived from % of Functional Threshold Pace speed and % of LTHR.
export type ThresholdZoneEntry = {
  zone:    string;   // '1', '2', '3', '4', '5a', '5b', '5c'
  label:   string;
  description: string;
  // Pace bounds (expressed as % of threshold speed; higher % = faster)
  paceMinSpeedPct: number;   // 0 = open (zone 1 has no lower speed bound)
  paceMaxSpeedPct: number;   // 0 = open (zone 5c has no upper speed bound)
  paceMinSecPerMi: number | null;   // faster end (lower value); null = no bound
  paceMaxSecPerMi: number | null;   // slower end (higher value); null = no bound
  // HR bounds (% of LTHR)
  hrMinPct: number;   // 0 = open lower
  hrMaxPct: number;   // 0 = open upper
  hrMinBPM: number | null;
  hrMaxBPM: number | null;
  rpeRange: [number, number];
};

// VDOT-derived race time prediction
export type RaceTimePrediction = {
  distance:     string;   // "1 Mile", "5K", etc.
  distanceKey:  string;
  distanceMeters: number;
  predictedSeconds: number;
};

export type CalibrationOutput = {
  // Derived fitness
  vdot:             number;
  estimatedHRMax:   number | null;   // only set when computed from age/threshold

  // Primary zones (VDOT / Friel 5-zone HR)
  paceZones:        Record<string, PaceZoneEntry>;
  hrZones:          HRZoneEntry[];

  // Additional zone systems (null when inputs unavailable)
  karvonenZones:    HRZoneEntry[] | null;    // Karvonen HRR (needs restingHR + hrMax)
  thresholdZones:   ThresholdZoneEntry[] | null;  // 7-zone (needs LTHR + threshold pace)

  // Race time predictions from VDOT
  racePredictions:  RaceTimePrediction[] | null;

  // Source attribution
  hrMaxSource:      string;    // "Estimated: Tanaka 2001" | "Measured" | etc.
  activeZoneMethod: ZoneMethod;

  // Calibration metadata
  confidenceScore:    number;            // 0–100
  confidenceLabel:    CalibrationConfidence;
  primarySource:      CalibrationSource;
  staleDays:          number;
  missingInputs:      string[];
  lastCalibratedAt:   number;

  // Fitness state signals
  fitnessImprovements: string[];
  deconditioningFlags: string[];

  // Sensitivity multipliers
  fatigueMultiplier:  number;
  recoveryMultiplier: number;
};

// ─── Readiness thresholds ──────────────────────────────────────────────────────

export type ReadinessThresholds = {
  highFatigue:     number;   // default 75
  criticalFatigue: number;   // default 85
  poorRecovery:    number;   // default 50
  criticalRecovery: number;  // default 35
};

// ─── Full athlete profile ─────────────────────────────────────────────────────

export type AthleteProfile = {
  // Identity
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
  trainingAgeYears:      number;
  returningFromInjury:   boolean;
  injuryHistory:         InjuryRecord[];

  // Race history
  racePRs:            RacePR[];
  preferredDistances: RaceDistance[];

  // HR data
  hrMax:        number | null;   // measured HRmax
  hrMaxManual:  boolean;         // true = use hrMax directly; false = Tanaka estimate
  hrResting:    number | null;   // morning resting HR (needed for Karvonen)
  hrThreshold:  number | null;   // lactate threshold HR (from threshold test)

  // Threshold field test (Joe Friel 30-min protocol)
  thresholdTest: ThresholdTestData | null;

  // MAF aerobic tracking (not primary prescription)
  mafTests: MAFTestRecord[];

  // Pace/fitness data
  thresholdPaceSecPerMi: number | null;
  vo2Estimate:           number;
  vdot:                  number;

  // Zone display preference
  activeZoneMethod: ZoneMethod;

  // Physiological sensitivity
  fatigueSensitivity:     number;
  recoveryResponsiveness: number;
  heatSensitivity:        number;

  // Environmental context
  altitudeMeters: number;

  // Scheduling preferences
  availableDays:  TrainingDay[];
  targetSessions: number;

  // Current calibration
  calibration: CalibrationOutput | null;
};

// ─── Calibration engine input ──────────────────────────────────────────────────

export type CalibrationInput = {
  profile:            AthleteProfile;
  weeklyMileage:      number;
  currentPhase:       TrainingPhase;
  recentWorkoutCount: number;
  lastWorkoutDaysAgo: number;
  currentFatigueScore:  number;
  currentRecoveryScore: number;
};

// ─── Multi-athlete selectors ──────────────────────────────────────────────────

export type AthleteProfileMap = Record<string, AthleteProfile>;
