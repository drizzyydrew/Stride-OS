import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { createJSONStorage } from 'zustand/middleware';
import { LocalDataOwner } from '../../src/lib/localDataOwner';
import { RunCompletionJournal } from '../../src/lib/runCompletionJournal';
import { activityFromWorkoutRecord } from '../../src/utils/activityMigration';
import { runCompletionKey, type RunWorkoutRecord } from '../../src/utils/runCompletionIdentity';

function loadSource(file: string, mocks: Record<string, unknown>) {
  const filename = path.resolve(file);
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} as any };
  const nativeRequire = createRequire(filename);
  vm.runInNewContext(compiled, { module, exports: module.exports,
    require: (id: string) => Object.hasOwn(mocks, id) ? mocks[id] : nativeRequire(id),
    console, setTimeout, clearTimeout, Date, process: { env: {} },
  }, { filename });
  return module.exports;
}

function raceRecord(): RunWorkoutRecord {
  return {
    id: runCompletionKey('rome-race'), workoutInstanceId: 'rome-race', ownerUserId: 'A', workoutId: 'tempo',
    type: 'tempo', intensity: 'hard', durationMinutes: 110, actualDurationMinutes: 110,
    estimatedDistanceMiles: 13.11, actualDistanceMiles: 13.11, actualStartTime: 1_000_000,
    actualEndTime: 7_600_000, timestamp: 7_600_001, week: 1, completed: true,
    estimatedLoad: 90, fatigueBefore: 10, fatigueAfter: 20, fatigueDelta: 10,
    recoveryBefore: 70, recoveryDelta: -3, distanceSource: 'gps', source: 'manual',
    routeCoordinates: [{ lat: 41.9, lng: 12.5, timestamp: 1_000_000, altitudeM: 25 }],
    activityMetrics: { rawHeartRateSamples: [{ timestamp: 1_000_000, bpm: 150, source: 'apple_watch' }] },
  };
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}

async function harness() {
  const values = new Map<string, string>();
  let hidePersistedActivity = false;
  let activityWriteGate: { entered: ReturnType<typeof deferred>; release: ReturnType<typeof deferred> } | undefined;
  const storage = {
    getItem: async (key: string) => {
      if (hidePersistedActivity && key === 'activity-store') {
        const raw = values.get(key);
        if (raw) return JSON.stringify({ ...JSON.parse(raw), state: { activities: [] } });
      }
      return values.get(key) ?? null;
    },
    setItem: async (key: string, value: string) => {
      if (key === 'activity-store' && activityWriteGate) {
        const gate = activityWriteGate;
        activityWriteGate = undefined;
        gate.entered.resolve();
        await gate.release.promise;
      }
      values.set(key, value);
    },
    removeItem: async (key: string) => { values.delete(key); },
  };
  const owner = new LocalDataOwner(storage);
  await owner.initialize('A', async () => true);
  await owner.accept('A');
  const ownership = { captureOwnerLease: () => owner.capture(), ownerLeaseIsCurrent: (lease: any) => owner.isCurrent(lease) };
  const persistence = { createAppJSONStorage: () => createJSONStorage(() => storage), getAppStorage: () => storage };
  const activityModule = loadSource('src/store/activityStore.ts', {
    './persistStorage': persistence, '@react-native-async-storage/async-storage': {},
    '../lib/localDataOwner': ownership, '../lib/recalculation': { runRecalculation() {} },
  });
  const activity = activityModule.useActivityStore;
  const workout = loadSource('src/store/workoutStore.ts', {
    './persistStorage': persistence, '@react-native-async-storage/async-storage': {}, './activityStore': { useActivityStore: activity },
    '../lib/localDataOwner': ownership,
    '../lib/syncService': { syncWorkoutLog: async () => {}, deleteWorkoutLog: async () => {} },
    '../lib/externalIntegrations': { syncCompletedWorkoutToExternalServices: async () => {} },
    '../utils/training': { calculateTrainingLoad: () => assert.fail('must not recalculate an existing run') },
    '../utils/calculateFatigue': { calculateUpdatedFatigue: () => assert.fail('must not reapply fatigue') },
  }).useWorkoutStore;
  await new Promise(resolve => setImmediate(resolve));
  const record = raceRecord();
  workout.setState({ history: [record], completedWorkouts: [record.id] });
  await new Promise(resolve => setImmediate(resolve));
  const entry = { ...record, completionKey: record.id, durationMinutes: 999, distanceMiles: 999,
    actualEndTime: record.actualEndTime! + 60_000, routeCoordinates: [], activityMetrics: {} };
  const save = () => workout.getState().commitRunEnd(entry, 2, 99, 99,
    () => assert.fail('must not reapply fatigue'), () => assert.fail('must not reapply load'));
  const journal = new RunCompletionJournal(storage);
  const explicitRestore = () => loadSource('src/lib/savedActivityRecovery.ts', {
    '../store/activityStore': activityModule, '../store/workoutStore': { useWorkoutStore: workout },
    './localDataOwner': ownership,
  }).recoverSavedActivity(`activity_workout_${record.id}`);
  return { values, storage, owner, activity, workout, record, entry, save, journal, explicitRestore,
    holdNextActivityWrite: () => {
      const gate = { entered: deferred(), release: deferred() };
      activityWriteGate = gate;
      return gate;
    },
    hideReadback: (value: boolean) => { hidePersistedActivity = value; } };
}

