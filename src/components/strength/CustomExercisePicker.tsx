import { captureOwnerLease, getLocalDataOwner, ownerLeaseIsCurrent } from '../../lib/localDataOwner';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Host } from '@expo/ui';
import Modal from '../ui/RecoverableModal';
import { GoalAction, GoalPicker } from '../goals/GoalLifecycleCard';
import { useColors } from '../../theme/useColors';
import { useThemeMode } from '../../store/themeStore';
import { useExerciseStore, type Exercise } from '../../store/exerciseStore';
import { useStrengthStore } from '../../store/strengthStore';
import { useCustomWorkoutStore } from '../../store/customWorkoutStore';
import { summarizeExerciseVolume, localWeekStart, lastRecordedExercise } from '../../utils/exerciseVolume';
import { exerciseIdentity, resolveExerciseMetadata } from '../../utils/exerciseCatalog';
import { mapEquipmentType, type AddExerciseInput } from '../../utils/strengthSession';
import { displayLabel, displayLabels } from '../../utils/displayLabels';
import ExerciseMuscleTags from './ExerciseMuscleTags';

function FilterWheel({label,value,options,onChange}:{label:string;value:string;options:{value:string;label:string}[];onChange:(value:string)=>void}) {
  const C=useColors();const mode=useThemeMode();const[open,setOpen]=useState(false);const[draft,setDraft]=useState(value);
  return <><GoalAction label={`${label}: ${options.find(item=>item.value===value)?.label??'Any'}`} secondary onPress={()=>{setDraft(value);setOpen(true);}}/>
    <Modal visible={open} onRequestClose={()=>setOpen(false)} presentationStyle="pageSheet">
      <ScrollView contentContainerStyle={{padding:20,paddingBottom:40,gap:16}}><Text style={{fontSize:22,fontWeight:'700',color:C.text}}>{label}</Text>
        {process.env.EXPO_OS==='ios'?<Host matchContents={{vertical:true}} colorScheme={mode} seedColor={C.primary} style={{width:'100%',height:220}}><IOSWheel label={label} value={draft} options={options} onChange={setDraft}/></Host>
          :<GoalPicker label={label} value={draft} options={options} onChange={setDraft}/>}
        <GoalAction label="Apply" onPress={()=>{onChange(draft);setOpen(false);}}/>
      </ScrollView>
    </Modal></>;
}
function IOSWheel({label,value,options,onChange}:{label:string;value:string;options:{value:string;label:string}[];onChange:(value:string)=>void}) {
  const {Picker,Text}=require('@expo/ui/swift-ui') as typeof import('@expo/ui/swift-ui');
  const m=require('@expo/ui/swift-ui/modifiers') as typeof import('@expo/ui/swift-ui/modifiers');
  return <Picker label={label} selection={value} onSelectionChange={onChange} modifiers={[m.pickerStyle('wheel'),m.frame({height:216}),m.accessibilityLabel(label)]}>
    {options.map(item=><Text key={item.value} modifiers={[m.tag(item.value)]}>{item.label}</Text>)}
  </Picker>;
}
export function filterCustomExerciseChoices(exercises:readonly Exercise[],query:string,category:string,muscle:string,equipment:string):Exercise[] {
  const q=query.trim().toLowerCase();return exercises.filter(ex=>{
    const metadata=resolveExerciseMetadata({id:ex.id,name:ex.name});
    return (!q||[ex.name,...ex.primaryMuscles,...(ex.equipment??[])].some(value=>value.toLowerCase().includes(q)))
      &&(!category||ex.category===category)&&(!muscle||[...metadata.primaryMuscles,...metadata.mobilityTargets].includes(muscle))
      &&(!equipment||(ex.equipment??metadata.equipment).includes(equipment));
  }).sort((a,b)=>a.name.localeCompare(b.name));
}
export default function CustomExercisePicker({onAdd,disabled=false}:{onAdd:(input:AddExerciseInput)=>void;disabled?:boolean}) {
  const C=useColors();const exercises=useExerciseStore(state=>state.exercises);const history=useStrengthStore(state=>state.history);const logs=useCustomWorkoutStore(state=>state.logs);
  const[query,setQuery]=useState('');const[selectedId,setSelectedId]=useState('');const[addEquipment,setAddEquipment]=useState('');const[category,setCategory]=useState('');const[muscle,setMuscle]=useState('');const[equipment,setEquipment]=useState('');const[filters,setFilters]=useState(false);const[volumeOpen,setVolumeOpen]=useState(false);const[lease]=useState(()=>captureOwnerLease());const[scopeValid,setScopeValid]=useState(true);
  useEffect(()=>getLocalDataOwner()?.onInvalidated(()=>setScopeValid(false)),[]);const[historyReady,setHistoryReady]=useState(()=>useStrengthStore.persist.hasHydrated()&&useCustomWorkoutStore.persist.hasHydrated());
  useEffect(()=>{const ready=()=>setHistoryReady(useStrengthStore.persist.hasHydrated()&&useCustomWorkoutStore.persist.hasHydrated());const a=useStrengthStore.persist.onFinishHydration(ready),b=useCustomWorkoutStore.persist.onFinishHydration(ready);ready();return()=>{a();b();};},[]);
  const selected=exercises.find(ex=>ex.id===selectedId&&ex.name===query);const choices=useMemo(()=>filterCustomExerciseChoices(exercises,query,category,muscle,equipment),[exercises,query,category,muscle,equipment]);
  const weekKey=localWeekStart(Date.now());const volume=useMemo(()=>summarizeExerciseVolume(history,Date.now(),logs),[history,logs,weekKey]);
  const muscles=[...new Set(exercises.flatMap(ex=>{const m=resolveExerciseMetadata({id:ex.id,name:ex.name});return [...m.primaryMuscles,...m.mobilityTargets];}))].sort();
  const equipmentOptions=[...new Set(exercises.flatMap(ex=>ex.equipment??[]))].sort();
  const metadata=selected?resolveExerciseMetadata({id:selected.id,name:selected.name}):null;
  const selectedEquipment=selected?.equipment?.length?selected.equipment:addEquipment?[addEquipment]:[];
  const last=selected&&historyReady?lastRecordedExercise(history,{id:selected.id,name:selected.name},mapEquipmentType(selectedEquipment)):null;
  const currentLease=captureOwnerLease();
  if(!scopeValid||!ownerLeaseIsCurrent(lease)||!currentLease||currentLease.ownerUserId!==lease?.ownerUserId||!ownerLeaseIsCurrent(currentLease))return <Text style={{color:C.textMuted}}>Account changed. Reopen the workout to search your exercises.</Text>;
  return <View style={{gap:10,minWidth:0}}>
    <Text style={{fontSize:17,fontWeight:'800',color:C.text}}>Add exercise</Text>
    <TextInput value={query} onChangeText={value=>{setQuery(value);setSelectedId('');}} accessibilityLabel="Search exercises by name or muscle" placeholder="Search exercises or muscle groups" placeholderTextColor={C.textDim}
      style={{color:C.text,fontSize:16,minHeight:48,padding:12,borderWidth:1,borderColor:C.border,borderRadius:10}} editable={!disabled}/>
    <GoalAction label={filters?'Hide exercise filters':'Filter exercises'} onPress={()=>setFilters(value=>!value)} secondary/>
    {filters?<View style={{gap:8}}>
      <FilterWheel label="Exercise focus" value={category} onChange={setCategory} options={[{value:'',label:'Any focus'},...['upper','lower','core','full_body','power','tendon_capacity','mobility_prehab'].map(value=>({value,label:displayLabel(value)}))]}/>
      <FilterWheel label="Muscles or mobility targets" value={muscle} onChange={setMuscle} options={[{value:'',label:'Any muscle'},...muscles.map(value=>({value,label:displayLabel(value)}))]}/>
      <FilterWheel label="Equipment" value={equipment} onChange={setEquipment} options={[{value:'',label:'Any equipment'},...equipmentOptions.map(value=>({value,label:displayLabel(value)}))]}/>
      <GoalAction label="Clear exercise filters" secondary onPress={()=>{setCategory('');setMuscle('');setEquipment('');}}/>
    </View>:null}
    {!selected?<><Text style={{fontSize:12,color:C.textMuted}}>{choices.length} matches{choices.length>12?' · refine your search for more':''}</Text>
      {choices.slice(0,12).map(ex=>{const seen=volume.exercises[exerciseIdentity({id:ex.id,name:ex.name})];return <TouchableOpacity key={ex.id} accessibilityRole="button" accessibilityLabel={`Select ${ex.name}`} disabled={disabled} onPress={()=>{setQuery(ex.name);setSelectedId(ex.id);setAddEquipment('');}}
        style={{borderColor:C.border,borderWidth:1,borderRadius:10,padding:12,minHeight:48}}>
        <Text style={{fontSize:15,fontWeight:'700',color:C.text}}>{ex.name}</Text><ExerciseMuscleTags exercise={ex}/>
        <Text style={{fontSize:12,color:C.textMuted}}>{historyReady?`Done in ${seen?.sessions??0} saved workouts · ${seen?.workingSetsThisWeek??0} working sets this week`:'History usage is loading…'}</Text>
      </TouchableOpacity>;})}</>:<View style={{gap:6}}><Text style={{fontSize:16,fontWeight:'700',color:C.text}}>{selected.name}</Text><ExerciseMuscleTags exercise={selected}/>
      <Text style={{fontSize:13,lineHeight:19,color:C.textMuted}}>{metadata?.setup}</Text><Text style={{fontSize:13,lineHeight:19,color:C.textMuted}}>{metadata?.benefit}</Text><Text style={{fontSize:12,lineHeight:18,color:C.textMuted}}>{metadata?.adjustment}</Text>
      <Text style={{fontSize:12,color:C.textMuted}}>{displayLabels(selected.equipment??[])||'Choose the equipment for this variation'} · {historyReady?`${volume.exercises[exerciseIdentity(selected)]?.sessions??0} saved workouts`:'History loading…'}</Text>
      {last?<Text style={{fontSize:12,lineHeight:18,color:C.textMuted}}>Last time ({new Date(last.timestamp).toLocaleDateString()}): {last.sets.slice(0,3).map(set=>`${set.reps??'—'} reps${set.weight!=null?` at ${set.weight} ${set.weightUnit??'unit not recorded'}`:''}${set.rpe!=null?`, RPE ${set.rpe}`:''}`).join(' · ')}</Text>:null}
      {!selected.equipment?.length?<FilterWheel label="Equipment for this exercise" value={addEquipment} onChange={setAddEquipment} options={[{value:'',label:'Choose equipment'},...['bodyweight','barbell','dumbbell','kettlebell','cable','machine','resistance_band','suspension_trainer','other'].map(value=>({value,label:displayLabel(value)}))]}/>:null}
    </View>}
    <GoalAction label={selected?`Add ${selected.name}`:'Add as custom exercise'} disabled={disabled||!query.trim()||Boolean(selected&&!selected.equipment?.length&&!addEquipment)} onPress={()=>{
      if(disabled||!query.trim()||!ownerLeaseIsCurrent(currentLease)||selected&&!selected.equipment?.length&&!addEquipment)return;onAdd({name:query.trim(),canonicalExerciseId:selected?.id,
        equipmentType:mapEquipmentType(selected?.equipment?.length?selected.equipment:addEquipment?[addEquipment]:equipment?[equipment]:[]),equipment:selected?.equipment?.length?selected.equipment:addEquipment?[addEquipment]:equipment?[equipment]:[]});setQuery('');setSelectedId('');
    }}/>
    {!selected&&query.trim()?<Text style={{fontSize:12,color:C.textMuted}}>A custom name is kept as your own exercise. Unknown muscles are not guessed.</Text>:null}
    <View style={{gap:4,borderTopWidth:1,borderColor:C.border,paddingTop:10}}>
      <GoalAction label={volumeOpen?'Hide weekly muscle work':'Weekly muscle work'} secondary onPress={()=>setVolumeOpen(value=>!value)}/>
      {volumeOpen?<><Text style={{fontSize:13,fontWeight:'700',color:C.text}}>Saved this week · Sunday–Saturday</Text>
      {!historyReady?<Text style={{fontSize:12,color:C.textMuted}}>History is still loading; counts are not available yet.</Text>:null}
      {Object.entries(volume.muscles).filter(([,v])=>v.directSets||v.supportingSets||v.practiceSets).map(([name,v])=><Text key={name} style={{fontSize:12,lineHeight:18,color:C.textMuted}}>{displayLabel(name)}: {v.directSets} direct sets · {v.supportingSets} supporting sets{v.practiceSets?` · ${v.practiceSets} practice sets`:''}</Text>)}
      {historyReady&&!Object.keys(volume.muscles).length?<Text style={{fontSize:12,color:C.textMuted}}>Completed sets appear after saving your workout.</Text>:null}
      {historyReady&&volume.unclassifiedSets?<Text style={{fontSize:12,color:C.textMuted}}>{volume.unclassifiedSets} working sets have no confirmed muscle tags.</Text>:null}
      <Text style={{fontSize:11,lineHeight:16,color:C.textMuted}}>Working sets are recorded sets, not measured muscle stimulus. Warm-ups are excluded; mobility, balance and power practice stay separate. Drop-set stages share one working sequence. No universal weekly target is assumed.</Text></>:null}
    </View>
  </View>;
}
