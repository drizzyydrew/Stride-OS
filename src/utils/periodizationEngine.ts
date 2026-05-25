import { resolveRaceDistance, buildPeriodizationPlan } from './periodization';
import { computeProgressedMileage } from './progression';

import type {
  MesocyclePosition,
  IntensityTargets,
  LongRunTarget,
  WeeklyLoadTargets,
  ProgressionSafeguard,
  PhaseIntegrityFlag,
  PhaseRationale,
  PeriodizationInput,
  PeriodizationOutput,
} from '../types/periodization';
import type { TrainingPhase, RaceDistance } from '../types/training';

// ─── Mesocycle Position ────────────────────────────────────────────────────────

// Bompa & Haff (2009): 4-week mesocycle — 3 loading weeks + 1 deload.
// Multipliers create progressive overload within each block: 90% → 95% → 100% → 65%.
const BLOCK_MULTIPLIERS = [0.90, 0.95, 1.00, 0.65] as const;

export function getMesocyclePosition(currentWeek: number, phase: TrainingPhase): MesocyclePosition {
  const blockNumber   = Math.ceil(currentWeek / 4);
  const weekInBlock   = ((currentWeek - 1) % 4) + 1;
  const isDeload      = weekInBlock === 4 || phase === 'deload';
  const isLoadingPeak = weekInBlock === 3 && !isDeload;
  const blockMultiplier = BLOCK_MULTIPLIERS[weekInBlock - 1];

  return { blockNumber, weekInBlock, isDeload, isLoadingPeak, blockMultiplier };
}

// ─── Intensity Targets ─────────────────────────────────────────────────────────

// Seiler (2010): 80/20 polarized distribution — base skews easier, peak skews harder.
// Deload: near-pure aerobic/recovery. Taper: maintain neuromuscular sharpness.
const INTENSITY_TARGETS: Record<TrainingPhase, IntensityTargets> = {
  base:   { easy: 0.85, moderate: 0.00, hard: 0.15 },
  build:  { easy: 0.80, moderate: 0.05, hard: 0.15 },
  peak:   { easy: 0.75, moderate: 0.05, hard: 0.20 },
  deload: { easy: 0.92, moderate: 0.08, hard: 0.00 },
  taper:  { easy: 0.80, moderate: 0.05, hard: 0.15 },
};

export function getIntensityTargets(phase: TrainingPhase): IntensityTargets {
  return INTENSITY_TARGETS[phase];
}

// ─── Long Run Targets ──────────────────────────────────────────────────────────

// Jack Daniels (2005): long run ≤ 30% of weekly mileage or 2.5h (whichever is shorter).
// Absolute caps by race distance ensure specificity without excessive loading.
const LONG_RUN_PCT: Record<TrainingPhase, [number, number]> = {
  base:   [0.24, 0.30],
  build:  [0.27, 0.33],
  peak:   [0.30, 0.35],
  deload: [0.15, 0.20],
  taper:  [0.18, 0.22],
};

const LONG_RUN_ABS_CAP: Record<RaceDistance, number> = {
  marathon:      22,
  half_marathon: 14,
  '10k':         10,
  '5k':           8,
};

export function getLongRunTarget(
  weeklyTarget: number,
  phase:        TrainingPhase,
  raceDistance: RaceDistance,
): LongRunTarget {
  const [pctMin, pctMax] = LONG_RUN_PCT[phase];
  const pctMid           = (pctMin + pctMax) / 2;
  const absCap           = LONG_RUN_ABS_CAP[raceDistance];

  const raw = {
    min:    weeklyTarget * pctMin,
    target: weeklyTarget * pctMid,
    max:    weeklyTarget * pctMax,
  };

  return {
    minMiles:    Math.round(Math.min(raw.min, absCap * 0.85) * 10) / 10,
    targetMiles: Math.round(Math.min(raw.target, absCap * 0.95) * 10) / 10,
    maxMiles:    Math.round(Math.min(raw.max, absCap) * 10) / 10,
    pctOfWeekly: pctMid,
  };
}

// ─── Adaptive Ceiling ──────────────────────────────────────────────────────────

