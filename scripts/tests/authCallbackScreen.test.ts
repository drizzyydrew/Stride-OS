import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

type Completion = { handled: boolean; recovery: boolean; error: string | null };
type Element = { type: string; props: Record<string, any>; children: any[] };
const success = (recovery = true): Completion => ({ handled: true, recovery, error: null });
const rawReset = (id: string) => `strideos://auth/callback#access_token=synthetic-${id}&refresh_token=synthetic-${id}&type=recovery`;
function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const tick = () => new Promise<void>(resolve => setImmediate(resolve));

// Execute repository source in an isolated VM. No native modules, credentials,
// SDK requests, real timers, or global module-loader patches are involved.
function transpile(source: string) {
  return ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
    jsx: ts.JsxEmit.React, jsxFactory: 'h', esModuleInterop: true,
  } }).outputText;
}
function declaration(path: string, name: string) {
  const source = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const node = source.statements.find(statement => ts.isFunctionDeclaration(statement) && statement.name?.text === name);
  assert.ok(node, `Expected the real ${name} function in ${path}`);
  return node.getText(source);
}

function loadAuthRedirect() {
  const mod = { exports: {} as any };
  const mocks: Record<string, unknown> = {
    'expo-linking': { createURL: (path: string) => `strideos://${path}` },
    './supabase': {}, './syncService': {}, './localDataOwner': {},
    '../store/checkInStore': {}, '../store/customWorkoutStore': {},
    '../store/strengthStore': {}, '../store/workoutStore': {}, '../store/activityStore': {},
  };
  // Load the full actual module, including authParams, resolver and OS-event
  // memory. Only its dependency boundary is mocked; no resolver logic is copied.
  runInNewContext(transpile(readFileSync('src/lib/authRedirect.ts', 'utf8')), {
    module: mod, exports: mod.exports, URL, URLSearchParams,
    require: (name: string) => { assert.ok(Object.hasOwn(mocks, name), `Unmocked redirect import: ${name}`); return mocks[name]; },
  }, { filename: 'src/lib/authRedirect.ts' });
  return mod.exports as Pick<typeof import('../../src/lib/authRedirect'),
    'AUTH_CALLBACK_PATH' | 'isAuthCallbackUrl' | 'rememberAuthCallbackUrl' | 'resolveAuthCallbackUrl'>;
}

function runtime() {
  let cursor = 0, dirty = false, disposed = false, tree: Element | null = null;
  let component: () => Element | null;
  const slots: any[] = [], pending: (() => void)[] = [];
  const cleanups = new Map<number, () => void>();
  const changed = (old: unknown[] | undefined, next: unknown[] | undefined) => !old || !next
    || old.length !== next.length || next.some((value, index) => !Object.is(value, old[index]));
  const hooks = {
    useState(initial: any) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
      return [slots[index], (next: any) => {
        assert.equal(disposed, false, 'No state update after unmount');
        const value = typeof next === 'function' ? next(slots[index]) : next;
        if (!Object.is(value, slots[index])) { slots[index] = value; dirty = true; }
      }];
    },
    useMemo(factory: () => any, dependencies: unknown[]) {
      const index = cursor++;
      if (!slots[index] || changed(slots[index].dependencies, dependencies)) {
        slots[index] = { dependencies: [...dependencies], value: factory() };
      }
      return slots[index].value;
    },
    useEffect(effect: () => void | (() => void), dependencies?: unknown[]) {
      const index = cursor++;
      if (changed(slots[index], dependencies)) {
        slots[index] = dependencies ? [...dependencies] : undefined;
        pending.push(() => {
          cleanups.get(index)?.();
          cleanups.delete(index);
          const cleanup = effect();
          if (cleanup) cleanups.set(index, cleanup);
        });
      }
    },
  };
  function render() {
    assert.equal(disposed, false);
    let passes = 0;
    do {
      assert.ok(++passes < 20, 'Render/effect cycle must settle');
      cursor = 0; dirty = false; tree = component();
      pending.splice(0).forEach(effect => effect());
    } while (dirty);
    return tree;
  }
  function nodes(): Element[] {
    const all: Element[] = [];
    const visit = (node: any) => {
      if (node && typeof node === 'object' && node.children) { all.push(node); node.children.forEach(visit); }
    };
    visit(tree);
    return all;
  }
  return { hooks, render, nodes, install: (value: typeof component) => { component = value; },
    text: () => nodes().flatMap(node => node.children.filter(child => typeof child === 'string')).join(' '),
    unmount: () => { cleanups.forEach(cleanup => cleanup()); cleanups.clear(); disposed = true; },
  };
}

