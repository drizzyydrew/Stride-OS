import assert from 'node:assert/strict';
import test from 'node:test';
import { createBackActionRegistry, isSectionRoot } from '../../src/utils/navigationEscape';

test('house appears on section roots while archive/edit/session details retain Back', () => {
  for (const path of ['/', '/dashboard', '/training', '/training/index', '/profile/', '/activity', '/more', '/calendar']) assert.equal(isSectionRoot(path), true, path);
  for (const path of ['/settings/goal-archive-detail', '/profile/calibration', '/training/run-creator', '/activity/start', '/auth/sign-in', '/onboarding/identity']) assert.equal(isSectionRoot(path), false, path);
});

test('Home queues scroll until retained Today is focused and consumes cold-entry reset once', () => {
  const registry = createBackActionRegistry();
  let first = 0;
  registry.requestTodayTop(); // Today has not mounted after a cold detail link.
  const leave = registry.registerTodayScroll(() => first++);
  assert.equal(first, 1);
  registry.requestTodayTop(); // Already on Today, scrolled down.
  assert.equal(first, 2);
  leave();
  registry.requestTodayTop(); // Another retained tab is focused.
  registry.requestTodayTop();
  let second = 0;
  const leaveSecond = registry.registerTodayScroll(() => second++);
  assert.equal(second, 1);
  leaveSecond();
  registry.registerTodayScroll(() => second++);
  assert.equal(second, 1); // Ordinary tab focus preserves position.
});

test('Home scroll registration never replaces or invokes nested unsaved-edit guards', () => {
  const registry = createBackActionRegistry();
  let guards = 0;
  registry.register(Symbol(), { path: '/training/run-creator', invoke: () => guards++ });
  const leave = registry.registerTodayScroll(() => {});
  registry.requestTodayTop();
  leave();
  assert.equal(guards, 0);
  assert.equal(registry.handle('/training/run-creator'), true);
  assert.equal(guards, 1);
});

import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

test('retained active Running hides tabs only during focus and restores them on Home/blur', () => {
  const source = readFileSync('app/(tabs)/training/index.tsx', 'utf8');
  const ast = ts.createSourceFile('running.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let call: ts.CallExpression | undefined;
  function visit(node: ts.Node) {
    if (ts.isCallExpression(node) && node.expression.getText(ast) === 'useFocusEffect') call = node;
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.ok(call, 'tab bar effect must have focus lifetime');
  for (const isRunning of [true, false]) {
    const changes: { tabBarStyle: Record<string, unknown> }[] = [];
    let focus!: () => () => void;
    runInNewContext(call.getText(ast), {
      useFocusEffect: (callback: () => () => void) => { focus = callback; },
      useCallback: (callback: () => () => void) => callback,
      navigation: { getParent: () => ({ setOptions: (change: { tabBarStyle: Record<string, unknown> }) => changes.push(change) }) },
      C: { bg: '#000', border: '#333' }, isRunning,
      LAYOUT: { tabBarHeight: 94, tabBarPadBottom: 26, tabBarPadTop: 10, tabBarPadHorizontal: 8 },
    });
    assert.equal(changes.length, 0, 'retained unfocused screen cannot own tab bar');
    const blur = focus();
    assert.equal(changes[0].tabBarStyle.display, isRunning ? 'none' : undefined);
    blur();
    assert.equal(changes[1].tabBarStyle.display, undefined);
    assert.equal(changes[1].tabBarStyle.height, 94);
  }
});
