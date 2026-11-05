import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import * as hydrationConfig from '../../src/constants/hydrationConfig';
import * as autoPause from '../../src/utils/autoPause';
import * as autoPauseSettings from '../../src/utils/autoPauseSettings';

type Element = { type: string; props: Record<string, any>; children: any[] };
const transpile = (source: string, jsx = false) => ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
  ...(jsx ? { jsx: ts.JsxEmit.React, jsxFactory: 'h' } : {}),
} }).outputText;
const turn = () => new Promise<void>(resolve => setImmediate(resolve));
function deferred() {
  let resolve!: () => void, reject!: (error: Error) => void;
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

/** Actual production settings store + real persistence middleware. Only native
 * storage is replaced, with deterministic read/write gates and synthetic data. */
function settingsHarness(saved?: Record<string, unknown>, options: { raw?: Map<string, string>; readGate?: Promise<void> } = {}) {
  const raw = options.raw ?? new Map<string, string>();
  if (saved) raw.set('settings-store', JSON.stringify({ version: 0, state: saved }));
  let writeGate: Promise<void> | null = null, writes = 0;
  const storage = createJSONStorage(() => ({
    getItem: async (key: string) => { await options.readGate; return raw.get(key) ?? null; },
    setItem: async (key: string, value: string) => { writes++; if (writeGate) await writeGate; raw.set(key, value); },
    removeItem: async (key: string) => { raw.delete(key); },
  }));
  const mocks: Record<string, unknown> = {
    zustand: { create }, 'zustand/middleware': { persist },
    './persistStorage': { createAppJSONStorage: () => storage },
    '../constants/hydrationConfig': hydrationConfig, '../utils/autoPauseSettings': autoPauseSettings,
  };
  const module = { exports: {} as any };
  runInNewContext(transpile(readFileSync('src/store/settingsStore.ts', 'utf8')), {
    module, exports: module.exports, require: (path: string) => {
      assert.ok(Object.hasOwn(mocks, path), `Unmocked settings import: ${path}`); return mocks[path];
    },
  });
  const store = module.exports.useSettingsStore;
  return { store, raw, writes: () => writes, gateWrites: (gate: Promise<void> | null) => { writeGate = gate; },
    ready: async () => {
      if (!store.persist.hasHydrated()) await new Promise<void>(resolve => {
        const unsubscribe = store.persist.onFinishHydration(() => { unsubscribe(); resolve(); });
      });
    } };
}

/** Execute the actual native control and its callback, mocking React rendering
 * rather than duplicating the setting-write or pending/error implementation. */
function control(store: any, paused = false) {
  let cursor = 0, tree: Element, updates = 0;
  const slots: any[] = [];
  const useSettingsStore = Object.assign((selector: (state: any) => unknown) => selector(store.getState()), {
    getState: store.getState, persist: store.persist,
  });
  const mocks: Record<string, any> = {
    react: {
      useState(initial: any) {
        const index = cursor++;
        if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
        return [slots[index], (next: any) => { updates++; slots[index] = typeof next === 'function' ? next(slots[index]) : next; }];
      },
      useRef(initial: any) { const index = cursor++; return slots[index] ??= { current: initial }; },
      useEffect(effect: () => (() => void) | undefined, deps?: unknown[]) {
        const index = cursor++;
        if (!slots[index] || !deps || deps.some((value, i) => value !== slots[index].deps?.[i])) {
          slots[index]?.cleanup?.(); slots[index] = { deps, cleanup: effect() };
        }
      },
    },
    'react-native': { Text: 'Text', View: 'View' }, '@expo/ui': { Host: 'Host', Switch: 'Switch' },
    '../../store/settingsStore': { useSettingsStore }, '../../store/themeStore': { useThemeMode: () => 'dark' },
    '../../theme/useColors': { useColors: () => ({ primary: '#abceff', textMuted: '#cccccc', critical: '#ff0000' }) },
    '../../utils/autoPause': autoPause, '../../utils/autoPauseSettings': autoPauseSettings,
  };
  const module = { exports: {} as any };
  runInNewContext(transpile(readFileSync('src/components/running/RunningAutoPauseControl.tsx', 'utf8'), true), {
    module, exports: module.exports, require: (path: string) => {
      assert.ok(Object.hasOwn(mocks, path), `Unmocked control import: ${path}`); return mocks[path];
    },
    h: (type: string, props: Record<string, any> | null, ...children: any[]) => ({ type, props: props ?? {}, children: children.flat(Infinity) }),
  });
  function render() { cursor = 0; tree = module.exports.default({ paused }); }
  function nodes() {
    const all: Element[] = [];
    const visit = (node: any) => { if (node && typeof node === 'object' && node.children) { all.push(node); node.children.forEach(visit); } };
    visit(tree); return all;
  }
  const text = (node: Element): string => node.children.map(child => typeof child === 'string' ? child : child?.children ? text(child) : '').join('');
  const toggle = () => {
    const result = nodes().find(node => node.type === 'Switch'); assert.ok(result); return result;
  };
  render();
  return { render, nodes, toggle, text: () => nodes().filter(node => node.type === 'Text').map(text).join(' '),
    change: (value: boolean) => { toggle().props.onValueChange(value); render(); },
    updates: () => updates, unmount: () => { for (const slot of slots) slot?.cleanup?.(); } };
}

test('explicit Off and each other saved mode survive actual settings cold hydration and repeat relaunch', async () => {
  for (const mode of ['off', 'running_only', 'cycling_only', 'running_and_cycling'] as const) {
    const h = settingsHarness({ autoPauseMode: mode, announceAutoPause: false, announceAutoResume: false });
    await h.ready(); assert.equal(h.store.getState().autoPauseMode, mode);
    await h.store.getState().setUnits('metric');
    for (let launch = 0; launch < 3; launch++) {
      const next = settingsHarness(undefined, { raw: h.raw }); await next.ready();
      assert.equal(next.store.getState().autoPauseMode, mode);
      assert.equal(next.store.getState().announceAutoPause, false);
      assert.equal(next.store.getState().announceAutoResume, false);
    }
  }
});

test('missing or invalid saved modes use the actual cold-start default without coercing explicit Off', async () => {
  for (const autoPauseMode of [undefined, null, '', 'unknown', false, 0, {}, []]) {
    const h = settingsHarness({ autoPauseMode }); await h.ready();
    assert.equal(h.store.getState().autoPauseMode, 'running_and_cycling');
  }
  assert.equal(autoPauseSettings.restoredAutoPauseMode('off', 'running_and_cycling'), 'off');
  assert.equal(autoPauseSettings.restoredAutoPauseMode(undefined, 'cycling_only'), 'cycling_only');
});

test('sport-specific switches handle every mode and preserve the other sport setting', () => {
  const modes = ['off', 'running_only', 'cycling_only', 'running_and_cycling'] as const;
  const expected = {
    running: { off: ['off', 'running_only'], running_only: ['off', 'running_only'], cycling_only: ['cycling_only', 'running_and_cycling'], running_and_cycling: ['cycling_only', 'running_and_cycling'] },
    cycling: { off: ['off', 'cycling_only'], running_only: ['running_only', 'running_and_cycling'], cycling_only: ['off', 'cycling_only'], running_and_cycling: ['running_only', 'running_and_cycling'] },
  } as const;
  for (const sport of ['running', 'cycling'] as const) for (const mode of modes) for (const enabled of [false, true]) {
    const result = autoPauseSettings.setActivityAutoPauseEnabled(mode, sport, enabled);
    assert.equal(result, expected[sport][mode][enabled ? 1 : 0], `${sport} ${mode} ${enabled}`);
    assert.equal(autoPause.isAutoPauseEnabled(result, sport), enabled);
    const other = sport === 'running' ? 'cycling' : 'running';
    assert.equal(autoPause.isAutoPauseEnabled(result, other), autoPause.isAutoPauseEnabled(mode, other));
  }
});

function stoppedDecision(mode: autoPause.AutoPauseMode) {
  let state = autoPause.initialAutoPauseState('running', mode);
  const actions: string[] = [];
  for (const atMs of [0, 1_000, 2_001, 3_001]) {
    const next = autoPause.reduceAutoPause(state, { atMs, speedMps: 0, displacementMeters: 0, horizontalAccuracyMeters: 4 });
    actions.push(next.action); state = next.state;
  }
  return actions;
}

test('voice-off remains only an announcement preference; the actual run switch changes detector behavior', async () => {
  const h = settingsHarness({ autoPauseMode: 'running_and_cycling', announceAutoPause: true }); await h.ready();
  await h.store.getState().setAnnounceAutoPause(false);
  assert.equal(h.store.getState().autoPauseMode, 'running_and_cycling');
  assert.ok(stoppedDecision(h.store.getState().autoPauseMode).includes('auto_pause'));
  const ui = control(h.store);
  assert.equal(ui.toggle().props.label, 'Auto-pause runs');
  ui.change(false); await turn(); ui.render();
  assert.equal(h.store.getState().autoPauseMode, 'cycling_only');
  assert.equal(h.store.getState().announceAutoPause, false);
  assert.ok(!stoppedDecision(h.store.getState().autoPauseMode).includes('auto_pause'));
  assert.equal(JSON.parse(h.raw.get('settings-store')!).state.autoPauseMode, 'cycling_only');
});

test('actual control uses current mode at action time rather than a stale rendered cycling bit', async () => {
  const h = settingsHarness({ autoPauseMode: 'off' }); await h.ready();
  const ui = control(h.store);
  await h.store.getState().setAutoPauseMode('cycling_only');
  ui.change(true); await turn(); ui.render();
  assert.equal(h.store.getState().autoPauseMode, 'running_and_cycling');
});

test('actual switch disables while persistence is pending and ignores a duplicate native callback', async () => {
  const h = settingsHarness({ autoPauseMode: 'running_and_cycling' }); await h.ready();
  const gate = deferred(); h.gateWrites(gate.promise);
  const ui = control(h.store);
  ui.change(false);
  assert.equal(ui.toggle().props.disabled, true);
  ui.change(true);
  assert.equal(h.writes(), 1);
  assert.equal(h.store.getState().autoPauseMode, 'cycling_only');
  assert.equal(JSON.parse(h.raw.get('settings-store')!).state.autoPauseMode, 'running_and_cycling');
  gate.resolve(); await turn(); ui.render();
  assert.equal(ui.toggle().props.disabled, false);
  assert.equal(ui.toggle().props.value, false);
  assert.equal(JSON.parse(h.raw.get('settings-store')!).state.autoPauseMode, 'cycling_only');
});

test('a rejected write exposes an alert and permits retry without pretending Off survived restart', async () => {
  const h = settingsHarness({ autoPauseMode: 'running_only' }); await h.ready();
  const gate = deferred(); h.gateWrites(gate.promise);
  const ui = control(h.store);
  ui.change(false); gate.reject(new Error('Synthetic storage failure')); await turn(); ui.render();
  assert.ok(ui.nodes().some(node => node.props.accessibilityRole === 'alert'));
  assert.match(ui.text(), /could not be saved/);
  assert.equal(ui.toggle().props.disabled, false);
  const relaunched = settingsHarness(undefined, { raw: h.raw }); await relaunched.ready();
  assert.equal(relaunched.store.getState().autoPauseMode, 'running_only');
  h.gateWrites(null); ui.change(false); await turn(); ui.render();
  assert.ok(!ui.nodes().some(node => node.props.accessibilityRole === 'alert'));
  assert.equal(JSON.parse(h.raw.get('settings-store')!).state.autoPauseMode, 'off');
});

test('before settings hydrate, the actual disabled control rejects even a stale native callback without overwriting cycling', async () => {
  const read = deferred();
  const h = settingsHarness({ autoPauseMode: 'cycling_only' }, { readGate: read.promise });
  const ui = control(h.store);
  assert.equal(ui.toggle().props.disabled, true);
  ui.change(false); await turn();
  assert.equal(h.writes(), 0);
  read.resolve(); await h.ready(); ui.render();
  assert.equal(h.store.getState().autoPauseMode, 'cycling_only');
  assert.equal(ui.toggle().props.disabled, false);
  assert.equal(ui.toggle().props.value, false);
});

test('paused control explains manual resume; unmounted pending controls emit no late state feedback', async () => {
  const h = settingsHarness({ autoPauseMode: 'running_only' }); await h.ready();
  const ui = control(h.store, true);
  assert.match(ui.text(), /paused.*Resume Run/);
  const gate = deferred(); h.gateWrites(gate.promise);
  ui.change(false); ui.unmount(); const before = ui.updates();
  gate.reject(new Error('Synthetic storage failure')); await turn();
  assert.equal(ui.updates(), before);
});
