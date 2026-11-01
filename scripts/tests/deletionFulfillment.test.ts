import assert from 'node:assert/strict';
import test from 'node:test';
import { DELETION_TABLES, deletionBlockers, fulfillDeletion, validateDeletionPlan, type DeletionPlan } from '../../src/utils/deletionFulfillment';

const id = '71e0ff16-e219-43f2-b87b-e58db4a10213';
const owner = '71e0ff16-e219-43f2-b87b-e58db4a10214';
const token = '71e0ff16-e219-43f2-b87b-e58db4a10215';
function plan(changes: Partial<DeletionPlan> = {}): DeletionPlan {
  return { request_id: id, user_id: owner, status: 'pending', auth_user_exists: true,
    record_counts: Object.fromEntries(DELETION_TABLES.map(table => [table, 0])),
    storage_paths: [`${owner}/clip.mp4`], unsafe_storage_objects: 0,
    shared_auth_tables: [], identity_providers: ['email'], ...changes };
}
function workflow(initial = plan()) {
  let current = initial;
  const calls: string[] = [];
  const deps = {
    plan: async () => structuredClone(current),
    claim: async () => { calls.push('claim'); current.status = 'processing'; return token; },
    assertLease: async () => { calls.push('lease'); },
    removeObjects: async (paths: string[]) => { calls.push('storage'); current.storage_paths = current.storage_paths.filter(path => !paths.includes(path)); },
    deleteAuthUser: async (userId: string) => { assert.equal(userId, owner); calls.push('auth'); current.auth_user_exists = false; current.identity_providers = []; },
    complete: async (requestId: string, lease: string) => { assert.equal(requestId, id); assert.equal(lease, token); calls.push('complete'); current.status = 'completed'; },
  };
  return { deps, calls, get: () => current, set: (next: DeletionPlan) => { current = next; } };
}
test('deletion defaults to a read-only dry-run and reports the shared-auth blocker', async () => {
  const w = workflow(plan({ shared_auth_tables: ['betdesk_profiles'] }));
  const result = await fulfillDeletion(id, w.deps);
  assert.equal(result.mode, 'dry-run'); assert.equal(result.complete, false);
  assert.match(result.blockers.join(), /Shared authentication/); assert.deepEqual(w.calls, []);
});
test('shared schema, other-bucket objects, and unrevoked providers block execution before a claim or deletion', async () => {
  for (const patch of [{ shared_auth_tables: ['betdesk_profiles'] }, { unsafe_storage_objects: 1 }, { identity_providers: ['apple'] }, { identity_providers: ['google'] }]) {
    const w = workflow(plan(patch));
    await assert.rejects(fulfillDeletion(id, w.deps, true)); assert.deepEqual(w.calls, []);
  }
});
test('invalid manifests and paths cannot authorize an operation or another owner', async () => {
  for (const patch of [{ request_id: owner }, { user_id: 'not-a-uuid' }, { storage_paths: ['other/clip.mp4'] },
    { storage_paths: [`${owner}/../other/file`] }, { storage_paths: [`${owner}//file`] },
    { record_counts: { profiles: 0 } }, { unsafe_storage_objects: -1 }]) {
    assert.throws(() => validateDeletionPlan(plan(patch), id));
  }
  const w = workflow(); await assert.rejects(fulfillDeletion('invalid', w.deps, true)); assert.deepEqual(w.calls, []);
});
test('eligible isolated-account deletion verifies storage then Auth and only then records completion', async () => {
  const w = workflow();
  const result = await fulfillDeletion(id, w.deps, true);
  assert.equal(result.complete, true);
  assert.deepEqual(w.calls, ['claim', 'lease', 'storage', 'lease', 'auth', 'complete']);
});
test('a failed storage call or residual object preserves Auth and cannot produce a completion receipt', async () => {
  for (const fail of [true, false]) {
    const w = workflow();
    w.deps.removeObjects = async () => { if (fail) throw new Error('Storage unavailable'); };
    await assert.rejects(fulfillDeletion(id, w.deps, true));
    assert.equal(w.calls.includes('auth'), false); assert.equal(w.calls.includes('complete'), false);
  }
});
test('claim owner races and expired leases cannot reach a destructive operation', async () => {
  const w = workflow();
  w.deps.claim = async () => { w.set(plan({ status: 'processing', user_id: token, storage_paths: [] })); return token; };
  await assert.rejects(fulfillDeletion(id, w.deps, true)); assert.deepEqual(w.calls, []);
  const expired = workflow(); expired.deps.assertLease = async () => { throw new Error('Expired'); };
  await assert.rejects(fulfillDeletion(id, expired.deps, true)); assert.deepEqual(expired.calls, ['claim']);
});
test('Auth failure and remaining app records cannot be misreported as a complete deletion', async () => {
  const failed = workflow(); failed.deps.deleteAuthUser = async () => { throw new Error('Auth unavailable'); };
  await assert.rejects(fulfillDeletion(id, failed.deps, true)); assert.equal(failed.calls.includes('complete'), false);
  const remaining = workflow(plan({ record_counts: { ...plan().record_counts, activity_logs: 1 } }));
  await assert.rejects(fulfillDeletion(id, remaining.deps, true)); assert.equal(remaining.calls.includes('complete'), false);
});
test('resuming after successful Auth removal is idempotent and uses the retained receipt', async () => {
  const w = workflow(plan({ status: 'processing', auth_user_exists: false, storage_paths: [], identity_providers: [] }));
  assert.equal(deletionBlockers(w.get()).length, 0);
  const result = await fulfillDeletion(id, w.deps, true);
  assert.equal(result.complete, true); assert.equal(w.calls.includes('auth'), false);
});
test('storage removal is bounded to batches of 100', async () => {
  const w = workflow(plan({ storage_paths: Array.from({ length: 205 }, (_, i) => `${owner}/${i}.mp4`) }));
  const lengths: number[] = []; const remove = w.deps.removeObjects;
  w.deps.removeObjects = async paths => { lengths.push(paths.length); await remove(paths); };
  await fulfillDeletion(id, w.deps, true); assert.deepEqual(lengths, [100, 100, 5]);
});
test('a stored completed status is not accepted while records, files or an Auth account remain', async () => {
  for (const patch of [{ auth_user_exists: true }, { storage_paths: [`${owner}/remaining.mp4`] },
    { record_counts: { ...plan().record_counts, workout_logs: 1 } }]) {
    const w = workflow(plan({ status: 'completed', auth_user_exists: false, storage_paths: [], identity_providers: [], ...patch }));
    await assert.rejects(fulfillDeletion(id, w.deps, true)); assert.deepEqual(w.calls, []);
  }
  const completed = workflow(plan({ status: 'completed', auth_user_exists: false, storage_paths: [], identity_providers: [] }));
  assert.equal((await fulfillDeletion(id, completed.deps, true)).complete, true);
  assert.deepEqual(completed.calls, []);
});

