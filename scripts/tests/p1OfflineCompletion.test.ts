import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { createJSONStorage } from 'zustand/middleware';
import { LocalDataOwner, LOCAL_DATA_OWNER_KEY } from '../../src/lib/localDataOwner';
import { RunCompletionJournal, RUN_COMPLETION_JOURNAL_KEY, type PendingRunCompletion } from '../../src/lib/runCompletionJournal';
import { matchingWatchRecording, mergeRecording, runCompletionKey, sameRecording, type RunWorkoutRecord } from '../../src/utils/runCompletionIdentity';
import { activityFromWorkoutRecord, migrateLegacyWorkoutHistory } from '../../src/utils/activityMigration';
import { buildHealthKitActivityDraft, isDuplicateHealthKitWorkout, type HealthKitWorkoutCandidate } from '../../src/utils/healthKitImport';
import type { Activity, ActivityMetrics } from '../../src/types/activity';
import { elapsedSecondsExcludingPause } from '../../src/utils/activeTime';
import { captureTrainingRunEnd } from '../../src/utils/trainingRunEndSnapshot';
import { RunEndRetryQueue } from '../../src/lib/runEndRetryQueue';
import type { ActiveRunStore } from '../../src/store/activeRunStore';
import { capturedRunTelemetryMetrics } from '../../src/utils/capturedRunTelemetryMetrics';
import { safePaceSecPerMile } from '../../src/utils/treadmill';
import { paceSecPerMileToSecPerKm } from '../../src/utils/units';

function phoneTelemetryFixture(startedAt: number, endedAt: number) {
  const timestamps = [startedAt, Math.floor((startedAt + endedAt) / 2), endedAt, endedAt + 1_000];
  return {
    rawHeartRateSamples: timestamps.map(timestamp => ({ timestamp, bpm: 145, source: 'apple_watch' as const })),
    cadenceSamples: timestamps.map(timestamp => ({ timestamp, cadenceSpm: 172, kind: 'steps' as const, source: 'apple_watch' as const })),
    powerSamples: timestamps.map(timestamp => ({ timestamp, watts: 230, kind: 'measured' as const, sport: 'running' as const, source: 'apple_watch' as const })),
    recordingPauses: [], telemetryStartedAt: startedAt, telemetryEndedAt: null,
  };
}

function assertPhoneEndTelemetry(metrics: Partial<ActivityMetrics> | undefined, startedAt: number, endedAt: number) {
  assert.ok(metrics, 'the actual Save entry must carry captured activityMetrics');
  const expected = phoneTelemetryFixture(startedAt, endedAt);
  for (const key of ['rawHeartRateSamples', 'cadenceSamples', 'powerSamples'] as const) {
    assert.deepEqual(metrics[key], expected[key].filter(sample => sample.timestamp <= endedAt),
      `${key} must retain the original observations through End, excluding later samples`);
  }
}

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    values,
    getItem: async (key: string) => values.get(key) ?? null,
    setItem: async (key: string, value: string) => { values.set(key, value); },
    removeItem: async (key: string) => { values.delete(key); },
  };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
async function ownerA() {
  const storage = memoryStorage();
  const owner = new LocalDataOwner(storage);
  await owner.initialize('A', async () => true);
  await owner.accept('A');
  return { owner, storage };
}

// Execute the real stores/services with native I/O replaced, not source-pattern assertions.
function loadSource(file: string, mocks: Record<string, unknown>) {
  const filename = path.resolve(file);
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} as any };
  const nativeRequire = createRequire(filename);
  const require = (id: string) => Object.hasOwn(mocks, id) ? mocks[id] : nativeRequire(id);
  vm.runInNewContext(compiled, { module, exports: module.exports, require, console, setTimeout, clearTimeout, URL, Date, process: { env: {} } }, { filename });
  return module.exports;
}