test('ambiguous history-only completion fails closed until explicit exact-record restoration', async () => {
  const h = await harness();
  const original = JSON.stringify(h.record);
  assert.equal(h.activity.getState().activities.length, 0);
  await assert.rejects(h.save(), /Restore saved recording/);
  assert.equal(h.activity.getState().activities.length, 0);
  assert.equal((await h.journal.read()).length, 0, 'late completion cannot manufacture repair permission');
  await h.explicitRestore();
  const result = await h.save();
  const saved = h.activity.getState().activities.find((item: any) => item.id === result.activityId);
  assert.ok(saved, 'success must identify an Activity that actually exists');
  assert.deepEqual(JSON.parse(JSON.stringify(saved)), JSON.parse(JSON.stringify(activityFromWorkoutRecord(h.record, false))));
  assert.equal(JSON.stringify(h.workout.getState().history), `[${original}]`);
  assert.equal(h.workout.getState().completedWorkouts.length, 1);
  const disk = JSON.parse(h.values.get('activity-store')!).state.activities;
  assert.deepEqual(disk, [JSON.parse(JSON.stringify(saved))]);
  assert.equal((await h.journal.read()).length, 0);
  assert.equal(result.entry.actualEndTime, h.record.actualEndTime);
  assert.equal(result.entry.distanceMiles, h.record.actualDistanceMiles);
});

test('an old pending journal cannot authorize automatic restoration of missing history', async () => {
  const h = await harness();
  await h.journal.save({ ownerUserId: 'A', entry: h.entry, week: 2, fatigue: 99, recovery: 99 });
  await h.workout.getState().restorePendingCompletions();
  assert.equal(h.activity.getState().activities.length, 0);
  assert.equal((await h.journal.read()).length, 1, 'retain ambiguous evidence without acknowledging it');
  await h.explicitRestore();
  await h.workout.getState().restorePendingCompletions();
  await h.workout.getState().restorePendingCompletions();
  assert.equal(h.workout.getState().history.length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(h.activity.getState().activities)),
    [JSON.parse(JSON.stringify(activityFromWorkoutRecord(h.record, false)))]);
  assert.equal((await h.journal.read()).length, 0);
});

test('history-only retry preserves a canonical Watch/Health alias instead of returning a synthetic ID', async () => {
  const h = await harness();
  h.activity.getState().addActivity({ ...activityFromWorkoutRecord(h.record, false), id: 'health-rome-alias' });
  const result = await h.save();
  assert.equal(result.activityId, 'health-rome-alias');
  assert.equal(h.activity.getState().activities.length, 1);
  assert.equal(JSON.parse(h.values.get('activity-store')!).state.activities[0].id, 'health-rome-alias');
});

test('repair failure retains completion journal and original history for retry', async () => {
  const h = await harness();
  await h.explicitRestore();
  // Fail only explicit durable writes, leaving normal middleware I/O harmless.
  const awaitPersistence = h.activity.getState().awaitPersistence;
  h.activity.setState({ awaitPersistence: async () => { throw new Error('disk unavailable'); } });
  await assert.rejects(h.save(), /disk unavailable/);
  assert.equal((await h.journal.read()).length, 1);
  assert.equal(h.workout.getState().history.length, 1);
  h.activity.setState({ awaitPersistence });
  await h.save();
  assert.equal(h.activity.getState().activities.length, 1);
  assert.equal((await h.journal.read()).length, 0);
});

