import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { Fragment } from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import { evaluateProAccess } from '../../src/utils/pro-access';

function source(file: string, mocks: Record<string, unknown>) {
  const module = { exports: {} as any };
  const compiled = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  vm.runInNewContext(compiled, { module, exports: module.exports, Uint8Array,
    require: (id: string) => { if (Object.hasOwn(mocks, id)) return mocks[id]; throw new Error(`Unexpected import ${id}`); },
  });
  return module.exports;
}

function gate() {
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  return { pending, release };
}

function harness() {
  let owner = 'a', generation = 1, pro = true, alive = true, checking = false;
  let refreshing: Promise<void> | null = null;
  let reads = 0;
  const assertProAccess = (feature: string) => {
    assert.equal(feature, 'movement-lab');
    if (checking) throw new Error('Checking your membership');
    if (!pro) throw new Error('Pro is required for new Movement Lab work');
  };
  const api = source('src/lib/movementLabAccess.ts', {
    './pro-access': { assertProAccess, requireProAccess: async (feature: string) => {
      reads++; if (refreshing) await refreshing; checking = false; assertProAccess(feature);
    } },
    './localDataOwner': {
      captureOwnerLease: () => owner ? { ownerUserId: owner, generation } : null,
      ownerLeaseIsCurrent: (lease: any) => lease.ownerUserId === owner && lease.generation === generation,
    },
  });
  return { api, begin: () => api.beginMovementLabWork(() => alive),
    owner: (value: string) => { owner = value; generation++; }, revoke: () => { pro = false; },
    unmount: () => { alive = false; }, pause: (pending: Promise<void> | null) => { refreshing = pending; checking = !!pending; }, reads: () => reads };
}

test('Movement Lab access has distinct paid-action copy and fails closed for new work', () => {
  const active = { billingEnabled: true, billingConfigured: true, owner: 'a', localAccess: true,
    online: true, membershipOwner: 'a', isPro: true, isLoading: false, error: null };
  assert.equal(evaluateProAccess(active, 'movement-lab').allowed, true);
  for (const patch of [{ isPro: false }, { isLoading: true }, { error: 'outage' }, { online: false }, { membershipOwner: 'b' }]) {
    const access = evaluateProAccess({ ...active, ...patch }, 'movement-lab');
    assert.equal(access.allowed, false);
    if (access.status !== 'checking') assert.match(access.message, /saved clips and results remain available/);
  }
  assert.equal(evaluateProAccess({ ...active, billingEnabled: false, isPro: false }, 'movement-lab').allowed, true);
});

test('creation gate keys content by owner while preserving same-owner verification refresh', () => {
  let owner = 'a', knownPro = true;
  let access = { allowed: true, status: 'active', message: '', retry: () => undefined };
  const passive = () => null;
  const gateModule = source('src/components/movement/MovementLabCreateGate.tsx', {
    react: { Fragment }, 'react/jsx-runtime': jsxRuntime,
    'react-native': { ScrollView: passive }, 'expo-router': { router: { back() {} } },
    '../../hooks/useProAccess': { useProAccess: (feature: string) => { assert.equal(feature, 'movement-lab'); return access; } },
    '../../store/authStore': { useAuthStore: (select: any) => select({ user: { id: owner } }) },
    '../../store/subscriptionStore': { useSubscriptionStore: (select: any) => select({ owner, isPro: knownPro }) },
    '../../lib/localDataOwner': { captureOwnerLease: () => ({ ownerUserId: owner, generation: 1 }) },
    '../../theme/useColors': { useColors: () => ({ bg: '#000' }) },
    '../layout/ScreenHeader': { default: passive }, '../subscription/ProAccessNotice': { default: passive },
    '../layout/PageSafeAreaView': { default: passive },
  });
  const content = { selectedMedia: 'owner-a-video' };
  const first = gateModule.default({ children: content });
  assert.equal(first.type, Fragment); assert.equal(first.key, 'a');
  access = { ...access, allowed: false, status: 'checking' };
  const refresh = gateModule.default({ children: content });
  assert.equal(refresh.key, first.key); assert.equal(refresh.type, Fragment);
  owner = 'b'; access = { ...access, allowed: true, status: 'active' };
  const switched = gateModule.default({ children: content });
  assert.notEqual(switched.key, first.key, 'React must discard the old owner’s child state even if both accounts are Pro');
  knownPro = false; access = { ...access, allowed: false, status: 'inactive' };
  assert.notEqual(gateModule.default({ children: content }).type, Fragment);
});

test('new work waits for verification, rejects denial and never returns a work ticket', async () => {
  const h = harness(); const wait = gate(); h.pause(wait.pending);
  let settled = false;
  const result = h.begin().then((work: unknown) => { settled = true; return work; });
  await Promise.resolve(); assert.equal(settled, false);
  h.revoke(); wait.release();
  await assert.rejects(result, /Pro is required/);
  assert.equal(h.reads(), 1);
});

