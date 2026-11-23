import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import {createJSONStorage} from 'zustand/middleware';
import {calendarDayStatus,calendarActivityIcon} from '../../src/utils/calendarPresentation';
import {routeGeometryMeters,routePointAtMeters,routeSectionLine,routeSectionsError,reverseRouteSections,legacyRouteSections,routeSectionCue,nextRouteSection,advanceRouteSectionProgress,snapshotRoute} from '../../src/utils/routeSections';
import {routeEditCanCommit,routeEditWaypoints} from '../../src/utils/routeEditing';
import type {RunRoute} from '../../src/store/routeStore';
const points=[{latitude:45,longitude:7},{latitude:45.01,longitude:7},{latitude:45.01,longitude:7.01}];
const length=routeGeometryMeters(points);
const sections=[{id:'warm',name:'Warm up',startMeters:0,endMeters:500},{id:'hill',name:'Hill climb',startMeters:600,endMeters:1200,targetRpe:6,targetHrZone:3 as const,targetPaceSecPerMile:600}];
const route:RunRoute={id:'synthetic-route',name:'Original',folder:'custom',difficulty:'Custom',distanceMiles:length/1609.344,elevationGainFt:0,estimatedMinutes:20,points,waypoints:points,segments:[],sections,updatedAt:10};
function source(file:string,mocks:Record<string,unknown>) {
 const filename=resolve(file),nativeRequire=createRequire(filename),module={exports:{} as any};
 vm.runInNewContext(ts.transpileModule(readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,
 {module,exports:module.exports,require:(id:string)=>Object.hasOwn(mocks,id)?mocks[id]:nativeRequire(id),console,Date,setTimeout,clearTimeout},{filename});
 return module.exports;
}
test('day status is shared across month/week: Today/race cannot hide completion, partial never Done',()=>{
 assert.equal(calendarDayStatus([{type:'race',completed:true}],false,false),'completed');
 assert.equal(calendarDayStatus([{type:'run',completed:true},{type:'strength'}],false,false),'partial');
 assert.equal(calendarDayStatus([{type:'run',completed:true},{type:'strength',missed:true}],false,true),'partial');
 assert.equal(calendarDayStatus([{type:'run'}],false,false),'planned');
 assert.equal(calendarDayStatus([{type:'strength'}],false,true),'missed');
 assert.equal(calendarDayStatus([],false,false),'rest');
 assert.equal(calendarDayStatus([{type:'run'}],true,false),'empty');
 assert.notEqual(calendarActivityIcon('strength'),calendarActivityIcon('run'));
 assert.equal(calendarActivityIcon('cross_country_skiing'),'snow-outline');
});
test('geographic ranges derive their own geometry and validate distance/targets/gaps/overlap',()=>{
 assert.equal(routeSectionsError(sections,length),null);
 const line=routeSectionLine(points,500,1200);
 assert.equal(line.length,3); assert.ok(Math.abs(routeGeometryMeters(line)-700)<1);
 assert.deepEqual(line[0],routePointAtMeters(points,500));
 for(const bad of [{...sections[0],endMeters:length+20},{...sections[0],startMeters:-1},{...sections[0],endMeters:0},{...sections[0],targetRpe:11},{...sections[0],targetHrZone:6},{...sections[0],targetPaceSecPerMile:NaN}]) assert.ok(routeSectionsError([bad] as any,length));
 assert.ok(routeSectionsError([sections[0]!,{...sections[1]!,startMeters:499}],length));
});
test('reversal preserves geographic range length and targets; legacy markers adapt without pretending they are timed blocks',()=>{
 const reversed=reverseRouteSections(sections,length);
 assert.equal(reversed[0]!.id,'hill');
 assert.ok(Math.abs((reversed[0]!.endMeters-reversed[0]!.startMeters)-600)<0.01);
 assert.equal(reversed[0]!.targetRpe,6);
 const twice=reverseRouteSections(reversed,length);
 assert.ok(Math.abs(twice[0]!.startMeters-sections[0]!.startMeters)<0.001);
 assert.deepEqual(legacyRouteSections([{label:'Bridge',distanceMiles:0.5}],length),[{id:'legacy-0',name:'Bridge',startMeters:0,endMeters:804.672}]);
});
test('section cues give turns priority, respect cooldown and do not replay seen sections after remount/backtracking',()=>{
 const input={sections,progressMeters:700,lastId:null,lastAt:0,now:20000,turnNear:false,imperial:true};
 assert.match(routeSectionCue(input)!.cue,/Hill climb.*Zone 3.*RPE 6/);
 assert.equal(routeSectionCue({...input,turnNear:true}),null);
 assert.equal(routeSectionCue({...input,lastAt:10000}),null);
 assert.equal(routeSectionCue({...input,seenIds:['hill']}),null);
 assert.equal(routeSectionCue({...input,progressMeters:550}),null);
});
test('edit seeding/cancel/save conflicts keep original route; stale owners cannot write even Save as New',()=>{
 const draft=snapshotRoute(route); draft.points[0]!.latitude=10;draft.sections![0]!.name='Changed';
 assert.equal(route.points[0]!.latitude,45);assert.equal(route.sections![0]!.name,'Warm up');
 assert.equal(routeEditCanCommit(false,route,route,true),false);
 assert.equal(routeEditCanCommit(true,route,{...route,updatedAt:11},false),false);
 assert.equal(routeEditCanCommit(true,route,undefined,false),false);
 assert.equal(routeEditCanCommit(true,route,undefined,true),true);
 const dense={...route,waypoints:undefined,points:Array.from({length:1000},(_,i)=>({latitude:45+i/100000,longitude:7}))};
 assert.equal(routeEditWaypoints(dense).length,40);
 assert.equal(routeEditWaypoints(dense)[39]!.latitude,dense.points[999]!.latitude);
});
test('actual route + active-run stores persist independent live snapshots across edit/delete/reversal and retain recorded GPS',async()=>{
 const raw=new Map<string,string>();const storage=createJSONStorage(()=>({getItem:(k:string)=>raw.get(k)??null,setItem:(k:string,v:string)=>{raw.set(k,v)},removeItem:(k:string)=>{raw.delete(k)}}));
 const mocks={'@react-native-async-storage/async-storage':{},'./persistStorage':{createAppJSONStorage:()=>storage},'./settingsStore':{useSettingsStore:{getState:()=>({autoPauseMode:'off'})}},'../lib/voiceCue':{enqueueVoiceCue(){}}};
 const routes=source('src/store/routeStore.ts',mocks).useRouteStore;
 const active=source('src/store/activeRunStore.ts',mocks).useActiveRunStore;
 const id=routes.getState().addRoute(snapshotRoute(route));
 const saved=routes.getState().routes.find((r:RunRoute)=>r.id===id);
 active.getState().startRun(null,{mode:'quick',routeSnapshot:saved});
 active.setState({coordinates:[{lat:45,lng:7,timestamp:1},{lat:45.001,lng:7,timestamp:2}]});
 routes.getState().updateRoute(id,{name:'Edited',points:[{latitude:1,longitude:2}],sections:[]});
 routes.getState().reverseAttachedRoute();routes.getState().removeRoute(id);
 assert.equal(active.getState().routeSnapshot.name,'Original');assert.equal(active.getState().routeSnapshot.points.length,3);
 assert.equal(active.getState().routeSnapshot.sections[1].targetRpe,6);
 const restored=source('src/store/activeRunStore.ts',mocks).useActiveRunStore;
 assert.equal(restored.getState().routeSnapshot.name,'Original');
 assert.equal(restored.getState().coordinates.length,2);
 active.getState().finishRun(); assert.equal(active.getState().lastRunCoordinates.length,2);
 active.getState().startRun(null,{mode:'quick',environment:'indoor',routeSnapshot:saved});
 assert.equal(active.getState().routeSnapshot,null);
});


test('accepted section progress persists while silent and future-section presentation advances without a checkpoint index',()=>{
 const initial={seenIds:['warm'],lastAt:20000,maxProgressMeters:0};
 const moved=advanceRouteSectionProgress(initial,700,700);
 assert.equal(moved.maxProgressMeters,700);assert.equal(moved.seenIds,initial.seenIds);
 assert.equal(routeSectionCue({sections,progressMeters:700,lastId:null,lastAt:20000,now:21000,turnNear:true,imperial:true}),null);
 assert.equal(advanceRouteSectionProgress(moved,100,700),moved);
 assert.equal(advanceRouteSectionProgress(moved,1800,700),moved);
 assert.equal(nextRouteSection(sections,0)!.id,'hill');assert.equal(nextRouteSection(sections,700),null);
 const source=readFileSync('app/(tabs)/training/route-builder.tsx','utf8');
 assert.match(source,/maxHeight: '92%'/);assert.match(source,/modalBody: \{ flexShrink: 1 \}/);
 const start=source.indexOf('<ScrollView\n              style={s.modalBody}');
 assert.ok(start>=0&&source.indexOf('<RouteSectionsEditor',start)<source.indexOf('</ScrollView>',start),'all segment fields are inside the bounded keyboard-avoiding save sheet scroll body');
});
