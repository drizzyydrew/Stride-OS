import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import { DELETION_TABLES, type DeletionPlan } from '../../src/utils/deletionFulfillment';

const owner = '71e0ff16-e219-43f2-b87b-e58db4a10214';
const requestId = '71e0ff16-e219-43f2-b87b-e58db4a10213';
const receiptSecret = 'e'.repeat(64);
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });
type ProviderToken = { provider: string; kind: string; subject: string; token: string };
type RpcResult = { data: unknown; error: unknown };
type Ticket = { id: string; expires: number; consumed: boolean; purpose: string };
const post = (body: unknown) => new Request('https://fixture.invalid', { method: 'POST', body: JSON.stringify(body) });
// Each test run observes one source snapshot even if another agent later edits
// shared files. No shared source is changed or copied into a second module.
const frozenSources = new Map([
  'supabase/functions/_shared/deletionRuntime.ts', 'supabase/functions/_shared/deletionHandlers.ts',
  'supabase/functions/_shared/deletionProviders.ts', 'supabase/functions/_shared/deletionProviderConfig.ts',
  'supabase/functions/_shared/launchHandlers.ts', 'src/utils/deletionFulfillment.ts',
  'supabase/functions/account-deletion/index.ts', 'supabase/functions/account-deletion-status/index.ts',
  'supabase/functions/account-deletion-worker/index.ts',
].map(file => [resolve(file), readFileSync(file, 'utf8')]));
const sqlParameters = new Map<string, string[]>();
for (const file of readdirSync('supabase/migrations').filter(file => file.endsWith('.sql')).sort()) {
  const sql = readFileSync(`supabase/migrations/${file}`, 'utf8');
  for (const match of sql.matchAll(/create\s+(?:or\s+replace\s+)?function\s+public\.([a-z_]+)\s*\(([^)]*)\)\s*returns/gi)) {
    sqlParameters.set(match[1]!, match[2]!.trim() ? match[2]!.split(',').map(arg => arg.trim().split(/\s+/)[0]!) : []);
  }
}

/**
 * All customer/provider/secret values below are synthetic. Real runtime, core,
 * handlers, config and provider adapter execute; only external boundaries are
 * mocked. The RPC state model is not evidence that migration SQL was executed.
 */