test('actual cold-navigation Stop uses persisted time and reports the durable first-End snapshot on retry', async () => {
  const source = fs.readFileSync('app/(tabs)/training/index.tsx', 'utf8');
  const parsed = ts.createSourceFile('index.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let stop: ts.FunctionDeclaration | undefined;
  function visit(node: ts.Node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === 'stop') stop = node;
    ts.forEachChild(node, visit);
  }
  visit(parsed);
  assert.ok(stop, 'the real screen completion handler must exist');
  const now = 1_000_000;
  const events: string[] = [];
  const state = { workoutInstanceId: 'cold-run', startTime: now - 620_000,
    ...phoneTelemetryFixture(now - 620_000, now),
    recordingPauses: [{ startTime: now - 100_000, endTime: now - 80_000 }],
    completionRequestedAt: now, isPaused: true, pausedAt: now, pausedDurationMs: 20_000, distanceMiles: 1.25, coordinates: [],
    requestCompletion: (endedAt: number) => {
      events.push('freeze');
      assert.equal(endedAt, now, 'a prior requested End is retained');
    } };
  let submitted: any;
  let nativeEnd: any;
  let finished = false;
  const context: Record<string, any> = {
    environment: 'outdoor', stopInFlightRef: { current: false },
    useActiveRunStore: { getState: () => state },
    capturedRunTelemetryMetrics,
    activeRunElapsedSeconds: (saved: typeof state, endedAt: number) => elapsedSecondsExcludingPause({
      startedAt: saved.startTime, isPaused: saved.isPaused, pausedAt: saved.pausedAt,
      pausedDurationMs: saved.pausedDurationMs,
    }, endedAt),
    captureOwnerLease: () => ({ ownerUserId: 'A', generation: 1 }), ownerLeaseIsCurrent: () => true,
    liveRunCompletionKey: () => 'run_cold-run', todayPlannedSession: null, runMode: 'quick',
    saveLiveRun: async (entry: any) => {
      assert.deepEqual(events, ['freeze'], 'the actual phone handler freezes before awaiting history');
      events.push('save');
      submitted = entry;
    },
    // A preceding failed write already journaled a shorter first-End snapshot.
    useWorkoutStore: { getState: () => ({ history: [{ workoutInstanceId: 'cold-run',
      actualDurationMinutes: 9.5, durationMinutes: 9.5, actualDistanceMiles: 1.2 }] }) },
    currentWeek: 1, fatigueScore: 0, recoveryScore: 0, setFatigueScore() {}, setRecentEasyLoad() {},
    selectedRoute: null, liveActivitySnapshot: { elapsedSeconds: 0 },
    endRunLiveActivity: async (value: any) => { nativeEnd = value; },
    endStrideWatchRun: async () => {}, setWatchStatus() {}, stopLocationTrackingWhen: async () => true,
    speakCue() {}, finishRun: () => { finished = true; }, setElapsed() {}, setRouteSegmentIndex() {},
    maxRouteProgressRef: { current: 0 }, segmentStartRef: { current: null }, onFinished: undefined,
    Alert: { alert: (...args: unknown[]) => { assert.notEqual(args[0], 'Run not yet saved'); } }, console,
  };
  const compiled = ts.transpileModule(`${stop.getText(parsed)}\nglobalThis.runStop = stop;`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  vm.runInNewContext(compiled, context);
  await context.runStop();
  assert.equal(submitted.durationMinutes, 10, 'persisted start/pause, not a reset screen timer');
  assert.equal(submitted.workoutInstanceId, 'cold-run');
  assert.equal(submitted.actualEndTime, now, 'persisted End is not replaced by time of screen navigation');
  assertPhoneEndTelemetry(submitted.activityMetrics, state.startTime, now);
  assert.equal(nativeEnd.elapsedSeconds, 570, 'retry reports the durable first-End duration');
  assert.equal(nativeEnd.distanceMiles, 1.2);
  assert.equal(finished, true);
  assert.deepEqual(events, ['freeze', 'save']);
  assert.equal(context.stopInFlightRef.current, false);
});

for (const handler of ['training-save', 'training-short-discard', 'tracking-save', 'tracking-short-discard', 'tracking-discard'] as const) {
  for (const change of ['new-recording', 'owner-revoked', 'unchanged'] as const) {
    test(`actual ${handler} rechecks ${change} after the awaited native GPS lookup`, async () => {
      const training = handler.startsWith('training');
      const file = training ? 'app/(tabs)/training/index.tsx' : 'app/(tabs)/training/run-tracking.tsx';
      const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      let body: ts.Node | undefined;
      function visit(node: ts.Node) {
        if (training && ts.isFunctionDeclaration(node) && node.name?.text === 'stop') body = node;
        if (!training && ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
          if ((handler === 'tracking-save' || handler === 'tracking-short-discard') && node.name.text === 'confirmEnd') body = node.initializer;
          if (handler === 'tracking-discard' && node.name.text === 'handleCancel'
            && node.initializer && ts.isCallExpression(node.initializer)) body = node.initializer.arguments[0];
        }
        ts.forEachChild(node, visit);
      }
      visit(source);
      assert.ok(body, 'execute the real handler, not a replica');
      const now = 1_000_000;
      const duration = handler.endsWith('short-discard') ? 180 : 600;
      const requiresFreeze = handler !== 'tracking-discard';
      const events: string[] = [];
      let state = { workoutInstanceId: 'old-recording', startTime: now - duration * 1000,
        ...phoneTelemetryFixture(now - duration * 1000, now),
        completionRequestedAt: null as number | null, isPaused: false, pausedAt: null as number | null,
        distanceMiles: 1.25, coordinates: [], averagePaceSecPerMile: 480,
        requestCompletion: (endedAt: number) => {
          events.push('freeze');
          assert.equal(endedAt, now);
          state = { ...state, completionRequestedAt: state.completionRequestedAt ?? endedAt, isPaused: true, pausedAt: endedAt };
        } };
      let ownerCurrent = true;
      let nativeStops = 0;
      let clears = 0;
      let navigations = 0;
      let saves = 0;
      let discards = 0;
      let savedEntry: any;
      const queried = deferred<void>();
      const nativeRead = deferred<boolean>();
      const persistenceEntered = deferred<void>();
      const persisted = deferred<void>();
      const persistRecording = async (kind: 'save' | 'discard', entry: any) => {
        assert.deepEqual(events, requiresFreeze ? ['freeze'] : [], 'freeze must precede the actual save/discard await');
        assert.equal(entry.actualEndTime, now);
        if (requiresFreeze) {
          assert.equal(state.isPaused, true);
          assert.equal(state.pausedAt, now);
          assert.equal(state.completionRequestedAt, now);
        }
        events.push(kind);
        if (kind === 'save') { saves += 1; savedEntry = entry; }
        else discards += 1;
        persistenceEntered.resolve();
        await persisted.promise;
      };
      // Run the real shared operation queue and conditional stop around delayed native I/O.
      const gps = loadSource('src/lib/gpsTracking.ts', {
        'expo-task-manager': { defineTask() {} },
        'expo-location': { Accuracy: { BestForNavigation: 1 }, ActivityType: { Fitness: 1 },
          hasStartedLocationUpdatesAsync: async () => { queried.resolve(); return nativeRead.promise; },
          stopLocationUpdatesAsync: async () => { nativeStops += 1; },
          requestForegroundPermissionsAsync: async () => ({ status: 'granted' }),
          requestBackgroundPermissionsAsync: async () => ({ status: 'granted' }),
          startLocationUpdatesAsync: async () => { assert.fail('the newer run already owns active GPS'); } },
        '../store/activeRunStore': { useActiveRunStore: { getState: () => state } },
        './trackingTaskHydration': { waitForPersistedStoreHydration: async () => {} },
      });
      let discard: (() => Promise<void>) | undefined;
      const context: Record<string, any> = {
        environment: 'outdoor', stopInFlightRef: { current: false }, finishInFlightRef: { current: false },
        capturedRunTelemetryMetrics,
        useActiveRunStore: { getState: () => state }, activeRunElapsedSeconds: (snapshot: typeof state) => {
          if (requiresFreeze) assert.equal(snapshot.isPaused, true, 'elapsed time is read from the post-freeze snapshot');
          return duration;
        }, Date: { now: () => now },
        captureOwnerLease: () => ({ ownerUserId: 'A', generation: 1 }), ownerLeaseIsCurrent: () => ownerCurrent,
        liveRunCompletionKey: () => 'run_old-recording', runCompletionKey: () => 'run_old-recording',
        todayPlannedSession: null, runMode: 'quick', selectedRoute: null,
        saveLiveRun: (entry: any) => persistRecording('save', entry), useWorkoutStore: { getState: () => ({ history: [],
          discardRunEnd: (entry: any) => persistRecording('discard', entry) }) },
        currentWeek: 1, fatigueScore: 0, recoveryScore: 0, setFatigueScore() {}, setRecentEasyLoad() {},
        liveActivitySnapshot: {}, endRunLiveActivity: async () => {}, formatPace: () => '8:00',
        endStrideWatchRun: async () => {}, setWatchStatus() {}, stopLocationTrackingWhen: gps.stopLocationTrackingWhen,
        speakCue() {}, enqueueVoiceCue() {}, finishRun: () => { clears += 1; }, cancelRun: () => { clears += 1; },
        setElapsed() {}, setRouteSegmentIndex() {}, maxRouteProgressRef: { current: 0 },
        segmentStartRef: { current: null }, onFinished: undefined, router: { back: () => { navigations += 1; } },
        Alert: { alert: (title: string, _message: string, actions?: any[]) => {
          assert.notEqual(title, 'Run not yet saved');
          discard = actions?.find(action => action.text === 'Discard')?.onPress;
        } }, console,
      };
      const declaration = training ? `${body.getText(source)}\nglobalThis.invoke = stop;`
        : `globalThis.invoke = ${body.getText(source)};`;
      vm.runInNewContext(ts.transpileModule(declaration, {
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
      }).outputText, context);
      let operation: Promise<void>;
      if (handler === 'tracking-discard') {
        context.invoke();
        assert.ok(discard);
        operation = discard();
      } else operation = context.invoke();
      await persistenceEntered.promise;
      assert.equal(clears, 0, 'a pending durable write cannot clear the recording');
      assert.equal(nativeStops, 0);
      assert.deepEqual(events, requiresFreeze ? ['freeze', handler.endsWith('save') ? 'save' : 'discard'] : ['discard']);
      persisted.resolve();
      await queried.promise;
      if (change === 'new-recording') state = { ...state, workoutInstanceId: 'new-recording', startTime: now };
      if (change === 'owner-revoked') ownerCurrent = false;
      const newStart = change === 'new-recording' ? gps.startLocationTracking() : Promise.resolve();
      nativeRead.resolve(true);
      await Promise.all([operation, newStart]);
      const current = change === 'unchanged';
      assert.equal(nativeStops, current ? 1 : 0, 'old completion cannot stop GPS after ownership changes');
      assert.equal(clears, current ? 1 : 0, 'old completion cannot clear the newer run or inaccessible owner');
      assert.equal(navigations, current && !training ? 1 : 0);
      assert.equal(saves, handler.endsWith('save') ? 1 : 0);
      assert.equal(discards, handler.endsWith('discard') ? 1 : 0, 'discard is journaled before native cleanup');
      if (handler.endsWith('save')) assertPhoneEndTelemetry(savedEntry.activityMetrics, now - duration * 1000, now);
      assert.equal(context.stopInFlightRef.current, false);
      assert.equal(context.finishInFlightRef.current, false);
    });
  }
}

for (const fail of [false, true]) {
  test(`actual short indoor sheet confirmation ${fail ? 'retains the recording on discard write failure' : 'journals discard before native cleanup'}`, async () => {
    const file = 'app/(tabs)/training/index.tsx';
    const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    let handler: ts.FunctionDeclaration | undefined;
    function visit(node: ts.Node) {
      if (ts.isFunctionDeclaration(node) && node.name?.text === 'completeIndoorRun') handler = node;
      ts.forEachChild(node, visit);
    }
    visit(source);
    assert.ok(handler);
    const events: string[] = [];
    const state = { workoutInstanceId: 'indoor-sheet', startTime: 100_000 };
    const context: Record<string, any> = {
      stopInFlightRef: { current: false }, setShowTreadmillCompletion() {},
      treadmillCompletionRef: { current: { ...state, startedAt: state.startTime, endedAt: 160_000, movingSeconds: 60 } },
      useActiveRunStore: { getState: () => state }, captureOwnerLease: () => ({ ownerUserId: 'A', generation: 1 }),
      capturedRunTelemetryMetrics,
      ownerLeaseIsCurrent: () => true, liveRunCompletionKey: () => 'run_indoor-sheet', todayPlannedSession: null,
      useWorkoutStore: { getState: () => ({ discardRunEnd: async (entry: any) => {
        events.push('discard');
        assert.equal(entry.actualEndTime, 160_000);
        assert.equal(entry.indoor, true);
        assert.equal(entry.distanceSource, 'treadmill_reported');
        if (fail) throw new Error('disk locked');
      } }) }, currentWeek: 1, fatigueScore: 0, recoveryScore: 70,
      liveActivitySnapshot: {}, endRunLiveActivity: async () => { events.push('native'); },
      endStrideWatchRun: async () => { events.push('watch'); }, setWatchStatus() {},
      finishRun: () => { events.push('finish'); }, setElapsed() {}, onFinished: undefined,
      Alert: { alert: (title: string) => { assert.equal(title, fail ? 'Run not yet saved' : 'Run discarded'); } }, console,
    };
    vm.runInNewContext(ts.transpileModule(`${handler.getText(source)}\nglobalThis.invoke = completeIndoorRun;`, {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    }).outputText, context);
    await context.invoke({ distanceMiles: 0.1, distanceSource: 'treadmill_reported' });
    assert.deepEqual(events, fail ? ['discard'] : ['discard', 'native', 'watch', 'finish']);
    assert.equal(context.stopInFlightRef.current, false);
    if (fail) assert.ok(context.treadmillCompletionRef.current, 'the sheet retains its original first-End snapshot');
  });
}

test('actual confirmed indoor Save retains End-bounded telemetry without changing sheet distance authority', async () => {
  const file = 'app/(tabs)/training/index.tsx';
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let handler: ts.FunctionDeclaration | undefined;
  function visit(node: ts.Node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === 'completeIndoorRun') handler = node;
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.ok(handler);
  for (const distanceSource of ['treadmill_reported', 'manual_entry', 'confirmed_speed_estimate'] as const) {
    const startedAt = 100_000;
    const endedAt = 700_000;
    const state = { workoutInstanceId: 'confirmed-indoor', startTime: startedAt, environment: 'indoor',
      isPaused: true, pausedAt: endedAt, ...phoneTelemetryFixture(startedAt, endedAt) };
    let saved: any;
    const events: string[] = [];
    const context: Record<string, any> = {
      stopInFlightRef: { current: false }, setShowTreadmillCompletion() {},
      treadmillCompletionRef: { current: { workoutInstanceId: state.workoutInstanceId, startedAt, endedAt, movingSeconds: 600 } },
      useActiveRunStore: { getState: () => state }, capturedRunTelemetryMetrics,
      captureOwnerLease: () => ({ ownerUserId: 'A', generation: 1 }), ownerLeaseIsCurrent: () => true,
      liveRunCompletionKey: () => 'run_confirmed-indoor', todayPlannedSession: null, runMode: 'quick',
      safePaceSecPerMile, paceSecPerMileToSecPerKm,
      saveLiveRun: async (entry: any) => { saved = entry; events.push('save'); },
      useWorkoutStore: { getState: () => ({ history: [] }) },
      currentWeek: 1, fatigueScore: 0, recoveryScore: 70, setFatigueScore() {}, setRecentEasyLoad() {},
      liveActivitySnapshot: {}, endRunLiveActivity: async () => { events.push('native'); },
      endStrideWatchRun: async () => { events.push('watch'); }, setWatchStatus() {}, speakCue() {},
      finishRun: () => { events.push('finish'); }, setElapsed() {}, onFinished: undefined,
      Alert: { alert: (title: string) => { assert.equal(title, 'Run saved'); } }, console,
    };
    vm.runInNewContext(ts.transpileModule(`${handler.getText(source)}\nglobalThis.invoke = completeIndoorRun;`, {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    }).outputText, context);
    await context.invoke({ distanceMiles: 2, distanceSource, originalEstimatedDistanceMiles: 1.25 });
    assert.deepEqual(events, ['save', 'native', 'watch', 'finish']);
    assertPhoneEndTelemetry(saved.activityMetrics, startedAt, endedAt);
    assert.equal(saved.distanceMiles, 2, 'the sheet result, not telemetry, remains authoritative');
    assert.equal(saved.distanceSource, distanceSource);
    assert.equal(saved.indoor, true);
    assert.equal(saved.activitySubtype, 'treadmill');
    assert.equal(saved.durationMinutes, 10);
    assert.equal(saved.actualEndTime, endedAt);
    assert.equal(saved.activityMetrics.originalEstimatedDistanceMiles, 1.25);
    assert.equal(saved.activityMetrics.pace.averageSecondsPerKilometer, paceSecPerMileToSecPerKm(300));
  }
});

function trainingEndFixture(): ActiveRunStore {
  return { isActive: true, workoutInstanceId: 'snapshot-run', environment: 'outdoor', startTime: 100_000,
    isPaused: false, pausedAt: null, pausedDurationMs: 0, distanceMiles: 99,
    recordingPauses: [], rawHeartRateSamples: [], cadenceSamples: [], powerSamples: [], plannedWorkout: null,
    coordinates: [{ lat: 0, lng: 0, timestamp: 100_000 },
      { lat: 180 / Math.PI / 3958.8, lng: 0, timestamp: 700_000 }],
  } as unknown as ActiveRunStore;
}

test('captured Training telemetry keeps bounded elevation gain/loss and clipped wall/active time', () => {
  const startedAt = 100_000;
  const endedAt = 130_000;
  const state = { ...trainingEndFixture(), ...phoneTelemetryFixture(startedAt, endedAt), startTime: startedAt,
    coordinates: [{ lat: 0, lng: 0, timestamp: startedAt, altitudeM: 100 },
      { lat: 0.0001, lng: 0, timestamp: startedAt + 10_000, altitudeM: 103 },
      { lat: 0.0002, lng: 0, timestamp: startedAt + 20_000, altitudeM: 101 },
      { lat: 0.0003, lng: 0, timestamp: endedAt, altitudeM: 105 },
      { lat: 0.0004, lng: 0, timestamp: endedAt + 10_000, altitudeM: 999 }] };
  const original = structuredClone({ rawHeartRateSamples: state.rawHeartRateSamples, coordinates: state.coordinates });
  const metrics = capturedRunTelemetryMetrics(state, endedAt);
  assertPhoneEndTelemetry(metrics, startedAt, endedAt);
  assert.equal(metrics.elevationGainMeters, 7);
  assert.equal(metrics.elevationLossMeters, 2);
  assert.equal(metrics.metricSources?.elevation, 'phone_gps');
  assert.equal(metrics.elapsedTimeSeconds, 30);
  assert.equal(metrics.activeTimeSeconds, 30);
  const projected = activityFromWorkoutRecord({ ...record, actualStartTime: startedAt, actualEndTime: endedAt,
    durationMinutes: 0.5, actualDurationMinutes: 0.5, routeCoordinates: state.coordinates.filter(point => point.timestamp <= endedAt),
    activityMetrics: metrics }, false);
  assert.equal(projected.metrics.elevationGainMeters, 7);
  assert.equal(projected.metrics.elevationLossMeters, 2);
  assertPhoneEndTelemetry(projected.metrics, startedAt, endedAt);
  assert.deepEqual({ rawHeartRateSamples: state.rawHeartRateSamples, coordinates: state.coordinates }, original);
  metrics.rawHeartRateSamples![0].bpm = 200;
  assert.equal(state.rawHeartRateSamples[0].bpm, 145, 'captured raw samples are independent of live store objects');
});

test('captured Training elevation does not bridge pauses or GPS gaps and leaves missing altitude unavailable', () => {
  const startedAt = 100_000;
  const endedAt = 230_000;
  const state = { ...trainingEndFixture(), ...phoneTelemetryFixture(startedAt, endedAt), startTime: startedAt,
    recordingPauses: [{ startTime: 112_000, endTime: 118_000 }, { startTime: 114_000, endTime: 116_000 },
      { startTime: 250_000, endTime: 280_000 }],
    coordinates: [{ lat: 0, lng: 0, timestamp: 100_000, altitudeM: 100 },
      { lat: 0.0001, lng: 0, timestamp: 110_000, altitudeM: 103 },
      { lat: 0.0002, lng: 0, timestamp: 120_000, altitudeM: 500 },
      { lat: 0.0003, lng: 0, timestamp: 130_000, altitudeM: 502 },
      { lat: 0.0004, lng: 0, timestamp: 220_000, altitudeM: 900 },
      { lat: 0.0005, lng: 0, timestamp: 230_000, altitudeM: 904 }] };
  const metrics = capturedRunTelemetryMetrics(state, endedAt);
  assert.equal(metrics.elevationGainMeters, 9, 'only continuous measured pairs contribute 3 + 2 + 4');
  assert.equal(metrics.elevationLossMeters, 0, 'zero loss has genuine measured altitude-pair coverage');
  assert.equal(metrics.elapsedTimeSeconds, 130);
  assert.equal(metrics.activeTimeSeconds, 124, 'overlapping pause intervals are counted once; future pause excluded');
  const absent = capturedRunTelemetryMetrics({ ...state,
    coordinates: state.coordinates.map(({ altitudeM: _altitude, ...point }) => point) }, endedAt);
  assert.equal(absent.elevationGainMeters, undefined);
  assert.equal(absent.elevationLossMeters, undefined);
  assert.equal(absent.metricSources?.elevation, undefined);
  const gapOnly = capturedRunTelemetryMetrics({ ...state, coordinates: [state.coordinates[0], state.coordinates[4]] }, endedAt);
  assert.equal(gapOnly.elevationGainMeters, undefined, 'isolated altitude readings across a gap are not a measured pair');
  assert.equal(gapOnly.elevationLossMeters, undefined);
  const futureOnly = capturedRunTelemetryMetrics({ ...state, coordinates: [
    { lat: 0, lng: 0, timestamp: endedAt, altitudeM: 100 },
    { lat: 0.0001, lng: 0, timestamp: endedAt + 10_000, altitudeM: 105 }] }, endedAt);
  assert.equal(futureOnly.elevationGainMeters, undefined);
});

test('Training Run snapshot clips and unions pauses, omits future observations, and keeps explicit Watch totals', () => {
  const state = trainingEndFixture();
  const end = { workoutInstanceId: state.workoutInstanceId!, endedAt: 700_000 };
  const gps = captureTrainingRunEnd(state, end);
  assert.ok(Math.abs(gps.distanceMiles - 1) < 1e-12, 'phone distance comes from End-bounded fixes, not the scalar 99');
  state.recordingPauses = [{ startTime: 90_000, endTime: 160_000 }, { startTime: 130_000, endTime: 220_000 },
    { startTime: 710_000, endTime: 900_000 }];
  state.isPaused = true;
  state.pausedAt = 800_000;
  state.pausedDurationMs = 999_000;
  state.rawHeartRateSamples = [{ timestamp: 800_000, bpm: 150, source: 'apple_watch' }];
  const watch = captureTrainingRunEnd(state, { ...end, distanceMiles: 1.4 });
  assert.equal(watch.durationMinutes, 8, 'overlap counted once, future pause excluded');
  assert.equal(watch.distanceMiles, 1.4);
  assert.deepEqual(watch.activityMetrics?.recordingPauses, [{ startTime: 100_000, endTime: 220_000 }]);
  assert.equal(watch.activityMetrics?.rawHeartRateSamples, undefined);
  assert.equal(watch.activityMetrics?.metricSources?.distance, 'apple_watch');
  assert.equal(captureTrainingRunEnd(state, { ...end, distanceMiles: 1.4, elapsedSeconds: 570 }).durationMinutes, 9.5);
  assert.equal(captureTrainingRunEnd(state, end).distanceMiles, 0, 'do not bridge GPS distance across a recorded pause');
});

test('actual Training Run command captures before hydration awaits and cannot adopt a newer recording', async () => {
  let state = trainingEndFixture();
  let ready = false;
  let finishHydration: (() => void) | undefined;
  const lease = { ownerUserId: 'A', generation: 1 };
  const athlete = { currentWeek: 1, fatigueScore: 0, recoveryScore: 70, setFatigueScore() {}, setRecentEasyLoad() {} };
  const store = { history: [], getRunDiscardResult: async () => null,
    commitRunEnd: async (entry: any) => ({ status: 'saved', entry, activityId: 'activity', ownerLease: lease }) };
  const hydrated = (value: unknown) => ({ persist: { hasHydrated: () => true }, getState: () => value });
  const command = loadSource('src/lib/runCompletionCommand.ts', {
    '../store/activeRunStore': { useActiveRunStore: { ...hydrated(state), getState: () => state } },
    '../store/workoutStore': { useWorkoutStore: { getState: () => store,
      persist: { hasHydrated: () => ready, onFinishHydration: (callback: () => void) => { finishHydration = callback; return () => {}; } } } },
    '../store/activityStore': { useActivityStore: hydrated({}) }, '../store/athleteStore': { useAthleteStore: hydrated(athlete) },
    './localDataOwner': { captureOwnerLease: () => lease, ownerLeaseIsCurrent: (value: unknown) => value === lease },
  });
  const original = { workoutInstanceId: 'snapshot-run', endedAt: 700_000 };
  const operation = command.completeRunCommand(original);
  state.coordinates.push({ lat: 2 * 180 / Math.PI / 3958.8, lng: 0, timestamp: 900_000 });
  state.recordingPauses.push({ startTime: 750_000, endTime: 850_000 });
  original.endedAt = 900_000;
  state = { ...state, workoutInstanceId: 'new-indoor', environment: 'indoor' };
  ready = true;
  assert.ok(finishHydration);
  finishHydration();
  const result = await operation;
  assert.equal(result.entry.actualEndTime, 700_000);
  assert.equal(result.entry.durationMinutes, 10);
  assert.ok(Math.abs(result.entry.distanceMiles - 1) < 1e-12);
  assert.equal(result.entry.routeCoordinates.length, 2);
  assert.equal(state.workoutInstanceId, 'new-indoor');
});

test('Training Run retry transport deep-copies full first snapshot and restores it after failed persistence', async () => {
  const storage = memoryStorage();
  let fail = true;
  const disk = { ...storage, setItem: async (key: string, value: string) => {
    if (fail) throw new Error('transport disk unavailable');
    await storage.setItem(key, value);
  } };
  const queue = new RunEndRetryQueue(disk);
  const command = { workoutInstanceId: 'snapshot-run', endedAt: 700_000,
    snapshot: { ...captureTrainingRunEnd(trainingEndFixture(), { workoutInstanceId: 'snapshot-run', endedAt: 700_000 }), ownerUserId: 'A' } };
  queue.retain({ ownerUserId: 'A', command });
  await assert.rejects(queue.pending('A', () => true), /transport disk unavailable/);
  command.snapshot.distanceMiles = 99;
  command.snapshot.routeCoordinates![0].lat = 20;
  command.snapshot.actualEndTime = 900_000;
  fail = false;
  await queue.pending('A', () => true);
  const restored = (await new RunEndRetryQueue(disk).pending('A', () => true))[0].command;
  assert.equal(restored.snapshot?.actualEndTime, 700_000);
  assert.ok(Math.abs(restored.snapshot!.distanceMiles - 1) < 1e-12);
  assert.equal(restored.snapshot?.routeCoordinates?.[0].lat, 0);
  assert.throws(() => queue.retain({ ownerUserId: 'B', command: restored }), /owner/);
});

test('actual Training Run freeze rejects post-failure backdated sensor arrivals before a direct retry', async () => {
  const storage = memoryStorage();
  const run = loadSource('src/store/activeRunStore.ts', {
    '@react-native-async-storage/async-storage': {},
    './persistStorage': { createAppJSONStorage: () => createJSONStorage(() => storage) },
    './settingsStore': { useSettingsStore: { getState: () => ({ autoPauseMode: 'off' }) } },
    '../lib/voiceCue': { enqueueVoiceCue() {} },
  }).useActiveRunStore;
  await new Promise(resolve => setImmediate(resolve));
  const state = trainingEndFixture();
  run.setState({ ...state, rawHeartRateSamples: [{ timestamp: 600_000, bpm: 140, source: 'apple_watch' }] });
  let fail = true;
  const entries: any[] = [];
  const lease = { ownerUserId: 'A', generation: 1 };
  const hydrated = (value: unknown) => ({ persist: { hasHydrated: () => true }, getState: () => value });
  const command = loadSource('src/lib/runCompletionCommand.ts', {
    '../store/activeRunStore': { useActiveRunStore: run },
    '../store/workoutStore': { useWorkoutStore: hydrated({ history: [], getRunDiscardResult: async () => null,
      commitRunEnd: async (entry: any) => {
        entries.push(JSON.parse(JSON.stringify(entry)));
        if (fail) throw new Error('journal disk unavailable');
        return { status: 'saved', entry, activityId: 'activity', ownerLease: lease };
      } }) },
    '../store/activityStore': { useActivityStore: hydrated({}) },
    '../store/athleteStore': { useAthleteStore: hydrated({ currentWeek: 1, fatigueScore: 0, recoveryScore: 70,
      setFatigueScore() {}, setRecentEasyLoad() {} }) },
    './localDataOwner': { captureOwnerLease: () => lease, ownerLeaseIsCurrent: (value: unknown) => value === lease },
  });
  const end = { workoutInstanceId: 'snapshot-run', endedAt: 700_000 };
  await assert.rejects(command.completeRunCommand(end), /journal disk unavailable/);
  assert.equal(run.getState().isActive, true);
  assert.equal(run.getState().completionRequestedAt, 700_000);
  run.getState().appendTelemetry('snapshot-run', { rawHeartRateSamples: [{ timestamp: 650_000, bpm: 190, source: 'apple_watch' }] });
  run.getState().addLocationUpdate({ timestamp: 650_000, coords: { latitude: 1, longitude: 1, accuracy: 5 } });
  run.getState().pauseRun();
  run.getState().resumeRun();
  assert.equal(run.getState().rawHeartRateSamples.length, 1);
  assert.equal(run.getState().coordinates.length, 2);
  fail = false;
  await command.completeRunCommand(end);
  assert.deepEqual(entries[1], entries[0], 'even pre-End observations arriving after failure cannot change the first payload');
});

function authHarness(options: { cachedId?: string | null; sessionError?: unknown; storage?: ReturnType<typeof memoryStorage>;
  hasExistingData?: boolean; cachedReadFails?: boolean; recover?: () => Promise<void>;
  credentials?: () => Promise<void>; apple?: () => Promise<unknown>; browser?: () => Promise<unknown> } = {}) {
  const storage = options.storage ?? memoryStorage();
  const owner = new LocalDataOwner(storage);
  const sessionFor = (id: string) => ({ user: { id }, access_token: 'synthetic-access', refresh_token: 'synthetic-refresh', expires_at: 1 });
  let explicitDepth = 0;
  let cache = options.cachedId === null ? null : sessionFor(options.cachedId ?? 'A');
  let clearCalls = 0;
  let credentialCalls = 0;
  let callbackCalls = 0;
  let listener: ((event: string, session: unknown) => void) | null = null;
  const client = { auth: {
    getSession: async () => ({ data: { session: options.sessionError ? null : cache }, error: options.sessionError ?? null }),
    onAuthStateChange: (callback: typeof listener) => { listener = callback; },
    stopAutoRefresh: () => {}, startAutoRefresh: () => {},
    signOut: async () => ({ error: { name: 'AuthRetryableFetchError' } }),
    signInWithPassword: async ({ email }: { email: string }) => {
      credentialCalls += 1;
      await options.credentials?.();
      cache = sessionFor(email);
      listener?.('SIGNED_IN', cache);
      return { data: { session: cache }, error: null };
    },
    signUp: async () => { credentialCalls += 1; await options.credentials?.(); return { data: { session: sessionFor('A') }, error: null }; },
    signInWithIdToken: async () => { credentialCalls += 1; await options.credentials?.(); return { data: { session: sessionFor('A') }, error: null }; },
    signInWithOAuth: async () => ({ data: { url: 'https://example.test/auth' }, error: null }),
  } };
  const exported = loadSource('src/store/authStore.ts', {
    '@supabase/supabase-js': { isAuthRetryableFetchError: (error: any) => error?.name === 'AuthRetryableFetchError' },
    'expo-apple-authentication': { signInAsync: options.apple, AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 } },
    'expo-web-browser': { openAuthSessionAsync: options.browser },
    '../lib/supabase': {
      localDataOwner: owner, getSupabaseAvailability: () => ({ status: 'available', client }),
      initializeLocalOwnership: async () => {
        if (options.cachedReadFails) throw new Error('device locked');
        await owner.initialize(cache?.user.id ?? null, async () => options.hasExistingData ?? true);
        return cache;
      },
      readCachedSupabaseSession: async () => cache,
      clearCachedSupabaseSession: async () => { clearCalls += 1; cache = null; },
      hasRetainedLocalData: async () => options.hasExistingData ?? true,
      isExplicitAuthAttempt: () => explicitDepth > 0,
      withExplicitAuthAttempt: async (action: () => Promise<unknown>) => { explicitDepth += 1; try { return await action(); } finally { explicitDepth -= 1; } },
    },
    '../lib/authRedirect': { hydrateUserData: async () => {}, authRedirectUrl: () => 'strideos://auth/callback',
      completeSupabaseAuthFromUrl: async () => { callbackCalls += 1; return { error: null }; } },
    './workoutStore': { useWorkoutStore: { getState: () => ({ restorePendingCompletions: options.recover ?? (async () => {}) }) } },
    './strengthStore': {}, './customWorkoutStore': {}, './checkInStore': {},
  });
  return { store: exported.useAuthStore, owner, storage, clearCalls: () => clearCalls,
    credentialCalls: () => credentialCalls, callbackCalls: () => callbackCalls };
}

