import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  ACTIVITY_TYPES,
  type Activity,
  type ActivityMetrics,
} from '../../src/types/activity';
import {
  activityMatchesFilter,
  calculateActivityLoad,
  sanitizeActivityMetrics,
  summarizeActivityLoad,
} from '../../src/utils/activityLoad';

function activity(type: Activity['activityType']): Activity {
  return {
    id: `activity_${type}`,
    activityType: type,
    source: 'manual',
    status: 'completed',
    scheduled: false,
    startTime: 1,
    rpe: 5,
    indoor: false,
    metrics: { durationSeconds: 3600 },
    trainingLoad: calculateActivityLoad({ activityType: type, durationMinutes: 60, rpe: 5 }),
    createdAt: 1,
    updatedAt: 1,
  };
}

test('canonical Activity taxonomy preserves existing types and explicitly supports touring', () => {
  assert.deepEqual(ACTIVITY_TYPES, [
    'running', 'walking', 'cycling', 'indoor_cycling', 'swimming', 'hiking',
    'downhill_skiing', 'cross_country_skiing', 'snowboarding', 'ski_touring', 'snowboard_touring', 'elliptical', 'rowing',
    'stair_climbing', 'hiit', 'mixed_modal', 'strength', 'mobility', 'other',
  ]);
  assert.equal(new Set(ACTIVITY_TYPES).size, ACTIVITY_TYPES.length);
});

test('applicable metrics are retained while irrelevant metrics are removed', () => {
  const allMetrics: ActivityMetrics = {
    durationSeconds: 3600,
    distanceMeters: 10_000,
    elevationGainMeters: 300,
    pace: { averageSecondsPerKilometer: 360 },
    speed: { averageMetersPerSecond: 8 },
    runningDynamics: { averageStrideLengthMeters: 1.1 },
    cyclingPowerWatts: 220,
    swimming: { environment: 'pool', distanceUnit: 'm', laps: 40 },
    mixedModal: { rounds: 5 },
    strength: { sets: 15 },
  };
  const run = sanitizeActivityMetrics('running', allMetrics);
  assert.equal(run.distanceMeters, 10_000);
  assert.ok(run.pace);
  assert.deepEqual(run.speed, { averageMetersPerSecond: 8 });
  assert.deepEqual(run.runningDynamics, { averageStrideLengthMeters: 1.1 });
  assert.equal(run.cyclingPowerWatts, undefined);
  assert.equal(run.swimming, undefined);
  assert.equal(run.strength, undefined);

  const strength = sanitizeActivityMetrics('strength', allMetrics);
  assert.deepEqual(strength.strength, { sets: 15 });
  assert.equal(strength.distanceMeters, undefined);
  assert.equal(strength.pace, undefined);
  assert.equal(strength.runningDynamics, undefined);

  const cycling = sanitizeActivityMetrics('cycling', allMetrics);
  assert.ok(cycling.speed);
  assert.equal(cycling.cyclingPowerWatts, 220);
  assert.equal(cycling.pace, undefined);
  assert.equal(cycling.runningDynamics, undefined);
  for (const type of ['ski_touring', 'snowboard_touring'] as const) {
    const touring = sanitizeActivityMetrics(type, allMetrics);
    assert.ok(touring.speed);
    assert.equal(touring.cyclingPowerWatts, undefined);
    assert.equal(touring.runningDynamics, undefined);
  }
});

test('Activity history filters group indoor cycling, skiing, and mixed-modal work', () => {
  assert.equal(activityMatchesFilter(activity('indoor_cycling'), 'cycling'), true);
  assert.equal(activityMatchesFilter(activity('cross_country_skiing'), 'skiing'), true);
  assert.equal(activityMatchesFilter(activity('ski_touring'), 'skiing'), true);
  assert.equal(activityMatchesFilter(activity('snowboard_touring'), 'skiing'), true);
  assert.equal(activityMatchesFilter(activity('mixed_modal'), 'hiit_mixed'), true);
  assert.equal(activityMatchesFilter(activity('rowing'), 'other'), true);
  assert.equal(activityMatchesFilter(activity('walking'), 'running'), false);
});

test('walking and cross-training load remain isolated from running load', () => {
  const records = [activity('running'), activity('walking'), activity('cycling'), activity('strength')];
  const summary = summarizeActivityLoad(records);
  assert.equal(summary.wholeBody, 1200);
  assert.equal(summary.running, 300);
  assert.equal(summary.walking, 300);
  assert.equal(summary.crossTraining, 300);
  assert.equal(summary.strength, 300);
  assert.equal(summary.durationMinutes, 240);
});
