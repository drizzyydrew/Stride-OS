import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import { create } from 'zustand';
import { createJSONStorage } from 'zustand/middleware';
import { LocalDataOwner } from '../../src/lib/localDataOwner';
import type { Activity } from '../../src/types/activity';
import type { GoalArchive } from '../../src/types/goalArchive';
import type { Race } from '../../src/types/plan';
import { createRaceActivityLink, isValidRaceActivityLink, raceEventSnapshot, raceResultFromRecordedLink,
  recordedRaceElapsedSeconds, resolveArchiveActivityResult, resolveRaceActivityResult } from '../../src/utils/raceLink';
import { activityRacePerformance, buildActivityRaceResult, reconcileRacePerformances } from '../../src/utils/racePerformance';
import { nextRacePrLedger } from '../../src/utils/racePrAwards';
import { mergeManualActivityEdit } from '../../src/utils/manualActivityEdit';
import { buildGoalArchive } from '../../src/utils/goalArchive';

const NOW = Date.now();
const START = NOW - 86_400_000;
const DATE = new Date(START);
const day = `${DATE.getFullYear()}-${String(DATE.getMonth() + 1).padStart(2, '0')}-${String(DATE.getDate()).padStart(2, '0')}`;
const race: Race = { id: 'race-one', name: 'Named 5K', date: day, distance: '5k', priority: 'A' };
const event = raceEventSnapshot(race);
const run = (id = 'run'): Activity => ({ id, activityType: 'running', source: 'tracked', status: 'completed', scheduled: false,
  startTime: START, endTime: START + 1200_000, indoor: false,
  metrics: { durationSeconds: 900, activeTimeSeconds: 900, elapsedTimeSeconds: 1200, elapsedTimeSource: 'recorded_wall_clock',
    distanceMeters: 5140, distanceSource: 'gps', recordingPauses: [{ startTime: START + 500_000, endTime: START + 800_000 }],
    routeCoordinates: [{ latitude: 1, longitude: 1, timestamp: START, horizontalAccuracyMeters: 5 }] },
  trainingLoad: { method: 'estimated', wholeBody: 1, running: 1, walking: 0, strength: 0, crossTraining: 0,
    impactBearing: 1, nonImpactAerobic: 0, confidence: 'low' }, createdAt: START, updatedAt: START });
const archive = (result: GoalArchive['result'] = { status: 'unrecorded' }): GoalArchive => ({
  schemaVersion: 1, id: 'archive-one', sourceKey: 'race:one', ownerUserId: 'owner', athleteId: 'athlete_default', title: 'Named 5K',
  kind: 'race', goalType: 'race_prep', startDate: day, endDate: day, archivedAt: NOW, race,
  summary: { completedActivities: 1, partialActivities: 0, activeDays: 1, distanceMeters: 5140, durationSeconds: 900,
    elevationGainMeters: null, trainingLoad: 1, activityIds: ['run'], weeks: [], coverage: { distanceActivities: 1, durationActivities: 1 } }, result });
