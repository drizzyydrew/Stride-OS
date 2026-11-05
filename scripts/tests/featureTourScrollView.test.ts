import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
import * as definitions from '../../src/utils/featureTours';

test('actual scroll wrapper cancels delayed native measurements after tour dismissal', async () => {
  const exports: any = {};
  const react = { createContext: () => ({ Provider: 'Provider' }), forwardRef: (fn: any) => fn,
    useRef: (value: any) => ({ current: value }), useImperativeHandle() {},
    useCallback: (fn: any) => fn, useMemo: (fn: any) => fn() };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/components/featureTour/FeatureTourScrollView.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText, { exports,
    require: (name: string) => name === 'react' ? react : name === 'react/jsx-runtime'
      ? { jsx: (type: any, props: any) => ({ type, props }) } : name.endsWith('/featureTours') ? definitions : { ScrollView: 'ScrollView' },
  });
  const tree = exports.default({ children: null }, null);
  let viewportCallback: any; let targetCallback: any; let current = true; const scrolls: any[] = [];
  tree.props.children.props.ref.current = {
    getNativeScrollRef: () => ({ measureInWindow: (callback: any) => { viewportCallback = callback; } }),
    scrollTo: (value: any) => scrolls.push(value),
  };
  const pending = tree.props.value.reveal({ measureInWindow: (callback: any) => { targetCallback = callback; } }, () => current);
  current = false;
  viewportCallback(0, 140, 390, 620); targetCallback(18, 1100, 354, 100);
  await pending;
  assert.deepEqual(scrolls, []);
});
