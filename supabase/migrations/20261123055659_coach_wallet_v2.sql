-- Build 126 preparation only. No v1 table is replaced; its consumer receives
-- the compatibility bridge below. All new APIs are service-role-only; the Edge
-- Function supplies the authenticated owner. No deployed state changes here.
create table public.stride_coach_v2_config (
  singleton boolean primary key default true check (singleton),
  enabled boolean not null default false,
  packs_enabled boolean not null default false,
  apple_expiring_approved boolean not null default false,
  monthly_budget_nano_usd bigint not null default 0 check (monthly_budget_nano_usd >= 0)
);
insert into public.stride_coach_v2_config(singleton) values (true);

create table public.stride_coach_v2_wallet (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  enrolled boolean not null default false,
  timezone text not null,
  pending_timezone text,
  period_started timestamptz not null,
  resets_at timestamptz not null,
  daily_used integer not null default 0 check (daily_used between 0 and 20)
);
create table public.stride_coach_v2_pack (
  transaction_id text primary key,
  owner_id uuid references auth.users(id) on delete set null,
  purchased_at timestamptz not null,
  expires_at timestamptz not null,
  remaining integer not null check (remaining between 0 and 30),
  revoked boolean not null default false,
  policy_exception boolean not null default false,
  check (expires_at > purchased_at)
);
create index stride_coach_v2_pack_owner on public.stride_coach_v2_pack(owner_id);
create table public.stride_coach_v2_request (
  owner_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  body_hash text not null check (body_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  state text not null check (state in ('pending','complete','failed')),
  source text not null check (source in ('included','purchased')),
  source_period timestamptz,
  source_transaction text references public.stride_coach_v2_pack(transaction_id),
  response jsonb,
  response_expires_at timestamptz,
  primary key (owner_id, request_id)
);
create table public.stride_coach_v2_spend (
  month date primary key,
  reserved_nano_usd bigint not null check (reserved_nano_usd >= 0)
);
create index stride_coach_v2_request_owner_time on public.stride_coach_v2_request(owner_id,created_at);
create table public.stride_coach_v2_purchase_intent (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  id uuid not null unique,
  expires_at timestamptz not null
);
create table public.stride_coach_v2_reminder (
  transaction_id text not null references public.stride_coach_v2_pack(transaction_id) on delete cascade,
  days_before integer not null check (days_before in (30,7)),
  state text not null default 'queued' check (state in ('queued','sending','sent','skipped')),
  first_claimed_at timestamptz,
  lease_id uuid,
  lease_expires_at timestamptz,
  attempts integer not null default 0 check (attempts >= 0),
  sent_at timestamptz,
  recipient_hash text check (recipient_hash is null or recipient_hash ~ '^[0-9a-f]{64}$'),
  primary key(transaction_id, days_before)
);

do $$ declare item text; begin
  foreach item in array array['stride_coach_v2_config','stride_coach_v2_wallet','stride_coach_v2_pack','stride_coach_v2_request','stride_coach_v2_spend','stride_coach_v2_purchase_intent','stride_coach_v2_reminder'] loop
    execute format('alter table public.%I enable row level security', item);
    execute format('revoke all on public.%I from public, anon, authenticated', item);
    execute format('grant all on public.%I to service_role', item);
    execute format('create policy %I on public.%I for all to service_role using (true) with check (true)', item || '_service', item);
  end loop;
end $$;

create function public.stride_coach_v2_refresh(p_owner uuid, p_timezone text)
returns public.stride_coach_v2_wallet language plpgsql security invoker set search_path = '' as $$
declare w public.stride_coach_v2_wallet; t timestamptz := now(); z text; stale record; begin
  if p_owner is null or not exists (select 1 from auth.users where id = p_owner)
    or exists (select 1 from public.stride_account_deletion_requests where user_id = p_owner) then
    raise exception 'Account unavailable';
  end if;
  if length(p_timezone) > 100 or not exists (select 1 from pg_catalog.pg_timezone_names where name = p_timezone) then
    raise exception 'Invalid timezone';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('stride-coach-v2-owner:' || p_owner::text, 0));
  insert into public.stride_coach_v2_wallet(owner_id, timezone, period_started, resets_at)
    values (p_owner, p_timezone, t, ((t at time zone p_timezone)::date + 1)::timestamp at time zone p_timezone)
    on conflict (owner_id) do nothing;
  select * into w from public.stride_coach_v2_wallet where owner_id = p_owner for update;
  for stale in select request_id from public.stride_coach_v2_request
    where owner_id = p_owner and state = 'pending' and created_at < t - interval '90 seconds' loop
    perform public.stride_coach_v2_finish(p_owner, stale.request_id, null);
  end loop;
  select * into w from public.stride_coach_v2_wallet where owner_id = p_owner;
  if w.resets_at <= t then
    z := coalesce(w.pending_timezone, w.timezone);
    -- A requested timezone change cannot create a fresh grant. At the existing
    -- boundary it carries usage to the next midnight in the new timezone. A
    -- long-dormant account may receive its ordinary single current-day grant.
    update public.stride_coach_v2_wallet set
      daily_used = case when z <> w.timezone and t < w.resets_at + interval '24 hours' then w.daily_used else 0 end,
      timezone = z, pending_timezone = null, period_started = t,
      resets_at = ((t at time zone z)::date + 1)::timestamp at time zone z
      where owner_id = p_owner returning * into w;
  end if;
  if p_timezone <> w.timezone then
    update public.stride_coach_v2_wallet set pending_timezone = p_timezone where owner_id = p_owner returning * into w;
  elsif w.pending_timezone is not null then
    update public.stride_coach_v2_wallet set pending_timezone = null where owner_id = p_owner returning * into w;
  end if;
  -- Purging the response body does not purge replay protection or billing.
  update public.stride_coach_v2_request set response = null
    where owner_id = p_owner and response_expires_at <= t and response is not null;
  return w;
