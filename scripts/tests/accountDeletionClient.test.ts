import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import { parseDeletionRequest } from '../../src/lib/accountDeletionProtocol';

function loadSource<T>(path: string, mocks: Record<string, unknown>, globals: Record<string, unknown> = {}): T {
  const filename = resolve(path);
  const compiled = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} };
  const require = createRequire(filename);
  vm.runInNewContext(compiled, { module, exports: module.exports,
    require: (id: string) => Object.hasOwn(mocks, id) ? mocks[id] : require(id),
    console, setTimeout, clearTimeout, AbortController, Date, URL, URLSearchParams, ...globals,
  }, { filename });
  return module.exports as T;
}
const OWNER = '11111111-1111-4111-8111-111111111111';
const RECEIPT = '22222222-2222-4222-8222-222222222222';
const CONTROL = 'strideos-account-deletion-control-v1';
const OWNER_KEY = 'strideos-local-data-owner-v1';
const SESSION_KEY = 'synthetic-session';
const pending = { id: RECEIPT, requested_at: '2026-11-01T01:00:00Z', status: 'pending' };

async function harness() {
  const values = new Map([['activity-store', 'saved activities'], ['training-plan-store', 'saved plan'], ['unrelated-preference', 'retain']]);
  const secureValues = new Map([[SESSION_KEY, 'synthetic-session-token']]);
  const events: string[] = [];
  const hooks = { lostPost: false, completed: false, authDeleted: false, recording: false,
    failControlReadback: false, failRemove: false, badStatus: false, foreignOnStatus: false,
    appleExchange: false, googleRevoke: false, automation: true, refreshReady: false,
    providerFailure: null as 'apple' | 'google' | null, providerReason: 'credential_refresh_required', wrongReauthOwner: false,
    rejectStartBeforeCommit: false, pauseControlWrite: null as null | (() => Promise<void>) };
  let serverSecret: string | null = null;
  let request: typeof pending | null = null;
  let randomCalls = 0, appleCalls = 0, authCalls = 0, googlePrompts = 0;
  const calls: { url: string; method: string; headers: Record<string, string>; body: Record<string, unknown> | null }[] = [];
  const storage = { getAllKeys: async () => [...values.keys()], getItem: async (key: string) => values.get(key) ?? null,
    setItem: async (key: string, value: string) => { values.set(key, value); }, removeItem: async (key: string) => {
      if (hooks.failRemove) throw new Error('synthetic locked storage');
      events.push(`remove:${key}`); values.delete(key);
    } };
  const secure = { getItemAsync: async (key: string) => {
    if (hooks.failControlReadback && key === CONTROL && secureValues.has(CONTROL)) {
      hooks.failControlReadback = false; throw new Error('synthetic readback failure');
    }
    return secureValues.get(key) ?? null;
  }, setItemAsync: async (key: string, value: string) => {
    if (key === CONTROL) await hooks.pauseControlWrite?.();
    events.push(`secure-write:${key}`); secureValues.set(key, value);
  },
    deleteItemAsync: async (key: string) => { events.push(`secure-remove:${key}`); secureValues.delete(key); } };
  const ownership = loadSource<typeof import('../../src/lib/localDataOwner')>('src/lib/localDataOwner.ts', {});
  const owner = ownership.configureLocalDataOwner({ getItem: secure.getItemAsync, setItem: secure.setItemAsync });
  await owner.initialize(OWNER, async () => true); await owner.accept(OWNER);
  const barrier = loadSource<typeof import('../../src/lib/localAccountCleanup')>('src/lib/localAccountCleanup.ts', {});
  const user = { id: OWNER, identities: [{ provider: 'email', identity_data: {} }] as { provider: string; identity_data: Record<string, unknown> }[] };
  const session = { user, access_token: 'synthetic-auth-token', provider_token: 'synthetic-provider-token' };
  const supabase = {
    getSupabaseAvailability: () => ({ status: 'available', client: { auth: {
      getSession: async () => { authCalls++; return { data: { session: hooks.authDeleted ? null : session }, error: null }; },
      getUser: async () => { authCalls++; return { data: { user: hooks.authDeleted ? null : user }, error: null }; },
      stopAutoRefresh: () => { events.push('stop-auth-refresh'); },
      signInWithOAuth: async () => ({ data: { url: 'https://synthetic.invalid/oauth' }, error: null }),
      exchangeCodeForSession: async () => {
        session.provider_token = 'synthetic-fresh-provider-token';
        return { data: { user: { ...user, id: hooks.wrongReauthOwner ? 'another-owner' : OWNER } }, error: null };
      },
      signInWithIdToken: async () => ({ data: { user: { ...user, id: hooks.wrongReauthOwner ? 'another-owner' : OWNER } }, error: null }),
      signOut: async () => ({ error: null }),
    } } }), getSupabaseConfigAvailability: () => ({ status: 'configured', supabaseAnonKey: 'synthetic-public-key' }),
    withExplicitAuthAttempt: async <T,>(work: () => Promise<T>, current: () => boolean) => { assert.equal(current(), true); const result = await work(); assert.equal(current(), true); return result; },
    clearCachedSupabaseSession: async () => { secureValues.delete(SESSION_KEY); },
    supabaseSessionStorageKey: () => SESSION_KEY,
    drainSupabaseCredentialWrites: async () => { events.push('sdk-credentials-drained'); },
    getSupabaseFunctionUrl: (name: string) => `https://synthetic.invalid/functions/v1/${name}`,
  };
  const files = new Set(['file:///documents/movement-videos/', 'file:///documents/movement-pose/']);
  const fs = { documentDirectory: 'file:///documents/', cacheDirectory: 'file:///cache/',
    readDirectoryAsync: async () => [], getInfoAsync: async (path: string) => ({ exists: files.has(path) }),
    deleteAsync: async (path: string) => { events.push(`media-remove:${path}`); files.delete(path); } };
  const consent = { setOwner: async (value: unknown) => { assert.equal(value, null); events.push('consent-off'); } };
  const mocks: Record<string, unknown> = {
    '@react-native-async-storage/async-storage': storage, 'expo-secure-store': secure, 'react-native': { Platform: { OS: 'ios' } },
    './localDataOwner': ownership, './localAccountCleanup': barrier, './supabase': supabase, 'expo-file-system/legacy': fs,
    './strava': { drainStravaCredentialWrites: async () => { events.push('strava-credentials-drained'); } },
    '../store/authStore': { useAuthStore: { getState: () => ({ lockForAccountDeletion: async () => { await owner.signOut(); events.push('auth-fenced'); } }) } },
    '../store/aiConsentStore': { aiConsent: consent }, '../store/observabilityConsentStore': { observabilityConsent: consent },
    './gpsTracking': { stopLocationTracking: async () => { events.push('gps-off'); } },
    './activityGpsTracking': { stopActivityLocationTracking: async () => { events.push('outdoor-off'); } },
    './notifications': { clearTrainingNotifications: async () => { events.push('notifications-off'); } },
  };
  const makeControl = () => loadSource<typeof import('../../src/lib/accountDeletionControl')>('src/lib/accountDeletionControl.ts', mocks);
  const control = makeControl(); await control.initializeAccountDeletionControl();
  const active = { getState: () => ({ isActive: hooks.recording, session: null }), persist: { hasHydrated: () => true } };
  const recordingMocks = {
    '../store/activeRunStore': { useActiveRunStore: active }, '../store/activeActivityStore': { useActiveActivityStore: active },
    '../store/activeIndoorRideStore': { useActiveIndoorRideStore: active }, '../store/activeStrengthSessionStore': { useActiveStrengthSessionStore: active },
    './trackingTaskHydration': { waitForPersistedStoreHydration: async () => true },
  };
  const fetcher = async (input: string, init: RequestInit) => {
    const body = init.body ? JSON.parse(init.body as string) : null;
    const call = { url: input, method: init.method!, headers: init.headers as Record<string, string>, body };
    calls.push(call);
    const capabilities = { automaticProcessing: hooks.automation, appleCodeExchange: hooks.appleExchange, googleTokenRevoke: hooks.googleRevoke,
      providerCredentialRefreshReady: hooks.refreshReady };
    const currentRequest = request && { ...request, ...(hooks.providerFailure ? { provider_actions: [{ provider: hooks.providerFailure, status: 'pending', reason: hooks.providerReason }] } : {}) };
    if (input.endsWith('/account-deletion') && init.method === 'GET') return new Response(JSON.stringify({ request: currentRequest, capabilities }));
    if (input.endsWith('/account-deletion') && init.method === 'POST') {
      assert.equal(JSON.parse(secureValues.get(CONTROL)!).receiptSecret, body.receiptSecret, 'secret must be durable before POST');
      if (hooks.rejectStartBeforeCommit) throw new Error('synthetic request never reached server');
      if (serverSecret && serverSecret !== body.receiptSecret) return new Response('{}', { status: 404 });
      serverSecret = body.receiptSecret; request = { ...pending };
      if (body.refreshProviderCredentials === true) hooks.providerReason = 'provider_retry_requested';
      if (hooks.lostPost) { hooks.lostPost = false; throw new Error('synthetic lost response'); }
      return new Response(JSON.stringify({ request: { ...request, ...(hooks.providerFailure ? { provider_actions: [{ provider: hooks.providerFailure, status: 'pending', reason: hooks.providerReason }] } : {}) }, complete: false }), { status: 202 });
    }
    assert.ok(input.endsWith('/account-deletion-status'));
    assert.equal(call.headers.authorization, undefined);
    if (!serverSecret || body.receiptSecret !== serverSecret) return new Response('{}', { status: 404 });
    if (hooks.foreignOnStatus) secureValues.set(OWNER_KEY, JSON.stringify({ version: 1, ownerUserId: 'another-owner', logoutFence: true, unclaimed: false }));
    return new Response(JSON.stringify({ request: hooks.badStatus ? { ...pending, status: 'invented-completion' }
      : hooks.completed ? { ...pending, status: 'completed', completed_at: '2026-11-01T02:00:00Z', provider_actions: [{ provider: 'apple', status: 'manual_required' }] } : currentRequest ?? pending }));
  };
  const client = loadSource<typeof import('../../src/lib/accountDeletion')>('src/lib/accountDeletion.ts', {
    './accountDeletionControl': control, './localDataOwner': ownership, './supabase': supabase, ...recordingMocks,
    'expo-crypto': { getRandomBytesAsync: async (length: number) => { assert.equal(length, 32); randomCalls++; return new Uint8Array(32).fill(0x5a); } },
    'expo-apple-authentication': { isAvailableAsync: async () => true, signInAsync: async () => { appleCalls++; return { user: 'apple-subject', identityToken: 'synthetic-apple-id', authorizationCode: 'synthetic-apple-code' }; } },
    'expo-web-browser': { openAuthSessionAsync: async () => { googlePrompts++; return { type: 'success', url: 'strideos://auth/callback?code=synthetic-code' }; } },
    'expo-linking': { createURL: () => 'strideos://auth/callback' },
  }, { fetch: fetcher });
  return { control, client, makeControl, owner, values, secureValues, files, events, calls, hooks, user,
    get randomCalls() { return randomCalls; }, get appleCalls() { return appleCalls; }, get authCalls() { return authCalls; }, get googlePrompts() { return googlePrompts; } };
}

