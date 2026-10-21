import assert from 'node:assert/strict';
import Module from 'node:module';
import test from 'node:test';
import type { Activity, ActivityDraft } from '../../src/types/activity';
import type { HealthKitWorkoutCandidate } from '../../src/utils/healthKitImport';
import { sameRecording } from '../../src/utils/runCompletionIdentity';

const workout: HealthKitWorkoutCandidate = { uuid: 'selected-health-uuid', sourceBundleIdentifier: 'watch',
  startTime: 1000, endTime: 5401000, durationSeconds: 5400, activityType: 'running',
  workoutInstanceId: 'synthetic-recording', distanceMeters: 15000, averageHeartRateBpm: 150,
  routeCoordinates: [{ latitude: 45, longitude: -120, timestamp: 1000 }] };

function harness(initial: Activity[] = []) {
  let activities = initial;
  let owner = true, current = true, hydration = true, granted = true, failedSave = false;
  let revision = 0;
  let lookup = () => {};
  let beforeCommit = () => {};
  let returned = workout;
  let listed = [workout];
  const queried: string[] = [];
  const durable: string[] = [];
  const lease = { ownerUserId: 'athlete', generation: 1 };
  const mocks: Record<string, unknown> = {
    './localDataOwner': { captureOwnerLease: () => lease, ownerLeaseIsCurrent: () => owner },
    './trackingTaskHydration': { waitForPersistedStoreHydration: async () => hydration },
    './healthKit': {
      requestPermissions: async () => granted,
      readHealthKitWorkoutHistory: async (options: any) => {
        assert.equal(options.metadataOnly, true); assert.equal(options.limit, 250);
        return { candidates: listed };
      },
      getHealthKitWorkoutByUuid: async (uuid: string) => { queried.push(uuid); lookup(); return returned; },
    },
    '../store/activityStore': { getActivityRemovalRevision: () => revision, useActivityStore: { getState: () => ({ activities, hydrationStatus: 'ready',
      addActivityAndPersist: async (draft: ActivityDraft, l: unknown, options: any) => {
        assert.equal(l, lease); assert.equal(options.onlyIfMissing, true);
        beforeCommit(); options.isCurrent();
        const existing = activities.filter(a => sameRecording(a, draft as Activity));
        if (existing.length > 1) throw new Error('Ambiguous exact matches');
        const id = existing[0]?.id ?? draft.id!;
        if (!existing.length) activities.push(draft as Activity);
        if (failedSave) throw new Error('Disk failure');
        durable.push(id); return id;
      },
    }) } },
  };
  const loader = Module as unknown as { _load: (id: string, ...args: unknown[]) => unknown };
  const original = loader._load;
  const file = '../../src/lib/healthWorkoutRecovery';
  delete require.cache[require.resolve(file)];
  loader._load = function (id, ...args) { return Object.hasOwn(mocks, id) ? mocks[id] : original.call(this, id, ...args); };
  let create: typeof import('../../src/lib/healthWorkoutRecovery').createHealthWorkoutRecovery;
  try { create = require(file).createHealthWorkoutRecovery; } finally { loader._load = original; }
  return { session: create(() => current), queried, durable, get activities() { return activities; },
    close: () => { current = false; }, switchOwner: () => { owner = false; }, failHydration: () => { hydration = false; },
    deny: () => { granted = false; }, failSave: () => { failedSave = true; }, allowSave: () => { failedSave = false; },
    switchDuringLookup: () => { lookup = () => { owner = false; }; },
    closeDuringLookup: () => { lookup = () => { current = false; }; },
    deleteDuringLookup: () => { lookup = () => { revision += 1; }; },
    deleteDuringQueue: () => { beforeCommit = () => { revision += 1; }; },
    differentRecord: () => { returned = { ...workout, uuid: 'wrong' }; },
    differentSource: () => { returned = { ...workout, sourceBundleIdentifier: 'different' }; },
    duplicateList: () => { listed = [workout, workout]; },
  };
}

test('only an explicitly listed UUID is fetched, saved and returned as a durable canonical ID', async () => {
  const h = harness();
  assert.equal((await h.session.listRecent()).length, 1);
  assert.equal(h.queried.length, 0); assert.equal(h.activities.length, 0);
  await assert.rejects(h.session.restoreSelected('not-listed'));
  const phases: string[] = [];
  const id = await h.session.restoreSelected(workout.uuid, phase => phases.push(phase));
  assert.deepEqual(phases, ['details', 'saving', 'opening']);
  assert.deepEqual(h.queried, [workout.uuid]);
  assert.deepEqual(h.durable, [id]);
  assert.deepEqual(h.activities[0]?.metrics.routeCoordinates, workout.routeCoordinates);
  assert.equal(await h.session.restoreSelected(workout.uuid), id);
  assert.equal(h.activities.length, 1);
});

