import { json, readJson } from './launchHandlers.ts';
import { COACH_PACK_PRODUCT } from './coachV2.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export type CoachPackEvent = { owner: string; transactionId: string; purchasedAt: string; refund: boolean };
export async function sameCoachSecret(actual: string, expected: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [a, b] = await Promise.all([actual, expected].map(value => crypto.subtle.digest('SHA-256', encoder.encode(value))));
  let mismatch = 0;
  const first = new Uint8Array(a), second = new Uint8Array(b);
  for (let i = 0; i < first.length; i++) mismatch |= first[i] ^ second[i];
  return mismatch === 0;
}
export function parseCoachPackEvent(value: unknown, appId: string, now = Date.now()): CoachPackEvent | null {
  if (!value || typeof value !== 'object') return null;
  const body = value as { api_version?: unknown; event?: Record<string, unknown> };
  const event = body.event;
  if (body.api_version !== '1.0' || !event || event.app_id !== appId || event.product_id !== COACH_PACK_PRODUCT
    || event.store !== 'APP_STORE' || event.environment !== 'PRODUCTION'
    || typeof event.app_user_id !== 'string' || !UUID.test(event.app_user_id)
    || typeof event.transaction_id !== 'string' || !/^[A-Za-z0-9._:-]{1,128}$/.test(event.transaction_id)
    || !Number.isSafeInteger(event.purchased_at_ms) || Number(event.purchased_at_ms) < Date.UTC(2026, 0, 1)
    || Number(event.purchased_at_ms) > now + 300_000
    || event.is_family_share === true || event.quantity !== undefined && event.quantity !== 1) return null;
  const refund = event.type === 'CANCELLATION' && event.cancel_reason === 'CUSTOMER_SUPPORT';
  if (event.type !== 'NON_RENEWING_PURCHASE' && !refund) return null;
  return { owner: event.app_user_id.toLowerCase(), transactionId: event.transaction_id,
    purchasedAt: new Date(Number(event.purchased_at_ms)).toISOString(), refund };
}
export function createCoachPackWebhook(deps: {
  enabled: boolean; appleApproved: boolean; appId: string | undefined; authorization: string | undefined;
  apply(event: CoachPackEvent): Promise<unknown>; now?: () => number;
}) {
  return async (req: Request): Promise<Response> => {
    if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
    if (!deps.authorization || deps.authorization.length < 32 || !deps.appId) return json({ error: 'Message packs are unavailable.' }, 503);
    if (!await sameCoachSecret(req.headers.get('authorization') ?? '', deps.authorization)) return json({ error: 'Unauthorized.' }, 401);
    try {
      const value = await readJson(req, 32_768);
      const event = parseCoachPackEvent(value, deps.appId, (deps.now ?? Date.now)());
      if (!event) return json({ error: 'Unsupported or invalid pack event.' }, 400);
      // Stopping new sales must not stop revocation of already refunded credit.
      // Authentication/app/product/store/environment checks still precede this.
      if (!event.refund && (!deps.enabled || !deps.appleApproved)) return json({ error: 'Message packs are unavailable.' }, 503);
      const result = await deps.apply(event);
      return json({ received: true, result });
    } catch { return json({ error: 'Pack event requires retry or reconciliation.' }, 503); }
  };
}
