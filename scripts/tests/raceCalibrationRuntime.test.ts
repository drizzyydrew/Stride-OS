import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import { createJSONStorage } from 'zustand/middleware';
import { LocalDataOwner, type OwnerLease } from '../../src/lib/localDataOwner';
import type { Activity } from '../../src/types/activity';
import type { AthleteProfile } from '../../src/types/athlete';
import type { GoalArchive } from '../../src/types/goalArchive';
import { createDefaultProfile } from '../../src/utils/calibrationEngine';
import { todayDateOnly } from '../../src/utils/dateOnly';
import { buildActivityRaceResult } from '../../src/utils/racePerformance';

const NOW = Date.now();
const day = todayDateOnly(new Date(NOW - 86_400_000));
const run = (id = 'run', date = NOW - 86_400_000): Activity => ({
  id, activityType: 'running', source: 'tracked', status: 'completed', scheduled: false,
  startTime: date, indoor: false, metrics: { durationSeconds: 1000, distanceMeters: 5100 },
  trainingLoad: { method: 'estimated', wholeBody: 0, running: 0, walking: 0, strength: 0, crossTraining: 0,
    impactBearing: 0, nonImpactAerobic: 0, confidence: 'low' }, createdAt: date, updatedAt: date,
  raceResult: buildActivityRaceResult('race', '5k', '25:00')!,
});
const snapshot = (): GoalArchive => ({
  schemaVersion: 1, id: 'race-archive', sourceKey: 'race:one', ownerUserId: 'owner', athleteId: 'athlete_default',
  title: 'Half', kind: 'race', goalType: 'race_prep', startDate: day, endDate: day, archivedAt: NOW,
  race: { id: 'event', date: day, name: 'Half', distance: 'half_marathon', priority: 'A' },
  summary: { completedActivities: 0, partialActivities: 0, activeDays: 0, distanceMeters: null, durationSeconds: null,
    elevationGainMeters: null, trainingLoad: null, activityIds: [], weeks: [], coverage: { distanceActivities: 0, durationActivities: 0 } },
  result: { status: 'finished', timeSeconds: 7200, source: 'user' },
});

async function harness() {
  const values = new Map<string, string>();
  const owner = new LocalDataOwner({ getItem: async key => values.get(key) ?? null, setItem: async (key, value) => { values.set(key, value); } });
  await owner.initialize('owner', async () => false);
  await owner.accept('owner', { offline: true });
  const hydration = { profile: true, athlete: true, custom: true };
  const profile = { activeAthleteId: 'athlete_default', profiles: { athlete_default: {
    ...createDefaultProfile({ athleteId: 'athlete_default', name: 'Tester', vo2Estimate: 40 }),
    hrMax: 195, hrMaxManual: true, racePRs: [],
  } } as Record<string, AthleteProfile>, updateProfile: async (_id: string, _patch: Partial<AthleteProfile>) => {} };
  const athlete = { weeklyMileage: 20, trainingPhase: 'base', fatigueScore: 25, recoveryScore: 75 };
  const activities = { hydrationStatus: 'ready', activities: [run()] };
  let loads = 0;
  let onArchiveLoad: ((lease: OwnerLease) => Promise<void>) | null = null;
  const archives = { status: 'ready', syncStatus: 'local', ownerUserId: 'owner' as string | null, archives: [] as GoalArchive[],
    load: async (lease: OwnerLease) => {
      loads++;
      if (onArchiveLoad) await onArchiveLoad(lease);
      else { archives.ownerUserId = lease.ownerUserId; archives.status = 'ready'; archives.syncStatus = 'synced'; }
    } };
  const custom = { logs: [] };
  let writes = 0;
  let failWrite = false;
  let beforeWrite: (() => Promise<void>) | null = null;
  profile.updateProfile = async (id, patch) => {
    writes++;
    await beforeWrite?.();
    if (failWrite) throw new Error('synthetic disk full');
    profile.profiles[id] = { ...profile.profiles[id], ...patch, updatedAt: Date.now() };
  };
  const filename = resolve('src/lib/raceCalibration.ts');
  const compiled = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} };
  const store = (get: () => unknown, hydrated?: () => boolean) => ({ getState: get, persist: { hasHydrated: hydrated } });
  const mocks: Record<string, unknown> = {
    './localDataOwner': { captureOwnerLease: () => owner.capture(), ownerLeaseIsCurrent: (lease: Parameters<LocalDataOwner['isCurrent']>[0]) => owner.isCurrent(lease) },
    '../store/activityStore': { useActivityStore: store(() => activities) },
    '../store/athleteStore': { useAthleteStore: store(() => athlete, () => hydration.athlete) },
    '../store/customWorkoutStore': { useCustomWorkoutStore: store(() => custom, () => hydration.custom) },
    '../store/goalArchiveStore': { useGoalArchiveStore: store(() => archives) },
    '../store/profileStore': { useProfileStore: store(() => profile, () => hydration.profile) },
  };
  const nativeRequire = createRequire(filename);
  vm.runInNewContext(compiled, { module, exports: module.exports, require: (id: string) => Object.hasOwn(mocks, id) ? mocks[id] : nativeRequire(id), console, Date }, { filename });
  return { owner, profile, athlete, activities, archives, hydration,
    reconcile: (module.exports as typeof import('../../src/lib/raceCalibration')).reconcileRaceCalibration,
    writes: () => writes, loads: () => loads,
    archiveLoad: (value: typeof onArchiveLoad) => { onArchiveLoad = value; },
    fail: (value: boolean) => { failWrite = value; }, gate: (value: typeof beforeWrite) => { beforeWrite = value; } };
}