test('commit rejects a missing persisted Activity even if the flush reports success', async () => {
  const h = await harness();
  await h.explicitRestore();
  h.activity.setState({ awaitPersistence: async () => {} });
  h.hideReadback(true);
  await assert.rejects(h.save(), /[Aa]ctivity.*(persist|confirm|unavailable)/);
  assert.equal((await h.journal.read()).length, 1);
});

test('history-only repair rejects an explicitly different record owner', async () => {
  const h = await harness();
  h.workout.setState({ history: [{ ...h.record, ownerUserId: 'B' }] });
  await assert.rejects(h.save(), /owner|account/i);
  assert.equal(h.activity.getState().activities.length, 0);
  assert.equal(h.workout.getState().history[0].ownerUserId, 'B');
});

test('explicitly restored projection receives exact-instance Watch evidence without changing run measurements', async () => {
  const h = await harness();
  await h.explicitRestore();
  const evidence = { workoutInstanceId: h.record.workoutInstanceId!, confirmedAt: h.record.actualEndTime!, state: 'ended' as const };
  h.entry.watchRecording = evidence;
  const result = await h.save();
  const saved = h.activity.getState().activities.find((item: any) => item.id === result.activityId);
  assert.deepEqual(JSON.parse(JSON.stringify(saved.watchRecording)), evidence);
  assert.equal(saved.metrics.distanceMeters, 13.11 * 1609.344);
  assert.equal(saved.metrics.durationSeconds, 110 * 60);
  assert.equal(h.workout.getState().history.length, 1);
  assert.equal(h.workout.getState().history[0].actualEndTime, h.record.actualEndTime);
});

test('owner revocation during Activity persistence prevents journal acknowledgment', async () => {
  const h = await harness();
  await h.explicitRestore();
  h.activity.setState({ awaitPersistence: async () => { await h.owner.signOut(); } });
  await assert.rejects(h.save(), /Account changed/);
  assert.equal((await h.journal.read()).length, 1);
  assert.equal(h.workout.getState().history[0].ownerUserId, 'A');
});

test('Activity deletion followed by an actual late Watch completion never resurrects the run', async () => {
  const h = await harness();
  const restored = await h.explicitRestore();
  h.activity.getState().removeActivity(restored);
  const command = loadSource('src/lib/runCompletionCommand.ts', {
    '../store/workoutStore': { useWorkoutStore: h.workout }, '../store/activityStore': { useActivityStore: h.activity },
    '../store/activeRunStore': { useActiveRunStore: { persist: { hasHydrated: () => true }, getState: () => ({ isActive: false }) } },
    '../store/athleteStore': { useAthleteStore: { persist: { hasHydrated: () => true }, getState: () => ({}) } },
    './localDataOwner': { captureOwnerLease: () => h.owner.capture(), ownerLeaseIsCurrent: (lease: any) => h.owner.isCurrent(lease) },
  });
  await assert.rejects(command.completeRunCommand({ workoutInstanceId: h.record.workoutInstanceId,
    endedAt: h.record.actualEndTime! + 1_000 }), /Restore saved recording/);
  assert.equal(h.activity.getState().activities.length, 0);
  assert.equal(h.workout.getState().history.length, 1);
  assert.equal((await h.journal.read()).length, 0);
});

test('Activity deletion during an unfinished commit remains deleted through bulk pending recovery', async () => {
  const h = await harness();
  const restored = await h.explicitRestore();
  await h.journal.save({ ownerUserId: 'A', entry: h.entry, week: 2, fatigue: 99, recovery: 99 });
  h.activity.getState().removeActivity(restored);
  await h.workout.getState().restorePendingCompletions();
  assert.equal(h.activity.getState().activities.length, 0);
  assert.equal((await h.journal.read()).length, 1);
  assert.equal(h.workout.getState().history[0].actualDistanceMiles, 13.11);
});

test('durable completion accepts a retained Health alias with metadata-only exact instance identity', async () => {
  const h = await harness();
  h.activity.getState().addActivity({ ...activityFromWorkoutRecord(h.record, false), id: 'health-metadata-only',
    workoutInstanceId: undefined, legacyWorkoutId: undefined, source: 'healthkit',
    healthKit: { workoutInstanceId: h.record.workoutInstanceId } });
  const result = await h.save();
  assert.equal(result.activityId, 'health-metadata-only');
  const saved = JSON.parse(h.values.get('activity-store')!).state.activities[0];
  assert.equal(saved.workoutInstanceId, undefined);
  assert.equal(saved.healthKit.workoutInstanceId, 'rome-race');
  assert.equal((await h.journal.read()).length, 0);
});