test('late password/signup/Apple credentials cannot reopen a completed logout', async () => {
  for (const method of ['signIn', 'signUp', 'signInWithApple'] as const) {
    const response = deferred<void>();
    const harness = authHarness({ credentials: () => response.promise,
      apple: async () => ({ identityToken: 'synthetic-token' }) });
    await harness.store.getState().initialize();
    const operation = harness.store.getState()[method]('A', 'synthetic');
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(harness.credentialCalls(), 1);
    await harness.store.getState().signOut();
    response.resolve();
    assert.match(await operation, /cancelled/);
    assert.equal(harness.store.getState().canAccessLocalData, false);
    assert.equal(harness.owner.logoutFenced, true);
    assert.equal(JSON.parse(harness.storage.values.get(LOCAL_DATA_OWNER_KEY)!).logoutFence, true);
  }
});

test('late Apple consent and OAuth browser returns never exchange credentials after logout', async () => {
  for (const method of ['signInWithApple', 'signInWithGoogle'] as const) {
    const response = deferred<unknown>();
    const harness = authHarness({ apple: () => response.promise, browser: () => response.promise });
    await harness.store.getState().initialize();
    const operation = harness.store.getState()[method]();
    await new Promise(resolve => setImmediate(resolve));
    await harness.store.getState().signOut();
    response.resolve(method === 'signInWithApple' ? { identityToken: 'synthetic-token' } : { type: 'success', url: 'strideos://auth/callback' });
    assert.match(await operation, /cancelled/);
    assert.equal(harness.credentialCalls(), 0);
    assert.equal(harness.callbackCalls(), 0);
    assert.equal(harness.owner.logoutFenced, true);
  }
});

