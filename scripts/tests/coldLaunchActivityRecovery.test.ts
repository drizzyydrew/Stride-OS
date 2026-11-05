import assert from 'node:assert/strict';
import Module from 'node:module';
import test from 'node:test';
import { ColdLaunchActivityRecovery, type RecoveredActivity } from '../../src/lib/coldLaunchActivityRecovery';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}

function harness() {
  const lease = { ownerUserId: 'athlete-a', generation: 1 };
  let ownerCurrent = true;
  let activity: RecoveredActivity | null = {
    domain: 'running', workoutInstanceId: 'original-run', startedAt: 100,
    name: 'Run', route: '/(tabs)/training', ending: false, alreadySaved: false, mayDiscardOnStop: false,
  };
  let pendingStop = false;
  let replacement = false;
  let wait = async () => {};
  let recover = async () => {};
  let complete = async (_value: RecoveredActivity, _time: number) => {};
  const routes: string[] = [];
  const stops: { id: string; time: number }[] = [];
  const deps = {
    waitForHydration: () => wait(), captureOwner: () => ownerCurrent ? lease : null,
    ownerIsCurrent: (candidate: typeof lease) => ownerCurrent && candidate === lease,
    readActivity: () => activity,
    recoverPendingStops: () => recover(), hasPendingNativeStop: () => pendingStop,
    complete: async (value: RecoveredActivity, time: number) => { stops.push({ id: value.workoutInstanceId, time }); await complete(value, time); },
    canNavigateAfterStop: () => !replacement,
    navigate: (value: RecoveredActivity) => { routes.push(value.route); }, now: () => 2000,
  };
  return { deps, routes, stops, get activity() { return activity; }, setActivity: (value: RecoveredActivity | null) => { activity = value; },
    revokeOwner: () => { ownerCurrent = false; }, setPendingStop: () => { pendingStop = true; },
    setReplacement: () => { replacement = true; }, setWait: (value: typeof wait) => { wait = value; },
    setRecover: (value: typeof recover) => { recover = value; }, setComplete: (value: typeof complete) => { complete = value; } };
}

test('cold-launch Resume returns to the same retained recording without restarting or ending it', async () => {
  const h = harness(); const recovery = new ColdLaunchActivityRecovery(1000);
  const decision = (await recovery.prepare(h.deps))!;
  assert.equal(recovery.claimPresentation(decision), true);
  assert.equal(decision.resume(), true);
  assert.deepEqual(h.routes, ['/(tabs)/training']); assert.deepEqual(h.stops, []);
  assert.equal(h.activity?.startedAt, 100);
  assert.equal(await recovery.prepare(h.deps), null);
});

test('Stop journals one exact identity and timestamp through the existing completion port', async () => {
  const h = harness(); const recovery = new ColdLaunchActivityRecovery(1000);
  const decision = (await recovery.prepare(h.deps))!;
  recovery.claimPresentation(decision);
  assert.equal(await decision.stop(), true);
  assert.equal(await decision.stop(), false);
  assert.equal(decision.resume(), false);
  assert.deepEqual(h.stops, [{ id: 'original-run', time: 2000 }]);
  assert.deepEqual(h.routes, ['/(tabs)/training']);
});

test('short recovered runs require explicit discard acknowledgment before Stop', async () => {
  const h = harness(); h.setActivity({ ...h.activity!, mayDiscardOnStop: true });
  const decision = (await new ColdLaunchActivityRecovery(1000).prepare(h.deps))!;
  assert.equal(decision.requiresDiscardConfirmation(), true);
  assert.equal(await decision.stop(), false); assert.deepEqual(h.stops, []);
  assert.equal(await decision.stop({ allowShortDiscard: true }), true);
  assert.deepEqual(h.stops, [{ id: 'original-run', time: 2000 }]);
});

test('ownership changed after the short-recording warning cannot authorize its confirmed Stop', async () => {
  const h = harness(); h.setActivity({ ...h.activity!, mayDiscardOnStop: true });
  const decision = (await new ColdLaunchActivityRecovery(1000).prepare(h.deps))!;
  assert.equal(decision.requiresDiscardConfirmation(), true);
  h.revokeOwner(); assert.equal(await decision.stop({ allowShortDiscard: true }), false);
  assert.deepEqual(h.stops, []); assert.deepEqual(h.routes, []);
});

