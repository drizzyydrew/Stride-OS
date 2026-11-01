import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import { createRevenueCatBillingPolicy, REVENUECAT_PROJECT_ID, REVENUECAT_PRO_ID } from '../../supabase/functions/_shared/revenueCatAccess';

const owner = '12345678-1234-4234-8234-123456789abc';
const other = '87654321-4321-4321-8321-cba987654321';
const list = (active: boolean) => ({ object: 'list', next_page: null, items: active ? [{
  object: 'customer.active_entitlement', entitlement_id: REVENUECAT_PRO_ID, expires_at: Date.now() + 86_400_000,
}] : [] });
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const files = [
  'supabase/functions/ai-coach/index.ts', 'supabase/functions/_shared/revenueCatAccess.ts',
  'supabase/functions/_shared/launchHandlers.ts',
];
const sources = new Map(files.map(file => [resolve(file), readFileSync(file, 'utf8')]));

// Execute the actual entrypoint and shared modules; only Deno/Supabase/network
// boundaries are mocked. No process.env, real keys, customers or network access.
function harness(options: {
  qaOwner?: string; global?: string; userId?: string; authError?: boolean;
  providerStatus?: number; active?: boolean; networkFailure?: boolean; configured?: boolean;
} = {}) {
  const env: Record<string, string | undefined> = {
    SUPABASE_URL: 'https://fixture.invalid', SUPABASE_SERVICE_ROLE_KEY: 'synthetic-service-key',
    ANTHROPIC_API_KEY: options.configured === false ? undefined : 'synthetic-ai-key',
    REVENUECAT_SECRET_API_KEY: 'sk_synthetic_private_fixture',
    STRIDEOS_BILLING_ENABLED: options.global, STRIDEOS_BILLING_QA_OWNER_ID: options.qaOwner,
  };
  const reads: string[] = [], events: string[] = [];
  const rpcCalls: { name: string; args: unknown }[] = [];
  let handler: ((request: Request) => Promise<Response>) | undefined;
  const cache = new Map<string, { exports: any }>();
  const admin = {
    auth: { getUser: async (token: string) => {
      assert.equal(token, 'synthetic-session'); events.push('auth');
      return options.authError ? { data: { user: null }, error: { message: 'private auth failure' } }
        : { data: { user: { id: options.userId ?? owner } }, error: null };
    } },
    rpc: async (name: string, args: unknown) => {
      events.push('quota'); rpcCalls.push({ name, args: JSON.parse(JSON.stringify(args)) }); return { data: true, error: null };
    },
  };
  const context = vm.createContext({
    Request, Response, Headers, TextDecoder, AbortController, AbortSignal, setTimeout, clearTimeout,
    Deno: {
      env: { get: (name: string) => { reads.push(name); return env[name]; } },
      serve: (value: typeof handler) => { assert.equal(handler, undefined); handler = value; },
    },
    fetch: async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith('https://api.revenuecat.com/')) {
        events.push('revenuecat');
        assert.equal(url, `https://api.revenuecat.com/v2/projects/${REVENUECAT_PROJECT_ID}/customers/${options.userId ?? owner}/active_entitlements?limit=100`);
        assert.equal(init?.method, 'GET'); assert.equal(init?.body, undefined); assert.equal(init?.redirect, 'error');
        assert.equal(new Headers(init?.headers).get('Authorization'), 'Bearer sk_synthetic_private_fixture');
        if (options.networkFailure) throw new Error('sk_synthetic_private_fixture');
        return json(list(options.active ?? true), options.providerStatus ?? 200);
      }
      assert.equal(url, 'https://api.anthropic.com/v1/messages');
      events.push('ai'); return json({ content: [{ type: 'text', text: 'Synthetic reply' }] });
    },
  });
  function load(file: string): any {
    const absolute = resolve(file);
    if (cache.has(absolute)) return cache.get(absolute)!.exports;
    const source = sources.get(absolute);
    assert.ok(source !== undefined, `Unexpected module ${absolute}`);
    const module = { exports: {} }; cache.set(absolute, module);
    const code = ts.transpileModule(source, { compilerOptions: {
      target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
    } }).outputText;
    const requireMock = (specifier: string) => {
      if (specifier === 'https://esm.sh/@supabase/supabase-js@2.48.0') return { createClient: (
        url: string, key: string, config: unknown,
      ) => {
        assert.equal(url, 'https://fixture.invalid'); assert.equal(key, 'synthetic-service-key');
        assert.equal(JSON.stringify(config), JSON.stringify({ auth: { persistSession: false, autoRefreshToken: false } }));
        return admin;
      } };
      assert.ok(specifier.startsWith('.'), `Unexpected dependency ${specifier}`);
      return load(resolve(dirname(absolute), specifier));
    };
    const execute = new vm.Script(`(function(require,module,exports){${code}\n})`, { filename: absolute })
      .runInContext(context, { timeout: 1000 });
    execute(requireMock, module, module.exports);
    return module.exports;
  }
  load(files[0]!); assert.ok(handler);
  const request = (method = 'POST', authenticated = true, extra: Record<string, unknown> = {}) => handler!(new Request('https://fixture.invalid/coach', {
    method, headers: authenticated ? { Authorization: 'Bearer synthetic-session' } : {},
    ...(method === 'POST' ? { body: JSON.stringify({ consentVersion: 1, system: 'Synthetic context',
      messages: [{ role: 'user', content: 'Easy run?' }], ...extra }) } : {}),
  }));
  return { request, reads, events, rpcCalls };
}

