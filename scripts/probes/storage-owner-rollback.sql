-- PREPARED for main's reviewed live execute_sql run, StrideOS only.
-- Run the ENTIRE batch. No DDL, email, Auth sessions/users/identities, credentials,
-- file bytes, application RPCs, control activation, cron or HTTP calls.
-- DML is limited to generated Storage metadata/bucket and a generated-owner
-- deletion-request fixture. Never replace generated IDs with existing owners.
-- A final receipt is conditional on the final ROLLBACK succeeding. Any error
-- aborts the transaction; discard it rather than committing/salvaging fixtures.
BEGIN;
SET LOCAL statement_timeout = '20s';
SET LOCAL lock_timeout = '2s';
SET LOCAL idle_in_transaction_session_timeout = '30s';
SET LOCAL row_security = on;

DO $probe$
DECLARE
  operator_role text := current_user;
  fixture_owner uuid := gen_random_uuid();
  fixture_foreign_owner uuid := gen_random_uuid();
  own_object uuid := gen_random_uuid();
  foreign_object uuid := gen_random_uuid();
  inserted_object uuid := gen_random_uuid();
  blocked_object uuid := gen_random_uuid();
  fixture_marker text := 'storage-owner-probe-' || gen_random_uuid()::text;
  fixture_bucket text := 'storage-owner-probe-' || gen_random_uuid()::text;
  own_path text;
  foreign_path text;
  inserted_path text;
  affected integer;
  visible integer;
  denied boolean;
