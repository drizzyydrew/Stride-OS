import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import Module from 'node:module';
import test from 'node:test';
import { captureOutdoorCompletion } from '../../src/utils/outdoorCompletionSnapshot';
import { OutdoorEndJournal, OUTDOOR_END_JOURNAL_KEY } from '../../src/lib/outdoorEndJournal';
import type { ActiveActivityStore } from '../../src/store/activeActivityStore';
import type { Activity, ActivityDraft } from '../../src/types/activity';
import { OUTDOOR_SPORTS, type OutdoorSport } from '../../src/utils/outdoorSports';

function fixture(type: OutdoorSport = 'hiking', instance = `recording-${type}`): ActiveActivityStore {
  return { activityId: `activity-${instance}`, workoutInstanceId: instance, activityType: type, subtype: 'outdoor',
    name: type, isActive: true, isPaused: false, startedAt: 1, pausedAt: null, pausedDurationMs: 10_000,
    recordingPauses: [{ startTime: 10_001, endTime: 20_001 }], completionRequestedAt: null,
    rawHeartRateSamples: [{ timestamp: 1, bpm: 120, source: 'apple_watch' }, { timestamp: 70_001, bpm: 200, source: 'apple_watch' }],
    cadenceSamples: [{ timestamp: 1, kind: type === 'cycling' ? 'cycling' : 'steps',
      ...(type === 'cycling' ? { cadenceRpm: 80 } : { cadenceSpm: 150 }), source: 'apple_watch' }],
    powerSamples: type === 'cycling' ? [{ timestamp: 1, watts: 200, kind: 'measured', sport: 'cycling', source: 'cycling_power_meter' }] : [],
    aggregate: { points: [{ latitude: 0, longitude: 0, timestamp: 1, altitudeMeters: 10, accuracyMeters: 5 },
      { latitude: 0, longitude: 0.001, timestamp: 60_001, altitudeMeters: 15, accuracyMeters: 5 }],
      distanceMeters: 100, elevationGainMeters: 5, elevationLossMeters: 0, currentMetersPerSecond: 2,
      averageMetersPerSecond: 2, maximumMetersPerSecond: 3 },
    scheduledSessionId: 'scheduled', associatedTrainingBlockId: 'block', associatedGoalId: 'goal', routeId: 'route', runWalkIntervals: [],
  } as unknown as ActiveActivityStore;
}

function load<T>(mocks: Record<string, unknown>, path = '../../src/lib/outdoorCompletion'): T {
  const module = Module as unknown as { _load: (id: string, ...args: unknown[]) => unknown };
  const previous = module._load;
  delete require.cache[require.resolve(path)];
  module._load = function (id, ...args) { return Object.hasOwn(mocks, id) ? mocks[id] : previous.call(this, id, ...args); };
  try { return require(path); } finally { module._load = previous; }
}

