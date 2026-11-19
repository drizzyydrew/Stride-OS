import type { CalendarEntry } from './calendarEngine';
import { addDays, parseYMD, toYMD } from './calendarEngine';
import type { TrainingDay } from '../types/athlete';
import type { ScheduledSession } from './scheduledSessions';
import { strengthScheduledSessionId } from './scheduledSessionIds';
import { hasOverlappingHardStress, isLongStress } from './sessionStress';

const DAYS: TrainingDay[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
function stressSession(entry: CalendarEntry): ScheduledSession {
  return { scheduledSessionId: entry.scheduledSessionId ?? entry.session?.id ?? entry.label,
    date: entry.date, originalDate: entry.originalDate ?? entry.date,
    activityType: entry.type, subtype: entry.session?.sessionType ?? entry.workout?.type ?? entry.type,
    title: entry.label, purpose: entry.session?.purpose ?? '', priority: entry.type === 'strength' ? 'supporting' : 'primary',
    durationMinutes: entry.session?.targetDuration ?? entry.workout?.durationMinutes ?? 0,
    target: '', status: entry.completed ? 'completed' : 'upcoming', strengthSession: entry.session };
}

/** Version2 generation only. A stable prospective rule, not a historical-data
 * rewrite: legacy plans never call this. Initial assignment does not depend on
 * completion flags, so a completed paired lift stays on its assigned date. */
export function reserveStrengthRestDay(input: {
  calendarMap: Map<string, CalendarEntry[]>;
  weekStartDate: Date;
  liftDays: TrainingDay[];
  activeStrengthSessionId?: string | null;
}) {
  const dates = Array.from({ length: 7 }, (_, i) => toYMD(addDays(input.weekStartDate, i)));
  const busy = dates.filter(date => input.calendarMap.get(date)?.some(entry => entry.type !== 'rest'));
  if (busy.length < 7) return { calendarMap: input.calendarMap, omittedSessionIds: [] as string[], note: null as string | null };
  // Preserve every key run. Consolidate or reduce a supporting strength day.
  const sourceDate = [...dates].reverse().find(date => {
    const entries = input.calendarMap.get(date) ?? [];
    return entries.length > 0 && entries.every(entry => entry.type === 'strength' && entry.session);
  });
  const source = sourceDate ? input.calendarMap.get(sourceDate)! : [];
  if (!sourceDate) {
    return { calendarMap: input.calendarMap, omittedSessionIds: [] as string[],
      note: 'This week needs a full-rest-day review. Completed and active sessions were kept; do not add catch-up work to resolve the conflict.' };
  }
  const allowed = new Set(input.liftDays.map(day => DAYS.indexOf(day)));
  const target = source.length === 1 ? dates.find(date => {
    if (date === sourceDate || !allowed.has(parseYMD(date).getDay())) return false;
    const entries = input.calendarMap.get(date) ?? [];
    if (!entries.length || entries.some(entry => entry.type === 'strength' || entry.type === 'race')) return false;
    const lift = stressSession(source[0]!);
    // Only pair with manageable work; protect long/quality running and nearby
    // lower-body demands rather than calling an upper day automatically rest.
    return [-1, 0, 1].every(offset => (input.calendarMap.get(toYMD(addDays(parseYMD(date), offset))) ?? [])
      .filter(entry => entry.date !== sourceDate).every(entry => {
        const other = stressSession(entry);
        return !isLongStress(other) && !hasOverlappingHardStress(lift, other);
      }));
  }) : undefined;
  const calendarMap = new Map(input.calendarMap);
  if (target) {
    calendarMap.delete(sourceDate);
    calendarMap.set(target, [...calendarMap.get(target)!, { ...source[0]!, date: target, originalDate: sourceDate }]);
    return { calendarMap, omittedSessionIds: [] as string[],
      note: `A supporting lift shares ${target} with easier training to leave ${sourceDate} fully free. Put your main priority first; separate sessions by several hours when practical.` };
  }
  if (source.some(entry => entry.completed || entry.session?.id === input.activeStrengthSessionId)) {
    return { calendarMap: input.calendarMap, omittedSessionIds: [] as string[],
      note: 'This week needs a full-rest-day review. Completed and active work was retained; change future availability rather than erase the work already performed.' };
  }
  calendarMap.delete(sourceDate);
  return { calendarMap, omittedSessionIds: source.flatMap(entry => entry.session ? [entry.session.id] : []),
    note: `The generated week leaves ${sourceDate} fully free. A supporting lift was omitted because the selected days did not allow a manageable pairing; review availability rather than train hard every day.` };
}


/** Instance completion keys are not legacy week/index aliases. Match only an
 * explicit canonical scheduled link before policies may omit supporting work. */
export function markCapturedStrengthCompletions(calendarMap: Map<string, CalendarEntry[]>, completedScheduledIds: readonly string[]) {
  const completed = new Set(completedScheduledIds);
  if (!completed.size) return calendarMap;
  return new Map([...calendarMap].map(([date, entries]) => [date, entries.map(entry => entry.type === 'strength' && entry.session
    && completed.has(entry.scheduledSessionId ?? strengthScheduledSessionId(date, entry.session.id)) ? { ...entry, completed: true } : entry)]));
}
