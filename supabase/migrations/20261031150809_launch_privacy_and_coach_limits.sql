create table public.stride_coach_usage (
  day date not null,
  scope text not null,
  requests integer not null default 0 check (requests >= 0),
  primary key (day, scope)
);
alter table public.stride_coach_usage enable row level security;
revoke all on public.stride_coach_usage from public, anon, authenticated;
grant all on public.stride_coach_usage to service_role;

create table public.stride_account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  requested_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed'))
);
alter table public.stride_account_deletion_requests enable row level security;
revoke all on public.stride_account_deletion_requests from public, anon, authenticated;
grant select on public.stride_account_deletion_requests to authenticated;
grant all on public.stride_account_deletion_requests to service_role;
create policy stride_deletion_request_owner_read on public.stride_account_deletion_requests
  for select to authenticated using ((select auth.uid()) = user_id);

create or replace function public.consume_stride_coach_allowance(owner_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  usage_day date := (now() at time zone 'UTC')::date;
  global_count integer;
  owner_count integer;
begin
  if owner_id is null or not exists (select 1 from auth.users where id = owner_id) then return false; end if;
  if exists (select 1 from public.stride_account_deletion_requests where user_id = owner_id) then return false; end if;
  -- One transaction-level lock makes global and per-account reservations atomic.
  perform pg_advisory_xact_lock(hashtextextended('stride-coach:' || usage_day::text, 0));
  delete from public.stride_coach_usage where day < usage_day - 7;
  select requests into global_count from public.stride_coach_usage where day = usage_day and scope = 'global';
  select requests into owner_count from public.stride_coach_usage where day = usage_day and scope = owner_id::text;
  if coalesce(global_count, 0) >= 500 or coalesce(owner_count, 0) >= 20 then return false; end if;
  insert into public.stride_coach_usage(day, scope, requests) values (usage_day, 'global', 1), (usage_day, owner_id::text, 1)
    on conflict(day, scope) do update set requests = public.stride_coach_usage.requests + 1;
  return true;
end;
$$;
revoke all on function public.consume_stride_coach_allowance(uuid) from public, anon, authenticated;
grant execute on function public.consume_stride_coach_allowance(uuid) to service_role;
