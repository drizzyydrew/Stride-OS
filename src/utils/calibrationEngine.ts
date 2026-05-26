// ─── Calibration Engine ────────────────────────────────────────────────────────
//
// PHYSIOLOGICAL BASIS
//
// JACK DANIELS VDOT MODEL (Daniels, 2005 — "Daniels' Running Formula"):
//   VDOT represents the effective VO2max a runner demonstrates in a race, not
//   the lab-measured VO2max.
//
//   VO2 at velocity v (m/min):
//     VO2(v) = -4.60 + 0.182258 × v + 0.000104 × v²
//
//   %VO2max at race duration t (minutes):
//     %VO2max(t) = 0.8 + 0.1894393 × e^(-0.012778t) + 0.2989558 × e^(-0.1932605t)
//
//   VDOT = VO2(velocity) / %VO2max(duration)
//
// HR ZONES — FRIEL 5-ZONE MODEL (Friel, "The Triathlete's Training Bible", 2012):
//   Zone 1: <60% HRmax — Recovery
//   Zone 2: 60–70% HRmax — Aerobic
//   Zone 3: 70–80% HRmax — Tempo
//   Zone 4: 80–90% HRmax — Lactate Threshold
//   Zone 5: 90–100% HRmax — VO2 Max
//
// KARVONEN HEART-RATE RESERVE METHOD (Karvonen et al., 1957):
//   Target HR = ((HRmax − HRresting) × intensity%) + HRresting
//   Provides individualised zones that account for resting HR variation.
//   Requires measured or estimated HRmax + morning resting HR.
//
// HRMX ESTIMATION — TANAKA et al. (2001):
//   HRmax = 208 − 0.7 × age
//   Meta-analysis of 351 studies (n=18,712). More accurate than 220−age,
//   especially for trained athletes.
//
// THRESHOLD ZONES — JOE FRIEL 7-ZONE SYSTEM:
//   Extended threshold-based zones for runners derived from:
//     Functional Threshold Pace (FTP-pace): average pace from last 20 min of 30-min TT
//     Lactate Threshold HR (LTHR): average HR from last 20 min of 30-min TT
//   Protocol: Joe Friel "30-minute threshold field test" (Friel, "Fast After 50")
//   Zone percentages are relative to threshold SPEED (higher% = faster):
//     Zone 1:  <78% FT speed  |  <85% LTHR
//     Zone 2: 78–88% FT speed | 85–89% LTHR
//     Zone 3: 88–94% FT speed | 90–94% LTHR
//     Zone 4: 95–101% FT speed| 95–99% LTHR
//     Zone 5a: 100–103%       | 100–102% LTHR
//     Zone 5b: 104–111%       | 103–106% LTHR
//     Zone 5c: >111%          | >106% LTHR
//
// MAF — MAXIMUM AEROBIC FUNCTION (Maffetone, 2010):
//   MAF HR = 180 − age (±adjustments)
//   Used ONLY for aerobic base trending and drift monitoring.
//   NOT used as primary training prescription.
//
// AI REPLACEMENT HOOK:
//   `runCalibration(input)` is the designated AI override point.
//   Interface MUST NOT change — only the implementation.

import type {
  CalibrationInput,
  CalibrationOutput,
  CalibrationSource,
  CalibrationConfidence,
  PaceZoneEntry,
  HRZoneEntry,
  ThresholdZoneEntry,
  RaceTimePrediction,
  ReadinessThresholds,
  AthleteProfile,
  ZoneMethod,
} from '../types/athlete';
import type { PaceZones, PaceGuidance } from '../types/training';

// ─── Constants ─────────────────────────────────────────────────────────────────

const METERS_PER_MILE = 1609.344;

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

// ─── VDOT math ─────────────────────────────────────────────────────────────────

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
  const velocity    = distanceMeters / durationMin;
  const vo2         = vo2AtVelocity(velocity);
  const pct         = pctVo2MaxAtDuration(durationMin);
  return Math.round((vo2 / pct) * 10) / 10;
}

