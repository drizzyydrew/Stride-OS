import assert from 'node:assert/strict';
import Module from 'node:module';
import test from 'node:test';
import type { Activity } from '../../src/types/activity';
import type { RunWorkoutRecord } from '../../src/utils/runCompletionIdentity';
import { activityFromWorkoutRecord } from '../../src/utils/activityMigration';

const startTime = new Date('2026-10-18T07:00:00Z').getTime();
const race = {
  id: 'run_rome%3Ahalf', workoutInstanceId: 'rome:half', ownerUserId: 'athlete', actualStartTime: startTime,
  actualEndTime: startTime + 7_543_000, type: 'tempo', intensity: 'hard', completed: true,
  workoutId: 'half-marathon', timestamp: startTime + 7_543_000, durationMinutes: 7_543 / 60,
  actualDurationMinutes: 7_543 / 60, actualDistanceMiles: 13.12, estimatedDistanceMiles: 13.12,
  source: 'manual', distanceSource: 'gps', week: 1,
  routeCoordinates: [{ lat: 41.89, lng: 12.49, timestamp: startTime, altitudeM: 20 },
    { lat: 41.9, lng: 12.5, timestamp: startTime + 7_543_000, altitudeM: 30 }],
  activityMetrics: { elevationGainMeters: 80, rawHeartRateSamples: [{ timestamp: startTime + 1000, bpm: 151, source: 'apple_watch' }] },
} as RunWorkoutRecord;

function harness(records: RunWorkoutRecord[] = [structuredClone(race)], initial: Activity[] = []) {
  let activities = initial;
  let current = true;
  let hydrated = true;
  let hydrationStatus = 'ready';
  let fail = false;
  let failAfterPublish = false;
  let flushes = 0;
  let changeOnWait = false;
  let changeOnWrite = false;
  let removalRevision = 0;
  let removeOnWait = false;
  let removeOnWrite = false;
  const writes: Activity[] = [];
  const lease = { ownerUserId: 'athlete', generation: 1 };
  const activityStore = { getState: () => ({ activities, hydrationStatus,
    awaitPersistence: async () => { flushes += 1; if (fail || failAfterPublish) throw new Error('Disk write failed'); },
    addActivityAndPersist: async (input: Activity, owner: unknown, options: { isCurrent: () => boolean; onlyIfMissing: boolean }) => {
      assert.equal(owner, lease);
      if (fail) throw new Error('Disk write failed');
      if (removeOnWrite) removalRevision += 1;
      assert.equal(options.onlyIfMissing, true);
      assert.equal(options.isCurrent(), true, 'Recovery must still be current before the queued add');
      writes.push(input); activities = [...activities, input];
      if (failAfterPublish) throw new Error('Disk write failed after publishing');
      if (changeOnWrite) current = false;
      return input.id;
    } }) };
  const mocks: Record<string, unknown> = {
    '../store/activityStore': { useActivityStore: activityStore, getActivityRemovalRevision: () => removalRevision },
    '../store/workoutStore': { useWorkoutStore: { getState: () => ({ history: records }) } },
    './localDataOwner': { captureOwnerLease: () => current ? lease : null, ownerLeaseIsCurrent: (value: unknown) => current && value === lease },
    './trackingTaskHydration': { waitForPersistedStoreHydration: async () => { if (changeOnWait) current = false; if (removeOnWait) removalRevision += 1; return hydrated; } },
  };
  const loader = Module as unknown as { _load: (id: string, ...args: unknown[]) => unknown };
  const original = loader._load;
  const file = '../../src/lib/savedActivityRecovery';
  delete require.cache[require.resolve(file)];
  loader._load = function (id, ...args) { return Object.hasOwn(mocks, id) ? mocks[id] : original.call(this, id, ...args); };
  let recover: typeof import('../../src/lib/savedActivityRecovery').recoverSavedActivity;
  try { recover = require(file).recoverSavedActivity; } finally { loader._load = original; }
  return { recover, writes, records, get activities() { return activities; },
    get flushes() { return flushes; },
    lock: () => { current = false; }, notHydrated: () => { hydrated = false; }, corrupt: () => { hydrationStatus = 'error'; },
    fail: () => { fail = true; }, switchOnWait: () => { changeOnWait = true; }, switchOnWrite: () => { changeOnWrite = true; },
    deleteOnWait: () => { removeOnWait = true; }, deleteOnWrite: () => { removeOnWrite = true; },
    failAfterPublish: () => { failAfterPublish = true; }, allowPersistence: () => { failAfterPublish = false; fail = false; } };
}

