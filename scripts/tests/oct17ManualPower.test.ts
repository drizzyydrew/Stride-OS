import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import type { Activity, ActivityDraft } from '../../src/types/activity';
import * as completion from '../../src/utils/activityCompletion';
import * as edit from '../../src/utils/manualActivityEdit';
import * as automatic from '../../src/utils/automaticActivityPower';
import * as power from '../../src/utils/outdoorPower';
import * as profilePower from '../../src/utils/profilePower';
import * as climbing from '../../src/utils/climbingWork';
import * as dates from '../../src/utils/dateOnly';
import * as substitution from '../../src/utils/substitution';
import * as powerPresentation from '../../src/utils/activityPowerPresentation';
import * as powerEquivalents from '../../src/utils/powerEquivalents';
import { sanitizeActivityMetrics } from '../../src/utils/activityLoad';

const startTime = new Date(2026, 9, 16, 8, 17, 23).getTime();
const profile = { athleteId: 'saved-athlete', weightKg: 82, weightProvenance: { source: 'user_entered' as const, weightKg: 82, savedAt: 1234 } };
const changedProfile = (weightKg: number) => ({ ...profile, weightKg, weightProvenance: { ...profile.weightProvenance, weightKg } });
function activity(type: Activity['activityType'] = 'cycling'): Activity {
  return {
    id: 'recorded', workoutInstanceId: 'instance', activityType: type, subtype: 'outdoor', source: 'tracked',
    scheduled: false, status: 'completed', startTime, endTime: startTime + 100_000, createdAt: 123, updatedAt: 456,
    indoor: false, rpe: 4, notes: 'original', trainingLoad: {} as Activity['trainingLoad'],
    metrics: { durationSeconds: 91, activeTimeSeconds: 91, elapsedTimeSeconds: 100,
      distanceMeters: 299.123, elevationGainMeters: 30.123,
      metricSources: { distance: 'phone_gps', elevation: 'phone_gps', heartRate: 'apple_watch' },
      recordingPauses: [{ startTime: startTime + 20_000, endTime: startTime + 29_000 }],
      rawHeartRateSamples: [{ timestamp: startTime, bpm: 130, source: 'apple_watch' }],
      cadenceSamples: [{ timestamp: startTime, rpm: 80, kind: 'cycling', source: 'cycling_cadence_sensor' }],
      routeCoordinates: Array.from({ length: 101 }, (_, index) => ({ latitude: index * 3 / 111195, longitude: 0,
        altitudeMeters: 100 + index * 0.3, timestamp: startTime + index * 1000 })) },
  };
}

test('profile mass validates the saved athlete with no onboarding or numeric fallback', () => {
  assert.deepEqual(profilePower.profilePowerMass(profile), { bodyMassKg: 82, athleteId: 'saved-athlete', source: 'active_profile', savedAt: 1234, provenance: profile.weightProvenance });
  assert.equal(profilePower.profilePowerMass({ athleteId: 'athlete_default', weightKg: 70 }), null);
  assert.equal(profilePower.profilePowerMass({ athleteId: 'athlete_default', weightKg: 75 }), null);
  assert.equal(profilePower.profilePowerMass({ ...profile, weightKg: 90 }), null);
  for (const weightKg of [NaN, Infinity, 0, 19.9, 300.1]) assert.equal(profilePower.profilePowerMass({ ...profile, weightKg }), null);
  assert.equal(profilePower.profilePowerMass(undefined), null);
  assert.equal(profilePower.profilePowerMass({ ...profile, athleteId: '' }), null);
  assert.equal(profilePower.profilePowerMass(changedProfile(20))?.bodyMassKg, 20);
  assert.equal(profilePower.profilePowerMass(changedProfile(300))?.bodyMassKg, 300);
});

test('elevation conversion distinguishes absent, zero and invalid input and supports exact feet/meters', () => {
  assert.deepEqual(edit.parseElevationInput('  ', 'metric'), {});
  assert.deepEqual(edit.parseElevationInput('0', 'imperial'), { meters: 0 });
  assert.deepEqual(edit.parseElevationInput('1000', 'imperial'), { meters: 304.8 });
  assert.deepEqual(edit.parseElevationInput('304.8', 'metric'), { meters: 304.8 });
  assert.equal(edit.elevationInputText(304.8, 'imperial'), '1000');
  for (const input of ['-1', 'NaN', 'Infinity', '.', '1e3', '1,000']) assert.ok(edit.parseElevationInput(input, 'metric').error);
  assert.equal(completion.buildManualActivityDraft(null, { elevationGainMeters: 0 }).metrics.elevationGainMeters, 0);
  assert.equal(completion.buildManualActivityDraft(null, { elevationGainFeet: 1000 }).metrics.elevationGainMeters, 304.8);
});

