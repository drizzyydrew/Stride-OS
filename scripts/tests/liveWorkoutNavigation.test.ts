import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
import { liveWorkoutDestination, liveWorkoutNavigationMethod } from '../../src/utils/liveWorkoutNavigation';
import type { ActiveSessionSnapshot } from '../../src/utils/activeSessionOwner';
import { createBackActionRegistry, isSectionRoot } from '../../src/utils/navigationEscape';

const empty: ActiveSessionSnapshot = { runningActive: false, outdoorActive: false, outdoorName: 'Walk',
  indoorRideActive: false, strengthName: null, strengthSource: null };
const access = { hydrated: true, canAccessLocalData: true };

test('each retained recording returns to its actual controls, including all strength sources', () => {
  for (const [snapshot, route] of [
    [{ ...empty, runningActive: true }, '/(tabs)/training'],
    [{ ...empty, outdoorActive: true }, '/(tabs)/activity/start'],
    [{ ...empty, indoorRideActive: true }, '/(tabs)/activity/indoor-ride'],
    [{ ...empty, strengthName: 'Strength A', strengthSource: 'training_block' }, '/(tabs)/strength'],
    [{ ...empty, strengthName: 'Preset A', strengthSource: 'preset' }, '/(tabs)/strength/preset-session'],
    [{ ...empty, strengthName: 'Custom A', strengthSource: 'custom' }, '/(tabs)/strength/custom-session'],
  ] as [ActiveSessionSnapshot, string][]) {
    assert.equal(liveWorkoutDestination(snapshot, '/settings', access)?.route, route);
    assert.equal(liveWorkoutDestination(snapshot, route, access), null);
    assert.equal(liveWorkoutDestination(snapshot, route.replace('/(tabs)', '') + '/index', access), null);
  }
});

test('hydration, account access, auth routes and conflicting records suppress the shortcut', () => {
  const run = { ...empty, runningActive: true };
  assert.equal(liveWorkoutDestination(empty, '/settings', access), null);
  assert.equal(liveWorkoutDestination(run, '/settings', { ...access, hydrated: false }), null);
  assert.equal(liveWorkoutDestination(run, '/settings', { ...access, canAccessLocalData: false }), null);
  for (const path of ['/auth/sign-in', '/auth/reset-password', '/onboarding', '/onboarding/physiology']) {
    assert.equal(liveWorkoutDestination(run, path, access), null);
  }
  assert.equal(liveWorkoutDestination({ ...run, outdoorActive: true }, '/settings', access), null);
  assert.equal(liveWorkoutDestination({ ...run, strengthName: 'A', strengthSource: 'custom' }, '/settings', access), null);
});

