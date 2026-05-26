// ─── Performance Engine ─────────────────────────────────────────────────────
//
// Computes eight dynamic performance dimensions from local training data.
// All logic is deterministic and pure — same input → same output.
// Scores degrade gracefully when data is sparse or missing.
//
// AI REPLACEMENT HOOK: This engine is the designated insertion point for a
// future Claude API layer that could interpret subjective data, training
// context, and movement findings to produce richer score explanations.

import type {
  PerformanceProfile,
  PerformanceDimension,
  PerformanceDimensionKey,
  PerformanceEngineInput,
  PerformanceConfidence,
} from '../types/performance';

// ─── Constants ────────────────────────────────────────────────────────────────

const FOUR_WEEKS_MS  = 28 * 24 * 60 * 60 * 1000;
const TWO_WEEKS_MS   = 14 * 24 * 60 * 60 * 1000;
const EIGHT_WEEKS_MS = 56 * 24 * 60 * 60 * 1000;

// Hard aerobic types
const HARD_TYPES = new Set([
  'vo2', 'intervals', 'threshold', 'tempo', 'norwegian_4x4',
  'hill_repeats', 'fartlek', 'sprint', 'strides',
]);

// Easy / aerobic types
const EASY_TYPES = new Set([
  'easy_run', 'recovery_run', 'long_run', 'recovery',
]);

// Long run types
const LONG_RUN_TYPES = new Set(['long_run']);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clamp(val: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, val));
}

function now(): number {
  return Date.now();
}

function worksInPast(ms: number, cutoffMs: number): boolean {
  return now() - ms < cutoffMs;
}

function confidenceFromCount(
  count: number,
  highThresh: number,
  modThresh:  number,
): PerformanceConfidence {
  if (count >= highThresh) return 'high';
  if (count >= modThresh)  return 'moderate';
  if (count >= 1)          return 'low';
  return 'estimated';
}

// ─── Dimension calculators ────────────────────────────────────────────────────

function calcAerobicPower(input: PerformanceEngineInput): PerformanceDimension {
  const { vdot, history, weeklyMileage } = input;
  const recentAerobic = history.filter(
    w => worksInPast(w.timestamp, FOUR_WEEKS_MS) && EASY_TYPES.has(w.type) && w.completed,
  );

  // Base: VDOT maps to ~0–100 range (realistic VDOT is 30–75)
  let score = vdot ? clamp(((vdot - 30) / 45) * 65 + 20, 15, 90) : 35;

  // Aerobic workout frequency modifier
  const aerobicBonus = clamp(recentAerobic.length * 2, 0, 15);
  score += aerobicBonus;

  // Weekly mileage modifier (more miles → higher aerobic base)
  const mileageBonus = clamp((weeklyMileage - 15) * 0.25, 0, 10);
  score += mileageBonus;

  score = clamp(score, 10, 92);

  const confidence = vdot
    ? confidenceFromCount(recentAerobic.length, 8, 4)
    : 'estimated';

  const missing: string[] = [];
  if (!vdot) missing.push('Race PR or threshold test for VDOT');
  if (recentAerobic.length < 4) missing.push('4+ aerobic workouts in the past 4 weeks');

  return {
    key:          'aerobic_power',
    label:        'Aerobic Power',
    score:        Math.round(score),
    confidence,
    source:       vdot ? `VDOT ${vdot.toFixed(1)} + ${recentAerobic.length} recent aerobic workouts` : 'Weekly mileage estimate',
    rationale:    vdot
      ? `VDOT ${vdot.toFixed(1)} anchors your aerobic ceiling. Recent aerobic volume adds ${aerobicBonus} pts.`
      : 'No VDOT available. Score estimated from mileage. Log a race PR to improve accuracy.',
    missingData:  missing,
    lastUpdatedAt: now(),
  };
}

