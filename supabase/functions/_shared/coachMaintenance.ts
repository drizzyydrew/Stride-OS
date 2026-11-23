import { json, readJson } from './launchHandlers.ts';
import { sameCoachSecret } from './coachPackWebhook.ts';

export type CoachReminder = { transactionId: string; daysBefore: 30 | 7; owner: string; remaining: number; expiresAt: string; leaseId: string };
const validEmail = (value: string) => value.length <= 254 && /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(value);
export async function coachReminderKey(item: CoachReminder): Promise<string> {
  const value = `${item.transactionId}:${item.daysBefore}:${item.expiresAt}`;
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
  return `stride-coach-expiry-${Array.from(bytes).map(value => value.toString(16).padStart(2, '0')).join('')}`;
}
export function createCoachExpirySender(deps: { key: string | undefined; from: string | undefined; fetch?: typeof fetch }) {
  return async (to: string, reminder: CoachReminder): Promise<void> => {
    if (!deps.key?.startsWith('re_') || !deps.from || !validEmail(deps.from) || !validEmail(to)
      || ![30, 7].includes(reminder.daysBefore) || !Number.isFinite(Date.parse(reminder.expiresAt))) throw Error('Reminder unavailable');
    const response = await (deps.fetch ?? fetch)('https://api.resend.com/emails', {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15_000),
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${deps.key}`, 'Idempotency-Key': await coachReminderKey(reminder) },
      body: JSON.stringify({ from: deps.from, to: [to], subject: 'Your purchased AI Coach messages expire soon',
        // Keep the content stable across retries. A balance can change while
        // Resend retains its 24h idempotency record; the app has the live count.
        text: `Your remaining purchased StrideOS AI Coach messages expire on ${new Date(reminder.expiresAt).toISOString().slice(0, 10)} (UTC). Open StrideOS to check your balance and use remaining messages before that date. Pro's included daily messages are used before purchased messages. This reminder does not renew a purchase or charge your account.` }),
    });
    if (!response.ok) { await response.body?.cancel(); throw Error('Reminder delivery unavailable'); }
    const result = await readJson(response, 8192) as { id?: unknown } | null;
    if (typeof result?.id !== 'string' || !result.id) throw Error('Reminder delivery needs reconciliation');
  };
}
export function createCoachMaintenanceHandler(deps: {
  enabled: boolean; remindersEnabled: boolean; authorization: string | undefined;
  purge(): Promise<number>; claim(): Promise<CoachReminder[]>;
  check(item: CoachReminder): Promise<{ owner: string; remaining: number; expiresAt: string } | null>;
  ownerEmail(owner: string): Promise<string | null>;
  bindRecipient(item: CoachReminder, hash: string): Promise<boolean>;
  send(to: string, item: CoachReminder): Promise<void>;
  finish(item: CoachReminder, sent: boolean, skip: boolean): Promise<boolean>;
}) {
  return async (req: Request): Promise<Response> => {
    if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
    if (!deps.enabled || !deps.authorization || deps.authorization.length < 32) return json({ error: 'Maintenance unavailable.' }, 503);
    if (!await sameCoachSecret(req.headers.get('authorization') ?? '', deps.authorization)) return json({ error: 'Unauthorized.' }, 401);
    try {
      const purged = await deps.purge();
      if (!deps.remindersEnabled) return json({ purged, remindersEnabled: false, sent: 0 });
      const batch = await deps.claim();
      let sent = 0, skipped = 0, failed = 0;
      for (const item of batch) {
        try {
          const live = await deps.check(item);
          if (!live || live.owner !== item.owner || live.remaining <= 0) {
            await deps.finish(item, false, true); skipped++; continue;
          }
          const email = await deps.ownerEmail(item.owner);
          if (!email || !validEmail(email)) { await deps.finish(item, false, true); skipped++; continue; }
          const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(email)));
          const hash = Array.from(digest).map(value => value.toString(16).padStart(2, '0')).join('');
          if (!await deps.bindRecipient(item, hash)) {
            // An account email changed during an uncertain send. Do not reuse
            // the provider key with a different recipient or retain an address.
            await deps.finish(item, false, true); skipped++; continue;
          }
          await deps.send(email, item);
          if (!await deps.finish(item, true, false)) throw Error('Delivery receipt unavailable');
          sent++;
        } catch {
          // Do not log addresses, purchase identifiers, chat or provider bodies.
          // An uncertain delivery retains its short lease and stable provider
          // idempotency key. Stale (>23h) uncertainty requires reconciliation.
          failed++;
        }
      }
      return json({ purged, remindersEnabled: true, sent, skipped, failed });
    } catch { return json({ error: 'Maintenance needs retry or reconciliation.' }, 503); }
  };
}
