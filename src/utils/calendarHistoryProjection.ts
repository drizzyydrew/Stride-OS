import type { CalendarEntry } from './calendarEngine';

/** Add unplanned actuals without hiding another session or duplicating a linked completion. */
export function mergeCalendarHistory(planned: readonly CalendarEntry[], actual: readonly CalendarEntry[]): CalendarEntry[] {
  const entries = [...planned];
  for (const recorded of actual) {
    const existing = entries.findIndex(entry =>
      (!!recorded.completedActivityId && entry.completedActivityId === recorded.completedActivityId)
      || (!!recorded.scheduledSessionId && entry.scheduledSessionId === recorded.scheduledSessionId));
    if (existing < 0) entries.push(recorded);
    else entries[existing] = { ...entries[existing], completed: recorded.completed,
      missed: recorded.missed, completedActivityId: recorded.completedActivityId };
  }
  return entries;
}
