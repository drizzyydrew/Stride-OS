import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { APPLE_SIGN_IN_INCOMPLETE, sameAppleSignInSession, signInWithCapturedAppleGrant, type AppleSignInDependencies } from '../../src/lib/appleSignInFlow';

type Session = { user: { id: string }; access_token: string };
const session: Session = Object.freeze({ user: Object.freeze({ id: 'fixture-owner' }), access_token: 'fixture-access' });
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; }
function harness() {
  const calls: string[] = [];
  let draw = 0, current = true, depth = 0;
  const history = Object.freeze([{ id: 'keep-training-record' }]);
  let challenge: { nonce: string; state: string } | null = null;
  let rawNonce: string | null = null;
  const deps: AppleSignInDependencies<Session> = {
    randomBytes: async count => { calls.push('random'); return new Uint8Array(count).fill(++draw); },
    sha256: async value => createHash('sha256').update(value).digest('hex'),
    current: () => current,
    authorize: async options => { calls.push('native'); challenge = options; return { identityToken: 'fixture.identity.token', authorizationCode: 'fixture-code', state: options.state }; },
    exclusive: async work => { calls.push('exclusive'); depth++; try { return await work(); } finally { depth--; } },
    authenticate: async options => { assert.equal(depth, 1); calls.push('authenticate'); rawNonce = options.nonce; return { data: { session }, error: null }; },
    capture: async (created, body) => {
      assert.equal(depth, 1); assert.equal(created, session); calls.push('capture');
      assert.deepEqual(Object.keys(body).sort(), ['authorizationCode', 'identityToken', 'nonce']);
      assert.equal(body.nonce, rawNonce); assert.equal(body.identityToken, 'fixture.identity.token'); assert.equal(body.authorizationCode, 'fixture-code');
      return { captured: true };
    },
    commitSession: async created => { assert.equal(depth, 1); calls.push('commit'); return created; },
    discardPartialSession: async created => { assert.equal(depth, 1); assert.equal(created, session); calls.push('discard'); },
  };
  return { deps, calls, history, stale: () => { current = false; }, get challenge() { return challenge; }, get rawNonce() { return rawNonce; } };
}

test('partial-session cleanup binds rotated tokens to the same owner, issuer and Supabase session', () => {
  const sid = '11111111-1111-4111-8111-111111111111';
  const claims = {sub:'fixture-owner',iss:'https://fixture.supabase.co/auth/v1',session_id:sid,exp:1};
  const jwt = (payload: unknown) => `e30.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.signature`;
  const before = {user:{id:'fixture-owner'},access_token:jwt(claims)};
  const candidate = (payload: unknown) => ({user:{id:'fixture-owner'},access_token:jwt(payload)});
  assert.equal(sameAppleSignInSession(before,candidate({...claims,exp:3600,name:'Athlète'})),true);
  assert.equal(sameAppleSignInSession(before,before),true);
  for (const payload of [
    {...claims,session_id:'22222222-2222-4222-8222-222222222222'},
    {...claims,iss:'https://other.supabase.co/auth/v1'}, {...claims,sub:'another-owner'},
    {...claims,session_id:undefined}, {...claims,session_id:'00000000-0000-0000-0000-000000000000'},
    {...claims,session_id:'not-a-session'}, {...claims,iss:''}, [], null,
  ]) assert.equal(sameAppleSignInSession(before,candidate(payload)),false);
  assert.equal(sameAppleSignInSession(before,{user:{id:'another-owner'},access_token:before.access_token}),false);
  for (const token of ['malformed','e30.A.signature','e30._w.signature','e30.e30.signature.extra']) {
    assert.equal(sameAppleSignInSession(before,{...before,access_token:token}),false);
  }
  assert.equal(sameAppleSignInSession(before,null),false);
});

test('Apple sees a hashed per-attempt nonce/state; Supabase sees raw nonce; server custody precedes returned session', async () => {
  const h = harness(); const captured = deferred<unknown>(); let finished = false;
  h.deps.capture = async (_session, body) => { h.calls.push('capture'); assert.equal(body.nonce, h.rawNonce); return captured.promise; };
  const work = signInWithCapturedAppleGrant(h.deps).then(value => { finished = true; return value; });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(finished, false); assert.ok(h.rawNonce); assert.ok(h.challenge);
  assert.match(h.rawNonce!, /^[0-9a-f]{64}$/); assert.notEqual(h.challenge!.state, h.rawNonce);
  assert.equal(h.challenge!.nonce, createHash('sha256').update(h.rawNonce!).digest('hex'));
  assert.deepEqual(h.calls, ['random', 'random', 'native', 'exclusive', 'authenticate', 'capture']);
  captured.resolve({ captured: true }); assert.equal(await work, session);
  assert.equal(h.calls.at(-1), 'commit');
  assert.equal(h.history[0].id, 'keep-training-record');
});

test('bad state, missing tokens and malformed credentials never exchange or create a session', async () => {
  for (const alter of [
    (state: string) => ({ state: state+'x', identityToken: 'id', authorizationCode: 'code' }),
    (state: string) => ({ state, identityToken: null, authorizationCode: 'code' }),
    (state: string) => ({ state, identityToken: 'id', authorizationCode: null }),
    (state: string) => ({ state, identityToken: 'id\nprivate', authorizationCode: 'code' }),
    (state: string) => ({ state, identityToken: 'id', authorizationCode: 'x'.repeat(16_385) }),
  ]) {
    const h = harness(); h.deps.authorize = async ({ state }) => alter(state);
    await assert.rejects(signInWithCapturedAppleGrant(h.deps), { message: APPLE_SIGN_IN_INCOMPLETE });
    assert.ok(!h.calls.includes('authenticate')); assert.ok(!h.calls.includes('capture')); assert.ok(!h.calls.includes('discard'));
  }
});

