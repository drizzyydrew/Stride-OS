import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as definitions from '../../src/utils/featureTours';

function harness() {
  let focused = false; let hydrated = true; let replay: number | undefined = 1;
  let dirty = false; let cursor = 0;
  const slots: any[] = []; const effects: (() => void)[] = [];
  const timers = new Map<number, () => void>(); let timerId = 0;
  const starts: string[] = []; const hydratedListeners = new Set<() => void>();
  const context = { startTour: (_id: string, source: string) => { starts.push(source); }, registerTarget: () => () => {} };
  const consumeReplay = () => { replay = undefined; dirty = true; };
  const store: any = (selector: any) => selector({ tourStatus: { today: { completed: true, lastSeenVersion: 1 } }, replayRequests: { today: replay }, consumeReplay });
  store.persist = { hasHydrated: () => hydrated, onFinishHydration: (fn: () => void) => { hydratedListeners.add(fn); return () => hydratedListeners.delete(fn); } };
  const react = {
    createContext: () => ({}), useContext: () => context,
    useRef: (value: any) => { const i = cursor++; return slots[i] ??= { current: value }; },
    useState: (initial: any) => { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial;
      return [slots[i], (value: any) => { if (slots[i] !== value) { slots[i] = value; dirty = true; } }]; },
    useEffect: (fn: () => any, deps: any[]) => { const i = cursor++; const old = slots[i];
      if (!old || deps.some((dep, n) => dep !== old.deps[n])) effects.push(() => { old?.cleanup?.(); slots[i] = { deps, cleanup: fn() }; }); },
  };
  const exports: any = {};
  const code = ts.transpileModule(fs.readFileSync('src/components/featureTour/FeatureTourProvider.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(code, { exports, setTimeout: (fn: () => void) => { timers.set(++timerId, fn); return timerId; }, clearTimeout: (id: number) => timers.delete(id),
    require: (name: string) => {
      if (name === 'react') return react;
      if (name === 'react-native') return { StyleSheet: { create: (s: any) => s } };
      if (name === 'expo-router/react-navigation') return { useIsFocused: () => focused };
      if (name.endsWith('/featureTourStore')) return { useFeatureTourStore: store };
      if (name.endsWith('/featureTours')) return definitions;
      return {};
    },
  });
  const render = () => { for (let n = 0; n < 10; n++) { dirty = false; cursor = 0; exports.useFeatureTour('today'); while (effects.length) effects.shift()!(); if (!dirty) return; } throw new Error('Render loop'); };
  return { render, starts, setFocused: (value: boolean) => { focused = value; }, setHydrated: (value: boolean) => { hydrated = value; if (value) hydratedListeners.forEach(fn => fn()); },
    pending: () => replay, replay: () => { replay = (replay ?? 0) + 1; }, timers: () => timers.size,
    fire: () => { const pending = [...timers.values()]; timers.clear(); pending.forEach(fn => fn()); render(); } };
}
test('replay survives navigation and is consumed only after the focused walkthrough starts', () => {
  const h = harness(); h.render(); assert.equal(h.timers(), 0); assert.equal(h.pending(), 1);
  h.setFocused(true); h.render(); assert.equal(h.pending(), 1); assert.equal(h.timers(), 1);
  h.fire(); assert.deepEqual(h.starts, ['replay']); assert.equal(h.pending(), undefined);
  h.replay(); h.render(); h.fire(); assert.deepEqual(h.starts, ['replay', 'replay']);
});
test('replay waits for hydration and a background screen cannot consume it', () => {
  const h = harness(); h.setHydrated(false); h.setFocused(true); h.render(); assert.equal(h.timers(), 0);
  h.setHydrated(true); h.render(); assert.equal(h.timers(), 1);
  h.setFocused(false); h.render(); assert.equal(h.timers(), 0); assert.equal(h.pending(), 1);
  h.setFocused(true); h.render(); h.fire(); assert.deepEqual(h.starts, ['replay']);
});
