import assert from 'node:assert/strict';
import test from 'node:test';
import { coachReminderKey, createCoachExpirySender, createCoachMaintenanceHandler,
  type CoachReminder } from '../../supabase/functions/_shared/coachMaintenance';

const reminder: CoachReminder = { transactionId: 'private-synthetic-transaction', daysBefore: 30,
  owner: '11111111-1111-4111-8111-111111111111', remaining: 11,
  expiresAt: '2027-01-01T00:00:00.000Z', leaseId: '22222222-2222-4222-8222-222222222222' };
const authorization = `Bearer ${'s'.repeat(40)}`;
const req = (auth = authorization) => new Request('https://example.test/coach-maintenance', { method: 'POST', headers: { authorization: auth } });
function harness() {
  const calls: unknown[][] = [];
  return { calls, deps: { enabled: true, remindersEnabled: true, authorization,
    purge: async () => { calls.push(['purge']); return 2; },
    claim: async () => { calls.push(['claim']); return [reminder]; },
    check: async (_item: CoachReminder) => ({ owner: reminder.owner, remaining: 11, expiresAt: reminder.expiresAt }) as { owner: string; remaining: number; expiresAt: string } | null,
    ownerEmail: async (_owner: string) => 'recipient@example.test' as string | null,
    bindRecipient: async (_item: CoachReminder, hash: string) => { calls.push(['bind', hash]); return true; },
    send: async (...args: unknown[]) => { calls.push(['send', ...args]); },
    finish: async (...args: unknown[]) => { calls.push(['finish', ...args]); return true; } } };
}
test('maintenance authenticates before all work and can purge without enabling reminder sends', async () => {
  const { calls, deps } = harness();
  assert.equal((await createCoachMaintenanceHandler(deps)(req('wrong'))).status, 401);
  assert.deepEqual(calls, []); deps.enabled = false;
  assert.equal((await createCoachMaintenanceHandler(deps)(req())).status, 503);
  assert.deepEqual(calls, []); deps.enabled = true; deps.remindersEnabled = false;
  assert.deepEqual(await (await createCoachMaintenanceHandler(deps)(req())).json(), { purged: 2, remindersEnabled: false, sent: 0 });
  assert.deepEqual(calls, [['purge']]);
});
test('maintenance sends only rechecked positive balances to confirmed owner email and records delivery', async () => {
  const { calls, deps } = harness();
  const response = await createCoachMaintenanceHandler(deps)(req());
  assert.deepEqual(await response.json(), { purged: 2, remindersEnabled: true, sent: 1, skipped: 0, failed: 0 });
  assert.deepEqual(calls.map(row => row[0]), ['purge', 'claim', 'bind', 'send', 'finish']);
  assert.match(String(calls[2][1]), /^[a-f0-9]{64}$/);
  for (const live of [null, { owner: reminder.owner, remaining: 0, expiresAt: reminder.expiresAt },
    { owner: 'wrong-owner', remaining: 1, expiresAt: reminder.expiresAt }]) {
    const run = harness(); run.deps.check = async () => live;
    await createCoachMaintenanceHandler(run.deps)(req());
    assert.ok(!run.calls.some(row => row[0] === 'send'));
    assert.deepEqual(run.calls.at(-1), ['finish', reminder, false, true]);
  }
});
test('changed recipient and missing verified address skip rather than using another recipient with the same delivery key', async () => {
  for (const email of [null, 'bad\r\nBcc: other@example.test', 'not-email']) {
    const run = harness(); run.deps.ownerEmail = async () => email;
    await createCoachMaintenanceHandler(run.deps)(req());
    assert.ok(!run.calls.some(row => row[0] === 'send'));
  }
  const run = harness(); run.deps.bindRecipient = async () => false;
  await createCoachMaintenanceHandler(run.deps)(req());
  assert.ok(!run.calls.some(row => row[0] === 'send'));
});
test('ambiguous email failure does not mark sent or immediately release its claim', async () => {
  const { calls, deps } = harness(); deps.send = async () => { throw Error('private upstream detail'); };
  const response = await createCoachMaintenanceHandler(deps)(req());
  assert.deepEqual(await response.json(), { purged: 2, remindersEnabled: true, sent: 0, skipped: 0, failed: 1 });
  assert.ok(!calls.some(row => row[0] === 'finish'));
});
test('Resend transport is fixed, authenticated, bounded and uses an opaque stable idempotency key without chat content', async () => {
  const key = await coachReminderKey(reminder);
  assert.equal(key, await coachReminderKey({ ...reminder, remaining: 5, leaseId: 'new-lease' }));
  assert.notEqual(key, await coachReminderKey({ ...reminder, daysBefore: 7 }));
  assert.ok(!key.includes(reminder.transactionId));
  let priorBody: string | null = null;
  const send = createCoachExpirySender({ key: 're_synthetic-only', from: 'noreply@example.test', fetch: async (url, init) => {
    assert.equal(url, 'https://api.resend.com/emails'); assert.equal(init?.redirect, 'error');
    const headers = new Headers(init?.headers); assert.equal(headers.get('idempotency-key'), key);
    const body = String(init?.body); if (priorBody !== null) assert.equal(body, priorBody); priorBody = body;
    assert.ok(!body.includes(reminder.transactionId)); assert.ok(!body.includes(reminder.owner));
    assert.ok(!body.includes('11')); assert.match(body, /2027-01-01/);
    return new Response(JSON.stringify({ id: 'synthetic-email-id' }));
  } });
  await send('recipient@example.test', reminder);
  await send('recipient@example.test', { ...reminder, remaining: 5 });
});
