import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import { createJSONStorage } from 'zustand/middleware';

async function harness() {
  const saved = new Map<string, string>();
  let current = true;
  let fail = false;
  let athlete = 'athlete_default';
  let block: (() => Promise<void>) | null = null;
  const storage = { getItem: async (key: string) => saved.get(key) ?? null,
    getItemOnce: async (key: string) => saved.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      if (fail) throw new Error('disk failed');
      const wait = block; block = null;
      if (wait) await wait();
      saved.set(key, value);
    }, removeItem: async (key: string) => { saved.delete(key); } };
  const profile = { get activeAthleteId() { return athlete; }, profiles: { athlete_default: {} }, updateProfile: () => {} };
  const filename = resolve('src/store/onboardingStore.ts');
  const module = { exports: {} };
  const nativeRequire = createRequire(filename);
  const mocks: Record<string, unknown> = {
    './persistStorage': { createAppJSONStorage: () => createJSONStorage(() => storage), getAppStorage: () => storage },
    '../lib/localDataOwner': { ownerLeaseIsCurrent: () => current },
    '@react-native-async-storage/async-storage': {},
    './profileStore': { useProfileStore: { getState: () => profile, persist: { hasHydrated: () => true } } },
    '../utils/profilePower': { preserveWeightProvenance: (_previous: unknown, patch: unknown) => patch,
      matchingWeightProvenance: () => null, migrateStoredWeight: (data: unknown) => data, userEnteredWeightPatch: () => null },
  };
  const compiled = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(compiled, { module, exports: module.exports,
    require: (id: string) => Object.hasOwn(mocks, id) ? mocks[id] : nativeRequire(id), console, Date }, { filename });
  const runtime = module.exports as typeof import('../../src/store/onboardingStore');
  await runtime.useOnboardingStore.persist.rehydrate();
  return { ...runtime, saved, retire: () => { current = false; }, setFail: (value: boolean) => { fail = value; },
    setAthlete: (value: string) => { athlete = value; }, holdNext: () => {
      let release!: () => void;
      const pending = new Promise<void>(resolve => { release = resolve; });
      block = () => pending;
      return release;
    } };
}
const lease = { ownerUserId: 'owner', generation: 1 };

test('planning choices publish only after same-owner durable readback and preserve unrelated profile fields', async () => {
  const h = await harness();
  h.useOnboardingStore.getState().updateData({ name: 'Runner' });
  await Promise.resolve();
  const before = h.useOnboardingStore.getState().data;
  const release = h.holdNext();
  const saving = h.saveStrengthPlanningPreferences({ strengthSessionMinutes: 30, strengthExercisePreferences: { pull_row: 'pull_band_row' } }, lease);
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(h.useOnboardingStore.getState().data, before);
  release(); await saving;
  assert.equal(h.useOnboardingStore.getState().data.name, 'Runner');
  assert.equal(h.useOnboardingStore.getState().data.strengthSessionMinutes, 30);
  const stored = JSON.parse(h.saved.get('onboarding-store')!);
  assert.equal(stored.state.data.strengthExercisePreferences.pull_row, 'pull_band_row');
  assert.equal(stored.version, 1);
});

test('failed writes, changed owners and another athlete cannot publish a planning preference', async () => {
  const h = await harness();
  const before = h.useOnboardingStore.getState().data;
  h.setFail(true);
  await assert.rejects(h.saveStrengthPlanningPreferences({ strengthSessionMinutes: 30 }, lease), /disk failed/);
  assert.equal(h.useOnboardingStore.getState().data, before);
  h.setFail(false);
  await h.saveStrengthPlanningPreferences({ strengthSessionMinutes: 30 }, lease);
  h.setAthlete('athlete_secondary');
  await assert.rejects(h.saveStrengthPlanningPreferences({ strengthSessionMinutes: 45 }, lease), /not ready/);
  assert.equal(h.useOnboardingStore.getState().data.strengthSessionMinutes, 30);
  h.setAthlete('athlete_default');
  const release = h.holdNext();
  const pending = h.saveStrengthPlanningPreferences({ strengthSessionMinutes: 45 }, lease);
  await new Promise(resolve => setTimeout(resolve, 0));
  h.retire(); release();
  await assert.rejects(pending, /account changed/);
  assert.equal(h.useOnboardingStore.getState().data.strengthSessionMinutes, 30);
});

test('a concurrent profile update survives a planning-choice retry', async () => {
  const h = await harness();
  const release = h.holdNext();
  const saving = h.saveStrengthPlanningPreferences({ strengthSessionMinutes: 30, strengthExercisePreferences: { pull_row: 'pull_band_row' } }, lease);
  await new Promise(resolve => setTimeout(resolve, 0));
  h.useOnboardingStore.getState().updateData({ name: 'Latest name', strengthExercisePreferences: { squat_goblet: 'squat_box' } });
  release(); await saving;
  assert.equal(h.useOnboardingStore.getState().data.name, 'Latest name');
  assert.equal(JSON.parse(h.saved.get('onboarding-store')!).state.data.name, 'Latest name');
  assert.deepEqual(JSON.parse(h.saved.get('onboarding-store')!).state.data.strengthExercisePreferences,
    { squat_goblet: 'squat_box', pull_row: 'pull_band_row' });
  await h.saveStrengthPlanningPreferences({ strengthExercisePreferences: { pull_row: null } }, lease);
  assert.deepEqual(JSON.parse(h.saved.get('onboarding-store')!).state.data.strengthExercisePreferences, { squat_goblet: 'squat_box' });
});
