import type { ActiveStrengthExercise, ActiveStrengthSession, ActiveSetEntry } from './strengthSession';
import { generateExerciseId, generateSetId } from './strengthSession';
import type { StrengthLogRecord, CompletedSet } from '../types/strength';

export type StrengthExerciseGroup={id:string;kind:'superset'|'circuit'};
export type PreviousSetPerformance=Pick<CompletedSet,'reps'|'weight'|'weightUnit'|'rpe'|'holdSeconds'|'distanceMeters'>;
export type SavedStrengthTemplate={id:string;ownerUserId:string;name:string;createdAt:number;updatedAt:number;
  exercises:ActiveStrengthExercise[];plannedDurationMin:number};
export function makeStrengthTemplate(session:ActiveStrengthSession,name:string,ownerUserId:string,now=Date.now()):SavedStrengthTemplate {
  const title=name.trim();if(!title||title.length>80)throw Error('Use a workout name between 1 and 80 characters.');
  if(!session.exercises.some(ex=>!ex.skipped))throw Error('Add an exercise before saving a workout.');
  const exercises=session.exercises.filter(ex=>!ex.skipped).map(ex=>({...ex,skipped:false,setEntries:ex.setEntries.map(set=>({...set}))}));
  return {id:generateExerciseId('template'),ownerUserId,name:title,createdAt:now,updatedAt:now,
    plannedDurationMin:session.plannedDurationMin,
    exercises:exercises.map(ex=>ex.group&&exercises.filter(other=>other.group?.id===ex.group?.id).length<2?{...ex,group:undefined}:ex)};
}
export function instantiateStrengthTemplate(template:SavedStrengthTemplate,history:readonly StrengthLogRecord[]=[]):ActiveStrengthExercise[] {
  const previous=[...history].filter(record=>record.templateId===template.id&&!record.skipped).sort((a,b)=>b.timestamp-a.timestamp);
  const groups=new Map<string,string>();const dropGroups=new Map<string,string>();
  return template.exercises.map(ex=>{
    const prior=previous.flatMap(record=>record.exercises).find(item=>!item.skipped&&item.templateExerciseId===ex.id&&item.exerciseId===(ex.canonicalExerciseId??ex.id)&&item.equipmentType===ex.equipmentType&&item.sets.some(set=>set.completed));
    const actual=prior?.sets.filter(set=>set.completed)??[];
    const seeds=ex.setEntries;
    const group=ex.group ? {kind:ex.group.kind,id:groups.get(ex.group.id)??generateExerciseId('group')} : undefined;
    if(ex.group&&group)groups.set(ex.group.id,group.id);
    const seedEntries:ActiveSetEntry[]=seeds.length?seeds:[{id:generateSetId(),completed:false}];
    return {...ex,id:generateExerciseId(),canonicalExerciseId:ex.canonicalExerciseId??ex.id,templateExerciseId:ex.id,group,skipped:false,
      setEntries:seedEntries.map((set,index)=>{
        const matched=actual[index]&&Boolean(actual[index]!.isWarmup)===Boolean(set.isWarmup)?actual[index]:undefined;
        const performed=matched??(set.completed?set:undefined);const quantities=performed??set;
        const priorPerformance=performed?{reps:performed.reps,weight:performed.weight,weightUnit:performed.weightUnit,rpe:performed.rpe,holdSeconds:performed.holdSeconds,distanceMeters:performed.distanceMeters}:undefined;
        const oldDrop=(set as ActiveSetEntry).dropSetGroupId;
        const drop=oldDrop?(dropGroups.get(oldDrop)??generateSetId('drop')):undefined;if(oldDrop&&drop)dropGroups.set(oldDrop,drop);
        return {id:generateSetId(),reps:quantities.reps,weight:quantities.weight,weightUnit:quantities.weightUnit,bandLevel:quantities.bandLevel,bandCustomLabel:quantities.bandCustomLabel,
          holdSeconds:quantities.holdSeconds,distanceMeters:quantities.distanceMeters,isWarmup:set.isWarmup,restSeconds:set.restSeconds,
          completed:false,rpe:undefined,rir:undefined,previousPerformance:priorPerformance,dropSetGroupId:drop};
      })};
  });
}
export function groupStrengthExercises<T extends ActiveStrengthSession>(session:T,ids:readonly string[],kind:'superset'|'circuit'|null):T {
  const chosen=new Set(ids);const eligible=session.exercises.filter(ex=>chosen.has(ex.id)&&!ex.skipped);
  if(kind&&(eligible.length<2||(kind==='superset'&&eligible.length!==2)))return session;
  const id=generateExerciseId('group');let exercises=session.exercises.map(ex=>chosen.has(ex.id)?{...ex,group:kind?{id,kind}:undefined}:ex);
  const counts=new Map<string,number>();for(const ex of exercises)if(ex.group)counts.set(ex.group.id,(counts.get(ex.group.id)??0)+1);
  exercises=exercises.map(ex=>ex.group&&(counts.get(ex.group.id)??0)<2?{...ex,group:undefined}:ex);
  return {...session,exercises};
}
export function addStrengthDropSet<T extends ActiveStrengthSession>(session:T,exerciseId:string):T {
  return {...session,exercises:session.exercises.map(ex=>{
    if(ex.id!==exerciseId||ex.skipped)return ex;
    const base=[...ex.setEntries].reverse().find(set=>!set.completed&&!set.isWarmup);
    const dropId=base?.dropSetGroupId??generateSetId('drop');
    const first=base?{...base,dropSetGroupId:dropId}:{id:generateSetId(),completed:false,dropSetGroupId:dropId};
    const extra:ActiveSetEntry={id:generateSetId(),completed:false,reps:first.reps,weightUnit:first.weightUnit,dropSetGroupId:dropId};
    return {...ex,setEntries:[...ex.setEntries.map(set=>set===base?first:set),...(!base?[first]:[]),extra]};
  })};
}
