import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { buildMacroPlan, macroWeekForDate } from '../../src/utils/plan/macroPlanner';
import { generateStrengthWeek, STRENGTH_EXERCISES } from '../../src/utils/strengthEngine';
import { applyGoalPlyometrics, INTRO_PLYOMETRIC, isReactiveExercise, plyometricDose } from '../../src/utils/goalPlyometrics';
import { estimateStrengthSessionMinutes } from '../../src/utils/strengthDesign';
import { runningSpecificityDecision } from '../../src/utils/training/runningSpecificity';
import { compatibleExerciseOptions, EXERCISE_ADAPTATION_OPTIONS } from '../../src/utils/exerciseAdaptation';
import { onboardingGoalDraft } from '../../src/utils/pro-access';
import { classifySessionStress } from '../../src/utils/sessionStress';
import { buildWeekPlan, type EngineInput } from '../../src/utils/trainingEngine';
import { strengthScheduledSessionId } from '../../src/utils/scheduledSessionIds';
import { balanceHybridStrength } from '../../src/utils/hybridStrengthSchedule';
import type { StrengthEngineInput, StrengthLogRecord, CompletedExercise, StrengthSession } from '../../src/types/strength';
import type { CompletedWorkoutRecord } from '../../src/types/training';
import type { WorkoutEngineInput } from '../../src/types/workout';
import type { CalendarEntry } from '../../src/utils/calendarEngine';
import type { ScheduledSession } from '../../src/utils/scheduledSessions';

const DAY=86400000, referenceDate='2026-08-16', NOW=new Date(`${referenceDate}T12:00:00`).getTime();
const set=(reps=8,rpe=6)=>({completed:true,reps,rpe,load:'BW'});
const completedExercise=(exerciseId:string):CompletedExercise=>({exerciseId,equipmentType:'bodyweight',sets:[set(),set()]});
const record=(days:number, patch:Partial<StrengthLogRecord>={}):StrengthLogRecord=>({id:`strength-${days}`,sessionId:`s-${days}`,sessionType:'full_body',goal:'force_production',week:1,timestamp:NOW-days*DAY,completed:true,plannedDuration:40,actualDuration:40,source:'generated',fatigueBefore:20,fatigueAfter:25,fatigueDelta:5,estimatedLoad:40,
 exercises:[completedExercise('squat_box'),completedExercise('calf_single_standing')],...patch});
const run=(days:number):CompletedWorkoutRecord=>({id:`run-${days}`,workoutId:'easy_run',type:'easy_run',intensity:'easy',durationMinutes:25,actualDurationMinutes:25,estimatedLoad:20,estimatedDistanceMiles:2,timestamp:NOW-days*DAY,week:1,completed:true,fatigueBefore:20,fatigueAfter:25,fatigueDelta:5,recoveryBefore:80,recoveryDelta:-5,rpe:4});
const running=()=>[1,3,8,10].map(run);
const input=(patch:Partial<StrengthEngineInput>={}):StrengthEngineInput=>({programmingVersion:2,goalType:'get_faster',strengthLevel:'beginner',progressionLevel:'beginner',trainingPhase:'base',currentWeek:7,weeklyMileage:12,fatigueScore:25,recoveryScore:85,soreness:1,injuryRisk:false,acwr:1,weeksToRace:0,availableTimeMin:60,availableEquipment:['bodyweight'],liftDays:['Tue','Fri'],referenceDate,runningHistory:running(),strengthHistory:[record(3),record(10)],...patch});
const own=(days:number,reps:number,patch:Partial<CompletedExercise>={}):StrengthLogRecord=>record(days,{exercises:[{...completedExercise(INTRO_PLYOMETRIC.id),sets:[set(reps),set(reps)],...patch}]});

