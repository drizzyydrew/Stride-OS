import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useColors } from '../../../src/theme/useColors';
import { LAYOUT } from '../../../src/constants/layout';
import { getMobilityWorkout, getMobilityExercise } from '../../../src/constants/mobilityBank';
import { useMobilityStore } from '../../../src/store/mobilityStore';
import type { MobilityDose } from '../../../src/types/mobility';

type FeedbackOption = 'easy' | 'right' | 'hard';

const FEEDBACK_OPTIONS: { value: FeedbackOption; label: string }[] = [
  { value: 'easy', label: 'Too Easy' },
  { value: 'right', label: 'Just Right' },
  { value: 'hard', label: 'Too Hard' },
];

function doseCountdownSeconds(dose: MobilityDose): number | null {
  if (dose.holdSec) return dose.holdSec;
  if (dose.timeSec) return dose.timeSec;
  return null;
}

function doseSummary(dose: MobilityDose): string {
  const parts: string[] = [];
  if (dose.sets) parts.push(`${dose.sets} set${dose.sets === 1 ? '' : 's'}`);
  if (dose.reps) parts.push(`${dose.reps} rep${dose.reps === 1 ? '' : 's'}`);
  if (dose.holdSec) parts.push(`${dose.holdSec}s hold`);
  if (dose.timeSec) parts.push(`${dose.timeSec}s`);
  let str = parts.join(' × ');
  if (dose.perSide) str += ' · each side';
  return str || '—';
}

