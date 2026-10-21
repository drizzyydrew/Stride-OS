import assert from 'node:assert/strict';
import Module from 'node:module';
import test from 'node:test';
import { sameRecording } from '../../src/utils/runCompletionIdentity';
import type { Activity, ActivityDraft } from '../../src/types/activity';
import type { HealthKitWorkoutCandidate } from '../../src/utils/healthKitImport';

const candidate: HealthKitWorkoutCandidate = {
  uuid: 'health-rome', sourceBundleIdentifier: 'com.mooremovement.strideos.watch',
  workoutInstanceId: 'adhoc:synthetic-health-recording', activityType: 'running',
  startTime: 1760000000000, endTime: 1760005400000, durationSeconds: 5400,
  averageHeartRateBpm: 150, distanceMeters: 15000, energyKcal: 900,
  routeCoordinates: [{ latitude: 45, longitude: -120, timestamp: 1760000000000 }],
};
function harness(initial: Activity[] = []) {
  let activities = initial;
  let current = true;
  let revision = 0;
  let hydrated = true;
  let hydrationStatus = 'ready';
  let authorized = true;
  let diskFailure = false;
  let queryFailure = false;
  let saveGate: Promise<void> | null = null;
  let queryAction = () => {};
  let queuedAction = () => {};
  let candidates = [structuredClone(candidate)];
  let commits = 0;
  let permissions = 0;
  const durable: string[] = [];
  const lease = { ownerUserId: 'athlete', generation: 1 };
  const store = { getState: () => ({ activities, hydrationStatus,
    addActivityAndPersist: async (input: ActivityDraft, owner: unknown, options: { onlyIfMissing: boolean; isCurrent: () => boolean }) => {
      queuedAction();
      assert.equal(owner, lease);
      assert.equal(options.onlyIfMissing, true);
      assert.equal(options.isCurrent(), true);
      commits += 1;
      const matches = activities.filter(activity => sameRecording(activity, input as Activity));
      if (matches.length > 1) throw new Error('Ambiguous recording');
      const existing = matches[0];
      if (!existing) activities = [...activities, input as Activity];
      if (saveGate) await saveGate;
      if (diskFailure) throw new Error('Disk write failed');
      const id = existing?.id ?? input.id!;
      durable.push(id);
      return id;
    },
  }) };
  const mocks: Record<string, unknown> = {
    './healthKit': {
      requestPermissions: async () => { permissions += 1; return authorized; },
      readHealthKitWorkoutHistory: async (options: { includeRoutes: boolean; onProgress?: (done: number, total: number) => void }) => {
        assert.equal(options.includeRoutes, true);
        queryAction();
        if (queryFailure) throw new Error('Health read failed');
        options.onProgress?.(candidates.length, candidates.length);
        return { candidates, sampleCount: candidates.length, skippedCount: 0 };
      },
    },
    './localDataOwner': { captureOwnerLease: () => current ? lease : null, ownerLeaseIsCurrent: (value: unknown) => current && value === lease },
    './trackingTaskHydration': { waitForPersistedStoreHydration: async () => hydrated },
    '../store/activityStore': { useActivityStore: store, getActivityRemovalRevision: () => revision },
  };
  const loader = Module as unknown as { _load: (id: string, ...args: unknown[]) => unknown };
  const original = loader._load;
  const file = '../../src/lib/healthActivityRestore';
  delete require.cache[require.resolve(file)];
  loader._load = function (id, ...args) { return Object.hasOwn(mocks, id) ? mocks[id] : original.call(this, id, ...args); };
  let restore: typeof import('../../src/lib/healthActivityRestore').restoreHealthActivityHistory;
  try { restore = require(file).restoreHealthActivityHistory; } finally { loader._load = original; }
  return { restore, durable, get activities() { return activities; }, get commits() { return commits; }, get permissions() { return permissions; },
    holdSave: () => { let release!: () => void; saveGate = new Promise(resolve => { release = resolve; }); return release; },
    lock: () => { current = false; }, unhydrated: () => { hydrated = false; }, corrupt: () => { hydrationStatus = 'error'; },
    deny: () => { authorized = false; }, failRead: () => { queryFailure = true; }, failDisk: () => { diskFailure = true; },
    allowDisk: () => { diskFailure = false; }, empty: () => { candidates = []; },
    switchDuringRead: () => { queryAction = () => { current = false; }; },
    deleteDuringRead: () => { queryAction = () => { revision += 1; }; },
    deleteDuringQueue: () => { queuedAction = () => { revision += 1; }; },
  };
}