function load<T>(file: string, mocks: Record<string, unknown>): T {
  const filename = resolve(file), module = { exports: {} };
  const nativeRequire = createRequire(filename);
  vm.runInNewContext(ts.transpileModule(readFileSync(filename, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
  } }).outputText, { module, exports: module.exports,
    require: (id: string) => Object.hasOwn(mocks, id) ? mocks[id] : nativeRequire(id),
    console, Date, Promise, setTimeout, clearTimeout }, { filename });
  return module.exports as T;
}
function deferred() { let resolve!: () => void; const promise = new Promise<void>(done => { resolve = done; }); return { promise, resolve }; }
async function harness(initial: Activity[] = [run()], savedArchives: GoalArchive[] = [archive()]) {
  const values = new Map<string, string>();
  let failKey: string | null = null;
  let writeHook: ((key: string, value: string) => Promise<void>) | undefined;
  const writes: string[] = [];
  const native = { getItem: async (key: string) => values.get(key) ?? null,
    setItem: async (key: string, value: string) => { writes.push(key); await writeHook?.(key, value);
      if (key === failKey) throw new Error('synthetic disk full'); values.set(key, value); },
    removeItem: async (key: string) => { values.delete(key); } };
  const owner = new LocalDataOwner(native);
  await owner.initialize('owner', async () => false); await owner.accept('owner', { offline: true });
  const storage = { ...native, getItemOnce: native.getItem };
  const boundary = { captureOwnerLease: () => owner.capture(), ownerLeaseIsCurrent: (lease: any) => owner.isCurrent(lease) };
  const activities = load<typeof import('../../src/store/activityStore')>('src/store/activityStore.ts', {
    '@react-native-async-storage/async-storage': native,
    './persistStorage': { createAppJSONStorage: () => createJSONStorage(() => storage), getAppStorage: () => storage },
    '../lib/localDataOwner': boundary, '../lib/recalculation': { runRecalculation: () => undefined },
  }).useActivityStore;
  await new Promise<void>(done => setImmediate(done));
  for (const activity of initial) await activities.getState().addActivityAndPersist(activity, owner.capture()!);
  const sync = load<typeof import('../../src/lib/goalArchiveSync')>('src/lib/goalArchiveSync.ts', {
    './localDataOwner': boundary, './supabase': { getSupabaseAvailability: () => ({ status: 'unavailable' }) },
  });
  values.set('goal-archives:owner', JSON.stringify(savedArchives));
  const archives = load<typeof import('../../src/store/goalArchiveStore')>('src/store/goalArchiveStore.ts', {
    '../lib/localDataOwner': boundary, '../lib/goalArchiveSync': sync, './persistStorage': { getAppStorage: () => storage },
  }).useGoalArchiveStore;
  await archives.getState().load(owner.capture()!);
  const profiles = create(() => ({ activeAthleteId: 'athlete_default', getActiveProfile: () => ({ createdAt: 1 }) }));
  const profileStore = Object.assign(profiles, { persist: { hasHydrated: () => true } });
  const plan = { getState: () => ({ races: [race] }), persist: { hasHydrated: () => true } };
  const service = load<typeof import('../../src/lib/raceActivityLink')>('src/lib/raceActivityLink.ts', {
    './localDataOwner': boundary, '../store/activityStore': { useActivityStore: activities },
    '../store/goalArchiveStore': { useGoalArchiveStore: archives }, '../store/profileStore': { useProfileStore: profileStore },
    '../store/trainingPlanStore': { useTrainingPlanStore: plan }, '../store/persistStorage': { getAppStorage: () => storage },
  });
  return { owner, activities, archives, profiles, service, sync, values, writes,
    disk: () => JSON.parse(values.get('activity-store')!).state.activities as Activity[],
    fail: (key: string | null) => { failKey = key; }, hook: (fn: typeof writeHook) => { writeHook = fn; } };
}

test('link snapshots exact course distance, never GPS/rounded goal, and full wall elapsed only after confirmed finish', () => {
  const link = createRaceActivityLink({ ...race, distance: 'half_marathon' }, 'owner', NOW);
  assert.equal(link.event.distanceMeters, 21097.5);
  assert.equal(raceResultFromRecordedLink(link, START, START + 1200_000), undefined);
  const finish = raceResultFromRecordedLink({ ...link, outcome: 'finished' }, START, START + 1200_000)!;
  assert.equal(finish.elapsedTimeSeconds, 1200); assert.equal(finish.timingSource, 'recorded_elapsed');
  for (const [start, end] of [[undefined, START], [START, undefined], [START, START], [START, Infinity]]) {
    assert.equal(raceResultFromRecordedLink({ ...link, outcome: 'finished' }, start, end), undefined);
  }
  assert.ok(raceResultFromRecordedLink({ ...link, event: { ...link.event, date: '2099-01-01' }, outcome: 'finished' }, START, START + 1000));
  assert.equal(isValidRaceActivityLink(link, 'other'), false);
  const synthetic = run(); delete synthetic.metrics.elapsedTimeSource;
  assert.equal(recordedRaceElapsedSeconds(synthetic), null);
  assert.equal(recordedRaceElapsedSeconds(run()), 1200);
});