test('owner change during verification cannot authorize media selected by the previous account', async () => {
  const h = harness(); const wait = gate(); h.pause(wait.pending);
  const result = h.begin(); h.owner('b'); wait.release();
  await assert.rejects(result, /account or Movement Lab screen changed/);
});

test('every processing/commit fence rejects entitlement loss, unmounted work and same-owner generation changes', async () => {
  for (const invalidation of ['pro', 'unmount', 'owner-generation'] as const) {
    const h = harness(); const work = await h.begin();
    if (invalidation === 'pro') h.revoke();
    if (invalidation === 'unmount') h.unmount();
    if (invalidation === 'owner-generation') h.owner('a');
    assert.throws(() => h.api.assertMovementLabWork(work), /Pro is required|account or Movement Lab screen changed/);
    await assert.rejects(h.api.recheckMovementLabWork(work), /Pro is required|account or Movement Lab screen changed/);
  }
});

test('final fresh membership check rejects expiry during verification without accepting old Pro state', async () => {
  const h = harness(); const work = await h.begin(); const wait = gate(); h.pause(wait.pending);
  const refreshed = h.api.recheckMovementLabWork(work);
  h.revoke(); wait.release();
  await assert.rejects(refreshed, /Pro is required/);
  assert.equal(h.reads(), 2);
});

test('returning native media waits for same-owner in-flight verification instead of discarding it', async () => {
  const h = harness(); const work = await h.begin(); const wait = gate();
  h.pause(wait.pending);
  assert.throws(() => h.api.assertMovementLabWork(work), /Checking/);
  let resumed = false;
  const result = h.api.recheckMovementLabWork(work).then(() => { resumed = true; });
  await Promise.resolve(); assert.equal(resumed, false);
  wait.release(); await result;
  assert.equal(resumed, true); h.api.assertMovementLabWork(work);
});

test('failed optional pose-file writes still fence final result updates and navigation', async () => {
  for (const invalidate of ['owner', 'pro', 'unmount'] as const) {
    const h = harness(); const work = await h.begin(); const wait = gate();
    const writing = gate();
    let committed = false;
    const result = h.api.attachMovementLabWork(work, async () => { writing.release(); await wait.pending; throw new Error('disk failed'); })
      .then(() => { committed = true; });
    await writing.pending;
    if (invalidate === 'owner') h.owner('b');
    if (invalidate === 'pro') h.revoke();
    if (invalidate === 'unmount') h.unmount();
    wait.release();
    await assert.rejects(result, /Pro is required|account or Movement Lab screen changed/);
    assert.equal(committed, false);
  }
  const h = harness(); const work = await h.begin();
  assert.equal(await h.api.attachMovementLabWork(work, async () => { throw new Error('disk failed'); }), undefined,
    'same-owner authorized inline results remain usable after an optional raw-file failure');
});

function storageHarness(h: ReturnType<typeof harness>, readWait: Promise<void> = Promise.resolve()) {
  let uploads = 0, reads = 0;
  const storage = source('src/lib/movementVideoStorage.ts', {
    'expo-file-system/legacy': { documentDirectory: 'file:///owned/', EncodingType: { Base64: 'base64' },
      readAsStringAsync: async () => { reads++; await readWait; return 'YQ=='; } },
    './mediaPaths': { resolveDocumentUri: (uri: string) => uri, toRelativeDocumentPath: (uri: string) => uri },
    './supabase': { getSupabaseAvailability: () => ({ status: 'available', client: {
      storage: { from: () => ({ upload: async () => { uploads++; return { error: null }; } }) },
    } }), supabaseUnavailableMessage: () => 'unavailable' },
    './movementLabAccess': h.api,
  });
  return { storage, uploads: () => uploads, reads: () => reads };
}

test('legacy upload service fences the async file-read gap before any network upload', async () => {
  for (const invalidation of ['owner', 'pro'] as const) {
    const h = harness(); const work = await h.begin(); const wait = gate();
    const s = storageHarness(h, wait.pending);
    const result = s.storage.uploadMovementVideo('file:///owned/clip.mp4', 'a/clip.mp4', 'video/mp4', work);
    assert.equal(s.reads(), 1);
    if (invalidation === 'owner') h.owner('b'); else h.revoke();
    wait.release();
    await assert.rejects(result, /Pro is required|account or Movement Lab screen changed/);
    assert.equal(s.uploads(), 0);
  }
});

test('legacy upload rejects another owner path before reading media, while valid same-owner work uploads', async () => {
  const h = harness(); const work = await h.begin(); const s = storageHarness(h);
  await assert.rejects(s.storage.uploadMovementVideo('file:///owned/clip.mp4', 'b/clip.mp4', 'video/mp4', work), /different account/);
  assert.equal(s.reads(), 0); assert.equal(s.uploads(), 0);
  await s.storage.uploadMovementVideo('file:///owned/clip.mp4', 'a/clip.mp4', 'video/mp4', work);
  assert.equal(s.uploads(), 1);
});
