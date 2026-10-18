import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createContext, runInContext, type Context } from 'node:vm';
import ts from 'typescript';
import { OUTDOOR_SPORTS, type OutdoorSport } from '../../src/utils/outdoorSports';
import { profilePowerMass } from '../../src/utils/profilePower';

const source = readFileSync('app/(tabs)/activity/start.tsx', 'utf8');
const ast = ts.createSourceFile('start.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const sessionAst = ts.createSourceFile('ActiveOutdoorSession.tsx', readFileSync('src/components/activity/ActiveOutdoorSession.tsx', 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

function findNode<T extends ts.Node>(predicate: (node: ts.Node) => node is T, root: ts.Node = ast): T {
  let found: T | undefined;
  function visit(node: ts.Node) {
    if (!found && predicate(node)) found = node;
    ts.forEachChild(node, visit);
  }
  visit(root);
  assert.ok(found);
  return found;
}

function functionText(name: string): string {
  return findNode((node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node) && node.name?.text === name).getText(ast);
}

function declaration(name: string): string {
  return `const ${findNode((node): node is ts.VariableDeclaration => ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === name).getText(ast)};`;
}

function evaluate(code: string, context: Context): any {
  return runInContext(ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);
}

function launchContext(selectedType: OutdoorSport, runWalk: boolean): Context {
  const context = createContext({ selectedType, runWalk, OUTDOOR_SPORTS,
    useMemo: (calculate: () => unknown) => calculate(),
    attached: null, mode: 'off', params: {}, units: 'metric', started: { workoutInstanceId: 'instance' },
  });
  evaluate([functionText('supportsRunWalk'), ...['TYPES', 'compatibleRunWalk', 'launchName', 'intervals'].map(declaration)].join('\n'), context);
  return context;
}

function callArgument(callee: string, context: Context, functionName = 'beginActivity'): any {
  const launch = findNode((node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node) && node.name?.text === functionName);
  const call = findNode((node): node is ts.CallExpression => ts.isCallExpression(node) && node.expression.getText(ast) === callee, launch);
  return evaluate(`(${call.arguments[0]!.getText(ast)})`, context);
}

function openings(tag: string, root: ts.Node = ast): ts.JsxOpeningLikeElement[] {
  const result: ts.JsxOpeningLikeElement[] = [];
  function visit(node: ts.Node) {
    if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && node.tagName.getText() === tag) result.push(node);
    ts.forEachChild(node, visit);
  }
  visit(root);
  return result;
}

function attribute(node: ts.JsxOpeningLikeElement, name: string): ts.JsxAttribute | undefined {
  return node.attributes.properties.find((prop): prop is ts.JsxAttribute => ts.isJsxAttribute(prop) && prop.name.getText() === name);
}

function attributeValue(node: ts.JsxOpeningLikeElement, name: string, context: Context): any {
  const value = attribute(node, name)?.initializer;
  assert.ok(value, `${name} must be present`);
  if (ts.isStringLiteral(value)) return value.text;
  assert.ok(ts.isJsxExpression(value) && value.expression);
  return evaluate(`(${value.expression.getText()})`, context);
}

test('all nine sports launch with compatible names, subtypes, intervals and platform labels even with stale Run/Walk state', () => {
  for (const sport of Object.keys(OUTDOOR_SPORTS) as OutdoorSport[]) {
    for (const enabled of [false, true]) {
      const context = launchContext(sport, enabled);
      const compatible = enabled && (sport === 'running' || sport === 'walking');
      const selected = evaluate('TYPES.find(item => item.type === selectedType)', context);
      const activity = callArgument('active.start', context);
      const live = callArgument('startOutdoorLiveActivity', context);
      context.started = { ...activity, workoutInstanceId: 'instance' };
      context.expectedId = 'instance';
      evaluate(declaration('workoutKind'), context);
      const watch = callArgument('startStrideWatchWorkout', context, 'connectOutdoorWatch');
      const expectedName = compatible ? 'Run / Walk' : selected.label;
      assert.equal(activity.activityType, sport);
      assert.equal(activity.name, expectedName);
      assert.equal(activity.subtype, compatible ? 'run_walk' : 'outdoor');
      assert.equal(activity.runWalkIntervals.length, compatible ? 12 : 0);
      if (compatible) {
        assert.equal(activity.runWalkIntervals[0].kind, 'run');
        assert.equal(activity.runWalkIntervals[0].durationSeconds, 60);
        assert.equal(activity.runWalkIntervals[1].kind, 'walk');
        assert.equal(activity.runWalkIntervals[1].durationSeconds, 90);
      }
      assert.equal(live.activityName, expectedName);
      assert.equal(live.activityType, compatible ? 'run_walk' : sport);
      assert.equal(watch.title, expectedName);
      assert.equal(watch.workoutKind, compatible ? 'run' : OUTDOOR_SPORTS[sport].watchKind);
      assert.equal(callArgument('enqueueVoiceCue', context), compatible ? 'Begin running.' : `${expectedName} started.`);
    }
  }
});