test('actual service and real Activity/archive stores persist and read back single linked authority without altering raw metrics or frozen totals', async () => {
  const h = await harness(), lease = h.owner.capture()!;
  const metrics = JSON.stringify(h.activities.getState().getById('run')!.metrics), summary = JSON.stringify(h.archives.getState().archives[0].summary);
  const saved = await h.service.saveLink({ activityId: 'run', event, outcome: 'finished', archiveId: 'archive-one' }, lease);
  assert.equal(saved.raceResult?.elapsedTimeSeconds, 1200); assert.equal(saved.raceResult?.distanceMeters, 5000);
  assert.equal(saved.raceResult?.timingSource, 'recorded_elapsed');
  assert.equal(JSON.stringify(saved.metrics), metrics);
  assert.equal(JSON.stringify(h.archives.getState().archives[0].summary), summary);
  assert.deepEqual(JSON.parse(h.values.get('goal-archives:owner')!)[0].result, JSON.parse(JSON.stringify(h.archives.getState().archives[0].result)));
  assert.equal(h.archives.getState().archives[0].result.timeSeconds, undefined);
  assert.equal(resolveArchiveActivityResult(h.archives.getState().archives[0], h.disk(), 'owner').timeSeconds, 1200);
  await h.activities.persist.rehydrate(); await new Promise<void>(done => setImmediate(done));
  assert.equal(h.activities.getState().getById('run')!.raceLink?.event.id, race.id);
  await h.service.saveLink({ activityId: 'run', event, outcome: 'finished' }, lease);
  assert.equal(h.activities.getState().activities.length, 1);
  assert.equal(h.disk()[0].raceResult?.elapsedTimeSeconds, 1200);
});

test('explicit official-time correction updates only result, preserves clock/route evidence, and DNF/Finished correction is coherent', async () => {
  const h = await harness(), lease = h.owner.capture()!;
  const before = JSON.stringify(h.disk()[0].metrics);
  await h.service.saveLink({ activityId: 'run', event, outcome: 'finished' }, lease);
  await h.service.saveLink({ activityId: 'run', event, outcome: 'finished', elapsedTimeSeconds: 1180 }, lease);
  assert.equal(h.disk()[0].raceResult?.timingSource, 'user_entered'); assert.equal(h.disk()[0].raceResult?.elapsedTimeSeconds, 1180);
  const dnf = await h.service.saveLink({ activityId: 'run', event, outcome: 'did_not_finish' }, lease);
  assert.equal(dnf.completionClassification, 'stopped_early'); assert.equal(dnf.status, 'partial');
  assert.equal(dnf.raceResult, undefined); assert.equal(activityRacePerformance(dnf, 'owner'), null);
  const finish = await h.service.saveLink({ activityId: 'run', event, outcome: 'finished' }, lease);
  assert.equal(finish.status, 'completed'); assert.equal(finish.completionClassification, 'modified');
  assert.equal(JSON.stringify(finish.metrics), before);
});

test('date mismatch and existing/manual/pointer replacements require explicit confirmation; blank user stub does not block relinking', async () => {
  const h = await harness([run()], [archive({ status: 'finished', timeSeconds: 1400, source: 'user' })]);
  const lease = h.owner.capture()!;
  await assert.rejects(h.service.saveLink({ activityId: 'run', event, outcome: 'finished' }, lease), /Confirm replacing/);
  await h.service.saveLink({ activityId: 'run', event, outcome: 'finished', replaceExisting: true }, lease);
  await h.service.unlinkLink('run', lease);
  await h.service.saveLink({ activityId: 'run', event, outcome: 'finished' }, lease);
  const otherDay = { ...event, date: '2099-01-01' };
  await h.archives.getState().saveResult('archive-one', { status: 'unrecorded' }, lease);
  h.activities.getState().updateActivity('run', { raceLink: { ...createRaceActivityLink(race, 'owner'), event: otherDay } });
  await assert.rejects(h.service.saveLink({ activityId: 'run', event: otherDay, outcome: 'finished' }, lease), /dates? differ/);
  const saved = await h.service.saveLink({ activityId: 'run', event: otherDay, outcome: 'finished', confirmDateMismatch: true }, lease);
  assert.equal(activityRacePerformance(saved, 'owner')?.date, day);
});

