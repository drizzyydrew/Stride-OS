import assert from 'node:assert/strict';
import test from 'node:test';
import { createAnthropicCoachReply } from '../../supabase/functions/_shared/coachProvider';
import { coachProviderTelemetry, COACH_PROVIDER_MODEL, estimateCoachTokenCostNanoUsd,
  parseCoachTokenUsage } from '../../supabase/functions/_shared/coachProviderTelemetry';
import type { CoachProviderTelemetry } from '../../supabase/functions/_shared/coachProviderTelemetry';

const usage = { input_tokens: 2000, output_tokens: 400, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 };
const answer = { model: COACH_PROVIDER_MODEL, usage, content: [{ type: 'text', text: 'Synthetic answer' }] };
const body = { system: 'private athlete context', messages: [{ role: 'user' as const, content: 'private latest question' }] };
const key = 'synthetic-private-provider-key';
const signal = () => new AbortController().signal;
const json = (value: unknown) => new Response(JSON.stringify(value));

test('normal provider counters preserve integer currency precision and do not equal an invoice', () => {
  const event = coachProviderTelemetry(answer);
  assert.deepEqual(event.tokens, { input: 2000, output: 400, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0 });
  assert.equal(event.usageStatus, 'available');
  assert.equal(event.estimatedCostNanoUsd, 4_000_000); // $0.004, not zero cents.
  assert.equal(event.costBasis, 'standard_text_token_rates_before_discounts');
  assert.equal(event.unavailableReason, null);
});

test('cached counters use exact duration-specific base rates and reject contradictory totals', () => {
  const cache = { ephemeral_5m_input_tokens: 1000, ephemeral_1h_input_tokens: 500 };
  const event = coachProviderTelemetry({ model: COACH_PROVIDER_MODEL, usage: { ...usage,
    cache_creation_input_tokens: 1500, cache_read_input_tokens: 2000, cache_creation: cache } });
  assert.equal(event.estimatedCostNanoUsd, 6_450_000);
  for (const value of [undefined, {}, { ...cache, ephemeral_1h_input_tokens: 499 },
    { ...cache, ephemeral_5m_input_tokens: -1 }]) {
    assert.equal(parseCoachTokenUsage({ ...usage, cache_creation_input_tokens: 1500, cache_creation: value }), null);
  }
  assert.equal(parseCoachTokenUsage({ ...usage, cache_creation: cache }), null);
});

test('missing, negative, fractional, nonfinite or overflow usage never fabricates zero cost', () => {
  const cases: unknown[] = [null, {}, { usage: {} }, { model: COACH_PROVIDER_MODEL },
    { model: COACH_PROVIDER_MODEL, usage: { input_tokens: 0, output_tokens: 0 } }];
  for (const bad of [undefined, null, -1, 0.5, NaN, Infinity, '2000', Number.MAX_SAFE_INTEGER + 1]) {
    cases.push({ model: COACH_PROVIDER_MODEL, usage: { ...usage, input_tokens: bad } });
  }
  for (const value of cases) {
    const event = coachProviderTelemetry(value);
    assert.equal(event.estimatedCostNanoUsd, null); assert.equal(event.costBasis, null);
    assert.equal(event.usageStatus, 'unavailable'); assert.equal(event.unavailableReason, 'missing_or_invalid_usage');
  }
  assert.equal(estimateCoachTokenCostNanoUsd(COACH_PROVIDER_MODEL,
    { input: Number.MAX_SAFE_INTEGER, output: 1, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0 }), null);
});

test('unknown models, billable tools and nonstandard tiers have no guessed cost or echoed strings', () => {
  for (const value of [{ ...answer, model: 'claude-private-user-id' }, { ...answer, model: key },
    { ...answer, usage: { ...usage, service_tier: 'priority' } },
    { ...answer, usage: { ...usage, server_tool_use: { web_search_requests: 1 } } }]) {
    const event = coachProviderTelemetry(value);
    assert.equal(event.estimatedCostNanoUsd, null); assert.equal(event.unavailableReason, 'unpriced_model_or_tier');
    assert.ok(!JSON.stringify(event).includes('private-user-id')); assert.ok(!JSON.stringify(event).includes(key));
  }
});

