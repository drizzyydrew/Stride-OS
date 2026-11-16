import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import { onboardingTrainingChoice } from '../../src/utils/pro-access';

function harness(initialized = false, allowed = false) {
  const file = 'app/onboarding/complete.tsx';
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const screen = source.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'CompleteScreen') as ts.FunctionDeclaration;
  const build = screen.body!.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'handleBuild') as ts.FunctionDeclaration;
  const block = (build.body!.statements.find(ts.isTryStatement) as ts.TryStatement).tryBlock;
  const start = block.statements.findIndex(statement => ts.isVariableStatement(statement)
    && statement.declarationList.declarations.some(item => item.name.getText(source) === 'trainingChoice'));
  assert.ok(start >= 0);
  const code = `async function finishTraining() { ${block.statements.slice(start).map(node => node.getText(source)).join('\n')} }`;
  const state = { initialized, trainingMode: initialized ? 'structured' : 'open', ensureInitialized: () => { events.push('initialize'); state.initialized = true; } };
  const events: unknown[] = [];
  let release!: () => void;
  let reject!: (reason: Error) => void;
  const saving = new Promise<void>((yes, no) => { release = yes; reject = no; });
  const data = { goalType: 'race_prep', programStartDate: '2026-11-16', raceName: 'My race', raceDate: '2027-01-01', raceDistance: '5k', racePriority: 'A' };
  const context = { onboardingTrainingChoice, proMembershipEnabled: () => true, getProAccess: () => ({ allowed }),
    useTrainingPlanStore: { getState: () => state }, data, toYMD: () => '2026-11-16',
    saveTrainingPlanChoice: async (_lease: unknown, choice: unknown, stillCurrent: () => boolean) => {
      assert.deepEqual(JSON.parse(JSON.stringify(choice)), { open: true }); assert.equal(stillCurrent(), true);
      events.push('open-start'); await saving; state.trainingMode = 'open'; events.push('open-confirmed');
    }, currentLease: { ownerUserId: 'owner' }, current: () => true,
    setGoalType: () => events.push('goal'), setProgramStartDate: () => events.push('start'), races: [], addRace: () => events.push('race'),
    completeOnboarding: async () => { events.push('onboarding-complete'); }, router: { replace: (route: string) => events.push(route) }, Date,
  };
  const run = vm.runInNewContext(`${ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText}\nfinishTraining`, context);
  return { run, release, reject, events, state, data };
}

test('new inactive onboarding confirms open mode before completion and preserves the draft for Pro later', async () => {
  const h = harness(); const draft = JSON.stringify(h.data); const pending = h.run();
  assert.deepEqual(h.events, ['open-start']);
  h.release(); await pending;
  assert.deepEqual(JSON.parse(JSON.stringify(h.events)), ['open-start', 'open-confirmed', 'onboarding-complete',
    { pathname: '/(tabs)/settings/membership', params: { source: 'onboarding' } }]);
  assert.equal(JSON.stringify(h.data), draft);
  assert.equal(h.events.includes('initialize'), false);
});

test('failed initial open-mode save cannot unlock completed onboarding or a generated plan', async () => {
  const h = harness(); const pending = h.run(); h.reject(new Error('disk full'));
  await assert.rejects(pending, /disk full/);
  assert.deepEqual(h.events, ['open-start']);
});

test('returning onboarding preserves an existing plan regardless of membership', async () => {
  for (const allowed of [true, false]) {
    const h = harness(true, allowed); await h.run();
    assert.deepEqual(h.events, ['onboarding-complete', '/(tabs)/dashboard']);
    assert.equal(h.state.trainingMode, 'structured');
  }
});

test('new verified Pro onboarding creates the personalized spine and target race', async () => {
  const h = harness(false, true); await h.run();
  assert.deepEqual(h.events, ['initialize', 'goal', 'start', 'race', 'onboarding-complete', '/(tabs)/dashboard']);
});
