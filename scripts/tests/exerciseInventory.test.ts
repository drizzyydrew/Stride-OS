import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { presetExerciseId, STRENGTH_PRESET_WORKOUTS } from '../../src/constants/strengthBank';
import { MOBILITY_EXERCISES, MOBILITY_WORKOUTS } from '../../src/constants/mobilityBank';
import { STRENGTH_EXERCISES } from '../../src/utils/strengthEngine';

type Inventory = {
  count: number;
  entries: Array<{ canonicalId: string; canonicalName: string; ids: string[]; aliases: string[] }>;
};

const inventory = JSON.parse(readFileSync(resolve(process.cwd(), 'docs/exercise-library-inventory.json'), 'utf8')) as Inventory;

test('exercise inventory canonical IDs and names are unique', () => {
  assert.equal(new Set(inventory.entries.map(entry => entry.canonicalId)).size, inventory.entries.length);
  assert.equal(new Set(inventory.entries.map(entry => entry.canonicalName.toLowerCase())).size, inventory.entries.length);
  assert.equal(inventory.count, inventory.entries.length);
});

test('every mobility workout exercise resolves into the inventory', () => {
  const inventoryIds = new Set(inventory.entries.flatMap(entry => entry.ids));
  const mobilityIds = new Set(MOBILITY_EXERCISES.map(exercise => exercise.id));
  for (const workout of MOBILITY_WORKOUTS) {
    for (const { exerciseId } of workout.exercises) {
      assert.ok(mobilityIds.has(exerciseId), `${workout.id} references missing mobility exercise ${exerciseId}`);
      assert.ok(inventoryIds.has(exerciseId), `inventory is missing mobility exercise ${exerciseId}`);
    }
  }
});

test('every strength preset exercise reference is represented', () => {
  const inventoryIds = new Set(inventory.entries.flatMap(entry => entry.ids));
  for (const workout of STRENGTH_PRESET_WORKOUTS) {
    for (const exercise of workout.exercises) {
      const derived = presetExerciseId(workout.id, exercise.name);
      assert.ok(inventoryIds.has(derived), `inventory is missing ${workout.id} / ${exercise.name}`);
    }
  }
});

test('every Training Block and built-in exercise-library ID is represented', () => {
  const inventoryIds = new Set(inventory.entries.flatMap(entry => entry.ids));
  for (const exercise of Object.values(STRENGTH_EXERCISES)) {
    assert.ok(inventoryIds.has(exercise.id), `inventory is missing Training Block exercise ${exercise.id}`);
  }

  const storeSource = readFileSync(resolve(process.cwd(), 'src/store/exerciseStore.ts'), 'utf8');
  const builtInIds = [...storeSource.matchAll(/\{ id: '(b_[^']+)'/g)].map(match => match[1]);
  assert.ok(builtInIds.length > 40, 'expected the full built-in exercise library');
  for (const id of builtInIds) assert.ok(inventoryIds.has(id), `inventory is missing built-in exercise ${id}`);
});