function harness(providers = ['email'], options: { tokens?: ProviderToken[]; paths?: number; googleOverride?: string; allowedOwners?: string[] } = {}) {
  const events: string[] = [];
  const rpcCalls: { name: string; args: Record<string, unknown> }[] = [];
  const pending: Promise<unknown>[] = [];
  const warnings: string[] = [];
  const served: Record<string, (req: Request) => Promise<Response>> = {};
  const plan: DeletionPlan = {
    request_id: requestId, user_id: owner, status: 'pending', auth_user_exists: true,
    record_counts: Object.fromEntries(DELETION_TABLES.map(table => [table, 1])),
    storage_paths: Array.from({ length: options.paths ?? 1 }, (_, index) => `${owner}/clip-${index}.mov`),
    unsafe_storage_objects: 0, shared_auth_tables: [], identity_providers: providers,
    fulfillment_version: 1, provider_actions: providers.filter(p => p !== 'email').map(provider => ({ provider, status: 'pending', reason: 'not_prepared' })),
  };
  const state = {
    // Positive fixtures explicitly model authorization for this synthetic UUID
    // only. Empty allowlist cases model the migration's safe default. These are
    // in-memory controls, never real owner IDs or production configuration.
    plan, tokens: clone(options.tokens ?? []), enabled: true, allowedOwners: new Set(options.allowedOwners ?? [owner]),
    now: 0, lease: '', leaseExpires: 0, claims: 0,
    tickets: new Map<string, Ticket>(), issued: 0, nextDispatchAt: 0, banError: false, storageError: false, authError: false,
    joseError: false, joseSubject: 'apple-owner', googleSubject: 'google-owner',
    googleInfoStatus: 200, appleExchangeStatus: 200, appleRevokeStatus: 200,
    rpcOverride: undefined as ((name: string, args: Record<string, unknown>) => RpcResult | undefined | Promise<RpcResult | undefined>) | undefined,
    fetchHook: undefined as ((url: string) => void | Promise<void>) | undefined,
  };
  const env: Record<string, string> = {
    SUPABASE_URL: 'https://synthetic-project.invalid', SUPABASE_SERVICE_ROLE_KEY: 'synthetic-service-role',
    STRIDEOS_APPLE_CLIENT_ID: 'synthetic.apple.app', STRIDEOS_APPLE_CLIENT_SECRET: 'synthetic-apple-client-secret',
    ...(options.googleOverride ? { STRIDEOS_GOOGLE_CLIENT_ID: options.googleOverride } : {}),
  };
  const success = (data: unknown): RpcResult => ({ data, error: null });
  const failure = (): RpcResult => ({ data: null, error: { message: 'synthetic private database error' } });
  const ownerEligible = (id: unknown) => state.enabled && typeof id === 'string' && state.allowedOwners.has(id);
  const leaseValid = (args: Record<string, unknown>) => args.request_id === requestId && args.claim_token === state.lease
    && state.plan.status === 'processing' && state.leaseExpires > state.now
    && (state.plan.fulfillment_version === 0 || ownerEligible(state.plan.user_id));
  const receipt = () => ({ id: requestId, requested_at: '2026-11-01T06:00:00Z', status: state.plan.status,
    completed_at: state.plan.status === 'completed' ? '2026-11-01T06:01:00Z' : null,
    user_id: owner, receipt_hash: 'synthetic-private-hash',
    provider_dispositions: Object.fromEntries((state.plan.provider_actions ?? []).map(action => [action.provider, action.status])),
    provider_actions: clone(state.plan.provider_actions ?? []),
  });
  const admin = {
    rpc: async (name: string, args: Record<string, unknown>): Promise<RpcResult> => {
      events.push(`rpc:${name}`); rpcCalls.push({ name, args: clone(args) });
      const parameters = sqlParameters.get(name);
      assert.ok(parameters, `${name} must exist in the checked-in migration contract`);
      assert.deepEqual(Object.keys(args).sort(), [...parameters].sort(), `${name} named arguments must match SQL`);
      const override = await state.rpcOverride?.(name, args);
      if (override) return override;
      if (name === 'stride_deletion_automation_enabled') return success(ownerEligible(args.owner_id));
      if (name === 'read_stride_deletion_owned_status') {
        assert.equal(args.owner_id, owner);
        return success({ ...receipt(), provider_credential_refresh_ready: ownerEligible(args.owner_id)
          && state.plan.fulfillment_version === 1 && state.plan.status !== 'completed' && state.leaseExpires <= state.now });
      }
      if (name === 'read_stride_deletion_receipt') return success(args.receipt_secret === receiptSecret
        && (args.request_id === null || args.request_id === requestId) ? receipt() : null);
      if (name === 'start_stride_deletion' || name === 'refresh_stride_deletion_provider_tokens') {
        assert.equal(args.user_id, owner); assert.equal(typeof args.receipt_hash, 'string');
        return ownerEligible(args.user_id) ? success(receipt()) : failure();
      }
      if (name !== 'consume_stride_deletion_job_ticket') assert.equal(args.request_id, requestId, `${name} must bind the exact request`);
      if (name === 'stride_deletion_plan') return success(clone(state.plan));
      if (name === 'claim_stride_deletion') {
        if (!ownerEligible(state.plan.user_id) || state.plan.status === 'completed' || state.leaseExpires > state.now) return failure();
        state.claims++;
        state.lease = `81e0ff16-e219-43f2-b87b-${String(state.claims).padStart(12, '0')}`;
        state.leaseExpires = state.now + 15 * 60_000; state.plan.status = 'processing';
        return success(state.lease);
      }
      if (name === 'renew_stride_deletion') {
        if (!leaseValid(args)) return success(false);
        state.leaseExpires = state.now + 15 * 60_000; return success(true);
      }
      if (name === 'issue_stride_deletion_job_ticket') {
        if (!ownerEligible(state.plan.user_id) || state.plan.status === 'completed' || state.leaseExpires > state.now || state.nextDispatchAt > state.now) return failure();
        for (const [key, ticket] of state.tickets) if (!ticket.consumed) state.tickets.delete(key);
        state.nextDispatchAt = state.now + Math.min(3600, 60 * 2 ** Math.min(state.issued, 6)) * 1000;
        const ticket = (++state.issued).toString(16).padStart(64, '0');
        state.tickets.set(ticket, { id: requestId, expires: state.now + 5 * 60_000, consumed: false, purpose: 'worker' });
        return success(ticket);
      }
      if (name === 'consume_stride_deletion_job_ticket') {
        const ticket = state.tickets.get(String(args.ticket_secret));
        if (!ownerEligible(state.plan.user_id) || !ticket || ticket.id !== args.request_id || ticket.consumed
          || ticket.expires <= state.now || ticket.purpose !== 'worker' || state.plan.status === 'completed') return success(false);
        ticket.consumed = true; return success(true);
      }
      if (!leaseValid(args)) return failure();
      if (name === 'read_stride_deletion_provider_tokens') return success(clone(state.tokens));
      if (name === 'replace_stride_deletion_apple_code') {
        const retained = state.tokens.find(token => token.provider === 'apple');
        if (!retained || retained.kind !== 'apple_authorization_code' || retained.subject !== args.provider_subject
          || retained.token !== args.authorization_code) return failure();
        retained.kind = 'apple_refresh_token'; retained.token = String(args.refresh_token);
        return success(true);
      }
      if (name === 'attest_stride_deletion_provider') {
        if (args.disposition !== 'retry_pending') {
          const action = state.plan.provider_actions!.find(value => value.provider === args.provider)!;
          action.status = args.disposition as 'revoked' | 'manual_required';
          action.reason = action.status === 'revoked' ? 'provider_confirmed' : 'legacy_token_unavailable';
          if (action.status === 'revoked') state.tokens = state.tokens.filter(token => token.provider !== action.provider);
        } else {
          const action = state.plan.provider_actions!.find(value => value.provider === args.provider)!;
          action.reason = String(args.reason);
        }
        return success(true);
      }
      if (name === 'complete_stride_deletion') {
        assert.equal(state.plan.auth_user_exists, false); assert.equal(state.plan.storage_paths.length, 0);
        assert.ok(Object.values(state.plan.record_counts).every(count => count === 0));
        state.plan.status = 'completed'; state.tickets.clear(); return success(true);
      }
      throw new Error(`Unexpected RPC ${name}`);
    },
    auth: {
      getUser: async (token: string) => {
        events.push('auth:getUser');
        return { data: { user: token === 'synthetic-owner-session' ? { id: owner,
          identities: providers.map(provider => ({ provider, provider_id: `${provider}-owner` })) } : null }, error: null };
      },
      admin: {
        updateUserById: async (id: string, attributes: unknown) => {
          events.push('auth:ban'); assert.equal(id, owner); assert.deepEqual(clone(attributes), { ban_duration: '8760h' });
          return { error: state.banError ? new Error('synthetic private ban error') : null };
        },
        deleteUser: async (id: string) => {
          events.push('auth:delete'); assert.equal(id, owner);
          if (state.authError) return { error: new Error('synthetic private auth error') };
          state.plan.auth_user_exists = false;
          state.plan.record_counts = Object.fromEntries(DELETION_TABLES.map(table => [table, 0]));
          return { error: null };
        },
      },
    },
    storage: { from: (bucket: string) => {
      assert.equal(bucket, 'movement-videos');
      return { remove: async (paths: string[]) => {
        events.push(`storage:remove:${paths.length}`);
        assert.ok(paths.length <= 100 && paths.every(path => path.startsWith(`${owner}/`)));
        if (state.storageError) return { error: new Error('synthetic private storage error') };
        state.plan.storage_paths = state.plan.storage_paths.filter(path => !paths.includes(path)); return { error: null };
      } };
    } },
    from: (table: string) => {
      assert.equal(table, 'stride_account_deletion_requests');
      const query = {
        select: (fields: string) => { assert.equal(fields, 'id,requested_at,status,completed_at'); return query; },
        eq: (field: string, id: string) => { assert.equal(field, 'user_id'); assert.equal(id, owner); return query; },
        maybeSingle: async () => ({ data: receipt(), error: null }), single: async () => ({ data: receipt(), error: null }),
        upsert: async () => ({ error: null }),
      }; return query;
    },
  };
  const cache = new Map<string, { exports: any }>();
  const load = <T,>(file: string): T => {
    const filename = resolve(file);
    const cached = cache.get(filename); if (cached) return cached.exports as T;
    const module = { exports: {} as any }; cache.set(filename, module);
    const source = frozenSources.get(filename);
    assert.notEqual(source, undefined, `Unexpected source outside frozen runtime modules: ${filename}`);
    const compiled = ts.transpileModule(source!, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText;
    const context = {
      module, exports: module.exports, URL, URLSearchParams, Request, Response, Headers, TextEncoder, TextDecoder,
      Uint8Array, AbortController, AbortSignal, crypto: webcrypto, setTimeout, clearTimeout,
      console: { warn: (message: string) => warnings.push(message) },
      Deno: { env: { get: (name: string) => env[name] }, serve: (handler: (req: Request) => Promise<Response>) => { served[filename] = handler; } },
      EdgeRuntime: { waitUntil: (promise: Promise<unknown>) => { events.push('queue:waitUntil'); pending.push(promise); } },
      fetch: async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input); await state.fetchHook?.(url);
        assert.equal(init?.redirect, 'error'); assert.ok(init?.signal instanceof AbortSignal);
        if (url.startsWith('https://oauth2.googleapis.com/tokeninfo?')) {
          events.push('provider:google:identity');
          const config = load<{ STRIDEOS_GOOGLE_CLIENT_ID: string }>('supabase/functions/_shared/deletionProviderConfig.ts');
          return json({ sub: state.googleSubject, aud: env.STRIDEOS_GOOGLE_CLIENT_ID ?? config.STRIDEOS_GOOGLE_CLIENT_ID }, state.googleInfoStatus);
        }
        if (url === 'https://oauth2.googleapis.com/revoke') { events.push('provider:google:revoke'); return new Response(''); }
        if (url === 'https://appleid.apple.com/auth/token') {
          events.push('provider:apple:exchange'); assert.equal(new URLSearchParams(String(init?.body)).get('grant_type'), 'authorization_code');
          return json({ id_token: 'synthetic-apple-id-jwt', refresh_token: 'synthetic-apple-refresh' }, state.appleExchangeStatus);
        }
        if (url === 'https://appleid.apple.com/auth/revoke') {
          events.push('provider:apple:revoke'); assert.equal(new URLSearchParams(String(init?.body)).get('token_type_hint'), 'refresh_token');
          return new Response('', { status: state.appleRevokeStatus });
        }
        throw new Error('Unexpected external request; real network is forbidden');
      },
      require: (id: string) => {
        if (id === 'https://esm.sh/@supabase/supabase-js@2.48.0') return { createClient: (url: string, key: string, config: unknown) => {
          assert.equal(url, env.SUPABASE_URL); assert.equal(key, 'synthetic-service-role');
          assert.deepEqual(clone(config), { auth: { persistSession: false, autoRefreshToken: false } }); return admin;
        } };
        if (id === 'https://esm.sh/jose@6.1.3') return {
          createRemoteJWKSet: (url: URL, config: unknown) => { assert.equal(String(url), 'https://appleid.apple.com/auth/keys');
            assert.deepEqual(clone(config), { timeoutDuration: 10_000 }); return 'synthetic-jwks'; },
          jwtVerify: async (jwt: string, keys: string, config: unknown) => {
            events.push('provider:apple:identity'); assert.equal(jwt, 'synthetic-apple-id-jwt'); assert.equal(keys, 'synthetic-jwks');
            assert.deepEqual(clone(config), { issuer: 'https://appleid.apple.com', audience: 'synthetic.apple.app', algorithms: ['RS256'] });
            if (state.joseError) throw new Error('synthetic expired/invalid Apple identity');
            return { payload: { sub: state.joseSubject } };
          },
        };
        if (id.startsWith('.')) return load(resolve(dirname(filename), id));
        throw new Error(`Unexpected import ${id}`);
      },
    };
    vm.runInNewContext(compiled, context, { filename }); return module.exports as T;
  };
  const runtime = load<typeof import('../../supabase/functions/_shared/deletionRuntime')>('supabase/functions/_shared/deletionRuntime.ts');
  const handler = (name: 'account-deletion' | 'account-deletion-status' | 'account-deletion-worker') => {
    const filename = resolve(`supabase/functions/${name}/index.ts`); load(filename); return served[filename]!;
  };
  return { runtime, state, env, events, rpcCalls, warnings, pending, handler,
    drain: async () => { await Promise.all(pending); },
    ticket: async () => { const result = await admin.rpc('issue_stride_deletion_job_ticket', { request_id: requestId });
      assert.equal(result.error, null); return result.data as string; },
    noRemoval: () => { assert.equal(events.some(event => event === 'auth:ban' || event === 'auth:delete' || event.startsWith('storage:')), false); },
  };
}