test('activity persistence failure preserves previous claimant and prevents archive pointer replacement; retry repairs both phases', async () => {
  const old = run('old'); old.raceLink = { ...createRaceActivityLink(race, 'owner'), outcome: 'finished' };
  old.raceResult = raceResultFromRecordedLink(old.raceLink, old.startTime, old.endTime);
  const h = await harness([old, run()], [archive({ status: 'unrecorded', source: 'activity_link', linkedActivityId: 'old' })]);
  const lease = h.owner.capture()!; h.fail('activity-store');
  await assert.rejects(h.service.saveLink({ activityId: 'run', event, outcome: 'finished', replaceExisting: true }, lease), /disk full/);
  assert.equal(h.disk().find(row => row.id === 'old')!.raceLink?.event.id, race.id);
  assert.equal(h.archives.getState().archives[0].result.linkedActivityId, 'old');
  h.fail(null);
  await h.service.saveLink({ activityId: 'run', event, outcome: 'finished', replaceExisting: true }, lease);
  assert.equal(h.disk().find(row => row.id === 'old')!.raceLink, undefined);
  assert.equal(h.archives.getState().archives[0].result.linkedActivityId, 'run');
});

test('archive persistence failure reports partial save, never success, and retry does not duplicate activities or finish copies', async () => {
  const h = await harness(), lease = h.owner.capture()!;
  h.fail('goal-archives:owner');
  await assert.rejects(h.service.saveLink({ activityId: 'run', event, outcome: 'finished' }, lease), /disk full/);
  assert.equal(h.disk()[0].raceResult?.elapsedTimeSeconds, 1200);
  assert.equal(h.archives.getState().archives[0].result.source, undefined);
  h.fail(null); await h.service.saveLink({ activityId: 'run', event, outcome: 'finished' }, lease);
  assert.equal(h.disk().length, 1); assert.equal(h.archives.getState().archives[0].result.source, 'activity_link');
});

test('owner invalidation during real pending activity write prevents archive writes and success', async () => {
  const h = await harness(), lease = h.owner.capture()!, gate = deferred(), entered = deferred();
  h.hook(async key => { if (key === 'activity-store') { entered.resolve(); await gate.promise; } });
  const save = h.service.saveLink({ activityId: 'run', event, outcome: 'finished' }, lease);
  await entered.promise; h.owner.block('signed-out'); gate.resolve();
  await assert.rejects(save, /Account changed|original account/);
  assert.equal(h.archives.getState().archives[0].result.source, undefined);
});

test('secondary athlete and incomplete hydration cannot mutate a link; foreign retained link is rejected', async () => {
  const h = await harness(), lease = h.owner.capture()!, before = h.values.get('activity-store');
  h.profiles.setState({ activeAthleteId: 'other' });
  await assert.rejects(h.service.saveLink({ activityId: 'run', event, outcome: 'finished' }, lease), /original account/);
  h.profiles.setState({ activeAthleteId: 'athlete_default' }); h.activities.getState().setHydrationStatus('error');
  await assert.rejects(h.service.saveLink({ activityId: 'run', event, outcome: 'finished' }, lease), /original account/);
  assert.equal(h.values.get('activity-store'), before);
  h.activities.getState().setHydrationStatus('ready');
  h.activities.getState().updateActivity('run', { raceLink: createRaceActivityLink(race, 'foreign') });
  await assert.rejects(h.service.saveLink({ activityId: 'run', event, outcome: 'finished' }, lease), /another owner/);
});