test('Get faster is selectable without a race, survives setup draft and has speed-focused macro blocks',()=>{
 for(const f of ['app/onboarding/goal.tsx','app/(tabs)/settings/next-goal.tsx','app/(tabs)/settings/index.tsx']) assert.match(readFileSync(f,'utf8'),/'get_faster'/);
 const draft=onboardingGoalDraft({source:'onboarding',openTraining:true,hasProgrammedBefore:false,today:'2026-08-16',data:{goalType:'get_faster'}});
 assert.equal(draft?.goalType,'get_faster');assert.equal(draft?.raceDate,undefined);
 const p=buildMacroPlan({goalType:'get_faster',programmingVersion:2,startDate:'2026-01-04',races:[],progressionLevel:'intermediate',yearsRunning:2,weeklyMileage:20});
 assert.equal(p.goalType,'get_faster');assert.equal(p.targetRaceId,undefined);
 assert.deepEqual([0,6,12,18].map(i=>p.weeks[i]!.phase),['aerobic_development','threshold','vo2','base']);
 assert.ok(p.weeks.filter(w=>w.isDeload).length>=10);assert.match(p.weeks[6]!.focus,/Get faster/);
 const extended=macroWeekForDate(p,new Date('2027-03-21T12:00:00'))!;
 assert.match(extended.focus,/Get faster|Deload/);assert.ok(extended.mesocycle);
 const beginner=buildMacroPlan({goalType:'get_faster',programmingVersion:2,startDate:'2026-01-04',races:[],progressionLevel:'beginner',yearsRunning:0,weeklyMileage:2});
 assert.ok(beginner.weeks.slice(0,6).every(w=>['foundation','deload'].includes(w.phase)));
});

test('speed goal does not turn absent history or base-only preference into hard workouts',()=>{
 const workout={...input(),calibration:null,fatigueSensitivity:1,recoveryResponsiveness:1,goalRace:'general_fitness',weeksToRace:0,recentIntensityDist:{easy:1,moderate:0,hard:0},recentHardSessions:0,adherenceRate:1,consistencyScore:90,longRunConsistency:1,trainingStyle:'mixed',motivation:8,trainingPhase:'vo2',currentWeek:20} as WorkoutEngineInput;
 assert.equal(runningSpecificityDecision({...workout,runningHistory:[]}).stage,'easy');
 assert.equal(runningSpecificityDecision({...workout,trainingStyle:'base_only'}).stage,'easy');
 assert.equal(runningSpecificityDecision(workout).stage,'strides');
});

test('small bilateral introduction needs real lower/calf sets and recent running, not calendar or labels',()=>{
 assert.deepEqual(plyometricDose(input())?.reps,5);
 for(const patch of [{strengthHistory:[]},{runningHistory:[]},{strengthHistory:[record(3)]},{strengthHistory:[record(3),record(3,{id:'duplicate-same-day'})]},
 {strengthHistory:[record(50),record(60)]},{strengthHistory:[record(-1),record(-2)]},
 {strengthHistory:[record(3,{exercises:[completedExercise('squat_box')]}),record(10)]}]) assert.equal(plyometricDose(input(patch)),null);
 for(const mutate of [ (ex:CompletedExercise)=>({...ex,sets:ex.sets.map(s=>({...s,rpe:undefined}))}),
 (ex:CompletedExercise)=>({...ex,sets:[set(),{...set(),completed:false}]}),
 (ex:CompletedExercise)=>({...ex,sets:ex.sets.map(s=>({...s,holdSeconds:30}))}),
 (ex:CompletedExercise)=>({...ex,equipmentType:undefined}),
 (ex:CompletedExercise)=>({...ex,sets:ex.sets.map(s=>({...s,load:'unknown'}))}),
 (ex:CompletedExercise)=>({...ex,sets:ex.sets.map(s=>({...s,weight:Number.NaN}))}) ]) {
  const history=[3,10].map(d=>record(d,{exercises:[completedExercise('squat_box'),mutate(completedExercise('calf_single_standing'))]}));
  assert.equal(plyometricDose(input({strengthHistory:history})),null);
 }
});

