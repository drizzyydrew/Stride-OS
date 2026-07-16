import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  DEFAULT_TRAINING_PREFERENCES,
  migrateTrainingPreferencesState,
} from '../../src/utils/trainingPreferences';

test('legacy users default to running with cross-training disabled', () => {
  assert.deepEqual(migrateTrainingPreferencesState(undefined), DEFAULT_TRAINING_PREFERENCES);
});

test('partial preference migrations are backward compatible and idempotent', () => {
  const partial = {
    crossTrainingDecision: 'yes' as const,
    crossTrainingFrequencyPerWeek: 2,
    crossTrainingActivities: [{
      activityType: 'swimming' as const,
      preferredDays: [2, 5],
      equipment: ['pool'],
      setting: 'indoor' as const,
      typicalDurationMinutes: 45,
      experienceLevel: 'some_experience' as const,
      use: 'replace_easy_aerobic' as const,
    }],
    primaryEnduranceMode: 'run_walk' as const,
  };
  const once = migrateTrainingPreferencesState(partial);
  const twice = migrateTrainingPreferencesState(once);
  assert.deepEqual(twice, once);
  assert.equal(once.crossTrainingDecision, 'yes');
  assert.equal(once.crossTrainingActivities[0].activityType, 'swimming');
  assert.deepEqual(once.crossTrainingPurpose, []);
});

test('cross-training frequency migration preserves supported values and normalizes unsafe values', () => {
  assert.equal(migrateTrainingPreferencesState({
    crossTrainingDecision: 'yes',
    crossTrainingFrequencyPerWeek: 4,
  }).crossTrainingFrequencyPerWeek, 4);
  assert.equal(migrateTrainingPreferencesState({
    crossTrainingDecision: 'yes',
    crossTrainingFrequencyPerWeek: 12,
  }).crossTrainingFrequencyPerWeek, 4);
  assert.equal(migrateTrainingPreferencesState({
    crossTrainingDecision: 'yes',
    crossTrainingFrequencyPerWeek: 0,
  }).crossTrainingFrequencyPerWeek, 2);
  assert.equal(migrateTrainingPreferencesState({
    crossTrainingDecision: 'no',
    crossTrainingFrequencyPerWeek: 3,
  }).crossTrainingFrequencyPerWeek, 3);
});