type Element = { type: string; props: Record<string, any>; children: any[] };
function headerHarness(options: { paused?: boolean; path?: string } = {}) {
  const run = { isActive: true, isPaused: options.paused ?? false, workoutInstanceId: 'retained-run', startTime: 1000 };
  const outdoor = { isActive: false, name: 'Walk' };
  const ride = { isActive: false };
  const strength = { session: null };
  const auth = { canAccessLocalData: true, loading: false };
  let ownerCurrent = true;
  const navigated: unknown[] = [];
  const pushed: unknown[] = [];
  let backed = 0;
  const registry = createBackActionRegistry();
  function store(value: object) {
    return Object.assign((selector: (value: any) => unknown) => selector(value), { getState: () => value,
      persist: { hasHydrated: () => true, onHydrate: () => () => {}, onFinishHydration: () => () => {} } });
  }
  const mocks: Record<string, any> = {
    react: { createContext: () => ({ Provider: 'Provider' }), useContext: () => registry,
      useMemo: (fn: () => any) => fn(), useCallback: (fn: () => any) => fn,
      useRef: (value: any) => ({ current: value }), useState: (value: any) => [typeof value === 'function' ? value() : value, () => {}],
      useEffect: (fn: () => any) => { fn(); } },
    'react-native': { Pressable: 'Pressable', View: 'View', Text: 'Text', StyleSheet: { create: (value: any) => value, hairlineWidth: 1 } },
    'expo-router': { usePathname: () => options.path ?? '/settings/profile', useFocusEffect: () => {},
      useRouter: () => ({ canGoBack: () => true, navigate: (value: unknown) => navigated.push(value), push: (value: unknown) => pushed.push(value), back: () => backed++, replace: (value: unknown) => navigated.push(value) }) },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0 }) },
    '../../theme/useColors': { useColors: () => ({ bg: '#000', border: '#333', text: '#fff', textMuted: '#ccc', primary: '#abc', primaryDim: '#123' }) },
    '../ui/BrandChevrons': { default: 'BrandChevrons' }, '@expo/vector-icons': { Ionicons: 'Ionicons' },
    '../../utils/navigationEscape': { createBackActionRegistry, isSectionRoot },
    '../../utils/liveWorkoutNavigation': { liveWorkoutDestination, liveWorkoutNavigationMethod },
    '../../store/activeRunStore': { useActiveRunStore: store(run) },
    '../../store/activeActivityStore': { useActiveActivityStore: store(outdoor) },
    '../../store/activeIndoorRideStore': { useActiveIndoorRideStore: store(ride) },
    '../../store/activeStrengthSessionStore': { useActiveStrengthSessionStore: store(strength) },
    '../../store/authStore': { useAuthStore: store(auth) },
    '../../lib/localDataOwner': { captureOwnerLease: () => ({ ownerUserId: 'owner', generation: 1 }), ownerLeaseIsCurrent: () => ownerCurrent },
  };
  const module = { exports: {} as any };
  const js = ts.transpileModule(readFileSync('src/components/layout/NavigationEscape.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, jsxFactory: 'h', esModuleInterop: true },
  }).outputText;
  runInNewContext(js, { module, exports: module.exports, require: (name: string) => {
    assert.ok(Object.hasOwn(mocks, name), `Unmocked header import: ${name}`); return mocks[name];
  }, h: (type: string, props: any, ...children: any[]) => ({ type, props: props ?? {}, children: children.flat() }) });
  const render = () => module.exports.FixedNavigationBanner() as Element;
  function nodes(element: Element): Element[] {
    return [element, ...element.children.filter(child => child && typeof child === 'object').flatMap(nodes)];
  }
  const live = () => nodes(render()).find(node => String(node.props.accessibilityLabel).startsWith('Return to live workout'));
  return { run, outdoor, strength, auth, navigated, pushed, live, registry, revoke: () => { ownerCurrent = false; },
    back: () => nodes(render()).find(node => node.props.accessibilityLabel === 'Back')?.props.onPress(), backed: () => backed };
}

test('actual global header returns to the retained active or paused run without touching its state or Back handler', () => {
  for (const paused of [false, true]) {
    const h = headerHarness({ paused }); const original = { ...h.run };
    let guardedBack = 0;
    h.registry.register(Symbol(), { path: '/settings/profile', invoke: () => guardedBack++ });
    h.live()!.props.onPress();
    assert.deepEqual(h.run, original);
    assert.equal(h.navigated.length, 1);
    assert.equal((h.navigated[0] as any).pathname, '/(tabs)/training');
    assert.equal((h.navigated[0] as any).params.tab, 'active');
    assert.equal(guardedBack, 0);
    h.back(); assert.equal(guardedBack, 1); assert.equal(h.backed(), 0);
  }
});

test('stale header callbacks recheck ended/conflicting sessions and revoked account access', () => {
  const ended = headerHarness(); const pressEnded = ended.live()!.props.onPress;
  ended.run.isActive = false; pressEnded(); assert.deepEqual(ended.navigated, []);
  const conflict = headerHarness(); const pressConflict = conflict.live()!.props.onPress;
  conflict.outdoor.isActive = true; pressConflict(); assert.deepEqual(conflict.navigated, []);
  const signedOut = headerHarness(); const pressSignedOut = signedOut.live()!.props.onPress;
  signedOut.auth.canAccessLocalData = false; pressSignedOut(); assert.deepEqual(signedOut.navigated, []);
  const revoked = headerHarness(); const pressRevoked = revoked.live()!.props.onPress;
  revoked.revoke(); pressRevoked(); assert.deepEqual(revoked.navigated, []);
  assert.equal(headerHarness({ path: '/training' }).live(), undefined);
});

test('return from another activity or strength form pushes the controls instead of unwinding unsaved drafts', () => {
  const activity = headerHarness({ path: '/activity/manual' });
  activity.run.isActive = false; activity.outdoor.isActive = true;
  activity.live()!.props.onPress();
  assert.deepEqual(activity.pushed, ['/(tabs)/activity/start']);
  assert.deepEqual(activity.navigated, []);
  const strength = headerHarness({ path: '/strength/preset/new' });
  strength.run.isActive = false;
  Object.assign(strength.strength, { session: { workoutName: 'My retained workout', source: 'custom', status: 'paused', workoutInstanceId: 'retained-strength' } });
  const before = JSON.stringify(strength.strength);
  strength.live()!.props.onPress();
  assert.deepEqual(strength.pushed, ['/(tabs)/strength/custom-session']);
  assert.deepEqual(strength.navigated, []);
  assert.equal(JSON.stringify(strength.strength), before);
});
