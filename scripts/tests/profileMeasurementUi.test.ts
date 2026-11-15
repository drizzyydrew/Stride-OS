import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import * as measurements from '../../src/utils/profileMeasurements';
import * as dates from '../../src/utils/dateOnly';

type Element = { type: unknown; props: Record<string, any> };
function elements(node: any): Element[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  return node && typeof node === 'object' ? [node, ...elements(node.props?.children)] : [];
}
function content(node: any): string {
  if (Array.isArray(node)) return node.map(content).join('');
  return node && typeof node === 'object' ? content(node.props?.children) : node == null ? '' : String(node);
}
function harness(options: { error?: boolean } = {}) {
  const source = ts.createSourceFile('fields.tsx', readFileSync('src/components/profile/profile-measurement-fields.tsx', 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const fn = source.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'ProfileMeasurementFields')!;
  const hooks: any[] = []; let cursor = 0; let tree: any;
  const calls: any[] = []; const saves: any[] = [];
  let fail = options.error;
  const context: any = { ...measurements, ...dates,
    React: { createElement: (type: unknown, props: any, ...children: any[]) => ({ type, props: { ...props, children } }) },
    useState: (initial: any) => {
      const i = cursor++; if (!(i in hooks)) hooks[i] = typeof initial === 'function' ? initial() : initial;
      return [hooks[i], (next: any) => { hooks[i] = typeof next === 'function' ? next(hooks[i]) : next; }];
    },
    useRef: (initial: any) => { const i = cursor++; return hooks[i] ?? (hooks[i] = { current: initial }); }, useEffect: () => {},
    useColors: () => ({ text: '#fff', textMuted: '#aaa', primary: '#06f', card: '#111' }), useThemeMode: () => 'dark',
    labels: { dateOfBirth: 'Date of birth', heightCm: 'Height', weightKg: 'Weight' }, s: {},
    range: (length: number) => Array.from({ length }, (_, i) => i), Platform: { OS: 'ios' },
  };
  for (const name of ['View', 'Text', 'TextInput', 'Pressable', 'ScrollView', 'Host', 'BottomSheet', 'RNHostView', 'DateTimePicker', 'Wheel']) context[name] = name;
  const compiled = ts.transpileModule(`${fn.getText(source).replace('export default ', '')}\nglobalThis.Fields = ProfileMeasurementFields;`, { compilerOptions: { target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React } }).outputText;
  vm.runInNewContext(compiled, context);
  const props = { values: { age: 40, dateOfBirth: undefined, heightCm: 177.8, weightKg: 81.6466266 }, units: 'imperial',
    createSave: () => { calls.push('open'); return async (draft: any) => { saves.push({ ...draft }); return fail
      ? { status: 'storage-failed', message: 'Keep the draft and retry' } : { status: draft.changed ? 'saved' : 'unchanged', message: '' }; }; } };
  const render = () => { cursor = 0; tree = context.Fields(props); return tree; };
  const press = (label: string) => { const node = elements(tree).find(node => node.type === 'Pressable' && (node.props.accessibilityLabel === label || content(node) === label)); assert.ok(node, label); node.props.onPress(); render(); };
  render();
  return { render, props, calls, saves, press, nodes: () => elements(tree), allowSave: () => { fail = false; },
    settle: async () => { await new Promise(resolve => setImmediate(resolve)); render(); } };
}

test('actual measurement JSX open/cancel/unit switch leaves precise canonical values and provenance untouched', async () => {
  const h = harness(); const original = { ...h.props.values };
  h.press('Edit weight'); assert.deepEqual(h.saves, []);
  h.press('Metric'); h.press('Imperial'); assert.deepEqual(h.saves, []);
  h.press('Cancel'); assert.deepEqual(h.saves, []);
  h.press('Edit weight'); h.press('Metric'); h.press('Save'); await h.settle();
  assert.equal(h.saves.length, 1); assert.equal(h.saves[0].changed, false);
  assert.equal(h.saves[0].value, original.weightKg); assert.deepEqual(h.props.values, original);
});

test('actual wheel event stores precise selection and failed Save keeps that draft for retry', async () => {
  const h = harness({ error: true }); h.press('Edit weight');
  const ones = h.nodes().find(node => node.type === 'Wheel' && node.props.label === 'Ones')!;
  ones.props.onChange(1); h.render(); h.press('Save'); await h.settle();
  assert.equal(h.saves[0].changed, true);
  assert.ok(Math.abs(h.saves[0].value - measurements.weightFromDigits([1, 8, 1], true)) < 1e-10);
  assert.equal(h.nodes().some(node => node.type === 'Text' && content(node) === 'Keep the draft and retry'), true);
  assert.equal(h.nodes().find(node => node.type === 'BottomSheet')?.props.isPresented, true);
  h.allowSave(); h.press('Save'); await h.settle();
  assert.equal(h.saves[1].value, h.saves[0].value);
  assert.equal(h.nodes().find(node => node.type === 'BottomSheet')?.props.isPresented, false);
});

test('Apple calendar starts as an unconfirmed cursor and requires actual selection before saving DOB', async () => {
  const h = harness(); h.press('Edit date of birth');
  assert.equal(h.nodes().find(node => node.type === 'Pressable' && content(node) === 'Save')?.props.disabled, true);
  const calendar = h.nodes().find(node => node.type === 'DateTimePicker')!;
  assert.equal(calendar.props.display, 'inline'); assert.equal(calendar.props.mode, 'date');
  calendar.props.onValueChange({}, new Date(1990, 1, 28, 12)); h.render();
  h.press('Save'); await h.settle();
  assert.equal(h.saves[0].value, '1990-02-28'); assert.equal(h.saves[0].changed, true);
});
