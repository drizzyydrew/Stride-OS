import { useProAccess } from '../../../src/hooks/useProAccess';
import { requireProAccess } from '../../../src/lib/pro-access';
import ProAccessNotice from '../../../src/components/subscription/ProAccessNotice';
import ExerciseGuidance from '../../../src/components/strength/exercise-guidance';
import StrengthCalculatorLink from '../../../src/components/strength/strength-calculator-link';
import { strengthGuidance } from '../../../src/utils/strengthGuidance';
import ExerciseMuscleTags from '../../../src/components/strength/ExerciseMuscleTags';
import CustomExercisePicker from '../../../src/components/strength/CustomExercisePicker';
import SaveWorkoutTemplateControl from '../../../src/components/strength/SaveWorkoutTemplateControl';
import StrengthSetEditor from '../../../src/components/strength/StrengthSetEditor';
import { GoalAction } from '../../../src/components/goals/GoalLifecycleCard';
import { captureOwnerLease, ownerLeaseIsCurrent, getLocalDataOwner } from '../../../src/lib/localDataOwner';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import SafeAreaView from '../../../src/components/layout/PageSafeAreaView';

import {
  activeStrengthElapsedSeconds,
  useActiveStrengthSessionStore,
  type EquipmentType,
} from '../../../src/store/activeStrengthSessionStore';
import type { ActiveSetEntry, ActiveStrengthExercise } from '../../../src/utils/strengthSession';
import { useSettingsStore } from '../../../src/store/settingsStore';
import { useStrengthStore } from '../../../src/store/strengthStore';
import { useAthleteStore } from '../../../src/store/athleteStore';
import { useColors } from '../../../src/theme/useColors';
import ScreenHeader from '../../../src/components/layout/ScreenHeader';
import { LAYOUT } from '../../../src/constants/layout';
import { endStrengthLiveActivity } from '../../../src/lib/strengthLiveActivity';
import { useWeekPlan } from '../../../src/hooks/useWeekPlan';
import { useScheduledSessions } from '../../../src/hooks/useScheduledSessions';
import { summarizeStrengthSession } from '../../../src/utils/strengthSummary';
import { completedExercisesFromActiveSession } from '../../../src/utils/strengthPersistence';
import { categoryFromScheduledType, classifySubstitution } from '../../../src/utils/substitution';
import { warmupForSession, type WarmupSessionKind } from '../../../src/utils/warmupProtocols';
import ExerciseAdjustment from '../../../src/components/strength/ExerciseAdjustment';
import {
  endStrideWatchWorkout,
  pauseStrideWatchWorkout,
  resumeStrideWatchWorkout,
} from '../../../modules/stride-watch-connectivity/src';

function formatElapsed(seconds: number): string {
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}


function warmupKind(scheduledCategory: string | undefined): WarmupSessionKind {
  if (scheduledCategory === 'mobility') return 'mobility';
  if (scheduledCategory === 'rest') return 'active_recovery';
  return 'strength_general';
}

