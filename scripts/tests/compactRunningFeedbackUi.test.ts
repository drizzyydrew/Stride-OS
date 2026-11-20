import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import * as feedback from '../../src/utils/runningQualityFeedback';

type Element = { type: any; props: Record<string, any>; key?: string };
function elements(tree: any): Element[] {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(elements);
  return [tree, ...elements(tree.props?.children)];
}
function control(tree: any, type: string, label: string) {
  const item = elements(tree).find(item => item.type === type && item.props.label === label);
  assert.ok(item, `${type}:${label}`); return item.props;
}
function harness() {
  let owner = 'A', generation = 1, current = true, athlete = 'athlete_default';
  let record: any = { id: 'run', type: 'strides', completed: true, actualDurationMinutes: 25, timestamp: Date.now(),
    runningQualityPrescription: { version: 1, source: 'captured_prescription', rung: 'strides', completedReps: 4, workSeconds: 15 } };
  const writes: any[] = [];
  let slots: any[] = [], cursor = 0;
  const react = {
    useState: (value: any) => { const index = cursor++; if (!(index in slots)) slots[index] = typeof value === 'function' ? value() : value;
      return [slots[index], (next: any) => { slots[index] = typeof next === 'function' ? next(slots[index]) : next; }]; },
    useRef: (value: any) => { const index = cursor++; return slots[index] ??= { current: value }; },
    useEffect: (fn: () => any, deps: any[]) => { const index = cursor++; const old = slots[index];
      if (!old || deps.some((value, i) => !Object.is(value, old.deps[i]))) { old?.cleanup?.(); slots[index] = { deps, cleanup: fn() }; } },
  };
  const workout = Object.assign((selector: any) => selector({ history: [record] }), { getState: () => ({ history: [record] }) });
  const profile = Object.assign((selector: any) => selector({ activeAthleteId: athlete }), { getState: () => ({ activeAthleteId: athlete }) });
  const jsx = (type: any, props: any, key?: string) => ({ type, props, key });
  const mocks: Record<string, any> = { react, 'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': { Text: 'Text', View: 'View', useWindowDimensions: () => ({ fontScale: 1 }) },
    '@expo/ui': { Collapsible: 'Collapsible', Host: 'Host', RNHostView: 'RNHostView' },
    '../goals/GoalLifecycleCard': { GoalAction: 'GoalAction', GoalPicker: 'GoalPicker' },
    '../../theme/useColors': { useColors: () => ({}) }, '../../store/themeStore': { useThemeMode: () => 'dark' },
    '../../store/profileStore': { useProfileStore: profile },
    '../../store/workoutStore': { useWorkoutStore: workout, saveRunningQualityFeedback: async (...args: any[]) => { writes.push(args); } },
    '../../lib/localDataOwner': { captureOwnerLease: () => current ? { ownerUserId: owner, generation } : null,
      ownerLeaseIsCurrent: (lease: any) => current && lease.ownerUserId === owner && lease.generation === generation },
    '../../utils/runningQualityFeedback': feedback,
  };
  const filename = resolve('src/components/activity/RunningQualityFeedback.tsx');
  const code = ts.transpileModule(readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const module: any = { exports: {} };
  vm.runInNewContext(code, { module, exports: module.exports, Date,
    require: (id: string) => { assert.ok(id in mocks, id); return mocks[id]; } });
  let editor: Element | null = null;
  function outer() { return module.exports.default({ recordId: 'run' }) as Element | null; }
  function render() {
    const next = outer(); if (!next) { for (const slot of slots) slot?.cleanup?.(); slots = []; editor = null; return null; }
    if (editor?.key !== next.key) { for (const slot of slots) slot?.cleanup?.(); slots = []; }
    editor = next; cursor = 0; return next.type(next.props);
  }
  return { render, outer, writes, get record() { return record; }, replace: () => { record = { ...record }; },
    switchOwner: () => { owner = 'B'; generation++; record = { ...record }; }, retire: () => { current = false; }, switchAthlete: (value: string) => { athlete = value; } };
}
const flush = () => new Promise(resolve => setTimeout(resolve, 0));

test('actual compact editor hides numeric interval details and stays unreported until explicit answers', async () => {
  const h = harness();
  const collapsed = h.render();
  assert.equal(control(collapsed, 'Collapsible', 'Workout feedback').isOpen, false);
  control(collapsed, 'Collapsible', 'Workout feedback').onOpenChange(true);
  const open = h.render();
  assert.equal(control(open, 'GoalPicker', 'Faster intervals completed?').value, 'unsure');
  assert.equal(elements(open).some(item => item.type === 'GoalField'), false);
  control(open, 'GoalAction', 'Save feedback').onPress(); await flush();
  assert.equal(h.writes[0][1], null);
  assert.equal(h.writes[0][3].value, 'unsure');
  control(h.render(), 'GoalPicker', 'Faster intervals completed?').onChange('as_planned');
  control(h.render(), 'GoalAction', 'Save feedback').onPress(); await flush();
  assert.equal(h.writes.length, 1, 'missing effort/recovery cannot earn exposure');
  control(h.render(), 'GoalPicker', 'Actual work effort (RPE)').onChange('6');
  control(h.render(), 'GoalPicker', 'Comfortable recovery between repeats?').onChange('yes');
  control(h.render(), 'GoalAction', 'Save feedback').onPress(); await flush();
  assert.equal(h.writes[1][1].completedReps, 4);
  assert.equal(h.writes[1][1].workSeconds, 15);
  assert.equal(h.writes[1][1].source, 'athlete_reported');
});

test('changed work stores no invented repeats, and stale same-ID controls cannot use a replacement owner', async () => {
  const h = harness(); control(h.render(), 'Collapsible', 'Workout feedback').onOpenChange(true);
  control(h.render(), 'GoalPicker', 'Faster intervals completed?').onChange('changed');
  const stale = control(h.render(), 'GoalAction', 'Save feedback').onPress;
  stale(); await flush();
  assert.equal(h.writes[0][1], null); assert.equal(h.writes[0][3].value, 'changed');
  const key = h.outer()!.key;
  h.switchOwner(); stale(); await flush();
  assert.equal(h.writes.length, 1);
  assert.notEqual(h.outer()!.key, key);
  assert.equal(control(h.render(), 'Collapsible', 'Workout feedback').isOpen, false);
  control(h.render(), 'Collapsible', 'Workout feedback').onOpenChange(true);
  assert.equal(control(h.render(), 'GoalPicker', 'Faster intervals completed?').value, 'unsure');
  h.retire(); assert.equal(h.outer(), null);
});


test('switching athlete unmounts the draft and detached controls stay retired after returning', async () => {
  const h = harness(); control(h.render(), 'Collapsible', 'Workout feedback').onOpenChange(true);
  control(h.render(), 'GoalPicker', 'Faster intervals completed?').onChange('changed');
  const stale = control(h.render(), 'GoalAction', 'Save feedback').onPress;
  h.switchAthlete('other'); assert.equal(h.render(), null);
  h.switchAthlete('athlete_default'); h.render(); stale(); await flush();
  assert.equal(h.writes.length, 0);
  assert.equal(control(h.render(), 'Collapsible', 'Workout feedback').isOpen, false);
});
