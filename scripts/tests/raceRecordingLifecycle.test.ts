import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import { createJSONStorage } from 'zustand/middleware';
import { LocalDataOwner } from '../../src/lib/localDataOwner';
import { RunCompletionJournal, RUN_COMPLETION_JOURNAL_KEY, type LiveRunEntry } from '../../src/lib/runCompletionJournal';
import { captureTrainingRunEnd } from '../../src/utils/trainingRunEndSnapshot';
import { activityFromWorkoutRecord } from '../../src/utils/activityMigration';
import { activityRacePerformance } from '../../src/utils/racePerformance';
import { recordedRunPerformances } from '../../src/utils/recordedRunPerformances';
import { createRaceActivityLink } from '../../src/utils/raceLink';
import type { ActiveRunStore } from '../../src/store/activeRunStore';
import type { RaceActivityLink } from '../../src/types/raceLink';
import type { Activity } from '../../src/types/activity';

const START = Date.UTC(2026, 10, 10, 16);
const EVENT = { id: 'synthetic-short-clock-race', name: 'Synthetic named 5K', date: '2026-11-10', distance: '5k' as const };

/** Execute production stores and completion commands; replace platform I/O only. */
function loadSource(file: string, mocks: Record<string, unknown>) {
  const filename = resolve(file);
  const require = createRequire(filename);
  const module = { exports: {} as any };
  const compiled = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(compiled, { module, exports: module.exports,
    require: (id: string) => Object.hasOwn(mocks, id) ? mocks[id] : require(id),
    console, setTimeout, clearTimeout, URL, Date, process: { env: {} } }, { filename });
  return module.exports;
}

async function fixture() {
  const values = new Map<string, string>();
  const disk = { getItem: async (key: string) => values.get(key) ?? null,
    setItem: async (key: string, value: string) => { values.set(key, value); },
    removeItem: async (key: string) => { values.delete(key); } };
  const owner = new LocalDataOwner(disk);
  await owner.initialize('A', async () => true); await owner.accept('A');
  let failActivityFlush = false;
  const confirmedDisk = { ...disk, setItem: async (key: string, value: string) => {
    if (key === 'activity-store' && failActivityFlush) throw new Error('race fixture activity flush failed');
    await disk.setItem(key, value);
  } };
  const ownership = { captureOwnerLease: (cloud = false) => owner.capture(cloud),
    ownerLeaseIsCurrent: (lease: any, cloud = false) => owner.isCurrent(lease, cloud) };
  const persistence = { createAppJSONStorage: () => createJSONStorage(() => disk), getAppStorage: () => confirmedDisk };
  async function stores() {
    const active = loadSource('src/store/activeRunStore.ts', {
      '@react-native-async-storage/async-storage': {}, './persistStorage': persistence,
      './settingsStore': { useSettingsStore: { getState: () => ({ autoPauseMode: 'off' }) } },
      '../lib/voiceCue': { enqueueVoiceCue() {} },
    }).useActiveRunStore;
    const activity = loadSource('src/store/activityStore.ts', {
      '@react-native-async-storage/async-storage': {}, './persistStorage': persistence,
      '../lib/localDataOwner': ownership, '../lib/recalculation': { runRecalculation() {} },
    }).useActivityStore;
    const workout = loadSource('src/store/workoutStore.ts', {
      '@react-native-async-storage/async-storage': {}, './persistStorage': persistence,
      './activityStore': { useActivityStore: activity }, '../lib/localDataOwner': ownership,
      '../lib/syncService': { syncWorkoutLog: async () => {}, deleteWorkoutLog: async () => {} },
      '../lib/externalIntegrations': { syncCompletedWorkoutToExternalServices: async () => {} },
      '../utils/training': { calculateTrainingLoad: () => 10 },
      '../utils/calculateFatigue': { calculateUpdatedFatigue: () => 10 },
    }).useWorkoutStore;
    await Promise.all([active, activity, workout].map(store => store.persist.hasHydrated() ? Promise.resolve()
      : new Promise<void>(done => { const off = store.persist.onFinishHydration(() => { off(); done(); }); })));
    const athlete = { currentWeek: 1, fatigueScore: 10, recoveryScore: 70, setFatigueScore() {}, setRecentEasyLoad() {} };
    const command = loadSource('src/lib/runCompletionCommand.ts', {
      '../store/activeRunStore': { useActiveRunStore: active }, '../store/workoutStore': { useWorkoutStore: workout },
      '../store/activityStore': { useActivityStore: activity }, './localDataOwner': ownership,
      '../store/athleteStore': { useAthleteStore: { getState: () => athlete, persist: { hasHydrated: () => true } } },
    });
    return { active, activity, workout, complete: command.completeRunCommand as (command: any) => Promise<any> };
  }
  return { ...await stores(), owner, values, disk, stores,
    failActivityFlush: (fail: boolean) => { failActivityFlush = fail; },
    journal: () => new RunCompletionJournal(disk),
  };
}