test('current readiness, symptom and recovery phases hold impact even with advanced labels',()=>{
 const patches:Partial<StrengthEngineInput>[]=[{programmingVersion:1},{goalType:'general_strength'},{currentWeek:2},{trainingPhase:'foundation'},{currentWeek:8},{trainingPhase:'taper'},
 {trainingPhase:'recovery'},{recoveryScore:69},{recoveryScore:101},{recoveryScore:Number.NaN},{fatigueScore:51},{fatigueScore:-1},{fatigueScore:Number.NaN},
 {acwr:1.31},{acwr:-1},{acwr:Number.NaN},{soreness:null},{soreness:4},{soreness:Number.NaN},{injuryRisk:true},{availableTimeMin:20},{availableTimeMin:Number.NaN},{weeksToRace:2}];
 for(const patch of patches) assert.equal(plyometricDose(input({...patch,strengthLevel:'advanced'})),null,JSON.stringify(patch));
});

test('unknown landing and next-day responses cannot earn contact increases; setup remains specific',()=>{
 assert.equal(plyometricDose(input({strengthHistory:[record(3),record(10),own(4,5)]}))?.reps,5);
 assert.equal(plyometricDose(input({strengthHistory:[record(3),record(10),own(4,5),own(11,5)]}))?.reps,5);
 assert.equal(plyometricDose(input({strengthHistory:[record(3),record(10),own(4,6),own(11,6)]}))?.reps,5);
 const wrong=own(4,20,{exerciseId:'calf_pogo'});
 assert.equal(plyometricDose(input({strengthHistory:[record(3),record(10),wrong,{...wrong,id:'other',timestamp:NOW-11*DAY}]}))?.reps,5);
 for(const exPatch of [{equipmentType:'dumbbell' as const},{sets:[set(6),{...set(6),completed:false}]},{sets:[set(6),{...set(6),rpe:9}]},{sets:[set(6),{...set(6),weight:5,weightUnit:'kg' as const}]}]) {
  assert.equal(plyometricDose(input({strengthHistory:[record(3),record(10),own(1,6,exPatch),own(11,6)]})),null);
 }
});

test('generated plyos are first, low volume, at most once weekly, fit time and preserve legacy plans',()=>{
 for(const minutes of [15,25,30,45,60]) {
  const i=input({availableTimeMin:minutes});const week=generateStrengthWeek(i);
  const reactive=week.sessions.flatMap(s=>s.exercises.filter(ex=>isReactiveExercise(ex.exercise)));
  assert.ok(reactive.length<=1);assert.ok(week.sessions.every(s=>estimateStrengthSessionMinutes(s.exercises)<=minutes));
  for(const s of week.sessions) if(s.exercises.some(ex=>isReactiveExercise(ex.exercise))) {
   assert.equal(s.exercises[0]!.exerciseId,INTRO_PLYOMETRIC.id);assert.equal(s.exercises[0]!.sets,2);assert.deepEqual(s.exercises[0]!.repRange,[5,5]);
   assert.match(s.exercises[0]!.coachingCues.join(' '),/Skip|skip/);assert.match(s.exercises[0]!.regressionRule,/different stimulus/);
  }
 }
 assert.equal(generateStrengthWeek(input()).sessions.flatMap(s=>s.exercises).filter(e=>isReactiveExercise(e.exercise)).length,1);
 const noData=generateStrengthWeek(input({strengthLevel:'advanced',strengthHistory:[],trainingPhase:'threshold'}));
 assert.ok(noData.sessions.every(s=>s.exercises.every(ex=>!isReactiveExercise(ex.exercise))));
 const old=generateStrengthWeek(input({programmingVersion:1,strengthLevel:'advanced',progressionLevel:'advanced',trainingPhase:'threshold'}));
 assert.ok(old.sessions.some(s=>s.exercises.some(ex=>isReactiveExercise(ex.exercise))));
});