BEGIN
  own_path := fixture_owner::text || '/' || fixture_marker || '/owner.data';
  foreign_path := fixture_foreign_owner::text || '/' || fixture_marker || '/foreign.data';
  inserted_path := fixture_owner::text || '/' || fixture_marker || '/inserted.data';
  IF fixture_owner=fixture_foreign_owner THEN RAISE EXCEPTION 'Fixture ID collision'; END IF;
  IF NOT EXISTS(SELECT 1 FROM storage.buckets WHERE id='movement-videos' AND NOT public) THEN
    RAISE EXCEPTION 'Probe requires the existing private movement-videos bucket';
  END IF;
  IF EXISTS(SELECT 1 FROM pg_catalog.pg_roles
    WHERE rolname IN ('authenticated','anon') AND (rolsuper OR rolbypassrls))
    OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_class
      WHERE oid='storage.objects'::regclass AND relrowsecurity
        AND relowner NOT IN ('authenticated'::regrole::oid,'anon'::regrole::oid)) THEN
    RAISE EXCEPTION 'Probe role/table RLS prerequisites are unsafe';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_policy
    WHERE polrelid='storage.objects'::regclass AND polname='stride_deletion_storage_freeze'
      AND NOT polpermissive AND polcmd='*' AND polroles=ARRAY['authenticated'::regrole::oid]
      AND polqual IS NOT NULL AND polwithcheck IS NOT NULL) THEN
    RAISE EXCEPTION 'Probe requires the restrictive authenticated Storage freeze';
  END IF;
  -- A valid destination bucket isolates WITH CHECK from a missing-bucket FK.
  INSERT INTO storage.buckets(id,name,public) VALUES(fixture_bucket,fixture_bucket,false);
  -- Omit owner/owner_id deliberately: the deployed policy is JWT + first-folder
  -- ownership. Nullable owner metadata needs no Auth fixture or identity.
  INSERT INTO storage.objects(id,bucket_id,name,metadata) VALUES
    (own_object,'movement-videos',own_path,jsonb_build_object('probe',fixture_marker,'version',1)),
    (foreign_object,'movement-videos',foreign_path,jsonb_build_object('probe',fixture_marker,'version',1));

  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',fixture_owner::text,'role','authenticated')::text,true);
  PERFORM set_config('request.jwt.claim.sub',fixture_owner::text,true);
  PERFORM set_config('request.jwt.claim.role','authenticated',true);
  SET LOCAL ROLE authenticated;
  IF current_user<>'authenticated' OR auth.uid() IS DISTINCT FROM fixture_owner THEN
    RAISE EXCEPTION 'Authenticated role/JWT fixture is not active';
  END IF;
  IF NOT has_table_privilege(current_user,'storage.objects','SELECT')
    OR NOT has_table_privilege(current_user,'storage.objects','INSERT')
    OR NOT has_table_privilege(current_user,'storage.objects','UPDATE') THEN
    RAISE EXCEPTION 'Probe needs table-level grants to distinguish CHECK rejection from column-permission denial';
  END IF;
  SELECT count(*) INTO visible FROM storage.objects
    WHERE id=own_object AND bucket_id='movement-videos' AND name=own_path;
  IF visible<>1 THEN RAISE EXCEPTION 'Owner SELECT failed'; END IF;
  UPDATE storage.objects SET metadata=jsonb_build_object('probe',fixture_marker,'version',2)
    WHERE id=own_object AND bucket_id='movement-videos' AND name=own_path;
  GET DIAGNOSTICS affected=ROW_COUNT;
  IF affected<>1 THEN RAISE EXCEPTION 'Owner UPDATE failed'; END IF;
  SELECT count(*) INTO visible FROM storage.objects WHERE id=own_object AND metadata->>'version'='2';
  IF visible<>1 THEN RAISE EXCEPTION 'Owner UPDATE readback failed'; END IF;
  INSERT INTO storage.objects(id,bucket_id,name,metadata) VALUES
    (inserted_object,'movement-videos',inserted_path,jsonb_build_object('probe',fixture_marker));
  GET DIAGNOSTICS affected=ROW_COUNT;
  IF affected<>1 THEN RAISE EXCEPTION 'Owner INSERT failed'; END IF;

  SELECT count(*) INTO visible FROM storage.objects WHERE id=foreign_object;
  IF visible<>0 THEN RAISE EXCEPTION 'Foreign-owner SELECT succeeded'; END IF;
  UPDATE storage.objects SET metadata=jsonb_build_object('probe',fixture_marker,'unexpected',true)
    WHERE id=foreign_object;
  GET DIAGNOSTICS affected=ROW_COUNT;
  IF affected<>0 THEN RAISE EXCEPTION 'Foreign-owner UPDATE succeeded'; END IF;
  denied := false;
  BEGIN
    UPDATE storage.objects SET name=fixture_foreign_owner::text || '/' || fixture_marker || '/moved.data'
      WHERE id=own_object;
  EXCEPTION WHEN insufficient_privilege THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Cross-prefix UPDATE CHECK was not enforced'; END IF;
  denied := false;
  BEGIN
    UPDATE storage.objects SET bucket_id=fixture_bucket WHERE id=own_object;
  EXCEPTION WHEN insufficient_privilege THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Cross-bucket UPDATE CHECK was not enforced'; END IF;

  -- Switch only the generated subject, leaving authenticated role in force.
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',fixture_foreign_owner::text,'role','authenticated')::text,true);
  PERFORM set_config('request.jwt.claim.sub',fixture_foreign_owner::text,true);
  IF auth.uid() IS DISTINCT FROM fixture_foreign_owner THEN RAISE EXCEPTION 'Foreign JWT fixture is not active'; END IF;
  SELECT count(*) INTO visible FROM storage.objects WHERE id=foreign_object;
  IF visible<>1 THEN RAISE EXCEPTION 'Foreign fixture cannot read its own object'; END IF;
  SELECT count(*) INTO visible FROM storage.objects WHERE id=own_object;
  IF visible<>0 THEN RAISE EXCEPTION 'Second owner read first owner object'; END IF;
  UPDATE storage.objects SET metadata=jsonb_build_object('probe',fixture_marker,'unexpected',true) WHERE id=own_object;
  GET DIAGNOSTICS affected=ROW_COUNT;
  IF affected<>0 THEN RAISE EXCEPTION 'Second owner updated first owner object'; END IF;

  -- Genuine anon claims have no subject. Either table privilege rejection or
  -- RLS zero-row filtering is denial; neither path may expose/update a fixture.
  PERFORM set_config('request.jwt.claims','{"role":"anon"}',true);
  PERFORM set_config('request.jwt.claim.sub','',true);
  PERFORM set_config('request.jwt.claim.role','anon',true);
  SET LOCAL ROLE anon;
  IF current_user<>'anon' OR auth.uid() IS NOT NULL THEN RAISE EXCEPTION 'Anonymous fixture is not active'; END IF;
  BEGIN
    SELECT count(*) INTO visible FROM storage.objects WHERE id=ANY(ARRAY[own_object,foreign_object,inserted_object]);
    IF visible<>0 THEN RAISE EXCEPTION 'Anonymous SELECT exposed fixture'; END IF;
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    UPDATE storage.objects SET metadata=jsonb_build_object('probe',fixture_marker,'unexpected',true)
      WHERE id=ANY(ARRAY[own_object,foreign_object,inserted_object]);
    GET DIAGNOSTICS affected=ROW_COUNT;
    IF affected<>0 THEN RAISE EXCEPTION 'Anonymous UPDATE changed fixture'; END IF;
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  denied := false;
  BEGIN
    INSERT INTO storage.objects(id,bucket_id,name,metadata) VALUES
      (blocked_object,'movement-videos',fixture_owner::text || '/' || fixture_marker || '/anonymous.data','{}');
  EXCEPTION WHEN insufficient_privilege THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Anonymous INSERT succeeded'; END IF;

  -- Add only this generated owner's freeze marker as the original operator.
  -- No deletion RPC, lease, scope/enablement switch or scheduler is invoked.
  PERFORM set_config('role',operator_role,true);
  INSERT INTO public.stride_account_deletion_requests(user_id) VALUES(fixture_owner);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',fixture_owner::text,'role','authenticated')::text,true);
  PERFORM set_config('request.jwt.claim.sub',fixture_owner::text,true);
  PERFORM set_config('request.jwt.claim.role','authenticated',true);
  SET LOCAL ROLE authenticated;
  IF current_user<>'authenticated' OR auth.uid() IS DISTINCT FROM fixture_owner THEN
    RAISE EXCEPTION 'Frozen-owner role/JWT fixture is not active';
  END IF;
  SELECT count(*) INTO visible FROM storage.objects WHERE id=ANY(ARRAY[own_object,inserted_object]);
  IF visible<>0 THEN RAISE EXCEPTION 'Deletion freeze allowed SELECT'; END IF;
  UPDATE storage.objects SET metadata=jsonb_build_object('probe',fixture_marker,'unexpected',true)
    WHERE id=ANY(ARRAY[own_object,inserted_object]);
  GET DIAGNOSTICS affected=ROW_COUNT;
  IF affected<>0 THEN RAISE EXCEPTION 'Deletion freeze allowed UPDATE'; END IF;
  denied := false;
  BEGIN
    INSERT INTO storage.objects(id,bucket_id,name,metadata) VALUES
      (blocked_object,'movement-videos',fixture_owner::text || '/' || fixture_marker || '/frozen.data','{}');
  EXCEPTION WHEN insufficient_privilege THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Deletion freeze allowed INSERT'; END IF;

  PERFORM set_config('role',operator_role,true);
  -- Final privileged readback remains bounded to generated object IDs and paths.
  IF (SELECT count(*) FROM storage.objects WHERE id=ANY(ARRAY[own_object,foreign_object,inserted_object]))<>3
    OR NOT EXISTS(SELECT 1 FROM storage.objects WHERE id=own_object AND bucket_id='movement-videos'
      AND name=own_path AND metadata=jsonb_build_object('probe',fixture_marker,'version',2))
    OR NOT EXISTS(SELECT 1 FROM storage.objects WHERE id=foreign_object AND bucket_id='movement-videos'
      AND name=foreign_path AND metadata=jsonb_build_object('probe',fixture_marker,'version',1))
    OR EXISTS(SELECT 1 FROM storage.objects WHERE id=blocked_object) THEN
    RAISE EXCEPTION 'Denied operations changed fixture state';
  END IF;
  PERFORM set_config('strideos.storage_owner_probe_receipt',jsonb_build_object(
    'probe','storage_owner_rollback','allAssertionsPassed',true,'syntheticObjectRows',3,
    'ownerSelectUpdateInsert',true,'foreignOwnerDenied',true,'crossPrefixCheckDenied',true,
    'crossBucketCheckDenied',true,'anonymousDenied',true,'restrictiveFreezeSelectUpdateInsert',true,
    'deniedOperationsPreservedRows',true,'authUsersCreated',0,'authIdentitiesCreated',0,
    'rollbackOnly',true,'requiresFinalRollbackSuccess',true,'httpJwtVerificationTested',false,
    'fileBytesTested',false,'deleteTested',false)::text,true);
END;
$probe$;

SELECT current_setting('strideos.storage_owner_probe_receipt',true)::jsonb AS receipt;
ROLLBACK;
