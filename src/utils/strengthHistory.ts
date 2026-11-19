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

// ─── Previous set reference ───────────────────────────────────────────────────
//
// Most recent logged performance for a given exerciseId, so the active-session
// UI can show "Last time: 3x10 @ 35 lb - RPE 7" while the user works the same
// exercise today. Returns null when there's no prior completed set for it.

export type LastExercisePerformance = {
  timestamp:    number;
  completedSets: number;
  reps:         number;
  load?:        string;
  rpe?:         number;
  comparableWorkingSets?: boolean;
  equipmentType?: import('./strengthSession').EquipmentType;
};

// ─── Progression suggestion ───────────────────────────────────────────────────
//
// Simple 5/3/1-style double-progression heuristic over the last logged
// performance, gated by today's readiness. Deterministic, explainable, and
// deliberately conservative: runners should win reps before winning weight,
// and should never chase load on a compromised day.

export type ProgressionSuggestion = {
  headline: string;   // e.g. "Try 40 lb today"
  reason:   string;   // one-sentence why
};

function parseLoadValue(load?: string): number | null {
  if (!load) return null;
  if (/^bw$/i.test(load.trim())) return 0;
  const match = load.match(/([\d.]+)/);
  return match ? Number(match[1]) : null;
}

export function suggestProgression(
  last:             LastExercisePerformance | null,
  targetSets:       number,
  readinessLimited: boolean,
  unitLabel:        string,
  targetTopReps?:   number | null,
  currentEquipmentType?: import('./strengthSession').EquipmentType,
): ProgressionSuggestion | null {
  if (!last) return null;
  if (!Number.isFinite(last.timestamp) || last.timestamp > Date.now() || last.timestamp < daysAgo(42)) return {
    headline: 'Recalibrate your starting load',
    reason: 'This is an older performance reference. Use current reps, setup and effort before adding load; the historical workout remains unchanged.',
  };

  const loadValue = parseLoadValue(last.load);
  const isBodyweight = /^bw$/i.test(last.load?.trim() ?? '');
  const loadLabel = isBodyweight ? 'bodyweight' : (last.load ?? 'a suitable starting load');
  const finishedAllSets = last.completedSets >= targetSets;
  const reportedEffort = Number.isFinite(last.rpe) && last.rpe! >= 1 && last.rpe! <= 10;

  if (!last.load || last.comparableWorkingSets === false) return {
    headline: 'Check the setup and starting load',
    reason: 'Previous working-set loads were missing or varied. Confirm this exercise and setup rather than transfer an assumed load or treat missing load as bodyweight.',
  };

  if (readinessLimited) {
    return {
      headline: `Hold at ${loadLabel}`,
      reason:   'Readiness is limited today — repeat last session\'s load and bank quality reps instead of chasing progression.',
    };
  }

  if (reportedEffort && last.rpe! >= 9) {
    return {
      headline: `Repeat ${loadLabel} (or drop ~5%)`,
      reason:   `Last time was RPE ${last.rpe} — near max. Own this load with 1–2 reps in reserve before moving up.`,
    };
  }

  const unitMatches = isBodyweight || new RegExp(`\\b${unitLabel}\\b`, 'i').test(last.load ?? '');
  const achievedReps = typeof targetTopReps === 'number' && targetTopReps > 0 && last.reps >= targetTopReps;
  const matchingSetup = !!currentEquipmentType && last.equipmentType === currentEquipmentType;
  if (finishedAllSets && achievedReps && reportedEffort && last.rpe! <= 7 && last.comparableWorkingSets === true && unitMatches && matchingSetup) {
    if (isBodyweight) {
      return {
        headline: 'Add 1–2 reps per set',
        reason:   `All working sets reached the prescribed reps with reported RPE ${last.rpe}. Consider a small rep increase if technique and recovery remain suitable.`,
      };
    }
    if (loadValue === null) return { headline: 'Confirm the recorded load', reason: 'A numeric load and its unit are needed before suggesting a load change.' };
    const increment = loadValue >= 50 ? 5 : 2.5;
    return {
      headline: `Try ${loadValue + increment} ${unitLabel} today`,
      reason:   `All working sets reached the prescribed reps with reported RPE ${last.rpe} at the same recorded load. Consider +${increment} ${unitLabel} if your equipment allows; recalibrate after a setup change.`,
    };
  }

  return {
    headline: `Repeat ${loadLabel}`,
    reason:   last.rpe !== undefined
      ? `Last session was RPE ${last.rpe}${finishedAllSets ? '' : ' with sets left on the table'} — win all sets at this load first, then add weight.`
      : 'Completion alone does not show how hard the work felt. Record working-set reps, load and actual RPE before considering more load.',
  };
}

