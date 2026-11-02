import assert from 'node:assert/strict';
import test from 'node:test';
import { prepareLaunchSession, runPreparationCli, PUBLIC_PAGES } from '../prepare-launch-session';
import { REVENUECAT_COACH_PROBE_URL } from '../verify-revenuecat-server';

function fixture(override: Record<string, unknown> = {}) {
  const docs: Record<string, unknown> = {
    'app.json': { expo: { ios: { buildNumber: '109' } } },
    'eas.json': { build: { production: { env: { EXPO_PUBLIC_STRIDEOS_BILLING_ENABLED: 'false' } } } },
    'docs/handoff/BUILD109_ARTIFACT_VERIFICATION.json': {
      buildId: 'eefedb6a-dee7-433a-a1fd-1bf8eb9ab5c3', compiled1024IconOpaque: true,
      privacyManifestsParsed: 21, noCredentialFilenamesInArchive: true,
      targets: ['com.mooremovement.strideos', 'com.mooremovement.strideos.watch', 'com.mooremovement.strideos.liveactivity']
        .map(bundle => ({ bundle, build: '109', signatureValid: true, debugSigning: false })),
    },
    'docs/handoff/BUILD109_APPLE_ACCEPTANCE.json': { testFlight: {
      buildNumber: '109', easBuildId: 'eefedb6a-dee7-433a-a1fd-1bf8eb9ab5c3',
      processingState: 'VALID', internalState: 'IN_BETA_TESTING', expired: false,
    } }, ...override,
  };
  return (path: string) => { assert.ok(path in docs); return JSON.stringify(docs[path]); };
}

test('offline preparation reads only named candidate receipts and cannot approve human acceptance', async () => {
  const r = await prepareLaunchSession(false, { read: fixture(), fetch: async () => { throw Error('Network forbidden'); } });
  assert.equal(r.preparationChecksPassed, true); assert.equal(r.livePublicChecksRun, false);
  assert.equal(r.publicLaunchReady, false); assert.equal(r.humanGates.length, 7);
  assert.ok(r.humanGates.every(g => g.status === 'NOT_ACCEPTED_BY_THIS_TOOL'));
});

test('a private QA build cannot be mistaken for canonical production-109 preparation', async () => {
  const r = await prepareLaunchSession(false, { read: fixture({ 'app.json': { expo: { ios: { buildNumber: '110' } } } }) });
  assert.equal(r.preparationChecksPassed, false);
  assert.equal(r.checks.find(c => c.name === 'canonical_production_still_109_billing_off')?.passed, false);
});

test('live preparation sends only the six fixed public requests, with no credentials, POSTs or bodies', async () => {
  const seen: string[] = [];
  const r = await prepareLaunchSession(true, { read: fixture(), fetch: async (url, options) => {
    const address = String(url); seen.push(`${options?.method} ${address}`);
    assert.ok([REVENUECAT_COACH_PROBE_URL, ...PUBLIC_PAGES].includes(address));
    assert.ok(['GET', 'OPTIONS'].includes(options?.method ?? ''));
    assert.equal(options?.body, undefined); assert.equal(options?.credentials, 'omit');
    assert.equal(options?.redirect, 'error'); assert.equal(new Headers(options?.headers).has('Authorization'), false);
    assert.equal(new Headers(options?.headers).has('apikey'), false);
    if (options?.method === 'OPTIONS') return new Response('private response discarded', { headers: {
      'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, POST, OPTIONS',
      'access-control-allow-headers': 'authorization,content-type',
    } });
    return new Response('private response discarded', { status: address === REVENUECAT_COACH_PROBE_URL ? 401 : 200 });
  } });
  assert.equal(seen.length, 6); assert.equal(r.preparationChecksPassed, true);
  assert.equal(r.publicLaunchReady, false); assert.ok(!JSON.stringify(r).includes('private response'));
});

test('network, HTTP and malformed-receipt failures are reported without raw private diagnostics', async () => {
  const r = await prepareLaunchSession(true, { read: () => { throw Error('private read detail'); },
    fetch: async url => { if (String(url).endsWith('support.html')) return new Response('', { status: 503 });
      throw Error('private network detail'); } });
  assert.equal(r.preparationChecksPassed, false);
  assert.ok(r.checks.some(c => c.httpStatus === 503)); assert.ok(!JSON.stringify(r).includes('private'));
});

test('help and unknown arguments cannot read files, send requests or echo a mistakenly pasted secret', async () => {
  for (const args of [['--help'], ['--secret', 'private_credential'], ['--live', '--help']]) {
    const output: string[] = [];
    const code = await runPreparationCli(args, { read: () => { throw Error('Unexpected read'); },
      fetch: async () => { throw Error('Unexpected request'); }, write: s => output.push(s) });
    assert.equal(code, args[0] === '--help' ? 0 : 2);
    assert.ok(!output.join('\n').includes('private_credential'));
  }
});
