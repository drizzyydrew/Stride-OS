import assert from 'node:assert/strict';
import { test } from 'node:test';

import { MOBILITY_WORKOUTS } from '../../src/constants/mobilityBank';
import { STRENGTH_PRESET_WORKOUTS } from '../../src/constants/strengthBank';

test('mobility bank contains 50 stable, usable workouts', () => {
  assert.equal(MOBILITY_WORKOUTS.length, 50);
  assert.equal(new Set(MOBILITY_WORKOUTS.map(item => item.id)).size, 50);
  assert.equal(MOBILITY_WORKOUTS.every(item => item.exercises.length > 0), true);
});

test('strength bank contains 50 presets with at least 15 gym/barbell options', () => {
  assert.equal(STRENGTH_PRESET_WORKOUTS.length, 50);
  assert.equal(new Set(STRENGTH_PRESET_WORKOUTS.map(item => item.id)).size, 50);
  assert.equal(STRENGTH_PRESET_WORKOUTS.every(item => item.exercises.length > 0), true);
  assert.ok(STRENGTH_PRESET_WORKOUTS.filter(item => item.categories.includes('gym_barbell')).length >= 15);
});
