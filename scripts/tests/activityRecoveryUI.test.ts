import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { resolveActivityDetail } from '../../src/utils/activityResolution';
import { buildHealthDistanceSplits } from '../../src/utils/healthDistanceSplits';
import { supportsHealthSplitRefresh } from '../../src/utils/healthDistanceRefresh';

function harness(status = 'ready') {
  let id = 'missing-race';
  let focused = true;
  let cursor = 0;
  let tree: any;
  let activities: any[] = [];
  const state: any[] = [], effects: (() => void)[] = [], cleanups: any[] = [], alerts: any[] = [], navigation: any[] = [], calls: string[] = [];
  let restore: (id: string) => Promise<string | null> = async () => null;
  const hooks = {
    useRef: (value: any) => { const i = cursor++; return state[i] ??= { current: value }; },
    useState: (value: any) => { const i = cursor++; if (!(i in state)) state[i] = typeof value === 'function' ? value() : value;
      return [state[i], (next: any) => { state[i] = next; }]; },
    useEffect: (fn: () => void, dependencies: any[]) => { const i = cursor++; if (!state[i] || dependencies.some((v, j) => v !== state[i][j])) effects.push(() => { cleanups[i]?.(); cleanups[i] = fn(); }); state[i] = dependencies; },
    useMemo: (fn: () => any, dependencies: any[]) => { const i = cursor++; if (!state[i] || dependencies.some((v, j) => v !== state[i].dependencies[j])) state[i] = { dependencies, value: fn() }; return state[i].value; },
  };
  const mocks: Record<string, any> = {
    react: { ...hooks, useLayoutEffect: hooks.useEffect },
    'react-native': { StyleSheet: { create: (s: any) => s }, Alert: { alert: (...args: any[]) => alerts.push(args) },
      ...Object.fromEntries(['ActivityIndicator', 'ScrollView', 'Text', 'TouchableOpacity', 'View'].map(n => [n, n])) },
    'expo-router': { useIsFocused: () => focused, useRoute: () => ({ params: { activityId: id } }), useRouter: () => ({ replace: (value: any) => navigation.push(value), back: () => navigation.push('back') }) },
    '@expo/vector-icons': { Ionicons: 'Ionicons' },
    activityStore: { useActivityStore: (selector: any) => selector({ activities, hydrationStatus: status }) },
    settingsStore: { useSettingsStore: (selector: any) => selector({ units: 'metric' }) },
    useColors: { useColors: () => ({}) },
    shareCard: { shareCardUnavailableReason: () => null },
    activityResolution: { resolveActivityDetail },
    displayLabels: { displayLabel: (value: string) => value },
    activitySummary: { buildActivitySummary: () => ({ primary: [], sections: [], title: 'Run' }) },
    activitySplits: { buildRunSplits: () => [] },
    outdoorAnalysis: { buildOutdoorSplits: () => [], analyzeSnowSegments: () => [] },
    healthDistanceSplits: { buildHealthDistanceSplits },
    healthDistanceRefresh: { supportsHealthSplitRefresh },
    savedActivityRecovery: { recoverSavedActivity: async (value: string) => { calls.push(value); return restore(value); } },
  };
  const module = { exports: {} as any };
  const code = ts.transpileModule(readFileSync('app/(tabs)/activity/[activityId].tsx', 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React,
    jsxFactory: 'h', jsxFragmentFactory: 'Fragment', esModuleInterop: true,
  } }).outputText;
  runInNewContext(code, { module, exports: module.exports, Error, Fragment: 'Fragment',
    require: (name: string) => mocks[name] ?? mocks[name.split('/').at(-1)!] ?? { __esModule: true, default: name.split('/').at(-1) },
    h: (type: any, props: any, ...children: any[]) => ({ type, props: props ?? {}, children: children.flat(Infinity) }),
  });
  function render() { cursor = 0; tree = module.exports.default(); effects.splice(0).forEach(fn => fn()); cursor = 0; tree = module.exports.default(); return tree; }
  function nodes() { const all: any[] = []; const visit = (n: any) => { if (n && typeof n === 'object') { all.push(n); n.children?.forEach(visit); } }; visit(tree); return all; }
  return { render, nodes, alerts, navigation, calls,
    button: () => nodes().find(n => n.props.accessibilityLabel === 'Restore saved recording'),
    health: () => nodes().find(n => n.type === 'HealthWorkoutRecovery'),
    setRestore: (fn: typeof restore) => { restore = fn; },
    publish: () => { activities = [{ id, activityType: 'running', metrics: {} }]; },
    setId: (value: string) => { id = value; render(); },
    setFocused: (value: boolean) => { focused = value; render(); },
    confirm: () => alerts.at(-1)[2].find((a: any) => a.text === 'Restore').onPress(),
    text: () => nodes().flatMap(n => n.children.filter((c: any) => typeof c === 'string')).join(' '),
  };
}

