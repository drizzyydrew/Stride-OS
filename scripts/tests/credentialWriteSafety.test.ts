import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import { runLocalAccountCleanup } from '../../src/lib/localAccountCleanup';

// Actual source, synthetic native storage only. Unmapped imports cannot reach
// a real SDK, keychain, browser, account or network.
function load<T>(file: string, mocks: Record<string, unknown>, globals: Record<string, unknown> = {}): T {
  const filename = resolve(file), module = { exports: {} };
  const code = ts.transpileModule(readFileSync(filename, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
  } }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, require: (id: string) => {
    if (Object.hasOwn(mocks, id)) return mocks[id];
    throw new Error(`Blocked unmapped test import: ${id}`);
  }, URL, URLSearchParams, setTimeout, clearTimeout,
  process: { env: { EXPO_PUBLIC_STRAVA_CLIENT_ID: 'synthetic-client' } }, ...globals }, { filename });
  return module.exports as T;
}
function gate() {
  let release!: () => void;
  const promise = new Promise<void>(resolve => { release = resolve; });
  return { promise, release };
}
const tick = () => new Promise<void>(resolve => setImmediate(resolve));
const KEY = 'sb-example-auth-token';
const session = JSON.stringify({ user: { id: 'owner' }, access_token: 'synthetic-access', refresh_token: 'synthetic-refresh' });
function sdkHarness() {
  const values = new Map<string, string>([[KEY, session]]);
  const hooks: { write?: (key: string) => Promise<void> } = {};
  const owners = load<typeof import('../../src/lib/localDataOwner')>('src/lib/localDataOwner.ts', {});
  let adapter!: { setItem(key: string, value: string): Promise<void> };
  const sdk = load<typeof import('../../src/lib/supabase')>('src/lib/supabase.ts', {
    './localDataOwner': owners,
    'expo-secure-store': {
      getItemAsync: async (key: string) => values.get(key) ?? null,
      setItemAsync: async (key: string, value: string) => { await hooks.write?.(key); values.set(key, value); },
      deleteItemAsync: async (key: string) => { values.delete(key); },
    },
    '@react-native-async-storage/async-storage': { getAllKeys: async () => [], getItem: async () => null },
    'react-native': { Platform: { OS: 'ios' }, AppState: { addEventListener: () => undefined } },
    '@supabase/supabase-js': { createClient: (_url: string, _key: string, options: any) => {
      adapter = options.auth.storage; return { auth: {} };
    } },
    './supabaseAvailability': {
      resolveSupabaseConfig: () => ({ status: 'configured', supabaseUrl: 'https://example.supabase.co', supabaseAnonKey: 'synthetic-public' }),
      createSupabaseAvailability: (_config: unknown, create: any) => ({ status: 'available', client: create('https://example.supabase.co', 'synthetic-public') }),
    },
  });
  sdk.getSupabaseAvailability();
  return { sdk, owners, adapter, values, hooks };
}

test('SDK main session, user cache and PKCE writes cannot survive cancellation during native I/O', async () => {
  for (const [key, value] of [[KEY, session], [`${KEY}-user`, JSON.stringify({ user: { id: 'owner' } })], [`${KEY}-code-verifier`, 'synthetic-verifier']]) {
    const h = sdkHarness(); await h.sdk.initializeLocalOwnership(); await h.sdk.localDataOwner.accept('owner');
    const started = gate(), finish = gate();
    h.hooks.write = async writtenKey => { if (writtenKey === key) { started.release(); await finish.promise; } };
    const writing = h.adapter.setItem(key, value); await started.promise;
    h.owners.setLocalOwnerAccessGuard(() => false); h.sdk.localDataOwner.block('signed-out');
    let drained = false;
    const drain = h.sdk.drainSupabaseCredentialWrites().then(() => { drained = true; });
    await tick(); assert.equal(drained, false, `${key}: native write must be drained before purge verification`);
    finish.release(); await writing; await drain;
    assert.equal(h.values.has(key), false, `${key}: cancelled write must remove its late native value`);
    await h.adapter.setItem(key, value);
    assert.equal(h.values.has(key), false, `${key}: new background writes stay blocked while deletion is pending`);
  }
});

test('cancelled explicit auxiliary SDK write cannot erase the next serialized attempt', async () => {
  for (const suffix of ['-user', '-code-verifier']) {
    const h = sdkHarness(); await h.sdk.initializeLocalOwnership();
    const key = `${KEY}${suffix}`, started = gate(), finish = gate(); let current = true, paused = false;
    h.hooks.write = async written => { if (written === key && !paused) { paused = true; started.release(); await finish.promise; } };
    const value = suffix === '-user' ? JSON.stringify({ user: { id: 'owner', label: 'old' } }) : 'old-verifier';
    const nextValue = suffix === '-user' ? JSON.stringify({ user: { id: 'owner', label: 'new' } }) : 'new-verifier';
    const old = h.sdk.withExplicitAuthAttempt(() => h.adapter.setItem(key, value), () => current);
    const rejected = assert.rejects(old, /cancelled/); await started.promise; current = false;
    const next = h.sdk.withExplicitAuthAttempt(() => h.adapter.setItem(key, nextValue));
    finish.release(); await rejected; await next;
    assert.equal(h.values.get(key), nextValue);
  }
});