test('an older explicit sign-in cannot publish after a newer attempt succeeds', async () => {
  const first = deferred<void>();
  let calls = 0;
  const harness = authHarness({ cachedId: 'a', credentials: async () => { if (++calls === 1) await first.promise; } });
  await harness.store.getState().initialize();
  const older = harness.store.getState().signIn('a', 'synthetic');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(await harness.store.getState().signIn('a', 'synthetic'), null);
  first.resolve();
  assert.match(await older, /cancelled/);
  assert.equal(harness.store.getState().user.id, 'a');
  assert.equal(harness.store.getState().canAccessLocalData, true);
});

test('actual auth bootstrap allows owner A offline without fabricating a live session', async () => {
  const harness = authHarness({ sessionError: { name: 'AuthRetryableFetchError' } });
  await harness.store.getState().initialize();
  const state = harness.store.getState();
  assert.equal(state.loading, false);
  assert.equal(state.canAccessLocalData, true);
  assert.equal(state.localAccessStatus, 'offline');
  assert.equal(state.offlineOwnerId, 'A');
  assert.equal(state.session, null);
});

test('actual auth distinguishes invalid refresh and inaccessible storage from offline access', async () => {
  const invalid = authHarness({ sessionError: { name: 'AuthApiError', code: 'refresh_token_not_found' } });
  await invalid.store.getState().initialize();
  assert.equal(invalid.store.getState().localAccessStatus, 'invalid');
  assert.equal(invalid.store.getState().canAccessLocalData, false);
  const locked = authHarness({ cachedReadFails: true });
  await locked.store.getState().initialize();
  assert.equal(locked.store.getState().loading, false);
  assert.equal(locked.store.getState().localAccessStatus, 'storage-error');
  assert.equal(locked.store.getState().canAccessLocalData, false);
});

test('actual offline logout clears credentials and its durable fence blocks restart or B adoption', async () => {
  const harness = authHarness();
  await harness.store.getState().initialize();
  await harness.store.getState().signOut();
  assert.equal(harness.clearCalls(), 1);
  assert.equal(harness.store.getState().canAccessLocalData, false);
  const restarted = authHarness({ storage: harness.storage, cachedId: 'A' });
  await restarted.store.getState().initialize();
  assert.equal(restarted.store.getState().canAccessLocalData, false);
  assert.match(await restarted.store.getState().signIn('B', 'synthetic'), /another account/);
  assert.equal(restarted.store.getState().canAccessLocalData, false);
  assert.equal(restarted.store.getState().user, null);
  assert.equal(restarted.store.getState().session, null);
});

test('SDK storage establishes ownership before a new login can replace the legacy cache', async () => {
  const secure = memoryStorage();
  const local = memoryStorage();
  local.values.set('workout-store', JSON.stringify({ state: { history: [{ id: 'legacy' }] } }));
  const key = 'sb-example-auth-token';
  const session = (id: string) => ({ user: { id }, access_token: 'synthetic-access', refresh_token: 'synthetic-refresh' });
  secure.values.set(key, JSON.stringify(session('A')));
  let adapter: any;
  const exported = loadSource('src/lib/supabase.ts', {
    'react-native': { Platform: { OS: 'ios' }, AppState: { addEventListener: () => ({ remove: () => {} }) } },
    'expo-secure-store': { getItemAsync: secure.getItem, setItemAsync: secure.setItem, deleteItemAsync: secure.removeItem },
    '@react-native-async-storage/async-storage': { ...local, getAllKeys: async () => [...local.values.keys()] },
    '@supabase/supabase-js': { createClient: (_url: string, _key: string, options: any) => {
      adapter = options.auth.storage;
      return { auth: { startAutoRefresh: () => {}, stopAutoRefresh: () => {} } };
    } },
    './supabaseAvailability': {
      resolveSupabaseConfig: () => ({ status: 'configured', supabaseUrl: 'https://example.supabase.co', supabaseAnonKey: 'synthetic-public' }),
      createSupabaseAvailability: (_config: unknown, create: any) => ({ status: 'available', client: create('https://example.supabase.co', 'synthetic-public') }),
    },
    './localDataOwner': { configureLocalDataOwner: (storage: any) => new LocalDataOwner(storage), LOCAL_DATA_OWNER_KEY },
  });
  exported.getSupabaseAvailability();
  await exported.withExplicitAuthAttempt(() => adapter.setItem(key, JSON.stringify(session('B'))));
  assert.equal(exported.localDataOwner.ownerUserId, 'A');
  assert.equal(JSON.parse(secure.values.get(key)!).user.id, 'A');
  await exported.localDataOwner.accept('A');
  await exported.localDataOwner.signOut();
  await adapter.setItem(key, JSON.stringify(session('A')));
  assert.equal(exported.localDataOwner.logoutFenced, true);
  await secure.removeItem(key);
  await assert.rejects(exported.withExplicitAuthAttempt(() => adapter.setItem(key, JSON.stringify(session('A'))), () => false), /cancelled/);
  assert.equal(secure.values.has(key), false, 'stale explicit SDK response cannot repersist credentials');
});