const google = (): ProviderToken => ({ provider: 'google', kind: 'google_access_token', subject: 'google-owner', token: 'synthetic-google-access' });
const apple = (): ProviderToken => ({ provider: 'apple', kind: 'apple_authorization_code', subject: 'apple-owner', token: 'synthetic-single-use-code' });

test('actual runtime binds renew/claim/provider RPCs and bans before owner-scoped storage batches and Auth deletion', async () => {
  const h = harness(['email', 'google'], { tokens: [google()], paths: 101 });
  await h.runtime.processDeletionRequest(requestId);
  assert.equal(h.state.plan.status, 'completed');
  const order = ['rpc:claim_stride_deletion', 'rpc:read_stride_deletion_provider_tokens', 'provider:google:identity',
    'provider:google:revoke', 'rpc:attest_stride_deletion_provider', 'auth:ban', 'storage:remove:100', 'storage:remove:1', 'auth:delete', 'rpc:complete_stride_deletion'];
  const positions = order.map(event => h.events.indexOf(event));
  assert.ok(positions.every((position, index) => position >= 0 && (index === 0 || position > positions[index - 1]!)));
  for (const event of ['auth:ban', 'storage:remove:100', 'storage:remove:1', 'auth:delete']) {
    assert.equal(h.events[h.events.indexOf(event) - 1], 'rpc:renew_stride_deletion');
  }
  assert.ok(h.rpcCalls.filter(call => ['renew_stride_deletion', 'attest_stride_deletion_provider',
    'read_stride_deletion_provider_tokens', 'complete_stride_deletion'].includes(call.name)).every(call => call.args.claim_token === h.state.lease));
});

