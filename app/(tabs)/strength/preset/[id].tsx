import { strengthGuidance } from '../../../../src/utils/strengthGuidance';
import StrengthCalculatorLink from '../../../../src/components/strength/strength-calculator-link';
import ExerciseGuidance from '../../../../src/components/strength/exercise-guidance';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useEffect, useRef, useState } from 'react';
import { Host, Picker } from '@expo/ui';
import { useLocalSearchParams, useRouter } from 'expo-router';
import SafeAreaView from '../../../../src/components/layout/PageSafeAreaView';

import { getStrengthPresetWorkout, STRENGTH_PRESET_PRIORITY_MAINS } from '../../../../src/constants/strengthBank';
import { useThemeMode } from '../../../../src/store/themeStore';
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
import {
  endStrideWatchWorkout,
  setStrideWatchWorkoutContext,
  startStrideWatchWorkout,
} from '../../../../modules/stride-watch-connectivity/src';
import { useSettingsStore } from '../../../../src/store/settingsStore';
import { useOnboardingStore } from '../../../../src/store/onboardingStore';
import { useAthleteStore } from '../../../../src/store/athleteStore';
import { useCheckInStore } from '../../../../src/store/checkInStore';
import { useTrainingPlanStore } from '../../../../src/store/trainingPlanStore';
import { useWeekPlan } from '../../../../src/hooks/useWeekPlan';
import { captureOwnerLease, ownerLeaseIsCurrent } from '../../../../src/lib/localDataOwner';
import { buildStrengthPresetContext, resolveStrengthPresetWorkout, strengthPresetLaunchInput, type ResolvedStrengthPreset } from '../../../../src/utils/strengthPresetProgramming';

function MainSetPicker({ value, onChange }: { value: 3 | 4 | 5; onChange: (value: 3 | 4 | 5) => void }) {
  const C = useColors(), theme = useThemeMode();
  const change = (next: number) => { if (next === 3 || next === 4 || next === 5) onChange(next); };
  const native = () => {
    const { Picker: NativePicker, Text: NativeText } = require('@expo/ui/swift-ui') as typeof import('@expo/ui/swift-ui');
    const { pickerStyle, tag, accessibilityLabel } = require('@expo/ui/swift-ui/modifiers') as typeof import('@expo/ui/swift-ui/modifiers');
    return <NativePicker label="Working sets per main lift" selection={value} onSelectionChange={change}
      modifiers={[pickerStyle('menu'), accessibilityLabel('Working sets per main lift')]}>
      {[3, 4, 5].map(sets => <NativeText key={sets} modifiers={[tag(sets)]}>{sets} sets</NativeText>)}
    </NativePicker>;
  };
  return <Host matchContents={{ vertical: true }} colorScheme={theme} seedColor={C.primary} style={{ width: '100%', minHeight: 44 }}>
    {process.env.EXPO_OS === 'ios' ? native() : <Picker selectedValue={value} onValueChange={change} appearance="menu">
      {[3, 4, 5].map(sets => <Picker.Item key={sets} value={sets} label={`${sets} sets per main lift`} />)}
    </Picker>}
  </Host>;
}

