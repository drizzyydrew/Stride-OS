import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import SafeAreaView from '../../../src/components/layout/PageSafeAreaView';
import ScreenHeader from '../../../src/components/layout/ScreenHeader';
import { GoalAction } from '../../../src/components/goals/GoalLifecycleCard';
import { useColors } from '../../../src/theme/useColors';
import { readStrengthTemplates } from '../../../src/lib/strengthTemplateRepository';
import { captureOwnerLease, getLocalDataOwner, ownerLeaseIsCurrent } from '../../../src/lib/localDataOwner';
import { instantiateStrengthTemplate, type SavedStrengthTemplate } from '../../../src/utils/strengthTemplates';
import { activeSessionStoresHydrated, getConflictingActiveSession } from '../../../src/lib/activeSessionCoordinator';
import { useActiveStrengthSessionStore } from '../../../src/store/activeStrengthSessionStore';
import { useStrengthStore } from '../../../src/store/strengthStore';
import { useSettingsStore } from '../../../src/store/settingsStore';
import { setStrideWatchWorkoutContext, startStrideWatchWorkout } from '../../../modules/stride-watch-connectivity/src';

export default function SavedStrengthWorkoutsScreen(){
  const C=useColors();const router=useRouter();const[pinnedLease]=useState(()=>captureOwnerLease());const owner=pinnedLease?.ownerUserId;const reads=useRef(0);const[templates,setTemplates]=useState<SavedStrengthTemplate[]>([]);const[status,setStatus]=useState('Loading saved workouts…');
  const load=useCallback(async()=>{
    const lease=captureOwnerLease();const sequence=++reads.current;
    if(!ownerLeaseIsCurrent(pinnedLease)||!lease||lease.ownerUserId!==owner){setTemplates([]);setStatus('Account access changed. Reopen Saved workouts.');return;}
    setStatus('Loading saved workouts…');try{const next=await readStrengthTemplates(lease);if(ownerLeaseIsCurrent(lease)&&sequence===reads.current){setTemplates(next);setStatus('');}}catch(error){if(sequence===reads.current)setStatus(error instanceof Error?error.message:'Saved workouts could not be loaded. Retry.');}
  },[owner,pinnedLease]);
  useFocusEffect(useCallback(()=>{void load();return()=>{reads.current++;};},[load]));
  useEffect(()=>getLocalDataOwner()?.onInvalidated(()=>{reads.current++;setTemplates([]);setStatus('Account changed. Reopen Saved workouts.');}),[]);

  function start(template:SavedStrengthTemplate){
    const lease=captureOwnerLease();if(!ownerLeaseIsCurrent(pinnedLease)||!lease||lease.ownerUserId!==owner||template.ownerUserId!==owner||!ownerLeaseIsCurrent(lease))return;if(!activeSessionStoresHydrated()||!useStrengthStore.persist.hasHydrated()){setStatus('Restoring your active workout. Try again in a moment.');return;}
    const current=useActiveStrengthSessionStore.getState().session;const conflict=getConflictingActiveSession('strength');
    if(current||conflict){Alert.alert('A workout is already active','Continue or finish your current workout before starting a saved one.',[{text:'Continue workout',onPress:()=>{if(ownerLeaseIsCurrent(lease))router.push((conflict?.route??(current?.source==='preset'?'/(tabs)/strength/preset-session':current?.source==='custom'?'/(tabs)/strength/custom-session':'/(tabs)/strength')) as never);}},{text:'Cancel',style:'cancel'}]);return;}
    let exercises;try{exercises=instantiateStrengthTemplate(template,useStrengthStore.getState().history);}catch{setStatus('This saved workout could not be opened safely. Its saved data was kept.');return;}
    useActiveStrengthSessionStore.getState().startSession({source:'custom',templateId:template.id,workoutId:`saved_${template.id}`,workoutName:template.name,plannedDurationMin:template.plannedDurationMin,exercises});
    const launched=useActiveStrengthSessionStore.getState().session;const units=useSettingsStore.getState().units;
    void setStrideWatchWorkoutContext({unitSystem:units}).catch(()=>undefined);
    void startStrideWatchWorkout({workoutKind:'strength',workoutInstanceId:launched?.workoutInstanceId,title:template.name,environment:'indoor',targetZone:null}).catch(()=>undefined);
    router.push('/(tabs)/strength/custom-session' as never);
  }
  return <SafeAreaView style={{flex:1,backgroundColor:C.bg}} edges={['top']}><ScreenHeader title="Saved workouts" onBack={()=>router.back()}/>
    <ScrollView contentContainerStyle={{padding:18,paddingBottom:120,gap:14}}>
      <Text style={{color:C.textMuted,fontSize:14,lineHeight:20}}>Reuse your named workouts with their exercise order and groups. Previous weights and effort are reference points, not proof of what you will perform today.</Text>
      {status?<Text accessibilityRole="alert" style={{color:C.textMuted,fontSize:14}}>{status}</Text>:null}
      {status&&!status.startsWith('Loading')?<GoalAction label="Retry saved workouts" secondary onPress={()=>void load()}/>:null}
      {!status&&!templates.length?<Text style={{color:C.textMuted,fontSize:14}}>Create a custom workout, add exercises, then choose Save workout.</Text>:null}
      {templates.map(template=><View key={template.id} style={{padding:16,gap:8,borderWidth:1,borderColor:C.border,borderRadius:14,backgroundColor:C.card}}>
        <Text style={{fontSize:20,fontWeight:'700',color:C.text}}>{template.name}</Text>
        <Text style={{fontSize:13,lineHeight:19,color:C.textMuted}}>{template.exercises.map(ex=>ex.name).join(' · ')}</Text>
        <GoalAction label={`Start ${template.name}`} onPress={()=>start(template)}/>
      </View>)}
    </ScrollView>
  </SafeAreaView>;
}
