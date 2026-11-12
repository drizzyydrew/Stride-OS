import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import * as weights from '../../src/utils/profilePower';
import { onboardingIdentityDraft, onboardingIdentityForCompletion } from '../../src/utils/onboardingIdentity';
import { profileIdentityLabel } from '../../src/utils/profileIdentity';

async function loadStore(raw: Map<string, string>) {
  const storage = createJSONStorage(() => ({
    getItem: async (key: string) => raw.get(key) ?? null,
    setItem: async (key: string, value: string) => { raw.set(key, value); },
    removeItem: async (key: string) => { raw.delete(key); },
  }));
  const profileStore = { getState: () => ({ activeAthleteId: 'athlete_default', profiles: {} }),
    persist: { hasHydrated: () => true } };
  const module = { exports: {} as any };
  const mocks: Record<string, unknown> = {
    zustand: { create }, 'zustand/middleware': { persist },
    './persistStorage': { createAppJSONStorage: () => storage },
    '@react-native-async-storage/async-storage': {},
    './profileStore': { useProfileStore: profileStore }, '../utils/profilePower': weights,
  };
  runInNewContext(ts.transpileModule(readFileSync('src/store/onboardingStore.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { module, exports: module.exports, require: (id: string) => {
    assert.ok(mocks[id], `Unmocked store import: ${id}`); return mocks[id];
  } });
  const store = module.exports.useOnboardingStore;
  if (!store.persist.hasHydrated()) await new Promise<void>(resolve => {
    const off = store.persist.onFinishHydration(() => { off(); resolve(); });
  });
  return store;
}

test('fresh optional onboarding identity never generates a surname or alias', () => {
  assert.deepEqual(onboardingIdentityDraft({}), { firstName: '', lastName: '', username: '', showName: true, showUsername: false });
  const result = onboardingIdentityForCompletion({ identityConfigured: true, showName: false, showUsername: false });
  assert.ok(result.ok);
  if (result.ok) assert.equal(profileIdentityLabel(result.patch), 'Athlete');
});

test('legacy in-progress name stays whole, while existing profile privacy wins when identity step was not visited', () => {
  const legacy = { name: 'María del Carmen van der Meer' };
  assert.equal(onboardingIdentityDraft(legacy).firstName, legacy.name);
  assert.equal(onboardingIdentityDraft(legacy).lastName, '');
  const result = onboardingIdentityForCompletion(legacy, { name: 'Private Person', showName: false, username: 'coach', showUsername: false });
  assert.ok(result.ok);
  if (result.ok) {
    assert.equal(profileIdentityLabel(result.patch), 'Athlete');
    assert.equal(result.patch.name, 'Private Person');
  }
});

test('explicit identity step choices independently survive actual onboarding store persistence and rehydration', async () => {
  const raw = new Map<string, string>();
  const store = await loadStore(raw);
  await store.getState().updateData({ firstName: 'Zoë', lastName: 'Moore', username: 'stride.zoe',
    showName: false, showUsername: true, identityConfigured: true });
  const reopened = await loadStore(raw);
  const result = onboardingIdentityForCompletion(reopened.getState().data);
  assert.ok(result.ok);
  if (result.ok) assert.equal(profileIdentityLabel(result.patch), '@stride.zoe');
  assert.equal(reopened.getState().onboardingComplete, false);
});

test('old completed snapshots retain completed status without synthesizing new identity choices', async () => {
  const raw = new Map([['onboarding-store', JSON.stringify({ version: 1, state: {
    onboardingComplete: true, currentStep: 11, data: { name: 'Legacy Athlete', weeklyMileage: 24 },
  } })]]);
  const store = await loadStore(raw);
  assert.equal(store.getState().onboardingComplete, true);
  assert.equal(store.getState().data.identityConfigured, undefined);
  assert.equal(onboardingIdentityDraft(store.getState().data).firstName, 'Legacy Athlete');
  assert.equal(store.getState().data.weeklyMileage, 24);
});

test('onboarding identity validation rejects an invalid alias before profile setup', () => {
  const result = onboardingIdentityForCompletion({ identityConfigured: true, username: 'two names' });
  assert.equal(result.ok, false);
});
