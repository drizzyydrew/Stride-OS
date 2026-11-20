import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import { reportablePlyometricExercises } from '../../src/utils/plyometricReporting';
import * as feedback from '../../src/utils/plyometricFeedback';

type Element = { type: any; props: Record<string, any> };
function elements(tree: any): Element[] {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(elements);
  return [tree, ...elements(tree.props?.children)];
}
function control(tree: any, type: string, label: string) {
  const found = elements(tree).find(item => item.type === type && item.props.label === label);
  assert.ok(found, `${type}: ${label}`); return found.props;
}

function harness(ageHours = 48) {
  let now = Date.now(); let current = true; let owner = 'owner'; let ownerGeneration = 1; let invalidation: (() => void) | undefined; let athlete = 'athlete_default'; let hydrated = true;
  const record: any = { id: 'saved-strength', timestamp: now - ageHours * 3_600_000, completed: true,
    exercises: [{ exerciseId: 'plyo_low_pogo', name: 'Low Pogo Hops', sets: [{ reps: 6, rpe: 4, completed: true }] }] };
  const writes: any[] = []; let pending: Promise<void> | undefined; let focus: (() => void) | undefined;
  const allSlots = { outer: [] as any[], editor: [] as any[] };
  let slots = allSlots.outer; let cursor = 0;
  function memo(fn: () => any, deps: any[]) {
    const index = cursor++; const old = slots[index];
    if (!old || deps.some((item, i) => !Object.is(item, old.deps[i]))) slots[index] = { value: fn(), deps };
    return slots[index].value;
  }
  const react = {
    useState: (initial: any) => { const index = cursor++; if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
      const ownerSlots = slots; return [ownerSlots[index], (next: any) => { ownerSlots[index] = typeof next === 'function' ? next(ownerSlots[index]) : next; }]; },
    useRef: (value: any) => { const index = cursor++; return slots[index] ??= { current: value }; },
    useMemo: memo, useCallback: (fn: any, deps: any[]) => memo(() => fn, deps),
    useEffect: (fn: () => any, deps: any[]) => { const index = cursor++; const old = slots[index];
      if (!old || deps.some((item, i) => !Object.is(item, old.deps[i]))) { old?.cleanup?.(); slots[index] = { deps, cleanup: fn() }; } },
  };
  const persist = { hasHydrated: () => hydrated, onHydrate: () => () => {}, onFinishHydration: () => () => {} };
  const profile: any = (selector: any) => selector({ activeAthleteId: athlete });
  profile.getState = () => ({ activeAthleteId: athlete }); profile.persist = persist;
  const strength: any = (selector: any) => selector({ history: [record] }); strength.persist = persist;
  const jsx = (type: any, props: any, key?: string) => ({ type, props, key });
  const mocks: Record<string, unknown> = {
    react, 'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': { Text: 'Text', View: 'View', useWindowDimensions: () => ({ fontScale: 1 }) },
    '@expo/ui': { Collapsible: 'Collapsible', Host: 'Host', RNHostView: 'RNHostView' },
    'expo-router': { useFocusEffect: (fn: () => void) => { focus = fn; } },
    '../goals/GoalLifecycleCard': { GoalAction: 'GoalAction', GoalPicker: 'GoalPicker' },
    '../../theme/useColors': { useColors: () => ({}) }, '../../store/themeStore': { useThemeMode: () => 'dark' },
    '../../store/profileStore': { useProfileStore: profile },
    '../../store/strengthStore': { useStrengthStore: strength, savePlyometricResponse: async (...args: any[]) => { writes.push(args); await pending; } },
    '../../lib/localDataOwner': { captureOwnerLease: () => current ? { ownerUserId: owner, generation: ownerGeneration } : null, ownerLeaseIsCurrent: (lease: any) => current && lease.ownerUserId === owner && lease.generation === ownerGeneration, getLocalDataOwner: () => ({ onLeaseInvalidated: (fn: () => void) => { invalidation = fn; return () => { invalidation = undefined; }; } }) },
    '../../utils/plyometricReporting': { reportablePlyometricExercises }, '../../utils/plyometricFeedback': feedback,
    '../../utils/strengthEngine': { getExercise: () => ({ name: 'Low Pogo Hops' }) },
  };
  const filename = resolve('src/components/activity/PlyometricResponse.tsx');
  const code = ts.transpileModule(readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const module = { exports: {} }; const fakeDate = class extends Date { static now() { return now; } };
  vm.runInNewContext(`${code}\nmodule.exports.Editor = ExerciseJumpResponse;`, { module, exports: module.exports, Date: fakeDate,
    require: (id: string) => { assert.ok(id in mocks, id); return mocks[id]; } }, { filename });
  const runtime: any = module.exports;
  const render = (editor = true) => { slots = allSlots[editor ? 'editor' : 'outer']; cursor = 0;
    return editor ? runtime.Editor({ record, exercise: record.exercises[0], now }) : runtime.default({ recordId: record.id }); };
  return { render, record, writes, switchOwner: () => { invalidation?.(); owner = 'new-owner'; ownerGeneration++; current = true; }, remountEditor: () => { allSlots.editor = []; }, retire: () => { current = false; }, athlete: (id: string) => { athlete = id; }, unhydrate: () => { hydrated = false; },
    advance: (hours: number) => { now += hours * 3_600_000; }, focus: () => focus?.(),
    hold: () => { let release!: () => void; pending = new Promise<void>(resolve => { release = resolve; }); return release; } };
}
const flush = () => new Promise(resolve => setTimeout(resolve, 0));

test('actual jump editor starts unknown and sends only explicitly chosen responses and preference', async () => {
  const h = harness();
  assert.equal(control(h.render(), 'GoalPicker', 'Were your landings controlled?').value, 'uncertain');
  assert.equal(control(h.render(), 'GoalPicker', 'Symptoms or pain during this exercise?').value, 'unknown');
  assert.equal(control(h.render(), 'GoalPicker', 'Response at least 24 hours later').value, 'unknown');
  assert.equal(control(h.render(), 'GoalPicker', 'Next time').value, 'repeat');
  control(h.render(), 'GoalPicker', 'Were your landings controlled?').onChange('controlled');
  control(h.render(), 'GoalPicker', 'Symptoms or pain during this exercise?').onChange('none');
  control(h.render(), 'GoalPicker', 'Next time').onChange('consider_harder');
  control(h.render(), 'GoalAction', 'Save jump response').onPress(); await flush();
  assert.equal(h.writes.length, 1);
  const [recordId, exerciseId, value] = h.writes[0];
  assert.equal(recordId, h.record.id); assert.equal(exerciseId, 'plyo_low_pogo');
  assert.equal(value.landingControl, 'controlled'); assert.equal(value.symptomsDuring, 'none');
  assert.equal(value.nextDayResponse, 'unknown', 'a completed low-RPE set does not imply a next-day response');
  assert.equal(value.nextStep, 'consider_harder'); assert.equal(value.source, 'athlete_reported');
});

test('next-day choices remain unavailable before 24 hours and focus refreshes the collapsed page clock', () => {
  const h = harness(1);
  const next = control(h.render(), 'GoalPicker', 'Response at least 24 hours later');
  assert.equal(next.disabled, true); assert.deepEqual(Array.from(next.options, (item: any) => item.value), ['unknown']);
  const initial = h.render(false); assert.equal(control(initial, 'Collapsible', 'Jump response').isOpen, false);
  h.advance(24); h.focus();
  control(h.render(false), 'Collapsible', 'Jump response').onOpenChange(true);
  const child = elements(h.render(false)).find(item => typeof item.type === 'function' && item.type.name === 'ExerciseJumpResponse');
  assert.ok(child); assert.ok(child.props.now - h.record.timestamp >= feedback.IMPACT_RESPONSE_DELAY_MS);
  assert.equal(control(h.render(), 'GoalPicker', 'Response at least 24 hours later').disabled, false);
});

test('existing feedback can be removed without a second purchase or changed workout input', async () => {
  const h = harness();
  h.record.exercises[0].impactResponse = { version: 1, source: 'athlete_reported', landingControl: 'lost',
    symptomsDuring: 'present', nextDayResponse: 'worse', nextStep: 'easier', reportedAt: Date.now() };
  h.render();
  assert.equal(control(h.render(), 'GoalPicker', 'Next time').value, 'easier');
  control(h.render(), 'GoalAction', 'Remove jump response').onPress(); await flush();
  assert.equal(h.writes[0][2], null);
  assert.equal(h.record.exercises[0].sets[0].reps, 6);
});

test('unready/other-athlete UI stays hidden and retired async callbacks publish no success message', async () => {
  const h = harness(); h.athlete('other'); assert.equal(h.render(false), null);
  h.athlete('athlete_default'); h.unhydrate(); assert.equal(h.render(false), null);
  const active = harness(); const release = active.hold();
  control(active.render(), 'GoalAction', 'Save jump response').onPress(); await flush();
  active.retire(); release(); await flush();
  assert.equal(elements(active.render()).some(item => typeof item.props.children === 'string' && /Response saved/.test(item.props.children)), false);
});

test('same-ID account changes remount unknown drafts and stale save controls cannot borrow a new lease', async () => {
  const h = harness();
  control(h.render(false), 'Collapsible', 'Jump response').onOpenChange(true);
  const first = elements(h.render(false)).find(item => typeof item.type === 'function' && item.type.name === 'ExerciseJumpResponse') as Element & { key: string };
  assert.ok(first);
  control(h.render(), 'GoalPicker', 'Were your landings controlled?').onChange('controlled');
  control(h.render(), 'GoalPicker', 'Next time').onChange('consider_harder');
  const staleSave = control(h.render(), 'GoalAction', 'Save jump response').onPress;
  h.switchOwner();
  staleSave(); await flush();
  assert.equal(h.writes.length, 0, 'a stale callback cannot capture the replacement owner lease');
  assert.equal(control(h.render(false), 'Collapsible', 'Jump response').isOpen, false);
  control(h.render(false), 'Collapsible', 'Jump response').onOpenChange(true);
  const second = elements(h.render(false)).find(item => typeof item.type === 'function' && item.type.name === 'ExerciseJumpResponse') as Element & { key: string };
  assert.ok(second); assert.notEqual(second.key, first.key);
  h.remountEditor(); // React creates fresh hook state for the changed rendered key.
  assert.equal(control(h.render(), 'GoalPicker', 'Were your landings controlled?').value, 'uncertain');
  assert.equal(control(h.render(), 'GoalPicker', 'Next time').value, 'repeat');
  assert.equal(control(h.render(), 'GoalAction', 'Save jump response').disabled, false);
});

test('an old pending save does not leave the replacement account editor busy or inject its response', async () => {
  const h = harness();
  control(h.render(false), 'Collapsible', 'Jump response').onOpenChange(true);
  control(h.render(), 'GoalPicker', 'Symptoms or pain during this exercise?').onChange('present');
  const release = h.hold();
  control(h.render(), 'GoalAction', 'Save jump response').onPress(); await flush();
  h.switchOwner(); control(h.render(false), 'Collapsible', 'Jump response').onOpenChange(true);
  h.remountEditor();
  assert.equal(control(h.render(), 'GoalAction', 'Save jump response').disabled, false);
  assert.equal(control(h.render(), 'GoalPicker', 'Symptoms or pain during this exercise?').value, 'unknown');
  release(); await flush();
  assert.equal(control(h.render(), 'GoalPicker', 'Symptoms or pain during this exercise?').value, 'unknown');
  assert.equal(elements(h.render()).some(item => typeof item.props.children === 'string' && /Response saved/.test(item.props.children)), false);
});
