// ─── Strength History Analytics ───────────────────────────────────────────────
//
// Pure functions over StrengthLogRecord[]. No store coupling, no side effects.
// Mirrors the shape of historyUtils.ts for running, but adapted for strength
// training metrics (sets, patterns, load units).

import type { StrengthLogRecord, MovementPattern } from '../types/strength';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysAgo(days: number): number {
  return Date.now() - days * 24 * 60 * 60 * 1000;
}

// ─── Volume ───────────────────────────────────────────────────────────────────

export type WeeklyStrengthVolume = {
  week:       number;
  sessions:   number;
  totalSets:  number;
  totalLoad:  number;  // estimated load units
};

export function getWeeklyStrengthVolume(
  history: StrengthLogRecord[],
  weeksBack = 8,
): WeeklyStrengthVolume[] {
  const completed = history.filter(r => !r.skipped);
  if (completed.length === 0) return [];

  const byWeek = new Map<number, StrengthLogRecord[]>();
  for (const r of completed) {
    const arr = byWeek.get(r.week) ?? [];
    arr.push(r);
    byWeek.set(r.week, arr);
  }

  const maxWeek = Math.max(...byWeek.keys());
  const result: WeeklyStrengthVolume[] = [];

  for (let w = Math.max(1, maxWeek - weeksBack + 1); w <= maxWeek; w++) {
    const sessions = byWeek.get(w) ?? [];
    const totalSets  = sessions.reduce((s, r) =>
      s + r.exercises.reduce((es, e) => es + e.sets.filter(set => set.completed).length, 0), 0);
    const totalLoad  = sessions.reduce((s, r) => s + r.estimatedLoad, 0);
    result.push({ week: w, sessions: sessions.length, totalSets, totalLoad });
  }

  return result;
}

// ─── Pattern balance ──────────────────────────────────────────────────────────

export function getStrengthPatternBalance(
  history: StrengthLogRecord[],
  days = 28,
): Partial<Record<MovementPattern, number>> {
  const cutoff  = daysAgo(days);
  const recent  = history.filter(r => r.timestamp >= cutoff && !r.skipped);
  const counts: Partial<Record<MovementPattern, number>> = {};

  for (const record of recent) {
    for (const ex of record.exercises) {
      // We don't have the full exercise object here, so we rely on a simple
      // naming heuristic embedded in exerciseId prefix (e.g. 'squat_*', 'hinge_*')
      const pattern = ex.exerciseId.split('_')[0] as MovementPattern | undefined;
      if (pattern) counts[pattern] = (counts[pattern] ?? 0) + ex.sets.filter(s => s.completed).length;
    }
  }

  return counts;
}

// ─── Load trend ───────────────────────────────────────────────────────────────

export type StrengthLoadPoint = { week: number; load: number };

export function getStrengthLoadTrend(history: StrengthLogRecord[]): StrengthLoadPoint[] {
  const byWeek = new Map<number, number>();
  for (const r of history.filter(r => !r.skipped)) {
    byWeek.set(r.week, (byWeek.get(r.week) ?? 0) + r.estimatedLoad);
  }
  return Array.from(byWeek.entries())
    .sort(([a], [b]) => a - b)
    .map(([week, load]) => ({ week, load }));
}

// ─── Adherence ───────────────────────────────────────────────────────────────

export function getStrengthAdherence(
  history:       StrengthLogRecord[],
  currentWeek:   number,
  weeklyPlanned: number,  // sessions planned per week
): number {
  if (currentWeek === 0 || weeklyPlanned === 0) return 0;
  const completed = history.filter(r => !r.skipped).length;
  const planned   = currentWeek * weeklyPlanned;
  return Math.min(1, completed / Math.max(1, planned));
}

// ─── This-week summary ────────────────────────────────────────────────────────

export function getThisWeekStrengthSessions(
  history:     StrengthLogRecord[],
  currentWeek: number,
): StrengthLogRecord[] {
  return history.filter(r => r.week === currentWeek);
}

// ─── Recent load (7/30-day) ───────────────────────────────────────────────────

export function getRecentStrengthLoad(
  history: StrengthLogRecord[],
  days = 7,
): number {
  const cutoff = daysAgo(days);
  return history
    .filter(r => r.timestamp >= cutoff && !r.skipped)
    .reduce((s, r) => s + r.estimatedLoad, 0);
}
