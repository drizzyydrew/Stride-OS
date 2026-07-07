import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useColors } from '../../../src/theme/useColors';
import { useSettingsStore } from '../../../src/store/settingsStore';
import { useAthleteStore } from '../../../src/store/athleteStore';
import { useStrengthStore } from '../../../src/store/strengthStore';
import { LAYOUT } from '../../../src/constants/layout';
import type { CompletedExercise } from '../../../src/types/strength';
import { getLastLoggedExercise, suggestProgression } from '../../../src/utils/strengthHistory';
import { getExerciseGuide } from '../../../src/constants/exerciseGuides';
import PickerWheel from '../../../src/components/ui/PickerWheel';
import {
  addStrengthIntentListener,
  endStrengthLiveActivity,
  startStrengthLiveActivity,
  updateStrengthLiveActivity,
} from '../../../src/lib/strengthLiveActivity';
import { startControlCommandPolling } from '../../../src/lib/runLiveActivity';

type ExDef = {
  id: string;
  name: string;
  shortName: string;
  sets: number;
  reps: string;
  weight: number;
  restSeconds: number;
  muscles: string;
  desc: string;
  cue: string;
  pr?: boolean;
};

const LOWER_WORKOUT: ExDef[] = [
  { id: 'gs',  name: 'Goblet Squat',        shortName: 'Goblet Sq',  sets: 3, reps: '10–12', weight: 35, restSeconds: 90, muscles: 'Quads · Glutes',           desc: 'Hold dumbbell at chest, feet shoulder-width, squat until thighs parallel.', cue: 'Drive knees out over toes; keep chest tall throughout descent.' },
  { id: 'rdl', name: 'Romanian Deadlift',    shortName: 'RDL',        sets: 3, reps: '10–12', weight: 65, restSeconds: 90, muscles: 'Hamstrings · Glutes',       desc: 'Hinge at hips with soft knees, lower bar until hamstring stretch.', cue: 'Imagine pushing the floor away — feel glutes fire at lockout.' },
  { id: 'gb',  name: 'Glute Bridge',         shortName: 'Glute Bdg',  sets: 3, reps: '15',    weight: 0,  restSeconds: 60, muscles: 'Glutes · Core',             desc: 'Lie on back, feet flat, drive hips up until body is straight.', cue: 'Squeeze glutes hard at the top; hold one full second.' },
  { id: 'pl',  name: 'Plank',                shortName: 'Plank',      sets: 3, reps: '45 sec', weight: 0,  restSeconds: 45, muscles: 'Core · Shoulders',          desc: 'Forearm plank, body rigid from head to heels.', cue: 'Breathe normally; brace abs as if absorbing a punch.' },
];

const UPPER_WORKOUT: ExDef[] = [
  { id: 'dbr', name: 'Dumbbell Row',         shortName: 'DB Row',     sets: 3, reps: '10',    weight: 45, restSeconds: 75, muscles: 'Lats · Rear Delt · Biceps', desc: 'Single-arm row, brace on bench, pull dumbbell to hip.', cue: 'Initiate with elbow — think "elbow to back pocket."', pr: true },
  { id: 'pu',  name: 'Push-Up',              shortName: 'Push-Up',    sets: 3, reps: '12',    weight: 0,  restSeconds: 60, muscles: 'Chest · Triceps · Core',    desc: 'High plank, lower chest to 1 inch from floor, press back up.', cue: 'Screw hands into the floor — engages chest, protects shoulders.' },
  { id: 'ohp', name: 'Overhead Press',       shortName: 'OHP',        sets: 3, reps: '8',     weight: 30, restSeconds: 75, muscles: 'Shoulders · Triceps',       desc: 'Standing, press dumbbells from shoulder height to overhead.', cue: 'Squeeze glutes at top to protect lower back.' },
  { id: 'db2', name: 'Dead Bug',             shortName: 'Dead Bug',   sets: 3, reps: '8 each', weight: 0, restSeconds: 45, muscles: 'Deep Core',                desc: 'Lying on back, extend opposite arm and leg, keep low back flat.', cue: 'Press lower back firmly into floor the entire time — no arching.' },
];

