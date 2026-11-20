import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import * as adaptation from '../../src/utils/exerciseAdaptation';
import * as plyometricCatalog from '../../src/utils/plyometricCatalog';
import { STRENGTH_EXERCISES } from '../../src/utils/strengthEngine';
import { editSet, ensureSessionShape, substituteExercise, type ActiveStrengthSession } from '../../src/utils/strengthSession';
import { MOBILITY_EXERCISES, getMobilityExercise } from '../../src/constants/mobilityBank';

type Element = { type: string; props: Record<string, any> };
function elements(tree: any): Element[] {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(elements);
  return [tree, ...elements(tree.props?.children)];
}
function control(tree: any, type: string, label: string) {
  const found = elements(tree).find(element => element.type === type && element.props.label === label);
  assert.ok(found, `${type}: ${label}`); return found.props;
}
function harness() {
  const initial: ActiveStrengthSession = ensureSessionShape({ workoutId: 'workout', workoutName: 'Test', plannedDurationMin: 30,
    startedAt: 1, pausedAt: null, pausedDurationMs: 0, status: 'active', workoutInstanceId: 'instance', currentExerciseIndex: 0,
    completedExerciseIds: [], rpeByExercise: {}, loadByExercise: {},
    exercises: [{ id: 'pull_row', name: 'Single-Arm DB Row', equipment: ['dumbbell'], sets: 3, reps: '8–12',
      repScheme: { kind: 'reps', repsMin: 8, repsMax: 12 }, plannedRpe: 7 }] });
  initial.exercises[0]!.setEntries[0]!.completed = true;
  let current = true;
  let pendingPreference: Promise<void> | undefined;
  let futureWrites = 0;
  let state: any = { session: initial,
    editSet: (id: string, setId: string, patch: any) => { state = { ...state, session: editSet(state.session, id, setId, patch) }; },
    substituteExercise: (id: string, replacement: any) => { state = { ...state, session: substituteExercise(state.session, id, replacement) }; },
  };
  const store: any = (selector: (state: any) => unknown) => selector(state);
  store.getState = () => state;
  store.setState = (patch: any) => { state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) }; };
  const slots: any[] = [];
  let cursor = 0;
  const react = { useState: (value: any) => {
    const index = cursor++; if (!(index in slots)) slots[index] = typeof value === 'function' ? value() : value;
    return [slots[index], (next: any) => { slots[index] = typeof next === 'function' ? next(slots[index]) : next; }];
  }, useRef: (value: any) => { const index = cursor++; return slots[index] ??= { current: value }; }, useMemo: (fn: () => unknown) => fn() };
  const jsx = (type: string, props: any) => ({ type, props });
  const filename = resolve('src/components/strength/ExerciseAdjustment.tsx');
  const mocks: Record<string, unknown> = {
    react, 'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': { Text: 'Text', View: 'View', useWindowDimensions: () => ({ fontScale: 1 }) },
    '@expo/ui': { Collapsible: 'Collapsible', Host: 'Host', RNHostView: 'RNHostView', Switch: 'Switch' },
    '../goals/GoalLifecycleCard': { GoalAction: 'GoalAction', GoalPicker: 'GoalPicker' },
    '../../store/themeStore': { useThemeMode: () => 'dark' }, '../../theme/useColors': { useColors: () => ({}) },
    '../../lib/localDataOwner': { captureOwnerLease: () => current ? { ownerUserId: 'owner', generation: 1 } : null, ownerLeaseIsCurrent: () => current },
    '../../store/activeStrengthSessionStore': { useActiveStrengthSessionStore: store },
    '../../store/onboardingStore': { useOnboardingStore: { getState: () => ({ data: {} }) }, saveStrengthPlanningPreferences: async () => { futureWrites++; await pendingPreference; } },
    '../../store/profileStore': { useProfileStore: { getState: () => ({ activeAthleteId: 'athlete_default' }) } },
    '../../utils/strengthEngine': { STRENGTH_EXERCISES }, '../../utils/exerciseAdaptation': adaptation,
    '../../utils/plyometricCatalog': plyometricCatalog,
  };
  const compiled = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(compiled, { module, exports: module.exports, require: (id: string) => {
    assert.ok(id in mocks, id); return mocks[id];
  } }, { filename });
  const Component = (module.exports as any).default;
  const render = () => { cursor = 0; return Component({ exercise: state.session.exercises.find((item: any) => item.id === 'pull_row'), workoutInstanceId: 'instance' }); };
  control(render(), 'Collapsible', 'Adjust exercise').onOpenChange(true);
  return { render, state: () => state, retire: () => { current = false; }, futureWrites: () => futureWrites,
    holdPreference: () => { let release!: () => void; pendingPreference = new Promise<void>(resolve => { release = resolve; }); return release; } };
}