// Gabbett (2016): ACWR > 1.3 significantly elevates injury risk.
// Meeusen et al. (2013): unresolved fatigue markers require load reduction.
// Multiple independent risk factors compound — we take the most restrictive.

type CeilingResult = { factor: number; reason: string | undefined };

export function getAdaptiveCeiling(
  acwr:         number,
  fatigueScore: number,
  recoveryScore: number,
  adherenceRate: number,
): CeilingResult {
  const ceilings: { factor: number; reason: string }[] = [];

  if (acwr > 1.5)        ceilings.push({ factor: 0.65, reason: 'ACWR > 1.5 — high injury risk' });
  else if (acwr > 1.3)   ceilings.push({ factor: 0.80, reason: 'ACWR > 1.3 — elevated risk zone' });

  if (fatigueScore > 80) ceilings.push({ factor: 0.70, reason: 'Fatigue critical — reduce load' });
  else if (fatigueScore > 65) ceilings.push({ factor: 0.85, reason: 'Fatigue high — moderate ceiling' });

  if (recoveryScore < 35) ceilings.push({ factor: 0.75, reason: 'Recovery very low — prioritize rest' });
  else if (recoveryScore < 50) ceilings.push({ factor: 0.85, reason: 'Recovery poor — limit load' });

  if (adherenceRate < 0.50) ceilings.push({ factor: 0.90, reason: 'Low adherence — keep load achievable' });

  if (ceilings.length === 0) return { factor: 1.0, reason: undefined };

  const worst = ceilings.reduce((a, b) => b.factor < a.factor ? b : a);
  return { factor: worst.factor, reason: worst.reason };
}

// ─── Mileage Targets ──────────────────────────────────────────────────────────

function buildMileageRange(base: number, target: number, ceiling: number): [number, number, number] {
  const capped     = target * ceiling;
  const minMiles   = Math.round(capped * 0.88 * 10) / 10;
  const targetMiles= Math.round(capped * 10) / 10;
  const maxMiles   = Math.round(Math.min(capped * 1.08, base * 1.30) * 10) / 10;
  return [minMiles, targetMiles, maxMiles];
}

// ─── Progression Safeguards ───────────────────────────────────────────────────

export function getProgressionSafeguards(
  previousWeekMiles:  number,
  targetMiles:        number,
  phase:              TrainingPhase,
  recentHardSessions: number,
  recoveryScore:      number,
  longRunMax:         number,
  absCap:             number,
): ProgressionSafeguard[] {
  const safeguards: ProgressionSafeguard[] = [];

  // Jack Daniels 10% rule: weekly mileage increase should not exceed ~10%.
  if (previousWeekMiles > 0 && targetMiles > previousWeekMiles * 1.12) {
    const jumpPct = Math.round(((targetMiles / previousWeekMiles) - 1) * 100);
    safeguards.push({
      type:    'mileage_jump',
      severity: jumpPct > 18 ? 'critical' : 'warning',
      message:  `Target is ${jumpPct}% above last week — exceeds 10% rule`,
      recommendation: 'Cap increase at 8–10% of last week\'s mileage to reduce injury risk',
    });
  }

  // Intensity stacking: ≥ 2 hard sessions in last 7 days during hard phase = risk.
  if (recentHardSessions >= 2 && (phase === 'peak' || phase === 'build')) {
    safeguards.push({
      type:    'intensity_stacking',
      severity: recentHardSessions >= 3 ? 'critical' : 'warning',
      message:  `${recentHardSessions} hard sessions detected in the last 7 days`,
      recommendation: 'Space hard sessions ≥ 48h apart; add an easy day between quality work',
    });
  }

  // Long run absolute cap check.
  if (longRunMax >= absCap) {
    safeguards.push({
      type:    'long_run_cap',
      severity: 'warning',
      message:  `Long run approaching distance-specific ceiling (${absCap} mi)`,
      recommendation: 'Do not exceed the absolute cap — additional long runs risk diminishing return',
    });
  }

  // Insufficient recovery: hard weeks should not be scheduled on poor recovery.
  if (recoveryScore < 40 && (phase === 'build' || phase === 'peak')) {
    safeguards.push({
      type:    'insufficient_recovery',
      severity: recoveryScore < 30 ? 'critical' : 'warning',
      message:  `Recovery score ${recoveryScore} — below threshold for quality training`,
      recommendation: 'Shift this week to aerobic/easy work only; delay quality sessions',
    });
  }

  return safeguards;
}

