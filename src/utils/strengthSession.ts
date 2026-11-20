// ─── Live Strength Session — pure per-set reducer logic ───────────────────────
//
// This module owns the data shape and all state transitions for a live
// strength session (per-set structure: reps/weight/band/hold/RPE/warm-up,
// add/remove/duplicate/edit sets, add/remove/reorder/substitute/skip
// exercises). `src/store/activeStrengthSessionStore.ts` is a thin zustand
// wrapper around these functions — every action here is a pure
// `(session, ...) => session` transform with no store/React dependency, so
// it can be exercised directly by node:test.
//
// `ActiveStrengthSource` (which screens exist for which session origin)
// stays defined in the store — it's UI/navigation concern, not reducer
// logic — see activeStrengthSessionStore.ts.

// ─── Types ──────────────────────────────────────────────────────────────────

import type { RepScheme, StrengthSessionType, StrengthGoal } from '../types/strength';
import {
  parsePrescriptionScheme,
  representativeDistanceMetersForScheme,
  representativeRepsForScheme,
  representativeSecondsForScheme,
} from './prescriptionFormat';

export type EquipmentType =
  | 'bodyweight'
  | 'barbell'
  | 'dumbbell'
  | 'kettlebell'
  | 'cable'
  | 'machine'
  | 'resistance_band'
  | 'suspension_trainer'
  | 'medicine_ball'
  | 'other';

export type BandLevel = 'extra_light' | 'light' | 'medium' | 'heavy' | 'extra_heavy' | 'custom';

export type ActiveSetEntry = {
  id: string;
  dropSetGroupId?: string;
  previousPerformance?: import('./strengthTemplates').PreviousSetPerformance;
  reps?: number;
  weight?: number;
  weightUnit?: 'lb' | 'kg';
  bandLevel?: BandLevel;
  bandCustomLabel?: string;
  holdSeconds?: number;
  distanceMeters?: number;   // e.g. loaded carries
  rpe?: number;
  rir?: number;              // reps in reserve — optional, surfaced only where trivial
  restSeconds?: number;
  isWarmup?: boolean;
  completed: boolean;
  notes?: string;
};

export type ActiveStrengthExercise = {
  id: string;
  canonicalExerciseId?: string;
  templateExerciseId?: string;
  group?: import('./strengthTemplates').StrengthExerciseGroup;
  modifiedTargets?: boolean;
  name: string;
  // Legacy prescribed shape — still the source of truth for what was
  // programmed; setEntries below is the live, athlete-editable record of
  // what was actually done.
  sets: number;
  reps: string;
  repScheme?: RepScheme;
  equipment: string[];
  equipmentType?: EquipmentType;
  notes?: string;
  plannedRpe?: number;
  plannedRestSeconds?: number;
  plannedLoadTarget?: string;
  setEntries: ActiveSetEntry[];
  // Set when this exercise replaced a prescribed one (substitution), or
  // when it was added freeform during a custom session.
  substitutedFromId?: string;
  substitutedFromPrescription?: { exerciseId: string; name: string; sets: number; reps: string; repScheme?: RepScheme; targetRpe?: number; restSeconds?: number; loadTarget?: string };
  // True when the athlete added an exercise that was not prescribed.
  // Substitutions use `substitutedFromId` instead.
  added?: boolean;
  // Prescribed exercise the athlete chose not to perform this session —
  // marked, never deleted, so the prescription stays visible.
  skipped?: boolean;
};

export type TrainingBlockTrackingContext = {
  completionKey: string;
  week: number;
  sessionType: StrengthSessionType;
  goal: StrengthGoal;
  warmupProtocol?: string;
  cooldownProtocol?: string;
};

export type ActiveStrengthSession = {
  templateId?: string;
  trackingContext?: TrainingBlockTrackingContext;
  workoutId: string;
  workoutName: string;
  plannedDurationMin: number;
  exercises: ActiveStrengthExercise[];
  currentExerciseIndex: number;
  completedExerciseIds: string[];
  rpeByExercise: Record<string, number>;
  loadByExercise: Record<string, string>;
  startedAt: number;
  pausedAt: number | null;
  pausedDurationMs: number;
  status: 'active' | 'paused';
  workoutInstanceId: string;
  // Present when this live session is being performed against a scheduled
  // session (Do My Own Workout launched from Calendar/Strength against a
  // specific day) — used to link the finished Activity and to drive
  // substitution classification. Absent for standalone custom sessions.
  scheduledSessionId?: string;
  // The scheduled session's own category (CalendarEntry['type'] /
  // ScheduledSession.activityType), captured at launch so substitution
  // classification doesn't need a second lookup at finish time.
  scheduledCategory?: string;
};

