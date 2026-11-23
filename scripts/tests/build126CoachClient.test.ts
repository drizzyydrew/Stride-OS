import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { COACH_CHAT_KEY, COACH_CHAT_LIFETIME_MS, createCoachChatHistory, unexpiredCoachMessages,
  type SavedCoachMessage } from '../../src/utils/coachChatHistory';
import { canBuyCoachPack, coachLowBalanceNotices, coachUsageLabel, parseCoachUsage,
  type CoachUsage } from '../../src/utils/coachUsage';

const T = Date.parse('2026-11-23T12:00:00.000Z');
const message = (id: string, createdAt = T, role: SavedCoachMessage['role'] = 'user'): SavedCoachMessage => ({ id, createdAt, role, content: `Private text ${id}` });
const document = (owner: string, messages: SavedCoachMessage[], clockFloor = T) => JSON.stringify({ version: 1, owner, clockFloor, messages });
const deferred = <T,>() => { let resolve!: (value: T) => void; let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
function historyHarness() {
  let now = T, failRead = false, failWrite = false;
  const values = new Map<string, string>([['profile', JSON.stringify({ goal: 'Run a 5K', chosenContext: 'My saved training data' })]]);
  const writes: string[] = [];
  const history = createCoachChatHistory({ getItem: async key => { if (failRead) throw Error('Disk read failed'); return values.get(key) ?? null; },
    setItem: async (key, value) => { if (failWrite) throw Error('Disk write failed'); writes.push(key); values.set(key, value); } }, () => now);
  return { history, values, writes, now: (value: number) => { now = value; }, readFailure: (value: boolean) => { failRead = value; }, writeFailure: (value: boolean) => { failWrite = value; } };
}
const v2 = (patch: Partial<CoachUsage> & { canPurchase?: boolean } = {}) => ({ version: 2 as const, pro: true, timezone: 'America/Los_Angeles',
  used: 0, limit: 20, remaining: 20, resetsAt: '2026-11-24T08:00:00.000Z', purchasedRemaining: 0,
  purchasedExpiresAt: null, packsEnabled: true, ...patch,
  canPurchase: patch.canPurchase ?? (patch.packsEnabled !== false && (patch.purchasedRemaining ?? 0) === 0) });

test('each message expires at its own exact 24-hour boundary; later activity does not extend it', async () => {
  const h = historyHarness(); await h.history.setOwner('A');
  await h.history.append(message('first'));
  h.now(T + 10_000); await h.history.append(message('reply', T + 10_000, 'assistant'));
  h.now(T + COACH_CHAT_LIFETIME_MS - 1); assert.equal((await h.history.prune()).length, 2);
  h.now(T + COACH_CHAT_LIFETIME_MS); assert.deepEqual((await h.history.prune()).map(row => row.id), ['reply']);
  assert.doesNotMatch(h.values.get(COACH_CHAT_KEY)!, /Private text first/);
  h.now(T + COACH_CHAT_LIFETIME_MS + 10_000); assert.deepEqual(await h.history.prune(), []);
  assert.match(h.values.get('profile')!, /Run a 5K/);
  assert.ok(h.writes.every(key => key === COACH_CHAT_KEY), 'chat does not auto-save profile facts or change billing storage');
});

test('rehydration removes expired records, rejects future messages and preserves a persisted clock floor', async () => {
  const h = historyHarness(); h.now(T + COACH_CHAT_LIFETIME_MS);
  h.values.set(COACH_CHAT_KEY, document('A', [message('expired'), message('recent', T + 1000)], T + COACH_CHAT_LIFETIME_MS));
  await h.history.setOwner('A'); assert.deepEqual(h.history.getState().messages.map(row => row.id), ['recent']);
  h.now(T); await h.history.setOwner('A'); assert.deepEqual(h.history.getState().messages.map(row => row.id), ['recent']);
  await assert.rejects(h.history.append(message('future', T + COACH_CHAT_LIFETIME_MS + 1)), /invalid|expired/i);
  assert.deepEqual(unexpiredCoachMessages([message('exact', T - COACH_CHAT_LIFETIME_MS), message('future', T + 1), message('valid')], T).map(row => row.id), ['valid']);
});

test('failed and malformed reads cannot overwrite chat or pretend hydration succeeded', async () => {
  const h = historyHarness(), raw = document('A', [message('saved')]); h.values.set(COACH_CHAT_KEY, raw);
  h.readFailure(true); await h.history.setOwner('A'); assert.equal(h.history.getState().ready, false);
  await assert.rejects(h.history.append(message('new')), /changed|history/i); assert.equal(h.values.get(COACH_CHAT_KEY), raw);
  h.readFailure(false); await h.history.setOwner('A'); assert.equal(h.history.getState().ready, true);
  h.values.set(COACH_CHAT_KEY, '{broken'); await h.history.setOwner('A'); assert.equal(h.history.getState().ready, false);
  assert.equal(h.values.get(COACH_CHAT_KEY), '{broken');
});

test('a new owner cannot see or overwrite another owner record and stale owner appends fail closed', async () => {
  const h = historyHarness(); await h.history.setOwner('A'); await h.history.append(message('A-only'));
  const raw = h.values.get(COACH_CHAT_KEY); await h.history.setOwner('B');
  assert.deepEqual(h.history.getState().messages, []); assert.equal(h.history.getState().ready, false);
  await assert.rejects(h.history.append(message('old-owner'), 'A')); assert.equal(h.values.get(COACH_CHAT_KEY), raw);
  h.values.delete(COACH_CHAT_KEY); await h.history.setOwner('B'); await h.history.append(message('B-only'), 'B');
  assert.deepEqual(h.history.getState().messages.map(row => row.id), ['B-only']);
});

test('late owner hydration cannot publish a previous account response or clobber the current account', async () => {
  const first = deferred<string | null>(), second = deferred<string | null>(); let reads = 0;
  const history = createCoachChatHistory({ getItem: async () => ++reads === 1 ? first.promise : second.promise,
    setItem: async () => { throw Error('No hydration write expected'); } }, () => T);
  const a = history.setOwner('A'); await Promise.resolve(); const b = history.setOwner('B'); await Promise.resolve();
  second.resolve(document('B', [message('B-only')])); await b;
  first.resolve(document('A', [message('A-only')])); await a;
  assert.equal(history.getState().owner, 'B'); assert.deepEqual(history.getState().messages.map(row => row.id), ['B-only']);
});

test('a request identity must be durably saved before a billable send and the same identity can retry a failed write', async () => {
  const h = historyHarness(); await h.history.setOwner('A'); h.writeFailure(true);
  await assert.rejects(h.history.append(message('request-id'), 'A'), /saved|save|write|storage|device/i);
  assert.equal(h.values.has(COACH_CHAT_KEY), false);
  h.writeFailure(false); await h.history.append(message('request-id'), 'A');
  const saved = JSON.parse(h.values.get(COACH_CHAT_KEY)!);
  assert.equal(saved.messages.filter((row: SavedCoachMessage) => row.id === 'request-id').length, 1);
});

test('duplicate successful append is idempotent and logout clears visible text without changing profile', async () => {
  const h = historyHarness(); await h.history.setOwner('A');
  await h.history.append(message('same')); await h.history.append(message('same'));
  assert.equal(h.history.getState().messages.length, 1);
  await h.history.setOwner(null); assert.equal(h.history.getState().ready, true); assert.deepEqual(h.history.getState().messages, []);
  await assert.rejects(h.history.append(message('while-logged-out'), 'A'));
  assert.match(h.values.get('profile')!, /chosenContext/);
});

test('v2 counters parse local-midnight resets, zero included allowance for non-Pro and standalone purchased credits', () => {
  const account = parseCoachUsage({ usage: v2() }); assert.equal(account.remaining, 20);
  const standalone = parseCoachUsage({ usage: v2({ pro: false, limit: 0, remaining: 0, purchasedRemaining: 30,
    purchasedExpiresAt: '2027-11-23T12:00:00.000Z' }) });
  assert.equal(coachUsageLabel(standalone, T), '30 purchased messages remaining'); assert.equal(canBuyCoachPack(standalone, T), false);
  for (const patch of [{ used: -1 }, { used: 1, remaining: 20 }, { limit: 200 }, { timezone: 'Invalid/Zone' },
    { pro: false }, { purchasedRemaining: -1 }, { purchasedRemaining: 1, purchasedExpiresAt: null },
    { packsEnabled: 'true' as unknown as boolean }, { purchasedExpiresAt: 'not-a-date' }]) {
    assert.throws(() => parseCoachUsage({ usage: v2(patch) }));
  }
});

test('pack eligibility requires zero confirmed balance, current counters, approval and the server purchase gate', () => {
  assert.equal(canBuyCoachPack(parseCoachUsage({ usage: v2() }), T), true);
  assert.equal(canBuyCoachPack(parseCoachUsage({ usage: v2({ pro: false, limit: 0, remaining: 0 }) }), T), true);
  assert.equal(canBuyCoachPack(parseCoachUsage({ usage: v2({ packsEnabled: false }) }), T), false);
  assert.equal(canBuyCoachPack(parseCoachUsage({ usage: v2({ canPurchase: false }) }), T), false,
    'a pending server purchase/request must not be offered again');
  assert.equal(canBuyCoachPack(parseCoachUsage({ usage: v2({ purchasedRemaining: 1, purchasedExpiresAt: '2027-11-23T12:00:00.000Z' }) }), T), false);
  assert.equal(canBuyCoachPack(parseCoachUsage({ usage: v2() }), Date.parse(v2().resetsAt)), false);
  assert.equal(canBuyCoachPack(null, T), false);
});

test('five-or-fewer warnings use stable allowance/pack keys without offering a purchase while a balance remains', () => {
  const expiry = '2027-11-23T12:00:00.000Z';
  const both = parseCoachUsage({ usage: v2({ used: 15, remaining: 5, purchasedRemaining: 5, purchasedExpiresAt: expiry, canPurchase: false }) });
  const first = coachLowBalanceNotices(both, T); assert.equal(first.length, 2);
  assert.match(first[0]!.text, /5 included.*5 purchased/); assert.match(first[1]!.text, /used up or expire/);
  const later = coachLowBalanceNotices({ ...both, used: 16, remaining: 4, purchasedRemaining: 4 }, T);
  assert.deepEqual(later.map(row => row.key), first.map(row => row.key), 'screen can warn once per balance window');
  assert.equal(canBuyCoachPack(both, T), false);
  assert.equal(coachLowBalanceNotices(parseCoachUsage({ usage: v2({ used: 14, remaining: 6 }) }), T).length, 0);
  assert.equal(coachLowBalanceNotices(both, Date.parse(both.resetsAt)).length, 0);
});

test('terminal failed delivery stays distinct from a paid reply and expires without profile memory', async () => {
  const h = historyHarness(); await h.history.setOwner('A'); await h.history.append(message('failed'));
  await h.history.markFailed('failed', 'A');
  assert.equal(h.history.getState().messages[0]!.delivery, 'failed');
  await h.history.setOwner('A'); assert.equal(h.history.getState().messages[0]!.delivery, 'failed');
  await assert.rejects(h.history.markFailed('failed', 'other-owner'));
  assert.equal(h.history.getState().messages.length, 1, 'marking a failure does not invent a reply');
  h.now(T + COACH_CHAT_LIFETIME_MS); assert.deepEqual(await h.history.prune(), []);
  assert.match(h.values.get('profile')!, /Run a 5K/);
});

// Execute the real screen handlers with controlled dependencies. This isolates
// race behavior without mocking the entire training-plan/navigation tree.
function screenHandlers(context: Record<string, any>) {
  const filename = 'app/(tabs)/coach/index.tsx', source = readFileSync(filename, 'utf8');
  const file = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const screen = file.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'CoachScreen') as ts.FunctionDeclaration;
  assert.ok(screen?.body);
  const declaration = (name: string) => {
    const node = screen.body!.statements.find(value => ts.isFunctionDeclaration(value) && value.name?.text === name);
    assert.ok(node, name); return node.getText(file);
  };
  const reset = screen.body.statements.find(node => ts.isExpressionStatement(node) && ts.isCallExpression(node.expression)
    && node.expression.expression.getText(file) === 'useEffect'
    && node.expression.arguments[1]?.getText(file) === '[chat.owner]') as ts.ExpressionStatement;
  assert.ok(reset && ts.isCallExpression(reset.expression));
  const resetBody = reset.expression.arguments[0]!.getText(file);
  const code = ts.transpileModule(`${declaration('sendMessage')}\n${declaration('recoverMessage')}\nconst resetOwner=${resetBody};\nmodule.exports={sendMessage,recoverMessage,resetOwner};`, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(code, { module, exports: module.exports, Error, Date, ...context });
  return module.exports as { sendMessage(): Promise<void>; recoverMessage(): Promise<void>; resetOwner(): void };
}
function handlerHarness() {
  const pending = deferred<void>(), appends: SavedCoachMessage[] = [], sends: any[] = [], state: Record<string, any> = {};
  let sequence = 0;
  const context = { input: 'My question', recoverable: null as SavedCoachMessage | null, inFlight: { current: false }, operation: { current: 0 },
    chat: { owner: 'A', ready: true, append: async (value: SavedCoachMessage) => { appends.push(value); await pending.promise; },
      prune: async () => [message('recover')], markFailed: async () => undefined },
    randomUUID: () => `request-${++sequence}`, setLoading: (value: boolean) => { state.loading = value; },
    setError: (value: string | null) => { state.error = value; }, setInput: (value: string) => { state.input = value; },
    setFocusAnalysisId: (value: string | null) => { state.focus = value; }, setCoachHealth: (value: unknown) => { state.health = value; },
    warnedBalances: { current: new Set(['A:private-warning']) },
    completeMessage: async (...args: any[]) => { sends.push(args); }, captureOwnerLease: () => ({ ownerUserId: 'A' }),
    ownerLeaseIsCurrent: () => true, coachUsage: { refresh: async () => undefined },
    recoverCoachReply: async () => ({ status: 'not_found' }), sanitizeCoachDisplayText: (value: string) => value,
  };
  return { context, pending, appends, sends, state, handlers: screenHandlers(context) };
}

test('real Send handler locks synchronously before persistence and preserves an unresolved receipt', async () => {
  const h = handlerHarness();
  const first = h.handlers.sendMessage(), second = h.handlers.sendMessage();
  assert.equal(h.appends.length, 1, 'a double tap cannot create a second charge identity');
  assert.equal(h.context.inFlight.current, true); assert.equal(h.sends.length, 0);
  h.pending.resolve(); await Promise.all([first, second]); assert.equal(h.sends.length, 1);
  const blocked = handlerHarness(); blocked.context.recoverable = message('recover');
  // The handler captures globals from the supplied context, so load the latest
  // unresolved state explicitly as a new render would.
  const handlers = screenHandlers(blocked.context); await handlers.sendMessage(); assert.equal(blocked.appends.length, 0);
});

test('real owner-reset callback cancels a waiting send and clears account-specific UI state', async () => {
  const h = handlerHarness(); const sending = h.handlers.sendMessage();
  h.handlers.resetOwner(); h.state.input = 'New owner draft';
  h.pending.resolve(); await sending;
  assert.equal(h.sends.length, 0); assert.equal(h.state.input, 'New owner draft');
  assert.equal(h.state.focus, null); assert.equal(h.state.health, null); assert.equal(h.state.loading, false);
  assert.equal(h.context.warnedBalances.current.size, 0); assert.equal(h.context.inFlight.current, false);
});

test('real recovery handler reuses the same unaccepted request identity rather than minting a new charge', async () => {
  const h = handlerHarness(); h.context.recoverable = message('recover');
  const handlers = screenHandlers(h.context); await handlers.recoverMessage();
  assert.equal(h.sends.length, 1); assert.equal(h.sends[0][0].id, 'recover'); assert.equal(h.appends.length, 0);
  assert.equal(h.context.inFlight.current, false);
});

test('failed-reply recovery cannot restore a previous owner question after a delayed status write', async () => {
  const h = handlerHarness(), writing = deferred<void>();
  h.context.recoverable = message('recover');
  h.context.recoverCoachReply = async () => ({ status: 'failed' });
  (h.context.chat as any).markFailed = async () => await writing.promise;
  const handlers = screenHandlers(h.context), recovery = handlers.recoverMessage();
  await new Promise<void>(resolve => setImmediate(resolve));
  handlers.resetOwner(); h.state.input = 'New owner draft';
  writing.resolve(); await recovery;
  assert.equal(h.state.input, 'New owner draft'); assert.equal(h.state.error, null);
  assert.equal(h.context.inFlight.current, false);
});
