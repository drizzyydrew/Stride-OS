import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

import { createObservabilityRuntime } from '../../src/lib/observability';
import { createObservabilityConsent, type ObservabilityConsent } from '../../src/utils/observabilityConsent';

type Auth = { loading: boolean; canAccessLocalData: boolean; user: { id: string } | null };
type Kind = 'usage' | 'diagnostics';
type TourEvent = { name: string } & Record<string, unknown>;
const signedIn = (id = 'owner-a'): Auth => ({ loading: false, canAccessLocalData: true, user: { id } });
const savedConsent = (owner = 'owner-a') => JSON.stringify({ version: 1, owner, usage: true, diagnostics: true });
const tick = () => new Promise<void>(resolve => setImmediate(resolve));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(finish => { resolve = finish; });
  return { promise, resolve };
}

function memoryStorage(initial: string | null = null) {
  let raw = initial;
  const calls = { reads: 0, writes: 0, removes: 0 };
  return {
    calls,
    get raw() { return raw; },
    getItem: async (_key: string): Promise<string | null> => { calls.reads++; return raw; },
    setItem: async (_key: string, value: string) => { calls.writes++; raw = value; },
    removeItem: async (_key: string) => { calls.removes++; raw = null; },
  };
}

function store<T>(initial: T) {
  let state = initial;
  const listeners = new Set<(next: T, previous: T) => void>();
  return {
    getState: () => state,
    subscribe(listener: (next: T, previous: T) => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    publish(next: T) {
      const previous = state;
      state = next;
      listeners.forEach(listener => listener(next, previous));
    },
    get subscriberCount() { return listeners.size; },
  };
}

function bridgeHarness(options: {
  auth?: Auth;
  storage?: Parameters<typeof createObservabilityConsent>[0];
  pendingFactories?: boolean;
} = {}) {
  const auth = store(options.auth ?? signedIn());
  const onboarding = store({ onboardingComplete: false });
  const consentController = createObservabilityConsent(options.storage ?? memoryStorage());
  const consentListeners = new Set<() => void>();
  const ownerChanges: (string | null)[] = [];
  const ownerWork: Promise<void>[] = [];
  const consent = {
    ...consentController,
    subscribe(listener: () => void) {
      consentListeners.add(listener);
      const unsubscribe = consentController.subscribe(listener);
      return () => { consentListeners.delete(listener); unsubscribe(); };
    },
    setOwner(owner: string | null) {
      ownerChanges.push(owner);
      const work = consentController.setOwner(owner);
      ownerWork.push(work);
      return work;
    },
  };
  const starts: { kind: Kind; owner: string | null; isActive: () => boolean; stops: number }[] = [];
  const captures: string[] = [];
  const pendingFactories: (() => void)[] = [];
  const factory = (kind: Kind) => async (isActive: () => boolean) => {
    const record = { kind, owner: consent.getState().owner, isActive, stops: 0 };
    starts.push(record);
    const connection = {
      capture(name: string) { captures.push(name); },
      stop() { record.stops++; },
    };
    if (!options.pendingFactories) return connection;
    const pending = deferred<typeof connection>();
    pendingFactories.push(() => pending.resolve(connection));
    return pending.promise;
  };
  const runtime = createObservabilityRuntime({ usage: factory('usage'), diagnostics: factory('diagnostics') });
  const syncs: ObservabilityConsent[] = [];
  const observability = {
    track: runtime.track,
    sync(state: ObservabilityConsent) { syncs.push({ ...state }); runtime.sync(state); },
  };
  const tours = new Set<(event: TourEvent) => void>();
  const effects: (() => (() => void) | undefined)[] = [];
  const modules: Record<string, unknown> = {
    react: { useEffect: (effect: () => (() => void) | undefined) => { effects.push(effect); } },
    '../../store/authStore': { useAuthStore: auth },
    '../../store/onboardingStore': { useOnboardingStore: onboarding },
    '../../store/observabilityConsentStore': { observabilityConsent: consent },
    '../../lib/observability': { observability },
    '../../utils/featureTourEvents': {
      subscribeFeatureTourEvents(listener: (event: TourEvent) => void) {
        tours.add(listener);
        return () => { tours.delete(listener); };
      },
    },
  };
  const moduleExports: { default?: () => null } = {};
  const file = path.resolve('src/components/sync/ObservabilityBridge.tsx');
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, {
    exports: moduleExports,
    require(id: string) {
      assert.ok(Object.hasOwn(modules, id), `Unexpected bridge dependency: ${id}`);
      return modules[id];
    },
  }, { filename: file });
  assert.ok(moduleExports.default);
  assert.equal(moduleExports.default(), null);
  const cleanups = effects.map(effect => effect());
  let cleaned = false;
  return {
    auth, onboarding, consent, starts, captures, ownerChanges, syncs,
    async settleOwners() { await Promise.all(ownerWork); await tick(); },
    resolveFactories() { pendingFactories.splice(0).forEach(resolve => resolve()); },
    emitTour(event: TourEvent) { tours.forEach(listener => listener(event)); },
    get subscriptions() {
      return { auth: auth.subscriberCount, consent: consentListeners.size, onboarding: onboarding.subscriberCount, tours: tours.size };
    },
    cleanup() {
      if (cleaned) return;
      cleaned = true;
      cleanups.forEach(cleanup => cleanup?.());
    },
  };
}