function start(active: any, link = createRaceActivityLink(EVENT, 'A', START), id = 'linked-recording') {
  active.getState().startRun(null, { mode: 'race', environment: 'outdoor', startedAtMs: START, workoutInstanceId: id, raceLink: link });
}

function firstEnd(active: any, at: number, outcome?: 'finished' | 'did_not_finish'): LiveRunEntry {
  const instance = active.getState().workoutInstanceId;
  if (outcome) assert.equal(active.getState().confirmRaceOutcome(instance, outcome, 'A'), true);
  // Match the production Finish callback's synchronous confirm + first-End latch.
  active.getState().requestCompletion(at);
  return captureTrainingRunEnd(active.getState() as ActiveRunStore,
    { workoutInstanceId: instance, endedAt: active.getState().completionRequestedAt });
}

function stopDialog(h: Awaited<ReturnType<typeof fixture>>, stopped: () => void) {
  const filename = 'app/(tabs)/training/index.tsx';
  const source = ts.createSourceFile(filename, readFileSync(filename, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let declaration: ts.FunctionDeclaration | undefined;
  function visit(node: ts.Node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === 'requestStop') declaration = node;
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.ok(declaration, 'the production race Finish/End handler exists');
  const compiled = ts.transpileModule(`${declaration.getText(source)}\nglobalThis.requestStop = requestStop;`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const alerts: { title: string; buttons: { text: string; onPress?: () => void }[] }[] = [];
  const context: Record<string, any> = {
    useActiveRunStore: h.active,
    useProfileStore: { getState: () => ({ activeAthleteId: 'athlete_default' }) },
    captureOwnerLease: () => h.owner.capture(), ownerLeaseIsCurrent: (lease: any) => h.owner.isCurrent(lease),
    Alert: { alert: (title: string, _message: string, buttons = []) => { alerts.push({ title, buttons }); } },
    stop: stopped, Date,
  };
  vm.runInNewContext(compiled, context, { filename });
  context.requestStop();
  return { alerts, buttons: alerts.find(alert => alert.title === 'Save race result')!.buttons };
}

test('short linked race keeps first outcome and full elapsed through failed commit, journal restart and normalized Activity', async t => {
  let clock = START;
  t.mock.method(Date, 'now', () => clock);
  const h = await fixture(); start(h.active);
  // Synthetic route is approximately 800 measured meters; named event distance remains separate.
  for (let second = 0; second <= 120; second += 10) {
    clock = START + second * 1000;
    if (second === 40) h.active.getState().pauseRun();
    if (second === 70) h.active.getState().resumeRun();
    h.active.getState().addLocationUpdate({ timestamp: clock, coords: {
      latitude: 0, longitude: second * 0.00008, altitude: 0, accuracy: 5, speed: 8.9,
    } });
  }
  const entry = firstEnd(h.active, clock, 'finished');
  assert.equal(entry.durationMinutes, 1.5);
  assert.equal(entry.activityMetrics!.elapsedTimeSeconds, 120);
  assert.equal(h.active.getState().confirmRaceOutcome('linked-recording', 'did_not_finish', 'A'), false);
  h.active.getState().requestCompletion(clock + 10_000);
  assert.equal(h.active.getState().completionRequestedAt, START + 120_000);
  h.failActivityFlush(true);
  await assert.rejects(h.workout.getState().commitRunEnd(entry, 1, 10, 70, () => {}, () => {}, true), /flush failed/);
  const retained = await h.journal().read();
  assert.equal(retained.length, 1);
  assert.equal(retained[0].discarded, false, 'explicit linked race survives the generic under-five-minute discard');
  assert.equal(retained[0].entry.raceLink!.outcome, 'finished');
  await h.journal().save({ ...retained[0], entry: { ...entry,
    actualEndTime: clock + 10_000, raceLink: { ...entry.raceLink!, outcome: 'did_not_finish' } } });
  assert.equal((await h.journal().read())[0].entry.actualEndTime, clock);
  h.failActivityFlush(false);
  const recovered = await h.stores();
  await recovered.workout.getState().restorePendingCompletions();
  await recovered.workout.getState().restorePendingCompletions();
  assert.equal(recovered.workout.getState().history.length, 1);
  assert.equal(recovered.activity.getState().activities.length, 1);
  const result: Activity = recovered.activity.getState().activities[0];
  assert.equal(result.workoutInstanceId, 'linked-recording');
  assert.equal(result.raceLink!.ownerUserId, 'A'); assert.equal(result.raceLink!.outcome, 'finished');
  assert.equal(result.raceResult!.elapsedTimeSeconds, 120, 'full elapsed includes the thirty-second pause');
  assert.equal(result.raceResult!.distanceMeters, 5000, 'explicit course distance is independent of GPS total');
  assert.ok(result.metrics.distanceMeters! < 1200);
  assert.equal(activityRacePerformance(result, 'A', clock)!.timeSeconds, 120);
  assert.equal((await h.journal().read()).length, 0);
  const savedBytes = JSON.parse(h.values.get('activity-store')!).state.activities[0];
  assert.equal(savedBytes.raceLink.outcome, 'finished');
  assert.equal(savedBytes.raceResult.elapsedTimeSeconds, 120);
  clock += 10_000;
  const replay = await recovered.complete({ workoutInstanceId: 'linked-recording', endedAt: clock });
  assert.equal(replay.entry.actualEndTime, START + 120_000, 'a later End command retains the first saved elapsed time');
  assert.equal(replay.entry.raceLink.outcome, 'finished');
  assert.equal(recovered.activity.getState().activities.length, 1);
});

test('generic Watch End leaves a linked result unrecorded; explicit early stop remains DNF without a PR', async t => {
  let clock = START; t.mock.method(Date, 'now', () => clock);
  for (const outcome of ['unrecorded', 'did_not_finish'] as const) {
    clock = START;
    const h = await fixture(); start(h.active);
    clock += 120_000;
    if (outcome === 'did_not_finish') firstEnd(h.active, clock, outcome);
    await h.complete({ workoutInstanceId: 'linked-recording', endedAt: clock });
    const saved: Activity = h.activity.getState().activities[0];
    assert.equal(saved.raceLink!.outcome, outcome);
    assert.equal(saved.raceResult, undefined);
    assert.equal(activityRacePerformance(saved, 'A', clock), null);
    if (outcome === 'did_not_finish') {
      assert.equal(saved.completionClassification, 'stopped_early');
      assert.deepEqual(recordedRunPerformances(saved, 'A', clock), []);
    }
    assert.equal(h.workout.getState().history.length, 1, 'short linked recording is retained for review');
  }
});

test('race metadata rejects foreign owners and stale confirms, then clears on an unrelated next start', async t => {
  let clock = START; t.mock.method(Date, 'now', () => clock);
  const h = await fixture();
  const link = createRaceActivityLink(EVENT, 'A', START);
  start(h.active, link);
  link.event.name = 'mutated caller';
  assert.equal(h.active.getState().raceLink.event.name, EVENT.name, 'start captures immutable event metadata');
  assert.equal(h.active.getState().confirmRaceOutcome('other-recording', 'finished', 'A'), false);
  assert.equal(h.active.getState().confirmRaceOutcome('linked-recording', 'finished', 'B'), false);
  clock += 120_000;
  const entry = firstEnd(h.active, clock);
  const foreign: RaceActivityLink = { ...entry.raceLink!, ownerUserId: 'B' };
  await assert.rejects(h.journal().save({ ownerUserId: 'A', entry: { ...entry, raceLink: foreign },
    week: 1, fatigue: 10, recovery: 70 }), /valid owner/);
  await assert.rejects(h.workout.getState().commitRunEnd({ ...entry, raceLink: foreign }, 1, 10, 70, () => {}, () => {}, true), /owner/);
  assert.equal(h.workout.getState().history.length, 0);
  h.active.getState().startRun(null, { mode: 'quick', workoutInstanceId: 'next-recording' });
  assert.equal(h.active.getState().raceLink, null);
  assert.equal(h.active.getState().completionRequestedAt, null);
  assert.equal(h.active.getState().workoutInstanceId, 'next-recording');
  assert.equal(h.values.has(RUN_COMPLETION_JOURNAL_KEY), false);
});

test('an explicit saved unlink tombstone survives an older workout projection through the real Activity merge path', async t => {
  let clock = START; t.mock.method(Date, 'now', () => clock);
  const h = await fixture(); start(h.active);
  clock += 120_000;
  const entry = firstEnd(h.active, clock, 'finished');
  await h.workout.getState().commitRunEnd(entry, 1, 10, 70, () => {}, () => {}, true);
  const record = h.workout.getState().history[0];
  const original: Activity = h.activity.getState().activities[0];
  assert.ok(original.raceLink);
  h.activity.getState().updateActivity(original.id, { raceLink: undefined, raceResult: undefined,
    raceLinkUpdatedAt: clock + 1000 });
  h.activity.getState().addActivity(activityFromWorkoutRecord(record, false));
  const edited: Activity = h.activity.getState().activities[0];
  assert.equal(h.activity.getState().activities.length, 1);
  assert.equal(edited.raceLink, undefined);
  assert.equal(edited.raceResult, undefined);
  assert.equal(activityRacePerformance(edited, 'A', clock), null);
  h.activity.getState().updateActivity(original.id, { raceLink: { ...original.raceLink!, outcome: 'did_not_finish' },
    raceResult: undefined, completionClassification: 'stopped_early', raceLinkUpdatedAt: clock + 2000 });
  h.activity.getState().addActivity(activityFromWorkoutRecord(record, false));
  const stopped: Activity = h.activity.getState().activities[0];
  assert.equal(stopped.raceLink!.outcome, 'did_not_finish');
  assert.equal(stopped.completionClassification, 'stopped_early');
  assert.equal(stopped.raceResult, undefined);
  assert.deepEqual(recordedRunPerformances(stopped, 'A', clock), []);
});

test('actual Finish/End dialog wires both outcomes to the exact frozen first End and calls Stop once', async t => {
  let clock = START; t.mock.method(Date, 'now', () => clock);
  for (const [buttonText, expected] of [['Finish race', 'finished'], ['Stop race early', 'did_not_finish']] as const) {
    clock = START;
    const h = await fixture(); start(h.active);
    clock += 120_000;
    const stopped: LiveRunEntry[] = [];
    const dialog = stopDialog(h, () => {
      stopped.push(captureTrainingRunEnd(h.active.getState(), {
        workoutInstanceId: 'linked-recording', endedAt: h.active.getState().completionRequestedAt,
      }));
    });
    const button = dialog.buttons.find(value => value.text === buttonText)!;
    button.onPress!();
    assert.equal(stopped.length, 1);
    assert.equal(stopped[0].raceLink!.outcome, expected);
    assert.equal(stopped[0].actualEndTime, clock);
    assert.equal(h.active.getState().completionRequestedAt, clock);
    assert.equal(h.active.getState().isPaused, true);
    clock += 1000;
    button.onPress!();
    dialog.buttons.find(value => value.text === (buttonText === 'Finish race' ? 'Stop race early' : 'Finish race'))!.onPress!();
    assert.equal(stopped.length, 1);
    assert.equal(h.active.getState().raceLink.outcome, expected);
    assert.equal(h.active.getState().completionRequestedAt, START + 120_000);
  }
});

test('actual open Finish dialog cannot replace a matching native End or act after its owner lease is invalidated', async t => {
  let clock = START; t.mock.method(Date, 'now', () => clock);
  for (const interruption of ['native-end', 'owner-signout'] as const) {
    clock = START;
    const h = await fixture(); start(h.active);
    clock += 120_000;
    let stopped = 0;
    const dialog = stopDialog(h, () => { stopped++; });
    clock += 5000;
    if (interruption === 'native-end') await h.complete({ workoutInstanceId: 'linked-recording', endedAt: clock });
    else await h.owner.signOut();
    dialog.buttons.find(value => value.text === 'Finish race')!.onPress!();
    assert.equal(stopped, 0);
    assert.equal(h.active.getState().raceLink.outcome, 'unrecorded');
    if (interruption === 'native-end') {
      assert.equal(h.active.getState().completionRequestedAt, clock);
      const saved: Activity = h.activity.getState().activities[0];
      assert.equal(saved.raceLink!.outcome, 'unrecorded');
      assert.equal(saved.raceResult, undefined);
    } else {
      assert.equal(h.active.getState().completionRequestedAt, null);
      assert.equal(h.activity.getState().activities.length, 0);
      assert.equal(h.values.has(RUN_COMPLETION_JOURNAL_KEY), false);
    }
  }
});
