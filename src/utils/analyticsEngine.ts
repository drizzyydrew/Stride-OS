import type {
  DataPoint,
  TrendDirection,
  TrendSeverity,
  MetricTrend,
  TrainingLoad,
  AnalyticsSummary,
  AnalyticsInput,
} from '../types/analytics';

import { buildPeriodizationPlan, resolveTrainingPhase, getWeeksRemaining, getPlanProgress } from './periodization';
import { computeProgressedMileage } from './progression';

// ─── Rolling Statistics ───────────────────────────────────────────────────────

export function rollingAverage(values: number[], window: number): number[] {
  return values.map((_, i) => {
    const slice = values.slice(Math.max(0, i - window + 1), i + 1);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  });
}

// Ordinary least-squares slope (units per step).
export function computeSlope(values: number[]): number {
  if (values.length < 2) return 0;
  const n    = values.length;
  const xs   = Array.from({ length: n }, (_, i) => i);
  const sumX = xs.reduce((a, b) => a + b, 0);
  const sumY = values.reduce((a, b) => a + b, 0);
  const sumXY = xs.reduce((acc, x, i) => acc + x * (values[i] ?? 0), 0);
  const sumX2 = xs.reduce((acc, x) => acc + x * x, 0);
  const denom = n * sumX2 - sumX * sumX;
  return denom === 0 ? 0 : (n * sumXY - sumX * sumY) / denom;
}

export function computeTrendDirection(slope: number, threshold = 0.4): TrendDirection {
  if (slope >  threshold) return 'up';
  if (slope < -threshold) return 'down';
  return 'flat';
}

// ─── Training Load (ATL / CTL / ACWR) ────────────────────────────────────────

// Acute Training Load — weighted toward the most recent weeks.
export function computeAcuteLoad(weeklyMileages: number[]): number {
  const recent = weeklyMileages.slice(-2);
  if (recent.length === 0) return 0;
  return Math.round((recent.reduce((a, b) => a + b, 0) / recent.length) * 10) / 10;
}

// Chronic Training Load — 4-week average representing fitness base.
export function computeChronicLoad(weeklyMileages: number[]): number {
  const recent = weeklyMileages.slice(-4);
  if (recent.length === 0) return 0;
  return Math.round((recent.reduce((a, b) => a + b, 0) / recent.length) * 10) / 10;
}

export function computeACWR(acute: number, chronic: number): number {
  if (chronic === 0) return 1.0;
  return Math.round((acute / chronic) * 100) / 100;
}

// ACWR risk zones (Gabbett 2016):
// < 0.8  → undertraining / detraining
// 0.8–1.3 → optimal training zone
// 1.3–1.5 → elevated risk
// > 1.5  → high injury risk
export function classifyACWR(acwr: number): TrendSeverity {
  if (acwr < 0.8)   return 'neutral';
  if (acwr <= 1.3)  return 'positive';
  if (acwr <= 1.5)  return 'warning';
  return 'critical';
}

// ─── Consistency ──────────────────────────────────────────────────────────────

// Inverse of coefficient of variation: lower variance → higher consistency score.
export function computeConsistency(weeklyMileages: number[]): number {
  if (weeklyMileages.length < 2) return 100;
  const mean = weeklyMileages.reduce((a, b) => a + b, 0) / weeklyMileages.length;
  if (mean === 0) return 0;
  const variance = weeklyMileages.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / weeklyMileages.length;
  const cv = Math.sqrt(variance) / mean;
  return Math.max(0, Math.round((1 - Math.min(cv, 1)) * 100));
}

// ─── Trend Series Builders ────────────────────────────────────────────────────

// Reconstructs mileage history from the progression engine.
// Once real workout logs exist, replace this with actuals from workoutStore.
export function buildMileageSeries(
  baseMileage: number,
  currentWeek: number,
  goalRace: string,
  progressionLevel: AnalyticsInput['progressionLevel'],
  seriesLength = 8,
): DataPoint[] {
  const plan      = buildPeriodizationPlan(goalRace, baseMileage);
  const startWeek = Math.max(1, currentWeek - seriesLength + 1);

  const points: DataPoint[] = [];
  for (let week = startWeek; week <= currentWeek; week++) {
    const phase   = resolveTrainingPhase(week, plan);
    const mileage = computeProgressedMileage({ baseMileage, currentWeek: week, phase, progressionLevel });
    points.push({ week, value: mileage });
  }
  return points;
}

