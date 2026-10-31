import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import { create } from 'zustand';
import { LocalDataOwner } from '../../src/lib/localDataOwner';
import { waitForPersistedStoreHydration } from '../../src/lib/trackingTaskHydration';
import { createHydrationSafeStorage } from '../../src/store/hydrationSafeStorage';
import { addDaysToDateOnly, todayDateOnly } from '../../src/utils/dateOnly';
import { generateBeginnerPlan } from '../../src/utils/beginnerPlans';
import { sundayOf, parseYMD, toYMD } from '../../src/utils/calendarEngine';
import { otherScheduledSessionId } from '../../src/utils/scheduledSessionIds';
import { adaptationWeekKey, type ConfirmedAdaptation } from '../../src/utils/adaptationWorkflow';
import type { Activity } from '../../src/types/activity';
import type { GeneratedBeginnerPlan } from '../../src/types/beginnerPlan';
import type { Race } from '../../src/types/plan';
import type { WeekPlan } from '../../src/utils/trainingEngine';
import type { ScheduledSession } from '../../src/utils/scheduledSessions';

// Execute the production coordinator, archive store, and plan store. Only device,
// auth, cloud, and unrelated store boundaries are replaced; no copied lifecycle.
function loadSource<T>(file: string, mocks: Record<string, unknown>): T {
  const filename = resolve(file);
  const compiled = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} };
  const nativeRequire = createRequire(filename);
  vm.runInNewContext(compiled, { module, exports: module.exports,
    require: (id: string) => Object.hasOwn(mocks, id) ? mocks[id] : nativeRequire(id),
    console, setTimeout, clearTimeout, Date,
  }, { filename });
  return module.exports as T;
}

function store<T extends object>(initial: T) {
  return Object.assign(create<T>(() => initial), { persist: {
    hasHydrated: () => true, onFinishHydration: () => () => undefined,
  } });
}

function gate() {
  let release!: () => void;
  let entered!: () => void;
  const promise = new Promise<void>(done => { release = done; });
  const started = new Promise<void>(done => { entered = done; });
  return { release, started, wait: async () => { entered(); await promise; } };
}

const today = todayDateOnly();
const start = addDaysToDateOnly(today, -28);
const yesterday = addDaysToDateOnly(today, -1);
const future = addDaysToDateOnly(today, 28);
const nextGoal = { title: 'Next strength block', goalType: 'general_strength' as const, endDate: future };
const race = (id: string, date = future, priority: Race['priority'] = 'A'): Race => ({
  id, date, priority, name: id, distance: '5k',
});

