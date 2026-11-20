import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import { EXPANDED_EXERCISE_CATALOG, exerciseIdentity, resolveExerciseMetadata } from '../../src/utils/exerciseCatalog';
import { summarizeExerciseVolume, localWeekStart, lastRecordedExercise } from '../../src/utils/exerciseVolume';
import { STRENGTH_EXERCISES } from '../../src/utils/strengthEngine';
import { STRENGTH_PRESET_WORKOUTS } from '../../src/constants/strengthBank';
import { MOBILITY_EXERCISES } from '../../src/constants/mobilityBank';
import { EXERCISE_ADAPTATION_OPTIONS, classifyExerciseStimulus } from '../../src/utils/exerciseAdaptation';
import { addExercise, duplicateSet, removeExercise, ensureExerciseShape, type ActiveStrengthSession } from '../../src/utils/strengthSession';
import { completedExercisesFromActiveSession } from '../../src/utils/strengthPersistence';
import { addStrengthDropSet, groupStrengthExercises, instantiateStrengthTemplate, makeStrengthTemplate } from '../../src/utils/strengthTemplates';
import { strengthWeightForDisplay } from '../../src/utils/strengthDesign';
import type { CompletedExercise, StrengthLogRecord } from '../../src/types/strength';
const now=new Date(2026,10,20,12).getTime();
const actual=(id:string,extra:Record<string,unknown>={})=>({id,reps:8,weight:100,weightUnit:'lb' as const,rpe:8,completed:true,...extra});
function record(id:string,exercises:CompletedExercise[],timestamp=now):StrengthLogRecord{return {id,sessionId:id,timestamp,completed:true,exercises} as StrengthLogRecord;}
function session():ActiveStrengthSession {
 return {workoutId:'custom',workoutName:'My strength',plannedDurationMin:30,exercises:[
  {id:'a',canonicalExerciseId:'b_squat',name:'Barbell Squat',equipment:['barbell'],equipmentType:'barbell',sets:2,reps:'8',setEntries:[actual('a1'),actual('aw',{isWarmup:true})]},
  {id:'b',canonicalExerciseId:'b_rdl',name:'Romanian Deadlift',equipment:['barbell'],equipmentType:'barbell',sets:2,reps:'8',setEntries:[actual('b1')]},
  {id:'c',canonicalExerciseId:'b_pushup',name:'Push-Up',equipment:['bodyweight'],equipmentType:'bodyweight',sets:1,reps:'8',setEntries:[{id:'c1',reps:8,completed:false}]},
 ],currentExerciseIndex:0,completedExerciseIds:[],rpeByExercise:{},loadByExercise:{},startedAt:now,pausedAt:null,pausedDurationMs:0,status:'active',workoutInstanceId:'instance'};
}

test('known exercise, preset and mobility coverage has purpose, technique, explicit roles and useful muscle tags',()=>{
 const all=[...Object.values(STRENGTH_EXERCISES),...STRENGTH_PRESET_WORKOUTS.flatMap(w=>w.exercises),...MOBILITY_EXERCISES,...EXERCISE_ADAPTATION_OPTIONS];
 for(const ex of all){const metadata=resolveExerciseMetadata({name:ex.name,id:'id'in ex?ex.id:undefined});assert.equal(metadata.known,true,ex.name);assert.ok(metadata.setup.length>30,ex.name);assert.ok(metadata.benefit.length>20,ex.name);assert.ok(classifyExerciseStimulus({name:ex.name}),ex.name);}
 assert.ok(EXPANDED_EXERCISE_CATALOG.length>=205);
 assert.deepEqual(resolveExerciseMetadata({name:'Alex invented squat experiment'}).primaryMuscles,[]);
 assert.equal(resolveExerciseMetadata({name:'Alex invented squat experiment'}).known,false);
 assert.equal(resolveExerciseMetadata({id:'b_goblet_squat'}).known,true);
 assert.notEqual(exerciseIdentity({name:'Barbell Romanian Deadlift'}),exerciseIdentity({name:'Dumbbell Romanian Deadlift'}));
 assert.equal(exerciseIdentity({name:'Single-Arm DB Row'}),exerciseIdentity({name:'One-Arm Dumbbell Row'}));
});

