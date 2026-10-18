import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createContext, runInContext, runInNewContext } from 'node:vm';
import ts from 'typescript';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import * as calibration from '../../src/utils/calibrationEngine';
import * as weights from '../../src/utils/profilePower';
import { withAutomaticActivityPower } from '../../src/utils/automaticActivityPower';
import type { AthleteProfile } from '../../src/types/athlete';

const explicit = (weightKg: number) => weights.userEnteredWeightPatch(weightKg, 12345)!;
function profile(weightKg = 70, athleteId = 'athlete_default'): AthleteProfile {
  return { ...calibration.createDefaultProfile({ athleteId, name: 'Athlete', vo2Estimate: 40 }), weightKg };
}

async function stores(options: { profileWeight?: number; onboardingWeight?: number; delay?: 'profile' | 'onboarding'; otherActive?: boolean; persisted?: Map<string, string> } = {}) {
  const raw = new Map<string, string>(options.persisted);
  if (!raw.has('profile-store')) raw.set('profile-store', JSON.stringify({ version: 0, state: { profiles: {
    athlete_default: profile(options.profileWeight ?? 70), ...(options.otherActive ? { other: profile(95, 'other') } : {}),
  }, activeAthleteId: options.otherActive ? 'other' : 'athlete_default' } }));
  if (!raw.has('onboarding-store')) raw.set('onboarding-store', JSON.stringify({ version: 0, state: { onboardingComplete: true, currentStep: 11, data: { weightKg: options.onboardingWeight ?? 70 } } }));
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const storage = createJSONStorage(() => ({
    getItem: async (name: string) => { if (name === `${options.delay}-store`) await gate; return raw.get(name) ?? null; },
    setItem: (name: string, value: string) => { raw.set(name, value); },
    removeItem: (name: string) => { raw.delete(name); },
  }));
  function load(path: string, additional: Record<string, any> = {}) {
    const module = { exports: {} as any };
    const mocks: Record<string, any> = { zustand: { create }, 'zustand/middleware': { persist },
      './persistStorage': { createAppJSONStorage: () => storage }, '../utils/calibrationEngine': calibration,
      '../utils/profilePower': weights, ...additional };
    runInNewContext(ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
      { module, exports: module.exports, require: (name: string) => { assert.ok(mocks[name], `unmocked store import ${name}`); return mocks[name]; } });
    return module.exports;
  }
  const profiles = load('src/store/profileStore.ts').useProfileStore;
  const onboarding = load('src/store/onboardingStore.ts', { './profileStore': { useProfileStore: profiles } }).useOnboardingStore;
  async function ready(store: any) {
    if (!store.persist.hasHydrated()) await new Promise<void>(resolve => { const unsubscribe = store.persist.onFinishHydration(() => { unsubscribe(); resolve(); }); });
  }
  if (options.delay === 'profile') await ready(onboarding);
  if (options.delay === 'onboarding') await ready(profiles);
  release(); await Promise.all([ready(profiles), ready(onboarding)]);
  return { profiles, onboarding, raw };
}

test('legacy hydration migrates prior non-default input and persists provenance in either hydration order', async () => {
  for (const delay of ['profile', 'onboarding'] as const) {
    const { profiles, onboarding, raw } = await stores({ profileWeight: 82, onboardingWeight: 88, delay });
    const saved = profiles.getState().getActiveProfile();
    assert.equal(saved.weightKg, 88, delay);
    assert.equal(saved.weightProvenance.source, 'legacy_nondefault');
    assert.equal(saved.weightProvenance.savedAt, undefined, 'migration must not fabricate an entry date');
    assert.equal(weights.profilePowerMass(saved)?.bodyMassKg, 88);
    assert.equal(onboarding.getState().data.weightProvenance.source, 'legacy_nondefault');
    assert.equal(JSON.parse(raw.get('profile-store')!).state.profiles.athlete_default.weightProvenance.source, 'legacy_nondefault');
    await profiles.persist.rehydrate(); await onboarding.persist.rehydrate();
    assert.equal(profiles.getState().getActiveProfile().weightKg, 88);
  }
});