test('automatic GPS estimates persist versioned saved-profile inputs and do not recompute on unrelated edits', () => {
  for (const sport of ['running', 'cycling'] as const) {
    const original = activity(sport);
    const snapshot = structuredClone(original);
    const metrics = automatic.withAutomaticActivityPower(original, profile, 1000);
    assert.ok(metrics.powerEstimate);
    assert.equal(metrics.powerEstimate.version, '3');
    assert.equal(metrics.powerEstimate.computedAt, 1000);
    assert.match(metrics.powerEstimate.inputs[0]!.name, /Saved active-profile/);
    assert.equal(metrics.powerEstimate.inputs[0]!.value, 82);
    assert.equal((metrics.powerEstimate as any).automaticInputs.massSource, 'active_profile');
    const saved = { ...original, metrics: sanitizeActivityMetrics(sport, metrics) };
    assert.equal(automatic.withAutomaticActivityPower(saved, profile, 2000), saved.metrics);
    const notesOnly = { ...saved, notes: 'edited', updatedAt: 10000 };
    assert.equal(automatic.withAutomaticActivityPower(notesOnly, profile, 3000), notesOnly.metrics);
    const changedMass = automatic.withAutomaticActivityPower(saved, changedProfile(90), 4000);
    assert.equal(changedMass, saved.metrics);
    const differentAthlete = automatic.withAutomaticActivityPower(saved, { ...changedProfile(90), athleteId: 'another-athlete' }, 5000);
    assert.equal(differentAthlete, saved.metrics);
    const corrected = { ...saved, metrics: { ...saved.metrics, activeTimeSeconds: 95 } };
    const correctedMetrics = automatic.withAutomaticActivityPower(corrected, changedProfile(90), 6000);
    assert.equal(correctedMetrics.powerEstimate?.computedAt, 6000);
    assert.equal(correctedMetrics.powerEstimate?.version, saved.metrics.powerEstimate?.version);
    assert.equal(correctedMetrics.powerEstimate?.inputs[0]!.value, 82);
    assert.deepEqual(original, snapshot);
    if (sport === 'cycling') {
      assert.equal(metrics.powerEstimate.inputs[1]!.source, 'model_estimate');
      assert.match(metrics.powerEstimate.assumptions.join(' '), /Bicycle mass assumed to be 10 kg/);
    }
  }
});

test('measured, device-estimated and user-entered power take priority; valid existing model estimates survive', () => {
  for (const kind of ['measured', 'device_estimated'] as const) {
    const original = activity();
    original.metrics.powerSamples = Array.from({ length: 101 }, (_, index) => ({ timestamp: startTime + index * 1000,
      watts: 200, sport: 'cycling', source: 'cycling_power_meter', kind }));
    assert.equal(automatic.withAutomaticActivityPower(original, profile), original.metrics);
    assert.equal(power.devicePowerSummary(original)?.kind, kind);
  }
  const entered = activity();
  entered.metrics.cyclingPowerWatts = 177;
  entered.metrics.metricSources!.power = 'manual_entry';
  assert.equal(automatic.withAutomaticActivityPower(entered, profile), entered.metrics);
  const existing = activity();
  existing.metrics.powerEstimate = power.estimateActivityPower(existing, 70, 11, 99)!;
  assert.equal(automatic.withAutomaticActivityPower(existing, profile), existing.metrics);
});

test('mass alone, aggregate manual totals, indoor sessions, run/walk and snow do not yield outdoor watts', () => {
  for (const sport of ['running', 'cycling', 'ski_touring', 'snowboard_touring', 'downhill_skiing', 'snowboarding', 'cross_country_skiing', 'hiking'] as const) {
    const manual = activity(sport);
    manual.source = 'manual'; delete manual.workoutInstanceId;
    assert.equal(automatic.withAutomaticActivityPower(manual, profile).powerEstimate, undefined, sport);
    manual.metrics.routeCoordinates = undefined;
    manual.metrics.distanceMeters = 10000;
    manual.metrics.elevationGainMeters = 1000;
    assert.equal(automatic.withAutomaticActivityPower(manual, profile).powerEstimate, undefined, sport);
  }
  const indoor = activity(); indoor.indoor = true;
  assert.equal(automatic.withAutomaticActivityPower(indoor, profile).powerEstimate, undefined);
  const mixed = activity('running'); mixed.subtype = 'run_walk';
  assert.equal(automatic.withAutomaticActivityPower(mixed, profile).powerEstimate, undefined);
  const missingGrade = activity(); missingGrade.metrics.routeCoordinates!.forEach(point => { delete point.altitudeMeters; });
  assert.equal(automatic.withAutomaticActivityPower(missingGrade, profile).powerEstimate, undefined);
  assert.equal(automatic.withAutomaticActivityPower(activity(), undefined).powerEstimate, undefined);
  const hiking = activity('hiking'); hiking.source = 'manual';
  assert.ok(power.estimateClimbingWork(hiking, 82)!.kilojoules > 0);
  assert.match(power.estimateClimbingWork(hiking, 82)!.note, /not total human power or calories/);
});