test('Google uses actual public CID fallback without a private credential and respects an explicit override', async () => {
  for (const googleOverride of [undefined, 'synthetic.google.override']) {
    const h = harness(['google'], { tokens: [google()], googleOverride });
    assert.equal(h.runtime.deletionDependencies.capabilities().googleTokenRevoke, true);
    if (!googleOverride) assert.equal(h.env.STRIDEOS_GOOGLE_CLIENT_ID, undefined);
    await h.runtime.processDeletionRequest(requestId);
    assert.equal(h.state.plan.status, 'completed');
  }
});

test('Apple exchange validates JWT and persists refresh via exact CAS RPC before revoke or any account removal', async () => {
  const h = harness(['apple'], { tokens: [apple()] });
  await h.runtime.processDeletionRequest(requestId);
  const order = ['provider:apple:exchange', 'provider:apple:identity', 'rpc:replace_stride_deletion_apple_code',
    'provider:apple:revoke', 'rpc:attest_stride_deletion_provider', 'auth:ban', 'auth:delete'];
  const positions = order.map(event => h.events.indexOf(event));
  assert.ok(positions.every((position, index) => position >= 0 && (index === 0 || position > positions[index - 1]!)));
  assert.deepEqual(h.rpcCalls.find(call => call.name === 'replace_stride_deletion_apple_code')!.args, {
    request_id: requestId, authorization_code: 'synthetic-single-use-code', refresh_token: 'synthetic-apple-refresh',
    provider_subject: 'apple-owner', claim_token: h.state.lease,
  });
});