test('hydration is awaited and a recording started after launch is never offered as recovered', async () => {
  const h = harness(); const hydration = deferred(); h.setWait(() => hydration.promise);
  const recovery = new ColdLaunchActivityRecovery(1000); const preparation = recovery.prepare(h.deps);
  h.setActivity({ ...h.activity!, workoutInstanceId: 'new-run', startedAt: 1500 });
  hydration.resolve(); assert.equal(await preparation, null);
});

test('an initially empty launch is considered once; later recording and ordinary unlock do not prompt', async () => {
  const h = harness(); const previous = h.activity; h.setActivity(null);
  const recovery = new ColdLaunchActivityRecovery(1000);
  assert.equal(await recovery.prepare(h.deps), null);
  h.setActivity(previous); assert.equal(await recovery.prepare(h.deps), null);
});

test('pending Stop recovery completes before a choice and suppresses already-ended activity', async () => {
  const h = harness(); h.setRecover(async () => { h.setActivity(null); });
  assert.equal(await new ColdLaunchActivityRecovery(1000).prepare(h.deps), null);
  assert.deepEqual(h.stops, []); assert.deepEqual(h.routes, []);
});

test('pending Stop recovery failure preserves the recording and offers no unsafe choice', async () => {
  const h = harness(); h.setRecover(async () => { throw new Error('retained-stop-storage-locked'); });
  await assert.rejects(new ColdLaunchActivityRecovery(1000).prepare(h.deps), /locked/);
  assert.equal(h.activity?.workoutInstanceId, 'original-run'); assert.deepEqual(h.stops, []);
});

test('ending, already-saved, invalid-identity and pending native Stop recordings are not offered', async () => {
  for (const update of [{ ending: true }, { alreadySaved: true }, { workoutInstanceId: '' }, { startedAt: NaN }]) {
    const h = harness(); h.setActivity({ ...h.activity!, ...update });
    assert.equal(await new ColdLaunchActivityRecovery(1000).prepare(h.deps), null);
  }
  const h = harness(); h.setPendingStop();
  assert.equal(await new ColdLaunchActivityRecovery(1000).prepare(h.deps), null);
});

test('owner changes and replacement sessions invalidate both buttons of an existing dialog', async () => {
  const h = harness(); const decision = (await new ColdLaunchActivityRecovery(1000).prepare(h.deps))!;
  h.revokeOwner(); assert.equal(decision.resume(), false); assert.equal(await decision.stop(), false);
  assert.deepEqual(h.stops, []); assert.deepEqual(h.routes, []);
  const other = harness(); const second = (await new ColdLaunchActivityRecovery(1000).prepare(other.deps))!;
  other.setActivity({ ...other.activity!, workoutInstanceId: 'new-recording' });
  assert.equal(second.resume(), false); assert.equal(await second.stop(), false);
  assert.deepEqual(other.stops, []);
});

test('same instance with different start time is not adopted by an old dialog', async () => {
  const h = harness(); const decision = (await new ColdLaunchActivityRecovery(1000).prepare(h.deps))!;
  h.setActivity({ ...h.activity!, startedAt: 200 });
  assert.equal(decision.resume(), false); assert.equal(await decision.stop(), false);
});

test('Watch Stop arriving while dialog is open prevents Resume or a second Stop', async () => {
  const h = harness(); const decision = (await new ColdLaunchActivityRecovery(1000).prepare(h.deps))!;
  h.setPendingStop(); assert.equal(decision.resume(), false); assert.equal(await decision.stop(), false);
  assert.deepEqual(h.stops, []);
});

