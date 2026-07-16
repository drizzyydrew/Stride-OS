import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

import { STRENGTH_PRESET_WORKOUTS, presetExerciseId } from '../../src/constants/strengthBank';

test('preset exercise identifiers are stable and unique within every workout', () => {
  for (const workout of STRENGTH_PRESET_WORKOUTS) {
    const ids = workout.exercises.map(exercise => presetExerciseId(workout.id, exercise.name));
    assert.equal(new Set(ids).size, ids.length);
    assert.ok(ids.every(id => id.startsWith(`${workout.id}_`)));
  }
});

test('preset workouts use detail, persistent active-session, completion, history, and Live Activity flows', () => {
  const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');
  const library = read('app/(tabs)/strength/index.tsx');
  const detail = read('app/(tabs)/strength/preset/[id].tsx');
  const session = read('app/(tabs)/strength/preset-session.tsx');
  const completion = read('app/(tabs)/strength/preset-complete.tsx');
  const activeStore = read('src/store/activeStrengthSessionStore.ts');
  assert.match(library, /View Preset Details/);
  assert.match(detail, /Start .*title|startSession/);
  assert.match(session, /Complete Exercise/);
  assert.match(session, /Save and Finish/);
  assert.match(session, /source: 'preset'/);
  assert.match(session, /updateStrengthLiveActivity/);
  assert.match(library, /source: 'training_block'/);
  assert.match(library, /Another strength session is active/);
  assert.match(detail, /active\.source === 'preset'/);
  assert.match(activeStore, /ActiveStrengthSource = 'training_block' \| 'preset'/);
  assert.match(detail, /WHAT IT SHOULD FEEL LIKE/);
  assert.match(session, /Warm-Up/);
  assert.match(completion, /Session feedback/);
  assert.doesNotMatch(library, /Finish & Log/);
});