test('secret is cryptographic, durable before POST and excluded from public state and URLs', async () => {
  const h = await harness(); await h.client.startAccountDeletion();
  const saved = JSON.parse(h.secureValues.get(CONTROL)!);
  assert.match(saved.receiptSecret, /^[0-9a-f]{64}$/); assert.equal(h.randomCalls, 1);
  assert.equal(JSON.stringify(h.control.accountDeletionControl.getSnapshot()).includes(saved.receiptSecret), false);
  assert.ok(h.calls.every(call => !call.url.includes(saved.receiptSecret)));
  assert.equal(h.values.get('activity-store'), 'saved activities');
  assert.equal(h.owner.capture(), null, 'ordinary local/cloud leases are fenced');
});
test('lost start response is recovered without Auth or a request ID, using the same durable secret', async () => {
  const h = await harness(); h.hooks.lostPost = true;
  await assert.rejects(h.client.startAccountDeletion(), /not confirmed/);
  assert.equal(JSON.parse(h.secureValues.get(CONTROL)!).request, null);
  h.hooks.authDeleted = true; const priorAuthCalls = h.authCalls;
  await h.client.pollAccountDeletion();
  assert.equal(h.authCalls, priorAuthCalls);
  const discovery = h.calls.find(call => call.url.endsWith('/account-deletion-status'))!;
  assert.equal(discovery.body!.requestId, undefined);
  assert.equal(h.control.accountDeletionControl.getSnapshot().request?.id, RECEIPT);
  assert.equal(h.randomCalls, 1); assert.equal(h.values.get('activity-store'), 'saved activities');
});
test('failed secure receipt readback sends no POST and retry recovers its original secret without rotation', async () => {
  const h = await harness(); h.hooks.failControlReadback = true;
  await assert.rejects(h.client.startAccountDeletion(), /receipt was not confirmed/);
  assert.equal(h.calls.some(call => call.method === 'POST'), false);
  const secret = JSON.parse(h.secureValues.get(CONTROL)!).receiptSecret;
  await h.client.pollAccountDeletion();
  assert.equal(JSON.parse(h.secureValues.get(CONTROL)!).receiptSecret, secret); assert.equal(h.randomCalls, 1);
});
test('pending or malformed server status never purges local data', async () => {
  const h = await harness(); await h.client.startAccountDeletion(); await h.client.pollAccountDeletion();
  h.hooks.badStatus = true; await assert.rejects(h.client.pollAccountDeletion());
  assert.equal(h.values.get('activity-store'), 'saved activities'); assert.equal(h.events.some(e => e.startsWith('remove:')), false);
});
test('intent generation is cancelled before awaiting native receipt save and never revives after failed persistence retry', async () => {
  const h = await harness(), oldLease = h.owner.capture(); assert.ok(oldLease);
  let started!: () => void, release!: () => void;
  const saving = new Promise<void>(resolve => { started = resolve; });
  const delayed = new Promise<void>(resolve => { release = resolve; });
  h.hooks.pauseControlWrite = async () => { started(); await delayed; throw new Error('synthetic write failure'); };
  const starting = h.client.startAccountDeletion(); const rejected = assert.rejects(starting, /not confirmed/);
  await saving;
  assert.equal(h.owner.isCurrent(oldLease), false, 'the generation must be cancelled while native intent save is still pending');
  release(); await rejected; h.hooks.pauseControlWrite = null;
  await h.control.initializeAccountDeletionControl();
  assert.equal(h.control.accountDeletionControl.getSnapshot().mode, 'open');
  await h.owner.accept(OWNER);
  assert.equal(h.owner.canAccess, true);
  assert.equal(h.owner.isCurrent(oldLease), false, 'reopening access cannot revive old captures');
  assert.equal(h.calls.some(call => call.method === 'POST'), false);
  assert.equal(h.values.get('activity-store'), 'saved activities');
});
test('completed capability receipt purges scoped app data, preserves originals and retains owner until cold verification', async () => {
  const h = await harness(); await h.client.startAccountDeletion(); h.hooks.completed = true;
  await h.client.pollAccountDeletion();
  assert.equal(h.control.accountDeletionControl.getSnapshot().mode, 'restart');
  assert.equal(h.values.has('activity-store'), false); assert.equal(h.values.get('unrelated-preference'), 'retain');
  assert.equal(h.secureValues.has(SESSION_KEY), false); assert.equal(h.files.size, 0);
  assert.equal(JSON.parse(h.secureValues.get(OWNER_KEY)!).ownerUserId, OWNER);
  const cold = h.makeControl(); await cold.initializeAccountDeletionControl();
  assert.equal(cold.accountDeletionControl.getSnapshot().mode, 'open');
  assert.equal(h.secureValues.has(OWNER_KEY), false);
  assert.equal(JSON.parse(h.secureValues.get(CONTROL)!).phase, 'released');
  assert.ok(h.events.indexOf('auth-fenced') < h.events.indexOf('remove:activity-store'));
  for (const event of ['sdk-credentials-drained', 'strava-credentials-drained']) {
    assert.ok(h.events.indexOf(event) >= 0 && h.events.indexOf(event) < h.events.indexOf('remove:activity-store'));
  }
});
test('partial local purge stays fenced and resumes offline from an already verified receipt', async () => {
  const h = await harness(); await h.client.startAccountDeletion(); h.hooks.completed = true; h.hooks.failRemove = true;
  await assert.rejects(h.client.pollAccountDeletion());
  assert.equal(h.control.accountDeletionControl.getSnapshot().mode, 'purging');
  assert.equal(h.values.get('activity-store'), 'saved activities');
  h.hooks.failRemove = false; const requests = h.calls.length;
  await h.client.pollAccountDeletion();
  assert.equal(h.calls.length, requests, 'verified receipt resumes device cleanup without another HTTP request');
  assert.equal(h.control.accountDeletionControl.getSnapshot().mode, 'restart');
});
test('cold verification detects a late old-runtime credential write and repairs it before releasing the owner', async () => {
  const h = await harness(); await h.client.startAccountDeletion(); h.hooks.completed = true;
  await h.client.pollAccountDeletion();
  h.secureValues.set('strava_refresh_token', 'synthetic-late-old-writer');
  const cold = h.makeControl(); await cold.initializeAccountDeletionControl();
  assert.equal(cold.accountDeletionControl.getSnapshot().mode, 'purging');
  assert.equal(h.secureValues.has(OWNER_KEY), true, 'late residue must keep the original owner fenced');
  await cold.completeLocalAccountCleanup();
  assert.equal(h.secureValues.has('strava_refresh_token'), false);
  assert.equal(cold.accountDeletionControl.getSnapshot().mode, 'restart');
  const verified = h.makeControl(); await verified.initializeAccountDeletionControl();
  assert.equal(verified.accountDeletionControl.getSnapshot().mode, 'open');
  assert.equal(h.secureValues.has(OWNER_KEY), false);
});
test('changed retained owner during a completed status lookup cannot purge another owner’s data', async () => {
  const h = await harness(); await h.client.startAccountDeletion(); h.hooks.completed = true; h.hooks.foreignOnStatus = true;
  await assert.rejects(h.client.pollAccountDeletion());
  assert.equal(h.values.get('activity-store'), 'saved activities');
});
test('Apple code collection is gated by server capability; existing verified Google token is transmitted once without storage', async () => {
  const h = await harness(); h.user.identities = [{ provider: 'apple', identity_data: { sub: 'apple-subject' } }, { provider: 'google', identity_data: {} }];
  h.hooks.googleRevoke = true;
  await h.client.startAccountDeletion(); assert.equal(h.appleCalls, 0);
  const post = h.calls.find(c => c.url.endsWith('/account-deletion') && c.method === 'POST')!;
  assert.deepEqual(post.body!.providerTokens, { google: 'synthetic-provider-token' });
  assert.equal(h.secureValues.get(CONTROL)!.includes('synthetic-provider-token'), false);
  const apple = await harness(); apple.user.identities = [{ provider: 'apple', identity_data: { sub: 'apple-subject' } }]; apple.hooks.appleExchange = true;
  await apple.client.startAccountDeletion(); assert.equal(apple.appleCalls, 1);
  const applePost = apple.calls.find(c => c.url.endsWith('/account-deletion') && c.method === 'POST')!;
  assert.deepEqual(applePost.body!.providerTokens, { appleAuthorizationCode: 'synthetic-apple-code' });
  assert.equal(apple.secureValues.get(CONTROL)!.includes('synthetic-apple-code'), false);
});
test('disabled server automation and active recordings cannot initiate deletion', async () => {
  const h = await harness(); h.hooks.automation = false;
  await assert.rejects(h.client.startAccountDeletion(), /not available/);
  assert.equal(h.secureValues.has(CONTROL), false); assert.equal(h.randomCalls, 0);
  const recording = await harness(); recording.hooks.recording = true;
  await assert.rejects(recording.client.startAccountDeletion(), /current workout/);
  assert.equal(recording.calls.length, 0); assert.equal(recording.secureValues.has(CONTROL), false);
});