test('selecting an incompatible sport clears Run/Walk and returning to running does not silently re-enable it', () => {
  const selector = openings('TouchableOpacity').find(node => attribute(node, 'key')?.initializer?.getText(ast) === '{item.type}')!;
  for (const sport of Object.keys(OUTDOOR_SPORTS) as OutdoorSport[]) {
    let selectedType: OutdoorSport = 'running';
    let runWalk = true;
    const context = createContext({ item: { type: sport },
      setSelectedType: (next: OutdoorSport) => { selectedType = next; },
      setRunWalk: (next: boolean) => { runWalk = next; },
    });
    evaluate(`${functionText('supportsRunWalk')}\n${functionText('selectSport')}`, context);
    attributeValue(selector, 'onPress', context)();
    assert.equal(selectedType, sport);
    assert.equal(runWalk, sport === 'running' || sport === 'walking');
    context.item = { type: 'running' };
    attributeValue(selector, 'onPress', context)();
    assert.equal(selectedType, 'running');
    assert.equal(runWalk, sport === 'running' || sport === 'walking');
  }
});

test('sport choices have accessible names and selection states and do not add swimming', () => {
  const selector = openings('TouchableOpacity').find(node => attribute(node, 'key')?.initializer?.getText(ast) === '{item.type}')!;
  const context = launchContext('cycling', true);
  const types = evaluate('TYPES', context);
  assert.equal(types.length, 9);
  assert.equal(types.some((item: { type: string }) => item.type === 'swimming'), false);
  for (const item of types) {
    context.item = item;
    assert.equal(attributeValue(selector, 'accessibilityRole', context), 'button');
    assert.equal(attributeValue(selector, 'accessibilityLabel', context), item.label);
    assert.equal(attributeValue(selector, 'accessibilityState', context).selected, item.type === 'cycling');
  }
});

test('only the wired interval and navigation switches remain and every switch has an accessible name', () => {
  const switches = openings('Switch');
  const context = launchContext('running', true);
  context.active = { intervalPromptsEnabled: false, navigationPromptsEnabled: true };
  assert.deepEqual(switches.map(node => attributeValue(node, 'accessibilityLabel', context)), [
    'Run and walk intervals', 'Interval voice prompts', 'Navigation prompts',
  ]);
  assert.equal(attributeValue(switches[0]!, 'value', context), true);
  assert.equal(attributeValue(switches[1]!, 'value', context), false);
  assert.equal(attributeValue(switches[2]!, 'value', context), true);
  for (const name of ['heartRateCoachingEnabled', 'paceCoachingEnabled', 'hydrationPromptsEnabled', 'fuelPromptsEnabled']) {
    assert.equal(source.includes(`active.${name}`), false);
  }
});

test('directions expose their selected and disabled state without requiring a route', () => {
  const selector = openings('TouchableOpacity').find(node => attribute(node, 'key')?.initializer?.getText(ast) === '{mode}')!;
  const context = createContext({ mode: 'cycling', navigationMode: 'cycling', attached: null });
  assert.equal(attributeValue(selector, 'accessibilityLabel', context), 'Cycling directions');
  assert.equal(attributeValue(selector, 'accessibilityState', context).selected, true);
  assert.equal(attributeValue(selector, 'accessibilityState', context).disabled, true);
  context.attached = { id: 'route' };
  assert.equal(attributeValue(selector, 'accessibilityState', context).disabled, false);
  context.mode = 'off';
  assert.equal(attributeValue(selector, 'accessibilityState', context).selected, false);
  assert.equal(attributeValue(selector, 'accessibilityLabel', context), 'Directions off');
});

