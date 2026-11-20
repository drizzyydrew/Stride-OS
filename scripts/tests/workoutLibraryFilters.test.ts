import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
import { STRENGTH_PRESET_WORKOUTS } from '../../src/constants/strengthBank';
import { MOBILITY_EXERCISES, MOBILITY_WORKOUTS } from '../../src/constants/mobilityBank';
import { presetLibraryItem, mobilityLibraryItem, matchesWorkoutLibraryFilters, emptyWorkoutLibraryFilters } from '../../src/utils/workoutLibraryFilters';

function compile(path: string, mocks: Record<string, unknown>) {
  const module = { exports: {} as any };
  vm.runInNewContext(ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText, { module, exports: module.exports, require: (key: string) => {
    assert.ok(Object.hasOwn(mocks, key), `Unexpected import ${key}`); return mocks[key];
  } });
  return module.exports;
}
const api = compile('src/utils/workoutLibraryFilters.ts', {
  './exerciseCatalog': { resolveExerciseMetadata: ({ name }: { name: string }) => name === 'Romanian deadlift'
    ? { primaryMuscles: ['hamstrings', 'glutes'], supportMuscles: ['core'], mobilityTargets: [] }
    : name === 'Hamstring stretch' ? { primaryMuscles: [], mobilityTargets: ['hamstrings'] }
      : { primaryMuscles: [], supportMuscles: [], mobilityTargets: [] } },
});

test('workout filters combine all muscles/equipment across a workout and any chosen category', () => {
  const item = { id: 'fit', durationMin: 27, categories: ['full_body'], muscles: ['hamstrings', 'glutes'], equipment: ['barbell', 'bench'] };
  const filters = { categories: ['full_body', 'runner_strength'], muscles: ['hamstrings', 'glutes'], equipment: ['barbell'], maxMinutes: 30 };
  assert.equal(api.matchesWorkoutLibraryFilters(item, filters), true);
  assert.equal(api.matchesWorkoutLibraryFilters({ ...item, muscles: ['hamstrings'] }, filters), false);
  assert.equal(api.matchesWorkoutLibraryFilters({ ...item, equipment: ['dumbbell'] }, filters), false);
  assert.equal(api.matchesWorkoutLibraryFilters({ ...item, categories: ['upper_body'] }, filters), false);
});

test('maximum duration is inclusive; short workouts remain, longer or unknown durations do not match a limit', () => {
  const filters = { ...api.emptyWorkoutLibraryFilters(), maxMinutes: 30 };
  const item = { id: 'fit', categories: [], muscles: [], equipment: [] };
  for (const durationMin of [8, 27, 30]) assert.equal(api.matchesWorkoutLibraryFilters({ ...item, durationMin }, filters), true);
  for (const durationMin of [30.1, 45, NaN, 0, -1]) assert.equal(api.matchesWorkoutLibraryFilters({ ...item, durationMin }, filters), false);
});

test('strength target tags include canonical primary muscles and do not inflate supporting muscles', () => {
  const item = api.presetLibraryItem({ id: 'rdl', durationMin: 20, categories: ['full_body'], equipment: ['barbell'],
    exercises: [{ name: 'Romanian deadlift' }, { name: 'Unknown custom lift' }] });
  assert.deepEqual(Array.from(item.muscles), ['glutes', 'hamstrings']);
  assert.equal(item.muscles.includes('core'), false);
  const mobility = api.mobilityLibraryItem({ id: 'stretch', durationMin: 8, categories: ['lower_body'], exercises: [{ exerciseId: 'ham' }] },
    [{ id: 'ham', name: 'Hamstring stretch', targetArea: 'Hamstrings' }]);
  assert.deepEqual(Array.from(mobility.muscles), ['hamstrings']);
});

