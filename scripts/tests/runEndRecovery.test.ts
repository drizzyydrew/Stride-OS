import assert from 'node:assert/strict';
import Module from 'node:module';
import test from 'node:test';
import { createJSONStorage } from 'zustand/middleware';
import { estimateDistanceMiles, resolveFinalDistance } from '../../src/utils/treadmill';
import { RunEndRetryQueue, RUN_END_RETRY_KEY } from '../../src/lib/runEndRetryQueue';

test('End transport persists first timestamp/totals, survives relaunch, and isolates owners', async () => {
  const data = new Map<string, string>();
  const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } };
  const queue = new RunEndRetryQueue(storage);
  queue.retain({ ownerUserId: 'A', command: { workoutInstanceId: 'one', endedAt: 100, distanceMiles: 1,
    watchRecording: { workoutInstanceId: 'one', confirmedAt: 100, state: 'ended' } } });
  queue.retain({ ownerUserId: 'A', command: { workoutInstanceId: 'one', endedAt: 200, distanceMiles: 2 } });
  queue.retain({ ownerUserId: 'B', command: { workoutInstanceId: 'two', endedAt: 300 } });
  assert.equal((await queue.pending('A', () => true))[0]?.command.endedAt, 100);
  assert.equal(JSON.parse(data.get(RUN_END_RETRY_KEY)!).length, 1);
  const restored = new RunEndRetryQueue(storage);
  assert.equal((await restored.pending('A', () => true))[0]?.command.distanceMiles, 1);
  assert.equal((await restored.pending('A', () => true))[0]?.command.watchRecording?.workoutInstanceId, 'one');
  await restored.acknowledge('A', 'one', () => false);
  assert.equal((await restored.pending('A', () => true)).length, 1);
  await restored.acknowledge('A', 'one', () => true);
  assert.equal((await restored.pending('A', () => true)).length, 0);
});

test('failed or unreadable transport storage retains retry instead of clearing it', async () => {
  let raw: string | null = null;
  let fail = true;
  const queue = new RunEndRetryQueue({ getItem: () => raw, setItem: (_key, value) => {
    if (fail) throw new Error('locked'); raw = value;
  } });
  queue.retain({ ownerUserId: 'A', command: { workoutInstanceId: 'one', endedAt: 100 } });
  await assert.rejects(queue.pending('A', () => true), /locked/);
  fail = false;
  assert.equal((await queue.pending('A', () => true)).length, 1);
  raw = 'broken';
  await assert.rejects(queue.pending('A', () => true));
  assert.equal(raw, 'broken');
});

function loadWithMocks<T>(path: string, mocks: Record<string, unknown>): T {
  const loader = Module as unknown as { _load: (id: string, ...args: unknown[]) => unknown };
  const original = loader._load;
  delete require.cache[require.resolve(path)];
  loader._load = function (id, ...args) {
    return Object.hasOwn(mocks, id) ? mocks[id] : original.call(this, id, ...args);
  };
  try { return require(path); } finally { loader._load = original; }
}

