-- DISPOSABLE LOCAL POSTGRES ONLY. Prerequisites: existing deletion migrations,
-- new automation migration, and local Vault/cron/net test doubles. Real pgcrypto
-- is used. Set stride.deletion_probe_disposable and
-- stride.deletion_probe_mock_transport to 'yes' in the test connection.
-- Every fixture, scheduler change, secret and queued HTTP row is rolled back.
begin;
do $$ begin
  if current_setting('stride.deletion_probe_disposable', true) is distinct from 'yes'
    or current_setting('stride.deletion_probe_mock_transport', true) is distinct from 'yes'
    or to_regclass('net.stride_deletion_probe_outbox') is null
    or to_regclass('cron.stride_deletion_probe_marker') is null then
    raise exception 'This probe requires a disposable database with mocked HTTP and cron';
  end if;
end $$;

create function stride_deletion_private.probe_assert(ok boolean, label text)
returns void language plpgsql as $$ begin
  if ok is distinct from true then raise exception 'Probe failed: %', label; end if;
end $$;
create function stride_deletion_private.probe_failure(command text, expected text)
returns void language plpgsql as $$ begin
  begin execute command;
  exception when others then
    if sqlerrm like expected then return; end if;
    raise exception 'Unexpected failure for %: %', expected, sqlerrm;
  end;
  raise exception 'Expected failure did not occur: %', expected;
end $$;

-- Stable test IDs, not existing customers. Refuse collisions even in local DBs.
do $$ begin
  if exists(select 1 from auth.users where id between
    '71e0ff16-e219-43f2-b87b-e58db4a12001'::uuid and '71e0ff16-e219-43f2-b87b-e58db4a12007'::uuid) then
    raise exception 'Probe fixture IDs already exist';
  end if;
