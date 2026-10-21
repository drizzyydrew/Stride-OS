import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import { LocalDataOwner } from '../../src/lib/localDataOwner';
import { createHydrationSafeStorage } from '../../src/store/hydrationSafeStorage';
import type { Activity } from '../../src/types/activity';
import { buildHealthKitActivityDraft } from '../../src/utils/healthKitImport';

function loadSource<T>(file: string, mocks: Record<string, unknown>): T {
  const filename = resolve(file);
  const compiled = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} };
  const nativeRequire = createRequire(filename);
  vm.runInNewContext(compiled, { module, exports: module.exports,
    require: (id: string) => Object.hasOwn(mocks, id) ? mocks[id] : nativeRequire(id),
    console, setTimeout, clearTimeout, Date, process: { env: {} },
  }, { filename });
  return module.exports as T;
}

const { WorkoutActivityType } = require(join(dirname(require.resolve('@kingstinct/react-native-healthkit/package.json')),
  'lib/commonjs/generated/healthkit.generated.js'));
const uuid = '11111111-1111-4111-8111-111111111111';
const bundle = 'synthetic.watch';
const startDate = new Date('2026-10-01T07:00:00Z');
const endDate = new Date('2026-10-01T08:30:00Z');
const draft = buildHealthKitActivityDraft({ candidate: { uuid, sourceBundleIdentifier: bundle,
  workoutInstanceId: 'synthetic-recording', activityType: 'running', durationSeconds: 5400,
  startTime: startDate.getTime(), endTime: endDate.getTime(), distanceMeters: 15000 } });
const tick = () => new Promise<void>(done => setImmediate(done));
function gate() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}

async function harness() {
  const values = new Map<string, string>();
  const hooks: {
    readError?: Error;
    readValue?: string | null;
    afterRead?: () => void;
    beforeWrite?: (value: string) => Promise<void>;
  } = {};
  let activityReads = 0;
  let recalculations = 0;
  const nativeStorage = {
    getItem: async (key: string) => {
      if (key === 'activity-store') {
        activityReads += 1;
        if (hooks.readError) {
          const error = hooks.readError; delete hooks.readError; throw error;
        }
        if (Object.hasOwn(hooks, 'readValue')) {
          const value = hooks.readValue!; delete hooks.readValue; return value;
        }
      }
      const value = values.get(key) ?? null;
      if (key === 'activity-store') hooks.afterRead?.();
      return value;
    },
    setItem: async (key: string, value: string) => {
      if (key === 'activity-store') await hooks.beforeWrite?.(value);
      values.set(key, value);
    },
    removeItem: async (key: string) => { values.delete(key); },
  };
  const owner = new LocalDataOwner(nativeStorage);
  await owner.initialize('athlete', async () => false);
  await owner.accept('athlete');
  const ownership = { captureOwnerLease: () => owner.capture(),
    ownerLeaseIsCurrent: (lease: Parameters<LocalDataOwner['isCurrent']>[0]) => owner.isCurrent(lease) };
  const platform = { Platform: { OS: 'ios', Version: '26.5' } };
  // Exercise the actual app storage factory and its hydration-safe wrapper.
  const persistence = loadSource<typeof import('../../src/store/persistStorage')>('src/store/persistStorage.ts', {
    '@react-native-async-storage/async-storage': nativeStorage, 'react-native': platform,
  });
  const activity = loadSource<typeof import('../../src/store/activityStore')>('src/store/activityStore.ts', {
    './persistStorage': persistence, '@react-native-async-storage/async-storage': nativeStorage,
    '../lib/localDataOwner': ownership, '../lib/recalculation': { runRecalculation: () => { recalculations += 1; } },
  });
  const store = activity.useActivityStore;
  await tick();
  assert.equal(store.getState().hydrationStatus, 'ready');
  await store.getState().awaitPersistence(owner.capture()!);

  const queries: { filter?: { uuid?: string } }[] = [];
  const sample = { uuid, workoutActivityType: WorkoutActivityType.running, startDate, endDate,
    duration: { quantity: 5400, unit: 's' }, totalDistance: { quantity: 15000, unit: 'meters' },
    metadata: { StrideOSWorkoutInstanceId: 'synthetic-recording' },
    sourceRevision: { source: { bundleIdentifier: bundle, name: 'SourceProxy',
      toJSON: () => ({ bundleIdentifier: bundle, name: 'StrideOS' }) } } };
  const health = loadSource<typeof import('../../src/lib/healthKit')>('src/lib/healthKit.ts', {
    'react-native': platform,
    '@kingstinct/react-native-healthkit': { WorkoutActivityType, default: {
      isHealthDataAvailableAsync: async () => true, requestAuthorization: async () => true,
      queryWorkoutSamples: async (options: typeof queries[number]) => {
        queries.push(options);
        return [{ ...sample, toJSON: () => sample, getWorkoutRoutes: async () => [{ locations: [
          { latitude: 45, longitude: -120, date: startDate },
          { latitude: 45.01, longitude: -120.01, date: endDate },
        ] }], getStatistic: async () => undefined }];
      },
    } },
  });
  const recovery = loadSource<typeof import('../../src/lib/healthWorkoutRecovery')>('src/lib/healthWorkoutRecovery.ts', {
    './healthKit': health, './localDataOwner': ownership, '../store/activityStore': activity,
  }).createHealthWorkoutRecovery();
  return { values, hooks, owner, store, recovery, queries,
    diskActivities: () => JSON.parse(values.get('activity-store')!).state.activities as Activity[],
    get activityReads() { return activityReads; }, get recalculations() { return recalculations; } };
}

