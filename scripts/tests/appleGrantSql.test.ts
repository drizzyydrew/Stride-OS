import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import test from 'node:test';

// Reuse an already cached local test engine. Never download software, connect to
// a configured project, read a DSN, or listen on TCP. Vault below is a SQL fixture,
// not evidence that this standalone PostgreSQL encrypts like Supabase Vault.
const cache=join(homedir(),'.npm','_npx');
const roots=existsSync(cache)?readdirSync(cache).map(name=>join(cache,name,'node_modules')):[];
const modules=roots.find(root=>existsSync(join(root,'@embedded-postgres','darwin-x64','native','bin','initdb'))&&existsSync(join(root,'pg')));
const require=createRequire(resolve('package.json'));
const baseline=readFileSync('supabase/migrations/20261101054636_deletion_automation_receipts_and_tickets.sql','utf8');
function originalFunction(name:string,schema='public') {
  const start=baseline.indexOf(`create function ${schema}.${name}(`);
  assert.ok(start>=0); const end=baseline.indexOf('end $$;',start); assert.ok(end>start);
  return baseline.slice(start,end+7);
}
test('real PostgreSQL executes custody migration, transactional replacement, deletion adoption, permissions and both lock orderings', {skip:!modules,timeout:60_000}, async t=>{
  const root=mkdtempSync(join(tmpdir(),'stride-apple-sql-'));
  const bin=join(modules!,'@embedded-postgres','darwin-x64','native','bin');
  const command=(name:string,args:string[])=>{
    const r=spawnSync(join(bin,name),args,{encoding:'utf8',timeout:15_000});
    assert.equal(r.status,0,`${name} failed: ${r.stderr?.slice(0,500)}`);
  };
  const {Client}=require(join(modules!,'pg'));
  let db:any,other:any,started=false;
  try {
    command('initdb',['-D',join(root,'data'),'-A','trust','-U','postgres','--no-locale','--encoding=UTF8']);
    command('pg_ctl',['-D',join(root,'data'),'-l',join(root,'server.log'),'-o',`-k ${root} -c listen_addresses='' -c fsync=off -c statement_timeout=5000`,'-w','start']); started=true;
    db=new Client({host:root,user:'postgres',database:'postgres'}); other=new Client({host:root,user:'postgres',database:'postgres'});
    await db.connect(); await other.connect();
    await db.query(`
      create role anon; create role authenticated; create role service_role;
      create schema auth; create schema vault; create schema stride_deletion_private;
      create table auth.users(id uuid primary key,banned_until timestamptz);
      create table auth.identities(user_id uuid references auth.users on delete cascade,provider text,provider_id text);
      create table vault.secrets(id uuid primary key default gen_random_uuid(),secret text);
      create view vault.decrypted_secrets as select id,secret as decrypted_secret from vault.secrets;
      create function vault.create_secret(secret text) returns uuid language sql as $$ insert into vault.secrets(secret) values($1) returning id $$;
      create table public.stride_account_deletion_requests(id uuid primary key default gen_random_uuid(),user_id uuid unique,
        status text default 'pending',requested_at timestamptz default now(),completed_at timestamptz,fulfillment_version int default 1,
        processing_token uuid,processing_expires_at timestamptz);
      create table stride_deletion_private.request_state(request_id uuid primary key,providers text[] default array['apple'],
        dispositions jsonb default '{}',reasons jsonb default '{}',token_providers text[] default '{}',failed_providers text[] default '{}');
      create table stride_deletion_private.provider_tokens(request_id uuid,provider text,kind text,subject text,vault_secret_id uuid,
        primary key(request_id,provider));
      create function stride_deletion_private.assert_lease(request_id uuid,claim_token uuid) returns void language plpgsql as $$ begin
        perform 1 from public.stride_account_deletion_requests r where r.id=$1 and r.processing_token=$2
          and r.processing_expires_at>now() and r.status='processing' for update;
        if not found then raise exception 'Invalid lease'; end if; end $$;
      create function stride_deletion_private.enabled_for_user(owner_id uuid) returns boolean language sql as $$select true$$;
      create function stride_deletion_private.provider_actions(request_id uuid) returns jsonb language sql as $$select '[]'::jsonb$$;
      create function public.stride_deletion_plan(request_id uuid) returns jsonb language sql as $$
        select jsonb_build_object('shared_auth_tables',coalesce(jsonb_agg(c.conrelid::regclass::text),'[]'::jsonb))
        from pg_constraint c join pg_class t on t.oid=c.conrelid join pg_namespace n on n.oid=t.relnamespace
        where c.confrelid='auth.users'::regclass and n.nspname<>'auth' $$;
    `);
    // Execute the original token/status function bodies, then the complete new migration.
    await db.query(originalFunction('read_stride_deletion_provider_tokens'));
    await db.query(originalFunction('read_stride_deletion_owned_status'));
    await db.query(originalFunction('clear_provider_tokens','stride_deletion_private'));
    await db.query(originalFunction('attest_stride_deletion_provider'));
    const migration=readdirSync('supabase/migrations').find(name=>name.endsWith('_apple_grant_custody.sql'))!;
    await db.query(readFileSync(join('supabase/migrations',migration),'utf8'));
    let number=0;
    const user=async()=>{
      const id=`71e0ff16-e219-43f2-b87b-${String(++number).padStart(12,'0')}`;
      await db.query('insert into auth.users(id) values($1)',[id]);
      await db.query("insert into auth.identities values($1::uuid,'apple','apple-'||($1::uuid)::text)",[id]); return id;
    };
    const tokens=(value='old')=>({refresh_token:`refresh-${value}`,access_token:`access-${value}`,id_token:`id-${value}`,token_type:'Bearer',expires_in:3600});
    const reserve=async(client:any,id:string,hash='a'.repeat(64))=>(await client.query('select public.reserve_stride_apple_capture($1,$2,$3,$4) id',[id,`apple-${id}`,'synthetic.app',hash])).rows[0].id;
    const finish=(client:any,id:string,hash:string,capture:string,value='old')=>client.query('select public.store_stride_apple_grant($1,$2,$3,$4,$5,$6) ok',[id,`apple-${id}`,'synthetic.app',hash,tokens(value),capture]);
    const store=async(client:any,id:string,hash='a'.repeat(64),value='old')=>{
      const existing=(await client.query('select id from stride_apple_private.capture_intents where owner_id=$1 and code_hash=$2',[id,hash])).rows[0]?.id;
      return finish(client,id,hash,existing??await reserve(client,id,hash),value);
    };
    const count=async(table:string)=>(await db.query(`select count(*)::int n from ${table}`)).rows[0].n;
    const secret=async(id:string)=>(await db.query('select g.vault_secret_id,v.decrypted_secret from stride_apple_private.grants g join vault.decrypted_secrets v on v.id=g.vault_secret_id where owner_id=$1',[id])).rows[0];
    const job=async(client:any,id:string)=>{
      const row=(await client.query("insert into public.stride_account_deletion_requests(user_id,status,processing_token,processing_expires_at) values($1,'processing',gen_random_uuid(),now()+interval '15 minutes') returning id,processing_token",[id])).rows[0];
      await client.query('insert into stride_deletion_private.request_state(request_id) values($1)',[row.id]); return row;
    };
    const ackKnown=async(client:any,j:any)=>{
      const rows=(await client.query('select public.read_stride_deletion_provider_tokens($1,$2) value',[j.id,j.processing_token])).rows[0].value;
      for(const token of rows.filter((x:any)=>x.kind.startsWith('apple_capture_'))) {
        const hash=createHash('sha256').update(token.token).digest('hex');
        await client.query('select public.ack_stride_apple_capture_token($1,$2,$3,$4,$5)',[j.id,j.processing_token,token.capture_id,token.kind,hash]);
      }
      return rows;
    };
    await t.test('capture/hash idempotency and newer active grant retain all completed responses for cleanup',async()=>{
      const id=await user(); await store(db,id); const first=await secret(id); const before=await count('vault.secrets');
      await store(db,id); assert.equal((await secret(id)).vault_secret_id,first.vault_secret_id); assert.equal(await count('vault.secrets'),before);
      await store(db,id,'b'.repeat(64),'new'); const next=await secret(id); assert.notEqual(next.vault_secret_id,first.vault_secret_id);
      assert.equal(JSON.parse(next.decrypted_secret).refresh_token,'refresh-new'); assert.equal(await count('vault.secrets'),before+1);
      assert.equal((await db.query('select public.stride_apple_grant_captured($1,$2,$3,$4) ok',[id,`apple-${id}`,'synthetic.app','a'.repeat(64)])).rows[0].ok,true);
    });
    await t.test('a failure after Vault creation rolls back the new secret, retains old custody and leaves the code retry unacknowledged',async()=>{
      const id=await user(); await store(db,id); const first=await secret(id),before=await count('vault.secrets');
      await db.query(`create function stride_apple_private.fixture_fail_capture() returns trigger language plpgsql as $$begin
        if new.code_hash=repeat('f',64) then raise exception 'synthetic commit failure'; end if; return new; end$$;
        create trigger fixture_fail_capture before insert on stride_apple_private.captures for each row execute function stride_apple_private.fixture_fail_capture()`);
      await assert.rejects(store(db,id,'f'.repeat(64),'failed'),/synthetic commit failure/);
      assert.equal((await secret(id)).vault_secret_id,first.vault_secret_id); assert.equal(await count('vault.secrets'),before);
      await db.query('drop trigger fixture_fail_capture on stride_apple_private.captures');
    });
    await t.test('ordinary roles cannot execute custody RPCs or read the private namespace',async()=>{
      for(const role of ['anon','authenticated']) {
        await db.query(`set role ${role}`);
        await assert.rejects(db.query('select public.stride_apple_grant_captured(null,null,null,null)'),/permission denied/);
        await assert.rejects(db.query('select public.store_stride_apple_grant(null,null,null,null,null,null)'),/permission denied/);
        await assert.rejects(db.query('select * from stride_apple_private.grants'),/permission denied/); await db.query('reset role');
      }
      const id=await user(); await db.query('set role service_role');
      const capture=await reserve(db,id); await finish(db,id,'a'.repeat(64),capture); await db.query('reset role');
    });
    await t.test('live identity and banned/deleting account checks fence capture; retained preflight returns no secret',async()=>{
      const id=await user(); await store(db,id);
      const pre=(await db.query('select public.read_stride_deletion_owned_status($1) value',[id])).rows[0].value;
      assert.deepEqual(pre,{request:null,apple_grant_retained:true});
      await assert.rejects(db.query('select public.store_stride_apple_grant($1,$2,$3,$4,$5,$6)',[id,'wrong','synthetic.app','c'.repeat(64),tokens(),'00000000-0000-4000-8000-000000000001']),/custody unavailable/);
      await db.query("update auth.users set banned_until=now()+interval '1 day' where id=$1",[id]);
      await assert.rejects(store(db,id),/custody unavailable/);
    });
    await t.test('privileged RPC rejects malformed token payloads and invalid code hashes without orphan secrets',async()=>{
      const id=await user(), before=await count('vault.secrets');
      const capture=await reserve(db,id);
      for(const payload of [{...tokens(),extra:'unsupported'},{...tokens(),expires_in:-1},{...tokens(),refresh_token:''},{}]) {
        await assert.rejects(db.query('select public.store_stride_apple_grant($1,$2,$3,$4,$5,$6)',[id,`apple-${id}`,'synthetic.app','a'.repeat(64),payload,capture]),/Invalid Apple token response/);
      }
      await assert.rejects(store(db,id,'not-a-hash'),/custody unavailable|reservation unavailable/);
      assert.equal(await count('vault.secrets'),before);
    });
    await t.test('leased deletion read adopts refresh ahead of a supplied authorization code; repair is never overwritten',async()=>{
      const id=await user(); await store(db,id); const j=await job(db,id);
      const code=(await db.query("select vault.create_secret('synthetic-code') id")).rows[0].id;
      await db.query("insert into stride_deletion_private.provider_tokens values($1,'apple','apple_authorization_code',$2,$3)",[j.id,`apple-${id}`,code]);
      const read=()=>db.query('select public.read_stride_deletion_provider_tokens($1,$2) value',[j.id,j.processing_token]);
      const list=(await read()).rows[0].value; assert.equal(list[0].kind,'apple_refresh_token'); assert.equal(list[0].token,'refresh-old');
      assert.equal((await db.query('select count(*)::int n from vault.secrets where id=$1',[code])).rows[0].n,0);
      const repair=(await db.query("select vault.create_secret('fresh-code') id")).rows[0].id;
      await db.query("delete from vault.secrets where id=(select vault_secret_id from stride_deletion_private.provider_tokens where request_id=$1)",[j.id]);
      await db.query("update stride_deletion_private.provider_tokens set kind='apple_authorization_code',vault_secret_id=$2 where request_id=$1",[j.id,repair]);
      assert.equal((await read()).rows[0].value[0].token,'fresh-code');
      await assert.rejects(db.query('select public.read_stride_deletion_provider_tokens($1,gen_random_uuid())',[j.id]),/Invalid lease/);
    });
    await t.test('revocation and completion purge full response, hash receipts and owner refs; Auth cascade does the same',async()=>{
      for(const mode of ['revoked','completed','cascade']) {
        const id=await user(); await store(db,id); const first=await secret(id);
        if(mode==='cascade') { const j=await job(db,id); await ackKnown(db,j); await db.query('delete from auth.users where id=$1',[id]); }
        else { const j=await job(db,id);
          if(mode==='revoked') {
            await ackKnown(db,j);
            const adopted=(await db.query('select public.read_stride_deletion_provider_tokens($1,$2) value',[j.id,j.processing_token])).rows[0].value;
            assert.equal(adopted[0].kind,'apple_refresh_token');
            await db.query("select public.attest_stride_deletion_provider($1,'apple','revoked','provider_confirmed',$2)",[j.id,j.processing_token]);
            assert.equal((await db.query('select count(*)::int n from stride_deletion_private.provider_tokens where request_id=$1',[j.id])).rows[0].n,0);
          }
          else { await ackKnown(db,j); await db.query("update public.stride_account_deletion_requests set status='completed' where id=$1",[j.id]); }
        }
        assert.equal((await db.query('select count(*)::int n from vault.secrets where id=$1',[first.vault_secret_id])).rows[0].n,0);
        assert.equal((await db.query('select count(*)::int n from stride_apple_private.grants where owner_id=$1',[id])).rows[0].n,0);
        assert.equal((await db.query('select count(*)::int n from stride_apple_private.captures where owner_id=$1',[id])).rows[0].n,0);
      }
    });
    await t.test('only reviewed grant FK is excluded; unknown Auth relationships still block inventory',async()=>{
      const id=await user(); const j=await job(db,id);
      assert.deepEqual((await db.query('select public.stride_deletion_plan($1) value',[j.id])).rows[0].value.shared_auth_tables,[]);
      await db.query('create table public.unreviewed_account_data(owner_id uuid references auth.users)');
      assert.deepEqual((await db.query('select public.stride_deletion_plan($1) value',[j.id])).rows[0].value.shared_auth_tables,['public.unreviewed_account_data']);
    });
    await t.test('extra Auth FK on an accepted table, altered delete action, or missing cleanup trigger remain inventory blockers',async()=>{
      const id=await user(),j=await job(db,id);
      const inventory=async()=>(await db.query('select public.stride_deletion_plan($1) value',[j.id])).rows[0].value.shared_auth_tables;
      await db.query('alter table stride_apple_private.grants add column unreviewed_owner uuid references auth.users');
      assert.ok((await inventory()).includes('stride_apple_private.grants'));
      await db.query('alter table stride_apple_private.grants drop column unreviewed_owner');
      await db.query('alter table stride_apple_private.grants drop constraint grants_owner_id_fkey, add constraint grants_owner_id_fkey foreign key(owner_id) references auth.users(id) on delete restrict');
      assert.ok((await inventory()).includes('stride_apple_private.grants'));
      await db.query('alter table stride_apple_private.grants drop constraint grants_owner_id_fkey, add constraint grants_owner_id_fkey foreign key(owner_id) references auth.users(id) on delete cascade');
      await db.query('alter table stride_apple_private.capture_intents disable trigger stride_apple_intent_secret_cleanup');
      assert.ok((await inventory()).includes('stride_apple_private.capture_intents'));
      await db.query('alter table stride_apple_private.capture_intents enable trigger stride_apple_intent_secret_cleanup');
      await db.query('drop trigger stride_apple_intent_secret_cleanup on stride_apple_private.capture_intents; create trigger stride_apple_intent_secret_cleanup before delete on stride_apple_private.capture_intents for each row when(false) execute function stride_apple_private.purge_intent_secret()');
      assert.ok((await inventory()).includes('stride_apple_private.capture_intents'));
      await db.query("drop trigger stride_apple_intent_secret_cleanup on stride_apple_private.capture_intents; create trigger stride_apple_intent_secret_cleanup before delete on stride_apple_private.capture_intents for each row execute function stride_apple_private.purge_intent_secret('unexpected')");
      assert.ok((await inventory()).includes('stride_apple_private.capture_intents'));
      await db.query('drop trigger stride_apple_intent_secret_cleanup on stride_apple_private.capture_intents; create trigger stride_apple_intent_secret_cleanup before delete on stride_apple_private.capture_intents for each row execute function stride_apple_private.purge_intent_secret()');
      await db.query('drop trigger stride_apple_auth_finalization_guard on auth.users; create trigger stride_apple_auth_finalization_guard before delete on auth.users for each row when(false) execute function stride_apple_private.guard_finalization()');
      assert.ok((await inventory()).includes('stride_apple_private.grants'));assert.ok((await inventory()).includes('stride_apple_private.capture_intents'));
      await db.query('drop trigger stride_apple_auth_finalization_guard on auth.users; create trigger stride_apple_auth_finalization_guard before delete on auth.users for each row execute function stride_apple_private.guard_finalization()');
      assert.ok(!(await inventory()).includes('stride_apple_private.grants'));assert.ok(!(await inventory()).includes('stride_apple_private.capture_intents'));
    });
    await t.test('paused exchange allows deletion intake but blocks final provider disposition/Auth/completion; late valid custody is denied login ACK before/after claim',async()=>{
      for(const stage of ['before-claim','after-claim']){
        const id=await user(),hash='e'.repeat(64),capture=await reserve(db,id,hash);
        assert.equal(await reserve(db,id,hash),null); // A busy duplicate receives no writer capability.
        const j=await job(db,id);
        if(stage==='before-claim') await db.query("update public.stride_account_deletion_requests set status='pending' where id=$1",[j.id]);
        await assert.rejects(reserve(db,id,'f'.repeat(64)),/custody unavailable/);
        await assert.rejects(db.query('delete from auth.users where id=$1',[id]),/capture outcome remains pending/);
        await assert.rejects(db.query("update public.stride_account_deletion_requests set status='completed' where id=$1",[j.id]),/capture outcome remains pending/);
        for(const disposition of ['revoked','manual_required']) await assert.rejects(db.query('select public.attest_stride_deletion_provider($1,$2,$3,$4,$5)',[j.id,'apple',disposition,disposition==='revoked'?'provider_confirmed':'legacy_token_unavailable',j.processing_token]),/capture outcome remains pending/);
        if(stage==='after-claim') await assert.rejects(db.query('select public.read_stride_deletion_provider_tokens($1,$2)',[j.id,j.processing_token]),/capture outcome remains pending/);
        assert.equal((await finish(db,id,hash,capture,'late')).rows[0].ok,false);
        const intent=(await db.query('select state,bound_request_id,vault_secret_id from stride_apple_private.capture_intents where id=$1',[capture])).rows[0];
        assert.equal(intent.state,'completed');assert.equal(intent.bound_request_id,j.id);assert.ok(intent.vault_secret_id);
        await db.query('select public.mark_stride_apple_capture_uncertain($1)',[capture]);
        assert.equal((await db.query('select state from stride_apple_private.capture_intents where id=$1',[capture])).rows[0].state,'completed');
        await assert.rejects(db.query('select public.stride_apple_grant_captured($1,$2,$3,$4)',[id,`apple-${id}`,'synthetic.app',hash]),/custody unavailable/);
        assert.equal((await finish(db,id,hash,capture,'late')).rows[0].ok,false);
        if(stage==='before-claim') await db.query("update public.stride_account_deletion_requests set status='processing' where id=$1",[j.id]);
        const adopted=(await db.query('select public.read_stride_deletion_provider_tokens($1,$2) value',[j.id,j.processing_token])).rows[0].value;
        assert.equal(adopted[0].token,'refresh-late');
        await ackKnown(db,j);
        await db.query("select public.attest_stride_deletion_provider($1,'apple','revoked','provider_confirmed',$2)",[j.id,j.processing_token]);
        assert.equal((await db.query('select count(*)::int n from vault.secrets where id=$1',[intent.vault_secret_id])).rows[0].n,0);
      }
    });
    await t.test('completion is bound to the exact random reservation/owner/subject/audience/hash and is one-shot',async()=>{
      const id=await user(),otherOwner=await user(),hash='a'.repeat(64),capture=await reserve(db,id,hash);
      for(const args of [
        [id,`apple-${id}`,'synthetic.app',hash,tokens(),'00000000-0000-4000-8000-000000000001'],
        [otherOwner,`apple-${otherOwner}`,'synthetic.app',hash,tokens(),capture],
        [id,`apple-${id}`,'other.app',hash,tokens(),capture],
        [id,`apple-${id}`,'synthetic.app','b'.repeat(64),tokens(),capture],
      ]) await assert.rejects(db.query('select public.store_stride_apple_grant($1,$2,$3,$4,$5,$6)',args),/reservation mismatch/);
      assert.equal((await finish(db,id,hash,capture)).rows[0].ok,true);const original=await secret(id);
      assert.equal((await finish(db,id,hash,capture,'altered-replay')).rows[0].ok,false);
      assert.equal((await secret(id)).vault_secret_id,original.vault_secret_id);
    });
    await t.test('older result cannot replace newer active grant or repaired job refresh; all encrypted generations purge at revocation',async()=>{
      const id=await user(),older=await reserve(db,id,'a'.repeat(64)),newer=await reserve(db,id,'b'.repeat(64));
      await finish(db,id,'b'.repeat(64),newer,'newer');const active=await secret(id);const j=await job(db,id);
      const repair=(await db.query("select vault.create_secret('refresh-repaired') id")).rows[0].id;
      await db.query("insert into stride_deletion_private.provider_tokens values($1,'apple','apple_refresh_token',$2,$3)",[j.id,`apple-${id}`,repair]);
      assert.equal((await finish(db,id,'a'.repeat(64),older,'older')).rows[0].ok,false);
      assert.equal((await secret(id)).vault_secret_id,active.vault_secret_id);
      const vaults=(await db.query('select vault_secret_id from stride_apple_private.capture_intents where owner_id=$1',[id])).rows.map((r:any)=>r.vault_secret_id);
      assert.equal(vaults.length,2);
      assert.equal((await db.query('select public.read_stride_deletion_provider_tokens($1,$2) value',[j.id,j.processing_token])).rows[0].value[0].token,'refresh-repaired');
      await ackKnown(db,j);
      await db.query("select public.attest_stride_deletion_provider($1,'apple','revoked','provider_confirmed',$2)",[j.id,j.processing_token]);
      assert.equal((await db.query('select count(*)::int n from vault.secrets where id=any($1::uuid[])',[vaults.concat(repair)])).rows[0].n,0);
    });
    await t.test('uncertainty does not expire with worker lease; explicit service-only stopped-capture resolution is manual and seals late completion',async()=>{
      const id=await user(),hash='a'.repeat(64),capture=await reserve(db,id,hash),j=await job(db,id);
      await db.query('select public.mark_stride_apple_capture_uncertain($1)',[capture]);
      const status=(await db.query('select public.read_stride_deletion_owned_status($1) value',[id])).rows[0].value;
      assert.equal(status.provider_actions[0].reason,'capture_outcome_unknown');
      await db.query("update public.stride_account_deletion_requests set processing_expires_at=now()-interval '1 day' where id=$1",[j.id]);
      await assert.rejects(db.query('delete from auth.users where id=$1',[id]),/capture outcome remains pending/);
      await assert.rejects(db.query('select public.resolve_stride_apple_capture_unavailable($1,$2,$3,$4)',[id,capture,'expired','elapsed time']),/Explicit stopped-capture/);
      await db.query('set role authenticated');
      await assert.rejects(db.query('select public.resolve_stride_apple_capture_unavailable(null,null,null,null)'),/permission denied/);await db.query('reset role');
      await db.query('select public.resolve_stride_apple_capture_unavailable($1,$2,$3,$4)',[id,capture,'CAPTURE STOPPED; TOKENS UNAVAILABLE','Synthetic operator confirmed no active writer; response irretrievable']);
      await assert.rejects(finish(db,id,hash,capture,'post-stop'),/reservation is sealed/);
      await db.query("update public.stride_account_deletion_requests set processing_expires_at=now()+interval '15 minutes' where id=$1",[j.id]);
      await db.query("select public.attest_stride_deletion_provider($1,'apple','manual_required','capture_outcome_unknown',$2)",[j.id,j.processing_token]);
      const manual=(await db.query('select public.read_stride_deletion_owned_status($1) value',[id])).rows[0].value;
      assert.equal(manual.provider_actions[0].status,'manual_required');assert.equal(manual.provider_actions[0].reason,'capture_outcome_unknown');
      await db.query('delete from auth.users where id=$1',[id]);
      assert.equal((await db.query('select stride_deletion_private.providers_ready($1) ok',[j.id])).rows[0].ok,true);
    });
    await t.test('all distinct retained refresh AND access tokens need exact leased ACKs before final disposition or purge',async()=>{
      const id=await user();await store(db,id,'a'.repeat(64),'first');await store(db,id,'b'.repeat(64),'second');const j=await job(db,id);
      const captures=(await db.query('select public.read_stride_deletion_provider_tokens($1,$2) value',[j.id,j.processing_token])).rows[0].value.filter((x:any)=>x.kind.startsWith('apple_capture_'));
      assert.equal(captures.length,4);
      await assert.rejects(db.query("select public.attest_stride_deletion_provider($1,'apple','revoked','provider_confirmed',$2)",[j.id,j.processing_token]),/tokens await revocation/);
      await assert.rejects(db.query('delete from auth.users where id=$1',[id]),/tokens await revocation/);
      const token=captures[0],hash=createHash('sha256').update(token.token).digest('hex');
      await assert.rejects(db.query('select public.ack_stride_apple_capture_token($1,$2,$3,$4,$5)',[j.id,j.processing_token,token.capture_id,token.kind,'0'.repeat(64)]),/acknowledgement mismatch/);
      await db.query('select public.ack_stride_apple_capture_token($1,$2,$3,$4,$5)',[j.id,j.processing_token,token.capture_id,token.kind,hash]);
      await assert.rejects(db.query("select public.attest_stride_deletion_provider($1,'apple','revoked','provider_confirmed',$2)",[j.id,j.processing_token]),/tokens await revocation/);
      assert.equal((await db.query('select count(*)::int n from stride_apple_private.capture_intents where owner_id=$1',[id])).rows[0].n,2);
      await ackKnown(db,j);
      await db.query("select public.attest_stride_deletion_provider($1,'apple','revoked','provider_confirmed',$2)",[j.id,j.processing_token]);
      assert.equal((await db.query('select count(*)::int n from stride_apple_private.capture_intents where owner_id=$1',[id])).rows[0].n,0);
    });
    await t.test('known-token acknowledgement plus a separate manual-unknown exchange never becomes aggregate provider-confirmed',async()=>{
      const id=await user();await store(db,id);const capture=await reserve(db,id,'b'.repeat(64)),j=await job(db,id);
      await db.query('select public.mark_stride_apple_capture_uncertain($1)',[capture]);
      await db.query('select public.resolve_stride_apple_capture_unavailable($1,$2,$3,$4)',[id,capture,'CAPTURE STOPPED; TOKENS UNAVAILABLE','Synthetic stopped writer, irretrievable response']);
      await ackKnown(db,j);
      await db.query("select public.attest_stride_deletion_provider($1,'apple','revoked','provider_confirmed',$2)",[j.id,j.processing_token]);
      const status=(await db.query('select public.read_stride_deletion_owned_status($1) value',[id])).rows[0].value;
      assert.equal(status.provider_actions[0].status,'manual_required');assert.equal(status.provider_actions[0].reason,'capture_outcome_unknown');
      assert.equal((await db.query('select public.stride_deletion_plan($1) value',[j.id])).rows[0].value.apple_capture_recovery_attested,true);
      assert.equal((await db.query('select stride_deletion_private.providers_ready($1) ok',[j.id])).rows[0].ok,true);
    });
    await t.test('intent cleanup is independent of Auth cascade order with older and latest Vault responses',async()=>{
      for(const intentsFirst of [false,true]){
        if(intentsFirst) await db.query('alter table stride_apple_private.grants drop constraint grants_owner_id_fkey, add constraint grants_owner_id_fkey foreign key(owner_id) references auth.users(id) on delete cascade');
        const id=await user();await store(db,id,'a'.repeat(64),'old');await store(db,id,'b'.repeat(64),'new');
        const vaults=(await db.query('select vault_secret_id from stride_apple_private.capture_intents where owner_id=$1',[id])).rows.map((r:any)=>r.vault_secret_id);
        assert.equal(vaults.length,2);const j=await job(db,id);await ackKnown(db,j);await db.query('delete from auth.users where id=$1',[id]);
        assert.equal((await db.query('select count(*)::int n from vault.secrets where id=any($1::uuid[])',[vaults])).rows[0].n,0);
        for(const table of ['grants','capture_intents','captures']) assert.equal((await db.query(`select count(*)::int n from stride_apple_private.${table} where owner_id=$1`,[id])).rows[0].n,0);
      }
    });
    await t.test('capture-first and deletion-first transactions serialize on the same auth-user row',async()=>{
      for(const first of ['capture','delete']) {
        const id=await user(); await db.query('begin'); let finished=false;
        if(first==='capture') await store(db,id); else await job(db,id);
        const pending=(first==='capture'?job(other,id):store(other,id)).then(()=>{finished=true;return true;},()=>{finished=true;return false;});
        await new Promise(resolve=>setTimeout(resolve,80)); assert.equal(finished,false);
        await db.query('commit'); assert.equal(await pending,first==='capture');
        await assert.rejects(store(db,id,'d'.repeat(64),'late'),/custody unavailable/);
      }
    });
  } finally {
    if(db) await db.end(); if(other) await other.end();
    if(started) command('pg_ctl',['-D',join(root,'data'),'-m','fast','-w','stop']);
    rmSync(root,{recursive:true,force:true});
  }
});
