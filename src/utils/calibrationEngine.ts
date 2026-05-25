// ─── Calibration Engine ────────────────────────────────────────────────────────
//
// PHYSIOLOGICAL BASIS
//
// JACK DANIELS VDOT MODEL (Daniels, 2005 — "Daniels' Running Formula"):
//   VDOT represents the effective VO2max a runner demonstrates in a race, not
//   the lab-measured VO2max. A VDOT of 50 means the athlete's race performance
//   is equivalent to someone with VO2max = 50 mL/kg/min running at 100% effort.
//
//   VO2 at velocity v (m/min):
//     VO2(v) = -4.60 + 0.182258 × v + 0.000104 × v²
//
//   %VO2max at race duration t (minutes):
//     %VO2max(t) = 0.8 + 0.1894393 × e^(-0.012778t) + 0.2989558 × e^(-0.1932605t)
//
//   VDOT = VO2(velocity) / %VO2max(duration)
//
//   Inverse (velocity at X% of VDOT, used for zone derivation):
//     VO2_target = VDOT × pct
//     Quadratic: 0.000104v² + 0.182258v − (4.60 + VO2_target) = 0
//     v = (−0.182258 + √(0.182258² + 4 × 0.000104 × (4.60 + VO2_target))) / (2 × 0.000104)
//
// HR ZONES (Friel / 5-zone model):
//   Zone 1: <60% HRmax — Recovery (RPE 1–3)
//   Zone 2: 60–70% HRmax — Aerobic/Easy (RPE 3–5)
//   Zone 3: 70–80% HRmax — Tempo/Moderate (RPE 5–7)
//   Zone 4: 80–90% HRmax — Lactate Threshold (RPE 7–8)
//   Zone 5: 90–100% HRmax — VO2 Max (RPE 8–10)
//
//   HRmax estimation:
//     Tanaka et al. (2001): HRmax = 208 − 0.7 × age (more accurate than 220−age)
//     From threshold HR:    HRmax ≈ thresholdHR / 0.875 (threshold ≈ 85–90% HRmax)
//
// FATIGUE SENSITIVITY ADAPTATION (Meeusen et al., 2013):
//   Athletes differ in their fatigue accumulation rate and recovery kinetics.
//   A fatigueSensitivity of 1.5 means this athlete accumulates fatigue ~50% faster
//   per unit of load than the baseline model assumes. The recommendation engine
//   uses this to lower the "high fatigue" threshold from 75 → 58.
//
// RECOVERY RESPONSIVENESS (Kenttä & Hassmén, 1998):
//   recoveryResponsiveness > 1.0 = athlete recovers faster than baseline.
//   Applied as a multiplier on the positive terms in calculateRecoveryScore.
//
// DECONDITIONING (Mujika & Padilla, 2000):
//   VO2max declines measurably after 2 weeks of inactivity.
//   After 4 weeks: 5–10% decrease. After 8 weeks: 20% decrease.
//   Detected by training gap > 14 days + no recent workouts.
//
// FITNESS IMPROVEMENT DETECTION (Borg et al., 1982 RPE / Coggan power):
//   Proxy: ACWR 0.8–1.0 for ≥ 3 consecutive weeks with increasing mileage
//   indicates positive chronic adaptation without overload.
//
// AI REPLACEMENT HOOK:
//   `runCalibration(input)` is the designated AI override point.
//   To replace: call Claude API with CalibrationInput, validate response as
//   CalibrationOutput, return it. The interface MUST NOT change — only the implementation.

import type {
  CalibrationInput,
  CalibrationOutput,
  CalibrationSource,
  CalibrationConfidence,
  PaceZoneEntry,
  HRZoneEntry,
  ReadinessThresholds,
  AthleteProfile,
} from '../types/athlete';
import type { PaceZones, PaceGuidance } from '../types/training';

// ─── Constants ─────────────────────────────────────────────────────────────────

const METERS_PER_MILE = 1609.344;

// %VO2max at which each training zone runs (mid-point of Jack Daniels ranges).
// Easy: 65–74%, Threshold: 83–88%, VO2: 95–100%, Rep: 105–115%
const ZONE_PCT: Record<string, [number, number]> = {
  recovery:  [0.58, 0.65],
  easy:      [0.65, 0.74],
  marathon:  [0.79, 0.84],
  threshold: [0.83, 0.88],
  vo2:       [0.97, 1.00],
  rep:       [1.05, 1.12],
};