test('one-shot reads require prior safe hydration and propagate one base error without retries', async () => {
  const original = 'retained-history';
  let saved = original, readable = false, reads = 0, writes = 0, waits = 0;
  const failure = new Error('protected data unavailable');
  const base = {
    getItem: async () => { reads += 1; if (!readable) throw failure; return saved; },
    setItem: async (_key: string, value: string) => { writes += 1; saved = value; },
    removeItem: async () => { saved = ''; },
  };
  const storage = createHydrationSafeStorage(base, async () => {
    waits += 1;
    await storage.setItem('activity-store', 'empty');
    await storage.removeItem('activity-store');
    assert.equal(saved, original);
    assert.equal(writes, 0);
    readable = true;
  });
  await assert.rejects(storage.getItemOnce('activity-store'), /not been read safely/);
  assert.equal(reads, 0, 'one-shot reads cannot establish hydration');
  assert.equal(await storage.getItem('activity-store'), original);
  assert.equal(waits, 1, 'initial hydration still retries a failed read');
  assert.equal(storage.droppedWriteCount('activity-store'), 1);
  readable = false;
  const before = reads;
  await assert.rejects(storage.getItemOnce('activity-store'), error => error === failure);
  assert.equal(reads, before + 1);
  assert.equal(waits, 1, 'confirmation must not enter the hydration retry loop');
  readable = true;
  await storage.setItem('activity-store', 'updated');
  assert.equal(await storage.getItemOnce('activity-store'), 'updated');
});

test('native-like selection through actual adapter/service/store rejects readback failure and retries the same edited row', async () => {
  const h = await harness();
  const [listed] = await h.recovery.listRecent();
  assert.equal(listed.sourceName, 'StrideOS');
  const failure = new Error('activity readback unavailable');
  h.hooks.readError = failure;
  const before = h.activityReads;
  const phases: string[] = [];
  await assert.rejects(h.recovery.restoreSelected(uuid, phase => phases.push(phase)), error => error === failure);
  assert.equal(h.activityReads, before + 1, 'a rejected base read is attempted only once');
  assert.ok(phases.includes('saving'));
  assert.equal(phases.includes('opening'), false);
  assert.equal(h.store.getState().activities.length, 1);
  const published = h.store.getState().activities[0];
  assert.equal(published.healthKit?.workoutUuid, uuid);
  assert.equal(published.metrics.routeCoordinates?.length, 2);
  assert.equal(h.diskActivities()[0].id, published.id, 'write succeeded but confirmation failed');
  h.store.getState().updateActivity(published.id, { notes: 'Keep this edit' });
  const edited = h.store.getState().getById(published.id)!;
  const recalculations = h.recalculations;
  const id = await h.recovery.restoreSelected(uuid, phase => phases.push(phase));
  assert.equal(id, published.id);
  assert.equal(h.store.getState().activities.length, 1);
  assert.equal(h.store.getState().getById(id), edited);
  assert.equal(h.recalculations, recalculations, 'retry does not add or recalculate the existing row');
  assert.equal(h.diskActivities()[0].notes, edited.notes);
  assert.equal(phases.at(-1), 'opening');
  assert.equal(h.queries.at(-1)?.filter?.uuid, uuid);
});

