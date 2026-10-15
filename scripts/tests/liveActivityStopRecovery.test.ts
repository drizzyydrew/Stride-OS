import assert from 'node:assert/strict';
import Module from 'node:module';
import test, { type TestContext } from 'node:test';
import type { StrideRunControlCommand } from '../../modules/stride-live-activity/src';
import { OUTDOOR_SPORTS } from '../../src/utils/outdoorSports';

function load<T>(path: string, mocks: Record<string, unknown>): T {
  const loader = Module as unknown as { _load: (id: string, ...args: unknown[]) => unknown };
  const original = loader._load;
  delete require.cache[require.resolve(path)];
  loader._load = function (id, ...args) {
    return Object.hasOwn(mocks, id) ? mocks[id] : original.call(this, id, ...args);
  };
  try { return require(path); } finally { loader._load = original; }
}

const drain = () => new Promise<void>(resolve => setImmediate(resolve));
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

function harness(t: TestContext) {
  let tick!: () => void;
  t.mock.method(globalThis, 'setInterval', ((callback: () => void) => { tick = callback; return 1; }) as unknown as typeof setInterval);
  t.mock.method(globalThis, 'clearInterval', () => {});
  t.mock.method(console, 'warn', () => {});
  const lease = { ownerUserId: 'A', generation: 1 };
  let ownerCurrent = true;
  let pending: StrideRunControlCommand | null = null;
  const cleared: string[] = [];
  const routes: string[] = [];
  const controls: string[] = [];
  const submitted: { workoutInstanceId: string; endedAt: number }[] = [];
  const run = { isActive: false, workoutInstanceId: null as string | null, startTime: null as number | null,
    environment: 'outdoor', pauseRun: () => { controls.push('run-pause'); }, resumeRun: () => { controls.push('run-resume'); },
    requestCompletion: () => { controls.push('legacy-run-stop'); } };
  const outdoor = { isActive: false, workoutInstanceId: null as string | null, activityId: null as string | null,
    activityType: 'hiking', pause: () => { controls.push('outdoor-pause'); }, resume: () => { controls.push('outdoor-resume'); },
    requestCompletion: () => { controls.push('legacy-outdoor-stop'); } };
  let session: { workoutInstanceId: string; source: string } | null = null;
  const store = (state: unknown) => ({ persist: { hasHydrated: () => true }, getState: () => state });
  const runStore = store(run);
  const outdoorStore = store(outdoor);
  const strengthStore = { ...store(null), getState: () => ({ session: session ? { ...session, exercises: [], currentExerciseIndex: 0 } : null,
    pause: () => { controls.push('strength-pause'); }, resume: () => { controls.push('strength-resume'); },
    requestCompletion: () => { controls.push('strength-complete'); } }) };
  type Accepted = { status: 'saved' | 'awaiting_confirmation'; activityId: string | null; ownerLease: typeof lease };
  const saved: Accepted = { status: 'saved', activityId: 'saved', ownerLease: lease };
  let complete = async (): Promise<Accepted> => saved;
  const api = load<typeof import('../../src/lib/runLiveActivity')>('../../src/lib/runLiveActivity', {
    'stride-live-activity': {
      getPendingRunControlCommand: () => pending,
      clearPendingRunControlCommand: (id: string) => { cleared.push(id); if (pending?.id === id) pending = null; },
      updateStrideRunLiveActivity: async () => {},
    },
    '../store/activeRunStore': { useActiveRunStore: runStore },
    '../store/settingsStore': { useSettingsStore: { getState: () => ({ units: 'metric' }) } },
  });
  let effect!: () => () => void;
  const reconciler = load<typeof import('../../src/components/liveActivity/LiveActivityCommandReconciler')>(
    '../../src/components/liveActivity/LiveActivityCommandReconciler', {
      react: { useEffect: (callback: () => () => void) => { effect = callback; } },
      'expo-router': { router: { replace: (route: string) => { routes.push(route); } } },
      '../../store/activeRunStore': { useActiveRunStore: runStore, activeRunElapsedSeconds: () => 0 },
      '../../store/activeActivityStore': { useActiveActivityStore: outdoorStore, activeOutdoorElapsedSeconds: () => 0 },
      '../../store/activeStrengthSessionStore': { useActiveStrengthSessionStore: strengthStore, activeStrengthElapsedSeconds: () => 0 },
      '../../lib/runLiveActivity': { ...api, updateRunLiveActivity: async () => {}, updateOutdoorLiveActivity: async () => {} },
      '../../lib/strengthLiveActivity': { strengthLiveActivitySessionId: () => 'strength', updateStrengthLiveActivity: async () => {} },
      '../../lib/localDataOwner': { captureOwnerLease: () => ownerCurrent ? lease : null,
        ownerLeaseIsCurrent: (value: unknown) => ownerCurrent && value === lease },
      '../../lib/outdoorCompletion': { completeWatchActivityEnd: async (command: typeof submitted[number]) => {
        submitted.push(command); return complete();
      } },
    });
  reconciler.default();
  const unmount = effect();
  const stop = (instance = 'recording', source = 'outdoor'): StrideRunControlCommand => ({
    id: `stop-${instance}`, action: 'stop', workoutInstanceId: instance, sessionId: instance,
    sessionSource: source, createdAt: (Date.now() - 180_000) / 1000,
  });
  return { api, run, outdoor, cleared, routes, controls, submitted, lease, saved, stop, unmount,
    tick: () => tick(), setPending: (command: StrideRunControlCommand) => { pending = command; },
    get pending() { return pending; }, setComplete: (fn: typeof complete) => { complete = fn; },
    revokeOwner: () => { ownerCurrent = false; }, setSession: (value: typeof session) => { session = value; },
  };
}