test('indoor Watch End durably freezes first End and confirmed segments without bypassing treadmill confirmation', async () => {
  const data = new Map<string, string>();
  const storage = { getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); }, removeItem: (key: string) => { data.delete(key); } };
  const { useActiveRunStore: store, activeRunElapsedSeconds } = loadWithMocks<typeof import('../../src/store/activeRunStore')>(
    '../../src/store/activeRunStore', {
      '@react-native-async-storage/async-storage': {},
      './persistStorage': { createAppJSONStorage: () => createJSONStorage(() => storage) },
      './settingsStore': { useSettingsStore: { getState: () => ({ autoPauseMode: 'off' }) } },
      '../lib/voiceCue': { enqueueVoiceCue: () => {} },
    });
  const lease = { ownerUserId: 'A', generation: 1 };
  const events: string[] = [];
  const history: { workoutInstanceId: string; ownerUserId: string; actualEndTime: number; distanceMiles: number; distanceSource: string }[] = [];
  store.setState({ isActive: true, environment: 'indoor', workoutInstanceId: 'treadmill', startTime: 100_000,
    treadmillSegments: [{ speedMph: 6, startedAtMs: 100_000, endedAtMs: 800_000 },
      { speedMph: 8, startedAtMs: 800_000, endedAtMs: null }],
    recordingPauses: [], isPaused: false, pausedAt: null, pausedDurationMs: 0 });
  const adapter = loadWithMocks<typeof import('../../src/lib/watchRunCompletion')>('../../src/lib/watchRunCompletion', {
    '../../modules/stride-watch-connectivity/src': { endStrideWatchWorkoutIfMatching: async () => { events.push('watch'); } },
    '../../modules/stride-live-activity/src': { endStrideRunLiveActivityIfMatching: async () => { events.push('native'); return true; } },
    '../store/activeRunStore': { useActiveRunStore: store },
    '../store/workoutStore': { useWorkoutStore: { persist: { hasHydrated: () => true }, getState: () => ({ history,
      pendingRunDiscards: async () => [], getRunDiscardResult: async () => null,
      acknowledgeRunCleanup: async () => { events.push('ack'); } }) } },
    '../store/persistStorage': { getAppStorage: () => storage },
    './localDataOwner': { captureOwnerLease: () => lease, getLocalDataOwner: () => lease, ownerLeaseIsCurrent: (value: unknown) => value === lease },
    './runCompletionCommand': { completeRunCommand: async () => {
      assert.equal(history.length, 1, 'automatic commit must not precede sheet confirmation');
      events.push('recommit-confirmed');
      return { status: 'saved', entry: history[0], activityId: 'activity', ownerLease: lease };
    } },
    './gpsTracking': { stopLocationTrackingWhen: async (guard: () => boolean) => guard() },
  });
  assert.equal(await adapter.completeWatchRunEnd({ workoutInstanceId: 'treadmill', endedAt: 700_000,
    distanceMiles: 99, elapsedSeconds: 600 }), false);
  assert.deepEqual(events, []);
  assert.equal(JSON.parse(data.get(RUN_END_RETRY_KEY)!)[0].command.endedAt, 700_000);
  assert.equal(JSON.parse(data.get('active-run-store-v1')!).state.completionRequestedAt, 700_000);
  assert.equal(store.getState().isActive, true);
  assert.equal(store.getState().isPaused, true);
  assert.equal(activeRunElapsedSeconds(store.getState(), 9_000_000), 600);
  const estimate = estimateDistanceMiles(store.getState().treadmillSegments, 9_000_000);
  assert.equal(estimate, 1);
  store.getState().resumeRun();
  assert.equal(store.getState().isPaused, true);
  assert.equal(await adapter.completeWatchRunEnd({ workoutInstanceId: 'treadmill', endedAt: 900_000, distanceMiles: 100 }), false);
  assert.equal(store.getState().completionRequestedAt, 700_000);
  assert.equal(estimateDistanceMiles(store.getState().treadmillSegments), 1);
  assert.deepEqual(events, []);
  const manual = resolveFinalDistance({ estimateMiles: estimate, enteredMiles: 1.2, choice: 'manual_entry' });
  assert.equal(manual.distanceSource, 'manual_entry');
  history.push({ workoutInstanceId: 'treadmill', ownerUserId: 'A', actualEndTime: 700_000,
    distanceMiles: manual.distanceMiles, distanceSource: manual.distanceSource });
  await adapter.recoverRunEndCommands();
  assert.deepEqual(events, ['recommit-confirmed', 'native', 'watch', 'ack']);
  assert.equal(history[0].distanceMiles, 1.2);
  assert.equal(history[0].distanceSource, 'manual_entry');
  assert.deepEqual(JSON.parse(data.get(RUN_END_RETRY_KEY)!), []);
});

test('exact native cleanup succeeds for absent/disabled capability without calling a legacy unscoped End', async () => {
  let legacyCalls = 0;
  let exactCalls = 0;
  for (const native of [null, { end: async () => { legacyCalls++; } },
    { isAvailable: () => false, endOutdoorIfMatching: async (instance: string) => {
      assert.equal(instance, 'exact'); exactCalls++; return true;
    } }]) {
    const api = loadWithMocks<typeof import('../../modules/stride-live-activity/src')>('../../modules/stride-live-activity/src', {
      'react-native': { Platform: { OS: 'ios' }, NativeModules: {}, NativeEventEmitter: class {} },
      'expo-modules-core': { requireNativeModule: () => { if (!native) throw new Error('unavailable'); return native; } },
    });
    assert.equal(await api.endStrideRunLiveActivityIfMatching('exact'), true);
    await api.endStrideRunLiveActivity({ workoutInstanceId: 'old', sessionId: 'old', runName: 'Run', elapsedSeconds: 10,
      distanceMiles: 0, averagePace: '--', heartRate: 0, zoneLabel: '--', zoneStatus: 'unknown', status: 'Finished' });
  }
  assert.equal(exactCalls, 1);
  assert.equal(legacyCalls, 0);
});

