-- Additive owner-only durable deletion intent. FK through profiles preserves the
-- existing account-deletion allowlist: deleting its profile cascades these rows.
create table public.workout_deletions (
  user_id uuid not null references public.profiles(id) on delete cascade,
  id text not null,
  data jsonb not null,
  primary key(user_id,id)
);
create index workout_deletion_identity_keys on public.workout_deletions using gin ((data->'keys'));
alter table public.workout_deletions enable row level security;
revoke all on public.workout_deletions from public, anon, authenticated;
grant select, insert, update on public.workout_deletions to authenticated;
grant all on public.workout_deletions to service_role;
create policy workout_deletions_owner on public.workout_deletions for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy stride_deletion_freeze on public.workout_deletions as restrictive for all to authenticated
  using (not exists(select 1 from public.stride_account_deletion_requests where user_id=(select auth.uid())))
  with check (not exists(select 1 from public.stride_account_deletion_requests where user_id=(select auth.uid())));

create function public.stride_workout_identity_keys(kind text, item jsonb)
returns text[] language plpgsql immutable security invoker set search_path='' as $$
declare keys text[] := '{}'; category text; pair text[]; value text; begin
  if kind='activity_logs' then
    keys := array_append(keys,'activity:'||(item->>'id'));
    category := case item->>'activityType' when 'strength' then 'strength' when 'mobility' then 'mobility' else 'workout' end;
    if coalesce(item->>'legacyWorkoutId','')<>'' then keys:=array_append(keys,category||':'||(item->>'legacyWorkoutId')); end if;
    foreach pair slice 1 in array array[['activity_workout_','workout'],['activity_strength_','strength'],['activity_mobility_','mobility'],['activity_custom_','custom']] loop
      if left(item->>'id',length(pair[1]))=pair[1] then keys:=array_append(keys,pair[2]||':'||substr(item->>'id',length(pair[1])+1)); end if;
    end loop;
  else keys:=array_append(keys,(case kind when 'workout_logs' then 'workout' when 'strength_logs' then 'strength' else 'custom' end)||':'||(item->>'id'));
  end if;
  foreach pair slice 1 in array array[['instance',item->>'workoutInstanceId'],['instance',item#>>'{healthKit,workoutInstanceId}'],['activity',item#>>'{healthKit,strideOSActivityId}'],[case item->>'activityType' when 'strength' then 'strength' when 'mobility' then 'mobility' else 'workout' end,item#>>'{healthKit,strideOSWorkoutId}'],['health',item#>>'{healthKit,workoutUuid}']] loop
    if coalesce(pair[2],'')<>'' then keys:=array_append(keys,pair[1]||':'||pair[2]); end if;
  end loop;
  return array(select distinct k from unnest(keys) k where k is not null order by k);
end $$;
revoke all on function public.stride_workout_identity_keys(text,jsonb) from public,anon;
grant execute on function public.stride_workout_identity_keys(text,jsonb) to authenticated,service_role;

create function public.stride_reject_deleted_workout()
returns trigger language plpgsql security invoker set search_path='' as $$ begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('stride-workout-history:'||new.user_id::text,0));
  if exists(select 1 from public.workout_deletions d where d.user_id=new.user_id
    and (d.data->'keys') ?| public.stride_workout_identity_keys(tg_table_name,new.data)) then return null; end if;
  return new;
end $$;
revoke all on function public.stride_reject_deleted_workout() from public,anon,authenticated;
create trigger stride_deleted_workout_guard before insert or update on public.activity_logs for each row execute function public.stride_reject_deleted_workout();
create trigger stride_deleted_workout_guard before insert or update on public.workout_logs for each row execute function public.stride_reject_deleted_workout();
create trigger stride_deleted_workout_guard before insert or update on public.strength_logs for each row execute function public.stride_reject_deleted_workout();
create trigger stride_deleted_workout_guard before insert or update on public.custom_workout_logs for each row execute function public.stride_reject_deleted_workout();

create function public.delete_stride_completed_workout(tombstone jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare owner uuid:=auth.uid(); saved jsonb; keyset text[]; begin
  if owner is null or tombstone->>'ownerUserId' is distinct from owner::text then raise exception 'Workout deletion requires its owner' using errcode='42501'; end if;
  if jsonb_typeof(tombstone->'activityId') is distinct from 'string' or length(tombstone->>'activityId') not between 1 and 512
    or jsonb_typeof(tombstone->'deletedAt') is distinct from 'number' or (tombstone->>'deletedAt')::numeric <0
    or jsonb_typeof(tombstone->'keys') is distinct from 'array' or jsonb_array_length(tombstone->'keys') not between 1 and 50
    or exists(select 1 from jsonb_array_elements(tombstone->'keys') k where jsonb_typeof(k)<>'string' or length(k#>>'{}')>1024 or (k#>>'{}') !~ '^(activity|workout|strength|mobility|custom|instance|health):.+')
    or not (tombstone->'keys' ? ('activity:'||(tombstone->>'activityId'))) then raise exception 'Invalid workout deletion'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('stride-workout-history:'||owner::text,0));
  insert into public.profiles(id) values(owner) on conflict(id) do nothing;
  select data into saved from public.workout_deletions where user_id=owner and id=tombstone->>'activityId' for update;
  select array_agg(distinct k order by k) into keyset from jsonb_array_elements_text(coalesce(saved->'keys','[]'::jsonb)||(tombstone->'keys')) k;
  saved:=jsonb_build_object('ownerUserId',owner::text,'activityId',tombstone->>'activityId','deletedAt',coalesce(saved->'deletedAt',tombstone->'deletedAt'),'keys',to_jsonb(keyset));
  insert into public.workout_deletions(user_id,id,data) values(owner,tombstone->>'activityId',saved)
    on conflict(user_id,id) do update set data=excluded.data;
  delete from public.activity_logs where user_id=owner and public.stride_workout_identity_keys('activity_logs',data)&&keyset;
  delete from public.workout_logs where user_id=owner and public.stride_workout_identity_keys('workout_logs',data)&&keyset;
  delete from public.strength_logs where user_id=owner and public.stride_workout_identity_keys('strength_logs',data)&&keyset;
  delete from public.custom_workout_logs where user_id=owner and public.stride_workout_identity_keys('custom_workout_logs',data)&&keyset;
  return saved;
end $$;
revoke all on function public.delete_stride_completed_workout(jsonb) from public,anon;
grant execute on function public.delete_stride_completed_workout(jsonb) to authenticated;

-- The old RPC remains available to old clients and preserves new fields.
-- Corrections affect display metadata, not the original captured plan/summary.
create function public.revise_stride_goal_archive(archive jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare owner uuid:=auth.uid(); canonical jsonb; history jsonb; idx integer; meta jsonb:=archive->'metadata'; oldmeta jsonb; begin
  if meta is not null then
    if jsonb_typeof(meta) is distinct from 'object' or jsonb_typeof(meta->'title') is distinct from 'string' or length(trim(meta->>'title')) not between 1 and 160
      or jsonb_typeof(meta->'startDate') is distinct from 'string' or jsonb_typeof(meta->'endDate') is distinct from 'string'
      or (meta->>'startDate') !~ '^\d{4}-\d{2}-\d{2}$' or (meta->>'endDate') !~ '^\d{4}-\d{2}-\d{2}$'
      or (meta->>'startDate')::date > (meta->>'endDate')::date
      or jsonb_typeof(meta->'updatedAt') is distinct from 'number' or (meta->>'updatedAt')::numeric<0
      or jsonb_typeof(meta->'mutationId') is distinct from 'string' or length(meta->>'mutationId') not between 1 and 120 then raise exception 'Invalid archive correction'; end if;
  end if;
  if archive ? 'deletedAt' and (jsonb_typeof(archive->'deletedAt') is distinct from 'number' or (archive->>'deletedAt')::numeric<0) then raise exception 'Invalid archive deletion'; end if;
  canonical:=public.merge_stride_goal_archive(archive);
  if canonical->>'sourceKey' is distinct from archive->>'sourceKey' then raise exception 'Archive source identity mismatch'; end if;
  oldmeta:=canonical->'metadata';
  if meta is not null and (oldmeta is null or (meta->>'updatedAt')::numeric>(oldmeta->>'updatedAt')::numeric
    or ((meta->>'updatedAt')::numeric=(oldmeta->>'updatedAt')::numeric and meta->>'mutationId'>oldmeta->>'mutationId')) then canonical:=jsonb_set(canonical,'{metadata}',meta); end if;
  if archive ? 'deletedAt' and not canonical ? 'deletedAt' then canonical:=jsonb_set(canonical,'{deletedAt}',archive->'deletedAt'); end if;
  select goal_archives into history from public.profiles where id=owner for update;
  select (ordinality-1)::integer into idx from jsonb_array_elements(history) with ordinality e(value,ordinality) where value->>'id'=archive->>'id';
  update public.profiles set goal_archives=jsonb_set(history,array[idx::text],canonical) where id=owner;
  if not found then raise exception 'Archive update blocked by owner RLS' using errcode='42501'; end if;
  return canonical;
end $$;
revoke all on function public.revise_stride_goal_archive(jsonb) from public,anon;
grant execute on function public.revise_stride_goal_archive(jsonb) to authenticated;