async function harness(options: { unfinished?: boolean; races?: Race[]; goalRaceId?: string | null } = {}) {
  const values = new Map<string, string>();
  const ownerValues = new Map<string, string>();
  const owner = new LocalDataOwner({ getItem: async key => ownerValues.get(key) ?? null,
    setItem: async (key, value) => { ownerValues.set(key, value); } });
  await owner.initialize('owner', async () => false);
  await owner.accept('owner', { offline: true });
  const ownership = {
    captureOwnerLease: (cloud = false) => owner.capture(cloud),
    ownerLeaseIsCurrent: (lease: Parameters<LocalDataOwner['isCurrent']>[0], cloud = false) => owner.isCurrent(lease, cloud),
  };
  const events: string[] = [];
  const hooks: {
    archiveWrite?: () => Promise<void>;
    failArchiveWrite?: boolean;
    failPlanWrite?: boolean;
    failNextPlanReadback?: boolean;
    failBeginnerWrite?: boolean;
    failJournalWrite?: boolean;
  } = {};
  const baseAdapter = createHydrationSafeStorage({
    getItem: async key => values.get(key) ?? null,
    setItem: async (key, value) => {
      if (key.startsWith('goal-archives:')) {
        events.push('archive-write');
        await hooks.archiveWrite?.();
        if (hooks.failArchiveWrite) throw new Error('synthetic archive disk full');
      } else if (key === 'training-plan-store') {
        if (hooks.failPlanWrite) throw new Error('synthetic plan disk full');
        events.push('plan-write');
      } else if (key === 'beginner-plan-store' && hooks.failBeginnerWrite) {
        throw new Error('synthetic beginner cache disk full');
      } else if (key.startsWith('goal-transition:') && hooks.failJournalWrite) {
        throw new Error('synthetic transition journal disk full');
      }
      values.set(key, value);
    },
    removeItem: async () => { throw new Error('The coordinator must not delete stored history'); },
  });
  const adapter = { ...baseAdapter, getItemOnce: async (key: string) => {
    if (key === 'training-plan-store' && hooks.failNextPlanReadback) {
      hooks.failNextPlanReadback = false;
      throw new Error('synthetic plan readback unavailable');
    }
    return baseAdapter.getItemOnce(key);
  } };
  const planModule = loadSource<typeof import('../../src/store/trainingPlanStore')>('src/store/trainingPlanStore.ts', {
    './persistStorage': { getAppStorage: () => adapter }, '../lib/localDataOwner': ownership,
  });
  const plan = planModule.useTrainingPlanStore;
  assert.equal(await waitForPersistedStoreHydration(plan), true);
  plan.setState({ initialized: true, programStartDate: start, goalType: options.races ? 'race_prep' : 'general_running',
    goalBlockId: 'original', goalTitle: 'Original block', goalEndDate: options.unfinished ? future : yesterday,
    races: options.races ?? [], goalRaceId: options.goalRaceId ?? null, revision: 1 });
  await planModule.persistTrainingPlanChanges(owner.capture()!);
  const sync = loadSource<typeof import('../../src/lib/goalArchiveSync')>('src/lib/goalArchiveSync.ts', {
    './localDataOwner': ownership,
    './supabase': { getSupabaseAvailability: () => { throw new Error('No live cloud access in coordinator tests'); } },
  });
  const archiveStore = loadSource<typeof import('../../src/store/goalArchiveStore')>('src/store/goalArchiveStore.ts', {
    './persistStorage': { getAppStorage: () => adapter }, '../lib/localDataOwner': ownership, '../lib/goalArchiveSync': sync,
  }).useGoalArchiveStore;
  const journal = loadSource<typeof import('../../src/lib/goalTransitionJournal')>('src/lib/goalTransitionJournal.ts', {
    '../store/persistStorage': { getAppStorage: () => adapter }, './localDataOwner': ownership, './goalArchiveSync': sync,
  });
  const recorded: Activity = {
    id: 'recorded', activityType: 'running', source: 'tracked', status: 'completed', scheduled: false,
    startTime: new Date(`${yesterday}T12:00:00`).getTime(), indoor: false,
    metrics: Object.freeze({ distanceMeters: 5000, durationSeconds: 1800 }),
    trainingLoad: { method: 'session_rpe', wholeBody: 100, running: 100, walking: 0, strength: 0,
      crossTraining: 0, impactBearing: 100, nonImpactAerobic: 0, confidence: 'high' },
    createdAt: 1, updatedAt: 1,
  };
  const activities = Object.freeze([Object.freeze(recorded)]) as unknown as Activity[];
  let activityMutations = 0;
  const forbiddenActivityWrite = () => { activityMutations++; throw new Error('History must remain untouched'); };
  const activity = store({ activities, hydrationStatus: 'ready', addActivity: forbiddenActivityWrite,
    updateActivity: forbiddenActivityWrite, removeActivity: forbiddenActivityWrite });
  const beginnerModule = loadSource<typeof import('../../src/store/beginnerPlanStore')>('src/store/beginnerPlanStore.ts', {
    './persistStorage': { getAppStorage: () => adapter }, '../lib/localDataOwner': ownership,
  });
  const beginner = beginnerModule.useBeginnerPlanStore;
  assert.equal(await waitForPersistedStoreHydration(beginner), true);
  const profile = store({ activeAthleteId: 'athlete_default', profiles: { athlete_default: { racePRs: [] } } });
  const athlete = store({ progressionLevel: 'intermediate', goalRace: 'Original block',
    setGoalRace: (goalRace: string) => athlete.setState({ goalRace }) });
  const onboarding = store({ data: { yearsRunning: 3, weeklyMileage: 20 },
    updateData: (patch: Record<string, unknown>) => onboarding.setState(state => ({ data: { ...state.data, ...patch } })) });
  const run = store({ isActive: false });
  const activeActivity = store({ isActive: false });
  const ride = store({ isActive: false });
  const strength = store<{ session: object | null }>({ session: null });
  const runtime = loadSource<typeof import('../../src/lib/goalLifecycle')>('src/lib/goalLifecycle.ts', {
    './localDataOwner': ownership, './trackingTaskHydration': { waitForPersistedStoreHydration },
    './goalTransitionJournal': journal,
    '../store/trainingPlanStore': planModule,
    '../store/goalArchiveStore': { useGoalArchiveStore: archiveStore },
    '../store/beginnerPlanStore': beginnerModule,
    '../store/activityStore': { useActivityStore: activity },
    '../store/profileStore': { useProfileStore: profile },
    '../store/athleteStore': { useAthleteStore: athlete },
    '../store/onboardingStore': { useOnboardingStore: onboarding },
    '../store/activeRunStore': { useActiveRunStore: run },
    '../store/activeActivityStore': { useActiveActivityStore: activeActivity },
    '../store/activeIndoorRideStore': { useActiveIndoorRideStore: ride },
    '../store/activeStrengthSessionStore': { useActiveStrengthSessionStore: strength },
  });
  plan.subscribe((current, previous) => {
    if (current.trainingMode !== previous.trainingMode) events.push(`mode:${current.trainingMode}`);
    if (current.goalBlockId !== previous.goalBlockId) events.push('new-goal');
  });
  events.length = 0;
  return { runtime, plan, archiveStore, activity, activities, run, activeActivity, ride, strength,
    profile, beginner, beginnerModule, planModule, owner, hooks, events, values,
    get activityMutations() { return activityMutations; } };
}

test('failed archive persistence never retires the active block; retry commits before retiring', async () => {
  const h = await harness();
  h.hooks.failArchiveWrite = true;
  await assert.rejects(h.runtime.reconcileGoalLifecycle(), /archive disk full/);
  assert.equal(h.plan.getState().trainingMode, 'structured');
  assert.equal(h.plan.getState().pendingArchiveId, null);
  assert.equal(h.archiveStore.getState().archives.length, 0);
  assert.equal(h.runtime.useGoalLifecycleRuntime.getState().status, 'error');
  h.hooks.failArchiveWrite = false;
  await h.runtime.reconcileGoalLifecycle();
  assert.equal(h.archiveStore.getState().archives.length, 1);
  assert.equal(h.plan.getState().trainingMode, 'open');
  assert.ok(h.events.indexOf('archive-write') < h.events.indexOf('mode:open'));
});

