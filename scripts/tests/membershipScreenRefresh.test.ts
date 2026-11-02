import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const coachPath = 'app/(tabs)/coach/index.tsx';
const membershipPath = 'app/(tabs)/settings/membership.tsx';
const tick = () => new Promise(resolve => setImmediate(resolve));
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}

// Execute the actual focus callback in isolation from the unrelated training
// calculations in this large screen. No copy of the lifecycle logic lives here.
function coachHarness() {
  const source = ts.createSourceFile(coachPath, readFileSync(coachPath, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const screen = source.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'CoachScreen') as ts.FunctionDeclaration;
  const statement = screen.body!.statements.find(node => ts.isExpressionStatement(node)
    && ts.isCallExpression(node.expression) && node.expression.expression.getText(source) === 'useFocusEffect') as ts.ExpressionStatement;
  assert.ok(statement, 'Coach must refresh on route focus');
  const call = statement.expression as ts.CallExpression;
  const code = ts.transpileModule(`function makeEffect(aiSharing: any) { return ${call.arguments[0].getText(source)}; }`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
  let enabled = true, owner: string | null = 'owner-a', calls = 0;
  const consent = { ready: true, allowed: true, owner: 'owner-a' as string | null };
  const listeners = new Set<(state: string) => void>();
  let retired: ((state: string) => void) | undefined;
  const appState = { currentState: 'active' as string | null,
    addEventListener: (_event: string, listener: (state: string) => void) => {
      listeners.add(listener); retired = listener;
      return { remove: () => listeners.delete(listener) };
    } };
  const context = { aiConsent: { getState: () => consent }, AppState: appState,
    captureOwnerLease: (cloud: boolean) => { assert.equal(cloud, true); return owner ? { ownerUserId: owner } : null; },
    billingIsConfigured: () => enabled, useCallback: (callback: unknown) => callback,
    useSubscriptionStore: { getState: () => ({ refresh: async () => { calls++; } }) } };
  const makeEffect = runInNewContext(`${code}\nmakeEffect`, context);
  return { consent, focus: () => makeEffect(consent)() as () => void,
    transition(state: string) { appState.currentState = state; for (const listener of listeners) listener(state); },
    retired: () => retired?.('active'), setOwner: (next: string | null) => { owner = next; },
    disable: () => { enabled = false; }, get calls() { return calls; }, get listeners() { return listeners.size; } };
}

test('Coach rechecks membership on navigation return and foreground, not repeated active events or blurred tabs', () => {
  const h = coachHarness();
  const blur = h.focus(); assert.equal(h.calls, 1);
  h.transition('active'); assert.equal(h.calls, 1);
  h.transition('background'); h.transition('active'); assert.equal(h.calls, 2);
  blur(); assert.equal(h.listeners, 0);
  h.transition('background'); h.transition('active'); h.retired(); assert.equal(h.calls, 2);
  const leave = h.focus(); assert.equal(h.calls, 3); leave();
});

test('Coach refresh reads live consent and owner fences before each request', () => {
  for (const scenario of ['not-ready', 'declined', 'mismatch', 'signed-out', 'billing-off'] as const) {
    const h = coachHarness(); const blur = h.focus();
    if (scenario === 'not-ready') h.consent.ready = false;
    if (scenario === 'declined') h.consent.allowed = false;
    if (scenario === 'mismatch') h.setOwner('owner-b');
    if (scenario === 'signed-out') h.setOwner(null);
    if (scenario === 'billing-off') h.disable();
    h.transition('background'); h.transition('active');
    assert.equal(h.calls, 1, scenario); blur();
  }
});

test('Coach never contacts billing before consent or while backgrounded; later consent can refresh on focus', () => {
  const h = coachHarness(); h.consent.allowed = false;
  h.focus()(); assert.equal(h.calls, 0);
  h.consent.allowed = true; h.transition('background');
  const blur = h.focus(); assert.equal(h.calls, 0);
  h.transition('active'); assert.equal(h.calls, 1); blur();
});

type Node = { type: string; props: Record<string, any>; children: any[] };
function membershipHarness(enabled = true) {
  let cursor = 0, tree: Node, mounted = true, updates = 0, generation = 1;
  const state: any[] = [], effects: (() => void)[] = [], cleanups = new Map<number, () => void>();
  const auth = { user: { id: 'owner-a' }, canAccessLocalData: true };
  let purchases = 0, restores = 0, refreshes = 0;
  let purchaseOutcome = async () => {}, restoreOutcome = async () => {}, optionsOutcome = async () => {};
  const access = { isPro: false, owner: 'owner-a', error: null as string | null, isLoading: false,
    refresh: async () => { refreshes++; await refreshOutcome(); } };
  let refreshOutcome = async () => { access.isPro = true; access.error = null; access.owner = auth.user.id; };
  const plan = { id: 'monthly', price: '$9.99', period: 'month', package: {} };
  const mocks: Record<string, any> = {
    react: {
      useRef(value: any) { return state[cursor++] ??= { current: value }; },
      useState(value: any) { const index = cursor++; if (!(index in state)) state[index] = value;
        return [state[index], (next: any) => { assert.ok(mounted, 'no state update after unmount'); updates++; state[index] = next; }]; },
      useEffect(fn: () => void | (() => void), deps: unknown[]) {
        const index = cursor++, previous = state[index] as unknown[] | undefined;
        if (previous && deps.every((value, i) => Object.is(value, previous[i]))) return;
        state[index] = deps; effects.push(() => { cleanups.get(index)?.(); const cleanup = fn();
          if (cleanup) cleanups.set(index, cleanup); });
      },
    },
    'react-native': { ActivityIndicator: 'ActivityIndicator', ScrollView: 'ScrollView', Text: 'Text',
      TouchableOpacity: 'TouchableOpacity', View: 'View', Linking: { openURL: async () => {} },
      StyleSheet: { create: (styles: unknown) => styles, hairlineWidth: 1 } },
    '@expo/vector-icons': { Ionicons: 'Ionicons' }, 'expo-router': { router: { back() {} } },
    '../../../src/components/layout/ScreenHeader': { __esModule: true, default: 'ScreenHeader' },
    '../../../src/theme/useColors': { useColors: () => ({}) },
    '../../../src/utils/legal': { LEGAL_URLS: {} },
    '../../../src/store/authStore': { useAuthStore: (selector: (value: typeof auth) => unknown) => selector(auth) },
    '../../../src/store/subscriptionStore': { useSubscriptionStore: { getState: () => access } },
    '../../../src/lib/localDataOwner': {
      captureOwnerLease: () => auth.canAccessLocalData ? { ownerUserId: auth.user.id, generation } : null,
      ownerLeaseIsCurrent: (lease: { ownerUserId: string; generation: number }) => auth.canAccessLocalData
        && lease.ownerUserId === auth.user.id && lease.generation === generation,
    },
    '../../../src/lib/revenueCat': { billingIsConfigured: () => enabled,
      getSubscriptionOptions: async () => { await optionsOutcome(); return [plan]; },
      purchaseSubscription: async () => { purchases++; await purchaseOutcome(); return { isPro: true }; },
      restoreSubscriptions: async () => { restores++; await restoreOutcome(); return { isPro: true }; } },
  };
  const module = { exports: {} as any };
  const code = ts.transpileModule(readFileSync(membershipPath, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React,
    jsxFactory: 'h', jsxFragmentFactory: 'Fragment', esModuleInterop: true,
  } }).outputText;
  runInNewContext(code, { module, exports: module.exports, Error, Fragment: 'Fragment',
    require: (id: string) => { assert.ok(id in mocks, `unexpected module ${id}`); return mocks[id]; },
    h: (type: string, props: any, ...children: any[]) => ({ type, props: props ?? {}, children: children.flat(Infinity) }) });
  const render = () => { cursor = 0; tree = module.exports.default(); for (const effect of effects.splice(0)) effect(); };
  function nodes(node: any): Node[] { return node && typeof node === 'object' ? [node, ...node.children.flatMap(nodes)] : []; }
  function text(node: any): string { return typeof node === 'string' ? node
    : node && typeof node === 'object' ? node.children.map(text).join(' ') : ''; }
  render(); render();
  return { access, render, text: () => text(tree), press(label: string) {
    const button = nodes(tree).find(node => node.type === 'TouchableOpacity' && text(node).includes(label));
    assert.ok(button, `missing button ${label}`); button.props.onPress();
  }, button(label: string) { return nodes(tree).find(node => node.type === 'TouchableOpacity' && text(node).includes(label)); },
    refreshOutcome: (fn: () => Promise<void>) => { refreshOutcome = fn; },
    purchaseOutcome: (fn: () => Promise<void>) => { purchaseOutcome = fn; },
    restoreOutcome: (fn: () => Promise<void>) => { restoreOutcome = fn; },
    optionsOutcome: (fn: () => Promise<void>) => { optionsOutcome = fn; },
    changeOwner() { generation++; auth.user = { id: 'owner-b' }; access.owner = 'owner-b'; render(); render(); },
    revoke() { generation++; auth.canAccessLocalData = false; render(); render(); },
    unmount() { for (const cleanup of cleanups.values()) cleanup(); mounted = false; },
    get counts() { return { purchases, restores, refreshes }; }, get updates() { return updates; } };
}

for (const action of ['purchase', 'restore'] as const) {
  async function start(h: ReturnType<typeof membershipHarness>) {
    if (action === 'purchase') { h.press('View plans'); await tick(); h.render(); h.press('Subscribe for'); }
    else h.press('Restore purchases');
    await tick(); h.render();
  }
  test(`${action} success followed by swallowed verification failure never claims active; retry only checks access`, async () => {
    const h = membershipHarness();
    h.refreshOutcome(async () => { h.access.isPro = false; h.access.error = 'Membership could not be verified'; });
    await start(h);
    assert.match(h.text(), /request finished, but Pro access could not be verified/);
    assert.doesNotMatch(h.text(), /Your Pro subscription is active/);
    const before = h.counts;
    h.refreshOutcome(async () => { h.access.error = null; h.access.isPro = true; });
    h.press('Retry membership check'); await tick(); h.render();
    assert.match(h.text(), /Your Pro subscription is active/);
    assert.equal(h.counts.purchases, before.purchases); assert.equal(h.counts.restores, before.restores);
    assert.equal(h.counts.refreshes, before.refreshes + 1);
  });
  test(`${action} uses refreshed denied access instead of the SDK's earlier Pro result`, async () => {
    const h = membershipHarness(); h.refreshOutcome(async () => { h.access.isPro = false; });
    await start(h); assert.match(h.text(), /Pro access is not active in StrideOS/);
    assert.doesNotMatch(h.text(), /Your Pro subscription is active/);
  });
  test(`${action} confirms active only after same-owner verification succeeds`, async () => {
    const h = membershipHarness(); await start(h); assert.match(h.text(), /Your Pro subscription is active/);
  });
  test(`${action} cannot publish the old owner's outcome after an owner switch during access refresh`, async () => {
    const h = membershipHarness(), pending = deferred();
    h.refreshOutcome(async () => { await pending.promise; h.access.isPro = true; });
    await start(h); h.changeOwner(); pending.resolve(); await tick(); h.render();
    assert.doesNotMatch(h.text(), /Your Pro subscription is active|request finished/);
    assert.equal(h.button('Subscribe for'), undefined);
  });
  test(`${action} completion after unmount performs no screen state updates`, async () => {
    const h = membershipHarness(), pending = deferred(); h.refreshOutcome(() => pending.promise);
    await start(h); h.unmount(); const before = h.updates;
    pending.resolve(); await tick(); assert.equal(h.updates, before);
  });
}

test('an owner switch while purchase is pending skips refresh; stale plans cannot leak across accounts', async () => {
  const h = membershipHarness(), pending = deferred();
  h.press('View plans'); await tick(); h.render(); h.purchaseOutcome(() => pending.promise);
  h.press('Subscribe for'); h.changeOwner(); pending.resolve(); await tick(); h.render();
  assert.equal(h.counts.refreshes, 0); assert.doesNotMatch(h.text(), /Your Pro subscription is active/);
  assert.equal(h.button('Subscribe for'), undefined);
});

test('duplicate purchase taps are single-flight and cancellation is not reported as activation', async () => {
  const h = membershipHarness(), pending = deferred();
  h.press('View plans'); await tick(); h.render();
  h.purchaseOutcome(async () => { await pending.promise; throw { userCancelled: true }; });
  h.press('Subscribe for'); h.press('Subscribe for'); assert.equal(h.counts.purchases, 1);
  pending.resolve(); await tick(); h.render();
  assert.match(h.text(), /Purchase cancelled/); assert.equal(h.counts.refreshes, 0);
});

test('rejected verification remains a completed request with unverified access, not a failed purchase', async () => {
  const h = membershipHarness(); h.refreshOutcome(async () => { throw new Error('offline'); });
  h.press('Restore purchases'); await tick(); h.render();
  assert.match(h.text(), /restore request finished, but Pro access could not be verified/);
  assert.doesNotMatch(h.text(), /This request could not be completed/);
});

test('disabled billing exposes no payment or retry actions', () => {
  const h = membershipHarness(false);
  assert.match(h.text(), /Purchases are not available/);
  assert.equal(h.button('Restore purchases'), undefined);
  assert.deepEqual(h.counts, { purchases: 0, restores: 0, refreshes: 0 });
});

test('lost local access prevents billing actions, and stale plan loading cannot restore purchase options', async () => {
  const h = membershipHarness(), pending = deferred(); h.optionsOutcome(() => pending.promise);
  h.press('View plans'); h.revoke(); pending.resolve(); await tick(); h.render();
  assert.equal(h.button('Subscribe for'), undefined);
  h.press('Restore purchases'); await tick(); h.render();
  assert.equal(h.counts.restores, 0); assert.match(h.text(), /Sign in online/);
});

test('auth success presentation does not claim email delivery', () => {
  for (const [file, handler] of [['forgot-password', 'handleReset'], ['sign-up', 'handleSignUp']] as const) {
    const path = `app/auth/${file}.tsx`, source = readFileSync(path, 'utf8');
    assert.doesNotMatch(source, /We sent a (?:password reset|confirmation) link/);
    assert.match(source, /Email delivery may be delayed/);
    assert.match(source, /spam folder/);
    assert.match(source, new RegExp(`async function ${handler}\\(`));
  }
});