test('an earned regression cannot reintroduce new impact after dose reduction',()=>{
 const today=new Date().toISOString().slice(0,10), shift=new Date(`${today}T12:00:00`).getTime()-NOW;
 const shiftRecord=(r:StrengthLogRecord)=>({...r,timestamp:r.timestamp+shift});
 const i=input({referenceDate:today,runningHistory:running().map(r=>({...r,timestamp:r.timestamp+shift})),strengthHistory:[record(3,{overallRpe:9}),record(10,{overallRpe:9})].map(shiftRecord)});
 const week=generateStrengthWeek(i);assert.equal(week.progressionState,'regress');
 assert.ok(week.sessions.every(s=>s.exercises.every(ex=>!isReactiveExercise(ex.exercise))));
});

test('reactive detection beats mislabeled calf/mobility recovery and reduced-support flags',()=>{
 const base=generateStrengthWeek(input()).sessions[0]!;
 const pogo={...base.exercises[0]!,exercise:{...INTRO_PLYOMETRIC,name:'Pogo Hops',pattern:'mobility' as const},sets:1,rpe:4};
 const session:StrengthSession={...base,title:'Recovery',lowerDemand:'reduced_support',exercises:[pogo]};
 const scheduled={activityType:'strength',subtype:'prehab',title:'Recovery',durationMinutes:10,strengthSession:session} as ScheduledSession;
 const stress=classifySessionStress(scheduled);assert.equal(stress.classification,'hard');assert.equal(stress.axes.impact,3);
 assert.ok(isReactiveExercise(STRENGTH_EXERCISES.calf_pogo!));
});

test('calendar balancing removes reactive calf and plyo work around key runs',()=>{
 const base=generateStrengthWeek(input()).sessions[0]!;
 const legacyPogo={...base.exercises[0]!,exerciseId:'calf_pogo',exercise:STRENGTH_EXERCISES.calf_pogo!};
 const session={...base,exercises:[legacyPogo,...base.exercises.slice(1)]};
 const map=new Map<string,CalendarEntry[]>([
 ['2026-08-17',[{date:'2026-08-17',type:'strength',label:'Recovery',completed:false,session} as CalendarEntry]],
 ['2026-08-18',[{date:'2026-08-18',type:'run',label:'Threshold',completed:false,workout:{id:'run',type:'threshold',durationMinutes:30,richType:'threshold'}} as CalendarEntry]]]);
 const result=balanceHybridStrength({calendarMap:map,weekStart:new Date('2026-08-16T12:00:00'),liftDays:['Mon'],today:'2026-08-16'});
 const kept=[...result.calendarMap.values()].flat().find(e=>e.session)?.session!;
 assert.ok(kept.exercises.every(ex=>!isReactiveExercise(ex.exercise)));
});

test('plyometric alternatives preserve reactive role; calf strength is not sold as an equivalent',()=>{
 const options=compatibleExerciseOptions(INTRO_PLYOMETRIC,EXERCISE_ADAPTATION_OPTIONS,{availableEquipment:['bodyweight']});
 assert.ok(options.length>=1);assert.ok(options.every(ex=>/pogo|line hops/i.test(ex.name)));
 assert.ok(options.every(ex=>!/calf raise|single.leg|depth|box/i.test(ex.name)));
});


test('already performed impact and active strength prevent an extra generated jump slot this week',()=>{
 const base=generateStrengthWeek(input());
 const other=own(0,5,{name:'Low Pogo Hops'});
 const i=input({strengthHistory:[record(3),record(10),{...other,sessionId:'a-custom-workout',timestamp:NOW-1000}]});
 assert.ok(generateStrengthWeek(i).sessions.every(s=>s.exercises.every(e=>!isReactiveExercise(e.exercise))));
 const active=generateStrengthWeek(input({activeStrengthSessionId:base.sessions[0]!.id}));
 assert.ok(active.sessions.every(s=>s.exercises.every(e=>!isReactiveExercise(e.exercise))));
 const linked={...other,sessionId:base.sessions[0]!.id,timestamp:NOW-1000};
 const retained=generateStrengthWeek(input({strengthHistory:[record(3),record(10),linked]}));
 assert.equal(retained.sessions.flatMap(s=>s.exercises).filter(e=>isReactiveExercise(e.exercise)).length,0);
});


