import assert from 'node:assert/strict';
import Module from 'node:module';
import test from 'node:test';
import { createJSONStorage } from 'zustand/middleware';
import { initialAutoPauseState, reconcileAutoPauseMode, reduceAutoPause, type AutoPauseMode, type AutoPauseState } from '../../src/utils/autoPause';
import type { LocationObject } from 'expo-location';

function load<T>(path: string, mocks: Record<string, unknown>): T {
  const loader = Module as unknown as { _load: (id: string, ...args: unknown[]) => unknown };
  const original = loader._load; delete require.cache[require.resolve(path)];
  loader._load = function (id, ...args) { return Object.hasOwn(mocks, id) ? mocks[id] : original.call(this, id, ...args); };
  try { return require(path); } finally { loader._load = original; }
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}

const BASE = 1_000_000;
function location(at: number, longitude = 0, speed = 0, altitude = 0): LocationObject {
  return { timestamp: at, coords: { latitude: 0, longitude, accuracy: 5, speed,
    altitude, altitudeAccuracy: 1, heading: null } };
}

type SharedState = {
  isActive: boolean; isPaused: boolean; pausedAt: number | null; pausedDurationMs: number;
  recordingPauses: { startTime: number; endTime: number }[];
  completionRequestedAt: number | null; autoPauseState: AutoPauseState | null;
  workoutInstanceId: string | null;
};
type SharedStore = {
  getState: () => SharedState;
  setState: (value: Record<string, unknown>) => void;
  persist: { hasHydrated: () => boolean; onFinishHydration: (callback: () => void) => () => void };
};

