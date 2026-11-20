import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import Module from 'node:module';
import test from 'node:test';
import { makeStrengthTemplate } from '../../src/utils/strengthTemplates';
import type { ActiveStrengthSession } from '../../src/utils/strengthSession';
import { accountCleanupKeys, isAccountDataKey } from '../../src/lib/localAccountCleanupManifest';
function template(name='My workout') { return makeStrengthTemplate({workoutName:name,plannedDurationMin:20,exercises:[{id:'ex',canonicalExerciseId:'b_squat',name:'Barbell Squat',equipment:['barbell'],equipmentType:'barbell',sets:1,reps:'8',setEntries:[{id:'set',reps:8,weight:100,weightUnit:'lb',rpe:8,completed:true}]}]} as ActiveStrengthSession,name,'A',1); }
function harness(){
 const data=new Map<string,string>();let generation=1;let owner='A';let failRead=false;let failWrite=false;let afterWrite=()=>{};let readGate:(()=>Promise<void>)|undefined;
 const lease=()=>({ownerUserId:owner,generation});
 const loader=Module as unknown as {_load:(id:string,...args:unknown[])=>unknown};const original=loader._load;
 const filename='../../src/lib/strengthTemplateRepository';delete require.cache[require.resolve(filename)];
 loader._load=function(id,...args){
  if(id==='../store/persistStorage')return {getAppStorage:()=>({getItem:async(key:string)=>{if(readGate)await readGate();if(failRead)throw Error('read failed');return data.get(key)??null;},setItem:async(key:string,value:string)=>{if(failWrite)throw Error('disk full');data.set(key,value);afterWrite();}})};
  if(id==='./localDataOwner')return {captureOwnerLease:lease,ownerLeaseIsCurrent:(value:any)=>Boolean(value&&value.ownerUserId===owner&&value.generation===generation)};
  return original.call(this,id,...args);
 };
 let api:typeof import('../../src/lib/strengthTemplateRepository');try{api=require(filename);}finally{loader._load=original;}
 return {api,data,lease,revoke:()=>{generation++;},switchOwner:()=>{owner='B';generation++;},failRead:(v:boolean)=>{failRead=v;},failWrite:(v:boolean)=>{failWrite=v;},afterWrite:(fn:()=>void)=>{afterWrite=fn;},setReadGate:(fn?:()=>Promise<void>)=>{readGate=fn;}};
}

test('saved workout writes merge fresh data, confirm readback, and replay one ID idempotently',async()=>{
 const h=harness();const a=template('A'),b=template('B');await Promise.all([h.api.saveStrengthTemplate(a),h.api.saveStrengthTemplate(b)]);
 assert.equal((await h.api.readStrengthTemplates()).length,2);await h.api.saveStrengthTemplate(a);assert.equal((await h.api.readStrengthTemplates()).length,2);
 await assert.rejects(h.api.saveStrengthTemplate({...template('a')}),/already used/);
});

test('queued saves snapshot the exact request before caller mutation',async()=>{
 const h=harness();let release!:()=>void;let first=true;const gate=new Promise<void>(resolve=>{release=resolve;});h.setReadGate(async()=>{if(first){first=false;await gate;}});
 const value=template('Original');const pending=h.api.saveStrengthTemplate(value);value.name='Mutated';value.exercises[0]!.name='Mutated exercise';release();await pending;
 const saved=await h.api.readStrengthTemplates();assert.equal(saved[0]!.name,'Original');assert.equal(saved[0]!.exercises[0]!.name,'Barbell Squat');
});

test('malformed nested records and failed reads never overwrite retained saved workouts',async()=>{
 const h=harness();const key='strength-templates:A';
 for(const bad of [null,{version:1,ownerUserId:'A',templates:[{...template(),exercises:[{}]}]},
 {version:1,ownerUserId:'A',templates:[{...template(),exercises:[{...template().exercises[0],setEntries:[{id:'s',completed:true,weightUnit:'stone'}]}]}]},
 {version:1,ownerUserId:'A',templates:[{...template(),exercises:[{...template().exercises[0],group:{id:'g',kind:'dropset'}}]}]}]){
  const raw=JSON.stringify(bad);h.data.set(key,raw);await assert.rejects(h.api.readStrengthTemplates());await assert.rejects(h.api.saveStrengthTemplate(template('New')));assert.equal(h.data.get(key),raw);
 }
 const good=JSON.stringify({version:1,ownerUserId:'A',templates:[template()]});h.data.set(key,good);h.failRead(true);await assert.rejects(h.api.saveStrengthTemplate(template('Other')),/read failed/);assert.equal(h.data.get(key),good);
});

test('owner revocation during a save cannot confirm data or write into a new owner namespace',async()=>{
 const h=harness();h.afterWrite(()=>h.switchOwner());await assert.rejects(h.api.saveStrengthTemplate(template()),/Account changed/);
 assert.ok(h.data.has('strength-templates:A'));assert.equal(h.data.has('strength-templates:B'),false);
 assert.deepEqual(await h.api.readStrengthTemplates(),[]);
});

test('revoked leases cannot read or start a later queued save even for the same owner',async()=>{
 const h=harness();const old=h.lease();h.revoke();await assert.rejects(h.api.readStrengthTemplates(old),/Account changed/);await assert.rejects(h.api.saveStrengthTemplate(template(),old),/Account changed/);assert.equal(h.data.size,0);
});

test('failed disk writes retain original data and a retry confirms the same saved workout',async()=>{
 const h=harness();const a=template();await h.api.saveStrengthTemplate(a);const before=h.data.get('strength-templates:A');const b=template('Second');h.failWrite(true);await assert.rejects(h.api.saveStrengthTemplate(b),/disk full/);assert.equal(h.data.get('strength-templates:A'),before);h.failWrite(false);await h.api.saveStrengthTemplate(b);assert.equal((await h.api.readStrengthTemplates()).length,2);
});

test('template prefix participates in owner discovery and verified cleanup without removing another owner data',()=>{
 assert.equal(isAccountDataKey('strength-templates:A'),true);assert.deepEqual(accountCleanupKeys(['strength-templates:A'],'A'),['strength-templates:A']);assert.throws(()=>accountCleanupKeys(['strength-templates:B'],'A'),/Another owner/);
 assert.match(readFileSync('src/lib/supabase.ts','utf8'),/key\.startsWith\('strength-templates:'\)/);
});