test('real credential queue binds storage to active A, never queued current B, including logout of both', async () => {
  for (const logout of [false, true]) {
    const secure = memoryStorage();
    const local = memoryStorage();
    const key = 'sb-example-auth-token';
    let adapter: any;
    const exported = loadSource('src/lib/supabase.ts', {
      'react-native': { Platform: { OS: 'ios' }, AppState: { addEventListener: () => ({ remove() {} }) } },
      'expo-secure-store': { getItemAsync: secure.getItem, setItemAsync: secure.setItem, deleteItemAsync: secure.removeItem },
      '@react-native-async-storage/async-storage': { ...local, getAllKeys: async () => [] },
      '@supabase/supabase-js': { createClient: (_url: string, _key: string, options: any) => {
        adapter = options.auth.storage;
        return { auth: { startAutoRefresh() {}, stopAutoRefresh() {} } };
      } },
      './supabaseAvailability': {
        resolveSupabaseConfig: () => ({ status: 'configured', supabaseUrl: 'https://example.supabase.co', supabaseAnonKey: 'synthetic-public' }),
        createSupabaseAvailability: (_config: unknown, create: any) => ({ status: 'available', client: create('https://example.supabase.co', 'synthetic-public') }),
      },
      './localDataOwner': { configureLocalDataOwner: (storage: any) => new LocalDataOwner(storage), LOCAL_DATA_OWNER_KEY },
    });
    exported.getSupabaseAvailability();
    await exported.initializeLocalOwnership();
    const started = deferred<void>(), response = deferred<void>();
    let aCurrent = true, bCurrent = true, bStarted = false;
    const session = (id: string) => JSON.stringify({ user: { id }, access_token: `synthetic-${id}`, refresh_token: 'synthetic-refresh' });
    const older = exported.withExplicitAuthAttempt(async () => {
      started.resolve();
      await response.promise;
      await adapter.setItem(key, session('A'));
      assert.equal(secure.values.has(key), false, 'A cannot borrow queued B permission');
    }, () => aCurrent);
    const olderRejected = assert.rejects(older, /cancelled/);
    await started.promise;
    aCurrent = false;
    const newer = exported.withExplicitAuthAttempt(async () => {
      bStarted = true;
      assert.equal(secure.values.has(key), false);
      await adapter.setItem(key, session('B'));
    }, () => bCurrent);
    const newerResult = logout ? assert.rejects(newer, /cancelled/) : newer;
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(bStarted, false, 'B waits until A leaves the SDK exchange');
    if (logout) { bCurrent = false; await exported.localDataOwner.signOut(); }
    response.resolve();
    await olderRejected;
    await newerResult;
    assert.equal(bStarted, !logout);
    if (logout) { assert.equal(secure.values.has(key), false); assert.equal(exported.localDataOwner.logoutFenced, true); }
    else assert.equal(JSON.parse(secure.values.get(key)!).user.id, 'B');
  }
});

test('actual ownership discovery allows startup preferences but quarantines readiness, programs, and connected identities', async () => {
  const local = memoryStorage();
  const secure = memoryStorage();
  local.values.set('integrations-store', JSON.stringify({ state: { morningReminderMigratedV37: true,
    readinessNotificationSchedule: 'daily', readinessNotificationDays: [2, 3, 4, 5, 6],
    stravaConnected: false, stravaTokenExpiry: null } }));
  local.values.set('readiness-store', JSON.stringify({ state: { schemaVersion: 1, history: [], todayReadiness: null, reminderEnabled: false } }));
  const exported = loadSource('src/lib/supabase.ts', {
    'react-native': { Platform: { OS: 'ios' }, AppState: {} },
    'expo-secure-store': { getItemAsync: secure.getItem, setItemAsync: secure.setItem }, '@supabase/supabase-js': {},
    '@react-native-async-storage/async-storage': { ...local, getAllKeys: async () => [...local.values.keys()] },
    './localDataOwner': { configureLocalDataOwner: (storage: any) => new LocalDataOwner(storage), LOCAL_DATA_OWNER_KEY },
  });
  assert.equal(await exported.hasRetainedLocalData(), false);
  const oldBoundary = new LocalDataOwner({ getItem: secure.getItem, setItem: secure.setItem });
  await oldBoundary.initialize(null, async () => true);
  assert.equal(oldBoundary.ownerUserId, null);
  assert.equal(JSON.parse(secure.values.get(LOCAL_DATA_OWNER_KEY)!).unclaimed, true);
  await exported.localDataOwner.initialize(null, exported.hasRetainedLocalData);
  await exported.localDataOwner.accept('new-owner', { explicitSignIn: true });
  assert.equal(exported.localDataOwner.canAccess, true);
  for (const [key, state] of [
    ['readiness-store', { history: [{ date: '2026-10-15', score: 50 }] }],
    ['custom-workout-store', { logs: [], customRuns: [{ id: 'personal-program' }] }],
    ['integrations-store', { stravaConnected: true }],
  ] as const) {
    local.values.set(key, JSON.stringify({ state }));
    assert.equal(await exported.hasRetainedLocalData(), true, key);
    local.values.delete(key);
  }
});

test('auth recovery finishing after logout cannot re-open local access', async () => {
  const recovery = deferred<void>();
  const harness = authHarness({ recover: () => recovery.promise });
  const boot = harness.store.getState().initialize();
  await new Promise(resolve => setImmediate(resolve));
  await harness.store.getState().signOut();
  recovery.resolve();
  await boot;
  assert.equal(harness.store.getState().canAccessLocalData, false);
  assert.equal(harness.store.getState().session, null);
});

test('legacy SDK identity A can use its own data offline; B cannot adopt it', async () => {
  const { owner, storage } = await ownerA();
  await owner.accept('A', { offline: true });
  assert.equal(owner.canAccess, true);
  assert.equal(owner.capture(true), null);
  await owner.accept('B', { explicitSignIn: true });
  assert.equal(owner.status, 'owner-conflict');
  assert.equal(owner.canAccess, false);
  assert.equal(JSON.parse(storage.values.get(LOCAL_DATA_OWNER_KEY)!).ownerUserId, 'A');
});

test('unknown legacy owner stays quarantined even after a later SDK login/cache', async () => {
  const storage = memoryStorage();
  const first = new LocalDataOwner(storage);
  await first.initialize(null, async () => true);
  await first.accept('B', { explicitSignIn: true });
  assert.equal(first.status, 'unclaimed');
  const restarted = new LocalDataOwner(storage);
  await restarted.initialize('B', async () => true);
  await restarted.accept('B', { explicitSignIn: true });
  assert.equal(restarted.canAccess, false);
  assert.equal(restarted.ownerUserId, null);
});

test('logout fence survives restart and only an explicit owner login clears it', async () => {
  const { owner, storage } = await ownerA();
  const lease = owner.capture();
  await owner.signOut();
  assert.equal(owner.isCurrent(lease), false);
  const restarted = new LocalDataOwner(storage);
  await restarted.initialize('A', async () => true);
  await restarted.accept('A', { offline: true });
  assert.equal(restarted.canAccess, false);
  await restarted.accept('B', { explicitSignIn: true });
  assert.equal(restarted.canAccess, false);
  assert.equal(restarted.logoutFenced, true);
  await restarted.accept('A', { explicitSignIn: true });
  assert.equal(restarted.canAccess, true);
});

test('owner storage failure blocks access without replacing existing history', async () => {
  const owner = new LocalDataOwner({ getItem: async () => { throw new Error('device locked'); }, setItem: async () => assert.fail('must not write after failed read') });
  await assert.rejects(owner.initialize('A', async () => true));
  assert.equal(owner.status, 'storage-error');
  assert.equal(owner.canAccess, false);
});

test('refreshing the same owner does not invalidate work; logout/relogin does', async () => {
  const { owner } = await ownerA();
  const lease = owner.capture(true);
  await owner.accept('A');
  assert.equal(owner.isCurrent(lease, true), true);
  await owner.signOut('invalid');
  await owner.accept('A', { explicitSignIn: true });
  assert.equal(owner.isCurrent(lease, true), false);
});

const record = {
  id: runCompletionKey('instance-A'), workoutId: 'easy_run', type: 'easy_run' as const,
  intensity: 'easy' as const, durationMinutes: 30, estimatedLoad: 90, estimatedDistanceMiles: 3,
  timestamp: 2_000_000, actualStartTime: 200_000, actualEndTime: 2_000_000,
  workoutInstanceId: 'instance-A', week: 1, completed: true as const, fatigueBefore: 0,
  fatigueAfter: 10, fatigueDelta: 10, recoveryBefore: 70, recoveryDelta: -3, source: 'manual' as const,
  actualDistanceMiles: 3, distanceSource: 'gps' as const,
  routeCoordinates: [{ lat: 40, lng: -120, timestamp: 200_000 }, { lat: 41, lng: -121, timestamp: 2_000_000 }],
};

test('completion projects actual start/end, exact instance and GPS route, not finish-as-start', () => {
  const activity = activityFromWorkoutRecord(record, false) as Activity & { workoutInstanceId?: string };
  assert.equal(activity.startTime, 200_000);
  assert.equal(activity.endTime, 2_000_000);
  assert.equal(activity.workoutInstanceId, 'instance-A');
  assert.equal(activity.metrics.distanceSource, 'gps');
  assert.equal(activity.metrics.routeCoordinates?.length, 2);
  assert.notEqual(runCompletionKey('a:b'), runCompletionKey('a_b'));
  assert.throws(() => runCompletionKey(null, null));
});

test('actual workout projection preserves route altitude, twelve-minute wall time, ten-minute active time and Watch provenance', () => {
  const input: RunWorkoutRecord = {
    ...record, durationMinutes: 10, actualDurationMinutes: 10, actualDistanceMiles: 1,
    actualStartTime: 100_000, actualEndTime: 820_000,
    routeCoordinates: [{ lat: 40, lng: -120, timestamp: 100_000, altitudeM: 112 },
      { lat: 40.01, lng: -120, timestamp: 820_000, altitudeM: 121 }],
    activityMetrics: { elapsedTimeSeconds: 720, activeTimeSeconds: 600,
      metricSources: { distance: 'apple_watch', cadence: 'apple_watch', power: 'apple_watch' } },
  };
  const unchanged = structuredClone(input);
  const activity = activityFromWorkoutRecord(input, false);
  assert.deepEqual(activity.metrics.routeCoordinates, [
    { latitude: 40, longitude: -120, timestamp: 100_000, altitudeMeters: 112 },
    { latitude: 40.01, longitude: -120, timestamp: 820_000, altitudeMeters: 121 },
  ]);
  assert.equal(activity.metrics.durationSeconds, 600);
  assert.equal(activity.metrics.elapsedTimeSeconds, 720);
  assert.equal(activity.metrics.activeTimeSeconds, 600);
  assert.equal(activity.metrics.distanceSource, 'gps');
  assert.deepEqual(activity.metrics.metricSources, input.activityMetrics!.metricSources);
  assert.equal(activity.metrics.distanceMeters, 1609.344);
  assert.deepEqual(input, unchanged, 'projection does not mutate the durable first-End record');
});

