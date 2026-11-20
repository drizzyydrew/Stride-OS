/** Public copy only: never render provider payloads, URLs or status dumps. */
export function signInErrorMessage(error: unknown): string {
  let value = error;
  let message = typeof value === 'string' ? value : '';
  if (value && typeof value === 'object' && 'message' in value && typeof value.message === 'string') message = value.message;
  // Auth can wrap an HTTP response summary as an Error.message string.
  if (message.length <= 16_384 && /^\s*\{/.test(message)) {
    try { const parsed = JSON.parse(message); if (parsed && typeof parsed === 'object') value = parsed; } catch { /* use safe fallback */ }
  }
  const record = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const status = Number(record.status ?? record.statusCode);
  const code = typeof record.code === 'string' ? record.code.toLowerCase() : '';
  const name = typeof record.name === 'string' ? record.name : '';
  if (status >= 500 && status <= 599) return 'Sign-in is temporarily unavailable. Please try again shortly.';
  if (status === 429 || /over_.*rate_limit|too_many_requests/.test(code) || /too many requests|rate limit/i.test(message)) {
    return 'Too many sign-in attempts. Please wait a little and try again.';
  }
  if (name === 'AuthRetryableFetchError' || /failed to fetch|network request failed|network error|timed? ?out|offline|load failed/i.test(message)) {
    return 'Unable to connect. Check your internet connection and try again.';
  }
  if (code === 'invalid_credentials' || /invalid login credentials|invalid (email|password|username)|incorrect (email|password)/i.test(message)) {
    return 'Invalid email or password. Please try again.';
  }
  if (code === 'email_not_confirmed' || /email not confirmed|confirm your email|email.*not.*verif/i.test(message)) {
    return 'Please confirm your email before signing in.';
  }
  if (/temporarily unavailable/i.test(message)) return 'Sign-in is temporarily unavailable. Please try again shortly.';
  return 'We could not sign you in. Please try again.';
}
