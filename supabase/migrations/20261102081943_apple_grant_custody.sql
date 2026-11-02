-- Inert custody only: no grants, credentials, dispatch, schedules or activation.
create schema stride_apple_private;
revoke all on schema stride_apple_private from public, anon, authenticated, service_role;
create table stride_apple_private.grants (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  subject text not null check (length(subject) between 1 and 512),
  client_id text not null check (length(client_id) between 1 and 255),
  vault_secret_id uuid not null unique,
  adopted_request_id uuid,
  capture_generation bigint not null default 0,
  bound_request_id uuid,
  captured_at timestamptz not null default now()
);
create table stride_apple_private.captures (
  owner_id uuid not null references stride_apple_private.grants(owner_id) on delete cascade,
  code_hash text not null check (code_hash ~ '^[0-9a-f]{64}$'),
  primary key(owner_id, code_hash)
);
create table stride_apple_private.capture_intents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  subject text not null, client_id text not null,
  code_hash text not null check (code_hash ~ '^[0-9a-f]{64}$'),
  generation bigint not null,
  state text not null default 'reserved' check (state in ('reserved','uncertain','completed','manual_unavailable')),
  vault_secret_id uuid unique,
  refresh_revoked_at timestamptz,
  access_revoked_at timestamptz,
  bound_request_id uuid,
  resolution_reason text, stopped_attested_at timestamptz,
  unique(owner_id,code_hash), unique(owner_id,generation)
);
alter table stride_apple_private.capture_intents enable row level security;
alter table stride_apple_private.grants enable row level security;
alter table stride_apple_private.captures enable row level security;
revoke all on all tables in schema stride_apple_private from public, anon, authenticated, service_role;

create function stride_apple_private.assert_owner(owner_id uuid, apple_subject text, client_id text, allow_pending boolean default false)
returns void language plpgsql security definer set search_path = '' as $$
begin
  -- Same first lock as deletion insertion. A token exchange never holds a DB lock.
  perform 1 from auth.users u where u.id=$1 and (u.banned_until is null or u.banned_until<=now()) for update;
  if not found or (not $4 and exists(select 1 from public.stride_account_deletion_requests r where r.user_id=$1))
    then raise exception 'Apple custody unavailable'; end if;
  if nullif($2,'') is null or length($2)>512 or nullif($3,'') is null or length($3)>255
    or (select count(*) from auth.identities i where i.user_id=$1 and i.provider='apple')<>1
    or not exists(select 1 from auth.identities i where i.user_id=$1 and i.provider='apple' and i.provider_id=$2)
    then raise exception 'Apple custody unavailable'; end if;
end $$;

create function public.stride_apple_grant_captured(owner_id uuid, apple_subject text, client_id text, code_hash text)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  perform stride_apple_private.assert_owner($1,$2,$3);
  if $4 is null or $4 !~ '^[0-9a-f]{64}$' then raise exception 'Apple custody unavailable'; end if;
  return exists(select 1 from stride_apple_private.captures c join stride_apple_private.grants g using(owner_id)
    join vault.decrypted_secrets v on v.id=g.vault_secret_id
    where c.owner_id=$1 and c.code_hash=$4 and g.subject=$2 and g.client_id=$3);
end $$;

create function stride_apple_private.purge_grant_secret()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from vault.secrets where id=old.vault_secret_id;
  delete from vault.secrets v using stride_apple_private.capture_intents i where i.owner_id=old.owner_id and v.id=i.vault_secret_id;
  delete from stride_apple_private.capture_intents where owner_id=old.owner_id;
  return old;
end $$;
create trigger stride_apple_grant_secret_cleanup before delete on stride_apple_private.grants
  for each row execute function stride_apple_private.purge_grant_secret();