test('unlink after deletion clears only pointers, never recreates an activity or resurrects a copied finish', async () => {
  const h = await harness(), lease = h.owner.capture()!;
  await h.service.saveLink({ activityId: 'run', event, outcome: 'finished' }, lease);
  h.activities.getState().removeActivity('run'); await h.activities.getState().awaitPersistence(lease);
  assert.equal(resolveArchiveActivityResult(h.archives.getState().archives[0], [], 'owner').availability, 'unavailable');
  await h.service.unlinkLink('run', lease);
  assert.equal(h.disk().length, 0);
  assert.equal(h.archives.getState().archives[0].result.status, 'unrecorded');
  assert.equal(h.archives.getState().archives[0].result.linkedActivityId, undefined);
});

test('archive pointer validator rejects copied times and malformed pointers while accepting legacy and referenced results', async () => {
  const h = await harness();
  h.sync.validateGoalArchiveResult({ status: 'unrecorded', source: 'activity_link', linkedActivityId: 'run' });
  h.sync.validateGoalArchiveResult({ status: 'finished', source: 'user', timeSeconds: 1200 });
  for (const value of [{ status: 'finished', source: 'activity_link', linkedActivityId: 'run', timeSeconds: 1200 },
    { status: 'unrecorded', source: 'activity_link' }, { status: 'unrecorded', source: 'user', linkedActivityId: 'run' }]) {
    assert.throws(() => h.sync.validateGoalArchiveResult(value), /Invalid goal archive/);
  }
});

test('one named event has one PR authority; manual archive wins until explicit pointer; corrections and provenance changes never replay badges', () => {
  const activity = run(); activity.raceLink = { ...createRaceActivityLink(race, 'owner'), outcome: 'finished' };
  activity.raceResult = raceResultFromRecordedLink(activity.raceLink, activity.startTime, activity.endTime);
  const manual = archive({ status: 'finished', source: 'user', timeSeconds: 1300, updatedAt: NOW - 100 });
  const before = reconcileRacePerformances([], [manual], [], 'owner', 'athlete_default', NOW, [activity]);
  assert.equal(before.length, 1); assert.equal(before[0].timeSeconds, 1300);
  const seeded = nextRacePrLedger(null, before, 'owner', NOW - 50).ledger;
  const pointer = archive({ status: 'unrecorded', source: 'activity_link', linkedActivityId: activity.id });
  activity.raceResult!.recordedAt = NOW;
  const after = reconcileRacePerformances(before, [pointer], [], 'owner', 'athlete_default', NOW, [activity]);
  assert.equal(after.length, 1); assert.equal(after[0].timeSeconds, 1200); assert.equal(after[0].official, false);
  assert.equal(nextRacePrLedger(seeded, after, 'owner', NOW).notifications.length, 0);
  assert.equal(reconcileRacePerformances(after, [pointer], [], 'owner', 'athlete_default', NOW, []).length, 0);
  const conflict = { ...activity, id: 'duplicate' };
  assert.equal(resolveRaceActivityResult(event, [activity, conflict], 'owner').availability, 'unavailable');
  assert.equal(reconcileRacePerformances([], [pointer], [], 'owner', 'athlete_default', NOW, [activity, conflict]).length, 0);
});