test('completed receipts require an actual completion timestamp and pending provider reasons are a closed set', () => {
  assert.throws(() => parseDeletionRequest({ ...pending, status: 'completed' }), /valid deletion receipt/);
  assert.throws(() => parseDeletionRequest({ ...pending, status: 'completed', completed_at: 'invalid' }), /valid deletion receipt/);
  for (const reason of ['configuration_unavailable', 'provider_failure', 'credential_refresh_required', 'provider_retry_requested', 'not_prepared']) {
    assert.equal(parseDeletionRequest({ ...pending, provider_actions: [{ provider: 'apple', status: 'pending', reason }] }).provider_actions?.[0].reason, reason);
  }
  assert.throws(() => parseDeletionRequest({ ...pending, provider_actions: [{ provider: 'apple', status: 'pending', reason: 'unknown' }] }));
});
test('explicit Google repair performs fresh same-owner OAuth and retains the original capability without an automatic prompt loop', async () => {
  const h = await harness(); h.user.identities = [{ provider: 'google', identity_data: {} }];
  h.hooks.googleRevoke = true; h.hooks.providerFailure = 'google';
  await h.client.startAccountDeletion();
  const secret = JSON.parse(h.secureValues.get(CONTROL)!).receiptSecret;
  await h.client.pollAccountDeletion(); assert.equal(h.googlePrompts, 0);
  h.hooks.refreshReady = true;
  await h.client.refreshDeletionProviderCredentials('google');
  assert.equal(h.googlePrompts, 1);
  const repair = h.calls.find(call => call.body?.refreshProviderCredentials === true)!;
  assert.equal(repair.body!.receiptSecret, secret);
  assert.deepEqual(repair.body!.providerTokens, { google: 'synthetic-fresh-provider-token' });
  assert.equal(h.secureValues.get(CONTROL)!.includes('synthetic-fresh-provider-token'), false);
  assert.equal(h.values.get('activity-store'), 'saved activities');
  await assert.rejects(h.client.refreshDeletionProviderCredentials('google'), /does not need fresh/);
  assert.equal(h.googlePrompts, 1);
});
test('Apple repair waits for configured exchange and expired-worker preflight before collecting a single-use code', async () => {
  const h = await harness(); h.user.identities = [{ provider: 'apple', identity_data: { sub: 'apple-subject' } }];
  h.hooks.providerFailure = 'apple'; await h.client.startAccountDeletion();
  await assert.rejects(h.client.refreshDeletionProviderCredentials('apple'), /released credential repair/);
  assert.equal(h.appleCalls, 0);
  h.hooks.refreshReady = true;
  await assert.rejects(h.client.refreshDeletionProviderCredentials('apple'), /not configured/);
  assert.equal(h.appleCalls, 0);
  h.hooks.appleExchange = true;
  await h.client.refreshDeletionProviderCredentials('apple');
  assert.equal(h.appleCalls, 1);
  const repair = h.calls.find(call => call.body?.refreshProviderCredentials === true)!;
  assert.deepEqual(repair.body!.providerTokens, { appleAuthorizationCode: 'synthetic-apple-code' });
  assert.equal(h.secureValues.get(CONTROL)!.includes('synthetic-apple-code'), false);
});
test('repeated status 404 polling never opens Apple reauthentication after an unconfirmed explicit start', async () => {
  const h = await harness(); h.user.identities = [{ provider: 'apple', identity_data: { sub: 'apple-subject' } }];
  h.hooks.appleExchange = true; h.hooks.rejectStartBeforeCommit = true;
  await assert.rejects(h.client.startAccountDeletion());
  assert.equal(h.appleCalls, 1, 'only the initial explicit user action can open optional Apple confirmation');
  const secret = JSON.parse(h.secureValues.get(CONTROL)!).receiptSecret;
  for (let attempt = 0; attempt < 3; attempt++) await assert.rejects(h.client.pollAccountDeletion());
  assert.equal(h.appleCalls, 1);
  h.hooks.rejectStartBeforeCommit = false; await h.client.pollAccountDeletion();
  assert.equal(h.appleCalls, 1); assert.equal(h.randomCalls, 1);
  const submissions = h.calls.filter(c => c.url.endsWith('/account-deletion') && c.method === 'POST');
  assert.ok(submissions.length >= 4);
  assert.ok(submissions.slice(1).every(c => !(c.body!.providerTokens as { appleAuthorizationCode?: string } | undefined)?.appleAuthorizationCode));
  assert.ok(submissions.every(c => c.body!.receiptSecret === secret));
  assert.equal(h.values.get('activity-store'), 'saved activities');
});
test('a wrong Google account and server configuration errors never authorize repair or local removal', async () => {
  const h = await harness(); h.user.identities = [{ provider: 'google', identity_data: {} }];
  h.hooks.googleRevoke = true; h.hooks.providerFailure = 'google'; await h.client.startAccountDeletion();
  h.hooks.refreshReady = true; h.hooks.wrongReauthOwner = true;
  await assert.rejects(h.client.refreshDeletionProviderCredentials('google'), /Google account that owns/);
  assert.equal(h.calls.some(call => call.body?.refreshProviderCredentials === true), false);
  assert.equal(h.values.get('activity-store'), 'saved activities');
  assert.equal(JSON.parse(h.secureValues.get(OWNER_KEY)!).ownerUserId, OWNER);
  const badConfig = await harness(); badConfig.hooks.providerFailure = 'apple'; badConfig.hooks.providerReason = 'configuration_unavailable';
  await badConfig.client.startAccountDeletion();
  await assert.rejects(badConfig.client.refreshDeletionProviderCredentials('apple'), /does not need fresh/);
  assert.equal(badConfig.appleCalls, 0);
});