test('all nine outdoor sports and Training Run use exact original Stop time without fabricated Watch evidence', async t => {
  const h = harness(t); await drain();
  for (const sport of Object.keys(OUTDOOR_SPORTS)) {
    Object.assign(h.outdoor, { isActive: true, workoutInstanceId: sport, activityId: sport, activityType: sport });
    const command = h.stop(sport);
    h.setPending(command); h.tick();
    assert.equal(h.cleared.includes(command.id), false);
    assert.deepEqual(h.submitted.at(-1), { workoutInstanceId: sport, endedAt: command.createdAt * 1000 });
    await drain();
    assert.equal(h.pending, null);
  }
  h.outdoor.isActive = false;
  Object.assign(h.run, { isActive: true, workoutInstanceId: 'run', startTime: 1 });
  const command = h.stop('run', 'running');
  h.setPending(command); h.tick(); await drain();
  assert.deepEqual(h.submitted.at(-1), { workoutInstanceId: 'run', endedAt: command.createdAt * 1000 });
  assert.equal(h.routes.at(-1), '/(tabs)/training');
  assert.deepEqual(h.controls, []);
  assert.equal(h.cleared.length, 10);
});

test('Stop is neither acknowledged nor dispatched twice while durable acceptance is pending', async t => {
  const h = harness(t); await drain();
  const acceptance = deferred<typeof h.saved>();
  h.setComplete(() => acceptance.promise);
  const command = h.stop(); h.setPending(command);
  h.tick(); h.tick(); await drain();
  assert.equal(h.submitted.length, 1);
  assert.deepEqual(h.cleared, []);
  assert.equal(h.pending?.id, command.id);
  acceptance.resolve(h.saved); await drain();
  assert.deepEqual(h.cleared, [command.id]);
});

test('failed durable Stop stays pending and the same command can retry successfully', async t => {
  const h = harness(t); await drain();
  h.setComplete(async () => { throw new Error('journal disk unavailable'); });
  const command = h.stop(); h.setPending(command); h.tick(); await drain();
  assert.equal(h.pending?.id, command.id);
  assert.deepEqual(h.cleared, []);
  h.setComplete(async () => h.saved); h.tick(); await drain();
  assert.equal(h.submitted.length, 2);
  assert.equal(h.pending, null);
  assert.deepEqual(h.submitted[0], h.submitted[1]);
});

test('Stop rejects missing, inconsistent, foreign-source and invalid identity/time rather than adopting the current session', async t => {
  const h = harness(t); await drain();
  Object.assign(h.outdoor, { isActive: true, workoutInstanceId: 'recording', activityId: 'recording' });
  for (const patch of [
    { workoutInstanceId: undefined, sessionId: undefined }, { sessionSource: undefined }, { sessionSource: 'preset' },
    { sessionSource: 'running' }, { sessionId: 'other' }, { createdAt: NaN }, { createdAt: 0 },
  ]) {
    const command = { ...h.stop(), ...patch };
    h.setPending(command); h.tick(); await drain();
    assert.equal(h.pending?.id, command.id);
  }
  assert.deepEqual(h.submitted, []);
  assert.deepEqual(h.cleared, []);
  assert.deepEqual(h.controls, []);
});

