-- HOLD pending independent revised-artifact review. This probe is NOT executed.
-- Matches durable reservation/custody/unknown-outcome fences; no provider proof.
-- PREPARED ONLY. Run the entire batch once through the privileged execute_sql
-- connection AFTER review/application of the inert Apple-grant migration.
-- No inputs, existing owner IDs, real credentials, HTTP, dispatch or schedules.
-- All Auth/identity/Vault row reads below are scoped to IDs generated in this DO.
-- The only data-bearing result is one JSON receipt before the final ROLLBACK.
-- Require the final ROLLBACK to succeed; a receipt alone is not rollback proof.
-- Any assertion/error aborts this transaction. Never salvage it by saving changes.

BEGIN;
SET LOCAL statement_timeout = '20s';
SET LOCAL lock_timeout = '3s';
SET LOCAL idle_in_transaction_session_timeout = '30s';

DO $probe$
DECLARE
  probe_owner uuid := gen_random_uuid();
  probe_cascade_owner uuid := gen_random_uuid();
  probe_subject text := 'synthetic-apple-probe-' || gen_random_uuid()::text;
  cascade_subject text := 'synthetic-apple-probe-' || gen_random_uuid()::text;
  audience text := 'invalid.strideos.apple-grant-rollback';
  code_hash text := encode(sha256(convert_to(gen_random_uuid()::text,'UTF8')),'hex');
  replacement_hash text := encode(sha256(convert_to(gen_random_uuid()::text,'UTF8')),'hex');
  cascade_hash text := encode(sha256(convert_to(gen_random_uuid()::text,'UTF8')),'hex');
  receipt_hash text := encode(sha256(convert_to(gen_random_uuid()::text,'UTF8')),'hex');
  fixture_marker text := gen_random_uuid()::text;
  token_response jsonb;
  replacement_response jsonb;
  cascade_response jsonb;
  capture_id uuid;
  replacement_capture_id uuid;
  late_capture_id uuid;
  late_vault_id uuid;
  cascade_capture_id uuid;
  cascade_older_vault_id uuid;
  late_hash text := encode(sha256(convert_to(gen_random_uuid()::text,'UTF8')),'hex');
  late_response jsonb;
  old_vault_id uuid;
  replacement_vault_id uuid;
  fresh_code_vault_id uuid;
  adopted_vault_id uuid;
  cascade_vault_id uuid;
  probe_request uuid;
  lease_token uuid;
  receipt jsonb;
  plan jsonb;
  provider_tokens jsonb;
  capture_token jsonb;
  cascade_request uuid;
  rejected boolean;