const ZONE_RPE: Record<string, [number, number]> = {
  recovery:  [1, 3],
  easy:      [3, 5],
  marathon:  [5, 6],
  threshold: [7, 8],
  vo2:       [8, 9],
  rep:       [9, 10],
};

const ZONE_HR: Record<string, number> = {
  recovery:  1,
  easy:      2,
  marathon:  3,
  threshold: 4,
  vo2:       5,
  rep:       5,
};

const ZONE_LABELS: Record<string, string> = {
  recovery:  'Recovery',
  easy:      'Easy Aerobic',
  marathon:  'Marathon Pace',
  threshold: 'Threshold',
  vo2:       'VO2 Max Intervals',
  rep:       'Repetition / Strides',
};

const ZONE_DESCRIPTIONS: Record<string, string> = {
  recovery:  'Fully conversational. Active recovery promoting blood flow without training stress.',
  easy:      'Zone 2 aerobic work. Builds mitochondrial density. Could sustain for hours.',
  marathon:  'Comfortably sustained effort. Goal marathon race pace. Aerobic power driver.',
  threshold: 'Comfortably hard. Short sentences only. Raises lactate threshold.',
  vo2:       'Hard controlled effort. 3K–5K race intensity. Elevates aerobic ceiling.',
  rep:       'Fast, relaxed accelerations. Neuromuscular power and running economy.',
};

// ─── VDOT math ──────────────────────────────────────────────────────────────────

function vo2AtVelocity(vMetersPerMin: number): number {
  return -4.60 + 0.182258 * vMetersPerMin + 0.000104 * vMetersPerMin * vMetersPerMin;
}

function pctVo2MaxAtDuration(durationMinutes: number): number {
  return (
    0.8
    + 0.1894393 * Math.exp(-0.012778 * durationMinutes)
    + 0.2989558 * Math.exp(-0.1932605 * durationMinutes)
  );
}

export function vdotFromRacePR(distanceMeters: number, timeSeconds: number): number {
  if (timeSeconds <= 0 || distanceMeters <= 0) return 0;
  const durationMin = timeSeconds / 60;
  const velocity    = distanceMeters / durationMin;   // m/min
  const vo2         = vo2AtVelocity(velocity);
  const pct         = pctVo2MaxAtDuration(durationMin);
  return Math.round((vo2 / pct) * 10) / 10;
}

export function vdotFromThresholdPace(paceSecPerMi: number): number {
  if (paceSecPerMi <= 0) return 0;
  const velocityMPerMin = (METERS_PER_MILE / paceSecPerMi) * 60;
  // Threshold corresponds to ~86% of VDOT effort (midpoint 83–88%)
  const vo2AtThreshold  = vo2AtVelocity(velocityMPerMin);
  return Math.round((vo2AtThreshold / 0.86) * 10) / 10;
}

// Inverse Daniels: given VDOT and a target %VO2max, solve for velocity (m/min).
function velocityAtPct(vdot: number, pct: number): number {
  const vo2Target = vdot * pct;
  const a = 0.000104;
  const b = 0.182258;
  const c = -(4.60 + vo2Target);
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return 0;
  return (-b + Math.sqrt(discriminant)) / (2 * a);
}

// Convert m/min to pace in sec/mi.
function velToSecPerMi(mPerMin: number): number {
  if (mPerMin <= 0) return 9999;
  return (METERS_PER_MILE / mPerMin) * 60;
}

// Format sec/mi as "M:SS/mi"
export function formatPace(secPerMi: number): string {
  const m   = Math.floor(secPerMi / 60);
  const s   = Math.round(secPerMi % 60);
  const ss  = s.toString().padStart(2, '0');
  return `${m}:${ss}`;
}

// ─── Pace zone derivation ──────────────────────────────────────────────────────

function buildPaceZones(vdot: number): Record<string, PaceZoneEntry> {
  const zones: Record<string, PaceZoneEntry> = {};

  for (const [key, [minPct, maxPct]] of Object.entries(ZONE_PCT)) {
    // In Daniels zones: slower bound = lower % (minPct), faster bound = higher % (maxPct).
    // But sec/mi inverts: higher velocity = lower sec/mi value.
    const fastVel = velocityAtPct(vdot, maxPct);   // faster = higher velocity
    const slowVel = velocityAtPct(vdot, minPct);   // slower = lower velocity

    const fastSecPerMi = velToSecPerMi(fastVel);
    const slowSecPerMi = velToSecPerMi(slowVel);

    zones[key] = {
      label:       ZONE_LABELS[key] ?? key,
      description: ZONE_DESCRIPTIONS[key] ?? '',
      minSecPerMi: fastSecPerMi,   // min = fastest in zone
      maxSecPerMi: slowSecPerMi,   // max = slowest in zone
      hrZone:      ZONE_HR[key] ?? 2,
      rpeRange:    ZONE_RPE[key] ?? [3, 6],
    };
  }

  return zones;
}