// Backward projection for fatigue. Anchors at current; earlier weeks were lower
// as training stress accumulated over time. Replaced by actuals once logs exist.
export function buildFatigueSeries(
  currentFatigue: number,
  currentWeek: number,
  seriesLength = 8,
): DataPoint[] {
  const startWeek = Math.max(1, currentWeek - seriesLength + 1);
  return Array.from({ length: currentWeek - startWeek + 1 }, (_, i) => {
    const week    = startWeek + i;
    const weeksAgo = currentWeek - week;
    const value   = Math.max(10, Math.min(100, currentFatigue - weeksAgo * 3));
    return { week, value: Math.round(value) };
  });
}

// Backward projection for recovery — inversely correlated with fatigue trend.
export function buildRecoverySeries(
  currentRecovery: number,
  currentWeek: number,
  seriesLength = 8,
): DataPoint[] {
  const startWeek = Math.max(1, currentWeek - seriesLength + 1);
  return Array.from({ length: currentWeek - startWeek + 1 }, (_, i) => {
    const week    = startWeek + i;
    const weeksAgo = currentWeek - week;
    const value   = Math.max(0, Math.min(100, currentRecovery + weeksAgo * 2));
    return { week, value: Math.round(value) };
  });
}

// ─── Metric Trend Builder ─────────────────────────────────────────────────────

function buildMetricTrend(
  series: DataPoint[],
  current: number,
  severity: TrendSeverity,
): MetricTrend {
  const values   = series.map(p => p.value);
  const slope    = computeSlope(values);
  const previous = values[values.length - 2] ?? current;

  return {
    current,
    previous,
    direction:     computeTrendDirection(slope),
    severity,
    slope:         Math.round(slope * 100) / 100,
    changePercent: previous !== 0
      ? Math.round(((current - previous) / previous) * 1000) / 10
      : 0,
  };
}

function classifyFatigueSeverity(fatigue: number): TrendSeverity {
  if (fatigue > 75) return 'critical';
  if (fatigue > 55) return 'warning';
  if (fatigue > 35) return 'neutral';
  return 'positive';
}

function classifyRecoverySeverity(recovery: number): TrendSeverity {
  if (recovery >= 80) return 'positive';
  if (recovery >= 60) return 'neutral';
  if (recovery >= 40) return 'warning';
  return 'critical';
}

function classifyMileageSeverity(slope: number): TrendSeverity {
  if (slope > 1)   return 'positive';
  if (slope > 0)   return 'neutral';
  if (slope > -2)  return 'warning';
  return 'critical';
}

// ─── Public: Full Analytics Computation ──────────────────────────────────────

export function computeAnalytics(input: AnalyticsInput): AnalyticsSummary {
  const plan = buildPeriodizationPlan(input.goalRace, input.weeklyMileage);

  const mileageTrend  = buildMileageSeries(input.weeklyMileage, input.currentWeek, input.goalRace, input.progressionLevel);
  const fatigueTrend  = buildFatigueSeries(input.fatigueScore, input.currentWeek);
  const recoveryTrend = buildRecoverySeries(input.recoveryScore, input.currentWeek);

  const mileageValues = mileageTrend.map(p => p.value);
  const mileageSlope  = computeSlope(mileageValues);

  const acute  = computeAcuteLoad(mileageValues);
  const chronic = computeChronicLoad(mileageValues);
  const acwr   = computeACWR(acute, chronic);

  return {
    mileageTrend,
    fatigueTrend,
    recoveryTrend,

    mileageMetric:  buildMetricTrend(mileageTrend,  input.weeklyMileage, classifyMileageSeverity(mileageSlope)),
    fatigueMetric:  buildMetricTrend(fatigueTrend,  input.fatigueScore,  classifyFatigueSeverity(input.fatigueScore)),
    recoveryMetric: buildMetricTrend(recoveryTrend, input.recoveryScore, classifyRecoverySeverity(input.recoveryScore)),

    trainingLoad: {
      acute,
      chronic,
      acwr,
      acwrSeverity: classifyACWR(acwr),
    },

    consistency:    computeConsistency(mileageValues),
    planProgress:   getPlanProgress(input.currentWeek, plan),
    weeksRemaining: getWeeksRemaining(input.currentWeek, plan),
    totalWeeks:     plan.totalWeeks,
  };
}
