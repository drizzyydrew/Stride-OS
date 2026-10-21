import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

function harness(initialLinked = true) {
  let cursor = 0, tree: any, current = true, updates = 0, calls = 0;
  const state: any[] = [], effects: (() => void)[] = [], cleanups: (() => void)[] = [];
  let linked = initialLinked;
  let outcome: (isCurrent: () => boolean) => Promise<void> = async () => {};
  const mocks: Record<string, any> = {
    react: {
      useRef: (value: any) => state[cursor++] ??= { current: value },
      useState: (value: any) => { const index = cursor++; if (!(index in state)) state[index] = value;
        return [state[index], (next: any) => { updates++; state[index] = next; }]; },
      useEffect: (fn: () => void) => { const index = cursor++; if (!state[index]) { effects.push(fn); state[index] = true; } },
    },
    'react-native': { StyleSheet: { create: (s: any) => s }, ActivityIndicator: 'ActivityIndicator', Text: 'Text', TouchableOpacity: 'TouchableOpacity', View: 'View' },
    '@expo/vector-icons': { Ionicons: 'Ionicons' },
    '../../theme/useColors': { useColors: () => ({}) },
    './HealthWorkoutRecovery': { __esModule: true, default: 'HealthWorkoutRecovery' },
    '../../lib/healthDistanceRefresh': { refreshActivityHealthDistance: async (id: string, isCurrent: () => boolean) => {
      assert.equal(id, 'canonical'); calls++; return outcome(isCurrent);
    } },
  };
  const module = { exports: {} as any };
  const source = ts.transpileModule(readFileSync('src/components/activity/HealthDistanceRefresh.tsx', 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, jsxFactory: 'h', esModuleInterop: true,
  } }).outputText;
  runInNewContext(source, { module, exports: module.exports, Error,
    require: (id: string) => mocks[id], h: (type: any, props: any, ...children: any[]) => ({ type, props: props ?? {}, children: children.flat(Infinity) }) });
  function render() {
    cursor = 0; tree = module.exports.default({ activityId: 'canonical', linked, isCurrent: () => current });
    for (const fn of effects.splice(0)) { const cleanup = fn(); if (typeof cleanup === 'function') cleanups.push(cleanup); }
  }
  function nodes() { const all: any[] = []; const visit = (node: any) => { if (node && typeof node === 'object') { all.push(node); node.children.forEach(visit); } }; visit(tree); return all; }
  render();
  return { render, button: () => nodes().find(n => n.type === 'TouchableOpacity'), picker: () => nodes().find(n => n.type === 'HealthWorkoutRecovery'),
    publishLink: () => { linked = true; render(); },
    text: () => nodes().flatMap(n => n.children.filter((c: any) => typeof c === 'string')).join(' '),
    setOutcome: (fn: typeof outcome) => { outcome = fn; }, unmount: () => cleanups.forEach(fn => fn()),
    leave: () => { current = false; }, get calls() { return calls; }, get updates() { return updates; } };
}
const tick = () => new Promise(resolve => setImmediate(resolve));
function deferred() { let resolve!: () => void, reject!: (e: Error) => void;
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; }); return { resolve, reject, promise }; }

test('split refresh is explicit, single-flight and confirms only after the durable service returns', async () => {
  const ui = harness(), pending = deferred();
  ui.setOutcome(() => pending.promise);
  assert.equal(ui.calls, 0);
  ui.button().props.onPress(); ui.button().props.onPress(); ui.render();
  assert.equal(ui.calls, 1); assert.equal(ui.button().props.disabled, true);
  assert.doesNotMatch(ui.text(), /evidence saved/);
  pending.resolve(); await tick(); ui.render();
  assert.match(ui.text(), /evidence saved/); assert.equal(ui.button().props.disabled, false);
});

test('refresh failures remain visible and retry does not create another completion', async () => {
  const ui = harness(); ui.setOutcome(async () => { throw new Error('Saving could not be confirmed'); });
  ui.button().props.onPress(); await tick(); ui.render();
  assert.match(ui.text(), /could not be confirmed/); assert.doesNotMatch(ui.text(), /evidence saved/);
  assert.equal(ui.button().props.disabled, false);
  ui.setOutcome(async () => {}); ui.button().props.onPress(); await tick(); ui.render();
  assert.equal(ui.calls, 2); assert.match(ui.text(), /evidence saved/);
});

test('leaving or unmounting fences native refresh results and its mutation guard', async () => {
  for (const action of ['leave', 'unmount'] as const) {
    const ui = harness(), pending = deferred(); let guard!: () => boolean;
    ui.setOutcome(current => { guard = current; return pending.promise; });
    ui.button().props.onPress(); ui[action]();
    const updates = ui.updates;
    assert.equal(guard(), false); pending.resolve(); await tick();
    assert.equal(ui.updates, updates);
  }
});

test('Health evidence never falls through to GPS splits and refresh remounts after focus changes', () => {
  const source = readFileSync('app/(tabs)/activity/[activityId].tsx', 'utf8');
  assert.match(source, /healthSplits \? healthSplits\.splits : buildOutdoorSplits/);
  assert.match(source, /healthSplits \? \[\] : buildRunSplits/);
  assert.match(source, /HealthDistanceRefresh key=\{`\$\{activity.id\}:\$\{focused\}`\}/);
  assert.match(source, /Health distance-derived/);
});

test('first-link picker remains mounted through early publication and failed durable confirmation', () => {
  const ui = harness(false);
  const picker = ui.picker();
  assert.equal(picker.props.targetActivityId, 'canonical');
  picker.props.onSavePending(); ui.publishLink();
  assert.ok(ui.picker(), 'published Health metadata must not switch away from the pending picker');
  assert.equal(ui.button(), undefined);
  ui.picker().props.onFailure('Save not confirmed'); ui.render();
  assert.ok(ui.picker()); assert.match(ui.text(), /Save not confirmed/);
  ui.picker().props.onRecovered('canonical'); ui.render();
  assert.equal(ui.picker(), undefined); assert.ok(ui.button());
  assert.match(ui.text(), /evidence saved/);
});