test('entropy/digest failure fails before native authorization', async () => {
  for (const mode of ['length','repeat','digest'] as const) {
    const h = harness();
    if (mode === 'length') h.deps.randomBytes = async () => new Uint8Array(1);
    if (mode === 'repeat') h.deps.randomBytes = async () => new Uint8Array(32).fill(1);
    if (mode === 'digest') h.deps.sha256 = async () => 'not-a-digest';
    await assert.rejects(signInWithCapturedAppleGrant(h.deps), { message: APPLE_SIGN_IN_INCOMPLETE });
    assert.ok(!h.calls.includes('native')); assert.ok(!h.calls.includes('authenticate'));
  }
});

test('native cancellation propagates its code without exchanging credentials or cleaning retained data', async () => {
  const h = harness(); const cancelled = { code: 'ERR_REQUEST_CANCELED' }; h.deps.authorize = async () => { throw cancelled; };
  await assert.rejects(signInWithCapturedAppleGrant(h.deps), error => error === cancelled);
  assert.ok(!h.calls.includes('authenticate')); assert.ok(!h.calls.includes('discard')); assert.equal(h.history.length, 1);
});

test('grant failure or an unexpected response never reports successful sign-in; partial-session cleanup is local only', async () => {
  for (const response of [null, {}, { captured: false }, { captured: true, refresh_token: 'never-expected' }, 'yes', []]) {
    const h = harness(); h.deps.capture = async () => response;
    await assert.rejects(signInWithCapturedAppleGrant(h.deps), { message: APPLE_SIGN_IN_INCOMPLETE });
    assert.deepEqual(h.calls.filter(x => x === 'discard'), ['discard']); assert.equal(h.history[0].id, 'keep-training-record');
    assert.ok(!h.calls.includes('commit'));
  }
  const h = harness(); h.deps.capture = async () => { throw new Error('private-provider-body'); };
  h.deps.discardPartialSession = async () => { h.calls.push('discard'); throw new Error('private-storage-error'); };
  await assert.rejects(signInWithCapturedAppleGrant(h.deps), { message: APPLE_SIGN_IN_INCOMPLETE });
  assert.equal(h.calls.filter(x => x === 'discard').length, 1);
});

test('an auth error with a partial session is cleaned up; no-session failure leaves existing custody/history untouched', async () => {
  const h = harness(); h.deps.authenticate = async () => ({ data: { session }, error: new Error('private-auth-error') });
  await assert.rejects(signInWithCapturedAppleGrant(h.deps), { message: APPLE_SIGN_IN_INCOMPLETE }); assert.ok(h.calls.includes('discard')); assert.ok(!h.calls.includes('capture'));
  const empty = harness(); empty.deps.authenticate = async () => ({ data: { session: null }, error: null });
  await assert.rejects(signInWithCapturedAppleGrant(empty.deps)); assert.ok(!empty.calls.includes('discard')); assert.ok(!empty.calls.includes('capture'));
});

test('logout/newer attempt during native consent never exchanges the late response', async () => {
  const h = harness(); const native = deferred<ReturnType<typeof Object>>();
  let state = ''; h.deps.authorize = async options => { state = options.state; return native.promise as never; };
  const work = signInWithCapturedAppleGrant(h.deps); await new Promise(resolve => setImmediate(resolve)); h.stale();
  native.resolve({ state, identityToken: 'id', authorizationCode: 'code' }); await assert.rejects(work);
  assert.ok(!h.calls.includes('authenticate')); assert.ok(!h.calls.includes('discard'));
});

test('logout during SDK exchange or custody never signs out a newer owner or returns the old session', async () => {
  for (const stage of ['authenticate','capture'] as const) {
    const h = harness(); const pause = deferred<void>();
    if (stage === 'authenticate') h.deps.authenticate = async () => { await pause.promise; return { data: { session }, error: null }; };
    else h.deps.capture = async () => { await pause.promise; return { captured: true }; };
    const work = signInWithCapturedAppleGrant(h.deps); await new Promise(resolve => setImmediate(resolve)); h.stale(); pause.resolve();
    await assert.rejects(work); assert.ok(!h.calls.includes('discard')); assert.equal(h.history.length, 1);
  }
});

test('a fresh retry gets a new nonce/state and native code rather than replaying a consumed authorization', async () => {
  const h = harness(); const states: string[] = [];
  h.deps.authorize = async ({ state }) => { states.push(state); return { state, identityToken: 'id', authorizationCode: 'code-'+states.length }; };
  h.deps.capture = async () => ({ captured: true });
  await signInWithCapturedAppleGrant(h.deps); await signInWithCapturedAppleGrant(h.deps);
  assert.equal(states.length, 2); assert.notEqual(states[0], states[1]);
});

test('failed or foreign session commit never returns access and invokes bounded cleanup', async () => {
  for (const foreign of [false, true]) {
    const h = harness(); h.deps.commitSession = async () => { if (!foreign) throw Error('private-persist-error'); return { user: { id: 'foreign-owner' }, access_token: 'foreign-token' }; };
    await assert.rejects(signInWithCapturedAppleGrant(h.deps), { message: APPLE_SIGN_IN_INCOMPLETE }); assert.ok(h.calls.includes('discard'));
  }
});