test('duplicate foreground calls share one operation and preserve the first durable snapshot', async () => {
  const h = await harness();
  const blocked = gate();
  h.hooks.archiveWrite = blocked.wait;
  const first = h.runtime.reconcileGoalLifecycle();
  const second = h.runtime.reconcileGoalLifecycle();
  assert.equal(first, second);
  await blocked.started;
  blocked.release();
  await Promise.all([first, second]);
  const original = JSON.stringify(h.archiveStore.getState().archives);
  await h.runtime.reconcileGoalLifecycle(new Date(Date.now() + 86_400_000));
  assert.equal(h.events.filter(item => item === 'archive-write').length, 1);
  assert.equal(JSON.stringify(h.archiveStore.getState().archives), original);
});

for (const kind of ['run', 'activeActivity', 'ride', 'strength'] as const) {
  test(`an active ${kind} defers archive creation and retirement until recording ends`, async () => {
    const h = await harness();
    if (kind === 'strength') h.strength.setState({ session: {} });
    else h[kind].setState({ isActive: true });
    await h.runtime.reconcileGoalLifecycle();
    assert.equal(h.archiveStore.getState().archives.length, 0);
    assert.equal(h.plan.getState().trainingMode, 'structured');
    if (kind === 'strength') h.strength.setState({ session: null });
    else h[kind].setState({ isActive: false });
    await h.runtime.reconcileGoalLifecycle();
    assert.equal(h.archiveStore.getState().archives.length, 1);
    assert.equal(h.plan.getState().trainingMode, 'open');
  });
}

test('owner revocation while an archive write awaits prevents retirement and later goal changes', async () => {
  const h = await harness();
  const blocked = gate();
  h.hooks.archiveWrite = blocked.wait;
  const pending = h.runtime.reconcileGoalLifecycle();
  await blocked.started;
  await h.owner.signOut();
  blocked.release();
  await assert.rejects(pending, /owner changed|account changed/i);
  assert.equal(h.plan.getState().trainingMode, 'structured');
  assert.equal(h.plan.getState().goalBlockId, 'original');
  await assert.rejects(h.runtime.startNextGoal(nextGoal), /Sign in/);
});

test('a source revision changed during the archive await is not retired', async () => {
  const h = await harness();
  const blocked = gate();
  h.hooks.archiveWrite = blocked.wait;
  const pending = h.runtime.reconcileGoalLifecycle();
  await blocked.started;
  h.plan.getState().beginGoal({ ...nextGoal, startDate: today });
  blocked.release();
  await pending;
  assert.equal(h.plan.getState().trainingMode, 'structured');
  assert.equal(h.plan.getState().goalTitle, nextGoal.title);
});

test('starting a new goal preserves the expired archive and does not mutate activities', async () => {
  const h = await harness();
  const before = JSON.stringify(h.activities);
  await h.runtime.startNextGoal(nextGoal);
  assert.equal(h.plan.getState().goalTitle, nextGoal.title);
  assert.equal(h.plan.getState().trainingMode, 'structured');
  assert.equal(h.plan.getState().activePresetGoal, null);
  assert.equal(h.archiveStore.getState().archives[0].sourceKey, 'goal:original');
  assert.equal(h.activity.getState().activities, h.activities);
  assert.equal(JSON.stringify(h.activities), before);
  assert.equal(h.activityMutations, 0);
});

test('choosing open training keeps the archive and actual history while clearing the pending prompt', async () => {
  const h = await harness();
  await h.runtime.continueOpenTraining();
  assert.equal(h.plan.getState().trainingMode, 'open');
  assert.equal(h.plan.getState().pendingArchiveId, null);
  assert.equal(h.archiveStore.getState().archives.length, 1);
  assert.equal(h.activity.getState().activities, h.activities);
  assert.equal(h.activityMutations, 0);
});

for (const choice of ['next', 'open'] as const) {
  test(`unfinished-focus journal must be durable before the explicit ${choice} choice`, async () => {
    const h = await harness({ unfinished: true });
    h.hooks.failJournalWrite = true;
    const change = () => choice === 'next' ? h.runtime.startNextGoal(nextGoal) : h.runtime.continueOpenTraining();
    await assert.rejects(change(), /transition journal disk full/);
    assert.equal(h.plan.getState().goalBlockId, 'original');
    assert.equal(h.plan.getState().trainingMode, 'structured');
    assert.equal(h.archiveStore.getState().archives.length, 0);
    h.hooks.failJournalWrite = false;
    await change();
    const saved = h.archiveStore.getState().archives[0];
    assert.equal(saved.sourceKey, 'goal:original');
    assert.equal(saved.closureReason, choice === 'next' ? 'replaced' : 'open_training');
    assert.equal(saved.endDate, today);
    assert.ok(saved.macroPlan);
    assert.equal(h.activityMutations, 0);
  });
}

test('replacement preserves future A and B races with their original dates before changing the plan', async () => {
  const h = await harness({ unfinished: true, races: [race('future-A'), race('future-B', addDaysToDateOnly(future, 7), 'B')] });
  await h.runtime.startNextGoal(nextGoal);
  const saved = h.archiveStore.getState().archives;
  assert.deepEqual(JSON.parse(JSON.stringify(saved.map(item => item.sourceKey).sort())), ['race:future-A', 'race:future-B']);
  assert.ok(saved.every(item => item.closureReason === 'replaced' && item.endDate === today && item.race!.date > today));
  const before = JSON.stringify(saved);
  await h.runtime.reconcileGoalLifecycle(new Date(`${addDaysToDateOnly(future, 8)}T12:00:00`));
  assert.equal(JSON.stringify(h.archiveStore.getState().archives.filter(item => item.kind === 'race')), before);
});