test('explicit same-owner repair can save SDK credentials while ordinary deletion-fenced writers cannot', async () => {
  const h = sdkHarness(); await h.sdk.initializeLocalOwnership(); await h.sdk.localDataOwner.signOut();
  h.owners.setLocalOwnerAccessGuard(() => false);
  await h.sdk.clearCachedSupabaseSession();
  await h.adapter.setItem(`${KEY}-code-verifier`, 'background');
  assert.equal(h.values.has(`${KEY}-code-verifier`), false);
  await h.sdk.withExplicitAuthAttempt(async () => {
    await h.adapter.setItem(KEY, session);
    await h.adapter.setItem(`${KEY}-user`, JSON.stringify({ user: { id: 'owner' } }));
    await h.adapter.setItem(`${KEY}-code-verifier`, 'repair-verifier');
    await h.adapter.setItem(`${KEY}-user`, JSON.stringify({ user: { id: 'wrong-owner' } }));
  });
  assert.equal(h.values.get(KEY), session);
  assert.equal(JSON.parse(h.values.get(`${KEY}-user`)!).user.id, 'owner');
  assert.equal(h.values.get(`${KEY}-code-verifier`), 'repair-verifier');
  assert.equal(h.sdk.localDataOwner.canAccess, false);
});

test('an explicit SDK exchange started before intent fencing stays cancelled after access reopens', async () => {
  const h = sdkHarness(); await h.sdk.initializeLocalOwnership(); await h.sdk.localDataOwner.accept('owner');
  const started = gate(), finish = gate();
  const old = h.sdk.withExplicitAuthAttempt(async () => {
    started.release(); await finish.promise;
    await h.adapter.setItem(KEY, session);
    await h.adapter.setItem(`${KEY}-user`, JSON.stringify({ user: { id: 'owner' } }));
    await h.adapter.setItem(`${KEY}-code-verifier`, 'cancelled-verifier');
  });
  const rejected = assert.rejects(old, /cancelled/); await started.promise;
  h.owners.setLocalOwnerAccessGuard(() => false); h.sdk.localDataOwner.block('signed-out');
  h.owners.setLocalOwnerAccessGuard(() => true); await h.sdk.localDataOwner.accept('owner');
  await h.sdk.clearCachedSupabaseSession();
  finish.release(); await rejected;
  for (const key of [KEY, `${KEY}-user`, `${KEY}-code-verifier`]) assert.equal(h.values.has(key), false);
});

test('verified cleanup waits for all delayed native Strava writes and rejects the cancelled exchange', async () => {
  const values = new Map<string, string>(); const started = gate(), finish = gate();
  let current = true, verified = false;
  const api = load<typeof import('../../src/lib/strava')>('src/lib/strava.ts', {
    'expo-web-browser': { openAuthSessionAsync: async (url: string) => ({ type: 'success', url: `strideos://strava-callback?code=synthetic&state=${new URL(url).searchParams.get('state')}` }) },
    'expo-secure-store': {
      getItemAsync: async (key: string) => values.get(key) ?? null,
      setItemAsync: async (key: string, value: string) => { started.release(); await finish.promise; values.set(key, value); },
      deleteItemAsync: async (key: string) => { values.delete(key); },
    },
    './localDataOwner': { captureOwnerLease: () => current ? { ownerUserId: 'owner', generation: 1 } : null, ownerLeaseIsCurrent: () => current },
    './supabase': { getSupabaseFunctionUrl: () => 'https://synthetic.invalid/token', getSupabaseFunctionHeaders: async () => ({ authorization: 'synthetic' }) },
  }, { fetch: async () => ({ ok: true, json: async () => ({ access_token: 'synthetic-access', refresh_token: 'synthetic-refresh', expires_at: 42 }) }) });
  const exchange = api.startStravaOAuth(); const cancelled = assert.rejects(exchange, /cancelled/);
  await started.promise;
  const cleanup = runLocalAccountCleanup({ ownerUserId: 'owner', requestId: 'synthetic', serverCompleted: true }, {
    assertOwner: async () => undefined, persistPurging: async () => undefined, fence: async () => { current = false; },
    quiesce: async () => undefined, drain: () => api.drainStravaCredentialWrites(),
    keys: async () => [], readKey: async () => null, removeKey: async () => undefined,
    removeCredentials: async () => { values.clear(); }, verifyCredentials: async () => { assert.equal(values.size, 0); },
    removeMedia: async () => undefined, verifyMedia: async () => undefined, persistVerified: async () => { verified = true; },
  });
  await tick(); assert.equal(verified, false);
  finish.release(); await cancelled; await cleanup;
  assert.equal(verified, true); assert.equal(values.size, 0);
  await assert.rejects(api.startStravaOAuth(), /cancelled/);
});
