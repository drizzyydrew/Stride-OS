begin;
insert into auth.users(id,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
  values ('71e0ff16-e219-43f2-b87b-e58db4a10214','deletion-probe@invalid.example','{}','{}',now(),now());
insert into public.activity_logs(user_id,id,data) values
  ('71e0ff16-e219-43f2-b87b-e58db4a10214','deletion-freeze-probe','{"synthetic":true}');
insert into public.stride_account_deletion_requests(id,user_id) values
  ('71e0ff16-e219-43f2-b87b-e58db4a10213','71e0ff16-e219-43f2-b87b-e58db4a10214');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"71e0ff16-e219-43f2-b87b-e58db4a10214","role":"authenticated"}',true);
do $$ declare n integer; begin
  select count(*) into n from public.activity_logs where id='deletion-freeze-probe';
  if n<>0 then raise exception 'Requested deletion still exposes cloud records'; end if;
  select count(*) into n from public.profiles where id='71e0ff16-e219-43f2-b87b-e58db4a10214';
  if n<>0 then raise exception 'Requested deletion still exposes profile'; end if;
  select count(*) into n from public.stride_account_deletion_requests where id='71e0ff16-e219-43f2-b87b-e58db4a10213';
  if n<>1 then raise exception 'Owner lost access to receipt'; end if;
  begin
    insert into public.activity_logs(user_id,id,data) values
      ('71e0ff16-e219-43f2-b87b-e58db4a10214','deletion-frozen-write','{}');
    raise exception 'Frozen account recreated cloud data';
  exception when insufficient_privilege then null; end;
  begin
    perform public.stride_deletion_plan('71e0ff16-e219-43f2-b87b-e58db4a10213');
    raise exception 'Client accessed privileged deletion manifest';
  exception when insufficient_privilege then null; end;
  if has_function_privilege('anon','public.claim_stride_deletion(uuid)','execute')
    or has_function_privilege('authenticated','public.complete_stride_deletion(uuid,uuid)','execute') then
    raise exception 'Deletion function is exposed';
  end if;
end $$;
reset role;
set local role service_role;
do $$ declare p jsonb; claimed uuid; begin
  p := public.stride_deletion_plan('71e0ff16-e219-43f2-b87b-e58db4a10213');
  if (p->'record_counts'->>'activity_logs')::integer <> 1 then raise exception 'Manifest did not inventory owned data'; end if;
  if jsonb_array_length(p->'shared_auth_tables') > 0 then
    begin
      perform public.claim_stride_deletion('71e0ff16-e219-43f2-b87b-e58db4a10213');
      raise exception 'Shared-auth account was claimed';
    exception when raise_exception then
      if sqlerrm not like 'Shared authentication%' then raise; end if;
    end;
  else
    claimed := public.claim_stride_deletion('71e0ff16-e219-43f2-b87b-e58db4a10213');
    if not public.renew_stride_deletion('71e0ff16-e219-43f2-b87b-e58db4a10213',claimed) then
      raise exception 'Isolated account could not obtain a valid lease';
    end if;
  end if;
  if public.renew_stride_deletion('71e0ff16-e219-43f2-b87b-e58db4a10213','71e0ff16-e219-43f2-b87b-e58db4a10215') then
    raise exception 'Unowned lease was renewed';
  end if;
end $$;
reset role;
update public.stride_account_deletion_requests set status='processing',
  processing_token='71e0ff16-e219-43f2-b87b-e58db4a10215',processing_expires_at=now()+interval '15 minutes'
  where id='71e0ff16-e219-43f2-b87b-e58db4a10213';
set local role service_role;
do $$ begin
  begin
    perform public.complete_stride_deletion('71e0ff16-e219-43f2-b87b-e58db4a10213',null);
    raise exception 'Null lease was accepted';
  exception when raise_exception then
    if sqlerrm <> 'Invalid deletion lease' then raise; end if;
  end;
  begin
    perform public.complete_stride_deletion('71e0ff16-e219-43f2-b87b-e58db4a10213','71e0ff16-e219-43f2-b87b-e58db4a10215');
    raise exception 'Live account was marked complete';
  exception when raise_exception then
    if sqlerrm <> 'Deletion is not complete' then raise; end if;
  end;
end $$;
reset role;
-- Metadata fixture only: no physical Storage object is uploaded or deleted.
insert into storage.objects(bucket_id,name,owner_id) values
  ('movement-videos','71e0ff16-e219-43f2-b87b-e58db4a10214/deletion-owner-mismatch-probe','71e0ff16-e219-43f2-b87b-e58db4a10215');
set local role service_role;
do $$ declare p jsonb; begin
  p := public.stride_deletion_plan('71e0ff16-e219-43f2-b87b-e58db4a10213');
  if (p->>'unsafe_storage_objects')::integer <> 1 then raise exception 'Conflicting object owner was not blocked'; end if;
end $$;
reset role;
rollback;
select 'Deletion freeze, owner-only receipt, operator-only RPCs, isolation guard and completion checks passed; fixtures rolled back' as result;