test('durable discard tombstones resolve late Ends before missing-session or indoor-confirmation branches', async () => {
  for (const scenario of ['missing', 'indoor', 'newer'] as const) {
    const data = new Map<string, string>();
    const events: string[] = [];
    const lease = { ownerUserId: 'A', generation: 1 };
    const run = { isActive: scenario !== 'missing', workoutInstanceId: scenario === 'newer' ? 'new' : 'discarded',
      environment: 'indoor', requestCompletion: () => { throw new Error('discard must not reopen confirmation'); },
      finishRun: () => { events.push('finish'); run.isActive = false; } };
    const resolved = { status: 'discarded', activityId: null, ownerLease: lease,
      entry: { workoutInstanceId: 'discarded', actualEndTime: 100 } };
    const adapter = loadWithMocks<typeof import('../../src/lib/watchRunCompletion')>('../../src/lib/watchRunCompletion', {
      '../../modules/stride-watch-connectivity/src': { endStrideWatchWorkoutIfMatching: async (id: string) => { events.push(`watch:${id}`); } },
      '../../modules/stride-live-activity/src': { endStrideRunLiveActivityIfMatching: async (id: string) => { events.push(`native:${id}`); return true; } },
      '../store/activeRunStore': { useActiveRunStore: { persist: { hasHydrated: () => true }, getState: () => run } },
      '../store/workoutStore': { useWorkoutStore: { persist: { hasHydrated: () => true }, getState: () => ({ history: [],
        pendingRunDiscards: async () => [], // Already acknowledged; only the durable tombstone remains.
        getRunDiscardResult: async (id: string) => id === 'discarded' ? resolved : null,
        acknowledgeRunCleanup: async () => { events.push('ack'); },
      }) } },
      '../store/persistStorage': { getAppStorage: () => ({ getItem: (key: string) => data.get(key) ?? null,
        setItem: (key: string, value: string) => { data.set(key, value); } }) },
      './localDataOwner': { captureOwnerLease: () => lease, getLocalDataOwner: () => lease, ownerLeaseIsCurrent: (value: unknown) => value === lease },
      './runCompletionCommand': { completeRunCommand: async () => { throw new Error('must not resave discarded recording'); } },
      './gpsTracking': { stopLocationTrackingWhen: async (guard: () => boolean) => { if (guard()) events.push('gps'); return guard(); } },
    });
    assert.equal(await adapter.completeWatchRunEnd({ workoutInstanceId: 'discarded', endedAt: 200 }), true);
    assert.deepEqual(JSON.parse(data.get(RUN_END_RETRY_KEY)!), []);
    assert.ok(events.includes('native:discarded') && events.includes('watch:discarded') && events.includes('ack'));
    assert.equal(events.includes('finish'), scenario === 'indoor');
    if (scenario === 'newer') {
      assert.equal(run.workoutInstanceId, 'new');
      assert.equal(run.isActive, true);
      assert.ok(!events.includes('gps'));
    }
    const afterCleanup = [...events];
    await adapter.recoverRunEndCommands();
    assert.deepEqual(events, afterCleanup);
  }
});