function harness(type: OutdoorSport = 'hiking') {
  const data = new Map<string, string>();
  const events: string[] = [];
  const activities: ActivityDraft[] = [];
  let state = fixture(type);
  let generation = 1;
  let failCommit = false;
  let failNative = false;
  let duringNative = () => {};
  let commitGate: (() => Promise<void>) | null = null;
  let runDiscarded = false;
  const run = { isActive: true, workoutInstanceId: 'standalone-run', environment: 'outdoor', completionRequestedAt: null as number | null };
  const lease = () => ({ ownerUserId: 'A', generation });
  function bind(next: ActiveActivityStore) {
    state = next;
    state.prepareEnd = (instance, at) => {
      if (state.workoutInstanceId !== instance || state.completionRequestedAt != null) return;
      state.completionRequestedAt = at; state.isPaused = true; state.pausedAt = at;
    };
    state.discard = () => { events.push(`discard:${state.workoutInstanceId}`); state.isActive = false; state.workoutInstanceId = null; state.completionRequestedAt = null; };
  }
  bind(state);
  const api = load<typeof import('../../src/lib/outdoorCompletion')>({
    '../../modules/stride-live-activity/src': { endStrideRunLiveActivityIfMatching: async (instance: string) => {
      events.push(`native:${instance}`); duringNative(); if (failNative) throw new Error('native unavailable'); return true;
    } },
    '../../modules/stride-watch-connectivity/src': { endStrideWatchWorkoutIfMatching: async (instance: string) => { events.push(`watch:${instance}`); } },
    '../store/activeActivityStore': { awaitActiveActivityPersistence: async () => { events.push('active-flush'); },
      useActiveActivityStore: { persist: { hasHydrated: () => true }, getState: () => state } },
    '../store/activeRunStore': { useActiveRunStore: { persist: { hasHydrated: () => true }, getState: () => run } },
    '../store/workoutStore': { useWorkoutStore: { persist: { hasHydrated: () => true }, getState: () => ({ history: [],
      getRunDiscardResult: async (instance: string) => runDiscarded && instance === 'standalone-run'
        ? { status: 'discarded', activityId: null, entry: { workoutInstanceId: instance }, ownerLease: lease() } : null,
    }) } },
    '../store/activityStore': { useActivityStore: { persist: { hasHydrated: () => true }, getState: () => ({ activities,
      addActivityAndPersist: async (activity: ActivityDraft) => {
        events.push(`commit:${activity.workoutInstanceId}`);
        const journal = JSON.parse(data.get(OUTDOOR_END_JOURNAL_KEY)!);
        assert.ok(journal.some((item: { activity?: ActivityDraft }) => item.activity?.workoutInstanceId === activity.workoutInstanceId));
        if (commitGate) await commitGate();
        if (failCommit) throw new Error('history disk unavailable');
        const index = activities.findIndex(prior => prior.workoutInstanceId === activity.workoutInstanceId);
        if (index >= 0) activities[index] = activity; else activities.push(activity);
        data.set('activity-store', JSON.stringify({ state: { activities }, version: 3 }));
        events.push(`durable:${activity.workoutInstanceId}`);
        return activity.id!;
      },
    }) } },
    '../store/persistStorage': { getAppStorage: () => ({ getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => { data.set(key, value); } }) },
    './localDataOwner': { captureOwnerLease: lease, getLocalDataOwner: () => ({ ownerUserId: 'A' }),
      ownerLeaseIsCurrent: (value: { generation: number } | null) => value?.generation === generation },
    './activityGpsTracking': { stopActivityLocationTrackingWhen: async (guard: () => boolean) => { if (guard()) events.push('gps'); return guard(); } },
    './watchRunCompletion': { completeWatchRunEnd: async (command: { workoutInstanceId: string; endedAt: number }) => {
      events.push(`run:${command.workoutInstanceId}`);
      if (!runDiscarded && run.environment === 'indoor') { run.completionRequestedAt ??= command.endedAt; return false; }
      return true;
    } },
  });
  return { api, data, events, activities, run, get state() { return state; }, bind,
    failCommit: (value: boolean) => { failCommit = value; }, failNative: (value: boolean) => { failNative = value; },
    duringNative: (fn: () => void) => { duringNative = fn; }, changeOwner: () => { generation++; },
    commitGate: (fn: (() => Promise<void>) | null) => { commitGate = fn; },
    discardRun: () => { runDiscarded = true; },
  };
}

test('shared Watch dispatcher retains indoor confirmation without consuming or cleaning the End', async () => {
  const h = harness();
  h.run.environment = 'indoor';
  const result = await h.api.completeWatchActivityEnd({ workoutInstanceId: 'standalone-run', endedAt: 60_001, distanceMeters: 9999 });
  assert.equal(result.status, 'awaiting_confirmation');
  assert.equal(h.run.completionRequestedAt, 60_001);
  assert.deepEqual(h.events, ['run:standalone-run']);
  assert.equal(h.activities.length, 0);
  assert.equal(JSON.parse(h.data.get(OUTDOOR_END_JOURNAL_KEY)!).length, 1);
  await h.api.recoverOutdoorCompletions();
  assert.equal(JSON.parse(h.data.get(OUTDOOR_END_JOURNAL_KEY)!).length, 1);
  assert.ok(!h.events.some(event => /^(native|watch|discard|commit):/.test(event)));
});

