import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildAdaptivePerformanceModel } from '../../src/utils/adaptivePerformance';
import type { Activity } from '../../src/types/activity';

function activity(id: string, daysAgo: number, overrides: Partial<Activity> = {}): Activity {
  const now = Date.UTC(2026, 7, 10, 12);
  return {
    id,
    activityType: 'running',
    source: 'manual',
    status: 'completed',
    scheduled: false,
    startTime: now - daysAgo * 24 * 60 * 60 * 1000,
    endTime: now - daysAgo * 24 * 60 * 60 * 1000 + 45 * 60 * 1000,
    indoor: false,
    metrics: { durationSeconds: 2700, distanceMeters: 8046.72 },
    trainingLoad: {
      method: 'session_rpe',
      wholeBody: 35,
      running: 35,
      walking: 0,
      strength: 0,
      crossTraining: 0,
      impactBearing: 35,
      nonImpactAerobic: 0,
      confidence: 'moderate',
    },
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

test('Adaptive Performance refuses to score before five completed workouts', () => {
  const model = buildAdaptivePerformanceModel([activity('a', 1), activity('b', 2), activity('c', 3)], Date.UTC(2026, 7, 10, 12));
  assert.equal(model.ready, false);
  assert.equal(model.overallScore, null);
  assert.match(model.caption, /Log 2 more workouts/);
});

test('Adaptive Performance derives dynamic scores from completed activity history', () => {
  const now = Date.UTC(2026, 7, 10, 12);
  const model = buildAdaptivePerformanceModel([
    activity('a', 1, { rpe: 4 }),
    activity('b', 4, { rpe: 8 }),
    activity('c', 8, { activityType: 'strength', metrics: { durationSeconds: 2400 }, rpe: 6 }),
    activity('d', 12, { rpe: 5 }),
    activity('e', 16, { rpe: 7 }),
  ], now);

  assert.equal(model.ready, true);
  assert.equal(typeof model.overallScore, 'number');
  assert.ok(model.metrics.every(metric => typeof metric.explanation === 'string' && !metric.subtitle.includes('VO2max-derived')));
});