test('global Watch End retries failed completion, then cleans/acknowledges only after durable save', async () => {
  const events: string[] = [];
  const data = new Map<string, string>();
  let failSave = true;
  let generation = 1;
  let replaceDuringEnd = false;
  let changeOwnerDuringEnd = false;
  let pendingDiscards: { ownerUserId: string; discarded: boolean; entry: { workoutInstanceId: string; actualEndTime: number } }[] = [];
  const run = { isActive: true, workoutInstanceId: 'old' as string | null, finishRun: () => {
    events.push('finish'); run.isActive = false; run.workoutInstanceId = null;
  } };
  const lease = () => ({ ownerUserId: 'A', generation });
  const workout = { history: [], pendingRunDiscards: async () => pendingDiscards,
    getRunDiscardResult: async (instance: string) => {
      const item = pendingDiscards.find(value => value.entry.workoutInstanceId === instance);
      return item ? { status: 'discarded', activityId: null, entry: item.entry, ownerLease: lease() } : null;
    },
    acknowledgeRunCleanup: async () => { events.push('ack'); pendingDiscards = []; } };
  const adapter = loadWithMocks<typeof import('../../src/lib/watchRunCompletion')>('../../src/lib/watchRunCompletion', {
    '../../modules/stride-watch-connectivity/src': { endStrideWatchWorkoutIfMatching: async (id: string) => { events.push(`watch:${id}`); } },
    '../../modules/stride-live-activity/src': { endStrideRunLiveActivityIfMatching: async (id: string) => {
      events.push(`native:${id}`);
      if (replaceDuringEnd) run.workoutInstanceId = 'new';
      if (changeOwnerDuringEnd) generation++;
      return true;
    } },
    '../store/activeRunStore': { useActiveRunStore: { persist: { hasHydrated: () => true }, getState: () => run } },
    '../store/workoutStore': { useWorkoutStore: { persist: { hasHydrated: () => true }, getState: () => workout } },
    '../store/persistStorage': { getAppStorage: () => ({ getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => { data.set(key, value); } }) },
    './localDataOwner': { captureOwnerLease: lease, getLocalDataOwner: () => ({ ownerUserId: 'A' }),
      ownerLeaseIsCurrent: (value: { generation: number } | null) => value?.generation === generation },
    './runCompletionCommand': { completeRunCommand: async (command: { endedAt: number; workoutInstanceId: string }) => {
      events.push(`save:${command.endedAt}`);
      if (failSave) throw new Error('disk unavailable');
      return { status: 'saved', entry: command, activityId: 'activity', ownerLease: lease() };
    } },
    './gpsTracking': { stopLocationTrackingWhen: async (guard: () => boolean) => { if (guard()) events.push('gps'); return guard(); } },
  });
  await assert.rejects(adapter.completeWatchRunEnd({ workoutInstanceId: 'old', endedAt: 100 }), /disk/);
  assert.deepEqual(events, ['save:100']);
  failSave = false;
  assert.equal(await adapter.completeWatchRunEnd({ workoutInstanceId: 'old', endedAt: 200 }), true);
  assert.deepEqual(events, ['save:100', 'save:100', 'native:old', 'watch:old', 'gps', 'finish', 'ack']);
  assert.deepEqual(JSON.parse(data.get(RUN_END_RETRY_KEY)!), []);

  events.length = 0;
  run.isActive = true; run.workoutInstanceId = 'old'; replaceDuringEnd = true;
  assert.equal(await adapter.completeWatchRunEnd({ workoutInstanceId: 'old', endedAt: 300 }), true);
  assert.equal(run.workoutInstanceId, 'new');
  assert.ok(!events.includes('gps') && !events.includes('finish'));
  assert.ok(events.includes('native:old') && events.includes('watch:old'));

  events.length = 0;
  replaceDuringEnd = false;
  pendingDiscards = [{ ownerUserId: 'A', discarded: true, entry: { workoutInstanceId: 'discard', actualEndTime: 350 } }];
  await adapter.recoverRunEndCommands();
  assert.deepEqual(events, ['native:discard', 'watch:discard', 'ack']);
  assert.equal(run.workoutInstanceId, 'new');

  events.length = 0;
  changeOwnerDuringEnd = true;
  assert.equal(await adapter.completeWatchRunEnd({ workoutInstanceId: 'old', endedAt: 400 }), false);
  assert.ok(!events.includes('watch:old') && !events.includes('ack') && !events.includes('finish'));
  assert.equal(JSON.parse(data.get(RUN_END_RETRY_KEY)!).length, 1);
});