test('failed/expired identities cannot attest success, ban, remove files, or delete Auth', async () => {
  for (const scenario of ['apple-expired-jwt', 'apple-wrong-subject', 'google-expired-token', 'google-wrong-subject']) {
    const isApple = scenario.startsWith('apple');
    const h = harness([isApple ? 'apple' : 'google'], { tokens: [isApple ? apple() : google()] });
    if (scenario === 'apple-expired-jwt') h.state.joseError = true;
    if (scenario === 'apple-wrong-subject') h.state.joseSubject = 'different-owner';
    if (scenario === 'google-expired-token') h.state.googleInfoStatus = 400;
    if (scenario === 'google-wrong-subject') h.state.googleSubject = 'different-owner';
    await assert.rejects(h.runtime.processDeletionRequest(requestId));
    h.noRemoval();
    assert.equal(h.events.some(event => event.endsWith(':revoke')), false);
    assert.equal(h.events.includes('rpc:replace_stride_deletion_apple_code'), false);
    assert.ok(h.rpcCalls.filter(call => call.name === 'attest_stride_deletion_provider').every(call => call.args.disposition === 'retry_pending'));
  }
});

test('Apple persistence failure blocks revoke; revoke failure resumes using persisted refresh after lease expiry', async () => {
  const failed = harness(['apple'], { tokens: [apple()] });
  failed.state.rpcOverride = name => name === 'replace_stride_deletion_apple_code' ? { data: false, error: null } : undefined;
  await assert.rejects(failed.runtime.processDeletionRequest(requestId)); failed.noRemoval();
  assert.equal(failed.events.includes('provider:apple:revoke'), false);
  const h = harness(['apple'], { tokens: [apple()] }); h.state.appleRevokeStatus = 503;
  await assert.rejects(h.runtime.processDeletionRequest(requestId)); h.noRemoval();
  assert.equal(h.state.tokens[0]!.kind, 'apple_refresh_token');
  assert.equal(h.state.tokens[0]!.token, 'synthetic-apple-refresh');
  h.state.now = h.state.leaseExpires; h.state.appleRevokeStatus = 200;
  await h.runtime.processDeletionRequest(requestId);
  assert.equal(h.state.claims, 2); assert.equal(h.state.plan.status, 'completed');
  assert.equal(h.events.filter(event => event === 'provider:apple:exchange').length, 1);
  assert.equal(h.events.filter(event => event === 'provider:apple:identity').length, 1);
});

test('cross-provider token kinds fail closed before any provider traffic or removal', async () => {
  for (const token of [{ ...apple(), kind: 'google_access_token' },
    { ...google(), kind: 'apple_authorization_code' }, { ...google(), kind: 'apple_refresh_token' }]) {
    const h = harness([token.provider], { tokens: [token] });
    await assert.rejects(h.runtime.processDeletionRequest(requestId));
    h.noRemoval(); assert.equal(h.events.some(event => event.startsWith('provider:')), false);
  }
});

test('unconfirmed provider attestation and expired lease stop the actual runtime before account/file effects', async () => {
  for (const stage of ['attestation', 'initial-renew', 'after-provider']) {
    const h = harness(['google'], { tokens: [google()] });
    h.state.rpcOverride = (name, args) => {
      if (stage === 'attestation' && name === 'attest_stride_deletion_provider' && args.disposition === 'revoked') return { data: false, error: null };
      if (stage === 'initial-renew' && name === 'renew_stride_deletion') return { data: false, error: null };
      return undefined;
    };
    if (stage === 'after-provider') h.state.fetchHook = url => { if (url.endsWith('/revoke')) h.state.now = h.state.leaseExpires; };
    await assert.rejects(h.runtime.processDeletionRequest(requestId)); h.noRemoval();
    if (stage === 'initial-renew') assert.equal(h.events.some(event => event.startsWith('provider:')), false);
  }
});