type Node = { type: string; props: Record<string, any>; children: any[] };
function harness(path: string, initial?: Activity, options: { units?: 'metric' | 'imperial'; profile?: typeof profile | null; activityId?: boolean; random?: () => number; failLink?: boolean } = {}) {
  let records = initial ? [initial] : [];
  let activeProfile = options.profile === null ? undefined : options.profile ?? profile;
  let states: any[] = [];
  let cursor = 0;
  let dirty = false;
  let effects: (() => void)[] = [];
  let tree: Node;
  const alerts: any[][] = [];
  const navigation: any[] = [];
  const writes: any[] = [];
  let failWrite = false;
  let rendering = false;
  let focusCallback: (() => void) | undefined;
  const hooks = {
    useCallback: (fn: () => void, dependencies: any[]) => hooks.useMemo(() => fn, dependencies),
    useState: (initialValue: any) => {
      const index = cursor++;
      if (!(index in states)) states[index] = typeof initialValue === 'function' ? initialValue() : initialValue;
      return [states[index], (next: any) => { const value = typeof next === 'function' ? next(states[index]) : next; if (!Object.is(value, states[index])) { states[index] = value; dirty = true; } }];
    },
    useRef: (value: any) => { const index = cursor++; return states[index] ??= { current: value }; },
    useMemo: (fn: () => any, dependencies: any[]) => {
      const index = cursor++;
      if (!states[index] || dependencies.some((value, i) => !Object.is(value, states[index].dependencies[i]))) states[index] = { value: fn(), dependencies };
      return states[index].value;
    },
    useEffect: (fn: () => void, dependencies: any[]) => {
      const index = cursor++;
      if (!states[index] || dependencies.some((value, i) => !Object.is(value, states[index][i]))) effects.push(fn);
      states[index] = dependencies;
    },
  };
  const store = {
    get activities() { return records; },
    addActivity: (draft: ActivityDraft) => {
      assert.equal(rendering, false, 'store write during render');
      if (failWrite) throw new Error('History locked');
      writes.push(draft);
      records = [{ ...draft, id: 'new', createdAt: 1, updatedAt: 2,
        metrics: sanitizeActivityMetrics(draft.activityType, draft.metrics) } as Activity];
      dirty = true;
      return 'new';
    },
    updateActivity: (id: string, patch: Partial<Activity>) => {
      assert.equal(rendering, false, 'store write during render');
      if (failWrite) throw new Error('History locked');
      writes.push(patch);
      records = records.map(record => record.id === id ? { ...record, ...patch,
        metrics: sanitizeActivityMetrics(record.activityType, patch.metrics ?? record.metrics), updatedAt: record.updatedAt + 1 } : record);
      dirty = true;
    },
  };
  const useStore = Object.assign((selector: any) => selector(store), { getState: () => store });
  const mocks: Record<string, any> = {
    react: hooks,
    'react-native': { Alert: { alert: (...args: any[]) => alerts.push(args) }, Linking: { openURL: async () => { if (options.failLink) throw new Error('Offline'); } }, StyleSheet: { create: (value: any) => value, hairlineWidth: 1 },
      Platform: { OS: 'ios' }, ...Object.fromEntries(['Image', 'KeyboardAvoidingView', 'ScrollView', 'Switch', 'Text', 'TextInput', 'TouchableOpacity', 'View'].map(name => [name, name])) },
    '@expo/ui': { Host: 'Host', RNHostView: 'RNHostView', Collapsible: 'Collapsible' },
    'expo-router': { useFocusEffect: (fn: () => void) => { focusCallback = fn; hooks.useEffect(fn, [fn]); }, useRoute: () => ({ params: options.activityId === true || initial && options.activityId !== false ? { activityId: initial?.id ?? 'recorded' } : {} }),
      useRouter: () => ({ replace: (value: any) => navigation.push(value), back: () => navigation.push('back') }) },
    '@expo/vector-icons': { Ionicons: 'Ionicons' },
    activityStore: { useActivityStore: useStore },
    profileStore: { useActiveProfile: () => activeProfile },
    settingsStore: { useSettingsStore: (selector: any) => selector({ units: options.units ?? 'metric' }) },
    recalculationStore: { useRecalculationStore: (selector: any) => selector({ status: 'idle', error: null }) },
    routeStore: { useRouteStore: (selector: any) => selector({ routes: [{ id: 'planned-route', name: 'Planned Route', points: [{ latitude: 1, longitude: 1 }] }] }) },
    gearStore: { useGearStore: (selector: any) => selector({ shoes: [], defaultShoeId: null }) },
    useColors: { useColors: () => ({}) },
    themeStore: { useThemeMode: () => 'dark' },
    useWeekPlan: { useWeekPlan: () => ({}) },
    useScheduledSessions: { useScheduledSessions: () => ({}) },
    activityCompletion: completion, manualActivityEdit: edit, automaticActivityPower: automatic, outdoorPower: power,
    profilePower, climbingWork: climbing, activityPowerPresentation: powerPresentation, powerEquivalents, dateOnly: dates, substitution, displayLabels: { displayLabel: (value: any) => value },
    prescriptionFormat: {}, recalculation: { runRecalculation: async () => {} },
  };
  const module = { exports: {} as any };
  const code = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React,
    jsxFactory: 'h', jsxFragmentFactory: 'Fragment', esModuleInterop: true,
  } }).outputText;
  runInNewContext(code, { module, exports: module.exports,
    Math: Object.assign(Object.create(Math), { random: options.random ?? Math.random }),
    require: (name: string) => mocks[name] ?? mocks[name.split('/').at(-1)!] ?? { __esModule: true, default: name.split('/').at(-1) },
    Fragment: 'Fragment', h: (type: any, props: any, ...children: any[]) => typeof type === 'function'
      ? type({ ...props, children }) : { type, props: props ?? {}, children: children.flat(Infinity) },
  });
  function render() {
    let renders = 0;
    do {
      assert.ok(++renders < 12, 'render/update loop');
      cursor = 0; dirty = false; effects = [];
      rendering = true;
      tree = module.exports.default({ activity: records[0], units: options.units ?? 'metric' });
      rendering = false;
      effects.forEach(effect => effect());
    } while (dirty);
    return tree;
  }
  function nodes(): Node[] {
    const result: Node[] = [];
    function visit(node: any) { if (node && typeof node === 'object') { result.push(node); node.children?.forEach(visit); } }
    visit(tree); return result;
  }
  return { render, nodes, alerts, navigation, writes, get record() { return records[0]!; },
    field: (label: string) => nodes().find(node => node.type === 'TextInput' && node.props.accessibilityLabel === label)!,
    save: () => { nodes().find(node => ['Save activity changes', 'Save activity'].includes(node.props.accessibilityLabel))!.props.onPress(); render(); },
    changeProfile: (next: typeof profile | undefined) => { activeProfile = next; render(); },
    changeRecord: (next: Activity) => { records = [next]; render(); },
    refocus: () => { focusCallback?.(); render(); },
    lock: () => { failWrite = true; }, unlock: () => { failWrite = false; },
  };
}

