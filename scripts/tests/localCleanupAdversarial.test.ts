import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import { createAccountStorageBarrier, runLocalAccountCleanup } from '../../src/lib/localAccountCleanup';
import * as manifest from '../../src/lib/localAccountCleanupManifest';
import * as protocol from '../../src/lib/accountDeletionProtocol';

// Execute actual client source against synthetic native/network adapters only.
// No production client, real keychain, account, browser or network call is used.
function load<T>(file: string, mocks: Record<string, unknown>, globals: Record<string, unknown> = {}): T {
  const filename = resolve(file);
  const compiled = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(compiled, { module, exports: module.exports,
    require: (id: string) => {
      if (Object.hasOwn(mocks, id)) return mocks[id];
      throw new Error(`Adversarial test blocked an unmapped dependency: ${id}`);
    },
    setTimeout, clearTimeout, URL, URLSearchParams,
    process: { env: { EXPO_PUBLIC_STRAVA_CLIENT_ID: 'synthetic-client' } }, ...globals,
  }, { filename });
  return module.exports as T;
}
function gate<T>() {
  let release!: (value: T) => void;
  const promise = new Promise<T>(resolve => { release = resolve; });
  return { promise, release };
}

test('a Strava exchange started before purge cannot resurrect credentials or succeed after cancellation', async () => {
  const values = new Map<string, string>([['activity-store', 'synthetic history']]);
  const credentials = new Map<string, string>();
  let current = true, verified = false;
  const started = gate<void>();
  const response = gate<unknown>();
  const api = load<{ startStravaOAuth(): Promise<unknown> }>('src/lib/strava.ts', {
    'expo-web-browser': { openAuthSessionAsync: async (url: string) => ({ type: 'success',
      url: `strideos://strava-callback?code=synthetic&state=${new URL(url).searchParams.get('state')}` }) },
    'expo-secure-store': {
      getItemAsync: async (key: string) => credentials.get(key) ?? null,
      setItemAsync: async (key: string, value: string) => { credentials.set(key, value); },
      deleteItemAsync: async (key: string) => { credentials.delete(key); },
    },
    './supabase': { getSupabaseFunctionUrl: () => 'https://synthetic.invalid/token',
      getSupabaseFunctionHeaders: async () => current ? { authorization: 'synthetic' } : null },
    './localDataOwner': { captureOwnerLease: () => current ? { ownerUserId: 'owner', generation: 1 } : null,
      ownerLeaseIsCurrent: () => current },
  }, {
    fetch: async () => { started.release(); return response.promise; },
  });
  const exchange = api.startStravaOAuth();
  // Observe both outcomes immediately, avoiding unhandled rejections after a fix.
  const outcome = exchange.then(() => ({ succeeded: true }), () => ({ succeeded: false }));
  await started.promise;
  await runLocalAccountCleanup({ ownerUserId: 'owner', requestId: 'synthetic-receipt', serverCompleted: true }, {
    assertOwner: async () => undefined, persistPurging: async () => undefined,
    fence: async () => { current = false; }, quiesce: async () => undefined, drain: async () => undefined,
    keys: async () => [...values.keys()], removeKey: async key => { values.delete(key); },
    readKey: async key => values.get(key) ?? null,
    removeCredentials: async () => { credentials.clear(); },
    verifyCredentials: async () => { assert.equal(credentials.size, 0); },
    removeMedia: async () => undefined, verifyMedia: async () => undefined,
    persistVerified: async () => { verified = true; },
  });
  assert.equal(verified, true);
  response.release({ ok: true, json: async () => ({ access_token: 'synthetic-access', refresh_token: 'synthetic-refresh', expires_at: 42 }) });
  const result = await outcome;
  assert.equal(credentials.size, 0, 'a delayed exchange must not recreate credentials after verified cleanup');
  assert.equal(result.succeeded, false, 'the old connection attempt must report cancellation');
});