function screen(options: {
  incoming?: string | null; params?: Record<string, string | string[]>;
  initial?: () => Promise<string | null>; complete?: (url: string) => Promise<Completion>;
  redirect?: ReturnType<typeof loadAuthRedirect>;
} = {}) {
  const ui = runtime(), navigation: string[] = [], calls: string[] = [];
  const cancellations: { url: string; reason: string }[] = [];
  let incoming = options.incoming ?? null, params = options.params ?? {}, initialCalls = 0;
  let now = 0, nextTimer = 0;
  const timers = new Map<number, { due: number; callback: () => void }>();
  const linking = {
    useURL: () => incoming,
    getInitialURL: () => { initialCalls++; return options.initial?.() ?? Promise.resolve(null); },
    createURL: (path: string, { queryParams = {} }: { queryParams?: Record<string, string> } = {}) => {
      const query = new URLSearchParams(queryParams).toString();
      return `strideos://${path}${query ? `?${query}` : ''}`;
    },
  };
  const redirect = options.redirect ?? loadAuthRedirect();
  const mocks: Record<string, any> = {
    react: ui.hooks,
    'expo-router': { useLocalSearchParams: () => params, router: { replace: (path: string) => navigation.push(path) } },
    'expo-linking': linking,
    'react-native': { StyleSheet: { create: (styles: unknown) => styles },
      ...Object.fromEntries(['ActivityIndicator', 'Pressable', 'Text', 'View'].map(name => [name, name])) },
    '../../src/lib/authRedirect': redirect,
    '../../src/store/authStore': { completeAuthLink: (url: string) => {
      calls.push(url); return options.complete?.(url) ?? Promise.resolve(success());
    }, cancelAuthLink: (url: string, reason: string) => { cancellations.push({ url, reason }); } },
    '../../src/theme/colors': { colors: {} }, '../../src/theme/spacing': { spacing: {} },
    '../../src/theme/tokens': { FontSize: {}, FontWeight: {}, Radius: {} },
  };
  const mod = { exports: {} as any };
  runInNewContext(transpile(readFileSync('app/auth/callback.tsx', 'utf8')), {
    module: mod, exports: mod.exports, URL, URLSearchParams, Error,
    require: (name: string) => { assert.ok(Object.hasOwn(mocks, name), `Unmocked import: ${name}`); return mocks[name]; },
    h: (type: string, props: Record<string, any> | null, ...children: any[]) => ({ type, props: props ?? {}, children: children.flat(Infinity) }),
    setTimeout: (callback: () => void, delay = 0) => { const id = ++nextTimer; timers.set(id, { due: now + delay, callback }); return id; },
    clearTimeout: (id: number) => timers.delete(id),
  }, { filename: 'app/auth/callback.tsx' });
  ui.install(mod.exports.default);
  return { ...ui, navigation, calls, cancellations,
    async settle() { await tick(); ui.render(); },
    setIncoming(value: string | null) { incoming = value; ui.render(); },
    setParams(value: typeof params) { params = value; ui.render(); },
    initialCalls: () => initialCalls, timerCount: () => timers.size,
    advance(ms: number) {
      const end = now + ms;
      for (let passes = 0; ; passes++) {
        assert.ok(passes < 100, 'Timers must settle');
        const next = [...timers].filter(([, timer]) => timer.due <= end).sort((a, b) => a[1].due - b[1].due)[0];
        if (!next) break;
        now = next[1].due; timers.delete(next[0]); next[1].callback();
      }
      now = end; ui.render();
    },
    back() {
      const button = ui.nodes().find(node => node.type === 'Pressable');
      assert.ok(button, 'Failure must offer a reachable Back to Sign In button'); button.props.onPress();
    },
  };
}

test('actual callback preserves cold initial raw recovery fragment when route params are lost', async () => {
  const raw = rawReset('cold'), ui = screen({ initial: async () => raw });
  ui.render(); assert.match(ui.text(), /Finishing sign in/);
  await ui.settle();
  assert.deepEqual(ui.calls, [raw]); assert.deepEqual(ui.navigation, ['/auth/new-password']);
  assert.equal(ui.initialCalls(), 1); assert.equal(ui.timerCount(), 0);
});

test('live raw fragments survive absent route params and a second reset supersedes pending first completion', async () => {
  const first = deferred<Completion>(), second = deferred<Completion>();
  const a = rawReset('first'), b = rawReset('second');
  const ui = screen({ incoming: a, complete: url => url === a ? first.promise : second.promise });
  ui.render(); await ui.settle(); ui.setIncoming(b); await ui.settle();
  assert.deepEqual(ui.calls, [a, b]); assert.equal(ui.initialCalls(), 0);
  first.resolve(success(false)); await ui.settle(); assert.deepEqual(ui.navigation, []);
  second.resolve(success()); await ui.settle(); assert.deepEqual(ui.navigation, ['/auth/new-password']);
  assert.equal(ui.timerCount(), 0);
});

