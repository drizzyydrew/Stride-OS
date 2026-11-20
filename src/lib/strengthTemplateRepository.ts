import type { SavedStrengthTemplate } from '../utils/strengthTemplates';
import { getAppStorage } from '../store/persistStorage';
import { captureOwnerLease, ownerLeaseIsCurrent, type OwnerLease } from './localDataOwner';

type Document={version:1;ownerUserId:string;templates:SavedStrengthTemplate[]};
export const strengthTemplateKey=(owner:string)=>`strength-templates:${owner}`;
let writes:Promise<unknown>=Promise.resolve();
const text=(value:unknown)=>typeof value==='string'&&value.trim().length>0;
function finiteFields(value:Record<string,unknown>,fields:readonly string[]){return fields.every(key=>value[key]===undefined||typeof value[key]==='number'&&Number.isFinite(value[key])&&(value[key] as number)>=0);}
function validTemplate(value:unknown,owner:string):value is SavedStrengthTemplate {
  if(!value||typeof value!=='object')return false;const t=value as SavedStrengthTemplate;
  if(!text(t.id)||!text(t.name)||t.name.length>80||t.ownerUserId!==owner||!Number.isFinite(t.createdAt)||!Number.isFinite(t.updatedAt)||!Number.isFinite(t.plannedDurationMin)||!Array.isArray(t.exercises)||!t.exercises.length)return false;
  const ids=new Set<string>();return t.exercises.every(ex=>{
    if(!ex||!text(ex.id)||ids.has(ex.id)||!text(ex.name)||!Array.isArray(ex.equipment)||!ex.equipment.every(item=>typeof item==='string')||!Array.isArray(ex.setEntries))return false;ids.add(ex.id);
    if(ex.canonicalExerciseId!==undefined&&!text(ex.canonicalExerciseId)||ex.templateExerciseId!==undefined&&!text(ex.templateExerciseId))return false;
    if(ex.group&&(!text(ex.group.id)||!['superset','circuit'].includes(ex.group.kind)))return false;
    const sets=new Set<string>();return ex.setEntries.every(set=>{
      if(!set||!text(set.id)||sets.has(set.id)||typeof set.completed!=='boolean'||set.isWarmup!==undefined&&typeof set.isWarmup!=='boolean')return false;sets.add(set.id);
      if(set.rpe!==undefined&&(typeof set.rpe!=='number'||set.rpe<1||set.rpe>10))return false;
      if(set.weightUnit!==undefined&&!['lb','kg'].includes(set.weightUnit))return false;
      if(set.dropSetGroupId!==undefined&&!text(set.dropSetGroupId))return false;
      if(set.previousPerformance&&(!finiteFields(set.previousPerformance as Record<string,unknown>,['reps','weight','rpe','holdSeconds','distanceMeters'])||set.previousPerformance.weightUnit!==undefined&&!['lb','kg'].includes(set.previousPerformance.weightUnit)))return false;
      return finiteFields(set as unknown as Record<string,unknown>,['reps','weight','rpe','rir','holdSeconds','distanceMeters','restSeconds']);
    });
  });
}
function assertLease(lease:OwnerLease|null):asserts lease is OwnerLease {if(!lease||!ownerLeaseIsCurrent(lease))throw Error('Account changed. Reopen Saved workouts before continuing.');}
export async function readStrengthTemplates(lease=captureOwnerLease()):Promise<SavedStrengthTemplate[]> {
  assertLease(lease);const raw=await getAppStorage().getItem(strengthTemplateKey(lease.ownerUserId));assertLease(lease);if(raw==null)return [];
  const doc=JSON.parse(raw) as Document;
  if(!doc||typeof doc!=='object'||doc.version!==1||doc.ownerUserId!==lease.ownerUserId||!Array.isArray(doc.templates)||doc.templates.some(item=>!validTemplate(item,lease.ownerUserId))||new Set(doc.templates.map(item=>item.id)).size!==doc.templates.length)throw Error('Saved workouts could not be read safely. Existing data was kept.');
  return doc.templates;
}
export function saveStrengthTemplate(template:SavedStrengthTemplate,lease=captureOwnerLease()):Promise<SavedStrengthTemplate[]> {
  try { template=JSON.parse(JSON.stringify(template)) as SavedStrengthTemplate; lease=lease?{...lease}:null; } catch { return Promise.reject(Error('This workout could not be copied safely. Existing data was kept.')); }
  const action=writes.catch(()=>undefined).then(async()=>{
    assertLease(lease);if(!validTemplate(template,lease.ownerUserId))throw Error('This workout contains invalid exercise or set data. Your existing saved workouts were kept.');if(template.ownerUserId!==lease.ownerUserId)throw Error('This saved workout belongs to a different account.');
    const prior=await readStrengthTemplates(lease);assertLease(lease);
    if(prior.some(item=>item.id!==template.id&&item.name.trim().toLowerCase()===template.name.trim().toLowerCase()))throw Error('That saved workout name is already used. Choose a different name.');
    const templates=[...prior.filter(item=>item.id!==template.id),template];const document:Document={version:1,ownerUserId:lease.ownerUserId,templates};
    await getAppStorage().setItem(strengthTemplateKey(lease.ownerUserId),JSON.stringify(document));assertLease(lease);
    const saved=await readStrengthTemplates(lease);assertLease(lease);
    if(!saved.some(item=>item.id===template.id&&JSON.stringify(item)===JSON.stringify(template)))throw Error('The saved workout is not yet confirmed. Your active workout is still available.');
    return saved;
  });writes=action.catch(()=>undefined);return action;
}
