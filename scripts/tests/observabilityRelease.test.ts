import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
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
for (const profile of ['production', 'billing-qa']) {
  test(`${profile} guard rejects missing, malformed, placeholder, and upload-bypass configuration without printing values`, () => {
    assert.equal(run({ EAS_BUILD_PROFILE: profile }).status, 0);
    for (const patch of [
      { EXPO_PUBLIC_SENTRY_DSN: 'invalid-secret-dsn' }, { EXPO_PUBLIC_POSTHOG_API_KEY: 'your-secret-project-key' },
      { SENTRY_ORG: 'your-organization' }, { SENTRY_PROJECT: '' }, { SENTRY_AUTH_TOKEN: 'short-secret' },
      { SENTRY_DISABLE_AUTO_UPLOAD: '1' }, { SENTRY_ALLOW_FAILURE: 'true' },
      Object.fromEntries(Object.keys(fixture).filter(key => key !== 'EAS_BUILD_PROFILE').map(key => [key, ''])),
    ]) {
      const result = run({ ...patch, EAS_BUILD_PROFILE: profile }); assert.equal(result.status, 1);
      const output = result.stdout + result.stderr;
      for (const value of Object.values(patch).filter(value => value.length > 4)) assert.ok(!output.includes(value));
      assert.ok(!output.includes(fixture.SENTRY_AUTH_TOKEN));
    }
  });
}

test('billing QA is a store-only profile inheriting production validation, image and environment without OTA', () => {
  const eas = JSON.parse(readFileSync('eas.json', 'utf8'));
  assert.deepEqual(eas.build['billing-qa'], {
    extends: 'production', distribution: 'store', env: { EXPO_PUBLIC_STRIDEOS_BILLING_ENABLED: 'true' },
  });
  assert.equal(eas.build.production.environment, 'production');
  assert.equal(eas.build.production.ios.image, 'macos-tahoe-26.5-xcode-26.6');
  assert.notEqual(eas.build.production.env?.EXPO_PUBLIC_STRIDEOS_BILLING_ENABLED, 'true');
  assert.equal(eas.build.production.channel, undefined);
  const app = JSON.parse(readFileSync('app.json', 'utf8')).expo;
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  assert.equal(app.updates?.url, undefined);
  assert.equal(pkg.dependencies['expo-updates'], undefined);
  assert.equal(pkg.scripts['eas-build-pre-install'], 'node scripts/check-observability-release.cjs');
});