test('a future primary after an expired B race keeps structured programming active', async () => {
  const h = await harness({ races: [race('B', yesterday, 'B'), race('A')] });
  await h.runtime.reconcileGoalLifecycle();
  assert.equal(h.plan.getState().trainingMode, 'structured');
  assert.deepEqual(JSON.parse(JSON.stringify(h.archiveStore.getState().archives.map(item => item.sourceKey))), ['race:B']);
});

test('switching away from the default athlete during archive persistence must prevent retirement', async () => {
  const h = await harness();
  const blocked = gate();
  h.hooks.archiveWrite = blocked.wait;
  const pending = h.runtime.reconcileGoalLifecycle();
  await blocked.started;
  h.profile.setState({ activeAthleteId: 'another-athlete' });
  blocked.release();
  await pending.catch(() => undefined);
  assert.equal(h.plan.getState().trainingMode, 'structured', 'a no-longer-default athlete must not trigger shared-plan retirement');
});

test('a recording starting during reconciliation must prevent an explicit next-goal choice', async () => {
  const h = await harness();
  const blocked = gate();
  h.hooks.archiveWrite = blocked.wait;
  const pending = h.runtime.startNextGoal(nextGoal);
  await blocked.started;
  h.run.setState({ isActive: true });
  blocked.release();
  await pending.catch(() => undefined);
  assert.equal(h.plan.getState().goalBlockId, 'original', 'a new recording must fence the choice after all awaits');
});

test('unfinished beginner replacement archives the full original plan before changing focus', async () => {
  const h = await harness({ unfinished: true });
  const beginner = generateBeginnerPlan({ goal: 'couch_to_5k', startingLevel: 'walking', continuousWalkMinutes: 35,
    continuousRunMinutes: 0, recentConsistentWeeks: 4, availableDaysPerWeek: 4,
    hasCurrentSymptoms: false, crossTrainingExperience: false, startDate: start }, 'running');
  h.beginner.setState({ activePlan: beginner });
  h.plan.getState().setActivePresetGoal({ goal: beginner.goal, planId: beginner.id,
    selectedAt: Date.now(), targetDate: beginner.targetDate });
  await h.runtime.startNextGoal(nextGoal);
  const saved = h.archiveStore.getState().archives.find(item => item.sourceKey === `beginner:${beginner.id}`);
  assert.ok(saved);
  assert.equal(saved.closureReason, 'replaced');
  assert.equal(JSON.stringify(saved.beginnerPlan), JSON.stringify(beginner));
  assert.equal(h.beginner.getState().activePlan, beginner);
});

// Hook modules are evaluated with their actual projection utilities and a
// synchronous useMemo boundary, so these assertions exercise the real resolver.
const useMemo = <T,>(calculate: () => T) => calculate();
const selector = <T,>(source: { getState: () => T }) => <U,>(select: (state: T) => U) => select(source.getState());

test('a new race goal uses the same target in Calendar timeline as the active week plan', async () => {
  const h = await harness({ unfinished: true, races: [race('old-future-A')] });
  await h.runtime.startNextGoal({ title: 'New race focus', goalType: 'race_prep', endDate: addDaysToDateOnly(future, 14),
    race: { ...race('new'), date: addDaysToDateOnly(future, 14) } });
  const hook = loadSource<typeof import('../../src/hooks/usePlanTimeline')>('src/hooks/usePlanTimeline.ts', {
    react: { useMemo },
    '../store/trainingPlanStore': { useTrainingPlanStore: selector(h.plan) },
    '../store/goalArchiveStore': { useGoalArchiveStore: selector(h.archiveStore) },
    '../store/athleteStore': { useAthleteStore: selector(store({ progressionLevel: 'intermediate' })) },
    '../store/onboardingStore': { useOnboardingStore: selector(store({ data: { yearsRunning: 3, weeklyMileage: 20 } })) },
  });
  const timeline = hook.usePlanTimeline();
  assert.equal(timeline.macroPlan?.targetRaceId, h.plan.getState().goalRaceId,
    'archived future races must not remain the Calendar macro target');
});

test('starting a new structured goal must not inject a moved snapshot from the archived block', async () => {
  const h = await harness({ unfinished: true });
  await h.runtime.startNextGoal(nextGoal);
  const old: ScheduledSession = { scheduledSessionId: 'old-block-session', date: yesterday, originalDate: yesterday,
    trainingBlockId: 'original', activityType: 'mobility', subtype: 'recovery', title: 'Old moved mobility',
    purpose: 'Original block only', priority: 'optional', durationMinutes: 10, target: 'Easy', status: 'upcoming' };
  const selection = store({ selectedByDate: {}, removedFromToday: {}, dateOverrides: {},
    moveLedger: { [old.scheduledSessionId]: { targetDate: today, movedAt: Date.now(), snapshot: old } } });
  const hook = loadSource<typeof import('../../src/hooks/useScheduledSessions')>('src/hooks/useScheduledSessions.ts', {
    react: { useMemo },
    '../store/trainingPlanStore': { useTrainingPlanStore: selector(h.plan) },
    '../store/goalArchiveStore': { useGoalArchiveStore: selector(h.archiveStore) },
    '../store/beginnerPlanStore': { useBeginnerPlanStore: selector(h.beginner) },
    '../store/activityStore': { useActivityStore: selector(h.activity) },
    '../store/scheduledSessionSelectionStore': { useScheduledSessionSelectionStore: selector(selection) },
    '../store/adaptationStore': { useAdaptationStore: selector(store({ confirmed: {} })) },
    '../store/onboardingStore': { useOnboardingStore: selector(store({ data: { availableDays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] } })) },
  });
  const week = { weekStartDate: sundayOf(parseYMD(today)), calendarMap: new Map(),
    metadata: { trainingMode: 'structured' } } as WeekPlan;
  const sessions = hook.useScheduledSessions(week, parseYMD(today));
  assert.equal(sessions.weekSessions.some(item => item.scheduledSessionId === old.scheduledSessionId), false,
    'new structured programming must exclude the archived source block too');
});