const manualPath = 'app/(tabs)/activity/manual.tsx';
const panelPath = 'src/components/activity/ActivityPowerPanel.tsx';

test('real manual form save persists optional zero/gain with correct units and never fabricates timed GPS from a planned route', () => {
  for (const units of ['metric', 'imperial'] as const) {
    for (const value of ['', '0', '1000']) {
      const ui = harness(manualPath, undefined, { units }); ui.render();
      ui.field('Elevation gain').props.onChangeText(value); ui.render();
      const route = ui.nodes().find(node => node.type === 'TouchableOpacity' && node.children.some(child => child?.children?.includes('Planned Route')))!;
      route.props.onPress(); ui.render(); ui.save();
      assert.equal(ui.record.metrics.elevationGainMeters, value === '' ? undefined : value === '0' ? 0 : units === 'metric' ? 1000 : 304.8);
      assert.equal(ui.record.metrics.routeId, 'planned-route');
      assert.equal(ui.record.metrics.routeCoordinates, undefined);
      assert.equal(ui.record.metrics.powerEstimate, undefined);
      assert.equal(ui.navigation.length, 1);
    }
  }
});

test('real manual save rejects negative elevation and stays on the form for failure and recovery', () => {
  const ui = harness(manualPath); ui.render();
  ui.field('Elevation gain').props.onChangeText('-2'); ui.render(); ui.save();
  assert.equal(ui.writes.length, 0); assert.equal(ui.navigation.length, 0);
  assert.equal(ui.alerts[0]![0], 'Check elevation gain');
  ui.field('Elevation gain').props.onChangeText('10'); ui.render(); ui.lock(); ui.save();
  assert.equal(ui.navigation.length, 0);
  ui.unlock(); ui.save(); assert.equal(ui.navigation.length, 1);
});

