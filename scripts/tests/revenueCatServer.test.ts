import assert from 'node:assert/strict';
import test from 'node:test';
import { createRevenueCatProVerifier, REVENUECAT_PROJECT_ID, REVENUECAT_PRO_ID } from '../../supabase/functions/_shared/revenueCatAccess';
import { createCoachHandler } from '../../supabase/functions/_shared/launchHandlers';

const owner = '12345678-1234-4234-8234-123456789abc';
const now = Date.parse('2026-10-31T12:00:00Z');
const pro = (expires_at: unknown = now + 60_000) => ({ object: 'customer.active_entitlement', entitlement_id: REVENUECAT_PRO_ID, expires_at });
const list = (items: unknown[] = [pro()], next_page: unknown = null) => ({ object: 'list', items, next_page });
const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });
const verifier = (fetcher: typeof fetch) => createRevenueCatProVerifier({ enabled: () => true, apiKey: () => 'sk_test_fixture', now: () => now, fetch: fetcher });

test('disabled billing does not read a key or contact RevenueCat', async () => {
  const check = createRevenueCatProVerifier({ enabled: () => false, apiKey: () => { throw Error('unexpected'); }, fetch: async () => { throw Error('unexpected'); } });
  assert.equal(await check(owner), true);
});
test('server uses verified owner, exact project and GET-only scoped V2 endpoint without redirects', async () => {
  let calls = 0;
  const check = verifier(async (url, options) => {
    calls++;
    assert.equal(String(url), `https://api.revenuecat.com/v2/projects/${REVENUECAT_PROJECT_ID}/customers/${owner}/active_entitlements?limit=100`);
    assert.equal(options?.method, 'GET'); assert.equal(options?.redirect, 'error');
    assert.equal(new Headers(options?.headers).get('Authorization'), 'Bearer sk_test_fixture');
    assert.ok(options?.signal instanceof AbortSignal); assert.equal(options?.body, undefined);
    return json(list());
  });
  assert.equal(await check(owner), true); assert.equal(calls, 1);
});
test('missing/public keys and non-UUID identities fail before a network request', async () => {
  let calls = 0;
  for (const key of [undefined, '', 'appl_public_fixture']) {
    await assert.rejects(createRevenueCatProVerifier({ enabled: () => true, apiKey: () => key, fetch: async () => { calls++; return json(list()); } })(owner));
  }
  await assert.rejects(verifier(async () => { calls++; return json(list()); })('../other-owner'));
  assert.equal(calls, 0);
});
test('no Pro, expired access and null lifetime access do not grant a subscription', async () => {
  for (const body of [list([]), list([pro(now)]), list([pro(now - 1)]), list([pro(null)]),
    list([{ ...pro(), entitlement_id: 'entl_other_project' }])]) {
    assert.equal(await verifier(async () => json(body))(owner), false);
  }
});
test('malformed, oversized and incomplete entitlement responses are unavailable, never an access grant', async () => {
  for (const body of [null, {}, { items: [pro()] }, list([{}]), list([pro('2027-01-01')]),
    list([pro(Number.MAX_SAFE_INTEGER + 1)]), { object: 'list', items: [] },
    { ...list(), next_page: 7 }, list(Array.from({ length: 101 }, () => pro()))]) {
    await assert.rejects(verifier(async () => json(body))(owner));
  }
  await assert.rejects(verifier(async () => new Response('x'.repeat(65_537)))(owner));
  await assert.rejects(verifier(async () => new Response('{bad json'))(owner));
});
test('partial answers never follow arbitrary next-page URLs with the secret', async () => {
  let calls = 0;
  const check = verifier(async () => { calls++; return json(list([], 'https://attacker.invalid/collect')); });
  await assert.rejects(check(owner)); assert.equal(calls, 1);
});
test('RevenueCat HTTP failures and network errors are sanitized and never retried', async () => {
  for (const status of [301, 401, 403, 404, 423, 429, 500, 503]) {
    let calls = 0;
    await assert.rejects(verifier(async () => { calls++; return new Response('private provider data', { status }); })(owner), /Subscription verification unavailable/);
    assert.equal(calls, 1);
  }
  await assert.rejects(verifier(async () => { throw Error('sk_private network data'); })(owner), { message: 'Subscription verification unavailable' });
});
test('real handler rejects bad verification before consuming AI allowance or contacting the AI provider', async () => {
  let reserved = 0; let replied = 0;
  const deps = { authenticate: async () => owner, configured: () => true,
    consumeAllowance: async () => { reserved++; return true; },
    reply: async () => { replied++; return { content: [{ type: 'text' as const, text: 'Advice' }] }; } };
  const request = () => new Request('https://example.invalid/coach', { method: 'POST', body: JSON.stringify({ consentVersion: 1, system: 'Synthetic context', messages: [{ role: 'user', content: 'Easy run?' }] }) });
  assert.equal((await createCoachHandler({ ...deps, canUsePlan: verifier(async () => json(list([]))) })(request())).status, 402);
  const unavailable = await createCoachHandler({ ...deps, canUsePlan: verifier(async () => new Response('sk_private', { status: 403 })) })(request());
  assert.equal(unavailable.status, 503); assert.ok(!(await unavailable.text()).includes('sk_private'));
  assert.equal(reserved, 0); assert.equal(replied, 0);
  assert.equal((await createCoachHandler({ ...deps, canUsePlan: verifier(async () => json(list())) })(request())).status, 200);
  assert.equal(reserved, 1); assert.equal(replied, 1);
});