test('a current-block move and confirmed adaptation both apply after starting a new goal', async () => {
  const h = await harness({ unfinished: true });
  await h.runtime.startNextGoal(nextGoal);
  const plan = h.plan.getState();
  assert.ok(plan.goalBlockId);
  assert.ok(plan.programmingStartedAt);
  const weekStart = addDaysToDateOnly(toYMD(sundayOf(parseYMD(today))), 7);
  const originalDate = addDaysToDateOnly(weekStart, 1);
  const targetDate = addDaysToDateOnly(weekStart, 2);
  const current: ScheduledSession = { scheduledSessionId: otherScheduledSessionId(originalDate, 'mobility', 'Current mobility'),
    trainingBlockId: plan.goalBlockId, date: originalDate, originalDate, activityType: 'mobility', subtype: 'mobility',
    title: 'Current mobility', purpose: 'Current block', priority: 'optional', durationMinutes: 20,
    target: 'Easy', status: 'upcoming' };
  const changed = { ...current, durationMinutes: 12, target: '12 min recovery' };
  const confirmed: ConfirmedAdaptation = { id: 'current-preview', weekKey: adaptationWeekKey(weekStart),
    reason: 'low_energy', createdAt: plan.programmingStartedAt, confirmedAt: plan.programmingStartedAt,
    confirmation: 'confirmed', unchangedSessionIds: [], summary: 'Current recovery adaptation', conflicts: [],
    overlays: [{ id: 'current-overlay', scheduledSessionId: current.scheduledSessionId, action: 'replaced',
      original: current, adapted: changed, reason: 'low_energy', explanation: 'Current recovery adaptation',
      intentPreserved: true, createdAt: plan.programmingStartedAt }] };
  const selection = store({ selectedByDate: {}, removedFromToday: {}, dateOverrides: {},
    moveLedger: { [current.scheduledSessionId]: { targetDate, movedAt: plan.programmingStartedAt, snapshot: current } } });
  const adaptations = store({ confirmed: { [confirmed.weekKey]: confirmed } });
  const ledgerBefore = JSON.stringify(selection.getState());
  const adaptationBefore = JSON.stringify(adaptations.getState());
  const hook = loadSource<typeof import('../../src/hooks/useScheduledSessions')>('src/hooks/useScheduledSessions.ts', {
    react: { useMemo },
    '../store/trainingPlanStore': { useTrainingPlanStore: selector(h.plan) },
    '../store/goalArchiveStore': { useGoalArchiveStore: selector(h.archiveStore) },
    '../store/beginnerPlanStore': { useBeginnerPlanStore: selector(h.beginner) },
    '../store/activityStore': { useActivityStore: selector(h.activity) },
    '../store/scheduledSessionSelectionStore': { useScheduledSessionSelectionStore: selector(selection) },
    '../store/adaptationStore': { useAdaptationStore: selector(adaptations) },
    '../store/onboardingStore': { useOnboardingStore: selector(store({ data: { availableDays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] } })) },
  });
  const week = { weekStartDate: parseYMD(weekStart), calendarMap: new Map([[originalDate, [{ date: originalDate,
    type: 'mobility', label: current.title, color: '#888888', completed: false }]]]),
    metadata: { trainingMode: 'structured' } } as WeekPlan;
  const result = hook.useScheduledSessions(week, parseYMD(today));
  assert.equal(result.weekSessions.length, 1);
  assert.equal(result.weekSessions[0].scheduledSessionId, current.scheduledSessionId);
  assert.equal(result.weekSessions[0].trainingBlockId, plan.goalBlockId);
  assert.equal(result.weekSessions[0].date, targetDate);
  assert.equal(result.weekSessions[0].originalDate, originalDate);
  assert.equal(result.weekSessions[0].durationMinutes, 12);
  assert.equal(result.weekSessions[0].adaptationReason, 'Current recovery adaptation');
  assert.equal(JSON.stringify(selection.getState()), ledgerBefore);
  assert.equal(JSON.stringify(adaptations.getState()), adaptationBefore);
});

