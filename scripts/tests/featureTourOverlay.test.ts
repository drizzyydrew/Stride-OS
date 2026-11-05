import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
import * as definitions from '../../src/utils/featureTours';
import * as runtime from '../../src/utils/feature-tour-runtime';

function harness() {
  let cursor = 0; let dirty = false; let pathname = '/training'; let tree: any;
  const slots: any[] = []; const effects: (() => void)[] = [];
  const skipped: string[] = []; const completed: string[] = [];
  const changed = (old: any, deps: any[]) => !old || deps.some((value, index) => value !== old.deps[index]);
  const react = {
    createContext: () => ({ Provider: 'Provider' }),
    useRef: (value: any) => { const index = cursor++; return slots[index] ??= { current: value }; },
    useState: (initial: any) => { const index = cursor++; if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
      return [slots[index], (value: any) => { const next = typeof value === 'function' ? value(slots[index]) : value;
        if (!Object.is(slots[index], next)) { slots[index] = next; dirty = true; } }]; },
    useEffect: (fn: () => any, deps: any[]) => { const index = cursor++; const old = slots[index];
      if (changed(old, deps)) effects.push(() => { old?.cleanup?.(); slots[index] = { deps, cleanup: fn() }; }); },
    useMemo: (fn: () => any, deps: any[]) => { const index = cursor++; const old = slots[index];
      if (changed(old, deps)) slots[index] = { deps, value: fn() }; return slots[index].value; },
    useCallback: (fn: () => any, deps: any[]) => react.useMemo(() => fn, deps),
  };
  const native = {
    AccessibilityInfo: { isReduceMotionEnabled: async () => false, addEventListener: () => ({ remove() {} }) },
    StyleSheet: { create: (styles: any) => styles, absoluteFill: {} }, Platform: { OS: 'ios' },
    useWindowDimensions: () => ({ width: 390, height: 844 }),
    Modal: 'Modal', Pressable: 'Pressable', ScrollView: 'ScrollView', Text: 'Text', TouchableOpacity: 'TouchableOpacity', View: 'View',
  };
  const markSkipped = (id: string) => skipped.push(id); const markCompleted = (id: string) => completed.push(id);
  const exports: any = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/components/featureTour/FeatureTourProvider.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText, { exports, setTimeout, clearTimeout,
    require: (name: string) => {
      if (name === 'react') return react;
      if (name === 'react/jsx-runtime') return { jsx: (type: any, props: any) => ({ type, props }), jsxs: (type: any, props: any) => ({ type, props }) };
      if (name === 'react-native') return native;
      if (name === 'react-native-safe-area-context') return { useSafeAreaInsets: () => ({ top: 47, bottom: 34, left: 0, right: 0 }) };
      if (name === 'expo-router') return { usePathname: () => pathname };
      if (name.endsWith('/useColors')) return { useColors: () => ({ primary: 'blue', onPrimary: 'white', overlay: '#0008' }) };
      if (name.endsWith('/featureTourStore')) return { useFeatureTourStore: (selector: any) => selector({ markSkipped, markCompleted }) };
      if (name.endsWith('/featureTours')) return definitions;
      if (name.endsWith('/feature-tour-runtime')) return runtime;
      if (name.endsWith('/featureTourEvents')) return { recordFeatureTourEvent() {} };
      return {};
    },
  });
  const render = () => { for (let attempt = 0; attempt < 20; attempt += 1) {
    dirty = false; cursor = 0; tree = exports.FeatureTourProvider({ children: null });
    while (effects.length) effects.shift()!(); if (!dirty) return tree;
  } throw new Error('render loop'); };
  const find = (predicate: (node: any) => boolean, node = tree): any => {
    if (!node || typeof node !== 'object') return undefined;
    if (predicate(node)) return node;
    for (const child of [node.props?.children].flat(Infinity)) {
      if (!child || typeof child !== 'object') continue;
      const result = find(predicate, child); if (result) return result;
    }
  };
  render();
  return { render, registry: () => tree.props.value, skipped, completed,
    find, path: (value: string) => { pathname = value; render(); },
    settled: async (milliseconds = 85) => { await new Promise(resolve => setTimeout(resolve, milliseconds)); render(); },
  };
}

test('actual overlay draws yellow outline, guides explicit safe navigation and preserves backdrop dismiss', async () => {
  const h = harness(); let navigationCount = 0;
  const rect = { x: 120, y: 160, width: 90, height: 44 };
  h.registry().registerTarget('running.tab.active', { measure: async () => rect, activate: () => { navigationCount += 1; } });
  h.registry().registerTarget('running.start', { measure: async () => ({ ...rect, y: 300 }) });
  h.registry().startTour('running'); h.render(); await h.settled();
  const highlight = h.find(node => node.props?.testID === 'feature-tour-highlight');
  assert.ok(highlight);
  assert.equal(highlight.props.style[1].borderColor, '#FFD84D');
  assert.equal(navigationCount, 0, 'tour does not navigate until explicit tap');
  highlight.props.onPress({ stopPropagation() {} }); h.render(); await h.settled();
  assert.equal(navigationCount, 1);
  assert.equal(h.registry().activeTargetId, 'running.start');
  const backdrop = h.find(node => node.props?.accessibilityViewIsModal);
  backdrop.props.onPress(); h.render();
  assert.equal(h.find(node => node.type === 'Modal').props.visible, false);
  assert.deepEqual(h.skipped, ['running']); assert.deepEqual(h.completed, []);
});

test('navigating away cancels pending target measurement and never resurrects the modal', async () => {
  const h = harness();
  h.registry().registerTarget('running.tab.active', { measure: async () => ({ x: 30, y: 160, width: 120, height: 44 }), activate() {} });
  h.registry().startTour('running'); h.render();
  h.path('/settings'); await h.settled();
  assert.equal(h.find(node => node.type === 'Modal').props.visible, false);
  assert.equal(h.registry().activeTargetId, null);
  assert.equal(h.find(node => node.props?.testID === 'feature-tour-highlight'), undefined);
});

test('a missing navigation action has an honest fallback and can be skipped', async () => {
  const h = harness();
  h.registry().registerTarget('running.tab.active', { measure: async () => ({ x: 30, y: 160, width: 120, height: 44 }) });
  h.registry().startTour('running'); h.render(); await h.settled(600);
  assert.equal(h.find(node => node.props?.testID === 'feature-tour-highlight'), undefined);
  const next = h.find(node => node.props?.accessibilityLabel === 'Next walkthrough step');
  assert.equal(next.props.disabled, false); next.props.onPress(); h.render();
  assert.equal(h.registry().activeTargetId, 'running.start');
  h.find(node => node.props?.accessibilityViewIsModal).props.onPress(); h.render();
});
