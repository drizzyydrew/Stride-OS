import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import { watchErrorText, createWatchStartCoordinator, watchAvailability } from '../../src/utils/watchAvailability';

const status = { isSupported: true, isPaired: true, isWatchAppInstalled: true,
  isReachable: false, activationState: 'activated', lastMessageAt: 0,
  lastError: 'ERR_STRIDE_WATCH_START_WORKOUT: URLwhilelocked; passcode required; underlying native reason retained in full.' };

function load(filename: string, mocks: Record<string, unknown>) {
  const path = resolve(filename);
  const require = createRequire(path);
  const module = { exports: {} as any };
  const result = ts.transpileModule(readFileSync(path, 'utf8'), { fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true }, reportDiagnostics: true });
  assert.equal(result.diagnostics?.length, 0, filename);
  vm.runInNewContext(result.outputText, { module, exports: module.exports,
    require: (id: string) => Object.hasOwn(mocks, id) ? mocks[id] : require(id) });
  return module.exports;
}

function componentHarness(width = 390, fontScale = 1) {
  const values: any[] = [];
  let index = 0;
  const api = load('src/components/watch/WatchConnectionStatus.tsx', {
    react: {
      useState: (initial: any) => {
        const position = index++;
        if (!(position in values)) values[position] = typeof initial === 'function' ? initial() : initial;
        return [values[position], (value: any) => { values[position] = typeof value === 'function' ? value(values[position]) : value; }];
      },
      useRef: (initial: any) => {
        const position = index++;
        if (!(position in values)) values[position] = { current: initial };
        return values[position];
      },
    },
    'react-native': { ActivityIndicator: 'ActivityIndicator', Text: 'Text', TouchableOpacity: 'TouchableOpacity', View: 'View',
      StyleSheet: { create: (value: unknown) => value, hairlineWidth: 1 }, useWindowDimensions: () => ({ width, fontScale }) },
    '@expo/vector-icons': { Ionicons: 'Icon' },
    '../../theme/useColors': { useColors: () => ({ border: '#333', primary: '#abc', text: '#fff', textMuted: '#ccc', warning: '#faa' }) },
    '../../utils/watchAvailability': { watchAvailability, createWatchStartCoordinator },
  });
  return { render: (props: any) => { index = 0; return api.default(props); },
    hook: (onStatus: any, id?: string) => { index = 0; return api.useWatchStartRequest(onStatus, id); } };
}

function nodes(element: any): any[] {
  if (!element || typeof element !== 'object') return [];
  if (Array.isArray(element)) return element.flatMap(nodes);
  return [element, ...nodes(element.props?.children)];
}

test('Watch row exposes guidance and retry while preserving full native errors behind details', () => {
  const h = componentHarness();
  let retries = 0;
  const props = { status, active: true, workoutInstanceId: 'exact', onRetry: () => { retries++; } };
  let tree = nodes(h.render(props));
  const texts = () => tree.filter(node => node.type === 'Text').map(node => node.props.children).join(' ');
  assert.match(texts(), /Unlock.*passcode.*retry/);
  assert.match(texts(), /Phone recording continues/);
  assert.doesNotMatch(texts(), /URLwhilelocked/);
  tree.find(node => node.props.accessibilityLabel === 'Retry Apple Watch start').props.onPress();
  assert.equal(retries, 1);
  tree.find(node => node.props.accessibilityLabel === 'Show Watch error details').props.onPress();
  tree = nodes(h.render(props));
  const raw = tree.find(node => node.type === 'Text' && node.props.children === status.lastError);
  assert.ok(raw);
  assert.equal(raw.props.numberOfLines, undefined);
  assert.equal(raw.props.selectable, true);
});

test('paused or ending Watch row has no start retry and does not claim ongoing phone recording', () => {
  for (const mode of [{ paused: true }, { ending: true }]) {
    const tree = nodes(componentHarness().render({ status, active: true, workoutInstanceId: 'exact', onRetry() {}, ...mode }));
    assert.equal(tree.some(node => node.props.accessibilityLabel === 'Retry Apple Watch start'), false);
    assert.equal(tree.some(node => node.type === 'Text' && /Phone recording continues/.test(node.props.children)), false);
  }
});

test('hook safely renders without an active workout or failure', () => {
  const result = componentHarness().hook(() => undefined);
  assert.equal(result.busy, false);
  assert.equal(result.requestError, null);
});

test('320px and large text put 44px controls below the status; body text scales without fixed line height', () => {
  for (const [width, fontScale] of [[320, 1.6], [390, 1.3], [320, 1]]) {
    const tree = componentHarness(width, fontScale).render({ status, active: true, workoutInstanceId: 'exact', onRetry() {} });
    const row = tree.props.children[0];
    const controls = tree.props.children[1];
    assert.ok(controls, `${width}/${fontScale} uses a separate controls row`);
    assert.equal(nodes(row).some(node => node.props.accessibilityLabel === 'Retry Apple Watch start'), false);
    const buttons = nodes(controls).filter(node => node.type === 'TouchableOpacity');
    assert.equal(buttons.length, 2);
    for (const button of buttons) assert.deepEqual([button.props.style.width, button.props.style.height], [44, 44]);
    const title = nodes(row).find(node => node.type === 'Text' && node.props.children === 'Apple Watch');
    assert.equal(title.props.style[0].fontSize, 14);
    for (const text of nodes(row).filter(node => node.type === 'Text' && node !== title)) {
      assert.equal(text.props.style[0].fontSize, 13);
      assert.equal(text.props.style[0].lineHeight, undefined);
      assert.equal(text.props.allowFontScaling, undefined);
      assert.equal(text.props.numberOfLines, undefined);
    }
  }
});

test('JS native bridge normalizes plain Expo failures and preserves native start arguments', async () => {
  let received: unknown[] = [];
  const api = load('modules/stride-watch-connectivity/src/index.ts', {
    'react-native': { Platform: { OS: 'ios' } },
    'expo-modules-core': { requireNativeModule: () => ({
      snapshot: () => status,
      startWorkout: async (...args: unknown[]) => { received = args; throw { code: 'ERR_STRIDE_WATCH_START_WORKOUT', reason: 'Open the updated watch app' }; },
    }) },
    '../../../src/utils/watchAvailability': { watchErrorText },
  });
  const result = await api.startStrideWatchWorkout({ workoutKind: 'walking', workoutInstanceId: 'exact', title: 'Walk', environment: 'outdoor', targetZone: null });
  assert.equal(Array.from(received).join('|'), 'walking|exact|Walk|outdoor|');
  assert.equal(result.lastError, 'ERR_STRIDE_WATCH_START_WORKOUT: Open the updated watch app');
});
