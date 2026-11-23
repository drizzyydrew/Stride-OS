import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// Optional local PostgreSQL runtime, installed outside the checkout. This test
// never connects to a hosted project. Required release verification runs it
// with STRIDEOS_TEST_PGLITE_MODULE pointing at a pinned PGlite installation.
const modulePath = process.env.STRIDEOS_TEST_PGLITE_MODULE;
test('coach v2 actual PostgreSQL wallet and privilege scenarios', { skip: !modulePath }, async t => {
  const { PGlite } = await import(modulePath!);
  const db = new PGlite();
  const owner = '11111111-1111-4111-8111-111111111111';
  const other = '33333333-3333-4333-8333-333333333333';
  const legacy = '44444444-4444-4444-8444-444444444444';
  const reader = '55555555-5555-4555-8555-555555555555';
  const exhaustedLegacy = '66666666-6666-4666-8666-666666666666';
  const hash = 'a'.repeat(64);
  let sequence = 0;
  const requestId = () => `22222222-2222-4222-8222-${String(++sequence).padStart(12, '0')}`;
  const value = async (sql: string, params: unknown[] = []) => (await db.query(sql, params)).rows[0]?.value;
  const usage = (id = owner, pro = true, zone = 'America/Los_Angeles') => value('select public.stride_coach_v2_usage($1,$2,$3) as value', [id, zone, pro]);
  const reserve = (id: string, ownerId = owner, pro = true, bodyHash = hash) => value(
    'select public.stride_coach_v2_reserve($1,$2,$3,$4,$5) as value', [ownerId, 'America/Los_Angeles', pro, id, bodyHash]);
  const finish = (id: string, response: unknown = { content: [{ type: 'text', text: 'Synthetic answer' }] }, ownerId = owner) => value(
    'select public.stride_coach_v2_finish($1,$2,$3::jsonb) as value', [ownerId, id, response === null ? null : JSON.stringify(response)]);
  const lookup = (id: string, ownerId = owner) => value('select public.stride_coach_v2_lookup($1,$2) as value', [ownerId, id]);
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key);
      grant usage on schema auth to service_role;
      create table public.stride_account_deletion_requests(user_id uuid);
      create table public.stride_coach_usage(day date, scope text, requests integer, primary key(day,scope));
      grant all on public.stride_account_deletion_requests, public.stride_coach_usage to service_role;`);
    await db.exec(readFileSync('supabase/migrations/20261123055659_coach_wallet_v2.sql', 'utf8'));
    await db.exec(readFileSync('supabase/migrations/20261123064711_coach_wallet_v2_owner_lookup.sql', 'utf8'));
    await db.query('insert into auth.users values ($1),($2),($3),($4),($5)', [owner, other, legacy, reader, exhaustedLegacy]);
    await db.exec('set role service_role');

    await t.test('hardened Auth permissions allow only a private service-owned boolean lookup', async () => {
      await assert.rejects(db.query('select id from auth.users'));
      assert.equal(await value('select stride_coach_private.owner_exists($1) as value',[owner]),true);
      assert.equal(await value('select stride_coach_private.owner_exists($1) as value',['99999999-9999-4999-8999-999999999999']),false);
      assert.equal(await value('select stride_coach_private.owner_exists(null) as value'),false);
      await assert.rejects(usage('99999999-9999-4999-8999-999999999999'));
      assert.equal(await value(`select bool_and(not p.prosecdef) as value from pg_catalog.pg_proc p
        join pg_catalog.pg_namespace n on n.oid=p.pronamespace
        where n.nspname='public' and (p.proname like 'stride_coach_v2_%' or p.proname='consume_stride_coach_allowance')`),true);
    });

    await t.test('default off, local midnight, no client timezone reset, and no Pro allowance for standalone owners', async () => {
      const initial = await usage();
      assert.equal(initial.version, 2); assert.equal(initial.limit, 20); assert.equal(initial.remaining, 20);
      assert.equal(initial.packsEnabled, false); assert.equal(initial.canPurchase, false);
      assert.equal((await reserve(requestId())).status, 'unavailable');
      assert.equal((await usage(other, false)).limit, 0);
      await db.query('update public.stride_coach_v2_wallet set daily_used=7 where owner_id=$1', [owner]);
      const changed = await usage(owner, true, 'Pacific/Kiritimati');
      assert.equal(changed.used, 7); assert.equal(changed.resetsAt, initial.resetsAt);
      assert.equal(changed.timezone, 'America/Los_Angeles'); assert.equal(changed.timezoneChangePending, true);
      await usage(); // reverting a temporary zone request clears the pending change
      await assert.rejects(usage(owner, true, 'Invalid/Zone'));
      await db.query('update public.stride_coach_v2_wallet set daily_used=0 where owner_id=$1', [owner]);
      await usage(reader);
      assert.equal(await value('select public.stride_coach_v2_is_enrolled($1) as value',[reader]),false);
      assert.equal(await value('select public.consume_stride_coach_allowance($1) as value',[reader]),true);
      assert.equal(await value('select public.consume_stride_coach_allowance($1) as value',[reader]),true);
    });
    await t.test('PostgreSQL local-midnight calculation follows 23h and 25h DST days', async () => {
      const spring = await value(`select extract(epoch from ((timestamp '2026-03-09' at time zone 'America/Los_Angeles') - (timestamp '2026-03-08' at time zone 'America/Los_Angeles')))/3600 as value`);
      const fall = await value(`select extract(epoch from ((timestamp '2026-11-02' at time zone 'America/Los_Angeles') - (timestamp '2026-11-01' at time zone 'America/Los_Angeles')))/3600 as value`);
      assert.equal(Number(spring), 23); assert.equal(Number(fall), 25);
    });
    await t.test('a pending travel timezone carries usage across its transition instead of granting another twenty', async () => {
      await db.query(`update public.stride_coach_v2_wallet set daily_used=9,
        resets_at=now()-interval '1 second',pending_timezone='Pacific/Kiritimati' where owner_id=$1`, [owner]);
      const transitioned = await usage(owner, true, 'Pacific/Kiritimati');
      assert.equal(transitioned.used, 9); assert.equal(transitioned.timezone, 'Pacific/Kiritimati');
      assert.ok(Date.parse(transitioned.resetsAt) > Date.now());
      await db.query(`update public.stride_coach_v2_wallet set timezone='America/Los_Angeles',
        pending_timezone=null,daily_used=0,resets_at=((now() at time zone 'America/Los_Angeles')::date+1)::timestamp at time zone 'America/Los_Angeles' where owner_id=$1`, [owner]);
    });
    await t.test('temporary UTC timezone fallback preserves the current period and carries used messages at transition', async () => {
      await db.query(`update public.stride_coach_v2_wallet set timezone='America/Vancouver',
        pending_timezone=null,daily_used=9,resets_at=now()+interval '1 hour' where owner_id=$1`, [owner]);
      const before = await usage(owner, true, 'UTC');
      assert.equal(before.used,9); assert.equal(before.timezone,'America/Vancouver');
      assert.equal(before.timezoneChangePending,true);
      await db.query(`update public.stride_coach_v2_wallet set resets_at=now()-interval '1 second' where owner_id=$1`,[owner]);
      const after = await usage(owner,true,'UTC');
      assert.equal(after.used,9); assert.equal(after.remaining,11); assert.equal(after.timezone,'UTC');
      assert.equal(after.timezoneChangePending,false);
      const reset = new Date(after.resetsAt);
      assert.equal(reset.getUTCHours(),0); assert.equal(reset.getUTCMinutes(),0);
      await db.query(`update public.stride_coach_v2_wallet set timezone='America/Los_Angeles',
        pending_timezone=null,daily_used=0,resets_at=((now() at time zone 'America/Los_Angeles')::date+1)::timestamp at time zone 'America/Los_Angeles' where owner_id=$1`,[owner]);
    });
    await t.test('purchase intents require both approval flags, zero balance and one active owner reservation', async () => {
      const id = requestId();
      assert.equal((await value('select public.stride_coach_v2_purchase($1,$2,false) as value', [owner, id])).status, 'unavailable');
      await db.exec('update public.stride_coach_v2_config set enabled=true,packs_enabled=true,apple_expiring_approved=true,monthly_budget_nano_usd=2000000000');
      const result = await value('select public.stride_coach_v2_purchase($1,$2,false) as value', [owner, id]);
      assert.equal(result.status, 'reserved'); assert.equal(result.id, id);
      assert.equal((await value('select public.stride_coach_v2_purchase($1,$2,false) as value', [owner, requestId()])).status, 'pending');
    });
    await t.test('legacy calls before v2 enrollment are counted; the old endpoint cannot grant a second allowance afterward', async () => {
      for(let i=0;i<5;i++) assert.equal(await value('select public.consume_stride_coach_allowance($1) as value',[legacy]),true);
      assert.equal(await value('select public.stride_coach_v2_is_enrolled($1) as value',[legacy]),false);
      assert.equal((await usage(legacy)).used,5);
      const id=requestId(); assert.equal((await reserve(id,legacy,true)).status,'reserved'); await finish(id,undefined,legacy);
      assert.equal((await usage(legacy)).used,6);
      assert.equal(await value('select public.stride_coach_v2_is_enrolled($1) as value',[legacy]),true);
      assert.equal(await value('select public.consume_stride_coach_allowance($1) as value',[legacy]),false);
      assert.equal((await usage(legacy)).used,6);
      assert.equal(await value('select public.stride_coach_v2_is_enrolled($1) as value',[reader]),false);
      assert.equal(await value('select public.consume_stride_coach_allowance($1) as value',[reader]),true);
      for(let i=0;i<20;i++) assert.equal(await value('select public.consume_stride_coach_allowance($1) as value',[exhaustedLegacy]),true);
      assert.equal((await usage(exhaustedLegacy)).remaining,0);
      assert.equal((await reserve(requestId(),exhaustedLegacy,true)).status,'exhausted');
      assert.equal(await value('select public.stride_coach_v2_is_enrolled($1) as value',[exhaustedLegacy]),false);
    });
    let purchased: string;
    await t.test('verified transaction grants exactly 30 once, retains original twelve-calendar-month expiry, and rejects owner transfer', async () => {
      purchased = await value(`select to_char(now() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as value`);
      const args = [owner, 'synthetic-apple-1', purchased, false];
      const sql = 'select public.stride_coach_v2_pack_event($1,$2,$3,$4) as value';
      assert.equal((await value(sql, args)).duplicate, false);
      assert.equal((await value(sql, args)).duplicate, true);
      assert.equal((await usage()).purchasedRemaining, 30);
      const expiry = await value(`select expires_at = (((purchased_at at time zone 'UTC') + interval '12 months') at time zone 'UTC') as value from public.stride_coach_v2_pack where transaction_id='synthetic-apple-1'`);
      assert.equal(expiry, true);
      await assert.rejects(value(sql, [other, ...args.slice(1)]));
      assert.equal((await value('select public.stride_coach_v2_purchase($1,$2,false) as value', [owner, requestId()])).status, 'balance_remaining');
    });
    await t.test('first twenty Pro requests spend included messages; replay never spends again, next request spends purchased', async () => {
      for (let i = 0; i < 20; i++) {
        const id = requestId(); assert.equal((await reserve(id)).status, 'reserved');
        if (i === 0) {
          assert.equal((await reserve(requestId())).status, 'pending');
          assert.equal((await reserve(id, owner, true, 'b'.repeat(64))).status, 'conflict');
        }
        assert.equal(await finish(id), true); assert.equal((await reserve(id)).status, 'cached');
        // Simulate normal pacing rather than intentionally triggering the
        // separate per-minute provider-attempt safety gate in this dose test.
        await db.query(`update public.stride_coach_v2_request set created_at=now()-interval '10 minutes' where owner_id=$1 and request_id=$2`, [owner,id]);
      }
      assert.equal((await usage()).remaining, 0); assert.equal((await usage()).purchasedRemaining, 30);
      const id = requestId(); assert.equal((await reserve(id)).status, 'reserved'); await finish(id);
      assert.equal((await usage()).purchasedRemaining, 29);
    });
    await t.test('standalone owner can use purchased balance; failure returns exactly one credit without releasing operating reservation', async () => {
      await value('select public.stride_coach_v2_pack_event($1,$2,now(),false) as value', [other, 'synthetic-apple-2']);
      const before = Number(await value('select sum(reserved_nano_usd) as value from public.stride_coach_v2_spend'));
      const id = requestId(); assert.equal((await reserve(id, other, false)).status, 'reserved');
      assert.equal((await usage(other, false)).purchasedRemaining, 29);
      assert.equal(await finish(id, null, other), true); assert.equal(await finish(id, null, other), false);
      assert.equal((await usage(other, false)).purchasedRemaining, 30);
      assert.equal(Number(await value('select sum(reserved_nano_usd) as value from public.stride_coach_v2_spend')), before + 20_000_000);
      assert.equal((await reserve(id, other, false)).status, 'expired');
    });
    await t.test('failed-call circuit preserves customer credits while limiting repeated provider attempts', async () => {
      const before=(await usage(other,false)).purchasedRemaining;
      for(let i=0;i<2;i++){ const id=requestId(); assert.equal((await reserve(id,other,false)).status,'reserved'); await finish(id,null,other); }
      assert.equal((await reserve(requestId(),other,false)).status,'rate_limited');
      assert.equal((await usage(other,false)).purchasedRemaining,before);
      await db.query(`update public.stride_coach_v2_request set created_at=now()-interval '10 minutes' where owner_id=$1`,[other]);
    });
    await t.test('24h answer expiry purges content but retains tombstone; cross-owner recovery cannot see it', async () => {
      const id = requestId(); await reserve(id); await finish(id);
      const result = await lookup(id); assert.equal(result.status, 'complete'); assert.ok(Number.isSafeInteger(result.response.createdAt));
      assert.equal((await lookup(id, other)).status, 'not_found');
      await db.query(`update public.stride_coach_v2_request set response_expires_at=now()-interval '1 second' where owner_id=$1 and request_id=$2`, [owner, id]);
      assert.equal((await lookup(id)).status, 'expired');
      assert.equal(await value('select response is null as value from public.stride_coach_v2_request where owner_id=$1 and request_id=$2', [owner, id]), true);
      assert.equal((await reserve(id)).status, 'expired');
    });
    await t.test('stranded pending request restores credit after 90s without retrying generation', async () => {
      const before = (await usage()).purchasedRemaining;
      const id = requestId(); await reserve(id);
      await db.query(`update public.stride_coach_v2_request set created_at=now()-interval '91 seconds' where owner_id=$1 and request_id=$2`, [owner, id]);
      assert.equal((await lookup(id)).status, 'failed'); assert.equal((await usage()).purchasedRemaining, before);
      assert.equal((await reserve(id)).status, 'expired');
    });
    await t.test('operator rollback refuses pending work, preserves paid credit and seeds old-client usage without a new allowance', async () => {
      // Owner has completed the daily twenty; only a purchased message is at risk.
      const before=(await usage()).purchasedRemaining;
      const id=requestId(); assert.equal((await reserve(id)).status,'reserved');
      assert.equal((await value('select public.stride_coach_v2_rollback_owner($1) as value',[owner])).status,'pending');
      assert.equal(await value('select public.stride_coach_v2_is_enrolled($1) as value',[owner]),true);
      await finish(id);
      assert.equal((await value('select public.stride_coach_v2_rollback_owner($1) as value',[owner])).status,'rolled_back');
      assert.equal(await value('select public.stride_coach_v2_is_enrolled($1) as value',[owner]),false);
      assert.equal(Number(await value(`select requests as value from public.stride_coach_usage where scope=$1 and day=(now() at time zone 'UTC')::date`,[owner])),20);
      assert.equal(await value('select public.consume_stride_coach_allowance($1) as value',[owner]),false);
      assert.equal((await usage()).purchasedRemaining,before-1);
      assert.equal((await usage()).used,20);
      const resumed=requestId(); assert.equal((await reserve(resumed)).status,'reserved'); await finish(resumed);
      assert.equal(await value('select public.stride_coach_v2_is_enrolled($1) as value',[owner]),true);
      assert.equal((await usage()).purchasedRemaining,before-2);
    });
    await t.test('refund-before-purchase is a permanent revoked receipt; subscription changes do not renew purchased expiry', async () => {
      const sql = 'select public.stride_coach_v2_pack_event($1,$2,now(),$3) as value';
      await value(sql, [other, 'synthetic-refunded-first', true]);
      assert.equal((await value(sql, [other, 'synthetic-refunded-first', false])).revoked, true);
      const before = (await usage()).purchasedExpiresAt;
      await usage(owner, false); await usage(owner, true);
      assert.equal((await usage()).purchasedExpiresAt, before);
      await db.query(`update public.stride_coach_v2_pack set expires_at=now()-interval '1 second', purchased_at=now()-interval '13 months' where owner_id=$1`, [other]);
      assert.equal((await usage(other, false)).purchasedRemaining, 0);
      assert.equal((await reserve(requestId(), other, false)).status, 'exhausted');
    });
    await t.test('turning off new sales never prevents authenticated refunds or creates usable out-of-order refund credit', async () => {
      await value('select public.stride_coach_v2_pack_event($1,$2,now(),false) as value',[reader,'synthetic-sales-off']);
      assert.equal((await usage(reader,false)).purchasedRemaining,30);
      await db.exec('update public.stride_coach_v2_config set packs_enabled=false,apple_expiring_approved=false');
      assert.equal((await value('select public.stride_coach_v2_pack_event($1,$2,now(),true) as value',[reader,'synthetic-sales-off'])).revoked,true);
      assert.equal((await usage(reader,false)).purchasedRemaining,0);
      assert.equal((await reserve(requestId(),reader,false)).status,'exhausted');
      assert.equal((await value('select public.stride_coach_v2_pack_event($1,$2,now(),true) as value',[reader,'synthetic-refund-during-shutdown'])).revoked,true);
      assert.equal((await usage(reader,false)).purchasedRemaining,0);
      await assert.rejects(value('select public.stride_coach_v2_pack_event($1,$2,now(),false) as value',[reader,'synthetic-new-sale-during-shutdown']));
      await db.exec('update public.stride_coach_v2_config set packs_enabled=true,apple_expiring_approved=true');
    });
    await t.test('global limit and operating budget deny before taking a customer credit', async () => {
      const before = (await usage()).purchasedRemaining;
      await db.exec('update public.stride_coach_v2_config set monthly_budget_nano_usd=1');
      assert.equal((await reserve(requestId())).status, 'unavailable'); assert.equal((await usage()).purchasedRemaining, before);
      await db.exec('update public.stride_coach_v2_config set monthly_budget_nano_usd=2000000000');
      await db.exec(`update public.stride_coach_usage set requests=500 where scope='global'`);
      assert.equal((await reserve(requestId())).status, 'unavailable'); assert.equal((await usage()).purchasedRemaining, before);
    });
    await t.test('background purge removes expired cached content without removing request tombstones', async () => {
      await db.query(`update public.stride_coach_v2_request set response_expires_at=now()-interval '1 second' where state='complete'`);
      assert.ok(Number(await value('select public.stride_coach_v2_purge() as value'))>0);
      assert.equal(Number(await value('select count(*) as value from public.stride_coach_v2_request where response is not null')),0);
      assert.ok(Number(await value('select count(*) as value from public.stride_coach_v2_request'))>0);
    });
    await t.test('30/7-day reminders are single-flight, recipient-bound, and stop on refund, zero balance or deletion', async () => {
      await db.query(`update public.stride_coach_v2_pack set expires_at=now()+interval '29 days',remaining=11 where transaction_id='synthetic-apple-1'`);
      const first=await value('select public.stride_coach_v2_reminder_claim(25) as value');
      assert.equal(first.length,1); assert.equal(first[0].daysBefore,30);
      assert.deepEqual(await value('select public.stride_coach_v2_reminder_claim(25) as value'),[]);
      const r=first[0],args=[r.transactionId,r.daysBefore,r.leaseId];
      assert.equal((await value('select public.stride_coach_v2_reminder_check($1,$2,$3) as value',args)).remaining,11);
      assert.equal(await value('select public.stride_coach_v2_reminder_bind($1,$2,$3,$4) as value',[...args,'a'.repeat(64)]),true);
      assert.equal(await value('select public.stride_coach_v2_reminder_bind($1,$2,$3,$4) as value',[...args,'b'.repeat(64)]),false);
      assert.equal(await value('select public.stride_coach_v2_reminder_finish($1,$2,$3,true,false) as value',args),true);
      assert.equal(await value('select recipient_hash is null as value from public.stride_coach_v2_reminder where transaction_id=$1 and days_before=$2',args.slice(0,2)),true);
      assert.equal(await value('select public.stride_coach_v2_reminder_finish($1,$2,$3,true,false) as value',args),false);
      await db.query(`update public.stride_coach_v2_pack set expires_at=now()+interval '6 days' where transaction_id='synthetic-apple-1'`);
      await db.exec('update public.stride_coach_v2_config set enabled=false,packs_enabled=false,apple_expiring_approved=false');
      const second=await value('select public.stride_coach_v2_reminder_claim(25) as value'); assert.equal(second.length,1); assert.equal(second[0].daysBefore,7);
      await db.query(`update public.stride_coach_v2_pack set revoked=true where transaction_id='synthetic-apple-1'`);
      assert.equal(await value('select public.stride_coach_v2_reminder_check($1,$2,$3) as value',[second[0].transactionId,7,second[0].leaseId]),null);
      assert.deepEqual(await value('select public.stride_coach_v2_reminder_claim(25) as value'),[]);
    });
    await t.test('authenticated and anonymous roles cannot read balances, grant credits or reserve usage', async () => {
      for (const role of ['authenticated', 'anon']) {
        await db.exec(`reset role; set role ${role}`);
        await assert.rejects(value('select stride_coach_private.owner_exists($1) as value',[owner]));
        await assert.rejects(db.query('select id from auth.users'));
        await assert.rejects(db.query('select * from public.stride_coach_v2_pack'));
        await assert.rejects(usage());
        await assert.rejects(reserve(requestId()));
        await assert.rejects(value('select public.stride_coach_v2_reminder_claim(25) as value'));
        await assert.rejects(value('select public.stride_coach_v2_purge() as value'));
        await assert.rejects(value('select public.stride_coach_v2_rollback_owner($1) as value',[owner]));
      }
    });
  } finally { await db.close(); }
});
