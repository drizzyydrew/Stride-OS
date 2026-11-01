import { CORS, json, readJson } from './launchHandlers.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SECRET = /^[0-9a-f]{64}$/;
export type DeletionIdentity = { provider: string; provider_id?: string; identity_data?: { sub?: string } };
export type DeletionUser = { id: string; identities?: DeletionIdentity[] };
export type InitialProviderToken = { kind: 'google_access_token' | 'apple_authorization_code'; secret: string; subject: string };
type Receipt = { id: string; requested_at: string; status: 'pending' | 'processing' | 'completed'; completed_at?: string | null;
  provider_actions: { provider: 'apple' | 'google'; status: 'revoked' | 'manual_required' | 'pending'; reason: string }[] };

export function publicDeletionReceipt(value: unknown): Receipt | null {
  if (value === null) return null;
  const r = value as Record<string, unknown>;
  if (!r || !UUID.test(String(r.id)) || typeof r.requested_at !== 'string' || !Number.isFinite(Date.parse(r.requested_at))
    || !['pending', 'processing', 'completed'].includes(String(r.status))
    || (r.status === 'completed' && (typeof r.completed_at !== 'string' || !Number.isFinite(Date.parse(r.completed_at))))) {
    throw new Error('Invalid deletion receipt');
  }
  const dispositions = r.provider_dispositions as Record<string, unknown> | undefined;
  const provider_actions: Receipt['provider_actions'] = [];
  for (const provider of ['apple', 'google'] as const) {
    const status = dispositions?.[provider];
    if (status === 'revoked' || status === 'manual_required') provider_actions.push({ provider, status,
      reason: status === 'revoked' ? 'provider_confirmed' : 'legacy_token_unavailable' });
    else {
      const pending = Array.isArray(r.provider_actions) ? r.provider_actions.find(a => a && a.provider === provider && a.status === 'pending') : null;
      if (pending) provider_actions.push({ provider, status: 'pending', reason:
        ['configuration_unavailable', 'provider_failure', 'credential_refresh_required', 'provider_retry_requested'].includes(pending.reason)
          ? pending.reason : 'not_prepared' });
    }
  }
  return { id: r.id as string, requested_at: r.requested_at, status: r.status as Receipt['status'],
    ...(typeof r.completed_at === 'string' ? { completed_at: r.completed_at } : {}), provider_actions };
}

export async function deletionSecretHash(secret: string): Promise<string> {
  if (!SECRET.test(secret)) throw new Error('Invalid receipt secret');
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
}

function initialTokens(value: unknown, user: DeletionUser): InitialProviderToken[] {
  if (value === undefined) return [];
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid provider credentials');
  const tokens = value as Record<string, unknown>;
  if (Object.keys(tokens).some(key => !['google', 'appleAuthorizationCode'].includes(key))) throw new Error('Invalid provider credentials');
  return Object.entries(tokens).map(([key, secret]) => {
    if (typeof secret !== 'string' || !secret || secret.length > 16_384 || /[\r\n\0]/.test(secret)) throw new Error('Invalid provider credentials');
    const provider = key === 'google' ? 'google' : 'apple';
    const identities = user.identities?.filter(identity => identity.provider === provider) ?? [];
    const subject = identities.length === 1 ? identities[0]!.provider_id ?? identities[0]!.identity_data?.sub : null;
    if (!subject) throw new Error('Provider identity does not match');
    return { kind: key === 'google' ? 'google_access_token' : 'apple_authorization_code', secret, subject };
  });
}

export type DeletionHandlersDependencies = {
  authenticate(req: Request): Promise<DeletionUser | null>;
  readAuthenticated(userId: string): Promise<unknown>;
  requestLegacy(userId: string): Promise<unknown>;
  automationEnabled(userId: string): Promise<boolean>;
  capabilities(): { appleCodeExchange: boolean; googleTokenRevoke: boolean };
  start(userId: string, hash: string, tokens: InitialProviderToken[]): Promise<unknown>;
  refresh(userId: string, hash: string, tokens: InitialProviderToken[]): Promise<unknown>;
  readReceipt(id: string | null, secret: string): Promise<unknown>;
  enqueue(id: string): Promise<void>;
};

