import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

const row = { uuid: 'synthetic-health-uuid', activityType: 'running', startTime: 1000, durationSeconds: 5400,
  distanceMeters: 15000, sourceName: 'Watch', sourceBundleIdentifier: 'watch' };
const settle = () => new Promise(resolve => setImmediate(resolve));
function harness() {
  let cursor = 0, tree: any;
  const state: any[] = [], effects: (() => void)[] = [], cleanup: (() => void)[] = [], alerts: any[] = [];
  const saves: string[] = [], recovered: string[] = [], failures: string[] = [], pending: boolean[] = [];
  let restore: (uuid: string) => Promise<string> = async () => 'canonical';
  let routeCurrent = true;
  const mocks: Record<string, any> = {
    react: {
      useRef: (v: any) => { const i = cursor++; return state[i] ??= { current: v }; },
      useState: (v: any) => { const i = cursor++; if (!(i in state)) state[i] = v; return [state[i], (next: any) => { state[i] = next; }]; },
      useEffect: (fn: () => void) => { const i = cursor++; if (!state[i]) { effects.push(fn); state[i] = true; } },
    },
    'react-native': { StyleSheet: { create: (s: any) => s, hairlineWidth: 1 }, Alert: { alert: (...args: any[]) => alerts.push(args) },
      ...Object.fromEntries(['ActivityIndicator', 'FlatList', 'Text', 'TouchableOpacity', 'View'].map(n => [n, n])) },
    '@expo/vector-icons': { Ionicons: 'Ionicons' },
    healthWorkoutRecovery: { createHealthWorkoutRecovery: () => ({ listRecent: async () => [row], restoreSelected: async (uuid: string) => { saves.push(uuid); return restore(uuid); } }) },
    useColors: { useColors: () => ({}) }, settingsStore: { useSettingsStore: (select: any) => select({ units: 'metric' }) },
    displayLabels: { displayLabel: (v: string) => v }, activitySummary: { formatDuration: () => '1:30:00' }, units: { formatDistance: () => '15.0 km' },
  };
  const module = { exports: {} as any };
  const source = ts.transpileModule(readFileSync('src/components/activity/HealthWorkoutRecovery.tsx', 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React,
    jsxFactory: 'h', jsxFragmentFactory: 'Fragment', esModuleInterop: true,
  } }).outputText;
  runInNewContext(source, { module, exports: module.exports, Error, Date, Fragment: 'Fragment',
    require: (name: string) => mocks[name] ?? mocks[name.split('/').at(-1)!] ?? { __esModule: true, default: name.split('/').at(-1) },
    h: (type: any, props: any, ...children: any[]) => ({ type, props: props ?? {}, children: children.flat(Infinity) }),
  });
  const props = { isCurrent: () => routeCurrent, onOpenChange() {}, onSavePending: () => pending.push(true), onFailure: (e: string) => failures.push(e), onRecovered: (id: string) => recovered.push(id) };
  function render() { cursor = 0; tree = module.exports.default(props); effects.splice(0).forEach(fn => { const result = fn(); if (typeof result === 'function') cleanup.push(result); }); return tree; }
  function nodes() { const all: any[] = []; const visit = (n: any) => { if (n && typeof n === 'object') { all.push(n); n.children?.forEach(visit); } }; visit(tree); return all; }
  return { render, saves, recovered, failures, pending, alerts,
    open: async () => { render(); nodes().find(n => n.props.accessibilityLabel === 'Find workout in Apple Health').props.onPress(); await settle(); render(); },
    choose: () => nodes().find(n => n.type === 'FlatList').props.renderItem({ item: row }).props.onPress(),
    close: () => nodes().find(n => n.type === 'RecoverableModal').props.onRequestClose(),
    confirm: () => alerts.at(-1)[2].find((b: any) => b.text === 'Restore').onPress(),
    cancel: () => alerts.at(-1)[2].find((b: any) => b.text === 'Cancel').onPress(),
    unmount: () => cleanup.forEach(fn => fn()),
    switchRoute: () => { routeCurrent = false; },
    setRestore: (fn: typeof restore) => { restore = fn; },
    text: () => nodes().flatMap(n => n.children.filter((c: any) => typeof c === 'string')).join(' '),
  };
}

test('Health picker requires explicit confirmation and permits cancelling without a save', async () => {
  const ui = harness(); await ui.open(); ui.choose(); ui.choose();
  assert.equal(ui.alerts.length, 1); assert.match(ui.alerts[0][1], /previously removed/);
  assert.equal(ui.saves.length, 0); ui.cancel();
  assert.equal(ui.pending.length, 0); assert.equal(ui.recovered.length, 0);
});

test('Health picker waits for durable result and keeps failure and same-selection retry visible', async () => {
  const ui = harness(); let finish!: (id: string) => void;
  ui.setRestore(() => new Promise(resolve => { finish = resolve; }));
  await ui.open(); ui.choose(); const saving = ui.confirm(); ui.render();
  assert.equal(ui.pending.length, 1); assert.equal(ui.recovered.length, 0);
  finish('confirmed-canonical'); await saving;
  assert.deepEqual(ui.recovered, ['confirmed-canonical']);
  const failed = harness(); failed.setRestore(async () => { throw new Error('Disk not saved'); });
  await failed.open(); failed.choose(); await failed.confirm(); failed.render();
  assert.match(failed.text(), /Disk not saved/); assert.equal(failed.recovered.length, 0);
  failed.setRestore(async () => 'retry-canonical'); failed.choose(); await failed.confirm();
  assert.deepEqual(failed.recovered, ['retry-canonical']);
});

test('closing or unmounting invalidates a confirmation and ignores late save results', async () => {
  for (const action of ['close', 'unmount', 'switchRoute'] as const) {
    const ui = harness(); await ui.open(); ui.choose(); ui[action](); await ui.confirm();
    assert.equal(ui.saves.length, 0, action);
    const pending = harness(); let finish!: (id: string) => void;
    pending.setRestore(() => new Promise(resolve => { finish = resolve; }));
    await pending.open(); pending.choose(); const saving = pending.confirm(); pending[action](); finish('stale'); await saving;
    assert.equal(pending.recovered.length, 0, action);
  }
});
