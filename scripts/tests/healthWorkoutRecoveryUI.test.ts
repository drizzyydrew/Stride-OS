import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

const row = { uuid: 'synthetic-health-uuid', activityType: 'running', startTime: 1000, durationSeconds: 5400,
  distanceMeters: 15000, sourceName: 'Watch', sourceBundleIdentifier: 'watch' };
const settle = () => new Promise(resolve => setImmediate(resolve));
type Progress = (phase: string) => void;
function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function harness(targetActivityId?: string) {
  let cursor = 0, tree: any, now = 0, timerId = 0, updates = 0;
  const state: any[] = [], effects: (() => void)[] = [], cleanup: (() => void)[] = [], alerts: any[] = [];
  const timers = new Map<number, { at: number; run: () => void }>();
  const saves: string[] = [], recovered: string[] = [], failures: string[] = [], pending: boolean[] = [], opened: boolean[] = [];
  const sessions: { current: () => boolean; targetActivityId?: string }[] = [];
  let restore: (uuid: string, progress?: Progress, session?: number) => Promise<string> = async () => 'canonical';
  let list: (session: number) => Promise<(typeof row)[]> = async () => [row];
  let routeCurrent = true;
  const mocks: Record<string, any> = {
    react: {
      useRef: (v: any) => { const i = cursor++; return state[i] ??= { current: v }; },
      useState: (v: any) => { const i = cursor++; if (!(i in state)) state[i] = v; return [state[i], (next: any) => { updates++; state[i] = next; }]; },
      useEffect: (fn: () => void) => { const i = cursor++; if (!state[i]) { effects.push(fn); state[i] = true; } },
    },
    'react-native': { StyleSheet: { create: (s: any) => s, hairlineWidth: 1 }, Alert: { alert: (...args: any[]) => alerts.push(args) },
      ...Object.fromEntries(['ActivityIndicator', 'FlatList', 'Text', 'TouchableOpacity', 'View'].map(n => [n, n])) },
    '@expo/vector-icons': { Ionicons: 'Ionicons' },
    healthWorkoutRecovery: { createHealthWorkoutRecovery: (current: () => boolean, targetActivityId?: string) => {
      const index = sessions.push({ current, targetActivityId }) - 1;
      return { listRecent: () => list(index), restoreSelected: (uuid: string, progress?: Progress) => {
        saves.push(uuid); return restore(uuid, progress, index);
      } };
    } },
    useColors: { useColors: () => ({}) }, settingsStore: { useSettingsStore: (select: any) => select({ units: 'metric' }) },
    displayLabels: { displayLabel: (v: string) => v }, activitySummary: { formatDuration: () => '1:30:00' }, units: { formatDistance: () => '15.0 km' },
  };
  const module = { exports: {} as any };
  const source = ts.transpileModule(readFileSync('src/components/activity/HealthWorkoutRecovery.tsx', 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React,
    jsxFactory: 'h', jsxFragmentFactory: 'Fragment', esModuleInterop: true,
  } }).outputText;
  runInNewContext(source, { module, exports: module.exports, Error, Date, Fragment: 'Fragment',
    setTimeout: (run: () => void, ms: number) => { const id = ++timerId; timers.set(id, { at: now + ms, run }); return id; },
    clearTimeout: (id: number) => { timers.delete(id); },
    require: (name: string) => mocks[name] ?? mocks[name.split('/').at(-1)!] ?? { __esModule: true, default: name.split('/').at(-1) },
    h: (type: any, props: any, ...children: any[]) => ({ type, props: props ?? {}, children: children.flat(Infinity) }),
  });
  const props = { targetActivityId, isCurrent: () => routeCurrent, onOpenChange: (open: boolean) => opened.push(open), onSavePending: () => pending.push(true), onFailure: (e: string) => failures.push(e), onRecovered: (id: string) => recovered.push(id) };
  function render() { cursor = 0; tree = module.exports.default(props); effects.splice(0).forEach(fn => { const result = fn(); if (typeof result === 'function') cleanup.push(result); }); return tree; }
  function nodes() { const all: any[] = []; const visit = (n: any) => { if (n && typeof n === 'object') { all.push(n); n.children?.forEach(visit); } }; visit(tree); return all; }
  const button = (label: string) => nodes().find(n => n.props.accessibilityLabel === label);
  return { render, nodes, button, saves, recovered, failures, pending, opened, alerts, sessions,
    open: async () => { render(); nodes().find(n => n.props.accessibilityLabel === (targetActivityId ? 'Refresh splits from Apple Health' : 'Find workout in Apple Health')).props.onPress(); await settle(); render(); },
    choose: () => nodes().find(n => n.type === 'FlatList').props.renderItem({ item: row }).props.onPress(),
    close: () => nodes().find(n => n.type === 'RecoverableModal').props.onRequestClose(),
    confirm: () => alerts.at(-1)[2].find((b: any) => b.text === (targetActivityId ? 'Use Health Distance' : 'Restore')).onPress(),
    cancel: () => alerts.at(-1)[2].find((b: any) => b.text === 'Cancel').onPress(),
    unmount: () => cleanup.forEach(fn => fn()),
    switchRoute: () => { routeCurrent = false; },
    setRestore: (fn: typeof restore) => { restore = fn; },
    setList: (fn: typeof list) => { list = fn; },
    retry: async () => { button('Retry same selection').props.onPress(); await settle(); render(); },
    advance: (ms: number) => {
      now += ms;
      for (const [id, timer] of [...timers]) if (timer.at <= now) { timers.delete(id); timer.run(); }
    },
    timerCount: () => timers.size, updateCount: () => updates,
    text: () => nodes().flatMap(n => n.children.filter((c: any) => typeof c === 'string')).join(' '),
  };
}