type Element = { type: string; props: any };
function nodes(node: any): Element[] {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(nodes);
  return [node, ...nodes(node.props?.children)];
}
function uiHarness() {
  const state: any[] = []; let cursor = 0;
  const useState = (initial: any) => { const key = cursor++; if (!(key in state)) state[key] = typeof initial === 'function' ? initial() : initial;
    return [state[key], (next: any) => { state[key] = typeof next === 'function' ? next(state[key]) : next; }]; };
  const jsx = (type: string, props: any) => ({ type, props });
  const ui = compile('src/components/strength/WorkoutLibraryFilters.tsx', {
    react: { useState }, 'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': { Text: 'Text', View: 'View', useWindowDimensions: () => ({ fontScale: 1 }) },
    '@expo/ui': { Button: 'Button', Checkbox: 'Checkbox', Collapsible: 'Collapsible', Column: 'Column', Host: 'Host', Text: 'NativeText' },
    '../../theme/useColors': { useColors: () => ({ text: '#fff', textMuted: '#aaa', primary: '#abc', card: '#111', border: '#333' }) },
    '../../store/themeStore': { useThemeMode: () => 'dark' }, '../../utils/displayLabels': { displayLabel: (value: string) => value },
    '../../utils/workoutLibraryFilters': api,
  });
  let value = api.emptyWorkoutLibraryFilters(); const applied: any[] = [];
  const render = () => { cursor = 0; return nodes(ui.default({ value, onApply: (next: any) => { applied.push(next); value = next; },
    categories: [{ value: 'full_body', label: 'Full body' }], muscles: ['hamstrings', 'core'], equipment: ['barbell'] })); };
  const find = (type: string, label: string) => { const node = render().find(item => item.type === type && item.props.label === label); assert.ok(node, `${type}: ${label}`); return node; };
  const disclosure = () => render().find(item => item.type === 'Collapsible')!;
  return { ui, render, find, disclosure, applied, value: () => value };
}

test('actual native dropdown edits a draft, applies once and collapses; Cancel discards changes and Clear waits for Apply', () => {
  const h = uiHarness();
  assert.equal(h.disclosure().props.isOpen, false);
  assert.equal(h.render().some(node => node.type === 'Checkbox'), false);
  h.disclosure().props.onOpenChange(true);
  h.find('Checkbox', 'hamstrings').props.onValueChange(true);
  h.find('Checkbox', 'barbell').props.onValueChange(true);
  h.find('Checkbox', '30 minutes or less').props.onValueChange(true);
  assert.equal(h.applied.length, 0);
  assert.equal(h.value().maxMinutes, null);
  h.find('Button', 'Apply filters').props.onPress();
  assert.equal(h.applied.length, 1);
  assert.equal(h.disclosure().props.isOpen, false);
  assert.equal(h.value().maxMinutes, 30);
  assert.equal(h.disclosure().props.label, 'Filters · 3 applied');
  h.disclosure().props.onOpenChange(true);
  h.find('Checkbox', 'core').props.onValueChange(true);
  h.find('Button', 'Cancel').props.onPress();
  h.disclosure().props.onOpenChange(true);
  assert.equal(h.find('Checkbox', 'core').props.value, false);
  h.find('Button', 'Clear choices').props.onPress();
  assert.equal(h.value().maxMinutes, 30);
  h.find('Button', 'Apply filters').props.onPress();
  assert.equal(h.applied.length, 2);
  assert.equal(h.disclosure().props.isOpen, false);
  assert.equal(api.libraryFilterCount(h.value()), 0);
});

test('one maximum duration replaces another and the library view buttons switch to distinct lists', () => {
  const h = uiHarness(); h.disclosure().props.onOpenChange(true);
  const previousMaximum = h.find('Checkbox', '30 minutes or less');
  previousMaximum.props.onValueChange(true);
  h.find('Checkbox', '15 minutes or less').props.onValueChange(true);
  previousMaximum.props.onValueChange(false);
  assert.equal(h.find('Checkbox', '30 minutes or less').props.value, false);
  h.find('Button', 'Apply filters').props.onPress(); assert.equal(h.value().maxMinutes, 15);
  let selected = 'all';
  let result = nodes(h.ui.LibraryViewSelector({ value: selected, onChange: (value: string) => { selected = value; }, recommendedCount: 3, allLabel: 'All presets' }));
  result.find(node => node.props?.label === 'Recommended for you (3)')!.props.onPress();
  assert.equal(selected, 'recommended');
  result = nodes(h.ui.LibraryViewSelector({ value: selected, onChange: (value: string) => { selected = value; }, recommendedCount: 3, allLabel: 'All presets' }));
  assert.equal(result.find(node => node.props?.label === 'Recommended for you (3) · selected')?.props.variant, 'filled');
  result.find(node => node.props?.label === 'All presets')!.props.onPress(); assert.equal(selected, 'all');
});

