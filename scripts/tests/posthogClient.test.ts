import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import * as privacy from '../../src/utils/observabilityPrivacy';
import { FEATURE_TOURS } from '../../src/utils/featureTours';
import config from '../../src/utils/observabilityConfig.cjs';

const KEY = `phc_${'a'.repeat(32)}`;
const HOST = 'https://us.i.posthog.com';
const QUEUE = 'queue';
const tick = () => new Promise<void>(resolve => setImmediate(resolve));
const uuid = (n: number) => `019a0000-0000-7000-8000-${String(n).padStart(12, '0')}`;
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

type Message = { uuid: string; event: string; properties: Record<string, unknown>; [key: string]: unknown };
type FetchOptions = { method: string; body: string; signal?: AbortSignal; headers?: Record<string, string> };
type Response = { status: number; text: () => Promise<string>; json: () => Promise<unknown> };
const success = (): Response => ({ status: 200, text: async () => '{}', json: async () => ({}) });

function harness(env: Record<string, string> = {}) {
  const outgoing: { url: string; options: RequestInit }[] = [];
  const clients: FakePostHog[] = [];
  const operations: string[] = [];
  let listenerCount = 0;
  let sdkImports = 0;
  let sequence = 0;
  let activeTransitions = 0;
  let maxTransitions = 0;
  let optInWait: Promise<void> | undefined;
  let optOutWait: Promise<void> | undefined;
  let optInFailure: Error | undefined;
  let optOutFailure: Error | undefined;
  let network: (options: RequestInit) => Promise<Response> = async () => success();

  class FakePostHog {
    options: any;
    optedOut = true;
    identity = '';
    queue: Message[] = [];
    constructor(_key: string, options: any) {
      this.options = options;
      clients.push(this);
      listenerCount++;
      // The real SDK attempts remote configuration during construction and retains this listener.
      void this.fetch(`${HOST}/config/`, { method: 'GET', body: '' });
      void this.fetch(`${HOST}/flags/`, { method: 'POST', body: '{}' });
    }
    async ready() {}
    async fetch(_url: string, _options: FetchOptions): Promise<Response> { throw new Error('Must be overridden'); }
    async optIn() {
      operations.push('optIn:start');
      activeTransitions++; maxTransitions = Math.max(maxTransitions, activeTransitions);
      const wait = optInWait; optInWait = undefined;
      const failure = optInFailure; optInFailure = undefined;
      try { await wait; if (failure) throw failure; this.optedOut = false; }
      finally { activeTransitions--; operations.push('optIn:end'); }
    }
    async optOut() {
      operations.push('optOut:start');
      activeTransitions++; maxTransitions = Math.max(maxTransitions, activeTransitions);
      const wait = optOutWait; optOutWait = undefined;
      const failure = optOutFailure; optOutFailure = undefined;
      try { await wait; if (failure) throw failure; this.optedOut = true; }
      finally { activeTransitions--; operations.push('optOut:end'); }
    }
    reset(keep: unknown[]) {
      assert.equal(activeTransitions, 0, 'reset cannot overlap async opt-in/out');
      operations.push('reset');
      assert.deepEqual(Array.from(keep), []);
      this.identity = uuid(++sequence);
      this.optedOut = !this.options.defaultOptIn;
      // Deliberately preserve the queue, like the installed SDK's reset().
    }
    getDistinctId() { return this.identity; }
    setPersistedProperty(key: string, value: Message[]) {
      assert.equal(key, QUEUE);
      operations.push('clearQueue');
      this.queue = value;
    }
    capture(event: string, properties: Record<string, unknown>) {
      if (this.optedOut) return;
      const result = this.options.before_send({ uuid: uuid(++sequence), event,
        properties: { ...properties, email: 'private@example.com', $device_id: 'PRIVATE' },
        $set: { private: 'PRIVATE' }, timestamp: new Date() });
      if (!result) return;
      const message = { ...result, distinct_id: 'account-id', timestamp: 'PRIVATE',
        properties: { ...result.properties, sdk_extra: 'PRIVATE' } };
      if (this.queue.length >= this.options.maxQueueSize) this.queue.shift();
      this.queue.push(message);
    }
    async send(messages: Message[], options: Partial<FetchOptions> = {}) {
      return this.fetch(`${HOST}/batch/`, { method: 'POST', body: JSON.stringify({
        api_key: 'PRIVATE', batch: messages, sent_at: 'PRIVATE' }), ...options });
    }
    async flush() {
      const snapshot = [...this.queue];
      const response = await this.send(snapshot);
      this.queue = this.queue.filter(message => !snapshot.includes(message));
      return response;
    }
  }

  const exports: { connectUsage?: (active: () => boolean) => Promise<{
    capture: (event: string, properties: Record<string, unknown>) => void; stop: () => void;
  }> } = {};
  const code = ts.transpileModule(fs.readFileSync(path.resolve('src/lib/posthogClient.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, {
    exports, AbortController, setTimeout, clearTimeout,
    process: { env: { EXPO_PUBLIC_POSTHOG_API_KEY: KEY, EXPO_PUBLIC_POSTHOG_HOST: HOST, ...env } },
    fetch: async (url: string, options: RequestInit) => { outgoing.push({ url, options }); return network(options); },
    require: (id: string) => {
      if (id.endsWith('observabilityPrivacy')) return privacy;
      if (id.endsWith('observabilityConfig.cjs')) return config;
      if (id === 'posthog-react-native') {
        sdkImports++;
        return { __esModule: true, default: FakePostHog, PostHogPersistedProperty: { Queue: QUEUE } };
      }
      throw new Error(`Unexpected module: ${id}`);
    },
  });
  return {
    connect: exports.connectUsage!, clients, outgoing, operations,
    listeners: () => listenerCount, imports: () => sdkImports, maxTransitions: () => maxTransitions,
    setNetwork: (next: typeof network) => { network = next; },
    delayOptIn: (wait: Promise<void>) => { optInWait = wait; },
    delayOptOut: (wait: Promise<void>) => { optOutWait = wait; },
    failOptIn: (error: Error) => { optInFailure = error; },
    failOptOut: (error: Error) => { optOutFailure = error; },
  };
}

test('one SDK constructor/listener across many consent sessions, with new anonymous IDs and public queue purges', async () => {
  const h = harness();
  const identities = new Set<string>();
  for (let i = 0; i < 40; i++) {
    const connection = await h.connect(() => true);
    const sdk = h.clients[0]!;
    assert.equal(sdk.queue.length, 0);
    identities.add(sdk.getDistinctId());
    connection.capture('settings_opened', {});
    await sdk.flush();
    connection.capture('settings_opened', {});
    assert.equal(sdk.queue.length, 1);
    connection.stop(); await tick();
    assert.equal(sdk.queue.length, 0);
    assert.equal(sdk.optedOut, true);
  }
  assert.equal(identities.size, 40);
  assert.equal(h.clients.length, 1); assert.equal(h.listeners(), 1); assert.equal(h.imports(), 1);
  assert.equal(h.maxTransitions(), 1);
  assert.ok(h.operations.includes('reset')); assert.ok(h.operations.includes('clearQueue'));
});

test('all automatic capture/config endpoints are denied and wire JSON contains only rebuilt safe fields', async () => {
  const h = harness(); const connection = await h.connect(() => true); const sdk = h.clients[0]!;
  assert.equal(h.outgoing.length, 0);
  assert.equal(sdk.options.persistence, 'memory'); assert.equal(sdk.options.defaultOptIn, false);
  assert.equal(sdk.options.captureAppLifecycleEvents, false); assert.equal(sdk.options.enableSessionReplay, false);
  assert.equal(sdk.options.errorTracking.autocapture, false); assert.equal(sdk.options.disableRemoteFeatureFlags, true);
  assert.equal(sdk.options.preloadFeatureFlags, false); assert.equal(sdk.options.disableSurveys, true);
  assert.equal(sdk.options.capturePushNotificationSubscriptions, false); assert.equal(sdk.options.capturePushNotificationOpened, false);
  assert.equal(sdk.options.fetchRetryCount, 0); assert.equal(sdk.options.disableCompression, true);
  assert.equal(sdk.options.logs.beforeSend({ private: 'PRIVATE' }), null);
  const tour = FEATURE_TOURS[0]!;
  connection.capture('feature_tour_started', { tourId: tour.id, tourVersion: tour.version, entrySource: 'manual', health: 'PRIVATE' });
  const captured = sdk.queue[0]!;
  assert.deepEqual(Object.keys(captured.properties).sort(), ['entry_source', 'sdk_extra', 'token', 'tour_id', 'tour_version']);
  for (const url of [`${HOST}/flags/`, `${HOST}/config/`, `${HOST}/logs/`, `${HOST}/e/`,
    `${HOST}/batch/?private=1`, `${HOST}.invalid/batch/`, 'https://eu.i.posthog.com/batch/']) {
    await sdk.fetch(url, { method: 'POST', body: JSON.stringify({ batch: [captured] }) });
  }
  assert.equal(h.outgoing.length, 0);
  await sdk.flush(); assert.equal(h.outgoing.length, 1);
  const { url, options } = h.outgoing[0]!;
  assert.equal(url, `${HOST}/batch/`); assert.equal(options.credentials, 'omit');
  assert.equal(options.redirect, 'error'); assert.equal(options.method, 'POST');
  assert.deepEqual(Object.keys(options.headers!), ['Content-Type']);
  const text = options.body as string;
  assert.ok(!/PRIVATE|account-id|private@example.com/.test(text));
  const body = JSON.parse(text);
  assert.deepEqual(Object.keys(body), ['api_key', 'batch']); assert.equal(body.api_key, KEY);
  assert.deepEqual(Object.keys(body.batch[0]).sort(), ['distinct_id', 'event', 'properties', 'uuid']);
  assert.deepEqual(body.batch[0].properties, { tour_id: tour.id, tour_version: tour.version,
    entry_source: 'manual', $geoip_disable: true, $process_person_profile: false });
  connection.stop(); await tick();
});

test('old SDK flush snapshots cannot enter a new session, and stale connection stop/capture cannot disable it', async () => {
  const h = harness(); let oldActive = true;
  const old = await h.connect(() => oldActive); const sdk = h.clients[0]!;
  old.capture('settings_opened', {});
  const oldSnapshot = [...sdk.queue]; const oldIdentity = sdk.getDistinctId();
  oldActive = false; old.stop();
  const next = await h.connect(() => true);
  assert.notEqual(sdk.getDistinctId(), oldIdentity);
  assert.equal(sdk.queue.length, 0);
  next.capture('settings_opened', {}); const currentSnapshot = [...sdk.queue];
  await sdk.send(oldSnapshot); assert.equal(h.outgoing.length, 0);
  old.stop(); old.capture('settings_opened', {}); await tick();
  assert.equal(sdk.optedOut, false);
  await sdk.send([...oldSnapshot, ...currentSnapshot]);
  assert.equal(h.outgoing.length, 1);
  const batch = JSON.parse(h.outgoing[0]!.options.body as string).batch;
  assert.equal(batch.length, 1); assert.equal(batch[0].uuid, currentSnapshot[0]!.uuid);
  assert.equal(batch[0].distinct_id, sdk.getDistinctId());
  await sdk.send(currentSnapshot); assert.equal(h.outgoing.length, 1, 'permissions are consumed after the attempt');
  next.stop(); await tick();
});

test('serialized async opt-out/reset/opt-in transitions cannot overlap or revive a superseded session', async () => {
  const h = harness(); const wait = deferred<void>(); h.delayOptIn(wait.promise);
  let active = true;
  const first = h.connect(() => active); await tick();
  assert.equal(h.operations.at(-1), 'optIn:start');
  active = false;
  const second = h.connect(() => true); await tick();
  assert.equal(h.clients.length, 1); assert.equal(h.outgoing.length, 0);
  wait.resolve(); const stale = await first; const next = await second;
  stale.stop(); stale.capture('settings_opened', {});
  assert.equal(h.clients[0]!.queue.length, 0);
  next.capture('settings_opened', {}); await h.clients[0]!.flush();
  assert.equal(h.outgoing.length, 1); assert.equal(h.maxTransitions(), 1);
  const stopWait = deferred<void>(); h.delayOptOut(stopWait.promise); next.stop(); await tick();
  const third = h.connect(() => true); await tick();
  stopWait.resolve(); const newest = await third;
  next.stop(); await tick(); assert.equal(h.clients[0]!.optedOut, false);
  newest.stop(); await tick();
});

test('revocation aborts in-flight fetches even when the network ignores abort, and late responses cannot contaminate a new session', async () => {
  const h = harness(); const network = deferred<Response>(); h.setNetwork(async () => network.promise);
  const old = await h.connect(() => true); const sdk = h.clients[0]!;
  old.capture('settings_opened', {}); const snapshot = [...sdk.queue];
  const sending = sdk.send(snapshot); await tick();
  assert.equal(h.outgoing.length, 1); const signal = h.outgoing[0]!.options.signal!;
  old.stop(); assert.equal(signal.aborted, true); await sending;
  const next = await h.connect(() => true);
  await sdk.send(snapshot); assert.equal(h.outgoing.length, 1);
  network.resolve(success()); await tick();
  h.setNetwork(async () => success()); next.capture('settings_opened', {}); await sdk.flush();
  assert.equal(h.outgoing.length, 2); next.stop(); await tick();
});

test('duplicate, unknown, expired and over-bound UUID permissions never send twice or grow past the SDK queue limit', async () => {
  const h = harness(); const connection = await h.connect(() => true); const sdk = h.clients[0]!;
  const messages: Message[] = [];
  for (let i = 0; i < 30; i++) {
    const id = uuid(10000 + i);
    const message = sdk.options.before_send({ uuid: id, event: 'settings_opened', properties: {} });
    assert.ok(message); messages.push(message);
  }
  for (let i = 0; i < 10; i++) await sdk.send([messages[i]!]);
  assert.equal(h.outgoing.length, 0, 'oldest UUID permissions are evicted');
  const current = messages.slice(10);
  await sdk.send([...current, current[0]!]); assert.equal(h.outgoing.length, 0, 'oversize batches are denied');
  await sdk.send([current[0]!, current[0]!]);
  assert.equal(JSON.parse(h.outgoing[0]!.options.body as string).batch.length, 1);
  await sdk.send([current[0]!]); assert.equal(h.outgoing.length, 1);
  await sdk.send([{ uuid: uuid(99999), event: 'settings_opened', properties: {} }]);
  assert.equal(h.outgoing.length, 1);
  assert.equal(sdk.options.before_send({ uuid: 'not-a-uuid', event: 'settings_opened', properties: {} }), null);
  assert.equal(sdk.options.before_send({ uuid: uuid(99998), event: 'health-event', properties: {} }), null);
  connection.stop(); await tick();
});

test('network failures consume permissions without offline retry, and caller cancellation reaches the actual request', async () => {
  const h = harness(); const connection = await h.connect(() => true); const sdk = h.clients[0]!;
  h.setNetwork(async () => { throw new Error('offline'); });
  connection.capture('settings_opened', {}); const failed = [...sdk.queue];
  await sdk.send(failed); await sdk.send(failed); assert.equal(h.outgoing.length, 1);
  const source = new AbortController();
  h.setNetwork(async () => new Promise(() => {}));
  connection.capture('settings_opened', {});
  const sending = sdk.send([sdk.queue.at(-1)!], { signal: source.signal }); await tick();
  source.abort(); await sending;
  assert.equal(h.outgoing[1]!.options.signal!.aborted, true);
  connection.stop(); await tick();
});

test('inactive calls and invalid shared configuration never construct an SDK; failed transitions reuse the same instance', async () => {
  for (const env of [{ EXPO_PUBLIC_POSTHOG_API_KEY: 'phc_test_only' },
    { EXPO_PUBLIC_POSTHOG_HOST: `${HOST}/` }, { EXPO_PUBLIC_POSTHOG_API_KEY: 'phc_placeholder_12345678901234567890' }]) {
    const h = harness(env); await assert.rejects(h.connect(() => true), /configuration unavailable/);
    assert.equal(h.imports(), 0); assert.equal(h.clients.length, 0);
  }
  const h = harness(); const off = await h.connect(() => false); off.stop();
  assert.equal(h.clients.length, 0);
  h.failOptIn(new Error('opt-in failed'));
  await assert.rejects(h.connect(() => true), /opt-in failed/);
  assert.equal(h.clients[0]!.optedOut, true);
  const next = await h.connect(() => true);
  assert.equal(h.clients.length, 1); assert.equal(h.listeners(), 1);
  next.capture('settings_opened', {}); await h.clients[0]!.flush(); assert.equal(h.outgoing.length, 1);
  next.stop(); await tick();
});

test('revocation purges queued data even if SDK opt-out fails, without allowing the retired session to send', async () => {
  const h = harness(); const connection = await h.connect(() => true); const sdk = h.clients[0]!;
  connection.capture('settings_opened', {}); const snapshot = [...sdk.queue];
  h.failOptOut(new Error('SDK opt-out failed')); connection.stop(); await tick();
  assert.equal(sdk.queue.length, 0);
  await sdk.send(snapshot); assert.equal(h.outgoing.length, 0);
  const next = await h.connect(() => true);
  next.capture('settings_opened', {}); await sdk.flush(); assert.equal(h.outgoing.length, 1);
  assert.equal(h.clients.length, 1); next.stop(); await tick();
});
