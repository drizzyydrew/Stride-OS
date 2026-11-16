import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { create } from 'zustand';
import { evaluateProAccess, adaptationNeedsPro, onboardingTrainingChoice, onboardingGoalDraft } from '../../src/utils/pro-access';

const active = { billingEnabled: true, billingConfigured: true, owner: 'a', localAccess: true, online: true,
  membershipOwner: 'a', isPro: true, isLoading: false, error: null };

test('only same-owner verified active membership unlocks new paid actions', () => {
  assert.equal(evaluateProAccess(active).allowed, true);
  for (const patch of [{ membershipOwner: 'b' }, { owner: null }, { localAccess: false }, { online: false },
    { billingConfigured: false }, { isLoading: true }, { error: 'network failed' }, { isPro: false }]) {
    assert.equal(evaluateProAccess({ ...active, ...patch }).allowed, false, JSON.stringify(patch));
  }
  assert.equal(evaluateProAccess({ ...active, error: 'network failed' }).status, 'unavailable');
  assert.equal(evaluateProAccess({ ...active, isPro: false }).status, 'inactive');
});

test('billing-disabled builds retain their existing paths, while enabled missing configuration fails closed', () => {
  assert.equal(evaluateProAccess({ ...active, billingEnabled: false, billingConfigured: false, owner: null }).allowed, true);
  assert.equal(evaluateProAccess({ ...active, billingConfigured: false }).allowed, false);
});

test('all safety and manual adaptation controls remain free; automatic rebuilding is paid', () => {
  for (const action of ['rest', 'reduced', 'remove_intensity', 'unchanged', 'removed', 'moved', 'convert_easy', 'active_recovery']) {
    assert.equal(adaptationNeedsPro([{ action }]), false, action);
  }
  assert.equal(adaptationNeedsPro([{ action: 'rest' }, { action: 'rebuild_week' }]), true);
  assert.equal(adaptationNeedsPro([{ action: 'convert_easy' }], 'week-rebuild'), true);
});

test('onboarding always preserves an existing or migrated plan and opens free training for new inactive users', () => {
  for (const proAllowed of [true, false]) assert.equal(onboardingTrainingChoice({ billingEnabled: true, hasExistingPlan: true, proAllowed }), 'preserve');
  assert.equal(onboardingTrainingChoice({ billingEnabled: true, hasExistingPlan: false, proAllowed: false }), 'open');
  assert.equal(onboardingTrainingChoice({ billingEnabled: true, hasExistingPlan: false, proAllowed: true }), 'structured');
  assert.equal(onboardingTrainingChoice({ billingEnabled: false, hasExistingPlan: false, proAllowed: false }), 'structured');
});

test('the onboarding handoff restores a new athlete race draft without starting a plan', () => {
  const input = { source: 'onboarding', openTraining: true, hasProgrammedBefore: false, today: '2026-11-16',
    data: { goalType: 'race_prep' as const, raceName: 'Spring half', raceDate: '2027-04-01', raceDistance: 'half_marathon' as const, racePriority: 'B' as const } };
  const original = JSON.stringify(input);
  assert.deepEqual(onboardingGoalDraft(input), { goalType: 'race_prep', title: 'Spring half', raceName: 'Spring half',
    raceDate: '2027-04-01', distance: 'half_marathon', priority: 'B' });
  assert.equal(JSON.stringify(input), original);
  for (const source of [undefined, 'external', ['onboarding'], { source: 'onboarding' }]) {
    assert.equal(onboardingGoalDraft({ ...input, source }), null);
  }
  assert.equal(onboardingGoalDraft({ ...input, openTraining: false }), null);
  assert.equal(onboardingGoalDraft({ ...input, hasProgrammedBefore: true }), null);
  assert.equal(onboardingGoalDraft({ ...input, data: { ...input.data, raceDate: '2020-01-01' } })?.raceDate, undefined);
});

function loadSource(file: string, mocks: Record<string, unknown>) {
  const module = { exports: {} as any };
  const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
  } }).outputText;
  vm.runInNewContext(compiled, { module, exports: module.exports, process: { env: { EXPO_PUBLIC_STRIDEOS_BILLING_ENABLED: 'true' } },
    require: (id: string) => { if (Object.hasOwn(mocks, id)) return mocks[id]; throw new Error(`Unexpected import ${id}`); }, Date });
  return module.exports;
}

test('a direct paid-action request verifies membership and rejects an owner switch during verification', async () => {
  let owner = 'a', calls = 0;
  const auth = { getState: () => ({ user: { id: owner }, canAccessLocalData: true }) };
  let switchDuringRead = false;
  const membership = { getState: () => ({ owner, isPro: true, isLoading: false, error: null,
    refresh: async () => { calls++; if (switchDuringRead) owner = 'b'; } }) };
  const api = loadSource('src/lib/pro-access.ts', {
    'react-native': { Platform: { OS: 'ios' } }, '../store/authStore': { useAuthStore: auth },
    '../store/subscriptionStore': { useSubscriptionStore: membership }, '../utils/pro-access': { evaluateProAccess },
    './revenueCat': { billingIsConfigured: () => true },
    './localDataOwner': { captureOwnerLease: () => ({ ownerUserId: owner, generation: owner === 'a' ? 1 : 2 }),
      ownerLeaseIsCurrent: (lease: any) => lease.ownerUserId === owner },
  });
  await api.requireProAccess('personalized-plans'); assert.equal(calls, 1);
  switchDuringRead = true;
  await assert.rejects(api.requireProAccess('personalized-plans'), /account changed/);
});

test('inactive membership cannot confirm a persisted automatic rebuild, but rest changes still apply', () => {
  let allowed = true;
  const fakePersist = (initializer: any) => initializer;
  const api = loadSource('src/store/adaptationStore.ts', {
    zustand: { create }, 'zustand/middleware': { persist: fakePersist },
    './persistStorage': { createAppJSONStorage: () => ({}) },
    '../lib/pro-access': { assertProAccess: () => { if (!allowed) throw new Error('Pro required'); } },
    '../utils/pro-access': { adaptationNeedsPro }, '../utils/adaptationWorkflow': { serializeConfirmedAdaptations: () => ({}) },
  });
  const store = api.useAdaptationStore;
  const preview = { id: 'preview', weekKey: 'week', createdAt: 1, reason: 'schedule_conflict', overlays: [{ action: 'rebuild_week' }],
    conflicts: [], unchangedSessionIds: [], summary: 'rebuild' };
  store.getState().setPreview(preview);
  allowed = false;
  assert.throws(() => store.getState().confirmPreview('week'), /Pro required/);
  assert.equal(store.getState().confirmed.week, undefined);
  assert.equal(store.getState().previews.week, preview);
  store.getState().setPreview({ ...preview, overlays: [{ action: 'rest' }] });
  assert.equal(store.getState().confirmPreview('week').confirmation, 'confirmed');
  assert.equal(store.getState().auditHistory.length, 1);
});