test('real recorded edit saves elevation alone without changing identity, time, raw samples, route or rounded totals', () => {
  const original = activity();
  const ui = harness(manualPath, original); ui.render();
  ui.field('Elevation gain').props.onChangeText('0'); ui.render(); ui.save();
  const saved = ui.record;
  for (const key of ['id', 'source', 'startTime', 'endTime', 'workoutInstanceId', 'createdAt'] as const) assert.equal(saved[key], original[key]);
  for (const key of ['durationSeconds', 'activeTimeSeconds', 'elapsedTimeSeconds', 'distanceMeters', 'routeCoordinates', 'recordingPauses', 'rawHeartRateSamples', 'cadenceSamples'] as const) assert.deepEqual(saved.metrics[key], original.metrics[key], key);
  assert.equal(saved.metrics.elevationGainMeters, 0);
  assert.equal(saved.metrics.metricSources?.elevation, 'manual_entry');
  assert.ok(saved.metrics.powerEstimate);
  assert.equal(original.metrics.elevationGainMeters, 30.123);
});

test('editing an encoded recording ID updates that exact row instead of creating another activity', () => {
  const original = { ...activity(), id: 'activity_workout_run_adhoc%3Asynthetic' };
  const ui = harness(manualPath, original); ui.render();
  assert.ok(ui.nodes().some(node => node.props.accessibilityLabel === 'Save activity changes'));
  ui.field('Elevation gain').props.onChangeText('0'); ui.render(); ui.save();
  assert.equal(ui.record.id, original.id);
  assert.equal(ui.writes.length, 1);
  assert.equal(ui.navigation.at(-1).params.activityId, original.id);
});

test('delayed activity hydration establishes the baseline before the first actual elevation edit', () => {
  const ui = harness(manualPath, undefined, { activityId: true }); ui.render();
  ui.changeRecord(activity());
  assert.equal(ui.field('Elevation gain').props.value, '30.12');
  ui.field('Elevation gain').props.onChangeText('111'); ui.render(); ui.save();
  assert.equal(ui.record.metrics.elevationGainMeters, 111);
  assert.equal(ui.record.metrics.distanceMeters, 299.123);
});

test('notes-only saves and delayed enrichment preserve every unedited metric and the latest raw route', () => {
  const original = activity();
  const ui = harness(manualPath, original); ui.render();
  const newer = { ...original, metrics: { ...original.metrics, distanceMeters: 456.789,
    routeCoordinates: [...original.metrics.routeCoordinates!, { latitude: 0.003, longitude: 0, timestamp: startTime + 100000 }] } };
  ui.changeRecord(newer);
  const notes = ui.nodes().find(node => node.type === 'TextInput' && node.props.multiline)!;
  notes.props.onChangeText('new note'); ui.render(); ui.save();
  assert.equal(ui.record.notes, 'new note');
  assert.equal(ui.record.metrics.distanceMeters, 456.789);
  assert.equal(ui.record.metrics.elevationGainMeters, 30.123);
  assert.deepEqual(ui.record.metrics.routeCoordinates, newer.metrics.routeCoordinates);
});

test('real normal and recorded edits preserve elapsed seconds even when active duration is corrected', () => {
  for (const recorded of [false, true]) {
    const original = activity();
    if (!recorded) { original.source = 'manual'; delete original.workoutInstanceId; delete original.metrics.routeCoordinates; delete original.metrics.rawHeartRateSamples; delete original.metrics.cadenceSamples; }
    const ui = harness(manualPath, original); ui.render();
    ui.field('Duration').props.onChangeText('5'); ui.render(); ui.save();
    assert.equal(ui.record.metrics.durationSeconds, 300);
    assert.equal(ui.record.metrics.activeTimeSeconds, 300);
    assert.equal(ui.record.metrics.elapsedTimeSeconds, 100);
    assert.equal(ui.record.startTime, original.startTime);
    assert.equal(ui.record.endTime, original.endTime);
    assert.equal(ui.record.source, original.source);
  }
});

test('real recorded edit leaves measured power and raw samples intact and accepts a manual power correction without a model overwrite', () => {
  const original = activity();
  original.metrics.cyclingPowerWatts = 180; original.metrics.metricSources!.power = 'cycling_power_meter';
  original.metrics.powerSamples = [{ timestamp: startTime, watts: 180, kind: 'measured', sport: 'cycling', source: 'cycling_power_meter' }];
  const ui = harness(manualPath, original); ui.render(); ui.save();
  assert.equal(ui.record.metrics.cyclingPowerWatts, 180);
  assert.deepEqual(ui.record.metrics.powerSamples, original.metrics.powerSamples);
  ui.field('Average power').props.onChangeText('210'); ui.render(); ui.save();
  assert.equal(ui.record.metrics.cyclingPowerWatts, 210);
  assert.equal(ui.record.metrics.metricSources?.power, 'manual_entry');
  assert.equal(ui.record.metrics.powerEstimate, undefined);
  ui.field('Average power').props.onChangeText('0'); ui.render(); ui.save();
  assert.equal(ui.record.metrics.cyclingPowerWatts, 0);
});

