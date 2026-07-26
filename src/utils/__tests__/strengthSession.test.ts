import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  addExercise,
  addSet,
  duplicateSet,
  editSet,
  ensureExerciseShape,
  ensureSessionShape,
  mapEquipmentType,
  removeExercise,
  removeSet,
  reorderExercise,
  skipExercise,
  substituteExercise,
  synthesizeSetEntries,
  toggleSetCompleted,
  toggleSetWarmup,
  type ActiveStrengthExercise,
  type ActiveStrengthSession,
} from '../strengthSession';

function makeExercise(overrides: Partial<ActiveStrengthExercise> = {}): ActiveStrengthExercise {
  return {
    id: overrides.id ?? 'ex1',
    name: overrides.name ?? 'Back Squat',
    sets: overrides.sets ?? 3,
    reps: overrides.reps ?? '8-10',
    equipment: overrides.equipment ?? ['barbell'],
    equipmentType: overrides.equipmentType ?? 'barbell',
    notes: overrides.notes,
    setEntries: overrides.setEntries ?? synthesizeSetEntries(overrides.sets ?? 3, overrides.reps ?? '8-10'),
    substitutedFromId: overrides.substitutedFromId,
    skipped: overrides.skipped,
  };
}

function makeSession(exercises: ActiveStrengthExercise[]): ActiveStrengthSession {
  return {
    workoutId: 'w1',
    workoutName: 'Test Workout',
    plannedDurationMin: 30,
    exercises,
    currentExerciseIndex: 0,
    completedExerciseIds: [],
    rpeByExercise: {},
    loadByExercise: {},
    startedAt: Date.now(),
    pausedAt: null,
    pausedDurationMs: 0,
    status: 'active',
    workoutInstanceId: 'adhoc:1',
  };
}

// ─── mapEquipmentType ───────────────────────────────────────────────────────

test('mapEquipmentType maps recognizable free-text tokens', () => {
  assert.equal(mapEquipmentType(['barbell']), 'barbell');
  assert.equal(mapEquipmentType(['Dumbbells']), 'dumbbell');
  assert.equal(mapEquipmentType(['band']), 'resistance_band');
  assert.equal(mapEquipmentType(['bodyweight']), 'bodyweight');
  assert.equal(mapEquipmentType(['kettlebell']), 'kettlebell');
});

test('mapEquipmentType falls back to other for unknown/empty input', () => {
  assert.equal(mapEquipmentType([]), 'other');
  assert.equal(mapEquipmentType(undefined), 'other');
  assert.equal(mapEquipmentType(['some exotic machine']), 'other');
});

// ─── synthesizeSetEntries / ensureExerciseShape / ensureSessionShape ───────

test('synthesizeSetEntries builds N un-completed sets with parsed reps', () => {
  const entries = synthesizeSetEntries(3, '8-10');
  assert.equal(entries.length, 3);
  for (const entry of entries) {
    assert.equal(entry.completed, false);
    assert.equal(entry.reps, 8);
    assert.ok(entry.id);
  }
});

test('synthesizeSetEntries treats "sec" reps as time-based (holdSeconds, not reps)', () => {
  const entries = synthesizeSetEntries(2, '30 sec');
  assert.equal(entries.length, 2);
  for (const entry of entries) {
    assert.equal(entry.reps, undefined);
    assert.equal(entry.holdSeconds, 30);
  }
});

test('ensureExerciseShape synthesizes setEntries/equipmentType for a legacy exercise, and is a no-op once shaped', () => {
  const legacy = { id: 'ex1', name: 'Push-Up', sets: 2, reps: '10', equipment: ['bodyweight'] };
  const shaped = ensureExerciseShape(legacy);
  assert.equal(shaped.setEntries.length, 2);
  assert.equal(shaped.equipmentType, 'bodyweight');

  const reshaped = ensureExerciseShape(shaped);
  assert.equal(reshaped.setEntries.length, 2);
  assert.deepEqual(reshaped.setEntries, shaped.setEntries);
});

test('ensureSessionShape maps ensureExerciseShape across every exercise', () => {
  const session = { exercises: [{ id: 'a', name: 'A', sets: 1, reps: '5', equipment: [] }] };
  const shaped = ensureSessionShape(session);
  assert.equal(shaped.exercises[0].setEntries.length, 1);
  assert.equal(shaped.exercises[0].equipmentType, 'other');
});

// ─── Exercise-level ops ─────────────────────────────────────────────────────

test('addExercise appends a freeform exercise with a seeded first set', () => {
  const session = makeSession([]);
  const next = addExercise(session, { name: 'Goblet Squat', equipmentType: 'kettlebell' });
  assert.equal(next.exercises.length, 1);
  assert.equal(next.exercises[0].name, 'Goblet Squat');
  assert.equal(next.exercises[0].equipmentType, 'kettlebell');
  assert.equal(next.exercises[0].setEntries.length, 1);
  assert.equal(next.exercises[0].setEntries[0].completed, false);
});

test('addExercise infers equipmentType from equipment[] when not given explicitly', () => {
  const session = makeSession([]);
  const next = addExercise(session, { name: 'Curl', equipment: ['dumbbell'] });
  assert.equal(next.exercises[0].equipmentType, 'dumbbell');
});

test('removeExercise drops the exercise and clears it from completedExerciseIds', () => {
  const session = { ...makeSession([makeExercise({ id: 'ex1' })]), completedExerciseIds: ['ex1'] };
  const next = removeExercise(session, 'ex1');
  assert.equal(next.exercises.length, 0);
  assert.equal(next.completedExerciseIds.length, 0);
});

test('removeExercise is a no-op for an unknown id', () => {
  const session = makeSession([makeExercise({ id: 'ex1' })]);
  const next = removeExercise(session, 'nope');
  assert.equal(next, session);
});