test('weekly volume uses actual working sets, Sunday calendar weeks and distinct direct/support/practice counts',()=>{
 const history=[record('current',[
  {exerciseId:'b_squat',name:'Barbell Squat',sets:[actual('1'),actual('warm',{isWarmup:true}),actual('not',{completed:false}),actual('blank',{reps:0,weight:0})]},
  {exerciseId:'b_rdl',name:'Romanian Deadlift',sets:[actual('2')]},
  {exerciseId:'push',name:'Bench Press',sets:[actual('3')]},
  {exerciseId:'stretch',name:'Seated Hamstring Stretch',sets:[{id:'hold',completed:true,holdSeconds:30}]},
  {exerciseId:'hop',name:'Low Pogo Hops',sets:[actual('hop')]},
  {exerciseId:'custom',name:'Mystery move',sets:[actual('unknown')]},
 ]),record('old',[{exerciseId:'b_squat',name:'Barbell Squat',sets:[actual('old')]}],localWeekStart(now)-1),
 record('future',[{exerciseId:'b_squat',name:'Barbell Squat',sets:[actual('future')]}],now+1000)];
 const summary=summarizeExerciseVolume(history,now);assert.equal(new Date(summary.weekStartsAt).getDay(),0);
 assert.equal(summary.muscles.quads?.directSets,1);assert.equal(summary.muscles.hamstrings?.directSets,1);assert.equal(summary.muscles.hamstrings?.practiceSets,1);
 assert.equal(summary.muscles.triceps?.directSets,0);assert.equal(summary.muscles.triceps?.supportingSets,1);assert.equal(summary.muscles.calves?.directSets,0);assert.equal(summary.muscles.calves?.practiceSets,1);
 assert.equal(summary.exercises[exerciseIdentity({name:'Barbell Squat'})]?.sessions,2);assert.equal(summary.unclassifiedSets,1);
});

test('duplicate saved IDs/rows/set IDs do not double count; legacy distinct rows are not silently collapsed',()=>{
 const ex={exerciseId:'b_squat',name:'Barbell Squat',sets:[actual('same')]};
 const h=record('same-session',[ex,{...ex,sets:[actual('same'),actual('extra')]}]);
 const summary=summarizeExerciseVolume([h,{...h}],now);assert.equal(summary.muscles.quads?.directSets,2);assert.equal(summary.exercises[exerciseIdentity(ex)]?.sessions,1);
 const malformed={...record('not-completed',[ex]),completed:false} as unknown as StrengthLogRecord;
 assert.equal(Object.keys(summarizeExerciseVolume([malformed],now).exercises).length,0);
 const legacy=record('legacy',[{...ex,sets:[{reps:8,completed:true}]},{...ex,sets:[{reps:8,completed:true}]}]);
 assert.equal(summarizeExerciseVolume([legacy],now).muscles.quads?.directSets,2);
});

test('drop stages share one working sequence even across rows and never become extra muscle-set credits',()=>{
 const summary=summarizeExerciseVolume([record('drop',[
  {exerciseId:'b_squat',name:'Barbell Squat',sets:[actual('a',{dropSetGroupId:'d'})]},
  {exerciseId:'b_squat',name:'Barbell Squat',sets:[actual('b',{dropSetGroupId:'d'})]},
 ])],now);const ex=summary.exercises[exerciseIdentity({name:'Barbell Squat'})]!;
 assert.equal(ex.workingSetsThisWeek,1);assert.equal(ex.dropStagesThisWeek,2);assert.equal(summary.muscles.quads?.directSets,1);
});

test('canonical search selection survives active reducer, shape restoration and completion',()=>{
 let s=session();s=addExercise(s,{name:'Dumbbell Romanian Deadlift',canonicalExerciseId:'library_dumbbell_romanian_deadlift',equipmentType:'dumbbell',equipment:['dumbbell']});
 const ex=s.exercises.at(-1)!;assert.equal(ex.canonicalExerciseId,'library_dumbbell_romanian_deadlift');
 assert.equal(ensureExerciseShape(ex).canonicalExerciseId,ex.canonicalExerciseId);
 assert.equal(completedExercisesFromActiveSession([ex],'custom')[0]!.exerciseId,ex.canonicalExerciseId);
});

