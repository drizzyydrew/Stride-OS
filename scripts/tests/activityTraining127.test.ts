import assert from 'node:assert/strict';
import test from 'node:test';
import { ACTIVITY_EXERCISE_DEFINITIONS, ACTIVITY_PROFILE_EXERCISE_IDS } from '../../src/constants/activityExerciseBank';
import { ACTIVITY_STRENGTH_PRESETS } from '../../src/constants/activityStrengthPresets';
import { ACTIVITY_MOBILITY_PRESETS } from '../../src/constants/activityMobilityPresets';
import { MOBILITY_EXERCISES } from '../../src/constants/mobilityBank';
import { EXERCISE_ADAPTATION_OPTIONS, compatibleExerciseOptions } from '../../src/utils/exerciseAdaptation';
import { resolveExerciseMetadata } from '../../src/utils/exerciseCatalog';
import { footImpactProgressionStage, resolveStrengthPresetWorkout, strengthPresetLaunchInput } from '../../src/utils/strengthPresetProgramming';
import { summarizeExerciseVolume } from '../../src/utils/exerciseVolume';
import type { StrengthLogRecord } from '../../src/types/strength';

const now = new Date('2026-11-23T20:00:00Z').getTime();
function impact(id: string, daysAgo: number, landings = 10, response = 'usual'): StrengthLogRecord {
  const timestamp=now-daysAgo*86400000;
  return {id,sessionId:id,completed:true,timestamp,exercises:[{exerciseId:'plyo_low_pogo',name:'Low Pogo Hops',
    sets:Array.from({length:landings/5},(_,i)=>({id:`${id}-${i}`,reps:5,completed:true})),
    impactResponse:{version:1,source:'athlete_reported',landingControl:'controlled',symptomsDuring:'none',nextDayResponse:response as 'usual',reportedAt:timestamp+86400000}}]} as StrengthLogRecord;
}
const ready={strengthLevel:'intermediate' as const,fatigueScore:30,recoveryScore:85,trainingPhase:'base' as const,availableTimeMin:45};

test('sport main roles are genuinely different, known and have same-purpose adjustment guidance',()=>{
  const signatures=new Set<string>();
  for(const profile of ['hiking','downhill_skiing','snowboarding','cross_country_skiing','mountaineering'] as const){
    const ids=ACTIVITY_PROFILE_EXERCISE_IDS[profile]!;
    signatures.add(ids.slice(0,3).join(','));
    for(const id of ids){const exercise=ACTIVITY_EXERCISE_DEFINITIONS.find(item=>item.id===id)!;assert.ok(exercise);assert.equal(resolveExerciseMetadata({id}).known,true);assert.ok(exercise.progression.length>30&&exercise.regression.length>30&&exercise.substitution.length>30);}
  }
  assert.equal(signatures.size,5);
  assert.equal(resolveExerciseMetadata({id:'foot_clock_reach'}).kind,'balance');
  const seated=ACTIVITY_EXERCISE_DEFINITIONS.find(item=>item.id==='foot_loaded_seated')!;
  assert.match(seated.coachingCues.join(' '),/meaningful resistance/);
  assert.match(seated.setup,/above the knees/);
});

test('beginner and recovery module doses fit the person and launch exactly the displayed targets',()=>{
  const original=ACTIVITY_STRENGTH_PRESETS.find(item=>item.id==='sw_foot_calf_strength')!;
  const novice=resolveStrengthPresetWorkout(original,{...ready,strengthLevel:'beginner'});
  const calf=novice.workout.exercises.find(ex=>ex.name==='Loaded Supported Single-Leg Calf Raise')!;
  assert.equal(calf.sets,2);assert.equal(calf.targetRpe,6);assert.match(calf.reps,/8-12/);
  const recovery=resolveStrengthPresetWorkout(original,{...ready,recoveryLimited:true});
  assert.equal(recovery.workout.exercises.find(ex=>ex.name==='Loaded Seated Calf Raise')?.targetRpe,5);
  assert.deepEqual(strengthPresetLaunchInput(novice)?.exercises.map(ex=>[ex.sets,ex.reps,ex.plannedRpe]),novice.workout.exercises.map(ex=>[ex.sets,ex.reps,ex.targetRpe]));
  assert.equal(original.exercises.find(ex=>ex.name==='Loaded Supported Single-Leg Calf Raise')?.sets,3);
});

