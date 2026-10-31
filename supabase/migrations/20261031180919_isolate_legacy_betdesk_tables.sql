-- Bet Desk production is dcqigdevqbugyodoxmbe; StrideOS stays on
-- pbzgrhnxpbtlkzpreizy. This archives legacy tables, never their records.
create schema betdesk_archive_20261031;
revoke all on schema betdesk_archive_20261031 from public, anon, authenticated;
grant usage on schema betdesk_archive_20261031 to service_role;
create table betdesk_archive_20261031.manifest (
  table_name text primary key,
  original_oid oid not null,
  row_count bigint not null,
  original_acl text,
  detached_auth_constraints jsonb not null,
  archived_at timestamptz not null default now()
);
alter table betdesk_archive_20261031.manifest enable row level security;
revoke all on betdesk_archive_20261031.manifest from public, anon, authenticated, service_role;
grant select on betdesk_archive_20261031.manifest to service_role;

do $$
declare
  names constant text[] := array['betdesk_bets','betdesk_closing_lines','betdesk_clv_observations',
    'betdesk_daily_picks','betdesk_game_results','betdesk_model_snapshots','betdesk_profiles',
    'betdesk_sheet_export_events','betdesk_user_settings'];
  table_name text;
  relation_oid oid;
  original_acl text;
  before_count bigint;
  after_count bigint;
  constraint_row record;
  constraints jsonb;
begin
  if (select count(*) from pg_catalog.pg_tables where schemaname='public' and tablename like 'betdesk_%') <> cardinality(names)
    then raise exception 'Unexpected legacy table inventory; review before isolating'; end if;
  foreach table_name in array names loop
    execute format('lock table public.%I in access exclusive mode', table_name);
  end loop;
  if exists(select 1 from public.betdesk_profiles) or exists(select 1 from public.betdesk_bets)
    or exists(select 1 from public.betdesk_user_settings) or exists(select 1 from public.betdesk_sheet_export_events)
    then raise exception 'Legacy user data exists; a verified identity migration is required instead'; end if;
  if exists(select 1 from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.prosrc ilike '%betdesk_%')
    or exists(select 1 from pg_catalog.pg_views where schemaname='public' and definition ilike '%betdesk_%')
    then raise exception 'Active public functions or views depend on legacy tables'; end if;

  foreach table_name in array names loop
    select c.oid, c.relacl::text into relation_oid, original_acl from pg_catalog.pg_class c
      join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname=table_name;
    if relation_oid is null then raise exception 'Legacy table missing: %', table_name; end if;
    execute format('select count(*) from public.%I',table_name) into before_count;
    select coalesce(jsonb_agg(jsonb_build_object('name',conname,'definition',pg_catalog.pg_get_constraintdef(oid))), '[]'::jsonb)
      into constraints from pg_catalog.pg_constraint where conrelid=relation_oid and confrelid='auth.users'::regclass;
    for constraint_row in select conname from pg_catalog.pg_constraint where conrelid=relation_oid and confrelid='auth.users'::regclass loop
      execute format('alter table public.%I drop constraint %I',table_name,constraint_row.conname);
    end loop;
    execute format('alter table public.%I set schema betdesk_archive_20261031',table_name);
    execute format('revoke all on betdesk_archive_20261031.%I from public, anon, authenticated, service_role',table_name);
    execute format('grant select on betdesk_archive_20261031.%I to service_role',table_name);
    execute format('select count(*) from betdesk_archive_20261031.%I',table_name) into after_count;
    if before_count <> after_count or relation_oid <> to_regclass(format('betdesk_archive_20261031.%I',table_name))::oid then
      raise exception 'Archive preservation verification failed';
    end if;
    insert into betdesk_archive_20261031.manifest(table_name,original_oid,row_count,original_acl,detached_auth_constraints)
      values(table_name,relation_oid,before_count,original_acl,constraints);
  end loop;
end;
$$;