test('shared Watch dispatcher resolves an acknowledged short-run discard after its active store has cleared', async () => {
  const h = harness();
  h.run.isActive = false;
  h.run.environment = 'indoor';
  h.discardRun();
  const result = await h.api.completeWatchActivityEnd({ workoutInstanceId: 'standalone-run', endedAt: 60_001 });
  assert.equal(result.status, 'saved'); // Transport resolved; no activity is created for a discarded run.
  assert.equal(result.activityId, null);
  assert.deepEqual(h.events, ['run:standalone-run']);
  assert.equal(h.activities.length, 0);
  assert.deepEqual(JSON.parse(h.data.get(OUTDOOR_END_JOURNAL_KEY)!), []);
  await h.api.recoverOutdoorCompletions();
  assert.deepEqual(h.events, ['run:standalone-run']);
  assert.equal(h.state.isActive, true);
});

test('all nine outdoor types complete without a mounted screen and preserve original time, route and telemetry', async () => {
  for (const type of Object.keys(OUTDOOR_SPORTS) as OutdoorSport[]) {
    const h = harness(type);
    const instance = h.state.workoutInstanceId!;
    const result = await h.api.completeWatchActivityEnd({ workoutInstanceId: instance, endedAt: 60_001 });
    assert.equal(result.activityId, `activity-${instance}`);
    const activity = h.activities[0]!;
    assert.equal(activity.activityType, type);
    assert.equal(activity.endTime, 60_001);
    assert.equal(activity.metrics.durationSeconds, 50);
    assert.equal(activity.metrics.routeCoordinates?.length, 2);
    assert.equal(activity.metrics.rawHeartRateSamples?.length, 1);
    assert.equal(activity.metrics.rawHeartRateSamples?.[0]?.timestamp, 1);
    assert.equal(activity.metrics.cadenceSamples?.length, 1);
    assert.equal(activity.scheduledSessionId, 'scheduled');
    assert.equal(activity.associatedTrainingBlockId, 'block');
    assert.ok(h.events.indexOf(`durable:${instance}`) < h.events.indexOf(`native:${instance}`));
    assert.ok(!h.events.some(event => event.startsWith('run:')), `${type} must not enter the standalone Run namespace`);
    assert.deepEqual(JSON.parse(h.data.get(OUTDOOR_END_JOURNAL_KEY)!), []);
  }
});

test('failed commit retains full first snapshot, freezes recording and retries idempotently without native cleanup first', async () => {
  const h = harness('cycling');
  h.failCommit(true);
  await assert.rejects(h.api.completeOutdoorCommand({ workoutInstanceId: 'recording-cycling', endedAt: 60_001 }), /disk/);
  assert.deepEqual(h.events, ['commit:recording-cycling']);
  assert.equal(h.state.completionRequestedAt, 60_001);
  assert.equal(h.state.isPaused, true);
  const retained = JSON.parse(h.data.get(OUTDOOR_END_JOURNAL_KEY)!)[0];
  assert.equal(retained.activity.metrics.powerSamples[0].watts, 200);
  h.state.aggregate.distanceMeters = 999;
  h.failCommit(false);
  await h.api.completeOutdoorCommand({ workoutInstanceId: 'recording-cycling', endedAt: 120_001 });
  assert.equal(h.activities.length, 1);
  assert.equal(h.activities[0]?.endTime, 60_001);
  assert.equal(h.activities[0]?.metrics.distanceMeters, 0);
  await h.api.completeWatchActivityEnd({ workoutInstanceId: 'recording-cycling', endedAt: 180_001 });
  assert.equal(h.activities.length, 1);
  assert.equal(h.activities[0]?.endTime, 60_001);
});

test('native cleanup failure retains the durable activity and snapshot for root retry', async () => {
  const h = harness(); h.failNative(true);
  await assert.rejects(h.api.completeOutdoorCommand({ workoutInstanceId: 'recording-hiking', endedAt: 60_001 }), /native/);
  assert.equal(h.activities.length, 1);
  assert.ok(!h.events.includes('gps'));
  assert.equal(JSON.parse(h.data.get(OUTDOOR_END_JOURNAL_KEY)!).length, 1);
  h.failNative(false);
  await h.api.recoverOutdoorCompletions();
  assert.equal(h.activities.length, 1);
  assert.equal(h.state.isActive, false);
});