type Control = {
  initializeAccountDeletionControl(): Promise<void>;
  prepareDeletionIntent(owner: string, secret: string): Promise<void>;
  accountDeletionControl: { getSnapshot(): { mode: string } };
};
function controllerHarness() {
  // Isolate owner globals from other tests, while exercising its actual class.
  const ownerApi = createRequire(resolve('package.json'))('typescript').transpileModule(
    readFileSync(resolve('src/lib/localDataOwner.ts'), 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
  ).outputText;
  const ownerModule = { exports: {} as Record<string, any> };
  vm.runInNewContext(ownerApi, { module: ownerModule, exports: ownerModule.exports });
  const owners = ownerModule.exports;
  const secure = new Map<string, string>();
  const values = new Map<string, string>();
  const barrier = createAccountStorageBarrier();
  let failControlWrite = false;
  const boundary = owners.configureLocalDataOwner({ getItem: async (key: string) => secure.get(key) ?? null,
    setItem: async (key: string, value: string) => { secure.set(key, value); } });
  const api = load<Control>('src/lib/accountDeletionControl.ts', {
    '@react-native-async-storage/async-storage': { getAllKeys: async () => [...values.keys()],
      getItem: async (key: string) => values.get(key) ?? null, removeItem: async (key: string) => { values.delete(key); } },
    'expo-secure-store': { getItemAsync: async (key: string) => secure.get(key) ?? null,
      setItemAsync: async (key: string, value: string) => { if (failControlWrite) throw new Error('synthetic secure write failure'); secure.set(key, value); },
      deleteItemAsync: async (key: string) => { secure.delete(key); } },
    'react-native': { Platform: { OS: 'ios' } },
    './localAccountCleanup': { accountStorageBarrier: barrier, runLocalAccountCleanup },
    './localAccountCleanupManifest': manifest,
    './localDataOwner': owners,
    './accountDeletionProtocol': protocol,
  });
  return { api, boundary, owners, secure, values, failControl: (value: boolean) => { failControlWrite = value; } };
}

test('failed intent capture and retry must not revalidate leases from the unmounted old app', async () => {
  const h = controllerHarness();
  await h.api.initializeAccountDeletionControl();
  await h.boundary.initialize(null, async () => false);
  await h.boundary.accept('owner', { explicitSignIn: true });
  const lease = h.boundary.capture();
  assert.ok(lease);
  h.failControl(true);
  await assert.rejects(h.api.prepareDeletionIntent('owner', 'a'.repeat(64)), /not confirmed/);
  assert.equal(h.boundary.isCurrent(lease), false);
  h.failControl(false);
  await h.api.initializeAccountDeletionControl();
  assert.equal(h.api.accountDeletionControl.getSnapshot().mode, 'open');
  assert.equal(h.boundary.isCurrent(lease), false, 'temporary access fencing must not revive a cancelled capture after retry');
});

test('reopening the root after failed intent persistence cannot reuse stale authenticated route access', async () => {
  const h = controllerHarness();
  await h.api.initializeAccountDeletionControl();
  const session = { user: { id: 'owner', identities: [] }, access_token: 'synthetic-auth', refresh_token: 'synthetic-refresh' };
  const client = { auth: {
    getSession: async () => ({ data: { session }, error: null }),
    onAuthStateChange: () => undefined,
    stopAutoRefresh: () => undefined,
  } };
  const auth = load<typeof import('../../src/store/authStore')>('src/store/authStore.ts', {
    zustand: createRequire(resolve('package.json'))('zustand'),
    '@supabase/supabase-js': { isAuthRetryableFetchError: () => false },
    'expo-apple-authentication': { addRevokeListener: () => ({ remove: () => undefined }) },
    'expo-web-browser': {},
    '../lib/localDataOwner': h.owners,
    '../lib/supabase': {
      localDataOwner: h.boundary,
      initializeLocalOwnership: () => h.boundary.initialize('owner', async () => true),
      readCachedSupabaseSession: async () => session,
      clearCachedSupabaseSession: async () => undefined,
      getSupabaseAvailability: () => ({ status: 'available', client }),
      withExplicitAuthAttempt: async (action: () => Promise<unknown>) => action(),
      isExplicitAuthAttempt: () => false,
    },
    '../lib/authRedirect': { hydrateUserData: async () => undefined },
    './workoutStore': { useWorkoutStore: { getState: () => ({ restorePendingCompletions: async () => undefined }) } },
    './strengthStore': {}, './customWorkoutStore': {}, './checkInStore': {},
  }).useAuthStore;
  await auth.getState().initialize();
  assert.equal(auth.getState().canAccessLocalData, true);
  h.failControl(true);
  await assert.rejects(h.api.prepareDeletionIntent('owner', 'c'.repeat(64)), /not confirmed/);
  h.failControl(false);
  await h.api.initializeAccountDeletionControl();
  assert.equal(h.api.accountDeletionControl.getSnapshot().mode, 'open');
  // AppRootContent calls initialize again when AccountCleanupGate remounts it.
  await auth.getState().initialize();
  assert.equal(auth.getState().canAccessLocalData, h.boundary.canAccess,
    'Stack.Protected and bridge mounting must agree with the signed-out owner boundary');
});

test('foreign retained owner prevents startup purge or release even with a local_verified receipt', async () => {
  const h = controllerHarness();
  const owner = { version: 1, ownerUserId: 'another-owner', logoutFence: true, unclaimed: false };
  h.secure.set(h.owners.LOCAL_DATA_OWNER_KEY, JSON.stringify(owner));
  h.secure.set('strideos-account-deletion-control-v1', JSON.stringify({
    version: 1, ownerUserId: 'owner', receiptSecret: 'b'.repeat(64), phase: 'local_verified', completionVerified: true,
    request: { id: '12345678-1234-4234-9234-123456789abc', requested_at: '2026-10-31T00:00:00Z', status: 'completed' },
  }));
  h.values.set('activity-store', 'another owner’s synthetic history');
  await assert.rejects(h.api.initializeAccountDeletionControl(), /incomplete/);
  assert.equal(h.api.accountDeletionControl.getSnapshot().mode, 'error');
  assert.equal(h.secure.get(h.owners.LOCAL_DATA_OWNER_KEY), JSON.stringify(owner));
  assert.equal(h.values.get('activity-store'), 'another owner’s synthetic history');
});

// Inspect the storage adapter handed to the SDK by the actual client factory.
// A cancelled PKCE computation can reach its first write after a fence/drain;
// auxiliary keys need admission checks as well as the primary session key.
for (const suffix of ['-code-verifier', '-user']) {
  test(`late SDK ${suffix} write cannot create credentials after the deletion fence`, async () => {
    const owners = load<typeof import('../../src/lib/localDataOwner')>('src/lib/localDataOwner.ts', {});
    const credentials = new Map<string, string>();
    let adapter!: { setItem(key: string, value: string): Promise<void> };
    const secure = {
      getItemAsync: async (key: string) => credentials.get(key) ?? null,
      setItemAsync: async (key: string, value: string) => { credentials.set(key, value); },
      deleteItemAsync: async (key: string) => { credentials.delete(key); },
    };
    const api = load<typeof import('../../src/lib/supabase')>('src/lib/supabase.ts', {
      '@supabase/supabase-js': { createClient: (_url: string, _key: string, options: any) => {
        adapter = options.auth.storage;
        return { auth: { startAutoRefresh: () => undefined, stopAutoRefresh: () => undefined } };
      } },
      'expo-secure-store': secure,
      'react-native': { Platform: { OS: 'ios' }, AppState: { addEventListener: () => ({ remove: () => undefined }) } },
      '@react-native-async-storage/async-storage': { getAllKeys: async () => [], getItem: async () => null },
      './localDataOwner': owners,
      './supabaseAvailability': {
        resolveSupabaseConfig: () => ({ status: 'configured', supabaseUrl: 'https://synthetic.supabase.invalid', supabaseAnonKey: 'synthetic-public' }),
        createSupabaseAvailability: (config: any, factory: any) => ({ status: 'available', client: factory(config.supabaseUrl, config.supabaseAnonKey) }),
        getSupabaseClientOrNull: (availability: any) => availability.client,
      },
    });
    api.getSupabaseAvailability();
    await api.initializeLocalOwnership();
    await api.localDataOwner.accept('owner', { explicitSignIn: true });
    const key = `${api.supabaseSessionStorageKey()}${suffix}`;
    assert.ok(manifest.accountSessionKeys(api.supabaseSessionStorageKey()).includes(key));
    // Control journal closes owner access before credential cleanup. No newer
    // account may inherit an old callback's PKCE verifier or cached user object.
    owners.setLocalOwnerAccessGuard(() => false);
    await api.localDataOwner.signOut();
    const value = suffix === '-user' ? JSON.stringify({ user: { id: 'owner' } }) : 'synthetic-cancelled-verifier';
    await adapter.setItem(key, value).catch(() => undefined); // rejection or drop is safe
    assert.equal(credentials.has(key), false, 'fenced SDK auxiliary write must not recreate the key');
  });
}
