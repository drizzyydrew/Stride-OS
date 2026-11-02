import assert from 'node:assert/strict';
import test from 'node:test';
import { DELETION_TABLES, deletionBlockers, fulfillDeletion, validateDeletionPlan, type DeletionPlan } from '../../src/utils/deletionFulfillment';

const request = '61e0ff16-e219-43f2-b87b-e58db4a10213';
const owner = '61e0ff16-e219-43f2-b87b-e58db4a10214';
const lease = '61e0ff16-e219-43f2-b87b-e58db4a10215';
function plan(patch: Partial<DeletionPlan> = {}): DeletionPlan {
  return { request_id: request, user_id: owner, status: 'pending', auth_user_exists: true,
    record_counts: Object.fromEntries(DELETION_TABLES.map(name => [name, 0])),
    storage_paths: [`${owner}/synthetic.mp4`], unsafe_storage_objects: 0, shared_auth_tables: [],
    identity_providers: ['apple'], fulfillment_version: 1,
    provider_actions: [{ provider: 'apple', status: 'manual_required', reason: 'capture_outcome_unknown' }], ...patch };
}
function workflow(current: DeletionPlan) {
  const calls: string[] = [];
  const deps = {
    plan: async () => structuredClone(current),
    claim: async () => { calls.push('claim'); current.status = 'processing'; return lease; },
    assertLease: async () => { calls.push('lease'); },
    removeObjects: async () => { calls.push('storage'); current.storage_paths = []; },
    deleteAuthUser: async (id: string) => { assert.equal(id, owner); calls.push('auth'); current.auth_user_exists = false; current.identity_providers = []; },
    complete: async () => { calls.push('complete'); current.status = 'completed'; },
  };
  return { current, calls, deps };
}

test('unknown capture requires the exact boolean trusted-server attestation; missing and false remain blocked', () => {
  for (const value of [undefined, false]) assert.ok(deletionBlockers(plan({ apple_capture_recovery_attested: value })).length);
  for (const value of [1, 'true', null, {}]) {
    assert.throws(() => validateDeletionPlan({ ...plan(), apple_capture_recovery_attested: value }, request));
  }
  assert.deepEqual(deletionBlockers(validateDeletionPlan(plan({ apple_capture_recovery_attested: true }), request)), []);
});

test('stopped-capture attestation cannot authorize Google, legacy fulfillment, pending, revoked-unknown or arbitrary reasons', () => {
  const patches: Partial<DeletionPlan>[] = [
    { fulfillment_version: 0 },
    { identity_providers: ['google'], provider_actions: [{ provider: 'google', status: 'manual_required', reason: 'capture_outcome_unknown' }] },
    ...['capture_outcome_unknown', 'capture_in_flight'].map(reason => ({ provider_actions: [{ provider: 'apple', status: 'pending' as const, reason }] })),
    { provider_actions: [{ provider: 'apple', status: 'revoked', reason: 'capture_outcome_unknown' }] },
    { provider_actions: [{ provider: 'apple', status: 'manual_required', reason: 'unverified-assertion' }] },
  ];
  for (const patch of patches) assert.ok(deletionBlockers(plan({ apple_capture_recovery_attested: true, ...patch })).length);
});

test('explicit server-attested manual Apple recovery follows normal deletion verification without promoting revocation', async () => {
  const w = workflow(plan({ apple_capture_recovery_attested: true }));
  assert.equal((await fulfillDeletion(request, w.deps, true)).complete, true);
  assert.deepEqual(w.calls, ['claim', 'lease', 'storage', 'lease', 'auth', 'complete']);
  assert.deepEqual(w.current.provider_actions, [{ provider: 'apple', status: 'manual_required', reason: 'capture_outcome_unknown' }]);
});

test('provider preparation cannot turn unresolved capture outcomes into destructive progress', async () => {
  for (const reason of ['capture_in_flight', 'capture_outcome_unknown']) {
    const w = workflow(plan({ apple_capture_recovery_attested: true,
      provider_actions: [{ provider: 'apple', status: 'pending', reason }] }));
    await assert.rejects(fulfillDeletion(request, { ...w.deps, prepareProviders: async () => { w.calls.push('prepare'); } }, true));
    assert.deepEqual(w.calls, ['claim', 'lease', 'prepare']);
    assert.equal(w.current.auth_user_exists, true);
  }
});

test('the coordinator rechecks stopped-capture evidence before Auth removal', async () => {
  const w = workflow(plan({ apple_capture_recovery_attested: true }));
  const remove = w.deps.removeObjects;
  w.deps.removeObjects = async () => { await remove(); w.current.apple_capture_recovery_attested = false; };
  await assert.rejects(fulfillDeletion(request, w.deps, true));
  assert.equal(w.calls.includes('auth'), false);
  assert.equal(w.calls.includes('complete'), false);
});
