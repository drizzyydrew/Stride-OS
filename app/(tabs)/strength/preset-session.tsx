import { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  activeStrengthElapsedSeconds,
  useActiveStrengthSessionStore,
} from '../../../src/store/activeStrengthSessionStore';
import { useStrengthStore } from '../../../src/store/strengthStore';
import { useAthleteStore } from '../../../src/store/athleteStore';
import {
  endStrengthLiveActivity,
  strengthLiveActivitySessionId,
  updateStrengthLiveActivity,
} from '../../../src/lib/strengthLiveActivity';
import { useColors } from '../../../src/theme/useColors';
import PickerWheel from '../../../src/components/ui/PickerWheel';
import ScreenHeader from '../../../src/components/layout/ScreenHeader';
import { LAYOUT } from '../../../src/constants/layout';
import { displayLabels } from '../../../src/utils/displayLabels';
import { getStrengthPresetWorkout } from '../../../src/constants/strengthBank';
import { warmupForSession, warmupKindForCategory } from '../../../src/utils/warmupProtocols';
import { summarizeStrengthSession } from '../../../src/utils/strengthSummary';
import { completedExercisesFromActiveSession } from '../../../src/utils/strengthPersistence';
import { useSettingsStore } from '../../../src/store/settingsStore';
import StrengthSetEditor from '../../../src/components/strength/StrengthSetEditor';
import { formatPrescriptionWithSets } from '../../../src/utils/prescriptionFormat';
import {
  endStrideWatchWorkout,
  pauseStrideWatchWorkout,
  resumeStrideWatchWorkout,
} from '../../../modules/stride-watch-connectivity/src';

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
  const insets = useSafeAreaInsets();
  const session = useActiveStrengthSessionStore(state => state.session);
  const { units } = useSettingsStore();
  const weightUnit: 'lb' | 'kg' = units === 'imperial' ? 'lb' : 'kg';
  const pause = useActiveStrengthSessionStore(state => state.pause);
  const resume = useActiveStrengthSessionStore(state => state.resume);
  const completeExercise = useActiveStrengthSessionStore(state => state.completeExercise);
  const setExerciseRpe = useActiveStrengthSessionStore(state => state.setExerciseRpe);
  const setExerciseLoad = useActiveStrengthSessionStore(state => state.setExerciseLoad);
  const goToExercise = useActiveStrengthSessionStore(state => state.goToExercise);
  const skipExercise = useActiveStrengthSessionStore(state => state.skipExercise);
  const addExercise = useActiveStrengthSessionStore(state => state.addExercise);
  const substituteExercise = useActiveStrengthSessionStore(state => state.substituteExercise);
  const addSet = useActiveStrengthSessionStore(state => state.addSet);
  const removeSet = useActiveStrengthSessionStore(state => state.removeSet);
  const duplicateSet = useActiveStrengthSessionStore(state => state.duplicateSet);
  const editSet = useActiveStrengthSessionStore(state => state.editSet);
  const toggleSetWarmup = useActiveStrengthSessionStore(state => state.toggleSetWarmup);
  const toggleSetCompleted = useActiveStrengthSessionStore(state => state.toggleSetCompleted);
  const completionRequestedAt = useActiveStrengthSessionStore(state => state.completionRequestedAt);
  const clearCompletionRequest = useActiveStrengthSessionStore(state => state.clearCompletionRequest);
  const clearSession = useActiveStrengthSessionStore(state => state.clearSession);
  const manualLog = useStrengthStore(state => state.manualLog);
  const fatigueScore = useAthleteStore(state => state.fatigueScore);
  const currentWeek = useAthleteStore(state => state.currentWeek);
  const [elapsed, setElapsed] = useState(() => activeStrengthElapsedSeconds(session));
  const [rpePickerExerciseId, setRpePickerExerciseId] = useState<string | null>(null);
  const [exerciseChangeName, setExerciseChangeName] = useState('');

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

  // No per-preset warmupProtocol content exists in the static bank yet — this
  // is the "fill the gap" fallback the utility is designed for, keyed off the
  // preset's own categories (upper/lower/full-body/runner strength etc.).
  const warmup = useMemo(() => {
    const presetWorkout = session?.source === 'preset' ? getStrengthPresetWorkout(session.workoutId) : null;
    const categories = presetWorkout?.categories ?? [];
    const preferred = categories.find(category => category !== 'recommended') ?? categories[0];
    return warmupForSession(warmupKindForCategory('strength', preferred));
  }, [session]);

  useEffect(() => {
    if (!session || session.source !== 'preset' || !current) return;
    updateStrengthLiveActivity({
      workoutName: session.workoutName,
      sessionId: strengthLiveActivitySessionId(session),
      sessionSource: 'preset',
      elapsedSeconds: elapsed,
      currentExercise: current.name,
      nextExercise: next?.name ?? '',
      setsCompleted: session.completedExerciseIds.length,
      totalSets: session.exercises.length,
      isPaused: session.status === 'paused',
      prescription: formatPrescriptionWithSets(current.sets, current.repScheme, current.reps),
      loadDisplay: session.loadByExercise[current.id] || (current.equipment.includes('bodyweight') ? 'Bodyweight' : 'Load not set'),
      progressLabel: `${session.completedExerciseIds.length}/${session.exercises.length} exercises`,
    }).catch(console.warn);
  }, [current, elapsed, next, session]);

  if (!session || session.source !== 'preset') {
    // A session exists, but it's a Training Block Workout, not a preset —
    // this screen has nothing to render for it. Never a dead end: offer to
    // discard the mismatched session, not just "go elsewhere."
    const mismatched = session && session.source !== 'preset' ? session : null;
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: C.bg }]}>
        <View style={styles.empty}>
          <Text style={[styles.title, { color: C.text }]}>No active preset workout</Text>
          {mismatched ? (
            <Text style={{ color: C.textMuted, textAlign: 'center', marginBottom: 12 }}>
              {mismatched.workoutName} is active from Training Block Workouts instead.
            </Text>
          ) : null}
          <TouchableOpacity onPress={() => router.replace('/(tabs)/strength' as never)}>
            <Text style={{ color: C.primary, fontWeight: '800' }}>Open Preset Library</Text>
          </TouchableOpacity>
          {mismatched ? (
            <TouchableOpacity
              style={{ marginTop: 16 }}
              onPress={() => Alert.alert(
                'Discard active session?',
                `This ends ${mismatched.workoutName} without saving it.`,
                [
                  { text: 'Keep It', style: 'cancel' },
                  {
                    text: 'Discard',
                    style: 'destructive',
                    onPress: () => {
                      endStrengthLiveActivity().catch(console.warn);
                      endStrideWatchWorkout().catch(() => undefined);
                      clearSession();
                    },
                  },
                ],
              )}
            >
              <Text style={{ color: C.critical, fontWeight: '800' }}>Discard {mismatched.workoutName}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </SafeAreaView>
    );
  }

  const saveAndFinish = () => {
    const exercises = completedExercisesFromActiveSession(
      session.exercises,
      'preset',
      session.completedExerciseIds,
      session.rpeByExercise,
      session.loadByExercise,
    );

    // Honest split summary comes from the same per-set source persisted above.
    const summary = summarizeStrengthSession({
      exercises: session.exercises,
      rpeByExercise: session.rpeByExercise,
      durationSeconds: elapsed,
    });

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
    endStrideWatchWorkout().catch(() => undefined);
    clearSession();
    router.replace({
      pathname: '/(tabs)/strength/preset-complete',
      params: {
        name: session.workoutName,
        duration: Math.max(1, Math.round(elapsed / 60)),
        rpe: overallRpe,
        logId: `preset_${session.workoutId}_${session.startedAt}`,
        completedSets: String(summary.completedSets),
        totalReps: String(summary.totalReps),
        externalLoadVolumeLb: summary.hasExternalLoadVolume ? String(summary.externalLoadVolumeLb) : '',
        bandSetsCount: String(summary.bandSetsCount),
        bodyweightSetsCount: String(summary.bodyweightSetsCount),
        totalHoldSeconds: String(summary.totalHoldSeconds),
        warmupSetsCount: String(summary.warmupSetsCount),
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
          endStrideWatchWorkout().catch(() => undefined);
          clearSession();
          router.replace('/(tabs)/strength' as never);
        },
      },
    ],
  );

  useEffect(() => {
    if (!completionRequestedAt || !session || session.source !== 'preset') return;
    clearCompletionRequest();
    saveAndFinish();
    // The native App Intent sets a one-shot store request. The save action uses
    // the current hydrated session snapshot and then clears the active session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completionRequestedAt, session?.source]);

  const pauseSession = () => {
    pause();
    pauseStrideWatchWorkout().catch(() => undefined);
  };

  const resumeSession = () => {
    resume();
    resumeStrideWatchWorkout().catch(() => undefined);
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: C.bg }]} edges={['top']}>
      <ScreenHeader
        eyebrow="ACTIVE PRESET WORKOUT"
        title={session.workoutName}
        onBack={() => router.back()}
        titleNumberOfLines={1}
        right={<Text style={[styles.timer, { color: C.primary }]}>{formatElapsed(elapsed)}</Text>}
      />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: LAYOUT.tabBarHeight + Math.max(insets.bottom, 16) + 28 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.progressCard, { backgroundColor: C.primaryDim, borderColor: C.primary }]}>
          <Text style={[styles.progress, { color: C.text }]}>{session.completedExerciseIds.length} of {session.exercises.length} exercises complete</Text>
          <View style={[styles.progressTrack, { backgroundColor: C.cardAlt }]}>
            <View style={[styles.progressFill, { backgroundColor: C.primary, width: `${session.exercises.length ? session.completedExerciseIds.length / session.exercises.length * 100 : 0}%` }]} />
          </View>
          <View style={styles.actions}>
            <TouchableOpacity style={[styles.secondaryButton, { borderColor: C.border }]} onPress={session.status === 'active' ? pauseSession : resumeSession}>
              <Ionicons name={session.status === 'active' ? 'pause' : 'play'} size={16} color={C.text} />
              <Text style={[styles.secondaryText, { color: C.text }]}>{session.status === 'active' ? 'Pause' : 'Resume'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.secondaryButton, { borderColor: C.critical }]} onPress={cancel}>
              <Text style={[styles.secondaryText, { color: C.critical }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
        {warmup.items.length > 0 ? (
          <View style={[styles.summaryCard, styles.warmupCard, { backgroundColor: C.card, borderColor: C.border }]}>
            {/* Warm-Up — session-specific protocol from warmupForSession(), not a generic hardcoded card */}
            <Text style={[styles.exerciseName, { color: C.text }]}>{warmup.title}</Text>
            <Text style={[styles.meta, { color: C.textMuted }]}>{warmup.durationMinutes} min</Text>
            {warmup.items.map(item => (
              <Text key={item} style={[styles.instructions, { color: C.textMuted }]}>• {item}</Text>
            ))}
          </View>
        ) : null}
        <Text style={[styles.eyebrow, styles.flowLabel, { color: C.textDim }]}>EXERCISE-BY-EXERCISE FLOW</Text>
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
                  <Text style={[styles.meta, { color: C.textMuted }]}>{formatPrescriptionWithSets(exercise.sets, exercise.repScheme, exercise.reps)} · {displayLabels(exercise.equipment)}</Text>
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
                  <StrengthSetEditor
                    sets={exercise.setEntries}
                    equipmentType={exercise.equipmentType}
                    weightUnit={weightUnit}
                    onAdd={() => addSet(exercise.id)}
                    onDuplicate={setId => duplicateSet(exercise.id, setId)}
                    onRemove={setId => removeSet(exercise.id, setId)}
                    onEdit={(setId, patch) => editSet(exercise.id, setId, patch)}
                    onToggleWarmup={setId => toggleSetWarmup(exercise.id, setId)}
                    onToggleCompleted={setId => toggleSetCompleted(exercise.id, setId)}
                  />
                  <TouchableOpacity
                    style={[styles.rpeButton, { backgroundColor: C.cardAlt }]}
                    onPress={() => skipExercise(exercise.id, !exercise.skipped)}
                  >
                    <Text style={[styles.secondaryText, { color: exercise.skipped ? C.primary : C.textMuted }]}>
                      {exercise.skipped ? 'Undo Skip' : 'Skip Exercise'}
                    </Text>
                  </TouchableOpacity>
                  <TextInput
                    value={exerciseChangeName}
                    onChangeText={setExerciseChangeName}
                    placeholder="Add or substitute exercise"
                    placeholderTextColor={C.textDim}
                    style={[styles.input, { color: C.text, borderColor: C.border, backgroundColor: C.bg }]}
                  />
                  <View style={styles.actions}>
                    <TouchableOpacity
                      style={[styles.secondaryButton, { borderColor: C.border }]}
                      disabled={!exerciseChangeName.trim()}
                      onPress={() => {
                        addExercise({ name: exerciseChangeName.trim(), equipmentType: 'other' });
                        setExerciseChangeName('');
                      }}
                    >
                      <Text style={[styles.secondaryText, { color: C.text }]}>Add Exercise</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.secondaryButton, { borderColor: C.border }]}
                      disabled={!exerciseChangeName.trim()}
                      onPress={() => {
                        substituteExercise(exercise.id, { name: exerciseChangeName.trim(), equipmentType: 'other' });
                        setExerciseChangeName('');
                      }}
                    >
                      <Text style={[styles.secondaryText, { color: C.text }]}>Substitute This</Text>
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity
                    style={[styles.completeButton, { backgroundColor: C.primary }]}
                    onPress={() => {
                      exercise.setEntries.forEach(entry => toggleSetCompleted(exercise.id, entry.id, true));
                      completeExercise(exercise.id);
                    }}
                  >
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
  eyebrow: { fontSize: 10, fontWeight: '900', letterSpacing: 1.4 },
  title: { fontSize: 24, fontFamily: 'CormorantGaramond_700Bold' },
  timer: { fontSize: 16, fontWeight: '900' },
  content: { paddingHorizontal: 18 },
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
  warmupCard: { marginBottom: 24 },
  flowLabel: { marginBottom: 12 },
  finishButton: { minHeight: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
});