// ─── ID generation ──────────────────────────────────────────────────────────
//
// Deterministic-enough (monotonic counter + timestamp) without needing a
// crypto/uuid dependency. Tests can ignore exact ids and assert on shape/count.

let idCounter = 0;
export function generateSetId(prefix = 'set'): string {
  idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${idCounter}`;
}
export function generateExerciseId(prefix = 'exercise'): string {
  idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${idCounter}`;
}

// ─── Equipment mapping ──────────────────────────────────────────────────────

const EQUIPMENT_TOKEN_MAP: Record<string, EquipmentType> = {
  bodyweight: 'bodyweight',
  barbell: 'barbell',
  dumbbell: 'dumbbell',
  dumbbells: 'dumbbell',
  kettlebell: 'kettlebell',
  kettlebells: 'kettlebell',
  cable: 'cable',
  machine: 'machine',
  band: 'resistance_band',
  bands: 'resistance_band',
  resistance_band: 'resistance_band',
  suspension: 'suspension_trainer',
  trx: 'suspension_trainer',
  suspension_trainer: 'suspension_trainer',
  medicine_ball: 'medicine_ball',
  med_ball: 'medicine_ball',
};

// Maps the existing free-text `equipment: string[]` onto the closed
// EquipmentType union. Falls back to 'other' when nothing recognizable is
// present rather than guessing.
export function mapEquipmentType(equipment: string[] | undefined | null): EquipmentType {
  if (!equipment || equipment.length === 0) return 'other';
  for (const raw of equipment) {
    const token = raw.trim().toLowerCase().replace(/\s+/g, '_');
    const mapped = EQUIPMENT_TOKEN_MAP[token];
    if (mapped) return mapped;
  }
  return 'other';
}

// ─── Set synthesis (start-time and rehydrate-time) ─────────────────────────

function primaryRepCount(reps: string): number | undefined {
  const match = reps.match(/\d+/);
  return match ? Number(match[0]) : undefined;
}

// Builds N un-completed set entries from a legacy prescribed sets/reps pair —
// used both when a session first starts (training_block/preset exercises
// arrive without setEntries) and when rehydrating a persisted session that
// predates the per-set structure.
export function synthesizeSetEntries(sets: number, reps: string, repScheme?: RepScheme): ActiveSetEntry[] {
  const count = Math.max(0, Math.round(sets) || 0);
  const scheme = repScheme ?? parsePrescriptionScheme(reps);
  const repCount = scheme ? representativeRepsForScheme(scheme) : primaryRepCount(reps);
  const holdSeconds = representativeSecondsForScheme(scheme, reps);
  const distanceMeters = representativeDistanceMetersForScheme(scheme, reps);
  return Array.from({ length: count }, () => ({
    id: generateSetId(),
    reps: repCount,
    holdSeconds,
    distanceMeters,
    completed: false,
  }));
}

// Fills in setEntries/equipmentType on a single exercise if missing, leaving
// an already-shaped exercise untouched (idempotent).
export function ensureExerciseShape(exercise: Partial<ActiveStrengthExercise> & { id: string; name: string }): ActiveStrengthExercise {
  const sets = exercise.sets ?? exercise.setEntries?.length ?? 0;
  const reps = exercise.reps ?? '';
  const repScheme = exercise.repScheme;
  return {
    id: exercise.id,
    name: exercise.name,
    sets,
    reps,
    repScheme,
    equipment: exercise.equipment ?? [],
    equipmentType: exercise.equipmentType ?? mapEquipmentType(exercise.equipment),
    notes: exercise.notes,
    canonicalExerciseId: exercise.canonicalExerciseId,
    templateExerciseId: exercise.templateExerciseId,
    group: exercise.group ? {...exercise.group} : undefined,
    modifiedTargets: exercise.modifiedTargets,
    substitutedFromPrescription: exercise.substitutedFromPrescription,
    plannedRpe: exercise.plannedRpe,
    plannedRestSeconds: exercise.plannedRestSeconds,
    plannedLoadTarget: exercise.plannedLoadTarget,
    setEntries: exercise.setEntries && exercise.setEntries.length > 0
      ? exercise.setEntries
      : synthesizeSetEntries(sets, reps, repScheme),
    substitutedFromId: exercise.substitutedFromId,
    added: exercise.added,
    skipped: exercise.skipped,
  };
}

// Fills in setEntries/equipmentType across every exercise in a session.
// Safe to call on an already-shaped session (no-op per exercise) — this is
// what the store's rehydrate merge calls on legacy persisted drafts, and
// what startSession calls on freshly-launched exercises.
export function ensureSessionShape<T extends { exercises: (Partial<ActiveStrengthExercise> & { id: string; name: string })[] }>(
  session: T,
): T & { exercises: ActiveStrengthExercise[] } {
  return {
    ...session,
    exercises: session.exercises.map(ensureExerciseShape),
  };
}