test('owner or recording replacement after await cannot stop GPS or discard a newer outdoor session', async () => {
  const h = harness();
  h.duringNative(() => h.bind(fixture('cycling', 'new-recording')));
  await h.api.completeOutdoorCommand({ workoutInstanceId: 'recording-hiking', endedAt: 60_001 });
  assert.equal(h.state.workoutInstanceId, 'new-recording');
  assert.ok(!h.events.includes('gps') && !h.events.some(event => event.startsWith('discard:')));
  const owner = harness(); owner.duringNative(owner.changeOwner);
  await assert.rejects(owner.api.completeOutdoorCommand({ workoutInstanceId: 'recording-hiking', endedAt: 60_001 }), /Account changed/);
  assert.ok(!owner.events.some(event => event.startsWith('watch:')) && !owner.events.includes('gps'));
  assert.equal(JSON.parse(owner.data.get(OUTDOOR_END_JOURNAL_KEY)!).length, 1);
});

test('native run kind resolves by exact store ownership, not sport or ID prefix', async () => {
  const h = harness('running');
  await h.api.completeWatchActivityEnd({ workoutInstanceId: 'recording-running', endedAt: 60_001 });
  assert.equal(h.activities[0]?.activityType, 'running');
  assert.ok(!h.events.includes('run:recording-running'));
  const standalone = harness('hiking');
  await standalone.api.completeWatchActivityEnd({ workoutInstanceId: 'standalone-run', endedAt: 60_001 });
  assert.deepEqual(standalone.events, ['run:standalone-run']);
  assert.equal(standalone.activities.length, 0);
});

test('unknown End remains retained without blocking a later valid outdoor recording', async () => {
  const h = harness();
  await assert.rejects(h.api.completeWatchActivityEnd({ workoutInstanceId: 'unknown', endedAt: 10_001 }), /does not match/);
  await h.api.completeOutdoorCommand({ workoutInstanceId: 'recording-hiking', endedAt: 60_001 });
  assert.equal(h.activities.length, 1);
  assert.equal(JSON.parse(h.data.get(OUTDOOR_END_JOURNAL_KEY)!)[0].command.workoutInstanceId, 'unknown');
});

test('journal restart preserves owner-scoped first End and full snapshot', async () => {
  let raw: string | null = null;
  const storage = { getItem: () => raw, setItem: (_key: string, value: string) => { raw = value; } };
  const first = new OutdoorEndJournal(storage);
  const command = { workoutInstanceId: 'recording-hiking', endedAt: 60_001 };
  first.retain({ ownerUserId: 'A', command, activity: captureOutdoorCompletion(fixture(), command) });
  await first.pending('A', () => true);
  const restored = new OutdoorEndJournal(storage);
  assert.equal((await restored.pending('A', () => true))[0]?.activity?.metrics.rawHeartRateSamples?.length, 1);
  assert.deepEqual(await restored.pending('B', () => true), []);
  await restored.acknowledge('B', command.workoutInstanceId, () => true);
  assert.equal((await restored.pending('A', () => true)).length, 1);
});

test('an outdoor End arriving during another commit is disk-retained and drained without a timer', async () => {
  const h = harness();
  let release!: () => void;
  let notifyBlocked!: () => void;
  const blocked = new Promise<void>(resolve => { notifyBlocked = resolve; });
  let first = true;
  h.commitGate(async () => {
    if (!first) return;
    first = false; notifyBlocked(); await new Promise<void>(resolve => { release = resolve; });
  });
  const old = h.api.completeOutdoorCommand({ workoutInstanceId: 'recording-hiking', endedAt: 60_001 });
  await blocked;
  h.bind(fixture('cycling', 'arrived'));
  const arrived = h.api.completeOutdoorCommand({ workoutInstanceId: 'arrived', endedAt: 50_001 });
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(JSON.parse(h.data.get(OUTDOOR_END_JOURNAL_KEY)!).map((item: { command: { workoutInstanceId: string } }) => item.command.workoutInstanceId), ['recording-hiking', 'arrived']);
  release();
  await old; await arrived;
  assert.equal(h.activities.length, 2);
  assert.equal(h.activities.find(value => value.workoutInstanceId === 'arrived')?.endTime, 50_001);
  assert.ok(!h.events.includes('discard:recording-hiking'));
  assert.ok(h.events.includes('discard:arrived'));
  assert.deepEqual(JSON.parse(h.data.get(OUTDOOR_END_JOURNAL_KEY)!), []);
});