test('initial auth loading preserves persistent consent and defers all SDK initialization', async t => {
  const disk = memoryStorage(savedConsent());
  const bridge = bridgeHarness({ auth: { loading: true, canAccessLocalData: false, user: null }, storage: disk });
  t.after(bridge.cleanup);
  await tick();
  assert.deepEqual(bridge.ownerChanges, []);
  assert.deepEqual(disk.calls, { reads: 0, writes: 0, removes: 0 });
  assert.equal(disk.raw, savedConsent());
  assert.equal(bridge.starts.length, 0);
  bridge.auth.publish(signedIn());
  await bridge.settleOwners();
  assert.deepEqual(bridge.ownerChanges, ['owner-a']);
  assert.deepEqual(bridge.starts.map(start => start.kind), ['usage', 'diagnostics']);
  assert.equal(disk.raw, savedConsent());
});

test('delayed owner hydration cannot initialize SDKs while auth is loading', async t => {
  const read = deferred<string | null>();
  const bridge = bridgeHarness({ storage: { ...memoryStorage(), getItem: () => read.promise } });
  t.after(bridge.cleanup);
  await tick();
  assert.equal(bridge.consent.getState().ready, false);
  bridge.auth.publish({ ...signedIn(), loading: true });
  read.resolve(savedConsent());
  await bridge.settleOwners();
  assert.equal(bridge.consent.getState().usage, true);
  assert.equal(bridge.consent.getState().diagnostics, true);
  assert.equal(bridge.starts.length, 0);
  assert.equal(bridge.syncs.at(-1)?.ready, false);
  bridge.auth.publish(signedIn());
  await tick();
  assert.equal(bridge.starts.length, 2);
  assert.deepEqual(bridge.ownerChanges, ['owner-a']);
});

for (const kind of ['usage', 'diagnostics'] as const) {
  test(`delayed ${kind} opt-in save cannot initialize an SDK during auth loading`, async t => {
    const write = deferred<void>();
    const disk = memoryStorage();
    const bridge = bridgeHarness({ storage: {
      ...disk,
      setItem: async (key, value) => { await write.promise; await disk.setItem(key, value); },
    } });
    t.after(bridge.cleanup);
    await bridge.settleOwners();
    const saving = bridge.consent.setConsent(kind, true);
    await tick();
    assert.equal(bridge.consent.getState()[kind], false);
    bridge.auth.publish({ ...signedIn(), loading: true });
    write.resolve(undefined);
    await saving;
    await tick();
    assert.equal(bridge.consent.getState()[kind], true);
    assert.equal(bridge.starts.length, 0);
    assert.equal(bridge.syncs.at(-1)?.ready, false);
    bridge.auth.publish(signedIn());
    await tick();
    assert.deepEqual(bridge.starts.map(start => start.kind), [kind]);
  });
}

test('a mismatched owner cannot activate SDKs through consent publication', async t => {
  const bridge = bridgeHarness({ storage: memoryStorage(savedConsent('owner-b')) });
  t.after(bridge.cleanup);
  await bridge.settleOwners();
  await bridge.consent.setOwner('owner-b');
  await tick();
  assert.equal(bridge.consent.getState().usage, true);
  assert.equal(bridge.consent.getState().diagnostics, true);
  assert.equal(bridge.consent.getState().owner, 'owner-b');
  assert.equal(bridge.auth.getState().user?.id, 'owner-a');
  assert.equal(bridge.starts.length, 0);
  assert.equal(bridge.syncs.at(-1)?.ready, false);
});

