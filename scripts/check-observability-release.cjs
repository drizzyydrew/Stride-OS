const required = ['EXPO_PUBLIC_POSTHOG_API_KEY', 'EXPO_PUBLIC_POSTHOG_HOST', 'EXPO_PUBLIC_SENTRY_DSN', 'SENTRY_ORG', 'SENTRY_PROJECT', 'SENTRY_AUTH_TOKEN'];
const { isSentryDsn, isPostHogHost, isPostHogKey } = require('../src/utils/observabilityConfig.cjs');
if (process.env.EAS_BUILD_PROFILE === 'production') {
  const missing = required.filter(name => !process.env[name]?.trim());
  if (missing.length) {
    console.error(`Release blocked: configure ${missing.join(', ')} in the production EAS environment. Values were not printed.`);
    process.exit(1);
  }
  const invalid = [];
  if (!isPostHogHost(process.env.EXPO_PUBLIC_POSTHOG_HOST)) invalid.push('EXPO_PUBLIC_POSTHOG_HOST');
  if (!isPostHogKey(process.env.EXPO_PUBLIC_POSTHOG_API_KEY)) invalid.push('EXPO_PUBLIC_POSTHOG_API_KEY');
  if (!isSentryDsn(process.env.EXPO_PUBLIC_SENTRY_DSN)) invalid.push('EXPO_PUBLIC_SENTRY_DSN');
  for (const key of ['SENTRY_ORG', 'SENTRY_PROJECT']) {
    if (process.env[key] !== process.env[key].trim() || !/^[a-z0-9]+(?:[-_][a-z0-9]+)*$/i.test(process.env[key]) || /^(your[-_]|example|placeholder|changeme)/i.test(process.env[key])) invalid.push(key);
  }
  if (process.env.SENTRY_AUTH_TOKEN.length < 20 || /\s/.test(process.env.SENTRY_AUTH_TOKEN) || /^(your[-_]|example|placeholder|changeme)/i.test(process.env.SENTRY_AUTH_TOKEN)) invalid.push('SENTRY_AUTH_TOKEN');
  for (const key of ['SENTRY_DISABLE_AUTO_UPLOAD', 'SENTRY_ALLOW_FAILURE']) if (process.env[key]) invalid.push(key);
  if (invalid.length) {
    console.error(`Release blocked: invalid or incompatible ${invalid.join(', ')}. Values were not printed.`);
    process.exit(1);
  }
  console.log('Observability release configuration is present. Vendor ingestion and source-map verification are separate gates.');
}