test('ban failure blocks files/Auth; storage failure retains Auth; Auth failure cannot complete', async () => {
  for (const stage of ['banError', 'storageError', 'authError'] as const) {
    const h = harness(); h.state[stage] = true;
    await assert.rejects(h.runtime.processDeletionRequest(requestId));
    assert.equal(h.events.includes('rpc:complete_stride_deletion'), false);
    assert.equal(h.state.plan.auth_user_exists, true);
    if (stage === 'banError') assert.equal(h.events.some(event => event.startsWith('storage:') || event === 'auth:delete'), false);
    if (stage === 'storageError') assert.equal(h.events.includes('auth:delete'), false);
  }
});

test('enqueue consumes the issued ticket before waitUntil; failed consumption schedules nothing', async () => {
  const h = harness(); await h.runtime.deletionDependencies.enqueue(requestId); await h.drain();
  const issue = h.events.indexOf('rpc:issue_stride_deletion_job_ticket');
  const consume = h.events.indexOf('rpc:consume_stride_deletion_job_ticket');
  const wait = h.events.indexOf('queue:waitUntil');
  assert.ok(issue >= 0 && consume > issue && wait > consume);
  assert.equal(h.state.plan.status, 'completed');
  const failed = harness(); failed.state.rpcOverride = name => name === 'consume_stride_deletion_job_ticket' ? { data: false, error: null } : undefined;
  await failed.runtime.deletionDependencies.enqueue(requestId);
  assert.equal(failed.pending.length, 0); failed.noRemoval();
});

test('actual worker entrypoint requires single-use unexpired request/purpose-bound ticket without relying on JWT gateway', async () => {
  for (const scenario of ['missing', 'wrong-secret', 'wrong-request', 'wrong-purpose', 'expired', 'disabled']) {
    const h = harness(); const ticket = await h.ticket();
    if (scenario === 'wrong-purpose') h.state.tickets.get(ticket)!.purpose = 'receipt';
    if (scenario === 'expired') h.state.now = h.state.tickets.get(ticket)!.expires;
    if (scenario === 'disabled') h.state.enabled = false;
    const response = await h.handler('account-deletion-worker')(post({ requestId: scenario === 'wrong-request' ? owner : requestId,
      ...(scenario === 'missing' ? {} : { jobTicket: scenario === 'wrong-secret' ? receiptSecret : ticket }),
      capabilities: { automaticProcessing: true }, isAdmin: true,
    }));
    assert.equal(response.status, 401); assert.equal(h.pending.length, 0); h.noRemoval();
  }
  const h = harness(); const ticket = await h.ticket(); const worker = h.handler('account-deletion-worker');
  assert.equal((await worker(post({ requestId, jobTicket: ticket }))).status, 202);
  assert.equal((await worker(post({ requestId, jobTicket: ticket }))).status, 401);
  await h.drain(); assert.equal(h.state.plan.status, 'completed'); assert.equal(h.pending.length, 1);
});

test('failed background run remains resumable only after lease expiry with a fresh worker ticket', async () => {
  const h = harness(); h.state.banError = true;
  const firstTicket = await h.ticket(); const worker = h.handler('account-deletion-worker');
  assert.equal((await worker(post({ requestId, jobTicket: firstTicket }))).status, 202); await h.drain();
  assert.equal(h.state.plan.status, 'processing'); assert.equal(h.state.plan.auth_user_exists, true);
  assert.ok(h.warnings.every(message => !message.includes('synthetic private')));
  await assert.rejects(h.runtime.deletionDependencies.enqueue(requestId));
  assert.equal((await worker(post({ requestId, jobTicket: firstTicket }))).status, 401);
  h.state.now = h.state.leaseExpires; h.state.banError = false;
  const freshTicket = await h.ticket(); assert.notEqual(freshTicket, firstTicket);
  assert.equal((await worker(post({ requestId, jobTicket: freshTicket }))).status, 202); await h.drain();
  assert.equal(h.state.claims, 2); assert.equal(h.state.plan.status, 'completed');
});

test('capability polling respects RPC retry backoff after consumed-ticket worker loss without bypassing ticket issuance', async () => {
  const h = harness(); const lost = await h.ticket();
  assert.equal(await h.runtime.consumeDeletionTicket(requestId, lost), true);
  // Model loss before waitUntil/claim. Recovery must use a fresh due ticket;
  // possession of the receipt cannot force issue through the SQL due-time gate.
  const status = h.handler('account-deletion-status');
  assert.equal((await status(post({ receiptSecret }))).status, 200);
  assert.equal(h.pending.length, 0); assert.equal(h.state.issued, 1); h.noRemoval();
  h.state.now = h.state.nextDispatchAt;
  assert.equal((await status(post({ receiptSecret }))).status, 200);
  await h.drain(); assert.equal(h.state.issued, 2); assert.equal(h.state.plan.status, 'completed');
});