export default function PresetStrengthDetailScreen() {
  const C = useColors();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [mainSets, setMainSets] = useState<3 | 4 | 5>(3);
  useEffect(() => setMainSets(3), [id]);
  const mainSetsRef = useRef(mainSets);
  mainSetsRef.current = mainSets;
  const { units } = useSettingsStore();
  const catalogWorkout = getStrengthPresetWorkout(String(id));
  const active = useActiveStrengthSessionStore(state => state.session);
  const startSession = useActiveStrengthSessionStore(state => state.startSession);
  const onboarding = useOnboardingStore(state => state.data);
  const fatigueScore = useAthleteStore(state => state.fatigueScore);
  const recoveryScore = useAthleteStore(state => state.recoveryScore);
  const goalType = useTrainingPlanStore(state => state.goalType);
  const weekPlan = useWeekPlan();
  const trainingPhase = weekPlan.metadata.trainingMode === 'open' ? undefined : weekPlan.metadata.trainingPhase;
  const planRecoveryLimited = weekPlan.strengthWeek.progressionState === 'regress';
  const checkIn = useCheckInStore(state => state.todayCheckIn);
  const currentPlanContext = useRef({ trainingPhase, planRecoveryLimited });
  currentPlanContext.current = { trainingPhase, planRecoveryLimited };
  const presetContext = buildStrengthPresetContext(onboarding, { fatigueScore, recoveryScore, trainingPhase, goalType }, checkIn);
  presetContext.recoveryLimited ||= planRecoveryLimited;
  presetContext.mainSets = mainSets;
  const resolved = catalogWorkout ? resolveStrengthPresetWorkout(catalogWorkout,
    presetContext, active) : null;
  const workout = resolved?.workout;

  if (!workout) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: C.bg }]}>
        <Text style={[styles.title, { color: C.text }]}>Preset not found</Text>
        <TouchableOpacity onPress={() => router.back()}><Text style={{ color: C.primary }}>Go back</Text></TouchableOpacity>
      </SafeAreaView>
    );
  }

  const currentResolution = () => {
    const context = buildStrengthPresetContext(useOnboardingStore.getState().data, {
      ...useAthleteStore.getState(), trainingPhase: currentPlanContext.current.trainingPhase,
      goalType: useTrainingPlanStore.getState().goalType,
    }, useCheckInStore.getState().todayCheckIn);
    context.recoveryLimited ||= currentPlanContext.current.planRecoveryLimited;
    context.mainSets = mainSetsRef.current;
    return resolveStrengthPresetWorkout(catalogWorkout!, context, useActiveStrengthSessionStore.getState().session);
  };
  type SessionAcknowledgement = { key: string; lease: NonNullable<ReturnType<typeof captureOwnerLease>> };
  const showSessionFit = (fit: ResolvedStrengthPreset, lease: SessionAcknowledgement['lease']) => {
    Alert.alert('Choose a session that fits today', `${fit.reason ?? 'Review your current training preferences before starting.'}\n\nThis preset takes about ${fit.workout.durationMin} minutes. Continuing applies only to this session and keeps the displayed sets, effort and full rests. Adjust or stop if it does not feel right.`, [
      ...(fit.alternativeWorkoutId ? [{ text: 'View lighter alternative', onPress: () => router.replace({
        pathname: '/(tabs)/strength/preset/[id]', params: { id: fit.alternativeWorkoutId },
      } as never) }] : [{ text: 'Browse other presets', onPress: () => router.back() }]),
      ...(fit.sessionFitKey ? [{ text: 'Continue anyway', onPress: () => {
        if (ownerLeaseIsCurrent(lease)) begin({ key: fit.sessionFitKey!, lease });
      } }] : []),
      { text: 'Cancel', style: 'cancel' },
    ]);
  };
  const begin = (acknowledgement?: SessionAcknowledgement) => {
    if (acknowledgement && !ownerLeaseIsCurrent(acknowledgement.lease)) return;
    if (!activeSessionStoresHydrated()) {
      Alert.alert('Restoring session', 'StrideOS is restoring your active-session state. Try again in a moment.');
      return;
    }
    const lease = captureOwnerLease();
    if (!lease || !ownerLeaseIsCurrent(lease)) {
      Alert.alert('Profile is still restoring', 'Reopen this preset after your account and training preferences are ready.');
      return;
    }
    const active = useActiveStrengthSessionStore.getState().session;
    if (active?.source === 'preset' && active.workoutId === workout.id) {
      router.push('/(tabs)/strength/preset-session' as never);
      return;
    }
    const fit = currentResolution();
    const accepts = (latest: ResolvedStrengthPreset) => {
      if (acknowledgement && latest.sessionFitKey !== acknowledgement.key) {
        Alert.alert('Session details changed', 'Review the updated prescription and your current preferences before starting.');
        return false;
      }
      if (!latest.canStart && !acknowledgement) { showSessionFit(latest, lease); return false; }
      return true;
    };
    if (!accepts(fit)) return;
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
      if (!ownerLeaseIsCurrent(lease)) return;
      const currentActive = useActiveStrengthSessionStore.getState().session;
      if (currentActive?.workoutInstanceId !== active?.workoutInstanceId || getConflictingActiveSession('strength')) {
        Alert.alert('Session changed', 'Continue the current session, then reopen this preset.');
        return;
      }
      const latest = currentResolution();
      if (!accepts(latest)) return;
      const launchWorkout = latest.workout;
      const launchInput = strengthPresetLaunchInput(latest, acknowledgement?.key);
      if (!launchInput) {
        Alert.alert('Review this preset', 'The prescription changed or is unavailable. Reopen it before starting.');
        return;
      }
      const exercises = launchInput.exercises;
      startSession(launchInput);
      const launchedSession = useActiveStrengthSessionStore.getState().session;
      startStrengthLiveActivity({
        workoutName: launchWorkout.title,
        elapsedSeconds: 0,
        currentExercise: `${exercises[0]?.name ?? ''} · ${formatPrescriptionWithSets(exercises[0]?.sets ?? 0, exercises[0]?.repScheme, exercises[0]?.reps ?? '')}`,
        nextExercise: exercises[1]?.name ?? '',
        setsCompleted: 0,
        totalSets: exercises.length,
      }).catch(console.warn);
      setStrideWatchWorkoutContext({ unitSystem: units }).catch(() => undefined);
      startStrideWatchWorkout({
        workoutKind: 'strength',
        workoutInstanceId: launchedSession?.workoutInstanceId ?? null,
        title: launchWorkout.title,
        environment: 'indoor',
        targetZone: null,
      }).catch(() => undefined);
      router.replace('/(tabs)/strength/preset-session' as never);
    };

    if (!active) return launch();
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
            const unchanged = () => ownerLeaseIsCurrent(lease)
              && useActiveStrengthSessionStore.getState().session?.workoutInstanceId === active.workoutInstanceId;
            if (!unchanged()) return;
            const latest = currentResolution();
            if (!accepts(latest)) return;
            await endStrengthLiveActivity().catch(console.warn);
            if (!unchanged()) return;
            await endStrideWatchWorkout().catch(() => undefined);
            if (!unchanged()) return;
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
          {workout.planningNote ? <Text style={[styles.body, { color: C.textMuted }]}>{workout.planningNote}</Text> : null}
          {STRENGTH_PRESET_PRIORITY_MAINS[workout.id]?.length && resolved?.mode !== 'captured' ? <>
            <Text style={[styles.detailLabel, { color: C.textDim }]}>WORKING SETS PER MAIN LIFT</Text>
            <MainSetPicker value={mainSets} onChange={setMainSets} />
            <Text style={[styles.body, { color: C.textMuted }]}>Start with 3. Choose 4 or 5 when your experience, weekly lifting volume, time and recovery support it. Rehearsal sets are separate. The estimated time above includes the selected sets and full rests.</Text>
          </> : null}
          {resolved?.reason ? <>
            <Text style={[styles.detailLabel, { color: C.primary }]}>SESSION FIT</Text>
            <Text style={[styles.body, { color: C.textMuted }]}>{resolved.reason}</Text>
          </> : null}
          <Text style={[styles.detailLabel, { color: C.textDim }]}>RECOMMENDED FREQUENCY</Text>
          <Text style={[styles.body, { color: C.textMuted }]}>Use 1–3 times per week when it fits your running load, recovery, and current training block.</Text>
          <Text style={[styles.sectionTitle, { color: C.primary }]}>WHY THIS WORKOUT</Text>
          <Text style={[styles.body, { color: C.textMuted }]}>
            This preset provides a repeatable session for the stated purpose. Choose loads that preserve technique and adjust the session when symptoms, fatigue, or equipment change.
          </Text>
        </View>
        <StrengthCalculatorLink />
        <Text style={[styles.eyebrow, { color: C.textDim, marginBottom: 8 }]}>EXERCISES</Text>
        {workout.exercises.map((exercise, index) => {
          return (
          <View key={exercise.name} style={[styles.exerciseCard, { backgroundColor: C.card, borderColor: C.border }]}> 
            <Text style={[styles.exerciseNumber, { color: C.primary }]}>{index + 1}</Text>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[styles.exerciseName, { color: C.text }]}>{exercise.name}</Text>
              <Text style={[styles.meta, { color: C.textMuted }]}>{formatPrescriptionWithSets(exercise.sets, exercise.repScheme, exercise.reps)} · {displayLabels(exercise.equipment)}</Text>
              <Text style={[styles.meta, { color: C.textMuted }]}>Target RPE {exercise.targetRpe ?? 'not set'} · rest {exercise.restSeconds ?? 90}s</Text>
              <ExerciseGuidance key={exercise.name} content={strengthGuidance({ name: exercise.name, equipment: exercise.equipment }, exercise.notes)} />
              <Text style={[styles.detailLabel, { color: C.textDim }]}>LOAD TYPE</Text>
              <Text style={[styles.body, { color: C.textMuted }]}>{displayLabels(exercise.equipment)} · {formatPrescriptionWithSets(exercise.sets, exercise.repScheme, exercise.reps)}</Text>
            </View>
          </View>
          );
        })}
        <TouchableOpacity accessibilityRole="button" style={[styles.startButton, { backgroundColor: C.primary }]} onPress={() => begin()}>
          <Text style={[styles.startText, { color: C.onPrimary }]}>
            {active?.source === 'preset' && active.workoutId === workout.id ? `Continue ${workout.title}`
              : resolved?.canStart ? `Start ${workout.title}` : 'Review session fit'}
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