test('concurrent setup and React effect remounts share one decision and one presentation', async () => {
  const h = harness(); const wait = deferred(); h.setWait(() => wait.promise);
  const recovery = new ColdLaunchActivityRecovery(1000);
  const first = recovery.prepare(h.deps); const second = recovery.prepare(h.deps);
  assert.equal(first, second); wait.resolve();
  const decision = (await first)!;
  assert.equal(recovery.claimPresentation(decision), true);
  assert.equal(recovery.claimPresentation(decision), false);
});

test('completion navigating after success cannot steal a replacement session or another owner', async () => {
  const h = harness(); const completion = deferred(); h.setComplete(() => completion.promise);
  const decision = (await new ColdLaunchActivityRecovery(1000).prepare(h.deps))!;
  const stopping = decision.stop(); h.setReplacement(); completion.resolve();
  await stopping; assert.deepEqual(h.routes, []);
  const other = harness(); const failure = deferred();
  other.setComplete(async () => { await failure.promise; throw new Error('owner changed'); });
  const second = (await new ColdLaunchActivityRecovery(1000).prepare(other.deps))!;
  const revoked = second.stop(); other.revokeOwner(); failure.resolve();
  assert.equal(await revoked, false); assert.deepEqual(other.routes, []);
});

test('outdoor recovery preserves its route, exact ID and completion failure retry screen', async () => {
  const h = harness(); h.setActivity({ ...h.activity!, domain: 'outdoor', route: '/(tabs)/activity/start', name: 'Walk' });
  h.setComplete(async () => { throw new Error('save pending'); });
  const decision = (await new ColdLaunchActivityRecovery(1000).prepare(h.deps))!;
  await assert.rejects(decision.stop(), /pending/);
  assert.deepEqual(h.stops, [{ id: 'original-run', time: 2000 }]);
  assert.deepEqual(h.routes, ['/(tabs)/activity/start']);
});

function load<T>(path: string, mocks: Record<string, unknown>): T {
  const loader = Module as unknown as { _load: (id: string, ...args: unknown[]) => unknown };
  const original = loader._load; delete require.cache[require.resolve(path)];
  loader._load = function (id, ...args) { return Object.hasOwn(mocks, id) ? mocks[id] : original.call(this, id, ...args); };
  try { return require(path); } finally { loader._load = original; }
}

function nativePromptHarness(options: { elapsedSeconds?: number; outdoor?: boolean } = {}) {
  let effect!: () => () => void;
  const alerts: { title: string; message: string; buttons: { text: string; onPress: () => void }[] }[] = [];
  const stops: unknown[] = []; const routes: string[] = [];
  const lease = { ownerUserId: 'athlete-a', generation: 1 };
  let ownerCurrent = true;
  const run = { isActive: !options.outdoor, workoutInstanceId: 'retained-outdoor-run', startTime: Date.now() - 600_000,
    environment: 'outdoor', completionRequestedAt: null };
  const outdoor = { isActive: Boolean(options.outdoor), workoutInstanceId: 'retained-outdoor-walk', startedAt: Date.now() - 600_000,
    name: 'Sensitive personal route name', completionRequestedAt: null };
  const store = (state: unknown) => ({ getState: () => state, persist: { hasHydrated: () => true } });
  let foreground!: (state: string) => void;
  const component = load<typeof import('../../src/components/activity/RecoveredActivityPrompt')>('../../src/components/activity/RecoveredActivityPrompt', {
    react: { useEffect: (callback: typeof effect) => { effect = callback; } },
    'react-native': { Platform: { OS: 'ios' }, AppState: { currentState: 'active', addEventListener: (_name: string, callback: typeof foreground) => { foreground = callback; return { remove() {} }; } },
      Alert: { alert: (title: string, message: string, buttons: typeof alerts[number]['buttons']) => { alerts.push({ title, message, buttons }); } } },
    'expo-router': { useSegments: () => ['(tabs)', 'dashboard'], router: { push: (route: string) => { routes.push(route); } } },
    '../../lib/activeSessionCoordinator': { waitForActiveSessionStores: async () => {} },
    '../../lib/localDataOwner': { captureOwnerLease: () => ownerCurrent ? lease : null, ownerLeaseIsCurrent: (value: unknown) => ownerCurrent && value === lease },
    '../../lib/runLiveActivity': { getPendingRunControlCommand: () => null },
    '../../lib/watchRunCompletion': { recoverRunEndCommands: async () => {} },
    '../../lib/outdoorCompletion': { recoverOutdoorCompletions: async () => {}, completeWatchActivityEnd: async (value: unknown) => { stops.push(value); run.isActive = false; outdoor.isActive = false; } },
    '../../store/activeRunStore': { useActiveRunStore: store(run), activeRunElapsedSeconds: () => options.elapsedSeconds ?? 600 },
    '../../store/activeActivityStore': { useActiveActivityStore: store(outdoor) },
    '../../store/activeIndoorRideStore': { useActiveIndoorRideStore: store({ isActive: false }) },
    '../../store/activeStrengthSessionStore': { useActiveStrengthSessionStore: store({ session: null }) },
    '../../store/activityStore': { useActivityStore: store({ activities: [] }) },
    '../../store/workoutStore': { useWorkoutStore: store({ history: [] }) },
    '../../store/onboardingStore': { useOnboardingStore: () => true },
  });
  component.default(); const unmount = effect();
  return { alerts, stops, routes, unmount, foreground: (state: string) => foreground(state),
    revokeOwner: () => { ownerCurrent = false; }, ready: () => new Promise(resolve => setImmediate(resolve)) };
}

