import assert from 'node:assert/strict';
import test from 'node:test';
import { COACH_PACK_PRODUCT, COACH_V2_INPUT_BYTES, coachV2BodyHash, coachV2ProviderPayload,
  createCoachV2Handler, createCoachV2Provider, parseCoachV2Payload, validCoachTimezone,
  coachV2Timezone,
  type V2Payload, type V2Usage } from '../../supabase/functions/_shared/coachV2';
import { createCoachPackWebhook, parseCoachPackEvent } from '../../supabase/functions/_shared/coachPackWebhook';

const now = Date.parse('2026-11-23T04:00:00Z');
const owner = '11111111-1111-4111-8111-111111111111';
const id = '22222222-2222-4222-8222-222222222222';
const payload = (): V2Payload => ({ requestId: id, timezone: 'America/Los_Angeles', system: 'Selected training context.', consentVersion: 2,
  messages: [{ role: 'user', content: 'What should I train today?', createdAt: now - 1000 }] });
const post = (body: unknown, url = 'https://example.test/ai-coach-v2') => new Request(url,
  { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } });
const usage: V2Usage = { version: 2, used: 20, limit: 20, remaining: 0, resetsAt: '2026-11-23T08:00:00.000Z',
  timezone: 'America/Los_Angeles', purchasedRemaining: 11, purchasedExpiresAt: '2027-01-01T00:00:00.000Z',
  pro: true, packsEnabled: false, canPurchase: false };
function harness() {
  const events: unknown[][] = [];
  const deps = { authenticate: async () => owner as string | null, configured: () => true,
    isPro: async (_owner: string) => false,
    readUsage: async (...args: unknown[]) => { events.push(['usage', ...args]); return usage; },
    lookup: async (...args: unknown[]) => { events.push(['lookup', ...args]); return { status: 'complete', response: { content: [{ type: 'text' as const, text: 'Recovered' }], createdAt: now - 1000 } }; },
    purchase: async (...args: unknown[]) => { events.push(['purchase', ...args]); return { status: 'reserved', id, expiresAt: new Date(now + 300_000).toISOString() }; },
    reserve: async (...args: unknown[]) => { events.push(['reserve', ...args]); return { status: 'reserved' }; },
    finish: async (...args: unknown[]) => { events.push(['finish', ...args]); return true; },
    reply: async (...args: unknown[]) => { events.push(['reply', ...args]); return { content: [{ type: 'text' as const, text: 'Answer' }] }; }, now: () => now };
  return { deps, events };
}

test('v2 validates actual UTF8 provider input, consent, time, role and stable identity before charging', async () => {
  assert.ok(parseCoachV2Payload(payload(), now));
  const rejected = [null, { ...payload(), consentVersion: 0 }, { ...payload(), consentVersion: 1 }, { ...payload(), requestId: 'other-owner' },
    { ...payload(), timezone: 'Invalid/Timezone' }, { ...payload(), messages: [{ role: 'assistant', content: 'orphan', createdAt: now }] },
    { ...payload(), messages: [{ role: 'user', content: 'expired', createdAt: now - 86_400_000 }] },
    { ...payload(), messages: [{ role: 'user', content: 'future', createdAt: now + 300_001 }] },
    { ...payload(), system: 'a'.repeat(5000), messages: Array.from({ length: 11 }, () => ({ role: 'user', content: '😀'.repeat(1000), createdAt: now })) }];
  for (const body of rejected) assert.equal(parseCoachV2Payload(body, now), null);
  assert.ok(validCoachTimezone('Asia/Kathmandu')); assert.ok(!validCoachTimezone('UTC+999'));
  const { deps, events } = harness();
  assert.equal((await createCoachV2Handler(deps)(post(rejected.at(-1)))).status, 400);
  assert.deepEqual(events, []);
  assert.equal(await coachV2BodyHash(payload()), await coachV2BodyHash(payload()));
  assert.notEqual(await coachV2BodyHash(payload()), await coachV2BodyHash({ ...payload(), system: 'Changed' }));
  assert.ok(new TextEncoder().encode(JSON.stringify(coachV2ProviderPayload(payload()))).length < COACH_V2_INPUT_BYTES);
});

test('v2 authenticates usage/recovery first, supplies server verified Pro, and ignores client owner/model', async () => {
  const { deps, events } = harness(); deps.authenticate = async () => null;
  const handler = createCoachV2Handler(deps);
  assert.equal((await handler(new Request(`https://example.test?requestId=${id}`))).status, 401);
  assert.deepEqual(events, []); deps.authenticate = async () => owner;
  const response = await handler(new Request('https://example.test?usage=1&timezone=Asia%2FKathmandu&owner=someone-else'));
  assert.deepEqual(await response.json(), { usage }); assert.deepEqual(events, [['usage', owner, 'Asia/Kathmandu', false]]);
  const recovered = await handler(new Request(`https://example.test?requestId=${id}&owner=someone-else`));
  assert.deepEqual(await recovered.json(), { status: 'completed', content: [{ type: 'text', text: 'Recovered' }], createdAt: now - 1000 });
  assert.deepEqual(events.at(-1), ['lookup', owner, id]);
});