test('remembered live B survives callback remount with stale incoming or initial A and no route credentials', async () => {
  for (const staleIncoming of [true, false]) {
    const redirect = loadAuthRedirect(), a = rawReset('launch-A'), b = rawReset('event-B');
    redirect.rememberAuthCallbackUrl(a, true);
    const original = screen({ redirect, incoming: a });
    original.render(); await original.settle(); assert.deepEqual(original.calls, [a]);
    original.unmount();

    // Root's transport-only listener records B even while callback is absent.
    redirect.rememberAuthCallbackUrl(b);
    // A late launch-URL read must not replace the newer delivered OS event.
    redirect.rememberAuthCallbackUrl(a, true);
    const remount = screen({ redirect, incoming: staleIncoming ? a : null, initial: async () => a, params: {} });
    remount.render(); await remount.settle();
    assert.deepEqual(remount.calls, [b]);
    assert.deepEqual(remount.navigation, ['/auth/new-password']);
    assert.equal(remount.initialCalls(), staleIncoming ? 0 : 1);
    assert.equal(remount.timerCount(), 0);
  }
});

test('current route query B overrides stale initial or remembered launch A', async () => {
  for (const remembered of [false, true]) {
    const redirect = loadAuthRedirect(), a = rawReset('launch-A');
    if (remembered) redirect.rememberAuthCallbackUrl(a, true);
    const ui = screen({ redirect, initial: async () => a, params: { code: 'route-B', type: 'recovery' } });
    ui.render(); await ui.settle();
    assert.deepEqual(ui.calls, ['strideos://auth/callback?code=route-B&type=recovery']);
    assert.deepEqual(ui.navigation, ['/auth/new-password']);
    assert.equal(ui.initialCalls(), 1); assert.equal(ui.timerCount(), 0);
  }
});

test('a new live reset clears the previous visible failure and processes its own payload', async () => {
  const a = rawReset('failed'), b = rawReset('retry'), retry = deferred<Completion>();
  const ui = screen({ incoming: a, complete: url => url === a
    ? Promise.resolve({ ...success(), error: 'Expired link' }) : retry.promise });
  ui.render(); await ui.settle(); assert.match(ui.text(), /Expired link/);
  ui.setIncoming(b); assert.doesNotMatch(ui.text(), /Expired link/); assert.match(ui.text(), /Finishing sign in/);
  retry.resolve(success()); await ui.settle(); assert.deepEqual(ui.calls, [a, b]);
  assert.deepEqual(ui.navigation, ['/auth/new-password']);
});

test('query fallback normalizes array params and ignores an unrelated incoming URL', async () => {
  const ui = screen({ incoming: 'strideos://settings', params: { code: ['first-code', 'unused-code'], type: 'recovery' } });
  ui.render(); await ui.settle();
  assert.equal(ui.calls.length, 1);
  const parsed = new URL(ui.calls[0]);
  assert.equal(parsed.searchParams.get('code'), 'first-code'); assert.equal(parsed.searchParams.get('type'), 'recovery');
  assert.deepEqual(ui.navigation, ['/auth/new-password']);
});

test('handled:false never navigates and exposes a usable failure action', async () => {
  const ui = screen({ complete: async () => ({ handled: false, recovery: false, error: null }) });
  ui.render(); await ui.settle(); assert.match(ui.text(), /missing sign-in details/);
  assert.deepEqual(ui.navigation, []); assert.equal(ui.timerCount(), 0);
  ui.back(); assert.deepEqual(ui.navigation, ['/auth/sign-in']);
});

test('coordinator errors and rejected completion show failure without navigation or private exception detail', async () => {
  for (const rejects of [false, true]) {
    const ui = screen({ incoming: rawReset('error'), complete: async () => {
      if (rejects) throw new Error('private-sdk-token-detail');
      return { ...success(), error: 'This link expired. Request a new one.' };
    } });
    ui.render(); await ui.settle();
    assert.match(ui.text(), /Sign-in link failed/);
    assert.match(ui.text(), rejects ? /could not finish/ : /This link expired/);
    assert.doesNotMatch(ui.text(), /private-sdk-token-detail/);
    assert.deepEqual(ui.navigation, []); assert.equal(ui.timerCount(), 0);
  }
});

