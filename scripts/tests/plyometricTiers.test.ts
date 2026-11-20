import assert from 'node:assert/strict';
import test from 'node:test';
import { plyometricDose, isReactiveExercise, isRecordedReactiveExercise } from '../../src/utils/goalPlyometrics';
import { PLYOMETRIC_CATALOG, plyometricTask, plyometricFootContacts, nextPlyometricTask, calibratePlyometricReplacement } from '../../src/utils/plyometricCatalog';
import { normalizePlyometricResponse, type PlyometricResponseFeedback } from '../../src/utils/plyometricFeedback';
import { classifyExerciseStimulus, getExerciseAdjustment, EXERCISE_ADAPTATION_OPTIONS } from '../../src/utils/exerciseAdaptation';
import type { StrengthEngineInput, StrengthLogRecord, CompletedExercise } from '../../src/types/strength';
import type { CompletedWorkoutRecord } from '../../src/types/training';

const DAY=86400000,referenceDate='2026-08-16',NOW=new Date(`${referenceDate}T12:00:00`).getTime();
const response=(patch:Partial<PlyometricResponseFeedback>={}):PlyometricResponseFeedback=>({version:1,source:'athlete_reported',landingControl:'controlled',symptomsDuring:'none',nextDayResponse:'usual',nextStep:'repeat',reportedAt:NOW-DAY,...patch});
const sets=(reps:number)=>[{completed:true,reps,rpe:6,load:'BW'},{completed:true,reps,rpe:6,load:'BW'}];
const prepExercise=(exerciseId:string):CompletedExercise=>({exerciseId,equipmentType:'bodyweight',sets:sets(8),prescription:{sets:2,reps:'8 per side',repScheme:{kind:'reps',repsMin:8,repsMax:8,perSide:true}}});
const record=(days:number,patch:Partial<StrengthLogRecord>={}):StrengthLogRecord=>({id:`prep-${days}`,sessionId:`prep-${days}`,sessionType:'full_body',goal:'force_production',week:1,timestamp:NOW-days*DAY,completed:true,plannedDuration:40,actualDuration:40,source:'generated',fatigueBefore:20,fatigueAfter:25,fatigueDelta:5,estimatedLoad:40,
 exercises:[prepExercise('squat_box'),prepExercise('calf_single_standing'),prepExercise('lunge_reverse')],...patch});
function own(days:number,id='plyo_low_pogo',reps=6,patch:Partial<PlyometricResponseFeedback>={},exercisePatch:Partial<CompletedExercise>={}):StrengthLogRecord {
 const task=plyometricTask(id)!;
 return record(days,{id:`own-${id}-${days}`,sessionId:`own-${id}-${days}`,exercises:[{exerciseId:id,equipmentType:'bodyweight',name:task.exercise.name,
  sets:sets(reps),prescription:{sets:2,reps:`${reps}`,repScheme:{kind:'reps',repsMin:reps,repsMax:reps,perSide:task.exercise.unilateral}},impactResponse:response(patch),...exercisePatch}]});
}
const run=(days:number):CompletedWorkoutRecord=>({id:`run-${days}`,workoutId:'easy_run',type:'easy_run',intensity:'easy',durationMinutes:25,actualDurationMinutes:25,estimatedLoad:20,estimatedDistanceMiles:2,timestamp:NOW-days*DAY,week:1,completed:true,fatigueBefore:20,fatigueAfter:25,fatigueDelta:5,recoveryBefore:80,recoveryDelta:-5,rpe:4});
const input=(patch:Partial<StrengthEngineInput>={}):StrengthEngineInput=>({programmingVersion:2,goalType:'get_faster',strengthLevel:'advanced',progressionLevel:'advanced',trainingPhase:'base',currentWeek:7,weeklyMileage:20,fatigueScore:25,recoveryScore:85,soreness:1,injuryRisk:false,acwr:1,weeksToRace:0,availableTimeMin:60,availableEquipment:['bodyweight'],liftDays:['Tue','Fri'],referenceDate,
 runningHistory:Array.from({length:6},(_,w)=>[1,3].map(d=>run(w*7+d))).flat(),strengthHistory:[record(3),record(10),record(17)],...patch});
function withOwn(...logs:StrengthLogRecord[]){return input({strengthHistory:[...input().strengthHistory,...logs]});}

test('next-day self-report is explicit, at least24h later, owner-independent purevalidation and defaults repeat',()=>{
 const value=response({nextStep:undefined});assert.equal(normalizePlyometricResponse(value,NOW-3*DAY,NOW)?.nextStep,'repeat');
 for(const [patch,workout] of [[{reportedAt:NOW+1},NOW-3*DAY],[{reportedAt:NOW-DAY},NOW-DAY/2],[{nextDayResponse:'usual'},NOW-DAY/2],[{nextStep:'automatically_advance'},NOW-3*DAY]] as const) {
  assert.equal(normalizePlyometricResponse({...value,...patch},workout,NOW),undefined);
 }
 assert.equal(normalizePlyometricResponse(response({reportedAt:NOW,nextDayResponse:'unknown'}),NOW-1000,NOW)?.nextDayResponse,'unknown');
});