test('legacy default 70/75 values remain unknown, stay stored, and never become entered by a migration or unrelated update', async () => {
  for (const weightKg of [70, 75]) {
    const { profiles, onboarding } = await stores({ profileWeight: weightKg, onboardingWeight: weightKg });
    assert.equal(weights.profilePowerMass(profiles.getState().getActiveProfile()), null);
    assert.equal(onboarding.getState().data.weightKg, weightKg);
    assert.equal(onboarding.getState().data.weightProvenance, null);
    profiles.getState().updateActive({ name: 'New name' });
    onboarding.getState().updateData({ age: 40 });
    await profiles.persist.rehydrate(); await onboarding.persist.rehydrate();
    assert.equal(weights.profilePowerMass(profiles.getState().getActiveProfile()), null);
  }
});

test('legacy global onboarding weight updates the original default athlete and never the selected second athlete', async () => {
  const { profiles } = await stores({ onboardingWeight: 88, otherActive: true, delay: 'profile' });
  assert.equal(profiles.getState().profiles.athlete_default.weightKg, 88);
  assert.equal(profiles.getState().activeAthleteId, 'other');
  assert.equal(profiles.getState().getActiveProfile().weightKg, 95);
});

test('saving a secondary athlete never changes global/default weight across fresh relaunches in either hydration order', async () => {
  for (const delay of ['profile', 'onboarding'] as const) {
    const saved = await stores({ profileWeight: 82, onboardingWeight: 82, otherActive: true, delay });
    const original = JSON.stringify(saved.profiles.getState().profiles.athlete_default);
    const globalWeight = JSON.stringify({ weightKg: saved.onboarding.getState().data.weightKg,
      weightProvenance: saved.onboarding.getState().data.weightProvenance });
    assert.equal(saved.onboarding.getState().setUserWeight(100), true);
    assert.equal(saved.profiles.getState().profiles.other.weightKg, 100);
    assert.equal(JSON.stringify(saved.profiles.getState().profiles.athlete_default), original);
    assert.equal(JSON.stringify({ weightKg: saved.onboarding.getState().data.weightKg,
      weightProvenance: saved.onboarding.getState().data.weightProvenance }), globalWeight);
    const restarted = await stores({ persisted: saved.raw, delay });
    assert.equal(restarted.profiles.getState().activeAthleteId, 'other');
    assert.equal(restarted.profiles.getState().profiles.other.weightKg, 100);
    assert.equal(restarted.profiles.getState().profiles.other.weightProvenance.source, 'user_entered');
    assert.equal(JSON.stringify(restarted.profiles.getState().profiles.athlete_default), original, delay);
    assert.equal(restarted.onboarding.getState().data.weightKg, 82);
    restarted.profiles.getState().setActiveAthlete('athlete_default');
    restarted.onboarding.getState().setUserWeight(85);
    assert.equal(restarted.onboarding.getState().data.weightKg, 85);
    assert.equal(restarted.profiles.getState().profiles.athlete_default.weightKg, 85);
    assert.equal(restarted.profiles.getState().profiles.other.weightKg, 100);
  }
});

test('generic onboarding patches cannot overwrite global weight while a secondary athlete is selected', async () => {
  const { profiles, onboarding } = await stores({ profileWeight: 82, onboardingWeight: 82, otherActive: true });
  const before = JSON.stringify(onboarding.getState().data.weightProvenance);
  onboarding.getState().updateData({ ...explicit(100), age: 40 });
  assert.equal(onboarding.getState().data.age, 40);
  assert.equal(onboarding.getState().data.weightKg, 82);
  assert.equal(JSON.stringify(onboarding.getState().data.weightProvenance), before);
  assert.equal(profiles.getState().profiles.athlete_default.weightKg, 82);
  assert.equal(profiles.getState().profiles.other.weightKg, 95);
  profiles.getState().setActiveAthlete('missing');
  assert.equal(onboarding.getState().setUserWeight(100), false);
  assert.equal(onboarding.getState().data.weightKg, 82);
});