function recorder(kind: 'run' | 'activity', options: {
  mode?: AutoPauseMode; settingsHydrated?: boolean; deferActiveHydration?: boolean;
  restored?: Record<string, unknown>;
} = {}) {
  let settingsHydrated = options.settingsHydrated ?? true;
  let prefs = { autoPauseMode: options.mode ?? 'off', announceAutoPause: false, announceAutoResume: false,
    autoPauseSpeech: false, autoResumeSpeech: false, units: 'imperial' };
  const listeners = new Set<(next: typeof prefs, previous: typeof prefs) => void>();
  const hydratedListeners = new Set<() => void>();
  const settings = {
    getState: () => prefs,
    subscribe: (callback: (next: typeof prefs, previous: typeof prefs) => void) => { listeners.add(callback); return () => listeners.delete(callback); },
    persist: { hasHydrated: () => settingsHydrated, onFinishHydration: (callback: () => void) => {
      hydratedListeners.add(callback); return () => hydratedListeners.delete(callback);
    } },
  };
  const setMode = (autoPauseMode: AutoPauseMode) => {
    const previous = prefs; prefs = { ...prefs, autoPauseMode };
    listeners.forEach(listener => listener(prefs, previous));
  };
  const data = new Map<string, string>();
  if (options.restored) data.set(kind === 'run' ? 'active-run-store-v1' : 'active-activity-store',
    JSON.stringify({ state: options.restored, version: 1 }));
  const gate = options.deferActiveHydration ? deferred() : null;
  const storage = {
    getItem: (key: string) => gate ? gate.promise.then(() => data.get(key) ?? null) : data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); }, removeItem: (key: string) => { data.delete(key); },
  };
  const mocks = {
    '@react-native-async-storage/async-storage': {}, './settingsStore': { useSettingsStore: settings },
    './persistStorage': { createAppJSONStorage: () => createJSONStorage(() => storage), getAppStorage: () => storage },
    '../lib/voiceCue': { enqueueVoiceCue: () => {} },
  };
  let store: SharedStore;
  let start: (sport?: 'running' | 'cycling' | 'walking' | 'hiking', indoor?: boolean, subtype?: string) => void;
  let pause: () => void; let resume: () => void; let add: (point: LocationObject) => void;
  let elapsed: (now: number) => number; let distance: () => number; let elevation: () => number; let pointCount: () => number;
  if (kind === 'run') {
    const api = load<typeof import('../../src/store/activeRunStore')>('../../src/store/activeRunStore', mocks);
    const actual = api.useActiveRunStore;
    store = actual as unknown as SharedStore;
    start = (_sport, indoor) => actual.getState().startRun(null, { environment: indoor ? 'indoor' : 'outdoor', startedAtMs: BASE });
    pause = () => actual.getState().pauseRun(); resume = () => actual.getState().resumeRun();
    add = point => actual.getState().addLocationUpdate(point);
    elapsed = now => api.activeRunElapsedSeconds(actual.getState(), now);
    distance = () => actual.getState().distanceMiles * 1609.344;
    elevation = () => actual.getState().elevationGainFt / 3.28084;
    pointCount = () => actual.getState().coordinates.length;
  } else {
    const api = load<typeof import('../../src/store/activeActivityStore')>('../../src/store/activeActivityStore', mocks);
    const actual = api.useActiveActivityStore;
    store = actual as unknown as SharedStore;
    start = (sport = 'running', indoor, subtype) => actual.getState().start({ activityType: sport, subtype: subtype ?? (indoor ? 'indoor' : 'outdoor') });
    pause = () => actual.getState().pause(); resume = () => actual.getState().resume();
    add = point => actual.getState().addLocation(point, api.activeOutdoorElapsedSeconds(actual.getState(), point.timestamp));
    elapsed = now => api.activeOutdoorElapsedSeconds(actual.getState(), now);
    distance = () => actual.getState().aggregate.distanceMeters;
    elevation = () => actual.getState().aggregate.elevationGainMeters;
    pointCount = () => actual.getState().aggregate.points.length;
  }
  const ready = () => {
    if (store.persist.hasHydrated()) return Promise.resolve();
    return new Promise<void>(resolve => {
      const unsubscribe = store.persist.onFinishHydration(() => { unsubscribe(); resolve(); });
      if (store.persist.hasHydrated()) { unsubscribe(); resolve(); }
    });
  };
  return { store, start, pause, resume, add, elapsed, distance, elevation, pointCount, ready, setMode,
    finishActive: async () => { gate?.resolve(); await ready(); },
    finishSettings: (mode: AutoPauseMode) => {
      setMode(mode); settingsHydrated = true; hydratedListeners.forEach(listener => listener());
    } };
}

test('a policy change clears detector candidates without resuming a paused workout', () => {
  const paused: AutoPauseState = { ...initialAutoPauseState('running', 'running_and_cycling'), paused: true,
    candidateSinceMs: 100, resumeCandidateSinceMs: 200, stationarySamples: 2, movingSamples: 1, lastDecisionAtMs: 300 };
  const off = reconcileAutoPauseMode(paused, 'off');
  assert.equal(off.paused, true); assert.equal(off.manualPaused, true);
  assert.equal(off.candidateSinceMs, null); assert.equal(off.resumeCandidateSinceMs, null);
  assert.equal(off.stationarySamples, 0); assert.equal(off.movingSamples, 0); assert.equal(off.lastDecisionAtMs, null);
  const enabled = reconcileAutoPauseMode(off, 'running_and_cycling');
  const movement = reduceAutoPause(enabled, { atMs: 1000, speedMps: 5, displacementMeters: 10, horizontalAccuracyMeters: 5 });
  assert.equal(movement.action, 'none'); assert.equal(movement.state.manualPaused, true);
});

test('changing only the other sport preserves this sport candidate window and decision identity', () => {
  const run = { ...initialAutoPauseState('running', 'running_and_cycling'), candidateSinceMs: 100, stationarySamples: 1, lastDecisionAtMs: 50 };
  const runOnly = reconcileAutoPauseMode(run, 'running_only');
  assert.equal(runOnly.candidateSinceMs, 100); assert.equal(runOnly.stationarySamples, 1); assert.equal(runOnly.lastDecisionAtMs, 50);
  const cycling = { ...initialAutoPauseState('cycling', 'cycling_only'), resumeCandidateSinceMs: 200, movingSamples: 1 };
  const both = reconcileAutoPauseMode(cycling, 'running_and_cycling');
  assert.equal(both.resumeCandidateSinceMs, 200); assert.equal(both.movingSamples, 1);
});

