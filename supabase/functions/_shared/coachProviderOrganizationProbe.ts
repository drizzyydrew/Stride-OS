import { readJson } from './launchHandlers.ts';

const PROVIDER_ORGANIZATION_URL = 'https://api.anthropic.com/v1/organizations/me';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function sameSecret(received: string, expected: string) {
  // Exact fixed-size digests bind one existing key; ordinary JWTs do not match.
  const a = new TextEncoder().encode(received);
  const b = new TextEncoder().encode(expected);
  let mismatch = a.length ^ b.length;
  for (let i = 0; i < b.length; i++) mismatch |= (a[i] ?? 0) ^ b[i];
  return mismatch === 0;
}
function result(status: number, providerHttpStatus: number | null = null, organizationId: string | null = null) {
  return new Response(JSON.stringify({ providerHttpStatus, organizationId }), {
    status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

/** Temporary metadata diagnostic. Deploy with gateway JWT verification ON; remove after one check. */
export function createCoachProviderOrganizationProbe(deps: {
  serviceRoleKeySha256: string | undefined;
  providerKey: string | undefined;
  fetch?: typeof fetch;
}) {
  return async (request: Request): Promise<Response> => {
    if (request.method !== 'GET') return result(405);
    const token = request.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
    const expected = deps.serviceRoleKeySha256;
    if (!token || !expected || !/^[0-9a-f]{64}$/.test(expected)) return result(401);
    // Expected digest comes only from the reviewed deployment bundle, never a request or claim.
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
    const received = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
    if (!sameSecret(received, expected)) return result(401);
    if (!deps.providerKey) return result(503);
    let providerHttpStatus: number | null = null;
    try {
      const response = await (deps.fetch ?? fetch)(PROVIDER_ORGANIZATION_URL, {
        method: 'GET', redirect: 'error', signal: AbortSignal.timeout(10_000),
        headers: { Authorization: `Bearer ${deps.providerKey}`, 'anthropic-version': '2026-10-21', Accept: 'application/json' },
      });
      providerHttpStatus = response.status;
      if (response.status !== 200) {
        try { await response.body?.cancel(); } catch { /* keep provider body private */ }
        return result(502, providerHttpStatus);
      }
      const value = await readJson(response, 16_384);
      if (!value || typeof value !== 'object' || Array.isArray(value)) return result(502, providerHttpStatus);
      const organization = value as Record<string, unknown>;
      if (organization.type !== 'organization' || typeof organization.id !== 'string'
        || organization.id.length !== 36 || !UUID.test(organization.id)) return result(502, providerHttpStatus);
      return result(200, providerHttpStatus, organization.id);
    } catch {
      // No raw provider response, account name, secret, prefix, length or error detail.
      return result(502, providerHttpStatus);
    }
  };
}
