-- Archive history stays inside the owner's existing RLS-protected profile.
-- No policies, deletion allowlists, or unrelated profile columns are changed.
alter table public.profiles
  add column goal_archives jsonb not null default '[]'::jsonb
  constraint profiles_goal_archives_array check (jsonb_typeof(goal_archives) = 'array');

create function public.merge_stride_goal_archive(archive jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  owner_id uuid := auth.uid();
  history jsonb;
  existing_archive jsonb;
  canonical_archive jsonb;
  archive_index integer;
  incoming_time numeric := -1;
  existing_time numeric := -1;
begin
  if owner_id is null or archive->>'ownerUserId' is distinct from owner_id::text then
    raise exception 'Goal archive requires its authenticated owner' using errcode = '42501';
  end if;
  if jsonb_typeof(archive) is distinct from 'object'
    or archive->'schemaVersion' is distinct from '1'::jsonb
    or jsonb_typeof(archive->'id') is distinct from 'string' or length(archive->>'id') = 0
    or jsonb_typeof(archive->'sourceKey') is distinct from 'string' or length(archive->>'sourceKey') = 0
    or jsonb_typeof(archive->'athleteId') is distinct from 'string' or length(archive->>'athleteId') = 0
    or jsonb_typeof(archive->'title') is distinct from 'string'
    or coalesce(archive->>'kind', '') not in ('race', 'goal', 'beginner')
    or jsonb_typeof(archive->'goalType') is distinct from 'string'
    or jsonb_typeof(archive->'startDate') is distinct from 'string'
    or jsonb_typeof(archive->'endDate') is distinct from 'string'
    or jsonb_typeof(archive->'archivedAt') is distinct from 'number'
    or jsonb_typeof(archive->'summary') is distinct from 'object'
    or jsonb_typeof(archive#>'{summary,activityIds}') is distinct from 'array'
    or jsonb_typeof(archive#>'{summary,weeks}') is distinct from 'array'
    or jsonb_typeof(archive#>'{summary,coverage}') is distinct from 'object'
    or jsonb_typeof(archive->'result') is distinct from 'object'
    or coalesce(archive#>>'{result,status}', '') not in ('unrecorded', 'finished', 'did_not_finish', 'did_not_start')
  then
    raise exception 'Invalid goal archive' using errcode = '22023';
  end if;
  if (archive->>'archivedAt')::numeric < 0 then
    raise exception 'Invalid goal archive timestamp' using errcode = '22023';
  end if;
  if (archive->'result') ? 'updatedAt' then
    if jsonb_typeof(archive#>'{result,updatedAt}') is distinct from 'number' then
      raise exception 'Invalid goal result timestamp' using errcode = '22023';
    end if;
    incoming_time := (archive#>>'{result,updatedAt}')::numeric;
    if incoming_time < 0 then
      raise exception 'Invalid goal result timestamp' using errcode = '22023';
    end if;
  end if;
  if (archive->'result') ? 'source' and coalesce(archive#>>'{result,source}', '') not in ('race_record', 'user') then
    raise exception 'Invalid goal result source' using errcode = '22023';
  end if;
  if (archive->'result') ? 'timeSeconds' then
    if jsonb_typeof(archive#>'{result,timeSeconds}') is distinct from 'number'
      or archive#>>'{result,status}' <> 'finished' then
      raise exception 'Invalid goal result time' using errcode = '22023';
    end if;
    if (archive#>>'{result,timeSeconds}')::numeric <= 0 then
      raise exception 'Invalid goal result time' using errcode = '22023';
    end if;
  end if;

  -- Insert only the missing profile id. Existing onboarding, athlete, and all
  -- other columns remain untouched. Both statements run under caller RLS,
  -- including the restrictive pending-account-deletion freeze.
  insert into public.profiles (id) values (owner_id) on conflict (id) do nothing;
  select goal_archives into history from public.profiles where id = owner_id for update;
  if not found then
    raise exception 'Goal archive profile is unavailable under owner RLS' using errcode = '42501';
  end if;
  if jsonb_typeof(history) is distinct from 'array' then
    raise exception 'Saved goal archive history is unreadable' using errcode = '22023';
  end if;

  select element, (ordinality - 1)::integer into existing_archive, archive_index
    from jsonb_array_elements(history) with ordinality as entries(element, ordinality)
    where element->>'id' = archive->>'id';
  if not found then
    canonical_archive := archive;
    history := history || jsonb_build_array(canonical_archive);
  else
    if existing_archive->>'ownerUserId' is distinct from owner_id::text then
      raise exception 'Saved goal archive has a conflicting owner' using errcode = '42501';
    end if;
    canonical_archive := existing_archive;
    if (existing_archive->'result') ? 'updatedAt' then
      if jsonb_typeof(existing_archive#>'{result,updatedAt}') is distinct from 'number' then
        raise exception 'Saved goal result timestamp is unreadable' using errcode = '22023';
      end if;
      existing_time := (existing_archive#>>'{result,updatedAt}')::numeric;
    end if;
    if incoming_time > existing_time then
      canonical_archive := jsonb_set(existing_archive, '{result}', archive->'result');
      history := jsonb_set(history, array[archive_index::text], canonical_archive);
    end if;
  end if;
  update public.profiles set goal_archives = history where id = owner_id;
  if not found then
    raise exception 'Goal archive update was blocked by owner RLS' using errcode = '42501';
  end if;
  return canonical_archive;
end;
$$;

revoke all on function public.merge_stride_goal_archive(jsonb) from public, anon, authenticated;
grant execute on function public.merge_stride_goal_archive(jsonb) to authenticated;
