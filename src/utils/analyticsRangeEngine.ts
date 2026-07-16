// ─── Analytics Range Engine ────────────────────────────────────────────────────
//
// Pure functions over real, already-logged training data (CompletedWorkoutRecord[],
// StrengthLogRecord[]). No store imports — safe to call from any context.
//
// Buckets by calendar time (not training-plan week — see historyUtils.ts /
// strengthHistory.ts, which group by plan week and don't fit a 4W/6M/1Y calendar
// filter). Never fabricates values: callers are expected to render an honest
// empty state when a returned series/summary reflects zero real records.

import type { TrendDirection, TrendSeverity } from '../types/analytics';
import {
  computeSlope,
  computeTrendDirection,
  computeAcuteLoad,
  computeChronicLoad,
  computeACWR,
  classifyACWR,
} from './analyticsEngine';

const DAY_MS = 24 * 60 * 60 * 1000;

export type RangeKey = '4W' | '8W' | '12W' | '6M' | '1Y';

export const RANGE_DAYS: Record<RangeKey, number> = {
  '4W':  28,
  '8W':  56,
  '12W': 84,
  '6M':  182,
  '1Y':  365,
};

export const RANGE_LABEL: Record<RangeKey, string> = {
  '4W':  'Last 4 Weeks',
  '8W':  'Last 8 Weeks',
  '12W': 'Last 12 Weeks',
  '6M':  'Last 6 Months',
  '1Y':  'Last Year',
};

// Weekly buckets stay legible up to 12 bars; beyond that, switch to monthly
// (30-day) buckets so 6M/1Y charts don't overcrowd a small card.
export function bucketUnitFor(range: RangeKey): 'week' | 'month' {
  return range === '6M' || range === '1Y' ? 'month' : 'week';
}

function bucketSizeDays(unit: 'week' | 'month'): number {
  return unit === 'week' ? 7 : 30;
}

export type TimestampedRecord = { timestamp: number };

export function filterSince<T extends TimestampedRecord>(records: T[], days: number): T[] {
  const cutoff = Date.now() - days * DAY_MS;
  return records.filter(r => r.timestamp >= cutoff);
}

// Records from the equivalent-length period immediately before the current
// range — used for honest period-over-period comparisons (e.g. pace delta).
export function filterPreviousPeriod<T extends TimestampedRecord>(records: T[], days: number): T[] {
  const now         = Date.now();
  const rangeStart  = now - days * DAY_MS;
  const priorStart  = rangeStart - days * DAY_MS;
  return records.filter(r => r.timestamp >= priorStart && r.timestamp < rangeStart);
}

export type Bucket = { label: string; value: number };

// Buckets `records` into `bucketCount` equal-width, oldest-first windows ending
// now, summing `valueFn` per record. Empty buckets are real zeros, not gaps.
export function buildBuckets<T extends TimestampedRecord>(
  records: T[],
  range: RangeKey,
  valueFn: (r: T) => number,
): Bucket[] {
  const unit        = bucketUnitFor(range);
  const bucketDays  = bucketSizeDays(unit);
  const bucketCount = Math.round(RANGE_DAYS[range] / bucketDays);
  const now         = Date.now();
  const prefix      = unit === 'week' ? 'W' : 'M';

  return Array.from({ length: bucketCount }, (_, i) => {
    const windowEnd   = now - (bucketCount - 1 - i) * bucketDays * DAY_MS;
    const windowStart = windowEnd - bucketDays * DAY_MS;
    const value = records
      .filter(r => r.timestamp >= windowStart && r.timestamp < windowEnd + DAY_MS)
      .reduce((sum, r) => sum + valueFn(r), 0);
    return { label: `${prefix}${i + 1}`, value: Math.round(value * 10) / 10 };
  });
}

// Percentage of buckets that have at least one unit of logged activity —
// "how many weeks/months did you actually train," not a variance measure.
export function computeAdherencePct(buckets: Bucket[]): number {
  if (buckets.length === 0) return 0;
  const active = buckets.filter(b => b.value > 0).length;
  return Math.round((active / buckets.length) * 100);
}

