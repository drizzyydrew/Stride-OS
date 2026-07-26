// ─── Honest split strength summaries ───────────────────────────────────────
//
// Deliberately produces NO single combined "volume" number. External load
// (barbell/dumbbell/kettlebell/cable/machine/medicine_ball/other with a
// valid weight+unit), band work, and bodyweight work are fundamentally
// different kinds of stimulus and are reported as separate, honest figures
// rather than summed into one misleading total. Warm-up sets are excluded
// from the "real work" totals (reps, external load) but reported separately
// so nothing is silently dropped.

import { kgToLb } from './units';
import type { ActiveSetEntry, ActiveStrengthExercise, EquipmentType } from './strengthSession';

export type StrengthSummaryExerciseInput = Pick<ActiveStrengthExercise, 'id' | 'name' | 'setEntries'> & {
  equipmentType?: EquipmentType;
  skipped?: boolean;
};

export type StrengthSessionSummary = {
  exerciseCount: number;
  completedSets: number;
  totalReps: number;                 // main (non-warm-up) completed sets only
  externalLoadVolumeLb: number;      // Σ reps×weight, canonical unit lb, main sets only
  hasExternalLoadVolume: boolean;    // false when nothing contributed (avoid showing a bare 0)
  bandSetsCount: number;             // never converted to a load number
  bodyweightSetsCount: number;
  totalHoldSeconds: number;
  durationMinutes: number;
  averageRpe: number | null;         // set-level rpe, falling back to exercise-level
  warmupSetsCount: number;           // reported separately, excluded from totalReps/externalLoadVolume
  warmupReps: number;
};

const LOAD_BEARING_EQUIPMENT: ReadonlySet<EquipmentType> = new Set([
  'barbell', 'dumbbell', 'kettlebell', 'cable', 'machine', 'medicine_ball', 'suspension_trainer', 'other',
]);

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

// A set counts as "band work" if it's flagged with a band level OR the
// exercise itself is a resistance-band exercise — either way it never
// contributes to externalLoadVolume.
function isBandSet(set: ActiveSetEntry, equipmentType: EquipmentType | undefined): boolean {
  return Boolean(set.bandLevel) || equipmentType === 'resistance_band';
}

function weightInLb(set: ActiveSetEntry): number | null {
  if (!isFiniteNumber(set.weight) || set.weight <= 0) return null;
  if (set.weightUnit === 'kg') return kgToLb(set.weight);
  if (set.weightUnit === 'lb') return set.weight;
  return null; // weight present but unit missing/invalid — never guess
}

export function summarizeStrengthSession(params: {
  exercises: StrengthSummaryExerciseInput[];
  rpeByExercise?: Record<string, number>;
  durationSeconds: number;
}): StrengthSessionSummary {
  const rpeByExercise = params.rpeByExercise ?? {};
  const activeExercises = params.exercises.filter(exercise => !exercise.skipped);

  let completedSets = 0;
  let totalReps = 0;
  let externalLoadVolumeLb = 0;
  let hasExternalLoadVolume = false;
  let bandSetsCount = 0;
  let bodyweightSetsCount = 0;
  let totalHoldSeconds = 0;
  let warmupSetsCount = 0;
  let warmupReps = 0;
  const rpeSamples: number[] = [];

  for (const exercise of activeExercises) {
    const fallbackRpe = rpeByExercise[exercise.id];
    for (const set of exercise.setEntries) {
      if (!set.completed) continue;
      completedSets += 1;

      if (isFiniteNumber(set.holdSeconds) && set.holdSeconds > 0) {
        totalHoldSeconds += set.holdSeconds;
      }

      if (isBandSet(set, exercise.equipmentType)) {
        bandSetsCount += 1;
      } else if (exercise.equipmentType === 'bodyweight') {
        bodyweightSetsCount += 1;
      }

      if (set.isWarmup) {
        warmupSetsCount += 1;
        if (isFiniteNumber(set.reps)) warmupReps += set.reps;
        continue; // excluded from main totalReps/externalLoadVolume + RPE
      }

      if (isFiniteNumber(set.reps) && set.reps > 0) totalReps += set.reps;

      const loadEligible = exercise.equipmentType && LOAD_BEARING_EQUIPMENT.has(exercise.equipmentType)
        && !isBandSet(set, exercise.equipmentType);
      if (loadEligible) {
        const lb = weightInLb(set);
        if (lb != null && isFiniteNumber(set.reps) && set.reps > 0) {
          externalLoadVolumeLb += lb * set.reps;
          hasExternalLoadVolume = true;
        }
      }

      const rpe = isFiniteNumber(set.rpe) ? set.rpe : fallbackRpe;
      if (isFiniteNumber(rpe)) rpeSamples.push(rpe);
    }
  }

  const averageRpe = rpeSamples.length > 0
    ? Math.round((rpeSamples.reduce((sum, value) => sum + value, 0) / rpeSamples.length) * 10) / 10
    : null;

  return {
    exerciseCount: activeExercises.length,
    completedSets,
    totalReps,
    externalLoadVolumeLb: Math.round(externalLoadVolumeLb * 10) / 10,
    hasExternalLoadVolume,
    bandSetsCount,
    bodyweightSetsCount,
    totalHoldSeconds,
    durationMinutes: Math.max(0, Math.round(params.durationSeconds / 60)),
    averageRpe,
    warmupSetsCount,
    warmupReps,
  };
}