test('receipt capability cannot bypass auth/start or worker tickets; valid read can resume only its bound request', async () => {
  const h = harness(); const status = h.handler('account-deletion-status');
  assert.equal((await status(post({ requestId, receiptSecret: 'f'.repeat(64), capabilities: { automaticProcessing: true } }))).status, 404);
  assert.equal(h.events.includes('rpc:issue_stride_deletion_job_ticket'), false);
  assert.equal(h.events.includes('auth:getUser'), false);
  const worker = h.handler('account-deletion-worker');
  assert.equal((await worker(post({ requestId, jobTicket: receiptSecret }))).status, 401);
  const response = await status(post({ receiptSecret })); assert.equal(response.status, 200);
  const body = await response.text();
  for (const privateValue of [receiptSecret, owner, 'synthetic-private-hash']) assert.equal(body.includes(privateValue), false);
  await h.drain(); assert.equal(h.state.plan.status, 'completed');
  assert.equal(h.events.includes('rpc:start_stride_deletion'), false);
});

test('account capabilities are descriptive only: forged flags cannot bypass verified authentication or disabled automation', async () => {
  const h = harness(); const account = h.handler('account-deletion');
  const body = { confirmation: 'DELETE MY STRIDEOS ACCOUNT', receiptSecret, userId: owner,
    capabilities: { automaticProcessing: true, appleCodeExchange: true, googleTokenRevoke: true } };
  assert.equal((await account(post(body))).status, 401);
  h.state.enabled = false;
  const request = post(body); request.headers.set('Authorization', 'Bearer synthetic-owner-session');
  assert.equal((await account(request)).status, 503);
  assert.equal(h.events.includes('rpc:start_stride_deletion'), false); assert.equal(h.pending.length, 0); h.noRemoval();
});

test('actual authenticated refresh binding sends exact SQL args, hashes original capability, and never uses start', async () => {
  const h = harness(['google'], { tokens: [google()] });
  // Keep this an isolated handler->runtime->RPC binding test, not an automatic
  // fulfillment test. A consumption denial prevents background scheduling.
  h.state.rpcOverride = name => name === 'consume_stride_deletion_job_ticket' ? { data: false, error: null } : undefined;
  const request = post({ confirmation: 'DELETE MY STRIDEOS ACCOUNT', receiptSecret,
    refreshProviderCredentials: true, userId: 'forged-owner', providerTokens: { google: 'synthetic-fresh-access' } });
  request.headers.set('Authorization', 'Bearer synthetic-owner-session');
  const response = await h.handler('account-deletion')(request);
  assert.equal(response.status, 202);
  const call = h.rpcCalls.find(call => call.name === 'refresh_stride_deletion_provider_tokens')!;
  assert.ok(call); assert.equal(call.args.user_id, owner);
  const digest = await webcrypto.subtle.digest('SHA-256', new TextEncoder().encode(receiptSecret));
  assert.equal(call.args.receipt_hash, Buffer.from(digest).toString('hex'));
  assert.deepEqual(call.args.provider_tokens, [{ kind: 'google_access_token', secret: 'synthetic-fresh-access', subject: 'google-owner' }]);
  assert.equal(h.events.includes('rpc:start_stride_deletion'), false);
  assert.equal(h.pending.length, 0); h.noRemoval();
  const text = await response.text(); assert.equal(text.includes('synthetic-fresh-access'), false); assert.equal(text.includes(receiptSecret), false);
});

test('expired provider credentials bind the refresh-required reason into a sanitized public pending action', async () => {
  const h = harness(['google'], { tokens: [google()] }); h.state.googleInfoStatus = 400;
  await assert.rejects(h.runtime.processDeletionRequest(requestId)); h.noRemoval();
  const attestation = h.rpcCalls.find(call => call.name === 'attest_stride_deletion_provider')!;
  assert.equal(attestation.args.disposition, 'retry_pending'); assert.equal(attestation.args.reason, 'credential_refresh_required');
  const response = await h.handler('account-deletion-status')(post({ receiptSecret }));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body.request.provider_actions, [{ provider: 'google', status: 'pending', reason: 'credential_refresh_required' }]);
  assert.equal(JSON.stringify(body).includes('synthetic-google-access'), false);
  // An active lease prevents this status read from scheduling a second worker.
  assert.equal(h.pending.length, 0);
});