for (const kind of ['run', 'activity'] as const) {
  test(`${kind}: OFF records stationary fixes without auto-pausing in the actual store`, async t => {
    t.mock.method(Date, 'now', () => BASE);
    const h = recorder(kind); await h.ready(); h.start();
    for (const offset of [0, 1000, 3000, 5000, 9000]) h.add(location(BASE + offset));
    assert.equal(h.store.getState().isPaused, false); assert.equal(h.store.getState().autoPauseState?.mode, 'off');
    assert.equal(h.elapsed(BASE + 10_000), 10);
  });

  test(`${kind}: hot OFF resets an in-progress stop candidate and immediately follows the new policy`, async t => {
    t.mock.method(Date, 'now', () => BASE);
    const h = recorder(kind, { mode: 'running_and_cycling' }); await h.ready(); h.start();
    h.add(location(BASE)); h.add(location(BASE + 1000));
    assert.equal(h.store.getState().autoPauseState?.stationarySamples, 1);
    h.setMode('off');
    assert.equal(h.store.getState().autoPauseState?.mode, 'off');
    assert.equal(h.store.getState().autoPauseState?.stationarySamples, 0);
    h.add(location(BASE + 3000)); h.add(location(BASE + 5000));
    assert.equal(h.store.getState().isPaused, false);
    h.setMode('running_only'); h.add(location(BASE + 6000));
    assert.equal(h.store.getState().isPaused, false);
    h.add(location(BASE + 8000)); assert.equal(h.store.getState().isPaused, true);
  });

  test(`${kind}: changing only cycling preference preserves a running stop candidate`, async t => {
    t.mock.method(Date, 'now', () => BASE);
    const h = recorder(kind, { mode: 'running_and_cycling' }); await h.ready(); h.start();
    h.add(location(BASE)); h.add(location(BASE + 1000));
    const candidate = h.store.getState().autoPauseState?.candidateSinceMs;
    h.setMode('running_only');
    assert.equal(h.store.getState().autoPauseState?.candidateSinceMs, candidate);
    assert.equal(h.store.getState().autoPauseState?.stationarySamples, 1);
    h.add(location(BASE + 3000)); assert.equal(h.store.getState().isPaused, true);
  });

  test(`${kind}: OFF then ON preserves an existing auto-pause and accounts its eventual manual Resume once`, async t => {
    let now = BASE; t.mock.method(Date, 'now', () => now);
    const h = recorder(kind, { mode: 'running_and_cycling' }); await h.ready(); h.start();
    h.add(location(BASE)); h.add(location(BASE + 1000)); h.add(location(BASE + 3000));
    assert.equal(h.store.getState().isPaused, true); assert.equal(h.store.getState().autoPauseState?.manualPaused, false);
    const before = h.store.getState(); const originalDistance = h.distance();
    now = BASE + 4000; h.setMode('off'); now = BASE + 5000; h.setMode('running_and_cycling');
    h.add(location(BASE + 6000, 0.00003, 3)); h.add(location(BASE + 8000, 0.00006, 3));
    const held = h.store.getState();
    assert.equal(held.isPaused, true); assert.equal(held.pausedAt, before.pausedAt);
    assert.equal(held.pausedDurationMs, before.pausedDurationMs); assert.deepEqual(held.recordingPauses, []);
    assert.equal(held.autoPauseState?.manualPaused, true); assert.equal(h.distance(), originalDistance);
    now = BASE + 9000; h.resume(); h.resume();
    assert.equal(h.store.getState().isPaused, false);
    assert.equal(h.store.getState().pausedDurationMs, 6000);
    assert.deepEqual(h.store.getState().recordingPauses, [{ startTime: BASE + 3000, endTime: BASE + 9000 }]);
    assert.equal(h.elapsed(BASE + 10_000), 4);
  });

  test(`${kind}: explicit manual Pause and a pending End are never resumed by policy changes`, async t => {
    let now = BASE; t.mock.method(Date, 'now', () => now);
    const h = recorder(kind, { mode: 'running_and_cycling' }); await h.ready(); h.start();
    now = BASE + 1000; h.pause(); const pausedAt = h.store.getState().pausedAt;
    h.setMode('off'); h.setMode('running_and_cycling');
    assert.equal(h.store.getState().isPaused, true); assert.equal(h.store.getState().pausedAt, pausedAt);
    h.store.setState({ completionRequestedAt: BASE + 2000 });
    const before = h.store.getState().autoPauseState;
    h.setMode('off'); h.add(location(BASE + 4000));
    assert.equal(h.store.getState().autoPauseState, before);
    assert.equal(h.store.getState().completionRequestedAt, BASE + 2000);
    assert.equal(h.store.getState().pausedAt, pausedAt);
  });

  test(`${kind}: detector does not act before settings hydration reveals the saved OFF choice`, async t => {
    t.mock.method(Date, 'now', () => BASE);
    const h = recorder(kind, { mode: 'running_and_cycling', settingsHydrated: false }); await h.ready(); h.start();
    for (const offset of [0, 1000, 3000, 5000]) h.add(location(BASE + offset));
    assert.equal(h.store.getState().isPaused, false);
    assert.equal(h.store.getState().autoPauseState?.stationarySamples, 0);
    h.finishSettings('off');
    assert.equal(h.store.getState().autoPauseState?.mode, 'off');
    h.add(location(BASE + 7000)); assert.equal(h.store.getState().isPaused, false);
  });

  for (const settingsFirst of [true, false]) {
    test(`${kind}: restored recording uses saved OFF with ${settingsFirst ? 'settings' : 'recording'} hydration first`, async t => {
      t.mock.method(Date, 'now', () => BASE + 10_000);
      const restored = { isActive: true, isPaused: false, startedAt: BASE, startTime: BASE,
        workoutInstanceId: 'retained', activityType: 'running', subtype: 'outdoor', environment: 'outdoor',
        autoPauseState: { ...initialAutoPauseState('running', 'running_and_cycling'), stationarySamples: 1, candidateSinceMs: BASE },
        completionRequestedAt: null };
      const h = recorder(kind, { mode: 'running_and_cycling', settingsHydrated: false, deferActiveHydration: true, restored });
      if (settingsFirst) { h.finishSettings('off'); await h.finishActive(); }
      else { await h.finishActive(); h.finishSettings('off'); }
      assert.equal(h.store.getState().isActive, true);
      assert.equal(h.store.getState().autoPauseState?.mode, 'off');
      assert.equal(h.store.getState().autoPauseState?.stationarySamples, 0);
      assert.equal(h.store.getState().isPaused, false);
      h.add(location(BASE + 11_000)); h.add(location(BASE + 14_000)); assert.equal(h.store.getState().isPaused, false);
    });
  }

  test(`${kind}: a legacy paused recording without detector state remains manually held after hydration`, async t => {
    t.mock.method(Date, 'now', () => BASE + 10_000);
    const h = recorder(kind, { mode: 'off', restored: { isActive: true, isPaused: true, pausedAt: BASE + 1000,
      pausedDurationMs: 500, recordingPauses: [], startTime: BASE, startedAt: BASE,
      workoutInstanceId: 'legacy-paused', activityType: 'running', subtype: 'outdoor', environment: 'outdoor',
      autoPauseState: null, completionRequestedAt: null } });
    await h.ready(); h.setMode('running_and_cycling');
    assert.equal(h.store.getState().isPaused, true); assert.equal(h.store.getState().pausedAt, BASE + 1000);
    assert.equal(h.store.getState().autoPauseState?.manualPaused, true);
    assert.equal(h.store.getState().pausedDurationMs, 500);
  });

  test(`${kind}: indoor recording state is not rewritten by GPS auto-pause policy`, async t => {
    t.mock.method(Date, 'now', () => BASE);
    const h = recorder(kind, { mode: 'running_and_cycling' }); await h.ready(); h.start('cycling', true);
    const before = h.store.getState().autoPauseState;
    h.setMode('off'); assert.equal(h.store.getState().autoPauseState, before); assert.equal(h.store.getState().isPaused, false);
  });

  test(`${kind}: Resume after disabling auto-pause rejects queued paused fixes and anchors distance/elevation without a gap`, async t => {
    let now = BASE; t.mock.method(Date, 'now', () => now);
    const h = recorder(kind, { mode: 'running_and_cycling' }); await h.ready(); h.start();
    const instance = h.store.getState().workoutInstanceId;
    h.add(location(BASE)); h.add(location(BASE + 1000)); h.add(location(BASE + 3000));
    assert.equal(h.store.getState().isPaused, true);
    now = BASE + 4000; h.setMode('off');
    h.add(location(BASE + 6000, 0.0002, 3, 50));
    now = BASE + 9000; h.resume();
    const previousPoints = h.pointCount();
    h.add(location(BASE + 7000, 0.0002, 3, 50));
    assert.equal(h.pointCount(), previousPoints); assert.equal(h.distance(), 0);
    const inaccurate = location(BASE + 9500, 0.00025, 3, 80);
    h.add({ ...inaccurate, coords: { ...inaccurate.coords, accuracy: 100 } });
    assert.equal(h.pointCount(), previousPoints); assert.equal(h.distance(), 0); assert.equal(h.elevation(), 0);
    h.add(location(BASE + 10_000, 0.0003, 3, 100));
    assert.equal(h.pointCount(), previousPoints + 1);
    assert.equal(h.distance(), 0); assert.equal(h.elevation(), 0);
    h.add(location(BASE + 11_000, 0.00033, 3, 100));
    assert.ok(h.distance() > 2 && h.distance() < 5);
    assert.equal(h.elevation(), 0); assert.equal(h.store.getState().workoutInstanceId, instance);
    assert.equal(h.elapsed(BASE + 11_000), 5);
    assert.equal(h.store.getState().pausedDurationMs, 6000);
    assert.deepEqual(h.store.getState().recordingPauses, [{ startTime: BASE + 3000, endTime: BASE + 9000 }]);
    const firstSegmentDistance = h.distance();
    now = BASE + 12_000; h.pause();
    h.add(location(BASE + 13_000, 0.0008, 3, 150));
    now = BASE + 20_000; h.resume();
    h.add(location(BASE + 17_000, 0.0008, 3, 150));
    assert.equal(h.distance(), firstSegmentDistance);
    h.add(location(BASE + 21_000, 0.001, 3, 200));
    assert.equal(h.distance(), firstSegmentDistance); assert.equal(h.elevation(), 0);
    h.add(location(BASE + 22_000, 0.00103, 3, 200));
    assert.ok(h.distance() > 5 && h.distance() < 8); assert.equal(h.elevation(), 0);
    assert.equal(h.elapsed(BASE + 22_000), 8);
    assert.equal(h.store.getState().pausedDurationMs, 14_000);
    assert.deepEqual(h.store.getState().recordingPauses, [
      { startTime: BASE + 3000, endTime: BASE + 9000 },
      { startTime: BASE + 12_000, endTime: BASE + 20_000 },
    ]);
    assert.equal(h.store.getState().workoutInstanceId, instance);
  });
}

