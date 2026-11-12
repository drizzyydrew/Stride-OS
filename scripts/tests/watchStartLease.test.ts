import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import { LocalDataOwner } from '../../src/lib/localDataOwner';

function nativeWrapper(prepared = true) {
  const calls: { name: string; args: unknown[] }[] = [];
  let status = { isSupported: true, isPaired: true, isWatchAppInstalled: true, isReachable: true,
    activationState: 'activated', lastMessageAt: 0 };
  let endAssociation = true;
  let endFailure = false;
  const native = {
    snapshot: () => status,
    startWorkout: async (...args: unknown[]) => { calls.push({ name: 'legacyStart', args }); return status; },
    endWorkout: async (...args: unknown[]) => { calls.push({ name: 'legacyEnd', args }); return status; },
    pauseWorkout: async (...args: unknown[]) => { calls.push({ name: 'legacyPause', args }); return status; },
    resumeWorkout: async (...args: unknown[]) => { calls.push({ name: 'legacyResume', args }); return status; },
    ...(prepared ? {
      prepareWorkoutStart: (id: string) => { calls.push({ name: 'prepare', args: [id] }); return `nonce:${id}`; },
      startPreparedWorkout: async (...args: unknown[]) => { calls.push({ name: 'preparedStart', args }); return status; },
      cancelPendingStart: (...args: unknown[]) => { calls.push({ name: 'cancel', args }); },
      endPreparedWorkout: (...args: unknown[]) => { calls.push({ name: 'syncEnd', args }); if (endFailure) throw new Error('Watch recovery requests are full'); return endAssociation ? status : null; },
      sendExplicitWorkoutControl: (...args: unknown[]) => { calls.push({ name: 'syncExplicitControl', args }); return status; },
    } : {}),
  };
  const filename = resolve('modules/stride-watch-connectivity/src/index.ts');
  const require = createRequire(filename);
  const module = { exports: {} as any };
  const compiled = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(compiled, { module, exports: module.exports, require: (id: string) =>
    id === 'react-native' ? { Platform: { OS: 'ios' } }
      : id === 'expo-modules-core' ? { requireNativeModule: () => native } : require(id) });
  return { api: module.exports, calls,
    setPaired: (value: boolean) => { status = { ...status, isPaired: value }; },
    setInstalled: (value: boolean) => { status = { ...status, isWatchAppInstalled: value }; },
    setEndAssociation: (value: boolean) => { endAssociation = value; },
    setEndFailure: (value: boolean) => { endFailure = value; },
  };
}

async function ownerFixture() {
  let bytes: string | null = null;
  let failWrites = false;
  const owner = new LocalDataOwner({ getItem: async () => bytes,
    setItem: async (_key, value) => { if (failWrites) throw new Error('owner fixture storage failure'); bytes = value; } });
  await owner.initialize('A', async () => true); await owner.accept('A');
  return { owner, failWrites: () => { failWrites = true; } };
}