test('explicit Health restore retains exact recording identity and is durable and idempotent', async () => {
  const h = harness();
  assert.deepEqual(await h.restore(), { restored: 1, withRoutes: 1, alreadyPresent: 0, tooShort: 0, sampleCount: 1, skippedCount: 0 });
  assert.equal(h.activities[0]?.workoutInstanceId, candidate.workoutInstanceId);
  assert.equal(h.activities[0]?.metrics.averageHeartRateBpm, 150);
  assert.equal(h.activities[0]?.metrics.routeCoordinates?.length, 1);
  assert.equal(h.durable.length, 1);
  assert.equal((await h.restore()).restored, 0);
  assert.equal(h.activities.length, 1);
  assert.equal(h.durable.length, 2, 'Existing rows also receive durable verification');
});

test('edited exact matches are never overwritten or inferred from a nearby workout', async () => {
  const edited = { id: 'edited', workoutInstanceId: candidate.workoutInstanceId, notes: 'Race notes', metrics: { durationSeconds: 8000 } } as Activity;
  const nearby = { id: 'nearby', activityType: 'running', startTime: candidate.startTime, metrics: { durationSeconds: 5400 } } as Activity;
  const h = harness([edited, nearby]);
  assert.equal((await h.restore()).alreadyPresent, 1);
  assert.equal(h.activities[0], edited);
  assert.equal(h.activities[1], nearby);
  assert.deepEqual(h.durable, ['edited']);
});

test('blocked history, failed reads, account switches and new deletions cause no restore writes', async () => {
  for (const prepare of ['lock', 'unhydrated', 'corrupt', 'deny', 'failRead', 'switchDuringRead', 'deleteDuringRead', 'deleteDuringQueue'] as const) {
    const h = harness(); h[prepare]();
    await assert.rejects(h.restore(), undefined, prepare);
    assert.equal(h.commits, 0, prepare);
    assert.equal(h.durable.length, 0, prepare);
  }
});

test('failed persistence never reports success and retry flushes the same published row', async () => {
  const h = harness(); h.failDisk();
  await assert.rejects(h.restore(), /Disk write/);
  assert.equal(h.activities.length, 1);
  await assert.rejects(h.restore(), /Disk write/);
  h.allowDisk();
  assert.equal((await h.restore()).alreadyPresent, 1);
  assert.equal(h.activities.length, 1);
  assert.equal(h.durable.length, 1);
});

test('genuinely empty Health results stay distinct from failed reads', async () => {
  const h = harness(); h.empty();
  assert.equal((await h.restore()).sampleCount, 0);
  assert.equal(h.commits, 0);
});

test('finishing reads enters a distinct saving phase and never reports completion before durable commit', async () => {
  const h = harness(); const release = h.holdSave();
  const phases: { done: number; total: number; phase?: string }[] = [];
  let complete = false;
  const pending = h.restore((done, total, phase) => phases.push({ done, total, phase })).then(() => { complete = true; });
  await new Promise(resolve => setImmediate(resolve));
  assert.ok(phases.some(p => p.phase === 'reading' && p.done === p.total));
  assert.deepEqual(phases.at(-1), { done: 0, total: 1, phase: 'saving' });
  assert.equal(complete, false);
  release(); await pending;
  assert.deepEqual(phases.at(-1), { done: 1, total: 1, phase: 'saving' });
  assert.equal(h.durable.length, 1);
});