test('metadata event is a strict whitelist and never contains prompt, reply, owner, headers or raw response', () => {
  const event = coachProviderTelemetry({ ...answer, id: 'private-request-id', user_id: 'private-user-id',
    headers: { 'x-api-key': key }, system: body.system, messages: body.messages,
    usage: { ...usage, private_extra: 'private-extra' } });
  const encoded = JSON.stringify(event);
  for (const forbidden of [body.system, body.messages[0].content, answer.content[0].text, key,
    'private-user-id', 'private-request-id', 'private-extra', 'x-api-key']) assert.ok(!encoded.includes(forbidden));
  assert.deepEqual(Object.keys(event), ['event', 'provider', 'model', 'usageStatus', 'tokens',
    'estimatedCostNanoUsd', 'costBasis', 'unavailableReason']);
});

test('real reply transport preserves fixed endpoint, safety, model, 1024 output bound, payload and cancellation', async () => {
  const events: CoachProviderTelemetry[] = []; const abort = signal(); let calls = 0;
  const reply = createAnthropicCoachReply({ apiKey: key, model: () => undefined,
    onTelemetry: event => events.push(event), fetch: async (url, options) => {
      calls++; assert.equal(url, 'https://api.anthropic.com/v1/messages');
      assert.equal(options?.method, 'POST'); assert.equal(options?.signal, abort);
      assert.equal(options?.redirect, 'error');
      const headers = new Headers(options?.headers);
      assert.equal(headers.get('x-api-key'), key); assert.equal(headers.get('anthropic-version'), '2023-06-01');
      const sent = JSON.parse(String(options?.body));
      assert.equal(sent.model, COACH_PROVIDER_MODEL); assert.equal(sent.max_tokens, 1024);
      assert.match(sent.system, /^You are a fitness training assistant, not a clinician\./);
      assert.ok(sent.system.endsWith(`Athlete context:\n${body.system}`));
      assert.deepEqual(sent.messages, body.messages); return json(answer);
    } });
  assert.deepEqual(await reply(body, abort), { content: answer.content });
  assert.equal(calls, 1); assert.equal(events.length, 1); assert.equal(events[0].estimatedCostNanoUsd, 4_000_000);
});

test('missing usage and throwing telemetry sinks do not discard or retry a valid answer', async () => {
  let calls = 0; const events: CoachProviderTelemetry[] = [];
  for (const onTelemetry of [(event: CoachProviderTelemetry) => events.push(event),
    () => { throw new Error(key); }, async () => { throw new Error(key); }]) {
    const reply = createAnthropicCoachReply({ apiKey: key, model: () => undefined, onTelemetry,
      fetch: async () => { calls++; return json({ content: answer.content }); } });
    assert.deepEqual(await reply(body, signal()), { content: answer.content });
  }
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls, 3); assert.equal(events[0].estimatedCostNanoUsd, null);
});

test('successful but empty output still records known provider usage', async () => {
  const events: CoachProviderTelemetry[] = [];
  const reply = createAnthropicCoachReply({ apiKey: key, model: () => undefined,
    onTelemetry: event => events.push(event), fetch: async () => json({ ...answer, content: [] }) });
  await assert.rejects(reply(body, signal()), { message: 'Empty response' });
  assert.equal(events.length, 1); assert.equal(events[0].estimatedCostNanoUsd, 4_000_000);
});

test('provider HTTP, malformed JSON, network and missing-key failures are sanitized without retries or fake usage', async () => {
  let calls = 0; const events: CoachProviderTelemetry[] = [];
  for (const fetcher of [async () => new Response(key, { status: 429 }),
    async () => new Response(key), async () => { throw new Error(key); },
    async () => new Response('x'.repeat(65_537)),
    async () => new Response(new Uint8Array([0xff, 0xfe]))]) {
    const reply = createAnthropicCoachReply({ apiKey: key, model: () => undefined,
      onTelemetry: event => events.push(event), fetch: async () => { calls++; return fetcher(); } });
    await assert.rejects(reply(body, signal()), { message: 'Provider unavailable' });
  }
  const missing = createAnthropicCoachReply({ apiKey: undefined, model: () => undefined,
    onTelemetry: event => events.push(event), fetch: async () => { assert.fail('Missing key contacted provider'); } });
  await assert.rejects(missing(body, signal()), { message: 'Provider unavailable' });
  assert.equal(calls, 5); assert.equal(events.length, 5);
  assert.ok(events.every(event => event.estimatedCostNanoUsd === null && event.usageStatus === 'unavailable'));
});
