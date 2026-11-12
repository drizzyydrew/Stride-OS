import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

function source(path: string) {
  return ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}
function find<T extends ts.Node>(root: ts.Node, predicate: (node: ts.Node) => node is T): T[] {
  const matches: T[] = [];
  function visit(node: ts.Node) { if (predicate(node)) matches.push(node); ts.forEachChild(node, visit); }
  visit(root);
  return matches;
}
function execute(code: string, context: Record<string, unknown>) {
  const js = ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
  return runInNewContext(js, context);
}
const running = source('app/(tabs)/training/index.tsx');
const active = find(running, (node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node) && node.name?.text === 'ActiveTab')[0];
assert.ok(active, 'actual ActiveTab exists');

test('actual Running manual Pause and Resume use explicit controls for the immutable run ID', () => {
  for (const action of ['pause', 'resume']) {
    const fn = find(active, (node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node) && node.name?.text === action)[0];
    assert.ok(fn, `actual ${action} handler exists`);
    const calls: unknown[] = [];
    const watch = (kind: string) => (id: string) => { calls.push([kind, id]); return Promise.resolve({}); };
    execute(`${fn.getText(running)}\n${action}();`, {
      workoutInstanceId: 'run-a', pauseRun: () => calls.push('phone-pause'), resumeRun: () => calls.push('phone-resume'),
      pauseStrideWatchWorkoutExplicit: watch('explicit-pause'), resumeStrideWatchWorkoutExplicit: watch('explicit-resume'),
      pauseStrideWatchRun: () => { throw new Error('manual action used the generic API'); },
      resumeStrideWatchRun: () => { throw new Error('manual action used the generic API'); },
      setWatchStatus: () => {}, speakCue: () => {},
    });
    assert.deepEqual(calls, [`phone-${action}`, [`explicit-${action}`, 'run-a']]);
  }
});

test('actual automatic pause mirror never opts into cold manual-control discovery', () => {
  const effects = find(active, (node): node is ts.CallExpression => ts.isCallExpression(node)
    && node.expression.getText(running) === 'useEffect'
    && !!node.arguments[0]?.getText(running).includes('lastMirroredAutoPauseDecisionRef.current'));
  assert.equal(effects.length, 1);
  const callback = effects[0].arguments[0].getText(running);
  for (const paused of [true, false]) {
    const calls: unknown[] = [];
    const watch = (kind: string) => (id: string) => { calls.push([kind, id]); return Promise.resolve({}); };
    execute(`(${callback})();`, {
      isActive: true, environment: 'outdoor', isPaused: paused, workoutInstanceId: 'run-a',
      autoPauseState: { lastDecisionAtMs: 10, manualPaused: false, paused }, lastMirroredAutoPauseDecisionRef: { current: null },
      pauseStrideWatchRun: watch('automatic-pause'), resumeStrideWatchRun: watch('automatic-resume'),
      pauseStrideWatchWorkoutExplicit: () => { throw new Error('automatic state became explicit user intent'); },
      resumeStrideWatchWorkoutExplicit: () => { throw new Error('automatic state became explicit user intent'); },
      setWatchStatus: () => {},
    });
    assert.deepEqual(calls, [[paused ? 'automatic-pause' : 'automatic-resume', 'run-a']]);
  }
});

const outdoor = source('app/(tabs)/activity/start.tsx');
const pauseAttributes = find(outdoor, (node): node is ts.JsxAttribute => ts.isJsxAttribute(node)
  && node.name.getText(outdoor) === 'onPauseResume');
assert.equal(pauseAttributes.length, 1);
const initializer = pauseAttributes[0].initializer;
assert.ok(initializer && ts.isJsxExpression(initializer) && initializer.expression);
const outdoorPause = initializer.expression.getText(outdoor);

test('actual outdoor manual controls pass the current recording ID for both actions', () => {
  for (const paused of [false, true]) {
    const calls: unknown[] = [];
    const latest = { isActive: true, isPaused: paused, completionRequestedAt: null, workoutInstanceId: 'outdoor-a',
      pause: () => calls.push('phone-pause'), resume: () => calls.push('phone-resume') };
    const watch = (kind: string) => (id: string) => { calls.push([kind, id]); return Promise.resolve({}); };
    execute(`(${outdoorPause})();`, {
      active: { workoutInstanceId: 'outdoor-a' }, useActiveActivityStore: { getState: () => latest },
      pauseStrideWatchWorkoutExplicit: watch('explicit-pause'), resumeStrideWatchWorkoutExplicit: watch('explicit-resume'),
    });
    const action = paused ? 'resume' : 'pause';
    assert.deepEqual(calls, [`phone-${action}`, [`explicit-${action}`, 'outdoor-a']]);
  }
});

test('an outdated outdoor control cannot toggle a different or completed recording', () => {
  for (const changed of [{ workoutInstanceId: 'outdoor-b' }, { isActive: false }, { completionRequestedAt: 123 }]) {
    const calls: unknown[] = [];
    const latest = { isActive: true, isPaused: false, completionRequestedAt: null, workoutInstanceId: 'outdoor-a',
      pause: () => calls.push('phone-pause'), resume: () => calls.push('phone-resume'), ...changed };
    execute(`(${outdoorPause})();`, {
      active: { workoutInstanceId: 'outdoor-a' }, useActiveActivityStore: { getState: () => latest },
      pauseStrideWatchWorkoutExplicit: () => { calls.push('watch-pause'); return Promise.resolve({}); },
      resumeStrideWatchWorkoutExplicit: () => { calls.push('watch-resume'); return Promise.resolve({}); },
    });
    assert.deepEqual(calls, []);
  }
});