export default function MobilitySessionScreen() {
  const C = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const logCompletion = useMobilityStore(s => s.logCompletion);

  const workout = id ? getMobilityWorkout(id) : undefined;

  const steps = useMemo(() => {
    if (!workout) return [];
    return workout.exercises.map(planned => {
      const exercise = getMobilityExercise(planned.exerciseId);
      const dose: MobilityDose = { ...(exercise?.dose ?? {}), ...planned.dose };
      return { planned, exercise, dose };
    }).filter((s): s is { planned: typeof s.planned; exercise: NonNullable<typeof s.exercise>; dose: MobilityDose } => !!s.exercise);
  }, [workout]);

  const [index, setIndex] = useState(0);
  const [finished, setFinished] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackOption | null>(null);

  const startRef = useRef(Date.now());

  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [timerActive, setTimerActive] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const current = steps[index];

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setTimerActive(false);
    setSecondsLeft(current ? doseCountdownSeconds(current.dose) : null);
  }, [index]);

  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);

  function startTimer() {
    if (secondsLeft === null || secondsLeft <= 0) return;
    setTimerActive(true);
    intervalRef.current = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev === null) return null;
        if (prev <= 1) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          setTimerActive(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  function pauseTimer() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setTimerActive(false);
  }

  function goNext() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (index < steps.length - 1) {
      setIndex(i => i + 1);
    } else {
      setFinished(true);
    }
  }

  function goBack() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (index > 0) setIndex(i => i - 1);
  }

  function saveSession() {
    if (!workout) return;
    const durationMin = Math.max(1, Math.round((Date.now() - startRef.current) / 60000));
    logCompletion({
      workoutId: workout.id,
      completedAt: Date.now(),
      durationMin,
      feedback: feedback ?? undefined,
    });
    router.replace('/(tabs)/strength' as any);
  }

  if (!workout) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <View style={[styles.screenHeader, { paddingTop: insets.top + 6 }]}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="arrow-back" size={20} color={C.primary} />
          </TouchableOpacity>
        </View>
        <View style={{ paddingHorizontal: 18 }}>
          <Text style={{ color: C.textMuted }}>Workout not found.</Text>
        </View>
      </View>
    );
  }

  if (finished) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <View style={[styles.screenHeader, { paddingTop: insets.top + 6 }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerLabel, { color: C.textDim }]}>MOBILITY</Text>
            <Text style={[styles.headerTitle, { color: C.text }]}>Session Complete</Text>
          </View>
        </View>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: LAYOUT.screenPadBottom }}>
          <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border, alignItems: 'center' }]}>
            <Ionicons name="checkmark-circle" size={40} color={C.positive} />
            <Text style={[{ fontSize: 17, fontWeight: '800', color: C.text, marginTop: 10 }]}>{workout.title}</Text>
            <Text style={[{ fontSize: 12, color: C.textMuted, marginTop: 4 }]}>{steps.length} exercises completed</Text>
          </View>

          <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
            <Text style={[styles.cardLabel, { color: C.textDim, marginBottom: 10 }]}>HOW DID IT FEEL?</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {FEEDBACK_OPTIONS.map(opt => {
                const active = feedback === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[
                      styles.feedbackChip,
                      { backgroundColor: active ? C.primaryDim : C.cardAlt, borderColor: active ? C.primary : C.border },
                    ]}
                    onPress={() => setFeedback(opt.value)}
                    activeOpacity={0.75}
                  >
                    <Text style={[{ fontSize: 12, fontWeight: '700', color: active ? C.primary : C.textMuted }]}>{opt.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: C.primary }]} onPress={saveSession} activeOpacity={0.85}>
            <Text style={[{ fontSize: 15, fontWeight: '700', color: C.onPrimary }]}>Save & Finish</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  if (!current) return null;
  const { exercise, dose } = current;
  const countdownTotal = doseCountdownSeconds(dose);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={[styles.screenHeader, { paddingTop: insets.top + 6 }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="close" size={22} color={C.primary} />
        </TouchableOpacity>
        <View style={{ marginLeft: 10, flex: 1 }}>
          <Text style={[styles.headerLabel, { color: C.textDim }]}>{workout.title.toUpperCase()}</Text>
          <Text style={[styles.headerTitle, { color: C.text }]}>Exercise {index + 1} of {steps.length}</Text>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: LAYOUT.screenPadBottom }}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
          <Text style={[{ fontSize: 10, fontWeight: '700', color: C.accent, letterSpacing: 0.4 }]}>{exercise.targetArea.toUpperCase()}</Text>
          <Text style={[styles.exTitle, { color: C.text }]}>{exercise.name}</Text>
          <Text style={[{ fontSize: 13, fontWeight: '700', color: C.primary, marginTop: 4 }]}>{doseSummary(dose)}</Text>
        </View>

        {countdownTotal !== null && (
          <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border, alignItems: 'center' }]}>
            <Text style={[styles.timerDisplay, { color: C.text }]}>{secondsLeft ?? countdownTotal}s</Text>
            <TouchableOpacity
              style={[styles.timerBtn, { backgroundColor: timerActive ? C.warning : C.primary }]}
              onPress={timerActive ? pauseTimer : startTimer}
              activeOpacity={0.85}
            >
              <Text style={[{ fontSize: 13, fontWeight: '700', color: timerActive ? '#14160F' : C.onPrimary }]}>
                {timerActive ? 'Pause' : secondsLeft === 0 ? 'Restart' : 'Start Timer'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
          <Text style={[styles.cardLabel, { color: C.textDim, marginBottom: 8 }]}>HOW TO</Text>
          {exercise.howTo.map((step, i) => (
            <Text key={i} style={[{ fontSize: 13, color: C.textMuted, lineHeight: 19, marginBottom: 4 }]}>{i + 1}. {step}</Text>
          ))}
        </View>

        {current.planned.cues.length > 0 && (
          <View style={[styles.card, { backgroundColor: C.primaryDim, borderColor: C.border }]}>
            <Text style={[styles.cardLabel, { color: C.primary, marginBottom: 6 }]}>CUES</Text>
            {current.planned.cues.map(c => (
              <Text key={c} style={[{ fontSize: 12, color: C.textMuted, lineHeight: 17 }]}>· {c}</Text>
            ))}
          </View>
        )}

        <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
          <Text style={[styles.cardLabel, { color: C.textDim, marginBottom: 6 }]}>WHAT IT SHOULD FEEL LIKE</Text>
          <Text style={[{ fontSize: 12, color: C.textMuted, lineHeight: 18 }]}>{exercise.whatItShouldFeelLike}</Text>
        </View>

        <View style={[styles.card, { backgroundColor: C.warningDim, borderColor: C.warning }]}>
          <Text style={[styles.cardLabel, { color: C.warning, marginBottom: 6 }]}>WHEN TO STOP OR MODIFY</Text>
          <Text style={[{ fontSize: 12, color: C.textMuted, lineHeight: 18 }]}>{exercise.whenToStopOrModify}</Text>
        </View>

        <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
          <TouchableOpacity
            style={[styles.navBtn, { backgroundColor: C.cardAlt, opacity: index === 0 ? 0.5 : 1 }]}
            onPress={goBack}
            disabled={index === 0}
            activeOpacity={0.75}
          >
            <Text style={[{ fontSize: 14, fontWeight: '700', color: C.textMuted }]}>Back</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.navBtn, { backgroundColor: C.primary }]} onPress={goNext} activeOpacity={0.85}>
            <Text style={[{ fontSize: 14, fontWeight: '700', color: C.onPrimary }]}>
              {index === steps.length - 1 ? 'Finish' : 'Next'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingBottom: 10,
  },
  headerLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    fontFamily: 'CormorantGaramond_700Bold',
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 10,
  },
  cardLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  exTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginTop: 4,
  },
  timerDisplay: {
    fontSize: 44,
    fontWeight: '800',
    marginBottom: 10,
    fontVariant: ['tabular-nums'],
  },
  timerBtn: {
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  navBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedbackChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  primaryBtn: {
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
});