function mountActualBridge(owner: LocalDataOwner, cancel: (hard?: boolean) => void) {
  const filename = 'src/components/watch/WatchWorkoutBridge.tsx';
  const source = ts.createSourceFile(filename, readFileSync(filename, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let declaration: ts.FunctionDeclaration | undefined;
  function visit(node: ts.Node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === 'WatchWorkoutBridge') declaration = node;
    ts.forEachChild(node, visit);
  }
  visit(source); assert.ok(declaration);
  let cleanup: (() => void) | undefined;
  let removed = 0;
  const actions = { markDeviceConnected() {}, markDeviceDisconnected() {}, markDeviceError() {}, recordBleReading() {} };
  const context: Record<string, any> = {
    Platform: { OS: 'ios' }, getLocalDataOwner: () => owner,
    cancelPendingStrideWatchStart: cancel,
    useEffect: (effect: () => () => void) => { cleanup = effect(); },
    useLiveSensorStore: (select: (state: typeof actions) => unknown) => select(actions),
    activateStrideWatchConnectivity: async () => undefined,
  };
  for (const name of ['addStrideWatchWorkoutStateListener', 'addStrideWatchHeartRateListener',
    'addStrideWatchStatusListener', 'addStrideWatchErrorListener']) {
    context[name] = () => ({ remove: () => { removed++; } });
  }
  const compiled = ts.transpileModule(`${declaration.getText(source).replace('export default ', '')}\nglobalThis.mount = WatchWorkoutBridge;`, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(compiled, context, { filename }); context.mount();
  return { cleanup: () => cleanup?.(), removed: () => removed };
}

test('actual native wrapper opts only outdoor sport recording into prepared API and retains legacy signatures', async () => {
  const h = nativeWrapper();
  for (const [kind, environment, expected] of [
    ['run', 'outdoor', 'preparedStart'], ['walking', 'outdoor', 'preparedStart'],
    ['run', 'indoor', 'legacyStart'], ['cycling', 'indoor', 'legacyStart'],
    ['strength', 'outdoor', 'legacyStart'], ['mobility', 'indoor', 'legacyStart'],
  ]) {
    await h.api.startStrideWatchWorkout({ workoutInstanceId: 'exact', workoutKind: kind, environment });
    assert.equal(h.calls.at(-1)!.name, expected);
    if (expected === 'preparedStart') assert.deepEqual(h.calls.at(-1)!.args.slice(0, 3), ['nonce:exact', kind, 'exact']);
    else assert.equal(h.calls.at(-1)!.args.length, 5);
  }
  const older = nativeWrapper(false);
  await older.api.startStrideWatchRun({ workoutInstanceId: 'old-binary', environment: 'outdoor' });
  assert.equal(older.calls[0].name, 'legacyStart');
});

test('synchronous exact End precedes pair guards and legacy async fallback', async () => {
  const h = nativeWrapper(); h.setPaired(false);
  await h.api.endStrideWatchWorkoutIfMatching('exact');
  assert.deepEqual(h.calls, [{ name: 'syncEnd', args: ['exact'] }]);
  h.setEndAssociation(false);
  await h.api.endStrideWatchWorkoutIfMatching('none');
  assert.equal(h.calls.filter(call => call.name === 'legacyEnd').length, 0);
  h.setPaired(true);
  await h.api.endStrideWatchWorkout('none');
  assert.deepEqual(h.calls.slice(-2).map(call => call.name), ['syncEnd', 'legacyEnd']);
});

test('cold exact-ID recovery Stop keeps legacy End fallback without preparing or starting', async () => {
  const current = nativeWrapper(); current.setEndAssociation(false);
  await current.api.endStrideWatchWorkoutIfMatching('persisted-cold-recording');
  assert.deepEqual(current.calls.map(call => call.name), ['syncEnd', 'legacyEnd']);
  assert.deepEqual(current.calls.map(call => call.args), [['persisted-cold-recording'], ['persisted-cold-recording']]);
  const legacy = nativeWrapper(false);
  await legacy.api.endStrideWatchWorkoutIfMatching('legacy-cold-recording');
  assert.equal(legacy.calls.at(-1)?.name, 'legacyEnd');
  assert.equal(legacy.calls.some(call => ['prepare', 'preparedStart', 'legacyStart'].includes(call.name)), false);
});

test('explicit controls use one synchronous native call; generic and older native paths stay separate', async () => {
  const current = nativeWrapper();
  await current.api.pauseStrideWatchWorkoutExplicit('current');
  await current.api.resumeStrideWatchWorkoutExplicit('current');
  assert.deepEqual(current.calls, [
    { name: 'syncExplicitControl', args: ['pauseWorkout', 'current'] },
    { name: 'syncExplicitControl', args: ['resumeWorkout', 'current'] },
  ]);
  await current.api.resumeStrideWatchWorkout('current');
  assert.equal(current.calls.at(-1)?.name, 'legacyResume');
  const older = nativeWrapper(false);
  await older.api.pauseStrideWatchWorkoutExplicit('old');
  await older.api.resumeStrideWatchWorkoutExplicit('old');
  assert.deepEqual(older.calls.map(call => call.name), ['legacyPause', 'legacyResume']);
});

test('explicit wrappers preserve nil-ID legacy fallback without native explicit lookup', async () => {
  const h = nativeWrapper();
  for (const id of [undefined, null, '']) {
    await h.api.pauseStrideWatchWorkoutExplicit(id);
    await h.api.resumeStrideWatchWorkoutExplicit(id);
  }
  assert.deepEqual(h.calls.map(call => call.name), ['legacyPause', 'legacyResume', 'legacyPause', 'legacyResume', 'legacyPause', 'legacyResume']);
  assert.deepEqual(h.calls.map(call => call.args), [[null], [null], [null], [null], [''], ['']]);
});

test('exact cleanup propagates terminal-intent failure for journal retry while general End shows the error', async () => {
  const h = nativeWrapper(); h.setEndFailure(true);
  await assert.rejects(h.api.endStrideWatchWorkoutIfMatching('retryable'), /requests are full/);
  const status = await h.api.endStrideWatchWorkout('retryable');
  assert.match(status.lastError, /requests are full/);
  assert.equal(h.calls.some(call => call.name === 'legacyEnd'), false);
});

test('actual phone completion finishes GPS/store/journal with authoritative optional Watch absence', async () => {
  const filename = 'src/lib/watchRunCompletion.ts';
  const source = ts.createSourceFile(filename, readFileSync(filename, 'utf8'), ts.ScriptTarget.Latest, true);
  const cleanup = source.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'cleanup');
  assert.ok(cleanup);
  const compiled = ts.transpileModule(`${cleanup.getText(source)}\nglobalThis.runCleanup = cleanup;`, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  for (const absence of ['no-watch', 'no-app', 'readonly-resume']) {
    const h = nativeWrapper(); h.setEndAssociation(false);
    if (absence === 'no-app') h.setInstalled(false); else h.setPaired(false);
    if (absence === 'readonly-resume') h.api.recoverStrideWatchControlIdentity('phone-only');
    const events: string[] = [];
    const lease = { ownerUserId: 'owner' };
    const state = { isActive: true, workoutInstanceId: 'phone-only', finishRun: () => { events.push('finish'); state.isActive = false; } };
    const context: Record<string, any> = {
      ownerLeaseIsCurrent: () => true,
      endStrideRunLiveActivityIfMatching: async () => true,
      endStrideWatchWorkoutIfMatching: h.api.endStrideWatchWorkoutIfMatching,
      stopLocationTrackingWhen: async (allowed: () => boolean) => { assert.equal(allowed(), true); events.push('gps'); },
      useActiveRunStore: { getState: () => state },
      useWorkoutStore: { getState: () => ({ acknowledgeRunCleanup: async () => { events.push('journal'); } }) },
      retryQueue: { acknowledge: async () => { events.push('retry'); } },
      cleanedEnds: new Set(), key: (owner: string, id: string) => JSON.stringify([owner, id]),
    };
    vm.runInNewContext(compiled, context, { filename });
    assert.equal(await context.runCleanup({ entry: { workoutInstanceId: 'phone-only' }, ownerLease: lease }, lease), true);
    assert.deepEqual(events, ['gps', 'finish', 'journal', 'retry']);
    assert.equal(h.calls.some(call => ['legacyEnd', 'legacyStart', 'preparedStart'].includes(call.name)), false);
  }
});

test('actual root bridge cancels before owner generation changes with distinct benign refresh and hard revoke', async () => {
  const { owner } = await ownerFixture();
  const native = nativeWrapper();
  const seen: { hard: boolean; generation: number; beforeCanAccess: boolean }[] = [];
  const bridge = mountActualBridge(owner, (hard = false) => {
    seen.push({ hard, generation: owner.accessGeneration, beforeCanAccess: owner.canAccess });
    native.api.cancelPendingStrideWatchStart(hard);
  });
  const first = owner.accessGeneration;
  await owner.accept('A', { offline: true });
  await owner.accept('A', { offline: false });
  await owner.accept('B');
  assert.deepEqual(seen.map(value => [value.hard, value.generation]), [[false, first], [false, first + 1], [true, first + 2]]);
  assert.ok(seen.every(value => value.beforeCanAccess));
  assert.equal(owner.status, 'owner-conflict');
  bridge.cleanup();
  assert.equal(native.calls.at(-1)!.args[0], false, 'bridge cleanup never remotely ends a recording');
  assert.equal(bridge.removed(), 4);
  const count = seen.length;
  owner.block('invalid');
  assert.equal(seen.length, count, 'cleanup removes the synchronous owner observer');
});

test('logout, block and storage failure revoke synchronously; a throwing observer cannot stop logout', async () => {
  for (const scenario of ['logout', 'block', 'storage'] as const) {
    const h = await ownerFixture();
    const events: boolean[] = [];
    h.owner.onLeaseInvalidated(() => { throw new Error('observer failure'); });
    mountActualBridge(h.owner, hard => { events.push(Boolean(hard)); });
    if (scenario === 'logout') await h.owner.signOut();
    if (scenario === 'block') h.owner.block('invalid');
    if (scenario === 'storage') {
      h.failWrites(); await assert.rejects(h.owner.accept('A', { offline: true }), /storage failure/);
      assert.equal(h.owner.status, 'storage-error');
      assert.deepEqual(events, [false, true]);
    } else assert.deepEqual(events, [true]);
    assert.equal(h.owner.capture(), null);
  }
});
