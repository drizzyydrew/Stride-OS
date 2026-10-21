import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import type { Activity, ActivityType } from '../../src/types/activity';
import { resolveActivityDetail } from '../../src/utils/activityResolution';
import { supportsHealthSplitRefresh } from '../../src/utils/healthDistanceRefresh';

const screenSource = readFileSync('app/(tabs)/activity/[activityId].tsx', 'utf8');
const startTime = Date.parse('2026-10-01T07:00:00Z');
const supported: ActivityType[] = ['running', 'walking', 'hiking', 'cycling'];

function recording(patch: Partial<Activity> = {}): Activity {
  return {
    id: 'activity_workout_run_adhoc%3Asynthetic', activityType: 'running', source: 'tracked',
    status: 'completed', scheduled: false, indoor: false, startTime,
    endTime: startTime + 60_000, createdAt: startTime, updatedAt: startTime,
    metrics: { durationSeconds: 60, distanceMeters: 180, distanceSource: 'gps',
      routeCoordinates: [{ latitude: 41.9, longitude: 12.5, timestamp: startTime }] },
    trainingLoad: { wholeBody: 12 }, ...patch,
  } as Activity;
}

function linkedRecording(patch: Partial<Activity> = {}): Activity {
  return recording({ ...patch, healthKit: {
    workoutUuid: '11111111-1111-4111-8111-111111111111', sourceBundleIdentifier: 'synthetic.watch',
    originalStartTime: startTime, originalEndTime: startTime + 60_000,
  } as Activity['healthKit'] });
}

type Node = { type: unknown; props: Record<string, any>; children: any[] };

// Execute the parent screen, not a copied eligibility branch or a child-only fixture.
function harness(initial: Activity, source = screenSource) {
  let activity = initial;
  let focused = true;
  let cursor = 0;
  let tree: Node;
  const states: any[] = [], effects: (() => void)[] = [], cleanups: any[] = [];
  const hooks = {
    useRef: (value: any) => { const i = cursor++; return states[i] ??= { current: value }; },
    useState: (value: any) => {
      const i = cursor++;
      if (!(i in states)) states[i] = typeof value === 'function' ? value() : value;
      return [states[i], (next: any) => { states[i] = typeof next === 'function' ? next(states[i]) : next; }];
    },
    useEffect: (fn: () => any, dependencies: any[]) => {
      const i = cursor++;
      if (!states[i] || dependencies.some((v, j) => v !== states[i][j])) {
        effects.push(() => { cleanups[i]?.(); cleanups[i] = fn(); });
      }
      states[i] = dependencies;
    },
    useMemo: (fn: () => any, dependencies: any[]) => {
      const i = cursor++;
      if (!states[i] || dependencies.some((v, j) => v !== states[i].dependencies[j])) {
        states[i] = { dependencies, value: fn() };
      }
      return states[i].value;
    },
  };
  const mocks: Record<string, any> = {
    react: { ...hooks, useLayoutEffect: hooks.useEffect },
    'react-native': { StyleSheet: { create: (s: any) => s }, Alert: { alert: () => {} },
      ...Object.fromEntries(['ActivityIndicator', 'ScrollView', 'Text', 'TouchableOpacity', 'View'].map(n => [n, n])) },
    'expo-router': { useIsFocused: () => focused,
      useRoute: () => ({ params: { activityId: activity.id } }),
      useRouter: () => ({ back: () => {}, push: () => {}, replace: () => {} }) },
    '@expo/vector-icons': { Ionicons: 'Ionicons' },
    activityStore: { useActivityStore: (selector: any) => selector({ activities: [activity], hydrationStatus: 'ready' }) },
    settingsStore: { useSettingsStore: (selector: any) => selector({ units: 'imperial' }) },
    useColors: { useColors: () => ({}) },
    activityResolution: { resolveActivityDetail },
    healthDistanceRefresh: { supportsHealthSplitRefresh },
    shareCard: { shareCardUnavailableReason: () => null },
    displayLabels: { displayLabel: (value: string) => value },
    activitySummary: { buildActivitySummary: () => ({ primary: [{ label: 'Distance', value: '0.1 mi' }], sections: [], title: 'Run' }) },
    activitySplits: { buildRunSplits: () => [] },
    outdoorAnalysis: { buildOutdoorSplits: () => [], analyzeSnowSegments: () => [] },
    healthDistanceSplits: { buildHealthDistanceSplits: () => null },
  };
  const module = { exports: {} as any };
  const code = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React,
    jsxFactory: 'h', jsxFragmentFactory: 'Fragment', esModuleInterop: true,
  } }).outputText;
  runInNewContext(code, { module, exports: module.exports, Error, Fragment: 'Fragment',
    require: (name: string) => mocks[name] ?? mocks[name.split('/').at(-1)!]
      ?? { __esModule: true, default: name.split('/').at(-1) },
    h: (type: unknown, props: any, ...children: any[]): Node => ({ type, props: props ?? {}, children: children.flat(Infinity) }),
  });
  function render() {
    cursor = 0; tree = module.exports.default();
    effects.splice(0).forEach(fn => fn());
    cursor = 0; tree = module.exports.default();
  }
  function nodes(root: Node = tree): Node[] {
    const all: Node[] = [];
    const visit = (node: any) => {
      if (node && typeof node === 'object' && 'children' in node) {
        all.push(node); node.children.forEach(visit);
      }
    };
    visit(root); return all;
  }
  render();
  return {
    nodes,
    refresh: () => nodes().find(node => node.type === 'HealthDistanceRefresh'),
    publish: (next: Activity) => { activity = next; render(); },
    setFocused: (next: boolean) => { focused = next; render(); },
  };
}

