import { resolveRaceDistance, buildPeriodizationPlan } from './periodization';
import { computeProgressedMileage } from './progression';
import { resolveDeloadDecision } from './training/deloadModel';

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

export function getMesocyclePosition(currentWeek: number, phase: TrainingPhase): MesocyclePosition {
  const decision = resolveDeloadDecision({ currentWeek, phase });
  return {
    blockNumber: decision.blockNumber,
    weekInBlock: decision.weekInBlock,
    isDeload: decision.isDeload,
    isLoadingPeak: decision.isLoadingPeak,
    blockMultiplier: decision.blockMultiplier,
  };
}

// ─── Intensity Targets ─────────────────────────────────────────────────────────

// Seiler (2010): 80/20 polarized distribution — base skews easier, peak skews harder.
// Deload: near-pure aerobic/recovery. Taper: maintain neuromuscular sharpness.
const INTENSITY_TARGETS: Record<TrainingPhase, IntensityTargets> = {
  foundation: { easy: 1.00, moderate: 0.00, hard: 0.00 },
  base:   { easy: 0.85, moderate: 0.00, hard: 0.15 },
  aerobic_development: { easy: 0.88, moderate: 0.07, hard: 0.05 },
  threshold: { easy: 0.80, moderate: 0.10, hard: 0.10 },
  vo2: { easy: 0.80, moderate: 0.05, hard: 0.15 },
  race_specific: { easy: 0.78, moderate: 0.07, hard: 0.15 },
  build:  { easy: 0.80, moderate: 0.05, hard: 0.15 },
  peak:   { easy: 0.75, moderate: 0.05, hard: 0.20 },
  deload: { easy: 0.92, moderate: 0.08, hard: 0.00 },
  taper:  { easy: 0.80, moderate: 0.05, hard: 0.15 },
  transition: { easy: 0.95, moderate: 0.05, hard: 0.00 },
  recovery: { easy: 1.00, moderate: 0.00, hard: 0.00 },
};

export function getIntensityTargets(phase: TrainingPhase): IntensityTargets {
  return INTENSITY_TARGETS[phase];
}

// ─── Long Run Targets ──────────────────────────────────────────────────────────

// Jack Daniels (2005): long run ≤ 30% of weekly mileage or 2.5h (whichever is shorter).
// Absolute caps by race distance ensure specificity without excessive loading.
const LONG_RUN_PCT: Record<TrainingPhase, [number, number]> = {
  foundation: [0.20, 0.25],
  base:   [0.24, 0.30],
  aerobic_development: [0.24, 0.30],
  threshold: [0.25, 0.31],
  vo2: [0.23, 0.28],
  race_specific: [0.28, 0.34],
  build:  [0.27, 0.33],
  peak:   [0.30, 0.35],
  deload: [0.15, 0.20],
  taper:  [0.18, 0.22],
  transition: [0.15, 0.22],
  recovery: [0.12, 0.18],
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

// ACWR is retained as a workload-trend input, not an injury predictor.
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

  if (acwr > 1.5)        ceilings.push({ factor: 0.65, reason: 'ACWR > 1.5 — abrupt recent load increase; use conservative progression' });
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
      recommendation: 'Cap the increase at 8–10% of last week\'s mileage to avoid an abrupt workload jump',
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
  foundation: {
    whyThisPhase:     'Foundation phase builds the running habit from zero. Run/walk intervals let tendons, bones, and the cardiovascular system adapt gradually before any continuous running volume or intensity is introduced.',
    adaptationTarget: 'Basic aerobic capacity, musculoskeletal adaptation to impact, and a consistent training habit — the prerequisites for everything that follows.',
    successCriteria:  'Sessions feel manageable and repeatable. No new aches or pains. Walk breaks feel like part of the plan, not a setback.',
  },
  base: {
    whyThisPhase:     'The base phase lays the aerobic foundation. Easy, high-volume running builds mitochondrial density and capillary networks in slow-twitch muscle fibers.',
    adaptationTarget: 'Aerobic base development, fat oxidation efficiency, musculoskeletal durability, and movement economy at easy paces.',
    successCriteria:  'Easy runs feel genuinely easy. Resting heart rate is stable or dropping. No recurring soreness. Mileage tolerance is building week over week.',
  },
  aerobic_development: {
    whyThisPhase:     'Aerobic development extends the base phase with slightly more purposeful volume while keeping effort controlled.',
    adaptationTarget: 'Aerobic capacity, durability, and repeatable weekly consistency.',
    successCriteria:  'Most sessions remain conversational, long-run tolerance improves, and recovery stays stable.',
  },
  threshold: {
    whyThisPhase:     'Threshold training introduces controlled sustained efforts after the aerobic base is ready.',
    adaptationTarget: 'Lactate clearance, steady-state control, and comfort near race-specific effort.',
    successCriteria:  'Quality segments feel strong but controlled, with no need to force paces.',
  },
  vo2: {
    whyThisPhase:     'VO₂ work is a limited high-intensity stimulus reserved for athletes with adequate base and recovery.',
    adaptationTarget: 'Aerobic power and controlled high-end effort tolerance.',
    successCriteria:  'Intervals are completed with consistent effort and full recovery between hard days.',
  },
  race_specific: {
    whyThisPhase:     'Race-specific work narrows training toward the demands of the target event.',
    adaptationTarget: 'Race-pace economy, fueling practice, and confidence in event-specific rhythm.',
    successCriteria:  'Key sessions match intended effort without disrupting recovery.',
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
  transition: {
    whyThisPhase:     'Transition lowers structure after a major goal or interruption so training can restart cleanly.',
    adaptationTarget: 'Routine, movement quality, and fatigue dissipation.',
    successCriteria:  'Training feels repeatable and the athlete is ready to resume a normal build.',
  },
  recovery: {
    whyThisPhase:     'Recovery prioritizes restoration when training stress or life stress needs to come down.',
    adaptationTarget: 'Freshness, symptom-free movement, and readiness to resume normal loading.',
    successCriteria:  'Fatigue drops, easy movement feels better, and hard sessions are no longer being forced.',
  },
};

const PHASE_KEY_FOCUS: Record<TrainingPhase, string> = {
  foundation: 'Show up consistently. Walk breaks are part of the plan — the goal is building the habit, not speed.',
  base:   'Build your long run and keep the vast majority of miles genuinely easy — conversational pace throughout.',
  aerobic_development: 'Build aerobic capacity with controlled volume. Do not turn easy days into hidden workouts.',
  threshold: 'Use controlled sustained efforts; stop chasing pace if effort drifts above the target.',
  vo2: 'Keep high-intensity exposure limited, precise, and surrounded by recovery.',
  race_specific: 'Practice the event demands without adding extra stress outside the prescription.',
  build:  'Execute threshold and quality sessions precisely; protect recovery days to absorb the adaptation.',
  peak:   'Hit the peak long run and key race-pace workouts. This is the hardest week of the plan — trust the process.',
  deload: 'Resist the urge to add extra miles. Active recovery runs only. Sleep and nutrition are the work this week.',
  taper:  'Short, sharp, easy miles only. Resist the "taper madness" urge. Your fitness is banked — rest is the strategy.',
  transition: 'Keep structure light and rebuild rhythm before adding load.',
  recovery: 'Choose restoration first; the goal is to be ready for the next useful training signal.',
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
  foundation: 4.0,
  base:   6.5,
  aerobic_development: 7.0,
  threshold: 8.0,
  vo2: 8.8,
  race_specific: 8.2,
  build:  8.5,
  peak:   9.5,
  deload: 4.5,
  taper:  5.5,
  transition: 4.2,
  recovery: 3.5,
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
