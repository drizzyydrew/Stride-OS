import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Activity, ActivityType } from '../../src/types/activity';
import {
  findActivityBySupportedId,
  resolveActivityDetail,
} from '../../src/utils/activityResolution';

function activity(id: string, activityType: ActivityType, legacyWorkoutId?: string): Activity {
  return {
    id,
    activityType,
    subtype: 'general',
    source: legacyWorkoutId ? 'legacy_import' : 'manual',
    status: 'completed',
    scheduled: false,
    startTime: 1_700_000_000_000,
    indoor: activityType === 'strength',
    metrics: { durationSeconds: 1_800 },
    trainingLoad: {
      method: 'session_rpe',
      wholeBody: 120,
      running: activityType === 'running' ? 120 : 0,
      walking: activityType === 'walking' ? 120 : 0,
      strength: activityType === 'strength' ? 120 : 0,
      crossTraining: activityType === 'cycling' ? 120 : 0,
      impactBearing: activityType === 'running' ? 120 : 0,
      nonImpactAerobic: activityType === 'cycling' ? 120 : 0,
      confidence: 'high',
    },
    legacyWorkoutId,
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_000_000,
  };
}

const activities = [
  activity('activity_workout_run_1', 'running', 'run_1'),
  activity('activity_strength_strength_1', 'strength', 'strength_1'),
  activity('cycling_1', 'cycling'),
];

test('Activity detail resolves canonical, legacy run, strength, and cross-training IDs', () => {
  assert.equal(findActivityBySupportedId(activities, 'activity_workout_run_1')?.id, 'activity_workout_run_1');
  assert.equal(findActivityBySupportedId(activities, 'run--run_1')?.id, 'activity_workout_run_1');
  assert.equal(findActivityBySupportedId(activities, 'run_1')?.id, 'activity_workout_run_1');
  assert.equal(findActivityBySupportedId(activities, 'strength--strength_1')?.id, 'activity_strength_strength_1');
  assert.equal(findActivityBySupportedId(activities, 'cycling_1')?.activityType, 'cycling');
});

test('temporarily unhydrated Activity detail remains loading instead of showing an error', () => {
  assert.deepEqual(resolveActivityDetail([], 'run--run_1', 'loading'), { status: 'loading' });
  assert.equal(resolveActivityDetail(activities, 'run--run_1', 'loading').status, 'resolved');
});

test('missing and invalid IDs return the designed unavailable state only when appropriate', () => {
  assert.deepEqual(resolveActivityDetail(activities, undefined, 'loading'), { status: 'unavailable' });
  assert.deepEqual(resolveActivityDetail(activities, '', 'ready'), { status: 'unavailable' });
  assert.deepEqual(resolveActivityDetail(activities, 'missing', 'ready'), { status: 'unavailable' });
  assert.deepEqual(resolveActivityDetail(activities, 'missing', 'error'), { status: 'unavailable' });
});
