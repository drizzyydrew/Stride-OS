import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import * as bank from '../../src/constants/strengthBank';
import * as programming from '../../src/utils/strengthPresetProgramming';
import { displayLabels } from '../../src/utils/displayLabels';
import { formatPrescriptionWithSets } from '../../src/utils/prescriptionFormat';

type Element = { type: any; props: Record<string, any> };
function elements(tree: any): Element[] {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(elements);
  return [tree, ...elements(tree.props?.children)];
}
function text(tree: any): string {
  if (typeof tree === 'string' || typeof tree === 'number') return String(tree);
  if (Array.isArray(tree)) return tree.map(text).join(' ');
  return tree?.props ? text(tree.props.children) : '';
}

function harness() {
  let owner = 'test-owner', generation = 1, current = true, hydrated = true;
  let id = 'sw_barbell_full_body_strength_a';
  let conflict: any = null, ending: Promise<void> | undefined;
  const alerts: any[] = [], routes: any[] = [], starts: any[] = [], native: string[] = [];
  const onboarding = { data: { strengthLevel: 'beginner', strengthSessionMinutes: 60, goalType: 'general_strength' } };
  const athlete = { fatigueScore: 25, recoveryScore: 85 };
  const active: any = { session: null, startSession: (input: any) => {
    starts.push(input); active.session = { ...input, workoutInstanceId: `launched-${starts.length}` };
  } };
  const store = (state: any) => Object.assign((selector?: any) => selector ? selector(state) : state, { getState: () => state });
  const slots: any[] = []; let cursor = 0;
  const react = {
    useState: (initial: any) => { const index = cursor++; if (!(index in slots)) slots[index] = initial;
      return [slots[index], (next: any) => { slots[index] = typeof next === 'function' ? next(slots[index]) : next; }]; },
    useRef: (value: any) => { const index = cursor++; return slots[index] ??= { current: value }; },
    useEffect: (fn: () => void, deps: any[]) => { const index = cursor++, prior = slots[index];
      if (!prior || deps.some((value, i) => !Object.is(value, prior[i]))) { slots[index] = deps; fn(); } },
  };
  const jsx = (type: any, props: any) => ({ type, props });
  const Picker = Object.assign('Picker', { Item: 'PickerItem' });
  const root = '../../../../src/';
  const mocks: Record<string, unknown> = {
    react, 'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': { Alert: { alert: (...args: any[]) => alerts.push({ title: args[0], message: args[1], buttons: args[2] ?? [] }) },
      ScrollView: 'ScrollView', Text: 'Text', TouchableOpacity: 'TouchableOpacity', View: 'View', StyleSheet: { create: (value: any) => value } },
    '@expo/ui': { Host: 'Host', Picker },
    'expo-router': { useLocalSearchParams: () => ({ id }), useRouter: () => ({ push: (value: any) => routes.push(['push', value]),
      replace: (value: any) => routes.push(['replace', value]), back: () => routes.push(['back']) }) },
    [root + 'components/layout/PageSafeAreaView']: { default: 'SafeAreaView' },
    [root + 'components/layout/ScreenHeader']: { default: 'ScreenHeader' },
    [root + 'constants/layout']: { LAYOUT: { gutter: 20, maxContentWidth: 600 } },
    [root + 'constants/strengthBank']: bank,
    [root + 'store/themeStore']: { useThemeMode: () => 'dark' },
    [root + 'theme/useColors']: { useColors: () => ({}) },
    [root + 'store/settingsStore']: { useSettingsStore: () => ({ units: 'imperial' }) },
    [root + 'store/activeStrengthSessionStore']: { useActiveStrengthSessionStore: store(active) },
    [root + 'store/onboardingStore']: { useOnboardingStore: store(onboarding) },
    [root + 'store/athleteStore']: { useAthleteStore: store(athlete) },
    [root + 'store/checkInStore']: { useCheckInStore: store({ todayCheckIn: null }) },
    [root + 'store/trainingPlanStore']: { useTrainingPlanStore: store({ goalType: 'general_strength' }) },
    [root + 'hooks/useWeekPlan']: { useWeekPlan: () => ({ metadata: { trainingMode: 'plan', trainingPhase: 'base' }, strengthWeek: { progressionState: 'maintain' } }) },
    [root + 'utils/displayLabels']: { displayLabels },
    [root + 'utils/prescriptionFormat']: { formatPrescriptionWithSets },
    [root + 'utils/strengthPresetProgramming']: programming,
    [root + 'lib/localDataOwner']: { captureOwnerLease: () => current ? { ownerUserId: owner, generation } : null,
      ownerLeaseIsCurrent: (lease: any) => current && lease?.ownerUserId === owner && lease?.generation === generation },
    [root + 'lib/activeSessionCoordinator']: { activeSessionStoresHydrated: () => hydrated, getConflictingActiveSession: () => conflict },
    [root + 'lib/strengthLiveActivity']: { endStrengthLiveActivity: async () => { native.push('end-live'); await ending; },
      startStrengthLiveActivity: async () => { native.push('start-live'); } },
    '../../../../modules/stride-watch-connectivity/src': { endStrideWatchWorkout: async () => { native.push('end-watch'); },
      setStrideWatchWorkoutContext: async () => { native.push('watch-context'); }, startStrideWatchWorkout: async () => { native.push('start-watch'); } },
  };
  const filename = resolve('app/(tabs)/strength/preset/[id].tsx');
  const code = ts.transpileModule(readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(code, { module, exports: module.exports, console, process: { env: { EXPO_OS: 'web' } }, require: (name: string) => {
    assert.ok(name in mocks, name); return mocks[name];
  } }, { filename });
  const render = () => { cursor = 0; return (module.exports as any).default(); };
  const pressStart = () => { const button = elements(render()).find(element => element.type === 'TouchableOpacity'
    && /^(?:Review session fit|Start |Continue )/.test(text(element))); assert.ok(button); button.props.onPress(); };
  const button = (label: string, alert = alerts.at(-1)) => { const found = alert?.buttons.find((item: any) => item.text === label);
    assert.ok(found, `${alert?.title}: ${label}`); return found; };
  const chooseSets = (value: number) => { const picker = elements(render()).find(element => element.type?.name === 'MainSetPicker'); assert.ok(picker);
    const ui = picker.type(picker.props), menu = elements(ui).find(element => element.props.appearance === 'menu'); assert.ok(menu); menu.props.onValueChange(value); render(); };
  return { render, pressStart, button, chooseSets, alerts, routes, starts, native, active, athlete, onboarding,
    retire: () => { current = false; }, switchOwner: () => { owner = 'different-owner'; generation++; current = true; },
    hydrate: (value: boolean) => { hydrated = value; }, conflict: (value: any) => { conflict = value; },
    route: (next: string) => { id = next; render(); render(); },
    holdEnd: () => { let release!: () => void; ending = new Promise<void>(resolve => { release = resolve; }); return release; } };
}

test('actual preset screen acknowledges only this session and launches the displayed three-set dose', () => {
  const h = harness(), before = structuredClone(h.onboarding);
  h.pressStart(); assert.equal(h.starts.length, 0); assert.match(h.alerts.at(-1).message, /only to this session/);
  h.button('Continue anyway').onPress();
  assert.equal(h.starts.length, 1);
  assert.deepEqual(h.starts[0].exercises.slice(0, 2).map((exercise: any) => exercise.sets), [3, 3]);
  assert.deepEqual(h.onboarding, before, 'acknowledgement is not a saved profile override');
});

test('set picker accepts three/four/five and invalidates an alert acknowledging an earlier dose', () => {
  const h = harness(); h.chooseSets(4); h.pressStart(); const stale = h.button('Continue anyway');
  h.chooseSets(5); stale.onPress(); assert.equal(h.starts.length, 0); assert.equal(h.alerts.at(-1).title, 'Session details changed');
  h.chooseSets(99); h.pressStart(); h.button('Continue anyway').onPress();
  assert.deepEqual(h.starts[0].exercises.slice(0, 2).map((exercise: any) => exercise.sets), [5, 5]);
});

test('changed readiness or retired owner invalidates pending session acknowledgement', () => {
  for (const change of ['readiness', 'owner'] as const) {
    const h = harness(); h.pressStart(); const stale = h.button('Continue anyway');
    if (change === 'owner') h.switchOwner(); else h.athlete.recoveryScore = 40;
    stale.onPress(); assert.equal(h.starts.length, 0, change); assert.equal(h.native.length, 0, change);
    h.pressStart(); h.button('Continue anyway').onPress(); assert.equal(h.starts.length, 1, 'fresh explicit acknowledgement may launch');
  }
});

test('hydration and owner readiness still gate the actual start interaction', () => {
  const h = harness(); h.hydrate(false); h.pressStart(); assert.equal(h.alerts.at(-1).title, 'Restoring session');
  h.hydrate(true); h.retire(); h.pressStart(); assert.equal(h.alerts.at(-1).title, 'Profile is still restoring'); assert.equal(h.starts.length, 0);
});

test('a captured active preset resumes without replacing its existing prescription', () => {
  const h = harness(); h.active.session = { source: 'preset', workoutId: 'sw_barbell_full_body_strength_a', workoutName: 'Captured',
    plannedDurationMin: 20, workoutInstanceId: 'existing', exercises: [{ id: 'old-squat', name: 'Back Squat', sets: 2, reps: '8', equipment: ['barbell'] }] };
  const before = structuredClone(h.active.session);
  assert.ok(!elements(h.render()).some(element => element.type?.name === 'MainSetPicker'));
  h.pressStart(); assert.equal(h.starts.length, 0); assert.deepEqual(h.active.session, before);
  assert.deepEqual(h.routes.at(-1), ['push', '/(tabs)/strength/preset-session']);
});

test('acknowledgement does not bypass a cross-domain active workout conflict', () => {
  const h = harness(); h.conflict({ name: 'Run', route: '/run-live' });
  h.pressStart(); h.button('Continue anyway').onPress(); assert.equal(h.alerts.at(-1).title, 'Another session is active');
  h.button('Continue Current Session').onPress(); assert.equal(h.starts.length, 0); assert.equal(h.native.length, 0);
  assert.deepEqual(h.routes.at(-1), ['push', '/run-live']);
});

test('strength conflict resumes existing work, and pending replacement cannot cross owner or instance changes', async () => {
  for (const change of ['resume', 'owner', 'instance'] as const) {
    const h = harness(); h.active.session = { source: 'training_block', workoutId: 'other', workoutName: 'Existing work', workoutInstanceId: 'old-instance', exercises: [] };
    h.pressStart(); h.button('Continue anyway').onPress(); assert.equal(h.alerts.at(-1).title, 'Another strength session is active');
    if (change === 'resume') { h.button('Continue Current Session').onPress(); assert.equal(h.starts.length, 0); assert.equal(h.native.length, 0); continue; }
    const release = h.holdEnd(), pending = h.button('End Current Session and Start Other Workout').onPress();
    if (change === 'owner') h.switchOwner(); else h.active.session = { ...h.active.session, workoutInstanceId: 'new-instance' };
    release(); await pending; assert.equal(h.starts.length, 0, change); assert.deepEqual(h.native, ['end-live'], change);
  }
});

test('changing main-set dose during explicit replacement invalidates its earlier acknowledgement', async () => {
  const h = harness(); h.active.session = { source: 'training_block', workoutId: 'other', workoutName: 'Existing', workoutInstanceId: 'old', exercises: [] };
  h.pressStart(); h.button('Continue anyway').onPress();
  const release = h.holdEnd(), pending = h.button('End Current Session and Start Other Workout').onPress();
  h.chooseSets(5); release(); await pending;
  assert.equal(h.starts.length, 0); assert.equal(h.alerts.at(-1).title, 'Session details changed');
});