test('QA policy accepts exactly one nonzero UUID and snapshots configuration', () => {
  for (const qaOwnerId of [undefined, '', '*', 'all', '00000000-0000-0000-0000-000000000000',
    `${owner},${other}`, `${owner} ${other}`, JSON.stringify([owner]), ` ${owner}`, `${owner}\n`, `${owner}x`]) {
    const policy = createRevenueCatBillingPolicy({ globalEnabled: undefined, qaOwnerId });
    assert.equal(policy.enabled(owner), false); assert.equal(policy.isQaOwner(owner), false);
  }
  const config = { globalEnabled: 'false', qaOwnerId: owner.toUpperCase() };
  const policy = createRevenueCatBillingPolicy(config);
  config.globalEnabled = 'true'; config.qaOwnerId = other;
  assert.equal(policy.enabled(owner), true); assert.equal(policy.isQaOwner(owner), true);
  assert.equal(policy.enabled(other), false); assert.equal(policy.isQaOwner(other), false);
  assert.equal(policy.isQaOwner(`${owner}\n`), false);
});

test('global flag remains explicit and independent of the QA owner guard', () => {
  for (const globalEnabled of [undefined, '', 'false', 'TRUE', '1', 'true ']) {
    assert.equal(createRevenueCatBillingPolicy({ globalEnabled, qaOwnerId: undefined }).enabled(owner), false);
  }
  const policy = createRevenueCatBillingPolicy({ globalEnabled: 'true', qaOwnerId: owner });
  assert.equal(policy.enabled(other), true); assert.equal(policy.isQaOwner(other), false);
});

for (const row of [
  { name: 'inactive entitlement', active: false, status: 402 },
  { name: 'active entitlement', active: true, status: 429 },
  { name: 'provider HTTP failure', providerStatus: 403, status: 503 },
  { name: 'unregistered customer', providerStatus: 404, status: 503 },
  { name: 'provider network failure', networkFailure: true, status: 503 },
]) {
  test(`actual factory QA ${row.name}: ${row.status}, no quota RPC or AI`, async () => {
    const fixture = harness({ qaOwner: owner, global: 'false', ...row });
    const response = await fixture.request();
    assert.equal(response.status, row.status);
    assert.deepEqual(fixture.events, ['auth', 'revenuecat']); assert.deepEqual(fixture.rpcCalls, []);
    const body = await response.json();
    assert.deepEqual(Object.keys(body), ['error']);
    const receipt = JSON.stringify(body);
    for (const privateValue of ['sk_synthetic_private_fixture', owner, REVENUECAT_PRO_ID, 'expires_at']) {
      assert.ok(!receipt.includes(privateValue));
    }
    assert.equal(fixture.reads.filter(name => name === 'REVENUECAT_SECRET_API_KEY').length, 1);
  });
}

test('QA no-quota guard survives global billing enabled', async () => {
  const fixture = harness({ qaOwner: owner, global: 'true' });
  assert.equal((await fixture.request()).status, 429);
  assert.deepEqual(fixture.events, ['auth', 'revenuecat']); assert.deepEqual(fixture.rpcCalls, []);
});

test('body identity and entitlement claims cannot select QA or replace verified owner', async () => {
  const fixture = harness({ qaOwner: owner, active: false });
  assert.equal((await fixture.request('POST', true, { userId: other, ownerUserId: other, isPro: true })).status, 402);
  assert.deepEqual(fixture.events, ['auth', 'revenuecat']); assert.deepEqual(fixture.rpcCalls, []);
});

test('unset QA and another owner preserve existing off/default behavior without reading RevenueCat key', async () => {
  for (const options of [{}, { qaOwner: owner, userId: other }]) {
    const fixture = harness(options);
    assert.equal((await fixture.request('POST', true, { ownerUserId: owner, isPro: true })).status, 200);
    assert.deepEqual(fixture.events, ['auth', 'quota', 'ai']);
    assert.deepEqual(fixture.rpcCalls, [{ name: 'consume_stride_coach_allowance', args: { owner_id: options.userId ?? owner } }]);
    assert.ok(!fixture.reads.includes('REVENUECAT_SECRET_API_KEY'));
  }
});

test('global enabled still verifies non-QA owners through existing quota and AI bindings', async () => {
  const fixture = harness({ qaOwner: owner, userId: other, global: 'true' });
  assert.equal((await fixture.request()).status, 200);
  assert.deepEqual(fixture.events, ['auth', 'revenuecat', 'quota', 'ai']);
});

test('authentication, GET, preflight, invalid input and unavailable configuration never run QA verification or writes', async () => {
  for (const row of [
    { method: 'POST', authenticated: false, status: 401, events: [] },
    { method: 'POST', authError: true, status: 401, events: ['auth'] },
    { method: 'OPTIONS', status: 200, events: [] },
    { method: 'GET', status: 200, events: ['auth'] },
    { method: 'POST', extra: { consentVersion: 0 }, status: 400, events: ['auth'] },
    { method: 'POST', configured: false, status: 503, events: ['auth'] },
  ]) {
    const fixture = harness({ qaOwner: owner, ...row });
    assert.equal((await fixture.request(row.method, row.authenticated ?? true, row.extra)).status, row.status);
    assert.deepEqual(fixture.events, row.events); assert.deepEqual(fixture.rpcCalls, []);
    assert.ok(!fixture.reads.includes('REVENUECAT_SECRET_API_KEY'));
  }
});