test('production coordinator links explicit result, updates VDOT/predictions and remains idempotent without editing raw workout or HR evidence', async () => {
  const h = await harness();
  const raw = JSON.stringify(h.activities.activities);
  assert.equal(await h.reconcile(NOW), 'updated');
  const profile = h.profile.profiles.athlete_default;
  assert.equal(profile.racePRs.length, 1);
  assert.equal(profile.calibration?.primarySource, 'race_pr');
  assert.ok(profile.calibration?.racePredictions?.length);
  assert.equal(profile.vdot, profile.calibration?.vdot);
  assert.equal(profile.hrMax, 195);
  assert.equal(profile.hrMaxManual, true);
  assert.equal(JSON.stringify(h.activities.activities), raw);
  assert.equal(await h.reconcile(NOW), 'unchanged');
  assert.equal(h.writes(), 1);
});

test('production coordinator corrects/deletes source-linked result and predictions, while keeping a manual PR', async () => {
  const h = await harness();
  h.archives.archives = [snapshot()];
  h.activities.activities = [];
  h.profile.profiles.athlete_default.racePRs = [{ id: 'manual', distanceKey: '5k', distanceLabel: '5K', distanceMeters: 5000,
    timeSeconds: 1800, date: day, official: true }];
  await h.reconcile(NOW);
  assert.equal(h.profile.profiles.athlete_default.racePRs.length, 2);
  h.archives.archives = [snapshot()];
  h.archives.archives[0].result.timeSeconds = 6900;
  assert.equal(await h.reconcile(NOW), 'updated');
  assert.equal(h.profile.profiles.athlete_default.racePRs.find(pr => pr.source)?.timeSeconds, 6900);
  h.archives.archives[0].result = { status: 'unrecorded' };
  assert.equal(await h.reconcile(NOW), 'updated');
  assert.deepEqual(h.profile.profiles.athlete_default.racePRs.map(pr => pr.id), ['manual']);
});

test('failed writes retry; an unsuccessful derived save is never cached as complete', async () => {
  const h = await harness();
  h.fail(true);
  await assert.rejects(h.reconcile(NOW), /synthetic disk full/);
  h.fail(false);
  assert.equal(await h.reconcile(NOW), 'updated');
  assert.equal(h.writes(), 2);
});

test('no profile mutation or archive reads before hydration, complete Activity reads and supported default athlete', async () => {
  for (const block of ['profile', 'athlete', 'custom', 'activity', 'athlete_id'] as const) {
    const h = await harness();
    if (['profile', 'athlete', 'custom'].includes(block)) h.hydration[block as keyof typeof h.hydration] = false;
    if (block === 'activity') h.activities.hydrationStatus = 'error';
    if (block === 'athlete_id') h.profile.activeAthleteId = 'other';
    assert.equal(await h.reconcile(NOW), 'deferred', block);
    assert.equal(h.writes(), 0, block);
    assert.equal(h.loads(), 0, block);
  }
});

test('direct Activity/Profile entry loads the existing owner archives once before automatic calibration', async () => {
  const h = await harness();
  h.archives.status = 'loading'; h.archives.ownerUserId = null;
  h.archiveLoad(async lease => {
    assert.equal(lease.ownerUserId, 'owner');
    h.archives.ownerUserId = lease.ownerUserId;
    h.archives.archives = [snapshot()]; h.archives.status = 'ready';
  });
  assert.equal(await h.reconcile(NOW), 'updated');
  assert.equal(h.loads(), 1);
  assert.equal(h.profile.profiles.athlete_default.racePRs.length, 2);
  assert.equal(await h.reconcile(NOW), 'unchanged');
  assert.equal(h.loads(), 1);
});