test('superset/circuit grouping retains completed work, rejects one-exercise supersets and prunes detached singleton groups',()=>{
 const s=session();const before=JSON.stringify(s.exercises.map(ex=>ex.setEntries));
 assert.equal(groupStrengthExercises(s,['a'],'superset'),s);
 const pair=groupStrengthExercises(s,['a','b'],'superset');assert.equal(pair.exercises[0]!.group?.id,pair.exercises[1]!.group?.id);
 const circuit=groupStrengthExercises(pair,['b','c'],'circuit');assert.equal(circuit.exercises[0]!.group,undefined);
 assert.equal(circuit.exercises[1]!.group?.kind,'circuit');assert.equal(JSON.stringify(circuit.exercises.map(ex=>ex.setEntries)),before);
 assert.equal(removeExercise(pair,'a').exercises.find(ex=>ex.id==='b')!.group,undefined);
 const skipped={...pair,exercises:pair.exercises.map(ex=>ex.id==='a'?{...ex,skipped:true}:ex)};assert.equal(makeStrengthTemplate(skipped,'Skipped group','owner').exercises.find(ex=>ex.id==='b')!.group,undefined);
 assert.deepEqual(ensureExerciseShape(circuit.exercises[1]!).group,circuit.exercises[1]!.group);
});

test('drop-set additions extend one pending chain, never rewrite completed source rows or assume their RPE',()=>{
 const s=session();const performed=s.exercises[0]!.setEntries[0]!;
 let next=addStrengthDropSet(s,'a');assert.deepEqual(next.exercises[0]!.setEntries[0],performed);
 assert.equal(next.exercises[0]!.setEntries.length,4);next=addStrengthDropSet(next,'a');const pending=next.exercises[0]!.setEntries.filter(set=>!set.completed);
 assert.equal(pending.length,3);assert.equal(new Set(pending.map(set=>set.dropSetGroupId)).size,1);assert.ok(pending.every(set=>set.rpe===undefined));
 const copy=duplicateSet(s,'a','a1').exercises[0]!.setEntries[1]!;assert.equal(copy.completed,false);assert.equal(copy.rpe,undefined);assert.equal(copy.rir,undefined);assert.equal(copy.previousPerformance?.rpe,8);assert.deepEqual(s.exercises[0]!.setEntries[0],performed);
});

test('templates retain groups/targets and previous results separately, use latest matching actual setup and do not copy completion/RPE',()=>{
 let s=groupStrengthExercises(session(),['a','b'],'superset');const template=makeStrengthTemplate(s,'My legs','owner',now);
 const completed=completedExercisesFromActiveSession(s.exercises.map(ex=>({...ex,templateExerciseId:ex.id})),'custom');
 const history=[{...record('first',completed),templateId:template.id},
  {...record('newer',completed.map(ex=>ex.exerciseId==='b_squat'?{...ex,sets:[actual('new',{weight:120,rpe:10}),actual('extra',{weight:200}),actual('extra2',{weight:200})]}:ex),now+1),templateId:template.id}];
 const repeated=instantiateStrengthTemplate(template,history);assert.equal(repeated[0]!.setEntries.length,s.exercises[0]!.setEntries.length);
 assert.equal(repeated[0]!.setEntries[0]!.weight,120);assert.equal(repeated[0]!.setEntries[0]!.previousPerformance?.rpe,10);
 assert.ok(repeated.flatMap(ex=>ex.setEntries).every(set=>!set.completed&&set.rpe===undefined&&set.rir===undefined));
 assert.notEqual(repeated[0]!.id,s.exercises[0]!.id);assert.equal(repeated[0]!.group?.id,repeated[1]!.group?.id);assert.notEqual(repeated[0]!.group?.id,s.exercises[0]!.group?.id);
 assert.equal(repeated[0]!.setEntries[1]!.isWarmup,true);assert.equal(repeated[0]!.canonicalExerciseId,'b_squat');
 const changedEquipment=history.map(record=>({...record,exercises:record.exercises.map(ex=>({...ex,equipmentType:'dumbbell' as const}))}));
 assert.equal(instantiateStrengthTemplate(template,changedEquipment)[0]!.setEntries[0]!.weight,100);
 assert.equal(completed[0]!.group?.kind,'superset');assert.equal(completed[0]!.templateExerciseId,'a');
});

test('last performed reference requires the same canonical name and recorded equipment',()=>{
 const history=[record('b',[{exerciseId:'x',name:'Romanian Deadlift',equipmentType:'barbell',sets:[actual('b')]}]),record('d',[{exerciseId:'y',name:'Romanian Deadlift',equipmentType:'dumbbell',sets:[actual('d',{weight:30})]}],now+1)];
 assert.equal(lastRecordedExercise(history,{name:'Romanian Deadlift'},'barbell',now+2)?.sets[0]!.weight,100);
 assert.equal(lastRecordedExercise(history,{name:'Romanian Deadlift'},'other',now+2),null);
});

