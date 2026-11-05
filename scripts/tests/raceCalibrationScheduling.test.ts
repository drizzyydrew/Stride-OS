import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

test('actual calibration bridge backs off self-published failed writes, resumes after success and cancels on unmount', async () => {
  let now = 0;
  let nextId = 1;
  let calls = 0;
  let fail = true;
  let cleanup: (() => void) | undefined;
  const timers = new Map<number, { at: number; run: () => void }>();
  const listeners = new Set<() => void>();
  const hydration = new Set<() => void>();
  const store = { subscribe: (listener: () => void) => { listeners.add(listener); return () => listeners.delete(listener); },
    persist: { onFinishHydration: (listener: () => void) => { hydration.add(listener); return () => hydration.delete(listener); } } };
  class ClockDate extends Date { static now() { return now; } }
  const filename = resolve('src/components/sync/RaceCalibrationReconciler.tsx');
  const compiled = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} };
  const mocks: Record<string, unknown> = {
    react: { useEffect: (effect: () => () => void) => { cleanup = effect(); } },
    'react-native': { AppState: { currentState: 'active', addEventListener: () => ({ remove: () => {} }) } },
    '../../lib/raceCalibration': { reconcileRaceCalibration: async () => {
      calls++;
      // Persist publishes the profile patch before the disk failure is known.
      listeners.forEach(listener => listener());
      if (fail) throw new Error('synthetic disk failure');
      return 'updated';
    } },
    '../../store/activityStore': { useActivityStore: store },
    '../../store/athleteStore': { useAthleteStore: store },
    '../../store/customWorkoutStore': { useCustomWorkoutStore: store },
    '../../store/goalArchiveStore': { useGoalArchiveStore: store },
    '../../store/profileStore': { useProfileStore: store },
  };
  vm.runInNewContext(compiled, { module, exports: module.exports, require: (id: string) => {
    assert.ok(Object.hasOwn(mocks, id), `unexpected import ${id}`); return mocks[id];
  }, Date: ClockDate, console,
  setTimeout: (run: () => void, delay: number) => { const id = nextId++; timers.set(id, { at: now + delay, run }); return id; },
  clearTimeout: (id: number) => timers.delete(id), setInterval: () => -1, clearInterval: () => {} }, { filename });
  (module.exports as { default: () => null }).default();
  const advance = async (milliseconds: number) => {
    const end = now + milliseconds;
    while (true) {
      const next = [...timers.entries()].filter(([, timer]) => timer.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) break;
      timers.delete(next[0]); now = next[1].at; next[1].run();
      for (let i = 0; i < 8; i++) await Promise.resolve();
    }
    now = end;
  };
  await advance(50);
  assert.equal(calls, 1);
  assert.deepEqual([...timers.values()].map(timer => timer.at), [1050]);
  await advance(999);
  assert.equal(calls, 1);
  await advance(1);
  assert.equal(calls, 2);
  assert.deepEqual([...timers.values()].map(timer => timer.at), [3050]);
  fail = false;
  // This mock always publishes, even on a repeated unchanged derivation. Make
  // the success publication's queued refresh irrelevant by unmounting below.
  await advance(2000);
  assert.equal(calls, 3);
  cleanup?.();
  assert.equal(timers.size, 0);
  assert.equal(listeners.size, 0);
  assert.equal(hydration.size, 0);
  await advance(60000);
  assert.equal(calls, 3);
});