test('explicit session ID remains supported without a separate workout ID', async t => {
  const h = harness(t); await drain();
  const command = { ...h.stop(), workoutInstanceId: undefined };
  h.setPending(command); h.tick(); await drain();
  assert.deepEqual(h.submitted, [{ workoutInstanceId: 'recording', endedAt: command.createdAt * 1000 }]);
  assert.equal(h.pending, null);
});

test('owner revocation during acceptance retains native Stop and prevents navigation', async t => {
  const h = harness(t); await drain();
  const acceptance = deferred<typeof h.saved>(); h.setComplete(() => acceptance.promise);
  h.setPending(h.stop()); h.tick(); h.revokeOwner(); acceptance.resolve(h.saved); await drain();
  assert.deepEqual(h.cleared, []);
  assert.deepEqual(h.routes, []);
  assert.ok(h.pending);
});

test('cleanup of an older Stop cannot clear a newer native command or navigate over a newer recording', async t => {
  const h = harness(t); await drain();
  const acceptance = deferred<typeof h.saved>(); h.setComplete(() => acceptance.promise);
  const old = h.stop('old'); h.setPending(old); h.tick();
  Object.assign(h.outdoor, { isActive: true, workoutInstanceId: 'new', activityId: 'new' });
  const newer = h.stop('new'); h.setPending(newer);
  acceptance.resolve(h.saved); await drain();
  assert.deepEqual(h.cleared, [old.id]);
  assert.equal(h.pending?.id, newer.id);
  assert.equal(h.outdoor.workoutInstanceId, 'new');
  assert.deepEqual(h.routes, []);
});

test('durably deferred indoor Stop is acknowledged only after acceptance and keeps the confirmation route', async t => {
  const h = harness(t); await drain();
  Object.assign(h.run, { isActive: true, workoutInstanceId: 'indoor', startTime: 1, environment: 'indoor' });
  h.setComplete(async () => ({ ...h.saved, status: 'awaiting_confirmation', activityId: null }));
  const command = h.stop('indoor', 'running'); h.setPending(command); h.tick();
  assert.deepEqual(h.cleared, []);
  await drain();
  assert.deepEqual(h.cleared, [command.id]);
  assert.deepEqual(h.routes, ['/(tabs)/training']);
  assert.deepEqual(h.controls, []);
});

test('unmount during pending acceptance leaves native Stop replayable', async t => {
  const h = harness(t); await drain();
  const acceptance = deferred<typeof h.saved>(); h.setComplete(() => acceptance.promise);
  h.setPending(h.stop()); h.tick(); h.unmount(); acceptance.resolve(h.saved); await drain();
  assert.ok(h.pending);
  assert.deepEqual(h.cleared, []);
  assert.deepEqual(h.routes, []);
});

test('pause/resume keep freshness expiry and strength Complete keeps its existing behavior', async t => {
  const h = harness(t); await drain();
  Object.assign(h.run, { isActive: true, workoutInstanceId: 'run', startTime: 1 });
  for (const action of ['pause', 'resume'] as const) {
    const before = h.controls.length;
    h.setPending({ ...h.stop('run', 'running'), id: `stale-${action}`, action }); h.tick();
    assert.equal(h.controls.length, before);
    h.setPending({ ...h.stop('run', 'running'), id: `fresh-${action}`, action, createdAt: Date.now() / 1000 }); h.tick();
  }
  assert.deepEqual(h.controls, ['run-pause', 'run-resume']);
  h.run.isActive = false;
  h.setSession({ workoutInstanceId: 'strength', source: 'preset' });
  h.setPending({ id: 'strength', action: 'strength_complete', createdAt: Date.now() / 1000,
    workoutInstanceId: 'strength', sessionSource: 'preset' }); h.tick();
  assert.equal(h.pending, null);
  assert.equal(h.controls.at(-1), 'strength-complete');
  assert.equal(h.routes.at(-1), '/(tabs)/strength/preset-session');
  assert.deepEqual(h.submitted, []);
});

test('Stop handlers must explicitly confirm acceptance; a void return does not authorize acknowledgement', async t => {
  const h = harness(t); await drain(); h.unmount();
  const stopPolling = h.api.startControlCommandPolling({ stop: () => {} });
  h.setPending(h.stop()); h.tick(); await drain();
  assert.ok(h.pending);
  assert.deepEqual(h.cleared, []);
  stopPolling();
});
