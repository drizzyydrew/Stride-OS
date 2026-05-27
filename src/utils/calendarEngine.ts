// ─── Calendar Engine ──────────────────────────────────────────────────────────
//
// Maps planned running workouts and strength sessions to specific calendar dates.
// All logic is pure/deterministic — no side effects, no store access.
//
// The planning system generates ordered lists of sessions (no dates assigned).
// This engine assigns them to the correct calendar days based on available days.

import type { Workout }         from '../types/training';
import type { StrengthSession } from '../types/strength';
import type { TrainingDay }     from '../types/athlete';

// ─── Types ────────────────────────────────────────────────────────────────────

export type CalendarEntry = {
  date:       string;       // "YYYY-MM-DD"
  type:       'run' | 'strength' | 'rest' | 'custom';
  label:      string;
  color:      string;
  workout?:   Workout;
  session?:   StrengthSession;
  completed:  boolean;
};

export type DayPlan = {
  date:     string;
  entries:  CalendarEntry[];
};

// ─── Day-of-week mapping ──────────────────────────────────────────────────────

const DOW_TO_IDX: Record<TrainingDay, number> = {
  Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 0,
};

// ─── Date utilities ────────────────────────────────────────────────────────────

export function toYMD(d: Date): string {
  return d.toISOString().split('T')[0]!;
}

export function sundayOf(d: Date): Date {
  const day = d.getDay(); // 0=Sun
  const r   = new Date(d);
  r.setDate(d.getDate() - day);
  r.setHours(0, 0, 0, 0);
  return r;
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function weeksInMonth(year: number, month: number): Date[][] {
  const weeks: Date[][] = [];
  const firstDay = new Date(year, month, 1);
  const start    = sundayOf(firstDay);

  for (let w = 0; w < 6; w++) {
    const weekStart = addDays(start, w * 7);
    // Stop if the week starts after the month ends
    if (weekStart.getFullYear() > year ||
        (weekStart.getFullYear() === year && weekStart.getMonth() > month)) break;

    const week = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
    weeks.push(week);
  }

  return weeks;
}

// ─── Map workouts to week dates ────────────────────────────────────────────────
//
// Given an ordered workout list and available training days, returns a map of
// date → planned workout for the current ISO week.

export function mapWorkoutsToDates(
  workouts:      Workout[],
  availableDays: TrainingDay[],
  weekStartDate: Date,        // Sunday of the current week
  completedKeys: string[],
  currentWeek:   number,
): DayPlan[] {
  if (workouts.length === 0) return [];

  // Build sorted available day indices (0=Sun…6=Sat)
  const availableIdxs = availableDays.length > 0
    ? availableDays.map(d => DOW_TO_IDX[d]).sort((a, b) => a - b)
    : [1, 2, 3, 4, 5, 6]; // Mon–Sat default

  // Map each workout to the Nth available day
  const plans: DayPlan[] = [];
  workouts.forEach((workout, i) => {
    if (workout.type === 'rest') return; // skip rest days
    const dayIdx = availableIdxs[i % availableIdxs.length];
    if (dayIdx === undefined) return;

    const date      = addDays(weekStartDate, dayIdx);
    const dateStr   = toYMD(date);
    const compKey   = `w${currentWeek}_${workout.id}_${i}`;
    const completed = completedKeys.includes(compKey);

    const existing = plans.find(p => p.date === dateStr);
    const entry: CalendarEntry = {
      date:     dateStr,
      type:     'run',
      label:    workout.title,
      color:    '#2563EB',
      workout,
      completed,
    };

    if (existing) {
      existing.entries.push(entry);
    } else {
      plans.push({ date: dateStr, entries: [entry] });
    }
  });

  return plans;
}

// ─── Map strength sessions to dates ───────────────────────────────────────────

export function mapStrengthToDates(
  sessions:      StrengthSession[],
  availableDays: TrainingDay[],
  runDays:       string[],              // dates already used by running (avoid stacking)
  weekStartDate: Date,
  completedKeys: string[],
  currentWeek:   number,
): DayPlan[] {
  if (sessions.length === 0) return [];

  // Prefer strength on non-run days within available window
  const allIdxs = availableDays.length > 0
    ? availableDays.map(d => DOW_TO_IDX[d]).sort((a, b) => a - b)
    : [1, 2, 3, 4, 5, 6];

  // Non-run indexes preferred; fall back to run days if not enough
  const nonRunIdxs = allIdxs.filter(idx => {
    const d = addDays(weekStartDate, idx);
    return !runDays.includes(toYMD(d));
  });
  const preferredIdxs = nonRunIdxs.length >= sessions.length ? nonRunIdxs : allIdxs;

  const plans: DayPlan[] = [];
  sessions.forEach((session, i) => {
    const dayIdx = preferredIdxs[i % preferredIdxs.length];
    if (dayIdx === undefined) return;

    const date      = addDays(weekStartDate, dayIdx);
    const dateStr   = toYMD(date);
    const compKey   = `strength_w${currentWeek}_s${i}`;
    const completed = completedKeys.includes(compKey);

    const existing = plans.find(p => p.date === dateStr);
    const entry: CalendarEntry = {
      date:     dateStr,
      type:     'strength',
      label:    session.title,
      color:    '#A855F7',
      session,
      completed,
    };

    if (existing) {
      existing.entries.push(entry);
    } else {
      plans.push({ date: dateStr, entries: [entry] });
    }
  });

  return plans;
}

// ─── Merge calendar plans ──────────────────────────────────────────────────────

export function mergePlans(...planArrays: DayPlan[][]): Map<string, CalendarEntry[]> {
  const result = new Map<string, CalendarEntry[]>();
  for (const plans of planArrays) {
    for (const plan of plans) {
      const existing = result.get(plan.date) ?? [];
      result.set(plan.date, [...existing, ...plan.entries]);
    }
  }
  return result;
}