test('actual recovery rejects conflicting UUID lineage and split claims before writing a selected workout', async () => {
  const byUuid = { ...draft, id: 'retained-uuid', workoutInstanceId: 'conflicting-instance' } as Activity;
  const metadataOnlyUuid = { ...byUuid, workoutInstanceId: undefined,
    healthKit: { ...byUuid.healthKit!, workoutInstanceId: undefined } };
  const byInstance = { ...draft, id: 'retained-instance', healthKit: undefined } as Activity;
  const nestedConflict = { ...byUuid, workoutInstanceId: draft.workoutInstanceId,
    healthKit: { ...byUuid.healthKit!, workoutInstanceId: 'conflicting-instance' } };
  const hiddenIntersection = { ...byUuid, healthKit: { ...byUuid.healthKit!, workoutUuid: 'earlier-export' } };
  for (const records of [[byUuid], [metadataOnlyUuid, byInstance], [nestedConflict], [hiddenIntersection]]) {
    const h = await harness();
    h.store.setState({ activities: records });
    await h.store.getState().awaitPersistence(h.owner.capture()!);
    const before = h.values.get('activity-store');
    await h.recovery.listRecent();
    await assert.rejects(h.recovery.restoreSelected(uuid), /conflicting recording identities|More than one saved activity claims/);
    assert.equal(h.store.getState().activities, records);
    assert.equal(h.values.get('activity-store'), before);
    assert.equal(h.recalculations, 0);
  }
});

test('actual recovery preserves one consistently identified edited canonical row across Health exports', async () => {
  const h = await harness();
  const id = h.store.getState().addActivity({ ...draft, id: 'edited-canonical', notes: 'Keep original edits',
    healthKit: { ...draft.healthKit!, workoutUuid: 'earlier-export' },
    metrics: { ...draft.metrics, durationSeconds: 5300 } });
  await h.store.getState().awaitPersistence(h.owner.capture()!);
  const retained = h.store.getState().getById(id)!;
  const before = h.values.get('activity-store');
  const recalculations = h.recalculations;
  await h.recovery.listRecent();
  assert.equal(await h.recovery.restoreSelected(uuid), id);
  assert.equal(h.store.getState().activities.length, 1);
  assert.equal(h.store.getState().getById(id), retained);
  assert.equal(h.store.getState().getById(id)?.healthKit?.workoutUuid, 'earlier-export');
  assert.equal(h.values.get('activity-store'), before);
  assert.equal(h.recalculations, recalculations);
});

test('actual queued recovery rechecks identity when a competing Health claim arrives after the initial guard', async () => {
  const h = await harness();
  await h.recovery.listRecent();
  const conflict = { ...draft, id: 'arrived-before-queued-commit', workoutInstanceId: 'conflicting-instance' } as Activity;
  const reads = h.activityReads;
  await assert.rejects(h.recovery.restoreSelected(uuid, phase => {
    if (phase === 'saving') h.store.setState({ activities: [conflict] });
  }), /conflicting recording identities/);
  assert.equal(h.store.getState().activities.length, 1);
  assert.equal(h.store.getState().activities[0], conflict);
  assert.equal(h.store.getState().getById(draft.id!), undefined);
  assert.equal(h.activityReads, reads, 'queued guard rejects before a confirmation read');
  assert.equal(h.recalculations, 0, 'the selected draft was never added');
  await h.store.getState().awaitPersistence(h.owner.capture()!);
  assert.equal(h.diskActivities()[0].id, conflict.id);
});

test('actual selected recovery rejects contradictory top-level and nested instance claims without acknowledgment', async () => {
  const h = await harness();
  const id = h.store.getState().addActivity({ ...draft, id: 'contradictory-row',
    healthKit: { ...draft.healthKit!, workoutInstanceId: 'conflicting-instance' } });
  await h.store.getState().awaitPersistence(h.owner.capture()!);
  await h.recovery.listRecent();
  const row = h.store.getState().getById(id);
  const before = h.values.get('activity-store');
  const phases: string[] = [];
  await assert.rejects(h.recovery.restoreSelected(uuid, phase => phases.push(phase)), /conflicting recording identities/);
  assert.equal(phases.includes('opening'), false);
  assert.equal(h.store.getState().activities.length, 1);
  assert.equal(h.store.getState().getById(id), row);
  assert.equal(h.values.get('activity-store'), before);
});