export function vdotFromThresholdPace(paceSecPerMi: number): number {
  if (paceSecPerMi <= 0) return 0;
  const velocityMPerMin = (METERS_PER_MILE / paceSecPerMi) * 60;
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

function velToSecPerMi(mPerMin: number): number {
  if (mPerMin <= 0) return 9999;
  return (METERS_PER_MILE / mPerMin) * 60;
}

export function formatPace(secPerMi: number): string {
  const m  = Math.floor(secPerMi / 60);
  const s  = Math.round(secPerMi % 60);
  const ss = s.toString().padStart(2, '0');
  return `${m}:${ss}`;
}

// Predict race time for a given VDOT and distance (binary search on velocity).
// Daniels, 2005 — the same VO2/duration model inverted to solve for time.
function predictRaceTime(vdot: number, distanceMeters: number): number {
  if (vdot <= 0 || distanceMeters <= 0) return 0;
  let lo = 50;    // very slow (~32 min/mi)
  let hi = 700;   // world-class sprint speed

  for (let i = 0; i < 60; i++) {
    const mid        = (lo + hi) / 2;
    const durMin     = distanceMeters / mid;
    const impliedVdot = vo2AtVelocity(mid) / pctVo2MaxAtDuration(durMin);
    if (impliedVdot < vdot) lo = mid;
    else hi = mid;
  }

  const vel = (lo + hi) / 2;
  return Math.round((distanceMeters / vel) * 60);   // seconds
}

const RACE_PREDICTION_DISTANCES: { key: string; label: string; meters: number }[] = [
  { key: '1_mile',       label: '1 Mile',        meters: 1609.344 },
  { key: '5k',           label: '5K',            meters: 5000     },
  { key: '10k',          label: '10K',           meters: 10000    },
  { key: 'half_marathon',label: 'Half Marathon', meters: 21097.5  },
  { key: 'marathon',     label: 'Marathon',      meters: 42195    },
];

export function buildRacePredictions(vdot: number): RaceTimePrediction[] {
  return RACE_PREDICTION_DISTANCES.map(d => ({
    distance:         d.label,
    distanceKey:      d.key,
    distanceMeters:   d.meters,
    predictedSeconds: predictRaceTime(vdot, d.meters),
  }));
}

export function formatRaceTime(seconds: number): string {
  const h   = Math.floor(seconds / 3600);
  const m   = Math.floor((seconds % 3600) / 60);
  const s   = seconds % 60;
  const mm  = m.toString().padStart(2, '0');
  const ss  = s.toString().padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

// ─── VDOT pace zone derivation ─────────────────────────────────────────────────

function buildPaceZones(vdot: number): Record<string, PaceZoneEntry> {
  const zones: Record<string, PaceZoneEntry> = {};

  for (const [key, [minPct, maxPct]] of Object.entries(ZONE_PCT)) {
    const fastVel    = velocityAtPct(vdot, maxPct);
    const slowVel    = velocityAtPct(vdot, minPct);
    const fastSecPerMi = velToSecPerMi(fastVel);
    const slowSecPerMi = velToSecPerMi(slowVel);

    zones[key] = {
      label:       ZONE_LABELS[key] ?? key,
      description: ZONE_DESCRIPTIONS[key] ?? '',
      minSecPerMi: fastSecPerMi,
      maxSecPerMi: slowSecPerMi,
      hrZone:      ZONE_HR[key] ?? 2,
      rpeRange:    ZONE_RPE[key] ?? [3, 6],
    };
  }

  return zones;
}

// ─── Friel 5-zone HR derivation ────────────────────────────────────────────────

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
  // Tanaka et al. (2001): 208 − 0.7 × age
  return Math.round(208 - 0.7 * age);
}

function hrMaxFromThreshold(thresholdHR: number): number {
  // Threshold HR ≈ 87.5% HRmax (midpoint of 85–90% range)
  return Math.round(thresholdHR / 0.875);
}

function buildHRZones(hrMax: number | null): HRZoneEntry[] {
  if (hrMax === null || hrMax <= 0) {
    return HR_ZONE_CONFIG.map(z => ({
      zone: z.zone, label: z.label,
      minBPM: null, maxBPM: null,
      minPct: z.minPct, maxPct: z.maxPct, rpeRange: z.rpeRange,
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

// ─── Karvonen HRR zones ────────────────────────────────────────────────────────
//
// Karvonen et al. (1957): Target HR = ((HRmax − HRresting) × intensity%) + HRresting
// Uses the same % boundaries as Friel's HRmax zones, applied to HRR.

export function buildKarvonenZones(hrMax: number, restingHR: number): HRZoneEntry[] {
  const hrr = hrMax - restingHR;
  if (hrr <= 0) return [];

  return HR_ZONE_CONFIG.map(z => ({
    zone:     z.zone,
    label:    z.label,
    minBPM:   z.minPct === 0 ? restingHR : Math.round(hrr * z.minPct + restingHR),
    maxBPM:   Math.round(hrr * z.maxPct + restingHR),
    minPct:   z.minPct,
    maxPct:   z.maxPct,
    rpeRange: z.rpeRange,
  }));
}

// ─── Threshold 7-zone system ──────────────────────────────────────────────────
//
// Joe Friel extended threshold zones for runners.
// Pace % is relative to threshold SPEED, so:
//   paceSecPerMi = thresholdPaceSecPerMi / speedPct
// Higher speedPct → faster pace → lower sec/mi.

type ThresholdZoneDef = {
  zone: string; label: string; description: string;
  paceMinSpeedPct: number; paceMaxSpeedPct: number;
  hrMinPct: number; hrMaxPct: number;
  rpeRange: [number, number];
};

const THRESHOLD_ZONE_DEFS: ThresholdZoneDef[] = [
  {
    zone: '1', label: 'Active Recovery',
    description: 'Fully conversational. No cardiovascular demand. Easy movement for recovery.',
    paceMinSpeedPct: 0,    paceMaxSpeedPct: 0.78,
    hrMinPct: 0,    hrMaxPct: 0.85,
    rpeRange: [1, 2],
  },
  {
    zone: '2', label: 'Extensive Aerobic',
    description: 'Aerobic base endurance. Long runs and easy workouts. Mitochondrial development.',
    paceMinSpeedPct: 0.78, paceMaxSpeedPct: 0.88,
    hrMinPct: 0.85, hrMaxPct: 0.89,
    rpeRange: [2, 4],
  },
  {
    zone: '3', label: 'Intensive Aerobic',
    description: 'Marathon race effort. Aerobic power. Comfortably sustained for 2–4 hours.',
    paceMinSpeedPct: 0.88, paceMaxSpeedPct: 0.94,
    hrMinPct: 0.90, hrMaxPct: 0.94,
    rpeRange: [4, 6],
  },
  {
    zone: '4', label: 'Threshold',
    description: 'Comfortably hard. Lactate threshold. Short sentences only. 1-hour max effort.',
    paceMinSpeedPct: 0.95, paceMaxSpeedPct: 1.01,
    hrMinPct: 0.95, hrMaxPct: 0.99,
    rpeRange: [6, 7],
  },
  {
    zone: '5a', label: 'Threshold+',
    description: 'Just above threshold. 10K race intensity. Raises anaerobic threshold ceiling.',
    paceMinSpeedPct: 1.00, paceMaxSpeedPct: 1.03,
    hrMinPct: 1.00, hrMaxPct: 1.02,
    rpeRange: [7, 8],
  },
  {
    zone: '5b', label: 'Aerobic Power',
    description: 'VO2max development. 3–5K race intensity. 3–5 minute intervals.',
    paceMinSpeedPct: 1.04, paceMaxSpeedPct: 1.11,
    hrMinPct: 1.03, hrMaxPct: 1.06,
    rpeRange: [8, 9],
  },
  {
    zone: '5c', label: 'Anaerobic / Speed',
    description: 'Neuromuscular power. Sprint repeats. Under 1 minute at max effort.',
    paceMinSpeedPct: 1.11, paceMaxSpeedPct: 0,   // 0 = no upper speed limit
    hrMinPct: 1.06, hrMaxPct: 0,                  // 0 = no upper HR limit
    rpeRange: [9, 10],
  },
];

export function buildThresholdZones(
  lthr: number,
  thresholdPaceSecPerMi: number,
): ThresholdZoneEntry[] {
  return THRESHOLD_ZONE_DEFS.map(z => {
    // paceSecPerMi = thresholdPaceSecPerMi / speedPct
    // Higher speedPct = faster pace = lower sec/mi = minSecPerMi
    const paceMin = z.paceMinSpeedPct === 0
      ? null  // Zone 1: no lower (faster) bound — all very easy paces qualify
      : Math.round(thresholdPaceSecPerMi / z.paceMaxSpeedPct);  // fastest end of zone
    const paceMax = z.paceMaxSpeedPct === 0
      ? null  // Zone 5c: no upper (slower) bound — go as fast as possible
      : Math.round(thresholdPaceSecPerMi / z.paceMinSpeedPct);  // slowest end of zone

    const hrMin = z.hrMinPct === 0 ? null : Math.round(lthr * z.hrMinPct);
    const hrMax = z.hrMaxPct === 0 ? null : Math.round(lthr * z.hrMaxPct);

    return {
      zone:            z.zone,
      label:           z.label,
      description:     z.description,
      paceMinSpeedPct: z.paceMinSpeedPct,
      paceMaxSpeedPct: z.paceMaxSpeedPct,
      paceMinSecPerMi: paceMin,
      paceMaxSecPerMi: paceMax,
      hrMinPct:        z.hrMinPct,
      hrMaxPct:        z.hrMaxPct,
      hrMinBPM:        hrMin,
      hrMaxBPM:        hrMax,
      rpeRange:        z.rpeRange,
    };
  });
}

// ─── HRmax source label ────────────────────────────────────────────────────────

export function buildHRMaxSourceLabel(profile: AthleteProfile): string {
  if (profile.hrMax !== null && profile.hrMaxManual) {
    return `Measured HRmax: ${profile.hrMax} bpm`;
  }
  if (profile.hrThreshold !== null && profile.hrMax === null) {
    const est = hrMaxFromThreshold(profile.hrThreshold);
    return `Estimated from LTHR: ${est} bpm (LTHR ÷ 0.875)`;
  }
  if (profile.age > 0) {
    const est = estimateHRMax(profile.age);
    return `Estimated: Tanaka 2001 (208 − 0.7 × ${profile.age} = ${est} bpm)`;
  }
  return 'HRmax unknown — enter age or measured HRmax';
}

// ─── VDOT fallback estimation ──────────────────────────────────────────────────

export function estimateVdotFromProfile(
  weeklyMileage:    number,
  trainingAgeYears: number,
  vo2Estimate:      number,
): number {
  if (vo2Estimate > 20) return vo2Estimate;
  const baseVdot = 28 + Math.min(weeklyMileage * 0.35, 22);
  const ageBonus = Math.min(trainingAgeYears * 1.2, 8);
  return Math.round((baseVdot + ageBonus) * 10) / 10;
}

// ─── Confidence scoring ────────────────────────────────────────────────────────

const PR_AGE_CUTOFF_MS = 18 * 30 * 24 * 60 * 60 * 1000;

function computeConfidenceScore(profile: AthleteProfile, recentWorkoutCount: number): number {
  let score = 0;
  const now = Date.now();

  const hasRecentPR = profile.racePRs.some(pr => {
    const prMs = new Date(pr.date).getTime();
    return !isNaN(prMs) && (now - prMs) < PR_AGE_CUTOFF_MS;
  });
  if (hasRecentPR) score += 35;
  else if (profile.racePRs.length > 0) score += 12;

  if (profile.thresholdPaceSecPerMi !== null || profile.thresholdTest !== null) score += 25;
  if (profile.hrMax !== null) score += 15;
  if (profile.hrThreshold !== null || (profile.thresholdTest?.avgHRLastTwentyMin ?? 0) > 0) score += 10;

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

function resolveCalibrationSource(profile: AthleteProfile): CalibrationSource {
  const hasRecentPR = profile.racePRs.some(pr => {
    const prMs = new Date(pr.date).getTime();
    return !isNaN(prMs) && (Date.now() - prMs) < PR_AGE_CUTOFF_MS;
  });
  if (hasRecentPR)                              return 'race_pr';
  if (profile.thresholdPaceSecPerMi !== null)   return 'threshold_test';
  if (profile.thresholdTest !== null)           return 'threshold_test';
  if (profile.racePRs.length > 0)               return 'estimated';
  return 'default';
}

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

  if (profile.thresholdPaceSecPerMi === null && profile.thresholdTest === null)
    missing.push('Threshold test — 30-min TT, record avg pace and HR for last 20 min');

  if (profile.hrMax === null && profile.hrThreshold === null)
    missing.push('Max HR — from measured HRmax or threshold test');

  if (profile.hrResting === null)
    missing.push('Resting HR — needed for Karvonen HRR zone accuracy');

  return missing;
}

// ─── Fitness signals ──────────────────────────────────────────────────────────

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

export function getReadinessThresholds(
  fatigueSensitivity:     number,
  recoveryResponsiveness: number,
): ReadinessThresholds {
  const highFatigue     = Math.round(75 / fatigueSensitivity);
  const criticalFatigue = Math.round(85 / fatigueSensitivity);
  const poorRecovery    = Math.round(50 * (1 / recoveryResponsiveness));
  const criticalRecovery = Math.round(35 * (1 / recoveryResponsiveness));

  return {
    highFatigue:      Math.max(40, Math.min(85, highFatigue)),
    criticalFatigue:  Math.max(55, Math.min(95, criticalFatigue)),
    poorRecovery:     Math.max(30, Math.min(65, poorRecovery)),
    criticalRecovery: Math.max(20, Math.min(50, criticalRecovery)),
  };
}

// ─── PaceZones adapter ────────────────────────────────────────────────────────

export function calibrationToPaceZones(calibration: CalibrationOutput): PaceZones {
  const fmtRange = (fast: number, slow: number): string =>
    `${formatPace(fast)}–${formatPace(slow)}/mi`;

  const z = calibration.paceZones;
  const make = (zone: PaceZoneEntry | undefined, fallback: PaceGuidance): PaceGuidance =>
    zone ? {
      label:       zone.label,
      description: zone.description,
      targetPace:  fmtRange(zone.minSecPerMi, zone.maxSecPerMi),
    } : fallback;

  const FALLBACK: PaceGuidance = { label: 'Pace', description: 'Based on current fitness estimate.', targetPace: 'N/A' };

  return {
    recovery:  make(z['recovery'],  FALLBACK),
    easy:      make(z['easy'],      FALLBACK),
    threshold: make(z['threshold'], FALLBACK),
    vo2:       make(z['vo2'],       FALLBACK),
    strides:   make(z['rep'],       FALLBACK),
  };
}

// ─── Main entry: runCalibration ────────────────────────────────────────────────
//
// AI REPLACEMENT HOOK — see file header.
// Pure function. Same input → same output. No side effects.

export function runCalibration(input: CalibrationInput): CalibrationOutput {
  const { profile, weeklyMileage, recentWorkoutCount, lastWorkoutDaysAgo, currentRecoveryScore } = input;

  // ── 1. Determine VDOT ────────────────────────────────────────────────────────
  let vdot = 0;
  let source: CalibrationSource = 'default';

  const sortedPRs = [...profile.racePRs].sort((a, b) =>
    new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
  for (const pr of sortedPRs) {
    const v = vdotFromRacePR(pr.distanceMeters, pr.timeSeconds);
    if (v > 0) { vdot = v; source = 'race_pr'; break; }
  }

  // Threshold test → VDOT (if no race PR or as supplement)
  const thresholdPace = profile.thresholdPaceSecPerMi
    ?? (profile.thresholdTest?.avgPaceSecPerMiLastTwenty ?? null);

  if (vdot === 0 && thresholdPace !== null) {
    vdot   = vdotFromThresholdPace(thresholdPace);
    source = 'threshold_test';
  }

  if (vdot === 0 && profile.vo2Estimate > 20) { vdot = profile.vo2Estimate; source = 'estimated'; }
  if (vdot === 0) {
    vdot   = estimateVdotFromProfile(weeklyMileage, profile.trainingAgeYears, 0);
    source = 'default';
  }
  vdot = Math.max(15, Math.min(85, vdot));

  // ── 2. Resolve HRmax ─────────────────────────────────────────────────────────
  let resolvedHRMax: number | null = null;

  if (profile.hrMaxManual && profile.hrMax !== null) {
    // User explicitly entered HRmax
    resolvedHRMax = profile.hrMax;
  } else if (!profile.hrMaxManual && profile.hrThreshold !== null) {
    resolvedHRMax = hrMaxFromThreshold(profile.hrThreshold);
  } else if (!profile.hrMaxManual && profile.age > 0) {
    resolvedHRMax = estimateHRMax(profile.age);
  }

  // Also use threshold test LTHR to estimate HRmax if still unresolved
  const lthr = profile.hrThreshold
    ?? (profile.thresholdTest?.avgHRLastTwentyMin ?? null);

  if (resolvedHRMax === null && lthr !== null) {
    resolvedHRMax = hrMaxFromThreshold(lthr);
  }

  const estimatedHRMax = resolvedHRMax !== profile.hrMax ? resolvedHRMax : null;
  const hrMaxForZones  = resolvedHRMax;

  // ── 3. Build zone systems ─────────────────────────────────────────────────────
  const paceZones = buildPaceZones(vdot);
  const hrZones   = buildHRZones(hrMaxForZones);

  // Karvonen zones: need hrMax + restingHR
  const restingHR = profile.hrResting;
  const karvonenZones = (hrMaxForZones !== null && restingHR !== null)
    ? buildKarvonenZones(hrMaxForZones, restingHR)
    : null;

  // Threshold 7-zone system: need LTHR + threshold pace
  const effectiveLTHR  = lthr;
  const effectiveThreshPace = thresholdPace;
  const thresholdZones = (effectiveLTHR !== null && effectiveThreshPace !== null)
    ? buildThresholdZones(effectiveLTHR, effectiveThreshPace)
    : null;

  // Race time predictions from VDOT
  const racePredictions = vdot > 0 ? buildRacePredictions(vdot) : null;

  // ── 4. Confidence & source ────────────────────────────────────────────────────
  const confidenceScore = computeConfidenceScore(profile, recentWorkoutCount);
  const confidence      = confidenceLabel(confidenceScore);
  const primarySource   = resolveCalibrationSource(profile);
  const missingInputs   = buildMissingInputs(profile, confidenceScore);

  const hrMaxSource = buildHRMaxSourceLabel(profile);

  // ── 5. Active zone method ─────────────────────────────────────────────────────
  // Respect user preference; fall back gracefully when data is unavailable.
  let activeZoneMethod: ZoneMethod = profile.activeZoneMethod;
  if (activeZoneMethod === 'threshold' && thresholdZones === null) {
    activeZoneMethod = 'vdot';  // no threshold data yet
  }
  if ((activeZoneMethod === 'tanaka_karvonen' || activeZoneMethod === 'manual_karvonen')
    && karvonenZones === null) {
    activeZoneMethod = 'vdot';
  }

  // ── 6. Stale days ─────────────────────────────────────────────────────────────
  const staleDays = profile.calibration
    ? Math.floor((Date.now() - profile.calibration.lastCalibratedAt) / (24 * 60 * 60 * 1000))
    : 999;

  // ── 7. Fitness signals ────────────────────────────────────────────────────────
  const fitnessImprovements = detectFitnessImprovements(lastWorkoutDaysAgo, currentRecoveryScore, recentWorkoutCount);
  const deconditioningFlags = detectDeconditioning(lastWorkoutDaysAgo, recentWorkoutCount, profile.returningFromInjury);

  const fatigueMultiplier  = Math.max(0.5, Math.min(2.0, profile.fatigueSensitivity));
  const recoveryMultiplier = Math.max(0.5, Math.min(2.0, profile.recoveryResponsiveness));

  return {
    vdot,
    estimatedHRMax,
    paceZones,
    hrZones,
    karvonenZones,
    thresholdZones,
    racePredictions,
    hrMaxSource,
    activeZoneMethod,
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

// ─── Stale check ──────────────────────────────────────────────────────────────

export function calibrationIsStale(calibration: CalibrationOutput): boolean {
  return (Date.now() - calibration.lastCalibratedAt) / (24 * 60 * 60 * 1000) > 60;
}

// ─── Default profile factory ──────────────────────────────────────────────────

export function createDefaultProfile(overrides: {
  athleteId:   string;
  name:        string;
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
    hrMaxManual:           false,
    hrResting:             null,
    hrThreshold:           null,
    thresholdTest:         null,
    mafTests:              [],
    thresholdPaceSecPerMi: null,
    vo2Estimate:           overrides.vo2Estimate,
    vdot:                  overrides.vo2Estimate,
    activeZoneMethod:      'vdot',
    fatigueSensitivity:    1.0,
    recoveryResponsiveness: 1.0,
    heatSensitivity:       1.0,
    altitudeMeters:        0,
    availableDays:         ['Mon', 'Tue', 'Wed', 'Thu', 'Sat', 'Sun'],
    targetSessions:        5,
    calibration:           null,
  };
}
