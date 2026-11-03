import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

function load<T>(file: string, mocks: Record<string, unknown>, globals: Record<string, unknown> = {}): T {
  const filename = resolve(file), module = { exports: {} };
  const code = ts.transpileModule(readFileSync(filename, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
  } }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, require: (id: string) => {
    if (Object.hasOwn(mocks, id)) return mocks[id];
    throw new Error(`Unmapped test dependency: ${id}`);
  }, URL, URLSearchParams, setTimeout, clearTimeout, console, Date, process: { env: {} }, ...globals }, { filename });
  return module.exports as T;
}
const tick = () => new Promise<void>(resolve => setImmediate(resolve));
function deferred<T>() { let resolve!: (v: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; }
const session = (id = 'A') => ({ user: { id }, access_token: `synthetic-access-${id}`, refresh_token: `synthetic-refresh-${id}` });
const link = (id = 'A') => `strideos://auth/callback#type=recovery&access_token=synthetic-access-${id}&refresh_token=synthetic-refresh-${id}`;
async function harness() {
  const values = new Map<string, string>();
  const timeouts = new Map<object, () => void>();
  const fakeSetTimeout = (cb: () => void, ms: number) => { if (ms !== 20_000) return setTimeout(cb, ms); const id = {}; timeouts.set(id, cb); return id; };
  const fakeClearTimeout = (id: any) => { if (!timeouts.delete(id)) clearTimeout(id); };
  const globals = { setTimeout: fakeSetTimeout, clearTimeout: fakeClearTimeout };
  const owners = load<typeof import('../../src/lib/localDataOwner')>('src/lib/localDataOwner.ts', {});
  let adapter: any, cached: any = null, listener: any;
  let exchanges = 0, updates = 0, restores = 0;
  const hooks: { exchange?: () => Promise<void>; write?: (key: string, value: string) => Promise<void>; update?: () => Promise<void>; restore?: () => Promise<void> } = {};
  const auth = {
    getSession: async () => ({ data: { session: cached }, error: null }),
    onAuthStateChange: (cb: any) => { listener = cb; }, stopAutoRefresh: () => {},
    signOut: async () => { cached = null; },
    setSession: async (tokens: { access_token: string }) => {
      exchanges++; await hooks.exchange?.();
      const target = session(tokens.access_token.endsWith('-B') ? 'B' : 'A');
      await adapter.setItem('sb-example-auth-token', JSON.stringify(target));
      cached = target; listener?.('SIGNED_IN', target);
      return { data: { session: target }, error: null };
    },
    exchangeCodeForSession: async () => { exchanges++; return { data: { session: session(), redirectType: 'recovery' }, error: null }; },
    updateUser: async () => { updates++; await hooks.update?.(); return { error: null }; },
  };
  const sdk = load<typeof import('../../src/lib/supabase')>('src/lib/supabase.ts', {
    './localDataOwner': owners,
    'expo-secure-store': { getItemAsync: async (k: string) => values.get(k) ?? null,
      setItemAsync: async (k: string, v: string) => { await hooks.write?.(k, v); values.set(k, v); },
      deleteItemAsync: async (k: string) => { values.delete(k); } },
    '@react-native-async-storage/async-storage': { getAllKeys: async () => [], getItem: async () => null },
    'react-native': { Platform: { OS: 'ios' }, AppState: { addEventListener: () => {} } },
    '@supabase/supabase-js': { createClient: (_url: string, _key: string, options: any) => { adapter = options.auth.storage; return { auth }; } },
    './supabaseAvailability': { resolveSupabaseConfig: () => ({ status: 'configured', supabaseUrl: 'https://example.supabase.co', supabaseAnonKey: 'synthetic-public' }),
      createSupabaseAvailability: (_cfg: unknown, create: any) => ({ status: 'available', client: create('synthetic', 'synthetic') }) },
  }, globals);
  sdk.getSupabaseAvailability();
  const noopStore = { getState: () => ({ restorePendingCompletions: async () => { await hooks.restore?.(); }, hydrateWorkouts() {}, hydrateStrength() {}, hydrateLogs() {}, hydrateCheckIns() {}, mergeRestoredActivities() {} }) };
  const redirects = load<typeof import('../../src/lib/authRedirect')>('src/lib/authRedirect.ts', {
    'expo-linking': { createURL: (path: string) => `strideos://${path}` }, './supabase': sdk,
    './localDataOwner': owners, './syncService': { hydrateFromSupabase: () => { restores++; return new Promise(() => {}); } },
    '../store/workoutStore': { useWorkoutStore: noopStore }, '../store/strengthStore': { useStrengthStore: noopStore },
    '../store/customWorkoutStore': { useCustomWorkoutStore: noopStore }, '../store/checkInStore': { useCheckInStore: noopStore },
    '../store/activityStore': { useActivityStore: noopStore },
  }, globals);
  const store = load<typeof import('../../src/store/authStore')>('src/store/authStore.ts', {
    zustand: createRequire(resolve('package.json'))('zustand'), '@supabase/supabase-js': { isAuthRetryableFetchError: () => false },
    'expo-apple-authentication': { addRevokeListener: () => {} }, 'expo-web-browser': {},
    '../lib/appleSignInFlow': {}, '../lib/supabase': sdk, '../lib/localDataOwner': owners, '../lib/authRedirect': redirects,
    './workoutStore': { useWorkoutStore: noopStore }, './strengthStore': { useStrengthStore: noopStore },
    './customWorkoutStore': { useCustomWorkoutStore: noopStore }, './checkInStore': { useCheckInStore: noopStore },
  }, globals);
  await store.useAuthStore.getState().initialize();
  return { store, sdk, owners, redirects, auth, values, hooks, counters: () => ({ exchanges, updates, restores }),
    expire: () => { for (const [id, cb] of [...timeouts]) { timeouts.delete(id); cb(); } } };
}

test('cold-start fragment recovery explicitly accepts its owner without awaiting cloud restoration', async () => {
  const h = await harness(); const result = await h.store.completeAuthLink(link());
  assert.equal(result.error, null); assert.equal(result.recovery, true);
  assert.equal(h.sdk.localDataOwner.ownerUserId, 'A'); assert.equal(h.sdk.localDataOwner.canAccess, true);
  assert.equal(h.counters().exchanges, 1); assert.equal(h.counters().restores, 1);
  assert.ok(h.values.has('sb-example-auth-token'));
  assert.equal('verifiedSession' in result, false, 'deduplicated results must not retain credentials');
});
test('equivalent query/fragment deliveries coalesce; a second reset is processed separately', async () => {
  const h = await harness(), block = deferred<void>(); h.hooks.exchange = () => block.promise;
  const first = h.store.completeAuthLink(link()); await tick();
  const duplicate = h.store.completeAuthLink('strideos:///auth/callback?refresh_token=synthetic-refresh-A&access_token=synthetic-access-A&type=recovery');
  assert.equal(first, duplicate); block.resolve(); await first;
  assert.equal((await h.store.completeAuthLink(link())).recovery, true); assert.equal(h.counters().exchanges, 1);
  h.hooks.exchange = undefined;
  await h.store.completeAuthLink(`${link()}&expires_in=3599`); assert.equal(h.counters().exchanges, 2);
});
test('failed PKCE recovery never adopts a cached same- or different-account session', async () => {
  const h = await harness(); await h.store.completeAuthLink(link());
  for (const id of ['A', 'B']) {
    let cachedReads = 0;
    h.auth.exchangeCodeForSession = async () => ({ data: { session: null, redirectType: null }, error: { message: 'private provider details' } }) as any;
    h.auth.getSession = async () => { cachedReads++; return { data: { session: session(id) }, error: null }; };
    const result = await h.redirects.completeSupabaseAuthFromUrl('strideos://auth/callback?code=used&type=recovery');
    assert.match(result.error!, /invalid or expired/); assert.equal(cachedReads, 0);
  }
});
test('code-flow recovery preserves SDK recovery metadata', async () => {
  const h = await harness(); const r = await h.redirects.completeSupabaseAuthFromUrl('strideos://auth/callback?code=synthetic');
  assert.equal(r.recovery, true); assert.equal(r.verifiedSession?.user.id, 'A');
});
test('foreign callback destinations and missing payload never exchange credentials', async () => {
  const h = await harness(); assert.equal((await h.store.completeAuthLink('https://untrusted.example/?code=synthetic')).handled, false);
  assert.equal((await h.store.completeAuthLink('strideos://auth/callback')).handled, false);
  assert.equal(h.counters().exchanges, 0);
});
test('a populated successful cache never authorizes a foreign destination', async () => {
  const h = await harness(); await h.store.completeAuthLink(link());
  const result = await h.store.completeAuthLink(link().replace('strideos://auth/callback', 'https://foreign.example/'));
  assert.equal(result.handled, false); assert.ok(result.error); assert.equal(h.counters().exchanges, 1);
});
test('a late initial launch URL cannot replace the current event or identifiable route credentials', async () => {
  const h = await harness(); h.redirects.rememberAuthCallbackUrl(link('A'), true);
  h.redirects.rememberAuthCallbackUrl(link('B')); h.redirects.rememberAuthCallbackUrl(link('A'), true);
  assert.equal(h.redirects.resolveAuthCallbackUrl('strideos://auth/callback', link('A'), link('A')), link('B'));
  const newRoute = 'strideos://auth/callback?code=newer';
  assert.equal(h.redirects.resolveAuthCallbackUrl(newRoute, link('A'), link('A')), newRoute);
});
test('timeout keeps SDK work fenced and serialized until it drains; late credentials do not survive', async () => {
  const h = await harness(), block = deferred<void>(); h.hooks.exchange = () => block.promise;
  const pending = h.store.completeAuthLink(link()); await tick(); h.expire();
  assert.match((await pending).error!, /taking longer/); assert.equal(h.sdk.isExplicitAuthAttempt(), true);
  const next = h.store.completeAuthLink(`${link()}&expires_in=3598`); await tick();
  assert.equal(h.counters().exchanges, 1, 'new link cannot overlap undrained SDK work');
  block.resolve(); h.hooks.exchange = undefined; const result = await next;
  assert.equal(result.error, null); assert.equal(h.counters().exchanges, 2);
  assert.equal(h.sdk.localDataOwner.canAccess, true);
});
test('logout during callback prevents late credential resurrection or local acceptance', async () => {
  const h = await harness(), block = deferred<void>(); h.hooks.exchange = () => block.promise;
  const pending = h.store.completeAuthLink(link()); await tick(); await h.store.useAuthStore.getState().signOut();
  block.resolve(); assert.ok((await pending).error); assert.equal(h.sdk.localDataOwner.canAccess, false);
  assert.equal(h.values.has('sb-example-auth-token'), false);
});
test('timeout during completion restore durably fences a cached login across restart', async () => {
  const h = await harness(), block = deferred<void>(); h.hooks.restore = () => block.promise;
  const pending = h.store.completeAuthLink(link()); await tick(); await tick(); h.expire();
  assert.ok((await pending).error); await tick();
  assert.equal(h.sdk.localDataOwner.logoutFenced, true); assert.equal(h.sdk.localDataOwner.canAccess, false);
  const restarted = new h.owners.LocalDataOwner({ getItem: async k => h.values.get(k) ?? null, setItem: async (k, v) => { h.values.set(k, v); } });
  await restarted.initialize('A', async () => true); await restarted.accept('A');
  assert.equal(restarted.canAccess, false); block.resolve(); await tick();
  assert.equal(h.sdk.localDataOwner.canAccess, false);
});
test('an older restore rejection cannot lock a newer successful same-owner recovery', async () => {
  const h = await harness(); let reject!: (reason: Error) => void, restores = 0;
  const failed = new Promise<void>((_resolve, no) => { reject = no; });
  h.hooks.restore = () => ++restores === 1 ? failed : Promise.resolve();
  const older = h.store.completeAuthLink(link()); await tick(); await tick();
  const newer = await h.store.completeAuthLink(`${link()}&expires_in=3590`); assert.equal(newer.error, null);
  reject(new Error('old synthetic restoration failed')); assert.ok((await older).error);
  assert.equal(h.sdk.localDataOwner.canAccess, true); assert.equal(h.store.useAuthStore.getState().user?.id, 'A');
});
test('acceptance cancellation waits for a delayed durable fence before reporting completion', async () => {
  const h = await harness(), restore = deferred<void>(), persisted = deferred<void>();
  h.hooks.restore = () => restore.promise;
  const pending = h.store.completeAuthLink(link()); await tick(); await tick();
  h.hooks.write = (key, value) => key === h.owners.LOCAL_DATA_OWNER_KEY && JSON.parse(value).logoutFence ? persisted.promise : Promise.resolve();
  let done = false; pending.then(() => { done = true; }); h.expire(); await tick();
  assert.equal(done, false); assert.equal(h.sdk.localDataOwner.canAccess, false);
  persisted.resolve(); assert.match((await pending).error!, /taking longer/);
  assert.equal(JSON.parse(h.values.get(h.owners.LOCAL_DATA_OWNER_KEY)!).logoutFence, true);
  assert.equal(h.values.has('sb-example-auth-token'), false); restore.resolve();
});
test('failed cancellation fence persistence is surfaced and its own cached credentials are removed', async () => {
  const h = await harness(), restore = deferred<void>(); h.hooks.restore = () => restore.promise;
  const pending = h.store.completeAuthLink(link()); await tick(); await tick();
  h.hooks.write = async (key, value) => { if (key === h.owners.LOCAL_DATA_OWNER_KEY && JSON.parse(value).logoutFence) throw new Error('synthetic storage failure'); };
  h.expire(); assert.match((await pending).error!, /storage could not secure/);
  assert.equal(h.sdk.localDataOwner.canAccess, false); assert.equal(h.values.has('sb-example-auth-token'), false);
  restore.resolve(); await tick(); assert.equal(h.sdk.localDataOwner.canAccess, false);
});
test('a different account cannot take over retained history during recovery', async () => {
  const h = await harness(); await h.store.completeAuthLink(link()); const before = h.sdk.localDataOwner.ownerUserId;
  const result = await h.store.completeAuthLink(link('B'));
  assert.ok(result.error); assert.equal(h.sdk.localDataOwner.ownerUserId, before);
  assert.equal(h.sdk.localDataOwner.canAccess, false);
});
test('password changes require the verified recovery identity and become one-use after success', async () => {
  const h = await harness(); assert.ok(await h.store.useAuthStore.getState().updatePassword('synthetic-new-password'));
  await h.store.completeAuthLink(link()); assert.equal(await h.store.useAuthStore.getState().updatePassword('synthetic-new-password'), null);
  assert.ok(await h.store.useAuthStore.getState().updatePassword('another-password')); assert.equal(h.counters().updates, 1);
});
test('logout during password update cannot publish a successful result', async () => {
  const h = await harness(); await h.store.completeAuthLink(link());
  const block = deferred<void>(); h.hooks.update = () => block.promise;
  const changing = h.store.useAuthStore.getState().updatePassword('synthetic-new-password'); await tick();
  await h.store.useAuthStore.getState().signOut(); block.resolve(); assert.ok(await changing);
  assert.equal(h.sdk.localDataOwner.canAccess, false);
});
test('a changed SDK session cannot receive the recovery password update', async () => {
  const h = await harness(); await h.store.completeAuthLink(link());
  h.auth.getSession = async () => ({ data: { session: session('B') }, error: null });
  assert.ok(await h.store.useAuthStore.getState().updatePassword('synthetic-new-password'));
  assert.equal(h.counters().updates, 0);
});
test('a changed SDK identity after update never becomes recovery success', async () => {
  const h = await harness(); await h.store.completeAuthLink(link());
  h.hooks.update = async () => { h.auth.getSession = async () => ({ data: { session: session('B') }, error: null }); };
  assert.ok(await h.store.useAuthStore.getState().updatePassword('synthetic-new-password'));
});