test('an unknown older End stays retained without blocking a later valid durable completion', async () => {
  const events: string[] = [];
  const unknown = { ownerUserId: 'A', command: { workoutInstanceId: 'unknown-old', endedAt: 100 } };
  const data = new Map<string, string>([[RUN_END_RETRY_KEY, JSON.stringify([unknown])]]);
  const lease = { ownerUserId: 'A', generation: 1 };
  const run = { isActive: true, workoutInstanceId: 'valid-new' as string | null, finishRun: () => {
    events.push('finish:valid-new'); run.isActive = false; run.workoutInstanceId = null;
  } };
  const adapter = loadWithMocks<typeof import('../../src/lib/watchRunCompletion')>('../../src/lib/watchRunCompletion', {
    '../../modules/stride-watch-connectivity/src': { endStrideWatchWorkoutIfMatching: async (id: string) => { events.push(`watch:${id}`); } },
    '../../modules/stride-live-activity/src': { endStrideRunLiveActivityIfMatching: async (id: string) => { events.push(`native:${id}`); return true; } },
    '../store/activeRunStore': { useActiveRunStore: { persist: { hasHydrated: () => true }, getState: () => run } },
    '../store/workoutStore': { useWorkoutStore: { persist: { hasHydrated: () => true }, getState: () => ({
      history: [], pendingRunDiscards: async () => [], getRunDiscardResult: async () => null,
      acknowledgeRunCleanup: async (id: string) => { events.push(`ack:${id}`); },
    }) } },
    '../store/persistStorage': { getAppStorage: () => ({ getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => { data.set(key, value); } }) },
    './localDataOwner': { captureOwnerLease: () => lease, getLocalDataOwner: () => ({ ownerUserId: 'A' }),
      ownerLeaseIsCurrent: (value: unknown) => value === lease },
    './runCompletionCommand': { completeRunCommand: async (command: { workoutInstanceId: string; endedAt: number }) => {
      events.push(`complete:${command.workoutInstanceId}`);
      if (command.workoutInstanceId === 'unknown-old') throw new Error('End does not match the active recording');
      // Stand in for B's separately tested durable commit boundary.
      data.set('durable-history', JSON.stringify(command));
      events.push(`durable:${command.workoutInstanceId}`);
      return { status: 'saved', entry: command, activityId: 'valid-activity', ownerLease: lease };
    } },
    './gpsTracking': { stopLocationTrackingWhen: async (guard: () => boolean) => { assert.ok(guard()); events.push('gps'); return true; } },
  });
  assert.equal(await adapter.completeWatchRunEnd({ workoutInstanceId: 'valid-new', endedAt: 200 }), true);
  assert.deepEqual(JSON.parse(data.get('durable-history')!), { workoutInstanceId: 'valid-new', endedAt: 200 });
  assert.deepEqual(events, ['complete:unknown-old', 'complete:valid-new', 'durable:valid-new',
    'native:valid-new', 'watch:valid-new', 'gps', 'finish:valid-new', 'ack:valid-new']);
  assert.deepEqual(JSON.parse(data.get(RUN_END_RETRY_KEY)!), [unknown]);
  await assert.rejects(adapter.recoverRunEndCommands(), /does not match/);
  assert.equal(events.filter(event => event === 'complete:unknown-old').length, 2);
  assert.equal(events.filter(event => event === 'complete:valid-new').length, 1);
  assert.ok(!events.includes('native:unknown-old') && !events.includes('ack:unknown-old'));
  assert.deepEqual(JSON.parse(data.get(RUN_END_RETRY_KEY)!), [unknown]);
});

