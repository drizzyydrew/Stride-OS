import assert from 'node:assert/strict';
import test from 'node:test';
import { REVENUECAT_COACH_PROBE_URL, runRevenueCatProbeCli, verifyRevenueCatServerBoundary } from '../verify-revenuecat-server';

const preflight = (headers: Record<string, string> = {}) => new Response('ok', { headers: {
  'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', ...headers,
} });

test('probe is fixed-host GET/OPTIONS only, credential-free and explicitly cannot accept paid lifecycle', async () => {
  const methods: string[] = [];
  const receipt = await verifyRevenueCatServerBoundary({ now: () => new Date('2026-10-31T00:00:00Z'), fetch: async (url, options) => {
    assert.equal(String(url), REVENUECAT_COACH_PROBE_URL);
    assert.equal(new URL(String(url)).hostname, 'pbzgrhnxpbtlkzpreizy.supabase.co');
    assert.equal(options?.redirect, 'error'); assert.equal(options?.credentials, 'omit');
    assert.equal(options?.body, undefined); assert.ok(options?.signal instanceof AbortSignal);
    const headers = new Headers(options?.headers);
    assert.equal(headers.get('authorization'), null); assert.equal(headers.get('apikey'), null);
    methods.push(options!.method!);
    return options?.method === 'GET' ? new Response('private gateway body', { status: 401 }) : preflight();
  } });
  assert.deepEqual(methods, ['GET', 'OPTIONS']); assert.equal(receipt.passed, true);
  assert.equal(receipt.testedAt, '2026-10-31T00:00:00.000Z');
  assert.equal(receipt.authenticatedRevenueCatLookupVerified, false);
  assert.equal(receipt.purchaseLifecycleVerified, false);
  assert.ok(!JSON.stringify(receipt).includes('private gateway body'));
});

test('unexpected public success, authorization status or broken CORS never passes', async () => {
  for (const status of [200, 302, 403, 404, 500, 503]) {
    const receipt = await verifyRevenueCatServerBoundary({ fetch: async (_url, options) =>
      options?.method === 'GET' ? new Response(null, { status }) : preflight() });
    assert.equal(receipt.passed, false); assert.equal(receipt.checks[0].httpStatus, status);
  }
  const invalidCors: Record<string, string>[] = [{ 'Access-Control-Allow-Origin': 'https://other.invalid' },
    { 'Access-Control-Allow-Methods': 'GET' }, { 'Access-Control-Allow-Headers': 'content-type' }];
  for (const headers of invalidCors) {
    const receipt = await verifyRevenueCatServerBoundary({ fetch: async (_url, options) =>
      options?.method === 'GET' ? new Response(null, { status: 401 }) : preflight(headers) });
    assert.equal(receipt.passed, false); assert.equal(receipt.checks[1].passed, false);
  }
});

test('network errors, timeouts and redirects are sanitized with exactly one attempt per method', async () => {
  let calls = 0;
  const receipt = await verifyRevenueCatServerBoundary({ fetch: async () => {
    calls++; throw new Error('synthetic_private_bearer_or_redirect');
  } });
  assert.equal(calls, 2); assert.equal(receipt.passed, false);
  assert.ok(receipt.checks.every(check => check.httpStatus === null));
  assert.ok(!JSON.stringify(receipt).includes('synthetic_private'));
});

test('CLI defaults/help/unknown args do not send requests or echo private command arguments', async () => {
  for (const args of [[], ['--help'], ['--secret', 'synthetic_private'], ['--live', '--endpoint=https://other.invalid']]) {
    const lines: string[] = []; let calls = 0;
    const code = await runRevenueCatProbeCli(args, { write: line => lines.push(line), fetch: async () => { calls++; throw Error('unexpected'); } });
    assert.equal(calls, 0); assert.ok(!lines.join('\n').includes('synthetic_private'));
    assert.equal(code, args.length === 0 || args[0] === '--help' ? 0 : 2);
  }
});

test('explicit live CLI reports safe JSON and returns nonzero on a failed boundary', async () => {
  for (const status of [401, 200]) {
    const lines: string[] = [];
    const code = await runRevenueCatProbeCli(['--live'], { write: line => lines.push(line), fetch: async (_url, options) =>
      options?.method === 'GET' ? new Response('synthetic_private_body', { status }) : preflight() });
    assert.equal(code, status === 401 ? 0 : 1);
    assert.equal(JSON.parse(lines[0]).passed, status === 401);
    assert.ok(!lines[0].includes('synthetic_private_body'));
  }
});