test('a conflicting top-level instance cannot borrow matching Health metadata for durable acknowledgment', async () => {
  const h = await harness();
  h.activity.getState().addActivity({ ...activityFromWorkoutRecord(h.record, false),
    workoutInstanceId: 'different-recording', healthKit: { workoutInstanceId: h.record.workoutInstanceId } });
  await assert.rejects(h.save(), /persistence could not be confirmed/);
  assert.equal((await h.journal.read()).length, 1);
});

test('ambiguous missing history stays pending without blocking another intact completion', async () => {
  const h = await harness();
  const other = { ...h.record, id: runCompletionKey('other-run'), workoutInstanceId: 'other-run' };
  h.workout.setState({ history: [h.record, other], completedWorkouts: [h.record.id, other.id] });
  h.activity.getState().addActivity(activityFromWorkoutRecord(other, false));
  await h.journal.save({ ownerUserId: 'A', entry: h.entry, week: 2, fatigue: 99, recovery: 99 });
  await h.journal.save({ ownerUserId: 'A', entry: { ...h.entry, completionKey: other.id, workoutInstanceId: other.workoutInstanceId },
    week: 2, fatigue: 99, recovery: 99 });
  await h.workout.getState().restorePendingCompletions();
  const retained = await h.journal.read();
  assert.equal(retained.length, 1);
  assert.equal(retained[0].entry.workoutInstanceId, h.record.workoutInstanceId);
  assert.equal(h.activity.getState().activities.length, 1);
  assert.equal(h.activity.getState().activities[0].workoutInstanceId, 'other-run');
});

test('real Activity commit queue preserves an edited same-instance row arriving during explicit restore', async () => {
  const h = await harness();
  const gate = h.holdNextActivityWrite();
  const blocker = h.activity.getState().awaitPersistence(h.owner.capture());
  await gate.entered.promise;
  const queuedRestore = h.explicitRestore();
  await new Promise(resolve => setImmediate(resolve));
  const edited = { ...activityFromWorkoutRecord(h.record, false), id: 'newly-arrived-edited-race',
    notes: 'Corrected after the race', metrics: { durationSeconds: 6_540, distanceMeters: 21_097.5 } };
  h.activity.getState().addActivity(edited);
  const before = JSON.stringify(h.activity.getState().activities[0]);
  gate.release.resolve();
  await blocker;
  const id = await queuedRestore;
  assert.equal(id, edited.id);
  assert.equal(h.activity.getState().activities.length, 1);
  assert.equal(JSON.stringify(h.activity.getState().activities[0]), before, 'queued recovery must not merge the older projection over user edits');
  assert.equal(JSON.stringify(JSON.parse(h.values.get('activity-store')!).state.activities[0]),
    JSON.stringify(JSON.parse(before)), 'the unchanged canonical edited row must also be durable');
  assert.equal(h.workout.getState().history[0].actualDistanceMiles, 13.11);
});

test('real Activity commit queue cancels explicit restore after removeActivity changes deletion revision', async () => {
  const h = await harness();
  const gate = h.holdNextActivityWrite();
  const blocker = h.activity.getState().awaitPersistence(h.owner.capture());
  await gate.entered.promise;
  const queuedRestore = h.explicitRestore();
  const rejected = assert.rejects(queuedRestore, /history changed/i);
  await new Promise(resolve => setImmediate(resolve));
  const incoming = { ...activityFromWorkoutRecord(h.record, false), id: 'arrived-then-deleted-race' };
  h.activity.getState().addActivity(incoming);
  h.activity.getState().removeActivity(incoming.id);
  gate.release.resolve();
  await blocker;
  await rejected;
  await h.activity.getState().awaitPersistence(h.owner.capture());
  assert.equal(h.activity.getState().activities.length, 0, 'queued restore must not recreate the deleted Activity');
  assert.equal(JSON.parse(h.values.get('activity-store')!).state.activities.length, 0);
  assert.equal(h.workout.getState().history.length, 1, 'retain the original saved recording for a later explicit decision');
  assert.equal((await h.journal.read()).length, 0);
});
