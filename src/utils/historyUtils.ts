// Pure functions over CompletedWorkoutRecord[]. No store imports — safe to call
// from any context, including derived selectors and analytics components.

import type { CompletedWorkoutRecord, WorkoutIntensity, WorkoutType } from '../types/training';
import type { HistoryWindow, WeeklyHistorySummary, TrainingDistribution } from '../types/history';
import type { DataPoint } from '../types/analytics';

const DAY_MS = 24 * 60 * 60 * 1000;

// ─── Distance Estimation ──────────────────────────────────────────────────────
//
// Approximate pace table (min/mile) for a sub-5h marathon training block.
// These are stored at record-creation time so queries never need to re-derive them,
// and so the model can be updated without invalidating existing history.
//
// very_easy: easy recovery jog (~13:30/mi)
// easy:      conversational aerobic pace (~10:30/mi)
// moderate:  steady-state / marathon pace (~9:00/mi)
// hard:      threshold / tempo pace (~7:30/mi)
// max:       VO2 max interval pace (~6:00/mi)

const PACE_MIN_PER_MILE: Record<WorkoutIntensity, number> = {
  rest:      0,
  very_easy: 13.5,
  easy:      10.5,
  moderate:  9.0,
  hard:      7.5,
  max:       6.0,
};

export function estimateDistanceMiles(
  durationMinutes: number,
  intensity:       WorkoutIntensity,
): number {
  const pace = PACE_MIN_PER_MILE[intensity];
  if (pace === 0) return 0;
  return Math.round((durationMinutes / pace) * 10) / 10;
}

// ─── Window helpers ───────────────────────────────────────────────────────────

function buildWindow(records: CompletedWorkoutRecord[]): HistoryWindow {
  const now = Date.now();
  return {
    totalLoad:   records.reduce((s, r) => s + r.estimatedLoad,          0),
    totalMiles:  Math.round(records.reduce((s, r) => s + r.estimatedDistanceMiles, 0) * 10) / 10,
    recordCount: records.length,
    startMs:     records.length > 0 ? Math.min(...records.map(r => r.timestamp)) : now,
    endMs:       now,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function getLast7DaysLoad(history: CompletedWorkoutRecord[]): HistoryWindow {
  const cutoff = Date.now() - 7 * DAY_MS;
  return buildWindow(history.filter(r => r.timestamp >= cutoff));
}

export function getLast30DaysLoad(history: CompletedWorkoutRecord[]): HistoryWindow {
  const cutoff = Date.now() - 30 * DAY_MS;
  return buildWindow(history.filter(r => r.timestamp >= cutoff));
}

// Groups records by training week number and returns one summary per week,
// sorted ascending. Week numbers are the `currentWeek` value stored on each
// record — they represent the athlete's plan week, not calendar week.
export function getWeeklyMileage(history: CompletedWorkoutRecord[]): WeeklyHistorySummary[] {
  if (history.length === 0) return [];

  const byWeek = new Map<number, CompletedWorkoutRecord[]>();
  for (const record of history) {
    const group = byWeek.get(record.week) ?? [];
    group.push(record);
    byWeek.set(record.week, group);
  }

  return Array.from(byWeek.entries())
    .sort(([a], [b]) => a - b)
    .map(([week, records]) => {
      const typeCounts      = countBy(records, r => r.type);
      const intensityCounts = countBy(records, r => r.intensity);

      return {
        week,
        totalLoad:         records.reduce((s, r) => s + r.estimatedLoad,          0),
        totalMiles:        Math.round(records.reduce((s, r) => s + r.estimatedDistanceMiles, 0) * 10) / 10,
        recordCount:       records.length,
        dominantType:      topKey(typeCounts)      as WorkoutType      | null,
        dominantIntensity: topKey(intensityCounts) as WorkoutIntensity | null,
      };
    });
}

// Returns a breakdown of workout counts by type and intensity.
// Pass `days` to restrict to a rolling window (e.g. last 30 days).
export function getTrainingDistribution(
  history: CompletedWorkoutRecord[],
  days?:   number,
): TrainingDistribution {
  const records = days != null
    ? history.filter(r => r.timestamp >= Date.now() - days * DAY_MS)
    : history;

  return {
    byType:      countBy(records, r => r.type)      as Partial<Record<WorkoutType,      number>>,
    byIntensity: countBy(records, r => r.intensity) as Partial<Record<WorkoutIntensity, number>>,
    totalCount:  records.length,
  };
}

// ─── Weekly trend series ──────────────────────────────────────────────────────

// For each training week with completions, takes the LAST record's fatigueAfter
// as the end-of-week fatigue state. Used to build real trend series for TrendCard.
export function getWeeklyFatigueTrend(history: CompletedWorkoutRecord[]): DataPoint[] {
  if (history.length === 0) return [];
  const lastPerWeek = latestPerWeek(history);
  return Array.from(lastPerWeek.entries())
    .sort(([a], [b]) => a - b)
    .map(([week, r]) => ({ week, value: r.fatigueAfter }));
}

// Uses recoveryBefore of the last workout per week — the best available proxy
// for weekly recovery state since recoveryAfter is not stored on the record.
export function getWeeklyRecoveryTrend(history: CompletedWorkoutRecord[]): DataPoint[] {
  if (history.length === 0) return [];
  const lastPerWeek = latestPerWeek(history);
  return Array.from(lastPerWeek.entries())
    .sort(([a], [b]) => a - b)
    .map(([week, r]) => ({ week, value: r.recoveryBefore }));
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function latestPerWeek(
  history: CompletedWorkoutRecord[],
): Map<number, CompletedWorkoutRecord> {
  const map = new Map<number, CompletedWorkoutRecord>();
  for (const r of history) {
    const existing = map.get(r.week);
    if (!existing || r.timestamp > existing.timestamp) map.set(r.week, r);
  }
  return map;
}

function countBy<T>(
  items: T[],
  key:   (item: T) => string,
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const item of items) {
    const k = key(item);
    result[k] = (result[k] ?? 0) + 1;
  }
  return result;
}

function topKey(counts: Record<string, number>): string | null {
  const entries = Object.entries(counts);
  if (entries.length === 0) return null;
  return entries.reduce((a, b) => (b[1] > a[1] ? b : a))[0];
}