test('Health picker requires explicit confirmation and permits cancelling without a save', async () => {
  const ui = harness(); await ui.open(); ui.choose(); ui.choose();
  assert.equal(ui.alerts.length, 1); assert.match(ui.alerts[0][1], /previously removed/);
  assert.equal(ui.saves.length, 0); ui.cancel();
  assert.equal(ui.pending.length, 0); assert.equal(ui.recovered.length, 0);
});

test('first-link picker clearly confirms evidence-only attachment to the existing activity', async () => {
  const ui = harness('existing-gps-row'); await ui.open(); ui.choose();
  assert.equal(ui.sessions[0].targetActivityId, 'existing-gps-row');
  assert.equal(ui.alerts[0][0], 'Use Health distance for this activity?');
  assert.match(ui.alerts[0][1], /No new activity is created/);
  assert.match(ui.alerts[0][1], /totals, notes, route and training links stay unchanged/);
  assert.doesNotMatch(ui.alerts[0][1], /previously removed|unresolved old link/);
  assert.equal(ui.saves.length, 0); ui.cancel();
  assert.equal(ui.saves.length, 0);
  ui.choose(); await ui.confirm();
  assert.equal(ui.saves.length, 1);
  assert.deepEqual(ui.recovered, ['canonical']);
});

test('Health picker waits for durable result and pins failure with same-selection retry without a second alert', async () => {
  const ui = harness(); let finish!: (id: string) => void;
  ui.setRestore(() => new Promise(resolve => { finish = resolve; }));
  await ui.open(); ui.choose(); const saving = ui.confirm(); ui.render();
  assert.equal(ui.pending.length, 1); assert.equal(ui.recovered.length, 0);
  finish('confirmed-canonical'); await saving;
  assert.deepEqual(ui.recovered, ['confirmed-canonical']);
  const failed = harness(); failed.setRestore(async () => { throw new Error('Disk not saved'); });
  await failed.open(); failed.choose(); await failed.confirm(); failed.render();
  assert.match(failed.text(), /Recovery not completed/); assert.match(failed.text(), /Disk not saved/); assert.equal(failed.recovered.length, 0);
  assert.ok(failed.button('Retry same selection')); assert.equal(failed.alerts.length, 1);
  assert.deepEqual(failed.failures, ['Disk not saved']); assert.equal(failed.timerCount(), 0);
  let usedSession: number | undefined;
  failed.setRestore(async (_uuid, _progress, session) => { usedSession = session; return 'retry-canonical'; }); await failed.retry();
  assert.equal(failed.sessions.length, 2); assert.equal(usedSession, 1);
  assert.equal(failed.sessions[0].current(), false); assert.equal(failed.sessions[1].current(), true);
  assert.deepEqual(failed.saves, [row.uuid, row.uuid]); assert.equal(failed.alerts.length, 1);
  assert.deepEqual(failed.recovered, ['retry-canonical']);
});