test('synthetic trial/grace access is governed by provider-active future expiry; cancellation is not inferred from products', async () => {
  // These payloads exercise parser policy, not real StoreKit lifecycle events.
  const fixtures = [
    { label: 'provider still lists access during trial', expiresAt: now + 7 * 86_400_000, expected: true },
    { label: 'provider still lists access after auto-renew cancellation', expiresAt: now + 60_000, expected: true },
    { label: 'provider still lists grace access', expiresAt: now + 300_000, expected: true },
    { label: 'provider no longer lists access after refund/revocation', expiresAt: null, expected: false },
  ];
  for (const fixture of fixtures) {
    const body = fixture.expiresAt === null ? list([]) : list([pro(fixture.expiresAt)]);
    assert.equal(await verifier(async () => json(body))(owner), fixture.expected, fixture.label);
  }
});

test('positive pagination stays on the fixed first page, but malformed trailing data still fails closed', async () => {
  let calls = 0;
  assert.equal(await verifier(async () => { calls++; return json(list([pro()], 'https://attacker.invalid/private')); })(owner), true);
  assert.equal(calls, 1);
  await assert.rejects(verifier(async () => json(list([pro(), {}])))(owner), /Subscription verification unavailable/);
  await assert.rejects(verifier(async () => json(list([pro()], {})))(owner), /Subscription verification unavailable/);
});

test('provider timeout, abort and invalid UTF-8 are unavailable without exposing provider details', async () => {
  for (const error of [new DOMException('synthetic_private_timeout', 'TimeoutError'),
    new DOMException('synthetic_private_abort', 'AbortError')]) {
    let calls = 0;
    await assert.rejects(verifier(async () => { calls++; throw error; })(owner), { message: 'Subscription verification unavailable' });
    assert.equal(calls, 1);
  }
  await assert.rejects(verifier(async () => new Response(new Uint8Array([0xff, 0xfe])))(owner), { message: 'Subscription verification unavailable' });
});

test('missing/invalid authentication, OPTIONS, GET and invalid POST never exercise entitlement, quota, or AI', async () => {
  let checks = 0, reservations = 0, replies = 0;
  const make = (authenticated: boolean) => createCoachHandler({ authenticate: async () => authenticated ? owner : null,
    configured: () => true, canUsePlan: async () => { checks++; throw new Error('unexpected verification'); },
    consumeAllowance: async () => { reservations++; return true; }, reply: async () => { replies++; return { content: [] }; } });
  const requests = [
    { auth: false, method: 'GET', status: 401 }, { auth: false, method: 'POST', status: 401 },
    { auth: true, method: 'GET', status: 200 }, { auth: false, method: 'OPTIONS', status: 200 },
    { auth: true, method: 'POST', status: 400 },
  ];
  for (const row of requests) {
    assert.equal((await make(row.auth)(new Request('https://example.invalid/coach', {
      method: row.method, ...(row.method === 'POST' ? { body: '{}' } : {}),
    }))).status, row.status);
  }
  assert.equal(checks, 0); assert.equal(reservations, 0); assert.equal(replies, 0);
});

test('server verifies the authenticated owner, ignores body identity/Pro claims, and reserves only after success', async () => {
  const order: string[] = [];
  const handler = createCoachHandler({ authenticate: async () => owner, configured: () => true,
    canUsePlan: async id => { assert.equal(id, owner); order.push('verified-owner-lookup'); return true; },
    consumeAllowance: async id => { assert.equal(id, owner); order.push('allowance'); return false; },
    reply: async () => { order.push('ai'); return { content: [] }; } });
  const response = await handler(new Request('https://example.invalid/coach', { method: 'POST', body: JSON.stringify({
    consentVersion: 1, system: 'Synthetic context', messages: [{ role: 'user', content: 'Easy run?' }],
    userId: 'other-owner', ownerUserId: 'other-owner', isPro: true, entitlement: 'pro',
  }) }));
  assert.equal(response.status, 429);
  assert.deepEqual(order, ['verified-owner-lookup', 'allowance']);
});
