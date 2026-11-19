import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import { createJSONStorage } from 'zustand/middleware';
import { canReportRunningQuality, normalizeRunningQuality } from '../../src/utils/runningQualityFeedback';
import type { CompletedWorkoutRecord, RunningQualityFeedback } from '../../src/types/training';

const report: RunningQualityFeedback = { version: 1, source: 'athlete_reported', rung: 'intervals', completedReps: 4, workSeconds: 180, rpe: 7, comfortableRecovery: true };
const record: CompletedWorkoutRecord = { id: 'run-a', workoutId: 'planned', type: 'vo2', intensity: 'hard', durationMinutes: 40, actualDurationMinutes: 35,
  estimatedLoad: 10, estimatedDistanceMiles: 3, timestamp: Date.now(), week: 3, completed: true, fatigueBefore: 20, fatigueAfter: 30, fatigueDelta: 10, recoveryBefore: 70, recoveryDelta: -3 };

async function harness() {
  const saved = new Map<string, string>(); let current = true; let fail = false; let retireOnWrite = false;
  const storage = { getItem: async (key: string) => saved.get(key) ?? null, getItemOnce: async (key: string) => saved.get(key) ?? null,
    setItem: async (key: string, value: string) => { if (fail) throw Error('disk failed'); saved.set(key, value); if (retireOnWrite) current = false; }, removeItem: async () => {} };
  const filename = resolve('src/store/workoutStore.ts'); const nativeRequire = createRequire(filename);
  const mocks: Record<string, unknown> = {
    './persistStorage': { getAppStorage: () => storage, createAppJSONStorage: () => createJSONStorage(() => storage) },
    '@react-native-async-storage/async-storage': {}, '../utils/training': {}, '../utils/calculateFatigue': {},
    '../utils/historyUtils': { estimateDistanceMiles: () => 0 }, '../lib/syncService': { syncWorkoutLog: async () => {} }, '../lib/externalIntegrations': {},
    './activityStore': { useActivityStore: {} }, '../utils/activityMigration': {},
    '../lib/localDataOwner': { captureOwnerLease: () => current ? { ownerUserId: 'owner', generation: 1 } : null, ownerLeaseIsCurrent: () => current },
    '../lib/runCompletionJournal': { RunCompletionJournal: class {} },
  };
  const module = { exports: {} };
  const code = ts.transpileModule(readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, require: (id: string) => Object.hasOwn(mocks, id) ? mocks[id] : nativeRequire(id), console, Date, setTimeout, clearTimeout }, { filename });
  const runtime = module.exports as typeof import('../../src/store/workoutStore');
  await runtime.useWorkoutStore.persist.rehydrate(); runtime.useWorkoutStore.setState({ history: [{ ...record }], completedWorkouts: ['run-a'] });
  return { ...runtime, saved, setFail: (value: boolean) => { fail = value; }, retireDuringWrite: () => { retireOnWrite = true; } };
}
const lease = { ownerUserId: 'owner', generation: 1 };

test('quality report needs explicit valid actual work; planned duration or a label is insufficient', () => {
  assert.equal(canReportRunningQuality({ ...record, actualDurationMinutes: undefined }), false);
  for (const value of [{ ...report, source: 'estimated' }, { ...report, rpe: NaN }, { ...report, completedReps: 50 }, { ...report, workSeconds: 1200 },
    { ...report, comfortableRecovery: undefined }, { ...report, rung: 'norwegian_4x4' }, { ...report, rung: 'strides', workSeconds: 60 }]) {
    assert.equal(normalizeRunningQuality(value, 35), undefined);
  }
  assert.deepEqual(normalizeRunningQuality(report, 35), report);
});

test('actual store persists exact run feedback without changing metrics and can remove it', async () => {
  const h = await harness(); await h.saveRunningQualityFeedback(record.id, report, lease);
  assert.deepEqual(h.useWorkoutStore.getState().history[0]!.runningQuality, report);
  assert.equal(h.useWorkoutStore.getState().history[0]!.actualDurationMinutes, 35);
  assert.ok(h.saved.get('workout-store')!.includes('athlete_reported'));
  await h.saveRunningQualityFeedback(record.id, null, lease);
  assert.equal(h.useWorkoutStore.getState().history[0]!.runningQuality, undefined);
});

test('failed save or ownership retirement never publishes new quality evidence', async () => {
  const h = await harness(); h.setFail(true);
  await assert.rejects(h.saveRunningQualityFeedback(record.id, report, lease), /disk failed/);
  assert.equal(h.useWorkoutStore.getState().history[0]!.runningQuality, undefined);
  h.setFail(false); h.retireDuringWrite();
  await assert.rejects(h.saveRunningQualityFeedback(record.id, report, lease), /Account changed/);
  assert.equal(h.useWorkoutStore.getState().history[0]!.runningQuality, undefined);
});