test('actual adjustment UI dose action preserves performed work, captured prescription and unknown effort', () => {
  const h = harness();
  const original = h.state().session.exercises[0];
  control(h.render(), 'GoalAction', 'Reduce remaining targets').onPress();
  const updated = h.state().session.exercises[0];
  assert.deepEqual(updated.setEntries[0], original.setEntries[0]);
  assert.ok(updated.setEntries[1].reps < original.setEntries[1].reps);
  assert.equal(updated.sets, 3); assert.equal(updated.reps, '8–12');
  assert.equal(updated.setEntries[1].rpe, undefined);
  assert.equal(updated.modifiedTargets, true);
  h.retire(); const before = h.state().session;
  control(h.render(), 'GoalAction', 'Reduce remaining targets').onPress();
  assert.equal(h.state().session, before);
});

function chooseBand(h: ReturnType<typeof harness>) {
  control(h.render(), 'GoalPicker', 'What would help?').onChange('equipment');
  control(h.render(), 'GoalPicker', 'Compatible movement').onChange('pull_band_row');
  control(h.render(), 'Switch', 'I can use this equipment and setup').onValueChange(true);
}

test('actual movement UI requires confirmed setup and inserts only remaining work with own unknown load', async () => {
  const h = harness(); chooseBand(h);
  assert.equal(control(h.render(), 'GoalAction', 'Use this movement').disabled, false);
  control(h.render(), 'GoalAction', 'Use this movement').onPress();
  await new Promise(resolve => setTimeout(resolve, 0));
  const exercises = h.state().session.exercises;
  assert.equal(exercises[0].setEntries.length, 1);
  assert.equal(exercises[1].setEntries.length, 2);
  assert.equal(exercises[1].canonicalExerciseId, 'pull_band_row');
  assert.deepEqual(Array.from(exercises[1].equipment), ['band', 'secure_anchor']);
  assert.equal(exercises[1].setEntries[0].weight, undefined);
  assert.equal(exercises[1].setEntries[0].rpe, undefined);
});

test('a pending future-preference callback cannot replace a workout after owner retirement', async () => {
  const h = harness(); chooseBand(h);
  const release = h.holdPreference();
  control(h.render(), 'Switch', 'Use in future generated workouts').onValueChange(true);
  const before = h.state().session;
  control(h.render(), 'GoalAction', 'Use this movement').onPress();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(h.futureWrites(), 1); assert.equal(h.state().session, before);
  h.retire(); release();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(h.state().session, before);
});

test('actual mobility adjustment callback reduces only remaining timed work and retains original plan reference', () => {
  const filename = 'app/(tabs)/strength/mobility-session.tsx';
  const source = readFileSync(filename, 'utf8');
  const start = source.indexOf('  function adjustCurrent(');
  const end = source.indexOf('\n  if (!workout)', start);
  assert.ok(start > 0 && end > start);
  const compiled = ts.transpileModule(`${source.slice(start, end)}\nmodule.exports = adjustCurrent;`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const exercise = MOBILITY_EXERCISES.find(item => item.name === 'Calf Stretch (Straight-Knee)')!;
  let changes: any = {}, notes: string[] = [], remaining = 10;
  const current = { exercise, dose: { holdSec: 30 }, planned: { exerciseId: exercise.id } };
  const module = { exports: {} };
  vm.runInNewContext(compiled, { module, current, owner: { current: {} }, ownerLeaseIsCurrent: () => true,
    secondsLeft: 10, index: 0, pauseTimer: () => {}, getMobilityExercise, MOBILITY_EXERCISES,
    compatibleExerciseOptions: adaptation.compatibleExerciseOptions,
    doseCountdownSeconds: (dose: any) => dose.holdSec ?? dose.timeSec ?? null, doseSummary: (dose: any) => JSON.stringify(dose),
    setStepChanges: (fn: any) => { changes = fn(changes); }, setChangeNotes: (fn: any) => { notes = fn(notes); }, setSecondsLeft: (value: number) => { remaining = value; },
  }, { filename });
  (module.exports as any)('too_hard');
  assert.equal(changes[0].dose.holdSec, 28); assert.equal(remaining, 8);
  assert.equal(current.dose.holdSec, 30); assert.equal(current.planned.exerciseId, exercise.id);
  assert.ok(notes[0]!.includes('20s already timed'));
});