export type TrendSummary = {
  direction:  TrendDirection;
  severity:   TrendSeverity;
  slope:      number;
};

export function summarizeTrend(buckets: Bucket[]): TrendSummary {
  const values    = buckets.map(b => b.value);
  const slope     = computeSlope(values);
  const direction = computeTrendDirection(slope);
  const severity: TrendSeverity =
    direction === 'up' ? 'positive' : direction === 'down' ? 'warning' : 'neutral';
  return { direction, severity, slope: Math.round(slope * 100) / 100 };
}

// ─── Running-specific helpers ─────────────────────────────────────────────────

export type RunLike = TimestampedRecord & {
  estimatedDistanceMiles: number;
  actualDistanceMiles?:   number;
  durationMinutes:        number;
  actualDurationMinutes?: number;
};

export function runDistance(r: RunLike): number {
  return r.actualDistanceMiles ?? r.estimatedDistanceMiles;
}

function runDuration(r: RunLike): number {
  return r.actualDurationMinutes ?? r.durationMinutes;
}

// Average pace in minutes/mile across the given records. Returns null when
// there's no distance to divide by (honest "not enough data" signal).
export function computeAvgPaceMinPerMile(records: RunLike[]): number | null {
  const totalMiles   = records.reduce((s, r) => s + runDistance(r), 0);
  const totalMinutes = records.reduce((s, r) => s + runDuration(r), 0);
  if (totalMiles <= 0) return null;
  return totalMinutes / totalMiles;
}

export function formatPace(minPerMile: number): string {
  const mins = Math.floor(minPerMile);
  const secs = Math.round((minPerMile - mins) * 60);
  return `${mins}'${String(secs).padStart(2, '0')}"`;
}

// ─── Coaching-language copy ────────────────────────────────────────────────────

export function describeVolumeTrend(
  trend:        TrendSummary,
  adherencePct: number,
  unit:         'week' | 'month',
  activityLabel: string,
): string {
  const unitPlural = unit === 'week' ? 'weeks' : 'months';
  const trendPhrase =
    trend.direction === 'up'   ? `${activityLabel} is trending up` :
    trend.direction === 'down' ? `${activityLabel} is trending down` :
    `${activityLabel} has been steady`;

  if (adherencePct >= 80) {
    return `${trendPhrase} over this period, and you've been consistent — training logged in ${adherencePct}% of ${unitPlural}.`;
  }
  if (adherencePct >= 40) {
    return `${trendPhrase} over this period. Consistency is moderate — logged in ${adherencePct}% of ${unitPlural}. More regular sessions would make this trend easier to trust.`;
  }
  return `${trendPhrase}, but logging has been sparse (${adherencePct}% of ${unitPlural}) — treat this trend as low-confidence until there's more data.`;
}

// ACWR (acute:chronic workload ratio) assumes weekly granularity — only
// meaningful when buckets are weekly (4W/8W/12W ranges), not monthly.
export function computeLoadPatternSeverity(weeklyValues: number[]): TrendSeverity {
  const acute   = computeAcuteLoad(weeklyValues);
  const chronic = computeChronicLoad(weeklyValues);
  return classifyACWR(computeACWR(acute, chronic));
}

export function describeTrainingLoadPattern(acwrSeverity: TrendSeverity): string {
  switch (acwrSeverity) {
    case 'positive':
      return 'Recent training load sits in a well-established, sustainable range relative to your longer-term average.';
    case 'neutral':
      return 'Recent training load is below your longer-term average — room to build back up gradually.';
    case 'warning':
      return 'Recent training load has climbed noticeably faster than your longer-term average. Consider an easier week to let this settle.';
    case 'critical':
      return 'Recent training load is well above your longer-term average. This workload trend has important limitations, but an easier week may support recovery.';
  }
}