test('owner-scoped automation RPC binds verified UUID, and an empty/unrelated allowlist cannot activate account deletion', async () => {
  for (const allowedOwners of [[], ['81e0ff16-e219-43f2-b87b-000000000999']]) {
    const h = harness(['google'], { tokens: [google()], allowedOwners });
    const account = h.handler('account-deletion');
    const get = new Request('https://fixture.invalid', { headers: { Authorization: 'Bearer synthetic-owner-session' } });
    const response = await account(get); assert.equal(response.status, 200);
    assert.equal((await response.json()).capabilities.automaticProcessing, false);
    assert.deepEqual(h.rpcCalls.find(call => call.name === 'stride_deletion_automation_enabled')!.args, { owner_id: owner });
    for (const refreshProviderCredentials of [false, true]) {
      const request = post({ confirmation: 'DELETE MY STRIDEOS ACCOUNT', receiptSecret,
        userId: allowedOwners[0] ?? owner, capabilities: { automaticProcessing: true },
        refreshProviderCredentials, providerTokens: { google: 'synthetic-fresh-access' } });
      request.headers.set('Authorization', 'Bearer synthetic-owner-session');
      assert.equal((await account(request)).status, 503);
    }
    assert.equal(h.events.includes('rpc:start_stride_deletion'), false);
    assert.equal(h.events.includes('rpc:refresh_stride_deletion_provider_tokens'), false);
    assert.equal(h.pending.length, 0); h.noRemoval();
    assert.equal(h.rpcCalls.some(call => call.name === 'configure_stride_deletion_automation'), false);
  }
});

test('fixture eligibility gates direct start/refresh/claim and both worker and receipt-based queue recovery', async () => {
  const h = harness([], { allowedOwners: [] });
  assert.equal(await h.runtime.deletionDependencies.automationEnabled(owner), false);
  await assert.rejects(h.runtime.deletionDependencies.start(owner, 'a'.repeat(64), []));
  await assert.rejects(h.runtime.deletionDependencies.refresh(owner, 'a'.repeat(64), []));
  await assert.rejects(h.runtime.processDeletionRequest(requestId));
  await assert.rejects(h.runtime.deletionDependencies.enqueue(requestId));
  assert.equal(h.pending.length, 0); h.noRemoval();

  const issued = harness(); const ticket = await issued.ticket(); issued.state.allowedOwners.clear();
  assert.equal((await issued.handler('account-deletion-worker')(post({ requestId, jobTicket: ticket }))).status, 401);
  assert.equal(issued.state.tickets.get(ticket)!.consumed, false);
  assert.equal((await issued.handler('account-deletion-status')(post({ receiptSecret }))).status, 200);
  assert.equal(issued.pending.length, 0); issued.noRemoval();
});

test('GET credential-refresh preflight trusts only the verified-owner RPC boolean, blocks active leases, and leaks no private fields', async () => {
  const h = harness(['apple'], { tokens: [apple()] });
  h.state.plan.status = 'processing'; h.state.leaseExpires = 15 * 60_000;
  const account = h.handler('account-deletion');
  const get = () => new Request(`https://fixture.invalid?owner_id=${requestId}&providerCredentialRefreshReady=true`, {
    headers: { Authorization: 'Bearer synthetic-owner-session', 'x-owner-id': requestId },
  });
  const active = await account(get()); assert.equal(active.status, 200);
  assert.equal((await active.json()).capabilities.providerCredentialRefreshReady, false);
  assert.deepEqual(h.rpcCalls.find(call => call.name === 'read_stride_deletion_owned_status')!.args, { owner_id: owner });

  h.state.now = h.state.leaseExpires;
  const expired = await account(get()); assert.equal(expired.status, 200);
  assert.equal((await expired.json()).capabilities.providerCredentialRefreshReady, true);

  for (const ready of [false, 'true', 1, null, undefined, true]) {
    h.state.rpcOverride = name => name === 'read_stride_deletion_owned_status' ? { data: {
      id: requestId, requested_at: '2026-11-01T06:00:00Z', status: 'processing',
      provider_actions: [{ provider: 'apple', status: 'pending', reason: 'credential_refresh_required' }],
      provider_credential_refresh_ready: ready, user_id: owner, receipt_hash: 'synthetic-private-hash',
      processing_token: 'synthetic-private-lease', provider_token: 'synthetic-private-provider-token',
    }, error: null } : undefined;
    const response = await account(get()); assert.equal(response.status, 200);
    const text = await response.text(); const body = JSON.parse(text);
    assert.equal(body.capabilities.providerCredentialRefreshReady, ready === true);
    assert.deepEqual(body.request.provider_actions, [{ provider: 'apple', status: 'pending', reason: 'credential_refresh_required' }]);
    for (const value of [owner, 'synthetic-private-hash', 'synthetic-private-lease', 'synthetic-private-provider-token',
      'provider_credential_refresh_ready', 'processing_token', 'receipt_hash', 'user_id']) assert.equal(text.includes(value), false);
  }
  assert.ok(h.rpcCalls.filter(call => call.name === 'read_stride_deletion_owned_status').every(call => call.args.owner_id === owner));
  assert.equal(h.pending.length, 0); h.noRemoval();
});