test('catalog has common graded tasks with explicit identities, direction and contact conventions',()=>{
 assert.equal(PLYOMETRIC_CATALOG.length,12);assert.equal(new Set(PLYOMETRIC_CATALOG.map(t=>t.exercise.id)).size,12);
 for(const tier of ['easy','medium','hard']) assert.ok(PLYOMETRIC_CATALOG.filter(t=>t.tier===tier).length>=3);
 for(const task of PLYOMETRIC_CATALOG) {
  assert.equal(classifyExerciseStimulus(task.exercise)?.stimulus,'power',task.exercise.name);assert.ok(isReactiveExercise(task.exercise));assert.ok(isRecordedReactiveExercise({exerciseId:task.exercise.id}));
  assert.equal(plyometricFootContacts(task,2,task.initialReps),task.initialReps*4);
  assert.doesNotMatch(task.exercise.name,/depth|drop/i);
 }
 assert.equal(nextPlyometricTask(plyometricTask('plyo_forward_hops')!)?.exercise.id,'plyo_single_forward');
 assert.equal(nextPlyometricTask(plyometricTask('plyo_quick_pogo')!)?.exercise.id,'plyo_single_pogo');
 assert.equal(nextPlyometricTask(plyometricTask('plyo_squat_jumps')!),undefined);
});

test('three own controlled symptom-free next-day reports earn small contact increase, never attendance/RPE alone',()=>{
 assert.equal(plyometricDose(withOwn(own(4,undefined,5),own(11,undefined,5),own(18,undefined,5)))?.reps,6);
 assert.equal(plyometricDose(withOwn(...[4,11,18].map(d=>own(d,undefined,6))))?.reps,7);
 for(const patch of [{landingControl:'uncertain' as const},{symptomsDuring:'unknown' as const},{nextDayResponse:'unknown' as const}]) {
  const result=plyometricDose(withOwn(...[4,11,18].map(d=>own(d,undefined,6,patch))));assert.equal(result?.reps,5);
 }
});

test('Medium requires explicit request and repeated latest own dose, retaining practiced role with smaller volume',()=>{
 const repeated=[own(4,undefined,6),own(11,undefined,6),own(18,undefined,6)];
 assert.equal(plyometricDose(withOwn(...repeated))?.task.tier,'easy');
 const medium=plyometricDose(withOwn(own(4,undefined,6,{nextStep:'consider_harder'}),...repeated.slice(1)))!;
 assert.equal(medium.task.exercise.id,'plyo_quick_pogo');assert.equal(medium.reps,3);
 assert.ok(plyometricFootContacts(medium.task,2,medium.reps)<plyometricFootContacts(plyometricTask('plyo_low_pogo')!,2,6));
 const line=plyometricDose(withOwn(...[4,11,18].map(d=>own(d,'plyo_line_hops',6,{nextStep:d===4?'consider_harder':'repeat'}))))!;
 assert.equal(line.task.exercise.id,'plyo_forward_hops');
 const short=plyometricDose(withOwn(own(3,undefined,1,{nextStep:'consider_harder'}),...repeated))!;
 assert.equal(short.task.tier,'easy');assert.ok(short.reps<=2);
});

test('Hard needs specific unilateral foundation, sustained running and explicit controlled Medium response',()=>{
 const logs=[4,11,18].map(d=>own(d,'plyo_quick_pogo',4,{nextStep:d===4?'consider_harder':'repeat'}));
 const hard=plyometricDose(withOwn(...logs))!;assert.equal(hard.task.exercise.id,'plyo_single_pogo');assert.equal(hard.reps,2);assert.equal(plyometricFootContacts(hard.task,2,hard.reps),8);
 const missingSides=input({strengthHistory:input().strengthHistory.map(r=>({...r,exercises:r.exercises.map(e=>({...e,prescription:undefined}))})).concat(logs)});
 assert.equal(plyometricDose(missingSides)?.task.tier,'medium');
 assert.equal(plyometricDose({...withOwn(...logs),runningHistory:input().runningHistory!.filter(r=>r.timestamp>NOW-14*DAY)})?.task.tier,'medium');
 const incomplete=input({strengthHistory:input().strengthHistory.map(r=>({...r,exercises:r.exercises.map(e=>e.exerciseId==='lunge_reverse'?{...e,sets:[e.sets[0]!,{...e.sets[1]!,completed:false}]}:e)})).concat(logs)});
 assert.equal(plyometricDose(incomplete)?.task.tier,'medium');
});