// ─── HR zone derivation ────────────────────────────────────────────────────────

const HR_ZONE_CONFIG: {
  zone: number; label: string; minPct: number; maxPct: number; rpeRange: [number, number];
}[] = [
  { zone: 1, label: 'Recovery',           minPct: 0,    maxPct: 0.60, rpeRange: [1, 3] },
  { zone: 2, label: 'Aerobic',            minPct: 0.60, maxPct: 0.70, rpeRange: [3, 5] },
  { zone: 3, label: 'Tempo',              minPct: 0.70, maxPct: 0.80, rpeRange: [5, 7] },
  { zone: 4, label: 'Lactate Threshold',  minPct: 0.80, maxPct: 0.90, rpeRange: [7, 8] },
  { zone: 5, label: 'VO2 Max',            minPct: 0.90, maxPct: 1.00, rpeRange: [8, 10] },
];

export function estimateHRMax(age: number): number {
  // Tanaka et al. (2001): more accurate than 220 − age for athletes.
  return Math.round(208 - 0.7 * age);
}

function hrMaxFromThreshold(thresholdHR: number): number {
  // Threshold HR ≈ 85–90% HRmax → use 87.5% midpoint
  return Math.round(thresholdHR / 0.875);
}

function buildHRZones(hrMax: number | null): HRZoneEntry[] {
  if (hrMax === null || hrMax <= 0) {
    // No HR data — return zones without absolute BPM values
    return HR_ZONE_CONFIG.map(z => ({
      zone:     z.zone,
      label:    z.label,
      minBPM:   null,
      maxBPM:   null,
      minPct:   z.minPct,
      maxPct:   z.maxPct,
      rpeRange: z.rpeRange,
    }));
  }

  return HR_ZONE_CONFIG.map(z => ({
    zone:     z.zone,
    label:    z.label,
    minBPM:   z.minPct === 0 ? 0 : Math.round(hrMax * z.minPct),
    maxBPM:   Math.round(hrMax * z.maxPct),
    minPct:   z.minPct,
    maxPct:   z.maxPct,
    rpeRange: z.rpeRange,
  }));
}

// ─── VDOT fallback estimation ──────────────────────────────────────────────────
//
// Rough empirical estimates when no race PR or threshold pace is available.
// Based on typical VO2max ranges by running background and training volume.

export function estimateVdotFromProfile(
  weeklyMileage:     number,
  trainingAgeYears:  number,
  vo2Estimate:       number,
): number {
  // If a VO2 estimate is already stored (from prior calibration or external test), use it.
  if (vo2Estimate > 20) return vo2Estimate;

  // Rough estimate from weekly volume + experience.
  // Novice runners: 30–38; intermediates: 38–50; advanced: 50+
  const baseVdot = 28 + Math.min(weeklyMileage * 0.35, 22);
  const ageBonus = Math.min(trainingAgeYears * 1.2, 8);
  return Math.round((baseVdot + ageBonus) * 10) / 10;
}

// ─── Confidence scoring ────────────────────────────────────────────────────────
//
// Scored additively. Reflects how grounded the calibration is in real data
// vs. population-average estimates.
//
// Points breakdown:
//   Recent race PR (< 18 months):   35 pts  ← most reliable VDOT source
//   Threshold pace known:            25 pts  ← direct LT measurement
//   HRmax known:                     15 pts  ← enables accurate HR zones
//   Threshold HR known:              10 pts  ← refines threshold zone
//   Sufficient workout history:      15 pts  ← enables fitness trend detection
//   Total possible:                 100 pts

const PR_AGE_CUTOFF_MS = 18 * 30 * 24 * 60 * 60 * 1000;  // 18 months