test('conflicting ambiguous legacy values invalidate inferred mass without replacing the stored number', async () => {
  const { profiles } = await stores({ profileWeight: 82, onboardingWeight: 70 });
  const saved = profiles.getState().getActiveProfile();
  assert.equal(saved.weightKg, 82);
  assert.equal(saved.weightProvenance, null);
  assert.equal(weights.profilePowerMass(saved), null);
  assert.equal(weights.matchingWeightProvenance(70, { source: 'legacy_nondefault', weightKg: 70, migratedAt: 1234 }), null);
});

test('explicit saved weight round-trips in both stores, including values numerically equal to defaults', async () => {
  const { profiles, onboarding, raw } = await stores();
  for (const weightKg of [70, 75, 82]) {
    assert.equal(onboarding.getState().setUserWeight(weightKg), true);
    const saved = profiles.getState().getActiveProfile();
    assert.equal(saved.weightProvenance.source, 'user_entered');
    assert.equal(saved.weightProvenance.weightKg, weightKg);
    assert.equal(weights.profilePowerMass(saved)?.bodyMassKg, weightKg);
    assert.equal(JSON.parse(raw.get('onboarding-store')!).state.data.weightProvenance.source, 'user_entered');
    await profiles.persist.rehydrate(); await onboarding.persist.rehydrate();
    assert.equal(profiles.getState().getActiveProfile().weightKg, weightKg);
    assert.equal(weights.profilePowerMass(profiles.getState().getActiveProfile())?.bodyMassKg, weightKg);
  }
  const previous = profiles.getState().getActiveProfile();
  for (const weightKg of [NaN, Infinity, 0, 19, 301]) assert.equal(onboarding.getState().setUserWeight(weightKg), false);
  assert.equal(profiles.getState().getActiveProfile(), previous);
});

test('generic profile/onboarding patches cannot attach stale evidence to a changed mass', async () => {
  const { profiles, onboarding } = await stores();
  onboarding.getState().setUserWeight(82);
  profiles.getState().updateActive({ weightKg: 90 });
  assert.equal(weights.profilePowerMass(profiles.getState().getActiveProfile()), null);
  onboarding.getState().updateData({ weightKg: 90 });
  assert.equal(onboarding.getState().data.weightProvenance, null);
  await profiles.persist.rehydrate(); await onboarding.persist.rehydrate();
  assert.equal(weights.profilePowerMass(profiles.getState().getActiveProfile()), null);
  profiles.getState().updateProfile('athlete_default', explicit(75));
  assert.equal(weights.profilePowerMass(profiles.getState().getActiveProfile())?.bodyMassKg, 75);
});

test('onboarding readback upgrades same-value legacy evidence and recovers newer explicit provenance', async () => {
  const { profiles, onboarding } = await stores({ profileWeight: 82, onboardingWeight: 82 });
  assert.equal(profiles.getState().getActiveProfile().weightProvenance.source, 'legacy_nondefault');
  onboarding.setState({ data: { ...onboarding.getState().data, ...explicit(82) } });
  await onboarding.persist.rehydrate();
  assert.equal(profiles.getState().getActiveProfile().weightProvenance.source, 'user_entered');
  assert.equal(profiles.getState().getActiveProfile().weightProvenance.savedAt, 12345);
  onboarding.setState({ data: { ...onboarding.getState().data, ...weights.userEnteredWeightPatch(82, 23456) } });
  await onboarding.persist.rehydrate();
  assert.equal(profiles.getState().getActiveProfile().weightProvenance.savedAt, 23456);
});

function sourceAst(path: string) {
  return ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}
