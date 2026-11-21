import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { createCoachProviderOrganizationProbe } from '../../supabase/functions/_shared/coachProviderOrganizationProbe';

const service = 'synthetic-service-role-key';
const serviceHash = createHash('sha256').update(service).digest('hex');
const provider = 'synthetic-private-provider-key';
const org = '12345678-1234-4234-8234-123456789abc';
const request = (token: string | null = service, method = 'GET') => new Request('https://fixture.invalid/diagnostic?owner=ignored', {
  method, headers: token ? { Authorization: `Bearer ${token}` } : {},
});
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });

test('service-key exact match alone authorizes fixed GET metadata without Auth/database/model calls', async () => {
  let calls = 0;
  const handler = createCoachProviderOrganizationProbe({ serviceRoleKeySha256: serviceHash, providerKey: provider,
    fetch: async (url, options) => {
      calls++; assert.equal(url, 'https://api.anthropic.com/v1/organizations/me');
      assert.equal(options?.method, 'GET'); assert.equal(options?.redirect, 'error'); assert.equal(options?.body, undefined);
      assert.ok(options?.signal instanceof AbortSignal); assert.equal(options.signal.aborted, false);
      const headers = new Headers(options.headers);
      assert.equal(headers.get('authorization'), `Bearer ${provider}`);
      assert.equal(headers.get('anthropic-version'), '2026-10-21');
      return json({ type: 'organization', id: org, name: 'private account name', key: provider,
        user_metadata: { role: 'service_role' } });
    } });
  const response = await handler(request());
  assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await response.json(), { providerHttpStatus: 200, organizationId: org });
  assert.equal(calls, 1);
});

test('ordinary JWTs, client claims, partial keys, missing keys and differing exact bytes never reach provider', async () => {
  let calls = 0;
  const handler = createCoachProviderOrganizationProbe({ serviceRoleKeySha256: serviceHash, providerKey: provider,
    fetch: async () => { calls++; assert.fail('Unauthorized provider call'); } });
  for (const token of [null, '', 'synthetic-user-jwt', 'synthetic-anon-key', serviceHash,
    service.slice(1), service + 'x', service.toUpperCase(), 'x' + service.slice(1),
    JSON.stringify({ role: 'service_role', user_metadata: { role: 'service_role' } })]) {
    const response = await handler(request(token)); assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { providerHttpStatus: null, organizationId: null });
  }
  assert.equal(calls, 0);
  const absent = createCoachProviderOrganizationProbe({ serviceRoleKeySha256: undefined, providerKey: provider,
    fetch: async () => { calls++; assert.fail('Unconfigured authorization contacted provider'); } });
  assert.equal((await absent(request())).status, 401); assert.equal(calls, 0);
});

test('all non-GET methods including OPTIONS fail without reading provider configuration or making calls', async () => {
  const handler = createCoachProviderOrganizationProbe({ serviceRoleKeySha256: serviceHash, providerKey: provider,
    fetch: async () => { assert.fail('Non-GET contacted provider'); } });
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']) {
    const response = await handler(request(service, method)); assert.equal(response.status, 405);
  }
});

test('missing provider configuration fails closed after valid service authorization without exposing keys', async () => {
  const handler = createCoachProviderOrganizationProbe({ serviceRoleKeySha256: serviceHash, providerKey: undefined,
    fetch: async () => { assert.fail('Unconfigured provider call'); } });
  const response = await handler(request()); assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { providerHttpStatus: null, organizationId: null });
});

test('HTTP failures, redirects and thrown network/timeout errors expose status only, do not retry or follow URLs', async () => {
  for (const status of [301, 302, 400, 401, 403, 429, 500, 503]) {
    let calls = 0;
    const handler = createCoachProviderOrganizationProbe({ serviceRoleKeySha256: serviceHash, providerKey: provider,
      fetch: async () => { calls++; return new Response(provider + service + 'private account name',
        { status, headers: { Location: 'https://attacker.invalid/collect' } }); } });
    const response = await handler(request()); assert.equal(response.status, 502);
    assert.deepEqual(await response.json(), { providerHttpStatus: status, organizationId: null });
    assert.equal(calls, 1);
  }
  for (const failure of [new Error(provider + service), new DOMException(provider, 'TimeoutError')]) {
    let calls = 0;
    const handler = createCoachProviderOrganizationProbe({ serviceRoleKeySha256: serviceHash, providerKey: provider,
      fetch: async () => { calls++; throw failure; } });
    const response = await handler(request()); assert.equal(response.status, 502);
    assert.deepEqual(await response.json(), { providerHttpStatus: null, organizationId: null });
    assert.equal(calls, 1);
  }
});

test('malformed, oversized, invalid UTF-8 and non-UUID responses cannot echo provider data', async () => {
  for (const response of [json(null), json([]), json({ type: 'wrong', id: org }),
    json({ type: 'organization', id: provider }), json({ type: 'organization', id: org + '\n' }),
    json({ type: 'organization', id: org, name: 'x'.repeat(17_000) }),
    new Response('invalid JSON' + provider), new Response(new Uint8Array([0xff, 0xfe]))]) {
    const handler = createCoachProviderOrganizationProbe({ serviceRoleKeySha256: serviceHash, providerKey: provider,
      fetch: async () => response });
    const result = await handler(request()); assert.equal(result.status, 502);
    assert.deepEqual(await result.json(), { providerHttpStatus: 200, organizationId: null });
  }
});

test('invalid deployment placeholders and caller-supplied expected digests cannot authorize a request', async () => {
  for (const expected of [undefined, '', '__TRUSTED_SERVICE_ROLE_SHA256__', serviceHash.toUpperCase(), '0'.repeat(64)]) {
    const handler = createCoachProviderOrganizationProbe({ serviceRoleKeySha256: expected, providerKey: provider,
      fetch: async () => { assert.fail('Client-controlled digest or unconfigured bundle contacted provider'); } });
    const response = await handler(new Request(`https://fixture.invalid/diagnostic?serviceRoleKeySha256=${serviceHash}`,
      { headers: { Authorization: `Bearer ${service}`, apikey: serviceHash } }));
    assert.equal(response.status, 401);
  }
});