test('snapshot pause union clips before-start, overlapping and future intervals before calculating duration', () => {
  const state = fixture();
  state.recordingPauses = [{ startTime: -10_000, endTime: 5_001 }, { startTime: 4_001, endTime: 10_001 },
    { startTime: 50_001, endTime: 100_001 }, { startTime: 55_001, endTime: 90_001 }];
  const draft = captureOutdoorCompletion(state, { workoutInstanceId: state.workoutInstanceId!, endedAt: 60_001 });
  assert.equal(draft.metrics.durationSeconds, 40);
  assert.deepEqual(draft.metrics.recordingPauses, [{ startTime: 1, endTime: 10_001 }, { startTime: 50_001, endTime: 60_001 }]);
  assert.equal(state.recordingPauses[0]?.startTime, -10_000);
});

test('a queued End excludes later phone GPS totals and never bridges a recorded pause', () => {
  const state = fixture();
  state.aggregate.points.push({ latitude: 0, longitude: 0.002, timestamp: 70_001, accuracyMeters: 5 });
  state.aggregate.distanceMeters = 999;
  const paused = captureOutdoorCompletion(state, { workoutInstanceId: state.workoutInstanceId!, endedAt: 60_001 });
  assert.equal(paused.metrics.distanceMeters, 0);
  assert.equal(paused.metrics.routeCoordinates?.length, 2);
  state.recordingPauses = [];
  const continuous = captureOutdoorCompletion(state, { workoutInstanceId: state.workoutInstanceId!, endedAt: 60_001 });
  assert.ok(continuous.metrics.distanceMeters! > 110 && continuous.metrics.distanceMeters! < 112);
  assert.ok(continuous.metrics.distanceMeters! < 999);
});

test('immediate and delayed End snapshots produce identical pause-aware GPS totals and route metrics', () => {
  for (const paused of [false, true]) {
    const state = fixture('hiking');
    if (!paused) state.recordingPauses = [];
    // Simulate the same already-accumulated GPS distance before either End delivery.
    state.aggregate.distanceMeters = 111.19492664455875;
    const command = { workoutInstanceId: state.workoutInstanceId!, endedAt: 60_001 };
    const immediate = captureOutdoorCompletion(state, command);
    state.aggregate.points.push({ latitude: 0, longitude: 0.002, timestamp: 70_001, altitudeMeters: 99 });
    state.aggregate.distanceMeters = 999;
    state.aggregate.elevationGainMeters = 99;
    const delayed = captureOutdoorCompletion(state, command);
    assert.deepEqual(delayed.metrics, immediate.metrics);
    if (paused) assert.equal(immediate.metrics.distanceMeters, 0);
    else assert.ok(immediate.metrics.distanceMeters! > 110 && immediate.metrics.distanceMeters! < 112);
  }
});

test('actual active-store normal writes and cleanup flush serialize so an old clear cannot overwrite a newer start', async () => {
  const data = new Map<string, string>();
  const lease = { ownerUserId: 'A', generation: 1 };
  let releaseClear!: () => void;
  let notifyClear!: () => void;
  const clearStarted = new Promise<void>(resolve => { notifyClear = resolve; });
  let gated = false;
  let writes = 0;
  let maximumConcurrentWrites = 0;
  const storeModule = load<typeof import('../../src/store/activeActivityStore')>({
    '@react-native-async-storage/async-storage': {},
    './persistStorage': { getAppStorage: () => ({ getItem: async (key: string) => data.get(key) ?? null,
      removeItem: async (key: string) => { data.delete(key); },
      setItem: async (key: string, value: string) => {
        writes++; maximumConcurrentWrites = Math.max(maximumConcurrentWrites, writes);
        const snapshot = JSON.parse(value).state;
        if (!gated && !snapshot.isActive && snapshot.activityId === null) {
          gated = true; notifyClear(); await new Promise<void>(resolve => { releaseClear = resolve; });
        }
        data.set(key, value); writes--;
      } }) },
    '../lib/localDataOwner': { ownerLeaseIsCurrent: (value: unknown) => value === lease },
    './settingsStore': { useSettingsStore: { getState: () => ({ autoPauseMode: 'off' }) } },
    '../lib/voiceCue': { enqueueVoiceCue: () => {} },
  }, '../../src/store/activeActivityStore');
  const store = storeModule.useActiveActivityStore;
  if (!store.persist.hasHydrated()) await new Promise<void>(resolve => { const off = store.persist.onFinishHydration(() => { off(); resolve(); }); });
  store.getState().start({ activityType: 'hiking', workoutInstanceId: 'old' });
  store.getState().discard();
  const oldFlush = storeModule.awaitActiveActivityPersistence(lease);
  await clearStarted;
  store.getState().start({ activityType: 'cycling', workoutInstanceId: 'new' });
  releaseClear();
  await oldFlush;
  await storeModule.awaitActiveActivityPersistence(lease);
  assert.equal(JSON.parse(data.get('active-activity-store')!).state.workoutInstanceId, 'new');
  assert.equal(store.getState().workoutInstanceId, 'new');
  assert.equal(maximumConcurrentWrites, 1);
});