export function getLastLoggedExercise(
  history:    StrengthLogRecord[],
  exerciseId: string,
  displayUnit?: 'lb' | 'kg',
  expectedEquipmentType?: import('./strengthSession').EquipmentType | null,
): LastExercisePerformance | null {
  const matches = history
    .filter(r => !r.skipped)
    .flatMap(r => {
      const match = r.exercises.find(e => e.exerciseId === exerciseId);
      if (!match || match.skipped) return [];
      const completed = match.sets.filter(s => s.completed && !s.isWarmup);
      if (completed.length === 0) return [];
      return [{ timestamp: r.timestamp, match, completed }];
    })
    .sort((a, b) => b.timestamp - a.timestamp);

  const latest = matches[0];
  if (!latest) return null;

  const normalized = latest.completed.map(set => {
    const label = set.load?.trim();
    const parsed = label?.match(/^(\d+(?:\.\d+)?)\s*(lb|lbs|kg)$/i);
    const unqualifiedWeight = Number.isFinite(set.weight) && set.weight! > 0 && set.weightUnit !== 'lb' && set.weightUnit !== 'kg';
    const weight = unqualifiedWeight ? undefined : set.weight ?? (parsed ? Number(parsed[1]) : undefined);
    const unit = unqualifiedWeight ? undefined : set.weightUnit ?? (parsed ? /^kg$/i.test(parsed[2]!) ? 'kg' : 'lb' : undefined);
    const bodyweight = !(Number.isFinite(set.weight) && set.weight! > 0) && !(Number.isFinite(weight) && weight! > 0)
      && (latest.match.equipmentType === 'bodyweight' || /^bw$/i.test(label ?? ''));
    return { weight, unit, bodyweight };
  });
  const first = normalized[0]!;
  const matchingSetup = expectedEquipmentType === undefined
    || (expectedEquipmentType !== null && expectedEquipmentType !== 'other' && expectedEquipmentType === latest.match.equipmentType);
  const comparable = matchingSetup && normalized.every(set => set.bodyweight && first.bodyweight
    || !set.bodyweight && !first.bodyweight && Number.isFinite(set.weight) && set.weight! > 0
      && !!set.unit && set.unit === first.unit && set.weight === first.weight);
  const validReps = latest.completed.every(set => Number.isFinite(set.reps) && set.reps! > 0);
  const validEffort = latest.completed.every(set => Number.isFinite(set.rpe) && set.rpe! >= 1 && set.rpe! <= 10);
  const shownUnit = displayUnit ?? first.unit;
  const shownWeight = first.weight && first.unit && shownUnit
    ? first.weight * (first.unit === shownUnit ? 1 : shownUnit === 'lb' ? 2.2046226218 : 1 / 2.2046226218)
    : undefined;
  return {
    timestamp:     latest.timestamp,
    completedSets: latest.completed.length,
    reps:          validReps ? Math.min(...latest.completed.map(set => set.reps!)) : 0,
    load:          !comparable ? undefined : first.bodyweight ? 'BW' : shownWeight && shownUnit ? `${Math.round(shownWeight * 10) / 10} ${shownUnit}` : undefined,
    rpe:           validEffort ? Math.max(...latest.completed.map(set => set.rpe!)) : undefined,
    comparableWorkingSets: comparable && validReps,
    equipmentType: latest.match.equipmentType,
  };
}