end $$;
insert into auth.users(id,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
  select ('71e0ff16-e219-43f2-b87b-e58db4a1200'||n)::uuid,
    'deletion-auto-probe-'||n||'@invalid.example','{}','{}',now(),now() from generate_series(1,7)n;
insert into public.profiles(id)
  select id from auth.users where email like 'deletion-auto-probe-%@invalid.example' on conflict do nothing;
insert into auth.identities(user_id,provider,provider_id,identity_data) values
  ('71e0ff16-e219-43f2-b87b-e58db4a12001','apple','probe-apple-sub','{"sub":"probe-apple-sub"}'),
  ('71e0ff16-e219-43f2-b87b-e58db4a12002','google','probe-google-sub','{"sub":"probe-google-sub"}'),
  ('71e0ff16-e219-43f2-b87b-e58db4a12003','email','probe-email-sub','{"sub":"probe-email-sub"}'),
  ('71e0ff16-e219-43f2-b87b-e58db4a12004','github','probe-unknown-sub','{"sub":"probe-unknown-sub"}'),
  ('71e0ff16-e219-43f2-b87b-e58db4a12005','apple','probe-legacy-sub','{"sub":"probe-legacy-sub"}'),
  ('71e0ff16-e219-43f2-b87b-e58db4a12006','apple','probe-missing-sub','{"sub":"probe-missing-sub"}'),
  ('71e0ff16-e219-43f2-b87b-e58db4a12007','apple','probe-foreign-sub','{"sub":"probe-foreign-sub"}');

-- All privileged RPCs deny ordinary clients; private metadata is not exposed.
do $$ declare signature text; begin
  foreach signature in array array[
    'public.start_stride_deletion(uuid,text,jsonb)', 'public.read_stride_deletion_receipt(uuid,text)',
    'public.read_stride_deletion_owned_status(uuid)',
    'public.attest_stride_deletion_provider(uuid,text,text,text,uuid)',
    'public.store_stride_deletion_provider_token(uuid,text,text,text,uuid)',
    'public.read_stride_deletion_provider_tokens(uuid,uuid)',
    'public.replace_stride_deletion_apple_code(uuid,text,text,text,uuid)',
    'public.refresh_stride_deletion_provider_tokens(uuid,text,jsonb)',
    'public.issue_stride_deletion_job_ticket(uuid)', 'public.consume_stride_deletion_job_ticket(uuid,text)',
    'public.configure_stride_deletion_automation(boolean,text,uuid[])', 'public.dispatch_stride_deletion_jobs()',
    'public.stride_deletion_automation_enabled(uuid)', 'public.stride_deletion_plan(uuid)',
    'public.claim_stride_deletion(uuid)', 'public.renew_stride_deletion(uuid,uuid)', 'public.complete_stride_deletion(uuid,uuid)'
  ] loop
    perform stride_deletion_private.probe_assert(not has_function_privilege('anon',signature,'execute')
      and not has_function_privilege('authenticated',signature,'execute')
      and has_function_privilege('service_role',signature,'execute'), 'RPC service-only: '||signature);
  end loop;
  perform stride_deletion_private.probe_assert(not has_schema_privilege('authenticated','stride_deletion_private','usage'), 'private schema');
  perform stride_deletion_private.probe_assert(not has_column_privilege('authenticated',
    'public.stride_account_deletion_requests','receipt_hash','select'), 'receipt hash is internal');
  perform stride_deletion_private.probe_assert(has_column_privilege('authenticated',
    'public.stride_account_deletion_requests','status','select'), 'owner status remains readable');
  perform stride_deletion_private.probe_assert(not public.stride_deletion_automation_enabled(), 'default disabled');
  perform stride_deletion_private.probe_assert(public.dispatch_stride_deletion_jobs()=0, 'disabled dispatcher is inert');
  perform stride_deletion_private.probe_failure(format('select public.start_stride_deletion(%L,%L)',
    '71e0ff16-e219-43f2-b87b-e58db4a12001', repeat('a',64)), 'Automatic deletion is disabled');
  perform stride_deletion_private.probe_failure('select public.configure_stride_deletion_automation(true,''sb_secret_not_public'')','Public gateway apikey required');
  perform public.configure_stride_deletion_automation(true,'sb_publishable_probe_fixture_only');
  perform stride_deletion_private.probe_assert(not public.stride_deletion_automation_enabled('71e0ff16-e219-43f2-b87b-e58db4a12001'), 'omitted owner list denies all despite enabled=true');
  perform stride_deletion_private.probe_assert(not public.stride_deletion_automation_enabled(), 'missing owner always denied');
  perform stride_deletion_private.probe_failure(format('select public.start_stride_deletion(%L,%L)',
    '71e0ff16-e219-43f2-b87b-e58db4a12001',repeat('a',64)),'Automatic deletion is disabled');
  perform public.configure_stride_deletion_automation(true,'sb_publishable_probe_fixture_only',
    array(select ('71e0ff16-e219-43f2-b87b-e58db4a1200'||n)::uuid from generate_series(1,7)n));
end $$;
set local role service_role;
select public.stride_deletion_automation_enabled('71e0ff16-e219-43f2-b87b-e58db4a12001') as service_rpc_executable;
reset role;

do $$ declare receipt jsonb; apple uuid; google uuid; email uuid; unknown_job uuid; legacy uuid; missing uuid;
  claim_token uuid; apple_claim uuid; google_claim uuid; stale_claim uuid; ticket text; second_ticket text; raw text;
  before_count integer; after_count integer; n integer; action jsonb;
begin
  -- The local test uses SHA-256 over UTF-8 hex text, matching the public contract.
  raw := repeat('a',64);
  receipt := public.start_stride_deletion('71e0ff16-e219-43f2-b87b-e58db4a12001',
    stride_deletion_private.secret_hash(raw), '[{"kind":"apple_authorization_code","secret":"probe-code","subject":"probe-apple-sub"}]');
  apple := (receipt->>'id')::uuid;
  perform stride_deletion_private.probe_assert(public.read_stride_deletion_owned_status(gen_random_uuid()) is null,'missing owned status');
  action := public.read_stride_deletion_owned_status('71e0ff16-e219-43f2-b87b-e58db4a12001');
  perform stride_deletion_private.probe_assert((action->>'provider_credential_refresh_ready')::boolean,'pending unclaimed owner may refresh');
  perform stride_deletion_private.probe_assert(not action ?| array['user_id','receipt_hash','processing_token','token','subject'],'owned GET status contains no secrets');
  perform stride_deletion_private.probe_assert(not receipt ? 'user_id' and not receipt ? 'receipt_hash', 'minimal receipt');
  perform stride_deletion_private.probe_assert(receipt->'provider_actions'->0->>'status'='pending'
    and receipt->'provider_actions'->0->>'reason'='not_prepared', 'strict pending action shape');
  perform stride_deletion_private.probe_assert(public.read_stride_deletion_receipt(apple,repeat('b',64)) is null, 'wrong capability');
  perform stride_deletion_private.probe_assert(public.read_stride_deletion_receipt(gen_random_uuid(),raw) is null, 'unknown receipt');
  perform stride_deletion_private.probe_assert(public.read_stride_deletion_receipt(apple,null) is null, 'missing capability');
  perform stride_deletion_private.probe_assert(public.read_stride_deletion_receipt(apple,raw)=receipt, 'capability readback');
  perform stride_deletion_private.probe_assert(public.read_stride_deletion_receipt(null,raw)=receipt, 'lost start response lookup');
  perform stride_deletion_private.probe_assert(public.read_stride_deletion_receipt(null,repeat('f',64)) is null, 'unknown secret-only lookup');
  perform stride_deletion_private.probe_failure(format('select public.start_stride_deletion(%L,%L)',
    '71e0ff16-e219-43f2-b87b-e58db4a12007',stride_deletion_private.secret_hash(raw)), 'duplicate key value violates unique constraint%');
  perform stride_deletion_private.probe_assert((public.start_stride_deletion('71e0ff16-e219-43f2-b87b-e58db4a12001',
    stride_deletion_private.secret_hash(raw),'[{"kind":"apple_authorization_code","secret":"ignored-retry-code","subject":"probe-foreign-sub"}]')->>'id')::uuid=apple,
    'matching request retries never restage tokens');
  perform stride_deletion_private.probe_failure(format('select public.start_stride_deletion(%L,%L)',
    '71e0ff16-e219-43f2-b87b-e58db4a12001',stride_deletion_private.secret_hash(repeat('b',64))), 'Reuse the original receipt secret');
  -- Initial subject validation failure rolls back the entire request and Vault secret.
  select count(*) into before_count from vault.secrets;
  perform stride_deletion_private.probe_failure(format('select public.start_stride_deletion(%L,%L,%L::jsonb)',
    '71e0ff16-e219-43f2-b87b-e58db4a12007',stride_deletion_private.secret_hash(repeat('f',64)),
    '[{"kind":"apple_authorization_code","secret":"wrong-owner","subject":"probe-apple-sub"}]'), 'Provider subject does not belong to this account');
  perform stride_deletion_private.probe_assert(not exists(select 1 from public.stride_account_deletion_requests
    where user_id='71e0ff16-e219-43f2-b87b-e58db4a12007'), 'failed token staging did not freeze account');
  select count(*) into after_count from vault.secrets;
  perform stride_deletion_private.probe_assert(before_count=after_count, 'no orphan Vault secret on failed start');

  google := (public.start_stride_deletion('71e0ff16-e219-43f2-b87b-e58db4a12002',stride_deletion_private.secret_hash(repeat('b',64)),
    '[{"kind":"google_access_token","secret":"probe-google-token","subject":"probe-google-sub"}]')->>'id')::uuid;
  email := (public.start_stride_deletion('71e0ff16-e219-43f2-b87b-e58db4a12003',stride_deletion_private.secret_hash(repeat('c',64)))->>'id')::uuid;
  unknown_job := (public.start_stride_deletion('71e0ff16-e219-43f2-b87b-e58db4a12004',stride_deletion_private.secret_hash(repeat('d',64)))->>'id')::uuid;
  missing := (public.start_stride_deletion('71e0ff16-e219-43f2-b87b-e58db4a12006',stride_deletion_private.secret_hash(repeat('e',64)))->>'id')::uuid;
  insert into public.stride_account_deletion_requests(user_id) values('71e0ff16-e219-43f2-b87b-e58db4a12005') returning id into legacy;
  perform stride_deletion_private.probe_failure(format('select public.start_stride_deletion(%L,%L)',
    '71e0ff16-e219-43f2-b87b-e58db4a12005',stride_deletion_private.secret_hash(repeat('e',64))), 'Legacy deletion request%');
  perform stride_deletion_private.probe_assert((select fulfillment_version=0 from public.stride_account_deletion_requests where id=legacy),'old requests stay manual');
  perform stride_deletion_private.probe_failure(format('select public.claim_stride_deletion(%L)',legacy),'Provider token revocation%');
  perform stride_deletion_private.probe_failure(format('select public.claim_stride_deletion(%L)',unknown_job),'Unknown identity provider');
  perform stride_deletion_private.probe_assert(public.stride_deletion_plan(email)->'provider_actions'='[]'::jsonb,'email omitted from strict actions');
  create table stride_deletion_private.probe_other_app(user_id uuid references auth.users(id));
  perform stride_deletion_private.probe_failure(format('select public.claim_stride_deletion(%L)',email),'Shared authentication must be separated%');
  drop table stride_deletion_private.probe_other_app;

  -- Tickets: owner binding, raw secret never persisted, replacement, expiry,
  -- replay prevention, and a consumed ticket does not itself claim a lease.
  ticket := public.issue_stride_deletion_job_ticket(apple);
  perform public.configure_stride_deletion_automation(true,'sb_publishable_probe_fixture_only',
    (select array_remove(allowed_owner_ids,'71e0ff16-e219-43f2-b87b-e58db4a12001'::uuid) from stride_deletion_private.control));
  perform stride_deletion_private.probe_assert(not public.stride_deletion_automation_enabled('71e0ff16-e219-43f2-b87b-e58db4a12001'),'excluded owner capability false');
  perform stride_deletion_private.probe_assert(not (public.read_stride_deletion_owned_status('71e0ff16-e219-43f2-b87b-e58db4a12001')->>'provider_credential_refresh_ready')::boolean,'excluded owner not prompted to reauthenticate');
  perform stride_deletion_private.probe_assert(public.read_stride_deletion_receipt(apple,raw)=receipt,'receipt remains available outside processing scope');
  perform stride_deletion_private.probe_failure(format('select public.claim_stride_deletion(%L)',apple),'Automatic deletion is disabled');
  perform stride_deletion_private.probe_failure(format('select public.issue_stride_deletion_job_ticket(%L)',apple),'Automatic deletion is disabled');
  perform stride_deletion_private.probe_assert(not public.consume_stride_deletion_job_ticket(apple,ticket),'excluded owner ticket cannot be consumed');
  perform public.configure_stride_deletion_automation(true,'sb_publishable_probe_fixture_only',
    (select allowed_owner_ids || array['71e0ff16-e219-43f2-b87b-e58db4a12001'::uuid] from stride_deletion_private.control));
  perform stride_deletion_private.probe_assert(ticket ~ '^[0-9a-f]{64}$','256-bit ticket encoding');
  perform stride_deletion_private.probe_assert(not exists(select 1 from stride_deletion_private.job_tickets where secret_hash=ticket),'only ticket hash stored');
  perform stride_deletion_private.probe_assert(not public.consume_stride_deletion_job_ticket(google,ticket),'cross-request ticket denied');
  perform stride_deletion_private.probe_failure(format('select public.issue_stride_deletion_job_ticket(%L)',apple),'Deletion retry is not due');
  update stride_deletion_private.request_state set next_dispatch_at=clock_timestamp()-interval '1 second' where request_id=apple;
  second_ticket := public.issue_stride_deletion_job_ticket(apple);
  perform stride_deletion_private.probe_assert(not public.consume_stride_deletion_job_ticket(apple,ticket),'old issued ticket superseded');
  perform stride_deletion_private.probe_assert(public.consume_stride_deletion_job_ticket(apple,second_ticket),'consume exactly once');
  perform stride_deletion_private.probe_assert(not public.consume_stride_deletion_job_ticket(apple,second_ticket),'ticket replay denied');
  perform stride_deletion_private.probe_assert((select status='pending' from public.stride_account_deletion_requests where id=apple),'ticket is separate from deletion lease');
  perform stride_deletion_private.probe_failure(format('select public.issue_stride_deletion_job_ticket(%L)',apple),'Deletion retry is not due');
  update stride_deletion_private.request_state set next_dispatch_at=clock_timestamp()-interval '1 second' where request_id=apple;
  ticket := public.issue_stride_deletion_job_ticket(apple);
  update stride_deletion_private.job_tickets set expires_at=clock_timestamp()-interval '1 second' where request_id=apple;
  perform stride_deletion_private.probe_assert(not public.consume_stride_deletion_job_ticket(apple,ticket),'expired ticket denied');

  -- Claim permits unresolved KNOWN providers, but token reads/mutations require
  -- that exact unexpired lease; existing isolation guards remain authoritative.
  apple_claim := public.claim_stride_deletion(apple);
  perform stride_deletion_private.probe_assert(not (public.read_stride_deletion_owned_status('71e0ff16-e219-43f2-b87b-e58db4a12001')->>'provider_credential_refresh_ready')::boolean,'active worker prevents reauthentication prompt');
  perform public.configure_stride_deletion_automation(true,'sb_publishable_probe_fixture_only',
    (select array_remove(allowed_owner_ids,'71e0ff16-e219-43f2-b87b-e58db4a12001'::uuid) from stride_deletion_private.control));
  perform stride_deletion_private.probe_assert(not public.renew_stride_deletion(apple,apple_claim),'scope removal fences worker heartbeat');
  perform stride_deletion_private.probe_failure(format('select public.read_stride_deletion_provider_tokens(%L,%L)',apple,apple_claim),'Invalid deletion lease');
  perform public.configure_stride_deletion_automation(true,'sb_publishable_probe_fixture_only',
    (select allowed_owner_ids || array['71e0ff16-e219-43f2-b87b-e58db4a12001'::uuid] from stride_deletion_private.control));
  perform stride_deletion_private.probe_failure(format('select public.claim_stride_deletion(%L)',apple),'Deletion is already being processed');
  perform stride_deletion_private.probe_assert(public.read_stride_deletion_provider_tokens(apple,apple_claim)->0->>'token'='probe-code','initial code durably staged');
  perform stride_deletion_private.probe_failure(format('select public.read_stride_deletion_provider_tokens(%L,%L)',apple,gen_random_uuid()),'Invalid deletion lease');
  perform stride_deletion_private.probe_failure(format('select public.attest_stride_deletion_provider(%L,%L,%L,%L,%L)',
    apple,'apple','manual_required','legacy_token_unavailable',apple_claim),'A known token or failure%');
  perform public.replace_stride_deletion_apple_code(apple,'probe-code','probe-refresh','probe-apple-sub',apple_claim);
  perform public.replace_stride_deletion_apple_code(apple,'probe-code','probe-refresh','probe-apple-sub',apple_claim);
  perform stride_deletion_private.probe_assert(public.read_stride_deletion_provider_tokens(apple,apple_claim)->0->>'kind'='apple_refresh_token','Apple CAS persists refresh before revoke');
  perform stride_deletion_private.probe_failure(format('select public.replace_stride_deletion_apple_code(%L,%L,%L,%L,%L)',
    apple,'wrong-code','different-refresh','probe-apple-sub',apple_claim),'Apple authorization code changed');
  perform public.attest_stride_deletion_provider(apple,'apple','retry_pending','provider_failure',apple_claim);
  perform stride_deletion_private.probe_assert(public.read_stride_deletion_provider_tokens(apple,apple_claim)->0->>'token'='probe-refresh','provider failure keeps recovery token');
  perform stride_deletion_private.probe_failure(format('select public.attest_stride_deletion_provider(%L,%L,%L,%L,%L)',
    apple,'apple','manual_required','legacy_token_unavailable',apple_claim),'A known token or failure%');
  perform stride_deletion_private.probe_failure(format('select public.refresh_stride_deletion_provider_tokens(%L,%L,%L::jsonb)',
    '71e0ff16-e219-43f2-b87b-e58db4a12001',stride_deletion_private.secret_hash(raw),
    '[{"kind":"apple_authorization_code","secret":"fresh-code","subject":"probe-apple-sub"}]'),'Deletion is already being processed');
  update public.stride_account_deletion_requests set processing_expires_at=clock_timestamp()-interval '1 second' where id=apple;
  perform stride_deletion_private.probe_assert((public.read_stride_deletion_owned_status('71e0ff16-e219-43f2-b87b-e58db4a12001')->>'provider_credential_refresh_ready')::boolean,'expired worker allows fresh authorization');
  perform public.refresh_stride_deletion_provider_tokens('71e0ff16-e219-43f2-b87b-e58db4a12001',stride_deletion_private.secret_hash(raw),
    '[{"kind":"apple_authorization_code","secret":"fresh-code","subject":"probe-apple-sub"}]');
  perform stride_deletion_private.probe_assert(not public.renew_stride_deletion(apple,apple_claim),'credential repair invalidates expired worker lease');
  apple_claim := public.claim_stride_deletion(apple);
  perform stride_deletion_private.probe_assert(public.read_stride_deletion_provider_tokens(apple,apple_claim)->0->>'token'='probe-refresh','credential repair cannot downgrade Apple refresh');
  perform public.attest_stride_deletion_provider(apple,'apple','revoked','provider_confirmed',apple_claim);
  perform public.attest_stride_deletion_provider(apple,'apple','retry_pending','provider_failure',apple_claim);
  perform stride_deletion_private.probe_assert(public.read_stride_deletion_provider_tokens(apple,apple_claim)='[]'::jsonb,'revocation erases token');
  action := public.stride_deletion_plan(apple)->'provider_actions'->0;
  perform stride_deletion_private.probe_assert(action->>'status'='revoked' and action->>'reason'='provider_confirmed','strict revoked action shape');

  google_claim := public.claim_stride_deletion(google);
  perform stride_deletion_private.probe_failure(format('select public.attest_stride_deletion_provider(%L,%L,%L,%L,%L)',
    google,'github','revoked','provider_confirmed',google_claim),'Unsupported provider disposition');
  perform public.attest_stride_deletion_provider(google,'google','retry_pending','provider_failure',google_claim);
  update public.stride_account_deletion_requests set processing_expires_at=clock_timestamp()-interval '1 second' where id=google;
  perform stride_deletion_private.probe_failure(format('select public.refresh_stride_deletion_provider_tokens(%L,%L,%L::jsonb)',
    '71e0ff16-e219-43f2-b87b-e58db4a12002',stride_deletion_private.secret_hash(repeat('b',64)),
    '[{"kind":"google_access_token","secret":"foreign-token","subject":"probe-foreign-sub"}]'),'Provider subject does not belong to this account');
  perform public.refresh_stride_deletion_provider_tokens('71e0ff16-e219-43f2-b87b-e58db4a12002',stride_deletion_private.secret_hash(repeat('b',64)),
    '[{"kind":"google_access_token","secret":"fresh-google-token","subject":"probe-google-sub"}]');
  google_claim := public.claim_stride_deletion(google);
  perform stride_deletion_private.probe_assert(public.read_stride_deletion_provider_tokens(google,google_claim)->0->>'token'='fresh-google-token','expired Google token can be repaired');
  perform stride_deletion_private.probe_failure(format('select public.attest_stride_deletion_provider(%L,%L,%L,%L,%L)',
    google,'google','manual_required','legacy_token_unavailable',google_claim),'A known token or failure%');
  perform public.attest_stride_deletion_provider(google,'google','revoked','provider_confirmed',google_claim);
  perform stride_deletion_private.probe_assert(public.read_stride_deletion_provider_tokens(google,google_claim)='[]'::jsonb,'Google token removed after revoke');
  claim_token := public.claim_stride_deletion(missing);
  perform public.attest_stride_deletion_provider(missing,'apple','manual_required','legacy_token_unavailable',claim_token);
  perform stride_deletion_private.probe_assert((public.stride_deletion_plan(missing)->>'providers_ready')::boolean,'documented missing-legacy-token fallback');

  -- Simulate a consumed Apple code whose refresh response never reached Vault.
  -- Only fresh subject-bound authorization can repair it, never a fake fallback.
  legacy := (public.start_stride_deletion('71e0ff16-e219-43f2-b87b-e58db4a12007',
    stride_deletion_private.secret_hash(repeat('f',64)),
    '[{"kind":"apple_authorization_code","secret":"consumed-code","subject":"probe-foreign-sub"}]')->>'id')::uuid;
  claim_token := public.claim_stride_deletion(legacy);
  perform public.attest_stride_deletion_provider(legacy,'apple','retry_pending','credential_refresh_required',claim_token);
  update public.stride_account_deletion_requests set processing_expires_at=clock_timestamp()-interval '1 second' where id=legacy;
  perform public.refresh_stride_deletion_provider_tokens('71e0ff16-e219-43f2-b87b-e58db4a12007',
    stride_deletion_private.secret_hash(repeat('f',64)),
    '[{"kind":"apple_authorization_code","secret":"new-reauth-code","subject":"probe-foreign-sub"}]');
  perform stride_deletion_private.probe_assert(not public.renew_stride_deletion(legacy,claim_token),'Apple repair fences old worker');
  claim_token := public.claim_stride_deletion(legacy);
  perform stride_deletion_private.probe_assert(public.read_stride_deletion_provider_tokens(legacy,claim_token)->0->>'token'='new-reauth-code','fresh Apple code replaces consumed code');
  perform stride_deletion_private.probe_failure(format('select public.attest_stride_deletion_provider(%L,%L,%L,%L,%L)',
    legacy,'apple','manual_required','legacy_token_unavailable',claim_token),'A known token or failure%');
  perform public.replace_stride_deletion_apple_code(legacy,'new-reauth-code','new-refresh','probe-foreign-sub',claim_token);
  perform public.attest_stride_deletion_provider(legacy,'apple','revoked','provider_confirmed',claim_token);
  -- Restore the version-0 id used by the scheduler exclusion assertion below.
  select id into legacy from public.stride_account_deletion_requests where user_id='71e0ff16-e219-43f2-b87b-e58db4a12005';

  -- Reclaim an expired worker. The old lease loses all authority, while the
  -- persisted dispositions still authorize the new worker to resume safely.
  stale_claim := apple_claim;
  update public.stride_account_deletion_requests set processing_expires_at=clock_timestamp()-interval '1 second' where id=apple;
  apple_claim := public.claim_stride_deletion(apple);
  perform stride_deletion_private.probe_assert(apple_claim<>stale_claim,'fresh lease after crashed worker');
  perform stride_deletion_private.probe_assert(not public.renew_stride_deletion(apple,stale_claim),'stale heartbeat denied');
  perform stride_deletion_private.probe_failure(format('select public.read_stride_deletion_provider_tokens(%L,%L)',apple,stale_claim),'Invalid deletion lease');
  perform stride_deletion_private.probe_failure(format('select public.complete_stride_deletion(%L,%L)',apple,apple_claim),'Deletion is not complete');

  -- Scheduler makes bounded fixed-target requests, with no raw receipt or
  -- long-lived credential. Only the local mock outbox is ever called here.
  perform public.configure_stride_deletion_automation(true,'sb_publishable_probe_fixture_only',
    (select array_remove(allowed_owner_ids,'71e0ff16-e219-43f2-b87b-e58db4a12004'::uuid) from stride_deletion_private.control));
  n := public.dispatch_stride_deletion_jobs();
  perform stride_deletion_private.probe_assert(n>0 and n<=10,'bounded scheduler batch');
  perform stride_deletion_private.probe_assert(not exists(select 1 from net.stride_deletion_probe_outbox
    where url<>'https://pbzgrhnxpbtlkzpreizy.supabase.co/functions/v1/account-deletion-worker'
      or not body ? 'requestId' or not body ? 'jobTicket' or body ? 'receiptSecret'),'fixed dispatch envelope');
  perform stride_deletion_private.probe_assert(not exists(select 1 from net.stride_deletion_probe_outbox
    where body->>'requestId'=legacy::text),'scheduler skips manual requests');
  perform stride_deletion_private.probe_assert(not exists(select 1 from net.stride_deletion_probe_outbox
    where body->>'requestId'=unknown_job::text),'scheduler skips excluded owners');
  perform stride_deletion_private.probe_assert(public.dispatch_stride_deletion_jobs()=0,'backoff prevents immediate redispatch');

  -- Metadata-only Storage conflict; never erase someone else's object.
  insert into storage.objects(bucket_id,name,owner_id) values('movement-videos',
    '71e0ff16-e219-43f2-b87b-e58db4a12003/mismatch-probe','71e0ff16-e219-43f2-b87b-e58db4a12007');
  perform stride_deletion_private.probe_failure(format('select public.claim_stride_deletion(%L)',email),'Storage ownership needs review');
  delete from storage.objects where name='71e0ff16-e219-43f2-b87b-e58db4a12003/mismatch-probe';

  -- Simulate the Auth API's committed database cascade on disposable fixtures.
  -- Completion and capability lookup survive loss of both Auth and identities.
  insert into public.stride_coach_usage(day,scope,requests) values(current_date,'71e0ff16-e219-43f2-b87b-e58db4a12001',1),
    (current_date,'71e0ff16-e219-43f2-b87b-e58db4a12007',1);
  delete from auth.users where id='71e0ff16-e219-43f2-b87b-e58db4a12001';
  perform stride_deletion_private.probe_assert(public.stride_deletion_plan(apple)->'identity_providers' ? 'apple','provider evidence survives Auth deletion');
  perform public.complete_stride_deletion(apple,apple_claim);
  receipt := public.read_stride_deletion_receipt(apple,raw);
  perform stride_deletion_private.probe_assert(receipt->>'status'='completed' and receipt->>'completed_at' is not null,'post-Auth capability completion');
  perform stride_deletion_private.probe_assert(not (public.read_stride_deletion_owned_status('71e0ff16-e219-43f2-b87b-e58db4a12001')->>'provider_credential_refresh_ready')::boolean,'completed owner cannot refresh');
  perform stride_deletion_private.probe_assert(public.read_stride_deletion_receipt(null,raw)=receipt,'lost response recovers completion without Auth or request id');
  perform stride_deletion_private.probe_assert(not exists(select 1 from public.stride_coach_usage where scope='71e0ff16-e219-43f2-b87b-e58db4a12001'),'owned operational rows removed');
  perform stride_deletion_private.probe_assert(exists(select 1 from public.stride_coach_usage where scope='71e0ff16-e219-43f2-b87b-e58db4a12007'),'other owner preserved');
  perform stride_deletion_private.probe_assert(not exists(select 1 from stride_deletion_private.job_tickets where request_id=apple),'completed tickets erased');
  perform stride_deletion_private.probe_assert(not exists(select 1 from vault.secrets),'revoked provider Vault secrets erased');
  perform public.configure_stride_deletion_automation(false);
  perform stride_deletion_private.probe_assert(not public.stride_deletion_automation_enabled() and public.dispatch_stride_deletion_jobs()=0,'kill switch');
  perform stride_deletion_private.probe_assert((select allowed_owner_ids='{}'::uuid[] from stride_deletion_private.control),'disable without explicit scope resets to deny-all');
  perform public.configure_stride_deletion_automation(true,'sb_publishable_probe_fixture_only',null);
  perform stride_deletion_private.probe_assert(public.stride_deletion_automation_enabled('71e0ff16-e219-43f2-b87b-e58db4a12004')
    and not public.stride_deletion_automation_enabled(),'explicit NULL list permits nonnull owners only');
  perform public.configure_stride_deletion_automation(false);
end $$;
rollback;
select 'Deletion automation: capability, atomic staging, provider leases/CAS, privacy, ticket replay/expiry, crash recovery, fixed scheduler and completion probes passed; all fixtures rolled back' as result;
