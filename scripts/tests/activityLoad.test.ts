import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Activity } from '../../src/types/activity';
import {
  calculateActivityLoad,
  calculateActivityLoadTrend,
  summarizeActivityDistribution,
} from '../../src/utils/activityLoad';

test('session-RPE is the preferred whole-body load method', () => {
  const load = calculateActivityLoad({
    activityType: 'cycling',
    durationMinutes: 45,
    rpe: 7,
    heartRateZoneMinutes: { 2: 45 },
  });
  assert.equal(load.method, 'session_rpe');
  assert.equal(load.wholeBody, 315);
  assert.equal(load.crossTraining, 315);
  assert.equal(load.nonImpactAerobic, 315);
  assert.equal(load.running, 0);
});

test('heart-rate-zone load is used when session RPE is unavailable', () => {
  const load = calculateActivityLoad({
    activityType: 'walking',
    durationMinutes: 60,
    heartRateZoneMinutes: { 1: 10, 2: 40, 3: 10 },
  });
  assert.equal(load.method, 'heart_rate_zones');
  assert.equal(load.wholeBody, 120);
  assert.equal(load.walking, 120);
  assert.equal(load.running, 0);
});

test('activity-specific fallback load does not convert distance to running mileage', () => {
  const shortRide = calculateActivityLoad({ activityType: 'cycling', durationMinutes: 30 });
  const longRideSameDuration = calculateActivityLoad({ activityType: 'cycling', durationMinutes: 30 });
  assert.deepEqual(shortRide, longRideSameDuration);
  assert.equal(shortRide.running, 0);
  assert.equal(shortRide.impactBearing, 0);
});

test('strength contributes to total and strength load but not aerobic dimensions', () => {
  const load = calculateActivityLoad({ activityType: 'strength', durationMinutes: 50, rpe: 6 });
  assert.equal(load.wholeBody, 300);
  assert.equal(load.strength, 300);
  assert.equal(load.running, 0);
  assert.equal(load.crossTraining, 0);
  assert.equal(load.nonImpactAerobic, 0);
});

function record(type: Activity['activityType'], startTime: number, load: number): Activity {
  return {
    id: `${type}_${startTime}`,
    activityType: type,
    source: 'manual',
    status: 'completed',
    scheduled: false,
    startTime,
    indoor: false,
    metrics: { durationSeconds: 1800 },
    trainingLoad: {
      method: 'session_rpe',
      wholeBody: load,
      running: type === 'running' ? load : 0,
      walking: type === 'walking' ? load : 0,
      strength: type === 'strength' ? load : 0,
      crossTraining: type === 'cycling' ? load : 0,
      impactBearing: type === 'cycling' ? 0 : load,
      nonImpactAerobic: type === 'cycling' ? load : 0,
      confidence: 'high',
    },
    createdAt: startTime,
    updatedAt: startTime,
  };
}

test('load trends can be queried independently for total, running, and cross-training', () => {
  const now = Date.UTC(2026, 6, 16);
  const activities = [
    record('running', now - 2 * 86_400_000, 140),
    record('cycling', now - 3 * 86_400_000, 210),
    record('running', now - 20 * 86_400_000, 280),
  ];
  const total = calculateActivityLoadTrend(activities, 'wholeBody', now);
  const running = calculateActivityLoadTrend(activities, 'running', now);
  const cross = calculateActivityLoadTrend(activities, 'crossTraining', now);
  assert.ok(total.acute > running.acute);
  assert.equal(cross.acute, 30);
  assert.equal(cross.interpretation, 'workload_trend_only');
  assert.equal(running.dimension, 'running');
});

test('weekly activity distribution reports duration by activity without mileage conversion', () => {
  const summary = summarizeActivityDistribution([
    record('running', 1, 10),
    record('walking', 2, 10),
    record('cycling', 3, 10),
  ]);
  assert.equal(summary.totalDurationMinutes, 90);
  assert.equal(summary.durationMinutesByType.cycling, 30);
  assert.equal(summary.countByType.walking, 1);
});