end $$;

create function public.stride_coach_v2_usage(p_owner uuid, p_timezone text, p_pro boolean)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare w public.stride_coach_v2_wallet; c public.stride_coach_v2_config; n integer; expiry timestamptz;
  legacy_used integer; v_day date := (now() at time zone 'UTC')::date; begin
  w := public.stride_coach_v2_refresh(p_owner, p_timezone);
  select * into c from public.stride_coach_v2_config where singleton;
  -- Read the same effective migration allowance as reserve, without enrolling
  -- the owner or granting/changing any legacy quota. UI cannot advertise twenty
  -- when the first reservation will import an already-used legacy allowance.
  if not w.enrolled then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('stride-coach:'||v_day::text,0));
    select least(20,coalesce(sum(requests),0))::integer into legacy_used from public.stride_coach_usage
      where scope=p_owner::text and day between
        ((date_trunc('day',now() at time zone w.timezone) at time zone w.timezone) at time zone 'UTC')::date and v_day;
    w.daily_used := greatest(w.daily_used,legacy_used);
  end if;
  select coalesce(sum(remaining), 0), min(expires_at) into n, expiry from public.stride_coach_v2_pack
    where owner_id = p_owner and not revoked and expires_at > now() and remaining > 0;
  return jsonb_build_object('version', 2, 'used', case when p_pro then w.daily_used else 0 end,
    'limit', case when p_pro then 20 else 0 end, 'remaining', case when p_pro then 20 - w.daily_used else 0 end,
    'resetsAt', to_char(w.resets_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'timezone', w.timezone, 'timezoneChangePending', w.pending_timezone is not null,
    'purchasedRemaining', n, 'purchasedExpiresAt', case when expiry is null then null else to_char(expiry at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') end,
    'packsEnabled', c.enabled and c.packs_enabled and c.apple_expiring_approved and c.monthly_budget_nano_usd > 0,
    'canPurchase', n = 0 and c.enabled and c.packs_enabled and c.apple_expiring_approved and c.monthly_budget_nano_usd > 0
      and not exists (select 1 from public.stride_coach_v2_request where owner_id = p_owner and state = 'pending')
      and not exists (select 1 from public.stride_coach_v2_purchase_intent where owner_id = p_owner and expires_at > now()),
    'pro', p_pro);
end $$;

create function public.stride_coach_v2_reserve(p_owner uuid, p_timezone text, p_pro boolean, p_request uuid, p_hash text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare w public.stride_coach_v2_wallet; c public.stride_coach_v2_config; r public.stride_coach_v2_request;
  pack text; src text; v_day date := (now() at time zone 'UTC')::date;
  v_month date := date_trunc('month', now() at time zone 'UTC')::date; global_used integer; legacy_used integer; spent bigint; begin
  w := public.stride_coach_v2_refresh(p_owner, p_timezone);
  if p_request is null or p_hash !~ '^[0-9a-f]{64}$' then raise exception 'Invalid request'; end if;
  select * into r from public.stride_coach_v2_request where owner_id = p_owner and request_id = p_request;
  if found then
    if r.body_hash <> p_hash then return jsonb_build_object('status','conflict'); end if;
    if r.state = 'complete' and r.response is not null and r.response_expires_at > now() then
      return jsonb_build_object('status','cached','response',r.response);
    end if;
    if r.state = 'pending' then return jsonb_build_object('status','pending'); end if;
    return jsonb_build_object('status','expired');
  end if;
  -- Do not automatically repeat an ambiguous provider request. A stale pending
  -- reservation blocks new work until the service-only reconciliation function
  -- settles it; no credit can be duplicated by a client timeout.
  if exists (select 1 from public.stride_coach_v2_request where owner_id = p_owner and state = 'pending') then
    return jsonb_build_object('status','pending');
  end if;
  -- Customer-credit refunds cannot turn repeated provider failures into an
  -- unlimited free upstream retry loop. Cached receipt reads bypass this gate.
  if (select count(*) from public.stride_coach_v2_request where owner_id=p_owner and created_at>now()-interval '1 minute') >= 6
    or (select count(*) from public.stride_coach_v2_request where owner_id=p_owner and state='failed' and created_at>now()-interval '5 minutes') >= 3 then
    return jsonb_build_object('status','rate_limited');
  end if;
  select * into c from public.stride_coach_v2_config where singleton;
  if not c.enabled or c.monthly_budget_nano_usd <= 0 then return jsonb_build_object('status','unavailable'); end if;
  -- Both versions take owner -> UTC-global locks in this order. Until actual
  -- v2 enrollment, preserve old clients. At enrollment conservatively count all
  -- legacy UTC buckets overlapping this local day (legacy has no per-call time).
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('stride-coach:' || v_day::text, 0));
  if not w.enrolled then
    select least(20,coalesce(sum(requests),0))::integer into legacy_used from public.stride_coach_usage
      where scope=p_owner::text and day between
        ((date_trunc('day',now() at time zone w.timezone) at time zone w.timezone) at time zone 'UTC')::date and v_day;
    w.daily_used := greatest(w.daily_used,legacy_used);
  end if;
  if p_pro and w.daily_used < 20 then src := 'included';
  else
    select transaction_id into pack from public.stride_coach_v2_pack
      where owner_id = p_owner and not revoked and remaining > 0 and expires_at > now()
      order by expires_at, transaction_id limit 1 for update;
    if pack is null then return jsonb_build_object('status','exhausted'); end if;
    src := 'purchased';
  end if;
  -- Share v1's existing 500/day counter and lock; this does not raise capacity.
  select requests into global_used from public.stride_coach_usage where scope = 'global' and day = v_day;
  if coalesce(global_used, 0) >= 500 then return jsonb_build_object('status','unavailable'); end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('stride-coach-v2-spend:' || v_month::text, 0));
  select reserved_nano_usd into spent from public.stride_coach_v2_spend where month = v_month;
  -- 2 cents is reserved per attempted bounded provider call. Failed/unknown
  -- provider use does not refund this conservative operating reservation.
  if coalesce(spent, 0) + 20000000 > c.monthly_budget_nano_usd then return jsonb_build_object('status','unavailable'); end if;
  insert into public.stride_coach_v2_spend values (v_month, 20000000)
    on conflict (month) do update set reserved_nano_usd = stride_coach_v2_spend.reserved_nano_usd + 20000000;
  insert into public.stride_coach_usage(day, scope, requests) values (v_day, 'global', 1)
    on conflict(day, scope) do update set requests = stride_coach_usage.requests + 1;
  update public.stride_coach_v2_wallet set enrolled=true,daily_used=w.daily_used where owner_id=p_owner;
  if src = 'included' then
    update public.stride_coach_v2_wallet set daily_used = daily_used + 1 where owner_id = p_owner;
  else
    update public.stride_coach_v2_pack set remaining = remaining - 1 where transaction_id = pack;
  end if;
  insert into public.stride_coach_v2_request(owner_id, request_id, body_hash, state, source, source_period, source_transaction)
    values (p_owner, p_request, p_hash, 'pending', src, w.period_started, pack);
  return jsonb_build_object('status','reserved');
end $$;

create function public.stride_coach_v2_is_enrolled(p_owner uuid)
returns boolean language sql stable security invoker set search_path = '' as $$
  select exists(select 1 from public.stride_coach_v2_wallet where owner_id=p_owner and enrolled);
$$;

create function public.stride_coach_v2_rollback_owner(p_owner uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare w public.stride_coach_v2_wallet; v_day date := (now() at time zone 'UTC')::date; begin
  if p_owner is null or not exists(select 1 from auth.users where id=p_owner)
    or exists(select 1 from public.stride_account_deletion_requests where user_id=p_owner) then raise exception 'Account unavailable'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('stride-coach-v2-owner:'||p_owner::text,0));
  select * into w from public.stride_coach_v2_wallet where owner_id=p_owner for update;
  if not found or not w.enrolled then return jsonb_build_object('status','not_enrolled'); end if;
  if exists(select 1 from public.stride_coach_v2_request where owner_id=p_owner and state='pending') then
    return jsonb_build_object('status','pending');
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('stride-coach:'||v_day::text,0));
  -- Operator-only rollback is conservative: preserve already-consumed work in
  -- the current legacy UTC bucket rather than grant a new twenty. Never erase
  -- paid balances, reservations, caches or global spend to restore an old app.
  insert into public.stride_coach_usage(day,scope,requests) values(v_day,p_owner::text,least(20,w.daily_used))
    on conflict(day,scope) do update set requests=greatest(stride_coach_usage.requests,excluded.requests);
  update public.stride_coach_v2_wallet set enrolled=false where owner_id=p_owner;
  return jsonb_build_object('status','rolled_back');