test('actual workout projection falls back to valid wall timestamps and phone GPS only when provenance is absent', () => {
  const input: RunWorkoutRecord = { ...record, durationMinutes: 10, actualDurationMinutes: 10,
    actualStartTime: 100_000, actualEndTime: 820_000,
    activityMetrics: { metricSources: { cadence: 'apple_watch' } } };
  const activity = activityFromWorkoutRecord(input, false);
  assert.equal(activity.metrics.elapsedTimeSeconds, 720);
  assert.equal(activity.metrics.activeTimeSeconds, 600);
  assert.equal(activity.metrics.metricSources?.distance, 'phone_gps');
  assert.equal(activity.metrics.metricSources?.cadence, 'apple_watch');
  const legacy = activityFromWorkoutRecord({ ...input, actualStartTime: undefined, actualEndTime: undefined }, true);
  assert.equal(legacy.metrics.elapsedTimeSeconds, 600);
  assert.equal(legacy.metrics.activeTimeSeconds, 600);
  const invalidTimes = activityFromWorkoutRecord({ ...input, actualEndTime: 90_000 }, true);
  assert.equal(invalidTimes.metrics.elapsedTimeSeconds, 600, 'invalid legacy wall bounds do not produce negative elapsed time');
});

test('actual workout projection does not replace captured timing or explicit unavailable distance provenance', () => {
  const input: RunWorkoutRecord = { ...record, durationMinutes: 10, actualDurationMinutes: 10,
    actualStartTime: 100_000, actualEndTime: 820_000,
    activityMetrics: { elapsedTimeSeconds: 725, activeTimeSeconds: 595, metricSources: { distance: 'unavailable' } } };
  const activity = activityFromWorkoutRecord(input, false);
  assert.equal(activity.metrics.elapsedTimeSeconds, 725);
  assert.equal(activity.metrics.activeTimeSeconds, 595);
  assert.equal(activity.metrics.durationSeconds, 600);
  assert.equal(activity.metrics.metricSources?.distance, 'unavailable');
});

test('Watch recording evidence survives projection and enrichment only for the exact native-confirmed instance', async () => {
  const evidence = { workoutInstanceId: 'instance-A', confirmedAt: 1_000_000, state: 'running' as const };
  const activity = activityFromWorkoutRecord({ ...record, watchRecording: evidence }, false);
  assert.deepEqual(activity.watchRecording, evidence);
  assert.equal(matchingWatchRecording({ ...evidence, workoutInstanceId: 'foreign' }, 'instance-A'), undefined);
  assert.equal(matchingWatchRecording({ ...evidence, confirmedAt: NaN }, 'instance-A'), undefined);
  assert.equal(matchingWatchRecording({ ...evidence, state: 'saved' as never }, 'instance-A'), undefined);
  assert.equal(matchingWatchRecording(evidence, 'instance-A', 1_100_000), undefined);
  const health = { ...activity, source: 'healthkit' as const, watchRecording: undefined };
  assert.deepEqual(mergeRecording(activity, health).watchRecording, evidence);
  const storage = memoryStorage();
  const journal = new RunCompletionJournal(storage);
  const entry = { completionKey: runCompletionKey('instance-A'), workoutInstanceId: 'instance-A',
    actualStartTime: 200_000, actualEndTime: 2_000_000, durationMinutes: 30, distanceMiles: 3,
    type: 'easy_run' as const, intensity: 'easy' as const, watchRecording: evidence };
  await journal.save({ ownerUserId: 'A', entry, week: 1, fatigue: 10, recovery: 70 });
  assert.deepEqual((await new RunCompletionJournal(storage).read())[0].entry.watchRecording, evidence);
  await assert.rejects(journal.save({ ownerUserId: 'A', entry: { ...entry,
    watchRecording: { ...evidence, workoutInstanceId: 'foreign' } }, week: 1, fatigue: 10, recovery: 70 }), /valid owner/);
});

test('nearby identical sessions and a shared schedule are not duplicate identity', () => {
  const a = activityFromWorkoutRecord(record, false);
  const b = activityFromWorkoutRecord({ ...record, id: runCompletionKey('instance-B'), workoutInstanceId: 'instance-B', scheduledSessionId: 'same-plan' }, false);
  a.scheduledSessionId = 'same-plan';
  assert.equal(sameRecording(a, b), false);
});

const candidate: HealthKitWorkoutCandidate = {
  uuid: 'health-A', sourceBundleIdentifier: 'example.watch', startTime: 200_000,
  endTime: 2_000_000, durationSeconds: 1800, activityType: 'running', distanceMeters: 4828.032,
};

test('Health matching requires UUID/source or explicit lineage, not 50% overlap', () => {
  const phone = activityFromWorkoutRecord(record, false);
  assert.equal(isDuplicateHealthKitWorkout(candidate, [phone]), false);
  assert.equal(isDuplicateHealthKitWorkout({ ...candidate, workoutInstanceId: 'instance-A' }, [phone]), true);
  assert.equal(isDuplicateHealthKitWorkout({ ...candidate, strideOSActivityId: phone.id }, [phone]), true);
  const imported = buildHealthKitActivityDraft({ candidate });
  const activity = { ...imported, createdAt: 1, updatedAt: 1, trainingLoad: phone.trainingLoad } as Activity;
  assert.equal(isDuplicateHealthKitWorkout(candidate, [activity]), true);
  assert.equal(isDuplicateHealthKitWorkout({ ...candidate, uuid: 'health-B' }, [activity]), false);
});

test('Health enrichment and migration replay preserve GPS and canonical ID without re-adding aliases', () => {
  const phone = activityFromWorkoutRecord(record, false);
  const imported = buildHealthKitActivityDraft({ candidate: { ...candidate, workoutInstanceId: 'instance-A', averageHeartRateBpm: 140 } });
  const health = { ...imported, createdAt: 1, updatedAt: 2, trainingLoad: phone.trainingLoad } as Activity;
  const merged = mergeRecording(phone, health);
  assert.equal(merged.id, phone.id);
  assert.equal(merged.metrics.routeCoordinates?.length, 2);
  assert.equal(merged.metrics.averageHeartRateBpm, 140);
  const alias = { ...merged, id: 'retained-canonical-id' };
  const once = migrateLegacyWorkoutHistory([record], [alias]);
  const twice = migrateLegacyWorkoutHistory([record], once);
  assert.equal(twice.length, 1);
  assert.equal(twice[0].id, 'retained-canonical-id');
});

const pending: PendingRunCompletion = {
  ownerUserId: 'A', entry: { completionKey: runCompletionKey('instance-A'), workoutInstanceId: 'instance-A',
    actualStartTime: 200_000, actualEndTime: 2_000_000, type: 'easy_run', intensity: 'easy', durationMinutes: 30, distanceMiles: 3 },
  week: 1, fatigue: 10, recovery: 70,
};

test('completion journal survives restart, retries once, and never acknowledges another owner', async () => {
  const storage = memoryStorage();
  const journal = new RunCompletionJournal(storage);
  await Promise.all([journal.save(pending), journal.save(pending)]);
  const restarted = new RunCompletionJournal(storage);
  assert.equal((await restarted.read()).length, 1);
  await restarted.acknowledge('B', pending.entry.completionKey);
  assert.equal((await restarted.read()).length, 1);
  await restarted.acknowledge('A', pending.entry.completionKey);
  assert.equal((await restarted.read()).length, 0);
  storage.values.set(RUN_COMPLETION_JOURNAL_KEY, 'not-json');
  await assert.rejects(restarted.save(pending));
  assert.equal(storage.values.get(RUN_COMPLETION_JOURNAL_KEY), 'not-json');
});

test('actual sync service fences a queued getUser response after account change', async () => {
  const { owner } = await ownerA();
  const userResult = deferred<any>();
  let requests = 0;
  const service = loadSource('src/lib/syncService.ts', {
    './supabase': { getSupabaseAvailability: () => ({ status: 'available', client: {
      auth: { getSession: async () => ({ data: { session: { user: { id: 'A' }, access_token: 'synthetic-A' } }, error: null }),
        getUser: () => userResult.promise }, from: () => { requests += 1; throw new Error('must not upload'); },
    } }) },
    './localDataOwner': { captureOwnerLease: (cloud: boolean) => owner.capture(cloud), ownerLeaseIsCurrent: (lease: any, cloud: boolean) => owner.isCurrent(lease, cloud) },
  });
  const upload = service.syncWorkoutLog(record);
  await owner.signOut();
  await owner.accept('B', { explicitSignIn: true });
  userResult.resolve({ data: { user: { id: 'B' } }, error: null });
  await upload;
  assert.equal(requests, 0);
});

test('actual cloud restore rejects stale response and service failures, rather than returning empty success', async () => {
  const { owner } = await ownerA();
  const response = deferred<any>();
  const client = { auth: {
    getSession: async () => ({ data: { session: { user: { id: 'A' }, access_token: 'synthetic-A' } }, error: null }),
    getUser: async () => ({ data: { user: { id: 'A' } }, error: null }),
  }, from: () => ({ select: () => ({ eq: () => ({ setHeader: () => response.promise }) }) }) };
  const service = loadSource('src/lib/syncService.ts', {
    './supabase': { getSupabaseAvailability: () => ({ status: 'available', client }) },
    './localDataOwner': { captureOwnerLease: (cloud: boolean) => owner.capture(cloud), ownerLeaseIsCurrent: (lease: any, cloud: boolean) => owner.isCurrent(lease, cloud) },
  });
  const restore = service.hydrateFromSupabase();
  await new Promise(resolve => setImmediate(resolve));
  await owner.signOut();
  response.resolve({ data: [{ data: record }], error: null });
  await assert.rejects(restore, /Account changed/);
  await owner.accept('A', { explicitSignIn: true });
  client.from = () => ({ select: () => ({ eq: () => ({ setHeader: () => Promise.resolve({ data: null, error: new Error('offline') }) }) }) });
  await assert.rejects(service.hydrateFromSupabase(), /local history was retained/);
});

test('cloud requests pin the verified owner token and reject explicitly foreign records', async () => {
  const { owner } = await ownerA();
  const requests: { row: any; header?: string }[] = [];
  const service = loadSource('src/lib/syncService.ts', {
    './supabase': { getSupabaseAvailability: () => ({ status: 'available', client: {
      auth: {
        getSession: async () => ({ data: { session: { user: { id: 'A' }, access_token: 'synthetic-A' } }, error: null }),
        getUser: async (token: string) => { assert.equal(token, 'synthetic-A'); return { data: { user: { id: 'A' } }, error: null }; },
      },
      from: () => ({ upsert: (row: any) => {
        const request = { row, header: undefined as string | undefined };
        requests.push(request);
        return { setHeader: (_name: string, header: string) => { request.header = header; return Promise.resolve({ error: null }); } };
      } }),
    } }) },
    './localDataOwner': { captureOwnerLease: (cloud: boolean) => owner.capture(cloud), ownerLeaseIsCurrent: (lease: any, cloud: boolean) => owner.isCurrent(lease, cloud) },
  });
  await service.syncWorkoutLog({ ...record, ownerUserId: 'A' });
  assert.equal(requests[0].row.user_id, 'A');
  assert.equal(requests[0].header, 'Bearer synthetic-A');
  await assert.rejects(service.syncWorkoutLog({ ...record, ownerUserId: 'B' }), /different local account/);
  assert.equal(requests.length, 1);
});