test('Hard own work needs per-leg convention and response; regress keeps contact total bounded',()=>{
 const h=own(4,'plyo_single_pogo',2,{nextStep:'easier'});
 const regressed=plyometricDose(withOwn(h))!;assert.equal(regressed.task.tier,'medium');assert.equal(regressed.reps,2);
 assert.ok(plyometricFootContacts(regressed.task,2,regressed.reps)<=8);
 const noSides=own(4,'plyo_single_pogo',2,{}, {prescription:undefined});assert.equal(plyometricDose(withOwn(noSides)),null);
 const unknown=own(4,'plyo_single_pogo',2,{nextDayResponse:'unknown'});assert.equal(plyometricDose(withOwn(unknown)),null);
});

test('same-day and duplicate scheduled exposures do not earn a tier',()=>{
 const three=[own(4,undefined,6,{nextStep:'consider_harder'}),own(11,undefined,6),own(18,undefined,6)];
 const sameDay=three.map((r,n)=>({...r,timestamp:NOW-4*DAY+n*1000}));
 assert.equal(plyometricDose(withOwn(...sameDay))?.task.tier,'easy');
 const duplicate=three.map(r=>({...r,scheduledSessionId:'week:same:strength:one'}));
 assert.equal(plyometricDose(withOwn(...duplicate))?.task.tier,'easy');
});

test('new variants calibrate separately, stale foreign role preferences cannot select an inappropriate task',()=>{
 const i=withOwn(own(4,undefined,6),own(11,undefined,6),own(18,undefined,6));
 assert.equal(plyometricDose({...i,exercisePreferences:{plyo_low_pogo:'plyo_line_hops'}})?.reps,5);
 assert.equal(plyometricDose({...i,exercisePreferences:{plyo_low_pogo:'plyo_squat_jumps'}})?.task.exercise.id,'plyo_low_pogo');
 const medium=withOwn(...[4,11,18].map(d=>own(d,'plyo_forward_hops',4)));
 assert.equal(plyometricDose({...medium,exercisePreferences:{plyo_forward_hops:'plyo_squat_jumps'}})?.task.exercise.id,'plyo_forward_hops');
});

test('adverse legacy/custom feedback cannot be cleared by an unrelated tiny positive report or old Hard work',()=>{
 const old=own(30,'plyo_single_pogo',3);
 const bad=record(20,{id:'boxbad',exercises:[{exerciseId:'b_box_jump',name:'Box Jump',equipmentType:'bodyweight',sets:sets(3),impactResponse:response({symptomsDuring:'present'})}]});
 const tiny=record(3,{id:'tiny',exercises:[{exerciseId:'custom',name:'Pogo Hops',equipmentType:'bodyweight',sets:[{completed:true,reps:1,rpe:2}],impactResponse:response()}]});
 assert.equal(plyometricDose(withOwn(old,bad,tiny)),null);
 const reset=plyometricDose(withOwn(old,bad,tiny,own(4,'plyo_low_pogo',5),own(11,'plyo_low_pogo',5)))!;
 assert.equal(reset.task.exercise.id,'plyo_low_pogo');assert.equal(reset.reps,5);
});

test('adjustment choices label mechanically compatible tasks and never raise demand for dislike/hard/equipment',()=>{
 for(const task of PLYOMETRIC_CATALOG) {
  for(const reason of ['too_hard','dislike','equipment'] as const) {
   const a=getExerciseAdjustment({exercise:task.exercise,reason,candidates:EXERCISE_ADAPTATION_OPTIONS,availableEquipment:['bodyweight']});
   const rank={easy:0,medium:1,hard:2};
   assert.ok(a.options.every(e=>!plyometricTask(e.id)||rank[plyometricTask(e.id)!.tier]<=rank[task.tier]),`${task.exercise.name} ${reason}`);
  }
 }
});


test('old larger doses cannot overpower the latest reduced actual work or unknown response',()=>{
 const old=[own(10,undefined,8),own(17,undefined,8),own(24,undefined,8)];
 const low=plyometricDose(withOwn(own(3,undefined,1,{nextStep:'consider_harder'}),...old))!;
 assert.equal(low.task.tier,'easy');assert.ok(low.reps<=2);
 const unknown=plyometricDose(withOwn(own(3,undefined,1,{nextDayResponse:'unknown'}),...old))!;assert.equal(unknown.reps,1);
 const six=plyometricDose(withOwn(own(3,undefined,6),...old))!;assert.ok(six.reps<=7);
});

test('compatible replacement calibrates its own dose without increasing remaining contacts',()=>{
 const task=plyometricTask('plyo_line_hops')!;
 assert.equal(calibratePlyometricReplacement(task,[1,1],true).repScheme.repsMax,1);
 assert.equal(calibratePlyometricReplacement(task,[5,5],true).repScheme.repsMax,4);
 assert.equal(calibratePlyometricReplacement(task,[2,2]).repScheme.repsMax,2);
 const single=calibratePlyometricReplacement(plyometricTask('plyo_single_lateral')!,[3,3],true);
 assert.equal(single.repScheme.perSide,true);assert.equal(single.repScheme.repsMax,2);
 const guidance=getExerciseAdjustment({exercise:task.exercise,reason:'too_easy'}).guidance;
 assert.match(guidance,/Do not add external load/);
});