test('touring choices are available through the real form without receiving cycling/running estimates', () => {
  for (const [label, type] of [['Ski Touring', 'ski_touring'], ['Snowboard Touring', 'snowboard_touring']]) {
    const ui = harness(manualPath); ui.render();
    const button = ui.nodes().find(node => node.type === 'TouchableOpacity' && node.children.some(child => child?.children?.includes(label)))!;
    button.props.onPress(); ui.render(); ui.field('Elevation gain').props.onChangeText('100'); ui.render(); ui.save();
    assert.equal(ui.record.activityType, type); assert.equal(ui.record.metrics.elevationGainMeters, 100);
    assert.equal(ui.record.metrics.powerEstimate, undefined);
  }
});

test('real power panel automatically persists once, retains historical mass through profile changes, and never writes during render or loops', () => {
  const ui = harness(panelPath, activity()); ui.render();
  assert.equal(ui.writes.length, 1);
  assert.equal(ui.record.metrics.powerEstimate?.inputs[0]!.value, 82);
  ui.render(); assert.equal(ui.writes.length, 1);
  ui.changeRecord({ ...ui.record, notes: 'unrelated edit' }); assert.equal(ui.writes.length, 1);
  const previous = ui.record.metrics.powerEstimate;
  ui.changeProfile(changedProfile(90)); assert.equal(ui.writes.length, 1);
  assert.equal(ui.record.metrics.powerEstimate, previous);
  assert.equal(ui.record.metrics.powerEstimate?.inputs[0]!.value, 82);
  assert.equal(ui.nodes().some(node => node.type === 'TextInput'), false);
});

test('real power panel has no default mass; hikes show one primary unit and keep component watts in details', () => {
  const missing = harness(panelPath, activity(), { profile: null }); missing.render();
  assert.equal(missing.writes.length, 0);
  const hike = activity('hiking'); hike.source = 'manual'; delete hike.workoutInstanceId; delete hike.metrics.routeCoordinates;
  const ui = harness(panelPath, hike); ui.render();
  assert.equal(ui.writes.length, 1);
  assert.ok(ui.nodes().some(node => node.children.includes(' kJ')));
  assert.ok(!ui.nodes().some(node => node.children.includes(' W')));
  assert.ok(!ui.nodes().some(node => node.children.some(child => typeof child === 'string' && child.includes('Average climbing-component power'))));
  ui.nodes().find(node => node.type === 'Collapsible' && node.props.label === 'Calculation details')!.props.onOpenChange(true); ui.render();
  assert.ok(ui.nodes().some(node => node.children.some(child => typeof child === 'string' && child.includes('Average climbing-component power'))));
  assert.equal(ui.record.metrics.powerEstimate, undefined);
  const saved = climbing.storedClimbingWork(ui.record)!;
  assert.ok(saved.averageClimbingWatts! > 0);
  ui.changeProfile(changedProfile(90));
  assert.equal(ui.writes.length, 1);
  assert.equal(climbing.storedClimbingWork(ui.record), saved);
});

test('real info icon explains meaning and value; dropdowns start collapsed and do not write on interaction', () => {
  const ui = harness(panelPath, activity()); ui.render();
  const before = ui.writes.length;
  assert.ok(ui.nodes().filter(node => node.type === 'Collapsible').every(node => node.props.isOpen === false));
  assert.ok(!ui.nodes().some(node => node.children.includes('Why care?')));
  const info = ui.nodes().find(node => node.props.accessibilityLabel === 'About cycling work')!;
  info.props.onPress(); ui.render();
  assert.ok(ui.nodes().some(node => node.children.includes('Why care?')));
  assert.equal(ui.nodes().find(node => node.props.accessibilityLabel === 'About cycling work')!.props.accessibilityState.expanded, true);
  ui.nodes().find(node => node.type === 'Collapsible' && node.props.label === 'Everyday equivalent')!.props.onOpenChange(true); ui.render();
  assert.ok(ui.nodes().some(node => node.children.some(child => typeof child === 'string' && child.includes('Power comparison only, not electrical output.'))));
  assert.ok(!ui.nodes().some(node => node.props.accessibilityRole === 'link'), 'references stay in calculation details');
  assert.equal(ui.writes.length, before);
});