end $$;

-- Compatibility bridge: installing the migration does not change unenrolled
-- Build125 owners. An owner who has actually reserved v2 work must use v2;
-- calling the old endpoint cannot create a second UTC-day allowance.
create or replace function public.consume_stride_coach_allowance(owner_id uuid)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare usage_day date := (now() at time zone 'UTC')::date; global_count integer; owner_count integer; begin
  if owner_id is null or not exists(select 1 from auth.users where id=owner_id)
    or exists(select 1 from public.stride_account_deletion_requests where user_id=owner_id) then return false; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('stride-coach-v2-owner:'||owner_id::text,0));
  if public.stride_coach_v2_is_enrolled(owner_id) then return false; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('stride-coach:'||usage_day::text,0));
  delete from public.stride_coach_usage where day < usage_day-7;
  select requests into global_count from public.stride_coach_usage where day=usage_day and scope='global';
  select requests into owner_count from public.stride_coach_usage where day=usage_day and scope=owner_id::text;
  if coalesce(global_count,0)>=500 or coalesce(owner_count,0)>=20 then return false; end if;
  insert into public.stride_coach_usage(day,scope,requests) values(usage_day,'global',1),(usage_day,owner_id::text,1)
    on conflict(day,scope) do update set requests=stride_coach_usage.requests+1;
  return true;
