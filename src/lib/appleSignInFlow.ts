/** Apple credentials live only in this attempt; durable grant custody is server-only. */
export const APPLE_SIGN_IN_INCOMPLETE = 'Apple sign-in could not finish securely. Please try again. Your saved training history is unchanged.';

type AppleSession = { user: { id: string }; access_token: string };
type AppleCredential = { identityToken: string | null; authorizationCode: string | null; state: string | null };
export type AppleGrantBody = { authorizationCode: string; identityToken: string; nonce: string };
export type AppleSignInDependencies<S extends AppleSession> = {
  randomBytes: (count: number) => Promise<Uint8Array>;
  sha256: (value: string) => Promise<string>;
  authorize: (challenge: { nonce: string; state: string }) => Promise<AppleCredential>;
  current: () => boolean;
  exclusive: <T>(work: () => Promise<T>) => Promise<T>;
  authenticate: (credentials: { token: string; nonce: string }) => Promise<{ data: { session: S | null }; error: unknown }>;
  capture: (session: S, body: AppleGrantBody) => Promise<unknown>;
  commitSession: (session: S) => Promise<S>;
  discardPartialSession: (session: S) => Promise<void>;
};

function incomplete(): never { throw new Error(APPLE_SIGN_IN_INCOMPLETE); }
function secret(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 16_384 && !/[\r\n\0]/.test(value);
}

function sessionBinding(session: AppleSession): { issuer: string; id: string } | null {
  try {
    const parts = session.access_token.split('.');
    if (parts.length !== 3 || parts.some(part => !/^[A-Za-z0-9_-]+$/.test(part))) return null;
    const payload = parts[1];
    if (payload.length % 4 === 1) return null;
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    let value = 0, bits = 0, encoded = '';
    for (const char of payload) {
      value = (value << 6) | alphabet.indexOf(char); bits += 6;
      if (bits >= 8) {
        bits -= 8;
        encoded += '%' + ((value >> bits) & 255).toString(16).padStart(2, '0');
        value &= (1 << bits) - 1;
      }
    }
    if (value !== 0) return null;
    const claims = JSON.parse(decodeURIComponent(encoded));
    if (!claims || typeof claims !== 'object' || Array.isArray(claims) || claims.sub !== session.user.id
      || typeof claims.iss !== 'string' || !secret(claims.iss)
      || typeof claims.session_id !== 'string' || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(claims.session_id)
      || claims.session_id === '00000000-0000-0000-0000-000000000000') return null;
    return { issuer: claims.iss, id: claims.session_id.toLowerCase() };
  } catch { return null; }
}

/** Cleanup identity only: the SDK authenticates these sessions; decoded claims never authorize access. */
export function sameAppleSignInSession(expected: AppleSession, actual: AppleSession | null | undefined): boolean {
  if (!actual || actual.user.id !== expected.user.id || !secret(expected.access_token) || !secret(actual.access_token)) return false;
  if (actual.access_token === expected.access_token) return true;
  const before = sessionBinding(expected), after = sessionBinding(actual);
  return Boolean(before && after && before.issuer === after.issuer && before.id === after.id);
}

function hex(bytes: Uint8Array) {
  if (bytes.length !== 32) incomplete();
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

/** Native consent precedes the SDK exchange lock. Capture must finish before access is published. */
export async function signInWithCapturedAppleGrant<S extends AppleSession>(deps: AppleSignInDependencies<S>): Promise<S> {
  const requireCurrent = () => { if (!deps.current()) incomplete(); };
  const [nonceBytes, stateBytes] = await Promise.all([deps.randomBytes(32), deps.randomBytes(32)]);
  const nonce = hex(nonceBytes), state = hex(stateBytes);
  if (nonce === state) incomplete();
  const hashedNonce = await deps.sha256(nonce);
  if (!/^[0-9a-f]{64}$/.test(hashedNonce)) incomplete();
  requireCurrent();
  // Expo passes nonce through to Apple. Apple receives SHA-256; Supabase receives the raw nonce.
  const credential = await deps.authorize({ nonce: hashedNonce, state });
  requireCurrent();
  if (credential.state !== state || !secret(credential.identityToken) || !secret(credential.authorizationCode)) incomplete();
  return deps.exclusive(async () => {
    requireCurrent();
    const result = await deps.authenticate({ token: credential.identityToken!, nonce });
    const session = result.data.session;
    if (!session) incomplete();
    try {
      requireCurrent();
      if (result.error || !secret(session.access_token) || !session.user.id) incomplete();
      const captured = await deps.capture(session, { authorizationCode: credential.authorizationCode!, identityToken: credential.identityToken!, nonce });
      requireCurrent();
      if (!captured || typeof captured !== 'object' || Array.isArray(captured)
        || Object.keys(captured).length !== 1 || (captured as { captured?: unknown }).captured !== true) incomplete();
      const committed = await deps.commitSession(session);
      requireCurrent();
      if (committed.user.id !== session.user.id || !secret(committed.access_token)) incomplete();
      return committed;
    } catch {
      // Never sign out a newer attempt or remove an account/history as rollback.
      if (deps.current()) await deps.discardPartialSession(session).catch(() => undefined);
      incomplete();
    }
  });
}