function expectRefresh(ui: ReturnType<typeof harness>, row: Activity, linked: boolean) {
  assert.ok(ui.nodes().some(node => node.type === 'ScreenHeader'), 'Render the resolved Activity screen');
  const scroll = ui.nodes().find(node => node.type === 'ScrollView');
  assert.ok(scroll, 'The control must live in the Activity scroll content');
  const control = ui.refresh();
  assert.ok(control, 'Eligible Activity screen must render HealthDistanceRefresh without requiring an existing Health link');
  assert.ok(ui.nodes(scroll).includes(control));
  assert.equal(control.props.activityId, row.id, 'Pass the opaque canonical ID unchanged');
  assert.equal(control.props.linked, linked);
  assert.equal(control.props.isCurrent(), true);
  return control;
}

test('resolved unlinked GPS recording renders first-link refresh in the actual parent screen', () => {
  const row = recording();
  assert.equal(row.healthKit, undefined);
  expectRefresh(harness(row), row, false);
});

test('supported outdoor types render unlinked and linked refresh controls', () => {
  for (const activityType of supported) {
    for (const linked of [false, true]) {
      const row = linked ? linkedRecording({ activityType }) : recording({ activityType });
      expectRefresh(harness(row), row, linked);
    }
  }
});

test('indoor and unsupported recordings do not render the Health split control', () => {
  for (const activityType of supported) {
    assert.equal(harness(recording({ activityType, indoor: true })).refresh(), undefined);
    assert.equal(harness(linkedRecording({ activityType, indoor: true })).refresh(), undefined);
  }
  for (const activityType of ['strength', 'swimming', 'indoor_cycling', 'snowboarding', 'other'] as ActivityType[]) {
    assert.equal(harness(recording({ activityType })).refresh(), undefined);
    assert.equal(harness(linkedRecording({ activityType })).refresh(), undefined);
  }
});

test('manual and plan-only entries without recording evidence are ignored', () => {
  for (const source of ['manual', 'training_plan'] as const) {
    for (const activityType of supported) {
      const row = recording({ source, activityType, metrics: { durationSeconds: 60, distanceMeters: 180 } });
      assert.equal(harness(row).refresh(), undefined);
    }
  }
});

test('manual-origin entries retaining real recording evidence remain eligible', () => {
  const gps = recording({ source: 'manual' });
  expectRefresh(harness(gps), gps, false);
  const health = linkedRecording({ source: 'manual', metrics: {} });
  expectRefresh(harness(health), health, true);
});

test('early link publication preserves the refresh key and focus changes invalidate old callbacks', () => {
  const row = recording(), ui = harness(row);
  const initial = expectRefresh(ui, row, false);
  const linked = linkedRecording();
  ui.publish(linked);
  const published = expectRefresh(ui, linked, true);
  assert.equal(initial.props.key, published.props.key, 'Early link publication must not remount the picker owner');
  ui.setFocused(false);
  assert.equal(initial.props.isCurrent(), false);
  ui.setFocused(true);
  assert.equal(initial.props.isCurrent(), false, 'An earlier focus session must never become current again');
  expectRefresh(ui, linked, true);
});

test('the rendered-screen assertion rejects reintroducing the old Health-link visibility guard', () => {
  const regression = screenSource.replace('supportsHealthSplitRefresh(activity)', 'activity.healthKit && supportsHealthSplitRefresh(activity)');
  assert.notEqual(regression, screenSource, 'The in-memory mutation must exercise the parent eligibility branch');
  const row = recording();
  assert.throws(() => expectRefresh(harness(row, regression), row, false), /Eligible Activity screen must render/);
  expectRefresh(harness(linkedRecording(), regression), linkedRecording(), true);
});
