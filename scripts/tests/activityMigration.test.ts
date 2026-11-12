import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { CompletedWorkoutRecord } from '../../src/types/training';
import type { RunWorkoutRecord } from '../../src/utils/runCompletionIdentity';
import { sanitizeActivityMetrics } from '../../src/utils/activityLoad';
import {
  activityFromMobilityCompletion,
  activityFromStrengthRecord,
  activityFromWorkoutRecord,
  migrateLegacyMobilityHistory,
  migrateLegacyStrengthHistory,
  migrateLegacyWorkoutHistory,
} from '../../src/utils/activityMigration';

function legacy(overrides: Partial<CompletedWorkoutRecord> = {}): CompletedWorkoutRecord {
  return {
    id: 'w1_easy_run_0',
    workoutId: 'easy_run',
    type: 'easy_run',
    intensity: 'easy',
    durationMinutes: 30,
    estimatedLoad: 21,
    estimatedDistanceMiles: 3,
    timestamp: 1_700_000_000_000,
    week: 1,
    completed: true,
    fatigueBefore: 20,
    fatigueAfter: 25,
    fatigueDelta: 5,
    recoveryBefore: 80,
    recoveryDelta: -2,
    source: 'generated',
    ...overrides,
  };
}

test('legacy running history migrates to stable Activity IDs and preserves routes', () => {
  const migrated = activityFromWorkoutRecord(legacy({
    routeCoordinates: [{ lat: 47.6, lng: -122.3, timestamp: 100 }],
  }));
  assert.equal(migrated.id, 'activity_workout_w1_easy_run_0');
  assert.equal(migrated.activityType, 'running');
  assert.equal(migrated.source, 'legacy_import');
  assert.ok((migrated.metrics.distanceMeters ?? 0) > 4_800);
  assert.deepEqual(migrated.metrics.routeCoordinates?.[0], {
    latitude: 47.6,
    longitude: -122.3,
    timestamp: 100,
    altitudeMeters: undefined,
  });
});

test('running route migration preserves observed accuracy and leaves missing or invalid quality absent', () => {
  const accuracyValues = [0, 7.5, undefined, -1, NaN, Infinity];
  const record = legacy({ routeCoordinates: accuracyValues.map((horizontalAccuracyMeters, index) => ({
    lat: 47.6, lng: -122.3 + index * 0.0001, timestamp: index * 1000,
    ...(horizontalAccuracyMeters !== undefined ? { horizontalAccuracyMeters } : {}),
  })) });
  const migrated = activityFromWorkoutRecord(record);
  const originalIdentity = activityFromWorkoutRecord({ ...record, routeCoordinates: undefined });
  const points = migrated.metrics.routeCoordinates!;
  assert.equal(points[0].horizontalAccuracyMeters, 0, 'an observed zero is not missing');
  assert.equal(points[1].horizontalAccuracyMeters, 7.5);
  for (const point of points.slice(2)) assert.equal(Object.hasOwn(point, 'horizontalAccuracyMeters'), false);
  assert.equal(migrated.id, originalIdentity.id);
  assert.equal(migrated.startTime, originalIdentity.startTime);
  assert.equal(migrated.endTime, originalIdentity.endTime);
  assert.equal(migrated.metrics.distanceMeters, originalIdentity.metrics.distanceMeters);
});

test('only a real saved start/end pair establishes recorded wall-clock elapsed including pauses', () => {
  const start = 1_700_000_000_000;
  const end = start + 600_000;
  const pauses = [{ startTime: start + 240_000, endTime: start + 360_000 }];
  const record: RunWorkoutRecord = { ...legacy({ durationMinutes: 8 }),
    actualStartTime: start, actualEndTime: end, workoutInstanceId: 'wall-clock-run',
    activityMetrics: { recordingPauses: pauses, metricSources: {} } };
  const migrated = activityFromWorkoutRecord(record, false);
  assert.equal(migrated.startTime, start); assert.equal(migrated.endTime, end);
  assert.equal(migrated.metrics.elapsedTimeSeconds, 600);
  assert.equal(migrated.metrics.activeTimeSeconds, 480);
  assert.equal(migrated.metrics.elapsedTimeSource, 'recorded_wall_clock');
  assert.deepEqual(migrated.metrics.recordingPauses, pauses);
  const sanitized = sanitizeActivityMetrics('running', migrated.metrics);
  assert.equal(sanitized.elapsedTimeSource, 'recorded_wall_clock');
  assert.equal(sanitized.elapsedTimeSeconds, 600);
  assert.deepEqual(sanitized.recordingPauses, pauses);
});

