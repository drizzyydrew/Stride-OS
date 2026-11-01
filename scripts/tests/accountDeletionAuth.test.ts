import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

function source<T>(path: string, mocks: Record<string, unknown>): T {
  const filename = resolve(path), module = { exports: {} }, native = createRequire(filename);
  const code = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, require: (id: string) => Object.hasOwn(mocks, id) ? mocks[id] : native(id), console, setTimeout, clearTimeout, Date }, { filename });
  return module.exports as T;
}
const tick = () => new Promise<void>(resolve => setImmediate(resolve));
async function harness() {
  const values = new Map<string, string>();
  const history = Object.freeze([{ id: 'keep-recording-history' }]);
  const boundary = source<typeof import('../../src/lib/localDataOwner')>('src/lib/localDataOwner.ts', {});
  const owner = boundary.configureLocalDataOwner({ getItem: async key => values.get(key) ?? null, setItem: async (key, value) => { values.set(key, value); } });
  const session = { user: { id: 'owner', identities: [{ provider: 'apple' }] }, access_token: 'synthetic-auth' };
  let revoked!: () => void, sdkSignOut = 0, cleared = 0, polls = 0;
  const hooks: { readSession?: () => Promise<void> } = {};
  const restore = { getState: () => ({ restorePendingCompletions: async () => undefined }) };
  const auth = source<typeof import('../../src/store/authStore')>('src/store/authStore.ts', {
    '../lib/localDataOwner': boundary,
    '../lib/supabase': {
      localDataOwner: owner,
      initializeLocalOwnership: () => owner.initialize('owner', async () => true),
      readCachedSupabaseSession: async () => session, clearCachedSupabaseSession: async () => { cleared++; },
      getSupabaseAvailability: () => ({ status: 'available', client: { auth: {
        getSession: async () => { await hooks.readSession?.(); return { data: { session }, error: null }; },
        onAuthStateChange: () => undefined, stopAutoRefresh: () => undefined,
        signOut: async () => { sdkSignOut++; },
      } } }),
      withExplicitAuthAttempt: async (work: () => Promise<unknown>) => work(), isExplicitAuthAttempt: () => false,
    },
    '../lib/authRedirect': { hydrateUserData: async () => undefined },
    'expo-apple-authentication': { addRevokeListener: (fn: () => void) => { revoked = fn; return { remove: () => undefined }; } },
    'expo-web-browser': {}, '../store/workoutStore': { useWorkoutStore: restore },
    './workoutStore': { useWorkoutStore: restore }, './strengthStore': {}, './customWorkoutStore': {}, './checkInStore': {},
    '../lib/accountDeletion': { pollAccountDeletion: async () => { polls++; return null; } },
  }).useAuthStore;
  await auth.getState().initialize();
  return { auth, owner, boundary, history, hooks, revoke: () => revoked(),
    counts: () => ({ sdkSignOut, cleared, polls }) };
}

test('ordinary Apple revocation signs out and retains local history without invoking deletion', async () => {
  const h = await harness(); assert.equal(h.auth.getState().canAccessLocalData, true);
  h.revoke(); await tick(); await tick();
  assert.equal(h.auth.getState().canAccessLocalData, false);
  assert.equal(h.owner.logoutFenced, true);
  assert.deepEqual(h.counts(), { sdkSignOut: 1, cleared: 1, polls: 0 });
  assert.equal(h.history[0].id, 'keep-recording-history');
});
test('Apple revocation during a deletion fence only checks the saved receipt and never directly erases data', async () => {
  const h = await harness(); h.boundary.setLocalOwnerAccessGuard(() => false);
  h.revoke(); await tick(); await tick();
  assert.deepEqual(h.counts(), { sdkSignOut: 0, cleared: 0, polls: 1 });
  assert.equal(h.history[0].id, 'keep-recording-history');
});
test('direct owner invalidation immediately revokes retained route and bridge access before a root remount', async () => {
  const h = await harness(); assert.equal(h.auth.getState().canAccessLocalData, true);
  h.owner.block('signed-out');
  assert.equal(h.auth.getState().canAccessLocalData, false);
  assert.equal(h.auth.getState().user, null); assert.equal(h.auth.getState().session, null);
  await h.auth.getState().initialize();
  assert.equal(h.auth.getState().canAccessLocalData, h.owner.canAccess);
  assert.equal(h.history[0].id, 'keep-recording-history');
});
test('deletion auth lock fences immediately then waits for pending SDK work before credential cleanup can proceed', async () => {
  const h = await harness();
  let release!: () => void; const delayed = new Promise<void>(resolve => { release = resolve; });
  h.hooks.readSession = () => delayed;
  let done = false; const locking = h.auth.getState().lockForAccountDeletion().then(() => { done = true; });
  await tick(); assert.equal(h.owner.logoutFenced, true); assert.equal(h.auth.getState().canAccessLocalData, false); assert.equal(done, false);
  release(); await locking;
  assert.equal(done, true); assert.equal(h.history[0].id, 'keep-recording-history');
});
