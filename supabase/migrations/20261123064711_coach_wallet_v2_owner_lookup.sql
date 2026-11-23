-- Correct the v2/legacy compatibility bridge for hardened hosted Auth ACLs.
-- Do not grant service_role SELECT on auth.users or elevate the whole ledger.
-- The only definer operation is an internal existence predicate; it exposes no
-- account fields, runs no dynamic SQL and is executable only by service_role.
-- This schema must remain outside the Data API exposed-schema allowlist.
create schema if not exists stride_coach_private;
revoke all on schema stride_coach_private from public, anon, authenticated, service_role;
grant usage on schema stride_coach_private to service_role;

create function stride_coach_private.owner_exists(p_owner uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_owner is not null and exists(select 1 from auth.users where id = p_owner);
$$;
revoke all on function stride_coach_private.owner_exists(uuid) from public, anon, authenticated;
grant execute on function stride_coach_private.owner_exists(uuid) to service_role;

create or replace function public.stride_coach_v2_refresh(p_owner uuid, p_timezone text)
returns public.stride_coach_v2_wallet language plpgsql security invoker set search_path = '' as $$
declare w public.stride_coach_v2_wallet; t timestamptz := now(); z text; stale record; begin
  if p_owner is null or not stride_coach_private.owner_exists(p_owner)
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

create or replace function public.stride_coach_v2_rollback_owner(p_owner uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare w public.stride_coach_v2_wallet; v_day date := (now() at time zone 'UTC')::date; begin
  if p_owner is null or not stride_coach_private.owner_exists(p_owner)
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

create or replace function public.consume_stride_coach_allowance(owner_id uuid)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare usage_day date := (now() at time zone 'UTC')::date; global_count integer; owner_count integer; begin
  if owner_id is null or not stride_coach_private.owner_exists(owner_id)
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

create or replace function public.stride_coach_v2_lookup(p_owner uuid, p_request uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare r public.stride_coach_v2_request; begin
  if not stride_coach_private.owner_exists(p_owner)
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

create or replace function public.stride_coach_v2_purchase(p_owner uuid, p_intent uuid, p_cancel boolean default false)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare c public.stride_coach_v2_config; existing public.stride_coach_v2_purchase_intent; begin
  if not stride_coach_private.owner_exists(p_owner)
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

create or replace function public.stride_coach_v2_pack_event(p_owner uuid, p_transaction text, p_purchased timestamptz, p_refund boolean)
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
    values (p_transaction, case when stride_coach_private.owner_exists(p_owner) then p_owner else null end, p_purchased,
      ((p_purchased at time zone 'UTC') + interval '12 months') at time zone 'UTC',
      30, p_refund, active_count > 0 or not exists (select 1 from public.stride_coach_v2_purchase_intent where owner_id = p_owner and expires_at >= p_purchased));
  delete from public.stride_coach_v2_purchase_intent where owner_id = p_owner;
  return jsonb_build_object('duplicate', false, 'revoked', p_refund, 'policyException', active_count > 0);
end $$;