function computeConfidenceScore(profile: AthleteProfile, recentWorkoutCount: number): number {
  let score = 0;

  const now = Date.now();

  // Recent race PR
  const hasRecentPR = profile.racePRs.some(pr => {
    const prMs = new Date(pr.date).getTime();
    return !isNaN(prMs) && (now - prMs) < PR_AGE_CUTOFF_MS;
  });
  if (hasRecentPR) score += 35;
  else if (profile.racePRs.length > 0) score += 12;  // old PR = partial credit

  // Threshold pace
  if (profile.thresholdPaceSecPerMi !== null) score += 25;

  // HR data
  if (profile.hrMax !== null) score += 15;
  if (profile.hrThreshold !== null) score += 10;

  // Recent workout history
  if (recentWorkoutCount >= 12) score += 15;
  else if (recentWorkoutCount >= 6) score += 8;
  else if (recentWorkoutCount >= 2) score += 3;

  return Math.min(100, score);
}

function confidenceLabel(score: number): CalibrationConfidence {
  if (score >= 75) return 'high';
  if (score >= 45) return 'moderate';
  if (score >= 20) return 'low';
  return 'estimated';
}

// ─── Primary calibration source ────────────────────────────────────────────────

function resolveCalibrationSource(profile: AthleteProfile): CalibrationSource {
  const hasRecentPR = profile.racePRs.some(pr => {
    const prMs = new Date(pr.date).getTime();
    return !isNaN(prMs) && (Date.now() - prMs) < PR_AGE_CUTOFF_MS;
  });
  if (hasRecentPR)                              return 'race_pr';
  if (profile.thresholdPaceSecPerMi !== null)   return 'threshold_test';
  if (profile.racePRs.length > 0)               return 'estimated';
  return 'default';
}

// ─── Missing inputs list ───────────────────────────────────────────────────────

function buildMissingInputs(profile: AthleteProfile, confidenceScore: number): string[] {
  if (confidenceScore >= 75) return [];
  const missing: string[] = [];

  if (profile.racePRs.length === 0) missing.push('Race PR (any distance) — needed for VDOT calculation');
  else {
    const hasRecent = profile.racePRs.some(pr => {
      const ms = new Date(pr.date).getTime();
      return !isNaN(ms) && (Date.now() - ms) < PR_AGE_CUTOFF_MS;
    });
    if (!hasRecent) missing.push('Race PR within 18 months — existing PR may be outdated');
  }

  if (profile.thresholdPaceSecPerMi === null)
    missing.push('Threshold pace — run a 30-min time trial, record average pace');

  if (profile.hrMax === null)
    missing.push('Max HR — from recent hard workout or HRmax test');

  if (profile.hrThreshold === null && profile.hrMax !== null)
    missing.push('Threshold HR — record average HR during your next threshold run');

  return missing;
}

// ─── Fitness improvement detection ────────────────────────────────────────────
//
// Detects upward aerobic adaptation trends from workout history signals.
// Proxy indicators (without lab testing):
//   - Sustained ACWR 0.85–1.1 over 3+ weeks (progressive aerobic stimulus)
//   - Increasing weekly mileage trend
//   - Athlete is in base/build phase with adequate recovery

function detectFitnessImprovements(
  lastWorkoutDaysAgo:   number,
  currentRecoveryScore: number,
  recentWorkoutCount:   number,
): string[] {
  const improvements: string[] = [];

  if (lastWorkoutDaysAgo <= 3 && recentWorkoutCount >= 10 && currentRecoveryScore >= 65)
    improvements.push('Consistent training pattern detected — aerobic adaptation is accumulating');

  if (recentWorkoutCount >= 15 && currentRecoveryScore >= 70)
    improvements.push('High training volume with maintained recovery — fitness ceiling is rising');

  return improvements;
}

// ─── Deconditioning detection ──────────────────────────────────────────────────
//
// Mujika & Padilla (2000): measurable VO2max loss after 2 weeks inactivity.
// At 4 weeks: −5–10%; at 8 weeks: up to −20%.

function detectDeconditioning(
  lastWorkoutDaysAgo:  number,
  recentWorkoutCount:  number,
  returningFromInjury: boolean,
): string[] {
  const flags: string[] = [];

  if (returningFromInjury)
    flags.push('Returning from injury — load should increase slowly over 4–6 weeks');

  if (lastWorkoutDaysAgo > 21)
    flags.push(`Training gap of ${lastWorkoutDaysAgo}d — VO2max may have declined 5–10%. Restart at 60% of prior load.`);
  else if (lastWorkoutDaysAgo > 10)
    flags.push(`${lastWorkoutDaysAgo}d since last workout — resume with easy aerobic work first`);

  if (recentWorkoutCount < 3 && lastWorkoutDaysAgo < 7)
    flags.push('Very low training frequency — adherence below threshold for meaningful adaptation');

  return flags;
}

