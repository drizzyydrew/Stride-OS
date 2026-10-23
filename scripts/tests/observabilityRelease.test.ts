import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { isPostHogHost, isPostHogKey, isSentryDsn } from '../../src/utils/observabilityConfig.cjs';

const fixture = {
  EAS_BUILD_PROFILE: 'production', EXPO_PUBLIC_POSTHOG_API_KEY: `phc_${'a'.repeat(32)}`,
  EXPO_PUBLIC_POSTHOG_HOST: 'https://us.i.posthog.com', EXPO_PUBLIC_SENTRY_DSN: `https://${'a'.repeat(32)}@o1.ingest.us.sentry.io/1`,
  SENTRY_ORG: 'synthetic-org', SENTRY_PROJECT: 'synthetic-app', SENTRY_AUTH_TOKEN: 'synthetic-build-secret-not-a-real-token',
};
function run(patch: Record<string, string>) {
  return spawnSync(process.execPath, ['scripts/check-observability-release.cjs'], {
    env: { ...fixture, ...patch }, encoding: 'utf8', timeout: 10000,
  });
}
test('runtime validators accept the supported ingestion regions and reject placeholders and foreign destinations', () => {
  for (const region of ['us', 'de', '']) assert.equal(isSentryDsn(`https://${'a'.repeat(32)}@o1.ingest.${region ? `${region}.` : ''}sentry.io/1`), true);
  for (const bad of ['', 'malformed', 'https://your_key@o1.ingest.us.sentry.io/1', `https://${'a'.repeat(32)}@evil.example/1`,
    `https://${'a'.repeat(32)}@o1..ingest.us.sentry.io/1`, `${fixture.EXPO_PUBLIC_SENTRY_DSN}\n`]) assert.equal(isSentryDsn(bad), false);
  assert.equal(isPostHogHost('https://us.i.posthog.com'), true); assert.equal(isPostHogHost('https://eu.i.posthog.com'), true);
  assert.equal(isPostHogHost('https://us.i.posthog.com.evil.example'), false);
  assert.equal(isPostHogKey(fixture.EXPO_PUBLIC_POSTHOG_API_KEY), true); assert.equal(isPostHogKey('phc_test_only'), false);
});
test('production guard rejects missing, malformed, placeholder, and upload-bypass configuration without printing values', () => {
  assert.equal(run({}).status, 0);
  for (const patch of [
    { EXPO_PUBLIC_SENTRY_DSN: 'invalid-secret-dsn' }, { EXPO_PUBLIC_POSTHOG_API_KEY: 'your-secret-project-key' },
    { SENTRY_ORG: 'your-organization' }, { SENTRY_PROJECT: '' }, { SENTRY_AUTH_TOKEN: 'short-secret' },
    { SENTRY_DISABLE_AUTO_UPLOAD: '1' }, { SENTRY_ALLOW_FAILURE: 'true' },
  ]) {
    const result = run(patch); assert.equal(result.status, 1);
    const output = result.stdout + result.stderr;
    for (const value of Object.values(patch).filter(value => value.length > 4)) assert.ok(!output.includes(value));
    assert.ok(!output.includes(fixture.SENTRY_AUTH_TOKEN));
  }
});