for (const [sport, subtype] of [['running', 'run_walk'], ['cycling', 'road'], ['cycling', 'mountain']] as const) {
  test(`Activity ${subtype}: automatic pause remains supported and hot OFF is honored`, async t => {
    let now = BASE; t.mock.method(Date, 'now', () => now);
    const h = recorder('activity', { mode: 'running_and_cycling' }); await h.ready(); h.start(sport, false, subtype);
    h.add(location(BASE)); h.add(location(BASE + 1000)); h.add(location(BASE + 3000));
    assert.equal(h.store.getState().isPaused, true);
    h.setMode('off'); assert.equal(h.store.getState().autoPauseState?.mode, 'off');
    now = BASE + 5000; h.resume();
    h.add(location(BASE + 6000)); h.add(location(BASE + 8000));
    assert.equal(h.store.getState().isPaused, false);
    h.setMode('running_and_cycling');
    h.add(location(BASE + 10_000)); assert.equal(h.store.getState().isPaused, false);
    h.add(location(BASE + 12_000)); assert.equal(h.store.getState().isPaused, true);
  });

  for (const settingsFirst of [true, false]) {
    test(`Activity ${subtype}: saved OFF survives ${settingsFirst ? 'settings' : 'recording'} hydration first`, async t => {
      t.mock.method(Date, 'now', () => BASE + 20_000);
      const h = recorder('activity', { mode: 'running_and_cycling', settingsHydrated: false, deferActiveHydration: true,
        restored: { isActive: true, isPaused: false, startedAt: BASE, workoutInstanceId: `restored-${subtype}`,
          activityType: sport, subtype, completionRequestedAt: null,
          autoPauseState: initialAutoPauseState(sport, 'running_and_cycling') } });
      if (settingsFirst) { h.finishSettings('off'); await h.finishActive(); }
      else { await h.finishActive(); h.finishSettings('off'); }
      assert.equal(h.store.getState().isActive, true); assert.equal(h.store.getState().autoPauseState?.mode, 'off');
      h.add(location(BASE + 21_000)); h.add(location(BASE + 22_000)); h.add(location(BASE + 24_000));
      assert.equal(h.store.getState().isPaused, false);
    });
  }
}

