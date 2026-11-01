import assert from 'node:assert/strict';
import test from 'node:test';
import { disconnectDeletionProvider, ProviderRemovalError } from '../../supabase/functions/_shared/deletionProviders';

function setup(responses: Response[] = []) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const saved: string[] = [];
  return { calls, saved, deps: {
    fetch: (async (url, init) => { calls.push({ url: String(url), init }); const next = responses.shift(); if (!next) throw new Error('fixture transport error secret-token'); return next; }) as typeof fetch,
    verifyAppleIdentity: async () => ({ sub: 'apple-owner' }),
    saveAppleRefreshToken: async (value: string) => { saved.push(value); },
  } };
}
const json = (value: unknown) => new Response(JSON.stringify(value));
const config = { googleClientId: 'google-client', appleClientId: 'app.bundle', appleClientSecret: 'private-client-secret' };

test('missing legacy provider credentials produce honest manual guidance without network traffic', async () => {
  for (const provider of ['apple', 'google'] as const) {
    const s = setup();
    assert.deepEqual(await disconnectDeletionProvider(provider, 'owner', {}, {}, s.deps), {
      provider, status: 'manual_required', reason: 'legacy_token_unavailable',
    });
    assert.equal(s.calls.length, 0);
  }
});
test('a retained token with missing configuration remains pending instead of falling back to manual', async () => {
  for (const provider of ['apple', 'google'] as const) {
    const s = setup();
    await assert.rejects(disconnectDeletionProvider(provider, 'owner', { token: 'secret-token' }, {}, s.deps), e => e instanceof ProviderRemovalError && e.code === 'configuration');
    assert.equal(s.calls.length, 0);
  }
});
test('Google revocation verifies both owner and app audience before sending the token to the fixed revoke endpoint', async () => {
  const s = setup([json({ sub: 'google-owner', aud: 'google-client' }), new Response('')]);
  const result = await disconnectDeletionProvider('google', 'google-owner', { token: 'secret-token' }, config, s.deps);
  assert.equal(result.status, 'revoked');
  assert.equal(s.calls[1]!.url, 'https://oauth2.googleapis.com/revoke');
  assert.equal(s.calls[1]!.init!.body, 'token=secret-token');
  assert.ok(s.calls.every(call => call.init?.redirect === 'error' && call.init.signal instanceof AbortSignal));
  for (const info of [{ sub: 'other-owner', aud: 'google-client' }, { sub: 'google-owner', aud: 'other-app' }]) {
    const wrong = setup([json(info)]);
    await assert.rejects(disconnectDeletionProvider('google', 'google-owner', { token: 'secret-token' }, config, wrong.deps));
    assert.equal(wrong.calls.length, 1);
  }
});
test('Apple persists a verified refresh token before revocation so a single-use code is recoverable', async () => {
  const s = setup([json({ id_token: 'signed-id-token', refresh_token: 'verified-refresh' }), new Response('')]);
  const original = s.deps.fetch;
  s.deps.fetch = (async (url, init) => {
    if (String(url).endsWith('/revoke')) assert.deepEqual(s.saved, ['verified-refresh']);
    return original(url, init);
  }) as typeof fetch;
  assert.equal((await disconnectDeletionProvider('apple', 'apple-owner', { authorizationCode: 'one-use-code' }, config, s.deps)).status, 'revoked');
  assert.match(String(s.calls[1]!.init!.body), /token=verified-refresh/);
  assert.match(String(s.calls[1]!.init!.body), /token_type_hint=refresh_token/);
});
test('an exchanged Apple identity must be verified and match the owner before its token is saved or revoked', async () => {
  const s = setup([json({ id_token: 'wrong-token', refresh_token: 'refresh' })]);
  s.deps.verifyAppleIdentity = async () => ({ sub: 'other-owner' });
  await assert.rejects(disconnectDeletionProvider('apple', 'apple-owner', { authorizationCode: 'code' }, config, s.deps));
  assert.deepEqual(s.saved, []); assert.equal(s.calls.length, 1);
});
test('Apple refresh persistence and provider HTTP failures cannot be reported as revoked or manual fallback', async () => {
  const failedSave = setup([json({ id_token: 'id', refresh_token: 'refresh' })]);
  failedSave.deps.saveAppleRefreshToken = async () => { throw new Error('storage failed'); };
  await assert.rejects(disconnectDeletionProvider('apple', 'apple-owner', { authorizationCode: 'code' }, config, failedSave.deps));
  assert.equal(failedSave.calls.length, 1);
  const failedRevoke = setup([new Response('secret provider error', { status: 503 })]);
  await assert.rejects(disconnectDeletionProvider('apple', 'apple-owner', { token: 'retained-refresh' }, config, failedRevoke.deps), error => error instanceof ProviderRemovalError && !error.message.includes('secret'));
});
test('oversized or malformed token-info responses and transport errors are sanitized', async () => {
  for (const response of [json({ value: 'x'.repeat(40_000) }), new Response('not-json'), json([])]) {
    const s = setup([response]);
    await assert.rejects(disconnectDeletionProvider('google', 'owner', { token: 'secret-token' }, config, s.deps), e => e instanceof ProviderRemovalError && !e.message.includes('secret-token'));
    assert.equal(s.calls.length, 1);
  }
  const offline = setup();
  await assert.rejects(disconnectDeletionProvider('google', 'owner', { token: 'secret-token' }, config, offline.deps), e => e instanceof ProviderRemovalError && !e.message.includes('secret-token'));
});

test('expired credentials request explicit reauthentication while invalid client configuration stays an owner configuration issue', async () => {
  for (const [providerError, expected] of [['invalid_grant', 'credential_refresh_required'], ['invalid_client', 'configuration']] as const) {
    const s = setup([new Response(JSON.stringify({ error: providerError }), { status: 400 })]);
    await assert.rejects(disconnectDeletionProvider('apple', 'apple-owner', { authorizationCode: 'code' }, config, s.deps),
      error => error instanceof ProviderRemovalError && error.code === expected);
    assert.deepEqual(s.saved, []);
  }
});