test('saved profile mass automatically drives cycling estimation and workout controls retain accessible identities', () => {
  const context = launchContext('cycling', true);
  context.active = { workoutInstanceId: 'instance', isPaused: false, activityType: 'cycling', aggregate: { points: [] }, recordingPauses: [] };
  context.profile = { athleteId: 'athlete', weightKg: 70, weightProvenance: { source: 'user_entered', weightKg: 70, savedAt: 1 } };
  context.profilePowerMass = profilePowerMass;
  context.powerSample = null;
  const masses: number[] = [];
  context.liveCyclingPower = (input: { bodyMassKg: number }) => { masses.push(input.bodyMassKg); return { watts: 210 }; };
  evaluate(`${declaration('cyclingMass')}\n${declaration('modeledPower')}`, context);
  assert.equal(evaluate('modeledPower.watts', context), 210);
  assert.deepEqual(masses, [70]);
  const unavailable = launchContext('cycling', false);
  Object.assign(unavailable, { active: context.active, profile: { athleteId: 'athlete', weightKg: 70 }, profilePowerMass,
    powerSample: null, liveCyclingPower: context.liveCyclingPower });
  evaluate(`${declaration('cyclingMass')}\n${declaration('modeledPower')}`, unavailable);
  assert.equal(evaluate('modeledPower', unavailable), null);
  assert.deepEqual(masses, [70], 'unverified defaults never drive an automatic estimate');
  assert.doesNotMatch(source, /confirmedCyclingMass|accessibilityRole="checkbox"/);
  const controls = openings('TouchableOpacity');
  const start = controls.find(node => attribute(node, 'style')?.initializer?.getText(ast).includes('s.startButton'))!;
  const sessionControls = openings('TouchableOpacity', sessionAst);
  const pause = sessionControls.find(node => attribute(node, 'accessibilityLabel')?.initializer?.getText().includes("'Resume activity'"))!;
  const complete = sessionControls.find(node => attribute(node, 'onPress')?.initializer?.getText() === '{props.onFinish}')!;
  context.props = { paused: false };
  for (const node of [start, pause, complete]) assert.equal(attributeValue(node, 'accessibilityRole', context), 'button');
  assert.equal(attributeValue(start, 'accessibilityLabel', context), 'Start Cycle');
  assert.equal(attributeValue(pause, 'accessibilityLabel', context), 'Pause activity');
  context.props.paused = true;
  assert.equal(attributeValue(pause, 'accessibilityLabel', context), 'Resume activity');
  assert.equal(attributeValue(complete, 'accessibilityLabel', context), 'Complete activity');
});

test('retained completion disables presentation immediately and a stale Pause/Resume callback never sends native controls', () => {
  const session = openings('ActiveOutdoorSession')[0]!;
  for (const isPaused of [false, true]) {
    for (const completionRequestedAt of [0, 123456]) {
      const calls: string[] = [];
      const latest = { isActive: true, isPaused, completionRequestedAt, workoutInstanceId: 'instance',
        pause: () => calls.push('pause'), resume: () => calls.push('resume') };
      const context = createContext({ active: { ...latest, completionRequestedAt: null },
        useActiveActivityStore: { getState: () => latest },
        pauseStrideWatchWorkout: () => { calls.push('native-pause'); return Promise.resolve(); },
        resumeStrideWatchWorkout: () => { calls.push('native-resume'); return Promise.resolve(); },
      });
      attributeValue(session, 'onPauseResume', context)();
      assert.deepEqual(calls, []);
      context.active = latest;
      assert.equal(attributeValue(session, 'ending', context), true);
      context.active = { ...latest, completionRequestedAt: null };
      assert.equal(attributeValue(session, 'ending', context), false);
      latest.completionRequestedAt = null as any;
      attributeValue(session, 'onPauseResume', context)();
      assert.deepEqual(calls, isPaused ? ['resume', 'native-resume'] : ['pause', 'native-pause']);
    }
  }
});

test('Live Activity average pace uses average speed, rounds across minute boundaries and rejects unavailable speed', () => {
  const publisher = findNode((node): node is ts.CallExpression => ts.isCallExpression(node) && node.expression.getText(ast) === 'updateOutdoorLiveActivity');
  const payload = publisher.arguments[0]!;
  assert.ok(ts.isObjectLiteralExpression(payload));
  const pace = payload.properties.find((node): node is ts.PropertyAssignment => ts.isPropertyAssignment(node) && node.name.getText(ast) === 'averagePace');
  assert.ok(pace);
  for (const [averageMetersPerSecond, expected] of [
    [1609.344 / 479.6, '8:00'], [1609.344 / 479.4, '7:59'],
    [0, '--:--'], [-1, '--:--'], [NaN, '--:--'], [Infinity, '--:--'],
  ] as const) {
    const context = createContext({ active: { aggregate: { averageMetersPerSecond, currentMetersPerSecond: 1 } } });
    evaluate(declaration('secPerMile'), context);
    assert.equal(evaluate(pace.initializer.getText(ast), context), expected);
  }
});
