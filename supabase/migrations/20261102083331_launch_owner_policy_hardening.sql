-- Prepared from main's deployed catalog, 2026-11-02, StrideOS only.
-- Not applied by this task. No table data, grants, functions or controls change.
-- One DO statement makes verification + all policy DDL atomic, even when the
-- caller does not wrap the migration in a larger transaction.
do $hardening$
declare
  expected record;
  authenticated_oid oid := 'authenticated'::regrole::oid;
  storage_oid oid := 'storage.objects'::regclass::oid;
  freeze_before jsonb;
  freeze_after jsonb;
begin
  -- Keep catalog verification and policy changes stable against concurrent DDL.
  -- This acquires locks only; it does not read or change application rows.
  lock table public.profiles, public.movement_videos, public.analysis_requests,
    storage.objects in share row exclusive mode;

  -- Check EVERY saved name, role list, command and complete predicate before
  -- changing ANY policy. Refuse drift instead of broadening/replacing a policy.
  for expected in
    select * from (values
      ('public.profiles', 'own profile', '*', '(auth.uid() = id)', null::text),
      ('public.movement_videos', 'own videos', '*', '(auth.uid() = user_id)', null::text),
      ('public.analysis_requests', 'own requests', '*', '(auth.uid() = user_id)', null::text),
      ('storage.objects', 'own video files read', 'r',
        '((bucket_id = ''movement-videos''::text) AND ((storage.foldername(name))[1] = (auth.uid())::text))', null::text),
      ('storage.objects', 'own video files upload', 'a', null::text,
        '((bucket_id = ''movement-videos''::text) AND ((storage.foldername(name))[1] = (auth.uid())::text))'),
      ('storage.objects', 'own video files delete', 'd',
        '((bucket_id = ''movement-videos''::text) AND ((storage.foldername(name))[1] = (auth.uid())::text))', null::text)
    ) v(relation_name, policy_name, command, using_expr, check_expr)
  loop
    if not exists (
      select 1 from pg_catalog.pg_policy p
      where p.polrelid=pg_catalog.to_regclass(expected.relation_name)
        and p.polname=expected.policy_name and p.polcmd::text=expected.command
        and p.polpermissive and p.polroles=array[0::oid]
        and pg_catalog.pg_get_expr(p.polqual,p.polrelid) is not distinct from expected.using_expr
        and pg_catalog.pg_get_expr(p.polwithcheck,p.polrelid) is not distinct from expected.check_expr
    ) then
      raise exception 'Policy inventory drift: %.%; review before applying hardening',
        expected.relation_name, expected.policy_name;
    end if;
  end loop;

  -- The existing restrictive freeze must survive byte-for-byte in catalog
  -- expression form, with the same command, role list and permissiveness.
  select pg_catalog.jsonb_build_object('oid',p.oid,'command',p.polcmd,'roles',p.polroles,
      'permissive',p.polpermissive,'using',pg_catalog.pg_get_expr(p.polqual,p.polrelid),
      'check',pg_catalog.pg_get_expr(p.polwithcheck,p.polrelid))
    into freeze_before from pg_catalog.pg_policy p
    where p.polrelid=storage_oid and p.polname='stride_deletion_storage_freeze'
      and not p.polpermissive and p.polcmd='*' and p.polroles=array[authenticated_oid]
      and p.polqual is not null and p.polwithcheck is not null;
  if freeze_before is null then
    raise exception 'Restrictive Storage deletion freeze is missing or changed';
  end if;
  if exists(select 1 from pg_catalog.pg_policy p where p.polrelid=storage_oid
    and (p.polname='own video files update' or (p.polpermissive and p.polcmd in ('w','*')
      and exists(select 1 from pg_catalog.unnest(p.polroles) r(role_oid)
        where case when r.role_oid=0 then true
          else pg_catalog.pg_has_role(authenticated_oid,r.role_oid,'MEMBER') end)))) then
    raise exception 'Storage UPDATE policy inventory changed; review instead of replacing';
  end if;

  -- Role scope only. Existing owner predicates and effective CHECK fallback stay.
  alter policy "own profile" on public.profiles to authenticated;
  alter policy "own videos" on public.movement_videos to authenticated;
  alter policy "own requests" on public.analysis_requests to authenticated;
  alter policy "own video files read" on storage.objects to authenticated;
  alter policy "own video files upload" on storage.objects to authenticated;
  alter policy "own video files delete" on storage.objects to authenticated;

  -- Upsert/replacement requires UPDATE as well as SELECT and INSERT. USING
  -- restricts the old row; WITH CHECK rejects cross-prefix moves/new contents.
  create policy "own video files update" on storage.objects
    for update to authenticated
    using (bucket_id = 'movement-videos' and (storage.foldername(name))[1] = auth.uid()::text)
    with check (bucket_id = 'movement-videos' and (storage.foldername(name))[1] = auth.uid()::text);

  select pg_catalog.jsonb_build_object('oid',p.oid,'command',p.polcmd,'roles',p.polroles,
      'permissive',p.polpermissive,'using',pg_catalog.pg_get_expr(p.polqual,p.polrelid),
      'check',pg_catalog.pg_get_expr(p.polwithcheck,p.polrelid))
    into freeze_after from pg_catalog.pg_policy p
    where p.polrelid=storage_oid and p.polname='stride_deletion_storage_freeze';
  if freeze_after is distinct from freeze_before then
    raise exception 'Storage deletion freeze changed; policy hardening rolled back';
  end if;
end;
$hardening$;