test('new social requests secure a lease and resolve providers before any owned data removal', async () => {
  const w = workflow(plan({ fulfillment_version: 1, identity_providers: ['apple'], provider_actions: [] }));
  const deps = { ...w.deps, prepareProviders: async () => {
    w.calls.push('providers');
    w.get().provider_actions = [{ provider: 'apple', status: 'manual_required', reason: 'legacy_token_unavailable' }];
  } };
  assert.equal((await fulfillDeletion(id, deps, true)).complete, true);
  assert.ok(w.calls.indexOf('providers') > w.calls.indexOf('claim'));
  assert.ok(w.calls.indexOf('providers') < w.calls.indexOf('storage'));
});

test('provider failures, unsupported identities and unconfirmed disposition cannot reach file or Auth deletion', async () => {
  for (const kind of ['failure', 'pending', 'unknown', 'false-reason'] as const) {
    const w = workflow(plan({ fulfillment_version: 1, identity_providers: [kind === 'unknown' ? 'unsupported' : 'apple'], provider_actions: [] }));
    const deps = { ...w.deps, prepareProviders: async () => {
      if (kind === 'failure') throw new Error('Provider unavailable');
      if (kind === 'false-reason') w.get().provider_actions = [{ provider: 'apple', status: 'manual_required', reason: 'configuration_missing' }];
    } };
    await assert.rejects(fulfillDeletion(id, deps, true));
    assert.equal(w.calls.includes('storage'), false); assert.equal(w.calls.includes('auth'), false);
    if (kind === 'unknown') assert.equal(w.calls.length, 0);
  }
});