test('generic durable Activity API awaits disk, retries failures, and returns the exact canonical recording ID', async () => {
  const { owner } = await ownerA();
  const storage = memoryStorage();
  let fail = false;
  let holdWrite = 0;
  let writes = 0;
  const entered = deferred<void>();
  const release = deferred<void>();
  const disk = { ...storage, setItem: async (key: string, value: string) => {
    if (key === 'activity-store') {
      writes += 1;
      if (writes === holdWrite) { entered.resolve(); await release.promise; }
      if (fail) throw new Error('activity disk unavailable');
    }
    await storage.setItem(key, value);
  } };
  const activity = loadSource('src/store/activityStore.ts', {
    './persistStorage': { createAppJSONStorage: () => createJSONStorage(() => disk), getAppStorage: () => disk },
    '@react-native-async-storage/async-storage': {}, '../lib/recalculation': { runRecalculation() {} },
    '../lib/localDataOwner': { captureOwnerLease: () => owner.capture(), ownerLeaseIsCurrent: (lease: any) => owner.isCurrent(lease) },
  }).useActivityStore;
  await new Promise(resolve => setImmediate(resolve));
  const lease = owner.capture()!;
  const firstEnd = { ...activityFromWorkoutRecord({ ...record, workoutInstanceId: 'generic-cycle' }),
    id: 'cycle-first-end', activityType: 'cycling' as const };
  fail = true;
  await assert.rejects(activity.getState().addActivityAndPersist(firstEnd, lease), /disk unavailable/);
  assert.equal(activity.getState().activities.length, 1, 'failed durability does not delete retained history');
  fail = false;
  writes = 0;
  holdWrite = 2; // normal middleware write completes; explicit durable flush is held.
  let acknowledged = false;
  const retry = activity.getState().addActivityAndPersist(firstEnd, lease).then((id: string) => { acknowledged = true; return id; });
  await entered.promise;
  assert.equal(acknowledged, false, 'native cleanup cannot be authorized while storage is pending');
  release.resolve();
  assert.equal(await retry, firstEnd.id);
  assert.equal(activity.getState().activities.length, 1);
  assert.equal(JSON.parse(storage.values.get('activity-store')!).state.activities[0].endTime, firstEnd.endTime);
  const health = { ...firstEnd, id: 'health-first', workoutInstanceId: 'health-alias', source: 'healthkit' as const };
  await activity.getState().addActivityAndPersist(health, lease);
  assert.equal(await activity.getState().addActivityAndPersist({ ...firstEnd, id: 'phone-alias', workoutInstanceId: 'health-alias' }, lease), 'health-first');
  await Promise.all(['nearby-A', 'nearby-B'].map(id => activity.getState().addActivityAndPersist({ ...firstEnd, id, workoutInstanceId: id }, lease)));
  await activity.getState().awaitPersistence(lease);
  assert.equal(activity.getState().activities.length, 4, 'distinct instances remain distinct despite identical timestamps');
  assert.equal(JSON.parse(storage.values.get('activity-store')!).state.activities.length, 4);
  await assert.rejects(activity.getState().addActivityAndPersist({ ...firstEnd, id: undefined, workoutInstanceId: undefined }, lease), /stable ID/);
});

test('generic Activity flush rejects owner revocation during disk I/O and fences queued additions', async () => {
  const { owner } = await ownerA();
  const storage = memoryStorage();
  const entered = deferred<void>();
  const release = deferred<void>();
  let writes = 0;
  let holdWrite = 0;
  const disk = { ...storage, setItem: async (key: string, value: string) => {
    if (key === 'activity-store' && ++writes === holdWrite) { entered.resolve(); await release.promise; }
    await storage.setItem(key, value);
  } };
  const activity = loadSource('src/store/activityStore.ts', {
    './persistStorage': { createAppJSONStorage: () => createJSONStorage(() => disk), getAppStorage: () => disk },
    '@react-native-async-storage/async-storage': {}, '../lib/recalculation': { runRecalculation() {} },
    '../lib/localDataOwner': { captureOwnerLease: () => owner.capture(), ownerLeaseIsCurrent: (lease: any) => owner.isCurrent(lease) },
  }).useActivityStore;
  await new Promise(resolve => setImmediate(resolve));
  const lease = owner.capture()!;
  const firstEnd = { ...activityFromWorkoutRecord({ ...record, workoutInstanceId: 'old-owner' }), id: 'old-owner' };
  writes = 0;
  holdWrite = 2;
  const first = assert.rejects(activity.getState().addActivityAndPersist(firstEnd, lease), /Account changed/);
  const queued = assert.rejects(activity.getState().addActivityAndPersist({ ...firstEnd, id: 'queued', workoutInstanceId: 'queued' }, lease), /Account changed/);
  await entered.promise;
  await owner.signOut();
  release.resolve();
  await Promise.all([first, queued]);
  assert.equal(activity.getState().activities.length, 1);
  assert.equal(activity.getState().getById('queued'), undefined);
  await assert.rejects(activity.getState().awaitPersistence(lease), /Account changed/);
  await owner.accept('B', { explicitSignIn: true });
  assert.equal(owner.canAccess, false, 'a later B login does not adopt A history');
  await owner.accept('A', { explicitSignIn: true });
  await activity.getState().addActivityAndPersist(firstEnd, owner.capture());
  assert.equal(activity.getState().activities.length, 1, 'original owner can retry the same first End');
});

test('generic Activity API waits for hydration and rejects stale ownership before adding history', async () => {
  const { owner } = await ownerA();
  const storage = memoryStorage();
  const readable = deferred<void>();
  const disk = { ...storage, getItem: async (key: string) => {
    if (key === 'activity-store') await readable.promise;
    return storage.getItem(key);
  } };
  const activity = loadSource('src/store/activityStore.ts', {
    './persistStorage': { createAppJSONStorage: () => createJSONStorage(() => disk), getAppStorage: () => disk },
    '@react-native-async-storage/async-storage': {}, '../lib/recalculation': { runRecalculation() {} },
    '../lib/localDataOwner': { captureOwnerLease: () => owner.capture(), ownerLeaseIsCurrent: (lease: any) => owner.isCurrent(lease) },
  }).useActivityStore;
  const rejected = assert.rejects(activity.getState().addActivityAndPersist(
    { ...activityFromWorkoutRecord(record), id: 'not-yet-readable' }, owner.capture()), /Account changed/);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(activity.getState().activities.length, 0);
  await owner.signOut();
  readable.resolve();
  await rejected;
  assert.equal(activity.getState().activities.length, 0);
});

test('generic Activity API rejects a write whose saved bytes cannot be confirmed', async () => {
  const { owner } = await ownerA();
  const storage = memoryStorage();
  const activity = loadSource('src/store/activityStore.ts', {
    './persistStorage': { createAppJSONStorage: () => createJSONStorage(() => storage),
      getAppStorage: () => ({ ...storage, getItem: async () => null }) },
    '@react-native-async-storage/async-storage': {}, '../lib/recalculation': { runRecalculation() {} },
    '../lib/localDataOwner': { captureOwnerLease: () => owner.capture(), ownerLeaseIsCurrent: (lease: any) => owner.isCurrent(lease) },
  }).useActivityStore;
  await new Promise(resolve => setImmediate(resolve));
  await assert.rejects(activity.getState().addActivityAndPersist(
    { ...activityFromWorkoutRecord(record), id: 'unconfirmed' }, owner.capture()), /could not be confirmed/);
});