test('reorderExercise swaps adjacent exercises and no-ops at the boundaries', () => {
  const session = makeSession([makeExercise({ id: 'a' }), makeExercise({ id: 'b' }), makeExercise({ id: 'c' })]);
  const moved = reorderExercise(session, 'b', 'up');
  assert.deepEqual(moved.exercises.map(e => e.id), ['b', 'a', 'c']);

  const atTop = reorderExercise(session, 'a', 'up');
  assert.deepEqual(atTop.exercises.map(e => e.id), ['a', 'b', 'c']);

  const atBottom = reorderExercise(session, 'c', 'down');
  assert.deepEqual(atBottom.exercises.map(e => e.id), ['a', 'b', 'c']);
});

test('substituteExercise replaces the prescribed exercise at the same position and records substitutedFromId', () => {
  const session = makeSession([makeExercise({ id: 'ex1', name: 'Back Squat' }), makeExercise({ id: 'ex2', name: 'Bench Press' })]);
  const next = substituteExercise(session, 'ex1', { name: 'Goblet Squat', equipmentType: 'kettlebell' });
  assert.equal(next.exercises.length, 2);
  assert.equal(next.exercises[0].name, 'Goblet Squat');
  assert.equal(next.exercises[0].substitutedFromId, 'ex1');
  assert.equal(next.exercises[1].id, 'ex2'); // position preserved
});

test('substituteExercise never mutates the original prescribed sets/reps — it replaces the entry entirely', () => {
  const session = makeSession([makeExercise({ id: 'ex1', sets: 5, reps: '5' })]);
  const next = substituteExercise(session, 'ex1', { name: 'Lunge' });
  assert.notEqual(next.exercises[0].id, 'ex1');
  assert.equal(next.exercises[0].sets, 0); // fresh exercise, not the prescribed 5x5
});

test('skipExercise marks skipped without deleting, and can be un-skipped', () => {
  const session = makeSession([makeExercise({ id: 'ex1' })]);
  const skipped = skipExercise(session, 'ex1');
  assert.equal(skipped.exercises[0].skipped, true);
  assert.equal(skipped.exercises.length, 1);

  const unskipped = skipExercise(skipped, 'ex1', false);
  assert.equal(unskipped.exercises[0].skipped, false);
});

// ─── Set-level ops ───────────────────────────────────────────────────────────

test('addSet appends an un-completed set, optionally seeded from a template', () => {
  const session = makeSession([makeExercise({ id: 'ex1', sets: 1 })]);
  const next = addSet(session, 'ex1', { reps: 12 });
  assert.equal(next.exercises[0].setEntries.length, 2);
  assert.equal(next.exercises[0].setEntries[1].reps, 12);
  assert.equal(next.exercises[0].setEntries[1].completed, false);
});

test('duplicateSet clones a set immediately after it, reset to un-completed', () => {
  const session = makeSession([makeExercise({ id: 'ex1', sets: 1 })]);
  const setId = session.exercises[0].setEntries[0].id;
  const completed = editSet(session, 'ex1', setId, { completed: true, weight: 135, weightUnit: 'lb' });
  const next = duplicateSet(completed, 'ex1', setId);
  assert.equal(next.exercises[0].setEntries.length, 2);
  assert.equal(next.exercises[0].setEntries[1].weight, 135);
  assert.equal(next.exercises[0].setEntries[1].completed, false);
  assert.notEqual(next.exercises[0].setEntries[1].id, setId);
});

test('removeSet drops exactly the targeted set', () => {
  const session = makeSession([makeExercise({ id: 'ex1', sets: 2 })]);
  const [first, second] = session.exercises[0].setEntries;
  const next = removeSet(session, 'ex1', first.id);
  assert.equal(next.exercises[0].setEntries.length, 1);
  assert.equal(next.exercises[0].setEntries[0].id, second.id);
});

test('editSet patches only the targeted set', () => {
  const session = makeSession([makeExercise({ id: 'ex1', sets: 2 })]);
  const [first] = session.exercises[0].setEntries;
  const next = editSet(session, 'ex1', first.id, { weight: 45, weightUnit: 'lb', rpe: 7 });
  assert.equal(next.exercises[0].setEntries[0].weight, 45);
  assert.equal(next.exercises[0].setEntries[0].weightUnit, 'lb');
  assert.equal(next.exercises[0].setEntries[0].rpe, 7);
  assert.equal(next.exercises[0].setEntries[1].weight, undefined);
});

test('toggleSetWarmup flips (or sets explicitly) the warm-up flag', () => {
  const session = makeSession([makeExercise({ id: 'ex1', sets: 1 })]);
  const setId = session.exercises[0].setEntries[0].id;
  const flagged = toggleSetWarmup(session, 'ex1', setId);
  assert.equal(flagged.exercises[0].setEntries[0].isWarmup, true);
  const explicit = toggleSetWarmup(flagged, 'ex1', setId, false);
  assert.equal(explicit.exercises[0].setEntries[0].isWarmup, false);
});

test('toggleSetCompleted flips (or sets explicitly) completion', () => {
  const session = makeSession([makeExercise({ id: 'ex1', sets: 1 })]);
  const setId = session.exercises[0].setEntries[0].id;
  const done = toggleSetCompleted(session, 'ex1', setId);
  assert.equal(done.exercises[0].setEntries[0].completed, true);
  const undone = toggleSetCompleted(done, 'ex1', setId, false);
  assert.equal(undone.exercises[0].setEntries[0].completed, false);
});

test('set ops on an unknown exerciseId are a safe no-op', () => {
  const session = makeSession([makeExercise({ id: 'ex1', sets: 1 })]);
  const next = addSet(session, 'nope');
  assert.equal(next, session);
});
