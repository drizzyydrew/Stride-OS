import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import { createObservabilityConsent, OBSERVABILITY_CONSENT_KEY } from '../../src/utils/observabilityConsent';
import { createObservabilityRuntime } from '../../src/lib/observability';
import * as privacy from '../../src/utils/observabilityPrivacy';

const tick = () => new Promise<void>(resolve => setImmediate(resolve));
const enabled = (usage = false, diagnostics = false, owner: string | null = 'owner-a') => ({ owner, ready: true, usage, diagnostics, saving: false, error: false });
function storage(initial: string | null = null) {
  let raw = initial;
  return { getItem: async () => raw, setItem: async (_key: string, value: string) => { raw = value; }, removeItem: async () => { raw = null; } };
}

test('consent defaults off, validates owner/version/booleans, and restores only the same account', async () => {
  for (const raw of [null, '{bad', '{}', JSON.stringify({ version: 2, owner: 'a', usage: true, diagnostics: true }), JSON.stringify({ version: 1, owner: 'a', usage: 'true', diagnostics: true })]) {
    const consent = createObservabilityConsent(storage(raw));
    assert.equal(consent.getState().ready, false);
    await consent.setOwner('a');
    assert.equal(consent.getState().usage, false); assert.equal(consent.getState().diagnostics, false);
  }
  const disk = storage(); const consent = createObservabilityConsent(disk);
  await consent.setOwner('a'); await consent.setConsent('usage', true);
  const restored = createObservabilityConsent(disk); await restored.setOwner('a');
  assert.equal(restored.getState().usage, true);
  await restored.setOwner('b'); assert.equal(restored.getState().usage, false);
  await restored.setOwner(null); await restored.setOwner('a'); assert.equal(restored.getState().usage, false);
  assert.ok(!OBSERVABILITY_CONSENT_KEY.includes('-store'), 'preferences are not classified as retained athlete history');
});

test('pending and failed reads stay off without blocking callers', async () => {
  let finish!: (raw: string | null) => void;
  const consent = createObservabilityConsent({ ...storage(), getItem: () => new Promise(resolve => { finish = resolve; }) });
  const pending = consent.setOwner('a'); await tick();
  assert.equal(consent.getState().ready, false); assert.equal(consent.getState().usage, false);
  const changed = consent.setOwner('b');
  finish(JSON.stringify({ version: 1, owner: 'a', usage: true, diagnostics: true }));
  await pending; await tick(); assert.equal(consent.getState().usage, false);
  finish(null); await changed;
  const failed = createObservabilityConsent({ ...storage(), getItem: async () => { throw new Error('locked'); } });
  await failed.setOwner('a'); assert.equal(failed.getState().error, true); assert.equal(failed.getState().usage, false);
});

test('enable waits for durable save; revoke is immediate and wins an in-flight enable', async () => {
  let finish!: () => void;
  const consent = createObservabilityConsent({ ...storage(), setItem: async () => new Promise<void>(resolve => { finish = resolve; }) });
  await consent.setOwner('a');
  const enabling = consent.setConsent('usage', true); await tick();
  assert.equal(consent.getState().usage, false);
  const revoking = consent.setConsent('usage', false);
  assert.equal(consent.getState().usage, false);
  finish(); await enabling; await tick();
  assert.equal(consent.getState().usage, false);
  finish(); await revoking; assert.equal(consent.getState().usage, false);
  const failed = createObservabilityConsent({ ...storage(), setItem: async () => { throw new Error('disk'); } });
  await failed.setOwner('a'); await failed.setConsent('diagnostics', true);
  assert.equal(failed.getState().diagnostics, false); assert.equal(failed.getState().error, true);
});

test('all four consent combinations initialize only the permitted clients; revoke stops stale factories', async () => {
  for (const usage of [false, true]) for (const diagnostics of [false, true]) {
    const starts: string[] = []; const stops: string[] = []; const captures: string[] = [];
    const runtime = createObservabilityRuntime({
      usage: async () => { starts.push('usage'); return { capture: (name: string) => { captures.push(name); }, stop: () => { stops.push('usage'); } }; },
      diagnostics: async () => { starts.push('diagnostics'); return { stop: () => { stops.push('diagnostics'); } }; },
    });
    runtime.sync({ ...enabled(true, true), ready: false }); assert.deepEqual(starts, []);
    runtime.sync(enabled(usage, diagnostics)); await tick();
    assert.equal(starts.includes('usage'), usage); assert.equal(starts.includes('diagnostics'), diagnostics);
    runtime.track('private-health-event', { heartRate: 170 }); assert.ok(!captures.includes('private-health-event'));
    runtime.sync(enabled(false, false));
    assert.equal(stops.includes('usage'), usage); assert.equal(stops.includes('diagnostics'), diagnostics);
    const count = captures.length; runtime.track('settings_opened'); assert.equal(captures.length, count);
  }
  let finish!: (connection: { stop: () => void }) => void; let staleStopped = false;
  const runtime = createObservabilityRuntime({ usage: () => new Promise(resolve => { finish = resolve; }), diagnostics: async () => ({ stop() {} }) });
  runtime.sync(enabled(true)); runtime.sync(enabled());
  finish({ stop: () => { staleStopped = true; } }); await tick(); assert.equal(staleStopped, true);
});