test('failed next-goal write with an unfinished source never publishes or archives its draft on retry', async () => {
  const h = await harness({ unfinished: true });
  const originalDisk = h.values.get('training-plan-store');
  h.hooks.failPlanWrite = true;
  await assert.rejects(h.runtime.startNextGoal(nextGoal), /plan disk full/);
  assert.equal(h.plan.getState().goalBlockId, 'original');
  assert.equal(h.plan.getState().goalTitle, 'Original block');
  assert.equal(h.values.get('training-plan-store'), originalDisk);
  assert.equal(h.events.includes('new-goal'), false);
  assert.equal(h.archiveStore.getState().archives.length, 0, 'failed primary save cannot publish a final archive');
  h.hooks.failPlanWrite = false;
  await h.runtime.startNextGoal(nextGoal);
  assert.equal(h.plan.getState().goalTitle, nextGoal.title);
  assert.notEqual(h.plan.getState().goalBlockId, 'original');
  assert.equal(h.archiveStore.getState().archives.length, 1);
  assert.equal(h.archiveStore.getState().archives[0].sourceKey, 'goal:original');
  const selectedId = h.plan.getState().goalBlockId;
  const finalArchives = JSON.stringify(h.archiveStore.getState().archives);
  await h.runtime.startNextGoal(nextGoal);
  assert.equal(h.plan.getState().goalBlockId, selectedId);
  assert.equal(JSON.stringify(h.archiveStore.getState().archives), finalArchives, 'completed request retry must be idempotent');
  assert.equal(JSON.parse(h.values.get('training-plan-store')!).state.goalBlockId, h.plan.getState().goalBlockId);
  assert.equal(h.activity.getState().activities, h.activities);
  assert.equal(h.activityMutations, 0);
});

function beginnerPlan(goal: GeneratedBeginnerPlan['goal'], startDate = today): GeneratedBeginnerPlan {
  return generateBeginnerPlan({ goal, startingLevel: 'walking', continuousWalkMinutes: 35,
    continuousRunMinutes: 0, recentConsistentWeeks: 4, availableDaysPerWeek: 4,
    hasCurrentSymptoms: false, crossTrainingExperience: false, startDate }, 'running');
}

async function seedBeginner(h: Awaited<ReturnType<typeof harness>>) {
  const old = beginnerPlan('couch_to_5k', start);
  // Preserve a real repeat-week audit as well as the originally generated plan.
  h.beginner.getState().setActivePlan(old);
  h.beginner.getState().repeatWeek(1);
  const repeated = h.beginner.getState().activePlan!;
  await h.beginnerModule.saveBeginnerPlanChoice(repeated, h.owner.capture()!);
  h.plan.getState().setActivePresetGoal({ goal: repeated.goal, planId: repeated.id,
    selectedAt: Date.now(), targetDate: repeated.targetDate });
  return repeated;
}

test('switching unfinished beginner paths preserves the full old plan and audit before publishing the new path', async () => {
  const h = await harness({ unfinished: true });
  const old = await seedBeginner(h);
  assert.ok(old.adaptationAudit?.length);
  const oldBody = JSON.stringify(old);
  const replacement = beginnerPlan('couch_to_10k');
  await h.runtime.activateBeginnerGoal(replacement);
  const archives = h.archiveStore.getState().archives;
  assert.equal(archives.length, 1);
  assert.equal(archives[0].sourceKey, `beginner:${old.id}`);
  assert.equal(archives[0].closureReason, 'replaced');
  assert.equal(JSON.stringify(archives[0].beginnerPlan), oldBody);
  assert.equal(h.beginner.getState().activePlan?.id, replacement.id);
  assert.equal(h.plan.getState().activePresetGoal?.planId, replacement.id);
  assert.equal(h.plan.getState().trainingMode, 'structured');
  assert.equal(JSON.parse(h.values.get('beginner-plan-store')!).state.activePlan.id, replacement.id);
  assert.equal(JSON.parse(h.values.get('training-plan-store')!).state.activePresetGoal.planId, replacement.id);
  assert.equal(JSON.stringify(old), oldBody);
  assert.equal(h.activityMutations, 0);
});

test('an active workout blocks old-to-new beginner switching before either plan or archive changes', async () => {
  const h = await harness({ unfinished: true });
  const old = await seedBeginner(h);
  const diskBefore = h.values.get('beginner-plan-store');
  h.run.setState({ isActive: true });
  await assert.rejects(h.runtime.activateBeginnerGoal(beginnerPlan('couch_to_10k')), /Finish your current workout/);
  assert.equal(h.beginner.getState().activePlan, old);
  assert.equal(h.plan.getState().activePresetGoal?.planId, old.id);
  assert.equal(h.values.get('beginner-plan-store'), diskBefore);
  assert.equal(h.archiveStore.getState().archives.length, 0);
  assert.equal(h.activityMutations, 0);
});

test('a retained beginner plan with a missing preset pointer is fully archived before replacement', async () => {
  const h = await harness({ unfinished: true });
  const orphan = await seedBeginner(h);
  h.plan.getState().clearActivePresetGoal();
  assert.equal(h.plan.getState().activePresetGoal, null);
  const originalBody = JSON.stringify(orphan);
  const replacement = beginnerPlan('couch_to_10k');
  await h.runtime.activateBeginnerGoal(replacement);
  const preserved = h.archiveStore.getState().archives.filter(item => item.sourceKey === `beginner:${orphan.id}`);
  assert.equal(preserved.length, 1);
  assert.equal(preserved[0].closureReason, 'replaced');
  assert.equal(JSON.stringify(preserved[0].beginnerPlan), originalBody);
  assert.equal(h.beginner.getState().activePlan?.id, replacement.id);
  assert.equal(h.plan.getState().activePresetGoal?.planId, replacement.id);
  assert.equal(h.activity.getState().activities, h.activities);
  assert.equal(h.activityMutations, 0);
});