test('synthesized legacy elapsed and incomplete or invalid actual-time pairs do not acquire a recorded wall-clock marker', () => {
  const start = 1_700_000_000_000;
  const cases: Partial<RunWorkoutRecord>[] = [
    {}, { actualStartTime: start }, { actualEndTime: start + 600_000 },
    { actualStartTime: start, actualEndTime: start - 1000 },
    { actualStartTime: NaN, actualEndTime: start + 600_000 },
  ];
  for (const overrides of cases) {
    const migrated = activityFromWorkoutRecord({ ...legacy({ durationMinutes: 10 }), ...overrides });
    assert.equal(Object.hasOwn(migrated.metrics, 'elapsedTimeSource'), false, JSON.stringify(overrides));
  }
  const synthesized = activityFromWorkoutRecord(legacy({ durationMinutes: 10 }));
  assert.equal(synthesized.metrics.elapsedTimeSeconds, 600);
  assert.equal(synthesized.endTime, start + 600_000);
  assert.equal(Object.hasOwn(sanitizeActivityMetrics('running', synthesized.metrics), 'elapsedTimeSource'), false);
  const claimed = activityFromWorkoutRecord(legacy({ activityMetrics: { elapsedTimeSource: 'recorded_wall_clock' } }));
  assert.equal(Object.hasOwn(claimed.metrics, 'elapsedTimeSource'), false,
    'a legacy marker cannot replace the missing actual start/end pair');
});

test('legacy cross-training cannot leak estimated running distance', () => {
  const migrated = activityFromWorkoutRecord(legacy({
    id: 'cross',
    workoutId: 'cross_training',
    type: 'cross_training',
    estimatedDistanceMiles: 25,
  }));
  assert.equal(migrated.activityType, 'other');
  assert.equal(migrated.metrics.distanceMeters, undefined);
  assert.equal(migrated.trainingLoad.running, 0);
});

test('legacy migration is idempotent and supports partially populated optional data', () => {
  const record = legacy({ rpe: undefined, routeCoordinates: undefined });
  const once = migrateLegacyWorkoutHistory([record]);
  const twice = migrateLegacyWorkoutHistory([record], once);
  assert.equal(once.length, 1);
  assert.equal(twice.length, 1);
  assert.equal(twice[0].id, once[0].id);
});

test('strength history becomes strength Activity without running metric leakage', () => {
  const strength = activityFromStrengthRecord({
    id: 'strength_1',
    sessionId: 'full_body_1',
    sessionType: 'full_body',
    goal: 'maintenance',
    week: 2,
    timestamp: 1_700_000_000_000,
    completed: true,
    plannedDuration: 45,
    actualDuration: 50,
    exercises: [{
      exerciseId: 'squat',
      sets: [
        { reps: 8, completed: true },
        { reps: 8, completed: true },
      ],
    }],
    overallRpe: 7,
    source: 'preset',
    fatigueBefore: 20,
    fatigueAfter: 25,
    fatigueDelta: 5,
    estimatedLoad: 80,
  });
  assert.equal(strength.activityType, 'strength');
  assert.equal(strength.trainingLoad.strength, 350);
  assert.equal(strength.trainingLoad.running, 0);
  assert.deepEqual(strength.metrics.strength, {
    exerciseCount: 1,
    sets: 2,
    reps: 16,
  });
  assert.equal(migrateLegacyStrengthHistory([], [strength]).length, 1);
});

test('mobility history remains a low-load Activity and migrates idempotently', () => {
  const completion = {
    id: 'mob_1',
    workoutId: 'ankle_mobility',
    completedAt: 1_700_000_000_000,
    durationMin: 15,
    feedback: 'right' as const,
  };
  const mobility = activityFromMobilityCompletion(completion);
  const once = migrateLegacyMobilityHistory([completion]);
  const twice = migrateLegacyMobilityHistory([completion], once);
  assert.equal(mobility.activityType, 'mobility');
  assert.equal(mobility.trainingLoad.wholeBody, 60);
  assert.equal(mobility.trainingLoad.running, 0);
  assert.equal(twice.length, 1);
});