test('rejected initial URL lookup reaches a bounded visible error', async () => {
  const ui = screen({ initial: async () => { throw new Error('private-native-error'); } });
  ui.render(); await ui.settle(); assert.match(ui.text(), /could not finish/);
  assert.deepEqual(ui.calls, []); assert.deepEqual(ui.navigation, []); assert.equal(ui.timerCount(), 0);
});

test('20 second screen timeout prevents late successful navigation and retains the failure action', async () => {
  const raw = rawReset('slow'), completion = deferred<Completion>(), ui = screen({ incoming: raw, complete: () => completion.promise });
  ui.render(); await ui.settle(); ui.advance(19_999); assert.match(ui.text(), /Finishing sign in/);
  assert.deepEqual(ui.cancellations, []);
  ui.advance(1); assert.match(ui.text(), /taking longer than expected/);
  assert.equal(ui.cancellations.length, 1); assert.equal(ui.cancellations[0].url, raw);
  assert.match(ui.cancellations[0].reason, /taking longer than expected/);
  assert.ok(ui.text().includes(ui.cancellations[0].reason), 'Cancellation and visible failure must describe the same timeout');
  completion.resolve(success()); await ui.settle(); assert.deepEqual(ui.navigation, []);
  assert.match(ui.text(), /taking longer than expected/); ui.back();
  assert.deepEqual(ui.navigation, ['/auth/sign-in']); assert.equal(ui.timerCount(), 0);
  assert.equal(ui.cancellations.length, 1, 'Late completion must not cancel again');
});

test('a coordinator cancellation storage error replaces timeout text with actionable failure without navigation', async () => {
  const raw = rawReset('cancellation-storage-error'), completion = deferred<Completion>();
  const ui = screen({ incoming: raw, complete: () => completion.promise });
  ui.render(); await ui.settle(); ui.advance(20_000);
  assert.match(ui.text(), /taking longer than expected/);
  assert.equal(ui.cancellations.length, 1); assert.equal(ui.cancellations[0].url, raw);

  const storageError = 'Sign-in cancellation could not be saved. Restart the app and try again.';
  completion.resolve({ handled: true, recovery: false, error: storageError });
  await ui.settle();
  assert.ok(ui.text().includes(storageError));
  assert.doesNotMatch(ui.text(), /taking longer than expected|Finishing sign in/);
  assert.match(ui.text(), /Sign-in link failed/);
  assert.deepEqual(ui.navigation, []);
  assert.equal(ui.cancellations.length, 1); assert.equal(ui.timerCount(), 0);
  ui.back(); assert.deepEqual(ui.navigation, ['/auth/sign-in']);
});

test('watchdog cancels exact resolved live B URL rather than stale incoming A or token-free route', async () => {
  const redirect = loadAuthRedirect(), a = rawReset('old-launch'), b = rawReset('resolved-live');
  redirect.rememberAuthCallbackUrl(a, true); redirect.rememberAuthCallbackUrl(b);
  const completion = deferred<Completion>();
  const ui = screen({ redirect, incoming: a, initial: async () => a, params: {}, complete: () => completion.promise });
  ui.render(); await ui.settle(); assert.deepEqual(ui.calls, [b]);
  ui.advance(20_000);
  assert.equal(ui.cancellations.length, 1); assert.equal(ui.cancellations[0].url, b);
  assert.match(ui.cancellations[0].reason, /taking longer than expected/);
  completion.resolve(success()); await ui.settle(); assert.deepEqual(ui.navigation, []);
});

test('unmount clears timeout and ignores both late success and late rejection', async () => {
  for (const rejects of [false, true]) {
    const completion = deferred<Completion>(), ui = screen({ incoming: rawReset('unmounted'), complete: () => completion.promise });
    ui.render(); await ui.settle(); ui.unmount(); assert.equal(ui.timerCount(), 0);
    if (rejects) completion.reject(new Error('late-private-error')); else completion.resolve(success());
    await tick(); assert.deepEqual(ui.navigation, []);
  }
});

test('a non-recovery verified callback navigates to dashboard once, including on unchanged rerender', async () => {
  const ui = screen({ incoming: 'strideos://auth/callback?code=synthetic-login', complete: async () => success(false) });
  ui.render(); await ui.settle(); ui.render(); await ui.settle();
  assert.equal(ui.calls.length, 1); assert.deepEqual(ui.navigation, ['/(tabs)/dashboard']);
});

