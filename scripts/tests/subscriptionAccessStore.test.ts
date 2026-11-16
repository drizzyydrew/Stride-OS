import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { create } from 'zustand';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function harness() {
  let owner: string | null = 'a', generation = 1, calls = 0;
  let listener: (next: any, previous: any) => void = () => {};
  let read = async () => ({ isPro: true, hasAnalysisCredits: false });
  const module = { exports: {} as any };
  const mocks: Record<string, unknown> = {
    zustand: { create },
    '../lib/revenueCat': { checkEntitlements: () => { calls++; return read(); } },
    '../lib/localDataOwner': {
      captureOwnerLease: () => owner ? { ownerUserId: owner, generation } : null,
      ownerLeaseIsCurrent: (lease: any) => lease.ownerUserId === owner && lease.generation === generation,
    },
    './authStore': { useAuthStore: { subscribe: (callback: typeof listener) => { listener = callback; } } },
  };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/store/subscriptionStore.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { module, exports: module.exports, require: (id: string) => {
    if (Object.hasOwn(mocks, id)) return mocks[id]; throw new Error(`Unexpected import ${id}`);
  } });
  return { store: module.exports.useSubscriptionStore,
    read: (next: typeof read) => { read = next; },
    switchOwner: (next: string | null) => {
      const previous = owner; owner = next; generation++;
      listener({ user: next ? { id: next } : null, canAccessLocalData: !!next }, { user: previous ? { id: previous } : null });
    },
    refreshLease: () => { generation++; }, calls: () => calls,
  };
}

test('focus and foreground reads deduplicate and retain known same-owner Pro only while a check is pending', async () => {
  const h = harness(); await h.store.getState().refresh();
  const pending = deferred<{ isPro: boolean; hasAnalysisCredits: boolean }>();
  h.read(() => pending.promise);
  const first = h.store.getState().refresh();
  const second = h.store.getState().refresh();
  assert.equal(first, second);
  assert.equal(h.calls(), 2);
  assert.equal(h.store.getState().isPro, true);
  assert.equal(h.store.getState().isLoading, true);
  pending.resolve({ isPro: false, hasAnalysisCredits: false });
  await first;
  assert.equal(h.store.getState().isLoading, false);
  assert.equal(h.store.getState().isPro, false);
});

test('an old same-owner lease response cannot overwrite a newer membership result', async () => {
  const h = harness(); const old = deferred<{ isPro: boolean; hasAnalysisCredits: boolean }>();
  h.read(() => old.promise);
  const first = h.store.getState().refresh();
  h.refreshLease(); h.read(async () => ({ isPro: false, hasAnalysisCredits: false }));
  await h.store.getState().refresh();
  old.resolve({ isPro: true, hasAnalysisCredits: false }); await first;
  assert.equal(h.store.getState().isPro, false);
  assert.equal(h.store.getState().isLoading, false);
});

test('a lease retiring without a replacement request exits loading and permits a later retry', async () => {
  const h = harness(); const old = deferred<{ isPro: boolean; hasAnalysisCredits: boolean }>();
  h.read(() => old.promise);
  const pending = h.store.getState().refresh();
  h.refreshLease();
  old.resolve({ isPro: true, hasAnalysisCredits: false }); await pending;
  assert.equal(h.store.getState().isLoading, false);
  assert.equal(h.store.getState().isPro, false);
  assert.match(h.store.getState().error, /could not be verified/);
  h.read(async () => ({ isPro: true, hasAnalysisCredits: false }));
  await h.store.getState().refresh();
  assert.equal(h.store.getState().isPro, true);
  assert.equal(h.store.getState().error, null);
});

test('logout and owner switches synchronously remove access and discard delayed results', async () => {
  for (const next of ['b', null]) {
    const h = harness(); await h.store.getState().refresh();
    const pending = deferred<{ isPro: boolean; hasAnalysisCredits: boolean }>(); h.read(() => pending.promise);
    const first = h.store.getState().refresh(); h.switchOwner(next);
    assert.equal(h.store.getState().isPro, false);
    assert.equal(h.store.getState().owner, null);
    pending.resolve({ isPro: true, hasAnalysisCredits: false }); await first;
    assert.equal(h.store.getState().isPro, false);
    assert.equal(h.store.getState().owner, null);
  }
});

test('network verification errors are not published as inactive verified membership or retained Pro grants', async () => {
  const h = harness(); await h.store.getState().refresh();
  h.read(async () => { throw new Error('network failed'); });
  await h.store.getState().refresh();
  assert.match(h.store.getState().error, /could not be verified/);
  assert.equal(h.store.getState().isPro, false);
  assert.equal(h.store.getState().isLoading, false);
});