test('archive read failure retains current PRs and calibration and succeeds on retry without an empty-evidence write', async () => {
  const h = await harness();
  await h.reconcile(NOW);
  const retained = h.profile.profiles.athlete_default;
  h.archives.status = 'error';
  h.archiveLoad(async () => { throw new Error('synthetic archive storage unavailable'); });
  await assert.rejects(h.reconcile(NOW), /archive storage unavailable/);
  assert.equal(h.profile.profiles.athlete_default, retained);
  assert.equal(h.writes(), 1);
  h.archiveLoad(null);
  assert.equal(await h.reconcile(NOW), 'unchanged');
  assert.equal(h.loads(), 2);
  assert.equal(h.writes(), 1);
});

test('owner change while loading archives prevents any subsequent profile write', async () => {
  const h = await harness();
  const retained = h.profile.profiles.athlete_default;
  h.archives.status = 'loading'; h.archives.ownerUserId = null;
  h.archiveLoad(async () => { await h.owner.signOut(); h.archives.status = 'ready'; h.archives.ownerUserId = 'owner'; });
  assert.equal(await h.reconcile(NOW), 'deferred');
  assert.equal(h.writes(), 0);
  assert.equal(h.profile.profiles.athlete_default, retained);
});

test('profile, Activity hydration and athlete identity are rechecked after archive loading', async () => {
  for (const block of ['profile', 'activity', 'athlete_id'] as const) {
    const h = await harness();
    h.archives.status = 'loading';
    h.archiveLoad(async () => {
      h.archives.status = 'ready';
      if (block === 'profile') h.hydration.profile = false;
      if (block === 'activity') h.activities.hydrationStatus = 'error';
      if (block === 'athlete_id') h.profile.activeAthleteId = 'other';
    });
    assert.equal(await h.reconcile(NOW), 'deferred', block);
    assert.equal(h.writes(), 0, block);
  }
});

test('archive load re-reads current profile edits and queued refreshes do not issue duplicate loads', async () => {
  const h = await harness();
  h.archives.status = 'loading';
  h.archiveLoad(async () => {
    await Promise.resolve();
    h.profile.profiles.athlete_default = { ...h.profile.profiles.athlete_default, name: 'Latest edited name',
      hrMax: 199, racePRs: [{ id: 'manual-during-load', distanceKey: '10k', distanceLabel: '10K', distanceMeters: 10000,
        timeSeconds: 3300, date: day, official: true }] };
    h.archives.status = 'ready';
  });
  await Promise.all([h.reconcile(NOW), h.reconcile(NOW)]);
  assert.equal(h.loads(), 1);
  assert.equal(h.writes(), 1);
  assert.equal(h.profile.profiles.athlete_default.name, 'Latest edited name');
  assert.equal(h.profile.profiles.athlete_default.hrMax, 199);
  assert.ok(h.profile.profiles.athlete_default.racePRs.some(pr => pr.id === 'manual-during-load'));
});

test('unconfirmed offline or failed cloud read with missing linked archive preserves exact profile instead of inferring deletion', async () => {
  const h = await harness();
  h.archives.archives = [snapshot()];
  await h.reconcile(NOW);
  const retained = h.profile.profiles.athlete_default;
  const writes = h.writes();
  h.archives.archives = [];
  h.activities.activities[0] = { ...run(), raceResult: buildActivityRaceResult('race', '5k', '24:00')! };
  for (const status of ['local', 'error', 'syncing']) {
    h.archives.syncStatus = status;
    h.archiveLoad(async () => { h.archives.status = 'ready'; h.archives.syncStatus = status; });
    await assert.rejects(h.reconcile(NOW), /saved archive source/);
    assert.equal(h.profile.profiles.athlete_default, retained, status);
    assert.equal(h.writes(), writes, status);
  }
});

test('confirmed archive recovery permits source removal; offline present-source result edits remain usable', async () => {
  const h = await harness();
  const manual = { id: 'manual', distanceKey: '10k' as const, distanceLabel: '10K', distanceMeters: 10000,
    timeSeconds: 3300, date: day, official: true };
  h.profile.profiles.athlete_default.racePRs = [manual];
  h.archives.archives = [snapshot()];
  await h.reconcile(NOW);
  h.archives.syncStatus = 'error';
  h.archives.archives[0].result.timeSeconds = 7000;
  assert.equal(await h.reconcile(NOW), 'updated');
  assert.equal(h.profile.profiles.athlete_default.racePRs.find(pr => pr.source?.kind === 'goal_archive')!.timeSeconds, 7000);
  h.archives.archives = [];
  h.archiveLoad(async () => { h.archives.status = 'ready'; h.archives.syncStatus = 'error'; });
  const retained = h.profile.profiles.athlete_default;
  await assert.rejects(h.reconcile(NOW), /saved archive source/);
  assert.equal(h.profile.profiles.athlete_default, retained);
  h.archiveLoad(null);
  assert.equal(await h.reconcile(NOW), 'updated');
  assert.equal(h.profile.profiles.athlete_default.racePRs.some(pr => pr.source?.kind === 'goal_archive'), false);
  assert.equal(h.profile.profiles.athlete_default.racePRs.find(pr => pr.id === 'manual'), manual);
});

