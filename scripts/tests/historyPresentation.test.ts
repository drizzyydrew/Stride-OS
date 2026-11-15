import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { formatHistoryNumber } from '../../src/utils/historyFormatting';

function source(file: string) {
  return ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}

test('history numbers show at most two decimals and missing values stay unavailable', () => {
  for (const [value, expected] of [[18.2666666666667, '18.27'], [139.4166666666667, '139.42'], [1.005, '1.01'], [2, '2'], [0, '0'], [-0.0001, '0']] as const) {
    assert.equal(formatHistoryNumber(value), expected);
  }
  for (const missing of [undefined, null, NaN, Infinity, -Infinity]) assert.equal(formatHistoryNumber(missing), '—');
});

test('actual Settings history callback rounds run and strength previews without mutating saved measurements', () => {
  const ast = source('app/(tabs)/settings/index.tsx');
  let callback = '';
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'recentTrainingHistory' && node.initializer && ts.isCallExpression(node.initializer)) {
      callback = node.initializer.arguments[0].getText(ast);
    }
    ts.forEachChild(node, visit);
  };
  visit(ast);
  assert.ok(callback);
  const workoutHistory = [{ id: 'run', timestamp: 2, actualDurationMinutes: 18.2666666666667, actualDistanceMiles: 1.23456789 }];
  const strengthHistory = [{ id: 'strength', timestamp: 1, actualDuration: 139.4166666666667 }];
  const before = JSON.stringify({ workoutHistory, strengthHistory });
  for (const imp of [true, false]) {
    const render = runInNewContext(ts.transpile(`const renderHistory = ${callback}; renderHistory;`, { target: ts.ScriptTarget.ES2022 }), {
      imp, workoutHistory, strengthHistory, formatHistoryNumber, formatHistoryDate: () => 'Nov 15',
    });
    const rows = render();
    assert.equal(rows[0].meta, `Nov 15 · 18.27 min · ${imp ? '1.23 mi' : '1.99 km'}`);
    assert.equal(rows[1].meta, 'Nov 15 · 139.42 min');
    assert.equal(JSON.stringify({ workoutHistory, strengthHistory }), before);
  }
});

test('Settings Profile card opens the existing page and More has one Settings entry without a duplicate Profile item', () => {
  const ast = source('app/(tabs)/settings/index.tsx');
  let handler = '';
  const visit = (node: ts.Node) => {
    if (ts.isJsxOpeningElement(node) && node.attributes.properties.some(prop => ts.isJsxAttribute(prop) && prop.name.getText(ast) === 'accessibilityLabel' && prop.initializer?.getText(ast) === '"Profile"')) {
      const press = node.attributes.properties.find(prop => ts.isJsxAttribute(prop) && prop.name.getText(ast) === 'onPress') as ts.JsxAttribute | undefined;
      if (press?.initializer && ts.isJsxExpression(press.initializer)) handler = press.initializer.expression!.getText(ast);
    }
    ts.forEachChild(node, visit);
  };
  visit(ast);
  assert.ok(handler);
  const routes: string[] = [];
  runInNewContext(`(${handler})`, { router: { push: (route: string) => routes.push(route) } })();
  assert.deepEqual(routes, ['/(tabs)/settings/profile']);
  const more = source('app/(tabs)/more/index.tsx');
  let itemsSource = '';
  const findItems = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && node.name.getText(more) === 'ITEMS') itemsSource = node.initializer!.getText(more);
    ts.forEachChild(node, findItems);
  };
  findItems(more);
  const items = runInNewContext(`(${itemsSource})`);
  assert.equal(items.filter((item: { route: string }) => item.route === '/(tabs)/settings').length, 1);
  assert.equal(items.filter((item: { route: string }) => item.route === '/(tabs)/profile').length, 0);
});