BEGIN
  token_response := jsonb_build_object(
    'refresh_token','synthetic-refresh-'||fixture_marker,
    'access_token','synthetic-access-'||fixture_marker,
    'id_token','synthetic-id-'||fixture_marker,
    'token_type','Bearer','expires_in',3600);
  replacement_response := token_response || jsonb_build_object('refresh_token','synthetic-replacement-'||fixture_marker);
  late_response := token_response || jsonb_build_object('refresh_token','synthetic-late-'||fixture_marker);
  cascade_response := token_response || jsonb_build_object('refresh_token','synthetic-cascade-'||fixture_marker);

  -- Direct SQL does not send signup email or create sessions. Reserved invalid
  -- addresses and generated subjects are fictional; never substitute an owner.
  INSERT INTO auth.users(id,aud,role,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
  VALUES
    (probe_owner,'authenticated','authenticated','apple-grant-probe-'||probe_owner::text||'@example.invalid',now(),
      '{"provider":"apple","providers":["apple"]}'::jsonb,'{"full_name":"Synthetic Grant Probe"}'::jsonb,now(),now()),
    (probe_cascade_owner,'authenticated','authenticated','apple-grant-probe-'||probe_cascade_owner::text||'@example.invalid',now(),
      '{"provider":"apple","providers":["apple"]}'::jsonb,'{"full_name":"Synthetic Cascade Probe"}'::jsonb,now(),now());
  INSERT INTO auth.identities(id,user_id,provider_id,provider,identity_data,created_at,updated_at)
  VALUES
    (gen_random_uuid(),probe_owner,probe_subject,'apple',jsonb_build_object('sub',probe_subject),now(),now()),
    (gen_random_uuid(),probe_cascade_owner,cascade_subject,'apple',jsonb_build_object('sub',cascade_subject),now(),now());

  capture_id := public.reserve_stride_apple_capture(probe_owner,probe_subject,audience,code_hash);
  IF capture_id IS NULL THEN RAISE EXCEPTION 'Probe failed: reservation missing'; END IF;
  IF public.store_stride_apple_grant(probe_owner,probe_subject,audience,code_hash,token_response,capture_id) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Probe failed: custody acknowledgement';
  END IF;
  SELECT g.vault_secret_id INTO STRICT old_vault_id FROM stride_apple_private.grants g WHERE g.owner_id=probe_owner;
  IF (SELECT v.decrypted_secret::jsonb FROM vault.decrypted_secrets v WHERE v.id=old_vault_id) IS DISTINCT FROM token_response THEN
    RAISE EXCEPTION 'Probe failed: full Vault response round trip';
  END IF;
  IF public.stride_apple_grant_captured(probe_owner,probe_subject,audience,code_hash) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Probe failed: captured receipt';
  END IF;
  -- Same owner/hash is a lost-response retry, not a second replacement.
  PERFORM public.store_stride_apple_grant(probe_owner,probe_subject,audience,code_hash,token_response,capture_id);
  IF (SELECT g.vault_secret_id FROM stride_apple_private.grants g WHERE g.owner_id=probe_owner) IS DISTINCT FROM old_vault_id THEN
    RAISE EXCEPTION 'Probe failed: idempotent custody changed';
  END IF;

  -- A forced error AFTER a valid replacement exercises transaction rollback of
  -- new intent, Vault creation, active selection and capture receipt together.
  BEGIN
    replacement_capture_id := public.reserve_stride_apple_capture(probe_owner,probe_subject,audience,replacement_hash);
    PERFORM public.store_stride_apple_grant(probe_owner,probe_subject,audience,replacement_hash,replacement_response,replacement_capture_id);
    SELECT g.vault_secret_id INTO STRICT replacement_vault_id FROM stride_apple_private.grants g WHERE g.owner_id=probe_owner;
    RAISE EXCEPTION USING ERRCODE='ZAG01', MESSAGE='Synthetic replacement rollback';
  EXCEPTION WHEN SQLSTATE 'ZAG01' THEN NULL;
  END;
  IF replacement_vault_id IS NULL OR replacement_vault_id=old_vault_id
    OR EXISTS(SELECT 1 FROM vault.secrets v WHERE v.id=replacement_vault_id)
    OR EXISTS(SELECT 1 FROM stride_apple_private.capture_intents i WHERE i.id=replacement_capture_id)
    OR (SELECT g.vault_secret_id FROM stride_apple_private.grants g WHERE g.owner_id=probe_owner) IS DISTINCT FROM old_vault_id
    OR (SELECT v.decrypted_secret::jsonb FROM vault.decrypted_secrets v WHERE v.id=old_vault_id) IS DISTINCT FROM token_response
    OR public.stride_apple_grant_captured(probe_owner,probe_subject,audience,replacement_hash) IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'Probe failed: replacement rollback did not preserve old custody';
  END IF;

  rejected := false;
  BEGIN
    PERFORM public.store_stride_apple_grant(probe_owner,cascade_subject,audience,replacement_hash,replacement_response,capture_id);
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    IF SQLERRM <> 'Apple custody unavailable' THEN RAISE; END IF;
    rejected := true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'Probe failed: identity mismatch accepted'; END IF;

  late_capture_id := public.reserve_stride_apple_capture(probe_owner,probe_subject,audience,late_hash);
  IF late_capture_id IS NULL OR public.reserve_stride_apple_capture(probe_owner,probe_subject,audience,late_hash) IS NOT NULL THEN
    RAISE EXCEPTION 'Probe failed: duplicate reservation not busy';
  END IF;

  -- This UPDATE is visible only inside this uncommitted transaction and is
  -- restored by ROLLBACK. It authorizes ONLY these generated fixture IDs for
  -- the real lease/attestation guards. Never call configure/dispatch/worker RPCs.
  -- No gateway key, worker URL, cron row or secret value is read or changed.
  UPDATE stride_deletion_private.control c SET enabled=true,allowed_owner_ids=ARRAY[probe_owner,probe_cascade_owner]
    WHERE c.singleton=true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Probe failed: expected deletion control missing'; END IF;
  receipt := public.start_stride_deletion(probe_owner,receipt_hash,
    jsonb_build_array(jsonb_build_object('kind','apple_authorization_code','subject',probe_subject,'secret','synthetic-code-'||fixture_marker)));
  probe_request := (receipt->>'id')::uuid;
  IF probe_request IS NULL THEN RAISE EXCEPTION 'Probe failed: deletion receipt missing'; END IF;
  SELECT t.vault_secret_id INTO STRICT fresh_code_vault_id FROM stride_deletion_private.provider_tokens t
    WHERE t.request_id=probe_request AND t.provider='apple';

  rejected := false;
  BEGIN
    PERFORM public.reserve_stride_apple_capture(probe_owner,probe_subject,audience,replacement_hash);
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    IF SQLERRM <> 'Apple custody unavailable' THEN RAISE; END IF;
    rejected := true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'Probe failed: deletion capture fence'; END IF;
  plan := public.stride_deletion_plan(probe_request);
  IF (plan->'shared_auth_tables') ? 'stride_apple_private.grants' OR (plan->'shared_auth_tables') ? 'stride_apple_private.capture_intents' THEN
    RAISE EXCEPTION 'Probe failed: custody FK falsely blocks deletion inventory';
  END IF;
  -- The actual claim retains every OTHER shared-Auth/storage-ownership fence.
  lease_token := public.claim_stride_deletion(probe_request);
  IF lease_token IS NULL THEN RAISE EXCEPTION 'Probe failed: lease missing'; END IF;
  rejected := false;
  BEGIN
    PERFORM public.read_stride_deletion_provider_tokens(probe_request,gen_random_uuid());
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    IF SQLERRM <> 'Invalid deletion lease' THEN RAISE; END IF;
    rejected := true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'Probe failed: invalid lease accepted'; END IF;
  rejected := false;
  BEGIN
    PERFORM public.read_stride_deletion_provider_tokens(probe_request,lease_token);
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    IF SQLERRM <> 'Apple capture outcome remains pending' THEN RAISE; END IF;
    rejected := true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'Probe failed: unresolved exchange allowed provider preparation'; END IF;
  rejected := false;
  BEGIN
    DELETE FROM auth.users u WHERE u.id=probe_owner;
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    IF SQLERRM <> 'Apple capture outcome remains pending' THEN RAISE; END IF;
    rejected := true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'Probe failed: unresolved exchange allowed Auth removal'; END IF;
  rejected := false;
  BEGIN
    PERFORM public.attest_stride_deletion_provider(probe_request,'apple','manual_required','legacy_token_unavailable',lease_token);
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    IF SQLERRM <> 'Apple capture outcome remains pending' THEN RAISE; END IF;
    rejected := true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'Probe failed: unresolved exchange allowed final disposition'; END IF;
  PERFORM public.mark_stride_apple_capture_uncertain(late_capture_id);
  receipt := public.read_stride_deletion_owned_status(probe_owner);
  IF receipt->>'apple_grant_retained'='true' THEN receipt:=receipt->'request'; END IF;
  IF receipt->'provider_actions'->0->>'reason' IS DISTINCT FROM 'capture_outcome_unknown' THEN
    RAISE EXCEPTION 'Probe failed: unknown outcome not visible';
  END IF;
  -- Simulated late VALID response: custody is retained but login eligibility denied.
  IF public.store_stride_apple_grant(probe_owner,probe_subject,audience,late_hash,late_response,late_capture_id) IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'Probe failed: pending deletion acknowledged login';
  END IF;
  SELECT i.vault_secret_id INTO STRICT late_vault_id FROM stride_apple_private.capture_intents i
    WHERE i.id=late_capture_id AND i.state='completed' AND i.bound_request_id=probe_request;
  PERFORM public.mark_stride_apple_capture_uncertain(late_capture_id);
  IF (SELECT i.state FROM stride_apple_private.capture_intents i WHERE i.id=late_capture_id) IS DISTINCT FROM 'completed' THEN
    RAISE EXCEPTION 'Probe failed: successful late custody downgraded';
  END IF;
  rejected := false;
  BEGIN
    PERFORM public.stride_apple_grant_captured(probe_owner,probe_subject,audience,late_hash);
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    IF SQLERRM <> 'Apple custody unavailable' THEN RAISE; END IF;
    rejected := true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'Probe failed: pending deletion capture retry acknowledged login'; END IF;
  provider_tokens := public.read_stride_deletion_provider_tokens(probe_request,lease_token);
  IF (select count(*) from jsonb_array_elements(provider_tokens) t where t->>'kind' not like 'apple_capture_%')<>1
    OR provider_tokens->0->>'provider' IS DISTINCT FROM 'apple'
    OR provider_tokens->0->>'kind' IS DISTINCT FROM 'apple_refresh_token'
    OR provider_tokens->0->>'subject' IS DISTINCT FROM probe_subject
    OR provider_tokens->0->>'token' IS DISTINCT FROM late_response->>'refresh_token'
    OR EXISTS(SELECT 1 FROM vault.secrets v WHERE v.id=fresh_code_vault_id) THEN
    RAISE EXCEPTION 'Probe failed: retained refresh adoption';
  END IF;
  SELECT t.vault_secret_id INTO STRICT adopted_vault_id FROM stride_deletion_private.provider_tokens t
    WHERE t.request_id=probe_request AND t.provider='apple';

  -- DB ACKs below are SYNTHETIC provider-confirmation fixtures. They exercise
  -- exact leased credential binding, NOT a real Apple HTTP success.
  rejected := false;
  BEGIN
    PERFORM public.attest_stride_deletion_provider(probe_request,'apple','revoked','provider_confirmed',lease_token);
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    IF SQLERRM <> 'Apple capture tokens await revocation' THEN RAISE; END IF;
    rejected := true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'Probe failed: unacknowledged retained token allowed purge'; END IF;
  FOR capture_token IN select value from jsonb_array_elements(provider_tokens) where value->>'kind' like 'apple_capture_%' LOOP
    PERFORM public.ack_stride_apple_capture_token(probe_request,lease_token,(capture_token->>'capture_id')::uuid,
      capture_token->>'kind',encode(sha256(convert_to(capture_token->>'token','UTF8')),'hex'));
  END LOOP;
  -- SYNTHETIC provider attestation tests DB cleanup ONLY. No Apple revocation
  -- occurred; this receipt must never be described as provider acceptance.
  IF public.attest_stride_deletion_provider(probe_request,'apple','revoked','provider_confirmed',lease_token) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Probe failed: synthetic attestation';
  END IF;
  IF EXISTS(SELECT 1 FROM stride_apple_private.grants g WHERE g.owner_id=probe_owner)
    OR EXISTS(SELECT 1 FROM stride_apple_private.captures c WHERE c.owner_id=probe_owner)
    OR EXISTS(SELECT 1 FROM stride_apple_private.capture_intents i WHERE i.owner_id=probe_owner)
    OR EXISTS(SELECT 1 FROM stride_deletion_private.provider_tokens t WHERE t.request_id=probe_request)
    OR EXISTS(SELECT 1 FROM vault.secrets v WHERE v.id=ANY(ARRAY[old_vault_id,replacement_vault_id,fresh_code_vault_id,adopted_vault_id,late_vault_id])) THEN
    RAISE EXCEPTION 'Probe failed: attestation retained a fixture grant reference';
  END IF;

  cascade_capture_id := public.reserve_stride_apple_capture(probe_cascade_owner,cascade_subject,audience,code_hash);
  PERFORM public.store_stride_apple_grant(probe_cascade_owner,cascade_subject,audience,code_hash,token_response,cascade_capture_id);
  SELECT g.vault_secret_id INTO STRICT cascade_older_vault_id FROM stride_apple_private.grants g WHERE g.owner_id=probe_cascade_owner;
  cascade_capture_id := public.reserve_stride_apple_capture(probe_cascade_owner,cascade_subject,audience,cascade_hash);
  PERFORM public.store_stride_apple_grant(probe_cascade_owner,cascade_subject,audience,cascade_hash,cascade_response,cascade_capture_id);
  SELECT g.vault_secret_id INTO STRICT cascade_vault_id FROM stride_apple_private.grants g WHERE g.owner_id=probe_cascade_owner;
  receipt := public.start_stride_deletion(probe_cascade_owner,
    encode(sha256(convert_to(gen_random_uuid()::text,'UTF8')),'hex'),'[]'::jsonb);
  cascade_request := (receipt->>'id')::uuid;
  lease_token := public.claim_stride_deletion(cascade_request);
  provider_tokens := public.read_stride_deletion_provider_tokens(cascade_request,lease_token);
  FOR capture_token IN select value from jsonb_array_elements(provider_tokens) where value->>'kind' like 'apple_capture_%' LOOP
    PERFORM public.ack_stride_apple_capture_token(cascade_request,lease_token,(capture_token->>'capture_id')::uuid,
      capture_token->>'kind',encode(sha256(convert_to(capture_token->>'token','UTF8')),'hex'));
  END LOOP;
  DELETE FROM auth.users u WHERE u.id=probe_cascade_owner;
  IF EXISTS(SELECT 1 FROM auth.users u WHERE u.id=probe_cascade_owner)
    OR EXISTS(SELECT 1 FROM auth.identities i WHERE i.user_id=probe_cascade_owner)
    OR EXISTS(SELECT 1 FROM stride_apple_private.grants g WHERE g.owner_id=probe_cascade_owner)
    OR EXISTS(SELECT 1 FROM stride_apple_private.captures c WHERE c.owner_id=probe_cascade_owner)
    OR EXISTS(SELECT 1 FROM stride_apple_private.capture_intents i WHERE i.owner_id=probe_cascade_owner)
    OR EXISTS(SELECT 1 FROM vault.secrets v WHERE v.id=ANY(ARRAY[cascade_vault_id,cascade_older_vault_id])) THEN
    RAISE EXCEPTION 'Probe failed: Auth cascade retained fixture grant data';
  END IF;

  -- Clear the separately retained job credential after proving Auth-cascade
  -- cleanup of the completed capture responses; still synthetic, no Apple call.
  PERFORM public.attest_stride_deletion_provider(cascade_request,'apple','revoked','provider_confirmed',lease_token);
  IF EXISTS(select 1 from stride_deletion_private.provider_tokens t where t.request_id=cascade_request) THEN
    RAISE EXCEPTION 'Probe failed: fixture job credential retained';
  END IF;

  PERFORM set_config('strideos.apple_grant_probe_receipt',jsonb_build_object(
    'probe','apple_grant_rollback','allAssertionsPassed',true,'generatedSyntheticOwners',2,
    'fullTokenResponseRoundTrip',true,'idempotentCapturedReceipt',true,'failedReplacementPreservedOldGrant',true,
    'identityMismatchRejected',true,'deletionCaptureFence',true,'invalidLeaseRejected',true,
    'unresolvedFinalizationBlocked',true,'unknownOutcomeVisible',true,'lateCustodyWithoutLoginACK',true,
    'retainedRefreshAdopted',true,'everyRetainedCredentialRequiresACK',true,'syntheticTokenACKsOnly',true,'syntheticAttestationPurgedAllRefs',true,'authCascadePurgedVault',true,
    'grantFKNotReportedUnsafe',true,'rollbackOnly',true,'requiresFinalRollbackSuccess',true,
    'liveProviderExchangeVerified',false,'liveProviderRevocationVerified',false)::text,true);
END
$probe$;

SELECT current_setting('strideos.apple_grant_probe_receipt',true)::jsonb AS receipt;
ROLLBACK;