// ─── Session helpers ────────────────────────────────────────────────────────

function mapExercise(
  session: ActiveStrengthSession,
  exerciseId: string,
  fn: (exercise: ActiveStrengthExercise) => ActiveStrengthExercise,
): ActiveStrengthSession {
  let changed = false;
  const exercises = session.exercises.map(exercise => {
    if (exercise.id !== exerciseId) return exercise;
    changed = true;
    return fn(exercise);
  });
  return changed ? { ...session, exercises } : session;
}

// ─── Exercise-level operations ─────────────────────────────────────────────

export type AddExerciseInput = {
  name: string;
  canonicalExerciseId?: string;
  plannedSets?: number;
  plannedReps?: string;
  equipmentType?: EquipmentType;
  equipment?: string[];
  notes?: string;
  repScheme?: RepScheme;
  substitutedFromId?: string;
  // Optional first set seed (custom sessions add one blank set by default so
  // the athlete has something to edit immediately).
  seedSet?: boolean;
};

export function addExercise(session: ActiveStrengthSession, input: AddExerciseInput): ActiveStrengthSession {
  const exercise: ActiveStrengthExercise = {
    id: generateExerciseId(),
    name: input.name.trim() || 'Exercise',
    canonicalExerciseId: input.canonicalExerciseId,
    sets: 0,
    reps: '',
    repScheme: input.repScheme,
    equipment: input.equipment ?? [],
    equipmentType: input.equipmentType ?? mapEquipmentType(input.equipment),
    notes: input.notes,
    setEntries: input.seedSet === false ? [] : [{ id: generateSetId(), completed: false }],
    substitutedFromId: input.substitutedFromId,
    added: !input.substitutedFromId,
  };
  return { ...session, exercises: [...session.exercises, exercise] };
}

export function removeExercise(session: ActiveStrengthSession, exerciseId: string): ActiveStrengthSession {
  const exercises = session.exercises.filter(exercise => exercise.id !== exerciseId);
  if (exercises.length === session.exercises.length) return session;
  return {
    ...session,
    exercises:exercises.map(ex=>ex.group&&exercises.filter(other=>other.group?.id===ex.group?.id).length<2?{...ex,group:undefined}:ex),
    completedExerciseIds: session.completedExerciseIds.filter(id => id !== exerciseId),
    currentExerciseIndex: Math.max(0, Math.min(session.currentExerciseIndex, exercises.length - 1)),
  };
}

export function reorderExercise(session: ActiveStrengthSession, exerciseId: string, direction: 'up' | 'down'): ActiveStrengthSession {
  const index = session.exercises.findIndex(exercise => exercise.id === exerciseId);
  if (index < 0) return session;
  const targetIndex = direction === 'up' ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= session.exercises.length) return session;
  const exercises = [...session.exercises];
  const [moved] = exercises.splice(index, 1);
  exercises.splice(targetIndex, 0, moved!);
  return { ...session, exercises };
}

// Replaces a prescribed exercise with a different one at the same position —
// the original is removed from the active list but its id is preserved on
// `substitutedFromId` so the substitution is auditable. Prescribed sets/reps
// on the original are never mutated (they live on the schedule side).
export function substituteExercise(
  session: ActiveStrengthSession,
  exerciseId: string,
  replacement: AddExerciseInput,
): ActiveStrengthSession {
  const index = session.exercises.findIndex(exercise => exercise.id === exerciseId);
  if (index < 0) return session;
  const original = session.exercises[index]!;
  const performed = original.setEntries.filter(set => set.completed && !set.isWarmup).length;
  const workingSets = original.setEntries.filter(set => !set.isWarmup);
  if (session.completedExerciseIds.includes(exerciseId) || (workingSets.length > 0 && workingSets.every(set => set.completed))) return session;
  const remaining = original.sets > 0 ? Math.max(0, original.sets - performed) : Math.max(1, workingSets.filter(set => !set.completed).length);
  if (!remaining) return session;
  const plannedSets = Math.max(1, Math.min(remaining, replacement.plannedSets ?? remaining));
  const next: ActiveStrengthExercise = {
    id: generateExerciseId(),
    canonicalExerciseId: replacement.canonicalExerciseId,
    name: replacement.name.trim() || 'Exercise',
    sets: replacement.plannedSets === undefined ? 0 : plannedSets,
    reps: replacement.plannedReps ?? '',
    repScheme: replacement.repScheme,
    equipment: replacement.equipment ?? [],
    equipmentType: replacement.equipmentType ?? mapEquipmentType(replacement.equipment),
    notes: replacement.notes,
    setEntries: replacement.seedSet === false ? [] : Array.from({ length: replacement.plannedSets === undefined ? 1 : plannedSets }, () => ({ id: generateSetId(), completed: false })),
    substitutedFromId: exerciseId,
    substitutedFromPrescription: original.substitutedFromPrescription ?? {
      exerciseId: original.canonicalExerciseId ?? original.id, name: original.name, sets: original.sets, reps: original.reps,
      repScheme: original.repScheme, targetRpe: original.plannedRpe, restSeconds: original.plannedRestSeconds, loadTarget: original.plannedLoadTarget,
    },
    added: false,
  };
  const exercises = [...session.exercises];
  // Performed work is immutable. Keep its original row and insert only the
  // remaining work, rather than erase actuals or duplicate the full dose.
  const anyPerformed = original.setEntries.some(set => set.completed);
  if (anyPerformed) {
    exercises[index] = { ...original, setEntries: original.setEntries.filter(set => set.completed),
      notes: `${original.notes ?? ''}${original.notes ? ' ' : ''}Performed work retained; remaining targets were moved to the chosen alternative.` };
    exercises.splice(index + 1, 0, next);
  }
  else exercises.splice(index, 1, next);
  return {
    ...session,
    exercises,
    completedExerciseIds: anyPerformed ? [...new Set([...session.completedExerciseIds, exerciseId])] : session.completedExerciseIds.filter(id => id !== exerciseId),
    currentExerciseIndex: anyPerformed ? index + 1 : index,
  };
}

