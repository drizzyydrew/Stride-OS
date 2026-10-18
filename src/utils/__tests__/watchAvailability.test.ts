import assert from 'node:assert/strict';
import test from 'node:test';
import { createWatchStartCoordinator, watchAvailability, watchErrorText, type WatchStartRequest } from '../watchAvailability';
import type { StrideWatchStatus } from '../../../modules/stride-watch-connectivity/src';

const ready: StrideWatchStatus = {
  isSupported: true, isPaired: true, isWatchAppInstalled: true, isReachable: true,
  activationState: 'activated', lastMessageAt: 0, lastError: null,
};
const active = { active: true, workoutInstanceId: 'phone-123' };

test('locked launch errors become unlock/open/retry guidance without claiming HR or recording', () => {
  const raw = 'Watch app launch failed: URLwhilelocked: passcode required';
  const result = watchAvailability({ ...ready, isReachable: false, lastError: raw }, active);
  assert.equal(result.title, 'Watch start needs attention');
  assert.match(result.detail, /Unlock.*passcode.*open StrideOS.*retry/);
  assert.match(result.detail, /Phone recording continues without confirmed Watch data/);
  assert.equal(result.retryable, true);
  assert.doesNotMatch(result.detail, /URLwhilelocked/);
});

test('native error strings, Error instances and plain Expo errors retain usable reasons', () => {
  assert.equal(watchErrorText(new Error('Health permission denied')), 'Health permission denied');
  assert.equal(watchErrorText(' Watch is locked '), 'Watch is locked');
  assert.equal(watchErrorText({ message: undefined, reason: 'Open the updated watch app' }), 'Open the updated watch app');
  assert.equal(watchErrorText({ message: 'undefinedreason', cause: { localizedDescription: 'URLwhilelocked' } }), 'URLwhilelocked');
  assert.match(watchErrorText({ message: undefined, reason: undefined }), /could not start.*retry/);
  const circular: { cause?: unknown } = {};
  circular.cause = circular;
  assert.match(watchErrorText(circular), /could not start/);
});

test('plural URLs while locked without a passcode suffix gives explicit passcode instructions', () => {
  const result = watchAvailability({ ...ready, isReachable: false, lastError: 'Cannot open URLs while locked' }, active);
  assert.match(result.detail, /Unlock your Apple Watch with its passcode, open StrideOS on the watch, then retry/);
  assert.match(result.detail, /Phone recording continues/);
  assert.equal(result.retryable, true);
});

test('reachability, an old workout and an ended workout never confirm current recording', () => {
  for (const recording of [undefined,
    { workoutInstanceId: 'other', confirmedAt: 1, state: 'running' as const },
    { workoutInstanceId: active.workoutInstanceId, confirmedAt: 1, state: 'ended' as const },
  ]) {
    const result = watchAvailability(ready, { ...active, recording });
    assert.match(result.title, /recording not confirmed/);
    assert.equal(result.retryable, true);
    assert.doesNotMatch(result.title, /ready|live HR|recording confirmed/);
  }
});

test('only matching recording evidence confirms recording; never claims live HR', () => {
  const result = watchAvailability(ready, {
    ...active, recording: { workoutInstanceId: active.workoutInstanceId, confirmedAt: 1, state: 'running' },
  });
  assert.equal(result.title, 'Watch recording confirmed: running');
  assert.equal(result.retryable, false);
  assert.equal(result.detail, 'Heart rate appears when a live sample arrives.');
});

test('recording evidence never hides a reported connection issue or its retry route', () => {
  const result = watchAvailability({ ...ready, lastError: 'URLwhilelocked' }, {
    ...active, recording: { workoutInstanceId: active.workoutInstanceId, confirmedAt: 1, state: 'running' },
  });
  assert.match(result.detail, /Last Watch issue: Unlock/);
  assert.equal(result.retryable, true);
});

test('paused, ending, requesting, idle and absent Watch states cannot retry', () => {
  for (const options of [{ paused: true }, { ending: true }, { requesting: true }, { active: false }]) {
    assert.equal(watchAvailability(ready, { ...active, ...options }).retryable, false);
  }
  for (const overrides of [{ isSupported: false }, { isPaired: false }, { isWatchAppInstalled: false }]) {
    assert.equal(watchAvailability({ ...ready, ...overrides }, active).retryable, false);
  }
  const paused = watchAvailability({ ...ready, lastError: 'launch failed' }, { ...active, paused: true });
  assert.match(paused.detail, /Resume the phone activity/);
  assert.doesNotMatch(paused.detail, /recording continues/);
});