// ─── Phase Integrity Flags ────────────────────────────────────────────────────

export function getPhaseIntegrityFlags(
  phase:           TrainingPhase,
  adaptiveCeiling: number,
  fatigueScore:    number,
  longRunCapped:   boolean,
): PhaseIntegrityFlag[] {
  const flags: PhaseIntegrityFlag[] = [];

  if (phase === 'taper') {
    flags.push({
      type:      'taper_preserved',
      message:   'Taper week — intensity and volume are locked into reduction mode. Do not add sessions.',
      protected: true,
    });
  }

  if (phase === 'deload') {
    flags.push({
      type:      'deload_enforced',
      message:   'Deload week — load is reduced to 65% of peak. Recovery supercompensation is the goal.',
      protected: true,
    });
  }

  if (adaptiveCeiling < 1.0) {
    flags.push({
      type:      'acwr_ceiling_applied',
      message:   `Load ceiling applied at ${Math.round(adaptiveCeiling * 100)}% of target — real-time metrics require caution.`,
      protected: false,
    });
  }

  if (fatigueScore > 75 && (phase === 'build' || phase === 'peak')) {
    flags.push({
      type:      'fatigue_override',
      message:   'Fatigue elevated above safe threshold for quality training. Consider treating this as a deload.',
      protected: false,
    });
  }

  if (longRunCapped) {
    flags.push({
      type:      'long_run_capped',
      message:   'Long run bounded by race-distance ceiling. Further increases unlikely to produce additional aerobic benefit.',
      protected: false,
    });
  }

  return flags;
}

// ─── Phase Rationale ──────────────────────────────────────────────────────────

const PHASE_RATIONALE: Record<TrainingPhase, Omit<PhaseRationale, 'keyFocus'>> = {
  base: {
    whyThisPhase:     'The base phase lays the aerobic foundation. Easy, high-volume running builds mitochondrial density and capillary networks in slow-twitch muscle fibers.',
    adaptationTarget: 'Aerobic base development, fat oxidation efficiency, musculoskeletal durability, and movement economy at easy paces.',
    successCriteria:  'Easy runs feel genuinely easy. Resting heart rate is stable or dropping. No recurring soreness. Mileage tolerance is building week over week.',
  },
  build: {
    whyThisPhase:     'The build phase adds structured quality work on top of the aerobic base. Threshold and VO2 sessions extend your lactate threshold and race-specific fitness.',
    adaptationTarget: 'Lactate threshold elevation, aerobic power, running economy at race pace, and ability to sustain effort in the discomfort zone.',
    successCriteria:  'Threshold runs at target pace feel controlled. Long runs include the last miles at strong effort. ACWR stays between 0.8–1.3.',
  },
  peak: {
    whyThisPhase:     'Peak training delivers the highest stress stimulus before the race. This phase demands the most — the goal is to peak fitness without accumulating residual fatigue.',
    adaptationTarget: 'Race-specific neuromuscular patterns, peak VO2 utilization, tolerance for sustained high-intensity effort, and race-pace confidence.',
    successCriteria:  'Workouts hit target paces without excessive strain. Recovery between sessions is adequate. Confidence in race fitness is building.',
  },
  deload: {
    whyThisPhase:     'Deload weeks allow supercompensation — the body rebuilds stronger during recovery. Skipping deloads is the most common cause of accumulated fatigue and injury.',
    adaptationTarget: 'Tissue repair, glycogen restoration, nervous system recovery, and hormonal rebalancing after 3 weeks of progressive loading.',
    successCriteria:  'Legs feel fresh by mid-week. Fatigue score drops measurably. Motivation to train returns. No lingering soreness from previous loading block.',
  },
  taper: {
    whyThisPhase:     'Taper reduces training load to allow full recovery before race day. Research shows 40–60% volume reduction over 2–3 weeks produces peak performance.',
    adaptationTarget: 'Full glycogen saturation, neuromuscular freshness, hormonal balance, reduced inflammation, and psychological readiness for race effort.',
    successCriteria:  'Legs feel springy. Race-pace runs feel easier than expected. Sleep is good. Excitement (not anxiety) is the dominant feeling approaching race day.',
  },
};