export default function CustomStrengthSessionScreen() {
  const access = useProAccess('custom-workouts');
  const [showMembership,setShowMembership]=useState(false);
  const paidActionBusy=useRef(false);
  const C = useColors();
  const router = useRouter();
  const { units } = useSettingsStore();
  const weightUnit: 'lb' | 'kg' = units === 'imperial' ? 'lb' : 'kg';
  const weekPlan = useWeekPlan();
  const scheduled = useScheduledSessions(weekPlan);
  const manualLog = useStrengthStore(state => state.manualLog);
  const fatigueScore = useAthleteStore(state => state.fatigueScore);
  const currentWeek = useAthleteStore(state => state.currentWeek);

  const session = useActiveStrengthSessionStore(state => state.session);
  const pause = useActiveStrengthSessionStore(state => state.pause);
  const resume = useActiveStrengthSessionStore(state => state.resume);
  const clearSession = useActiveStrengthSessionStore(state => state.clearSession);
  const addExercise = useActiveStrengthSessionStore(state => state.addExercise);
  const removeExercise = useActiveStrengthSessionStore(state => state.removeExercise);
  const reorderExercise = useActiveStrengthSessionStore(state => state.reorderExercise);
  const skipExercise = useActiveStrengthSessionStore(state => state.skipExercise);
  const addSet = useActiveStrengthSessionStore(state => state.addSet);
  const removeSet = useActiveStrengthSessionStore(state => state.removeSet);
  const duplicateSet = useActiveStrengthSessionStore(state => state.duplicateSet);
  const editSet = useActiveStrengthSessionStore(state => state.editSet);
  const toggleSetWarmup = useActiveStrengthSessionStore(state => state.toggleSetWarmup);
  const toggleSetCompleted = useActiveStrengthSessionStore(state => state.toggleSetCompleted);

  const [elapsed, setElapsed] = useState(() => activeStrengthElapsedSeconds(session));
  const editorLease=useRef(captureOwnerLease());
  const [selectMode,setSelectMode]=useState(false);
  const [selectedIds,setSelectedIds]=useState<string[]>([]);
  const [actionsOpen,setActionsOpen]=useState(false);
  const [groupStatus,setGroupStatus]=useState('');
  const [warmupOpen, setWarmupOpen] = useState(false);

  useEffect(() => {
    const tick = () => setElapsed(activeStrengthElapsedSeconds(useActiveStrengthSessionStore.getState().session));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(()=>getLocalDataOwner()?.onInvalidated(()=>{setSelectMode(false);setSelectedIds([]);setActionsOpen(false);}),[]);

  const groupLabels=useMemo(()=>{const labels=new Map<string,string>();const counts={superset:0,circuit:0};for(const exercise of session?.exercises??[]){const g=exercise.group;if(g&&!labels.has(g.id)){counts[g.kind]++;labels.set(g.id,`${g.kind==='superset'?'Superset':'Circuit'} ${counts[g.kind]}`);}}return labels;},[session?.exercises]);

  const isCustom = Boolean(session && session.source === 'custom');
  const warmup = useMemo(() => warmupForSession(warmupKind(session?.scheduledCategory)), [session?.scheduledCategory]);

  if (!isCustom || !session) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: C.bg }]}>
        <View style={styles.empty}>
          <Text style={[styles.title, { color: C.text }]}>No active custom workout</Text>
          <Text style={{ color: C.textMuted, textAlign: 'center', marginTop: 8 }}>
            Start a custom workout from the Strength tab or from a scheduled session's action sheet.
          </Text>
          <TouchableOpacity style={{ marginTop: 16 }} onPress={() => router.replace('/(tabs)/strength' as never)}>
            <Text style={{ color: C.primary, fontWeight: '800' }}>Back to Strength</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // `session` is narrowed non-null by the guard above, but function
  // declarations below (called later, from onPress handlers) don't retain
  // that narrowing — a stable non-null local does.
  const activeSession = session;

  function pauseSession() {
    pause();
    pauseStrideWatchWorkout().catch(() => undefined);
  }

  function resumeSession() {
    resume();
    resumeStrideWatchWorkout().catch(() => undefined);
  }

  function currentEditor() {
    const current=useActiveStrengthSessionStore.getState().session;
    const lease=captureOwnerLease();return ownerLeaseIsCurrent(editorLease.current)&&!!lease&&lease.ownerUserId===editorLease.current?.ownerUserId&&ownerLeaseIsCurrent(lease)&&current?.workoutInstanceId===activeSession.workoutInstanceId&&current.source==='custom';
  }
  function groupSelected(kind:'superset'|'circuit'|null) {
    void paidAction(()=>{
    if(!currentEditor())return;const selected=useActiveStrengthSessionStore.getState().session!.exercises.filter(ex=>selectedIds.includes(ex.id)&&!ex.skipped).map(ex=>ex.id);
    if(kind&&(selected.length<2||kind==='superset'&&selected.length!==2)){setGroupStatus('Select two available exercises for a superset, or two or more for a circuit.');return;}
    useActiveStrengthSessionStore.getState().groupExercises(selected,kind);
    setGroupStatus(kind?`${kind==='superset'?'Superset':'Circuit'} saved. Complete and record each set separately.`:'Selected exercise groups removed.');setActionsOpen(false);setSelectedIds([]);setSelectMode(false);
    });
  }
  function makeDropSet() {
    void paidAction(()=>{
    if(!currentEditor()||selectedIds.length!==1)return;const exercise=useActiveStrengthSessionStore.getState().session!.exercises.find(ex=>ex.id===selectedIds[0]&&!ex.skipped);if(!exercise){setGroupStatus('Choose an available exercise for a drop set.');return;}useActiveStrengthSessionStore.getState().addDropSet(exercise.id);
    setGroupStatus('Drop-set stage added to that exercise. Enter an appropriate lower load; no stage is marked complete.');setActionsOpen(false);setSelectedIds([]);setSelectMode(false);
    });
  }

  async function paidAction(action:()=>void) {
    if(paidActionBusy.current||!currentEditor())return;
    paidActionBusy.current=true;
    try { await requireProAccess('custom-workouts'); if(currentEditor()) action(); }
    catch(error) { if(currentEditor()) { setShowMembership(true);setGroupStatus(error instanceof Error?error.message:'Membership could not be verified. Your workout was kept.'); } }
    finally { paidActionBusy.current=false; }
  }

  function saveDraftAndExit() {
    router.replace('/(tabs)/strength' as never);
  }

  function cancel() {
    Alert.alert(
      'End custom workout?',
      'Ending now discards the session without saving it to history.',
      [
        { text: 'Keep Workout', style: 'cancel' },
        {
          text: 'End Without Saving',
          style: 'destructive',
          onPress: () => {
            endStrengthLiveActivity().catch(console.warn);
            endStrideWatchWorkout().catch(() => undefined);
            clearSession();
            router.replace('/(tabs)/strength' as never);
          },
        },
      ],
    );
  }

  function finish() {
    const completedSetCount = activeSession.exercises.reduce(
      (sum, exercise) => sum + exercise.setEntries.filter(entry => entry.completed).length, 0,
    );
    if (completedSetCount === 0) {
      Alert.alert('Nothing logged yet', 'Complete at least one set before finishing, or end without saving.');
      return;
    }

    const summary = summarizeStrengthSession({
      exercises: activeSession.exercises,
      rpeByExercise: activeSession.rpeByExercise,
      durationSeconds: elapsed,
    });

    const scheduledSession = activeSession.scheduledSessionId ? scheduled.getSessionById(activeSession.scheduledSessionId) : null;
    const substitution = scheduledSession
      ? classifySubstitution({
        scheduledCategory: categoryFromScheduledType(activeSession.scheduledCategory ?? scheduledSession.activityType),
        actualCategory: 'strength',
        intentMatch: categoryFromScheduledType(activeSession.scheduledCategory ?? scheduledSession.activityType) === 'strength',
      })
      : null;

    const classification = substitution?.classification;
    const durationMinutes = Math.max(1, summary.durationMinutes);
    const overallRpe = summary.averageRpe ?? undefined;

    manualLog({
      completionKey: `custom_${activeSession.workoutInstanceId}`,
      templateId: activeSession.templateId,
      scheduledSessionId: activeSession.scheduledSessionId,
      sessionType: scheduledSession?.strengthSession?.sessionType ?? 'full_body',
      goal: scheduledSession?.strengthSession?.goal ?? 'maintenance',
      week: Math.max(1, currentWeek),
      plannedDuration: activeSession.plannedDurationMin,
      actualDuration: durationMinutes,
      exercises: completedExercisesFromActiveSession(
        activeSession.exercises,
        'custom',
        activeSession.completedExerciseIds,
        activeSession.rpeByExercise,
        activeSession.loadByExercise,
      ),
      overallRpe,
      notes: `Custom Workout · ${activeSession.workoutName}`,
      source: scheduledSession ? 'generated' : 'manual',
      completionClassification: classification,
    }, fatigueScore);

    endStrengthLiveActivity().catch(console.warn);
    endStrideWatchWorkout().catch(() => undefined);
    clearSession();

    const lines = [
      `${summary.completedSets} sets · ${summary.totalReps} main reps`,
      summary.hasExternalLoadVolume ? `External load: ${summary.externalLoadVolumeLb.toLocaleString()} lb` : null,
      summary.bandSetsCount ? `Band sets: ${summary.bandSetsCount} (not counted as load)` : null,
      summary.bodyweightSetsCount ? `Bodyweight sets: ${summary.bodyweightSetsCount}` : null,
      summary.totalHoldSeconds ? `Hold time: ${summary.totalHoldSeconds}s` : null,
      summary.warmupSetsCount ? `Warm-up sets (excluded above): ${summary.warmupSetsCount}` : null,
    ].filter(Boolean).join('\n');

    Alert.alert('Custom workout saved', lines || 'Saved to your training history.', [
      { text: 'Done', onPress: () => router.replace('/(tabs)/strength' as never) },
    ]);
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: C.bg }]} edges={['top']}>
      <ScreenHeader
        eyebrow="CUSTOM WORKOUT"
        title={session.workoutName}
        onBack={saveDraftAndExit}
        titleNumberOfLines={2}
        right={<Text style={[styles.timer, { color: C.primary }]}>{formatElapsed(elapsed)}</Text>}
      />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: LAYOUT.tabBarHeight + 40 }]} keyboardShouldPersistTaps="handled">
        <View style={[styles.progressCard, { backgroundColor: C.primaryDim, borderColor: C.primary }]}>
          <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8,flexWrap:'wrap'}}>
            <Text style={[styles.progress, { color: C.text }]}>{session.exercises.filter(e => !e.skipped).length} exercises added</Text>
            <View style={{flexDirection:'row',gap:8}}>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel={selectMode?'Finish selecting exercises':'Select exercises'} onPress={()=>{if(!access.allowed){setShowMembership(true);return;}setSelectMode(value=>!value);setSelectedIds([]);setActionsOpen(false);}} style={styles.secondaryButton}><Text style={[styles.secondaryText,{color:C.primary}]}>{selectMode?'Done':'Select'}</Text></TouchableOpacity>
              {selectMode&&selectedIds.length?<TouchableOpacity accessibilityRole="button" accessibilityLabel="More actions for selected exercises" onPress={()=>setActionsOpen(value=>!value)} style={styles.secondaryButton}><Ionicons name="ellipsis-horizontal" size={22} color={C.primary}/></TouchableOpacity>:null}
            </View>
          </View>
          {showMembership&&!access.allowed?<ProAccessNotice access={access} title="Workout groups and templates are part of Pro"/>:null}
          {actionsOpen&&access.allowed?<View style={{gap:8,marginTop:12}}>
            <Text style={{color:C.textMuted,fontSize:13}}>{selectedIds.length} selected. Superset pairs two exercises; a circuit can contain two or more. A drop set is a sequence within one exercise.</Text>
            {selectedIds.length>=2?<><GoalAction label="Make superset" disabled={selectedIds.length!==2} secondary onPress={()=>groupSelected('superset')}/><GoalAction label="Make circuit" secondary onPress={()=>groupSelected('circuit')}/></>:<GoalAction label="Add drop-set stage" secondary onPress={makeDropSet}/>}
            <GoalAction label="Remove selected groups" secondary onPress={()=>groupSelected(null)}/>
          </View>:null}
          {groupStatus?<Text accessibilityRole="alert" style={{color:C.textMuted,fontSize:13,lineHeight:19,marginTop:8}}>{groupStatus}</Text>:null}
          <View style={styles.actions}>
            <TouchableOpacity style={[styles.secondaryButton, { borderColor: C.border }]} onPress={session.status === 'active' ? pauseSession : resumeSession}>
              <Ionicons name={session.status === 'active' ? 'pause' : 'play'} size={16} color={C.text} />
              <Text style={[styles.secondaryText, { color: C.text }]}>{session.status === 'active' ? 'Pause' : 'Resume'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.secondaryButton, { borderColor: C.border }]} onPress={saveDraftAndExit}>
              <Text style={[styles.secondaryText, { color: C.text }]}>Save Draft & Exit</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.secondaryButton, { borderColor: C.critical }]} onPress={cancel}>
              <Text style={[styles.secondaryText, { color: C.critical }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{marginBottom:16}}><SaveWorkoutTemplateControl key={session.workoutInstanceId} session={session}/></View>

        {warmup.items.length > 0 ? (
          <TouchableOpacity
            style={[styles.summaryCard, { backgroundColor: C.card, borderColor: C.border }]}
            onPress={() => setWarmupOpen(o => !o)}
            activeOpacity={0.8}
          >
            <Text style={[styles.exerciseName, { color: C.text }]}>{warmup.title}</Text>
            <Text style={[styles.meta, { color: C.textMuted }]}>{warmup.durationMinutes} min</Text>
            {warmupOpen ? warmup.items.map(item => (
              <Text key={item} style={[styles.instructions, { color: C.textMuted }]}>• {item}</Text>
            )) : null}
          </TouchableOpacity>
        ) : null}

        <StrengthCalculatorLink />
        <Text style={[styles.eyebrow, styles.flowLabel, { color: C.textDim }]}>EXERCISES</Text>
        {session.exercises.map((exercise, index) => (
          <View key={exercise.id}>
          <ExerciseCard
            exercise={exercise}
            index={index}
            total={session.exercises.length}
            C={C}
            weightUnit={weightUnit}
            groupLabel={exercise.group?groupLabels.get(exercise.group.id):undefined}
            selectMode={selectMode}
            selected={selectedIds.includes(exercise.id)}
            onSelect={()=>{if(!exercise.skipped&&currentEditor())setSelectedIds(ids=>ids.includes(exercise.id)?ids.filter(id=>id!==exercise.id):[...ids,exercise.id]);}}
            onAddSet={() => addSet(exercise.id)}
            onDuplicateSet={setId => duplicateSet(exercise.id, setId)}
            onRemoveSet={setId => removeSet(exercise.id, setId)}
            onEditSet={(setId, patch) => editSet(exercise.id, setId, patch)}
            onToggleWarmup={setId => toggleSetWarmup(exercise.id, setId)}
            onToggleCompleted={setId => toggleSetCompleted(exercise.id, setId)}
            onRemoveExercise={() => removeExercise(exercise.id)}
            onSkipExercise={() => skipExercise(exercise.id, !exercise.skipped)}
            onReorder={direction => {void paidAction(()=>reorderExercise(exercise.id, direction));}}
          />
          <ExerciseAdjustment exercise={exercise} workoutInstanceId={session.workoutInstanceId} showMuscleTags={false} />
          </View>
        ))}

        <View style={[styles.summaryCard, { backgroundColor: C.card, borderColor: C.border, marginTop: 8 }]}>
          <CustomExercisePicker key={session.workoutInstanceId} onAdd={input=>{if(currentEditor())addExercise(input);}}/>
        </View>

        <TouchableOpacity style={[styles.finishButton, { backgroundColor: C.primary }]} onPress={finish}>
          <Text style={[styles.completeText, { color: C.onPrimary }]}>Finish Workout</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function ExerciseCard({
  exercise, index, total, C, weightUnit, selectMode, selected, onSelect, groupLabel,
  onAddSet, onDuplicateSet, onRemoveSet, onEditSet, onToggleWarmup, onToggleCompleted,
  onRemoveExercise, onSkipExercise, onReorder,
}: {
  exercise: ActiveStrengthExercise;
  index: number;
  total: number;
  C: ReturnType<typeof useColors>;
  weightUnit: 'lb' | 'kg';
  selectMode:boolean; selected:boolean; onSelect:()=>void; groupLabel?:string;
  onAddSet: () => void;
  onDuplicateSet: (setId: string) => void;
  onRemoveSet: (setId: string) => void;
  onEditSet: (setId: string, patch: Partial<Omit<ActiveSetEntry, 'id'>>) => void;
  onToggleWarmup: (setId: string) => void;
  onToggleCompleted: (setId: string) => void;
  onRemoveExercise: () => void;
  onSkipExercise: () => void;
  onReorder: (direction: 'up' | 'down') => void;
}) {
  return (
    <View style={[styles.exerciseCard, { backgroundColor: exercise.skipped ? C.cardAlt : C.card, borderColor: C.border, opacity: exercise.skipped ? 0.6 : 1 }]}>
      <View style={styles.exerciseHeader}>
        {selectMode?<TouchableOpacity accessibilityRole="checkbox" accessibilityLabel={`Select ${exercise.name}`} accessibilityState={{checked:selected,disabled:Boolean(exercise.skipped)}} disabled={exercise.skipped} onPress={onSelect} style={{minWidth:44,minHeight:44,justifyContent:'center'}}><Ionicons name={selected?'checkbox':'square-outline'} size={24} color={C.primary}/></TouchableOpacity>:null}
        <View style={{ flex: 1 }}>
          <Text style={[styles.exerciseName, { color: C.text }]}>{exercise.name}{exercise.skipped ? ' (skipped)' : ''}</Text>
          <Text style={[styles.meta, { color: C.textMuted }]}>{exercise.equipmentType ?? 'other'}</Text>
          <ExerciseMuscleTags exercise={exercise}/>
          {exercise.group?<Text style={[styles.meta,{color:C.primary}]}>{groupLabel}</Text>:null}
        </View>
        <TouchableOpacity onPress={() => onReorder('up')} disabled={index === 0} hitSlop={6}>
          <Ionicons name="chevron-up" size={18} color={index === 0 ? C.textDim : C.text} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => onReorder('down')} disabled={index === total - 1} hitSlop={6}>
          <Ionicons name="chevron-down" size={18} color={index === total - 1 ? C.textDim : C.text} />
        </TouchableOpacity>
        <TouchableOpacity onPress={onSkipExercise} hitSlop={6}>
          <Ionicons name={exercise.skipped ? 'refresh-outline' : 'play-skip-forward-outline'} size={18} color={C.textDim} />
        </TouchableOpacity>
        <TouchableOpacity onPress={onRemoveExercise} hitSlop={6}>
          <Ionicons name="close-circle-outline" size={20} color={C.critical} />
        </TouchableOpacity>
      </View>
      {!exercise.skipped ? (
        <View style={{ marginTop: 8 }}>
          <ExerciseGuidance key={`${exercise.id}:${exercise.name}`} content={strengthGuidance({ id: exercise.canonicalExerciseId, name: exercise.name,
            equipment: exercise.equipment }, exercise.notes)} />
          <StrengthSetEditor sets={exercise.setEntries} equipmentType={exercise.equipmentType} weightUnit={weightUnit}
            onAdd={onAddSet} onDuplicate={onDuplicateSet} onRemove={onRemoveSet} onEdit={onEditSet}
            onToggleWarmup={onToggleWarmup} onToggleCompleted={onToggleCompleted}/>

        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  eyebrow: { fontSize: 10, fontWeight: '900', letterSpacing: 1.4 },
  title: { fontSize: 24, fontFamily: 'CormorantGaramond_700Bold' },
  timer: { fontSize: 16, fontWeight: '900' },
  content: { paddingHorizontal: 18 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  progressCard: { borderWidth: 1, borderRadius: 16, padding: 15, marginBottom: 18 },
  progress: { fontSize: 14, fontWeight: '900' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' },
  secondaryButton: { minHeight: 42, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  secondaryText: { fontSize: 12, fontWeight: '800' },
  exerciseCard: { borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 10 },
  exerciseHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  exerciseName: { fontSize: 16, fontWeight: '900' },
  meta: { fontSize: 12, lineHeight: 18, marginTop: 3 },
  instructions: { fontSize: 12, lineHeight: 18, marginTop: 4 },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 10, padding: 8, marginTop: 6 },
  setIndex: { width: 16, fontSize: 11, fontWeight: '800' },
  setInput: { flex: 1, minHeight: 34, borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, fontSize: 12 },
  addSetButton: { marginTop: 8, minHeight: 38, borderRadius: 9, borderWidth: 1, borderStyle: 'dashed', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  input: { minHeight: 46, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, marginTop: 10, fontSize: 14 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1 },
  chipText: { fontSize: 11, fontWeight: '700' },
  completeButton: { minHeight: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  completeText: { fontSize: 13, fontWeight: '900' },
  summaryCard: { borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 12 },
  flowLabel: { marginBottom: 12 },
  finishButton: { minHeight: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 4, marginBottom: 12 },
});