test('comparison is stable through toggles and units; refocusing and a different activity choose a fresh reference', () => {
  const hike = activity('hiking'); hike.source = 'manual'; delete hike.workoutInstanceId;
  let sample = 0;
  const options = { units: 'metric' as 'metric' | 'imperial', random: () => (sample++ * 0.19) % 1 };
  const ui = harness(panelPath, hike, options); ui.render();
  const open = () => { ui.nodes().find(node => node.type === 'Collapsible' && node.props.label === 'Everyday equivalent')!.props.onOpenChange(true); ui.render(); };
  const text = () => ui.nodes().flatMap(node => node.children).find(child => typeof child === 'string' && child.includes('Energy equivalent of running'));
  open(); const first = text(); assert.ok(first);
  ui.nodes().find(node => node.props.accessibilityLabel === 'About hiking work')!.props.onPress(); ui.render();
  options.units = 'imperial'; ui.render();
  assert.equal(text(), first);
  assert.equal(sample, 2, 'only mount and first focus choose randomness');
  ui.refocus(); assert.ok(ui.nodes().filter(node => node.type === 'Collapsible').every(node => !node.props.isOpen));
  open(); assert.notEqual(text(), first);
  const previous = text();
  ui.changeRecord({ ...ui.record, id: 'another-hike' });
  assert.ok(ui.nodes().filter(node => node.type === 'Collapsible').every(node => !node.props.isOpen));
  open(); assert.notEqual(text(), previous);
});

test('unavailable result and valid zero never gain a made-up comparison or secondary energy', () => {
  const run = activity('running'); run.source = 'manual'; delete run.workoutInstanceId;
  const missing = harness(panelPath, run); missing.render();
  assert.ok(missing.nodes().some(node => node.children.includes('Power estimate unavailable')));
  assert.ok(!missing.nodes().some(node => node.type === 'Collapsible' && node.props.label === 'Everyday equivalent'));
  const zero = activity('indoor_cycling'); zero.metrics.cyclingPowerWatts = 0; zero.metrics.metricSources!.power = 'manual_entry';
  const ui = harness(panelPath, zero); ui.render();
  assert.ok(ui.nodes().some(node => node.children.includes('0') && node.children.includes(' W')));
  assert.ok(!ui.nodes().some(node => node.type === 'Collapsible' && node.props.label === 'Everyday equivalent'));
});

test('failed source links show a retryable error without changing saved activity data', async () => {
  const options = { failLink: true };
  const ui = harness(panelPath, activity(), options); ui.render();
  const before = ui.writes.length;
  ui.nodes().find(node => node.type === 'Collapsible' && node.props.label === 'Calculation details')!.props.onOpenChange(true); ui.render();
  const link = () => ui.nodes().find(node => node.props.accessibilityRole === 'link')!;
  link().props.onPress(); await Promise.resolve(); await Promise.resolve(); ui.render();
  assert.ok(ui.nodes().some(node => node.props.accessibilityRole === 'alert'));
  options.failLink = false; link().props.onPress(); await Promise.resolve(); ui.render();
  assert.ok(!ui.nodes().some(node => node.props.accessibilityRole === 'alert'));
  assert.equal(ui.writes.length, before);
});

test('settings units control new, prefilled and delayed-hydration distance and the saved meters', () => {
  for (const units of ['metric', 'imperial'] as const) {
    const expected = units === 'metric' ? '1.61' : '1.00';
    const original = activity('running'); original.metrics.distanceMeters = 1609.344;
    for (const delayed of [false, true]) {
      const ui = harness(manualPath, delayed ? undefined : original, { units, activityId: true }); ui.render();
      if (delayed) ui.changeRecord(original);
      assert.equal(ui.field('Distance').props.value, expected);
      ui.save(); assert.equal(ui.record.metrics.distanceMeters, 1609.344);
    }
    const ui = harness(manualPath, undefined, { units }); ui.render();
    ui.field('Distance').props.onChangeText('2'); ui.render(); ui.save();
    assert.equal(ui.record.metrics.distanceMeters, units === 'metric' ? 2000 : 3218.688);
  }
});

test('every manual activity choice retains optional elevation through the actual save handler and store filter', () => {
  const choices = ['Running', 'Treadmill', 'Run/Walk', 'Walking', 'Strength Training', 'Outdoor Cycling', 'Indoor Cycling', 'Swimming', 'Hiking',
    'Downhill Skiing', 'Cross-Country Skiing', 'Snowboarding', 'Ski Touring', 'Snowboard Touring', 'Mobility', 'Elliptical', 'Rowing', 'Stair Climbing', 'HIIT', 'HIIT / Mixed Conditioning', 'Active Recovery', 'Other'];
  for (const label of choices) {
    const ui = harness(manualPath); ui.render();
    ui.nodes().find(node => node.type === 'TouchableOpacity' && node.children.some(child => child?.children?.includes(label)))!.props.onPress();
    ui.render(); ui.field('Elevation gain').props.onChangeText('125.5'); ui.render(); ui.save();
    assert.equal(ui.record.metrics.elevationGainMeters, 125.5, label);
    assert.equal(ui.record.metrics.metricSources?.elevation, 'manual_entry', label);
    ui.field('Elevation gain').props.onChangeText('0'); ui.render(); ui.save();
    assert.equal(ui.record.metrics.elevationGainMeters, 0, label);
    ui.field('Elevation gain').props.onChangeText(''); ui.render(); ui.save();
    assert.equal(ui.record.metrics.elevationGainMeters, undefined, label);
  }
});