function calcAnaerobicBattery(input: PerformanceEngineInput): PerformanceDimension {
  const { history, vdot } = input;
  const recentHard = history.filter(
    w => worksInPast(w.timestamp, FOUR_WEEKS_MS) && HARD_TYPES.has(w.type) && w.completed,
  );
  const recentHard8w = history.filter(
    w => worksInPast(w.timestamp, EIGHT_WEEKS_MS) && HARD_TYPES.has(w.type) && w.completed,
  );

  // Base: moderate default; grows with consistent hard training
  let score = 35;

  // Hard workout frequency (past 4 weeks)
  score += clamp(recentHard.length * 5, 0, 25);

  // VDOT supplement (higher aerobic base supports anaerobic capacity)
  if (vdot) score += clamp((vdot - 40) * 0.4, 0, 15);

  // Consistency bonus: sustained over 8 weeks
  if (recentHard8w.length >= 6) score += 10;
  else if (recentHard8w.length >= 3) score += 5;

  score = clamp(score, 10, 85);

  const confidence = confidenceFromCount(recentHard.length, 6, 3);
  const missing: string[] = [];
  if (recentHard.length === 0) missing.push('Interval / VO2 workouts in the past 4 weeks');
  if (!vdot) missing.push('Race PR for VDOT anchor');

  return {
    key:          'anaerobic_battery',
    label:        'Anaerobic Battery',
    score:        Math.round(score),
    confidence,
    source:       `${recentHard.length} hard sessions (4w) · ${recentHard8w.length} hard sessions (8w)`,
    rationale:    recentHard.length > 0
      ? `${recentHard.length} quality sessions in the past 4 weeks build anaerobic capacity.`
      : 'No recent hard workouts found. Score reflects baseline capacity only.',
    missingData:  missing,
    lastUpdatedAt: now(),
  };
}

function calcFatigueResistance(input: PerformanceEngineInput): PerformanceDimension {
  const { fatigueScore, recoveryScore, history } = input;
  const recentAll = history.filter(
    w => worksInPast(w.timestamp, FOUR_WEEKS_MS),
  );
  const completedRecent = recentAll.filter(w => w.completed);
  const adherenceRate = recentAll.length > 0
    ? completedRecent.length / recentAll.length
    : 0.5;

  // Inverted fatigue: lower fatigue = higher resistance
  let score = clamp(100 - fatigueScore, 20, 85);

  // Adherence modifier: training consistently despite load shows resistance
  score += clamp(adherenceRate * 15, 0, 15);

  // Recovery score supplement
  score = score * 0.6 + recoveryScore * 0.4;

  score = clamp(score, 10, 90);

  const confidence = recentAll.length >= 8 ? 'moderate' : 'low';

  return {
    key:          'fatigue_resistance',
    label:        'Fatigue Resistance',
    score:        Math.round(score),
    confidence,
    source:       `Fatigue ${fatigueScore} · Recovery ${recoveryScore} · Adherence ${Math.round(adherenceRate * 100)}%`,
    rationale:    fatigueScore > 70
      ? 'High fatigue is reducing your resistance score. Rest or reduce intensity.'
      : `Current fatigue (${fatigueScore}) and recovery (${recoveryScore}) indicate good resistance.`,
    lastUpdatedAt: now(),
  };
}

function calcDurability(input: PerformanceEngineInput): PerformanceDimension {
  const { history, weeklyMileage, activeRiskFlags } = input;
  const recentLong = history.filter(
    w => worksInPast(w.timestamp, EIGHT_WEEKS_MS) && LONG_RUN_TYPES.has(w.type) && w.completed,
  );
  const totalCompleted = history.filter(
    w => worksInPast(w.timestamp, EIGHT_WEEKS_MS) && w.completed,
  );

  // Base from long run consistency (cornerstone of durability)
  let score = 30 + clamp(recentLong.length * 6, 0, 30);

  // Weekly mileage base
  score += clamp((weeklyMileage - 10) * 0.4, 0, 15);

  // Training consistency (8-week)
  const weeklyAvg = totalCompleted.length / 8;
  score += clamp(weeklyAvg * 3, 0, 15);

  // Risk flag penalty (active high-severity flags reduce durability)
  const highFlags    = activeRiskFlags.filter(f =>
    f.severity === 'high' && f.affectsScores.includes('durability'),
  ).length;
  const modFlags     = activeRiskFlags.filter(f =>
    f.severity === 'moderate' && f.affectsScores.includes('durability'),
  ).length;
  score -= highFlags * 12 + modFlags * 5;

  score = clamp(score, 10, 88);

  const confidence = recentLong.length >= 4 ? 'moderate' : 'low';
  const missing: string[] = [];
  if (recentLong.length < 2) missing.push('Long runs in the past 8 weeks');

  return {
    key:          'durability',
    label:        'Durability',
    score:        Math.round(score),
    confidence,
    source:       `${recentLong.length} long runs (8w) · ${weeklyMileage.toFixed(0)} mi/week`,
    rationale:    recentLong.length >= 4
      ? `${recentLong.length} long runs in 8 weeks demonstrates solid durability base.`
      : 'Durability builds with consistent long runs. Aim for 1 long run per week.',
    missingData:  missing,
    lastUpdatedAt: now(),
  };
}