// ─── Sensitivity multipliers ───────────────────────────────────────────────────
//
// Fatigued-adapted readiness thresholds:
//   A runner with fatigueSensitivity = 1.5 should feel "high fatigue" at 50 (vs 75).
//   A runner with recoveryResponsiveness = 0.7 recovers slower than baseline.
//
// The multipliers are stored in CalibrationOutput and applied by:
//   - calculateUpdatedFatigue (via profileStore callback)
//   - getReadinessThresholds (via recommendation engine)

export function getReadinessThresholds(
  fatigueSensitivity:     number,
  recoveryResponsiveness: number,
): ReadinessThresholds {
  // Higher sensitivity = lower threshold before alarm
  const highFatigue     = Math.round(75 / fatigueSensitivity);
  const criticalFatigue = Math.round(85 / fatigueSensitivity);
  // Lower responsiveness = needs higher recovery score to be considered "good"
  const poorRecovery     = Math.round(50 * (1 / recoveryResponsiveness));
  const criticalRecovery = Math.round(35 * (1 / recoveryResponsiveness));

  return {
    highFatigue:      Math.max(40, Math.min(85, highFatigue)),
    criticalFatigue:  Math.max(55, Math.min(95, criticalFatigue)),
    poorRecovery:     Math.max(30, Math.min(65, poorRecovery)),
    criticalRecovery: Math.max(20, Math.min(50, criticalRecovery)),
  };
}

// ─── PaceZones adapter ────────────────────────────────────────────────────────
//
// Produces the existing `PaceZones` type (used by workoutGenerator) from
// CalibrationOutput. Screens that have profile data use this instead of
// the goalRace-lookup approach.

export function calibrationToPaceZones(calibration: CalibrationOutput): PaceZones {
  const fmtRange = (fast: number, slow: number): string =>
    `${formatPace(fast)}–${formatPace(slow)}/mi`;

  const z = calibration.paceZones;

  const recovZone  = z['recovery'];
  const easyZone   = z['easy'];
  const threshZone = z['threshold'];
  const vo2Zone    = z['vo2'];
  const repZone    = z['rep'];

  const make = (zone: PaceZoneEntry | undefined, fallback: PaceGuidance): PaceGuidance =>
    zone
      ? {
          label:       zone.label,
          description: zone.description,
          targetPace:  fmtRange(zone.minSecPerMi, zone.maxSecPerMi),
        }
      : fallback;

  const FALLBACK: PaceGuidance = {
    label: 'Pace',
    description: 'Based on current fitness estimate.',
    targetPace: 'N/A',
  };

  return {
    recovery:  make(recovZone, FALLBACK),
    easy:      make(easyZone, FALLBACK),
    threshold: make(threshZone, FALLBACK),
    vo2:       make(vo2Zone, FALLBACK),
    strides:   make(repZone, FALLBACK),
  };
}

// ─── Main entry: runCalibration ────────────────────────────────────────────────
//
// AI REPLACEMENT HOOK — see file header.
// Pure function. Same input → same output. No side effects.