test('v2 standalone purchased access does not require Pro; complete commits once without client model', async () => {
  const { deps, events } = harness();
  const response = await createCoachV2Handler(deps)(post({ ...payload(), owner: 'other', model: 'expensive' }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { content: [{ type: 'text', text: 'Answer' }], createdAt: now });
  assert.deepEqual(events.map(row => row[0]), ['reserve', 'reply', 'finish']);
  assert.equal(events[0][1], owner); assert.equal(events[0][3], false);
  assert.equal((events[1][1] as any).model, undefined);
});

test('known stale 2026 zones and aliases use explicit UTC policy for both usage and reservation', async () => {
  const zones = ['America/Vancouver', 'Canada/Pacific', 'America/Edmonton', 'Canada/Mountain',
    'America/Yellowknife', 'Africa/Casablanca', 'Africa/El_Aaiun', 'America/Inuvik',
    'America/Winnipeg', 'Canada/Central', 'America/Rainy_River', 'america/vancouver'];
  for (const zone of zones) {
    assert.deepEqual(coachV2Timezone(zone), { timezone: 'UTC', requestedTimezone: zone, timezoneFallback: 'server_tzdata_outdated' });
    const { deps, events } = harness();
    // Existing guarded periods remain authoritative; never overwrite their
    // returned zone/reset while a transition to UTC is pending.
    deps.readUsage = async (...args: unknown[]) => {
      events.push(['usage', ...args]); return { ...usage, timezone: zone, timezoneChangePending: true };
    };
    const handler = createCoachV2Handler(deps);
    const result = await (await handler(new Request(`https://example.test?usage=1&timezone=${encodeURIComponent(zone)}`))).json();
    assert.equal(result.usage.timezone, zone); assert.equal(result.usage.resetsAt, usage.resetsAt);
    assert.equal(result.usage.requestedTimezone, zone); assert.equal(result.usage.timezoneFallback, 'server_tzdata_outdated');
    assert.deepEqual(events[0], ['usage', owner, 'UTC', false]);
    await handler(post({ ...payload(), timezone: zone }));
    assert.equal(events.find(row => row[0] === 'reserve')?.[2], 'UTC');
  }
  for (const zone of ['America/Los_Angeles', 'America/Denver', 'America/Phoenix', 'Asia/Kathmandu', 'UTC'])
    assert.deepEqual(coachV2Timezone(zone), { timezone: zone, requestedTimezone: zone });
});

test('no extra provider call for replay, conflict, pending, exhausted or expired receipts', async () => {
  for (const [state, expected] of [['pending', 409], ['conflict', 409], ['expired', 410], ['exhausted', 402], ['unavailable', 503], ['rate_limited', 429]] as const) {
    const { deps, events } = harness(); deps.reserve = async () => ({ status: state });
    assert.equal((await createCoachV2Handler(deps)(post(payload()))).status, expected);
    assert.ok(!events.some(row => row[0] === 'reply' || row[0] === 'finish'));
  }
  const { deps, events } = harness();
  deps.reserve = async () => ({ status: 'cached', response: { content: [{ type: 'text', text: 'Cached' }] } });
  assert.equal((await createCoachV2Handler(deps)(post(payload()))).status, 200);
  assert.deepEqual(events, []);
});

test('provider failure restores credit; settlement failure never invokes refund after a valid reply', async () => {
  const fail = harness(); fail.deps.reply = async () => { throw Error('private upstream failure'); };
  assert.equal((await createCoachV2Handler(fail.deps)(post(payload()))).status, 503);
  assert.deepEqual(fail.events.at(-1), ['finish', owner, id, null]);
  const unknown = harness(); unknown.deps.reply = async () => { throw Error('provider'); };
  unknown.deps.finish = async () => false;
  assert.doesNotMatch(await (await createCoachV2Handler(unknown.deps)(post(payload()))).text(), /was restored/);
  const pending = harness(); pending.deps.finish = async (...args: unknown[]) => { pending.events.push(['finish', ...args]); throw Error('database'); };
  const response = await createCoachV2Handler(pending.deps)(post(payload()));
  assert.equal(response.status, 503); assert.doesNotMatch(await response.text(), /database/);
  assert.equal(pending.events.filter(row => row[0] === 'finish').length, 1);
  assert.notEqual(pending.events.at(-1)?.[3], null);
});

test('owner-scoped purchase intent is separate from chat and requires a valid id', async () => {
  const { deps, events } = harness();
  const response = await createCoachV2Handler(deps)(post({ intentId: id, owner: 'other' }, 'https://example.test?purchase=1'));
  assert.deepEqual(await response.json(), { purchaseIntent: { id, expiresAt: new Date(now + 300_000).toISOString() } });
  assert.deepEqual(events, [['purchase', owner, id, false]]);
  assert.equal((await createCoachV2Handler(deps)(post({ intentId: 'bad' }, 'https://example.test?purchase=1'))).status, 503);
});

test('v2 provider fixes model, output and no tools; strips timestamps and meters without content', async () => {
  let calls = 0;
  const reply = createCoachV2Provider({ key: 'synthetic-key', fetch: async (_url, init) => {
    calls++; const body = JSON.parse(String(init?.body));
    assert.equal(body.model, 'claude-haiku-4-5-20251001'); assert.equal(body.max_tokens, 1024);
    assert.equal(init?.redirect, 'error'); assert.equal(body.tools, undefined);
    assert.equal(body.messages[0].createdAt, undefined); assert.match(body.system, /not a clinician/);
    return new Response(JSON.stringify({ content: [{ type: 'text', text: 'Answer' }] }));
  } });
  assert.deepEqual(await reply(payload(), new AbortController().signal), { content: [{ type: 'text', text: 'Answer' }] });
  assert.equal(calls, 1);
});

const packEvent = () => ({ api_version: '1.0', event: { app_id: 'app-test', app_user_id: owner,
  environment: 'PRODUCTION', store: 'APP_STORE', product_id: COACH_PACK_PRODUCT,
  transaction_id: 'apple-transaction-1', purchased_at_ms: now - 1000, type: 'NON_RENEWING_PURCHASE', quantity: 1 } });
test('pack event parser rejects sandbox, aliases, unsupported products, quantities, stores and future purchases', () => {
  assert.deepEqual(parseCoachPackEvent(packEvent(), 'app-test', now), { owner, transactionId: 'apple-transaction-1',
    purchasedAt: new Date(now - 1000).toISOString(), refund: false });
  for (const change of [{ environment: 'SANDBOX' }, { app_id: 'other-app' }, { app_user_id: '$RCAnonymousID:somebody', aliases: [owner] },
    { product_id: 'strideos_pro_monthly' }, { store: 'PROMOTIONAL' }, { quantity: 2 }, { purchased_at_ms: now + 300_001 },
    { type: 'REFUND_REVERSED' }, { type: 'CANCELLATION', cancel_reason: 'UNSUBSCRIBE' }]) {
    assert.equal(parseCoachPackEvent({ ...packEvent(), event: { ...packEvent().event, ...change } }, 'app-test', now), null);
  }
  assert.equal(parseCoachPackEvent({ ...packEvent(), event: { ...packEvent().event, type: 'CANCELLATION', cancel_reason: 'CUSTOMER_SUPPORT' } }, 'app-test', now)?.refund, true);
});
test('webhook is disabled by default, authenticates before parsing, and only applies validated paid events', async () => {
  let applied = 0; const secret = `Bearer ${'s'.repeat(40)}`;
  const deps = { enabled: false, appleApproved: false, appId: 'app-test', authorization: secret,
    now: () => now, apply: async () => { applied++; return { duplicate: false }; } };
  const request = (authorization = secret) => new Request('https://example.test', { method: 'POST',
    headers: { authorization }, body: JSON.stringify(packEvent()) });
  assert.equal((await createCoachPackWebhook(deps)(request())).status, 503);
  deps.enabled = true;
  assert.equal((await createCoachPackWebhook(deps)(request())).status, 503);
  deps.appleApproved = true;
  assert.equal((await createCoachPackWebhook(deps)(request('wrong-secret'))).status, 401);
  assert.equal(applied, 0);
  assert.equal((await createCoachPackWebhook(deps)(request())).status, 200); assert.equal(applied, 1);
  deps.enabled=false; deps.appleApproved=false;
  const refund = new Request('https://example.test',{method:'POST',headers:{authorization:secret},
    body:JSON.stringify({...packEvent(),event:{...packEvent().event,type:'CANCELLATION',cancel_reason:'CUSTOMER_SUPPORT'}})});
  assert.equal((await createCoachPackWebhook(deps)(refund)).status,200); assert.equal(applied,2);
  assert.equal((await createCoachPackWebhook(deps)(request())).status,503); assert.equal(applied,2);
});
