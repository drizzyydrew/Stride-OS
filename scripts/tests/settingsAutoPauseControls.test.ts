import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
import { isAutoPauseEnabled, type AutoPauseMode } from '../../src/utils/autoPause';
import { setActivityAutoPauseEnabled } from '../../src/utils/autoPauseSettings';

type Element = { type: string; props: Record<string, any>; children: any[] };
const tick = () => new Promise<void>(resolve => setImmediate(resolve));

/** Executes the Settings page and the actual native-switch callbacks. Native
 * rendering/storage are replaced; recording policy remains the production helper. */
function harness(initial: AutoPauseMode, initialReady = true) {
  let cursor = 0, ready = initialReady;
  let write: Promise<void> = Promise.resolve();
  const slots: any[] = [];
  const written: AutoPauseMode[] = [];
  const finished = new Set<() => void>();
  const state: Record<string, any> = { autoPauseMode: initial, announceAutoPause: true, announceAutoResume: true,
    liveActivitiesEnabled: true, activityDetectionMode: 'off', treadmillPhonePlacementDefault: 'on_body',
    setAutoPauseMode: (mode: AutoPauseMode) => { state.autoPauseMode = mode; written.push(mode); return write; } };
  const store = Object.assign(() => state, { getState: () => state, persist: {
    hasHydrated: () => ready, onHydrate: () => () => {},
    onFinishHydration: (listener: () => void) => { finished.add(listener); return () => finished.delete(listener); },
  } });
  const mocks: Record<string, any> = {
    react: {
      useState(value: any) { const i = cursor++; if (!(i in slots)) slots[i] = typeof value === 'function' ? value() : value;
        return [slots[i], (next: any) => { slots[i] = next; }]; },
      useRef(value: any) { const i = cursor++; return slots[i] ??= { current: value }; },
      useEffect(fn: () => any) { const i = cursor++; if (!(i in slots)) slots[i] = { cleanup: fn() }; },
    },
    '../../../src/components/layout/NavigationEscape': { LegacyBackControl: 'LegacyBackControl' },
    'react-native': { ScrollView: 'ScrollView', View: 'View', Text: 'Text', Switch: 'VoiceSwitch', TouchableOpacity: 'TouchableOpacity', StyleSheet: { create: (value: any) => value } },
    '@expo/ui': { Host: 'Host', Switch: 'RecordingSwitch' },
    '../../../src/components/layout/PageSafeAreaView': { usePageSafeAreaInsets: () => ({ top: 0 }) },
    'expo-router': { useRouter: () => ({ back: () => {} }) }, '@expo/vector-icons': { Ionicons: 'Ionicons' },
    '../../../src/constants/layout': { LAYOUT: { screenPadBottom: 40 } },
    '../../../src/store/settingsStore': { useSettingsStore: store },
    '../../../src/theme/useColors': { useColors: () => ({ text: '#fff', bg: '#000', card: '#222', cardAlt: '#333', primary: '#abc', textMuted: '#ccc', critical: '#f00' }) },
    '../../../src/utils/autoPause': { isAutoPauseEnabled },
    '../../../src/utils/autoPauseSettings': { setActivityAutoPauseEnabled },
    '../../../src/store/themeStore': { useThemeMode: () => 'dark' },
  };
  const module = { exports: {} as any };
  const js = ts.transpileModule(readFileSync('app/(tabs)/settings/workout-intelligence.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, jsxFactory: 'h', esModuleInterop: true },
  }).outputText;
  runInNewContext(js, { module, exports: module.exports, require: (name: string) => {
    assert.ok(Object.hasOwn(mocks, name), `Unmocked Settings import: ${name}`); return mocks[name];
  }, h: (type: string, props: any, ...children: any[]) => ({ type, props: props ?? {}, children: children.flat() }) });
  function render() { cursor = 0; return module.exports.default() as Element; }
  function nodes(element: Element): Element[] { return [element, ...element.children.filter(child => child && typeof child === 'object').flatMap(nodes)]; }
  return { state, written, nodes: () => nodes(render()), toggle: (label: string) => nodes(render()).find(node => node.type === 'RecordingSwitch' && node.props.label === label)!,
    hydrate: () => { ready = true; finished.forEach(fn => fn()); }, setWrite: (promise: Promise<void>) => { write = promise; } };
}

test('actual Settings exposes recording switches independently from voice and preserves each sport', async () => {
  const h = harness('running_and_cycling');
  assert.equal(h.toggle('Auto-pause runs').props.value, true);
  assert.equal(h.toggle('Auto-pause rides').props.value, true);
  h.toggle('Auto-pause runs').props.onValueChange(false); await tick();
  assert.equal(h.state.autoPauseMode, 'cycling_only');
  h.toggle('Auto-pause rides').props.onValueChange(false); await tick();
  assert.equal(h.state.autoPauseMode, 'off');
  h.toggle('Auto-pause runs').props.onValueChange(true); await tick();
  assert.equal(h.state.autoPauseMode, 'running_only');
  assert.equal(h.state.announceAutoPause, true); assert.equal(h.state.announceAutoResume, true);
  assert.equal(h.nodes().filter(node => node.type === 'VoiceSwitch').length, 3);
});

test('Settings waits for hydration, serializes writes and reads the latest other-sport choice', async () => {
  const h = harness('off', false);
  assert.equal(h.toggle('Auto-pause runs').props.disabled, true);
  h.toggle('Auto-pause runs').props.onValueChange(true); await tick(); assert.deepEqual(h.written, []);
  h.hydrate();
  const oldRunHandler = h.toggle('Auto-pause runs').props.onValueChange;
  h.state.autoPauseMode = 'cycling_only';
  let resolve!: () => void; h.setWrite(new Promise<void>(yes => { resolve = yes; }));
  oldRunHandler(true);
  assert.equal(h.state.autoPauseMode, 'running_and_cycling');
  assert.equal(h.toggle('Auto-pause rides').props.disabled, true);
  h.toggle('Auto-pause rides').props.onValueChange(false);
  assert.deepEqual(h.written, ['running_and_cycling']);
  resolve(); await tick(); assert.equal(h.toggle('Auto-pause runs').props.disabled, false);
});

test('a Settings write failure shows an error and permits an explicit retry', async () => {
  const h = harness('running_only');
  let reject!: (error: Error) => void; h.setWrite(new Promise<void>((_yes, no) => { reject = no; }));
  h.toggle('Auto-pause runs').props.onValueChange(false); reject(new Error('storage unavailable')); await tick();
  assert.ok(h.nodes().some(node => node.props.accessibilityRole === 'alert'));
  assert.equal(h.toggle('Auto-pause runs').props.disabled, false);
  h.setWrite(Promise.resolve()); h.toggle('Auto-pause runs').props.onValueChange(true); await tick();
  assert.ok(!h.nodes().some(node => node.props.accessibilityRole === 'alert'));
});
