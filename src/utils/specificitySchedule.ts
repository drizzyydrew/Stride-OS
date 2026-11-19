import type { CalendarEntry } from './calendarEngine';
import { addDays, parseYMD, toYMD } from './calendarEngine';
import type { RichWorkout } from '../types/workout';
import type { ScheduledSession } from './scheduledSessions';
import { isHardLowerStrengthStress, isHardStress, isLongStress } from './sessionStress';
import { runScheduledSessionId } from './scheduledSessionIds';
import type { StrengthLogRecord } from '../types/strength';
import type { CompletedWorkoutRecord } from '../types/training';
import { classifyExerciseStimulus } from './exerciseAdaptation';

/** Known actual work, including before the visible week, matters for spacing.
 * Neither target RPE nor a default overall strength effort establishes this. */
export function priorDemandingDates(strength: StrengthLogRecord[], running: CompletedWorkoutRecord[], weekStart: Date): string[] {
  const before = Math.min(addDays(weekStart, 7).getTime(), Date.now() + 1);
  const lower = new Set(['squat', 'hip_hinge', 'hip_extension', 'single_leg', 'knee_flexion', 'knee_extension_isometric',
    'ankle_straight_knee', 'ankle_bent_knee', 'ankle_power', 'vertical_power', 'horizontal_power']);
  const dates = strength.filter(record => !record.skipped && Number.isFinite(record.timestamp) && record.timestamp > 0 && record.timestamp < before
    && record.exercises.some(exercise => !exercise.skipped
      && (lower.has(classifyExerciseStimulus({ name: exercise.name ?? '' })?.family ?? '') || /^(squat|hinge|lunge|calf|plyo)_/.test(exercise.exerciseId))
      && exercise.sets.some(set => set.completed && !set.isWarmup && Number.isFinite(set.rpe) && set.rpe! >= 8 && set.rpe! <= 10)))
    .map(record => toYMD(new Date(record.timestamp)));
  dates.push(...running.filter(record => !record.skipped && Number.isFinite(record.timestamp) && record.timestamp > 0 && record.timestamp < before
    && Number.isFinite(record.actualDurationMinutes) && record.actualDurationMinutes! > 0
    && ((record.type === 'long_run' && record.actualDurationMinutes! >= 75)
      || (Number.isFinite(record.rpe) && record.rpe! >= 8 && record.rpe! <= 10)))
    .map(record => toYMD(new Date(record.timestamp))));
  return [...new Set(dates)];
}

function stressEntry(entry: CalendarEntry): ScheduledSession {
  return { scheduledSessionId: entry.scheduledSessionId ?? entry.session?.id ?? entry.workout?.id ?? entry.label,
    date: entry.date, originalDate: entry.originalDate ?? entry.date, activityType: entry.type,
    subtype: entry.session?.sessionType ?? entry.workout?.type ?? entry.type, title: entry.label,
    purpose: entry.session?.purpose ?? '', priority: entry.type === 'strength' ? 'supporting' : 'primary',
    durationMinutes: entry.session?.targetDuration ?? entry.workout?.durationMinutes ?? 0,
    target: '', status: entry.completed ? 'completed' : 'upcoming', strengthSession: entry.session };
}

export function markCapturedRunCompletions(calendarMap: Map<string, CalendarEntry[]>, completedScheduledIds: readonly string[]) {
  const completed = new Set(completedScheduledIds);
  if (!completed.size) return calendarMap;
  return new Map([...calendarMap].map(([date, entries]) => [date, entries.map(entry => {
    const workout = entry.workout as RichWorkout | undefined;
    if (!workout) return entry;
    const id = entry.scheduledSessionId ?? runScheduledSessionId(date, workout.id, workout.dayIndex);
    return completed.has(id) ? { ...entry, completed: true } : entry;
  })]));
}

/** Check the actual assigned dates, after rest-day placement. An eligible
 * athlete still needs space for a high-demand aerobic-power session. */
export function protectNorwegianSchedule(input: {
  calendarMap: Map<string, CalendarEntry[]>;
  activeWorkoutId?: string | null;
  completedScheduledIds?: readonly string[];
  priorDemandingDates?: readonly string[];
  easyAlternative: (workout: RichWorkout) => RichWorkout;
}) {
  const replacements = new Map<string, RichWorkout>();
  const notes: string[] = [];
  const completed = new Set(input.completedScheduledIds);
  const historicalDemand = new Set(input.priorDemandingDates);
  const calendarMap = new Map([...input.calendarMap].map(([date, entries]) => [date, entries.map(entry => {
    const workout = entry.workout as RichWorkout | undefined;
    if (workout?.protocol !== 'norwegian_4x4') return entry;
    const conflict = [-1, 0, 1].some(offset => historicalDemand.has(toYMD(addDays(parseYMD(date), offset))) || (input.calendarMap.get(toYMD(addDays(parseYMD(date), offset))) ?? [])
      .filter(other => other !== entry).some(other => {
        const stress = stressEntry(other);
        return isHardLowerStrengthStress(stress) || isLongStress(stress)
          || (other.type !== 'strength' && other.type !== 'rest' && isHardStress(stress));
      }));
    if (!conflict) return entry;
    const scheduledId = entry.scheduledSessionId ?? runScheduledSessionId(date, workout.id, workout.dayIndex);
    if (entry.completed || completed.has(scheduledId) || input.activeWorkoutId === workout.id) {
      notes.push('The started or completed interval session was retained. Review nearby demanding work and do not add catch-up training.');
      return entry;
    }
    const easy = { ...input.easyAlternative(workout), id: workout.id, dayIndex: workout.dayIndex };
    replacements.set(workout.id, easy);
    notes.push('Norwegian 4×4 was held because the assigned dates place demanding lower-body work or a long/quality run nearby. Easy running preserves recovery; change future availability to create space.');
    return { ...entry, label: easy.title, workout: easy };
  })]));
  return { calendarMap, replacements, notes };
}
