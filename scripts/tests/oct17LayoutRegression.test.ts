import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

function nodes(element: any): any[] {
  if (!element || typeof element !== 'object') return [];
  if (Array.isArray(element)) return element.flatMap(nodes);
  return [element, ...nodes(element.props?.children)];
}

function picker(width: number, fontScale: number) {
  const filename = resolve('src/components/share/ShareOptionGrid.tsx');
  const require = createRequire(filename);
  const mocks: Record<string, unknown> = {
    'react-native': { Text: 'Text', TouchableOpacity: 'Button', View: 'View',
      useWindowDimensions: () => ({ width, fontScale }), StyleSheet: { create: (styles: unknown) => styles } },
    '../../theme/useColors': { useColors: () => ({ text: '#fff', primary: '#789', primaryDim: '#123', cardAlt: '#222', border: '#444' }) },
  };
  const module = { exports: {} as any };
  vm.runInNewContext(ts.transpileModule(readFileSync(filename, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText, { module, exports: module.exports, require: (id: string) => mocks[id] ?? require(id) });
  return module.exports.default;
}

test('actual share options keep full labels and grow/reflow at phone widths and accessibility scales', () => {
  for (const width of [320, 390, 430]) for (const fontScale of [1, 1.3, 2]) {
    const changes: string[] = [];
    const tree = picker(width, fontScale)({ options: [{ id: 'overlay', label: 'Transparent Overlay' },
      { id: 'achievement', label: 'Activity + Achievement' }], value: 'overlay', onChange: (value: string) => changes.push(value) });
    assert.equal(tree.props.style.flexWrap, 'wrap');
    const buttons = nodes(tree).filter(node => node.type === 'Button');
    for (const button of buttons) {
      const [base, dynamic] = button.props.style;
      assert.equal(base.maxWidth, '100%');
      assert.equal(base.minHeight, 56);
      assert.equal(base.height, undefined);
      assert.equal(dynamic.flexBasis, 150 * fontScale);
      const label = button.props.children;
      assert.equal(label.props.style[0].fontSize, 14);
      assert.equal(label.props.numberOfLines, undefined);
      assert.equal(label.props.adjustsFontSizeToFit, undefined);
    }
    assert.equal(buttons[0].props.children.props.children, 'Transparent Overlay');
    buttons[1].props.onPress();
    assert.deepEqual(changes, ['achievement']);
  }
  const locked = picker(320, 2)({ options: [{ id: 'square', label: 'Square' }], value: 'square', onChange() {}, disabled: true });
  assert.equal(nodes(locked).find(node => node.type === 'Button').props.disabled, true);
});

const trainingText = readFileSync('app/(tabs)/training/index.tsx', 'utf8');
const training = ts.createSourceFile('training.tsx', trainingText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function find(root: ts.Node, predicate: (node: ts.Node) => boolean): ts.Node | undefined {
  if (predicate(root)) return root;
  return ts.forEachChild(root, node => find(node, predicate));
}
function jsxName(node: ts.Node, name: string): node is ts.JsxElement {
  return ts.isJsxElement(node) && node.openingElement.tagName.getText(training) === name;
}

test('paused Training metrics scroll independently while Resume and Stop remain outside that scrolling subtree', () => {
  const activeTab = find(training, node => ts.isFunctionDeclaration(node) && node.name?.text === 'ActiveTab')!;
  const paused = find(activeTab, node => ts.isIfStatement(node) && node.expression.getText(training) === "runState === 'paused'")!;
  const scroll = find(paused, node => jsxName(node, 'ScrollView'))!;
  assert.ok(scroll);
  assert.ok(find(scroll, node => ts.isJsxSelfClosingElement(node) && node.tagName.getText(training) === 'RunPrimaryMetrics'));
  assert.doesNotMatch(scroll.getText(training), /accessibilityLabel="(?:Resume|Stop) run"/);
  assert.match(paused.getText(training), /accessibilityLabel="Resume run"/);
  assert.match(paused.getText(training), /accessibilityLabel="Stop run"/);
});

test('Training setup resets only its presentation scroll subtree on idle/environment transitions', () => {
  assert.match(trainingText, /key=\{`setup:\$\{pendingEnvironment\}:\$\{runState === 'idle' \? 'idle' : 'session'\}`\}/);
  assert.doesNotMatch(trainingText, /<ActiveTab[^>]*key=/);
  const primary = find(training, node => ts.isFunctionDeclaration(node) && node.name?.text === 'RunPrimaryMetrics')!;
  assert.match(primary.getText(training), /livePrimaryMetricBasis\(time, distance, width - 48, fontScale\)/);
  assert.match(primary.getText(training), /FittedMetricText value=\{time\}/);
  assert.doesNotMatch(primary.getText(training), /adjustsFontSizeToFit|numberOfLines/);
});

test('share artwork uses explicit fixed-size composition and no native autoshrink paths', () => {
  const source = readFileSync('src/components/share/ShareStudio.tsx', 'utf8');
  assert.doesNotMatch(source, /adjustsFontSizeToFit|minimumFontScale/);
  assert.match(source, /squareTitle: \{[^\n]*fontSize: 34, lineHeight: 36/);
  assert.match(source, /squareComposition: \{[^\n]*width: 360, height: 360/);
  assert.match(source, /storyComposition: \{[^\n]*width: 360, height: 640/);
  assert.match(source, /canvasSize.width \|\| 360\) \/ 360/);
  assert.match(source, /isOutdoorSport\(activity.activityType\).*OUTDOOR_SPORTS\[activity.activityType\].speedBased/);
  assert.match(source, /full|accessibilityLabel/);
  assert.match(source, /titleLayoutKey = `\$\{variant\}:\$\{separateActivityTitle\}:\$\{fixedTitleSize\}`/);
  assert.match(source, /key=\{titleLayoutKey\}/);
  assert.match(source, /titleLayoutGeneration.current !== titleLayoutKey/);
  assert.match(source, /else if \(fixedTitleSize > 24\)/);
  assert.match(source, /isStory && selectedMetrics.length >= 5 && styles.denseStoryRoute/);
  assert.match(source, /denseStoryRoute: \{ top: '49%' \}/);
  assert.match(source, /denseStoryBadge: \{ top: 310 \}/);
  const ast = ts.createSourceFile('share.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const budget = find(ast, node => ts.isFunctionDeclaration(node) && node.name?.text === 'storyHeaderBudget')!;
  const code = ts.transpileModule(budget.getText(ast).replace('export ', ''), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const context = vm.createContext({});
  vm.runInContext(code, context);
  assert.equal(vm.runInContext("storyHeaderBudget('editorial_card')", context), 89.6);
  assert.equal(vm.runInContext("storyHeaderBudget('transparent_overlay')", context), 101.6);
  assert.equal(vm.runInContext("storyHeaderBudget('activity_achievement')", context), 108);
});
