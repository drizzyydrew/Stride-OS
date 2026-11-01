import test from 'node:test';
import assert from 'node:assert/strict';
import { createDeletionAccountHandler, createDeletionReceiptHandler, createDeletionWorkerHandler, deletionSecretHash, publicDeletionReceipt, type DeletionHandlersDependencies } from '../../supabase/functions/_shared/deletionHandlers';

const owner = '71e0ff16-e219-43f2-b87b-e58db4a10214';
const id = '71e0ff16-e219-43f2-b87b-e58db4a10213';
const secret = 'a'.repeat(64);
const receipt = () => ({ id, requested_at: '2026-10-31T12:00:00Z', status: 'pending', user_id: owner, receipt_hash: 'private-hash', provider_dispositions: { apple: 'manual_required' } });
const post = (body: unknown) => new Request('https://fixture.invalid', { method: 'POST', body: JSON.stringify(body) });
function setup() {
  const calls: unknown[][] = [];
  const deps: DeletionHandlersDependencies = {
    authenticate: async () => ({ id: owner, identities: [{ provider: 'google', provider_id: 'google-owner' }] }),
    readAuthenticated: async () => receipt(), requestLegacy: async user => { calls.push(['legacy', user]); return receipt(); },
    automationEnabled: async () => true, capabilities: () => ({ appleCodeExchange: false, googleTokenRevoke: true }),
    start: async (...args) => { calls.push(['start', ...args]); return receipt(); },
    refresh: async (...args) => { calls.push(['refresh', ...args]); return receipt(); },
    readReceipt: async (...args) => { calls.push(['read', ...args]); return receipt(); },
    enqueue: async value => { calls.push(['enqueue', value]); },
  };
  return { deps, calls };
}
test('deletion start requires authenticated owner and confirmation and never trusts a submitted owner', async () => {
  const s = setup(); const handler = createDeletionAccountHandler(s.deps);
  assert.equal((await handler(post({ confirmation: 'DELETE MY STRIDEOS ACCOUNT', receiptSecret: secret, userId: 'attacker' }))).status, 202);
  assert.equal(s.calls[0]![1], owner);
  assert.equal(s.calls[0]![2], await deletionSecretHash(secret));
  s.deps.authenticate = async () => null;
  assert.equal((await handler(post({ confirmation: 'DELETE MY STRIDEOS ACCOUNT', receiptSecret: secret }))).status, 401);
  s.deps.authenticate = async () => ({ id: owner });
  assert.equal((await handler(post({ receiptSecret: secret }))).status, 400);
});
test('disabled automation and invalid provider credentials do not start or enqueue a deletion', async () => {
  const s = setup(); s.deps.automationEnabled = async () => false;
  assert.equal((await createDeletionAccountHandler(s.deps)(post({ confirmation: 'DELETE MY STRIDEOS ACCOUNT', receiptSecret: secret }))).status, 503);
  assert.deepEqual(s.calls, []);
  s.deps.automationEnabled = async () => true;
  assert.equal((await createDeletionAccountHandler(s.deps)(post({ confirmation: 'DELETE MY STRIDEOS ACCOUNT', receiptSecret: secret, providerTokens: { appleAuthorizationCode: 'other-provider-code' } }))).status, 400);
  assert.deepEqual(s.calls, []);
});
test('provider secrets are atomically handed to the authenticated start dependency and never returned', async () => {
  const s = setup();
  const response = await createDeletionAccountHandler(s.deps)(post({ confirmation: 'DELETE MY STRIDEOS ACCOUNT', receiptSecret: secret, providerTokens: { google: 'google-secret-token' } }));
  assert.deepEqual(s.calls[0]![3], [{ kind: 'google_access_token', secret: 'google-secret-token', subject: 'google-owner' }]);
  const body = await response.text();
  for (const privateValue of [owner, secret, 'private-hash', 'google-secret-token']) assert.equal(body.includes(privateValue), false);
});
test('legacy callers remain on the manual flow and cannot trigger automatic fulfillment', async () => {
  const s = setup();
  assert.equal((await createDeletionAccountHandler(s.deps)(post({ confirmation: 'DELETE MY STRIDEOS ACCOUNT' }))).status, 202);
  assert.deepEqual(s.calls, [['legacy', owner]]);
});
test('receipt lookup works after Auth removal but schedules only an already-authorized, matching capability', async () => {
  const s = setup(); s.deps.authenticate = async () => null;
  const response = await createDeletionReceiptHandler(s.deps)(post({ requestId: id, receiptSecret: secret }));
  assert.equal(response.status, 200);
  assert.deepEqual(s.calls, [['read', id, secret], ['enqueue', id]]);
  s.calls.length = 0; s.deps.readReceipt = async () => null;
  assert.equal((await createDeletionReceiptHandler(s.deps)(post({ requestId: id, receiptSecret: secret }))).status, 404);
  assert.deepEqual(s.calls, []);
});
test('worker rejects missing or unverified tickets and schedules only a consumed ticket', async () => {
  const calls: string[] = [];
  let valid = false;
  const handler = createDeletionWorkerHandler({ consume: async () => valid, schedule: value => { calls.push(value); } });
  assert.equal((await handler(post({ requestId: id }))).status, 401);
  assert.equal((await handler(post({ requestId: id, jobTicket: secret }))).status, 401);
  assert.deepEqual(calls, []); valid = true;
  assert.equal((await handler(post({ requestId: id, jobTicket: secret }))).status, 202);
  assert.deepEqual(calls, [id]);
});

