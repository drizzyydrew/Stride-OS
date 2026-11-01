-- Dormant until explicitly configured. No extensions, jobs, HTTP requests, or
-- account deletions are performed by applying this migration.
-- Secrets are 32 random bytes encoded as 64 lowercase hex characters. Hash the
-- UTF-8 TEXT representation, not decoded bytes, in clients and Edge handlers.
create schema if not exists stride_deletion_private;
revoke all on schema stride_deletion_private from public, anon, authenticated, service_role;

alter table public.stride_account_deletion_requests
  add column receipt_hash text check (receipt_hash ~ '^[0-9a-f]{64}$'),
  add column fulfillment_version integer not null default 0 check (fulfillment_version in (0, 1));
create unique index stride_deletion_receipt_hash_unique
  on public.stride_account_deletion_requests(receipt_hash) where receipt_hash is not null;

create table stride_deletion_private.control (
  singleton boolean primary key default true check (singleton),
  enabled boolean not null default false,
  -- Empty denies everyone. NULL is an explicit future global activation.
  allowed_owner_ids uuid[] default array[]::uuid[],
  gateway_apikey text,
  worker_url text not null default 'https://pbzgrhnxpbtlkzpreizy.supabase.co/functions/v1/account-deletion-worker'
    check (worker_url = 'https://pbzgrhnxpbtlkzpreizy.supabase.co/functions/v1/account-deletion-worker')
);
insert into stride_deletion_private.control(singleton) values (true);

create table stride_deletion_private.request_state (
  request_id uuid primary key references public.stride_account_deletion_requests(id) on delete cascade,
  providers text[] not null,
  dispositions jsonb not null default '{}'::jsonb check (jsonb_typeof(dispositions) = 'object'),
  reasons jsonb not null default '{}'::jsonb check (jsonb_typeof(reasons) = 'object'),
  token_providers text[] not null default array[]::text[],
  failed_providers text[] not null default array[]::text[],
  next_dispatch_at timestamptz not null default now(),
  dispatch_attempts integer not null default 0 check (dispatch_attempts >= 0)
);
create table stride_deletion_private.job_tickets (
  secret_hash text primary key check (secret_hash ~ '^[0-9a-f]{64}$'),
  request_id uuid not null references public.stride_account_deletion_requests(id) on delete cascade,
  purpose text not null default 'worker' check (purpose = 'worker'),
  expires_at timestamptz not null,
  consumed_at timestamptz
);
create index on stride_deletion_private.job_tickets(request_id);
create table stride_deletion_private.provider_tokens (
  request_id uuid not null references public.stride_account_deletion_requests(id) on delete cascade,
  provider text not null check (provider in ('apple','google')),
  kind text not null check (kind in ('google_access_token','apple_authorization_code','apple_refresh_token')),
  subject text not null check (length(subject) between 1 and 512),
  vault_secret_id uuid not null unique,
  primary key(request_id, provider),
  check ((provider = 'google' and kind = 'google_access_token') or
    (provider = 'apple' and kind in ('apple_authorization_code','apple_refresh_token')))
);
do $$ declare t text; begin
  foreach t in array array['control','request_state','job_tickets','provider_tokens'] loop
    execute format('alter table stride_deletion_private.%I enable row level security', t);
    execute format('revoke all on stride_deletion_private.%I from public, anon, authenticated, service_role', t);
  end loop;
end $$;

-- Keep receipt hashes and internal versioning out of ordinary client SELECTs.
revoke select on public.stride_account_deletion_requests from authenticated;
grant select(id, user_id, requested_at, status, completed_at)
  on public.stride_account_deletion_requests to authenticated;

create function stride_deletion_private.secret_hash(secret text)
returns text language sql immutable strict set search_path = '' as $$
  select encode(sha256(convert_to(secret, 'UTF8')), 'hex')
$$;

-- Prevent accidentally placing a server credential in pg_net's HTTP queue.
-- This is a format/role check, not ticket authorization or JWT verification.
create function stride_deletion_private.public_gateway_key(value text)
returns boolean language plpgsql immutable set search_path = '' as $$
declare payload text; claims jsonb;
begin
  if $1 is null or length($1)>4096 or $1 ~ '[[:space:]]' then return false; end if;
  if $1 ~ '^sb_publishable_[A-Za-z0-9_-]+$' then return true; end if;
  if $1 !~ '^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$' then return false; end if;
  payload := translate(split_part($1,'.',2), '-_', '+/');
  payload := payload || repeat('=', (4-length(payload)%4)%4);
  claims := convert_from(decode(payload,'base64'),'UTF8')::jsonb;
  return coalesce(claims->>'role'='anon', false);
