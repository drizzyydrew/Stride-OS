import { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

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

function formatElapsed(seconds: number): string {
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

const EQUIPMENT_CHOICES: { type: EquipmentType; label: string }[] = [
  { type: 'bodyweight', label: 'Bodyweight' },
  { type: 'barbell', label: 'Barbell' },
  { type: 'dumbbell', label: 'Dumbbell' },
  { type: 'kettlebell', label: 'Kettlebell' },
  { type: 'cable', label: 'Cable' },
  { type: 'machine', label: 'Machine' },
  { type: 'resistance_band', label: 'Band' },
  { type: 'suspension_trainer', label: 'Suspension' },
  { type: 'medicine_ball', label: 'Med Ball' },
  { type: 'other', label: 'Other' },
];

function warmupKind(scheduledCategory: string | undefined): WarmupSessionKind {
  if (scheduledCategory === 'mobility') return 'mobility';
  if (scheduledCategory === 'rest') return 'active_recovery';
  return 'strength_general';
}

export default function CustomStrengthSessionScreen() {
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
  const [newExerciseName, setNewExerciseName] = useState('');
  const [newExerciseEquipment, setNewExerciseEquipment] = useState<EquipmentType>('bodyweight');
  const [warmupOpen, setWarmupOpen] = useState(false);

  useEffect(() => {
    const tick = () => setElapsed(activeStrengthElapsedSeconds(useActiveStrengthSessionStore.getState().session));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, []);

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

  function commitAddOrSubstitute() {
    if (!newExerciseName.trim()) return;
    addExercise({ name: newExerciseName.trim(), equipmentType: newExerciseEquipment });
    setNewExerciseName('');
    setNewExerciseEquipment('bodyweight');
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
        titleNumberOfLines={1}
        right={<Text style={[styles.timer, { color: C.primary }]}>{formatElapsed(elapsed)}</Text>}
      />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: LAYOUT.tabBarHeight + 40 }]} keyboardShouldPersistTaps="handled">
        <View style={[styles.progressCard, { backgroundColor: C.primaryDim, borderColor: C.primary }]}>
          <Text style={[styles.progress, { color: C.text }]}>{session.exercises.filter(e => !e.skipped).length} exercises added</Text>
          <View style={styles.actions}>
            <TouchableOpacity style={[styles.secondaryButton, { borderColor: C.border }]} onPress={session.status === 'active' ? pause : resume}>
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

        <Text style={[styles.eyebrow, styles.flowLabel, { color: C.textDim }]}>EXERCISES</Text>
        {session.exercises.map((exercise, index) => (
          <ExerciseCard
            key={exercise.id}
            exercise={exercise}
            index={index}
            total={session.exercises.length}
            C={C}
            weightUnit={weightUnit}
            onAddSet={() => addSet(exercise.id)}
            onDuplicateSet={setId => duplicateSet(exercise.id, setId)}
            onRemoveSet={setId => removeSet(exercise.id, setId)}
            onEditSet={(setId, patch) => editSet(exercise.id, setId, patch)}
            onToggleWarmup={setId => toggleSetWarmup(exercise.id, setId)}
            onToggleCompleted={setId => toggleSetCompleted(exercise.id, setId)}
            onRemoveExercise={() => removeExercise(exercise.id)}
            onSkipExercise={() => skipExercise(exercise.id, !exercise.skipped)}
            onReorder={direction => reorderExercise(exercise.id, direction)}
          />
        ))}

        <View style={[styles.summaryCard, { backgroundColor: C.card, borderColor: C.border, marginTop: 8 }]}>
          <Text style={[styles.exerciseName, { color: C.text }]}>Add Exercise</Text>
          <TextInput
            value={newExerciseName}
            onChangeText={setNewExerciseName}
            placeholder="Exercise name, e.g. Goblet Squat"
            placeholderTextColor={C.textDim}
            style={[styles.input, { color: C.text, borderColor: C.border, backgroundColor: C.bg }]}
          />
          <View style={styles.chipRow}>
            {EQUIPMENT_CHOICES.map(choice => (
              <TouchableOpacity
                key={choice.type}
                style={[styles.chip, {
                  backgroundColor: newExerciseEquipment === choice.type ? C.primaryDim : C.cardAlt,
                  borderColor: newExerciseEquipment === choice.type ? C.primary : C.border,
                }]}
                onPress={() => setNewExerciseEquipment(choice.type)}
              >
                <Text style={[styles.chipText, { color: newExerciseEquipment === choice.type ? C.primary : C.textMuted }]}>{choice.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity
            style={[styles.completeButton, { backgroundColor: newExerciseName.trim() ? C.primary : C.cardAlt, marginTop: 10 }]}
            onPress={commitAddOrSubstitute}
            disabled={!newExerciseName.trim()}
          >
            <Text style={[styles.completeText, { color: newExerciseName.trim() ? C.onPrimary : C.textMuted }]}>Add Exercise</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={[styles.finishButton, { backgroundColor: C.primary }]} onPress={finish}>
          <Text style={[styles.completeText, { color: C.onPrimary }]}>Finish Workout</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function SetRow({ set, index, C, weightUnit, onDuplicate, onRemove, onEdit, onToggleWarmup, onToggleCompleted }: {
  set: ActiveSetEntry;
  index: number;
  C: ReturnType<typeof useColors>;
  weightUnit: 'lb' | 'kg';
  onDuplicate: () => void;
  onRemove: () => void;
  onEdit: (patch: Partial<Omit<ActiveSetEntry, 'id'>>) => void;
  onToggleWarmup: () => void;
  onToggleCompleted: () => void;
}) {
  return (
    <View style={[styles.setRow, { borderColor: C.border, backgroundColor: set.isWarmup ? C.cardAlt : C.card }]}>
      <Text style={[styles.setIndex, { color: C.textDim }]}>{set.isWarmup ? 'W' : index + 1}</Text>
      <TextInput
        value={set.reps != null ? String(set.reps) : ''}
        onChangeText={value => onEdit({ reps: value ? Number(value.replace(/[^0-9]/g, '')) : undefined })}
        placeholder="reps"
        placeholderTextColor={C.textDim}
        keyboardType="number-pad"
        style={[styles.setInput, { color: C.text, borderColor: C.border }]}
      />
      <TextInput
        value={set.weight != null ? String(set.weight) : ''}
        onChangeText={value => onEdit({ weight: value ? Number(value.replace(/[^0-9.]/g, '')) : undefined, weightUnit })}
        placeholder={weightUnit}
        placeholderTextColor={C.textDim}
        keyboardType="decimal-pad"
        style={[styles.setInput, { color: C.text, borderColor: C.border }]}
      />
      <TextInput
        value={set.rpe != null ? String(set.rpe) : ''}
        onChangeText={value => onEdit({ rpe: value ? Number(value.replace(/[^0-9]/g, '')) : undefined })}
        placeholder="RPE"
        placeholderTextColor={C.textDim}
        keyboardType="number-pad"
        style={[styles.setInput, { color: C.text, borderColor: C.border }]}
      />
      <TouchableOpacity onPress={onToggleWarmup} hitSlop={6}>
        <Ionicons name="flame-outline" size={18} color={set.isWarmup ? C.warning : C.textDim} />
      </TouchableOpacity>
      <TouchableOpacity onPress={onDuplicate} hitSlop={6}>
        <Ionicons name="copy-outline" size={18} color={C.textDim} />
      </TouchableOpacity>
      <TouchableOpacity onPress={onRemove} hitSlop={6}>
        <Ionicons name="trash-outline" size={18} color={C.critical} />
      </TouchableOpacity>
      <TouchableOpacity onPress={onToggleCompleted} hitSlop={6}>
        <Ionicons name={set.completed ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={set.completed ? C.primary : C.textDim} />
      </TouchableOpacity>
    </View>
  );
}

function ExerciseCard({
  exercise, index, total, C, weightUnit,
  onAddSet, onDuplicateSet, onRemoveSet, onEditSet, onToggleWarmup, onToggleCompleted,
  onRemoveExercise, onSkipExercise, onReorder,
}: {
  exercise: ActiveStrengthExercise;
  index: number;
  total: number;
  C: ReturnType<typeof useColors>;
  weightUnit: 'lb' | 'kg';
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
        <View style={{ flex: 1 }}>
          <Text style={[styles.exerciseName, { color: C.text }]}>{exercise.name}{exercise.skipped ? ' (skipped)' : ''}</Text>
          <Text style={[styles.meta, { color: C.textMuted }]}>{exercise.equipmentType ?? 'other'}</Text>
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
          {exercise.setEntries.map((set, setIndex) => (
            <SetRow
              key={set.id}
              set={set}
              index={setIndex}
              C={C}
              weightUnit={weightUnit}
              onDuplicate={() => onDuplicateSet(set.id)}
              onRemove={() => onRemoveSet(set.id)}
              onEdit={patch => onEditSet(set.id, patch)}
              onToggleWarmup={() => onToggleWarmup(set.id)}
              onToggleCompleted={() => onToggleCompleted(set.id)}
            />
          ))}
          <TouchableOpacity style={[styles.addSetButton, { borderColor: C.border }]} onPress={onAddSet}>
            <Ionicons name="add" size={16} color={C.primary} />
            <Text style={[styles.secondaryText, { color: C.primary }]}>Add Set</Text>
          </TouchableOpacity>
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
