import type { CalendarEntry } from './calendarEngine';
import { addDays, parseYMD, toYMD } from './calendarEngine';
import type { TrainingDay } from '../types/athlete';
import type { RichWorkout } from '../types/workout';
import type { StrengthSession } from '../types/strength';
import type { ScheduledSession } from './scheduledSessions';
import { isHardLowerStrengthStress, isHardStress, isLongStress } from './sessionStress';
import { estimateStrengthSessionMinutes } from './strengthDesign';

const DAYS: TrainingDay[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const LOWER = new Set(['squat', 'hinge', 'lunge', 'calf_ankle']);
function stress(entry: CalendarEntry): ScheduledSession {
  return { scheduledSessionId: entry.session?.id ?? entry.workout?.id ?? entry.label, date: entry.date, originalDate: entry.originalDate ?? entry.date,
    activityType: entry.type, subtype: entry.session?.sessionType ?? entry.workout?.type ?? entry.type, title: entry.label,
    purpose: entry.session?.purpose ?? '', target: '', priority: 'supporting', durationMinutes: entry.session?.targetDuration ?? entry.workout?.durationMinutes ?? 0,
    status: entry.completed ? 'completed' : 'upcoming', strengthSession: entry.session, richWorkout: entry.workout as RichWorkout | undefined };
}
function keyRun(entry: CalendarEntry) {
  return ['run', 'run_walk', 'race'].includes(entry.type) && (entry.type === 'race' || isHardStress(stress(entry))
    || entry.workout?.type === 'long_run' || (entry.workout as RichWorkout | undefined)?.richType === 'long_run');
}
function reduceSupport(session: StrengthSession): StrengthSession {
  const exercises = session.exercises.filter(ex => ex.exercise.pattern !== 'plyometric').map(ex => {
    if (!LOWER.has(ex.exercise.pattern)) return ex;
    const rpe = Math.min(ex.rpe, 5);
    return { ...ex, sets: Math.min(ex.sets, 1), rpe, rir: 10 - rpe,
      loadTarget: `RPE ${rpe} — light support around the key run; reduce the load for today's effort`,
      notes: `${ex.notes ?? ''} Lower-body dose reduced to protect nearby running quality; no catch-up sets.`.trim() };
  });
  return { ...session, title: 'Reduced strength support', lowerDemand: 'reduced_support', exercises,
    primaryPatterns: [...new Set(exercises.map(ex => ex.exercise.pattern))],
    targetDuration: estimateStrengthSessionMinutes(exercises),
    purpose: 'Keep upper-body and trunk practice, with light lower-body support around important running work.',
    progressionNote: `${session.progressionNote} Lower-body progression is held because the selected days put it beside a key run. Review availability to create room for more strength work.` };
}

/** New generated plans only. Fit lifting around actual key-run dates rather
 * than declaring every non-running day a suitable demanding lower-body day. */
export function balanceHybridStrength(input: { calendarMap: Map<string, CalendarEntry[]>; weekStart: Date; liftDays: TrainingDay[];
  activeStrengthSessionId?: string | null; today?: string }) {
  const calendarMap = new Map([...input.calendarMap].map(([date, entries]) => [date, [...entries]]));
  const replacements = new Map<string, StrengthSession>(); const notes: string[] = [];
  const selected = new Set(input.liftDays);
  const dates = Array.from({ length: 7 }, (_, i) => toYMD(addDays(input.weekStart, i)));
  const relevant = (entry: CalendarEntry) => !input.today || entry.date >= input.today || entry.completed;
  const nearbyKeys = (date: string, excludeSame = false) => [-1, 0, 1].flatMap(offset => excludeSame && offset === 0 ? []
    : (calendarMap.get(toYMD(addDays(parseYMD(date), offset))) ?? []).filter(entry => relevant(entry) && keyRun(entry)));
  const nearbyOtherLift = (date: string, id: string) => [-1, 1].some(offset =>
    (calendarMap.get(toYMD(addDays(parseYMD(date), offset))) ?? []).some(entry => relevant(entry) && entry.session?.id !== id && isHardLowerStrengthStress(stress(entry))));
  const sources = [...calendarMap.values()].flat().filter(entry => entry.session && isHardLowerStrengthStress(stress(entry)));
  for (const entry of sources) {
    const session = entry.session!;
    if (!nearbyKeys(entry.date).length) continue;
    if (entry.completed || session.id === input.activeStrengthSessionId) {
      notes.push('Started or completed strength work was retained. Review future key-run and lifting placement rather than erase or repeat completed work.'); continue;
    }
    if (input.today && entry.date < input.today) continue; // Never move a missed lift forward as catch-up.
    const target = dates.find(date => date !== entry.date && (!input.today || date >= input.today)
      && selected.has(DAYS[parseYMD(date).getDay()]!)
      && !(calendarMap.get(date) ?? []).some(other => other.type === 'strength') && nearbyKeys(date).length === 0 && !nearbyOtherLift(date, session.id));
    if (target) {
      calendarMap.set(entry.date, (calendarMap.get(entry.date) ?? []).filter(other => other !== entry));
      calendarMap.set(target, [...(calendarMap.get(target) ?? []), { ...entry, date: target, originalDate: entry.originalDate ?? entry.date }]);
      notes.push(`A supporting lift moved to ${target} within your selected lifting days to protect the key run.`); continue;
    }
    // A selected quality day can concentrate demands if both neighbors are
    // easy/rest. Long runs and Norwegian 4×4 retain their stricter separation.
    const paired = dates.find(date => date !== entry.date && (!input.today || date >= input.today)
      && selected.has(DAYS[parseYMD(date).getDay()]!) && !(calendarMap.get(date) ?? []).some(other => other.type === 'strength')
      && (calendarMap.get(date) ?? []).some(other => relevant(other) && keyRun(other))
      && (calendarMap.get(date) ?? []).every(other => !relevant(other) || (!isLongStress(stress(other)) && (other.workout as RichWorkout | undefined)?.protocol !== 'norwegian_4x4' && other.type !== 'race'))
      && nearbyKeys(date, true).length === 0 && !nearbyOtherLift(date, session.id));
    if (paired) {
      const exercises = session.exercises.filter(ex => ex.exercise.pattern !== 'plyometric').map(ex => LOWER.has(ex.exercise.pattern) ? { ...ex, sets: Math.min(ex.sets, 2), rpe: Math.min(ex.rpe, 6), rir: Math.max(ex.rir, 4),
        loadTarget: 'RPE 6 or easier — manageable paired-session work; calibrate the load for this effort' } : ex);
      const adjusted = { ...session, exercises, primaryPatterns: [...new Set(exercises.map(ex => ex.exercise.pattern))], targetDuration: estimateStrengthSessionMinutes(exercises),
        progressionNote: `${session.progressionNote} This lift shares the quality day; explosive work is held and lower-body dose is capped. Put the main priority first and separate sessions by several hours when practical.` };
      replacements.set(session.id, adjusted);
      calendarMap.set(entry.date, (calendarMap.get(entry.date) ?? []).filter(other => other !== entry));
      calendarMap.set(paired, [...calendarMap.get(paired)!, { ...entry, date: paired, originalDate: entry.originalDate ?? entry.date, session: adjusted }]);
      notes.push('A manageable supporting lift shares a quality day so the following easier day remains easier; prioritize the key session.'); continue;
    }
    const reduced = reduceSupport(session); replacements.set(session.id, reduced);
    calendarMap.set(entry.date, (calendarMap.get(entry.date) ?? []).map(other => other === entry ? { ...other, label: reduced.title, session: reduced } : other));
    notes.push('The selected days leave strength beside a key run. Lower-body work was reduced instead of making every day demanding; choose different lifting days to support more strength progression.');
  }
  return { calendarMap, replacements, notes };
}
