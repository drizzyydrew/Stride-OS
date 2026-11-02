import { CORS, json, readJson } from './launchHandlers.ts';

export type AppleGrantUser = { id: string; identities?: { provider: string; provider_id?: string; identity_data?: { sub?: string } }[] };
export type AppleGrantIdentity = { sub?: string; aud?: string | string[]; iss?: string; exp?: number; nonce?: string };
export type AppleGrantTokens = { refresh_token: string; access_token: string; id_token: string; token_type: 'Bearer'; expires_in: number };
export type AppleGrantDependencies = {
  authenticate(req: Request): Promise<AppleGrantUser | null>;
  clientId(): string | undefined;
  clientSecret(): Promise<string>;
  verifyIdentity(token: string, audience: string): Promise<AppleGrantIdentity>;
  captured(owner: string, subject: string, audience: string, codeHash: string): Promise<boolean>;
  reserve(owner: string, subject: string, audience: string, codeHash: string): Promise<string | null>;
  uncertain(captureId: string): Promise<void>;
  store(owner: string, subject: string, audience: string, codeHash: string, tokens: AppleGrantTokens, captureId: string): Promise<boolean>;
  fetch: typeof fetch;
  now?: () => number;
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const safe = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 16_384 && !/[\r\n\0]/.test(value);
const failure = () => json({ error: 'Apple authorization could not be secured. Retry with a fresh Apple sign-in.' }, 503);

export async function appleGrantHash(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}
function assertIdentity(identity: AppleGrantIdentity, audience: string, subject: string, nonce: string, requiredNonce: boolean, now: number) {
  // The JWKS adapter verifies cryptography; retain explicit claim checks in the core as well.
  if (identity.iss !== 'https://appleid.apple.com' || identity.aud !== audience || identity.sub !== subject
    || !Number.isSafeInteger(identity.exp) || identity.exp! <= Math.floor(now / 1000)
    || (requiredNonce || identity.nonce !== undefined) && identity.nonce !== nonce) throw new Error('Apple identity mismatch');
}
export function createAppleGrantHandler(deps: AppleGrantDependencies) {
  return async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
    let captureId: string | null = null;
    try {
      if (!/^Bearer [^\s]+$/i.test(req.headers.get('authorization') ?? '')) return failure();
      const user = await deps.authenticate(req);
      if (!user || !UUID.test(user.id)) return failure();
      const body = await readJson(req, 40_000) as Record<string, unknown>;
      if (!body || Array.isArray(body) || Object.keys(body).length !== 3
        || Object.keys(body).some(key => !['authorizationCode', 'identityToken', 'nonce'].includes(key))
        || !safe(body.authorizationCode) || !safe(body.identityToken)
        || typeof body.nonce !== 'string' || !/^[0-9a-f]{64}$/.test(body.nonce)) return failure();
      const apple = user.identities?.filter(identity => identity.provider === 'apple') ?? [];
      if (apple.length !== 1) return failure();
      const identity = apple[0]!;
      const subject = identity.identity_data?.sub ?? identity.provider_id;
      if (!safe(subject) || subject.length > 512 || identity.provider_id && identity.provider_id !== subject) return failure();
      const audience = deps.clientId();
      if (!safe(audience) || audience.length > 255) return failure();
      const nonce = await appleGrantHash(body.nonce);
      assertIdentity(await deps.verifyIdentity(body.identityToken, audience), audience, subject, nonce, true, (deps.now ?? Date.now)());
      const hash = await appleGrantHash(body.authorizationCode);
      // RPC checks the live identity and deletion boundary under the auth-user lock.
      if (await deps.captured(user.id, subject, audience, hash)) return json({ captured: true });
      // Resolve configuration before reserving. Once reserved, ANY exchange or
      // persistence ambiguity remains durable; no timeout proves no issuance.
      const clientSecret = await deps.clientSecret();
      captureId = await deps.reserve(user.id, subject, audience, hash);
      if (!captureId || !UUID.test(captureId)) return failure();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10_000);
      let tokens: AppleGrantTokens;
      try {
        const response = await deps.fetch('https://appleid.apple.com/auth/token', {
          method: 'POST', redirect: 'error', signal: controller.signal,
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ client_id: audience, client_secret: clientSecret,
            code: body.authorizationCode, grant_type: 'authorization_code' }).toString(),
        });
        if (!response.ok) { await response.body?.cancel(); throw new Error('Apple exchange uncertain'); }
        const value = await readJson(response, 65_536) as Record<string, unknown>;
        if (!value || !safe(value.refresh_token) || !safe(value.access_token) || !safe(value.id_token)
          || value.token_type !== 'Bearer' || !Number.isSafeInteger(value.expires_in) || (value.expires_in as number) <= 0) throw new Error('Apple exchange uncertain');
        // Deliberately allowlist the complete supported token response, never arbitrary provider fields.
        tokens = { refresh_token: value.refresh_token, access_token: value.access_token, id_token: value.id_token,
          token_type: 'Bearer', expires_in: value.expires_in as number };
      } finally { clearTimeout(timer); }
      assertIdentity(await deps.verifyIdentity(tokens.id_token, audience), audience, subject, nonce, false, (deps.now ?? Date.now)());
      if (!await deps.store(user.id, subject, audience, hash, tokens, captureId)) throw new Error('Apple custody uncertain');
      return json({ captured: true });
    } catch {
      // If this write fails, the original reserved state remains unresolved.
      // A lost successful store acknowledgement must not downgrade completion.
      if (captureId) await deps.uncertain(captureId).catch(() => undefined);
      return failure();
    }
  };
}