const WARMUP_MIN   = 5;
const COOLDOWN_MIN = 5;
const SECONDS_PER_REP = 3; // rough eccentric+concentric average for a controlled tempo

function buildWeightValues(maxValue: number, step: number): number[] {
  const list: number[] = [];
  for (let v = 0; v <= maxValue; v += step) list.push(Math.round(v * 10) / 10);
  return list;
}
const WEIGHT_VALUES_LB = buildWeightValues(500, 2.5);
const WEIGHT_VALUES_KG = buildWeightValues(220, 2.5);

const RPE_VALUES = [6, 7, 8, 9, 10];
const RPE_LABELS: Record<number, string> = {
  6: 'easy (4+ in tank)',
  7: 'moderate',
  8: 'hard (2 left)',
  9: 'very hard',
  10: 'max effort',
};

function fmt(s: number): string {
  const m = Math.floor(s / 60), sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function primaryRepCount(reps: string): number {
  const match = reps.match(/\d+/);
  return match ? Number(match[0]) : 10;
}

// Estimated total session length from this workout's actual exercises: each
// exercise's own set count, rep/time load, and rest between sets — not a
// single flat guess. Mirrors the "X min" already shown for warm-up/cool-down.
function estimateWorkoutDurationMin(exercises: ExDef[]): number {
  let totalSeconds = WARMUP_MIN * 60 + COOLDOWN_MIN * 60;
  let lastRest = 0;

  for (const ex of exercises) {
    const isTimeBased = /sec/.test(ex.reps);
    const workSecondsPerSet = isTimeBased
      ? primaryRepCount(ex.reps)
      : primaryRepCount(ex.reps) * SECONDS_PER_REP;

    totalSeconds += ex.sets * (workSecondsPerSet + ex.restSeconds);
    lastRest = ex.restSeconds;
  }

  // No rest needed after the very last set of the workout.
  totalSeconds -= lastRest;

  return Math.max(1, Math.round(totalSeconds / 60));
}

export default function StrengthScreen() {
  const C = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { units } = useSettingsStore();
  const { currentWeek, fatigueScore, recoveryScore } = useAthleteStore();
  const readinessLimited = fatigueScore > 70 || recoveryScore < 45;
  const logStrengthSession = useStrengthStore(s => s.manualLog);
  const strengthHistory = useStrengthStore(s => s.history);
  const imp = units === 'imperial';
  const wtUnit = imp ? 'lb' : 'kg';
  const WEIGHT_VALUES = imp ? WEIGHT_VALUES_LB : WEIGHT_VALUES_KG;

  const [workout, setWorkout] = useState<'lower' | 'upper'>('lower');
  const [strState, setStrState] = useState<'idle' | 'active' | 'paused'>('idle');
  const [timer, setTimer] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [weights, setWeights] = useState<Record<string, number>>({});
  const [completedExercises, setCompletedExercises] = useState<Record<string, boolean>>({});
  const [rpe,     setRpe]     = useState<Record<string, number>>({});
  const [howOpen, setHowOpen] = useState<Record<string, boolean>>({});
  const [warmupOpen, setWarmupOpen] = useState(false);
  const [cooldownOpen, setCooldownOpen] = useState(false);
  const [weekOpen, setWeekOpen] = useState(false);
  const [weightPickerFor, setWeightPickerFor] = useState<ExDef | null>(null);
  const [rpePickerFor, setRpePickerFor] = useState<ExDef | null>(null);

  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);

  const exercises = workout === 'lower' ? LOWER_WORKOUT : UPPER_WORKOUT;
  const wDef = { title: workout === 'lower' ? 'Lower Body & Core' : 'Upper Body & Core', label: workout === 'lower' ? 'Strength · Today' : 'Strength · Tomorrow' };

  const estimatedDurationMin = estimateWorkoutDurationMin(exercises);

  // Completion is per EXERCISE, not per set: 4 exercises = 4 completions,
  // in the app and from the Lock Screen alike.
  function isExerciseDone(ex: ExDef): boolean {
    return completedExercises[ex.id] === true;
  }

  const totalExercises = exercises.length;
  const exercisesCompleted = exercises.reduce((acc, ex) => acc + (isExerciseDone(ex) ? 1 : 0), 0);
  const currentExercise = exercises.find(ex => !isExerciseDone(ex)) ?? null;

  // Lock-screen line: name + prescription so the athlete never has to unlock
  // to remember the set scheme.
  function exerciseDetail(ex: ExDef | null): string {
    if (!ex) return exercises[exercises.length - 1]?.name ?? '';
    const w = getWeight(ex);
    return `${ex.name} · ${ex.sets}×${ex.reps}${w > 0 ? ` @ ${w} ${wtUnit}` : ''}`;
  }
  function nextExerciseName(): string {
    const idx = currentExercise ? exercises.indexOf(currentExercise) : -1;
    return idx >= 0 && idx + 1 < exercises.length ? exercises[idx + 1].name : '';
  }

  function completeExercise(ex: ExDef) {
    setCompletedExercises(prev => ({ ...prev, [ex.id]: true }));
  }
  function undoExercise(ex: ExDef) {
    setCompletedExercises(prev => ({ ...prev, [ex.id]: false }));
  }

  function start() {
    intervalRef.current = setInterval(() => setTimer(t => t + 1), 1000);
    setStrState('active');
    startStrengthLiveActivity({
      workoutName: wDef.title,
      elapsedSeconds: 0,
      currentExercise: exerciseDetail(currentExercise),
      nextExercise: nextExerciseName(),
      setsCompleted: 0,
      totalSets: totalExercises,
    }).catch(console.warn);
  }
  function pause() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setStrState('paused');
  }
  function resume() {
    intervalRef.current = setInterval(() => setTimer(t => t + 1), 1000);
    setStrState('active');
  }

  // Lock-screen completion of the FINAL exercise: offer to finish the whole
  // workout so the session doesn't sit open after the last lift.
  function completeFromLockScreen() {
    if (!currentExercise) return;
    const isLast = exercisesCompleted === totalExercises - 1;
    completeExercise(currentExercise);
    if (isLast) {
      Alert.alert('All exercises complete', 'Finish the workout and save it to your history?', [
        { text: 'Keep Going', style: 'cancel' },
        { text: 'Finish & Save', onPress: finishSession },
      ]);
    }
  }

  // Lock-screen intents: native event listeners (in-process case) plus App
  // Group command polling — the widget runs in its own process, so polling
  // the shared store is the path that actually works from the Lock Screen.
  useEffect(() => {
    if (strState === 'idle') return;
    const subs = [
      addStrengthIntentListener('onPauseStrengthIntent',   () => { if (strState === 'active') pause(); }),
      addStrengthIntentListener('onResumeStrengthIntent',  () => { if (strState === 'paused') resume(); }),
      addStrengthIntentListener('onMarkSetCompleteIntent', completeFromLockScreen),
    ];
    const stopPolling = startControlCommandPolling({
      strength_pause:    () => { if (strState === 'active') pause(); },
      strength_resume:   () => { if (strState === 'paused') resume(); },
      strength_complete: completeFromLockScreen,
    });
    return () => {
      subs.forEach(s => s.remove());
      stopPolling();
    };
  }, [strState, currentExercise, exercisesCompleted, exercises]);

  // Keep the Live Activity in lockstep with the in-app session: every timer
  // tick, exercise completion, and pause/resume pushes authoritative state
  // (mirrors how the run activity stays current).
  useEffect(() => {
    if (strState === 'idle') return;
    updateStrengthLiveActivity({
      workoutName: wDef.title,
      elapsedSeconds: timer,
      currentExercise: exerciseDetail(currentExercise),
      nextExercise: nextExerciseName(),
      setsCompleted: exercisesCompleted,
      totalSets: totalExercises,
      isPaused: strState === 'paused',
    }).catch(console.warn);
  }, [timer, exercisesCompleted, strState]);

  function finishSession() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    endStrengthLiveActivity().catch(console.warn);

    const selectedRpes = exercises.map(ex => rpe[ex.id]).filter((value): value is number => typeof value === 'number');
    const overallRpe = selectedRpes.length
      ? Math.round(selectedRpes.reduce((sum, value) => sum + value, 0) / selectedRpes.length)
      : 7;
    const durationMinutes = Math.max(1, Math.round(timer / 60));
    const completionKey = `prototype-strength-${workout}-${new Date().toISOString().slice(0, 10)}`;

    // Exercise-level completion: a completed exercise logs all of its
    // prescribed sets as done. With nothing marked, treat the whole session
    // as completed (the athlete finished without ticking boxes).
    const anyMarked = Object.values(completedExercises).some(Boolean);
    const loggedExercises: CompletedExercise[] = exercises.map(ex => {
      const reps = primaryRepCount(ex.reps);
      const load = getWeight(ex) > 0 ? `${getWeight(ex)} ${wtUnit}` : 'BW';
      const done = anyMarked ? isExerciseDone(ex) : true;
      return {
        exerciseId: ex.id,
        sets: Array.from({ length: ex.sets }, () => ({
          reps,
          load,
          rpe: rpe[ex.id] ?? overallRpe,
          completed: done,
        })),
      };
    });

    logStrengthSession({
      completionKey,
      sessionType: workout === 'lower' ? 'lower_power' : 'full_body',
      goal: 'force_production',
      week: currentWeek,
      plannedDuration: estimatedDurationMin,
      actualDuration: durationMinutes,
      exercises: loggedExercises,
      overallRpe,
      notes: `${wDef.title} completed from the prototype-style Strength screen.`,
    }, fatigueScore);

    setCompletedExercises({});
    setTimer(0);
    setStrState('idle');
    Alert.alert('Strength logged', `${wDef.title} was saved to your training history.`);
  }

  function getWeight(ex: ExDef): number {
    return weights[ex.id] !== undefined ? weights[ex.id] : ex.weight;
  }

  const totalVol = exercises.reduce((acc, ex) => {
    const w = getWeight(ex);
    return acc + (ex.sets * (parseInt(ex.reps) || 10) * w);
  }, 0);
  const totalVolStr = totalVol > 0 ? `${Math.round(totalVol).toLocaleString()} ${wtUnit}` : '—';

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Header */}
      <View style={[styles.screenHeader, { paddingTop: insets.top + 6, backgroundColor: C.bg }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={20} color={C.primary} />
        </TouchableOpacity>
        <View style={{ marginLeft: 10, flex: 1 }}>
          <Text style={[styles.headerLabel, { color: C.textDim }]}>{wDef.label.toUpperCase()}</Text>
          <Text style={[styles.headerTitle, { color: C.text }]}>{wDef.title}</Text>
        </View>
        <TouchableOpacity onPress={() => setWorkout(w => w === 'lower' ? 'upper' : 'lower')} style={{ padding: 4 }}>
          <Ionicons name="swap-horizontal-outline" size={20} color={C.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: LAYOUT.screenPadBottom }}
        showsVerticalScrollIndicator={false}
      >
        {/* Session Timer */}
        <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border, alignItems: 'center' }]}>
          <Text style={[styles.cardLabel, { color: C.textDim }]}>SESSION TIME</Text>
          <Text style={[styles.timerDisplay, { color: C.text }]}>{fmt(timer)}</Text>
          {strState === 'idle' && (
            <>
              <View style={[styles.previewRow, { borderColor: C.border }]}>
                <View style={styles.previewStat}>
                  <Text style={[styles.previewValue, { color: C.text }]}>{exercises.length}</Text>
                  <Text style={[styles.previewLabel, { color: C.textDim }]}>Exercises</Text>
                </View>
                <View style={[styles.previewDivider, { backgroundColor: C.border }]} />
                <View style={styles.previewStat}>
                  <Text style={[styles.previewValue, { color: C.text }]}>~{estimatedDurationMin}</Text>
                  <Text style={[styles.previewLabel, { color: C.textDim }]}>Est. Min</Text>
                </View>
              </View>
              <TouchableOpacity style={[styles.bigBtn, { backgroundColor: C.primary, marginBottom: 8 }]} onPress={start} activeOpacity={0.8}>
                <Text style={[styles.bigBtnText, { color: C.onPrimary }]}>Start {wDef.title}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.smBtn, { backgroundColor: C.cardAlt }]} onPress={() => router.back()} activeOpacity={0.8}>
                <Text style={[styles.smBtnText, { color: C.textMuted }]}>Skip Workout</Text>
              </TouchableOpacity>
            </>
          )}
          {strState === 'active' && (
            <>
              <View style={styles.btnRow}>
                <TouchableOpacity style={[styles.halfBtn, { backgroundColor: C.warning }]} onPress={pause} activeOpacity={0.8}>
                  <Text style={[styles.bigBtnText, { color: '#14160F' }]}>Pause</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.halfBtn, { backgroundColor: C.critical }]} onPress={finishSession} activeOpacity={0.8}>
                  <Text style={[styles.bigBtnText, { color: '#F3F1E9' }]}>Finish</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
          {strState === 'paused' && (
            <View style={styles.btnRow}>
              <TouchableOpacity style={[styles.halfBtn, { backgroundColor: C.positive }]} onPress={resume} activeOpacity={0.8}>
                <Text style={[styles.bigBtnText, { color: '#14160F' }]}>Resume</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.halfBtn, { backgroundColor: C.critical }]} onPress={finishSession} activeOpacity={0.8}>
                <Text style={[styles.bigBtnText, { color: '#F3F1E9' }]}>Finish</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Warm-Up */}
        <TouchableOpacity
          style={[styles.accordionCard, { backgroundColor: C.card, borderColor: C.border }]}
          onPress={() => setWarmupOpen(o => !o)}
          activeOpacity={0.8}
        >
          <View style={styles.accordionHeader}>
            <View style={[styles.iconBox, { backgroundColor: C.accentDim }]}>
              <Ionicons name="time-outline" size={15} color={C.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.subTitle, { color: C.text }]}>Warm-Up</Text>
              <Text style={[{ fontSize: 11, color: C.textMuted }]}>5 min · Dynamic mobility</Text>
            </View>
            <Text style={[{ fontSize: 13, color: C.textDim }]}>{warmupOpen ? '▲' : '▼'}</Text>
          </View>
          {warmupOpen && (
            <View style={[{ borderTopWidth: 1, borderTopColor: C.border, paddingTop: 10, gap: 5 }]}>
              {['Leg Swings · 10 each · 1 min', 'Hip Circles · 10 each way · 1 min', 'Bodyweight Squat · 15 reps · 1 min', 'Glute Bridges · 15 reps · 1 min', 'Inchworm · 5 reps · 1 min'].map(item => {
                const [name, ...rest] = item.split(' · ');
                return (
                  <View key={item} style={[styles.listRow, { backgroundColor: C.cardAlt }]}>
                    <Text style={[{ fontSize: 12, fontWeight: '600', color: C.text }]}>{name}</Text>
                    <Text style={[{ fontSize: 11, color: C.textMuted }]}>{rest.join(' · ')}</Text>
                  </View>
                );
              })}
            </View>
          )}
        </TouchableOpacity>

        {/* Exercises */}
        <Text style={[styles.cardLabel, { color: C.textDim, marginBottom: 8 }]}>EXERCISES</Text>
        {exercises.map((ex, i) => {
          const w = getWeight(ex);
          const isDone = isExerciseDone(ex);
          const isCurrent = !isDone && currentExercise?.id === ex.id;
          const htOpen = !!howOpen[ex.id];
          const rpeVal = rpe[ex.id];
          const wDisplay = w > 0 ? `${w} ${wtUnit}` : 'BW';
          const lastPerformance = getLastLoggedExercise(strengthHistory, ex.id);
          const progression = suggestProgression(lastPerformance, ex.sets, readinessLimited, wtUnit);
          const guide = getExerciseGuide(ex.id);
          return (
            <View
              key={ex.id}
              style={[
                styles.exCard,
                {
                  backgroundColor: isDone ? C.primaryDim : C.card,
                  borderColor: isDone ? C.primary : isCurrent ? C.accent : C.border,
                },
                isCurrent && { borderWidth: 2 },
              ]}
            >
              <View style={{ padding: 14 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                      <Text style={[{ fontSize: 10, fontWeight: '700', color: C.accent, letterSpacing: 0.4 }]}>{ex.muscles}</Text>
                      {isCurrent && (
                        <View style={[{ paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999, backgroundColor: C.accent }]}>
                          <Text style={[{ fontSize: 8, fontWeight: '700', color: C.onPrimary, letterSpacing: 0.4 }]}>CURRENT</Text>
                        </View>
                      )}
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={[styles.subTitle, { color: C.text }]}>{ex.name}</Text>
                      {ex.pr && (
                        <View style={[{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: C.warning }]}>
                          <Text style={[{ fontSize: 9, fontWeight: '700', color: '#14160F' }]}>PR</Text>
                        </View>
                      )}
                    </View>
                    <Text style={[{ fontSize: 12, color: C.textMuted }]}>{ex.sets} × {ex.reps}{w > 0 ? ` · ${wDisplay}` : ''}</Text>
                    {lastPerformance && (
                      <Text style={[{ fontSize: 11, color: C.textDim, marginTop: 2 }]}>
                        Last time: {lastPerformance.completedSets}×{lastPerformance.reps}
                        {lastPerformance.load ? ` @ ${lastPerformance.load}` : ''}
                        {lastPerformance.rpe !== undefined ? ` · RPE ${lastPerformance.rpe}` : ''}
                      </Text>
                    )}
                    {progression && (
                      <Text style={[{ fontSize: 11, fontWeight: '700', color: C.primary, marginTop: 2 }]}>
                        ↑ {progression.headline}
                      </Text>
                    )}
                  </View>
                  <TouchableOpacity
                    style={[{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: C.cardAlt }]}
                    onPress={() => setWeightPickerFor(ex)}
                    activeOpacity={0.7}
                  >
                    <Text style={[{ fontSize: 11, fontWeight: '700', color: C.text }]}>{wDisplay}</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* How to perform */}
              <View style={[{ borderTopWidth: 1, borderTopColor: C.border, paddingHorizontal: 16 }]}>
                <TouchableOpacity
                  style={{ paddingVertical: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                  onPress={() => setHowOpen(p => ({ ...p, [ex.id]: !p[ex.id] }))}
                  activeOpacity={0.7}
                >
                  <Text style={[{ fontSize: 12, fontWeight: '700', color: C.textMuted }]}>How to Perform</Text>
                  <Text style={[{ fontSize: 12, color: C.textDim }]}>{htOpen ? '▲' : '▼'}</Text>
                </TouchableOpacity>
                {htOpen && (
                  <View style={{ paddingBottom: 14 }}>
                    {guide ? (
                      <View style={{ gap: 8, marginBottom: 10 }}>
                        <View>
                          <Text style={[{ fontSize: 9, fontWeight: '700', color: C.textDim, letterSpacing: 0.8, marginBottom: 2 }]}>START POSITION</Text>
                          <Text style={[{ fontSize: 12, color: C.textMuted, lineHeight: 18 }]}>{guide.startPosition}</Text>
                        </View>
                        <View>
                          <Text style={[{ fontSize: 9, fontWeight: '700', color: C.textDim, letterSpacing: 0.8, marginBottom: 2 }]}>FINISH POSITION</Text>
                          <Text style={[{ fontSize: 12, color: C.textMuted, lineHeight: 18 }]}>{guide.finishPosition}</Text>
                        </View>
                        <View>
                          <Text style={[{ fontSize: 9, fontWeight: '700', color: C.textDim, letterSpacing: 0.8, marginBottom: 2 }]}>HOW TO PERFORM</Text>
                          <Text style={[{ fontSize: 12, color: C.textMuted, lineHeight: 18 }]}>{guide.howTo}</Text>
                        </View>
                        <View>
                          <Text style={[{ fontSize: 9, fontWeight: '700', color: C.textDim, letterSpacing: 0.8, marginBottom: 2 }]}>COMMON MISTAKES</Text>
                          {guide.mistakes.map(m => (
                            <Text key={m} style={[{ fontSize: 11, color: C.textMuted, lineHeight: 17 }]}>• {m}</Text>
                          ))}
                        </View>
                      </View>
                    ) : (
                      <Text style={[{ fontSize: 12, color: C.textMuted, lineHeight: 19, marginBottom: 10 }]}>{ex.desc}</Text>
                    )}
                    <View style={[{ backgroundColor: C.primaryDim, borderRadius: 8, padding: 10 }]}>
                      <Text style={[{ fontSize: 9, fontWeight: '700', color: C.primary, letterSpacing: 0.8, marginBottom: 3 }]}>CLINICAL PEARL</Text>
                      <Text style={[{ fontSize: 11, color: C.textMuted, lineHeight: 16 }]}>{guide?.tips[0] ?? ex.cue}</Text>
                      {guide?.tips[1] ? (
                        <Text style={[{ fontSize: 11, color: C.textMuted, lineHeight: 16, marginTop: 3 }]}>{guide.tips[1]}</Text>
                      ) : null}
                    </View>
                    {progression && (
                      <View style={[{ backgroundColor: C.cardAlt, borderRadius: 8, padding: 10, marginTop: 8 }]}>
                        <Text style={[{ fontSize: 9, fontWeight: '700', color: C.accent, letterSpacing: 0.8, marginBottom: 3 }]}>PROGRESSION</Text>
                        <Text style={[{ fontSize: 11, color: C.textMuted, lineHeight: 16 }]}>{progression.reason}</Text>
                      </View>
                    )}
                  </View>
                )}
              </View>

              {/* RPE — compact picker-wheel row, consistent with the weight selector */}
              <View style={{ paddingHorizontal: 16, paddingBottom: 10 }}>
                <TouchableOpacity
                  style={[{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 9, borderWidth: 1, borderColor: C.border, backgroundColor: C.cardAlt, paddingHorizontal: 12, paddingVertical: 9 }]}
                  onPress={() => setRpePickerFor(ex)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={`Set effort for ${ex.name}`}
                >
                  <Text style={[{ fontSize: 11, fontWeight: '700', color: C.textDim, letterSpacing: 0.5 }]}>EFFORT · RPE</Text>
                  <Text style={[{ fontSize: 13, fontWeight: '800', color: rpeVal !== undefined ? C.primary : C.textMuted }]}>
                    {rpeVal !== undefined ? `${rpeVal} · ${RPE_LABELS[rpeVal] ?? ''}` : 'Tap to set ›'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Exercise completion — one action per exercise */}
              <View style={{ paddingHorizontal: 16, paddingBottom: 14 }}>
                {isDone ? (
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <View style={[{ flex: 1, height: 40, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: C.primary }]}>
                      <Text style={[{ fontSize: 12, fontWeight: '700', color: C.onPrimary }]}>✓ Exercise Complete</Text>
                    </View>
                    <TouchableOpacity
                      style={[{ paddingHorizontal: 14, height: 40, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: C.cardAlt }]}
                      onPress={() => undoExercise(ex)}
                      activeOpacity={0.7}
                    >
                      <Text style={[{ fontSize: 12, fontWeight: '700', color: C.textMuted }]}>Undo</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[{ height: 44, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: isCurrent ? C.accent : C.cardAlt }]}
                    onPress={() => completeExercise(ex)}
                    activeOpacity={0.7}
                  >
                    <Text style={[{ fontSize: 13, fontWeight: '700', color: isCurrent ? C.onPrimary : C.textMuted }]}>
                      Complete Exercise
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        })}

        {/* Volume Summary */}
        <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
          <Text style={[styles.cardLabel, { color: C.textDim, marginBottom: 10 }]}>VOLUME SUMMARY</Text>
          {exercises.map(ex => {
            const w = getWeight(ex);
            return (
              <View key={ex.id} style={[{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: C.border }]}>
                <Text style={[{ fontSize: 12, color: C.textMuted }]}>{ex.name}</Text>
                <Text style={[{ fontSize: 12, fontWeight: '700', color: C.text }]}>{ex.sets} × {ex.reps}{w > 0 ? ` @ ${w} ${wtUnit}` : ''}</Text>
              </View>
            );
          })}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingTop: 10 }}>
            <Text style={[{ fontSize: 13, fontWeight: '700', color: C.text }]}>Total Volume</Text>
            <Text style={[{ fontSize: 15, fontWeight: '800', color: C.primary }]}>{totalVolStr}</Text>
          </View>
        </View>

        {/* Cool-Down */}
        <TouchableOpacity
          style={[styles.accordionCard, { backgroundColor: C.card, borderColor: C.border }]}
          onPress={() => setCooldownOpen(o => !o)}
          activeOpacity={0.8}
        >
          <View style={styles.accordionHeader}>
            <View style={[styles.iconBox, { backgroundColor: C.primaryDim }]}>
              <Ionicons name="time-outline" size={15} color={C.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.subTitle, { color: C.text }]}>Cool-Down</Text>
              <Text style={[{ fontSize: 11, color: C.textMuted }]}>5 min · Static stretching</Text>
            </View>
            <Text style={[{ fontSize: 13, color: C.textDim }]}>{cooldownOpen ? '▲' : '▼'}</Text>
          </View>
          {cooldownOpen && (
            <View style={[{ borderTopWidth: 1, borderTopColor: C.border, paddingTop: 10, gap: 5 }]}>
              {["Quad Stretch · 30s each · 1 min", "Hamstring Stretch · 30s each · 1 min", "Hip Flexor Stretch · 45s each · 1.5 min", "Child's Pose · 60s · 1 min", "Pigeon Pose · 45s each · 1.5 min"].map(item => {
                const [name, ...rest] = item.split(' · ');
                return (
                  <View key={item} style={[styles.listRow, { backgroundColor: C.cardAlt }]}>
                    <Text style={[{ fontSize: 12, fontWeight: '600', color: C.text }]}>{name}</Text>
                    <Text style={[{ fontSize: 11, color: C.textMuted }]}>{rest.join(' · ')}</Text>
                  </View>
                );
              })}
            </View>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Weight Picker */}
      <PickerWheel
        visible={weightPickerFor !== null}
        title={weightPickerFor ? `Set weight for ${weightPickerFor.name}` : 'Set weight'}
        values={WEIGHT_VALUES}
        selectedValue={weightPickerFor ? getWeight(weightPickerFor) : 0}
        formatValue={v => v === 0 ? 'Bodyweight' : `${v % 5 === 0 ? v : v.toFixed(1)} ${wtUnit}`}
        onConfirm={v => {
          if (weightPickerFor) setWeights(p => ({ ...p, [weightPickerFor.id]: v }));
          setWeightPickerFor(null);
        }}
        onClose={() => setWeightPickerFor(null)}
      />

      {/* RPE Picker */}
      <PickerWheel
        visible={rpePickerFor !== null}
        title={rpePickerFor ? `Effort for ${rpePickerFor.name}` : 'Effort · RPE'}
        values={RPE_VALUES}
        selectedValue={rpePickerFor ? (rpe[rpePickerFor.id] ?? 7) : 7}
        formatValue={v => `RPE ${v} · ${RPE_LABELS[v] ?? ''}`}
        onConfirm={v => {
          if (rpePickerFor) setRpe(p => ({ ...p, [rpePickerFor.id]: v }));
          setRpePickerFor(null);
        }}
        onClose={() => setRpePickerFor(null)}
      />
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
    fontSize: 26,
    fontWeight: '700',
    fontFamily: 'CormorantGaramond_700Bold',
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    marginBottom: 10,
  },
  accordionCard: {
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
    overflow: 'hidden',
  },
  accordionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    paddingHorizontal: 16,
  },
  iconBox: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exCard: {
    borderRadius: 14,
    borderWidth: 1.5,
    marginBottom: 8,
    overflow: 'hidden',
  },
  cardLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  subTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  listRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  timerDisplay: {
    fontSize: 58,
    fontWeight: '800',
    lineHeight: 64,
    marginBottom: 12,
    fontVariant: ['tabular-nums'],
  },
  bigBtn: {
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  bigBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },
  smBtn: {
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  smBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  btnRow: {
    flexDirection: 'row',
    gap: 8,
    width: '100%',
    marginTop: 8,
  },
  halfBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewRow: {
    flexDirection: 'row',
    width: '100%',
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 12,
    marginBottom: 12,
  },
  previewStat: {
    flex: 1,
    alignItems: 'center',
  },
  previewValue: {
    fontSize: 20,
    fontWeight: '800',
  },
  previewLabel: {
    fontSize: 10,
    marginTop: 2,
  },
  previewDivider: {
    width: 1,
  },
});
