import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { homedir, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

// Actual SQL, disposable synthetic cluster, existing cached engine only. Unix
// socket only: no TCP listener, configured project, DSN, key or customer records.
const cache = join(homedir(), '.npm', '_npx');
const modules = (existsSync(cache) ? readdirSync(cache) : [])
  .map(name => join(cache, name, 'node_modules'))
  .find(root => existsSync(join(root, '@embedded-postgres', 'darwin-x64', 'native', 'bin', 'initdb'))
    && existsSync(join(root, 'pg')));
const require = createRequire(resolve('package.json'));
const migration = readFileSync('supabase/migrations/20261102083331_launch_owner_policy_hardening.sql', 'utf8');
const owner = '71e0ff16-e219-43f2-b87b-e58db4a13001';
const other = '71e0ff16-e219-43f2-b87b-e58db4a13002';

test('policy migration guard failures are atomic and successful UPDATE enforces owner roles and freeze',
  { skip: !modules, timeout: 60_000 }, async t => {
    const root = mkdtempSync(join(tmpdir(), 'stride-security-sql-'));
    const bin = join(modules!, '@embedded-postgres', 'darwin-x64', 'native', 'bin');
    const command = (name: string, args: string[]) => {
      const result = spawnSync(join(bin, name), args, { encoding: 'utf8', timeout: 15_000 });
      assert.equal(result.status, 0, `${name}: ${result.stderr?.slice(0, 400)}`);
    };
    const { Client } = require(join(modules!, 'pg'));
    let db: any; let started = false;
    try {
      command('initdb', ['-D', join(root, 'data'), '-A', 'trust', '-U', 'postgres', '--no-locale', '--encoding=UTF8']);
      command('pg_ctl', ['-D', join(root, 'data'), '-l', join(root, 'server.log'), '-o',
        `-k ${root} -c listen_addresses='' -c fsync=off -c statement_timeout=5000`, '-w', 'start']);
      started = true;
      db = new Client({ host: root, user: 'postgres', database: 'postgres' });
      await db.connect();
      await db.query('create role anon; create role authenticated; create role service_role;');
      const reset = async () => {
        await db.query(`reset role;
          drop schema if exists storage cascade; drop schema if exists auth cascade;
          drop table if exists public.profiles, public.movement_videos, public.analysis_requests,
            public.stride_account_deletion_requests cascade;
          drop event trigger if exists fixture_late_failure;
          drop function if exists public.fixture_late_failure();
          create schema auth; create schema storage;
          grant usage on schema auth,storage to anon,authenticated;
          create function auth.uid() returns uuid language sql stable as $$
            select nullif(current_setting('fixture.uid',true),'')::uuid $$;
          create function storage.foldername(name text) returns text[] language sql immutable as $$
            select (string_to_array($1,'/'))[1:array_length(string_to_array($1,'/'),1)-1] $$;
          create table public.profiles(id uuid primary key);
          create table public.movement_videos(id text primary key,user_id uuid);
          create table public.analysis_requests(id text primary key,user_id uuid);
          create table public.stride_account_deletion_requests(user_id uuid primary key);
          create table storage.objects(id text primary key,bucket_id text,name text,content text);
          alter table public.profiles enable row level security;
          alter table public.movement_videos enable row level security;
          alter table public.analysis_requests enable row level security;
          alter table storage.objects enable row level security;
          grant select,insert,update,delete on public.profiles,public.movement_videos,
            public.analysis_requests to authenticated;
          grant select on public.stride_account_deletion_requests to authenticated;
          grant select,insert,update,delete on storage.objects to anon,authenticated;
          create policy "own profile" on public.profiles using (auth.uid()=id);
          create policy "own videos" on public.movement_videos using (auth.uid()=user_id);
          create policy "own requests" on public.analysis_requests using (auth.uid()=user_id);
          create policy "own video files read" on storage.objects for select
            using (bucket_id='movement-videos' and (storage.foldername(name))[1]=auth.uid()::text);
          create policy "own video files upload" on storage.objects for insert
            with check (bucket_id='movement-videos' and (storage.foldername(name))[1]=auth.uid()::text);
          create policy "own video files delete" on storage.objects for delete
            using (bucket_id='movement-videos' and (storage.foldername(name))[1]=auth.uid()::text);
          create policy stride_deletion_storage_freeze on storage.objects as restrictive
            for all to authenticated
            using (bucket_id<>'movement-videos' or not exists(select 1 from public.stride_account_deletion_requests where user_id=(select auth.uid())))
            with check (bucket_id<>'movement-videos' or not exists(select 1 from public.stride_account_deletion_requests where user_id=(select auth.uid())));
        `);
      };
      const snapshot = async () => (await db.query(`select n.nspname,c.relname,p.polname,p.polcmd,p.polpermissive,
        p.polroles::text,pg_get_expr(p.polqual,p.polrelid) as using_expr,
        pg_get_expr(p.polwithcheck,p.polrelid) as check_expr
        from pg_policy p join pg_class c on c.oid=p.polrelid join pg_namespace n on n.oid=c.relnamespace
        where n.nspname in ('public','storage') order by n.nspname,c.relname,p.polname`)).rows;
      const noPartialChange = async (drift: string, error: RegExp) => {
        await reset();
        await db.query(drift); // Commit fixture drift BEFORE the attempted migration.
        const before = await snapshot();
        // Autocommit, no surrounding rollback to mask partial migration behavior.
        await assert.rejects(db.query(migration), error);
        assert.deepEqual(await snapshot(), before);
      };
      const cases: Array<[string, string]> = [
        ['profile predicate', 'alter policy "own profile" on public.profiles using (true)'],
        ['video role list', 'alter policy "own videos" on public.movement_videos to authenticated'],
        ['request predicate', 'alter policy "own requests" on public.analysis_requests using (false)'],
        ['Storage read predicate', 'alter policy "own video files read" on storage.objects using (true)'],
        ['Storage upload check', 'alter policy "own video files upload" on storage.objects with check (true)'],
        ['Storage delete predicate', 'alter policy "own video files delete" on storage.objects using (true)'],
        ['policy command', 'drop policy "own requests" on public.analysis_requests; create policy "own requests" on public.analysis_requests for select using (auth.uid()=user_id)'],
        ['policy permissiveness', 'drop policy "own profile" on public.profiles; create policy "own profile" on public.profiles as restrictive using (auth.uid()=id)'],
      ];
      for (const [label, drift] of cases) await t.test(`guard rejects ${label} drift without any policy changes`,
        () => noPartialChange(drift, /Policy inventory drift/));
      await t.test('missing freeze cannot partially narrow earlier policy roles', () => noPartialChange(
        'drop policy stride_deletion_storage_freeze on storage.objects', /deletion freeze is missing or changed/));
      await t.test('pre-existing UPDATE cannot partially narrow earlier policy roles', () => noPartialChange(
        'create policy fixture_existing_update on storage.objects for update to authenticated using (true) with check (true)',
        /UPDATE policy inventory changed/));
      await t.test('a late SQL failure after role ALTERs rolls back those ALTERs too', () => noPartialChange(`
        create function public.fixture_late_failure() returns event_trigger language plpgsql as $$begin
          if tg_tag='CREATE POLICY' then raise exception 'synthetic late DDL failure'; end if;
        end $$;
        create event trigger fixture_late_failure on ddl_command_end execute function public.fixture_late_failure();`,
        /synthetic late DDL failure/));
      await t.test('success preserves existing predicates, enforces SELECT/UPDATE CHECK, role scope and deletion freeze', async () => {
        await reset();
        const before = await snapshot();
        await db.query(migration);
        const after = await snapshot();
        const roleOid = (await db.query("select oid from pg_roles where rolname='authenticated'")).rows[0].oid;
        for (const row of before) {
          const changed = after.find((next: any) => next.relname===row.relname && next.polname===row.polname);
          assert.ok(changed);
          if (row.polname==='stride_deletion_storage_freeze') assert.deepEqual(changed,row);
          else assert.deepEqual(changed,{...row,polroles:`{${roleOid}}`});
        }
        const update = after.find((row: any) => row.polname==='own video files update');
        assert.equal(update.polcmd,'w'); assert.equal(update.polroles,`{${roleOid}}`);
        assert.equal(update.using_expr,update.check_expr);
        await db.query(`insert into storage.objects values
          ('mine','movement-videos','${owner}/run.mp4','initial'),
          ('theirs','movement-videos','${other}/run.mp4','initial'),
          ('other-bucket','other-bucket','${owner}/run.mp4','initial');
          select set_config('fixture.uid','${owner}',false); set role authenticated;`);
        assert.deepEqual((await db.query('select id from storage.objects')).rows,[{id:'mine'}]);
        assert.equal((await db.query("update storage.objects set content='updated' where id='mine' returning id")).rowCount,1);
        assert.equal((await db.query("update storage.objects set content='forbidden' where id='theirs' returning id")).rowCount,0);
        assert.equal((await db.query("update storage.objects set content='forbidden' where id='other-bucket' returning id")).rowCount,0);
        await assert.rejects(db.query(`update storage.objects set name='${other}/moved.mp4' where id='mine'`),/row-level security/);
        await assert.rejects(db.query("update storage.objects set bucket_id='other-bucket' where id='mine'"),/row-level security/);
        await db.query('reset role; drop policy "own video files read" on storage.objects; set role authenticated;');
        assert.equal((await db.query("update storage.objects set content='no-select' where id='mine' returning id")).rowCount,0);
        await db.query(`reset role; create policy "own video files read" on storage.objects for select to authenticated
          using (bucket_id='movement-videos' and (storage.foldername(name))[1]=auth.uid()::text);
          set role anon;`);
        assert.equal((await db.query('select id from storage.objects')).rowCount,0);
        assert.equal((await db.query("update storage.objects set content='anon' where id='mine' returning id")).rowCount,0);
        await db.query(`reset role; insert into public.stride_account_deletion_requests values('${owner}'); set role authenticated;`);
        assert.equal((await db.query('select id from storage.objects')).rowCount,0);
        assert.equal((await db.query("update storage.objects set content='frozen' where id='mine' returning id")).rowCount,0);
        assert.equal((await db.query("delete from storage.objects where id='mine' returning id")).rowCount,0);
        await assert.rejects(db.query(`insert into storage.objects values('new','movement-videos','${owner}/new.mp4','frozen')`),/row-level security/);
        await db.query('reset role');
        assert.equal((await db.query("select content from storage.objects where id='mine'")).rows[0].content,'updated');
      });
      await t.test('exact prepared live Storage probe returns one receipt, rolls back all fixtures, and rejects missing UPDATE', async () => {
        await reset();
        await db.query(migration);
        await db.query(`
          alter table storage.objects alter column id type uuid using id::uuid;
          alter table storage.objects add column metadata jsonb;
          create table storage.buckets(id text primary key,name text,public boolean);
          insert into storage.buckets values('movement-videos','movement-videos',false);
          create or replace function auth.uid() returns uuid language sql stable as $$
            select coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),
              nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid $$;
        `);
        const probe = readFileSync('scripts/probes/storage-owner-rollback.sql','utf8');
        const result = await db.query(probe);
        const receipts = result.flatMap((item: any) => item.rows).filter((row: any) => row.receipt);
        assert.equal(receipts.length,1);
        assert.equal(receipts[0].receipt.allAssertionsPassed,true);
        assert.equal(receipts[0].receipt.authUsersCreated,0);
        assert.equal(receipts[0].receipt.authIdentitiesCreated,0);
        assert.equal(receipts[0].receipt.crossPrefixCheckDenied,true);
        assert.equal(receipts[0].receipt.crossBucketCheckDenied,true);
        assert.equal(receipts[0].receipt.restrictiveFreezeSelectUpdateInsert,true);
        const counts = async () => (await db.query(`select
          (select count(*)::int from storage.objects) objects,
          (select count(*)::int from storage.buckets) buckets,
          (select count(*)::int from public.stride_account_deletion_requests) requests,
          current_user as role`)).rows[0];
        assert.deepEqual(await counts(),{objects:0,buckets:1,requests:0,role:'postgres'});
        await db.query('drop policy "own video files update" on storage.objects');
        try { await assert.rejects(db.query(probe),/Owner UPDATE failed/); }
        finally { await db.query('rollback'); }
        assert.deepEqual(await counts(),{objects:0,buckets:1,requests:0,role:'postgres'});
      });
      const maintenance = readFileSync('supabase/migrations/20261102100131_launch_legacy_maintenance_privileges.sql','utf8');
      const rawLegacyAcl = async () => (await db.query(`select c.relname,r.rolname,a.privilege_type,a.is_grantable
        from pg_class c cross join lateral aclexplode(c.relacl) a left join pg_roles r on r.oid=a.grantee
        where c.oid in ('public.movement_videos'::regclass,'public.analysis_requests'::regclass)
          and a.grantee<>c.relowner order by c.relname,r.rolname,a.privilege_type`)).rows;
      const grantMaintenance = async () => db.query(`
        grant maintain on public.movement_videos,public.analysis_requests to anon,authenticated;
        grant maintain,references,trigger,truncate on public.movement_videos,public.analysis_requests to service_role;`);
      await t.test('exact main-reported legacy ACL loses only maintenance; records and policies stay identical; rerun is safe',async () => {
        await reset();
        await db.query('revoke all on public.movement_videos,public.analysis_requests from anon,authenticated,service_role');
        await grantMaintenance();
        const expected = ['analysis_requests','movement_videos'].flatMap(relname =>
          [['anon',['MAINTAIN']],['authenticated',['MAINTAIN']],['service_role',['MAINTAIN','REFERENCES','TRIGGER','TRUNCATE']]]
            .flatMap(([rolname, privileges]) => (privileges as string[]).map(privilege_type => ({relname,rolname,privilege_type,is_grantable:false}))));
        assert.deepEqual(await rawLegacyAcl(),expected); // Actual deployed metadata, no guessed CRUD requirement.
        await db.query(`insert into public.movement_videos values('synthetic-video','${owner}');
          insert into public.analysis_requests values('synthetic-request','${owner}');`);
        const beforePolicies = await snapshot();
        const rows = async () => (await db.query(`select 'video' kind,id,user_id from public.movement_videos
          union all select 'request',id,user_id from public.analysis_requests order by kind`)).rows;
        const beforeRows = await rows();
        await db.query(maintenance);
        assert.deepEqual(await rawLegacyAcl(),[]);
        assert.deepEqual(await snapshot(),beforePolicies);
        assert.deepEqual(await rows(),beforeRows);
        await db.query(maintenance);
        assert.deepEqual(await rawLegacyAcl(),[]);
      });
      await t.test('maintenance cleanup preserves CRUD grants, unrelated roles and PUBLIC SELECT',async () => {
        await reset(); await grantMaintenance();
        await db.query(`grant select on public.movement_videos to service_role;
          grant select on public.analysis_requests to public;`);
        const before = (await rawLegacyAcl()).filter((a:any) => !['MAINTAIN','REFERENCES','TRIGGER','TRUNCATE'].includes(a.privilege_type));
        await db.query(maintenance);
        assert.deepEqual(await rawLegacyAcl(),before);
      });
      await t.test('inherited maintenance surviving direct revocation rolls back ALL direct ACL changes',async () => {
        await reset(); await grantMaintenance();
        await db.query(`create role fixture_legacy_maintenance;
          grant maintain on public.analysis_requests to fixture_legacy_maintenance;
          grant fixture_legacy_maintenance to service_role;`);
        const before = await rawLegacyAcl();
        await assert.rejects(db.query(maintenance),/maintenance access survives direct REVOKE/);
        assert.deepEqual(await rawLegacyAcl(),before);
        await db.query('revoke fixture_legacy_maintenance from service_role');
      });
      for (const [label,change,error] of [
        ['non-RLS second table','alter table public.analysis_requests disable row level security',/owner\/type\/RLS drift/],
        ['grant-option drift on second table','grant maintain on public.analysis_requests to service_role with grant option',/grant-option drift/],
        ['unexpected column REFERENCES','grant references(user_id) on public.analysis_requests to service_role',/column REFERENCES maintenance drift/],
      ] as const) await t.test(`maintenance cleanup rejects ${label} without partial revokes`,async () => {
        await reset(); await grantMaintenance(); await db.query(change);
        const before = await rawLegacyAcl();
        await assert.rejects(db.query(maintenance),error);
        assert.deepEqual(await rawLegacyAcl(),before);
      });
      await t.test('v5 combined catalog accepts approved private intents and rejects real ACL, FK and trigger drift', async auditTest => {
        await reset();
        await db.query(`
          create table auth.users(id uuid primary key,banned_until timestamptz);
          create table auth.identities(user_id uuid references auth.users(id) on delete cascade,provider text,provider_id text);
          create schema stride_deletion_private; create schema cron; create schema vault;
          create table stride_deletion_private.control(singleton boolean,enabled boolean,allowed_owner_ids uuid[],worker_url text);
          insert into stride_deletion_private.control values(true,false,'{}','https://pbzgrhnxpbtlkzpreizy.supabase.co/functions/v1/account-deletion-worker');
          create table storage.buckets(id text primary key,public boolean);
          insert into storage.buckets values('movement-videos',false);
          create table cron.job(jobname text,active boolean,command text);
          drop table public.stride_account_deletion_requests cascade;
          create table public.stride_account_deletion_requests(id uuid primary key,user_id uuid,status text,
            fulfillment_version int,processing_token uuid,processing_expires_at timestamptz);
          create table stride_deletion_private.request_state(request_id uuid,dispositions jsonb,providers text[],reasons jsonb,token_providers text[],failed_providers text[]);
          create table stride_deletion_private.provider_tokens(request_id uuid,provider text,kind text,subject text,vault_secret_id uuid);
          create function public.stride_deletion_plan(request_id uuid) returns jsonb language sql as $$select '{}'::jsonb$$;
        `);
        // Replay exact approved migration against synthetic prerequisites. No app
        // RPC is invoked. The unrelated base schema remains deliberately incomplete.
        const baseline = execFileSync('git',['show',
          'cbf1932:supabase/migrations/20261101054636_deletion_automation_receipts_and_tickets.sql'],{encoding:'utf8'});
        for (const name of ['read_stride_deletion_provider_tokens','read_stride_deletion_owned_status','attest_stride_deletion_provider']) {
          const functions = [...baseline.matchAll(/create(?: or replace)? function public\.(\w+)\([^;]*?\$\$[\s\S]*?\$\$;/gi)];
          const declaration = functions.find(m => m[1]===name)?.[0];
          assert.ok(declaration, name);
          await db.query(declaration);
        }
        await db.query(readFileSync('supabase/migrations/20261102081943_apple_grant_custody.sql','utf8'));
        type Check = {check_id:string;target:string;status:string};
        const readAudit = async () => {
          const results = await db.query(readFileSync('scripts/auditLaunchSecurity.sql','utf8'));
          const documents = results.flatMap((result:any) => result.rows)
            .filter((row:any) => row.launch_security_acceptance).map((row:any) => row.launch_security_acceptance);
          assert.equal(documents.length,1);
          return documents[0];
        };
        const report = await readAudit();
        assert.equal(report.audit,'strideos-launch-security-v5');
        assert.equal(report.acceptance_hold,undefined);
        assert.equal(report.status,'FAIL'); // Missing unrelated base schema must fail.
        assert.equal(report.phases.dormant_control.status,'PASS');
        const checks = report.phases.catalog.checks as Check[];
        assert.ok(!checks.some(row => row.check_id==='apple_revision_review'));
        for(const target of ['grants','captures','capture_intents']) assert.ok(checks.some(row =>
          row.check_id==='private_rls_no_policies' && row.target===`stride_apple_private.${target}` && row.status==='PASS'));
        assert.ok(report.server_version_num>=170000);
        assert.equal(report.maintain_supported,true);
        await db.query('revoke all on public.movement_videos,public.analysis_requests from anon,authenticated,service_role');
        await grantMaintenance();
        const metadataQuery = readFileSync('docs/handoff/LAUNCH_SECURITY_20261102.md','utf8')
          .match(/```sql\n(begin transaction read only;[\s\S]*?as legacy_maintenance_metadata;\nrollback;)\n```/)?.[1];
        assert.ok(metadataQuery,'bounded handoff metadata query');
        const metadataResults = await db.query(metadataQuery);
        const metadata = metadataResults.flatMap((result:any) => result.rows)
          .find((row:any) => row.legacy_maintenance_metadata)?.legacy_maintenance_metadata;
        assert.equal(metadata.relations.length,2);
        assert.equal(metadata.effective.length,24);
        assert.ok(metadata.relations.every((relation:any) => relation.owner==='postgres' && relation.column_references.length===0));
        const failingLegacy = ((await readAudit()).phases.catalog.checks as Check[]).filter(r =>
          r.check_id==='table_acl' && /^public\.(movement_videos|analysis_requests):/.test(r.target) && r.status==='FAIL');
        assert.equal(failingLegacy.length,12); // 8 service +4 anon/auth MAINTAIN. v4 missed 6 MAINTAIN failures.
        for(const relation of ['movement_videos','analysis_requests']) for(const role of ['anon','authenticated','service_role']) {
          assert.ok(failingLegacy.some(r => r.target===`public.${relation}:${role}:MAINTAIN`));
        }
        await db.query(maintenance);
        assert.deepEqual(((await readAudit()).phases.catalog.checks as Check[]).filter(r =>
          r.check_id==='table_acl' && /^public\.(movement_videos|analysis_requests):/.test(r.target) && r.status==='FAIL'),[]);
        const appleChecks = checks.filter(row => row.check_id.startsWith('apple_'));
        assert.ok(appleChecks.length>40);
        assert.deepEqual(appleChecks.filter(row => row.status!=='PASS'),[]);
        for(const row of checks.filter(row => row.check_id==='function_contract' && (
          row.target.startsWith('stride_apple_private.') && !row.target.includes('deletion_plan_before_grants')
          || /public\.(reserve_stride_apple|mark_stride_apple|resolve_stride_apple|ack_stride_apple|store_stride_apple|stride_apple_grant|stride_deletion_plan)/.test(row.target)))) {
          assert.equal(row.status,'PASS',row.target);
        }
        assert.ok(!checks.some(row => row.check_id==='shared_auth_foreign_key' && row.target.startsWith('stride_apple_private.')));
        const drift = async (label:string, change:string, verify:(rows:Check[])=>void) => {
          await auditTest.test(label,async () => {
            // Roll back fixture mutations separately from the audit's own read-only transaction.
            await db.query(change);
            try { verify((await readAudit()).phases.catalog.checks); }
            finally { await db.query('rollback'); }
          });
        };
        // Each mutation is explicitly restored: the audit uses BEGIN/ROLLBACK itself.
        await drift('extra Auth FK on accepted intent table blocks both exact and unknown-FK gates',
          'alter table stride_apple_private.capture_intents add constraint unreviewed_auth_fk foreign key(bound_request_id) references auth.users(id)', rows => {
            assert.ok(rows.some(r => r.check_id==='apple_auth_fence' && r.target==='stride_apple_private.capture_intents' && r.status==='FAIL'));
            assert.ok(rows.some(r => r.check_id==='shared_auth_foreign_key' && r.target.endsWith(':unreviewed_auth_fk') && r.status==='FAIL'));
          });
        await db.query('alter table stride_apple_private.capture_intents drop constraint unreviewed_auth_fk');
        for(const [label,change,restore] of [
          ['disabled intent cleanup','alter table stride_apple_private.capture_intents disable trigger stride_apple_intent_secret_cleanup','alter table stride_apple_private.capture_intents enable trigger stride_apple_intent_secret_cleanup'],
          ['conditional intent cleanup',`drop trigger stride_apple_intent_secret_cleanup on stride_apple_private.capture_intents; create trigger stride_apple_intent_secret_cleanup before delete on stride_apple_private.capture_intents for each row when(false) execute function stride_apple_private.purge_intent_secret()`, 'drop trigger stride_apple_intent_secret_cleanup on stride_apple_private.capture_intents; create trigger stride_apple_intent_secret_cleanup before delete on stride_apple_private.capture_intents for each row execute function stride_apple_private.purge_intent_secret()'],
          ['cleanup with arguments',`drop trigger stride_apple_intent_secret_cleanup on stride_apple_private.capture_intents; create trigger stride_apple_intent_secret_cleanup before delete on stride_apple_private.capture_intents for each row execute function stride_apple_private.purge_intent_secret('unexpected')`, 'drop trigger stride_apple_intent_secret_cleanup on stride_apple_private.capture_intents; create trigger stride_apple_intent_secret_cleanup before delete on stride_apple_private.capture_intents for each row execute function stride_apple_private.purge_intent_secret()'],
          ['missing Auth guard','drop trigger stride_apple_auth_finalization_guard on auth.users','create trigger stride_apple_auth_finalization_guard before delete on auth.users for each row execute function stride_apple_private.guard_finalization()'],
          ['deferrable owner FK','alter table stride_apple_private.capture_intents alter constraint capture_intents_owner_id_fkey deferrable','alter table stride_apple_private.capture_intents alter constraint capture_intents_owner_id_fkey not deferrable'],
        ]) {
          await drift(label,change,rows => assert.ok(rows.some(r => r.check_id==='apple_auth_fence' && r.target==='stride_apple_private.capture_intents' && r.status==='FAIL')));
          await db.query(restore);
        }
        await drift('anonymous RPC EXECUTE cannot hide behind expected service permission',
          'grant execute on function public.ack_stride_apple_capture_token(uuid,uuid,uuid,text,text) to anon', rows =>
            assert.ok(rows.some(r => r.check_id==='function_execute' && r.target==='public.ack_stride_apple_capture_token(uuid,uuid,uuid,text,text):anon' && r.status==='FAIL')));
        await db.query('revoke execute on function public.ack_stride_apple_capture_token(uuid,uuid,uuid,text,text) from anon');
        await drift('private intent table service SELECT violates least privilege',
          'grant select on stride_apple_private.capture_intents to service_role', rows =>
            assert.ok(rows.some(r => r.check_id==='table_acl' && r.target==='stride_apple_private.capture_intents:service_role:SELECT' && r.status==='FAIL')));
        await db.query('revoke select on stride_apple_private.capture_intents from service_role');
        await drift('disabled provider guard fails exact trigger binding',
          'alter table stride_deletion_private.request_state disable trigger stride_apple_provider_finalization_guard', rows =>
            assert.ok(rows.some(r => r.check_id==='apple_trigger' && r.target.endsWith(':stride_apple_provider_finalization_guard') && r.status==='FAIL')));
        await db.query('alter table stride_deletion_private.request_state enable trigger stride_apple_provider_finalization_guard');
        await drift('duplicate Apple Auth guard fails exact trigger inventory',
          'create trigger stride_apple_unreviewed_guard before delete on auth.users for each row execute function stride_apple_private.guard_finalization()', rows =>
            assert.ok(rows.some(r => r.check_id==='apple_trigger_inventory' && r.status==='FAIL')));
        await db.query('drop trigger stride_apple_unreviewed_guard on auth.users');
        await drift('removed per-token ACK column fails schema inventory',
          'alter table stride_apple_private.capture_intents drop column refresh_revoked_at', rows => {
            assert.ok(rows.some(r => r.check_id==='apple_private_column' && r.target==='capture_intents.refresh_revoked_at' && r.status==='FAIL'));
            assert.ok(rows.some(r => r.check_id==='apple_private_column_inventory' && r.target==='capture_intents' && r.status==='FAIL'));
          });
        await db.query('alter table stride_apple_private.capture_intents add column refresh_revoked_at timestamptz');
        await drift('modified function body fails despite matching service ACL and signature',
          "create or replace function public.mark_stride_apple_capture_uncertain(capture_id uuid) returns boolean language plpgsql security definer set search_path='' as $$begin return true; end $$", rows =>
            assert.ok(rows.some(r => r.check_id==='function_contract' && r.target==='public.mark_stride_apple_capture_uncertain(uuid)' && r.status==='FAIL')));
      });
    } finally {
      if (db) await db.end();
      if (started) command('pg_ctl', ['-D',join(root,'data'),'-m','fast','-w','stop']);
      rmSync(root,{ recursive:true, force:true });
    }
  });