test('weekly impact cap normalizes midweek and omitted reference dates to local Sunday',()=>{
 const day=new Date();day.setHours(12,0,0,0);const today=`${day.getFullYear()}-${String(day.getMonth()+1).padStart(2,'0')}-${String(day.getDate()).padStart(2,'0')}`;
 const shift=day.getTime()-NOW;
 const futureInput=input({referenceDate:today,runningHistory:running().map(r=>({...r,timestamp:r.timestamp+shift})),strengthHistory:[record(3),record(10)].map(r=>({...r,timestamp:r.timestamp+shift}))});
 const justPerformed={...own(0,5),timestamp:Date.now()-1000};
 for(const referenceDate of [today,undefined]) {
  const week=generateStrengthWeek({...futureInput,referenceDate,strengthHistory:[...futureInput.strengthHistory,justPerformed]});
  assert.ok(week.sessions.every(s=>s.exercises.every(e=>!isReactiveExercise(e.exercise))));
 }
});

test('real weekly calendar retains exact completion and does not add impact after availability changes',()=>{
 const i:EngineInput={referenceDate,goalType:'get_faster',goalScopeId:'speed-integration',strengthProgrammingVersion:2,trainingMode:'structured',goalRace:'general_fitness',
 weeklyMileage:12,fatigueScore:25,recoveryScore:85,currentWeek:7,trainingPhase:'base',progressionLevel:'beginner',
 macroWeek:{weekNumber:7,startDate:referenceDate,phase:'base',isDeload:false,isTaper:false,isRaceWeek:false,focus:'Speed foundation'},
 beforeStart:false,programStartDate:'2026-07-05',races:[],calibration:null,fatigueSensitivity:1,recoveryResponsiveness:1,returningFromInjury:false,
 availableDays:['Mon','Tue','Wed','Thu','Fri','Sat'],runDays:['Wed','Sat'],liftDays:['Mon','Thu'],trainingStyle:'base_only',primaryGoal:'general_fitness',hasCurrentInjury:false,
 strengthLevel:'beginner',strengthSessionMinutes:60,strengthEquipment:['bodyweight'],soreness:1,motivation:8,acwr:1,recentIntensityDist:{easy:12,moderate:0,hard:0},recentHardSessions:0,
 adherenceRate:1,consistencyScore:90,longRunConsistency:1,completedWorkoutKeys:[],completedStrengthKeys:[],strengthHistory:[record(3),record(10)],runningHistory:running()};
 const first=buildWeekPlan(i),original=[...first.calendarMap.values()].flat().find(e=>e.session?.exercises.some(ex=>isReactiveExercise(ex.exercise)));
 assert.ok(original?.session);
 const logged={...own(0,5),sessionId:original.session.id,scheduledSessionId:strengthScheduledSessionId(original.date,original.session.id),timestamp:new Date(`${original.date}T12:00:00`).getTime()};
 const capture=JSON.stringify(logged);
 const same=buildWeekPlan({...i,strengthHistory:[...i.strengthHistory,logged]});
 const retained=[...same.calendarMap.values()].flat().find(e=>e.session?.id===original.session!.id);
 assert.equal(retained?.completed,true);
 assert.ok([...same.calendarMap.values()].flat().filter(e=>!e.completed).every(e=>!e.session?.exercises.some(ex=>isReactiveExercise(ex.exercise))));
 const moved=buildWeekPlan({...i,liftDays:['Tue','Fri'],strengthHistory:[...i.strengthHistory,logged]});
 assert.ok([...moved.calendarMap.values()].flat().filter(e=>!e.completed).every(e=>!e.session?.exercises.some(ex=>isReactiveExercise(ex.exercise))));
 assert.equal(JSON.stringify(logged),capture);
});