test('each phase stays visible until durable completion and confirmation is single-flight', async () => {
  const ui = harness(), saved = deferred<string>(); let progress!: Progress;
  ui.setRestore((_uuid, emit) => { progress = emit!; return saved.promise; });
  await ui.open(); ui.choose(); const saving = ui.confirm(); await ui.confirm(); ui.render();
  assert.equal(ui.saves.length, 1); assert.equal(ui.pending.length, 1);
  for (const [phase, label] of Object.entries({ details: 'Reading selected workout', route: 'Reading workout route',
    metrics: 'Reading workout metrics', saving: 'Saving and verifying activity', opening: 'Opening saved activity' })) {
    progress(phase); ui.render(); assert.ok(ui.text().includes(label)); assert.equal(ui.recovered.length, 0);
  }
  saved.resolve('confirmed-canonical'); await saving;
  assert.deepEqual(ui.recovered, ['confirmed-canonical']); assert.equal(ui.timerCount(), 0);
});

test('retry never substitutes another UUID or source from the refreshed list', async () => {
  for (const changed of [{ ...row, uuid: 'different-uuid' }, { ...row, sourceBundleIdentifier: 'different-source' }]) {
    const ui = harness(); ui.setRestore(async () => { throw new Error('Activity history changed. Open recovery again.'); });
    await ui.open(); ui.choose(); await ui.confirm(); ui.render();
    ui.setList(async () => [changed]); await ui.retry();
    assert.equal(ui.saves.length, 1); assert.equal(ui.recovered.length, 0);
    assert.match(ui.text(), /not in the refreshed Health list/); assert.equal(ui.button('Retry same selection'), undefined);
  }
});

test('a failed retry list read preserves the selection for another refresh', async () => {
  const ui = harness(); ui.setRestore(async () => { throw new Error('Session expired'); });
  await ui.open(); ui.choose(); await ui.confirm(); ui.render();
  ui.setList(async () => { throw new Error('Health temporarily unreadable'); }); await ui.retry();
  assert.match(ui.text(), /Health temporarily unreadable/); assert.ok(ui.button('Retry same selection'));
  ui.setList(async () => [row]); ui.setRestore(async () => 'refreshed-canonical'); await ui.retry();
  assert.deepEqual(ui.recovered, ['refreshed-canonical']); assert.deepEqual(ui.saves, [row.uuid, row.uuid]);
});

test('Close during selected-workout read or save reports uncertainty and fences late events', async () => {
  for (const phase of ['details', 'saving']) for (const outcome of ['success', 'failure']) {
    const ui = harness(), saved = deferred<string>(); let progress!: Progress;
    ui.setRestore((_uuid, emit) => { progress = emit!; emit!(phase); return saved.promise; });
    await ui.open(); ui.choose(); const saving = ui.confirm(); ui.render(); ui.close(); ui.render();
    assert.equal(ui.opened.at(-1), false); assert.equal(ui.failures.length, 1);
    assert.match(ui.failures[0], /cancelled/); assert.match(ui.failures[0], /not confirmed saved/);
    assert.match(ui.failures[0], /may still finish/); assert.doesNotMatch(ui.failures[0], /rolled back|nothing was saved/);
    assert.equal(ui.timerCount(), 0);
    const updates = ui.updateCount(); progress('opening');
    if (outcome === 'success') saved.resolve('late-canonical'); else saved.reject(new Error('Late disk error'));
    await saving; ui.advance(30_000);
    assert.equal(ui.updateCount(), updates); assert.equal(ui.recovered.length, 0); assert.equal(ui.failures.length, 1);
    await ui.open(); assert.ok(ui.button('Retry same selection'));
    ui.setRestore(async () => 'confirmed-after-reopen'); await ui.retry();
    assert.deepEqual(ui.recovered, ['confirmed-after-reopen']);
  }
});

test('unmounted and stale-route saves cannot emit progress, failures or navigation', async () => {
  for (const action of ['unmount', 'switchRoute'] as const) for (const outcome of ['success', 'failure']) {
    const ui = harness(), saved = deferred<string>(); let progress!: Progress;
    ui.setRestore((_uuid, emit) => { progress = emit!; return saved.promise; });
    await ui.open(); ui.choose(); const saving = ui.confirm(); ui[action]();
    const updates = ui.updateCount(); progress('route'); ui.advance(30_000);
    if (outcome === 'success') saved.resolve('stale'); else saved.reject(new Error('Stale failure'));
    await saving;
    assert.equal(ui.updateCount(), updates); assert.equal(ui.recovered.length, 0); assert.equal(ui.failures.length, 0);
    assert.equal(ui.timerCount(), 0);
  }
});