const PHASE_KEY_FOCUS: Record<TrainingPhase, string> = {
  base:   'Build your long run and keep the vast majority of miles genuinely easy — conversational pace throughout.',
  build:  'Execute threshold and quality sessions precisely; protect recovery days to absorb the adaptation.',
  peak:   'Hit the peak long run and key race-pace workouts. This is the hardest week of the plan — trust the process.',
  deload: 'Resist the urge to add extra miles. Active recovery runs only. Sleep and nutrition are the work this week.',
  taper:  'Short, sharp, easy miles only. Resist the "taper madness" urge. Your fitness is banked — rest is the strategy.',
};

export function getPhaseRationale(phase: TrainingPhase): PhaseRationale {
  return {
    ...PHASE_RATIONALE[phase],
    keyFocus: PHASE_KEY_FOCUS[phase],
  };
}

// ─── TSS-Analog Load Range ─────────────────────────────────────────────────────

// Rough TSS estimate: miles × intensity factor × 10
const INTENSITY_LOAD_FACTOR: Record<TrainingPhase, number> = {
  base:   6.5,
  build:  8.5,
  peak:   9.5,
  deload: 4.5,
  taper:  5.5,
};

function estimateLoadRange(targetMiles: number, phase: TrainingPhase): [number, number] {
  const factor = INTENSITY_LOAD_FACTOR[phase];
  return [
    Math.round(targetMiles * factor * 0.85),
    Math.round(targetMiles * factor * 1.15),
  ];
}

// ─── Main Engine ───────────────────────────────────────────────────────────────

export function computePeriodization(input: PeriodizationInput): PeriodizationOutput {
  const {
    weeklyMileage,
    currentWeek,
    trainingPhase,
    progressionLevel,
    goalRace,
    acwr,
    fatigueScore,
    recoveryScore,
    adherenceRate,
    previousWeekMiles,
    recentHardSessions,
  } = input;

  const raceDistance = resolveRaceDistance(goalRace);
  const plan         = buildPeriodizationPlan(goalRace, weeklyMileage);

  const mesocycle    = getMesocyclePosition(currentWeek, trainingPhase);

  // Target mileage: apply block multiplier on top of progression model.
  const progressedBase = computeProgressedMileage({
    baseMileage:      weeklyMileage,
    currentWeek,
    phase:            trainingPhase,
    progressionLevel,
  });
  const rawTarget = progressedBase * mesocycle.blockMultiplier;

  // Adaptive ceiling from real-time readiness metrics.
  const { factor: ceilingFactor, reason: ceilingReason } = getAdaptiveCeiling(
    acwr, fatigueScore, recoveryScore, adherenceRate,
  );

  const [minMiles, targetMiles, maxMiles] = buildMileageRange(
    weeklyMileage, rawTarget, ceilingFactor,
  );

  const absCap   = LONG_RUN_ABS_CAP[raceDistance];
  const longRun  = getLongRunTarget(targetMiles, trainingPhase, raceDistance);
  const intensity = getIntensityTargets(trainingPhase);
  const loadRange = estimateLoadRange(targetMiles, trainingPhase);

  const safeguards = getProgressionSafeguards(
    previousWeekMiles,
    targetMiles,
    trainingPhase,
    recentHardSessions,
    recoveryScore,
    longRun.maxMiles,
    absCap,
  );

  const longRunCapped = longRun.maxMiles >= absCap * 0.95;
  const integrityFlags = getPhaseIntegrityFlags(
    trainingPhase,
    ceilingFactor,
    fatigueScore,
    longRunCapped,
  );

  const weeklyTargets: WeeklyLoadTargets = {
    minMiles,
    targetMiles,
    maxMiles,
    longRun,
    intensity,
    targetLoadRange: loadRange,
    adaptiveCeiling: ceilingFactor,
    ceilingReason,
  };

  return {
    mesocycle,
    weeklyTargets,
    safeguards,
    integrityFlags,
    rationale: getPhaseRationale(trainingPhase),
    raceDistance,
    totalWeeks:  plan.totalWeeks,
    planPhases:  plan.phases,
  };
}