const recovery = source('src/components/activity/RecoveredActivityPrompt.tsx');
const resumeAction = find(recovery, (node): node is ts.ObjectLiteralExpression => ts.isObjectLiteralExpression(node)
  && node.properties.some(property => ts.isPropertyAssignment(property) && property.name.getText(recovery) === 'text'
    && ts.isStringLiteral(property.initializer) && property.initializer.text === 'Resume activity'));
assert.equal(resumeAction.length, 1);
const resumeReference = resumeAction[0].properties.find((property): property is ts.PropertyAssignment =>
  ts.isPropertyAssignment(property) && property.name.getText(recovery) === 'onPress')!.initializer.getText(recovery);
const resumeDeclaration = find(recovery, (node): node is ts.VariableDeclaration => ts.isVariableDeclaration(node)
  && node.name.getText(recovery) === resumeReference && !!node.initializer);
assert.equal(resumeDeclaration.length, 1);
const resumeCallback = resumeDeclaration[0].initializer!.getText(recovery);

test('both recovery Resume choices use the same guarded discovery callback', () => {
  const continuation = find(recovery, (node): node is ts.ObjectLiteralExpression => ts.isObjectLiteralExpression(node)
    && node.properties.some(property => ts.isPropertyAssignment(property) && property.name.getText(recovery) === 'text'
      && ts.isStringLiteral(property.initializer) && property.initializer.text === 'Continue recording'));
  assert.equal(continuation.length, 1);
  const callback = continuation[0].properties.find((property): property is ts.PropertyAssignment =>
    ts.isPropertyAssignment(property) && property.name.getText(recovery) === 'onPress')!.initializer.getText(recovery);
  assert.equal(callback, resumeReference);
});

test('actual recovery Resume discovers only the current outdoor identity before navigation', () => {
  for (const domain of ['running', 'outdoor']) {
    const calls: unknown[] = [];
    const activity = { domain, workoutInstanceId: 'retained-a', startedAt: 100, ending: false, alreadySaved: false };
    execute(`(${resumeCallback})();`, {
      cancelled: false, decision: { activity, isOwnerCurrent: () => true, resume: () => calls.push('navigate') },
      readActivity: () => activity, useActiveRunStore: { getState: () => ({ environment: 'outdoor' }) },
      recoverStrideWatchControlIdentity: (id: string) => calls.push(['read-only-identity', id]),
    });
    assert.deepEqual(calls, [['read-only-identity', 'retained-a'], 'navigate']);
  }
});

test('stale recovery choices never discover or navigate another owner or recording', () => {
  for (const scenario of [
    { owner: false }, { cancelled: true }, { current: null },
    { changed: { workoutInstanceId: 'retained-b' } }, { changed: { startedAt: 200 } },
    { changed: { domain: 'outdoor' } }, { changed: { ending: true } }, { changed: { alreadySaved: true } },
  ]) {
    const calls: unknown[] = [];
    const activity = { domain: 'running', workoutInstanceId: 'retained-a', startedAt: 100, ending: false, alreadySaved: false };
    const current = 'current' in scenario ? scenario.current : { ...activity, ...scenario.changed };
    execute(`(${resumeCallback})();`, {
      cancelled: scenario.cancelled ?? false,
      decision: { activity, isOwnerCurrent: () => scenario.owner ?? true, resume: () => calls.push('navigate') },
      readActivity: () => current, useActiveRunStore: { getState: () => ({ environment: 'outdoor' }) },
      recoverStrideWatchControlIdentity: () => calls.push('identity'),
    });
    assert.deepEqual(calls, []);
  }
});

test('indoor recovery keeps its prior navigation without outdoor identity discovery', () => {
  const calls: unknown[] = [];
  const activity = { domain: 'running', workoutInstanceId: 'retained-a', startedAt: 100, ending: false, alreadySaved: false };
  execute(`(${resumeCallback})();`, {
    cancelled: false, decision: { activity, isOwnerCurrent: () => true, resume: () => calls.push('navigate') },
    readActivity: () => activity, useActiveRunStore: { getState: () => ({ environment: 'indoor' }) },
    recoverStrideWatchControlIdentity: () => calls.push('identity'),
  });
  assert.deepEqual(calls, ['navigate']);
});

test('actual read-only helper calls prepare only, with safe legacy and failure fallbacks', () => {
  const bridge = source('modules/stride-watch-connectivity/src/index.ts');
  const helper = find(bridge, (node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node)
    && node.name?.text === 'recoverStrideWatchControlIdentity')[0];
  assert.ok(helper);
  const code = helper.getText(bridge).replace(/^export\s+/, '');
  for (const mode of ['current', 'legacy', 'unavailable', 'failure', 'empty']) {
    const calls: unknown[] = [];
    const native = mode === 'unavailable' ? null : {
      ...(mode === 'legacy' ? {} : { prepareWorkoutStart: (id: string) => {
        calls.push(['prepare-only', id]);
        if (mode === 'failure') throw new Error('Watch unavailable');
        return 'nonce';
      } }),
      startPreparedWorkout: () => { calls.push('unexpected-start'); throw new Error('read-only recovery started a workout'); },
      startWorkout: () => { calls.push('unexpected-start'); throw new Error('read-only recovery started a workout'); },
      startRun: () => { calls.push('unexpected-start'); throw new Error('read-only recovery started a workout'); },
    };
    assert.doesNotThrow(() => execute(`${code}\nrecoverStrideWatchControlIdentity(${mode === 'empty' ? "''" : "'retained-a'"});`, {
      getNativeModule: () => native,
    }));
    assert.deepEqual(calls, ['current', 'failure'].includes(mode) ? [['prepare-only', 'retained-a']] : []);
  }
});