end $$;

create function public.stride_coach_v2_lookup(p_owner uuid, p_request uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare r public.stride_coach_v2_request; begin
  if not exists (select 1 from auth.users where id = p_owner)
    or exists (select 1 from public.stride_account_deletion_requests where user_id = p_owner) then raise exception 'Account unavailable'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('stride-coach-v2-owner:' || p_owner::text, 0));
  select * into r from public.stride_coach_v2_request where owner_id = p_owner and request_id = p_request for update;
  if not found then return jsonb_build_object('status','not_found'); end if;
  if r.state = 'pending' and r.created_at < now() - interval '90 seconds' then
    -- Provider has a 25s server timeout. Recover a stranded receipt without
    -- reissuing the generation; keep its global/currency reservation spent.
    perform public.stride_coach_v2_finish(p_owner, p_request, null);
    return jsonb_build_object('status','failed');
  end if;
  if r.state = 'complete' then
    if r.response_expires_at <= now() or r.response is null then
      update public.stride_coach_v2_request set response = null where owner_id = p_owner and request_id = p_request;
      return jsonb_build_object('status','expired');
    end if;
    return jsonb_build_object('status','complete','response',r.response);
  end if;
  return jsonb_build_object('status',r.state);
end $$;

create function public.stride_coach_v2_purchase(p_owner uuid, p_intent uuid, p_cancel boolean default false)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare c public.stride_coach_v2_config; existing public.stride_coach_v2_purchase_intent; begin
  if not exists (select 1 from auth.users where id = p_owner)
    or exists (select 1 from public.stride_account_deletion_requests where user_id = p_owner) then raise exception 'Account unavailable'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('stride-coach-v2-owner:' || p_owner::text, 0));
  if p_cancel then
    delete from public.stride_coach_v2_purchase_intent where owner_id = p_owner and id = p_intent;
    return jsonb_build_object('status','cancelled');
  end if;
  select * into c from public.stride_coach_v2_config where singleton;
  if not c.enabled or not c.packs_enabled or not c.apple_expiring_approved or c.monthly_budget_nano_usd <= 0 then
    return jsonb_build_object('status','unavailable');
  end if;
  if exists (select 1 from public.stride_coach_v2_pack where owner_id = p_owner and not revoked and remaining > 0 and expires_at > now()) then
    return jsonb_build_object('status','balance_remaining');
  end if;
  if exists (select 1 from public.stride_coach_v2_request where owner_id = p_owner and state = 'pending') then
    return jsonb_build_object('status','pending');
  end if;
  select * into existing from public.stride_coach_v2_purchase_intent where owner_id = p_owner for update;
  if found and existing.expires_at > now() then return jsonb_build_object('status','pending'); end if;
  insert into public.stride_coach_v2_purchase_intent values (p_owner, p_intent, now() + interval '5 minutes')
    on conflict (owner_id) do update set id = excluded.id, expires_at = excluded.expires_at returning * into existing;
  return jsonb_build_object('status','reserved','id',existing.id,
    'expiresAt',to_char(existing.expires_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));