create function public.store_stride_apple_grant(owner_id uuid, apple_subject text, client_id text, code_hash text, token_response jsonb, capture_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare new_secret uuid; field text; intent stride_apple_private.capture_intents%rowtype; job uuid; current_generation bigint;
begin
  perform stride_apple_private.assert_owner($1,$2,$3,true);
  select * into intent from stride_apple_private.capture_intents i where i.id=$6 and i.owner_id=$1
    and i.subject=$2 and i.client_id=$3 and i.code_hash=$4 for update;
  if not found then raise exception 'Apple reservation mismatch'; end if;
  if intent.state='completed' then
    return not exists(select 1 from public.stride_account_deletion_requests r where r.user_id=$1)
      and exists(select 1 from vault.decrypted_secrets v where v.id=intent.vault_secret_id and v.decrypted_secret::jsonb=$5);
  end if;
  if intent.state not in ('reserved','uncertain') then raise exception 'Apple reservation is sealed'; end if;
  select r.id into job from public.stride_account_deletion_requests r where r.user_id=$1 and r.status<>'completed';
  if exists(select 1 from public.stride_account_deletion_requests r where r.user_id=$1 and r.status='completed')
    then raise exception 'Apple deletion is final'; end if;
  if $5 is null or jsonb_typeof($5)<>'object' then raise exception 'Invalid Apple token response'; end if;
  if (select count(*) from jsonb_object_keys($5))<>5
    or exists(select 1 from jsonb_object_keys($5) k where k not in ('refresh_token','access_token','id_token','token_type','expires_in'))
    then raise exception 'Invalid Apple token response'; end if;
  foreach field in array array['refresh_token','access_token','id_token'] loop
    if jsonb_typeof($5->field) is distinct from 'string' or length($5->>field) not between 1 and 16384
      or position(chr(10) in $5->>field)>0 or position(chr(13) in $5->>field)>0
      then raise exception 'Invalid Apple token response'; end if;
  end loop;
  if $5->>'token_type' is distinct from 'Bearer' or jsonb_typeof($5->'expires_in') is distinct from 'number'
    or ($5->>'expires_in') !~ '^[0-9]+$' then raise exception 'Invalid Apple token response'; end if;
  if ($5->>'expires_in')::numeric not between 1 and 9007199254740991 then raise exception 'Invalid Apple token response'; end if;
  select g.capture_generation into current_generation from stride_apple_private.grants g where g.owner_id=$1;
  new_secret := vault.create_secret($5::text);
  update stride_apple_private.capture_intents i set vault_secret_id=new_secret,state='completed',bound_request_id=job where i.id=$6;
  if current_generation is null or intent.generation>current_generation then
    insert into stride_apple_private.grants(owner_id,subject,client_id,vault_secret_id,capture_generation,bound_request_id)
      values($1,$2,$3,new_secret,intent.generation,job) on conflict on constraint grants_pkey do update set subject=excluded.subject,
      client_id=excluded.client_id,vault_secret_id=excluded.vault_secret_id,capture_generation=excluded.capture_generation,
      bound_request_id=excluded.bound_request_id,adopted_request_id=null,captured_at=now();
  end if;
  insert into stride_apple_private.captures(owner_id,code_hash) values($1,$4);
  -- Earlier completed responses remain encrypted in their intents until revocation;
  -- a late older generation never overwrites newer custody or a repaired job token.
  return job is null;
end $$;

create function stride_apple_private.lock_deletion_owner()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from auth.users u where u.id=new.user_id for update;
  return new;
end $$;
create trigger stride_apple_deletion_owner_lock before insert on public.stride_account_deletion_requests
  for each row execute function stride_apple_private.lock_deletion_owner();

create function stride_apple_private.adopt(request_id uuid, claim_token uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare job public.stride_account_deletion_requests%rowtype; grant_row stride_apple_private.grants%rowtype;
  existing stride_deletion_private.provider_tokens%rowtype; payload jsonb; secret_id uuid;
begin
  perform stride_deletion_private.assert_lease($1,$2);
  select * into job from public.stride_account_deletion_requests r where r.id=$1;
  if job.fulfillment_version<>1 then return; end if;
  perform stride_apple_private.assert_settled(job.user_id);
  select * into grant_row from stride_apple_private.grants g where g.owner_id=job.user_id for update;
  if not found or grant_row.adopted_request_id is not null then return; end if;
  if exists(select 1 from stride_deletion_private.request_state s where s.request_id=$1
    and s.dispositions->>'apple' in ('revoked','manual_required')) then raise exception 'Apple grant has a final disposition'; end if;
  if not exists(select 1 from auth.identities i where i.user_id=job.user_id and i.provider='apple' and i.provider_id=grant_row.subject)
    then raise exception 'Apple grant owner mismatch'; end if;
  select * into existing from stride_deletion_private.provider_tokens t where t.request_id=$1 and t.provider='apple' for update;
  -- A retained job refresh (including repaired credentials) always wins. Never reset repair to an older grant.
  if found and (existing.kind='apple_refresh_token' or exists(select 1 from stride_deletion_private.request_state s where s.request_id=$1 and s.reasons->>'apple'='provider_retry_requested')) then
    update stride_apple_private.grants set adopted_request_id=$1 where owner_id=job.user_id;
    return;
  end if;
  select v.decrypted_secret::jsonb into payload from vault.decrypted_secrets v where v.id=grant_row.vault_secret_id;
  if payload is null or nullif(payload->>'refresh_token','') is null then raise exception 'Apple grant secret unavailable'; end if;
  secret_id := vault.create_secret(payload->>'refresh_token');
  if existing.vault_secret_id is not null then delete from vault.secrets where id=existing.vault_secret_id; end if;
  insert into stride_deletion_private.provider_tokens(request_id,provider,kind,subject,vault_secret_id)
    values($1,'apple','apple_refresh_token',grant_row.subject,secret_id)
    on conflict on constraint provider_tokens_pkey do update set kind=excluded.kind,subject=excluded.subject,vault_secret_id=excluded.vault_secret_id;
  update stride_apple_private.grants set adopted_request_id=$1 where owner_id=job.user_id;
  update stride_deletion_private.request_state s set
    providers=array(select distinct p from unnest(s.providers||array['apple']) p),
    token_providers=array(select distinct p from unnest(s.token_providers||array['apple']) p) where s.request_id=$1;
end $$;

-- Reuse the existing worker's leased read contract; no token ever returns through a client handler.
alter function public.read_stride_deletion_provider_tokens(uuid,uuid) set schema stride_apple_private;
alter function stride_apple_private.read_stride_deletion_provider_tokens(uuid,uuid) rename to read_deletion_tokens_before_grants;
create function public.read_stride_deletion_provider_tokens(request_id uuid, claim_token uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare retained jsonb; pending jsonb;
begin
  perform stride_apple_private.adopt($1,$2);
  retained:=stride_apple_private.read_deletion_tokens_before_grants($1,$2);
  if exists(select 1 from stride_apple_private.capture_intents i join public.stride_account_deletion_requests r on r.user_id=i.owner_id
    left join vault.decrypted_secrets v on v.id=i.vault_secret_id where r.id=$1 and i.state='completed'
      and (i.refresh_revoked_at is null or i.access_revoked_at is null) and v.id is null) then raise exception 'Apple capture secret unavailable'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('provider','apple','kind',p.kind,'subject',p.subject,
    'client_id',p.client_id,'capture_id',p.id,'token',p.token) order by p.generation,p.kind),'[]'::jsonb)
    into pending from (
      select i.id,i.subject,i.client_id,i.generation,part.kind,v.decrypted_secret::jsonb->>part.field token
      from stride_apple_private.capture_intents i join public.stride_account_deletion_requests r on r.user_id=i.owner_id
      join vault.decrypted_secrets v on v.id=i.vault_secret_id,
      lateral (values('apple_capture_refresh_token','refresh_token',i.refresh_revoked_at),('apple_capture_access_token','access_token',i.access_revoked_at)) part(kind,field,revoked_at)
      where r.id=$1 and i.state='completed' and part.revoked_at is null order by i.generation,part.kind limit 7
    ) p;
  return retained||pending;
end $$;

alter function public.read_stride_deletion_owned_status(uuid) set schema stride_apple_private;
alter function stride_apple_private.read_stride_deletion_owned_status(uuid) rename to read_deletion_status_before_grants;
create function public.read_stride_deletion_owned_status(owner_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare receipt jsonb;
begin
  receipt := stride_apple_private.read_deletion_status_before_grants($1);
  if exists(select 1 from stride_apple_private.grants g where g.owner_id=$1) then
    return jsonb_build_object('request',receipt,'apple_grant_retained',true);
  end if;
  return receipt;
end $$;

-- The new FK has an explicit cascade + Vault purge. Exclude ONLY this reviewed table;
-- preserve the unknown-auth-table fence for every other relationship.
alter function public.stride_deletion_plan(uuid) set schema stride_apple_private;
alter function stride_apple_private.stride_deletion_plan(uuid) rename to deletion_plan_before_grants;
create function public.stride_deletion_plan(request_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare plan jsonb; accepted text[]:=array[]::text[]; spec record; relation oid; owner_column smallint; auth_column smallint;
begin
  plan := stride_apple_private.deletion_plan_before_grants($1);
  select attnum into auth_column from pg_catalog.pg_attribute where attrelid='auth.users'::regclass and attname='id' and not attisdropped;
  for spec in select * from (values
    ('stride_apple_private.grants','grants_owner_id_fkey','stride_apple_grant_secret_cleanup','stride_apple_private.purge_grant_secret()'),
    ('stride_apple_private.capture_intents','capture_intents_owner_id_fkey','stride_apple_intent_secret_cleanup','stride_apple_private.purge_intent_secret()')
  ) v(relation_name,constraint_name,cleanup_trigger,cleanup_function) loop
    relation:=pg_catalog.to_regclass(spec.relation_name);
    select attnum into owner_column from pg_catalog.pg_attribute where attrelid=relation and attname='owner_id' and not attisdropped;
    if (select count(*) from pg_catalog.pg_constraint c where c.conrelid=relation and c.contype='f' and c.confrelid='auth.users'::regclass)=1
      and exists(select 1 from pg_catalog.pg_constraint c where c.conrelid=relation and c.conname=spec.constraint_name
        and c.contype='f' and c.confrelid='auth.users'::regclass and c.conkey=array[owner_column]::smallint[]
        and c.confkey=array[auth_column]::smallint[] and c.confdeltype='c' and c.confupdtype='a' and c.confmatchtype='s'
        and c.convalidated and not c.condeferrable and not c.condeferred)
      and exists(select 1 from pg_catalog.pg_trigger t where t.tgrelid=relation and t.tgname=spec.cleanup_trigger
        and t.tgfoid=pg_catalog.to_regprocedure(spec.cleanup_function) and t.tgenabled='O' and t.tgtype=11 and t.tgqual is null and t.tgnargs=0 and not t.tgisinternal)
      and exists(select 1 from pg_catalog.pg_trigger t where t.tgrelid='auth.users'::regclass and t.tgname='stride_apple_auth_finalization_guard'
        and t.tgfoid='stride_apple_private.guard_finalization()'::regprocedure and t.tgenabled='O' and t.tgtype=11 and t.tgqual is null and t.tgnargs=0 and not t.tgisinternal)
      then accepted:=array_append(accepted,spec.relation_name); end if;
  end loop;
  return plan || jsonb_build_object('apple_capture_recovery_attested',exists(select 1 from stride_deletion_private.request_state s
      where s.request_id=$1 and s.reasons->>'apple_capture_resolution'='operator_stopped_unavailable'),
    'shared_auth_tables',coalesce((select jsonb_agg(t.value)
    from jsonb_array_elements_text(plan->'shared_auth_tables') t where not t.value=any(accepted)),'[]'::jsonb));
end $$;

create function stride_apple_private.purge_revoked()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.dispositions->>'apple'='revoked' then
    delete from stride_apple_private.grants g using public.stride_account_deletion_requests r
      where r.id=new.request_id and g.owner_id=r.user_id;
  end if;
  return new;
end $$;
create trigger stride_apple_revocation_cleanup after update of dispositions on stride_deletion_private.request_state
  for each row execute function stride_apple_private.purge_revoked();
create function stride_apple_private.purge_completed()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status='completed' then delete from stride_apple_private.grants where owner_id=new.user_id; end if;
  return new;
end $$;
create trigger stride_apple_completion_cleanup after update of status on public.stride_account_deletion_requests
  for each row execute function stride_apple_private.purge_completed();

create function public.reserve_stride_apple_capture(owner_id uuid, apple_subject text, client_id text, code_hash text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare capture uuid; next_generation bigint;
begin
  perform stride_apple_private.assert_owner($1,$2,$3);
  if $4 is null or $4 !~ '^[0-9a-f]{64}$' then raise exception 'Apple reservation unavailable'; end if;
  if exists(select 1 from stride_apple_private.capture_intents i where i.owner_id=$1 and i.code_hash=$4) then return null; end if;
  select coalesce(max(i.generation),0)+1 into next_generation from stride_apple_private.capture_intents i where i.owner_id=$1;
  insert into stride_apple_private.capture_intents(owner_id,subject,client_id,code_hash,generation)
    values($1,$2,$3,$4,next_generation) returning id into capture;
  return capture;
end $$;

create function public.mark_stride_apple_capture_uncertain(capture_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  update stride_apple_private.capture_intents set state='uncertain' where id=$1 and state='reserved';
  return true;
end $$;

create function public.resolve_stride_apple_capture_unavailable(owner_id uuid, capture_id uuid, acknowledgement text, reason text)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  -- Operator attestation, NEVER a timeout/TTL inference. Stop/confirm the writer
  -- before calling. This seals late completion and records MANUAL uncertainty.
  if $3 is distinct from 'CAPTURE STOPPED; TOKENS UNAVAILABLE' or nullif(btrim($4),'') is null
    or length($4)>500 or $4 ~ '[\r\n]' then raise exception 'Explicit stopped-capture attestation required'; end if;
  perform 1 from auth.users u where u.id=$1 for update;
  if not found then raise exception 'Capture owner unavailable'; end if;
  update stride_apple_private.capture_intents i set state='manual_unavailable',resolution_reason=$4,stopped_attested_at=clock_timestamp()
    where i.id=$2 and i.owner_id=$1 and i.state in ('reserved','uncertain') and i.vault_secret_id is null;
  if not found then raise exception 'Unresolved capture required'; end if;
  return true;
end $$;

create function stride_apple_private.assert_settled(owner_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if exists(select 1 from stride_apple_private.capture_intents i where i.owner_id=$1 and i.state in ('reserved','uncertain'))
    then raise exception 'Apple capture outcome remains pending'; end if;
end $$;

create function stride_apple_private.assert_revocation_complete(owner_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform stride_apple_private.assert_settled($1);
  if exists(select 1 from stride_apple_private.capture_intents i where i.owner_id=$1 and i.state='completed'
    and (i.refresh_revoked_at is null or i.access_revoked_at is null)) then raise exception 'Apple capture tokens await revocation'; end if;
end $$;

create function public.ack_stride_apple_capture_token(request_id uuid, claim_token uuid, capture_id uuid, token_kind text, token_hash text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare owner uuid; token_field text;
begin
  perform stride_deletion_private.assert_lease($1,$2);
  select r.user_id into owner from public.stride_account_deletion_requests r where r.id=$1;
  token_field:=case $4 when 'apple_capture_refresh_token' then 'refresh_token' when 'apple_capture_access_token' then 'access_token' end;
  if token_field is null or $5 is null or $5 !~ '^[0-9a-f]{64}$' then raise exception 'Invalid Apple token acknowledgement'; end if;
  if not exists(select 1 from stride_apple_private.capture_intents i join vault.decrypted_secrets v on v.id=i.vault_secret_id
    where i.id=$3 and i.owner_id=owner and i.state='completed'
      and encode(sha256(convert_to(v.decrypted_secret::jsonb->>token_field,'UTF8')),'hex')=$5) then raise exception 'Apple token acknowledgement mismatch'; end if;
  update stride_apple_private.capture_intents i set
    refresh_revoked_at=case when token_field='refresh_token' then coalesce(i.refresh_revoked_at,clock_timestamp()) else i.refresh_revoked_at end,
    access_revoked_at=case when token_field='access_token' then coalesce(i.access_revoked_at,clock_timestamp()) else i.access_revoked_at end
    where i.id=$3 and i.owner_id=owner;
  return true;
end $$;

create function stride_apple_private.guard_finalization()
returns trigger language plpgsql security definer set search_path = '' as $$
declare owner uuid;
begin
  if tg_table_schema='auth' then owner:=old.id;
  elsif tg_table_name='request_state' then
    if not exists(select 1 from jsonb_each_text(new.dispositions) p where p.value in ('revoked','manual_required')) then return new; end if;
    select r.user_id into owner from public.stride_account_deletion_requests r where r.id=new.request_id;
  else
    if new.status<>'completed' then return new; end if;
    owner:=new.user_id;
  end if;
  perform stride_apple_private.assert_revocation_complete(owner);
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;
create trigger stride_apple_auth_finalization_guard before delete on auth.users for each row execute function stride_apple_private.guard_finalization();
create trigger stride_apple_provider_finalization_guard before update of dispositions on stride_deletion_private.request_state
  for each row execute function stride_apple_private.guard_finalization();
create trigger stride_apple_completion_guard before update of status on public.stride_account_deletion_requests
  for each row execute function stride_apple_private.guard_finalization();

create function stride_apple_private.purge_intent_secret()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from vault.secrets where id=old.vault_secret_id;
  return old;
end $$;
create trigger stride_apple_intent_secret_cleanup before delete on stride_apple_private.capture_intents
  for each row execute function stride_apple_private.purge_intent_secret();

-- Surface unresolved intent state through existing receipts/plans. No new
-- customer-facing token/intention identifiers or provider-success inference.
create or replace function stride_deletion_private.provider_actions(request_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('provider',p,
    'status',case when p='apple' and exists(select 1 from stride_apple_private.capture_intents i where i.owner_id=r.user_id and i.state in ('reserved','uncertain')) then 'pending'
      when s.dispositions->>p in ('revoked','manual_required') then s.dispositions->>p else 'pending' end,
    'reason',case when p='apple' and exists(select 1 from stride_apple_private.capture_intents i where i.owner_id=r.user_id and i.state='uncertain') then 'capture_outcome_unknown'
      when p='apple' and exists(select 1 from stride_apple_private.capture_intents i where i.owner_id=r.user_id and i.state='reserved') then 'capture_in_flight'
      else coalesce(s.reasons->>p,'not_prepared') end) order by p),'[]'::jsonb)
  from stride_deletion_private.request_state s join public.stride_account_deletion_requests r on r.id=s.request_id,
    lateral (select unnest(s.providers) p union select i.provider from auth.identities i where i.user_id=r.user_id) providers
  where s.request_id=$1
$$;

alter function public.attest_stride_deletion_provider(uuid,text,text,text,uuid) set schema stride_apple_private;
alter function stride_apple_private.attest_stride_deletion_provider(uuid,text,text,text,uuid) rename to attest_before_intents;
create function public.attest_stride_deletion_provider(request_id uuid, provider text, disposition text, reason text default null, claim_token uuid default null)
returns boolean language plpgsql security definer set search_path = '' as $$
declare owner uuid; manual_unknown boolean;
begin
  select r.user_id into owner from public.stride_account_deletion_requests r where r.id=$1 for update;
  if $3 in ('revoked','manual_required') then perform stride_apple_private.assert_revocation_complete(owner); end if;
  manual_unknown := $2='apple' and $3 in ('revoked','manual_required') and
    (exists(select 1 from stride_apple_private.capture_intents i where i.owner_id=owner and i.state='manual_unavailable'
      and i.stopped_attested_at is not null and nullif(i.resolution_reason,'') is not null)
     or exists(select 1 from stride_deletion_private.request_state s where s.request_id=$1 and s.reasons->>'apple_capture_resolution'='operator_stopped_unavailable'));
  if $4='capture_outcome_unknown' and not manual_unknown then raise exception 'Manual capture recovery is not attested'; end if;
  perform stride_apple_private.attest_before_intents($1,$2,$3,
    case when manual_unknown and $3='manual_required' then 'legacy_token_unavailable' else $4 end,$5);
  if manual_unknown then
    update stride_deletion_private.request_state s set dispositions=s.dispositions||'{"apple":"manual_required"}'::jsonb,
      reasons=s.reasons||'{"apple":"capture_outcome_unknown","apple_capture_resolution":"operator_stopped_unavailable"}'::jsonb
        ||case when $3='revoked' then '{"apple_known_tokens_revoked":"provider_confirmed"}'::jsonb else '{}'::jsonb end where s.request_id=$1;
  end if;
  return true;
end $$;

create or replace function stride_deletion_private.providers_ready(request_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare state stride_deletion_private.request_state%rowtype; provider text; disposition text; owner uuid;
begin
  select r.user_id into owner from public.stride_account_deletion_requests r where r.id=$1;
  if exists(select 1 from stride_apple_private.capture_intents i where i.owner_id=owner and (i.state in ('reserved','uncertain')
    or (i.state='completed' and (i.refresh_revoked_at is null or i.access_revoked_at is null)))) then return false; end if;
  select * into state from stride_deletion_private.request_state where request_state.request_id=$1;
  if not found then return false; end if;
  for provider in select unnest(state.providers) union select i.provider from auth.identities i where i.user_id=owner loop
    disposition:=state.dispositions->>provider;
    if provider='email' then
      if disposition is distinct from 'not_applicable' then return false; end if;
    elsif provider in ('apple','google') then
      if disposition='revoked' then continue; end if;
      if disposition='manual_required' and
        ((not provider=any(state.token_providers) and not provider=any(state.failed_providers) and state.reasons->>provider='legacy_token_unavailable')
         or (provider='apple' and state.reasons->>provider='capture_outcome_unknown' and state.reasons->>'apple_capture_resolution'='operator_stopped_unavailable'
           and ((not provider=any(state.token_providers) and not provider=any(state.failed_providers)) or state.reasons->>'apple_known_tokens_revoked'='provider_confirmed')))
        then continue; end if;
      return false;
    else return false;
    end if;
  end loop;
  return true;
end $$;

revoke all on all functions in schema stride_apple_private from public, anon, authenticated, service_role;
do $$ declare signature text; begin
  foreach signature in array array[
    'public.stride_apple_grant_captured(uuid,text,text,text)',
    'public.store_stride_apple_grant(uuid,text,text,text,jsonb,uuid)',
    'public.reserve_stride_apple_capture(uuid,text,text,text)',
    'public.mark_stride_apple_capture_uncertain(uuid)',
    'public.resolve_stride_apple_capture_unavailable(uuid,uuid,text,text)',
    'public.ack_stride_apple_capture_token(uuid,uuid,uuid,text,text)',
    'public.read_stride_deletion_provider_tokens(uuid,uuid)',
    'public.read_stride_deletion_owned_status(uuid)', 'public.stride_deletion_plan(uuid)',
    'public.attest_stride_deletion_provider(uuid,text,text,text,uuid)'
  ] loop
    execute 'revoke all on function '||signature||' from public, anon, authenticated';
    execute 'grant execute on function '||signature||' to service_role';
  end loop;
end $$;
