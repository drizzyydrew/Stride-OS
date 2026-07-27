// ─── Strength completion persistence ────────────────────────────────────────
//
// Converts the live per-set session state into the existing StrengthLogRecord
// shape. Keeping this pure means preset, Training Block, and custom sessions
// all retain the same audit trail without creating a second activity log.

import type { CompletedExercise } from '../types/strength';
import type { ActiveStrengthExercise } from './strengthSession';

export function completedExercisesFromActiveSession(
  exercises: ActiveStrengthExercise[],
  source: 'training_block' | 'preset' | 'custom',
  completedExerciseIds: readonly string[] = [],
  rpeByExercise: Record<string, number> = {},
  loadByExercise: Record<string, string> = {},
): CompletedExercise[] {
  return exercises.map(exercise => ({
    exerciseId: exercise.id,
    name: exercise.name,
    equipmentType: exercise.equipmentType,
    skipped: exercise.skipped || undefined,
    substitutedFromExerciseId: exercise.substitutedFromId,
    // Custom sessions do not have a prescribed exercise list. A replacement
    // still carries substitutedFromExerciseId above, so callers can tell the
    // two cases apart without inference.
    added: exercise.added || (source === 'custom' && !exercise.substitutedFromId) || undefined,
    notes: exercise.notes,
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
