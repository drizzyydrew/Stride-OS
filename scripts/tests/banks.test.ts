import assert from 'node:assert/strict';
import { test } from 'node:test';

import { MOBILITY_WORKOUTS } from '../../src/constants/mobilityBank';
import { STRENGTH_PRESET_WORKOUTS } from '../../src/constants/strengthBank';

test('mobility bank retains the original 50 plus activity-specific usable workouts', () => {
  assert.ok(MOBILITY_WORKOUTS.length >= 60);
  assert.equal(new Set(MOBILITY_WORKOUTS.map(item => item.id)).size, MOBILITY_WORKOUTS.length);
  assert.equal(MOBILITY_WORKOUTS.every(item => item.exercises.length > 0), true);
});

test('strength bank retains at least 50 presets with at least 15 gym/barbell options', () => {
  assert.ok(STRENGTH_PRESET_WORKOUTS.length >= 58);
  assert.equal(new Set(STRENGTH_PRESET_WORKOUTS.map(item => item.id)).size, STRENGTH_PRESET_WORKOUTS.length);
  assert.equal(STRENGTH_PRESET_WORKOUTS.every(item => item.exercises.length > 0), true);
  assert.ok(STRENGTH_PRESET_WORKOUTS.filter(item => item.categories.includes('gym_barbell')).length >= 15);
});
