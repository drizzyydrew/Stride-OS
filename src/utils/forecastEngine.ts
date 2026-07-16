// Pure, deterministic performance forecasting engine.
// No AI APIs, no network calls. All inputs come from local stores.
//
// Physiological foundations:
//   Race time prediction  — Jack Daniels (2005) VDOT formula (binary-search over velocity)
//   VDOT adjustment       — fatigue penalty + adherence/long-run bonuses
//   Trajectory projection — OLS slopes anchored to current measured values
//   ACWR overreaching     — Gabbett (2016) optimal zone 0.8–1.3; high risk >1.5
//
// AI integration point: swap `adjustedVDOT()` with an ML model that takes
// the full feature vector. All surrounding types/structure stay identical.

import type {
  ForecastInput,
  ForecastResult,
  ForecastTrendDirection,
  RaceTimePrediction,
  FatigueTrajectory,
  RecoveryTrajectory,
  ReadinessForecast,
  OverreachingRisk,
  TrajectoryPoint,
} from '../types/forecast';

// ─── Daniels' VDOT → Race Time (Jack Daniels 2005) ───────────────────────────
//
// Given VDOT and distance, binary-search for velocity v (m/min) satisfying:
//   VO2(v) / %VO2max(t) = VDOT      where t = distanceMeters / v  (minutes)
//
// %VO2max(t) = 0.8 + 0.1894393·e^(−0.012778·t) + 0.2989558·e^(−0.1932605·t)
// VO2(v)     = −4.60 + 0.182258·v + 0.000104·v²

function vdotAtVelocity(v: number, distanceMeters: number): number {
  const t   = distanceMeters / v;
  const pct = 0.8
    + 0.1894393 * Math.exp(-0.012778  * t)
    + 0.2989558 * Math.exp(-0.1932605 * t);
  const vo2 = -4.60 + 0.182258 * v + 0.000104 * v * v;
  return vo2 / pct;
}

function predictRaceMinutes(vdot: number, distanceMeters: number): number {
  // 100–600 m/min spans ~1:40/mi (elite) to ~26:00/mi (walk)
  let lo = 100, hi = 600;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (vdotAtVelocity(mid, distanceMeters) < vdot) lo = mid;
    else hi = mid;
  }
  return distanceMeters / ((lo + hi) / 2);
}

// ─── Formatting ───────────────────────────────────────────────────────────────

