import { isValidDateOnly, dateOnlyToLocalTimestamp } from './dateOnly';
import { sundayOf } from './calendarEngine';
import type { CompletedExercise, StrengthLogRecord } from '../types/strength';
import type { CustomWorkoutLog } from '../types/customWorkout';
import { exerciseIdentity, resolveExerciseMetadata } from './exerciseCatalog';

export type MuscleVolume = { directSets:number; supportingSets:number; practiceSets:number };
export type ExerciseVolume = { sessions:number; workingSetsThisWeek:number; practiceSetsThisWeek:number; dropStagesThisWeek:number };
export type WeeklyExerciseVolume = { weekStartsAt:number; muscles:Record<string,MuscleVolume>; exercises:Record<string,ExerciseVolume>; unclassifiedSets:number };
export function localWeekStart(now:number):number { return sundayOf(new Date(now)).getTime(); }
function actualSets(ex:CompletedExercise, row:number, ids=new Set<string>(), drops=new Set<string>()) {
  let working=0,dropStages=0;
  for (const [index,set] of ex.sets.entries()) {
    if (!set.completed || set.isWarmup || ![set.reps,set.holdSeconds,set.distanceMeters].some(value=>typeof value==='number'&&Number.isFinite(value)&&value>0)) continue;
    const id=set.id??`row:${row}:${index}`;if(ids.has(id))continue;ids.add(id);
    const drop=(set as typeof set & {dropSetGroupId?:string}).dropSetGroupId;
    if(drop){dropStages++;if(drops.has(drop))continue;drops.add(drop);}
    working++;
  }
  return {working,dropStages};
}
/** Actual saved sets only. No prescribed sets, warm-ups, estimated muscle activation or universal dose target. */
export function summarizeExerciseVolume(history:readonly StrengthLogRecord[], now=Date.now(), customLogs:readonly CustomWorkoutLog[]=[]):WeeklyExerciseVolume {
  const result:WeeklyExerciseVolume={weekStartsAt:localWeekStart(now),muscles:{},exercises:{},unclassifiedSets:0};
  const records=new Map<string,{id:string;sessionId?:string;timestamp:number;skipped?:boolean;exercises:CompletedExercise[]}>();
  for(const record of history){if(!record||record.completed!==true||!Number.isFinite(record.timestamp)||record.timestamp>now)continue;const key=record.id||`${record.sessionId??'legacy'}@${record.timestamp}`;const prior=records.get(key);if(!prior||record.timestamp>=prior.timestamp)records.set(key,record);}
  for(const log of customLogs){if(log.category!=='strength'||!Number.isFinite(log.completedAt)||log.completedAt>now||!isValidDateOnly(log.date))continue;
    const performedAt=dateOnlyToLocalTimestamp(log.date,0);if(performedAt>now)continue;
    // These legacy logs are a separate source; only an explicit identical ID can link them.
    if([...records.values()].some(record=>record.id===log.id||record.sessionId===log.id))continue;
    records.set(`custom-log:${log.id}`,{id:log.id,timestamp:performedAt,exercises:(log.exercises??[]).map(ex=>({exerciseId:ex.exerciseId??'',name:ex.exerciseName,sets:ex.sets.map(set=>({...set}))}))});
  }
  for(const record of records.values()){
    if(record.skipped)continue;const thisWeek=record.timestamp>=result.weekStartsAt;const seen=new Set<string>();const setIds=new Map<string,Set<string>>(),dropIds=new Map<string,Set<string>>();
    for(const [row,ex] of (record.exercises??[]).entries()){if(ex.skipped)continue;const key=exerciseIdentity({id:ex.exerciseId,name:ex.name});
      const ids=setIds.get(key)??new Set<string>(),drops=dropIds.get(key)??new Set<string>();setIds.set(key,ids);dropIds.set(key,drops);
      const actual=actualSets(ex,row,ids,drops);if(!actual.working&&!actual.dropStages)continue;
      const metadata=resolveExerciseMetadata({id:ex.exerciseId,name:ex.name});
      const volume=result.exercises[key]??={sessions:0,workingSetsThisWeek:0,practiceSetsThisWeek:0,dropStagesThisWeek:0};
      if(!seen.has(key)){volume.sessions++;seen.add(key);}if(!thisWeek)continue;
      const practice=['mobility','power','balance'].includes(metadata.kind);
      if(practice)volume.practiceSetsThisWeek+=actual.working;else volume.workingSetsThisWeek+=actual.working;
      volume.dropStagesThisWeek+=actual.dropStages;
      if(!metadata.known){result.unclassifiedSets+=actual.working;continue;}
      const primary=practice?metadata.mobilityTargets.length?metadata.mobilityTargets:metadata.primaryMuscles:metadata.primaryMuscles;
      for(const muscle of primary){const v=result.muscles[muscle]??={directSets:0,supportingSets:0,practiceSets:0};if(practice)v.practiceSets+=actual.working;else v.directSets+=actual.working;}
      if(!practice)for(const muscle of metadata.supportMuscles.filter(muscle=>!primary.includes(muscle))){const v=result.muscles[muscle]??={directSets:0,supportingSets:0,practiceSets:0};v.supportingSets+=actual.working;}
    }
  }
  return result;
}


/** A display-only reference; changes in setup receive no automatic load transfer. */
export function lastRecordedExercise(history:readonly StrengthLogRecord[],input:{id?:string;name?:string},equipmentType:string|undefined,now=Date.now()) {
  if(!equipmentType||equipmentType==='other')return null;const key=exerciseIdentity(input);
  for(const record of [...history].filter(record=>record.completed===true&&!record.skipped&&record.timestamp<=now).sort((a,b)=>b.timestamp-a.timestamp)){
    const exercise=record.exercises.find(ex=>!ex.skipped&&ex.equipmentType===equipmentType&&exerciseIdentity({id:ex.exerciseId,name:ex.name})===key);
    const sets=exercise?.sets.filter(set=>set.completed&&!set.isWarmup&&[set.reps,set.holdSeconds,set.distanceMeters].some(value=>typeof value==='number'&&value>0));
    if(sets?.length)return {timestamp:record.timestamp,sets};
  }
  return null;
}
