// ─── Missed Workout Reconciliation ─────────────────────────────────────────────
//
// Pure post-processing pass over a week's calendarMap. Flags past, incomplete
// entries as missed WITHOUT rescheduling them onto later days (no stacking —
// StrideOS never asks an athlete to "make up" a missed run by cramming it
// elsewhere). If the week is falling apart (2+ missed runs) and a quality
// session remains later this week, it's proactively softened to easy running
// so the athlete doesn't walk into a hard session already fatigued and behind.

import type { CalendarEntry } from '../calendarEngine';
import type { RichWorkout, RichWorkoutType } from '../../types/workout';
import { parseYMD } from '../calendarEngine';

const QUALITY_TYPES: ReadonlySet<RichWorkoutType> = new Set([
  'threshold', 'tempo', 'vo2', 'hill_repeats', 'progression_run', 'fartlek', 'marathon_pace',
]);

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function weekdayLabel(dateYMD: string): string {
  return WEEKDAY_NAMES[parseYMD(dateYMD).getDay()] ?? dateYMD;
}

export type MissedReconcileResult = {
  calendarMap: Map<string, CalendarEntry[]>;
  notes:       string[];
};

export function reconcileMissedSessions(input: {
  calendarMap: Map<string, CalendarEntry[]>;
  todayYMD:    string;
}): MissedReconcileResult {
  const { calendarMap, todayYMD } = input;
  const notes: string[] = [];
  let missedRunCount = 0;

  // Pass 1 — mark past, incomplete entries as missed. No rescheduling.
  const nextMap = new Map<string, CalendarEntry[]>();
  for (const [date, entries] of calendarMap.entries()) {
    const updated = entries.map(e => {
      if (date < todayYMD && !e.completed && e.type !== 'rest' && e.type !== 'race') {
        if (e.type === 'run') missedRunCount++;
        return { ...e, missed: true };
      }
      return e;
    });
    nextMap.set(date, updated);
  }

  // Pass 2 — if the week is unraveling, soften the next remaining quality
  // session rather than let the athlete cram it in fatigued.
  if (missedRunCount >= 2) {
    const dates = [...nextMap.keys()].filter(d => d >= todayYMD).sort();

    outer:
    for (const date of dates) {
      const entries = nextMap.get(date)!;
      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i]!;
        if (entry.type !== 'run' || entry.completed) continue;
        const richType = (entry.workout as RichWorkout | undefined)?.richType;
        if (richType && QUALITY_TYPES.has(richType)) {
          const downgradedWorkout = entry.workout
            ? { ...entry.workout, type: 'easy_run' as const, title: 'Easy Run (adjusted)', richType: 'easy_run' } as RichWorkout
            : entry.workout;
          const dayEntries = [...entries];
          dayEntries[i] = { ...entry, label: 'Easy Run (adjusted)', workout: downgradedWorkout };
          nextMap.set(date, dayEntries);
          notes.push(`Missed sessions this week — swapped ${weekdayLabel(date)}'s quality session for easy running to avoid cramming.`);
          break outer;
        }
      }
    }
  }

  return { calendarMap: nextMap, notes };
}
