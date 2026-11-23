-- Hosted acceptance: synthetic accounts/records only; every write rolls back.
-- Run only after 20261123123200 is applied. Never remove the final ROLLBACK.
begin;
select pg_catalog.set_config('strideos127.owner_a', pg_catalog.gen_random_uuid()::text, true);
select pg_catalog.set_config('strideos127.owner_b', pg_catalog.gen_random_uuid()::text, true);
do $$ declare a uuid:=current_setting('strideos127.owner_a')::uuid; b uuid:=current_setting('strideos127.owner_b')::uuid; begin
  insert into auth.users(id,aud,role) values(a,'authenticated','authenticated'),(b,'authenticated','authenticated');
  insert into public.profiles(id) values(a),(b) on conflict(id) do nothing;
end $$;
set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub',current_setting('strideos127.owner_a'),true);
select pg_catalog.set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('strideos127.owner_a'),'role','authenticated')::text,true);
do $$ declare a uuid:=current_setting('strideos127.owner_a')::uuid; b uuid:=current_setting('strideos127.owner_b')::uuid; archive jsonb; result jsonb; denied boolean:=false; begin
  insert into public.activity_logs(id,user_id,data) values('127-synthetic-activity',a,'{"id":"127-synthetic-activity","activityType":"running","legacyWorkoutId":"127-synthetic-run","workoutInstanceId":"127-synthetic-instance"}');
  insert into public.workout_logs(id,user_id,data) values('127-synthetic-run',a,'{"id":"127-synthetic-run","workoutInstanceId":"127-synthetic-instance"}');
  perform public.delete_stride_completed_workout(jsonb_build_object('ownerUserId',a::text,'activityId','127-synthetic-activity','deletedAt',1,'keys',jsonb_build_array('activity:127-synthetic-activity','workout:127-synthetic-run','instance:127-synthetic-instance')));
  if exists(select 1 from public.activity_logs where user_id=a and id='127-synthetic-activity') or exists(select 1 from public.workout_logs where user_id=a and id='127-synthetic-run') then raise exception 'Synthetic whole-workout deletion failed'; end if;
  insert into public.activity_logs(id,user_id,data) values('127-synthetic-health-alias',a,'{"id":"127-synthetic-health-alias","workoutInstanceId":"127-synthetic-instance"}');
  insert into public.workout_logs(id,user_id,data) values('127-synthetic-run',a,'{"id":"127-synthetic-run"}');
  if exists(select 1 from public.activity_logs where user_id=a and id='127-synthetic-health-alias') or exists(select 1 from public.workout_logs where user_id=a and id='127-synthetic-run') then raise exception 'Synthetic stale re-upload was resurrected'; end if;
  begin perform public.delete_stride_completed_workout(jsonb_build_object('ownerUserId',b::text,'activityId','other','deletedAt',1,'keys',jsonb_build_array('activity:other'))); exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'Cross-owner delete RPC was accepted'; end if;
  archive:=jsonb_build_object('schemaVersion',1,'id','127-synthetic-archive','sourceKey','127-synthetic-source','ownerUserId',a::text,'athleteId','athlete_default','title','Original synthetic title','kind','goal','goalType','general_running','startDate','2026-01-01','endDate','2026-02-01','archivedAt',1,'summary',jsonb_build_object('activityIds','[]'::jsonb,'weeks','[]'::jsonb,'coverage','{}'::jsonb),'macroPlan',jsonb_build_object('weeks',jsonb_build_array(jsonb_build_object('prescription','unchanged'))),'result',jsonb_build_object('status','unrecorded'));
  perform public.merge_stride_goal_archive(archive);
  result:=public.revise_stride_goal_archive(archive||jsonb_build_object('metadata',jsonb_build_object('title','Corrected synthetic title','startDate','2026-01-02','endDate','2026-02-02','updatedAt',2,'mutationId','127-synthetic-mutation')));
  if result->'macroPlan' is distinct from archive->'macroPlan' or result->>'title'<>'Original synthetic title' or result#>>'{metadata,title}'<>'Corrected synthetic title' then raise exception 'Archive correction rewrote original data'; end if;
  perform public.revise_stride_goal_archive(archive||jsonb_build_object('deletedAt',3));
  result:=public.merge_stride_goal_archive(archive||jsonb_build_object('result',jsonb_build_object('status','finished','timeSeconds',600,'updatedAt',4)));
  if result->>'deletedAt'<>'3' or result#>>'{metadata,title}'<>'Corrected synthetic title' then raise exception 'Stale archive write undid deletion/correction'; end if;
end $$;
select pg_catalog.set_config('request.jwt.claim.sub',current_setting('strideos127.owner_b'),true);
select pg_catalog.set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('strideos127.owner_b'),'role','authenticated')::text,true);
do $$ declare b uuid:=current_setting('strideos127.owner_b')::uuid; begin
  if exists(select 1 from public.workout_deletions where user_id=current_setting('strideos127.owner_a')::uuid) then raise exception 'Other owner deletion intent visible'; end if;
  insert into public.activity_logs(id,user_id,data) values('127-synthetic-activity',b,'{"id":"127-synthetic-activity","workoutInstanceId":"127-synthetic-instance"}');
  if not exists(select 1 from public.activity_logs where user_id=b and id='127-synthetic-activity') then raise exception 'Another owner same identity incorrectly blocked'; end if;
end $$;
set local role anon;
do $$ declare denied boolean:=false; begin
  begin perform public.delete_stride_completed_workout('{}'::jsonb); exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'Anonymous deletion RPC executable'; end if;
  denied:=false;
  begin perform public.revise_stride_goal_archive('{}'::jsonb); exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'Anonymous archive RPC executable'; end if;
end $$;
reset role;
rollback;