function formatMinutes(totalMinutes: number): string {
  const h  = Math.floor(totalMinutes / 60);
  const m  = Math.floor(totalMinutes % 60);
  const s  = Math.round((totalMinutes - Math.floor(totalMinutes)) * 60);
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

// ─── Adjusted VDOT ────────────────────────────────────────────────────────────
//
// Base VDOT from the athlete's store (VO2max estimate).
// Adjustments model how current physiological state affects race readiness:
//
// Fatigue penalty:    0 at fatigue ≤ 40; up to −3 VDOT pts at fatigue = 100.
//   High fatigue = can't fully express aerobic ceiling on race day.
//
// Adherence bonus:    up to +1 VDOT pt. Consistent training builds fitness.
//
// Long run bonus:     up to +1 VDOT pt for marathon. Long run is the primary
//   stimulus for aerobic fat oxidation and glycogen sparing (Holloszy 1967).

function adjustedVDOT(input: ForecastInput): number {
  const fatiguePenalty = Math.max(0, (input.fatigueScore - 40) / 60) * 3;
  const adherenceBonus = input.adherenceRate * 1;
  const longRunBonus   = input.longRunConsistency * 1;
  return Math.max(25, input.vdot - fatiguePenalty + adherenceBonus + longRunBonus);
}

// ─── Trend direction ──────────────────────────────────────────────────────────

function deriveTrend(signal: number, threshold = 0.2): ForecastTrendDirection {
  if (signal >  threshold) return 'improving';
  if (signal < -threshold) return 'declining';
  return 'stable';
}

// ─── Confidence ───────────────────────────────────────────────────────────────
//
// How reliable are race time predictions?
//
// History depth  (0–40 pts): 0 wks = 0; 8+ wks = 40. More real data → better.
// ACWR zone      (0–25 pts): 0.8–1.3 = 25; ≤1.5 = 10; >1.5 = 0.
//   Training in the optimal zone is a prerequisite for accurate VDOT estimation.
// Adherence      (0–20 pts): 100% = 20. Missed sessions degrade fitness signal.
// Easy proportion(0–15 pts): ≥0.80 = 15 (Seiler 80/20 polarized principle).
//   Athletes doing >80% easy work have more predictable aerobic responses.

function computeConfidence(input: ForecastInput): number {
  const historyPts  = Math.min(40, input.historyWeeks * 5);
  const acwrPts     = input.acwr >= 0.8 && input.acwr <= 1.3 ? 25
                    : input.acwr <= 1.5                       ? 10
                    : 0;
  const adherPts    = Math.round(input.adherenceRate * 20);
  const easyPts     = input.easyProportion >= 0.80 ? 15
                    : input.easyProportion >= 0.65 ? 8
                    : 0;
  return Math.min(100, historyPts + acwrPts + adherPts + easyPts);
}

// ─── Race predictions ─────────────────────────────────────────────────────────

const RACE_DISTANCES = [
  { label: 'Marathon',      meters: 42195 },
  { label: 'Half Marathon', meters: 21098 },
  { label: '5K',            meters: 5000  },
] as const;

function buildRacePredictions(
  input:      ForecastInput,
  confidence: number,
): RaceTimePrediction[] {
  const aVdot = adjustedVDOT(input);

  // Composite signal: falling fatigue + rising recovery + good adherence → improving
  const trendSignal =
    -input.fatigueSlope * 0.40 +
    input.recoverySlope * 0.40 +
    (input.adherenceRate - 0.70) * 0.20;
  const trend = deriveTrend(trendSignal);

  const explanation =
    trend === 'improving'
      ? 'prediction improving — fatigue dropping and recovery rising'
      : trend === 'declining'
      ? 'prediction declining — fatigue elevated or training inconsistent'
      : 'prediction stable — training load balanced';

  return RACE_DISTANCES.map(({ label, meters }) => ({
    distanceLabel:    label,
    distanceMeters:   meters,
    predictedMinutes: Math.round(predictRaceMinutes(aVdot, meters) * 10) / 10,
    formattedTime:    formatMinutes(predictRaceMinutes(aVdot, meters)),
    confidence,
    trend,
    explanation,
  }));
}

// ─── Fatigue trajectory ───────────────────────────────────────────────────────
//
// Projects 4 weeks forward using observed weekly OLS slope, clamped to ±5 pts/wk.
// Slope clamping prevents runaway projections from short noisy trend windows.

function buildFatigueTrajectory(input: ForecastInput): FatigueTrajectory {
  const slope  = Math.max(-5, Math.min(5, input.fatigueSlope));
  const points: TrajectoryPoint[] = [];
  let peakWeek: number | null = null;
  let peakVal  = input.fatigueScore;

  for (let w = 1; w <= 4; w++) {
    const value = Math.max(0, Math.min(100, Math.round(input.fatigueScore + slope * w)));
    points.push({ weeksFromNow: w, value });
    if (value > peakVal) { peakVal = value; peakWeek = w; }
  }

  const explanation =
    slope > 0.5
      ? `Fatigue trending up ${(Math.round(slope * 10) / 10).toFixed(1)} pts/wk — training load is building`
      : slope < -0.5
      ? `Fatigue trending down ${(Math.round(Math.abs(slope) * 10) / 10).toFixed(1)} pts/wk — recovery is outpacing load`
      : 'Fatigue stable — load and recovery are balanced';

  return { current: input.fatigueScore, trajectory: points, peakFatigueWeek: peakWeek, explanation };
}

// ─── Recovery trajectory ──────────────────────────────────────────────────────

function buildRecoveryTrajectory(input: ForecastInput): RecoveryTrajectory {
  const slope  = Math.max(-5, Math.min(5, input.recoverySlope));
  const points: TrajectoryPoint[] = [];

  for (let w = 1; w <= 4; w++) {
    const value = Math.max(0, Math.min(100, Math.round(input.recoveryScore + slope * w)));
    points.push({ weeksFromNow: w, value });
  }

  const explanation =
    slope > 0.5
      ? `Recovery trending up ${(Math.round(slope * 10) / 10).toFixed(1)} pts/wk — aerobic base building`
      : slope < -0.5
      ? `Recovery declining ${(Math.round(Math.abs(slope) * 10) / 10).toFixed(1)} pts/wk — accumulated fatigue is limiting adaptation`
      : 'Recovery stable — physiological equilibrium maintained';

  return { current: input.recoveryScore, trajectory: points, explanation };
}

// ─── Readiness forecast ───────────────────────────────────────────────────────
//
// Readiness = 0.40 × recovery + 0.35 × (100 − fatigue) + 0.25 × 70 (neutral baseline)
// The 70 term holds soreness and motivation constant — we can't forecast subjective inputs.
// Projects using the fatigue and recovery trajectories computed above.

function buildReadinessForecast(
  input:    ForecastInput,
  fatigue:  FatigueTrajectory,
  recovery: RecoveryTrajectory,
): ReadinessForecast {
  const currentReadiness = Math.round(
    0.40 * input.recoveryScore +
    0.35 * (100 - input.fatigueScore) +
    0.25 * 70,
  );

  const points: TrajectoryPoint[] = [];
  let peakWeek  = 0;
  let peakValue = currentReadiness;

  for (let w = 0; w < 4; w++) {
    const f     = fatigue.trajectory[w]?.value  ?? input.fatigueScore;
    const r     = recovery.trajectory[w]?.value ?? input.recoveryScore;
    const value = Math.round(0.40 * r + 0.35 * (100 - f) + 0.25 * 70);
    points.push({ weeksFromNow: w + 1, value });
    if (value > peakValue) { peakValue = value; peakWeek = w + 1; }
  }

  const explanation = peakWeek === 0
    ? 'Peak readiness is now — begin tapering to lock in current form for race day'
    : `Peak readiness projected in +${peakWeek} week${peakWeek > 1 ? 's' : ''} — schedule your key workout or race to this window`;

  return {
    current:            currentReadiness,
    trajectory:         points,
    peakReadinessWeek:  peakWeek,
    projectedPeakValue: peakValue,
    explanation,
  };
}

// ─── Overreaching risk ────────────────────────────────────────────────────────
//
// ACWR bands are workload-trend heuristics with major limitations; they do not predict injury.
// We project ACWR forward using fatigue slope as a proxy for ATL growth:
//   acwrSlope ≈ fatigueSlope / 40 (scaled to ACWR units).
//
// Rationale: when fatigue rises 1 pt/wk (≈2.5% of 40-pt base), acute training load
// is growing ~2.5% faster than the 42-day chronic base — which maps to ~0.025 ACWR/wk.

function buildOverreachingRisk(input: ForecastInput): OverreachingRisk {
  const acwrSlope       = input.fatigueSlope / 40;
  let   weeksToRisk: number | null = null;

  for (let w = 1; w <= 8; w++) {
    if (input.acwr + acwrSlope * w > 1.5) { weeksToRisk = w; break; }
  }

  const projected4wk = Math.max(0, Math.round((input.acwr + acwrSlope * 4) * 100) / 100);

  const level: OverreachingRisk['level'] =
    input.acwr > 1.5                                            ? 'high'
    : input.acwr > 1.3 || (acwrSlope > 0.02 && input.acwr > 1.1) ? 'moderate'
    : 'low';

  const explanation =
    level === 'high'
      ? `ACWR ${input.acwr.toFixed(2)} — acute load far exceeds chronic base. Risk of non-functional overreaching.`
      : level === 'moderate'
      ? `ACWR ${input.acwr.toFixed(2)} — elevated. ${weeksToRisk != null ? `High-risk zone projected in ${weeksToRisk} week${weeksToRisk > 1 ? 's' : ''}.` : 'Monitor weekly load carefully.'}`
      : `ACWR ${input.acwr.toFixed(2)} — training load in the optimal zone.`;

  return { level, weeksToRisk, projectedACWR: projected4wk, explanation };
}

// ─── Public entry point ───────────────────────────────────────────────────────

export function generateForecast(input: ForecastInput): ForecastResult {
  const overallConfidence  = computeConfidence(input);
  const racePredictions    = buildRacePredictions(input, overallConfidence);
  const fatigueTrajectory  = buildFatigueTrajectory(input);
  const recoveryTrajectory = buildRecoveryTrajectory(input);
  const readinessForecast  = buildReadinessForecast(input, fatigueTrajectory, recoveryTrajectory);
  const overreachingRisk   = buildOverreachingRisk(input);

  return {
    racePredictions,
    fatigueTrajectory,
    recoveryTrajectory,
    readinessForecast,
    overreachingRisk,
    overallConfidence,
  };
}