test('manual hike save persists mgh/time with active seconds and no fabricated GPS or total-power model', () => {
  const ui = harness(manualPath); ui.render();
  ui.nodes().find(node => node.type === 'TouchableOpacity' && node.children.some(child => child?.children?.includes('Hiking')))!.props.onPress(); ui.render();
  ui.field('Elevation gain').props.onChangeText('100'); ui.field('Duration').props.onChangeText('10'); ui.render(); ui.save();
  const saved = climbing.storedClimbingWork(ui.record)!;
  assert.ok(Math.abs(saved.kilojoules - 82 * 9.80665 * 100 / 1000) < 1e-9);
  assert.ok(Math.abs(saved.averageClimbingWatts! - 82 * 9.80665 * 100 / 600) < 1e-9);
  assert.equal(saved.timeBasis, 'active'); assert.equal(saved.seconds, 600);
  assert.equal(saved.weightProvenance.source, 'user_entered');
  assert.equal(ui.record.metrics.routeCoordinates, undefined);
  assert.equal(ui.record.metrics.powerEstimate, undefined);
  assert.match(saved.note, /not total human power/);
});

test('climbing time fallback is explicit and historical mass survives gain corrections and profile changes', () => {
  const hike = activity('hiking');
  const metrics = climbing.withAutomaticClimbingWork(hike, profile, 1000);
  const saved = { ...hike, metrics };
  assert.equal(climbing.withAutomaticClimbingWork(saved, changedProfile(90), 2000), metrics);
  const corrected = { ...saved, metrics: { ...metrics, elevationGainMeters: 100 } };
  const next = climbing.withAutomaticClimbingWork(corrected, changedProfile(90), 3000).climbingWorkEstimate!;
  assert.equal(next.bodyMassKg, 82); assert.equal(next.computedAt, 3000);
  delete hike.metrics.activeTimeSeconds;
  assert.equal(power.estimateClimbingWork(hike, 82)?.timeBasis, 'duration');
  delete hike.metrics.durationSeconds;
  assert.equal(power.estimateClimbingWork(hike, 82)?.timeBasis, 'elapsed');
  hike.metrics.elapsedTimeSeconds = 0;
  assert.equal(power.estimateClimbingWork(hike, 82)?.averageClimbingWatts, undefined);
  assert.ok(power.estimateClimbingWork(hike, 82)!.kilojoules > 0);
  hike.metrics.activeTimeSeconds = NaN; hike.metrics.elapsedTimeSeconds = 100;
  assert.equal(power.estimateClimbingWork(hike, 82)?.averageClimbingWatts, undefined);
  for (const gain of [undefined, 0, -1, NaN]) {
    hike.metrics.elevationGainMeters = gain;
    assert.equal(power.estimateClimbingWork(hike, 82), null);
  }
  hike.metrics.elevationGainMeters = 1e308;
  assert.equal(power.estimateClimbingWork(hike, 82), null);
  hike.metrics.elevationGainMeters = 100;
  for (const elevation of ['prescribed_estimate', 'unavailable'] as const) {
    hike.metrics.metricSources = { elevation };
    assert.equal(power.estimateClimbingWork(hike, 82), null);
  }
});

test('editing swim laps and mixed rounds preserves unrelated session detail', () => {
  const swim = activity('swimming');
  swim.metrics.swimming = { environment: 'open_water', distanceUnit: 'm', laps: 2, strokeType: 'freestyle', paceSecondsPer100: 100 };
  const draft = completion.buildManualActivityDraft(null, { activityType: 'swimming' });
  draft.metrics.swimming = { environment: 'pool', distanceUnit: 'yd', laps: 4 };
  const saved = edit.mergeManualActivityEdit(swim, draft, new Set(['laps']));
  assert.deepEqual(saved.metrics.swimming, { ...swim.metrics.swimming, laps: 4 });
  const mixed = activity('mixed_modal'); mixed.metrics.mixedModal = { rounds: 2, workIntervals: 4, strengthComponent: 'carry' };
  draft.metrics.mixedModal = { rounds: 3 };
  assert.deepEqual(edit.mergeManualActivityEdit(mixed, draft, new Set(['rounds'])).metrics.mixedModal, { rounds: 3, workIntervals: 4, strengthComponent: 'carry' });
});
