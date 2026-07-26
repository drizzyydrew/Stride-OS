import assert from 'node:assert/strict';
import test from 'node:test';

import { completedExercisesFromActiveSession } from '../strengthPersistence';
import type { ActiveStrengthExercise } from '../strengthSession';

const exercises: ActiveStrengthExercise[] = [
  {
    id: 'prescribed', name: 'Split Squat', sets: 2, reps: '8', equipment: ['dumbbell'], equipmentType: 'dumbbell',
    setEntries: [
      { id: 'a', reps: 8, weight: 30, weightUnit: 'lb', rpe: 7, isWarmup: true, completed: true },
      { id: 'b', reps: 8, weight: 35, weightUnit: 'lb', rpe: 8, completed: true },
    ],
  },
  {
    id: 'replacement', name: 'Step-Up', sets: 1, reps: '10', equipment: ['band'], equipmentType: 'resistance_band',
    substitutedFromId: 'prescribed_lunge',
    setEntries: [{ id: 'c', reps: 10, bandLevel: 'medium', holdSeconds: 2, completed: true }],
  },
  {
    id: 'skipped', name: 'Calf Raise', sets: 1, reps: '12', equipment: [], equipmentType: 'bodyweight', skipped: true,
    setEntries: [{ id: 'd', reps: 12, completed: true }],
  },
];

test('strength persistence retains exact per-set execution and exercise audit fields', () => {
  const persisted = completedExercisesFromActiveSession(exercises, 'custom', [], { prescribed: 6 });
  assert.equal(persisted[0].sets[0].weight, 30);
  assert.equal(persisted[0].sets[0].weightUnit, 'lb');
  assert.equal(persisted[0].sets[0].isWarmup, true);
  assert.equal(persisted[1].substitutedFromExerciseId, 'prescribed_lunge');
  assert.equal(persisted[1].added, undefined);
  assert.equal(persisted[1].sets[0].bandLevel, 'medium');
  assert.equal(persisted[1].sets[0].holdSeconds, 2);
  assert.equal(persisted[2].skipped, true);
  assert.equal(persisted[2].sets[0].completed, false);
});

test('preset/training-block completion applies deliberate exercise completion without inventing a load', () => {
  const persisted = completedExercisesFromActiveSession([exercises[0]], 'preset', ['prescribed'], { prescribed: 8 });
  assert.equal(persisted[0].sets[0].completed, true);
  assert.equal(persisted[0].sets[0].rpe, 7); // set-level value wins
  assert.equal(persisted[0].sets[0].load, undefined);
});