for (const [name, auth] of [
  ['blocked local access', { ...signedIn(), canAccessLocalData: false }],
  ['signed out', { loading: false, canAccessLocalData: true, user: null }],
] as const) {
  test(`${name} prevents later consent publications from reactivating SDKs`, async t => {
    const bridge = bridgeHarness({ storage: memoryStorage(savedConsent()) });
    t.after(bridge.cleanup);
    await bridge.settleOwners();
    assert.equal(bridge.starts.length, 2);
    bridge.auth.publish(auth);
    assert.ok(bridge.starts.every(start => !start.isActive() && start.stops === 1));
    await bridge.settleOwners();
    await bridge.consent.setOwner('owner-a');
    await bridge.consent.setConsent('usage', true);
    await bridge.consent.setConsent('diagnostics', true);
    await tick();
    assert.equal(bridge.consent.getState().usage, true);
    assert.equal(bridge.consent.getState().diagnostics, true);
    assert.equal(bridge.starts.length, 2);
    assert.equal(bridge.syncs.at(-1)?.ready, false);
  });
}

test('switching accounts revokes both generations synchronously and resets the new owner', async t => {
  const bridge = bridgeHarness({ storage: memoryStorage(savedConsent()) });
  t.after(bridge.cleanup);
  await bridge.settleOwners();
  assert.equal(bridge.starts.length, 2);
  bridge.auth.publish(signedIn('owner-b'));
  assert.equal(bridge.consent.getState().owner, 'owner-b');
  assert.equal(bridge.consent.getState().ready, false);
  assert.equal(bridge.consent.getState().usage, false);
  assert.equal(bridge.consent.getState().diagnostics, false);
  assert.ok(bridge.starts.every(start => !start.isActive() && start.stops === 1));
  await bridge.settleOwners();
  assert.equal(bridge.consent.getState().ready, true);
  assert.equal(bridge.starts.length, 2);
  assert.deepEqual(bridge.ownerChanges, ['owner-a', 'owner-b']);
  await bridge.consent.setConsent('usage', true);
  await tick();
  assert.equal(bridge.starts.length, 3);
  assert.equal(bridge.starts[2].owner, 'owner-b');
  assert.equal(bridge.starts[2].kind, 'usage');
});

test('cleanup disables clients and removes auth, consent, onboarding and tour subscriptions', async t => {
  const bridge = bridgeHarness({ storage: memoryStorage(savedConsent()) });
  t.after(bridge.cleanup);
  await bridge.settleOwners();
  assert.deepEqual(bridge.subscriptions, { auth: 1, consent: 1, onboarding: 1, tours: 1 });
  bridge.emitTour({ name: 'feature_tour_started', tourId: 'today', tourVersion: 1 });
  bridge.onboarding.publish({ onboardingComplete: true });
  assert.ok(bridge.captures.includes('feature_tour_started'));
  assert.ok(bridge.captures.includes('onboarding_completed'));
  bridge.cleanup();
  assert.deepEqual(bridge.subscriptions, { auth: 0, consent: 0, onboarding: 0, tours: 0 });
  assert.ok(bridge.starts.every(start => !start.isActive() && start.stops === 1));
  const syncCount = bridge.syncs.length;
  const captureCount = bridge.captures.length;
  bridge.auth.publish(signedIn('owner-b'));
  await bridge.consent.setConsent('usage', false);
  bridge.emitTour({ name: 'feature_tour_completed', tourId: 'today', tourVersion: 1 });
  bridge.onboarding.publish({ onboardingComplete: false });
  bridge.onboarding.publish({ onboardingComplete: true });
  await tick();
  assert.equal(bridge.syncs.length, syncCount);
  assert.equal(bridge.captures.length, captureCount);
  assert.deepEqual(bridge.ownerChanges, ['owner-a']);
});

test('cleanup fences factories that resolve after the bridge unmounts', async t => {
  const bridge = bridgeHarness({ storage: memoryStorage(savedConsent()), pendingFactories: true });
  t.after(bridge.cleanup);
  await bridge.settleOwners();
  assert.equal(bridge.starts.length, 2);
  bridge.cleanup();
  assert.ok(bridge.starts.every(start => !start.isActive()));
  bridge.resolveFactories();
  await tick();
  assert.ok(bridge.starts.every(start => start.stops === 1));
  assert.deepEqual(bridge.captures, []);
});
