import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement, type ReactElement, type ReactNode } from 'react';
import * as jsxRuntime from 'react/jsx-runtime';

// Render the actual Training Outlook JSX with synthetic view state. This keeps
// the production eligibility condition and real disclosure handler under test.
const source = readFileSync('app/(tabs)/dashboard/index.tsx', 'utf8');
const ast = ts.createSourceFile('dashboard.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let outlook: ts.JsxElement | undefined;
function visit(node: ts.Node) {
  if (ts.isJsxElement(node) && node.openingElement.tagName.getText(ast) === 'FeatureTourTarget'
    && node.openingElement.attributes.properties.some(attr => ts.isJsxAttribute(attr)
      && attr.name.getText(ast) === 'targetId' && attr.initializer?.getText(ast) === '"today.outlook"')) outlook = node;
  ts.forEachChild(node, visit);
}
visit(ast); assert.ok(outlook, 'actual Training Outlook section exists');
const compiled = ts.transpileModule(`module.exports = function render(context) {
  const { C, styles, showBalancedDetails, showDataRichDetails, outlookOpen, outlookRationaleOpen, outlookHistoryOpen,
    setOutlookOpen, setOutlookRationaleOpen, setOutlookHistoryOpen, trainingOutlook, FeatureTourTarget, View, Text, TouchableOpacity } = context;
  return (${outlook.getText(ast)});
}`, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const moduleBox = { exports: {} as (context: any) => ReactElement };
runInNewContext(compiled, { module: moduleBox, exports: moduleBox.exports, require: () => jsxRuntime });
function fixture(balanced: boolean, rich: boolean) {
  let open = false, rationale = false, history = false;
  const context = () => ({ C: {}, styles: {}, showBalancedDetails: balanced, showDataRichDetails: rich,
    outlookOpen: open, outlookRationaleOpen: rationale, outlookHistoryOpen: history,
    setOutlookOpen: (fn: (value: boolean) => boolean) => { open = fn(open); },
    setOutlookRationaleOpen: (fn: (value: boolean) => boolean) => { rationale = fn(rationale); },
    setOutlookHistoryOpen: (fn: (value: boolean) => boolean) => { history = fn(history); },
    trainingOutlook: { statusLabel: 'Ready to train', recommendation: 'Keep today easy.', focus: 'Aerobic foundation', message: 'Recover between hard days.',
      historyWeeks: 4, completedActivities: 12, confidence: 'moderate' },
    FeatureTourTarget: ({ children }: { children: ReactNode }) => createElement('section', {}, children),
    View: ({ children }: { children: ReactNode }) => createElement('div', {}, children),
    Text: ({ children }: { children: ReactNode }) => createElement('span', {}, children),
    TouchableOpacity: ({ children }: { children: ReactNode }) => createElement('button', {}, children),
  });
  const tree = () => moduleBox.exports(context());
  const html = () => renderToStaticMarkup(tree());
  function click(label: string) {
    let handler: (() => void) | undefined;
    function scan(node: any) {
      if (!node || typeof node !== 'object') return;
      const children = node.props?.children;
      const text = (value: any): string => Array.isArray(value) ? value.map(text).join('') : typeof value === 'string' ? value : text(value?.props?.children ?? '');
      if (node.props?.onPress && text(children).includes(label)) handler = node.props.onPress;
      (Array.isArray(children) ? children : [children]).forEach(scan);
    }
    scan(tree()); assert.ok(handler, `actual ${label} control exists`); handler();
  }
  return { html, click };
}

test('guided Training Outlook retains its guidance without an empty Training Details action', () => {
  const h = fixture(false, false);
  assert.match(h.html(), /Ready to train/); assert.match(h.html(), /Keep today easy/);
  assert.doesNotMatch(h.html(), /Training Details|<button|History and Confidence|Training Focus/);
});
test('balanced Training Details keeps its real handler and reveals meaningful training guidance', () => {
  const h = fixture(true, false);
  assert.match(h.html(), /Training Details/); assert.doesNotMatch(h.html(), /Training Focus/);
  h.click('Training Details');
  assert.match(h.html(), /Training Focus/); assert.match(h.html(), /Aerobic foundation/); assert.match(h.html(), /Recommended Action/);
  h.click('Why?'); assert.match(h.html(), /Recover between hard days/);
  h.click('Training Details'); assert.doesNotMatch(h.html(), /Training Focus/);
});
test('data-rich Training Details keeps its history disclosure rather than hiding an eligible control', () => {
  const h = fixture(false, true);
  h.click('Training Details'); assert.match(h.html(), /History and Confidence/);
  h.click('History and Confidence'); assert.match(h.html(), /History 4 weeks/); assert.match(h.html(), /confidence moderate/);
});