test('actual Strength tab labels have a noncollapsing native height, accessible names and working actions', () => {
  const source = readFileSync('app/(tabs)/strength/index.tsx', 'utf8');
  const ast = ts.createSourceFile('strength.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const fn = ast.statements.find((node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node) && node.name?.text === 'SegmentedControl');
  const styleStatement = ast.statements.find(node => ts.isVariableStatement(node) && node.declarationList.declarations.some(declaration => declaration.name.getText(ast) === 'segStyles'));
  assert.ok(fn); assert.ok(styleStatement);
  const jsx = (type: string, props: any) => ({ type, props }); const module = { exports: {} as any };
  vm.runInNewContext(ts.transpileModule(`${fn.getText(ast)}\n${styleStatement.getText(ast)}\nexports.render = SegmentedControl;`, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText, { module, exports: module.exports, FeatureTourTarget: 'Target', TouchableOpacity: 'Button', Text: 'Text',
    StyleSheet: { create: (styles: unknown) => styles }, require: () => ({ jsx, jsxs: jsx }) });
  const chosen: string[] = [];
  const result = nodes(module.exports.render({ segment: 'strength', setSegment: (value: string) => chosen.push(value), C: {} }));
  for (const label of ['Strength', 'Presets', 'Mobility']) {
    assert.ok(result.some(node => node.type === 'Text' && node.props.children === label));
    const button = result.find(node => node.type === 'Button' && node.props.accessibilityLabel === label)!;
    assert.equal(button.props.accessibilityRole, 'tab');
    const styles = Object.assign({}, ...button.props.style.filter(Boolean));
    assert.ok(styles.minHeight >= 44); assert.equal(styles.flex, undefined);
  }
  result.find(node => node.props.accessibilityLabel === 'Presets')!.props.onPress();
  assert.deepEqual(chosen, ['presets']);
});

test('Running, Coach and Calendar retain visible tab names and intrinsic minimum height', () => {
  for (const [path, styleName, labels] of [
    ['app/(tabs)/training/index.tsx', 'subTab', ['Plan', 'Active', 'Hydration', 'Routes']],
    ['app/(tabs)/coach/index.tsx', 'segmentBtn', ['Ask Coach', 'Insights', 'Video']],
    ['app/(tabs)/calendar/index.tsx', 'segment', ['Month', 'Week', 'Day']],
  ] as const) {
    const source = readFileSync(path, 'utf8');
    const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    let found: ts.ObjectLiteralExpression | undefined;
    const visit = (node: ts.Node) => {
      if (ts.isPropertyAssignment(node) && node.name.getText(ast) === styleName && ts.isObjectLiteralExpression(node.initializer)) found = node.initializer;
      ts.forEachChild(node, visit);
    };
    visit(ast); assert.ok(found);
    const minimum = found.properties.find((node): node is ts.PropertyAssignment => ts.isPropertyAssignment(node) && node.name.getText(ast) === 'minHeight');
    assert.equal(minimum?.initializer.getText(ast), '44', path);
    assert.equal(found.properties.some(node => ts.isPropertyAssignment(node) && node.name.getText(ast) === 'height'), false);
    for (const label of labels) assert.ok(source.includes(label), `${path}: ${label}`);
  }
});


test('actual preset and mobility banks supply filterable known muscles while preserving inclusive duration', () => {
  const presets = STRENGTH_PRESET_WORKOUTS.map(presetLibraryItem);
  const mobility = MOBILITY_WORKOUTS.map(workout => mobilityLibraryItem(workout, MOBILITY_EXERCISES));
  for (const item of [...presets, ...mobility]) {
    assert.ok(item.muscles.length > 0, `Missing known muscle/area tags: ${item.id}`);
    const filters = { ...emptyWorkoutLibraryFilters(), maxMinutes: item.durationMin };
    assert.equal(matchesWorkoutLibraryFilters(item, filters), true, item.id);
    assert.equal(matchesWorkoutLibraryFilters(item, { ...filters, maxMinutes: item.durationMin - 1 }), false, item.id);
  }
  assert.ok(presets.some(item => item.muscles.includes('hamstrings') && item.equipment.includes('barbell')));
});