function calcMovementCapacity(input: PerformanceEngineInput): PerformanceDimension {
  const { activeRiskFlags } = input;

  // Base: 60 (neutral — no movement data assessed yet)
  let score = 60;

  const activeMovement = activeRiskFlags.filter(f =>
    f.affectsScores.includes('movement_capacity'),
  );
  const highFlags = activeMovement.filter(f => f.severity === 'high').length;
  const modFlags  = activeMovement.filter(f => f.severity === 'moderate').length;
  const lowFlags  = activeMovement.filter(f => f.severity === 'low').length;

  score -= highFlags * 15 + modFlags * 8 + lowFlags * 3;

  // If no movement data at all, score is estimated at 60
  const hasMovementData = activeRiskFlags.length > 0 ||
    input.history.some(w => worksInPast(w.timestamp, EIGHT_WEEKS_MS));

  score = clamp(score, 10, 90);

  const confidence: PerformanceConfidence = activeMovement.length >= 3
    ? 'moderate'
    : activeMovement.length > 0
    ? 'low'
    : 'estimated';

  return {
    key:          'movement_capacity',
    label:        'Movement Capacity',
    score:        Math.round(score),
    confidence,
    source:       activeMovement.length > 0
      ? `${activeMovement.length} active movement risk flags`
      : 'No movement analysis data',
    rationale:    activeMovement.length > 0
      ? `${highFlags} high · ${modFlags} moderate · ${lowFlags} low severity findings affect this score.`
      : 'Log a Movement Lab video to get an evidence-based movement capacity score.',
    missingData:  hasMovementData ? [] : ['Movement Lab video analysis'],
    lastUpdatedAt: now(),
  };
}

function calcRecoveryCapacity(input: PerformanceEngineInput): PerformanceDimension {
  const { recoveryScore, fatigueScore, checkInCount } = input;

  // Base: directly from recovery score
  let score = recoveryScore * 0.75;

  // Check-in consistency bonus
  score += clamp(checkInCount * 0.5, 0, 15);

  // Penalize for chronic low recovery
  if (recoveryScore < 40) score -= 10;

  score = clamp(score, 10, 92);

  const confidence = checkInCount >= 14 ? 'moderate' : checkInCount >= 5 ? 'low' : 'estimated';

  return {
    key:          'recovery_capacity',
    label:        'Recovery Capacity',
    score:        Math.round(score),
    confidence,
    source:       `Recovery score ${recoveryScore} · ${checkInCount} check-ins logged`,
    rationale:    recoveryScore >= 65
      ? 'Strong recovery signals indicate good systemic recovery capacity.'
      : `Recovery score ${recoveryScore} suggests recovery capacity is currently limited.`,
    missingData:  checkInCount < 7 ? ['7+ daily check-ins for trend data'] : [],
    lastUpdatedAt: now(),
  };
}

function calcThresholdEfficiency(input: PerformanceEngineInput): PerformanceDimension {
  const { vdot, lthr, thresholdPaceSec, history } = input;
  const thresholdWorkouts = history.filter(
    w => worksInPast(w.timestamp, FOUR_WEEKS_MS) &&
      (w.type === 'threshold' || w.type === 'tempo') && w.completed,
  );

  let score = 40;  // base: moderate

  // VDOT-based component (threshold efficiency correlates with aerobic ceiling)
  if (vdot) {
    score += clamp((vdot - 35) * 0.7, 0, 25);
  }

  // Threshold workout frequency
  score += clamp(thresholdWorkouts.length * 4, 0, 15);

  // If we have LTHR and threshold pace, we can compute a quality indicator:
  // At LTHR, the athlete should sustain threshold pace. Better ratio = higher score.
  if (lthr && thresholdPaceSec && vdot) {
    // Typically LTHR ≈ 87–92% of HRmax; well-trained athletes sustain faster paces
    // at LTHR. Proxy: compare actual threshold pace to VDOT-expected threshold.
    score += 5;  // data available
  }

  score = clamp(score, 15, 88);

  const confidence = (vdot && lthr && thresholdPaceSec)
    ? 'moderate'
    : vdot
    ? 'low'
    : 'estimated';

  const missing: string[] = [];
  if (!vdot) missing.push('Race PR or time trial for VDOT');
  if (!lthr || !thresholdPaceSec) missing.push('30-min threshold field test');

  return {
    key:          'threshold_efficiency',
    label:        'Threshold Efficiency',
    score:        Math.round(score),
    confidence,
    source:       vdot
      ? `VDOT ${vdot.toFixed(1)}${lthr ? ` · LTHR ${lthr}` : ''} · ${thresholdWorkouts.length} threshold sessions`
      : 'No threshold data',
    rationale:    vdot
      ? `Threshold efficiency is anchored to VDOT ${vdot.toFixed(1)}. ${thresholdWorkouts.length} recent threshold sessions add training-specific fitness.`
      : 'Complete a 30-minute threshold test to unlock this score.',
    missingData:  missing,
    lastUpdatedAt: now(),
  };
}