end $$;

create function public.stride_coach_v2_finish(p_owner uuid, p_request uuid, p_response jsonb)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare r public.stride_coach_v2_request; begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('stride-coach-v2-owner:' || p_owner::text, 0));
  select * into r from public.stride_coach_v2_request where owner_id = p_owner and request_id = p_request for update;
  if not found or r.state <> 'pending' then return false; end if;
  if p_response is not null then
    if jsonb_typeof(p_response->'content') <> 'array' or octet_length(p_response::text) > 65536 then raise exception 'Invalid response'; end if;
    update public.stride_coach_v2_request set state = 'complete',
      response = jsonb_set(p_response, '{createdAt}', to_jsonb(floor(extract(epoch from now()) * 1000)::bigint)),
      response_expires_at = now() + interval '24 hours' where owner_id = p_owner and request_id = p_request;
  else
    if r.source = 'included' then
      update public.stride_coach_v2_wallet set daily_used = greatest(0, daily_used - 1)
        where owner_id = p_owner and period_started = r.source_period;
    else
      update public.stride_coach_v2_pack set remaining = least(30, remaining + 1)
        where transaction_id = r.source_transaction;
    end if;
    update public.stride_coach_v2_request set state = 'failed', response = null
      where owner_id = p_owner and request_id = p_request;
  end if;
  return true;
end $$;

create function public.stride_coach_v2_pack_event(p_owner uuid, p_transaction text, p_purchased timestamptz, p_refund boolean)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare c public.stride_coach_v2_config; existing public.stride_coach_v2_pack; active_count integer; begin
  if p_transaction is null or p_transaction !~ '^[A-Za-z0-9._:-]{1,128}$'
    or p_purchased > now() + interval '5 minutes' or p_purchased < timestamptz '2026-01-01' then raise exception 'Invalid transaction'; end if;
  select * into c from public.stride_coach_v2_config where singleton;
  if not p_refund and (not c.enabled or not c.packs_enabled or not c.apple_expiring_approved) then raise exception 'Packs unavailable'; end if;
  -- Global transaction identity prevents replay to a different account.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('stride-coach-v2-owner:' || p_owner::text, 0));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('stride-coach-v2-purchase:' || p_transaction, 0));
  select * into existing from public.stride_coach_v2_pack where transaction_id = p_transaction for update;
  if found then
    if not p_refund and existing.owner_id is distinct from p_owner then raise exception 'Transaction owner mismatch'; end if;
    if p_refund then update public.stride_coach_v2_pack set revoked = true where transaction_id = p_transaction; end if;
    return jsonb_build_object('duplicate', true, 'revoked', existing.revoked or p_refund);
  end if;
  select count(*) into active_count from public.stride_coach_v2_pack
    where owner_id = p_owner and not revoked and remaining > 0 and expires_at > now();
  -- The app/server offer blocks purchases while credit remains. A genuinely
  -- paid concurrent/out-of-band purchase must not disappear: preserve its value
  -- and mark the policy exception for operator reconciliation, never double a
  -- transaction or silently forfeit money. Activation requires this flow QA.
  insert into public.stride_coach_v2_pack(transaction_id, owner_id, purchased_at, expires_at, remaining, revoked, policy_exception)
    values (p_transaction, case when exists(select 1 from auth.users where id=p_owner) then p_owner else null end, p_purchased,
      ((p_purchased at time zone 'UTC') + interval '12 months') at time zone 'UTC',
      30, p_refund, active_count > 0 or not exists (select 1 from public.stride_coach_v2_purchase_intent where owner_id = p_owner and expires_at >= p_purchased));
  delete from public.stride_coach_v2_purchase_intent where owner_id = p_owner;
  return jsonb_build_object('duplicate', false, 'revoked', p_refund, 'policyException', active_count > 0);