test('actual shared set editor displays converted units, stores edits in displayed units and names the warm-up control',()=>{
 const file=resolve('src/components/strength/StrengthSetEditor.tsx');const req=createRequire(file);const module={exports:{} as any};
 const mocks:Record<string,unknown>={'react-native':{View:'View',Text:'Text',TextInput:'TextInput',TouchableOpacity:'Button',StyleSheet:{create:(v:unknown)=>v}},'@expo/vector-icons':{Ionicons:'Icon'},'../../theme/useColors':{useColors:()=>({})},'../../utils/strengthDesign':{strengthWeightForDisplay}};
 vm.runInNewContext(ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{module,exports:module.exports,require:(name:string)=>Object.hasOwn(mocks,name)?mocks[name]:req(name)});
 const edits:unknown[]=[];const element=module.exports.default({sets:[actual('unit',{completed:false,previousPerformance:{weight:100,weightUnit:'lb',rpe:8}})],weightUnit:'kg',equipmentType:'barbell',onEdit:(...args:unknown[])=>edits.push(args)});
 const nodes=(node:any):any[]=>!node||typeof node!=='object'?[]:[node,...[node.props?.children].flat(Infinity).flatMap(nodes)];const all=nodes(element);
 const input=all.find(node=>node.props?.accessibilityLabel==='Set 1 weight in kg');assert.equal(input.props.value,'45.4');input.props.onChangeText('50');assert.equal((edits[0] as any)[1].weight,50);assert.equal((edits[0] as any)[1].weightUnit,'kg');
 assert.ok(all.some(node=>node.props?.accessibilityLabel==='Toggle warm-up set'));assert.ok(all.some(node=>JSON.stringify(node.props?.children).includes('Warm-up')));
 assert.ok(all.some(node=>node.props?.style?.flexWrap==='wrap'));
});


test('backdated custom strength uses its performed date, not the date it was entered',()=>{
  const logs=[{id:'old',category:'strength',date:'2026-11-01',completedAt:now,source:'backdated',exercises:[{exerciseName:'Barbell Squat',sets:[actual('old')]}]},
    {id:'current',category:'strength',date:'2026-11-20',completedAt:now,source:'backdated',exercises:[{exerciseName:'Barbell Squat',sets:[actual('now')]}]},
    {id:'future',category:'strength',date:'2026-11-21',completedAt:now,source:'backdated',exercises:[{exerciseName:'Barbell Squat',sets:[actual('future')]}]}] as any;
  const summary=summarizeExerciseVolume([],now,logs);assert.equal(summary.muscles.quads?.directSets,1);assert.equal(summary.exercises[exerciseIdentity({name:'Barbell Squat'})]?.sessions,2);
});


test('repeating actual quantities cannot rewrite named drop-set/rest structure',()=>{
 const s=session();s.exercises[0]!.setEntries[0]!.dropSetGroupId='saved-chain';s.exercises[0]!.setEntries[0]!.restSeconds=60;
 const template=makeStrengthTemplate(s,'Structure','owner',now);const exercises=completedExercisesFromActiveSession(s.exercises.map(ex=>({...ex,templateExerciseId:ex.id})),'custom');
 exercises[0]!.sets[0]!.dropSetGroupId='different-actual-chain';exercises[0]!.sets[0]!.weight=120;
 const repeated=instantiateStrengthTemplate(template,[{...record('latest',exercises),templateId:template.id}]);
 const set=repeated[0]!.setEntries[0]!;assert.equal(set.weight,120);assert.equal(set.restSeconds,60);assert.notEqual(set.dropSetGroupId,'different-actual-chain');assert.equal(set.isWarmup,undefined);assert.equal(set.previousPerformance?.rpe,8);
});


test('actual strength rehydrate migration preserves the named-template link and grouped exercise data',()=>{
 const source=ts.createSourceFile('strengthStore.ts',readFileSync('src/store/strengthStore.ts','utf8'),ts.ScriptTarget.Latest,true);
 const fn=source.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text==='migrateStrengthRecord');assert.ok(fn);
 const context:any={};vm.runInNewContext(ts.transpileModule(fn.getText(source)+';globalThis.migrate=migrateStrengthRecord;',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,context);
 const input={...record('saved',completedExercisesFromActiveSession(groupStrengthExercises(session(),['a','b'],'superset').exercises.map(ex=>({...ex,templateExerciseId:ex.id})),'custom')),templateId:'template-id'};
 const restored=context.migrate(JSON.parse(JSON.stringify(input)));assert.equal(restored.templateId,'template-id');assert.equal(restored.exercises[0].templateExerciseId,'a');assert.equal(restored.exercises[0].group.kind,'superset');assert.equal(restored.exercises[0].sets[0].rpe,8);
});
