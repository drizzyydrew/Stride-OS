import { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  activeStrengthElapsedSeconds,
  useActiveStrengthSessionStore,
} from '../../../src/store/activeStrengthSessionStore';
import { useStrengthStore } from '../../../src/store/strengthStore';
import { useAthleteStore } from '../../../src/store/athleteStore';
import { endStrengthLiveActivity, updateStrengthLiveActivity } from '../../../src/lib/strengthLiveActivity';
import { useColors } from '../../../src/theme/useColors';
import PickerWheel from '../../../src/components/ui/PickerWheel';
import { LAYOUT } from '../../../src/constants/layout';
import type { CompletedExercise } from '../../../src/types/strength';

function primaryRepCount(reps: string): number {
  const match = reps.match(/\d+/);
  return match ? Number(match[0]) : 8;
}

function formatElapsed(seconds: number): string {
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

function sessionExerciseSupport(name: string, equipment: string[]) {
  const lower = name.toLowerCase();
  return {
    how: 'Set up in a stable position, use a controlled range, and keep each repetition repeatable.',
    feel: lower.includes('plank') || lower.includes('hold')
      ? 'Steady trunk tension with normal breathing.'
      : 'Working effort in the target muscles without sharp, escalating, or unfamiliar symptoms.',
    easier: lower.includes('single') || lower.includes('lunge')
      ? 'Use bodyweight, shorten the range, or hold a stable support.'
      : equipment.includes('barbell')
        ? 'Reduce the load or use a dumbbell or bodyweight variation.'
        : 'Reduce load, range, or repetitions.',
  };
}

export default function PresetStrengthSessionScreen() {
  const C = useColors();
  const router = useRouter();
  const session = useActiveStrengthSessionStore(state => state.session);
  const pause = useActiveStrengthSessionStore(state => state.pause);
  const resume = useActiveStrengthSessionStore(state => state.resume);
  const completeExercise = useActiveStrengthSessionStore(state => state.completeExercise);
  const setExerciseRpe = useActiveStrengthSessionStore(state => state.setExerciseRpe);
  const setExerciseLoad = useActiveStrengthSessionStore(state => state.setExerciseLoad);
  const goToExercise = useActiveStrengthSessionStore(state => state.goToExercise);
  const clearSession = useActiveStrengthSessionStore(state => state.clearSession);
  const manualLog = useStrengthStore(state => state.manualLog);
  const fatigueScore = useAthleteStore(state => state.fatigueScore);
  const currentWeek = useAthleteStore(state => state.currentWeek);
  const [elapsed, setElapsed] = useState(() => activeStrengthElapsedSeconds(session));
  const [rpePickerExerciseId, setRpePickerExerciseId] = useState<string | null>(null);

  useEffect(() => {
    const tick = () => setElapsed(activeStrengthElapsedSeconds(useActiveStrengthSessionStore.getState().session));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, []);

  const current = session?.exercises[session.currentExerciseIndex] ?? null;
  const next = session?.exercises[session.currentExerciseIndex + 1] ?? null;
  const allComplete = Boolean(session && session.completedExerciseIds.length >= session.exercises.length);
  const overallRpe = useMemo(() => {
    if (!session) return 7;
    const values = Object.values(session.rpeByExercise);
    return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 7;
  }, [session]);

  useEffect(() => {
    if (!session || !current) return;
    updateStrengthLiveActivity({
      workoutName: session.workoutName,
      elapsedSeconds: elapsed,
      currentExercise: `${current.name} · ${current.sets}×${current.reps}`,
      nextExercise: next?.name ?? '',
      setsCompleted: session.completedExerciseIds.length,
      totalSets: session.exercises.length,
      isPaused: session.status === 'paused',
    }).catch(console.warn);
  }, [current, elapsed, next, session]);

  if (!session) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: C.bg }]}>
        <View style={styles.empty}>
          <Text style={[styles.title, { color: C.text }]}>No active preset workout</Text>
          <TouchableOpacity onPress={() => router.replace('/(tabs)/strength' as never)}>
            <Text style={{ color: C.primary, fontWeight: '800' }}>Open Preset Library</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const saveAndFinish = () => {
    const exercises: CompletedExercise[] = session.exercises.map(exercise => ({
      exerciseId: exercise.id,
      sets: Array.from({ length: exercise.sets }, () => ({
        reps: primaryRepCount(exercise.reps),
        load: session.loadByExercise[exercise.id] || (exercise.equipment.includes('bodyweight') ? 'BW' : undefined),
        rpe: session.rpeByExercise[exercise.id] ?? overallRpe,
        completed: session.completedExerciseIds.includes(exercise.id),
      })),
      notes: exercise.notes,
    }));
    manualLog({
      completionKey: `preset_${session.workoutId}_${session.startedAt}`,
      sessionType: 'full_body',
      goal: 'maintenance',
      week: Math.max(1, currentWeek),
      plannedDuration: session.plannedDurationMin,
      actualDuration: Math.max(1, Math.round(elapsed / 60)),
      exercises,
      overallRpe,
      notes: `Preset Workout · ${session.workoutName}`,
      source: 'preset',
      presetId: session.workoutId,
      workoutName: session.workoutName,
    }, fatigueScore);
    endStrengthLiveActivity().catch(console.warn);
    clearSession();
    router.replace({
      pathname: '/(tabs)/strength/preset-complete',
      params: {
        name: session.workoutName,
        duration: Math.max(1, Math.round(elapsed / 60)),
        rpe: overallRpe,
        logId: `preset_${session.workoutId}_${session.startedAt}`,
      },
    } as never);
  };

  const cancel = () => Alert.alert(
    'End preset workout?',
    'Ending now discards the active session. It does not modify the preset or any Training Block Workout.',
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

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: C.bg }]} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconButton}><Ionicons name="chevron-back" size={24} color={C.text} /></TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.eyebrow, { color: C.textDim }]}>ACTIVE PRESET WORKOUT</Text>
          <Text style={[styles.title, { color: C.text }]} numberOfLines={1}>{session.workoutName}</Text>
        </View>
        <Text style={[styles.timer, { color: C.primary }]}>{formatElapsed(elapsed)}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={[styles.progressCard, { backgroundColor: C.primaryDim, borderColor: C.primary }]}>
          <Text style={[styles.progress, { color: C.text }]}>{session.completedExerciseIds.length} of {session.exercises.length} exercises complete</Text>
          <View style={[styles.progressTrack, { backgroundColor: C.cardAlt }]}>
            <View style={[styles.progressFill, { backgroundColor: C.primary, width: `${session.exercises.length ? session.completedExerciseIds.length / session.exercises.length * 100 : 0}%` }]} />
          </View>
          <View style={styles.actions}>
            <TouchableOpacity style={[styles.secondaryButton, { borderColor: C.border }]} onPress={session.status === 'active' ? pause : resume}>
              <Ionicons name={session.status === 'active' ? 'pause' : 'play'} size={16} color={C.text} />
              <Text style={[styles.secondaryText, { color: C.text }]}>{session.status === 'active' ? 'Pause' : 'Resume'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.secondaryButton, { borderColor: C.critical }]} onPress={cancel}>
              <Text style={[styles.secondaryText, { color: C.critical }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: C.card, borderColor: C.border }]}> 
          <Text style={[styles.exerciseName, { color: C.text }]}>Warm-Up</Text>
          <Text style={[styles.instructions, { color: C.textMuted }]}>Spend about five minutes on easy movement, joint-specific preparation, and lighter practice sets before the first working exercise.</Text>
        </View>
        <Text style={[styles.eyebrow, { color: C.textDim, marginBottom: 8 }]}>EXERCISE-BY-EXERCISE FLOW</Text>
        {session.exercises.map((exercise, index) => {
          const done = session.completedExerciseIds.includes(exercise.id);
          const selected = index === session.currentExerciseIndex;
          const support = sessionExerciseSupport(exercise.name, exercise.equipment);
          return (
            <TouchableOpacity
              key={exercise.id}
              style={[styles.exerciseCard, {
                backgroundColor: done ? C.primaryDim : C.card,
                borderColor: selected ? C.primary : C.border,
                borderWidth: selected ? 2 : 1,
              }]}
              onPress={() => goToExercise(index)}
              activeOpacity={0.85}
            >
              <View style={styles.exerciseHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.exerciseName, { color: C.text }]}>{exercise.name}</Text>
                  <Text style={[styles.meta, { color: C.textMuted }]}>{exercise.sets} sets · {exercise.reps} · {exercise.equipment.join(', ')}</Text>
                </View>
                {done ? <Ionicons name="checkmark-circle" size={23} color={C.primary} /> : null}
              </View>
              {selected && !done ? (
                <View style={{ marginTop: 12 }}>
                  <Text style={[styles.detailLabel, { color: C.textDim }]}>HOW TO PERFORM</Text>
                  <Text style={[styles.instructions, { color: C.textMuted }]}>{support.how}</Text>
                  <Text style={[styles.detailLabel, { color: C.textDim }]}>COACHING CUES</Text>
                  <Text style={[styles.instructions, { color: C.textMuted }]}> 
                    {exercise.notes ?? 'Use a controlled range, maintain stable technique, and choose a load appropriate for today.'}
                  </Text>
                  <Text style={[styles.detailLabel, { color: C.textDim }]}>WHAT IT SHOULD FEEL LIKE</Text>
                  <Text style={[styles.instructions, { color: C.textMuted }]}>{support.feel}</Text>
                  <Text style={[styles.detailLabel, { color: C.textDim }]}>WHEN TO STOP OR MODIFY</Text>
                  <Text style={[styles.instructions, { color: C.textMuted }]}>Stop the set for pain, dizziness, or meaningful loss of control.</Text>
                  <Text style={[styles.detailLabel, { color: C.textDim }]}>EASIER ALTERNATIVE</Text>
                  <Text style={[styles.instructions, { color: C.textMuted }]}>{support.easier}</Text>
                  <TextInput
                    value={session.loadByExercise[exercise.id] ?? ''}
                    onChangeText={value => setExerciseLoad(exercise.id, value)}
                    placeholder="Load used, e.g. 45 lb or Bodyweight"
                    placeholderTextColor={C.textDim}
                    style={[styles.input, { color: C.text, borderColor: C.border, backgroundColor: C.bg }]}
                  />
                  <TouchableOpacity style={[styles.rpeButton, { backgroundColor: C.cardAlt }]} onPress={() => setRpePickerExerciseId(exercise.id)}>
                    <Text style={[styles.secondaryText, { color: C.text }]}>RPE</Text>
                    <Text style={[styles.rpeValue, { color: C.primary }]}>{session.rpeByExercise[exercise.id] ?? 'Set effort'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.completeButton, { backgroundColor: C.primary }]} onPress={() => completeExercise(exercise.id)}>
                    <Text style={[styles.completeText, { color: C.onPrimary }]}>Complete Exercise</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </TouchableOpacity>
          );
        })}
        <View style={[styles.summaryCard, { backgroundColor: C.card, borderColor: C.border }]}>
          <Text style={[styles.exerciseName, { color: C.text }]}>Volume Summary</Text>
          <Text style={[styles.meta, { color: C.textMuted }]}>
            {session.exercises.reduce((total, exercise) => total + exercise.sets, 0)} prescribed sets · Overall RPE {overallRpe}
          </Text>
          <Text style={[styles.instructions, { color: C.textMuted }]}>
            Cool down with easy movement and save when the session reflects what you completed.
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.finishButton, { backgroundColor: allComplete ? C.primary : C.cardAlt }]}
          onPress={saveAndFinish}
        >
          <Text style={[styles.completeText, { color: allComplete ? C.onPrimary : C.text }]}>Save and Finish</Text>
        </TouchableOpacity>
      </ScrollView>
      <PickerWheel
        visible={rpePickerExerciseId !== null}
        title="Exercise RPE"
        values={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]}
        selectedValue={rpePickerExerciseId ? session.rpeByExercise[rpePickerExerciseId] ?? 7 : 7}
        formatValue={value => `RPE ${value}`}
        onClose={() => setRpePickerExerciseId(null)}
        onConfirm={value => {
          if (rpePickerExerciseId) setExerciseRpe(rpePickerExerciseId, value);
          setRpePickerExerciseId(null);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 10, gap: 8 },
  iconButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { fontSize: 10, fontWeight: '900', letterSpacing: 1.4 },
  title: { fontSize: 24, fontFamily: 'CormorantGaramond_700Bold' },
  timer: { fontSize: 16, fontWeight: '900' },
  content: { paddingHorizontal: 18, paddingBottom: LAYOUT.screenPadBottom },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  progressCard: { borderWidth: 1, borderRadius: 16, padding: 15, marginBottom: 18 },
  progress: { fontSize: 14, fontWeight: '900' },
  progressTrack: { height: 7, borderRadius: 4, marginTop: 10, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  secondaryButton: { minHeight: 42, borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  secondaryText: { fontSize: 12, fontWeight: '800' },
  exerciseCard: { borderRadius: 14, padding: 14, marginBottom: 10 },
  exerciseHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  exerciseName: { fontSize: 16, fontWeight: '900' },
  meta: { fontSize: 12, lineHeight: 18, marginTop: 3 },
  instructions: { fontSize: 12, lineHeight: 18, marginTop: 8 },
  detailLabel: { fontSize: 9, fontWeight: '900', letterSpacing: 1, marginTop: 10 },
  input: { minHeight: 46, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, marginTop: 12, fontSize: 14 },
  rpeButton: { minHeight: 44, borderRadius: 10, paddingHorizontal: 12, marginTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rpeValue: { fontSize: 13, fontWeight: '900' },
  completeButton: { minHeight: 46, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  completeText: { fontSize: 13, fontWeight: '900' },
  summaryCard: { borderWidth: 1, borderRadius: 14, padding: 14, marginTop: 6 },
  finishButton: { minHeight: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
});
