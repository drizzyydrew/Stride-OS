-- StrideOS deployed security acceptance v5, base cbf1932, 2026-11-02.
-- Plus reviewed Apple custody, owner-policy and legacy-maintenance migrations.
-- Expected post-migration state, NOT evidence either migration was deployed.
-- Darwin approved the exact frozen durable-intent revision (see source hashes).
-- Deployment/readback and provider/device acceptance remain separate gates.
-- PREPARED ONLY. No application RPCs, fixtures, DDL, DML, customer rows or secrets.
-- Operator: read docs/handoff/LAUNCH_SECURITY_20261102.md before running.
-- Use a privileged readback connection and stop on SQL errors. One JSON SELECT
-- combines catalog and dormant_control phases. An error/missing result is failure.
-- This is an acceptance profile for DORMANT deletion, not authorization to enable it.
begin transaction isolation level repeatable read read only;
set local statement_timeout = '15s';
set local lock_timeout = '2s';
set local search_path = pg_catalog;

with
roles as (
  select wanted.name, r.oid, r.rolsuper, r.rolbypassrls
  from (values ('anon'), ('authenticated'), ('service_role')) wanted(name)
  left join pg_roles r on r.rolname = wanted.name
),
expected_tables(schema_name, table_name, kind, owner_column) as (values
  ('public','profiles','owner','id'),
  ('public','activity_logs','owner','user_id'),
  ('public','workout_logs','owner','user_id'),
  ('public','strength_logs','owner','user_id'),
  ('public','custom_workout_logs','owner','user_id'),
  ('public','daily_check_ins','owner','user_id'),
  ('public','movement_videos','legacy_owner','user_id'),
  ('public','analysis_requests','legacy_owner','user_id'),
  ('public','stride_coach_usage','service',null),
  ('public','stride_account_deletion_requests','receipt','user_id'),
  ('stride_deletion_private','control','private',null),
  ('stride_deletion_private','request_state','private',null),
  ('stride_deletion_private','job_tickets','private',null),
  ('stride_deletion_private','provider_tokens','private',null),
  ('stride_apple_private','grants','private',null),
  ('stride_apple_private','captures','private',null),
  ('stride_apple_private','capture_intents','private',null),
  ('betdesk_archive_20261031','manifest','archive_manifest',null),
  ('betdesk_archive_20261031','betdesk_bets','archive',null),
  ('betdesk_archive_20261031','betdesk_closing_lines','archive',null),
  ('betdesk_archive_20261031','betdesk_clv_observations','archive',null),
  ('betdesk_archive_20261031','betdesk_daily_picks','archive',null),
  ('betdesk_archive_20261031','betdesk_game_results','archive',null),
  ('betdesk_archive_20261031','betdesk_model_snapshots','archive',null),
  ('betdesk_archive_20261031','betdesk_profiles','archive',null),
  ('betdesk_archive_20261031','betdesk_sheet_export_events','archive',null),
  ('betdesk_archive_20261031','betdesk_user_settings','archive',null),
  ('storage','objects','storage',null)
),
tables as (
  select e.*, c.oid, c.relrowsecurity, c.relkind, c.relowner, c.relacl
  from expected_tables e left join pg_namespace n on n.nspname=e.schema_name
  left join pg_class c on c.relnamespace=n.oid and c.relname=e.table_name
),
-- Exact migration bodies, not substring tests. MD5 is a drift fingerprint,
-- not a signature/security primitive. The document records regeneration rules.
expected_functions(signature, body_md5, definer, audience) as (values
  ('public.consume_stride_coach_allowance(uuid)','0c00ed72e27dc427a658a8b229944bf4',true,'service'),
  ('public.claim_stride_deletion(uuid)','fbb0b2dc7613f53547db509017e8ba87',true,'service'),
  ('public.renew_stride_deletion(uuid,uuid)','dd26873c9fd40e7ad308927126f6d27f',true,'service'),
  ('public.complete_stride_deletion(uuid,uuid)','7005c4f80307e6604e03e2593184b12d',true,'service'),
  ('public.merge_stride_goal_archive(jsonb)','394d7be7d975ba585fab4a9eea1d0911',false,'authenticated'),
  ('stride_deletion_private.secret_hash(text)','42b3fffb805b2e65e01240964d7777fe',false,'private'),
  ('stride_deletion_private.public_gateway_key(text)','0f3af1ab4bfa97618bf8a662a5d3c78c',false,'private'),
  ('stride_deletion_private.enabled_for_user(uuid)','815d19cfb4518e17a7c21d0c4f37bfc8',true,'private'),
  ('stride_deletion_private.providers_ready(uuid)','89712fd50c0e1c99e6eb53a9c867abd1',true,'private'),
  ('stride_deletion_private.assert_lease(uuid,uuid)','b8aabf6e718a36b5c8077716ad4bc49a',true,'private'),
  ('stride_deletion_private.provider_actions(uuid)','913de342d954ce57a9ac7648bcf19d17',true,'private'),
  ('stride_deletion_private.clear_provider_tokens(uuid,text)','fb2060774f4a4e9119747769deafe47a',true,'private'),
  ('public.store_stride_deletion_provider_token(uuid,text,text,text,uuid)','f23fa995206abf64c6b952b2596307b1',true,'service'),
  ('public.replace_stride_deletion_apple_code(uuid,text,text,text,uuid)','9ee6b3fdc29dcad9f0d77c101d214db1',true,'service'),
  ('public.read_stride_deletion_receipt(uuid,text)','d9b59105b0c2c938ac77db5656726a74',true,'service'),
  ('public.start_stride_deletion(uuid,text,jsonb)','690c1a331fe6c8115e850d6c5fb9da2b',true,'service'),
  ('public.refresh_stride_deletion_provider_tokens(uuid,text,jsonb)','5a2dd96c2b32f9a73d0cd3380a0a6c17',true,'service'),
  ('public.stride_deletion_inventory_v0(uuid)','364c34c3cac7348eb81669e29eb7a39f',true,'service'),
  ('public.issue_stride_deletion_job_ticket(uuid)','2db48b056c1fd9a1f7083ac7aaf8b2b0',true,'service'),
  ('public.consume_stride_deletion_job_ticket(uuid,text)','5d855897a7458e688c19f663f5ca94e6',true,'service'),
  ('public.dispatch_stride_deletion_jobs()','f0fef71606c416a76806ee734291ce91',true,'service'),
  ('public.configure_stride_deletion_automation(boolean,text,uuid[])','ad7f08af90c731520ffefa805707baec',true,'service'),
  ('public.stride_deletion_automation_enabled(uuid)','e3bca981cf38434856bac3c4dab25b7d',true,'service'),
  ('stride_apple_private.assert_owner(uuid,text,text,boolean)','3ad3dfaf78f796ed16f9c060d7801ead',true,'private'),
  ('public.stride_apple_grant_captured(uuid,text,text,text)','3b2e41878be94a70b6afb9fffc81589d',true,'service'),
  ('stride_apple_private.purge_grant_secret()','0eb549a6406b68056aadbcb45a16f292',true,'private'),
  ('public.store_stride_apple_grant(uuid,text,text,text,jsonb,uuid)','acad015b460c55410bbabc5947898997',true,'service'),
  ('stride_apple_private.lock_deletion_owner()','cb1a111d7dbd287615199aec93a0996d',true,'private'),
  ('stride_apple_private.adopt(uuid,uuid)','53425df60139613c6dd7210a7d1488fe',true,'private'),
  ('stride_apple_private.read_deletion_tokens_before_grants(uuid,uuid)','650426b1470f92e7fe77c8fdcd5f6b93',true,'private'),
  ('public.read_stride_deletion_provider_tokens(uuid,uuid)','5a224a114e78c17bea3a52d2ccc0522b',true,'service'),
  ('stride_apple_private.read_deletion_status_before_grants(uuid)','eecd65744cd355a680d0b19982b12d0c',true,'private'),
  ('public.read_stride_deletion_owned_status(uuid)','c5a4aede35113a9d2585620102f8eb4c',true,'service'),
  ('stride_apple_private.deletion_plan_before_grants(uuid)','123aa0c7cc2960362242d461cd00f986',true,'private'),
  ('public.stride_deletion_plan(uuid)','6a0a6957d470f997310343fef57275b2',true,'service'),
  ('stride_apple_private.purge_revoked()','023a456a0877f98cb02bf4463a28abe8',true,'private'),
  ('stride_apple_private.purge_completed()','ae875110e8600a9501ae5ee689dc7339',true,'private'),
  ('public.reserve_stride_apple_capture(uuid,text,text,text)','1b05af2d75b0cc0e6cf556b4d6c3311d',true,'service'),
  ('public.mark_stride_apple_capture_uncertain(uuid)','1f15e318b7667f81253daca64803cc49',true,'service'),
  ('public.resolve_stride_apple_capture_unavailable(uuid,uuid,text,text)','cd2325939fd3df7bc1e087354d7ae12f',true,'service'),
  ('stride_apple_private.assert_settled(uuid)','151a83cb787a50d567579c8d813d3e2c',true,'private'),
  ('stride_apple_private.assert_revocation_complete(uuid)','63c50d7dc107947c1dddb8b58b7d17b5',true,'private'),
  ('public.ack_stride_apple_capture_token(uuid,uuid,uuid,text,text)','c8217db4e8edfadf27693cdac30ecd73',true,'service'),
  ('stride_apple_private.guard_finalization()','5e14068c80bd2fd6b4a96a982a50526a',true,'private'),
  ('stride_apple_private.purge_intent_secret()','f5217a472cc2ec51f766df38e11a791a',true,'private'),
  ('stride_apple_private.attest_before_intents(uuid,text,text,text,uuid)','9b3dbc72a57953f66249f1b1a9d2175e',true,'private'),
  ('public.attest_stride_deletion_provider(uuid,text,text,text,uuid)','243caa894b263725a8d1b72cc6a46f81',true,'service'),
  ('public.handle_new_user()','fc0e692c32cd0f78ccc2f2a239cea040',true,'service'),
  ('public.rls_auto_enable()','99be20677b456ea8d3be47bdd44fb369',true,'service')
),
expected_arguments(signature, names, result_type, default_count) as (values
  ('public.consume_stride_coach_allowance(uuid)','owner_id','boolean',0),
  ('public.claim_stride_deletion(uuid)','request_id','uuid',0),
  ('public.renew_stride_deletion(uuid,uuid)','request_id,claim_token','boolean',0),
  ('public.complete_stride_deletion(uuid,uuid)','request_id,claim_token','boolean',0),
  ('public.merge_stride_goal_archive(jsonb)','archive','jsonb',0),
  ('stride_deletion_private.secret_hash(text)','secret','text',0),
  ('stride_deletion_private.public_gateway_key(text)','value','boolean',0),
  ('stride_deletion_private.enabled_for_user(uuid)','owner_id','boolean',0),
  ('stride_deletion_private.providers_ready(uuid)','request_id','boolean',0),
  ('stride_deletion_private.assert_lease(uuid,uuid)','request_id,claim_token','void',0),
  ('stride_deletion_private.provider_actions(uuid)','request_id','jsonb',0),
  ('stride_deletion_private.clear_provider_tokens(uuid,text)','request_id,provider','void',1),
  ('public.store_stride_deletion_provider_token(uuid,text,text,text,uuid)','request_id,token_kind,token_secret,provider_subject,claim_token','boolean',1),
  ('public.replace_stride_deletion_apple_code(uuid,text,text,text,uuid)','request_id,authorization_code,refresh_token,provider_subject,claim_token','boolean',0),
  ('public.read_stride_deletion_receipt(uuid,text)','request_id,receipt_secret','jsonb',0),
  ('public.start_stride_deletion(uuid,text,jsonb)','user_id,receipt_hash,provider_tokens','jsonb',1),
  ('public.refresh_stride_deletion_provider_tokens(uuid,text,jsonb)','user_id,receipt_hash,provider_tokens','jsonb',0),
  ('public.stride_deletion_inventory_v0(uuid)','request_id','jsonb',0),
  ('public.issue_stride_deletion_job_ticket(uuid)','request_id','text',0),
  ('public.consume_stride_deletion_job_ticket(uuid,text)','request_id,ticket_secret','boolean',0),
  ('public.dispatch_stride_deletion_jobs()','','integer',0),
  ('public.configure_stride_deletion_automation(boolean,text,uuid[])','enabled,gateway_apikey,test_owner_ids','boolean',2),
  ('public.stride_deletion_automation_enabled(uuid)','owner_id','boolean',1),
  ('stride_apple_private.assert_owner(uuid,text,text,boolean)','owner_id,apple_subject,client_id,allow_pending','void',1),
  ('public.stride_apple_grant_captured(uuid,text,text,text)','owner_id,apple_subject,client_id,code_hash','boolean',0),
  ('stride_apple_private.purge_grant_secret()','','trigger',0),
  ('public.store_stride_apple_grant(uuid,text,text,text,jsonb,uuid)','owner_id,apple_subject,client_id,code_hash,token_response,capture_id','boolean',0),
  ('stride_apple_private.lock_deletion_owner()','','trigger',0),
  ('stride_apple_private.adopt(uuid,uuid)','request_id,claim_token','void',0),
  ('stride_apple_private.read_deletion_tokens_before_grants(uuid,uuid)','request_id,claim_token','jsonb',0),
  ('public.read_stride_deletion_provider_tokens(uuid,uuid)','request_id,claim_token','jsonb',0),
  ('stride_apple_private.read_deletion_status_before_grants(uuid)','owner_id','jsonb',0),
  ('public.read_stride_deletion_owned_status(uuid)','owner_id','jsonb',0),
  ('stride_apple_private.deletion_plan_before_grants(uuid)','request_id','jsonb',0),
  ('public.stride_deletion_plan(uuid)','request_id','jsonb',0),
  ('stride_apple_private.purge_revoked()','','trigger',0),
  ('stride_apple_private.purge_completed()','','trigger',0),
  ('public.reserve_stride_apple_capture(uuid,text,text,text)','owner_id,apple_subject,client_id,code_hash','uuid',0),
  ('public.mark_stride_apple_capture_uncertain(uuid)','capture_id','boolean',0),
  ('public.resolve_stride_apple_capture_unavailable(uuid,uuid,text,text)','owner_id,capture_id,acknowledgement,reason','boolean',0),
  ('stride_apple_private.assert_settled(uuid)','owner_id','void',0),
  ('stride_apple_private.assert_revocation_complete(uuid)','owner_id','void',0),
  ('public.ack_stride_apple_capture_token(uuid,uuid,uuid,text,text)','request_id,claim_token,capture_id,token_kind,token_hash','boolean',0),
  ('stride_apple_private.guard_finalization()','','trigger',0),
  ('stride_apple_private.purge_intent_secret()','','trigger',0),
  ('stride_apple_private.attest_before_intents(uuid,text,text,text,uuid)','request_id,provider,disposition,reason,claim_token','boolean',2),
  ('public.attest_stride_deletion_provider(uuid,text,text,text,uuid)','request_id,provider,disposition,reason,claim_token','boolean',2),
  ('public.handle_new_user()','','trigger',0),
  ('public.rls_auto_enable()','','event_trigger',0)
),
functions as (
  select e.*, p.oid, p.prosrc, p.prosecdef, p.proconfig, p.proowner, p.proacl,
    p.pronargdefaults, p.proargdefaults, p.proargnames, p.prorettype, l.lanname
  from expected_functions e left join pg_proc p on p.oid=to_regprocedure(e.signature)
  left join pg_language l on l.oid=p.prolang
),
expected_apple_triggers(relation_name, trigger_name, function_name, trigger_type, update_column) as (values
  ('stride_apple_private.grants','stride_apple_grant_secret_cleanup','stride_apple_private.purge_grant_secret()',11,null::text),
  ('public.stride_account_deletion_requests','stride_apple_deletion_owner_lock','stride_apple_private.lock_deletion_owner()',7,null::text),
  ('stride_deletion_private.request_state','stride_apple_revocation_cleanup','stride_apple_private.purge_revoked()',17,'dispositions'),
  ('public.stride_account_deletion_requests','stride_apple_completion_cleanup','stride_apple_private.purge_completed()',17,'status'),
  ('stride_apple_private.capture_intents','stride_apple_intent_secret_cleanup','stride_apple_private.purge_intent_secret()',11,null),
  ('auth.users','stride_apple_auth_finalization_guard','stride_apple_private.guard_finalization()',11,null),
  ('stride_deletion_private.request_state','stride_apple_provider_finalization_guard','stride_apple_private.guard_finalization()',19,'dispositions'),
  ('public.stride_account_deletion_requests','stride_apple_completion_guard','stride_apple_private.guard_finalization()',19,'status')
),
expected_apple_columns(table_name, column_name, type_name, not_null) as (values
  ('grants','owner_id','uuid',true), ('grants','subject','text',true),
  ('grants','client_id','text',true), ('grants','vault_secret_id','uuid',true),
  ('grants','adopted_request_id','uuid',false), ('grants','captured_at','timestamp with time zone',true),
  ('grants','capture_generation','bigint',true), ('grants','bound_request_id','uuid',false),
  ('captures','owner_id','uuid',true), ('captures','code_hash','text',true),
  ('capture_intents','id','uuid',true), ('capture_intents','owner_id','uuid',true),
  ('capture_intents','subject','text',true), ('capture_intents','client_id','text',true),
  ('capture_intents','code_hash','text',true), ('capture_intents','generation','bigint',true),
  ('capture_intents','state','text',true), ('capture_intents','vault_secret_id','uuid',false),
  ('capture_intents','refresh_revoked_at','timestamp with time zone',false),
  ('capture_intents','access_revoked_at','timestamp with time zone',false),
  ('capture_intents','bound_request_id','uuid',false), ('capture_intents','resolution_reason','text',false),
  ('capture_intents','stopped_attested_at','timestamp with time zone',false)
),
reviewed_apple_auth_fks(relation_name,constraint_name,cleanup_trigger,cleanup_function) as (values
  ('stride_apple_private.grants','grants_owner_id_fkey','stride_apple_grant_secret_cleanup','stride_apple_private.purge_grant_secret()'),
  ('stride_apple_private.capture_intents','capture_intents_owner_id_fkey','stride_apple_intent_secret_cleanup','stride_apple_private.purge_intent_secret()')
),
apple_auth_fences as (
  select e.*, f.oid accepted_fk,
    (select count(*) from pg_constraint c where c.conrelid=to_regclass(e.relation_name)
      and c.contype='f' and c.confrelid=to_regclass('auth.users'))=1
    and f.oid is not null
    and exists(select 1 from pg_trigger t where t.tgrelid=to_regclass(e.relation_name)
      and t.tgname=e.cleanup_trigger and t.tgfoid=to_regprocedure(e.cleanup_function)
      and t.tgenabled='O' and t.tgtype=11 and t.tgqual is null and t.tgnargs=0 and not t.tgisinternal)
    and exists(select 1 from pg_trigger t where t.tgrelid=to_regclass('auth.users')
      and t.tgname='stride_apple_auth_finalization_guard' and t.tgfoid=to_regprocedure('stride_apple_private.guard_finalization()')
      and t.tgenabled='O' and t.tgtype=11 and t.tgqual is null and t.tgnargs=0 and not t.tgisinternal) accepted
  from reviewed_apple_auth_fks e left join pg_constraint f on f.conrelid=to_regclass(e.relation_name)
    and f.conname=e.constraint_name and f.contype='f' and f.confrelid=to_regclass('auth.users')
    and f.conkey=array[(select a.attnum from pg_attribute a where a.attrelid=f.conrelid and a.attname='owner_id' and not a.attisdropped)]::smallint[]
    and f.confkey=array[(select a.attnum from pg_attribute a where a.attrelid=f.confrelid and a.attname='id' and not a.attisdropped)]::smallint[]
    and f.confdeltype='c' and f.confupdtype='a' and f.confmatchtype='s'
    and f.convalidated and not f.condeferrable and not f.condeferred
),
raw_policies as (
  select t.*, p.oid policy_oid, p.polname, p.polcmd::text polcmd, p.polpermissive, p.polroles,
    pg_get_expr(p.polqual,p.polrelid) using_expr,
    pg_get_expr(p.polwithcheck,p.polrelid) check_expr
  from tables t join pg_policy p on p.polrelid=t.oid
),
policies as (
  -- Strict small expression grammar. Unknown equivalent expressions are REVIEW,
  -- never automatically accepted. Removing parentheses is safe here only because
  -- accepted owner/bucket grammars have no mixed AND/OR or extra tokens.
  select p.*,
    replace(regexp_replace(replace(replace(lower(coalesce(using_expr,'')),
      'public.',''),' as uid',''),'[[:space:]()"]','','g'),'selectauth.uid','auth.uid') uq,
    replace(regexp_replace(replace(replace(lower(coalesce(check_expr,'')),
      'public.',''),' as uid',''),'[[:space:]()"]','','g'),'selectauth.uid','auth.uid') cq
  from raw_policies p
),
client_policies as (
  select p.*, r.name role_name,
    uq in (owner_column||'=auth.uid','auth.uid='||owner_column,
      table_name||'.'||owner_column||'=auth.uid','auth.uid='||table_name||'.'||owner_column) owner_using,
    cq in (owner_column||'=auth.uid','auth.uid='||owner_column,
      table_name||'.'||owner_column||'=auth.uid','auth.uid='||table_name||'.'||owner_column) owner_check
  from policies p cross join roles r
  where r.name in ('anon','authenticated') and r.oid is not null
    and exists(select 1 from unnest(p.polroles) pr(role_oid)
      where case when pr.role_oid=0 then true else pg_has_role(r.oid,pr.role_oid,'MEMBER') end)
),
privileges as (
  select t.*, r.name role_name, r.oid role_oid, v.priv,
    coalesce(has_table_privilege(r.oid,t.oid,v.priv),false)
      or case when v.priv in ('SELECT','INSERT','UPDATE','REFERENCES')
        then coalesce(has_any_column_privilege(r.oid,t.oid,v.priv),false) else false end allowed,
    coalesce(has_table_privilege(r.oid,t.oid,v.priv||' WITH GRANT OPTION'),false)
      or case when v.priv in ('SELECT','INSERT','UPDATE','REFERENCES')
        then coalesce(has_any_column_privilege(r.oid,t.oid,v.priv||' WITH GRANT OPTION'),false) else false end grantable
  from tables t cross join roles r
  cross join (values ('SELECT'),('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),('REFERENCES'),('TRIGGER'),('MAINTAIN')) v(priv)
  where v.priv<>'MAINTAIN' or current_setting('server_version_num')::integer>=170000
),
checks(check_id,target,status,observed) as (
  select 'role', name, case when oid is null or (name<>'service_role' and (rolsuper or rolbypassrls))
    then 'FAIL' else 'PASS' end, jsonb_build_object('exists',oid is not null,'superuser',rolsuper,'bypassrls',rolbypassrls)
  from roles
  union all
  select 'table_rls',schema_name||'.'||table_name,
    case when oid is not null and relkind in ('r','p') and (relrowsecurity or kind='archive')
      and not exists(select 1 from roles where name in ('anon','authenticated') and roles.oid=relowner)
      then 'PASS' else 'FAIL' end,
    jsonb_build_object('exists',oid is not null,'rls',relrowsecurity,'relkind',relkind,
      'rls_required',kind<>'archive','expected',case when kind='archive' then 'isolated archived table; schema and ACL gates required' else 'RLS enabled' end)
  from tables
  union all
  select 'table_acl',schema_name||'.'||table_name||':'||role_name||':'||priv,
    case when oid is null or role_oid is null then 'FAIL'
      when kind='private' then case when not allowed then 'PASS' else 'FAIL' end
      when kind='storage' and role_name in ('anon','authenticated') then
        case when grantable then 'FAIL'
          when priv in ('SELECT','INSERT','UPDATE','DELETE') and (role_name='anon' or has_table_privilege(role_oid,oid,priv)) then 'PASS'
          when priv not in ('SELECT','INSERT','UPDATE','DELETE') and not allowed then 'PASS' else 'FAIL' end
      when role_name='anon' then case when not allowed then 'PASS' else 'FAIL' end
      when role_name='authenticated' and kind='receipt' and priv='SELECT' then 'PASS' -- exact columns checked below
      when role_name='authenticated' and kind in ('owner','legacy_owner') then
        case when grantable then 'FAIL'
          when priv in ('SELECT','INSERT','UPDATE','DELETE') and (has_table_privilege(role_oid,oid,priv) or kind='legacy_owner') then 'PASS'
          when priv not in ('SELECT','INSERT','UPDATE','DELETE') and not allowed then 'PASS' else 'FAIL' end
      when role_name='authenticated' then case when not allowed then 'PASS' else 'FAIL' end
      -- No source/app/backend writer uses these legacy metadata tables. Definer
      -- inventory and Auth cascades do not require service-role direct grants.
      when role_name='service_role' and kind='legacy_owner' then case when not allowed and not grantable then 'PASS' else 'FAIL' end
      when role_name='service_role' then case when kind in ('archive','archive_manifest') then
        case when allowed=(priv='SELECT') then 'PASS' else 'FAIL' end
        when priv in ('SELECT','INSERT','UPDATE','DELETE') and not has_table_privilege(role_oid,oid,priv) then 'FAIL' else 'PASS' end
      else 'FAIL' end,
    jsonb_build_object('effective_table_or_column',allowed,'grant_option',grantable,'kind',kind)
  from privileges
  union all
  select 'public_table_column_acl',schema_name||'.'||table_name,
    case when not exists(select 1 from aclexplode(coalesce(relacl,acldefault('r',relowner))) a where a.grantee=0)
      and not exists(select 1 from pg_attribute c cross join lateral aclexplode(c.attacl) a
        where c.attrelid=t.oid and a.grantee=0) then 'PASS' else 'FAIL' end,
    jsonb_build_object('expected','no PUBLIC relation or column grants; Storage uses role grants and RLS')
  from tables t
  union all
  select 'receipt_column_acl',a.attname||':'||r.name||':'||v.priv,
    case when coalesce(has_column_privilege(r.oid,t.oid,a.attnum,v.priv),false)=
      (r.name='authenticated' and v.priv='SELECT' and a.attname in ('id','user_id','requested_at','status','completed_at'))
      and not coalesce(has_column_privilege(r.oid,t.oid,a.attnum,v.priv||' WITH GRANT OPTION'),false)
      then 'PASS' else 'FAIL' end,
    jsonb_build_object('allowed',has_column_privilege(r.oid,t.oid,a.attnum,v.priv))
  from tables t join pg_attribute a on a.attrelid=t.oid and a.attnum>0 and not a.attisdropped
  cross join roles r cross join (values ('SELECT'),('INSERT'),('UPDATE'),('REFERENCES')) v(priv)
  where t.kind='receipt' and r.name in ('anon','authenticated')
  union all
  select 'owner_policy',schema_name||'.'||table_name||':'||polname||':'||role_name,
    case when role_name='anon' and polpermissive then 'FAIL'
      when not polpermissive then case when polname='stride_deletion_freeze' then 'PASS' else 'REVIEW' end
      when (case when polcmd in ('r','d') then owner_using
        when polcmd='a' then coalesce(owner_check,owner_using)
        when polcmd in ('w','*') then owner_using and case when check_expr is null then owner_using else owner_check end
        else false end) then 'PASS' else 'REVIEW' end,
    jsonb_build_object('command',polcmd,'permissive',polpermissive,'using',using_expr,'check',check_expr)
  from client_policies where kind in ('owner','legacy_owner','receipt')
  union all
  select 'owner_policy_coverage',t.schema_name||'.'||t.table_name||':'||v.priv,
    case when exists(select 1 from client_policies p where p.oid=t.oid and p.role_name='authenticated'
      and p.polpermissive and p.polcmd in ('*',v.cmd)) then 'PASS' else 'FAIL' end,
    jsonb_build_object('expected','authenticated permissive owner policy, classified independently')
  from tables t cross join (values ('SELECT','r'),('INSERT','a'),('UPDATE','w'),('DELETE','d')) v(priv,cmd)
  where t.kind in ('owner','legacy_owner','receipt') and (t.kind<>'receipt' or v.priv='SELECT')
    and (t.kind<>'legacy_owner' or exists(select 1 from privileges x where x.oid=t.oid and x.role_name='authenticated' and x.priv=v.priv and x.allowed))
  union all
  select 'deletion_freeze',t.schema_name||'.'||t.table_name,
    case when not exists(select 1 from policies p where p.oid=t.oid and p.polname=case when t.kind='storage'
      then 'stride_deletion_storage_freeze' else 'stride_deletion_freeze' end) then 'FAIL'
      when exists(select 1 from policies p where p.oid=t.oid and not p.polpermissive and p.polcmd='*'
        and p.polroles=array[(select oid from roles where name='authenticated')]
        and p.uq=p.cq and p.uq=case when t.kind='storage' then 'bucket_id<>''movement-videos''::textor' else '' end
          || 'notexistsselect1fromstride_account_deletion_requestswherestride_account_deletion_requests.user_id=auth.uid')
        then 'PASS' else 'REVIEW' end,
    jsonb_build_object('expected','restrictive ALL/authenticated, identical owner-request denial on USING and CHECK')
  from tables t where t.kind in ('owner','legacy_owner','storage')
  union all
  select 'private_rls_no_policies',schema_name||'.'||table_name,
    case when oid is not null and relrowsecurity and not exists(select 1 from policies p where p.oid=t.oid)
      then 'PASS' else 'FAIL' end,
    jsonb_build_object('expected','intentional RLS deny-all; API-role schema/table/column grants must also be absent')
  from tables t where kind='private'
  union all
  select 'operational_client_policy',schema_name||'.'||table_name||':'||polname||':'||role_name,
    case when not polpermissive then 'PASS' else 'FAIL' end,
    jsonb_build_object('expected','no permissive anon/authenticated policies')
  from client_policies where kind in ('service','archive_manifest','private')
  union all
  select 'schema_acl',n.nspname||':'||r.name,
    case when not has_schema_privilege(r.oid,n.oid,'CREATE')
      and (n.nspname='public' or not has_schema_privilege(r.oid,n.oid,'USAGE')) then 'PASS' else 'FAIL' end,
    jsonb_build_object('usage',has_schema_privilege(r.oid,n.oid,'USAGE'),'create',has_schema_privilege(r.oid,n.oid,'CREATE'))
  from pg_namespace n cross join roles r where n.nspname in ('public','stride_deletion_private','stride_apple_private','betdesk_archive_20261031')
    and (r.name in ('anon','authenticated') or (n.nspname in ('stride_deletion_private','stride_apple_private') and r.name='service_role'))
  union all
  select 'vault_client_acl',v.name||':'||r.name,
    case when to_regclass(v.name) is not null
      and not has_table_privilege(r.oid,to_regclass(v.name),'SELECT')
      and not has_any_column_privilege(r.oid,to_regclass(v.name),'SELECT')
      then 'PASS' else 'FAIL' end,
    jsonb_build_object('expected','no API-role readable Vault columns; no Vault rows queried')
  from (values ('vault.secrets'),('vault.decrypted_secrets')) v(name) cross join roles r
  where r.name in ('anon','authenticated')
  union all
  select 'required_schema_usage',v.schema_name||':'||v.role_name,
    case when n.oid is not null and r.oid is not null and has_schema_privilege(r.oid,n.oid,'USAGE')
      then 'PASS' else 'FAIL' end, jsonb_build_object('expected','USAGE for intended operator/client access')
  from (values ('public','authenticated'),('public','service_role'),('storage','authenticated'),
    ('storage','service_role'),('betdesk_archive_20261031','service_role')) v(schema_name,role_name)
  left join pg_namespace n on n.nspname=v.schema_name left join roles r on r.name=v.role_name
  union all
  select 'receipt_shape','public.stride_account_deletion_requests',
    case when (select count(*) from pg_attribute a where a.attrelid=to_regclass('public.stride_account_deletion_requests')
      and a.attnum>0 and not a.attisdropped and a.attname in ('id','user_id','requested_at','status','completed_at',
        'receipt_hash','fulfillment_version','processing_token','processing_expires_at'))=9 then 'PASS' else 'FAIL' end,
    jsonb_build_object('expected','five owner-readable columns plus four hidden internal columns')
  union all
  select 'receipt_hash_unique','public.stride_account_deletion_requests',
    case when exists(select 1 from pg_index i join pg_attribute a on a.attrelid=i.indrelid and a.attname='receipt_hash'
      where i.indrelid=to_regclass('public.stride_account_deletion_requests') and i.indisunique and i.indisvalid
        and i.indnkeyatts=1 and i.indkey[0]=a.attnum and (i.indpred is null or
          regexp_replace(lower(pg_get_expr(i.indpred,i.indrelid)),'[[:space:]()]','','g')='receipt_hashisnotnull'))
      then 'PASS' else 'FAIL' end,
    jsonb_build_object('expected','valid unique nonnull receipt-hash index, no receipt data queried')
  union all
  select 'signup_trigger','auth.users',
    case when (select count(*) from pg_trigger t where t.tgrelid=to_regclass('auth.users') and not t.tgisinternal
      and t.tgfoid=to_regprocedure('public.handle_new_user()') and t.tgenabled in ('O','A')
      and (t.tgtype::integer & 4)=4 and (t.tgtype::integer & 1)=1 and (t.tgtype::integer & 2)=0)=1
      then 'PASS' else 'FAIL' end,
    jsonb_build_object('expected','one enabled AFTER INSERT FOR EACH ROW signup trigger')
  union all
  select 'function_rpc_arguments',f.signature,
    case when f.oid is not null and coalesce(array_to_string(f.proargnames,','),'')=a.names
      and format_type(f.prorettype,null)=a.result_type and f.pronargdefaults=a.default_count
      then 'PASS' else 'FAIL' end,
    jsonb_build_object('expected_names',a.names,'expected_result',a.result_type,'expected_default_count',a.default_count)
  from expected_arguments a join functions f using(signature)
  union all
  select 'signup_trigger_search_path','public.handle_new_user()',
    case when exists(select 1 from functions f cross join lateral unnest(f.proconfig) c
      where f.signature='public.handle_new_user()' and regexp_replace(c,'[[:space:]"]','','g')='search_path=pg_catalog')
      then 'PASS' else 'FAIL' end,
    jsonb_build_object('expected','migration-pinned pg_catalog lookup path')
  union all
  select 'function_contract',signature,
    case when oid is null then 'FAIL' when body_md5 is null then 'REVIEW'
      when md5(prosrc)=body_md5 and prosecdef=definer and lanname in ('sql','plpgsql')
        and exists(select 1 from unnest(proconfig) c where regexp_replace(c,'[[:space:]"]','','g')=
          case when signature in ('public.handle_new_user()','public.rls_auto_enable()')
            then 'search_path=pg_catalog' else 'search_path=' end)
        and not exists(select 1 from roles where name in ('anon','authenticated','service_role') and roles.oid=proowner)
      then 'PASS' else 'FAIL' end,
    jsonb_build_object('exists',oid is not null,'body_md5',md5(prosrc),'expected_body_md5',body_md5,
      'definer',prosecdef,'language',lanname,'argument_names',proargnames,'result',format_type(prorettype,null),
      'search_path_pinned',exists(select 1 from unnest(proconfig) c where c like 'search_path=%'),
      'expected_search_path',case when signature in ('public.handle_new_user()','public.rls_auto_enable()')
        then 'pg_catalog' else '' end)
  from functions
  union all
  select 'function_execute',signature||':'||r.name,
    case when f.oid is not null and r.oid is not null and
      (case when audience='authenticated' and r.name='service_role' then true
        else has_function_privilege(r.oid,f.oid,'EXECUTE')=
          (audience=r.name or (audience='service' and r.name='service_role')) end)
      and not has_function_privilege(r.oid,f.oid,'EXECUTE WITH GRANT OPTION') then 'PASS' else 'FAIL' end,
    jsonb_build_object('effective_execute',has_function_privilege(r.oid,f.oid,'EXECUTE'),'audience',audience)
  from functions f cross join roles r
  union all
  select 'function_public_execute',signature,
    case when oid is not null and not exists(select 1 from aclexplode(coalesce(proacl,acldefault('f',proowner))) a
      where a.grantee=0 and a.privilege_type='EXECUTE') then 'PASS' else 'FAIL' end,
    jsonb_build_object('expected','no PUBLIC EXECUTE, including implicit defaults') from functions
  union all
  select 'unexpected_function',n.nspname||'.'||p.proname||'('||oidvectortypes(p.proargtypes)||')','REVIEW',
    jsonb_build_object('definer',p.prosecdef,'body_md5',md5(p.prosrc),
      'anon_execute',has_function_privilege((select oid from roles where name='anon'),p.oid,'EXECUTE'),
      'authenticated_execute',has_function_privilege((select oid from roles where name='authenticated'),p.oid,'EXECUTE'))
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname in ('public','stride_deletion_private','stride_apple_private','betdesk_archive_20261031') and p.prokind in ('f','p')
    and not exists(select 1 from functions f where f.oid=p.oid)
    and not exists(select 1 from pg_depend d where d.classid='pg_proc'::regclass and d.objid=p.oid and d.deptype='e')
  union all
  select 'extension_definer_api',n.nspname||'.'||p.proname||'('||oidvectortypes(p.proargtypes)||')','REVIEW',
    jsonb_build_object('expected','independent review of extension-owned SECURITY DEFINER API exposure')
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.prosecdef and exists(select 1 from pg_depend d
    where d.classid='pg_proc'::regclass and d.objid=p.oid and d.deptype='e')
    and exists(select 1 from roles r where r.name in ('anon','authenticated') and has_function_privilege(r.oid,p.oid,'EXECUTE'))
  union all
  select 'uninventoried_relation',n.nspname||'.'||c.relname,'REVIEW',jsonb_build_object('kind',c.relkind,'rls',c.relrowsecurity)
  from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','stride_deletion_private','stride_apple_private','betdesk_archive_20261031') and c.relkind in ('r','p','v','m','f')
    and not exists(select 1 from tables t where t.oid=c.oid)
    and not exists(select 1 from pg_depend d where d.classid='pg_class'::regclass and d.objid=c.oid and d.deptype='e')
  union all
  select 'shared_auth_foreign_key',n.nspname||'.'||c.relname||':'||f.conname,'FAIL',
    jsonb_build_object('expected','no external auth.users reference outside supported deletion inventory')
  from pg_constraint f join pg_class c on c.oid=f.conrelid join pg_namespace n on n.oid=c.relnamespace
  where f.contype='f' and f.confrelid=to_regclass('auth.users') and n.nspname not in ('auth','storage')
    and not exists(select 1 from tables t where t.oid=c.oid and t.kind in ('owner','legacy_owner'))
    and not exists(select 1 from apple_auth_fences a where a.accepted_fk=f.oid and a.accepted)
  union all
  select 'apple_auth_fence',relation_name,case when accepted then 'PASS' else 'FAIL' end,
    jsonb_build_object('expected','exactly one reviewed validated nondeferrable owner Auth CASCADE; unconditional zero-argument enabled cleanup and Auth guard')
  from apple_auth_fences
  union all
  select 'owner_auth_cascade',schema_name||'.'||table_name,
    case when exists(select 1 from pg_constraint c join pg_attribute a on a.attrelid=t.oid and a.attname=t.owner_column
      join pg_attribute b on b.attrelid=to_regclass('auth.users') and b.attname='id'
      where c.conrelid=t.oid and c.contype='f' and c.confrelid=to_regclass('auth.users')
        and c.conkey=array[a.attnum] and c.confkey=array[b.attnum] and c.confdeltype='c') then 'PASS' else 'FAIL' end,
    jsonb_build_object('expected','owner column references auth.users.id ON DELETE CASCADE')
  from tables t where kind in ('owner','legacy_owner')
  union all
  select 'apple_private_column',e.table_name||'.'||e.column_name,
    case when a.attnum is not null and format_type(a.atttypid,a.atttypmod)=e.type_name
      and a.attnotnull=e.not_null then 'PASS' else 'FAIL' end,
    jsonb_build_object('expected_type',e.type_name,'expected_not_null',e.not_null)
  from expected_apple_columns e left join pg_attribute a
    on a.attrelid=to_regclass('stride_apple_private.'||e.table_name) and a.attname=e.column_name
      and a.attnum>0 and not a.attisdropped
  union all
  select 'apple_private_column_inventory',t.table_name,
    case when (select count(*) from pg_attribute a where a.attrelid=t.oid and a.attnum>0 and not a.attisdropped)=
      (select count(*) from expected_apple_columns e where e.table_name=t.table_name) then 'PASS' else 'FAIL' end,
    jsonb_build_object('expected','exact source column inventory; no values queried')
  from tables t where t.schema_name='stride_apple_private'
  union all
  select 'apple_cascade',v.child_table||'->'||v.parent_table,
    case when exists(select 1 from pg_constraint c join pg_attribute a
      on a.attrelid=c.conrelid and a.attname=v.child_column
      join pg_attribute b on b.attrelid=c.confrelid and b.attname=v.parent_column
      where c.conrelid=to_regclass(v.child_table) and c.confrelid=to_regclass(v.parent_table)
        and c.contype='f' and c.convalidated and c.confdeltype='c'
        and c.conkey=array[a.attnum] and c.confkey=array[b.attnum]) then 'PASS' else 'FAIL' end,
    jsonb_build_object('expected','validated exact-owner cascade; Auth exceptions require exact FK + cleanup + Auth guard')
  from (values ('stride_apple_private.grants','auth.users','owner_id','id'),
    ('stride_apple_private.captures','stride_apple_private.grants','owner_id','owner_id'),
    ('stride_apple_private.capture_intents','auth.users','owner_id','id'))
    v(child_table,parent_table,child_column,parent_column)
  union all
  select 'apple_intent_default',v.table_name||'.'||v.column_name,
    case when exists(select 1 from pg_attribute a join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
      where a.attrelid=to_regclass('stride_apple_private.'||v.table_name) and a.attname=v.column_name
        and regexp_replace(pg_get_expr(d.adbin,d.adrelid),'[[:space:]]','','g')=v.expression)
      then 'PASS' else 'FAIL' end,jsonb_build_object('expected_expression',v.expression)
  from (values ('capture_intents','id','gen_random_uuid()'),('capture_intents','state','''reserved''::text'),
    ('grants','capture_generation','0')) v(table_name,column_name,expression)
  union all
  select 'apple_intent_state_constraint','stride_apple_private.capture_intents',
    case when exists(select 1 from pg_constraint c where c.conrelid=to_regclass('stride_apple_private.capture_intents')
      and c.conname='capture_intents_state_check' and c.contype='c' and c.convalidated
      and regexp_replace(lower(pg_get_expr(c.conbin,c.conrelid)),'[[:space:]()]','','g')=
        'state=anyarray[''reserved''::text,''uncertain''::text,''completed''::text,''manual_unavailable''::text]')
      then 'PASS' else 'FAIL' end,jsonb_build_object('expected','exact four reviewed durable states; no expiry state')
  union all
  select 'apple_primary_key',v.table_name,
    case when exists(select 1 from pg_constraint c where c.conrelid=to_regclass('stride_apple_private.'||v.table_name)
      and c.contype='p' and c.convalidated and
        (select string_agg(a.attname,',' order by k.ordinality) from unnest(c.conkey) with ordinality k(attnum,ordinality)
          join pg_attribute a on a.attrelid=c.conrelid and a.attnum=k.attnum)=v.columns)
      then 'PASS' else 'FAIL' end, jsonb_build_object('expected_columns',v.columns)
  from (values ('grants','owner_id'),('captures','owner_id,code_hash'),('capture_intents','id')) v(table_name,columns)
  union all
  select 'apple_vault_reference_unique','stride_apple_private.'||v.table_name||'.vault_secret_id',
    case when exists(select 1 from pg_index i join pg_attribute a on a.attrelid=i.indrelid and a.attname='vault_secret_id'
      where i.indrelid=to_regclass('stride_apple_private.'||v.table_name) and i.indisunique and i.indisvalid
        and i.indnkeyatts=1 and i.indkey[0]=a.attnum and i.indpred is null) then 'PASS' else 'FAIL' end,
    jsonb_build_object('expected','one unconditionally unique Vault reference; secret metadata/values never read')
  from (values ('grants'),('capture_intents')) v(table_name)
  union all
  select 'apple_trigger',e.relation_name||':'||e.trigger_name,
    case when exists(select 1 from pg_trigger t
      left join pg_attribute a on a.attrelid=t.tgrelid and a.attname=e.update_column
      where t.tgrelid=to_regclass(e.relation_name) and t.tgname=e.trigger_name
        and t.tgfoid=to_regprocedure(e.function_name) and not t.tgisinternal and t.tgenabled='O'
        and t.tgtype::integer=e.trigger_type and t.tgnargs=0 and t.tgqual is null
        and case when e.update_column is null then coalesce(array_length(t.tgattr,1),0)=0
          else array_length(t.tgattr,1)=1 and t.tgattr[0]=a.attnum end)
      then 'PASS' else 'FAIL' end,
    jsonb_build_object('expected_function',e.function_name,'expected_type',e.trigger_type,'update_column',e.update_column)
  from expected_apple_triggers e
  union all
  select 'apple_trigger_inventory','reviewed eight trigger bindings',
    case when (select count(*) from expected_apple_triggers)=8
      and (select count(*) from pg_trigger t where not t.tgisinternal and
        (t.tgname like 'stride_apple_%' or t.tgfoid in (select to_regprocedure(function_name) from expected_apple_triggers)))=8
      then 'PASS' else 'FAIL' end,
    jsonb_build_object('expected','exactly eight Apple bindings; each definition checked independently')
  union all
  select 'apple_intent_unique',v.columns,
    case when exists(select 1 from pg_constraint c where c.conrelid=to_regclass('stride_apple_private.capture_intents')
      and c.contype='u' and c.convalidated and not c.condeferrable
      and (select string_agg(a.attname,',' order by k.ordinality) from unnest(c.conkey) with ordinality k(attnum,ordinality)
        join pg_attribute a on a.attrelid=c.conrelid and a.attnum=k.attnum)=v.columns)
      then 'PASS' else 'FAIL' end,jsonb_build_object('expected_columns',v.columns)
  from (values ('owner_id,code_hash'),('owner_id,generation')) v(columns)
  union all
  select 'legacy_archive_location',table_name,
    case when oid is not null and to_regclass('public.'||table_name) is null then 'PASS' else 'FAIL' end,
    jsonb_build_object('expected','exists only in betdesk_archive_20261031; no public duplicate')
  from tables where kind='archive'
  union all
  select 'scheduler_prerequisite',name,case when to_regclass(name) is not null then 'PASS' else 'FAIL' end,
    jsonb_build_object('exists',to_regclass(name) is not null)
  from (values ('cron.job'),('stride_deletion_private.control'),('storage.buckets')) v(name)
  union all
  select 'configure_defaults','public.configure_stride_deletion_automation',
    case when pronargdefaults=2 and regexp_replace(lower(pg_get_expr(proargdefaults,0)), '[[:space:]()]','','g')=
      'null::text,array[]::uuid[]' then 'PASS' else 'FAIL' end,
    jsonb_build_object('expected','NULL gateway and empty deny-all owner list; NOT NULL/global owner scope by default')
  from functions where signature='public.configure_stride_deletion_automation(boolean,text,uuid[])'
  union all
  select 'storage_policy',polname||':'||role_name,
    case when not polpermissive then case when polname='stride_deletion_storage_freeze' then 'PASS' else 'REVIEW' end
      when role_name='anon' then 'FAIL'
      when (case when polcmd in ('r','d') then uq when polcmd='a' then cq else uq end) in (
        'bucket_id=''movement-videos''::textandstorage.foldernamename[1]=auth.uid::text',
        'bucket_id=''movement-videos''::textandauth.uid::text=storage.foldernamename[1]')
      and (polcmd in ('r','d','a') or coalesce(nullif(cq,''),uq)=uq) then 'PASS' else 'REVIEW' end,
    jsonb_build_object('command',polcmd,'permissive',polpermissive,'using',using_expr,'check',check_expr)
  from client_policies where kind='storage'
  union all
  select 'storage_policy_coverage',v.cmd,
    case when exists(select 1 from client_policies p where p.kind='storage' and p.role_name='authenticated'
      and p.polpermissive and p.polcmd in ('*',v.cmd)) then 'PASS' else 'FAIL' end,
    jsonb_build_object('expected','SELECT/INSERT/UPDATE/DELETE prefix-scoped policy; upsert needs all first three')
  from (values ('r'),('a'),('w'),('d')) v(cmd)
),
-- Configuration metadata only. Never select gateway_apikey, owner UUIDs,
-- cron commands, customer requests, Storage objects or any Vault contents.
-- Missing prerequisite objects/permissions => SQL error => no acceptance.
control_checks(check_id,status,observed) as (
  select 'dormant_control',case when count(*)=1 and bool_and(singleton and not enabled
    and allowed_owner_ids is not null and cardinality(allowed_owner_ids)=0
    and worker_url='https://pbzgrhnxpbtlkzpreizy.supabase.co/functions/v1/account-deletion-worker')
    then 'PASS' else 'FAIL' end,
    jsonb_build_object('rows',count(*),'disabled',coalesce(bool_and(not enabled),false),
      'empty_nonnull_scope',coalesce(bool_and(allowed_owner_ids is not null and cardinality(allowed_owner_ids)=0),false),
      'fixed_worker_target',coalesce(bool_and(worker_url='https://pbzgrhnxpbtlkzpreizy.supabase.co/functions/v1/account-deletion-worker'),false))
  from stride_deletion_private.control
  union all
  select 'private_movement_bucket',case when count(*)=1 and bool_and(not public) then 'PASS' else 'FAIL' end,
    jsonb_build_object('matching_buckets',count(*),'private',coalesce(bool_and(not public),false))
  from storage.buckets where id='movement-videos'
  union all
  select 'dormant_scheduler',case when count(*) filter(where active)>0 then 'FAIL' else 'PASS' end,
    jsonb_build_object('matching_jobs',count(*),'active_jobs',count(*) filter(where active))
  from cron.job where jobname='stride-account-deletion-worker-v1'
    or command ilike '%dispatch_stride_deletion_jobs%' or command ilike '%account-deletion-worker%'
),
all_checks as (
  select 'catalog'::text phase, check_id, target, status, observed from checks
  union all
  select 'dormant_control', check_id, 'configuration', status, observed from control_checks
),
phase_results as (
  select phase, jsonb_build_object(
    'status',case when count(*) filter(where status='FAIL')>0 then 'FAIL'
      when count(*) filter(where status='REVIEW')>0 then 'REVIEW' else 'PASS' end,
    'pass_count',count(*) filter(where status='PASS'),'fail_count',count(*) filter(where status='FAIL'),
    'review_count',count(*) filter(where status='REVIEW'),
    'checks',jsonb_agg(jsonb_build_object('check_id',check_id,'target',target,'status',status,'observed',observed)
      order by check_id,target)) result from all_checks group by phase
)
select jsonb_build_object('audit','strideos-launch-security-v5','source_head','cbf1932',
  'acceptance_revision','20261102-legacy-maintenance-5',
  'pending_migration','20261102100131_launch_legacy_maintenance_privileges.sql',
  'source_migrations',jsonb_build_object(
    '20261102081943_apple_grant_custody.sql','747d3e324a7856eb113f372c37f3469d359d8a6a6dc02a802c64a27372cbc1b3',
    '20261102083331_launch_owner_policy_hardening.sql','5082af90a0de256fecdd67e062fabd444e78fde9d0ec82ea456bb0b29b039c96',
    '20261102100131_launch_legacy_maintenance_privileges.sql','a55122b148001bd2ed463de8e5c8f6cb3c85abea69b8431886ffce9cc73b915b'),
  'reviewed_source',jsonb_build_object('deletionRuntime.ts','9dc2ee56a854cd167cefc2678ca8a29d3737adffdabb93ea6204a30688b3c76b',
    'deletionFulfillment.ts','19b5319a6c93c8096838f60f13cda549ab37ac6862d227856e014fe937a26131'),
  'server_version_num',current_setting('server_version_num')::integer,
  'maintain_supported',current_setting('server_version_num')::integer>=170000,
  'expected_project_ref','pbzgrhnxpbtlkzpreizy',
  'status',case when exists(select 1 from all_checks where status='FAIL') then 'FAIL'
    when exists(select 1 from all_checks where status='REVIEW') then 'REVIEW' else 'PASS' end,
  'phases',jsonb_object_agg(phase,result)) as launch_security_acceptance from phase_results;
rollback;