function harness(overrides: Partial<WatchStartRequest> = {}) {
  const calls: string[] = [];
  const state = { status: { ...ready }, current: true };
  const request: WatchStartRequest = {
    workoutInstanceId: active.workoutInstanceId, workoutKind: 'run',
    isCurrent: () => state.current,
    getStatus: () => state.status,
    activate: async () => { calls.push('activate'); return state.status; },
    setContext: async () => { calls.push('context'); },
    start: async () => { calls.push(`start:${active.workoutInstanceId}`); return state.status; },
    wait: async () => { calls.push('wait'); },
    ...overrides,
  };
  return { calls, state, request, coordinator: createWatchStartCoordinator() };
}

test('verified ready run path sends the existing exact-ID start without activation or delay', async () => {
  const h = harness();
  assert.deepEqual(await h.coordinator.request(h.request), ready);
  assert.deepEqual(h.calls, ['context', 'start:phone-123']);
});

test('activation completes before start rather than losing auto-launch to a queued command', async () => {
  const h = harness();
  h.state.status = { ...ready, activationState: 'notActivated' };
  h.request.wait = async () => { h.calls.push('wait'); h.state.status = ready; };
  await h.coordinator.request(h.request);
  assert.deepEqual(h.calls, ['activate', 'wait', 'context', 'start:phone-123']);
});

test('activation timeout is bounded, visible, and does not queue a stale workout start', async () => {
  const h = harness();
  h.state.status = { ...ready, activationState: 'notActivated' };
  const result = await h.coordinator.request(h.request);
  assert.equal(h.calls.filter(call => call === 'wait').length, 15);
  assert.equal(h.calls.some(call => call.startsWith('start:')), false);
  assert.match(result!.lastError!, /still activating.*retry/);
});

test('new sport waits for advertised capabilities before using the native start', async () => {
  const h = harness({ workoutKind: 'walking' });
  h.request.wait = async () => { h.calls.push('capabilities'); h.state.status = { ...ready, supportedWorkoutKinds: ['walking'] }; };
  await h.coordinator.request(h.request);
  assert.deepEqual(h.calls, ['activate', 'capabilities', 'context', 'start:phone-123']);
});

test('missing sport capability preserves native rejection and allows explicit retry after opening Watch', async () => {
  const h = harness({ workoutKind: 'walking' });
  h.state.status = { ...ready, isReachable: false };
  h.request.start = async () => { throw { reason: 'Open the updated StrideOS watch app to enable this sport.' }; };
  const failed = await h.coordinator.request(h.request);
  assert.match(failed!.lastError!, /enable this sport/);
  assert.match(watchAvailability(failed!, active).detail, /updated StrideOS/);
  h.state.status = { ...ready, supportedWorkoutKinds: ['walking'] };
  h.request.start = async () => { h.calls.push('retry:phone-123'); return h.state.status; };
  await h.coordinator.request(h.request);
  assert.equal(h.calls.at(-1), 'retry:phone-123');
});

test('repeated taps share one in-flight start with the same workout ID', async () => {
  const h = harness();
  const first = h.coordinator.request(h.request);
  const second = h.coordinator.request(h.request);
  assert.equal(first, second);
  await first;
  assert.deepEqual(h.calls, ['context', 'start:phone-123']);
});

test('pause, End, replacement or owner change during activation suppresses late start', async () => {
  for (const cancelledDuring of ['activate', 'wait', 'context']) {
    const h = harness();
    if (cancelledDuring !== 'context') h.state.status = { ...ready, activationState: 'notActivated' };
    h.request.activate = async () => {
      if (cancelledDuring === 'activate') h.state.current = false;
      return h.state.status;
    };
    h.request.wait = async () => { h.state.current = false; };
    h.request.setContext = async () => { h.state.current = false; };
    assert.equal(await h.coordinator.request(h.request), null);
    assert.equal(h.calls.some(call => call.startsWith('start:')), false, cancelledDuring);
  }
});

test('late response after session cancellation cannot replace current session status', async () => {
  const h = harness();
  h.request.start = async () => { h.state.current = false; return ready; };
  assert.equal(await h.coordinator.request(h.request), null);
});

test('a real start failure remains visible and retry sends the same ID', async () => {
  const h = harness();
  h.request.start = async () => { throw new Error('URLwhilelocked: passcode required'); };
  const failed = await h.coordinator.request(h.request);
  assert.match(failed!.lastError!, /URLwhilelocked/);
  assert.equal(watchAvailability(failed!, active).retryable, true);
  h.request.start = async () => { h.calls.push('retry:phone-123'); return ready; };
  assert.deepEqual(await h.coordinator.request(h.request), ready);
  assert.equal(h.calls.at(-1), 'retry:phone-123');
});
