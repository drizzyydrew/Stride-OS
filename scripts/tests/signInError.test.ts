import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { signInErrorMessage } from '../../src/lib/signInError';

test('wrong credentials use one clear message without revealing which credential is wrong', () => {
  for (const error of [{ code: 'invalid_credentials', status: 400, message: 'Invalid login credentials' },
    new Error('Invalid login credentials'), 'Invalid email or password', { message: 'Incorrect password' }]) {
    assert.equal(signInErrorMessage(error), 'Invalid email or password. Please try again.');
  }
});

test('the reported 522 response is a service problem, never an incorrect-password claim or raw payload', () => {
  const payload = JSON.stringify({ status: 522, statusText: 'server error', redirected: false, url: 'https://private.invalid/auth/v1/token?grant_type=password' });
  for (const error of [payload, new Error(payload), { status: 522, message: payload }, { status: 503, code: 'invalid_credentials' }]) {
    assert.equal(signInErrorMessage(error), 'Sign-in is temporarily unavailable. Please try again shortly.');
  }
});

test('network, rate-limit and confirmation failures each give a useful next action', () => {
  assert.match(signInErrorMessage(new Error('Network request failed')), /internet connection/);
  assert.match(signInErrorMessage({ name: 'AuthRetryableFetchError', message: 'fetch' }), /internet connection/);
  assert.match(signInErrorMessage({ status: 429 }), /wait a little/);
  assert.match(signInErrorMessage({ code: 'over_request_rate_limit' }), /wait a little/);
  assert.match(signInErrorMessage({ code: 'email_not_confirmed' }), /confirm your email/);
});

test('unknown provider data cannot leak secrets, endpoint URLs or serialized diagnostics', () => {
  for (const error of [null, undefined, {}, new Error('https://private.invalid/?token=private-value'),
    '<html>private data</html>', '{bad JSON', { status: 401, message: 'private identity' }]) {
    assert.equal(signInErrorMessage(error), 'We could not sign you in. Please try again.');
  }
});

test('credential result and thrown-error branches use safe copy without changing ownership/session decisions', () => {
  const store = readFileSync('src/store/authStore.ts', 'utf8');
  const signIn = store.slice(store.indexOf('  signIn: async'), store.indexOf('  signUp: async'));
  assert.match(signIn, /return error \? signInErrorMessage\(error\) : await finishExplicitSignIn\(data.session, attempt\)/);
  assert.match(signIn, /STALE_AUTH_ATTEMPT : signInErrorMessage\(error\)/);
  assert.doesNotMatch(signIn, /return error\?\.message|instanceof Error \? error.message/);
});
