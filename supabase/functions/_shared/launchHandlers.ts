export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};
export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}
export async function readJson(req: Request, maximumBytes = 65_536): Promise<unknown> {
  const reader = req.body?.getReader();
  if (!reader) throw new Error('Invalid request');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maximumBytes) { await reader.cancel(); throw new Error('Request too large'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const combined = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { combined.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(combined));
}
export type CoachMessage = { role: 'user' | 'assistant'; content: string };
export function activeProFromSubscriber(body: unknown, now = Date.now()): boolean {
  const value = body as { subscriber?: { entitlements?: { pro?: { product_identifier?: string; expires_date?: unknown; grace_period_expires_date?: unknown } } } } | null;
  const entitlement = value?.subscriber?.entitlements?.pro;
  return Boolean(entitlement && ['strideos_pro_monthly', 'strideos_pro_annual'].includes(entitlement.product_identifier ?? '')
    && [entitlement.expires_date, entitlement.grace_period_expires_date].some(date => typeof date === 'string' && Date.parse(date) > now));
}
export function validCoachPayload(value: unknown): value is { messages: CoachMessage[]; system: string; consentVersion: number } {
  if (!value || typeof value !== 'object') return false;
  const body = value as Record<string, unknown>;
  return body.consentVersion === 1 && typeof body.system === 'string' && body.system.trim().length > 0
    && body.system.length <= 5000 && Array.isArray(body.messages) && body.messages.length > 0 && body.messages.length <= 12
    && body.messages.every(message => message && typeof message === 'object'
      && (message.role === 'user' || message.role === 'assistant')
      && typeof message.content === 'string' && message.content.trim().length > 0 && message.content.length <= 4000);
}
export function createCoachHandler(deps: {
  authenticate(req: Request): Promise<string | null>;
  configured(): boolean;
  canUsePlan?(userId: string): Promise<boolean>;
  consumeAllowance(userId: string): Promise<boolean>;
  reply(payload: { messages: CoachMessage[]; system: string }, signal: AbortSignal): Promise<{ content: { type: 'text'; text: string }[] }>;
}) {
  return async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
    if (!['GET', 'POST'].includes(req.method)) return json({ error: 'Method not allowed' }, 405);
    try {
      const userId = await deps.authenticate(req);
      if (!userId) return json({ error: 'Please sign in again.' }, 401);
      if (req.method === 'GET') return json({ ok: deps.configured() });
      let body: unknown;
      try { body = await readJson(req); } catch { return json({ error: 'Invalid or oversized request.' }, 400); }
      if (!validCoachPayload(body)) return json({ error: 'AI sharing permission or message format is invalid. Update the app and review AI Coach Privacy.' }, 400);
      if (!deps.configured()) return json({ error: 'AI Coach is temporarily unavailable.' }, 503);
      if (deps.canUsePlan && !await deps.canUsePlan(userId)) return json({ error: 'An active StrideOS Pro subscription is required for AI Coach chat.' }, 402);
      if (!await deps.consumeAllowance(userId)) return json({ error: 'AI Coach has reached its daily request limit. Try again tomorrow; on-device Insights remain available.' }, 429);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 25_000);
      const cancel = () => controller.abort();
      req.signal.addEventListener('abort', cancel, { once: true });
      try {
        const messages = body.messages.map(({ role, content }) => ({ role, content }));
        return json(await deps.reply({ messages, system: body.system.trim() }, controller.signal));
      } finally { clearTimeout(timeout); req.signal.removeEventListener('abort', cancel); }
    } catch { return json({ error: 'AI Coach could not complete this request. Please try again later.' }, 503); }
  };
}
export function createDeletionRequestHandler(deps: {
  authenticate(req: Request): Promise<string | null>;
  read(userId: string): Promise<unknown>;
  request(userId: string): Promise<{ id: string; requested_at: string; status: string }>;
}) {
  return async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
    if (!['GET', 'POST'].includes(req.method)) return json({ error: 'Method not allowed' }, 405);
    try {
      const userId = await deps.authenticate(req);
      if (!userId) return json({ error: 'Sign in to request account deletion.' }, 401);
      if (req.method === 'GET') return json({ request: await deps.read(userId) });
      let body: unknown;
      try { body = await readJson(req, 1024); } catch { return json({ error: 'Invalid request.' }, 400); }
      if (!body || typeof body !== 'object' || (body as Record<string, unknown>).confirmation !== 'DELETE MY STRIDEOS ACCOUNT') return json({ error: 'Account deletion must be explicitly confirmed.' }, 400);
      const request = await deps.request(userId);
      return json({ request, complete: false }, 202);
    } catch { return json({ error: 'The deletion request could not be recorded. Nothing has been deleted. Please retry.' }, 503); }
  };
}