test('explicit exact-run recovery preserves the race route, sensor data, totals and identity without creating another run', async () => {
  const original = structuredClone(race);
  const h = harness();
  const id = await h.recover('activity_workout_run_rome%3Ahalf');
  assert.equal(id, 'activity_workout_run_rome%3Ahalf');
  assert.equal(h.activities.length, 1);
  assert.equal(h.records.length, 1);
  assert.deepEqual(h.activities[0], activityFromWorkoutRecord(race, false));
  assert.equal(h.activities[0].metrics.durationSeconds, 7543);
  assert.deepEqual(h.activities[0].metrics.rawHeartRateSamples, race.activityMetrics!.rawHeartRateSamples);
  assert.equal(h.activities[0].metrics.routeCoordinates!.length, 2);
  assert.deepEqual(h.records[0], original);
  assert.equal(await h.recover(id!), id);
  assert.equal(h.writes.length, 1);
});

test('existing canonical or merged activity returns without changing edited metrics', async () => {
  const edited = { ...activityFromWorkoutRecord(race, false), id: 'kept', notes: 'race notes', metrics: { durationSeconds: 7540 } };
  const h = harness([race], [edited]);
  assert.equal(await h.recover('activity_workout_run_rome%3Ahalf'), 'kept');
  assert.equal(h.writes.length, 0);
  assert.equal(h.activities[0], edited);
});

test('recovery will not guess by race date, schedule, missing ID, conflicting owner or ambiguous exact lineage', async () => {
  for (const id of [undefined, '', 'not-this-race', 'half-marathon']) {
    const h = harness(); assert.equal(await h.recover(id), null); assert.equal(h.writes.length, 0);
  }
  const foreign = harness([{ ...race, ownerUserId: 'other' }]);
  assert.equal(await foreign.recover('activity_workout_run_rome%3Ahalf'), null);
  assert.equal(foreign.writes.length, 0);
  const ambiguous = harness([race, { ...race, id: 'different-record' }]);
  assert.equal(await ambiguous.recover('rome:half'), null);
  assert.equal(ambiguous.writes.length, 0);
});

test('unreadable history, failed persistence and owner changes never report recovery success', async () => {
  for (const prepare of [(h: ReturnType<typeof harness>) => h.lock(), h => h.notHydrated(), h => h.corrupt(), h => h.fail(), h => h.switchOnWait(), h => h.switchOnWrite()]) {
    const h = harness(); prepare(h);
    await assert.rejects(h.recover('activity_workout_run_rome%3Ahalf'));
    assert.equal(h.records.length, 1);
  }
});

test('a new deletion during hydration or while waiting to write cancels restoration', async () => {
  for (const phase of ['deleteOnWait', 'deleteOnWrite'] as const) {
    const h = harness(); h[phase]();
    await assert.rejects(h.recover('activity_workout_run_rome%3Ahalf'));
    assert.equal(h.writes.length, 0);
    assert.equal(h.records.length, 1);
  }
});

test('ambiguous existing activities are never treated as a missing projection or overwritten', async () => {
  const original = activityFromWorkoutRecord(race, false);
  const a = { ...original, id: 'one', metrics: { durationSeconds: 111 } };
  const b = { ...original, id: 'two', metrics: { durationSeconds: 222 } };
  const h = harness([race], [a, b]);
  await assert.rejects(h.recover(original.id), /More than one/);
  assert.equal(h.writes.length, 0);
  assert.deepEqual(h.activities, [a, b]);
});

test('a row published before a failed save is durably retried, never treated as already restored', async () => {
  const h = harness(); h.failAfterPublish();
  await assert.rejects(h.recover('activity_workout_run_rome%3Ahalf'), /after publishing/);
  assert.equal(h.activities.length, 1);
  await assert.rejects(h.recover('activity_workout_run_rome%3Ahalf'), /Disk write failed/);
  assert.equal(h.flushes, 1);
  h.allowPersistence();
  assert.equal(await h.recover('activity_workout_run_rome%3Ahalf'), h.activities[0].id);
  assert.equal(h.flushes, 2);
  assert.equal(h.writes.length, 1);
});