export function createDeletionAccountHandler(deps: DeletionHandlersDependencies) {
  return async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
    if (!['GET', 'POST'].includes(req.method)) return json({ error: 'Method not allowed' }, 405);
    try {
      const user = await deps.authenticate(req);
      if (!user || !UUID.test(user.id)) return json({ error: 'Sign in to request account deletion.' }, 401);
      if (req.method === 'GET') {
        const saved = await deps.readAuthenticated(user.id);
        return json({ request: publicDeletionReceipt(saved), capabilities: {
          automaticProcessing: await deps.automationEnabled(user.id), ...deps.capabilities(),
          providerCredentialRefreshReady: Boolean(saved && typeof saved === 'object'
            && (saved as Record<string, unknown>).provider_credential_refresh_ready === true),
        } });
      }
      let body: Record<string, unknown>;
      try { body = await readJson(req, 40_000) as Record<string, unknown>; }
      catch { return json({ error: 'Invalid deletion request.' }, 400); }
      if (!body || body.confirmation !== 'DELETE MY STRIDEOS ACCOUNT') return json({ error: 'Account deletion must be explicitly confirmed.' }, 400);
      if (body.receiptSecret === undefined) {
        return json({ request: publicDeletionReceipt(await deps.requestLegacy(user.id)), complete: false }, 202);
      }
      if (typeof body.receiptSecret !== 'string' || !SECRET.test(body.receiptSecret)) return json({ error: 'Invalid deletion receipt.' }, 400);
      if (!await deps.automationEnabled(user.id)) return json({ error: 'Automatic account deletion is temporarily unavailable. Please retry later.' }, 503);
      let tokens: InitialProviderToken[];
      try { tokens = initialTokens(body.providerTokens, user); }
      catch { return json({ error: 'Provider credentials do not match this account. Please retry.' }, 400); }
      if (body.refreshProviderCredentials !== undefined && typeof body.refreshProviderCredentials !== 'boolean') return json({ error: 'Invalid credential refresh request.' }, 400);
      if (body.refreshProviderCredentials === true && tokens.length === 0) return json({ error: 'Fresh provider credentials are required.' }, 400);
      const save = body.refreshProviderCredentials === true ? deps.refresh : deps.start;
      const request = publicDeletionReceipt(await save(user.id, await deletionSecretHash(body.receiptSecret), tokens));
      if (!request) throw new Error('Missing receipt');
      // Background scheduling failure does not erase an already-confirmed request.
      // The independently configured scheduler retains recovery authority.
      await deps.enqueue(request.id).catch(() => undefined);
      return json({ request, complete: request.status === 'completed' }, 202);
    } catch { return json({ error: 'Deletion could not be confirmed. Keep the saved receipt and retry safely.' }, 503); }
  };
}

export function createDeletionReceiptHandler(deps: Pick<DeletionHandlersDependencies, 'readReceipt' | 'enqueue'>) {
  return async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
    try {
      const body = await readJson(req, 1024) as Record<string, unknown>;
      if (!body || (body.requestId !== undefined && body.requestId !== null
        && (typeof body.requestId !== 'string' || !UUID.test(body.requestId)))
        || typeof body.receiptSecret !== 'string' || !SECRET.test(body.receiptSecret)) return json({ error: 'Receipt unavailable.' }, 404);
      const request = publicDeletionReceipt(await deps.readReceipt(typeof body.requestId === 'string' ? body.requestId : null, body.receiptSecret));
      if (!request) return json({ error: 'Receipt unavailable.' }, 404);
      if (request.status !== 'completed') await deps.enqueue(request.id).catch(() => undefined);
      return json({ request });
    } catch { return json({ error: 'Deletion status is unavailable. Keep the saved receipt and retry.' }, 503); }
  };
}

export function createDeletionWorkerHandler(deps: {
  consume(id: string, ticket: string): Promise<boolean>;
  schedule(id: string): void;
}) {
  return async (req: Request): Promise<Response> => {
    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
    try {
      const body = await readJson(req, 1024) as Record<string, unknown>;
      if (!body || typeof body.requestId !== 'string' || !UUID.test(body.requestId)
        || typeof body.jobTicket !== 'string' || !SECRET.test(body.jobTicket)
        || !await deps.consume(body.requestId, body.jobTicket)) return json({ error: 'Unauthorized worker request.' }, 401);
      deps.schedule(body.requestId);
      return json({ accepted: true }, 202);
    } catch { return json({ error: 'Worker request could not be accepted.' }, 503); }
  };
}
