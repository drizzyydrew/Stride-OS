import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getStrengthPresetWorkout, presetExerciseId } from '../../../../src/constants/strengthBank';
import { useActiveStrengthSessionStore } from '../../../../src/store/activeStrengthSessionStore';
import { endStrengthLiveActivity, startStrengthLiveActivity } from '../../../../src/lib/strengthLiveActivity';
import { useColors } from '../../../../src/theme/useColors';
import { LAYOUT } from '../../../../src/constants/layout';
import ScreenHeader from '../../../../src/components/layout/ScreenHeader';
import { displayLabels } from '../../../../src/utils/displayLabels';
import { formatPrescriptionWithSets } from '../../../../src/utils/prescriptionFormat';
import {
  activeSessionStoresHydrated,
  getConflictingActiveSession,
} from '../../../../src/lib/activeSessionCoordinator';

function exerciseSupport(name: string, equipment: string[]) {
  const lower = name.toLowerCase();
  const isSingleLeg = lower.includes('single') || lower.includes('lunge') || lower.includes('step-up');
  const isPress = lower.includes('press') || lower.includes('push-up') || lower.includes('dip');
  const isHold = lower.includes('plank') || lower.includes('hold') || lower.includes('carry');
  return {
    feel: isHold
      ? 'Steady trunk tension and controlled breathing without pinching or sharp symptoms.'
      : isPress
        ? 'Working effort through the chest, shoulders, or arms while the trunk stays organized.'
        : 'Working effort in the target muscles with stable joints and a repeatable range.',
    easier: isSingleLeg
      ? 'Use bodyweight, shorten the range, or hold a stable support.'
      : equipment.includes('barbell')
        ? 'Reduce the load or use a dumbbell or bodyweight version.'
        : 'Reduce load, range, or repetitions while keeping the same movement pattern.',
  };
}

