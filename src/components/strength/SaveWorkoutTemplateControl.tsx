import { useProAccess } from '../../hooks/useProAccess';
import { requireProAccess } from '../../lib/pro-access';
import ProAccessNotice from '../subscription/ProAccessNotice';
import { useEffect, useRef, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, ScrollView, Text, TextInput, View } from 'react-native';
import Modal from '../ui/RecoverableModal';
import { GoalAction } from '../goals/GoalLifecycleCard';
import { useColors } from '../../theme/useColors';
import type { ActiveStrengthSession } from '../../store/activeStrengthSessionStore';
import { useActiveStrengthSessionStore } from '../../store/activeStrengthSessionStore';
import { captureOwnerLease, getLocalDataOwner, ownerLeaseIsCurrent } from '../../lib/localDataOwner';
import { makeStrengthTemplate, type SavedStrengthTemplate } from '../../utils/strengthTemplates';
import { saveStrengthTemplate } from '../../lib/strengthTemplateRepository';

export default function SaveWorkoutTemplateControl({session}:{session:ActiveStrengthSession}) {
  const access=useProAccess('custom-workouts');
  const [showMembership,setShowMembership]=useState(false);
  const C=useColors();const[lease]=useState(()=>captureOwnerLease());const[open,setOpen]=useState(false);const[name,setName]=useState(session.workoutName+(session.templateId?' copy':''));const[busy,setBusy]=useState(false);const[status,setStatus]=useState('');const pending=useRef<SavedStrengthTemplate|null>(null);const writing=useRef(false);
  useEffect(()=>getLocalDataOwner()?.onInvalidated(()=>{setOpen(false);pending.current=null;setStatus('');}),[]);
  async function save(){
    const writeLease=captureOwnerLease();if(writing.current||!ownerLeaseIsCurrent(lease)||!writeLease||writeLease.ownerUserId!==lease?.ownerUserId||!ownerLeaseIsCurrent(writeLease))return;const current=useActiveStrengthSessionStore.getState().session;
    if(!current||current.workoutInstanceId!==session.workoutInstanceId)return;writing.current=true;setBusy(true);setStatus('');
    try{
      await requireProAccess('custom-workouts');
      if(!ownerLeaseIsCurrent(writeLease)||useActiveStrengthSessionStore.getState().session?.workoutInstanceId!==current.workoutInstanceId)return;
      pending.current??=makeStrengthTemplate(current,name,writeLease.ownerUserId);
      await saveStrengthTemplate(pending.current,writeLease);if(!ownerLeaseIsCurrent(writeLease))return;
      useActiveStrengthSessionStore.getState().attachTemplate(current.workoutInstanceId,pending.current.id);
      setOpen(false);setStatus(`Saved “${pending.current.name}” in Saved workouts.`);pending.current=null;
    }catch(error){setShowMembership(true);if(captureOwnerLease()?.ownerUserId===lease?.ownerUserId)setStatus(error instanceof Error?error.message:'Workout could not be saved. Keep this screen open and retry.');}
    finally{writing.current=false;setBusy(false);}
  }
  return <View style={{gap:8}}><GoalAction label={session.templateId?'Save a workout copy':'Save workout'} secondary disabled={!session.exercises.length} onPress={()=>{if(!access.allowed){setShowMembership(true);return;}if(ownerLeaseIsCurrent(lease)&&captureOwnerLease()?.ownerUserId===lease?.ownerUserId){pending.current=null;setStatus('');setOpen(true);}}}/>
    {showMembership&&!access.allowed?<ProAccessNotice access={access} title="Saved workout templates are part of Pro"/>:null}
    {status&&!open?<Text accessibilityRole="alert" style={{color:C.textMuted,fontSize:13}}>{status}</Text>:null}
    <Modal visible={open} onRequestClose={()=>{if(!busy)setOpen(false);}} presentationStyle="pageSheet"><KeyboardAvoidingView style={{flex:1}} behavior={process.env.EXPO_OS==='ios'?'padding':undefined}><ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={{padding:20,paddingBottom:40,gap:16}}>
      <Text style={{fontSize:22,fontWeight:'700',color:C.text}}>Name your workout</Text>
      <TextInput value={name} onChangeText={value=>{setName(value);pending.current=null;}} maxLength={80} returnKeyType="done" onSubmitEditing={()=>Keyboard.dismiss()} editable={!busy} accessibilityLabel="Saved workout name" placeholder="e.g. My upper-body day" placeholderTextColor={C.textDim} style={{color:C.text,fontSize:17,minHeight:50,padding:12,borderWidth:1,borderColor:C.border,borderRadius:10}}/>
      <Text style={{color:C.textMuted,fontSize:13,lineHeight:19}}>The exercise order and groups are saved. Next time, previous results are shown separately and every set starts unchecked.</Text>
      <GoalAction label={busy?'Saving…':'Save named workout'} onPress={()=>void save()} disabled={busy||!name.trim()}/>
      {status?<Text accessibilityRole="alert" style={{color:C.textMuted,fontSize:13}}>{status}</Text>:null}
    </ScrollView></KeyboardAvoidingView></Modal>
  </View>;
}
