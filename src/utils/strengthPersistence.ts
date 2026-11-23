// ─── Strength completion persistence ────────────────────────────────────────
//
// Converts the live per-set session state into the existing StrengthLogRecord
// shape. Keeping this pure means preset, Training Block, and custom sessions
// all retain the same audit trail without creating a second activity log.

import type { CompletedExercise } from '../types/strength';
import type { ActiveStrengthExercise, ActiveStrengthSession } from './strengthSession';

export function completedExercisesFromActiveSession(
  exercises: ActiveStrengthExercise[],
  source: 'training_block' | 'preset' | 'custom',
  completedExerciseIds: readonly string[] = [],
  rpeByExercise: Record<string, number> = {},
  loadByExercise: Record<string, string> = {},
): CompletedExercise[] {
  return exercises.map(exercise => ({
    exerciseId: exercise.canonicalExerciseId ?? exercise.id,
    name: exercise.name,
    templateExerciseId: exercise.templateExerciseId,
    group: exercise.group ? {...exercise.group} : undefined,
    equipmentType: exercise.equipmentType,
    skipped: exercise.skipped || undefined,
    substitutedFromExerciseId: exercise.substitutedFromId,
    substitutedFromPrescription: exercise.substitutedFromPrescription,
    // Custom sessions do not have a prescribed exercise list. A replacement
    // still carries substitutedFromExerciseId above, so callers can tell the
    // two cases apart without inference.
    added: exercise.added || (source === 'custom' && !exercise.substitutedFromId) || undefined,
    notes: exercise.notes,
    prescription: source !== 'custom' && exercise.sets > 0 ? {
      sets: exercise.sets, reps: exercise.reps,
      repScheme: exercise.repScheme ? { ...exercise.repScheme } : undefined,
      targetRpe: exercise.plannedRpe, restSeconds: exercise.plannedRestSeconds,
      loadTarget: exercise.plannedLoadTarget,
    } : undefined,
    sets: exercise.setEntries.map(entry => {
      const rawLoad = loadByExercise[exercise.id];
      const parsedLoad = parseStructuredLoad(rawLoad);
      const completed = (entry.completed || completedExerciseIds.includes(exercise.id)) && !exercise.skipped;
      return {
      id: entry.id,
      reps: entry.reps,
      load: rawLoad || undefined,
      weight: entry.weight ?? parsedLoad.weight,
      weightUnit: entry.weightUnit ?? parsedLoad.weightUnit,
      bandLevel: entry.bandLevel,
      bandCustomLabel: entry.bandCustomLabel,
      holdSeconds: entry.holdSeconds,
      distanceMeters: entry.distanceMeters,
      rpe: entry.rpe ?? rpeByExercise[exercise.id],
      isWarmup: entry.isWarmup,
      completed,
      dropSetGroupId: entry.dropSetGroupId,
      notes: entry.notes,
      };
    }),
  }));
}

function parseStructuredLoad(load: string | undefined): { weight?: number; weightUnit?: 'lb' | 'kg' } {
  if (!load) return {};
  const match = load.match(/(\d+(?:\.\d+)?)\s*(lb|lbs|kg)\b/i);
  if (!match) return {};
  const weight = Number(match[1]);
  if (!Number.isFinite(weight) || weight <= 0) return {};
  return { weight, weightUnit: /^kg$/i.test(match[2] ?? '') ? 'kg' : 'lb' };
}


/** Finish the captured workout even when a later plan no longer contains it.
 * Legacy drafts lack original scheduling metadata: use an instance identity
 * and neutral classification rather than attribute them to the current week. */
export function trainingBlockCompletionFromActiveSession(session: ActiveStrengthSession, elapsedSeconds: number) {
  const marked = session.completedExerciseIds.length > 0 || session.exercises.some(ex => ex.setEntries.some(set => set.completed));
  const completedIds = marked ? session.completedExerciseIds : session.exercises.map(ex => ex.id);
  const exercises = completedExercisesFromActiveSession(session.exercises, 'training_block', completedIds, session.rpeByExercise, session.loadByExercise);
  const actualEffort = exercises.flatMap(ex => ex.sets.filter(set => set.completed && !set.isWarmup).map(set => set.rpe))
    .filter((rpe): rpe is number => Number.isFinite(rpe) && rpe! >= 1 && rpe! <= 10);
  const partial = marked && exercises.some(ex => ex.skipped || ex.sets.some(set => !set.completed));
  return {
    completionKey: `training_block_${session.workoutInstanceId}`,
    workoutInstanceId: session.workoutInstanceId,
    scheduledSessionId: session.scheduledSessionId,
    sessionType: session.trackingContext?.sessionType ?? 'full_body' as const,
    goal: session.trackingContext?.goal ?? 'maintenance' as const,
    week: session.trackingContext?.week ?? 1,
    plannedDuration: session.plannedDurationMin,
    actualDuration: Math.max(1, Math.round(elapsedSeconds / 60)),
    exercises,
    overallRpe: actualEffort.length ? Math.round(actualEffort.reduce((sum, value) => sum + value, 0) / actualEffort.length) : undefined,
    notes: `${session.workoutName} completed from its captured active workout.${session.trackingContext ? '' : ' Legacy draft: original goal, session type and program week were not captured; full-body/maintenance/week1 are neutral compatibility fields.'}`,
    workoutName: session.workoutName,
    source: session.trackingContext ? 'generated' as const : 'manual' as const,
    completionClassification: partial ? 'partial' as const : session.exercises.some(ex => ex.substitutedFromId || ex.modifiedTargets) ? 'modified' as const : 'completed_as_prescribed' as const,
  };
}
