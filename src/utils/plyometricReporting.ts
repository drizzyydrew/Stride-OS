import type { CompletedExercise, StrengthLogRecord } from '../types/strength';
import { isRecordedReactiveExercise } from './goalPlyometrics';

/** A report belongs to an exact performed exercise, not a scheduled jump label.
 * Duplicate IDs cannot identify one exercise unambiguously and stay unavailable. */
export function reportablePlyometricExercises(record: StrengthLogRecord | undefined, now = Date.now()): CompletedExercise[] {
  if (!record || record.completed !== true || record.skipped || !Number.isFinite(record.timestamp)
    || record.timestamp <= 0 || record.timestamp > now || !Array.isArray(record.exercises)) return [];
  return record.exercises.filter(exercise => typeof exercise.exerciseId === 'string' && exercise.exerciseId.length > 0
    && record.exercises.filter(item => item.exerciseId === exercise.exerciseId).length === 1
    && !exercise.skipped && isRecordedReactiveExercise(exercise) && Array.isArray(exercise.sets)
    && exercise.sets.some(set => set.completed === true && !set.isWarmup && Number.isSafeInteger(set.reps) && set.reps! > 0));
}
