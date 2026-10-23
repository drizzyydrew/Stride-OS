/** @param {unknown} value */
function isSentryDsn(value) {
  return typeof value === 'string' && value === value.trim()
    && /^https:\/\/[a-f0-9]{32}@[a-z0-9]+(?:-[a-z0-9]+)*(?:\.[a-z0-9]+(?:-[a-z0-9]+)*)*\.ingest\.(?:us\.|de\.)?sentry\.io\/[1-9]\d*$/i.test(value);
}
/** @param {unknown} value */
function isPostHogHost(value) {
  return value === 'https://us.i.posthog.com' || value === 'https://eu.i.posthog.com';
}
/** @param {unknown} value */
function isPostHogKey(value) {
  return typeof value === 'string' && value === value.trim()
    && /^phc_[a-z0-9_-]{20,}$/i.test(value) && !/placeholder|example|test_only/i.test(value);
}
module.exports = { isSentryDsn, isPostHogHost, isPostHogKey };
