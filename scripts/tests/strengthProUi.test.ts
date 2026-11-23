import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

type Element = { type: any; props: Record<string, any> };
const elements = (tree: any): Element[] => !tree || typeof tree !== 'object' ? [] : Array.isArray(tree) ? tree.flatMap(elements)
  : [tree, ...elements(tree.props?.children)];
const tick = () => new Promise<void>(resolve => setImmediate(resolve));
function harness(filename: string) {
  let allowed = false, owner = 'A', generation = 1, cursor = 0, refreshGate: Promise<void> | undefined, focusedAccess: boolean | undefined;
  const slots: any[] = [], writes: any[] = [], groups: any[] = [], reorders: any[] = [], edits: any[] = [], reads: any[] = [], starts: any[] = [];
  const session: any = { source: 'custom', workoutName: 'Free open workout', workoutInstanceId: 'workout-A',
    status: 'active', exercises: ['a', 'b'].map(id => ({ id, name: id, equipment: ['dumbbell'], equipmentType: 'dumbbell', sets: 1,
      reps: '8', setEntries: [{ id: `s-${id}`, reps: 8, completed: false }] })), currentExerciseIndex: 0,
    rpeByExercise: {}, loadByExercise: {}, startedAt: Date.now(), pausedAt: null, pausedDurationMs: 0 };
  const lease = () => ({ ownerUserId: owner, generation });
  const current = (value: any) => value?.ownerUserId === owner && value?.generation === generation;
  const state = { session, addSet: (id: string) => edits.push(['add', id]), editSet: (...args: any[]) => edits.push(['edit', ...args]),
    reorderExercise: (...args: any[]) => reorders.push(args), groupExercises: (...args: any[]) => groups.push(args), attachTemplate: () => undefined, startSession: (...args: any[]) => starts.push(args) };
  const store = Object.assign((selector: any) => selector(state), { getState: () => state });
  const jsx = (type: any, props: any) => ({ type, props });
  const react = { useState: (initial: any) => {
    const index = cursor++; if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
    return [slots[index], (next: any) => { slots[index] = typeof next === 'function' ? next(slots[index]) : next; }];
  }, useRef: (value: any) => { const index = cursor++; return slots[index] ??= { current: value }; },
  useMemo: (fn: () => any) => fn(), useCallback: (fn: any) => fn, useEffect: () => undefined };
  const modules: Record<string, any> = {
    react, 'react/jsx-runtime': { jsx, jsxs: jsx }, 'expo-router': { useRouter: () => ({ push() {}, replace() {} }), useFocusEffect: (fn: any) => { if(focusedAccess!==allowed){ focusedAccess=allowed; fn(); } } },
    'react-native': { Alert: { alert() {} }, Text: 'Text', View: 'View', TextInput: 'TextInput', ScrollView: 'ScrollView', TouchableOpacity: 'TouchableOpacity',
      KeyboardAvoidingView: 'KeyboardAvoidingView', Keyboard: { dismiss() {} }, StyleSheet: { create: (v: any) => v } },
    '@expo/vector-icons': { Ionicons: 'Icon' },
  };
  const requireModule = (name: string) => {
    if (name in modules) return modules[name];
    if (name.endsWith('/hooks/useProAccess')) return { useProAccess: () => ({ allowed, status: allowed ? 'active' : 'inactive', message: 'Pro required', retry() {} }) };
    if (name.endsWith('/lib/pro-access')) return { hasProAccess: () => allowed, requireProAccess: async () => { await refreshGate; if (!allowed) throw Error('Pro required'); } };
    if (name.endsWith('/lib/localDataOwner')) return { captureOwnerLease: lease, ownerLeaseIsCurrent: current, getLocalDataOwner: () => ({}) };
    if (name.endsWith('/store/activeStrengthSessionStore')) return { useActiveStrengthSessionStore: store, activeStrengthElapsedSeconds: () => 10 };
    if (name.endsWith('/store/settingsStore')) return { useSettingsStore: () => ({ units: 'imperial' }) };
    if (name.endsWith('/store/strengthStore')) return { useStrengthStore: (select: any) => select({ manualLog() {} }) };
    if (name.endsWith('/store/athleteStore')) return { useAthleteStore: (select: any) => select({ fatigueScore: 20, currentWeek: 1 }) };
    if (name.endsWith('/theme/useColors')) return { useColors: () => ({}) };
    if (name.endsWith('/hooks/useWeekPlan')) return { useWeekPlan: () => ({}) };
    if (name.endsWith('/hooks/useScheduledSessions')) return { useScheduledSessions: () => ({}) };
    if (name.endsWith('/utils/warmupProtocols')) return { warmupForSession: () => ({ items: [], title: 'Warm-up', durationMinutes: 0 }) };
    if (name.endsWith('/utils/strengthTemplates')) return { makeStrengthTemplate: (value: any, title: string, account: string) => ({ id: 'template', name: title, ownerUserId: account, value }) };
    if (name.endsWith('/lib/strengthTemplateRepository')) return { readStrengthTemplates: async () => { reads.push(true);return [{ id:'template',name:'My saved routine',ownerUserId:'A',exercises:[{name:'Squat'}] }]; }, saveStrengthTemplate: async (value: any) => { writes.push(value); } };
    if (name.endsWith('/constants/layout')) return { LAYOUT: { tabBarHeight: 80 } };
    if (name.endsWith('/utils/strengthGuidance')) return { strengthGuidance: () => ({}) };
    if (name.endsWith('/goals/GoalLifecycleCard')) return { GoalAction: 'GoalAction' };
    if (name.includes('/components/') || name.startsWith('../ui/') || name.startsWith('../subscription/')) return { default: name.split('/').at(-1) };
    return {};
  };
  const code = ts.transpileModule(readFileSync(filename, 'utf8'), { fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(code, { module, exports: module.exports, process: { env: { EXPO_OS: 'web' } }, require: requireModule });
  const render = () => { cursor = 0; return (module.exports as any).default({ session }); };
  const find = (label: string) => elements(render()).find(item => item.props.accessibilityLabel === label || item.props.label === label)!;
  return { render, find, session, writes, groups, reorders, edits, reads, starts,
    pro: (value: boolean) => { allowed = value; }, gate: (value?: Promise<void>) => { refreshGate = value; }, switchOwner: () => { owner = 'B'; generation++; } };
}

test('non-Pro can log exercises/sets but grouping and reordering require refreshed Pro access', async () => {
  const h = harness('app/(tabs)/strength/custom-session.tsx');
  const card = () => elements(h.render()).find(item => item.type?.name === 'ExerciseCard')!;
  assert.ok(card(), 'open workout remains visible without Pro');
  card().props.onAddSet(); card().props.onEditSet('s-a', { reps: 9 });
  assert.equal(h.edits.length, 2);
  card().props.onReorder('down'); await tick(); assert.equal(h.reorders.length, 0);
  h.find('Select exercises').props.onPress();
  assert.ok(elements(h.render()).some(item => item.props.title?.includes('part of Pro')), JSON.stringify(elements(h.render()).map(item=>({type: typeof item.type==='string'?item.type:item.type?.name,title:item.props.title}))));
  h.pro(true); h.find('Select exercises').props.onPress();
  for (const item of elements(h.render()).filter(item => item.type?.name === 'ExerciseCard')) item.props.onSelect();
  h.find('More actions for selected exercises').props.onPress();
  const staleGroup = h.find('Make superset'); assert.ok(staleGroup);
  h.pro(false); staleGroup.props.onPress(); await tick(); assert.equal(h.groups.length, 0, 'stale rendered paid action cannot bypass expiry');
});

test('template save is gated, refreshes access before write and does not cross an owner switch', async () => {
  const h = harness('src/components/strength/SaveWorkoutTemplateControl.tsx');
  h.find('Save workout').props.onPress(); assert.equal(h.writes.length, 0);
  assert.ok(elements(h.render()).some(item => item.props.title?.includes('part of Pro')), JSON.stringify(elements(h.render()).map(item=>({type: typeof item.type==='string'?item.type:item.type?.name,title:item.props.title}))));
  h.pro(true); h.find('Save workout').props.onPress();
  h.pro(false); h.find('Save named workout').props.onPress(); await tick(); assert.equal(h.writes.length, 0);
  h.pro(true); h.find('Save named workout').props.onPress(); await tick(); assert.equal(h.writes.length, 1);
  const moved = harness('src/components/strength/SaveWorkoutTemplateControl.tsx'); moved.pro(true);
  moved.find('Save workout').props.onPress(); let release!: () => void;
  moved.gate(new Promise<void>(resolve => { release = resolve; }));
  moved.find('Save named workout').props.onPress(); moved.switchOwner(); release(); await tick();
  assert.equal(moved.writes.length, 0);
});

test('saved template route blocks free reads and stale reuse while retaining stored records', async () => {
  const h = harness('app/(tabs)/strength/saved-workouts.tsx');
  h.render(); await tick(); assert.equal(h.reads.length, 0);
  h.pro(true); h.render(); await tick();
  const start = h.find('Start My saved routine'); assert.ok(start);
  assert.equal(h.reads.length, 1);
  h.pro(false); h.render(); await tick();
  assert.equal(h.find('Start My saved routine'), undefined, 'saved routines disappear from paid surface on expiry');
  start.props.onPress(); await tick(); assert.equal(h.starts.length, 0);
  assert.equal(h.writes.length, 0, 'access denial does not overwrite or erase saved templates');
});