// These delayed native-lookup cases assert cancellation before starting SDK work,
// rather than merely hiding navigation after a stale exchange already started.
test('initial URL lookup resolving after timeout must not start a fresh auth attempt', async () => {
  const initial = deferred<string | null>(), ui = screen({ initial: () => initial.promise });
  ui.render(); ui.advance(20_000);
  assert.deepEqual(ui.cancellations, [], 'Pending native lookup has no coordinator attempt to cancel');
  assert.match(ui.text(), /taking longer than expected/);
  initial.resolve(rawReset('too-late')); await ui.settle();
  assert.deepEqual(ui.calls, [], 'An expired screen must not start coordinator work');
  assert.deepEqual(ui.cancellations, [], 'Late lookup must neither start nor cancel a different attempt');
  assert.deepEqual(ui.navigation, []);
});

test('initial URL lookup resolving after unmount must not start a fresh auth attempt', async () => {
  const initial = deferred<string | null>(), ui = screen({ initial: () => initial.promise });
  ui.render(); ui.unmount(); initial.resolve(rawReset('unmounted-initial')); await tick();
  assert.deepEqual(ui.calls, [], 'An unmounted screen must not start coordinator work');
  assert.deepEqual(ui.navigation, []);
});

test('a stale pending initial URL must not supersede a newer live reset attempt', async () => {
  const initial = deferred<string | null>(), completion = deferred<Completion>();
  const live = rawReset('live-newer'), ui = screen({ initial: () => initial.promise, complete: () => completion.promise });
  ui.render(); ui.setIncoming(live); await ui.settle();
  initial.resolve(rawReset('stale-initial')); await ui.settle();
  assert.deepEqual(ui.calls, [live], 'Old native lookup must not invalidate the newer coordinator nonce');
  completion.resolve(success()); await ui.settle(); assert.deepEqual(ui.navigation, ['/auth/new-password']);
});

function gate(initial: { access: boolean; loading: boolean; onboarding: boolean; segments: string[] }) {
  const ui = runtime(), navigation: string[] = [];
  let state = initial;
  const mod = { exports: {} as any };
  // Extract the exact real function AST, retaining its entire body and effect.
  runInNewContext(transpile(`${declaration('app/_layout.tsx', 'NavigationGate')}\nmodule.exports = NavigationGate;`), {
    module: mod, exports: mod.exports, useEffect: ui.hooks.useEffect,
    useAuthStore: (selector: any) => selector({ canAccessLocalData: state.access, loading: state.loading }),
    useOnboardingStore: (selector: any) => selector({ onboardingComplete: state.onboarding }),
    useSegments: () => state.segments,
    router: { replace: (path: string) => navigation.push(path) },
  }, { filename: 'app/_layout.tsx:NavigationGate' });
  ui.install(mod.exports);
  return { ...ui, navigation, update(next: Partial<typeof state>) { state = { ...state, ...next }; ui.render(); } };
}

test('real NavigationGate preserves callback and new-password across loading, access and onboarding transitions', () => {
  for (const route of ['callback', 'new-password']) {
    const ui = gate({ access: false, loading: true, onboarding: false, segments: ['auth', route] });
    ui.render(); ui.update({ loading: false }); ui.update({ access: true }); ui.update({ onboarding: true });
    assert.deepEqual(ui.navigation, [], `${route} must remain mounted throughout recovery acceptance`);
  }
});

test('real NavigationGate retains signed-out, onboarding, dashboard and loading behavior for ordinary routes', () => {
  const cases = [
    { access: false, loading: false, onboarding: true, segments: ['(tabs)', 'dashboard'], expected: '/auth/sign-in' },
    { access: false, loading: false, onboarding: false, segments: ['auth', 'sign-in'], expected: null },
    { access: true, loading: false, onboarding: false, segments: ['auth', 'sign-in'], expected: '/onboarding' },
    { access: true, loading: false, onboarding: false, segments: ['onboarding'], expected: null },
    { access: true, loading: false, onboarding: true, segments: ['auth', 'sign-in'], expected: '/(tabs)/dashboard' },
    { access: true, loading: false, onboarding: true, segments: ['onboarding'], expected: '/(tabs)/dashboard' },
    { access: true, loading: false, onboarding: true, segments: ['(tabs)', 'dashboard'], expected: null },
    { access: false, loading: true, onboarding: true, segments: ['(tabs)', 'dashboard'], expected: null },
  ];
  for (const fixture of cases) {
    const ui = gate(fixture); ui.render();
    assert.deepEqual(ui.navigation, fixture.expected ? [fixture.expected] : [], JSON.stringify(fixture));
  }
  const ui = gate({ access: true, loading: true, onboarding: true, segments: ['auth', 'sign-in'] });
  ui.render(); assert.deepEqual(ui.navigation, []);
  ui.update({ loading: false }); assert.deepEqual(ui.navigation, ['/(tabs)/dashboard']);
});
