import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import * as calculators from '../../src/utils/strengthCalculators';
import { strengthGuidance } from '../../src/utils/strengthGuidance';

type Element = { type: any; props: Record<string, any> };
function elements(tree: any): Element[] {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(elements);
  return [tree, ...elements(tree.props?.children)];
}
function text(tree: any): string {
  if (typeof tree === 'string' || typeof tree === 'number') return String(tree);
  if (Array.isArray(tree)) return tree.map(text).join(' ');
  return tree?.props ? text(tree.props.children) : '';
}
function load(filename: string, extra: Record<string, unknown> = {}) {
  let cursor = 0;
  const slots: any[] = [];
  const jsx = (type: any, props: any) => ({ type, props });
  const react = { useState: (initial: any) => {
    const index = cursor++; if (!(index in slots)) slots[index] = initial;
    return [slots[index], (next: any) => { slots[index] = typeof next === 'function' ? next(slots[index]) : next; }];
  }, useMemo: (fn: () => any) => fn(), useEffect: () => undefined };
  const mocks: Record<string, unknown> = {
    react, 'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': { Text: 'Text', View: 'View', ScrollView: 'ScrollView', TouchableOpacity: 'TouchableOpacity',
      Keyboard: { dismiss() {} }, useWindowDimensions: () => ({ width: 320, fontScale: 1.5 }) },
    '@expo/ui': { Host: 'Host', Collapsible: 'Collapsible', Button: 'Button', Picker: 'Picker', TextInput: 'TextInput' },
    'expo-router': { Stack: { Screen: 'Screen' }, Link: 'Link' },
    '../../store/themeStore': { useThemeMode: () => 'dark' }, '../../theme/useColors': { useColors: () => ({}) },
    '../../../src/store/themeStore': { useThemeMode: () => 'dark' }, '../../../src/theme/useColors': { useColors: () => ({}) },
    '../../../src/store/settingsStore': { useSettingsStore: (select: any) => select({ units: 'imperial' }) },
    '../../../src/constants/layout': { LAYOUT: { screenPadBottom: 120 } },
    '../../../src/utils/strengthCalculators': calculators, ...extra,
  };
  const code = ts.transpileModule(readFileSync(filename, 'utf8'), { fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(code, { module, exports: module.exports, Error, process: { env: { EXPO_OS: 'web' } }, require: (name: string) => {
    assert.ok(name in mocks, `unmocked ${name}`); return mocks[name];
  } });
  return (props?: any) => { cursor = 0; return (module.exports as any).default(props); };
}

test('five guidance sections start collapsed and toggle independently while containing long paragraphs', () => {
  const render = load('src/components/strength/exercise-guidance.tsx');
  const content = { how: 'How body', cues: 'Cue body', feel: 'Feel body', stop: 'Stop body', easier: 'Easy body' };
  const headers = () => elements(render({ content })).filter(item => item.type === 'Collapsible');
  assert.equal(headers().length, 5); assert.ok(headers().every(item => item.props.isOpen === false));
  assert.equal(text(render({ content })).trim(), '');
  headers()[0]!.props.onOpenChange(true);
  assert.match(text(render({ content })), /How body/); assert.doesNotMatch(text(render({ content })), /Cue body|Stop body/);
  headers()[3]!.props.onOpenChange(true); headers()[0]!.props.onOpenChange(false);
  assert.doesNotMatch(text(render({ content })), /How body/); assert.match(text(render({ content })), /Stop body/);
  const long = { ...content, stop: 'A long paragraph '.repeat(80) };
  const tree = render({ content: long }), paragraph = elements(tree).find(item => item.type === 'Text');
  assert.equal(paragraph!.props.style.width, '100%'); assert.equal(paragraph!.props.style.flexShrink, 1);
  assert.ok(elements(tree).filter(item => item.type === 'Host').every(item => item.props.style.minHeight >= 44));
});

test('shared guidance retains canonical setup, coaching details and recognized custom metadata', () => {
  const squat = strengthGuidance({ id: 'squat_goblet', name: 'Goblet Squat' }, 'Prescribed cue');
  assert.match(squat.how, /Start:.*Stand feet/); assert.match(squat.how, /Finish:/);
  assert.match(squat.cues, /Prescribed cue/); assert.match(squat.cues, /Avoid:/);
  const row = strengthGuidance({ name: 'Barbell Row', equipment: ['barbell'] });
  assert.ok(row.how.length > 20 && row.easier.length > 10);
  assert.match(row.stop, /pain|loss of control/);
  assert.equal(strengthGuidance({ name: 'Unlisted custom movement' }, 'My cue', 'My recorded instructions').how, 'My recorded instructions');
});

test('calculator interaction keeps default numeric results while removing method controls and calculation details', () => {
  const render = load('app/(tabs)/settings/strength-calculators.tsx');
  const choice = (label: string) => elements(render()).find(item => item.props.label === label)!;
  const field = (label: string) => elements(render()).find(item => item.type?.name === 'NumberField' && item.props.label.startsWith(label))!;
  const calculate = () => elements(render()).find(item => item.type === 'Button' && item.props.label === 'Calculate')!.props.onPress();
  field('Working weight').props.onChange('100'); field('Repetitions completed').props.onChange('5'); calculate();
  assert.match(text(render()), /115.5/);
  assert.doesNotMatch(text(render()), /Epley|equation average|Sheet average|Calculation details|Changing units clears/);
  assert.equal(choice('Result method'), undefined);
  choice('Calculator').props.onChange('rep_max'); field('Known or estimated').props.onChange('200');
  field('Target repetitions').props.onChange('5'); calculate(); assert.match(text(render()), /173.2/);
  choice('Calculator').props.onChange('repetitions'); field('Working weight').props.onChange('150'); calculate();
  assert.match(text(render()), /9.9\s+reps/);
  choice('Calculator').props.onChange('percentages'); calculate();
  for (const percent of [50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100]) assert.match(text(render()), new RegExp(`${percent}\\s*%`));
  assert.match(text(render()), /30–70%/); assert.match(text(render()), /ranges overlap/);
  choice('Weight unit').props.onChange('kg');
  assert.equal(field('Known or estimated').props.value, ''); assert.doesNotMatch(text(render()), /173.2|9.9\s+reps/);
  calculate(); assert.match(text(render()), /Enter a positive/);
});

test('strength calculator link pushes a separate route without mutating or ending the workout', () => {
  const render = load('src/components/strength/strength-calculator-link.tsx');
  const tree = render(); assert.equal(tree.type, 'Link');
  assert.equal(tree.props.href, '/(tabs)/strength/calculators'); assert.equal(tree.props.push, true);
  assert.match(text(tree), /Strength calculators/);
  assert.equal(tree.props.children.props.accessibilityLabel, 'Open strength calculators');
});