test('explicit flush surfaces a failed read and mismatched bytes without poisoning either queue', async () => {
  const h = await harness();
  const lease = h.owner.capture()!;
  const id = await h.store.getState().addActivityAndPersist(draft, lease, { onlyIfMissing: true });
  h.hooks.readError = new Error('flush readback failed');
  await assert.rejects(h.store.getState().awaitPersistence(lease), /flush readback failed/);
  h.hooks.readValue = null;
  await assert.rejects(h.store.getState().awaitPersistence(lease), /persistence could not be confirmed/);
  await h.store.getState().awaitPersistence(lease);
  assert.equal(h.diskActivities().length, 1);
  assert.equal(h.diskActivities()[0].id, id);
});

test('an edit during readback drains its queued write before recovery confirms the edited snapshot', async () => {
  const h = await harness();
  await h.recovery.listRecent();
  const entered = gate(), release = gate();
  h.hooks.afterRead = () => {
    delete h.hooks.afterRead;
    h.store.getState().updateActivity(draft.id!, { notes: 'Edited during readback' });
  };
  h.hooks.beforeWrite = async value => {
    if (!JSON.parse(value).state.activities[0]?.notes) return;
    delete h.hooks.beforeWrite;
    entered.resolve();
    await release.promise;
  };
  let acknowledged = false;
  const pending = h.recovery.restoreSelected(uuid).then(id => { acknowledged = true; return id; });
  try {
    await entered.promise;
    await tick();
    assert.equal(acknowledged, false, 'the old snapshot cannot acknowledge the concurrent edit');
    assert.equal(h.diskActivities()[0].notes, undefined);
  } finally { release.resolve(); }
  const id = await pending;
  assert.equal(h.store.getState().getById(id)?.notes, 'Edited during readback');
  assert.equal(h.diskActivities()[0].notes, 'Edited during readback');
});

test('continuous edits exhaust three confirmations and leave both queues usable for a later retry', async () => {
  const h = await harness();
  let changes = 0;
  h.hooks.afterRead = () => {
    changes += 1;
    h.store.getState().updateActivity(draft.id!, { notes: `Edit ${changes}` });
  };
  const lease = h.owner.capture()!;
  await assert.rejects(h.store.getState().addActivityAndPersist(draft, lease, { onlyIfMissing: true }), /kept changing.*retry/);
  assert.equal(changes, 3, 'confirmation retries have a fixed bound');
  delete h.hooks.afterRead;
  const edited = h.store.getState().getById(draft.id!)!;
  assert.equal(await h.store.getState().addActivityAndPersist(draft, lease, { onlyIfMissing: true }), edited.id);
  assert.equal(h.store.getState().getById(edited.id), edited);
  assert.equal(h.diskActivities().length, 1);
  assert.equal(h.diskActivities()[0].notes, 'Edit 3');
});

test('owner revocation during one-shot readback rejects and fences a queued addition', async () => {
  const h = await harness();
  const lease = h.owner.capture()!;
  h.hooks.afterRead = () => { delete h.hooks.afterRead; h.owner.block('signed-out'); };
  const first = assert.rejects(h.store.getState().addActivityAndPersist(draft, lease), /Account changed/);
  const queued = assert.rejects(h.store.getState().addActivityAndPersist({ ...draft, id: 'queued', workoutInstanceId: 'queued' }, lease), /Account changed/);
  await Promise.all([first, queued]);
  assert.equal(h.store.getState().getById('queued'), undefined);
  assert.equal(h.store.getState().activities.length, 1);
  await h.owner.accept('athlete', { explicitSignIn: true });
  await h.store.getState().addActivityAndPersist(draft, h.owner.capture()!, { onlyIfMissing: true });
  assert.equal(h.diskActivities().length, 1);
});

test('deletion during confirmation cannot be resurrected or acknowledged as recovered', async () => {
  const h = await harness();
  await h.recovery.listRecent();
  h.hooks.afterRead = () => {
    delete h.hooks.afterRead;
    h.store.getState().removeActivity(draft.id!);
  };
  await assert.rejects(h.recovery.restoreSelected(uuid), /Activity history changed/);
  assert.equal(h.store.getState().activities.length, 0);
  await h.store.getState().awaitPersistence(h.owner.capture()!);
  assert.equal(h.diskActivities().length, 0);
});