test('synchronous SDK failures and poisoned telemetry properties never interrupt app actions', async () => {
  const runtime = createObservabilityRuntime({ usage: () => { throw new Error('SDK unavailable'); }, diagnostics: async () => ({ stop() {} }) });
  assert.doesNotThrow(() => runtime.sync(enabled(true)));
  assert.doesNotThrow(() => runtime.track('feature_tour_started', { get tourId() { throw new Error('malformed'); } }));
});

function clientHarness(fetcher?: (url: string, options: any) => Promise<{ status: number }>) {
  let active = true;
  const outgoing: { url: string; body: string; signal?: AbortSignal | null }[] = [];
  let sentryOptions: any; let closed = 0;
  const sentry = { init(options: any) { sentryOptions = options; }, getClient: () => ({ close: async () => { closed++; } }),
    reactNativeErrorHandlersIntegration: () => ({}), dedupeIntegration: () => ({}), createReactNativeRewriteFrames: () => ({}) };
  const exports: any = {};
  const file = path.resolve('src/lib/observabilityClients.ts');
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  vm.runInNewContext(code, { exports, AbortController, setTimeout, clearTimeout, process: { env: { EXPO_PUBLIC_SENTRY_DSN: `https://${'a'.repeat(32)}@o1.ingest.us.sentry.io/1` } },
    fetch: async (url: string, options: any) => { outgoing.push({ url, body: options.body, signal: options.signal }); return fetcher ? fetcher(url, options) : { status: 200 }; },
    require: (id: string) => {
      if (id.endsWith('app.json')) return JSON.parse(fs.readFileSync('app.json', 'utf8'));
      if (id.endsWith('observabilityPrivacy')) return privacy;
      if (id.endsWith('observabilityConfig.cjs')) return require('../../src/utils/observabilityConfig.cjs');
      if (id === '@sentry/react-native') return sentry;
      throw new Error(`Unexpected module ${id}`);
    },
  });
  return { exports, outgoing, isActive: () => active, revoke: () => { active = false; }, sentryOptions: () => sentryOptions, closed: () => closed };
}

test('Sentry transport sends only sanitized error items, never attachments/sessions/logs or data after revocation', async () => {
  const harness = clientHarness(); const client = await harness.exports.connectDiagnostics(harness.isActive);
  const options = harness.sentryOptions(); assert.equal(options.enableNative, false); assert.equal(options.defaultIntegrations, false);
  assert.equal(options.enableAutoSessionTracking, false); assert.equal(options.sendClientReports, false);
  const transport = options.transport({ url: 'https://o1.ingest.us.sentry.io/api/1/envelope/' });
  const event = { exception: { values: [{ type: 'TypeError', value: 'SECRET health private@example.com', stacktrace: { frames: [{ filename: 'app:///main.jsbundle', lineno: 12, colno: 4, vars: { token: 'SECRET' } }] } }] }, user: { email: 'private@example.com' }, contexts: { health: 'SECRET' } };
  await transport.send([{ auth: 'SECRET' }, [[{ type: 'event' }, event], [{ type: 'attachment' }, 'SECRET'], [{ type: 'session' }, { private: 'SECRET' }], [{ type: 'log' }, 'SECRET']]]);
  assert.equal(harness.outgoing.length, 1);
  const lines = harness.outgoing[0]!.body.split('\n'); assert.equal(lines.length, 3);
  assert.equal(JSON.parse(lines[1]!).type, 'event'); assert.ok(!harness.outgoing[0]!.body.includes('SECRET')); assert.ok(!harness.outgoing[0]!.body.includes('private@example.com'));
  assert.ok(JSON.parse(lines[2]!).exception.values[0].stacktrace.frames[0].lineno === 12);
  harness.revoke(); client.stop(); await transport.send([{}, [[{ type: 'event' }, event]]]);
  assert.equal(harness.outgoing.length, 1); assert.equal(harness.closed(), 1);
});

test('Sentry flush waits for pending delivery, rejects failed sends, respects deadlines, and revocation aborts', async () => {
  const envelope = [{}, [[{ type: 'event' }, { exception: { values: [{ type: 'Error', value: 'private' }] } }]]];
  for (const outcome of ['success', 'failure', 'timeout', 'revoke']) {
    let resolve!: (response: { status: number }) => void; let reject!: (error: Error) => void;
    const harness = clientHarness((_url, options) => new Promise((yes, no) => {
      resolve = yes; reject = no;
      options.signal.addEventListener('abort', () => no(new Error('aborted')));
    }));
    const client = await harness.exports.connectDiagnostics(harness.isActive);
    const transport = harness.sentryOptions().transport({ url: 'https://o1.ingest.us.sentry.io/api/1/envelope/' });
    const sending = transport.send(envelope); void sending.catch(() => {});
    let settled = false; const flush = transport.flush(outcome === 'timeout' ? 5 : 1000).then((result: boolean) => { settled = true; return result; });
    await tick(); assert.equal(settled, false);
    if (outcome === 'success') resolve({ status: 200 });
    else if (outcome === 'failure') reject(new Error('offline'));
    else if (outcome === 'revoke') { harness.revoke(); client.stop(); }
    assert.equal(await flush, outcome === 'success');
    if (outcome === 'timeout') { harness.revoke(); client.stop(); }
    await sending.catch(() => {});
    client.stop();
  }
});