exception when others then return false;
end $$;

create function stride_deletion_private.enabled_for_user(owner_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce($1 is not null and c.enabled
    and (c.allowed_owner_ids is null or $1=any(c.allowed_owner_ids)),false)
  from stride_deletion_private.control c where singleton
$$;

create function stride_deletion_private.providers_ready(request_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare state stride_deletion_private.request_state%rowtype; provider text; disposition text;
begin
  select * into state from stride_deletion_private.request_state where request_state.request_id = $1;
  if not found then return false; end if;
  -- Include identities linked after submission; never infer success from Auth's
  -- disappearance. Captured providers survive Auth deletion for recovery.
  for provider in select unnest(state.providers) union
    select i.provider from auth.identities i join public.stride_account_deletion_requests r on r.user_id = i.user_id where r.id = $1
  loop
    disposition := state.dispositions->>provider;
    if provider = 'email' then
      if disposition is distinct from 'not_applicable' then return false; end if;
    elsif provider in ('apple','google') then
      if disposition = 'revoked' then continue; end if;
      if disposition = 'manual_required' and state.reasons->>provider = 'legacy_token_unavailable'
        and not provider = any(state.token_providers) and not provider = any(state.failed_providers) then continue; end if;
      return false;
    else return false;
    end if;
  end loop;
  return true;
end $$;

-- Every worker mutation takes the request row lock and checks an unexpired lease.
create function stride_deletion_private.assert_lease(request_id uuid, claim_token uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.stride_account_deletion_requests r where r.id = $1 and r.fulfillment_version = 1
    and r.status = 'processing' and $2 is not null and r.processing_token = $2
    and r.processing_expires_at > clock_timestamp()
    and stride_deletion_private.enabled_for_user(r.user_id) for update;
  if not found then raise exception 'Invalid deletion lease'; end if;
end $$;

create function stride_deletion_private.provider_actions(request_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('provider', p,
    'status', case when s.dispositions->>p in ('revoked','manual_required') then s.dispositions->>p else 'pending' end,
    'reason', coalesce(s.reasons->>p, 'not_prepared')) order by p), '[]'::jsonb)
  from stride_deletion_private.request_state s join public.stride_account_deletion_requests r on r.id=s.request_id,
    lateral (select unnest(s.providers) p union select i.provider from auth.identities i where i.user_id=r.user_id) providers
  where s.request_id=$1 and p in ('apple','google')
$$;

create function stride_deletion_private.clear_provider_tokens(request_id uuid, provider text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  delete from vault.secrets v using stride_deletion_private.provider_tokens t
    where t.request_id = $1 and ($2 is null or t.provider = $2) and v.id = t.vault_secret_id;
  delete from stride_deletion_private.provider_tokens t where t.request_id = $1 and ($2 is null or t.provider = $2);
end $$;

create function public.store_stride_deletion_provider_token(request_id uuid, token_kind text, token_secret text,
  provider_subject text, claim_token uuid default null)
returns boolean language plpgsql security definer set search_path = '' as $$
declare job public.stride_account_deletion_requests%rowtype; provider_name text;
  existing stride_deletion_private.provider_tokens%rowtype; secret_id uuid; old_secret text;
begin
  select * into job from public.stride_account_deletion_requests r where r.id = $1 for update;
  if not found or job.fulfillment_version <> 1 or job.status = 'completed' then raise exception 'Active automatic request required'; end if;
  if not stride_deletion_private.enabled_for_user(job.user_id) then raise exception 'Automatic deletion is disabled'; end if;
  if $2 not in ('google_access_token','apple_authorization_code','apple_refresh_token') or $2 is null
    or nullif($3, '') is null or octet_length($3) > 16384
    or nullif($4, '') is null or length($4) > 512 then raise exception 'Invalid provider token'; end if;
  if $5 is null then
    if job.status <> 'pending' or job.processing_token is not null or $2 = 'apple_refresh_token' then raise exception 'Invalid deletion lease'; end if;
  else perform stride_deletion_private.assert_lease($1, $5);
  end if;
  provider_name := case when $2 = 'google_access_token' then 'google' else 'apple' end;
  if not exists(select 1 from auth.identities i where i.user_id = job.user_id
    and i.provider = provider_name and i.provider_id = $4) then raise exception 'Provider subject does not belong to this account'; end if;
  if exists(select 1 from stride_deletion_private.request_state s where s.request_id = $1
    and s.dispositions->>provider_name in ('revoked','manual_required')) then raise exception 'Provider disposition is already final'; end if;
  select * into existing from stride_deletion_private.provider_tokens t where t.request_id = $1 and t.provider = provider_name;
  if found then
    select v.decrypted_secret into old_secret from vault.decrypted_secrets v where v.id = existing.vault_secret_id;
    if existing.subject = $4 and existing.kind = $2 and old_secret = $3 then return true; end if;
    if $5 is null or existing.kind = 'apple_refresh_token' or $2 = 'apple_refresh_token' then
      raise exception 'Existing provider token must be retained; use the Apple exchange CAS';
    end if;
    perform vault.update_secret(existing.vault_secret_id, $3);
  else
    if $2 = 'apple_refresh_token' then raise exception 'Apple exchange requires the persisted authorization code'; end if;
    secret_id := vault.create_secret($3);
    insert into stride_deletion_private.provider_tokens(request_id, provider, kind, subject, vault_secret_id)
      values($1, provider_name, $2, $4, secret_id);
  end if;
  update stride_deletion_private.request_state s set
    providers = array(select distinct p from unnest(s.providers || array[provider_name]) p),
    token_providers = array(select distinct p from unnest(s.token_providers || array[provider_name]) p)
    where s.request_id = $1;
  return true;
end $$;

create function public.read_stride_deletion_provider_tokens(request_id uuid, claim_token uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform stride_deletion_private.assert_lease($1, $2);
  if exists(select 1 from stride_deletion_private.provider_tokens t left join vault.decrypted_secrets v on v.id=t.vault_secret_id
    where t.request_id=$1 and v.id is null) then raise exception 'Provider secret is unavailable'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('provider', t.provider, 'kind', t.kind,
    'subject', t.subject, 'token', v.decrypted_secret) order by t.provider), '[]'::jsonb)
    from stride_deletion_private.provider_tokens t join vault.decrypted_secrets v on v.id=t.vault_secret_id where t.request_id=$1);
end $$;

create function public.replace_stride_deletion_apple_code(request_id uuid, authorization_code text,
  refresh_token text, provider_subject text, claim_token uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare existing stride_deletion_private.provider_tokens%rowtype; current_secret text;
begin
  perform stride_deletion_private.assert_lease($1, $5);
  if nullif($2, '') is null or nullif($3, '') is null or octet_length($3) > 16384 then raise exception 'Invalid Apple exchange'; end if;
  select * into existing from stride_deletion_private.provider_tokens t where t.request_id=$1 and t.provider='apple' for update;
  if not found or existing.subject is distinct from $4 then raise exception 'Apple subject does not match'; end if;
  select v.decrypted_secret into current_secret from vault.decrypted_secrets v where v.id=existing.vault_secret_id;
  -- A retry after a lost acknowledgement is idempotent for the same refresh token.
  if existing.kind='apple_refresh_token' and current_secret=$3 then return true; end if;
  if existing.kind<>'apple_authorization_code' or current_secret is distinct from $2 then raise exception 'Apple authorization code changed'; end if;
  perform vault.update_secret(existing.vault_secret_id, $3);
  update stride_deletion_private.provider_tokens t set kind='apple_refresh_token' where t.request_id=$1 and t.provider='apple';
  return true;
end $$;

create function public.read_stride_deletion_receipt(request_id uuid, receipt_secret text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare job public.stride_account_deletion_requests%rowtype; dispositions jsonb;
begin
  if $2 is null or $2 !~ '^[0-9a-f]{64}$' then return null; end if;
  -- NULL request_id recovers a lost start response even after Auth is gone.
  -- The unique hash still requires the full 256-bit capability, never an ID scan.
  select * into job from public.stride_account_deletion_requests r
    where r.fulfillment_version = 1 and r.receipt_hash = stride_deletion_private.secret_hash($2)
      and ($1 is null or r.id = $1);
  if not found then return null; end if;
  select s.dispositions into dispositions from stride_deletion_private.request_state s where s.request_id = job.id;
  return jsonb_build_object('id', job.id, 'requested_at', job.requested_at,
    'status', job.status, 'completed_at', job.completed_at,
    'fulfillment_version', job.fulfillment_version, 'provider_dispositions', coalesce(dispositions, '{}'::jsonb),
    'provider_actions', stride_deletion_private.provider_actions(job.id));
end $$;

-- Authenticated GET handler supplies the verified caller's id; no caller-chosen
-- owner is accepted by the public Edge handler. Refresh readiness is separate
-- from provider capability so reauthorization is not prompted during a lease.
create function public.read_stride_deletion_owned_status(owner_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare job public.stride_account_deletion_requests%rowtype; dispositions jsonb;
begin
  select * into job from public.stride_account_deletion_requests r where r.user_id=$1;
  if not found then return null; end if;
  select s.dispositions into dispositions from stride_deletion_private.request_state s where s.request_id=job.id;
  return jsonb_build_object('id',job.id,'requested_at',job.requested_at,'status',job.status,'completed_at',job.completed_at,
    'provider_dispositions',coalesce(dispositions,'{}'::jsonb),
    'provider_actions',stride_deletion_private.provider_actions(job.id),
    'provider_credential_refresh_ready',job.fulfillment_version=1 and job.status<>'completed'
      and (job.processing_expires_at is null or job.processing_expires_at<=clock_timestamp())
      and stride_deletion_private.enabled_for_user(job.user_id));
end $$;

create function public.start_stride_deletion(user_id uuid, receipt_hash text, provider_tokens jsonb default '[]'::jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare job public.stride_account_deletion_requests%rowtype; providers text[]; dispositions jsonb;
  inserted integer; token_entry jsonb;
begin
  if not stride_deletion_private.enabled_for_user($1) then raise exception 'Automatic deletion is disabled'; end if;
  if $2 is null or $2 !~ '^[0-9a-f]{64}$' then raise exception 'Invalid receipt hash'; end if;
  if $3 is null or jsonb_typeof($3)<>'array' then raise exception 'Invalid initial provider tokens'; end if;
  if jsonb_array_length($3)>2 then raise exception 'Invalid initial provider tokens'; end if;
  if not exists(select 1 from auth.users u where u.id = $1) then raise exception 'Verified account required'; end if;
  insert into public.stride_account_deletion_requests(user_id, receipt_hash, fulfillment_version)
    values ($1, $2, 1) on conflict on constraint stride_account_deletion_requests_user_id_key do nothing;
  get diagnostics inserted = row_count;
  select * into job from public.stride_account_deletion_requests r where r.user_id = $1 for update;
  if job.fulfillment_version <> 1 then raise exception 'Legacy deletion request requires the manual operator'; end if;
  if job.receipt_hash is distinct from $2 then raise exception 'Reuse the original receipt secret'; end if;
  select coalesce(array_agg(distinct i.provider), array[]::text[]) into providers from auth.identities i where i.user_id = $1;
  dispositions := case when 'email' = any(providers) then '{"email":"not_applicable"}'::jsonb else '{}'::jsonb end;
  insert into stride_deletion_private.request_state(request_id, providers, dispositions)
    values(job.id, providers, dispositions) on conflict(request_id) do nothing;
  if inserted=1 then
    for token_entry in select value from jsonb_array_elements($3) loop
      if jsonb_typeof(token_entry)<>'object' or jsonb_typeof(token_entry->'kind') is distinct from 'string'
        or jsonb_typeof(token_entry->'secret') is distinct from 'string'
        or jsonb_typeof(token_entry->'subject') is distinct from 'string' then raise exception 'Invalid initial provider tokens'; end if;
      perform public.store_stride_deletion_provider_token(job.id, token_entry->>'kind', token_entry->>'secret', token_entry->>'subject');
    end loop;
  end if;
  select s.dispositions into dispositions from stride_deletion_private.request_state s where s.request_id = job.id;
  return jsonb_build_object('id', job.id, 'requested_at', job.requested_at, 'status', job.status,
    'completed_at', job.completed_at, 'fulfillment_version', 1, 'provider_dispositions', dispositions,
    'provider_actions', stride_deletion_private.provider_actions(job.id));
end $$;

create function public.attest_stride_deletion_provider(request_id uuid, provider text, disposition text,
  reason text default null, claim_token uuid default null)
returns boolean language plpgsql security definer set search_path = '' as $$
declare job public.stride_account_deletion_requests%rowtype; prior_disposition text;
begin
  select * into job from public.stride_account_deletion_requests r where r.id = $1 for update;
  if not found or job.fulfillment_version <> 1 or job.status = 'completed' then raise exception 'Active automatic request required'; end if;
  perform stride_deletion_private.assert_lease($1, $5);
  if $2 is null or $2 not in ('email','apple','google') or $3 is null then raise exception 'Unsupported provider disposition'; end if;
  if not (($2 = 'email' and $3 = 'not_applicable' and $4 is null)
    or ($2 in ('apple','google') and (($3 = 'revoked' and ($4 is null or $4 = 'provider_confirmed'))
      or ($3 = 'manual_required' and $4 = 'legacy_token_unavailable')
      or ($3 = 'retry_pending' and $4 in ('configuration_unavailable','provider_failure','credential_refresh_required'))))) then
    raise exception 'Unsupported provider disposition';
  end if;
  if not exists(select 1 from stride_deletion_private.request_state s where s.request_id = $1
    and ($2 = any(s.providers) or exists(select 1 from auth.identities i where i.user_id = job.user_id and i.provider = $2))) then
    raise exception 'Provider is not bound to this request';
  end if;
  select s.dispositions->>$2 into prior_disposition from stride_deletion_private.request_state s where s.request_id=$1;
  -- A lost HTTP acknowledgement after a COMMITTED attestation must not let the
  -- worker's catch-path erase success (and strand a now-deleted Vault token).
  if prior_disposition in ('revoked','manual_required') then
    if $3=prior_disposition or $3='retry_pending' then return true; end if;
    raise exception 'Provider disposition is already final';
  end if;
  if $3 = 'manual_required' and exists(select 1 from stride_deletion_private.request_state s where s.request_id=$1
    and ($2=any(s.token_providers) or $2=any(s.failed_providers))) then
    raise exception 'A known token or failure cannot become the legacy fallback';
  end if;
  if $3='revoked' then perform stride_deletion_private.clear_provider_tokens($1, $2); end if;
  update stride_deletion_private.request_state s set
    providers = array(select distinct p from unnest(s.providers || array[$2]) p),
    dispositions = s.dispositions || jsonb_build_object($2, $3),
    reasons = case when $3='revoked' then s.reasons || jsonb_build_object($2, 'provider_confirmed')
      when $4 is null then s.reasons - $2 else s.reasons || jsonb_build_object($2, $4) end,
    failed_providers = case when $3='retry_pending' then array(select distinct p from unnest(s.failed_providers || array[$2]) p) else s.failed_providers end
    where s.request_id = $1;
  return true;
end $$;

-- Explicit reauthentication repair, separate from idempotent start. The handler
-- supplies its verified user's id and the original receipt hash. This never
-- reopens completed providers or discards a secured Apple refresh token.
create function public.refresh_stride_deletion_provider_tokens(user_id uuid, receipt_hash text, provider_tokens jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare job public.stride_account_deletion_requests%rowtype; entry jsonb; provider_name text;
  existing stride_deletion_private.provider_tokens%rowtype; secret_id uuid; current_secret text; seen text[] := array[]::text[];
begin
  if not stride_deletion_private.enabled_for_user($1) then raise exception 'Automatic deletion is disabled'; end if;
  if $2 is null or $2 !~ '^[0-9a-f]{64}$' or $3 is null or jsonb_typeof($3)<>'array' then raise exception 'Invalid credential refresh'; end if;
  if jsonb_array_length($3) not between 1 and 2 then raise exception 'Invalid credential refresh'; end if;
  select * into job from public.stride_account_deletion_requests r where r.user_id=$1
    and r.receipt_hash=$2 and r.fulfillment_version=1 for update;
  if not found or job.status='completed' or not exists(select 1 from auth.users u where u.id=$1) then raise exception 'Active owned request required'; end if;
  if job.processing_expires_at>clock_timestamp() then raise exception 'Deletion is already being processed'; end if;
  for entry in select value from jsonb_array_elements($3) loop
    if jsonb_typeof(entry)<>'object' or jsonb_typeof(entry->'kind') is distinct from 'string'
      or jsonb_typeof(entry->'secret') is distinct from 'string' or jsonb_typeof(entry->'subject') is distinct from 'string'
      or entry->>'kind' not in ('google_access_token','apple_authorization_code')
      or length(entry->>'subject') not between 1 and 512
      or octet_length(entry->>'secret') not between 1 and 16384 then raise exception 'Invalid credential refresh'; end if;
    provider_name := case when entry->>'kind'='google_access_token' then 'google' else 'apple' end;
    if provider_name=any(seen) then raise exception 'Duplicate provider credentials'; end if;
    seen := seen || provider_name;
    if not exists(select 1 from auth.identities i where i.user_id=$1 and i.provider=provider_name
      and i.provider_id=entry->>'subject') then raise exception 'Provider subject does not belong to this account'; end if;
    if exists(select 1 from stride_deletion_private.request_state s where s.request_id=job.id
      and s.dispositions->>provider_name in ('revoked','manual_required')) then raise exception 'Provider disposition is already final'; end if;
    select * into existing from stride_deletion_private.provider_tokens t where t.request_id=job.id and t.provider=provider_name;
    if found and existing.kind='apple_refresh_token' then
      continue;
    elsif found then
      select v.decrypted_secret into current_secret from vault.decrypted_secrets v where v.id=existing.vault_secret_id;
      if current_secret is null then raise exception 'Provider secret is unavailable'; end if;
      if current_secret is distinct from entry->>'secret' then perform vault.update_secret(existing.vault_secret_id,entry->>'secret'); end if;
    else
      secret_id := vault.create_secret(entry->>'secret');
      insert into stride_deletion_private.provider_tokens(request_id,provider,kind,subject,vault_secret_id)
        values(job.id,provider_name,entry->>'kind',entry->>'subject',secret_id);
    end if;
    update stride_deletion_private.request_state s set
      providers=array(select distinct p from unnest(s.providers || array[provider_name]) p),
      token_providers=array(select distinct p from unnest(s.token_providers || array[provider_name]) p),
      dispositions=s.dispositions || jsonb_build_object(provider_name,'retry_pending'),
      reasons=s.reasons || jsonb_build_object(provider_name,'provider_retry_requested') where s.request_id=job.id;
  end loop;
  -- Reset only after all credentials validate. A failure rolls back every token
  -- update. The expired worker's old token can no longer mutate this request.
  update public.stride_account_deletion_requests r set status='pending',processing_token=null,processing_expires_at=null where r.id=job.id;
  update stride_deletion_private.request_state s set next_dispatch_at=now() where s.request_id=job.id;
  delete from stride_deletion_private.job_tickets t where t.request_id=job.id and t.consumed_at is null;
  return public.start_stride_deletion($1,$2,'[]'::jsonb);
end $$;

-- Preserve the already-hardened inventory implementation; enrich its result.
alter function public.stride_deletion_plan(uuid) rename to stride_deletion_inventory_v0;
create function public.stride_deletion_plan(request_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare plan jsonb; job public.stride_account_deletion_requests%rowtype; state stride_deletion_private.request_state%rowtype;
begin
  plan := public.stride_deletion_inventory_v0($1);
  select * into job from public.stride_account_deletion_requests r where r.id = $1;
  select * into state from stride_deletion_private.request_state s where s.request_id = $1;
  return plan || jsonb_build_object('fulfillment_version', job.fulfillment_version,
    'identity_providers', (select coalesce(jsonb_agg(p order by p), '[]'::jsonb) from
      (select jsonb_array_elements_text(plan->'identity_providers') p union select unnest(state.providers)) providers),
    'provider_dispositions', coalesce(state.dispositions, '{}'::jsonb),
    'providers_ready', case when job.fulfillment_version = 1 then stride_deletion_private.providers_ready($1) else false end,
    'provider_actions', stride_deletion_private.provider_actions($1));
end $$;

create or replace function public.claim_stride_deletion(request_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare job public.stride_account_deletion_requests%rowtype; plan jsonb; token uuid;
begin
  select * into job from public.stride_account_deletion_requests r where r.id = $1 for update;
  if not found or job.status = 'completed' then raise exception 'Deletion is not pending'; end if;
  if job.processing_expires_at > now() then raise exception 'Deletion is already being processed'; end if;
  plan := public.stride_deletion_plan($1);
  if jsonb_array_length(plan->'shared_auth_tables') <> 0 then raise exception 'Shared authentication must be separated before automatic deletion'; end if;
  if (plan->>'unsafe_storage_objects')::bigint <> 0 then raise exception 'Storage ownership needs review'; end if;
  if job.fulfillment_version = 1 then
    if not stride_deletion_private.enabled_for_user(job.user_id) then raise exception 'Automatic deletion is disabled'; end if;
    if exists(select 1 from jsonb_array_elements_text(plan->'identity_providers') p where p not in ('email','apple','google')) then
      raise exception 'Unknown identity provider'; end if;
  elsif exists(select 1 from jsonb_array_elements_text(plan->'identity_providers') p where p <> 'email') then
    raise exception 'Provider token revocation must be implemented before processing this account';
  end if;
  token := gen_random_uuid();
  update public.stride_account_deletion_requests r set status = 'processing', processing_token = token,
    processing_expires_at = now() + interval '15 minutes' where r.id = $1;
  return token;
end $$;

-- The existing lease RPC is also a worker checkpoint. Preserve version-0
-- operator semantics while rejecting excluded automatic workers at the fence.
create or replace function public.renew_stride_deletion(request_id uuid, claim_token uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  update public.stride_account_deletion_requests r set processing_expires_at=now()+interval '15 minutes'
    where r.id=$1 and r.status='processing' and r.processing_token=$2 and r.processing_expires_at>now()
      and (r.fulfillment_version=0 or stride_deletion_private.enabled_for_user(r.user_id));
  return found;
end $$;

create or replace function public.complete_stride_deletion(request_id uuid, claim_token uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare job public.stride_account_deletion_requests%rowtype; plan jsonb;
begin
  select * into job from public.stride_account_deletion_requests r where r.id = $1 for update;
  if not found or job.status <> 'processing' or $2 is null or job.processing_token is null
    or job.processing_token is distinct from $2 or job.processing_expires_at is null
    or job.processing_expires_at <= now() then raise exception 'Invalid deletion lease'; end if;
  if job.fulfillment_version=1 and not stride_deletion_private.enabled_for_user(job.user_id) then raise exception 'Automatic deletion is disabled'; end if;
  if job.fulfillment_version = 1 and not stride_deletion_private.providers_ready($1) then raise exception 'Provider disposition is not complete'; end if;
  plan := public.stride_deletion_plan($1);
  if (plan->>'auth_user_exists')::boolean or jsonb_array_length(plan->'storage_paths') <> 0
    or (plan->>'unsafe_storage_objects')::bigint <> 0
    or exists(select 1 from jsonb_each_text(plan->'record_counts') r where r.value::bigint <> 0) then
    raise exception 'Deletion is not complete';
  end if;
  if job.fulfillment_version = 1 then
    delete from public.stride_coach_usage where scope = job.user_id::text;
    perform stride_deletion_private.clear_provider_tokens($1);
  end if;
  update public.stride_account_deletion_requests r set status = 'completed', completed_at = now(),
    processing_token = null, processing_expires_at = null where r.id = $1;
  delete from stride_deletion_private.job_tickets t where t.request_id = $1;
  return true;
end $$;

create function public.issue_stride_deletion_job_ticket(request_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare job public.stride_account_deletion_requests%rowtype; secret text; attempts integer;
begin
  select * into job from public.stride_account_deletion_requests r where r.id = $1 for update;
  if not found or job.fulfillment_version <> 1 or job.status = 'completed'
    or job.processing_expires_at > now() then raise exception 'Automatic deletion job is not eligible'; end if;
  if not stride_deletion_private.enabled_for_user(job.user_id) then raise exception 'Automatic deletion is disabled'; end if;
  select s.dispatch_attempts into attempts from stride_deletion_private.request_state s
    where s.request_id=$1 and s.next_dispatch_at<=clock_timestamp() for update;
  if not found then raise exception 'Deletion retry is not due'; end if;
  -- pgcrypto is already installed in the hosted project's extensions schema.
  secret := encode(extensions.gen_random_bytes(32), 'hex');
  delete from stride_deletion_private.job_tickets t where t.request_id = $1 and t.consumed_at is null;
  insert into stride_deletion_private.job_tickets(secret_hash, request_id, expires_at)
    values(stride_deletion_private.secret_hash(secret), $1, now() + interval '5 minutes');
  -- Every entrypoint shares one retry budget. Status polling must not bypass
  -- cron backoff, and ticket-consumed/worker-crashed still becomes due again.
  update stride_deletion_private.request_state s set dispatch_attempts=least(s.dispatch_attempts+1,1000000),
    next_dispatch_at=clock_timestamp()+make_interval(secs=>least(3600,(60*power(2,least(attempts,6)))::integer))
    where s.request_id=$1;
  return secret;
end $$;

create function public.consume_stride_deletion_job_ticket(request_id uuid, ticket_secret text)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if $2 is null or $2 !~ '^[0-9a-f]{64}$'
    or not (select c.enabled from stride_deletion_private.control c where singleton) then return false; end if;
  update stride_deletion_private.job_tickets t set consumed_at = clock_timestamp()
    where t.request_id = $1 and t.secret_hash = stride_deletion_private.secret_hash($2)
      and t.purpose = 'worker' and t.consumed_at is null and t.expires_at > clock_timestamp()
      and exists(select 1 from public.stride_account_deletion_requests r
        where r.id = $1 and r.fulfillment_version = 1 and r.status <> 'completed'
          and stride_deletion_private.enabled_for_user(r.user_id));
  return found;
end $$;

create function public.dispatch_stride_deletion_jobs()
returns integer language plpgsql security definer set search_path = '' as $$
declare config stride_deletion_private.control%rowtype; job record; ticket text; dispatched integer := 0;
begin
  select * into config from stride_deletion_private.control where singleton;
  if not config.enabled then return 0; end if;
  if not pg_try_advisory_xact_lock(hashtextextended('stride-deletion-dispatch-v1', 0)) then return 0; end if;
  if config.gateway_apikey is null or to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') is null then
    raise exception 'Deletion scheduler transport is not configured';
  end if;
  delete from stride_deletion_private.job_tickets where expires_at < now() - interval '1 day';
  for job in select r.id from public.stride_account_deletion_requests r
    join stride_deletion_private.request_state s on s.request_id = r.id
    where r.fulfillment_version = 1 and r.status <> 'completed' and s.next_dispatch_at <= now()
      and stride_deletion_private.enabled_for_user(r.user_id)
      and (r.processing_expires_at is null or r.processing_expires_at <= now())
    order by r.requested_at limit 10 for update of r, s skip locked
  loop
    ticket := public.issue_stride_deletion_job_ticket(job.id);
    -- No secret in URL or SQL text; pg_net sees only a short-lived scoped ticket
    -- and the public gateway key. The worker verifies the ticket via service RPC.
    execute 'select net.http_post(url := $1, body := $2, headers := $3, timeout_milliseconds := 10000)'
      using config.worker_url, jsonb_build_object('requestId', job.id, 'jobTicket', ticket),
        jsonb_build_object('Content-Type', 'application/json', 'apikey', config.gateway_apikey);
    dispatched := dispatched + 1;
  end loop;
  return dispatched;
end $$;

create function public.configure_stride_deletion_automation(enabled boolean, gateway_apikey text default null,
  test_owner_ids uuid[] default array[]::uuid[])
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if $1 is null then raise exception 'Explicit enabled flag required'; end if;
  if $3 is not null and array_position($3,null::uuid) is not null then raise exception 'Owner allowlist cannot contain null entries'; end if;
  if $1 then
    if not stride_deletion_private.public_gateway_key($2) then raise exception 'Public gateway apikey required'; end if;
    if to_regprocedure('cron.schedule(text,text,text)') is null
      or to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') is null then
      raise exception 'Install and verify pg_cron and pg_net before enabling';
    end if;
    execute 'select cron.schedule(''stride-account-deletion-worker-v1'', ''* * * * *'', ''select public.dispatch_stride_deletion_jobs();'')';
  elsif to_regprocedure('cron.unschedule(text)') is not null then
    if exists(select 1 from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname='cron' and c.relname='job') then
      if (select exists(select 1 from cron.job where jobname = 'stride-account-deletion-worker-v1')) then
        execute 'select cron.unschedule(''stride-account-deletion-worker-v1'')';
      end if;
    end if;
  end if;
  -- One MVCC row update publishes scope and enablement together.
  update stride_deletion_private.control c set allowed_owner_ids=$3, enabled = $1,
    gateway_apikey = case when $1 then $2 else null end where singleton;
  return $1;
end $$;

create function public.stride_deletion_automation_enabled(owner_id uuid default null)
returns boolean language sql stable security definer set search_path = '' as $$
  select stride_deletion_private.enabled_for_user($1)
$$;

-- Functions are privileged endpoints, never client-authorized by an anon key.
do $$ declare signature text; begin
  foreach signature in array array[
    'public.start_stride_deletion(uuid,text,jsonb)', 'public.read_stride_deletion_receipt(uuid,text)',
    'public.read_stride_deletion_owned_status(uuid)',
    'public.attest_stride_deletion_provider(uuid,text,text,text,uuid)',
    'public.store_stride_deletion_provider_token(uuid,text,text,text,uuid)',
    'public.read_stride_deletion_provider_tokens(uuid,uuid)',
    'public.replace_stride_deletion_apple_code(uuid,text,text,text,uuid)',
    'public.refresh_stride_deletion_provider_tokens(uuid,text,jsonb)',
    'public.stride_deletion_inventory_v0(uuid)', 'public.stride_deletion_plan(uuid)',
    'public.claim_stride_deletion(uuid)', 'public.renew_stride_deletion(uuid,uuid)', 'public.complete_stride_deletion(uuid,uuid)',
    'public.issue_stride_deletion_job_ticket(uuid)', 'public.consume_stride_deletion_job_ticket(uuid,text)',
    'public.dispatch_stride_deletion_jobs()', 'public.configure_stride_deletion_automation(boolean,text,uuid[])',
    'public.stride_deletion_automation_enabled(uuid)'
  ] loop
    execute 'revoke all on function ' || signature || ' from public, anon, authenticated';
    execute 'grant execute on function ' || signature || ' to service_role';
  end loop;
end $$;
revoke all on all functions in schema stride_deletion_private from public, anon, authenticated, service_role;