test('Activity walking and hiking never acquire running/cycling auto-pause behavior', async t => {
  t.mock.method(Date, 'now', () => BASE);
  for (const sport of ['walking', 'hiking'] as const) {
    const h = recorder('activity', { mode: 'running_and_cycling' }); await h.ready(); h.start(sport);
    for (const offset of [0, 1000, 3000, 6000]) h.add(location(BASE + offset));
    h.setMode('off'); h.setMode('running_and_cycling');
    assert.equal(h.store.getState().autoPauseState, null); assert.equal(h.store.getState().isPaused, false);
  }
});

test('Activity cycling obeys cycling-only policy while running remains disabled', async t => {
  t.mock.method(Date, 'now', () => BASE);
  const run = recorder('run', { mode: 'cycling_only' }); await run.ready(); run.start();
  const ride = recorder('activity', { mode: 'cycling_only' }); await ride.ready(); ride.start('cycling');
  for (const offset of [0, 1000, 3000]) { run.add(location(BASE + offset)); ride.add(location(BASE + offset)); }
  assert.equal(run.store.getState().isPaused, false); assert.equal(ride.store.getState().isPaused, true);
});

test('Activity cycling keeps its candidate when the running preference is enabled', async t => {
  t.mock.method(Date, 'now', () => BASE);
  const h = recorder('activity', { mode: 'cycling_only' }); await h.ready(); h.start('cycling');
  h.add(location(BASE)); h.add(location(BASE + 1000));
  const candidate = h.store.getState().autoPauseState?.candidateSinceMs;
  h.setMode('running_and_cycling');
  assert.equal(h.store.getState().autoPauseState?.candidateSinceMs, candidate);
  assert.equal(h.store.getState().autoPauseState?.stationarySamples, 1);
  h.add(location(BASE + 3000)); assert.equal(h.store.getState().isPaused, true);
});