function find<T extends ts.Node>(root: ts.Node, predicate: (node: ts.Node) => node is T): T {
  let result: T | undefined;
  function visit(node: ts.Node) { if (!result && predicate(node)) result = node; ts.forEachChild(node, visit); }
  visit(root); assert.ok(result); return result;
}
function execute(text: string, context: any): any {
  return runInContext(ts.transpileModule(text, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);
}

test('actual Profile and Settings weight-change/blur handlers save to the active profile without promoting untouched defaults', async () => {
  for (const path of ['app/(tabs)/profile/index.tsx', 'app/(tabs)/settings/index.tsx']) {
    for (const imp of [false, true]) {
      const { profiles, onboarding } = await stores();
      const ast = sourceAst(path);
      const context = createContext({ imp, savedWeightKg: undefined, weightInput: '', weightEditedRef: { current: false },
        setUserWeight: onboarding.getState().setUserWeight,
        setWeightInput: (text: string) => { context.weightInput = text; } });
      for (const name of ['formatWeight', 'commitWeight']) execute(find(ast, (node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node) && node.name?.text === name).getText(ast), context);
      execute('commitWeight()', context);
      assert.equal(weights.profilePowerMass(profiles.getState().getActiveProfile()), null, path);
      const field = find(ast, (node): node is ts.ObjectLiteralExpression => ts.isObjectLiteralExpression(node)
        && node.properties.some(prop => ts.isPropertyAssignment(prop) && prop.name.getText(ast) === 'label' && prop.initializer.getText(ast) === "'Weight'"));
      const change = field.properties.find((node): node is ts.PropertyAssignment => ts.isPropertyAssignment(node) && node.name.getText(ast) === 'onChangeText')!;
      const blur = field.properties.find((node): node is ts.PropertyAssignment => ts.isPropertyAssignment(node) && node.name.getText(ast) === 'onBlur')!;
      execute(`(${change.initializer.getText(ast)})('${imp ? 180 : 82}')`, context);
      execute(`${blur.initializer.getText(ast)}()`, context);
      const saved = profiles.getState().getActiveProfile();
      assert.equal(saved.weightKg, 82, path);
      assert.equal(saved.weightProvenance.source, 'user_entered', path);
      assert.equal(onboarding.getState().data.weightKg, 82);
      await profiles.persist.rehydrate();
      assert.equal(weights.profilePowerMass(profiles.getState().getActiveProfile())?.bodyMassKg, 82);
    }
  }
});

test('Profile and Settings display/edit secondary profile weight and unrelated fields never replace it with global onboarding weight', async () => {
  for (const path of ['app/(tabs)/profile/index.tsx', 'app/(tabs)/settings/index.tsx']) {
    for (const delay of ['profile', 'onboarding'] as const) {
      const { profiles, onboarding, raw } = await stores({ profileWeight: 82, onboardingWeight: 82, otherActive: true, delay });
      onboarding.getState().setUserWeight(100);
      const ast = sourceAst(path);
      const context = createContext({ imp: false, profile: profiles.getState().getActiveProfile(), profilePowerMass: weights.profilePowerMass,
        savedWeightKg: 100, weightInput: '', weightEditedRef: { current: false },
        setUserWeight: onboarding.getState().setUserWeight, useEffect: (fn: () => void) => fn(),
        setWeightInput: (value: string) => { context.weightInput = value; } });
      for (const name of ['formatWeight', 'commitWeight']) execute(find(ast, (node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node) && node.name?.text === name).getText(ast), context);
      const displayed = find(ast, (node): node is ts.VariableDeclaration => ts.isVariableDeclaration(node) && node.name.getText(ast) === 'savedWeightKg');
      const effect = find(ast, (node): node is ts.CallExpression => ts.isCallExpression(node) && node.expression.getText(ast) === 'useEffect'
        && node.arguments[0]!.getText(ast).includes('setWeightInput'));
      execute(`(() => { const ${displayed.getText(ast)}; ${effect.getText(ast)}; })()`, context);
      assert.equal(context.weightInput, '100', path);
      const field = find(ast, (node): node is ts.ObjectLiteralExpression => ts.isObjectLiteralExpression(node)
        && node.properties.some(prop => ts.isPropertyAssignment(prop) && prop.name.getText(ast) === 'label' && prop.initializer.getText(ast) === "'Weight'"));
      const change = field.properties.find((node): node is ts.PropertyAssignment => ts.isPropertyAssignment(node) && node.name.getText(ast) === 'onChangeText')!;
      execute(`(${change.initializer.getText(ast)})('101'); commitWeight()`, context);
      assert.equal(profiles.getState().profiles.other.weightKg, 101);
      onboarding.getState().updateData({ age: 40, profilePhotoUri: 'local-photo' });
      assert.equal(onboarding.getState().data.weightKg, 82);
      assert.equal(profiles.getState().profiles.other.weightKg, 101);
      const restarted = await stores({ persisted: raw, delay });
      context.profile = restarted.profiles.getState().getActiveProfile();
      execute(`(() => { const ${displayed.getText(ast)}; ${effect.getText(ast)}; })()`, context);
      assert.equal(context.weightInput, '101', `${path}/${delay}`);
      assert.equal(restarted.profiles.getState().profiles.athlete_default.weightKg, 82);
      assert.equal(restarted.profiles.getState().profiles.other.weightProvenance.source, 'user_entered');
    }
  }
});

test('actual onboarding physiology controls record explicit edits only and completion carries that provenance into the profile', async () => {
  for (const touched of [false, true]) {
    const { profiles, onboarding } = await stores();
    onboarding.getState().resetOnboarding();
    const ast = sourceAst('app/onboarding/physiology.tsx');
    const context = createContext({ age: 30, sex: 'prefer_not_to_say', heightCm: 175, weightKg: 70,
      weightEdited: false, hasResting: false, hrResting: 55, router: { push: () => {} },
      updateData: onboarding.getState().updateData, setUserWeight: onboarding.getState().setUserWeight,
      setWeightEdited: (value: boolean) => { context.weightEdited = value; },
      setWeightKg: (fn: (value: number) => number) => { context.weightKg = fn(context.weightKg); } });
    const row = find(ast, (node): node is ts.JsxSelfClosingElement => ts.isJsxSelfClosingElement(node) && node.tagName.getText(ast) === 'Row'
      && node.attributes.properties.some(attr => ts.isJsxAttribute(attr) && attr.name.getText(ast) === 'label' && attr.initializer?.getText(ast) === '"Weight"'));
    if (touched) {
      const inc = row.attributes.properties.find((attr): attr is ts.JsxAttribute => ts.isJsxAttribute(attr) && attr.name.getText(ast) === 'onInc')!;
      assert.ok(inc.initializer && ts.isJsxExpression(inc.initializer));
      execute(`(${inc.initializer.expression!.getText(ast)})()`, context);
    }
    execute(find(ast, (node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node) && node.name?.text === 'handleNext').getText(ast), context);
    execute('handleNext()', context);
    const data = onboarding.getState().data;
    assert.equal(data.weightProvenance?.source, touched ? 'user_entered' : undefined);
    const completeAst = sourceAst('app/onboarding/complete.tsx');
    const update = find(completeAst, (node): node is ts.CallExpression => ts.isCallExpression(node) && node.expression.getText(completeAst) === 'updateActive');
    const completeContext = createContext({ data, displayName: 'Athlete', hrMaxEst: 190, vdotFinal: 40, updateActive: profiles.getState().updateActive });
    execute(update.getText(completeAst), completeContext);
    assert.equal(weights.profilePowerMass(profiles.getState().getActiveProfile())?.bodyMassKg, touched ? 70.5 : undefined);
  }
});

test('migrated legacy mass supports eligible estimates with explicit inference/date-unknown provenance', async () => {
  const { profiles } = await stores({ profileWeight: 82, onboardingWeight: 82 });
  const active = profiles.getState().getActiveProfile();
  const startTime = 1760000000000;
  const activity = { activityType: 'cycling', subtype: 'outdoor', source: 'tracked', indoor: false, startTime, endTime: startTime + 100000,
    metrics: { activeTimeSeconds: 100, durationSeconds: 100,
      routeCoordinates: Array.from({ length: 101 }, (_, index) => ({ latitude: index * 3 / 111195, longitude: 0, altitudeMeters: 100, timestamp: startTime + index * 1000 })) } } as any;
  const estimate = withAutomaticActivityPower(activity, active).powerEstimate!;
  assert.ok(estimate);
  assert.match(estimate.assumptions.join(' '), /legacy non-default entry; original entry date is unknown/);
});