test('manual result edits preserve unrelated links, mark explicit timing, and tombstone incompatible clearing or distance changes', () => {
  const activity = run(); activity.raceLink = { ...createRaceActivityLink(race, 'owner'), outcome: 'finished' };
  activity.raceResult = raceResultFromRecordedLink(activity.raceLink, activity.startTime, activity.endTime);
  const unchanged = mergeManualActivityEdit(activity, { ...activity, notes: 'note' }, new Set(['notes']));
  assert.deepEqual(unchanged.raceLink, activity.raceLink); assert.equal(unchanged.raceLinkUpdatedAt, undefined);
  const timed = mergeManualActivityEdit(activity, { ...activity, raceResult: buildActivityRaceResult('race', '5k', '19:00')! }, new Set(['raceFinishTime']));
  assert.equal(timed.raceResult?.timingSource, 'user_entered'); assert.equal(timed.raceLink?.outcome, 'finished');
  assert.ok(timed.raceLinkUpdatedAt! >= activity.raceLink.linkedAt);
  const cleared = mergeManualActivityEdit(activity, { ...activity, raceResult: undefined }, new Set(['raceResultKind']));
  assert.equal(cleared.raceLink, undefined); assert.equal(cleared.raceResult, undefined); assert.ok(cleared.raceLinkUpdatedAt);
  const distance = mergeManualActivityEdit(activity, { ...activity, raceResult: buildActivityRaceResult('race', '10k', '40:00')! }, new Set(['raceDistanceKey']));
  assert.equal(distance.raceLink, undefined); assert.equal(distance.raceResult?.distanceMeters, 10000);
});


test('new archive captures a unique explicit event pointer without copying a finish; duplicate claimants stay unresolved', () => {
  const activity = run(); activity.raceLink = { ...createRaceActivityLink(race, 'owner'), outcome: 'finished' };
  activity.raceResult = raceResultFromRecordedLink(activity.raceLink, activity.startTime, activity.endTime);
  const { summary: _summary, result: _result, ...descriptor } = archive();
  const built = buildGoalArchive(descriptor, [activity], [], NOW);
  assert.equal(built.result.source, 'activity_link'); assert.equal(built.result.linkedActivityId, 'run');
  assert.equal(built.result.timeSeconds, undefined);
  assert.equal(resolveArchiveActivityResult(built, [activity], 'owner').timeSeconds, 1200);
  const duplicate = buildGoalArchive(descriptor, [activity, { ...activity, id: 'other' }], [], NOW);
  assert.equal(duplicate.result.status, 'unrecorded'); assert.equal(duplicate.result.linkedActivityId, undefined);
});


test('blank user-cleared archive does not block a newly explicit prelinked race, and recorded clock corrections withhold stale finish times', () => {
  const activity = run(); activity.raceLink = { ...createRaceActivityLink(race, 'owner'), outcome: 'finished' };
  activity.raceResult = raceResultFromRecordedLink(activity.raceLink, activity.startTime, activity.endTime);
  const blank = archive({ status: 'unrecorded', source: 'user' });
  assert.equal(resolveArchiveActivityResult(blank, [activity], 'owner').timeSeconds, 1200);
  const rows = reconcileRacePerformances([], [blank], [], 'owner', 'athlete_default', NOW, [activity]);
  assert.equal(rows.length, 1); assert.equal(rows[0].source?.kind, 'activity');
  const correctedClock = { ...activity, endTime: activity.endTime! - 10_000, metrics: { ...activity.metrics, elapsedTimeSeconds: 1190 } };
  assert.equal(activityRacePerformance(correctedClock, 'owner'), null);
  assert.equal(resolveRaceActivityResult(event, [correctedClock], 'owner').timeSeconds, undefined);
});


test('a manual archive correction during a pending link is preserved instead of being silently replaced', async () => {
  const h = await harness(), lease = h.owner.capture()!, gate = deferred(), entered = deferred();
  h.hook(async key => { if (key === 'activity-store') { entered.resolve(); await gate.promise; } });
  const saving = h.service.saveLink({ activityId: 'run', event, outcome: 'finished' }, lease);
  await entered.promise;
  await h.archives.getState().saveResult('archive-one', { status: 'finished', source: 'user', timeSeconds: 1250, updatedAt: Date.now() }, lease);
  gate.resolve();
  await assert.rejects(saving, /changed while linking/);
  assert.equal(h.archives.getState().archives[0].result.timeSeconds, 1250);
  assert.equal(h.archives.getState().archives[0].result.source, 'user');
});
