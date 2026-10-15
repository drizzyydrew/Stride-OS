import assert from 'node:assert/strict';
import Module from 'node:module';
import test from 'node:test';
import { buildHealthKitActivityDraft } from '../../src/utils/healthKitImport';
import type { Activity } from '../../src/types/activity';
import type { CompletedWorkoutRecord } from '../../src/types/training';

test('HealthKit adapter writes and reads exact recording metadata through the public query', async () => {
  const saved: { uuid: string; workoutActivityType: number; startDate: Date; endDate: Date; metadata: Record<string, unknown> }[] = [];
  const health = {
    isHealthDataAvailable: () => true,
    WorkoutActivityType: { running: 37 },
    saveWorkoutSample: async (workoutActivityType: number, _quantities: unknown[], startDate: Date, endDate: Date,
      _totals: unknown, metadata: Record<string, unknown>) => {
      saved.push({ uuid: `health-${saved.length}`, workoutActivityType, startDate, endDate, metadata });
      return {};
    },
    queryWorkoutSamples: async () => saved,
  };
  const loader = Module as unknown as { _load: (id: string, ...args: unknown[]) => unknown };
  const originalLoad = loader._load;
  let adapter: typeof import('../../src/lib/healthKit');
  loader._load = function (id, ...args) {
    if (id === 'react-native') return { Platform: { OS: 'ios', Version: '17.0' } };
    if (id === '@kingstinct/react-native-healthkit') return health;
    return originalLoad.call(this, id, ...args);
  };
  try {
    adapter = require('../../src/lib/healthKit');
  } finally {
    loader._load = originalLoad;
  }
  await adapter.writeWorkout({ id: 'workout/exact', workoutInstanceId: 'recording/exact',
    timestamp: 60_001, durationMinutes: 1, actualDistanceMiles: 1 } as CompletedWorkoutRecord & { workoutInstanceId: string });
  await adapter.writeActivityToHealth({ id: 'activity/exact', legacyWorkoutId: 'workout/exact',
    workoutInstanceId: 'recording/exact', activityType: 'running', startTime: 1, endTime: 60_001,
    metrics: { durationSeconds: 60 } } as Activity);
  assert.equal(saved[0]?.metadata.StrideOSWorkoutId, 'workout/exact');
  assert.equal(saved[0]?.metadata.StrideOSWorkoutInstanceId, 'recording/exact');
  assert.equal(saved[1]?.metadata.StrideOSActivityId, 'activity/exact');
  assert.equal(saved[1]?.metadata.StrideOSWorkoutId, 'workout/exact');
  assert.equal(saved[1]?.metadata.StrideOSWorkoutInstanceId, 'recording/exact');
  const candidates = await adapter.getRecentHealthKitWorkoutCandidates();
  assert.equal(candidates.length, 2);
  for (const candidate of candidates) {
    assert.equal(candidate.workoutInstanceId, 'recording/exact');
    assert.equal(candidate.strideOSWorkoutId, 'workout/exact');
    const draft = buildHealthKitActivityDraft({ candidate });
    assert.equal(draft.workoutInstanceId, 'recording/exact');
    assert.equal(draft.healthKit?.strideOSWorkoutId, 'workout/exact');
  }
  assert.equal(candidates[1]?.strideOSActivityId, 'activity/exact');
  assert.equal(buildHealthKitActivityDraft({ candidate: candidates[1]! }).healthKit?.strideOSActivityId, 'activity/exact');
  // Malformed native results must not acquire a guessed identity from dates.
  saved.push({ ...saved[0]!, uuid: '' });
  assert.equal((await adapter.getRecentHealthKitWorkoutCandidates()).length, 2);
});
