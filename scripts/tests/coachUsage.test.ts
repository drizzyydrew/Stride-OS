import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { readCoachAllowance, COACH_DAILY_LIMIT } from '../../supabase/functions/_shared/coachAllowance';
import { createCoachHandler } from '../../supabase/functions/_shared/launchHandlers';
import { coachUsageLabel, coachUsageExample, parseCoachUsage } from '../../src/utils/coachUsage';
import { createCoachUsageMonitor } from '../../src/utils/coachUsageMonitor';

const usage = { used: 3, limit: 20, remaining: 17, resetsAt: '2026-11-19T00:00:00.000Z' };
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

test('server allowance handles empty rows, exhaustion, and UTC midnight from one instant', async () => {
  const reads: string[][] = [];
  const read = async (owner: string, day: string) => { reads.push([owner, day]); return 3; };
  assert.deepEqual(await readCoachAllowance('verified-owner', read, new Date('2026-11-18T23:59:59.999Z')), usage);
  const next = await readCoachAllowance('verified-owner', async () => null, new Date('2026-11-19T00:00:00Z'));
  assert.deepEqual(next, { used: 0, limit: 20, remaining: 20, resetsAt: '2026-11-20T00:00:00.000Z' });
  assert.deepEqual(reads, [['verified-owner', '2026-11-18']]);
  assert.equal((await readCoachAllowance('a', async () => 20)).remaining, 0);
  for (const count of [-1, 1.5, NaN, Infinity]) await assert.rejects(readCoachAllowance('a', async () => count));
  await assert.rejects(readCoachAllowance('a', async () => { throw new Error('database'); }));
});

test('displayed server limit matches the actual existing SQL allowance', () => {
  const sql = readFileSync('supabase/migrations/20261031150809_launch_privacy_and_coach_limits.sql', 'utf8');
  const actual = Number(sql.match(/coalesce\(owner_count, 0\) >= (\d+)/)?.[1]);
  assert.equal(COACH_DAILY_LIMIT, actual);
});

test('usage authenticates first, ignores client owner, spends nothing and preserves health GET', async () => {
  let owner: string | null = null;
  const reads: string[] = [];
  let consumed = 0;
  let calls = 0;
  const handler = createCoachHandler({
    authenticate: async () => owner, configured: () => false,
    canUsePlan: async () => { throw new Error('Must not check paid access for own usage'); },
    readUsage: async id => { reads.push(id); return usage; },
    consumeAllowance: async () => { consumed++; return true; },
    reply: async () => { calls++; return { content: [] }; },
  });
  const req = () => new Request('https://example.test/ai-coach?usage=1&owner=other-user');
  assert.equal((await handler(req())).status, 401);
  assert.deepEqual(reads, []);
  owner = 'verified-owner';
  const response = await handler(req());
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await response.json(), { usage });
  assert.deepEqual(reads, ['verified-owner']);
  assert.equal(consumed, 0); assert.equal(calls, 0);
  assert.deepEqual(await (await handler(new Request('https://example.test/ai-coach'))).json(), { ok: false });
});

test('usage read failures are sanitized and do not consume allowance', async () => {
  const response = await createCoachHandler({ authenticate: async () => 'a', configured: () => true,
    readUsage: async () => { throw new Error('secret database details'); },
    consumeAllowance: async () => { throw new Error('must not reserve'); }, reply: async () => ({ content: [] }),
  })(new Request('https://example.test/ai-coach?usage=1'));
  assert.equal(response.status, 503);
  assert.doesNotMatch(await response.text(), /secret/);
});

test('client rejects old backend/malformed readings; empty is not loading and UTC expiry hides old count', () => {
  assert.deepEqual(parseCoachUsage({ usage }), usage);
  for (const body of [null, {}, { ok: true }, { usage: { ...usage, used: -1 } },
    { usage: { ...usage, remaining: 18 } }, { usage: { ...usage, resetsAt: 'bad' } },
    { usage: { ...usage, resetsAt: '2026-11-19T01:00:00.000Z' } }]) assert.throws(() => parseCoachUsage(body));
  assert.equal(coachUsageLabel(usage, Date.parse('2026-11-18T20:00:00Z')), '3 of 20 requests used today');
  assert.equal(coachUsageLabel(usage, Date.parse(usage.resetsAt)), 'Usage unavailable');
  assert.match(coachUsageExample(20), /3 messages.*3 requests.*17/);
  assert.match(coachUsageExample(2), /2 messages.*2 requests.*0/);
});

test('late/out-of-order reads and a revoked owner cannot replace the current count', async () => {
  let owner = 'a'; let generation = 0;
  const pending: ReturnType<typeof deferred<typeof usage>>[] = [];
  const monitor = createCoachUsageMonitor({
    capture: () => ({ ownerUserId: owner, generation }),
    isCurrent: lease => lease.ownerUserId === owner && lease.generation === generation,
    read: () => { const result = deferred<typeof usage>(); pending.push(result); return result.promise; },
  });
  const first = monitor.refresh(); const second = monitor.refresh();
  pending[1].resolve({ ...usage, used: 4, remaining: 16 }); await second;
  pending[0].resolve(usage); await first;
  assert.equal(monitor.getSnapshot().usage?.used, 4);
  const oldOwner = monitor.refresh(); owner = 'b'; generation++; monitor.clear();
  assert.equal(monitor.getSnapshot().usage, null);
  pending[2].resolve(usage); await oldOwner;
  assert.equal(monitor.getSnapshot().usage, null);
  const newOwner = monitor.refresh(); pending[3].resolve({ ...usage, used: 0, remaining: 20 }); await newOwner;
  assert.equal(monitor.getSnapshot().usage?.used, 0);
  assert.equal(monitor.getSnapshot().lease?.ownerUserId, 'b');
});

test('failed refresh retains the same owner reading as unavailable and recovers', async () => {
  let fail = false;
  const monitor = createCoachUsageMonitor({ capture: () => ({ ownerUserId: 'a', generation: 0 }),
    isCurrent: () => true, read: async () => { if (fail) throw new Error('offline'); return usage; } });
  await monitor.refresh(); fail = true; await monitor.refresh();
  assert.equal(monitor.getSnapshot().status, 'unavailable');
  assert.deepEqual(monitor.getSnapshot().usage, usage);
  fail = false; await monitor.refresh();
  assert.equal(monitor.getSnapshot().status, 'current');
  monitor.clear();
});

test('timeout marks unavailable even if a read ignores abort; late data cannot become current', async context => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const pending = deferred<typeof usage>();
  let signal: AbortSignal | undefined;
  const monitor = createCoachUsageMonitor({ capture: () => ({ ownerUserId: 'a', generation: 0 }),
    isCurrent: () => true, read: async value => { signal = value; return pending.promise; } });
  const read = monitor.refresh();
  context.mock.timers.tick(10_000);
  assert.equal(signal?.aborted, true);
  assert.equal(monitor.getSnapshot().status, 'unavailable');
  pending.resolve(usage); await read;
  assert.equal(monitor.getSnapshot().usage, null);
  assert.equal(monitor.getSnapshot().status, 'unavailable');
  monitor.clear();
});
