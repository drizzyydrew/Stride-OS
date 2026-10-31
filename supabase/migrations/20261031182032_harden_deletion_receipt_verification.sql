create or replace function public.stride_deletion_plan(request_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  job public.stride_account_deletion_requests%rowtype;
  table_name text;
  row_count bigint;
  records jsonb := '{}'::jsonb;
  shared_auth_tables jsonb;
  paths jsonb;
  unsafe_objects bigint;
  providers jsonb;
begin
  select * into job from public.stride_account_deletion_requests where id = request_id;
  if not found then raise exception 'Unknown deletion request'; end if;
  foreach table_name in array array['profiles','activity_logs','workout_logs',
    'strength_logs','custom_workout_logs','daily_check_ins','movement_videos','analysis_requests']
  loop
    execute format('select count(*) from public.%I where %I = $1', table_name,
      case when table_name = 'profiles' then 'id' else 'user_id' end)
      into row_count using job.user_id;
    records := records || jsonb_build_object(table_name, row_count);
  end loop;
  select coalesce(jsonb_agg(distinct c.conrelid::regclass::text), '[]'::jsonb)
    into shared_auth_tables from pg_catalog.pg_constraint c
    join pg_catalog.pg_class t on t.oid = c.conrelid
    join pg_catalog.pg_namespace n on n.oid = t.relnamespace
    where c.confrelid = 'auth.users'::regclass and n.nspname not in ('auth','storage')
      and not (n.nspname = 'public' and t.relname = any(array['profiles','activity_logs',
        'workout_logs','strength_logs','custom_workout_logs','daily_check_ins','movement_videos','analysis_requests']));
  select coalesce(jsonb_agg(name order by name), '[]'::jsonb) into paths
    from storage.objects where bucket_id = 'movement-videos'
      and split_part(name, '/', 1) = job.user_id::text;
  -- Check both directions: an owned file outside the prefix, or a file in the
  -- prefix explicitly owned by someone else. Never resolve conflicts by deleting.
  select count(*) into unsafe_objects from storage.objects
    where ((owner_id = job.user_id::text or owner = job.user_id)
      and not (bucket_id = 'movement-videos' and split_part(name, '/', 1) = job.user_id::text))
    or (bucket_id = 'movement-videos' and split_part(name, '/', 1) = job.user_id::text
      and ((owner_id is not null and owner_id <> job.user_id::text) or (owner is not null and owner <> job.user_id)));
  select coalesce(jsonb_agg(distinct provider), '[]'::jsonb) into providers
    from auth.identities where user_id = job.user_id;
  return jsonb_build_object('request_id', job.id, 'user_id', job.user_id, 'status', job.status,
    'auth_user_exists', exists(select 1 from auth.users where id = job.user_id),
    'record_counts', records, 'storage_paths', paths, 'unsafe_storage_objects', unsafe_objects,
    'shared_auth_tables', shared_auth_tables, 'identity_providers', providers);
end;
$$;
revoke all on function public.stride_deletion_plan(uuid) from public, anon, authenticated;
grant execute on function public.stride_deletion_plan(uuid) to service_role;

create or replace function public.complete_stride_deletion(request_id uuid, claim_token uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare job public.stride_account_deletion_requests%rowtype; plan jsonb;
begin
  select * into job from public.stride_account_deletion_requests where id = request_id for update;
  if not found or job.status <> 'processing' or claim_token is null or job.processing_token is null
    or job.processing_token is distinct from claim_token or job.processing_expires_at is null
    or job.processing_expires_at <= now() then raise exception 'Invalid deletion lease'; end if;
  plan := public.stride_deletion_plan(request_id);
  if (plan->>'auth_user_exists')::boolean or jsonb_array_length(plan->'storage_paths') <> 0
    or (plan->>'unsafe_storage_objects')::bigint <> 0
    or exists(select 1 from jsonb_each_text(plan->'record_counts') r where r.value::bigint <> 0) then
    raise exception 'Deletion is not complete';
  end if;
  update public.stride_account_deletion_requests set status = 'completed', completed_at = now(),
    processing_token = null, processing_expires_at = null where id = request_id;
  return true;
end;
$$;
revoke all on function public.complete_stride_deletion(uuid, uuid) from public, anon, authenticated;
grant execute on function public.complete_stride_deletion(uuid, uuid) to service_role;