// Marks a prescribed exercise as skipped — kept in the list (not deleted) so
// the prescription remains visible; excluded from finish-time aggregates.
export function skipExercise(session: ActiveStrengthSession, exerciseId: string, skipped = true): ActiveStrengthSession {
  return mapExercise(session, exerciseId, exercise => ({ ...exercise, skipped }));
}

// ─── Set-level operations ───────────────────────────────────────────────────

export function addSet(session: ActiveStrengthSession, exerciseId: string, template?: Partial<Omit<ActiveSetEntry, 'id'>>): ActiveStrengthSession {
  return mapExercise(session, exerciseId, exercise => ({
    ...exercise,
    setEntries: [...exercise.setEntries, { id: generateSetId(), completed: false, ...template }],
  }));
}

export function duplicateSet(session: ActiveStrengthSession, exerciseId: string, setId: string): ActiveStrengthSession {
  return mapExercise(session, exerciseId, exercise => {
    const source = exercise.setEntries.find(entry => entry.id === setId);
    if (!source) return exercise;
    const index = exercise.setEntries.findIndex(entry => entry.id === setId);
    const clone: ActiveSetEntry = { ...source, id: generateSetId(), completed: false, rpe:undefined, rir:undefined, previousPerformance:source.completed?{reps:source.reps,weight:source.weight,weightUnit:source.weightUnit,rpe:source.rpe,holdSeconds:source.holdSeconds,distanceMeters:source.distanceMeters}:source.previousPerformance };
    const setEntries = [...exercise.setEntries];
    setEntries.splice(index + 1, 0, clone);
    return { ...exercise, setEntries };
  });
}

export function removeSet(session: ActiveStrengthSession, exerciseId: string, setId: string): ActiveStrengthSession {
  return mapExercise(session, exerciseId, exercise => ({
    ...exercise,
    setEntries: exercise.setEntries.filter(entry => entry.id !== setId),
  }));
}

export function editSet(
  session: ActiveStrengthSession,
  exerciseId: string,
  setId: string,
  patch: Partial<Omit<ActiveSetEntry, 'id'>>,
): ActiveStrengthSession {
  return mapExercise(session, exerciseId, exercise => ({
    ...exercise,
    setEntries: exercise.setEntries.map(entry => entry.id === setId ? { ...entry, ...patch } : entry),
  }));
}

export function toggleSetWarmup(session: ActiveStrengthSession, exerciseId: string, setId: string, isWarmup?: boolean): ActiveStrengthSession {
  return mapExercise(session, exerciseId, exercise => ({
    ...exercise,
    setEntries: exercise.setEntries.map(entry => entry.id === setId
      ? { ...entry, isWarmup: isWarmup ?? !entry.isWarmup }
      : entry),
  }));
}

export function toggleSetCompleted(session: ActiveStrengthSession, exerciseId: string, setId: string, completed?: boolean): ActiveStrengthSession {
  return mapExercise(session, exerciseId, exercise => ({
    ...exercise,
    setEntries: exercise.setEntries.map(entry => entry.id === setId
      ? { ...entry, completed: completed ?? !entry.completed }
      : entry),
  }));
}
