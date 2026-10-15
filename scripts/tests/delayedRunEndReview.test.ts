import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import { createJSONStorage } from 'zustand/middleware';
import type { LocationObject } from 'expo-location';
import type { RunCompletionResult } from '../../src/store/workoutStore';
import type { LiveRunEntry } from '../../src/lib/runCompletionJournal';

const START = 1_760_000_000_000;
const END = START + 600_000;
const INSTANCE = 'delayed-run-review';

function loadSource(file: string, mocks: Record<string, unknown>, clock: () => number): any {
  const filename = resolve(file);
  const nativeRequire = createRequire(filename);
  const module = { exports: {} };
  const compiled = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  class ReviewDate extends Date {
    static now() { return clock(); }
  }
  vm.runInNewContext(compiled, {
    module, exports: module.exports,
    require: (id: string) => Object.hasOwn(mocks, id) ? mocks[id] : nativeRequire(id),
    Date: ReviewDate, console, setTimeout, clearTimeout,
  }, { filename });
  return module.exports;
}

function fixture() {
  let now = START;
  let failCommit = false;
  const data = new Map<string, string>();
  const storage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); },
    removeItem: (key: string) => { data.delete(key); },
  };
  const lease = { ownerUserId: 'review-owner', generation: 1 };
  const owner = {
    captureOwnerLease: () => lease,
    ownerLeaseIsCurrent: (value: unknown) => value === lease,
  };
  const runModule = loadSource('src/store/activeRunStore.ts', {
    '@react-native-async-storage/async-storage': {},
    './persistStorage': { createAppJSONStorage: () => createJSONStorage(() => storage) },
    './settingsStore': { useSettingsStore: { getState: () => ({ autoPauseMode: 'off' }) } },
    '../lib/voiceCue': { enqueueVoiceCue() {} },
    '../lib/localDataOwner': owner,
  }, () => now) as typeof import('../../src/store/activeRunStore');
  const run = runModule.useActiveRunStore;
  assert.equal(run.persist.hasHydrated(), true);
  run.getState().startRun(null, { environment: 'outdoor', workoutInstanceId: INSTANCE, startedAtMs: START });
  const attempts: LiveRunEntry[] = [];
  const workoutState = {
    history: [],
    getRunDiscardResult: async () => null,
    commitRunEnd: async (entry: LiveRunEntry): Promise<RunCompletionResult> => {
      attempts.push(JSON.parse(JSON.stringify(entry)));
      if (failCommit) throw new Error('review: history storage unavailable');
      return { status: 'saved', activityId: 'review-activity', entry, ownerLease: lease };
    },
  };
  const hydrated = (state: unknown) => ({ persist: { hasHydrated: () => true }, getState: () => state });
  const completion = loadSource('src/lib/runCompletionCommand.ts', {
    '../store/activeRunStore': runModule,
    '../store/athleteStore': { useAthleteStore: hydrated({ currentWeek: 1, fatigueScore: 0, recoveryScore: 100,
      setFatigueScore() {}, setRecentEasyLoad() {} }) },
    '../store/workoutStore': { useWorkoutStore: hydrated(workoutState) },
    '../store/activityStore': { useActivityStore: hydrated({ activities: [] }) },
    './localDataOwner': owner,
  }, () => now) as typeof import('../../src/lib/runCompletionCommand');

  function location(seconds: number): LocationObject {
    return { timestamp: START + seconds * 1000, mocked: false, coords: {
      latitude: 45 + seconds * 2.68224 / 111_195, longitude: 7,
      accuracy: 5, altitude: 100, altitudeAccuracy: 1, speed: 2.68224, heading: 0,
    } };
  }
  const addFix = (seconds: number) => {
    now = START + seconds * 1000;
    run.getState().addLocationUpdate(location(seconds));
  };
  for (let seconds = 0; seconds <= 600; seconds += 30) addFix(seconds);
  const end = () => completion.completeRunCommand({ workoutInstanceId: INSTANCE, endedAt: END });
  return { run, attempts, addFix, end,
    setTime: (timestamp: number) => { now = timestamp; },
    setCommitFailure: (value: boolean) => { failCommit = value; },
  };
}

const plain = <T>(value: T): T => JSON.parse(JSON.stringify(value));

test('Training Run original End has identical GPS totals when delivered immediately or after later fixes', async () => {
  const immediate = fixture();
  const expected = (await immediate.end()).entry;
  const delayed = fixture();
  for (let seconds = 630; seconds <= 900; seconds += 30) delayed.addFix(seconds);
  const actual = (await delayed.end()).entry;
  assert.equal(actual.actualEndTime, END);
  assert.equal(actual.durationMinutes, 10);
  assert.ok(expected.distanceMiles > 0.9 && expected.distanceMiles < 1.1, 'Fixture records about one mile before End');
  assert.ok(Math.abs(actual.distanceMiles - expected.distanceMiles) < 1e-9,
    `Post-End GPS must not inflate distance: immediate=${expected.distanceMiles}, delayed=${actual.distanceMiles}`);
  assert.deepEqual(plain(actual.routeCoordinates), plain(expected.routeCoordinates));
  assert.deepEqual(plain(actual.activityMetrics), plain(expected.activityMetrics));
});

test('Training Run End excludes a later completed pause from its original duration and metrics', async () => {
  const immediate = fixture();
  const expected = (await immediate.end()).entry;
  const delayed = fixture();
  delayed.setTime(END + 60_000);
  delayed.run.getState().pauseRun();
  delayed.setTime(END + 180_000);
  delayed.run.getState().resumeRun();
  assert.equal(delayed.run.getState().pausedDurationMs, 120_000, 'The completed pause is entirely after End');
  const actual = (await delayed.end()).entry;
  assert.equal(actual.actualEndTime, END);
  assert.equal(actual.durationMinutes, expected.durationMinutes, 'A post-End pause must not shorten the saved recording');
  assert.equal(actual.durationMinutes, 10);
  assert.deepEqual(plain(actual.activityMetrics), plain(expected.activityMetrics));
});

test('Training Run failed history write retries the first End snapshot despite later GPS and pause attempts', async () => {
  const recording = fixture();
  recording.setCommitFailure(true);
  await assert.rejects(recording.end(), /review: history storage unavailable/);
  assert.equal(recording.run.getState().isActive, true, 'Failed persistence must not clear the recording');
  const first = recording.attempts[0]!;
  for (let seconds = 630; seconds <= 900; seconds += 30) recording.addFix(seconds);
  recording.setTime(END + 330_000);
  recording.run.getState().pauseRun();
  recording.setTime(END + 450_000);
  recording.run.getState().resumeRun();
  recording.setCommitFailure(false);
  const retried = (await recording.end()).entry;
  assert.equal(retried.actualEndTime, first.actualEndTime);
  assert.equal(retried.durationMinutes, first.durationMinutes, 'Retry cannot recompute a shorter duration from later pauses');
  assert.equal(retried.distanceMiles, first.distanceMiles, 'Retry cannot accumulate GPS after the original End');
  assert.deepEqual(plain(retried.routeCoordinates), first.routeCoordinates);
  assert.deepEqual(plain(retried.activityMetrics), first.activityMetrics);
});