test('progress from a failed attempt cannot overwrite a pending retry', async () => {
  const ui = harness(); let oldProgress!: Progress, newProgress!: Progress;
  ui.setRestore(async (_uuid, emit) => { oldProgress = emit!; throw new Error('Retry required'); });
  await ui.open(); ui.choose(); await ui.confirm(); ui.render();
  const saved = deferred<string>();
  ui.setRestore((_uuid, emit) => { newProgress = emit!; return saved.promise; }); await ui.retry();
  newProgress('metrics'); ui.render(); oldProgress('opening'); ui.render();
  assert.match(ui.text(), /Reading workout metrics/); assert.doesNotMatch(ui.text(), /Opening saved activity/);
  saved.resolve('retry-result'); await settle(); assert.deepEqual(ui.recovered, ['retry-result']);
});

test('the bounded pending hint never fails, cancels or enables a second save', async () => {
  const ui = harness(), saved = deferred<string>();
  ui.setRestore(() => saved.promise); await ui.open(); ui.choose(); const saving = ui.confirm(); ui.render();
  ui.advance(14_999); ui.render(); assert.doesNotMatch(ui.text(), /taking longer/);
  ui.advance(1); ui.render(); assert.match(ui.text(), /taking longer/); assert.match(ui.text(), /still in progress/);
  assert.equal(ui.failures.length, 0); assert.equal(ui.recovered.length, 0); assert.equal(ui.button('Retry same selection'), undefined);
  const list = ui.nodes().find(n => n.type === 'FlatList'); assert.equal(list.props.renderItem({ item: row }).props.disabled, true);
  ui.choose(); await ui.confirm(); assert.equal(ui.saves.length, 1);
  saved.resolve('eventually-confirmed'); await saving; ui.render();
  assert.deepEqual(ui.recovered, ['eventually-confirmed']); assert.doesNotMatch(ui.text(), /taking longer/);
});

test('unmount clears the pending timer without subsequent state updates', async () => {
  const ui = harness(), saved = deferred<string>(); ui.setRestore(() => saved.promise);
  await ui.open(); ui.choose(); const saving = ui.confirm(); assert.equal(ui.timerCount(), 1);
  ui.unmount(); const updates = ui.updateCount(); assert.equal(ui.timerCount(), 0);
  ui.advance(30_000); saved.resolve('after-unmount'); await saving;
  assert.equal(ui.updateCount(), updates); assert.equal(ui.recovered.length, 0);
});

test('a focus-key remount starts usable UI while the old read and timer remain fenced', async () => {
  const old = harness(), oldSave = deferred<string>(); let oldProgress!: Progress;
  old.setRestore((_uuid, progress) => { oldProgress = progress!; return oldSave.promise; });
  await old.open(); old.choose(); const oldPending = old.confirm(); old.unmount();
  const updates = old.updateCount(); assert.equal(old.timerCount(), 0);
  const fresh = harness(), newSave = deferred<string>(); fresh.setRestore(() => newSave.promise);
  await fresh.open(); fresh.choose(); const newPending = fresh.confirm(); fresh.render();
  assert.equal(fresh.saves.length, 1); assert.equal(fresh.timerCount(), 1);
  oldProgress('opening'); oldSave.resolve('old-result'); await oldPending; old.advance(30_000);
  assert.equal(old.updateCount(), updates); assert.equal(old.recovered.length, 0); assert.equal(old.failures.length, 0);
  assert.equal(fresh.timerCount(), 1); assert.equal(fresh.recovered.length, 0);
  newSave.resolve('fresh-result'); await newPending;
  assert.deepEqual(fresh.recovered, ['fresh-result']); assert.equal(fresh.timerCount(), 0);
});

test('closing or unmounting invalidates a confirmation and ignores late save results', async () => {
  for (const action of ['close', 'unmount', 'switchRoute'] as const) {
    const ui = harness(); await ui.open(); ui.choose(); ui[action](); await ui.confirm();
    assert.equal(ui.saves.length, 0, action);
    const pending = harness(); let finish!: (id: string) => void;
    pending.setRestore(() => new Promise(resolve => { finish = resolve; }));
    await pending.open(); pending.choose(); const saving = pending.confirm(); pending[action](); finish('stale'); await saving;
    assert.equal(pending.recovered.length, 0, action);
  }
});