test('ordinary training completions refresh confidence/history without being promoted to a race or replacing explicit HRmax', async () => {
  const h = await harness();
  h.activities.activities = [run('one'), run('two')].map(activity => ({ ...activity, raceResult: undefined }));
  await h.reconcile(NOW);
  const before = h.profile.profiles.athlete_default.calibration!.confidenceScore;
  h.activities.activities = Array.from({ length: 12 }, (_, index) => ({ ...run(`history-${index}`), raceResult: undefined }));
  assert.equal(await h.reconcile(NOW), 'updated');
  assert.ok(h.profile.profiles.athlete_default.calibration!.confidenceScore > before);
  assert.equal(h.profile.profiles.athlete_default.racePRs.length, 0);
  assert.equal(h.profile.profiles.athlete_default.hrMax, 195);
});

test('queued refresh reads latest result rather than replaying a stale snapshot', async () => {
  const h = await harness();
  let release!: () => void;
  let entered!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  const started = new Promise<void>(resolve => { entered = resolve; });
  h.gate(async () => { entered(); await pending; });
  const first = h.reconcile(NOW);
  await started;
  h.activities.activities[0] = { ...run(), raceResult: buildActivityRaceResult('race', '5k', '24:00')! };
  const second = h.reconcile(NOW);
  h.gate(null); release();
  await first; await second;
  assert.equal(h.profile.profiles.athlete_default.racePRs[0].timeSeconds, 1440);
  assert.equal(h.writes(), 2);
});

test('signed-out and owner-invalidated state cannot produce a new calibration', async () => {
  const h = await harness();
  await h.owner.signOut();
  assert.equal(await h.reconcile(NOW), 'deferred');
  assert.equal(h.writes(), 0);
});

test('actual Activity store normalizes, durably saves, rehydrates and edits explicit race metadata without changing raw recorded metrics', async () => {
  const values = new Map<string, string>();
  const native = { getItem: async (key: string) => values.get(key) ?? null,
    setItem: async (key: string, value: string) => { values.set(key, value); },
    removeItem: async (key: string) => { values.delete(key); } };
  const owner = new LocalDataOwner(native);
  await owner.initialize('owner', async () => false);
  await owner.accept('owner');
  const storage = { ...native, getItemOnce: native.getItem };
  const filename = resolve('src/store/activityStore.ts');
  const compiled = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2016, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} };
  const mocks: Record<string, unknown> = {
    '@react-native-async-storage/async-storage': native,
    './persistStorage': { createAppJSONStorage: () => createJSONStorage(() => storage), getAppStorage: () => storage },
    '../lib/localDataOwner': { captureOwnerLease: () => owner.capture(), ownerLeaseIsCurrent: (lease: Parameters<LocalDataOwner['isCurrent']>[0]) => owner.isCurrent(lease) },
    '../lib/recalculation': { runRecalculation: async () => undefined },
  };
  const nativeRequire = createRequire(filename);
  vm.runInNewContext(compiled, { module, exports: module.exports,
    require: (id: string) => Object.hasOwn(mocks, id) ? mocks[id] : nativeRequire(id),
    console, Date, Promise, setTimeout, clearTimeout }, { filename });
  const store = (module.exports as typeof import('../../src/store/activityStore')).useActivityStore;
  await new Promise<void>(resolve => setImmediate(resolve));
  assert.equal(store.getState().hydrationStatus, 'ready');
  const original = run();
  const id = await store.getState().addActivityAndPersist(original, owner.capture()!);
  const disk = () => JSON.parse(values.get('activity-store')!).state.activities as Activity[];
  assert.deepEqual(disk()[0].raceResult, original.raceResult);
  const measured = JSON.stringify(store.getState().getById(id)!.metrics);
  await store.persist.rehydrate();
  await new Promise<void>(resolve => setImmediate(resolve));
  assert.deepEqual(store.getState().getById(id)!.raceResult, original.raceResult);
  store.getState().updateActivity(id, { raceResult: buildActivityRaceResult('race', '5k', '24:00')! });
  await store.getState().awaitPersistence(owner.capture()!);
  assert.equal(disk()[0].raceResult!.elapsedTimeSeconds, 1440);
  assert.equal(JSON.stringify(store.getState().getById(id)!.metrics), measured);
  store.getState().updateActivity(id, { raceResult: undefined });
  await store.getState().awaitPersistence(owner.capture()!);
  assert.equal(disk()[0].raceResult, undefined);
  assert.equal(JSON.stringify(store.getState().getById(id)!.metrics), measured);
});
