import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { workoutIdentityKeys } from '../../src/utils/workoutDeletion';

const modulePath = process.env.STRIDEOS_TEST_PGLITE_MODULE;
test('durable workout deletion and archive revisions under actual PostgreSQL owner RLS', { skip: !modulePath }, async t => {
  const { PGlite } = await import(modulePath!); const db = new PGlite();
  const owner = '11111111-1111-4111-8111-111111111111', other = '22222222-2222-4222-8222-222222222222';
  const value = async (sql: string, args: unknown[] = []) => (await db.query(sql, args)).rows[0]?.value;
  const call = (name: string, data: unknown) => value(`select public.${name}($1::jsonb) as value`, [JSON.stringify(data)]);
  const asOwner = async (id = owner) => { await db.exec('reset role; set role authenticated'); await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]); };
  const row = { id: 'original', activityType: 'running', legacyWorkoutId: 'run1', workoutInstanceId: 'instance1', healthKit: { workoutUuid: 'health1' } };
  const tombstone = { ownerUserId: owner, activityId: row.id, deletedAt: 1, keys: workoutIdentityKeys('activity_logs', row) };
  const archive = { schemaVersion: 1, id: 'archive1', sourceKey: 'goal:original', ownerUserId: owner, athleteId: 'athlete_default', title: 'Original', kind: 'goal', goalType: 'general_running', startDate: '2026-10-01', endDate: '2026-10-31', archivedAt: 10, summary: { activityIds: ['original'], weeks: [], coverage: {} }, macroPlan: { weeks: [{ prescription: 'immutable' }] }, result: { status: 'unrecorded' } };
  try {
    await db.exec(`create role authenticated; create role anon; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key,aud text,role text);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth to authenticated,anon;
      create table public.profiles(id uuid primary key references auth.users(id) on delete cascade);
      alter table profiles enable row level security;
      grant select,insert,update,delete on profiles to authenticated;
      create policy own_profile on profiles for all to authenticated using(auth.uid()=id) with check(auth.uid()=id);
      create table public.stride_account_deletion_requests(user_id uuid); grant select on public.stride_account_deletion_requests to authenticated;`);
    for (const table of ['activity_logs','workout_logs','strength_logs','custom_workout_logs']) await db.exec(`create table public.${table}(id text,user_id uuid,data jsonb,primary key(user_id,id)); alter table public.${table} enable row level security; grant select,insert,update,delete on public.${table} to authenticated; create policy own_log on public.${table} for all to authenticated using(auth.uid()=user_id) with check(auth.uid()=user_id);`);
    await db.exec(readFileSync('supabase/migrations/20261031210327_owner_scoped_goal_archives.sql','utf8'));
    await db.exec(readFileSync('supabase/migrations/20261123123200_workout_deletion_and_archive_revisions.sql','utf8'));
    await db.query('insert into auth.users(id) values($1),($2)',[owner,other]);
    await db.query('insert into profiles(id) values($1),($2)',[owner,other]);
    await asOwner();
    await t.test('SQL and phone identity extractors agree across legacy, Health, custom and strength records', async () => {
      for (const [table,item] of [['activity_logs',row],['activity_logs',{id:'activity_custom_x',activityType:'other'}],['activity_logs',{id:'health-alias',activityType:'strength',healthKit:{strideOSWorkoutId:'s1',strideOSActivityId:'activity_strength_s1'}}],['strength_logs',{id:'s1',workoutInstanceId:'s-instance'}]] as const) {
        assert.deepEqual(await value('select public.stride_workout_identity_keys($1,$2::jsonb) as value',[table,JSON.stringify(item)]),workoutIdentityKeys(table,item));
      }
    });
    await t.test('delete entire workout atomically; preserve another owner with identical IDs', async () => {
      await db.query('insert into activity_logs values($1,$2,$3)',[row.id,owner,row]);
      await db.query('insert into workout_logs values($1,$2,$3)',['run1',owner,{id:'run1',workoutInstanceId:'instance1'}]);
      await asOwner(other); await db.query('insert into activity_logs values($1,$2,$3)',[row.id,other,row]); await asOwner();
      await call('delete_stride_completed_workout',tombstone);
      assert.equal(await value('select count(*)::int as value from activity_logs'),0);
      assert.equal(await value('select count(*)::int as value from workout_logs'),0);
      assert.equal(await value('select count(*)::int as value from workout_deletions'),1);
      await asOwner(other); assert.equal(await value('select count(*)::int as value from activity_logs'),1); assert.equal(await value('select count(*)::int as value from workout_deletions'),0);
      await assert.rejects(call('delete_stride_completed_workout',tombstone)); await asOwner();
    });
    await t.test('stale cloud/old client re-upsert and Health alias cannot resurrect deleted history', async () => {
      await db.query('insert into activity_logs values($1,$2,$3) on conflict(user_id,id) do update set data=excluded.data',[row.id,owner,row]);
      await db.query('insert into activity_logs values($1,$2,$3)',['health-restored',owner,{...row,id:'health-restored',legacyWorkoutId:undefined}]);
      await db.query('insert into workout_logs values($1,$2,$3)',['run1',owner,{id:'run1'}]);
      assert.equal(await value('select count(*)::int as value from activity_logs'),0); assert.equal(await value('select count(*)::int as value from workout_logs'),0);
      assert.deepEqual((await call('delete_stride_completed_workout',{...tombstone,deletedAt:999})).deletedAt,1);
      await assert.rejects(call('delete_stride_completed_workout',{...tombstone,keys:[]}));
    });
    await t.test('archive corrections, independent results and tombstones survive stale older RPC writes', async () => {
      await call('merge_stride_goal_archive',archive);
      const metadata = { title:'Corrected',startDate:'2026-09-30',endDate:'2026-11-01',updatedAt:20,mutationId:'a' };
      const corrected=await call('revise_stride_goal_archive',{...archive,macroPlan:{weeks:[]},metadata});
      assert.deepEqual(corrected.macroPlan,archive.macroPlan); assert.equal(corrected.title,'Original'); assert.equal(corrected.metadata.title,'Corrected');
      await call('revise_stride_goal_archive',{...archive,metadata:{...metadata,title:'Stale',updatedAt:19}});
      const deleted=await call('revise_stride_goal_archive',{...archive,deletedAt:30}); assert.equal(deleted.metadata.title,'Corrected');
      const old=await call('merge_stride_goal_archive',{...archive,result:{status:'finished',timeSeconds:500,updatedAt:40}});
      assert.equal(old.deletedAt,30); assert.equal(old.metadata.title,'Corrected'); assert.equal(old.result.timeSeconds,500);
      await assert.rejects(call('revise_stride_goal_archive',{...archive,metadata:{title:'Invalid',updatedAt:60,mutationId:'bad'}}));
      await assert.rejects(call('revise_stride_goal_archive',{...archive,ownerUserId:other}));
      const repeated=await call('merge_stride_goal_archive',{...archive,id:'new-plan-archive',sourceKey:'goal:new-instance'}); assert.equal(repeated.deletedAt,undefined);
    });
    await t.test('pending account deletion freezes mutation; anonymous cannot read or mutate intent', async () => {
      await db.exec('reset role'); await db.query('insert into stride_account_deletion_requests values($1)',[owner]); await asOwner();
      await assert.rejects(call('delete_stride_completed_workout',{...tombstone,activityId:'another',keys:['activity:another']}));
      await db.exec('reset role; set role anon'); await assert.rejects(db.query('select * from workout_deletions')); await assert.rejects(call('delete_stride_completed_workout',tombstone));
      await db.exec('reset role'); await db.query('delete from profiles where id=$1',[owner]); assert.equal(await value('select count(*)::int as value from workout_deletions'),0);
    });
    await t.test('hosted acceptance script runs with synthetic accounts and rolls all changes back', async () => {
      await db.exec('reset role');
      const before = await value('select count(*)::int as value from auth.users');
      await db.exec(readFileSync('scripts/verification/build127-history-acceptance.sql','utf8'));
      assert.equal(await value('select count(*)::int as value from auth.users'),before);
    });
  } finally { await db.close(); }
});
