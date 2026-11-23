import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import { createJSONStorage } from 'zustand/middleware';
import { deletionForActivity, workoutIdentityKeys, workoutWasDeleted, mergeWorkoutDeletions, decodeWorkoutDeletions } from '../../src/utils/workoutDeletion';
import { visibleGoalArchives } from '../../src/lib/goalArchiveOperations';
import type { Activity } from '../../src/types/activity';
import type { GoalArchive } from '../../src/types/goalArchive';

function load<T>(file: string, mocks: Record<string, unknown>): T {
  const filename=resolve(file), module={exports:{}};
  const compiled=ts.transpileModule(readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
  const native=createRequire(filename);
  vm.runInNewContext(compiled,{module,exports:module.exports,require:(id:string)=>Object.hasOwn(mocks,id)?mocks[id]:native(id),console,Date,setTimeout,clearTimeout},{filename});
  return module.exports as T;
}
const plain=<T,>(value:T):T=>JSON.parse(JSON.stringify(value));
const activity=(id='original'):Activity=>({id,activityType:'running',source:'tracked',status:'completed',scheduled:false,indoor:false,startTime:1,createdAt:1,updatedAt:1,workoutInstanceId:'instance',legacyWorkoutId:'run',metrics:{durationSeconds:300},trainingLoad:{}});
const record={id:'run',workoutId:'easy',type:'easy_run',week:1,timestamp:1,durationMinutes:5,estimatedDistanceMiles:1,actualDurationMinutes:5,workoutInstanceId:'instance'};
async function activityHarness(disk=new Map<string,string>()) {
  let current={ownerUserId:'owner',generation:1}; let fail=false; let beforeRead: (()=>void)|undefined;
  const storage={getItem:async(key:string)=>disk.get(key)??null,getItemOnce:async(key:string)=>{beforeRead?.();return disk.get(key)??null;},setItem:async(key:string,value:string)=>{if(fail)throw new Error('disk full');disk.set(key,value);},removeItem:async(key:string)=>{disk.delete(key);}};
  const ownership={captureOwnerLease:()=>({...current}),ownerLeaseIsCurrent:(lease:any)=>lease?.ownerUserId===current.ownerUserId&&lease.generation===current.generation};
  const source=load<typeof import('../../src/store/activityStore')>('src/store/activityStore.ts',{
    '@react-native-async-storage/async-storage':{}, './persistStorage':{createAppJSONStorage:()=>createJSONStorage(()=>storage),getAppStorage:()=>storage},
    '../lib/localDataOwner':ownership,'../lib/recalculation':{runRecalculation:()=>{}},'../lib/trackingTaskHydration':{waitForPersistedStoreHydration:async()=>true},
  });
  await source.useActivityStore.persist.rehydrate(); await new Promise(resolve=>setTimeout(resolve,0)); source.useActivityStore.getState().setHydrationStatus('ready');
  return {store:source.useActivityStore,lease:()=>({...current}),disk,setFailure:(value:boolean)=>{fail=value;},onRead:(callback:()=>void)=>{beforeRead=callback;},switchOwner:()=>{current={ownerUserId:'other',generation:2};}};
}

test('whole workout deletion persists offline, survives restart, legacy boot import and stale cloud restore',async()=>{
  const h=await activityHarness();h.store.getState().addActivity(activity());await h.store.getState().awaitPersistence(h.lease());
  await h.store.getState().removeActivityAndPersist('original',h.lease());
  assert.equal(h.store.getState().activities.length,0);assert.equal(h.store.getState().deletedActivities.length,1);
  h.disk.set('workout-store',JSON.stringify({state:{history:[record]}}));
  const restarted=await activityHarness(h.disk);
  assert.equal(restarted.store.getState().activities.length,0);
  restarted.store.getState().importLegacyWorkouts([record as any]);
  assert.equal(restarted.store.getState().mergeRestoredActivities([{...activity(),id:'cloud-alias'}]),0);
  assert.throws(()=>restarted.store.getState().addActivity({...activity(),id:'late-recording'}),/deleted/);
  await assert.rejects(restarted.store.getState().addActivityAndPersist(activity(),restarted.lease()),/deleted/);
  assert.equal(restarted.store.getState().activities.length,0);
});

test('a failed durable save is reported, retry persists the same deletion without minting another intent',async()=>{
  const h=await activityHarness();h.store.getState().addActivity(activity());await h.store.getState().awaitPersistence(h.lease());
  // Fail the explicit commit rather than the normal middleware fire-and-forget write.
  h.onRead(()=>{throw new Error('confirmation unavailable');});
  await assert.rejects(h.store.getState().removeActivityAndPersist('original',h.lease()),/confirmation unavailable/);
  h.onRead(()=>{});await h.store.getState().removeActivityAndPersist('original',h.lease());
  assert.equal(h.store.getState().deletedActivities.length,1);
  const restarted=await activityHarness(h.disk);assert.equal(restarted.store.getState().activities.length,0);
});

test('owner change fences delayed persistence and rejects another owner tombstone',async()=>{
  const h=await activityHarness();h.store.getState().addActivity(activity());await h.store.getState().awaitPersistence(h.lease());
  const lease=h.lease();h.onRead(()=>{h.switchOwner();h.store.setState({activities:[activity('other-owner')],deletedActivities:[]});});
  await assert.rejects(h.store.getState().removeActivityAndPersist('original',lease),/Account changed/);
  assert.equal(h.store.getState().activities[0].id,'other-owner');
  assert.throws(()=>h.store.getState().mergeDeletedActivities([deletionForActivity(activity(),'owner')]),/another owner/);
});

test('deletion identities preserve same-named independent workouts and filter Health/native aliases',()=>{
  const a=activity(),deletions=[deletionForActivity(a,'owner')];
  assert.equal(workoutWasDeleted(deletions,'workout_logs',{id:'run'}),true);
  assert.equal(workoutWasDeleted(deletions,'strength_logs',{id:'run'}),false);
  assert.equal(workoutWasDeleted(deletions,'activity_logs',{id:'health',healthKit:{workoutInstanceId:'instance'}}),true);
  assert.equal(workoutWasDeleted(deletions,'activity_logs',{id:'other',workoutInstanceId:'new-instance'}),false);
  assert.equal(workoutWasDeleted(deletions,'workout_logs',{id:'run'},'different-owner'),false);
  assert.throws(()=>decodeWorkoutDeletions(deletions,'different-owner'),/owner/);
  assert.deepEqual(workoutIdentityKeys('activity_logs',{id:'activity_custom_abc'}),['activity:activity_custom_abc','custom:abc']);
  const union=mergeWorkoutDeletions(deletions,[{...deletions[0],keys:[...deletions[0].keys,'health:uuid']}]);
  assert.equal(union.length,1);assert.equal(workoutWasDeleted(union,'activity_logs',{id:'health',healthKit:{workoutUuid:'uuid'}}),true);
});

test('archive corrections merge deterministically, preserve old prescriptions and survive stale result-only writes',()=>{
  const api=load<typeof import('../../src/lib/goalArchiveSync')>('src/lib/goalArchiveSync.ts',{'./localDataOwner':{ownerLeaseIsCurrent:()=>true},'./supabase':{getSupabaseAvailability:()=>({status:'unavailable'})}});
  const original={schemaVersion:1,id:'old',sourceKey:'goal:old',ownerUserId:'owner',title:'Original',startDate:'2026-01-01',endDate:'2026-02-01',macroPlan:{goalIntent:{version:1,priorities:['hiking','get_stronger'],season:'off_season'},weeks:[{prescription:'3x5'}]},result:{status:'unrecorded'}} as unknown as GoalArchive;
  const corrected={...original,title:'Hostile overwrite',macroPlan:{weeks:[]},metadata:{title:'Corrected',startDate:'2026-01-02',endDate:'2026-02-02',updatedAt:10,mutationId:'a'}};
  const saved=api.mergeGoalArchives([original],[corrected])[0];assert.equal(saved.title,'Original');assert.deepEqual(plain(saved.macroPlan),plain(original.macroPlan));assert.deepEqual(plain(saved.macroPlan?.goalIntent),plain(original.macroPlan?.goalIntent));assert.equal(visibleGoalArchives([saved])[0].title,'Corrected');
  const newer={...original,metadata:{...corrected.metadata,title:'Tie winner',mutationId:'b'}};
  assert.equal(api.mergeGoalArchives([saved],[newer])[0].metadata?.title,'Tie winner');
  const deleted=api.mergeGoalArchives([saved],[{...original,deletedAt:30}]);
  const stale=api.mergeGoalArchives(deleted,[{...original,result:{status:'finished',timeSeconds:300,updatedAt:50}}]);
  assert.equal(stale[0].deletedAt,30);assert.equal(stale[0].result.timeSeconds,300);assert.equal(visibleGoalArchives(stale).length,0);
  assert.equal(visibleGoalArchives([...stale,{...original,id:'new',sourceKey:'goal:new'}]).length,1);
  assert.throws(()=>api.mergeGoalArchives([saved],[{...original,ownerUserId:'other'}]),/identity/);
});

test('active projection observer cannot prune legacy history before the deletion revision is disk-confirmed',async()=>{
  const h=await activityHarness();h.store.getState().addActivity(activity());await h.store.getState().awaitPersistence(h.lease());
  const makeStore=(state:any)=>({getState:()=>state,setState:(patch:any)=>{Object.assign(state,patch);}});
  const workouts=makeStore({history:[record],completedWorkouts:['run']});
  const strength=makeStore({history:[],completedSessions:[]});
  const mobility=makeStore({completions:[]});const custom=makeStore({logs:[]});
  const deletion=load<typeof import('../../src/lib/completedWorkoutDeletion')>('src/lib/completedWorkoutDeletion.ts',{
    './localDataOwner':{captureOwnerLease:h.lease,ownerLeaseIsCurrent:(lease:any)=>lease.ownerUserId===h.lease().ownerUserId&&lease.generation===h.lease().generation},
    '../store/activityStore':{useActivityStore:h.store},'../store/workoutStore':{useWorkoutStore:workouts},'../store/strengthStore':{useStrengthStore:strength},'../store/mobilityStore':{useMobilityStore:mobility},'../store/customWorkoutStore':{useCustomWorkoutStore:custom},
  });
  const stop=h.store.subscribe(()=>deletion.pruneDeletedWorkoutProjections(h.lease()));
  h.onRead(()=>{throw new Error('confirmation failed');});
  await assert.rejects(deletion.deleteCompletedWorkout('original'),/confirmation failed/);
  assert.equal(h.store.getState().deletedActivities.length,1);
  assert.equal(h.store.getState().confirmedDeletedActivities.length,0);
  assert.equal(workouts.getState().history.length,1);assert.deepEqual(workouts.getState().completedWorkouts,['run']);
  h.onRead(()=>{});await deletion.deleteCompletedWorkout('original');
  assert.equal(h.store.getState().confirmedDeletedActivities.length,1);
  assert.equal(workouts.getState().history.length,0);assert.deepEqual(workouts.getState().completedWorkouts,[]);
  stop();
});

test('newly performing a deleted schedule slot uses fresh physical identity and does not restore the deleted recording',async()=>{
  const h=await activityHarness();
  const storage={getItem:async(key:string)=>h.disk.get(key)??null,getItemOnce:async(key:string)=>h.disk.get(key)??null,setItem:async(key:string,value:string)=>{h.disk.set(key,value);},removeItem:async()=>{}};
  const ownership={captureOwnerLease:h.lease,ownerLeaseIsCurrent:(lease:any)=>lease.ownerUserId===h.lease().ownerUserId&&lease.generation===h.lease().generation};
  const common={'@react-native-async-storage/async-storage':{},'./persistStorage':{createAppJSONStorage:()=>createJSONStorage(()=>storage),getAppStorage:()=>storage},'../lib/localDataOwner':ownership,'./activityStore':{useActivityStore:h.store},'../lib/syncService':{syncWorkoutLog:async()=>{},deleteWorkoutLog:async()=>{},syncStrengthLog:async()=>{},deleteStrengthLog:async()=>{}},'../lib/externalIntegrations':{syncCompletedWorkoutToExternalServices:async()=>{},syncStrengthSessionToExternalServices:async()=>{}}};
  const workouts=load<typeof import('../../src/store/workoutStore')>('src/store/workoutStore.ts',common).useWorkoutStore;
  await workouts.persist.rehydrate();
  const plan={id:'easy',type:'easy_run',intensity:'easy',durationMinutes:20} as any;
  const finish=()=>workouts.getState().completeWorkout('w1_easy_0',plan,1,20,80,()=>{},()=>{});
  finish();const first=workouts.getState().history[0]!;await workouts.getState().deleteLog(first.id,h.lease());
  assert.equal(workouts.getState().history.length,0);finish();
  const second=workouts.getState().history[0]!;assert.notEqual(second.id,first.id);assert.equal(second.completionKey,'w1_easy_0');
  assert.equal(workouts.getState().completedWorkouts.includes('w1_easy_0'),true);
  h.store.getState().importLegacyWorkouts([first]);assert.equal(h.store.getState().activities.length,1);
  assert.equal(h.store.getState().activities[0].legacyWorkoutId,second.id);
  const before=workouts.getState().history;
  assert.throws(()=>workouts.getState().manualLog({completionKey:first.id,workoutInstanceId:'deleted-native',actualStartTime:1,actualEndTime:1000,durationMinutes:1,type:'easy_run',intensity:'easy'} as any,1,20,80,()=>{},()=>{}),/deleted/);
  assert.equal(workouts.getState().history,before,'deleted native retry must reject before a legacy write');
  const strength=load<typeof import('../../src/store/strengthStore')>('src/store/strengthStore.ts',{...common,'../utils/strengthEngine':{estimateSessionLoad:()=>1},'./profileStore':{useProfileStore:{persist:{hasHydrated:()=>true},getState:()=>({activeAthleteId:'athlete_default'})}}}).useStrengthStore;
  await strength.persist.rehydrate();
  const lift=()=>strength.getState().logSession('sw1_full_0','session','full_body','force_production',1,20,[],10,7);
  lift();const oldLift=strength.getState().history[0]!;await strength.getState().deleteLog(oldLift.id,h.lease());lift();
  const newLift=strength.getState().history[0]!;assert.notEqual(newLift.id,oldLift.id);assert.equal(newLift.completionKey,'sw1_full_0');
  assert.equal(strength.getState().completedSessions.includes('sw1_full_0'),true);
  await strength.getState().deleteLog('sw1_full_0',h.lease());
  assert.equal(strength.getState().history.length,0);assert.equal(strength.getState().completedSessions.length,0);
  const captured = { completionKey:'training_block_frozen',workoutInstanceId:'frozen',sessionType:'full_body',goal:'maintenance',week:1,plannedDuration:20,actualDuration:20,exercises:[] } as const;
  strength.getState().manualLog(captured as any,10); await strength.getState().deleteLog(captured.completionKey,h.lease());
  assert.throws(()=>strength.getState().manualLog(captured as any,10),/deleted/);
  assert.equal(strength.getState().history.length,0,'a deleted captured Finish retry cannot become a new performance');
});

test('native setter failure keeps deletion unconfirmed and legacy projection intact until a successful retry',async()=>{
  const h=await activityHarness();h.store.getState().addActivity(activity());await h.store.getState().awaitPersistence(h.lease());
  h.setFailure(true);
  await assert.rejects(h.store.getState().removeActivityAndPersist('original',h.lease()),/disk full/);
  assert.equal(h.store.getState().confirmedDeletedActivities.length,0);
  assert.equal(JSON.parse(h.disk.get('activity-store')!).state.activities.length,1);
  h.setFailure(false);await h.store.getState().removeActivityAndPersist('original',h.lease());
  assert.equal(h.store.getState().confirmedDeletedActivities.length,1);
  assert.equal(JSON.parse(h.disk.get('activity-store')!).state.activities.length,0);
});