test('a lost initial response is recoverable using the saved capability without Auth or a server-generated ID', async () => {
  const s = setup(); s.deps.authenticate = async () => null;
  assert.equal((await createDeletionReceiptHandler(s.deps)(post({ receiptSecret: secret }))).status, 200);
  assert.deepEqual(s.calls, [['read', null, secret], ['enqueue', id]]);
});

test('credential repair requires explicit intent, the authenticated owner and fresh credentials while preserving the receipt hash', async () => {
  const s = setup();
  const response = await createDeletionAccountHandler(s.deps)(post({ confirmation: 'DELETE MY STRIDEOS ACCOUNT', receiptSecret: secret,
    refreshProviderCredentials: true, providerTokens: { google: 'fresh-token' } }));
  assert.equal(response.status, 202);
  assert.deepEqual(s.calls[0], ['refresh', owner, await deletionSecretHash(secret), [{ kind: 'google_access_token', secret: 'fresh-token', subject: 'google-owner' }]]);
  s.calls.length = 0;
  assert.equal((await createDeletionAccountHandler(s.deps)(post({ confirmation: 'DELETE MY STRIDEOS ACCOUNT', receiptSecret: secret, refreshProviderCredentials: true }))).status, 400);
  assert.deepEqual(s.calls, []);
});
test('receipt schema cannot falsely claim completion and drops all internal fields', () => {
  assert.throws(() => publicDeletionReceipt({ ...receipt(), status: 'completed' }));
  const publicValue = publicDeletionReceipt({ ...receipt(), status: 'completed', completed_at: '2026-10-31T13:00:00Z' })!;
  assert.equal(publicValue.provider_actions[0]!.status, 'manual_required');
  assert.equal('user_id' in publicValue, false); assert.equal('receipt_hash' in publicValue, false);
});
test('background enqueue failure preserves a confirmed receipt and HTTP errors do not echo provider details', async () => {
  const s = setup(); s.deps.enqueue = async () => { throw new Error('private secret'); };
  assert.equal((await createDeletionAccountHandler(s.deps)(post({ confirmation: 'DELETE MY STRIDEOS ACCOUNT', receiptSecret: secret }))).status, 202);
  s.deps.start = async () => { throw new Error('private secret'); };
  const response = await createDeletionAccountHandler(s.deps)(post({ confirmation: 'DELETE MY STRIDEOS ACCOUNT', receiptSecret: secret }));
  assert.equal(response.status, 503); assert.equal((await response.text()).includes('private secret'), false);
});