test('orphan archive failure after primary commit recovers the accepted replacement and archives the orphan once', async () => {
  const h = await harness({ unfinished: true });
  const orphan = await seedBeginner(h);
  h.plan.getState().clearActivePresetGoal();
  const originalDisk = h.values.get('beginner-plan-store');
  const replacement = beginnerPlan('couch_to_10k');
  let attempts = 0;
  h.hooks.archiveWrite = async () => {
    // First write preserves the current general focus; the second is the
    // retained beginner path whose preset pointer was missing.
    if (++attempts === 2) throw new Error('synthetic orphan archive failure');
  };
  await assert.rejects(h.runtime.activateBeginnerGoal(replacement), /orphan archive failure/);
  assert.equal(attempts, 2);
  assert.equal(h.plan.getState().activePresetGoal?.planId, replacement.id);
  assert.equal(h.runtime.currentBeginnerPlan()?.id, replacement.id);
  assert.equal(h.values.get('beginner-plan-store'), originalDisk);
  h.hooks.archiveWrite = undefined;
  await h.runtime.activateBeginnerGoal(replacement);
  const preserved = h.archiveStore.getState().archives.filter(item => item.sourceKey === `beginner:${orphan.id}`);
  assert.equal(preserved.length, 1);
  assert.equal(JSON.stringify(preserved[0].beginnerPlan), JSON.stringify(orphan));
  assert.equal(h.beginner.getState().activePlan?.id, replacement.id);
  assert.equal(h.plan.getState().activePresetGoal?.planId, replacement.id);
  assert.equal(h.activityMutations, 0);
});

function assertUsablePrimaryBeginnerSchedule(h: Awaited<ReturnType<typeof harness>>, expected: GeneratedBeginnerPlan) {
  assert.equal(h.runtime.currentBeginnerPlan()?.id, expected.id);
  assert.equal(h.plan.getState().activePresetGoal?.planId, expected.id);
  assert.equal(JSON.stringify(h.plan.getState().activePresetPlan), JSON.stringify(expected));
  const hook = loadSource<typeof import('../../src/hooks/useScheduledSessions')>('src/hooks/useScheduledSessions.ts', {
    react: { useMemo },
    '../store/trainingPlanStore': { useTrainingPlanStore: selector(h.plan) },
    '../store/goalArchiveStore': { useGoalArchiveStore: selector(h.archiveStore) },
    '../store/beginnerPlanStore': { useBeginnerPlanStore: selector(h.beginner) },
    '../store/activityStore': { useActivityStore: selector(h.activity) },
    '../store/scheduledSessionSelectionStore': { useScheduledSessionSelectionStore: selector(store({
      selectedByDate: {}, removedFromToday: {}, dateOverrides: {}, moveLedger: {},
    })) },
    '../store/adaptationStore': { useAdaptationStore: selector(store({ confirmed: {} })) },
    '../store/onboardingStore': { useOnboardingStore: selector(store({ data: {
      availableDays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    } })) },
  });
  const week = { weekStartDate: sundayOf(parseYMD(addDaysToDateOnly(today, 7))), calendarMap: new Map(),
    metadata: { trainingMode: 'structured' } } as WeekPlan;
  const resolved = hook.useScheduledSessions(week, parseYMD(today));
  assert.equal(resolved.activeBeginnerPlan?.id, expected.id);
  assert.ok(resolved.weekSessions.length > 0, 'the primary plan must still produce usable scheduled sessions');
  assert.ok(resolved.weekSessions.every(session => session.goalPlanId === expected.id));
  assert.equal(h.activity.getState().activities, h.activities);
  assert.equal(h.activityMutations, 0);
}

test('beginner write success then readback failure rehydrates a matching full primary plan despite the old legacy cache', async () => {
  const h = await harness({ unfinished: true });
  const old = await seedBeginner(h);
  const legacyBefore = h.values.get('beginner-plan-store');
  const historyBefore = JSON.stringify(h.activities);
  const replacement = beginnerPlan('couch_to_10k');
  h.hooks.failNextPlanReadback = true;
  await assert.rejects(h.runtime.activateBeginnerGoal(replacement), /plan readback unavailable/);
  assert.equal(h.hooks.failNextPlanReadback, false, 'the injected one-shot confirmation failure was exercised');
  const durable = JSON.parse(h.values.get('training-plan-store')!).state;
  assert.equal(durable.activePresetGoal.planId, replacement.id);
  assert.equal(JSON.stringify(durable.activePresetPlan), JSON.stringify(replacement),
    'the actual successful disk write must contain pointer and full body together');
  assert.equal(h.plan.getState().activePresetGoal?.planId, old.id, 'unconfirmed choice remains unpublished before relaunch');
  assert.equal(h.beginner.getState().activePlan?.id, old.id);
  assert.equal(h.values.get('beginner-plan-store'), legacyBefore);
  // Use real Zustand hydration, not manual setState, to reproduce relaunch from
  // the successful primary write while the compatibility cache remains stale.
  await h.plan.persist.rehydrate();
  assert.equal(h.plan.persist.hasHydrated(), true);
  assert.equal(h.beginner.getState().activePlan?.id, old.id);
  assert.equal(h.archiveStore.getState().archives.length, 0, 'unconfirmed primary choice has not published final archives');
  await h.runtime.reconcileGoalLifecycle();
  assertUsablePrimaryBeginnerSchedule(h, replacement);
  assert.equal(JSON.stringify(h.activities), historyBefore);
  const savedOld = h.archiveStore.getState().archives.find(item => item.sourceKey === `beginner:${old.id}`);
  assert.equal(JSON.stringify(savedOld?.beginnerPlan), JSON.stringify(old));
});