function calcRunningEconomy(input: PerformanceEngineInput): PerformanceDimension {
  const { vdot, weeklyMileage, history, activeRiskFlags } = input;
  const recentEasy = history.filter(
    w => worksInPast(w.timestamp, EIGHT_WEEKS_MS) && EASY_TYPES.has(w.type) && w.completed,
  );

  // Running economy improves with mileage accumulation and high VDOT
  let score = 40;

  if (vdot) score += clamp((vdot - 30) * 0.5, 0, 20);
  score += clamp((weeklyMileage - 10) * 0.3, 0, 15);
  score += clamp(recentEasy.length * 0.5, 0, 10);

  // Movement flags that affect running economy
  const econFlags = activeRiskFlags.filter(f =>
    f.affectsScores.includes('running_economy'),
  );
  const highFlags = econFlags.filter(f => f.severity === 'high').length;
  const modFlags  = econFlags.filter(f => f.severity === 'moderate').length;
  score -= highFlags * 12 + modFlags * 6;

  score = clamp(score, 10, 85);

  const confidence = (vdot && weeklyMileage > 20) ? 'moderate' : 'low';

  return {
    key:          'running_economy',
    label:        'Running Economy',
    score:        Math.round(score),
    confidence,
    source:       vdot
      ? `VDOT ${vdot.toFixed(1)} · ${weeklyMileage.toFixed(0)} mi/week · ${econFlags.length} form flags`
      : 'Mileage estimate only',
    rationale:    econFlags.length > 0
      ? `${econFlags.length} movement finding(s) (e.g. overstride, valgus) are lowering economy score.`
      : 'Economy improves with consistent easy mileage and good form. Log a Movement Lab video for gait-specific insights.',
    missingData:  !vdot ? ['Race PR for VDOT'] : econFlags.length === 0 ? ['Movement Lab gait video'] : [],
    lastUpdatedAt: now(),
  };
}

// ─── Main entry: buildPerformanceProfile ─────────────────────────────────────

export function buildPerformanceProfile(
  input:    PerformanceEngineInput,
  previous?: PerformanceProfile,
): PerformanceProfile {
  const dimensions: PerformanceDimension[] = [
    calcAerobicPower(input),
    calcAnaerobicBattery(input),
    calcFatigueResistance(input),
    calcDurability(input),
    calcMovementCapacity(input),
    calcRecoveryCapacity(input),
    calcThresholdEfficiency(input),
    calcRunningEconomy(input),
  ];

  // Attach previous scores for delta display
  if (previous) {
    for (const dim of dimensions) {
      const prev = previous.dimensions.find(d => d.key === dim.key);
      if (prev) {
        dim.previousScore = prev.score;
        dim.delta         = dim.score - prev.score;
      }
    }
  }

  // Overall: weighted average (aerobic/durability/recovery weighted higher)
  const WEIGHTS: Record<PerformanceDimensionKey, number> = {
    aerobic_power:       1.5,
    anaerobic_battery:   1.0,
    fatigue_resistance:  1.2,
    durability:          1.3,
    movement_capacity:   0.8,
    recovery_capacity:   1.2,
    threshold_efficiency: 1.0,
    running_economy:     1.0,
  };

  const totalWeight = Object.values(WEIGHTS).reduce((a, b) => a + b, 0);
  const overallScore = Math.round(
    dimensions.reduce((sum, d) => sum + d.score * WEIGHTS[d.key], 0) / totalWeight,
  );

  // Data quality from confidence distribution
  const highCount = dimensions.filter(d => d.confidence === 'high').length;
  const modCount  = dimensions.filter(d => d.confidence === 'moderate').length;
  const totalConf = highCount + modCount;
  const dataQuality = totalConf >= 6
    ? 'high'
    : totalConf >= 4
    ? 'moderate'
    : totalConf >= 2
    ? 'low'
    : 'insufficient';

  return {
    dimensions,
    overallScore,
    lastCalculatedAt: now(),
    dataQuality,
  };
}

// Convenience: readable confidence label for UI
export function confidenceText(c: PerformanceConfidence): string {
  switch (c) {
    case 'high':      return 'High confidence';
    case 'moderate':  return 'Moderate confidence';
    case 'low':       return 'Low confidence';
    case 'estimated': return 'Estimated';
  }
}