end $$;

create function public.stride_coach_v2_purge()
returns integer language plpgsql security invoker set search_path = '' as $$
declare cleared integer; begin
  update public.stride_coach_v2_request set response = null where response_expires_at <= now() and response is not null;
  get diagnostics cleared = row_count;
  delete from public.stride_coach_v2_purchase_intent where expires_at <= now();
  update public.stride_coach_v2_reminder r set recipient_hash=null
    where recipient_hash is not null and (first_claimed_at<now()-interval '24 hours'
      or exists(select 1 from public.stride_coach_v2_pack p where p.transaction_id=r.transaction_id and p.owner_id is null));
  return cleared;
end $$;

create function public.stride_coach_v2_reminder_claim(p_limit integer default 25)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare row record; result jsonb := '[]'::jsonb; lease uuid; begin
  -- Expiry notices for already-sold credit continue if new sales or generation
  -- are disabled. This cannot grant credit or enable a purchase.
  if p_limit < 1 or p_limit > 100 then raise exception 'Invalid reminder batch'; end if;
  insert into public.stride_coach_v2_reminder(transaction_id,days_before)
    select p.transaction_id, d.days from public.stride_coach_v2_pack p cross join (values (30),(7)) as d(days)
    where not p.revoked and p.owner_id is not null and p.remaining > 0 and p.expires_at > now()
      and p.expires_at <= now() + make_interval(days => d.days)
      and (d.days=7 or p.expires_at>now()+interval '7 days')
      and not exists (select 1 from public.stride_account_deletion_requests where user_id = p.owner_id)
    on conflict(transaction_id,days_before) do nothing;
  -- A single daily run can catch up a missed reminder. Provider retries use a
  -- stable idempotency key; uncertain sends older than its 24h window are left
  -- for operator reconciliation instead of risking a duplicate email.
  for row in select r.transaction_id, r.days_before, p.owner_id, p.remaining, p.expires_at
    from public.stride_coach_v2_reminder r join public.stride_coach_v2_pack p using(transaction_id)
    where not p.revoked and p.owner_id is not null and p.remaining > 0 and p.expires_at > now()
      and not exists (select 1 from public.stride_account_deletion_requests where user_id = p.owner_id)
      and r.state in ('queued','sending') and r.attempts < 5
      and (r.lease_expires_at is null or r.lease_expires_at <= now())
      and (r.first_claimed_at is null or r.first_claimed_at > now() - interval '23 hours')
    order by p.expires_at, r.days_before desc limit p_limit for update of r skip locked loop
    lease := gen_random_uuid();
    update public.stride_coach_v2_reminder set state='sending', first_claimed_at=coalesce(first_claimed_at,now()),
      lease_id=lease,lease_expires_at=now()+interval '5 minutes',attempts=attempts+1
      where transaction_id=row.transaction_id and days_before=row.days_before;
    result := result || jsonb_build_array(jsonb_build_object('transactionId',row.transaction_id,'daysBefore',row.days_before,
      'owner',row.owner_id,'remaining',row.remaining,'expiresAt',to_char(row.expires_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'leaseId',lease));
  end loop;
  return result;
end $$;

create function public.stride_coach_v2_reminder_bind(p_transaction text,p_days integer,p_lease uuid,p_hash text)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare changed integer; begin
  if p_hash !~ '^[0-9a-f]{64}$' then return false; end if;
  update public.stride_coach_v2_reminder set recipient_hash=p_hash
    where transaction_id=p_transaction and days_before=p_days and lease_id=p_lease and state='sending'
      and lease_expires_at>now() and (recipient_hash is null or recipient_hash=p_hash);
  get diagnostics changed = row_count;
  return changed=1;
end $$;

create function public.stride_coach_v2_reminder_check(p_transaction text,p_days integer,p_lease uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare result jsonb; begin
  select jsonb_build_object('owner',p.owner_id,'remaining',p.remaining,
    'expiresAt',to_char(p.expires_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) into result
    from public.stride_coach_v2_reminder r join public.stride_coach_v2_pack p using(transaction_id)
    where r.transaction_id=p_transaction and r.days_before=p_days and r.lease_id=p_lease
      and r.state='sending' and r.lease_expires_at>now() and p.owner_id is not null
      and not p.revoked and p.remaining>0 and p.expires_at>now()
      and not exists(select 1 from public.stride_account_deletion_requests where user_id=p.owner_id);
  return coalesce(result,'null'::jsonb);
end $$;

create function public.stride_coach_v2_reminder_finish(p_transaction text,p_days integer,p_lease uuid,p_sent boolean,p_skip boolean default false)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare changed integer; begin
  update public.stride_coach_v2_reminder set state=case when p_sent then 'sent' when p_skip then 'skipped' else 'sending' end,
    sent_at=case when p_sent then now() else null end,
    recipient_hash=case when p_sent or p_skip then null else recipient_hash end
    where transaction_id=p_transaction and days_before=p_days and lease_id=p_lease and state='sending';
  get diagnostics changed = row_count;
  return changed=1;
end $$;

-- Minimize privileges even if the database's default function ACL is broad.
revoke all on function public.stride_coach_v2_refresh(uuid,text) from public, anon, authenticated;
revoke all on function public.stride_coach_v2_usage(uuid,text,boolean) from public, anon, authenticated;
revoke all on function public.stride_coach_v2_reserve(uuid,text,boolean,uuid,text) from public, anon, authenticated;
revoke all on function public.stride_coach_v2_finish(uuid,uuid,jsonb) from public, anon, authenticated;
revoke all on function public.stride_coach_v2_pack_event(uuid,text,timestamptz,boolean) from public, anon, authenticated;
revoke all on function public.stride_coach_v2_lookup(uuid,uuid) from public, anon, authenticated;
revoke all on function public.stride_coach_v2_purchase(uuid,uuid,boolean) from public, anon, authenticated;
revoke all on function public.stride_coach_v2_is_enrolled(uuid) from public, anon, authenticated;
revoke all on function public.stride_coach_v2_rollback_owner(uuid) from public, anon, authenticated;
revoke all on function public.consume_stride_coach_allowance(uuid) from public, anon, authenticated;
revoke all on function public.stride_coach_v2_purge() from public, anon, authenticated;
revoke all on function public.stride_coach_v2_reminder_claim(integer) from public, anon, authenticated;
revoke all on function public.stride_coach_v2_reminder_check(text,integer,uuid) from public, anon, authenticated;
revoke all on function public.stride_coach_v2_reminder_bind(text,integer,uuid,text) from public, anon, authenticated;
revoke all on function public.stride_coach_v2_reminder_finish(text,integer,uuid,boolean,boolean) from public, anon, authenticated;
grant execute on function public.stride_coach_v2_refresh(uuid,text), public.stride_coach_v2_usage(uuid,text,boolean),
  public.stride_coach_v2_reserve(uuid,text,boolean,uuid,text), public.stride_coach_v2_finish(uuid,uuid,jsonb),
  public.stride_coach_v2_pack_event(uuid,text,timestamptz,boolean),
  public.stride_coach_v2_lookup(uuid,uuid), public.stride_coach_v2_purchase(uuid,uuid,boolean),
  public.stride_coach_v2_is_enrolled(uuid), public.consume_stride_coach_allowance(uuid),
  public.stride_coach_v2_rollback_owner(uuid),
  public.stride_coach_v2_purge(), public.stride_coach_v2_reminder_claim(integer),
  public.stride_coach_v2_reminder_check(text,integer,uuid),
  public.stride_coach_v2_reminder_bind(text,integer,uuid,text),
  public.stride_coach_v2_reminder_finish(text,integer,uuid,boolean,boolean) to service_role;
