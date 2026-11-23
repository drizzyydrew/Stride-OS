import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
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

test('all nonempty schedule adaptations require Pro, while an empty preview has no paid change', () => {
  for (const action of ['rest', 'reduced', 'remove_intensity', 'unchanged', 'removed', 'moved', 'convert_easy', 'active_recovery']) {
    assert.equal(adaptationNeedsPro([{ action }]), true, action);
  }
  assert.equal(adaptationNeedsPro([]), false);
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

test('inactive membership cannot confirm persisted schedule changes, including rest, and keeps previews intact', () => {
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
  for (const action of ['rest', 'reduced', 'moved', 'removed', 'convert_easy', 'active_recovery']) {
    const retained = { ...preview, overlays: [{ action }] };
    allowed = true; store.getState().setPreview(retained); allowed = false;
    assert.throws(() => store.getState().confirmPreview('week'), /Pro required/);
    assert.equal(store.getState().previews.week, retained);
    assert.equal(store.getState().confirmed.week, undefined);
  }
  assert.equal(store.getState().auditHistory.length, 0);
  allowed = true;
  assert.equal(store.getState().confirmPreview('week').confirmation, 'confirmed');
  assert.equal(store.getState().auditHistory.length, 1);
});


test('inactive users cannot remove, move or undo a scheduled date; denied writes preserve the complete selection state', () => {
  let allowed = true;
  const api = loadSource('src/store/scheduledSessionSelectionStore.ts', {
    zustand: { create }, 'zustand/middleware': { persist: (initializer: unknown) => initializer },
    '@react-native-async-storage/async-storage': {}, './persistStorage': { createAppJSONStorage: () => ({}) },
    '../utils/scheduleMoveLedger': { legacyOverridesToMoveLedger: () => ({}) },
    '../lib/pro-access': { assertProAccess: (feature: string) => { assert.equal(feature, 'schedule-changes'); if (!allowed) throw new Error('Pro required'); } },
  });
  const store = api.useScheduledSessionSelectionStore;
  store.getState().selectForDate('2026-11-23', 's1');
  store.getState().rescheduleSession('s1', '2026-11-24');
  const before = JSON.stringify(store.getState());
  allowed = false;
  for (const action of [() => store.getState().removeFromToday('2026-11-23', 's1'),
    () => store.getState().rescheduleSession('s1', '2026-11-25'), () => store.getState().clearReschedule('s1')]) {
    assert.throws(action, /Pro required/);
    assert.equal(JSON.stringify(store.getState()), before);
  }
  allowed = true;
  store.getState().clearReschedule('s1');
  assert.equal(store.getState().dateOverrides.s1, undefined);
  store.getState().removeFromToday('2026-11-23', 's1');
  assert.equal(store.getState().isRemovedFromToday('2026-11-23', 's1'), true);
});

test('actual distance correction, pause and completion remain available when premium schedule access is denied', () => {
  const filename = resolve('src/store/activeRunStore.ts');
  const nativeRequire = createRequire(filename);
  let billingCalls = 0;
  const mocks: Record<string, unknown> = {
    '@react-native-async-storage/async-storage': {},
    'zustand/middleware': { persist },
    './persistStorage': { createAppJSONStorage: () => createJSONStorage(() => ({ getItem: () => null, setItem() {}, removeItem() {} })) },
    './settingsStore': { useSettingsStore: { getState: () => ({ autoPauseMode: 'off' }) } },
    '../lib/voiceCue': { enqueueVoiceCue() {} },
    '../lib/localDataOwner': { captureOwnerLease: () => ({ ownerUserId: 'a' }), ownerLeaseIsCurrent: () => true },
    '../lib/pro-access': { assertProAccess: () => { billingCalls++; throw new Error('Pro required'); } },
  };
  const module = { exports: {} as any };
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
  } }).outputText;
  vm.runInNewContext(compiled, { module, exports: module.exports, Date, console, setTimeout, clearTimeout,
    require: (id: string) => Object.hasOwn(mocks, id) ? mocks[id] : nativeRequire(id) }, { filename });
  const run = module.exports.useActiveRunStore;
  const startedAt = Date.now() - 60_000;
  run.getState().startRun(null, { mode: 'quick', environment: 'indoor', workoutInstanceId: 'free-stop', startedAtMs: startedAt });
  run.getState().setManualLiveDistance(1.25);
  assert.equal(run.getState().manualDistanceMiles, 1.25);
  run.getState().pauseRun(); assert.equal(run.getState().isPaused, true);
  const endedAt = Date.now(); run.getState().requestCompletion(endedAt);
  assert.equal(run.getState().completionRequestedAt, endedAt);
  assert.equal(billingCalls, 0, 'recording actual work and stopping must never require a subscription');
});
