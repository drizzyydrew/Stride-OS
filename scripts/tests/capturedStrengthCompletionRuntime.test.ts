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
  let failWrite = false;
  let current = true;
  let activityCommits = 0;
  const activities = new Map<string, unknown>();
  const storage = { getItem: async (key: string) => saved.get(key) ?? null,
    getItemOnce: async (key: string) => saved.get(key) ?? null,
    setItem: async (key: string, value: string) => { if (failWrite) throw new Error('disk failed'); saved.set(key, value); },
    removeItem: async (key: string) => { saved.delete(key); } };
  const activity = { addActivity: (value: { id: string }) => { activities.set(value.id, value); return value.id; },
    addActivityAndPersist: async (value: { id: string }) => { activityCommits++; activities.set(value.id, value); } };
  const filename = resolve('src/store/strengthStore.ts');
  const compiled = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const mocks: Record<string, unknown> = {
    './persistStorage': { createAppJSONStorage: () => createJSONStorage(() => storage), getAppStorage: () => storage },
    '../lib/localDataOwner': { captureOwnerLease: () => ({ ownerUserId: 'owner', generation: current ? 1 : 2 }), ownerLeaseIsCurrent: (lease: { generation: number }) => current && lease.generation === 1 },
    '@react-native-async-storage/async-storage': {},
    '../utils/strengthEngine': { estimateSessionLoad: () => 1 },
    '../lib/syncService': { syncStrengthLog: async () => {}, deleteStrengthLog: async () => {} },
    '../lib/externalIntegrations': { syncStrengthSessionToExternalServices: async () => {} },
    './activityStore': { useActivityStore: { getState: () => activity } },
    '../utils/activityMigration': { activityFromStrengthRecord: (record: { id: string }) => ({ id: `activity_strength_${record.id}` }) },
  };
  const module = { exports: {} };
  const nativeRequire = createRequire(filename);
  vm.runInNewContext(compiled, { module, exports: module.exports,
    require: (id: string) => Object.hasOwn(mocks, id) ? mocks[id] : nativeRequire(id), console, Date, setTimeout, clearTimeout }, { filename });
  const runtime = module.exports as typeof import('../../src/store/strengthStore');
  await runtime.useStrengthStore.persist.rehydrate();
  return { ...runtime, saved, activities, setFail: (value: boolean) => { failWrite = value; },
    retire: () => { current = false; }, get activityCommits() { return activityCommits; } };
}
const lease = { ownerUserId: 'owner', generation: 1 };
const entry = { completionKey: 'training_block_retained_instance', sessionType: 'full_body' as const, goal: 'maintenance' as const,
  week: 2, plannedDuration: 30, actualDuration: 20, exercises: [], source: 'generated' as const };

test('captured completion confirms both local histories and retry stays idempotent', async () => {
  const h = await harness();
  h.useStrengthStore.getState().manualLog(entry, 20);
  await h.confirmStrengthCompletionSaved(entry.completionKey, lease);
  assert.ok(h.saved.get('strength-store')?.includes(entry.completionKey));
  assert.equal(h.activityCommits, 1);
  h.useStrengthStore.getState().manualLog(entry, 20);
  await h.confirmStrengthCompletionSaved(entry.completionKey, lease);
  assert.equal(h.useStrengthStore.getState().history.length, 1);
  assert.equal(h.activities.size, 1);
});

test('unconfirmed disk or retired account rejects completion confirmation', async () => {
  const h = await harness();
  h.useStrengthStore.getState().manualLog(entry, 20);
  await h.confirmStrengthCompletionSaved(entry.completionKey, lease);
  h.setFail(true);
  await assert.rejects(h.confirmStrengthCompletionSaved(entry.completionKey, lease), /disk failed/);
  assert.equal(h.useStrengthStore.getState().history.length, 1);
  h.setFail(false);
  await h.confirmStrengthCompletionSaved(entry.completionKey, lease);
  h.retire();
  await assert.rejects(h.confirmStrengthCompletionSaved(entry.completionKey, lease), /not ready/);
});

test('Strength screen undo clears the same captured set flags that complete marks', async () => {
  const { ensureExerciseShape, toggleSetCompleted } = await import('../../src/utils/strengthSession');
  const source = readFileSync('app/(tabs)/strength/index.tsx', 'utf8');
  const start = source.indexOf('  function undoExercise(');
  const end = source.indexOf('\n  function launchTrainingBlock', start);
  const code = ts.transpileModule(`${source.slice(start, end)}\nundoExercise({ id: 'row' });`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
  let captured = { exercises: [ensureExerciseShape({ id: 'row', name: 'Row', sets: 2, reps: '10', equipment: ['dumbbell'],
    setEntries: [{ id: 's1', reps: 10, completed: true }, { id: 's2', reps: 10, completed: true }] })],
    completedExerciseIds: ['row'] };
  vm.runInNewContext(code, { ownsActiveTrainingBlock: true, activeStrengthSession: captured,
    setCompletedExercises: () => {},
    toggleActiveStrengthSetCompleted: (exercise: string, set: string, value: boolean) => {
      captured = toggleSetCompleted(captured as never, exercise, set, value);
    }, uncompleteActiveStrengthExercise: (id: string) => { captured.completedExerciseIds = captured.completedExerciseIds.filter(item => item !== id); },
  });
  assert.deepEqual(captured.completedExerciseIds, []);
  assert.ok(captured.exercises[0]!.setEntries.every(set => !set.completed));
});


test('queued strength persistence refuses a retired owner before writing', async () => {
  const h = await harness();
  h.useStrengthStore.getState().manualLog(entry, 20);
  h.retire();
  await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(h.saved.get('strength-store')?.includes(entry.completionKey) ?? false, false);
});