test('a failed legacy beginner-cache write cannot reject or orphan the accepted full primary plan', async () => {
  const h = await harness({ unfinished: true });
  const old = await seedBeginner(h);
  const legacyBefore = h.values.get('beginner-plan-store');
  const replacement = beginnerPlan('couch_to_10k');
  h.hooks.failBeginnerWrite = true;
  await h.runtime.activateBeginnerGoal(replacement);
  assert.equal(h.beginner.getState().activePlan?.id, old.id);
  assert.equal(h.values.get('beginner-plan-store'), legacyBefore);
  const durable = JSON.parse(h.values.get('training-plan-store')!).state;
  assert.equal(durable.activePresetGoal.planId, replacement.id);
  assert.equal(JSON.stringify(durable.activePresetPlan), JSON.stringify(replacement));
  assertUsablePrimaryBeginnerSchedule(h, replacement);
});

test('failed unfinished beginner primary save keeps the old schedule selected and publishes no final archives', async () => {
  const h = await harness({ unfinished: true });
  const old = await seedBeginner(h);
  h.plan.setState({ activePresetPlan: old });
  await h.planModule.persistTrainingPlanChanges(h.owner.capture()!);
  const replacement = beginnerPlan('couch_to_10k');
  h.hooks.failPlanWrite = true;
  await assert.rejects(h.runtime.activateBeginnerGoal(replacement), /plan disk full/);
  assert.equal(h.archiveStore.getState().archives.length, 0);
  assert.equal(JSON.parse(h.values.get('goal-transition:owner')!).status, 'prepared');
  assertUsablePrimaryBeginnerSchedule(h, old);
  assert.equal(JSON.parse(h.values.get('training-plan-store')!).state.activePresetGoal.planId, old.id);
  h.hooks.failPlanWrite = false;
  await h.runtime.activateBeginnerGoal(replacement);
  assertUsablePrimaryBeginnerSchedule(h, replacement);
  assert.equal(h.archiveStore.getState().archives.length, 1);
  assert.equal(h.archiveStore.getState().archives[0].sourceKey, `beginner:${old.id}`);
  assert.equal(JSON.parse(h.values.get('goal-transition:owner')!).status, 'complete');
});

for (const choice of ['next', 'open'] as const) {
  test(`post-commit ${choice} archive failure recovers final archives once without replacing the accepted primary`, async () => {
    const h = await harness({ unfinished: true });
    const change = () => choice === 'next' ? h.runtime.startNextGoal(nextGoal) : h.runtime.continueOpenTraining();
    h.hooks.failArchiveWrite = true;
    await assert.rejects(change(), /archive disk full/);
    assert.equal(h.plan.getState().trainingMode, choice === 'next' ? 'structured' : 'open');
    if (choice === 'next') assert.equal(h.plan.getState().goalTitle, nextGoal.title);
    assert.equal(h.archiveStore.getState().archives.length, 0);
    const transitionId = h.plan.getState().lastTransitionId;
    assert.ok(transitionId);
    assert.equal(JSON.parse(h.values.get('training-plan-store')!).state.lastTransitionId, transitionId);
    assert.equal(JSON.parse(h.values.get('goal-transition:owner')!).status, 'prepared');
    h.hooks.failArchiveWrite = false;
    await h.runtime.reconcileGoalLifecycle();
    const recovered = JSON.stringify(h.archiveStore.getState().archives);
    assert.equal(h.archiveStore.getState().archives.length, 1);
    assert.equal(h.archiveStore.getState().archives[0].sourceKey, 'goal:original');
    assert.equal(JSON.parse(h.values.get('goal-transition:owner')!).status, 'complete');
    await change();
    assert.equal(h.plan.getState().lastTransitionId, transitionId);
    assert.equal(JSON.stringify(h.archiveStore.getState().archives), recovered);
    assert.equal(h.activityMutations, 0);
  });
}

test('beginner retry after successful primary write with failed readback recovers in ready and deduplicates a regenerated request', async () => {
  const h = await harness({ unfinished: true });
  const old = await seedBeginner(h);
  const replacement = beginnerPlan('couch_to_10k');
  h.hooks.failNextPlanReadback = true;
  await assert.rejects(h.runtime.activateBeginnerGoal(replacement), /plan readback unavailable/);
  assert.equal(h.archiveStore.getState().archives.length, 0);
  assert.equal(h.plan.getState().activePresetGoal?.planId, old.id);
  const durableTransition = JSON.parse(h.values.get('training-plan-store')!).state.lastTransitionId;
  // A reopened form can generate a new plan ID for the same intended choice.
  // The real ready() recovery must adopt the durable first choice before dedup.
  const retry = { ...replacement, id: `${replacement.id}_regenerated` };
  await h.runtime.activateBeginnerGoal(retry);
  assert.equal(h.plan.getState().activePresetGoal?.planId, replacement.id);
  assert.equal(h.plan.getState().lastTransitionId, durableTransition);
  assertUsablePrimaryBeginnerSchedule(h, replacement);
  assert.equal(h.archiveStore.getState().archives.length, 1);
  assert.equal(h.archiveStore.getState().archives[0].sourceKey, `beginner:${old.id}`);
  assert.equal(JSON.parse(h.values.get('goal-transition:owner')!).status, 'complete');
});
