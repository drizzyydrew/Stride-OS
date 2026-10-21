import assert from 'node:assert/strict';
import Module from 'node:module';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { buildHealthKitActivityDraft } from '../../src/utils/healthKitImport';

// Use the installed bridge's generated enum, not a parallel list of sport codes.
const { WorkoutActivityType } = require(join(dirname(require.resolve('@kingstinct/react-native-healthkit/package.json')),
  'lib/commonjs/generated/healthkit.generated.js'));
// Synthetic measurements and identifiers; never publish an athlete's Health record.
const startDate = new Date('2026-10-01T07:00:00Z');
const endDate = new Date('2026-10-01T08:30:00Z');
const route = [{ locations: [
  { latitude: 45, longitude: -120, date: startDate, altitude: 20, horizontalAccuracy: 5 },
  { latitude: 45.01, longitude: -120.01, date: endDate, altitude: 30, horizontalAccuracy: 5 },
] }];
function race() {
  const sample = { uuid: 'health-rome', workoutActivityType: WorkoutActivityType.running,
    startDate, endDate, duration: { quantity: 5400.25, unit: 's' },
    totalDistance: { quantity: 15000, unit: 'meters' }, totalEnergyBurned: { quantity: 900, unit: 'kcal' },
    metadata: { StrideOSWorkoutInstanceId: 'adhoc:synthetic-health-recording', StrideOSSport: 'run' },
    sourceRevision: { source: { bundleIdentifier: 'com.mooremovement.strideos.watch', name: 'StrideOS' } },
    device: { name: 'Apple Watch', manufacturer: 'Apple Inc.' } };
  return { ...sample, toJSON: () => sample, getWorkoutRoutes: async () => route,
    getStatistic: async (type: string) => type.endsWith('HeartRate')
      ? { averageQuantity: { quantity: 150, unit: 'count/min' }, maximumQuantity: { quantity: 180, unit: 'count/min' } }
      : type.endsWith('StepCount') ? { sumQuantity: { quantity: 16000, unit: 'count' } } : undefined };
}
function adapter(options: { query?: () => Promise<unknown[]>; available?: boolean; enums?: boolean; module?: boolean } = {}) {
  const loader = Module as unknown as { _load: (id: string, ...args: unknown[]) => unknown };
  const original = loader._load;
  const file = '../../src/lib/healthKit';
  delete require.cache[require.resolve(file)];
  loader._load = function (id, ...args) {
    if (id === 'react-native') return { Platform: { OS: 'ios', Version: '26.5' } };
    if (id === '@kingstinct/react-native-healthkit') {
      if (options.module === false) throw new Error('Native bridge missing');
      // v14 exports bound functions on default, but enums only on the namespace.
      return { default: { isHealthDataAvailableAsync: async () => options.available !== false,
        queryWorkoutSamples: options.query ?? (async () => [race()]) },
      ...(options.enums === false ? {} : { WorkoutActivityType }) };
    }
    return original.call(this, id, ...args);
  };
  try { return require(file) as typeof import('../../src/lib/healthKit'); }
  finally { loader._load = original; }
}

test('v14 split exports retain a Health record identity, route and measured totals', async () => {
  const candidates = await adapter().getHealthKitWorkoutHistory({ days: 3650, limit: 2000, includeRoutes: true });
  assert.equal(candidates.length, 1);
  const candidate = candidates[0]!;
  assert.equal(candidate.workoutInstanceId, 'adhoc:synthetic-health-recording');
  assert.equal(candidate.activityType, 'running');
  assert.equal(candidate.durationSeconds, 5400);
  assert.equal(candidate.averageHeartRateBpm, 150);
  assert.equal(candidate.energyKcal, 900);
  assert.equal(candidate.metricsSummary?.stepCount, 16000);
  assert.equal(candidate.routeCoordinates?.length, 2);
  assert.equal(candidate.routeCoordinates?.[0]?.latitude, 45);
  const draft = buildHealthKitActivityDraft({ candidate });
  assert.equal(draft.workoutInstanceId, 'adhoc:synthetic-health-recording');
  assert.equal(draft.metrics.distanceMeters, 15000);
});

test('native query failures and unavailable bridge are never presented as empty history', async () => {
  await assert.rejects(adapter({ query: async () => { throw new Error('protected data unavailable'); } })
    .getHealthKitWorkoutHistory({ days: 3650, limit: 2000 }), /could not be read/i);
  for (const options of [{ available: false }, { module: false }, { enums: false }]) {
    await assert.rejects(adapter(options).getHealthKitWorkoutHistory({ days: 3650, limit: 2000 }));
  }
});

test('unexpected decoding failures are not silently discarded as no workouts', async () => {
  await assert.rejects(adapter({ query: async () => [{ ...race(), toJSON: () => { throw new Error('decode failure'); } }] })
    .getHealthKitWorkoutHistory({ days: 3650, limit: 2000 }), /could not be read/i);
});

test('failed requested route reads never save a silently route-less candidate', async () => {
  const health = adapter({ query: async () => [{ ...race(), getWorkoutRoutes: async () => { throw new Error('Route read failed'); } }] });
  await assert.rejects(health.getHealthKitWorkoutHistory({ days: 3650, limit: 2000, includeRoutes: true }), /could not be read safely/);
  assert.equal((await health.getHealthKitWorkoutHistory({ days: 3650, limit: 2000 })).length, 1,
    'An outbound deduplication lookup does not need to read a route');
});

test('read summary distinguishes genuinely empty responses from unsupported or invalid records', async () => {
  const empty = await adapter({ query: async () => [] }).readHealthKitWorkoutHistory({ days: 3650, limit: 2000 });
  assert.equal(empty.sampleCount, 0);
  const unsupported = { ...race(), toJSON: () => ({ ...race().toJSON(), workoutActivityType: WorkoutActivityType.golf }) };
  const mixed = await adapter({ query: async () => [unsupported, race(), { ...race(), toJSON: () => ({ ...race().toJSON(), uuid: '' }) }] })
    .readHealthKitWorkoutHistory({ days: 3650, limit: 2000 });
  assert.equal(mixed.sampleCount, 3);
  assert.equal(mixed.skippedCount, 2);
  assert.equal(mixed.candidates.length, 1);
});