test('real workout/activity stores persist one live completion, preserve nearby runs, and retry a failed disk save', async () => {
  const { owner } = await ownerA();
  const storage = memoryStorage();
  let failActivityWrite = false;
  const guardedStorage = { ...storage, setItem: async (key: string, value: string) => {
    if (key === 'activity-store' && failActivityWrite) throw new Error('disk unavailable');
    await storage.setItem(key, value);
  } };
  const ownership = { captureOwnerLease: (cloud: boolean) => owner.capture(cloud), ownerLeaseIsCurrent: (lease: any, cloud: boolean) => owner.isCurrent(lease, cloud) };
  const persistence = { createAppJSONStorage: () => createJSONStorage(() => storage), getAppStorage: () => guardedStorage };
  const activity = loadSource('src/store/activityStore.ts', {
    './persistStorage': persistence, '@react-native-async-storage/async-storage': {},
    '../lib/localDataOwner': ownership, '../lib/recalculation': { runRecalculation: () => {} },
  }).useActivityStore;
  const workout = loadSource('src/store/workoutStore.ts', {
    './persistStorage': persistence, '@react-native-async-storage/async-storage': {}, './activityStore': { useActivityStore: activity },
    '../lib/localDataOwner': ownership,
    '../lib/syncService': { syncWorkoutLog: async () => {}, deleteWorkoutLog: async () => {} },
    '../lib/externalIntegrations': { syncCompletedWorkoutToExternalServices: async () => {} },
    '../utils/training': { calculateTrainingLoad: () => 90 }, '../utils/calculateFatigue': { calculateUpdatedFatigue: () => 20 },
  }).useWorkoutStore;
  await new Promise(resolve => setImmediate(resolve));
  let fatigueUpdates = 0;
  const save = (entry = pending.entry) => workout.getState().saveLiveRun(entry, 1, 10, 70, () => { fatigueUpdates += 1; }, () => {});
  failActivityWrite = true;
  await assert.rejects(save(), /disk unavailable/);
  assert.equal((JSON.parse(storage.values.get(RUN_COMPLETION_JOURNAL_KEY)!)).length, 1);
  failActivityWrite = false;
  await Promise.all([save(), save()]);
  assert.equal(workout.getState().history.length, 1);
  assert.equal(activity.getState().activities.length, 1);
  assert.equal(fatigueUpdates, 1);
  const localActivity = activity.getState().activities[0];
  assert.equal(activity.getState().mergeRestoredActivities([{ ...localActivity, metrics: { distanceMeters: 999_999 } }]), 0);
  assert.equal(activity.getState().getById(localActivity.id).metrics.distanceMeters, localActivity.metrics.distanceMeters);
  await save({ ...pending.entry, workoutInstanceId: 'instance-B', completionKey: runCompletionKey('instance-B') });
  assert.equal(workout.getState().history.length, 2);
  assert.equal(activity.getState().activities.length, 2);
  const journal = new RunCompletionJournal(guardedStorage);
  const recoveryEntry = { ...pending.entry, workoutInstanceId: 'instance-C', completionKey: runCompletionKey('instance-C') };
  await journal.save({ ...pending, entry: recoveryEntry });
  await journal.save({ ...pending, ownerUserId: 'B', entry: { ...pending.entry, workoutInstanceId: 'foreign', completionKey: runCompletionKey('foreign') } });
  const health = buildHealthKitActivityDraft({ candidate: { ...candidate, uuid: 'health-C', workoutInstanceId: 'instance-C' } });
  const healthId = activity.getState().addActivity(health);
  await workout.getState().restorePendingCompletions();
  await workout.getState().restorePendingCompletions();
  assert.equal(workout.getState().history.length, 3);
  assert.equal(activity.getState().activities.length, 3);
  assert.equal((await journal.read())[0].ownerUserId, 'B');
  workout.getState().deleteLog(recoveryEntry.completionKey);
  assert.equal(activity.getState().getById(healthId), undefined);
  assert.equal(workout.getState().history.length, 2);
  const now = Date.now();
  const active = { ...record, isActive: true, startTime: now - 600_000, workoutInstanceId: 'background-end',
    scheduledSessionId: 'same-plan', environment: 'outdoor', distanceMiles: 2, coordinates: [], plannedWorkout: null,
    isPaused: false, pausedAt: null, pausedDurationMs: 0 };
  const hydrated = { hasHydrated: () => true };
  const command = loadSource('src/lib/runCompletionCommand.ts', {
    '../store/workoutStore': { useWorkoutStore: workout }, '../store/activityStore': { useActivityStore: activity },
    '../store/activeRunStore': { useActiveRunStore: { persist: hydrated, getState: () => active },
      activeRunElapsedSeconds: (state: typeof active, end: number) => (end - state.startTime) / 1000 },
    '../store/athleteStore': { useAthleteStore: { persist: hydrated, getState: () => ({ currentWeek: 1, fatigueScore: 10,
      recoveryScore: 70, setFatigueScore: () => { fatigueUpdates += 1; }, setRecentEasyLoad() {} }) } },
    './localDataOwner': ownership, '../utils/capturedRunTelemetryMetrics': { capturedRunTelemetryMetrics: () => ({}) },
  });
  failActivityWrite = true;
  // This fixture has no GPS fixes: its two miles are an explicit measured Watch End total.
  await assert.rejects(command.completeRunCommand({ workoutInstanceId: 'background-end', endedAt: now, distanceMiles: 2 }), /disk unavailable/);
  const durableEnd = (await journal.read()).find(entry => entry.entry.workoutInstanceId === 'background-end')!;
  assert.equal(durableEnd.entry.actualEndTime, now);
  active.distanceMiles = 5;
  failActivityWrite = false;
  const evidence = { workoutInstanceId: 'background-end', confirmedAt: now, state: 'ended' as const };
  const completed = await command.completeRunCommand({ workoutInstanceId: 'background-end', endedAt: now + 1_000, watchRecording: evidence });
  assert.equal(completed.entry.actualEndTime, now);
  assert.equal(completed.entry.distanceMiles, 2);
  assert.equal(completed.entry.durationMinutes, 10);
  assert.deepEqual(completed.entry.watchRecording, evidence);
  assert.deepEqual(workout.getState().history.find((record: any) => record.workoutInstanceId === 'background-end').watchRecording, evidence);
  assert.deepEqual(activity.getState().activities.find((record: any) => record.workoutInstanceId === 'background-end').watchRecording, evidence);
  assert.equal(workout.getState().history.length, 3);
  assert.equal(active.isActive, true, 'caller retains native cleanup ownership');
  active.workoutInstanceId = 'new-recording';
  failActivityWrite = true;
  await assert.rejects(command.completeRunCommand({ workoutInstanceId: 'background-end', endedAt: now + 2_000 }), /disk unavailable/);
  failActivityWrite = false;
  const replay = await command.completeRunCommand({ workoutInstanceId: 'background-end', endedAt: now + 2_000, elapsedSeconds: 1 });
  assert.equal(replay.status, 'saved');
  assert.equal(replay.entry.actualEndTime, now);
  assert.equal(active.workoutInstanceId, 'new-recording');
  await assert.rejects(command.completeRunCommand({ workoutInstanceId: 'unknown-end', endedAt: now }), /does not match/);
  active.workoutInstanceId = 'short-run';
  active.startTime = now - 60_000;
  const short = await command.completeRunCommand({ workoutInstanceId: 'short-run', endedAt: now });
  assert.equal(short.status, 'discarded');
  assert.equal((await workout.getState().pendingRunDiscards()).length, 1);
  await workout.getState().restorePendingCompletions();
  assert.equal(workout.getState().history.length, 3);
  await assert.rejects(save({ ...short.entry, durationMinutes: 10 }), /durable short-run discard/);
  await workout.getState().acknowledgeRunCleanup('short-run', short.ownerLease);
  assert.equal((await workout.getState().pendingRunDiscards()).length, 0);
  const discardedAfterCleanup = await workout.getState().getRunDiscardResult('short-run', short.ownerLease);
  assert.equal(discardedAfterCleanup.status, 'discarded');
  assert.equal((await new RunCompletionJournal(guardedStorage).read()).find(item => item.entry.workoutInstanceId === 'short-run')!.cleanupAcknowledged, true);
  active.workoutInstanceId = 'new-indoor';
  active.environment = 'indoor';
  active.startTime = now - 600_000;
  await assert.rejects(command.completeRunCommand({ workoutInstanceId: 'new-indoor', endedAt: now, distanceMiles: 99,
    distanceSource: 'confirmed_speed_estimate' }), /requires TreadmillCompletionSheet confirmation/);
  assert.equal(workout.getState().history.length, 3, 'Watch distance never bypasses indoor confirmation');
  assert.equal((await journal.read()).some(item => item.entry.workoutInstanceId === 'new-indoor'), false);
  const discardReplay = await command.completeRunCommand({ workoutInstanceId: 'short-run', endedAt: now + 2_000, distanceMiles: 99 });
  assert.equal(discardReplay.status, 'discarded', 'resolved discard is replayable with a newer indoor run active');
  assert.equal(discardReplay.entry.actualEndTime, short.entry.actualEndTime);
  assert.equal(active.workoutInstanceId, 'new-indoor');
  const explicitDiscard = { ...pending.entry, workoutInstanceId: 'explicit-indoor-discard',
    completionKey: runCompletionKey('explicit-indoor-discard'), actualStartTime: now - 60_000, actualEndTime: now,
    durationMinutes: 1, indoor: true, activitySubtype: 'treadmill' as const };
  const discarded = await workout.getState().discardRunEnd(explicitDiscard, 1, 10, 70, owner.capture());
  await workout.getState().discardRunEnd({ ...explicitDiscard, actualEndTime: now + 1_000, durationMinutes: 2 }, 1, 10, 70, owner.capture());
  assert.equal((await workout.getState().getRunDiscardResult(explicitDiscard.workoutInstanceId, owner.capture())).entry.actualEndTime, now);
  assert.equal(workout.getState().history.length, 3, 'explicit discard adds no workout or Activity history');
  await workout.getState().acknowledgeRunCleanup(explicitDiscard.workoutInstanceId, discarded.ownerLease);
  await workout.getState().restorePendingCompletions();
  assert.equal(workout.getState().history.length, 3);
  const nativeEnds: string[] = [];
  const sharedMocks = {
    '../../modules/stride-live-activity/src': { endStrideRunLiveActivityIfMatching: async (instance: string) => { nativeEnds.push(`live:${instance}`); return true; } },
    '../../modules/stride-watch-connectivity/src': { endStrideWatchWorkoutIfMatching: async (instance: string) => { nativeEnds.push(`watch:${instance}`); return true; } },
    '../store/activeRunStore': { useActiveRunStore: { persist: hydrated, getState: () => active } },
    '../store/workoutStore': { useWorkoutStore: workout },
    '../store/persistStorage': { getAppStorage: () => guardedStorage },
    './localDataOwner': { ...ownership, getLocalDataOwner: () => owner },
  };
  const watchAdapter = loadSource('src/lib/watchRunCompletion.ts', {
    ...sharedMocks, './runCompletionCommand': command,
    './gpsTracking': { stopLocationTrackingWhen: async () => { assert.fail('a newer indoor recording must not lose GPS'); } },
  });
  const outdoorAdapter = loadSource('src/lib/outdoorCompletion.ts', {
    ...sharedMocks,
    '../store/activeActivityStore': { useActiveActivityStore: { persist: hydrated, getState: () => ({ isActive: false, workoutInstanceId: null }) },
      awaitActiveActivityPersistence: async () => { assert.fail('a run discard is not an outdoor-store mutation'); } },
    '../store/activityStore': { useActivityStore: activity }, './watchRunCompletion': watchAdapter,
    './activityGpsTracking': { stopActivityLocationTrackingWhen: async () => { assert.fail('a run discard must not stop another domain'); } },
  });
  const activityCount = activity.getState().activities.length;
  // Use both real adapters with the real durable tombstone API, not a stubbed resolution.
  assert.equal(await watchAdapter.completeWatchRunEnd({ workoutInstanceId: 'short-run', endedAt: now + 2_000 }), true);
  const transported = await outdoorAdapter.completeWatchActivityEnd({ workoutInstanceId: explicitDiscard.workoutInstanceId, endedAt: now + 2_000 });
  assert.equal(transported.status, 'saved', 'outer transport resolves the discard, not a new achievement');
  assert.equal(transported.activityId, null);
  assert.equal(activity.getState().activities.length, activityCount);
  assert.equal(workout.getState().history.length, 3);
  assert.equal(active.workoutInstanceId, 'new-indoor');
  assert.deepEqual(nativeEnds, ['live:short-run', 'watch:short-run', `live:${explicitDiscard.workoutInstanceId}`, `watch:${explicitDiscard.workoutInstanceId}`]);
  assert.equal((await workout.getState().pendingRunDiscards()).length, 0);
  const confirmedIndoor = { ...pending.entry, workoutInstanceId: 'confirmed-indoor', completionKey: runCompletionKey('confirmed-indoor'),
    actualStartTime: now - 600_000, actualEndTime: now, durationMinutes: 10, distanceMiles: 1.25,
    indoor: true, activitySubtype: 'treadmill' as const, distanceSource: 'treadmill_reported' as const };
  await save(confirmedIndoor);
  const confirmedReplay = await command.completeRunCommand({ workoutInstanceId: 'confirmed-indoor', endedAt: now + 2_000, distanceMiles: 99 });
  assert.equal(confirmedReplay.status, 'saved');
  assert.equal(confirmedReplay.entry.distanceMiles, 1.25);
  assert.equal(confirmedReplay.entry.distanceSource, 'treadmill_reported');
  assert.equal(confirmedReplay.entry.actualEndTime, now);
  assert.equal(workout.getState().history.length, 4, 'confirmed indoor history can replay without the sheet');
  await assert.rejects(workout.getState().discardRunEnd(confirmedIndoor, 1, 10, 70, owner.capture()), /saved recording cannot be discarded/);
  await owner.signOut();
  await assert.rejects(workout.getState().getRunDiscardResult('short-run', short.ownerLease), /Account changed/);
  await assert.rejects(save(), /owner/);
  assert.equal(workout.getState().history.length, 4);
});