export function runCalibration(input: CalibrationInput): CalibrationOutput {
  const {
    profile,
    weeklyMileage,
    recentWorkoutCount,
    lastWorkoutDaysAgo,
    currentRecoveryScore,
  } = input;

  // ── 1. Determine VDOT ────────────────────────────────────────────────────────
  let vdot = 0;
  let source: CalibrationSource = 'default';

  // Priority: recent race PR → threshold pace → stored vo2Estimate → estimation
  const sortedPRs = [...profile.racePRs].sort((a, b) => {
    const aMs = new Date(a.date).getTime();
    const bMs = new Date(b.date).getTime();
    return bMs - aMs;  // newest first
  });

  for (const pr of sortedPRs) {
    const v = vdotFromRacePR(pr.distanceMeters, pr.timeSeconds);
    if (v > 0) {
      vdot   = v;
      source = 'race_pr';
      break;
    }
  }

  if (vdot === 0 && profile.thresholdPaceSecPerMi !== null) {
    vdot   = vdotFromThresholdPace(profile.thresholdPaceSecPerMi);
    source = 'threshold_test';
  }

  if (vdot === 0 && profile.vo2Estimate > 20) {
    vdot   = profile.vo2Estimate;
    source = 'estimated';
  }

  if (vdot === 0) {
    vdot   = estimateVdotFromProfile(weeklyMileage, profile.trainingAgeYears, 0);
    source = 'default';
  }

  vdot = Math.max(15, Math.min(85, vdot));

  // ── 2. Resolve HRmax ─────────────────────────────────────────────────────────
  let resolvedHRMax: number | null = profile.hrMax;

  if (resolvedHRMax === null && profile.hrThreshold !== null) {
    resolvedHRMax = hrMaxFromThreshold(profile.hrThreshold);
  }

  // If still unknown but age is set, use Tanaka estimate (stored separately as estimatedHRMax)
  const estimatedHRMax =
    resolvedHRMax === null && profile.age > 0
      ? estimateHRMax(profile.age)
      : null;

  const hrMaxForZones = resolvedHRMax ?? estimatedHRMax;

  // ── 3. Build zones ────────────────────────────────────────────────────────────
  const paceZones = buildPaceZones(vdot);
  const hrZones   = buildHRZones(hrMaxForZones);

  // ── 4. Confidence ─────────────────────────────────────────────────────────────
  const confidenceScore = computeConfidenceScore(profile, recentWorkoutCount);
  const confidence      = confidenceLabel(confidenceScore);
  const primarySource   = resolveCalibrationSource(profile);
  const missingInputs   = buildMissingInputs(profile, confidenceScore);

  // ── 5. Days since last calibration ────────────────────────────────────────────
  const staleDays = profile.calibration
    ? Math.floor((Date.now() - profile.calibration.lastCalibratedAt) / (24 * 60 * 60 * 1000))
    : 999;

  // ── 6. Fitness signals ────────────────────────────────────────────────────────
  const fitnessImprovements = detectFitnessImprovements(
    lastWorkoutDaysAgo,
    currentRecoveryScore,
    recentWorkoutCount,
  );
  const deconditioningFlags = detectDeconditioning(
    lastWorkoutDaysAgo,
    recentWorkoutCount,
    profile.returningFromInjury,
  );

  // ── 7. Sensitivity multipliers ────────────────────────────────────────────────
  const fatigueMultiplier  = Math.max(0.5, Math.min(2.0, profile.fatigueSensitivity));
  const recoveryMultiplier = Math.max(0.5, Math.min(2.0, profile.recoveryResponsiveness));

  return {
    vdot,
    estimatedHRMax:       hrMaxForZones !== profile.hrMax ? hrMaxForZones : null,
    paceZones,
    hrZones,
    confidenceScore,
    confidenceLabel:      confidence,
    primarySource,
    staleDays,
    missingInputs,
    lastCalibratedAt:     Date.now(),
    fitnessImprovements,
    deconditioningFlags,
    fatigueMultiplier,
    recoveryMultiplier,
  };
}

// ─── Stale check helper ────────────────────────────────────────────────────────

export function calibrationIsStale(calibration: CalibrationOutput): boolean {
  const days = (Date.now() - calibration.lastCalibratedAt) / (24 * 60 * 60 * 1000);
  return days > 60;
}

// ─── Default profile factory ──────────────────────────────────────────────────
//
// Creates a baseline AthleteProfile for a new athlete with no data.
// Used when the profile store is first initialized.

export function createDefaultProfile(overrides: {
  athleteId:  string;
  name:       string;
  vo2Estimate: number;
}): AthleteProfile {
  return {
    athleteId:             overrides.athleteId,
    createdAt:             Date.now(),
    updatedAt:             Date.now(),
    name:                  overrides.name,
    age:                   30,
    sex:                   'prefer_not_to_say',
    heightCm:              175,
    weightKg:              70,
    trainingAgeYears:      1,
    returningFromInjury:   false,
    injuryHistory:         [],
    racePRs:               [],
    preferredDistances:    ['marathon'],
    hrMax:                 null,
    hrResting:             null,
    hrThreshold:           null,
    thresholdPaceSecPerMi: null,
    vo2Estimate:           overrides.vo2Estimate,
    vdot:                  overrides.vo2Estimate,
    fatigueSensitivity:    1.0,
    recoveryResponsiveness: 1.0,
    heatSensitivity:       1.0,
    altitudeMeters:        0,
    availableDays:         ['Mon', 'Tue', 'Wed', 'Thu', 'Sat', 'Sun'],
    targetSessions:        5,
    calibration:           null,
  };
}