test('Health recovery callbacks from a covered screen stay invalid after focus returns', () => {
  const ui = harness(); ui.render();
  const old = ui.health().props;
  assert.equal(old.isCurrent(), true);
  ui.setFocused(false);
  assert.equal(ui.health().props.key, 'missing-race:false');
  assert.equal(old.isCurrent(), false);
  old.onRecovered('stale');
  ui.setFocused(true);
  assert.equal(ui.health().props.key, 'missing-race:true');
  assert.equal(old.isCurrent(), false);
  old.onRecovered('still-stale');
  assert.equal(ui.navigation.length, 0);
  assert.equal(ui.health().props.isCurrent(), true);
});

const settle = () => new Promise(resolve => setImmediate(resolve));

test('missing Activity offers explicit restore with prior-removal consent and reachable frozen Back', () => {
  const ui = harness(); ui.render();
  assert.ok(ui.nodes().some(n => n.type === 'ScreenHeader'));
  assert.ok(ui.nodes().some(n => n.type === 'ScrollView'));
  ui.button().props.onPress();
  assert.equal(ui.calls.length, 0);
  assert.match(ui.alerts[0][1], /previously removed/);
  assert.ok(ui.text().includes('Back to Activity'));
});

test('loading and read failure do not claim the run was deleted and never restore on render', () => {
  const loading = harness('loading'); loading.render();
  assert.match(loading.text(), /Loading activity/); assert.equal(loading.button(), undefined);
  const error = harness('error'); error.render();
  assert.match(error.text(), /does not mean the recording was deleted/);
  assert.equal(error.calls.length, 0);
});

test('confirmed restore is single-flight and navigates only to its confirmed canonical ID', async () => {
  const ui = harness(); let complete!: (id: string) => void;
  ui.setRestore(() => new Promise(resolve => { complete = resolve; }));
  ui.render(); ui.button().props.onPress(); ui.confirm(); ui.confirm(); ui.render();
  assert.equal(ui.calls.length, 1); assert.equal(ui.button().props.disabled, true);
  complete('restored-canonical'); await settle(); ui.render();
  assert.equal(ui.navigation[0].params.activityId, 'restored-canonical');
});

test('failed or absent recovery retains the screen and offers retry without navigation', async () => {
  for (const outcome of ['missing', 'error']) {
    const ui = harness(); ui.setRestore(async () => { if (outcome === 'error') throw new Error('Saved history locked'); return null; });
    ui.render(); ui.button().props.onPress(); ui.confirm(); await settle(); ui.render();
    assert.equal(ui.navigation.length, 0); assert.equal(ui.button().props.disabled, false);
    assert.match(ui.text(), outcome === 'error' ? /Saved history locked/ : /No exact saved run/);
  }
});

test('a confirmation or late result from a previous activity cannot navigate over the current one', async () => {
  const ui = harness(); ui.render(); ui.button().props.onPress(); ui.setId('other-race'); ui.confirm();
  assert.equal(ui.calls.length, 0);
  let complete!: (id: string) => void; ui.setRestore(() => new Promise(resolve => { complete = resolve; }));
  ui.button().props.onPress(); ui.confirm(); ui.setId('third-race'); complete('old-result'); await settle(); ui.render();
  assert.equal(ui.navigation.length, 0);
});

test('restoration status and retry remain visible when the row appears before persistence fails', async () => {
  const ui = harness(); let reject!: (error: Error) => void;
  ui.setRestore(() => { ui.publish(); return new Promise((_resolve, fail) => { reject = fail; }); });
  ui.render(); ui.button().props.onPress(); ui.confirm(); ui.render();
  assert.match(ui.text(), /Waiting for save confirmation/);
  reject(new Error('Disk is locked; recording not yet saved'));
  await settle(); ui.render();
  assert.match(ui.text(), /recording not yet saved/);
  assert.match(ui.text(), /Retry saving recovered recording/);
  assert.ok(ui.button()); assert.equal(ui.navigation.length, 0);
});

test('Health selection remains mounted and errors stay visible after an early in-memory publication', () => {
  const ui = harness(); ui.render();
  ui.health().props.onOpenChange(true);
  ui.health().props.onSavePending();
  ui.publish(); ui.render();
  assert.ok(ui.health(), 'A published alias must not dismiss the selected-workout save');
  ui.health().props.onFailure('Health workout is not durably saved');
  ui.health().props.onOpenChange(false); ui.render();
  assert.match(ui.text(), /not durably saved/);
  assert.ok(ui.health(), 'Retry must remain reachable after closing a failed save');
  assert.equal(ui.navigation.length, 0);
  ui.health().props.onRecovered('confirmed-health-canonical');
  assert.equal(ui.navigation.at(-1).params.activityId, 'confirmed-health-canonical');
});

test('changing the unresolved route keys a new Health recovery session', () => {
  const ui = harness(); ui.render();
  assert.equal(ui.health().props.key, 'missing-race:true');
  const stale = ui.health().props;
  ui.health().props.onOpenChange(true);
  ui.setId('another-missing-recording');
  assert.equal(stale.isCurrent(), false);
  stale.onRecovered('stale-canonical');
  assert.equal(ui.health().props.key, 'another-missing-recording:true');
  assert.equal(ui.navigation.length, 0);
});