export default function PresetStrengthDetailScreen() {
  const C = useColors();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const workout = getStrengthPresetWorkout(String(id));
  const active = useActiveStrengthSessionStore(state => state.session);
  const startSession = useActiveStrengthSessionStore(state => state.startSession);

  if (!workout) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: C.bg }]}>
        <Text style={[styles.title, { color: C.text }]}>Preset not found</Text>
        <TouchableOpacity onPress={() => router.back()}><Text style={{ color: C.primary }}>Go back</Text></TouchableOpacity>
      </SafeAreaView>
    );
  }

  const begin = () => {
    if (!activeSessionStoresHydrated()) {
      Alert.alert('Restoring session', 'StrideOS is restoring your active-session state. Try again in a moment.');
      return;
    }
    const crossDomainConflict = getConflictingActiveSession('strength');
    if (crossDomainConflict) {
      Alert.alert(
        'Another session is active',
        `${crossDomainConflict.name} is still in progress. Continue it or end it before starting this Preset Workout.`,
        [
          {
            text: 'Continue Current Session',
            onPress: () => router.push(crossDomainConflict.route as never),
          },
          { text: 'Cancel', style: 'cancel' },
        ],
      );
      return;
    }
    const launch = () => {
      const exercises = workout.exercises.map(exercise => ({
        id: presetExerciseId(workout.id, exercise.name),
        name: exercise.name,
        sets: exercise.sets,
        reps: exercise.reps,
        repScheme: exercise.repScheme,
        equipment: exercise.equipment,
        notes: exercise.notes,
      }));
      startSession({
        source: 'preset',
        workoutId: workout.id,
        workoutName: workout.title,
        plannedDurationMin: workout.durationMin,
        exercises,
      });
      startStrengthLiveActivity({
        workoutName: workout.title,
        elapsedSeconds: 0,
        currentExercise: `${exercises[0]?.name ?? ''} · ${formatPrescriptionWithSets(exercises[0]?.sets ?? 0, exercises[0]?.repScheme, exercises[0]?.reps ?? '')}`,
        nextExercise: exercises[1]?.name ?? '',
        setsCompleted: 0,
        totalSets: exercises.length,
      }).catch(console.warn);
      router.replace('/(tabs)/strength/preset-session' as never);
    };

    if (!active) return launch();
    if (active.source === 'preset' && active.workoutId === workout.id) {
      router.push('/(tabs)/strength/preset-session' as never);
      return;
    }
    Alert.alert(
      'Another strength session is active',
      `${active.workoutName} is still in progress. StrideOS will never end it silently.`,
      [
        {
          text: 'Continue Current Session',
          onPress: () => router.push(active.source === 'preset'
            ? '/(tabs)/strength/preset-session' as never
            : '/(tabs)/strength' as never),
        },
        {
          text: 'End Current Session and Start Other Workout',
          style: 'destructive',
          onPress: async () => {
            await endStrengthLiveActivity().catch(console.warn);
            launch();
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: C.bg }]} edges={['top']}>
      <ScreenHeader
        eyebrow="PRESET WORKOUT"
        title={workout.title}
        onBack={() => router.back()}
        backLabel="Back to preset workouts"
      />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.hero, { backgroundColor: C.card, borderColor: C.border }]}>
          <Text style={[styles.purpose, { color: C.text }]}>{workout.description}</Text>
          <Text style={[styles.meta, { color: C.textMuted }]}> 
            {workout.durationMin} min · {workout.exercises.length} exercises · {displayLabels(workout.equipment)}
          </Text>
          <Text style={[styles.detailLabel, { color: C.textDim }]}>INTENDED USE</Text>
          <Text style={[styles.body, { color: C.textMuted }]}>{workout.description}</Text>
          <Text style={[styles.detailLabel, { color: C.textDim }]}>RECOMMENDED FREQUENCY</Text>
          <Text style={[styles.body, { color: C.textMuted }]}>Use 1–3 times per week when it fits your running load, recovery, and current training block.</Text>
          <Text style={[styles.sectionTitle, { color: C.primary }]}>WHY THIS WORKOUT</Text>
          <Text style={[styles.body, { color: C.textMuted }]}>
            This preset provides a repeatable session for the stated purpose. Choose loads that preserve technique and adjust the session when symptoms, fatigue, or equipment change.
          </Text>
        </View>
        <Text style={[styles.eyebrow, { color: C.textDim, marginBottom: 8 }]}>EXERCISES</Text>
        {workout.exercises.map((exercise, index) => {
          const support = exerciseSupport(exercise.name, exercise.equipment);
          return (
          <View key={exercise.name} style={[styles.exerciseCard, { backgroundColor: C.card, borderColor: C.border }]}> 
            <Text style={[styles.exerciseNumber, { color: C.primary }]}>{index + 1}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.exerciseName, { color: C.text }]}>{exercise.name}</Text>
              <Text style={[styles.meta, { color: C.textMuted }]}>{formatPrescriptionWithSets(exercise.sets, exercise.repScheme, exercise.reps)} · {displayLabels(exercise.equipment)}</Text>
              <Text style={[styles.detailLabel, { color: C.textDim }]}>HOW TO PERFORM</Text>
              <Text style={[styles.body, { color: C.textMuted }]}>
                Use a controlled range you can own. Keep the prescribed setup stable and stop the set before technique meaningfully changes.
              </Text>
              <Text style={[styles.detailLabel, { color: C.textDim }]}>COACHING CUE</Text>
              <Text style={[styles.body, { color: C.textMuted }]}>{exercise.notes ?? 'Move with control and keep effort appropriate for today.'}</Text>
              <Text style={[styles.detailLabel, { color: C.textDim }]}>WHAT IT SHOULD FEEL LIKE</Text>
              <Text style={[styles.body, { color: C.textMuted }]}>{support.feel}</Text>
              <Text style={[styles.detailLabel, { color: C.textDim }]}>WHEN TO STOP OR MODIFY</Text>
              <Text style={[styles.body, { color: C.textMuted }]}>Stop or choose an easier load or range if pain, dizziness, or loss of control occurs.</Text>
              <Text style={[styles.detailLabel, { color: C.textDim }]}>EASIER ALTERNATIVE</Text>
              <Text style={[styles.body, { color: C.textMuted }]}>{support.easier}</Text>
              <Text style={[styles.detailLabel, { color: C.textDim }]}>LOAD TYPE</Text>
              <Text style={[styles.body, { color: C.textMuted }]}>{displayLabels(exercise.equipment)} · {formatPrescriptionWithSets(exercise.sets, exercise.repScheme, exercise.reps)}</Text>
            </View>
          </View>
          );
        })}
        <TouchableOpacity style={[styles.startButton, { backgroundColor: C.primary }]} onPress={begin}>
          <Text style={[styles.startText, { color: C.onPrimary }]}>
            {active?.source === 'preset' && active.workoutId === workout.id ? `Continue ${workout.title}` : `Start ${workout.title}`}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { paddingHorizontal: 18, paddingBottom: LAYOUT.screenPadBottom },
  eyebrow: { fontSize: 10, fontWeight: '900', letterSpacing: 1.6 },
  title: { fontSize: 28, fontFamily: 'CormorantGaramond_700Bold' },
  hero: { borderWidth: 1, borderRadius: 16, padding: 16, marginBottom: 18 },
  purpose: { fontSize: 15, lineHeight: 21, fontWeight: '700' },
  meta: { fontSize: 12, lineHeight: 18, marginTop: 5 },
  sectionTitle: { fontSize: 10, fontWeight: '900', letterSpacing: 1.3, marginTop: 16, marginBottom: 5 },
  body: { fontSize: 12, lineHeight: 18 },
  exerciseCard: { borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 10, flexDirection: 'row', gap: 12 },
  exerciseNumber: { fontSize: 14, fontWeight: '900', width: 20 },
  exerciseName: { fontSize: 16, fontWeight: '900' },
  detailLabel: { fontSize: 9, fontWeight: '900', letterSpacing: 1, marginTop: 10, marginBottom: 2 },
  startButton: { minHeight: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, marginTop: 10 },
  startText: { fontSize: 14, fontWeight: '900', textAlign: 'center' },
});