test('root prompt wires native Stop to the existing completion pipeline without Watch evidence', async () => {
  const h = nativePromptHarness(); await h.ready();
  assert.equal(h.alerts.length, 1); assert.equal(h.alerts[0].title, 'Activity still open');
  h.alerts[0].buttons.find(button => button.text === 'Stop activity')!.onPress();
  await h.ready();
  assert.equal(h.stops.length, 1);
  assert.deepEqual(Object.keys(h.stops[0] as object).sort(), ['endedAt', 'workoutInstanceId']);
  assert.equal((h.stops[0] as { workoutInstanceId: string }).workoutInstanceId, 'retained-outdoor-run');
  assert.deepEqual(h.routes, ['/(tabs)/training']);
  h.foreground('active'); await h.ready();
  assert.equal(h.alerts.length, 1); h.unmount();
});

test('native short-run Stop warns before any completion and remains owner-fenced after confirmation', async () => {
  const h = nativePromptHarness({ elapsedSeconds: 60 }); await h.ready();
  h.alerts[0].buttons.find(button => button.text === 'Stop activity')!.onPress();
  assert.equal(h.alerts[1].title, 'Short recording');
  assert.match(h.alerts[1].message, /discarded/); assert.deepEqual(h.stops, []);
  h.revokeOwner(); h.alerts[1].buttons.find(button => button.text === 'Stop anyway')!.onPress();
  await h.ready(); assert.deepEqual(h.stops, []); assert.deepEqual(h.routes, []); h.unmount();
});

test('native short-run warning can keep the same recording or explicitly confirm existing Stop rules', async () => {
  const keep = nativePromptHarness({ elapsedSeconds: 60 }); await keep.ready();
  keep.alerts[0].buttons.find(button => button.text === 'Stop activity')!.onPress();
  keep.alerts[1].buttons.find(button => button.text === 'Continue recording')!.onPress();
  assert.deepEqual(keep.stops, []); assert.deepEqual(keep.routes, ['/(tabs)/training']); keep.unmount();
  const stop = nativePromptHarness({ elapsedSeconds: 60 }); await stop.ready();
  stop.alerts[0].buttons.find(button => button.text === 'Stop activity')!.onPress();
  stop.alerts[1].buttons.find(button => button.text === 'Stop anyway')!.onPress();
  await stop.ready(); assert.equal(stop.stops.length, 1); stop.unmount();
});

test('the recovery alert does not reveal a custom outdoor activity name', async () => {
  const h = nativePromptHarness({ outdoor: true }); await h.ready();
  assert.equal(h.alerts.length, 1); assert.match(h.alerts[0].message, /Outdoor activity/);
  assert.doesNotMatch(h.alerts[0].message, /Sensitive personal route name/); h.unmount();
});