test('a late weather fetch cannot recreate its coordinate cache after the actual app storage adapter is fenced', async () => {
  const barrierModule = loadSource<typeof import('../../src/lib/localAccountCleanup')>('src/lib/localAccountCleanup.ts', {});
  const barrier = barrierModule.accountStorageBarrier;
  const values = new Map<string, string>(); let writes = 0;
  const storage = { getItem: async (key: string) => values.get(key) ?? null,
    setItem: async (key: string, value: string) => { writes++; values.set(key, value); }, removeItem: async (key: string) => { values.delete(key); } };
  const persist = loadSource<typeof import('../../src/store/persistStorage')>('src/store/persistStorage.ts', {
    '@react-native-async-storage/async-storage': storage, 'react-native': { Platform: { OS: 'ios' } },
    '../lib/localAccountCleanup': barrierModule,
    '../lib/accountDeletionControl': { initializeAccountDeletionControl: async () => { barrier.setMode('open'); } },
  });
  let release!: () => void, started!: () => void;
  const delayed = new Promise<void>(resolve => { release = resolve; });
  const requested = new Promise<void>(resolve => { started = resolve; });
  const weather = loadSource<typeof import('../../src/lib/weather')>('src/lib/weather.ts', {
    '../store/persistStorage': persist,
    'expo-location': { Accuracy: { Low: 1 }, getForegroundPermissionsAsync: async () => ({ granted: true }),
      getCurrentPositionAsync: async () => ({ coords: { latitude: 1, longitude: 2 } }), reverseGeocodeAsync: async () => [] },
  }, { fetch: async () => {
    started(); await delayed;
    return new Response(JSON.stringify({ current: { temperature_2m: 60, apparent_temperature: 60,
      relative_humidity_2m: 50, wind_speed_10m: 3, weather_code: 0, us_aqi: 10 } }));
  } });
  const fetch = weather.getWeatherReport({ force: true }); await requested;
  barrier.setMode('purging'); values.delete('strideos-weather-cache-v1'); release();
  await fetch; await barrier.drain();
  assert.equal(values.has('strideos-weather-cache-v1'), false); assert.equal(writes, 0);
});