test('an existing Health UUID without old-link aliases opens its kept edited canonical activity', async () => {
  const edited = { id: 'kept-canonical', activityType: 'running', notes: 'Keep my edits', metrics: { durationSeconds: 5000 },
    healthKit: { workoutUuid: workout.uuid, sourceBundleIdentifier: workout.sourceBundleIdentifier } } as Activity;
  const h = harness([edited]); await h.session.listRecent();
  assert.equal(await h.session.restoreSelected(workout.uuid), edited.id);
  assert.equal(h.activities[0], edited);
  assert.equal(h.activities[0].workoutInstanceId, undefined, 'Do not invent lineage for the old link');
});

test('competing UUID and recording-instance evidence rejects before a duplicate or wrong canonical save', async () => {
  const exactUuid = { id: 'uuid-row', activityType: 'running', workoutInstanceId: 'conflicting-instance', metrics: {},
    healthKit: { workoutUuid: workout.uuid, sourceBundleIdentifier: workout.sourceBundleIdentifier } } as Activity;
  const byInstance = { id: 'instance-row', activityType: 'running', workoutInstanceId: workout.workoutInstanceId, metrics: {} } as Activity;
  for (const records of [[exactUuid], [{ ...exactUuid, workoutInstanceId: undefined }, byInstance]]) {
    const h = harness(records); await h.session.listRecent();
    await assert.rejects(h.session.restoreSelected(workout.uuid), /conflicting recording identities|More than one saved activity claims/);
    assert.equal(h.activities.length, records.length);
    assert.equal(h.durable.length, 0);
  }
});

test('all retained recording-ID claims must agree, including otherwise hidden nested claims', async () => {
  for (const top of [workout.workoutInstanceId, 'conflicting-instance']) {
    const row = { id: 'conflicting-row', workoutInstanceId: top, activityType: 'running', metrics: {}, healthKit: {
      workoutUuid: workout.uuid, sourceBundleIdentifier: workout.sourceBundleIdentifier,
      workoutInstanceId: top === workout.workoutInstanceId ? 'conflicting-instance' : workout.workoutInstanceId,
    } } as Activity;
    const h = harness([row]); await h.session.listRecent();
    await assert.rejects(h.session.restoreSelected(workout.uuid), /conflicting recording identities/);
    assert.equal(h.durable.length, 0); assert.equal(h.activities[0], row);
  }
});

test('one canonical row with consistent exact instance lineage is preserved across multiple Health exports', async () => {
  const row = { id: 'canonical-recording', workoutInstanceId: workout.workoutInstanceId, activityType: 'running',
    notes: 'Keep edits', metrics: { durationSeconds: 5300 }, healthKit: { workoutUuid: 'earlier-export-uuid',
      sourceBundleIdentifier: workout.sourceBundleIdentifier, workoutInstanceId: workout.workoutInstanceId } } as Activity;
  const h = harness([row]); await h.session.listRecent();
  assert.equal(await h.session.restoreSelected(workout.uuid), row.id);
  assert.equal(h.activities.length, 1); assert.equal(h.activities[0], row);
  assert.equal(h.activities[0].healthKit?.workoutUuid, 'earlier-export-uuid');
});

test('stale request, owner change, deletion or mismatched selected record prevents a new save', async () => {
  for (const phase of ['close', 'switchOwner', 'switchDuringLookup', 'closeDuringLookup', 'deleteDuringLookup', 'deleteDuringQueue', 'differentRecord', 'differentSource'] as const) {
    const h = harness(); await h.session.listRecent(); h[phase]();
    await assert.rejects(h.session.restoreSelected(workout.uuid), undefined, phase);
    assert.equal(h.activities.length, 0, phase); assert.equal(h.durable.length, 0, phase);
  }
});

test('failed save can be retried without duplicating the published row or claiming early success', async () => {
  const h = harness(); await h.session.listRecent(); h.failSave();
  await assert.rejects(h.session.restoreSelected(workout.uuid), /Disk failure/);
  await assert.rejects(h.session.restoreSelected(workout.uuid), /Disk failure/);
  assert.equal(h.activities.length, 1); assert.equal(h.durable.length, 0);
  h.allowSave(); await h.session.restoreSelected(workout.uuid);
  assert.equal(h.activities.length, 1); assert.equal(h.durable.length, 1);
});

test('unreadable history, incomplete permission and ambiguous lists do not authorize a restore', async () => {
  for (const phase of ['failHydration', 'deny', 'duplicateList'] as const) {
    const h = harness(); h[phase](); await assert.rejects(h.session.listRecent());
    await assert.rejects(h.session.restoreSelected(workout.uuid));
    assert.equal(h.durable.length, 0);
  }
});