test('real outdoor GPS cleanup rechecks after native await and orders a newer start after an in-flight stop', async () => {
  let releaseRead!: (value: boolean) => void;
  let releaseStop!: () => void;
  let delayRead = true;
  let delayStop = false;
  let allowed = true;
  let started = true;
  const events: string[] = [];
  const state = { activityType: 'hiking', completionRequestedAt: null as number | null };
  const gps = load<typeof import('../../src/lib/activityGpsTracking')>({
    'expo-task-manager': { defineTask: () => {} },
    'expo-location': { Accuracy: { BestForNavigation: 1 }, ActivityType: { Fitness: 1, OtherNavigation: 2 },
      hasStartedLocationUpdatesAsync: () => delayRead ? new Promise<boolean>(resolve => { releaseRead = resolve; }) : Promise.resolve(started),
      stopLocationUpdatesAsync: async () => { events.push('stop'); if (delayStop) await new Promise<void>(resolve => { releaseStop = resolve; }); started = false; },
      startLocationUpdatesAsync: async () => { events.push('start'); started = true; },
      requestForegroundPermissionsAsync: async () => ({ status: 'granted' }), requestBackgroundPermissionsAsync: async () => ({ status: 'granted' }),
    },
    '../store/activeActivityStore': { useActiveActivityStore: { getState: () => state } },
    './trackingTaskHydration': { waitForPersistedStoreHydration: async () => {} },
  }, '../../src/lib/activityGpsTracking');
  const stale = gps.stopActivityLocationTrackingWhen(() => allowed);
  await new Promise(resolve => setImmediate(resolve)); allowed = false; releaseRead(true);
  assert.equal(await stale, false); assert.deepEqual(events, []);
  delayRead = false; delayStop = true; allowed = true;
  const oldStop = gps.stopActivityLocationTrackingWhen(() => allowed);
  await new Promise(resolve => setImmediate(resolve));
  const newStart = gps.startActivityLocationTracking(); releaseStop();
  await oldStop; await newStart;
  assert.deepEqual(events, ['stop', 'start']); assert.equal(started, true);
  state.completionRequestedAt = 60_001;
  assert.equal(await gps.resumeActivityLocationTrackingIfPermitted(), false);
});

test('workout-state subscribes before native buffer flush, and outdoor End has no screen request consumer', () => {
  const bridge = readFileSync('src/components/watch/WatchWorkoutBridge.tsx', 'utf8');
  const effect = bridge.slice(bridge.indexOf("if (Platform.OS !== 'ios') return undefined;"));
  assert.ok(effect.indexOf('const workoutStateSub') < effect.indexOf('const statusSub'));
  assert.ok(effect.indexOf('const workoutStateSub') < effect.indexOf('const heartRateSub'));
  assert.ok(effect.indexOf('const workoutStateSub') < effect.indexOf('activateStrideWatchConnectivity()'));
  assert.match(bridge, /completeWatchActivityEnd\(\{ workoutInstanceId: instance, endedAt: event.timestamp/);
  assert.doesNotMatch(bridge, /useActiveActivityStore.getState\(\).requestCompletion\(\)/);
  const ui = readFileSync('app/(tabs)/activity/start.tsx', 'utf8');
  const save = ui.slice(ui.indexOf('async function saveAndFinish()'), ui.indexOf('function finish()'));
  assert.match(save, /await completeOutdoorCommand/);
  assert.doesNotMatch(save, /stopActivityLocationTracking|addActivity\(|clearCompletionRequest|\.discard\(/);
});