test('reactive dose earns only one step from consecutive full actual exposures; newer problems block old positives',()=>{
  assert.equal(footImpactProgressionStage([],now),0);
  assert.equal(footImpactProgressionStage([impact('one',3)],now),0);
  assert.equal(footImpactProgressionStage([impact('one',3),impact('one',3)],now),0);
  assert.equal(footImpactProgressionStage([impact('one',5),impact('two',3)],now),1);
  const original=impact('one',3);
  assert.equal(footImpactProgressionStage([original,{...original,id:'copied-id'}],now),0);
  assert.equal(footImpactProgressionStage([original,{...original,id:'copied-id',timestamp:now-2*86400000}],now),0);
  const badIdOnly=impact('bad-id-only',2,10,'worse');badIdOnly.exercises[0]!.name=undefined;
  assert.equal(footImpactProgressionStage([impact('one',5),impact('two',3),badIdOnly],now),0);
  assert.equal(footImpactProgressionStage([impact('one',5),impact('two',3),{...impact('incomplete',2),completed:false} as unknown as StrengthLogRecord],now),0);
  assert.equal(footImpactProgressionStage([impact('one',5),impact('two',3),{...impact('skipped',2),skipped:true}],now),0);
  assert.equal(footImpactProgressionStage([impact('one',5,15),impact('two',3,15)],now),2);
  assert.equal(footImpactProgressionStage([impact('one',5,20),impact('two',3,20)],now),3);
  assert.equal(footImpactProgressionStage([impact('one',5,20),impact('two',3,20),impact('bad',2,10,'worse')],now),0);
  assert.equal(footImpactProgressionStage([impact('one',5,20),impact('two',3,20),impact('new',0.5,10)],now),0);
  assert.equal(footImpactProgressionStage([impact('old',50,20),impact('older',55,20)],now),0);
  const preset=ACTIVITY_STRENGTH_PRESETS.find(item=>item.id==='sw_foot_reactive')!;
  for(const stage of [0,1,2,3] as const){const resolved=resolveStrengthPresetWorkout(preset,{...ready,footImpactStage:stage});
    const landings=resolved.workout.exercises.reduce((sum,ex)=>sum+ex.sets*(ex.repScheme&&'repsMin'in ex.repScheme?ex.repScheme.repsMin:0),0);
    assert.equal(landings,[10,15,20,25][stage]);assert.equal(strengthPresetLaunchInput(resolved)?.exercises.length,resolved.workout.exercises.length);
  }
});

test('balance, foot control and carrying alternatives retain their actual dose conventions',()=>{
  for(const id of ['hike_pack_carry','mountaineering_carry','ski_wall_hold'])assert.equal(EXERCISE_ADAPTATION_OPTIONS.find(item=>item.id===id)?.repScheme?.kind,'duration');
  assert.equal(EXERCISE_ADAPTATION_OPTIONS.find(item=>item.id==='foot_short_arch')?.repScheme?.kind,'reps_hold');
  const source=EXERCISE_ADAPTATION_OPTIONS.find(item=>item.id==='foot_clock_reach')!;
  const options=compatibleExerciseOptions(source,EXERCISE_ADAPTATION_OPTIONS);
  assert.ok(options.some(item=>item.id==='foot_clock_supported'));
  assert.ok(options.every(item=>/clock reach/i.test(item.name)));
  const volume=summarizeExerciseVolume([{id:'balance',sessionId:'balance',completed:true,timestamp:now,exercises:[
    {exerciseId:'foot_clock_reach',sets:[{id:'reach',reps:3,completed:true}]},
    {exerciseId:'foot_loaded_seated',sets:[{id:'calf',reps:10,weight:45,completed:true}]},
  ]} as StrengthLogRecord],now);
  assert.equal(volume.muscles.calves?.directSets,1);
  assert.equal(Object.values(volume.exercises).reduce((sum,item)=>sum+item.practiceSetsThisWeek,0),1);
});

test('each sport has usable preparation and cooldown with real exercise references and bounded durations',()=>{
  for(const profile of ['hiking','downhill_skiing','snowboarding','cross_country_skiing','mountaineering']){
    const workouts=ACTIVITY_MOBILITY_PRESETS.filter(workout=>workout.categories.includes(profile as never));assert.equal(workouts.length,2);
    for(const workout of workouts){assert.ok(workout.durationMin<=10);for(const planned of workout.exercises)assert.ok(MOBILITY_EXERCISES.find(ex=>ex.id===planned.exerciseId),planned.exerciseId);}
  }
});