test('End arriving during an empty in-flight sweep is persisted before joining and drained without a timer', async () => {
  const data = new Map<string, string>();
  const events: string[] = [];
  const lease = { ownerUserId: 'A', generation: 1 };
  let releaseEmptySweep!: (value: []) => void;
  let notifyEmptyRead!: () => void;
  let notifyPersisted!: () => void;
  const emptyRead = new Promise<void>(resolve => { notifyEmptyRead = resolve; });
  const persisted = new Promise<void>(resolve => { notifyPersisted = resolve; });
  let firstSweep = true;
  const run = { isActive: true, workoutInstanceId: 'arrived' as string | null, finishRun: () => {
    events.push('finish'); run.isActive = false; run.workoutInstanceId = null;
  } };
  const adapter = loadWithMocks<typeof import('../../src/lib/watchRunCompletion')>('../../src/lib/watchRunCompletion', {
    '../../modules/stride-watch-connectivity/src': { endStrideWatchWorkoutIfMatching: async () => { events.push('watch'); } },
    '../../modules/stride-live-activity/src': { endStrideRunLiveActivityIfMatching: async () => { events.push('native'); return true; } },
    '../store/activeRunStore': { useActiveRunStore: { persist: { hasHydrated: () => true }, getState: () => run } },
    '../store/workoutStore': { useWorkoutStore: { persist: { hasHydrated: () => true }, getState: () => ({ history: [],
      getRunDiscardResult: async () => null,
      pendingRunDiscards: async () => {
        if (!firstSweep) return [];
        firstSweep = false;
        notifyEmptyRead();
        return new Promise<[]>(resolve => { releaseEmptySweep = resolve; });
      },
      acknowledgeRunCleanup: async () => { events.push('ack'); },
    }) } },
    '../store/persistStorage': { getAppStorage: () => ({ getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => {
        data.set(key, value);
        if (key === RUN_END_RETRY_KEY && JSON.parse(value).some((item: { command: { workoutInstanceId: string } }) => item.command.workoutInstanceId === 'arrived')) notifyPersisted();
      } }) },
    './localDataOwner': { captureOwnerLease: () => lease, getLocalDataOwner: () => ({ ownerUserId: 'A' }), ownerLeaseIsCurrent: (value: unknown) => value === lease },
    './runCompletionCommand': { completeRunCommand: async (command: { workoutInstanceId: string; endedAt: number }) => {
      assert.equal(JSON.parse(data.get(RUN_END_RETRY_KEY)!)[0]?.command.workoutInstanceId, 'arrived');
      events.push('durable-completion');
      data.set('durable-history', JSON.stringify(command));
      return { status: 'saved', entry: command, activityId: 'activity', ownerLease: lease };
    } },
    './gpsTracking': { stopLocationTrackingWhen: async (guard: () => boolean) => { assert.ok(guard()); events.push('gps'); return true; } },
  });
  const initialSweep = adapter.recoverRunEndCommands();
  await emptyRead;
  let settled = false;
  const end = adapter.completeWatchRunEnd({ workoutInstanceId: 'arrived', endedAt: 500 }).finally(() => { settled = true; });
  await persisted;
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(settled, false);
  assert.deepEqual(events, []);
  assert.deepEqual(JSON.parse(data.get(RUN_END_RETRY_KEY)!), [{ ownerUserId: 'A', command: { workoutInstanceId: 'arrived', endedAt: 500 } }]);
  releaseEmptySweep([]);
  await initialSweep;
  assert.equal(await end, true);
  assert.equal(JSON.parse(data.get('durable-history')!).workoutInstanceId, 'arrived');
  assert.deepEqual(events, ['durable-completion', 'native', 'watch', 'gps', 'finish', 'ack']);
  assert.deepEqual(JSON.parse(data.get(RUN_END_RETRY_KEY)!), []);
});

test('real GPS adapter checks ownership after native await and serializes a newer start behind an old stop', async () => {
  let releaseRead!: (value: boolean) => void;
  let releaseStop!: () => void;
  let hasStarted = true;
  let guarded = true;
  let delayRead = true;
  let delayStop = false;
  const events: string[] = [];
  const gps = loadWithMocks<typeof import('../../src/lib/gpsTracking')>('../../src/lib/gpsTracking', {
    'expo-task-manager': { defineTask: () => {} },
    'expo-location': { Accuracy: { BestForNavigation: 1 }, ActivityType: { Fitness: 1 },
      hasStartedLocationUpdatesAsync: () => delayRead ? new Promise<boolean>(resolve => { releaseRead = resolve; }) : Promise.resolve(hasStarted),
      stopLocationUpdatesAsync: async () => { events.push('stop'); if (delayStop) await new Promise<void>(resolve => { releaseStop = resolve; }); hasStarted = false; },
      startLocationUpdatesAsync: async () => { events.push('start'); hasStarted = true; },
      requestForegroundPermissionsAsync: async () => ({ status: 'granted' }), requestBackgroundPermissionsAsync: async () => ({ status: 'granted' }),
    },
    '../store/activeRunStore': { useActiveRunStore: {} }, './trackingTaskHydration': { waitForPersistedStoreHydration: async () => {} },
  });
  const staleStop = gps.stopLocationTrackingWhen(() => guarded);
  await new Promise(resolve => setImmediate(resolve));
  guarded = false; releaseRead(true);
  assert.equal(await staleStop, false);
  assert.deepEqual(events, []);
  delayRead = false; delayStop = true; guarded = true;
  const oldStop = gps.stopLocationTrackingWhen(() => guarded);
  await new Promise(resolve => setImmediate(resolve));
  const newStart = gps.startLocationTracking();
  releaseStop();
  await oldStop; await newStart;
  assert.deepEqual(events, ['stop', 'start']);
  assert.equal(hasStarted, true);
});
