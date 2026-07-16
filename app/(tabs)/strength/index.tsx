import { useEffect, useMemo, useRef, useState } from 'react';
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
import type { CompletedExercise, MovementPattern, StrengthSession } from '../../../src/types/strength';
import { getLastLoggedExercise, suggestProgression } from '../../../src/utils/strengthHistory';
import { getExerciseGuide } from '../../../src/constants/exerciseGuides';
import { toYMD } from '../../../src/utils/calendarEngine';
import { useWeekPlan } from '../../../src/hooks/useWeekPlan';
import PickerWheel from '../../../src/components/ui/PickerWheel';
import {
  addStrengthIntentListener,
  endStrengthLiveActivity,
  startStrengthLiveActivity,
  updateStrengthLiveActivity,
} from '../../../src/lib/strengthLiveActivity';
import { startControlCommandPolling } from '../../../src/lib/runLiveActivity';
import InfoButton from '../../../src/components/shared/InfoButton';
import { useMobilityStore, weeklyCompletionCount, lastCompletedAt } from '../../../src/store/mobilityStore';
import {
  MOBILITY_WORKOUTS,
  MOBILITY_CATEGORY_LABELS,
  getMobilityWorkoutsByCategory,
} from '../../../src/constants/mobilityBank';
import type { MobilityCategory } from '../../../src/types/mobility';
import {
  STRENGTH_PRESET_WORKOUTS,
  STRENGTH_PRESET_CATEGORY_LABELS,
  getStrengthPresetWorkoutsByCategory,
  type PresetStrengthWorkout,
  type StrengthPresetCategory,
} from '../../../src/constants/strengthBank';
import {
  activeStrengthElapsedSeconds,
  useActiveStrengthSessionStore,
} from '../../../src/store/activeStrengthSessionStore';

type Segment = 'strength' | 'presets' | 'mobility';

function SegmentedControl({ segment, setSegment, C }: {
  segment: Segment;
  setSegment: (s: Segment) => void;
  C: ReturnType<typeof useColors>;
}) {
  const options: { label: string; value: Segment }[] = [
    { label: 'Strength', value: 'strength' },
    { label: 'Presets', value: 'presets' },
    { label: 'Mobility', value: 'mobility' },
  ];
  return (
    <View style={[segStyles.wrap, { backgroundColor: C.cardAlt }]}>
      {options.map(opt => {
        const active = segment === opt.value;
        return (
          <TouchableOpacity
            key={opt.value}
            style={[segStyles.btn, active && { backgroundColor: C.card }]}
            onPress={() => setSegment(opt.value)}
            activeOpacity={0.75}
          >
            <Text style={[segStyles.btnText, { color: active ? C.text : C.textMuted, fontWeight: active ? '700' : '500' }]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const segStyles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    borderRadius: 10,
    padding: 4,
    gap: 4,
    marginHorizontal: 18,
    marginBottom: 12,
  },
  btn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  btnText: {
    fontSize: 13,
  },
});

// ─── Mobility segment ──────────────────────────────────────────────────────────

const CATEGORY_FILTERS: (MobilityCategory | 'all')[] = [
  'all', 'full_body', 'problem_areas', 'ankle', 'hip', 'back_spine',
  'pre_run', 'post_run', 'upper_body', 'lower_body', 'running_readiness', 'walking_readiness',
];

function formatLastDone(ts: number | null): string {
  if (ts === null) return 'Not done yet';
  const days = Math.floor((Date.now() - ts) / (24 * 60 * 60 * 1000));
  if (days <= 0) return 'Last done today';
  if (days === 1) return 'Last done yesterday';
  if (days < 7) return `Last done ${days}d ago`;
  const weeks = Math.floor(days / 7);
  return `Last done ${weeks}w ago`;
}

function MobilityTabContent({ segment, setSegment, C }: {
  segment: Segment;
  setSegment: (s: Segment) => void;
  C: ReturnType<typeof useColors>;
}) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const completions = useMobilityStore(s => s.completions);
  const recommendedWorkoutIds = useMobilityStore(s => s.recommendedWorkoutIds);
  const [categoryFilter, setCategoryFilter] = useState<MobilityCategory | 'all'>('all');

  const weekCount = useMemo(() => weeklyCompletionCount(completions), [completions]);
  const recommended = useMemo(
    () => MOBILITY_WORKOUTS.filter(w => recommendedWorkoutIds.includes(w.id)),
    [recommendedWorkoutIds],
  );
  const filteredWorkouts = useMemo(
    () => categoryFilter === 'all' ? MOBILITY_WORKOUTS : getMobilityWorkoutsByCategory(categoryFilter),
    [categoryFilter],
  );

  function openWorkout(id: string) {
    router.push({ pathname: '/(tabs)/strength/mobility-workout', params: { id } } as any);
  }

  function renderWorkoutCard(workoutId: string, key: string) {
    const workout = MOBILITY_WORKOUTS.find(w => w.id === workoutId);
    if (!workout) return null;
    const lastDone = lastCompletedAt(completions, workout.id);
    return (
      <TouchableOpacity
        key={key}
        style={[styles.card, { backgroundColor: C.card, borderColor: C.border, marginBottom: 10 }]}
        activeOpacity={0.8}
        onPress={() => openWorkout(workout.id)}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1, paddingRight: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={[styles.subTitle, { color: C.text }]}>{workout.title}</Text>
              <InfoButton term="mobility" />
            </View>
            <Text style={[{ fontSize: 12, color: C.textMuted, marginTop: 3 }]}>{workout.targetAreas.join(' · ')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={C.textMuted} />
        </View>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
          <Text style={[{ fontSize: 11, color: C.textDim }]}>{workout.durationMin} min</Text>
          <Text style={[{ fontSize: 11, color: C.textDim }]}>·</Text>
          <Text style={[{ fontSize: 11, color: C.textDim }]}>{workout.recommendedFrequency}</Text>
        </View>
        <Text style={[{ fontSize: 11, color: lastDone ? C.primary : C.textDim, marginTop: 4, fontWeight: '600' }]}>
          {formatLastDone(lastDone)}
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={[styles.screenHeader, { paddingTop: insets.top + 6, backgroundColor: C.bg }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerLabel, { color: C.textDim }]}>MOBILITY</Text>
          <Text style={[styles.headerTitle, { color: C.text }]}>Mobility</Text>
        </View>
      </View>

      <SegmentedControl segment={segment} setSegment={setSegment} C={C} />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: LAYOUT.screenPadBottom }}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
          <Text style={[{ fontSize: 13, fontWeight: '700', color: C.text }]}>This week: {weekCount} session{weekCount === 1 ? '' : 's'}</Text>
        </View>

        {/* Recommended for you */}
        <Text style={[styles.cardLabel, { color: C.textDim, marginBottom: 8, marginTop: 4 }]}>RECOMMENDED FOR YOU</Text>
        {recommended.length > 0 ? (
          recommended.map(w => renderWorkoutCard(w.id, `rec_${w.id}`))
        ) : (
          <View style={[styles.card, { backgroundColor: C.cardAlt, borderColor: C.border, marginBottom: 10 }]}>
            <Text style={[{ fontSize: 12, color: C.textMuted, lineHeight: 18 }]}>
              Complete a Movement Lab readiness assessment to get personalized mobility recommendations.
            </Text>
          </View>
        )}

        {/* Category filter chips */}
        <Text style={[styles.cardLabel, { color: C.textDim, marginBottom: 8, marginTop: 10 }]}>ALL MOBILITY WORKOUTS</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {CATEGORY_FILTERS.map(cat => {
              const active = categoryFilter === cat;
              const label = cat === 'all' ? 'All' : MOBILITY_CATEGORY_LABELS[cat];
              return (
                <TouchableOpacity
                  key={cat}
                  style={[
                    { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1 },
                    { backgroundColor: active ? C.primaryDim : C.card, borderColor: active ? C.primary : C.border },
                  ]}
                  onPress={() => setCategoryFilter(cat)}
                  activeOpacity={0.75}
                >
                  <Text style={{ fontSize: 12, fontWeight: '700', color: active ? C.primary : C.textDim }}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        {filteredWorkouts.map(w => renderWorkoutCard(w.id, w.id))}
      </ScrollView>
    </View>
  );
}

// ─── Strength preset library segment ───────────────────────────────────────────
//
// Read-only presentation over STRENGTH_PRESET_WORKOUTS. Mirrors the mobility
// library pattern above (recommended section + category filter chips + cards).
// The Training Block Workout segment (default tab) remains the primary,
// personalized program; this is a browsable static library alongside it.
// Does not touch strengthStore or any engine — Codex wires launch/logging.

const PRESET_CATEGORY_FILTERS: (StrengthPresetCategory | 'all')[] = [
  'all', 'gym_barbell', 'dumbbell', 'kettlebell', 'bodyweight',
  'full_body', 'upper_body', 'lower_body', 'runner_strength',
  'pre_run', 'post_run_recovery', 'problem_area',
];

const EQUIPMENT_LABELS: Record<string, string> = {
  barbell: 'Barbell',
  squat_rack: 'Squat Rack',
  bench: 'Bench',
  dumbbell: 'Dumbbell',
  kettlebell: 'Kettlebell',
  band: 'Band',
  bodyweight: 'Bodyweight',
};

function PresetsTabContent({ segment, setSegment, C }: {
  segment: Segment;
  setSegment: (s: Segment) => void;
  C: ReturnType<typeof useColors>;
}) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [categoryFilter, setCategoryFilter] = useState<StrengthPresetCategory | 'all'>('all');
  const [openPresetId, setOpenPresetId] = useState<string | null>(null);
  const completedSessions = useStrengthStore(s => s.completedSessions);

  const recommended = useMemo(
    () => STRENGTH_PRESET_WORKOUTS.filter(w => w.categories.includes('recommended')),
    [],
  );
  const filteredPresets = useMemo(
    () => categoryFilter === 'all' ? STRENGTH_PRESET_WORKOUTS : getStrengthPresetWorkoutsByCategory(categoryFilter),
    [categoryFilter],
  );

  function renderPresetCard(preset: PresetStrengthWorkout, key: string) {
    const open = openPresetId === preset.id;
    return (
      <TouchableOpacity
        key={key}
        style={[styles.card, { backgroundColor: C.card, borderColor: C.border, marginBottom: 10 }]}
        activeOpacity={0.8}
        onPress={() => setOpenPresetId(open ? null : preset.id)}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Text style={[styles.subTitle, { color: C.text }]}>{preset.title}</Text>
            <Text style={[{ fontSize: 12, color: C.textMuted, marginTop: 3, lineHeight: 17 }]}>{preset.description}</Text>
          </View>
          <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={C.textMuted} />
        </View>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          <Text style={[{ fontSize: 11, color: C.textDim }]}>{preset.durationMin} min</Text>
          <Text style={[{ fontSize: 11, color: C.textDim }]}>·</Text>
          <Text style={[{ fontSize: 11, color: C.textDim }]}>{preset.exercises.length} exercises</Text>
          <Text style={[{ fontSize: 11, color: C.textDim }]}>·</Text>
          <Text style={[{ fontSize: 11, color: C.textDim, flexShrink: 1 }]} numberOfLines={1}>
            {preset.equipment.map(e => EQUIPMENT_LABELS[e] ?? e).join(', ')}
          </Text>
        </View>
        {open && (
          <View style={{ marginTop: 10, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 10, gap: 6 }}>
            {preset.exercises.map(e => (
              <View key={e.name} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                <Text style={[{ fontSize: 12, color: C.textMuted, flex: 1 }]}>{e.name}</Text>
                <Text style={[{ fontSize: 12, fontWeight: '700', color: C.text }]}>{e.sets} × {e.reps}</Text>
              </View>
            ))}
            <TouchableOpacity
              style={{ marginTop: 8, minHeight: 42, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: C.primary }}
              onPress={event => {
                event.stopPropagation();
                router.push({ pathname: '/(tabs)/strength/preset/[id]', params: { id: preset.id } } as never);
              }}
            >
              <Text style={{ color: C.onPrimary, fontSize: 13, fontWeight: '700' }}>View Preset Details</Text>
            </TouchableOpacity>
            {completedSessions.some(id => id.startsWith(`preset_${preset.id}_`)) ? (
              <Text style={{ color: C.positive, fontSize: 11, marginTop: 2 }}>Previously completed</Text>
            ) : null}
          </View>
        )}
      </TouchableOpacity>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={[styles.screenHeader, { paddingTop: insets.top + 6, backgroundColor: C.bg }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerLabel, { color: C.textDim }]}>STRENGTH</Text>
          <Text style={[styles.headerTitle, { color: C.text }]}>Preset Library</Text>
        </View>
      </View>

      <SegmentedControl segment={segment} setSegment={setSegment} C={C} />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: LAYOUT.screenPadBottom }}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.card, { backgroundColor: C.cardAlt, borderColor: C.border }]}>
          <Text style={[{ fontSize: 12, color: C.textMuted, lineHeight: 18 }]}>
            Training Block Workouts and Preset Workouts remain independent. Open a preset for its purpose,
            exercise instructions, session flow, loading, RPE, and history logging.
          </Text>
        </View>

        <Text style={[styles.cardLabel, { color: C.textDim, marginBottom: 8, marginTop: 4 }]}>RECOMMENDED FOR YOU</Text>
        {recommended.length > 0 ? (
          recommended.map(w => renderPresetCard(w, `rec_${w.id}`))
        ) : (
          <View style={[styles.card, { backgroundColor: C.cardAlt, borderColor: C.border, marginBottom: 10 }]}>
            <Text style={[{ fontSize: 12, color: C.textMuted, lineHeight: 18 }]}>No recommended presets right now.</Text>
          </View>
        )}

        <Text style={[styles.cardLabel, { color: C.textDim, marginBottom: 8, marginTop: 10 }]}>ALL PRESETS</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {PRESET_CATEGORY_FILTERS.map(cat => {
              const active = categoryFilter === cat;
              const label = cat === 'all' ? 'All' : STRENGTH_PRESET_CATEGORY_LABELS[cat];
              return (
                <TouchableOpacity
                  key={cat}
                  style={[
                    { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1 },
                    { backgroundColor: active ? C.primaryDim : C.card, borderColor: active ? C.primary : C.border },
                  ]}
                  onPress={() => setCategoryFilter(cat)}
                  activeOpacity={0.75}
                >
                  <Text style={{ fontSize: 12, fontWeight: '700', color: active ? C.primary : C.textDim }}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        {filteredPresets.map(w => renderPresetCard(w, w.id))}
      </ScrollView>
    </View>
  );
}

type ExDef = {
  id: string;
  name: string;
  sets: number;
  reps: string;
  weight: number;
  restSeconds: number;
  muscles: string;
  desc: string;
  cue: string;
};

const PATTERN_MUSCLES: Record<MovementPattern, string> = {
  squat:       'Quads · Glutes',
  hinge:       'Hamstrings · Glutes',
  lunge:       'Quads · Glutes · Balance',
  push:        'Chest · Shoulders · Triceps',
  pull:        'Back · Biceps',
  carry:       'Core · Grip',
  trunk:       'Core',
  calf_ankle:  'Calves · Ankles',
  plyometric:  'Power · Reactivity',
  mobility:    'Mobility',
};

function sessionToExDefs(session: StrengthSession, strengthHistory: ReturnType<typeof useStrengthStore.getState>['history']): ExDef[] {
  return session.exercises.map(ex => {
    const last = getLastLoggedExercise(strengthHistory, ex.exerciseId);
    const parsedWeight = last?.load ? parseFloat(last.load) : NaN;
    return {
      id: ex.exerciseId,
      name: ex.exercise.name,
      sets: ex.sets,
      reps: `${ex.repRange[0]}–${ex.repRange[1]}`,
      weight: Number.isFinite(parsedWeight) ? parsedWeight : 0,
      restSeconds: ex.restSeconds,
      muscles: PATTERN_MUSCLES[ex.exercise.pattern] ?? ex.exercise.pattern.replace(/_/g, ' '),
      desc: ex.exercise.rationale,
      cue: ex.exercise.coachingCues[0] ?? ex.rationale,
    };
  });
}

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

function dayLabelFor(dateYMD: string, todayYMD: string): string {
  if (dateYMD === todayYMD) return 'Today';
  const [y, m, d] = dateYMD.split('-').map(Number);
  const date = new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  if (toYMD(tomorrow) === dateYMD) return 'Tomorrow';
  return date.toLocaleDateString('en-US', { weekday: 'long' });
}

export default function StrengthScreen() {
  const C = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [segment, setSegment] = useState<Segment>('strength');
  const { units } = useSettingsStore();
  const weekPlan = useWeekPlan();
  const fatigueScore = useAthleteStore(s => s.fatigueScore);
  const readinessLimited = weekPlan.strengthWeek.progressionState === 'regress';
  const logStrengthSession = useStrengthStore(s => s.manualLog);
  const strengthHistory = useStrengthStore(s => s.history);
  const activeStrengthSession = useActiveStrengthSessionStore(s => s.session);
  const startActiveStrengthSession = useActiveStrengthSessionStore(s => s.startSession);
  const pauseActiveStrengthSession = useActiveStrengthSessionStore(s => s.pause);
  const resumeActiveStrengthSession = useActiveStrengthSessionStore(s => s.resume);
  const completeActiveStrengthExercise = useActiveStrengthSessionStore(s => s.completeExercise);
  const uncompleteActiveStrengthExercise = useActiveStrengthSessionStore(s => s.uncompleteExercise);
  const setActiveStrengthRpe = useActiveStrengthSessionStore(s => s.setExerciseRpe);
  const setActiveStrengthLoad = useActiveStrengthSessionStore(s => s.setExerciseLoad);
  const clearActiveStrengthSession = useActiveStrengthSessionStore(s => s.clearSession);
  const imp = units === 'imperial';
  const wtUnit = imp ? 'lb' : 'kg';
  const WEIGHT_VALUES = imp ? WEIGHT_VALUES_LB : WEIGHT_VALUES_KG;

  const todayYMD = useMemo(() => toYMD(new Date()), []);

  // ── Real sessions for this week, date-sorted ───────────────────────────────
  const strengthEntries = useMemo(() => {
    const list: { date: string; session: StrengthSession }[] = [];
    for (const [date, entries] of weekPlan.calendarMap.entries()) {
      for (const e of entries) {
        if (e.type === 'strength' && e.session) list.push({ date, session: e.session });
      }
    }
    return list.sort((a, b) => a.date.localeCompare(b.date));
  }, [weekPlan.calendarMap]);

  const autoIndex = useMemo(() => {
    if (strengthEntries.length === 0) return -1;
    const todayIdx = strengthEntries.findIndex(e => e.date === todayYMD);
    if (todayIdx !== -1) return todayIdx;
    const nextIdx = strengthEntries.findIndex(e => e.date > todayYMD);
    if (nextIdx !== -1) return nextIdx;
    return strengthEntries.length - 1;
  }, [strengthEntries, todayYMD]);

  const [manualIndex, setManualIndex] = useState<number | null>(null);
  const activeIndex = manualIndex !== null && strengthEntries.length > 0
    ? ((manualIndex % strengthEntries.length) + strengthEntries.length) % strengthEntries.length
    : autoIndex;
  const activeEntry = activeIndex >= 0 ? strengthEntries[activeIndex] : null;
  const session = activeEntry?.session ?? null;

  const sessionIndexInWeek = session ? weekPlan.strengthWeek.sessions.indexOf(session) : -1;
  const currentWeek = weekPlan.metadata.currentWeek;

  const wDef = session
    ? { title: session.title, label: `Strength · ${dayLabelFor(activeEntry!.date, todayYMD)}` }
    : { title: 'Strength', label: 'STRENGTH' };

  const [strState, setStrState] = useState<'idle' | 'active' | 'paused'>('idle');
  const [timer, setTimer] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [weights, setWeights] = useState<Record<string, number>>({});
  const [completedExercises, setCompletedExercises] = useState<Record<string, boolean>>({});
  const [rpe,     setRpe]     = useState<Record<string, number>>({});
  const [howOpen, setHowOpen] = useState<Record<string, boolean>>({});
  const [warmupOpen, setWarmupOpen] = useState(false);
  const [cooldownOpen, setCooldownOpen] = useState(false);
  const [weightPickerFor, setWeightPickerFor] = useState<ExDef | null>(null);
  const [rpePickerFor, setRpePickerFor] = useState<ExDef | null>(null);

  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);

  // Reset in-progress UI state whenever the active session changes.
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setStrState('idle');
    setTimer(0);
    setWeights({});
    setCompletedExercises({});
    setRpe({});
  }, [session?.id]);

  const exercises = useMemo(() => session ? sessionToExDefs(session, strengthHistory) : [], [session, strengthHistory]);
  const estimatedDurationMin = exercises.length > 0 ? estimateWorkoutDurationMin(exercises) : 0;

  const ownsActiveTrainingBlock = Boolean(
    activeStrengthSession?.source === 'training_block'
    && activeStrengthSession.workoutId === session?.id,
  );

  useEffect(() => {
    if (activeStrengthSession?.source !== 'training_block') return;
    const activeEntryIndex = strengthEntries.findIndex(entry => entry.session.id === activeStrengthSession.workoutId);
    if (activeEntryIndex >= 0 && activeEntryIndex !== activeIndex) setManualIndex(activeEntryIndex);
  }, [activeIndex, activeStrengthSession, strengthEntries]);

  useEffect(() => {
    if (!ownsActiveTrainingBlock || !activeStrengthSession) return;
    if (intervalRef.current) clearInterval(intervalRef.current);
    setTimer(activeStrengthElapsedSeconds(activeStrengthSession));
    setCompletedExercises(Object.fromEntries(activeStrengthSession.completedExerciseIds.map(id => [id, true])));
    setRpe(activeStrengthSession.rpeByExercise);
    setWeights(Object.fromEntries(
      Object.entries(activeStrengthSession.loadByExercise)
        .map(([id, value]) => [id, Number.parseFloat(value)])
        .filter((entry): entry is [string, number] => Number.isFinite(entry[1])),
    ));
    setStrState(activeStrengthSession.status);
    if (activeStrengthSession.status === 'active') {
      intervalRef.current = setInterval(() => {
        setTimer(activeStrengthElapsedSeconds(useActiveStrengthSessionStore.getState().session));
      }, 1000);
    }
  }, [activeStrengthSession?.workoutId, ownsActiveTrainingBlock]);

  // Completion is per EXERCISE, not per set: N exercises = N completions,
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
    if (ownsActiveTrainingBlock) completeActiveStrengthExercise(ex.id);
  }
  function undoExercise(ex: ExDef) {
    setCompletedExercises(prev => ({ ...prev, [ex.id]: false }));
    if (ownsActiveTrainingBlock) uncompleteActiveStrengthExercise(ex.id);
  }

  function launchTrainingBlock() {
    if (!session) return;
    startActiveStrengthSession({
      source: 'training_block',
      workoutId: session.id,
      workoutName: wDef.title,
      plannedDurationMin: estimatedDurationMin,
      exercises: exercises.map(exercise => ({
        id: exercise.id,
        name: exercise.name,
        sets: exercise.sets,
        reps: exercise.reps,
        equipment: [],
        notes: exercise.cue,
      })),
    });
    if (intervalRef.current) clearInterval(intervalRef.current);
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
  function start() {
    if (!activeStrengthSession || ownsActiveTrainingBlock) {
      if (ownsActiveTrainingBlock) {
        if (activeStrengthSession?.status === 'paused') resume();
        return;
      }
      launchTrainingBlock();
      return;
    }
    Alert.alert(
      'Another strength session is active',
      `${activeStrengthSession.workoutName} is still in progress. StrideOS will never end it silently.`,
      [
        {
          text: 'Continue Current Session',
          onPress: () => {
            if (activeStrengthSession.source === 'preset') {
              router.push('/(tabs)/strength/preset-session' as never);
              return;
            }
            const index = strengthEntries.findIndex(entry => entry.session.id === activeStrengthSession.workoutId);
            if (index >= 0) setManualIndex(index);
          },
        },
        {
          text: 'End Current Session and Start Other Workout',
          style: 'destructive',
          onPress: async () => {
            await endStrengthLiveActivity().catch(console.warn);
            clearActiveStrengthSession();
            launchTrainingBlock();
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  }
  function pause() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setStrState('paused');
    if (ownsActiveTrainingBlock) pauseActiveStrengthSession();
  }
  function resume() {
    intervalRef.current = setInterval(() => setTimer(t => t + 1), 1000);
    setStrState('active');
    if (ownsActiveTrainingBlock) resumeActiveStrengthSession();
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
    if (!session || sessionIndexInWeek === -1) return;
    if (intervalRef.current) clearInterval(intervalRef.current);
    endStrengthLiveActivity().catch(console.warn);
    if (ownsActiveTrainingBlock) clearActiveStrengthSession();

    const selectedRpes = exercises.map(ex => rpe[ex.id]).filter((value): value is number => typeof value === 'number');
    const overallRpe = selectedRpes.length
      ? Math.round(selectedRpes.reduce((sum, value) => sum + value, 0) / selectedRpes.length)
      : 7;
    const durationMinutes = Math.max(1, Math.round(timer / 60));
    const completionKey = `strength_w${currentWeek}_s${sessionIndexInWeek}`;

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
      sessionType: session.sessionType,
      goal: session.goal,
      week: currentWeek,
      plannedDuration: estimatedDurationMin,
      actualDuration: durationMinutes,
      exercises: loggedExercises,
      overallRpe,
      notes: `${wDef.title} completed from the Strength screen.`,
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

  // ── Presets segment ──────────────────────────────────────────────────────────
  if (segment === 'presets') {
    return <PresetsTabContent segment={segment} setSegment={setSegment} C={C} />;
  }

  // ── Mobility segment ─────────────────────────────────────────────────────────
  if (segment === 'mobility') {
    return <MobilityTabContent segment={segment} setSegment={setSegment} C={C} />;
  }

  // ── Before program start ────────────────────────────────────────────────────
  if (weekPlan.metadata.currentWeek === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <View style={[styles.screenHeader, { paddingTop: insets.top + 6, backgroundColor: C.bg }]}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="arrow-back" size={20} color={C.primary} />
          </TouchableOpacity>
          <View style={{ marginLeft: 10, flex: 1 }}>
            <Text style={[styles.headerLabel, { color: C.textDim }]}>STRENGTH</Text>
            <Text style={[styles.headerTitle, { color: C.text }]}>Strength</Text>
          </View>
        </View>
        <SegmentedControl segment={segment} setSegment={setSegment} C={C} />
        <View style={{ paddingHorizontal: 18 }}>
          <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
            <Text style={[styles.subTitle, { color: C.text, marginBottom: 6 }]}>Your plan hasn't started yet</Text>
            <Text style={[{ fontSize: 13, color: C.textMuted, lineHeight: 19 }]}>
              {weekPlan.metadata.startsOn
                ? `Strength sessions begin the week of ${weekPlan.metadata.startsOn}.`
                : 'Set a program start date in Settings to see your strength sessions here.'}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  // ── No session available this week ─────────────────────────────────────────
  if (!session) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <View style={[styles.screenHeader, { paddingTop: insets.top + 6, backgroundColor: C.bg }]}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="arrow-back" size={20} color={C.primary} />
          </TouchableOpacity>
          <View style={{ marginLeft: 10, flex: 1 }}>
            <Text style={[styles.headerLabel, { color: C.textDim }]}>STRENGTH</Text>
            <Text style={[styles.headerTitle, { color: C.text }]}>Strength</Text>
          </View>
        </View>
        <SegmentedControl segment={segment} setSegment={setSegment} C={C} />
        <View style={{ paddingHorizontal: 18 }}>
          <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
            <Text style={[{ fontSize: 13, color: C.textMuted, lineHeight: 19 }]}>
              No strength session is scheduled this week — {weekPlan.strengthWeek.phaseNote || 'check back next week.'}
            </Text>
          </View>
        </View>
      </View>
    );
  }

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
        {strengthEntries.length > 1 && (
          <TouchableOpacity onPress={() => setManualIndex((manualIndex ?? autoIndex) + 1)} style={{ padding: 4 }}>
            <Ionicons name="swap-horizontal-outline" size={20} color={C.primary} />
          </TouchableOpacity>
        )}
      </View>

      <SegmentedControl segment={segment} setSegment={setSegment} C={C} />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: LAYOUT.screenPadBottom }}
        showsVerticalScrollIndicator={false}
      >
        {/* Progression banner */}
        <View style={[
          styles.progressionBanner,
          {
            backgroundColor: weekPlan.strengthWeek.progressionState === 'progress' ? C.positiveDim
              : weekPlan.strengthWeek.progressionState === 'regress' ? C.criticalDim : C.cardAlt,
            borderColor: weekPlan.strengthWeek.progressionState === 'progress' ? C.positive
              : weekPlan.strengthWeek.progressionState === 'regress' ? C.critical : C.border,
          },
        ]}>
          <Text style={[styles.progressionLabel, {
            color: weekPlan.strengthWeek.progressionState === 'progress' ? C.positive
              : weekPlan.strengthWeek.progressionState === 'regress' ? C.critical : C.textMuted,
          }]}>
            Strength: {weekPlan.strengthWeek.progressionState === 'progress' ? 'progressing'
              : weekPlan.strengthWeek.progressionState === 'regress' ? 'pulling back' : 'holding steady'}
          </Text>
          <Text style={[{ fontSize: 12, color: C.textMuted, lineHeight: 17, marginTop: 2 }]}>
            {weekPlan.strengthWeek.progressionReason}
          </Text>
        </View>

        {/* Session Timer */}
        <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border, alignItems: 'center' }]}>
          <Text style={[styles.cardLabel, { color: C.primary, marginBottom: 3 }]}>TRAINING BLOCK WORKOUT</Text>
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
                <Text style={[styles.bigBtnText, { color: C.onPrimary }]}>Start Training Block Workout</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.smBtn, { backgroundColor: C.cardAlt }]} onPress={() => router.back()} activeOpacity={0.8}>
                <Text style={[styles.smBtnText, { color: C.textMuted }]}>Skip Workout</Text>
              </TouchableOpacity>
            </>
          )}
          {strState === 'active' && (
            <View style={styles.btnRow}>
              <TouchableOpacity style={[styles.halfBtn, { backgroundColor: C.warning }]} onPress={pause} activeOpacity={0.8}>
                <Text style={[styles.bigBtnText, { color: '#14160F' }]}>Pause</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.halfBtn, { backgroundColor: C.critical }]} onPress={finishSession} activeOpacity={0.8}>
                <Text style={[styles.bigBtnText, { color: '#F3F1E9' }]}>Finish</Text>
              </TouchableOpacity>
            </View>
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
              <Text style={[{ fontSize: 11, color: C.textMuted }]}>{WARMUP_MIN} min · Dynamic mobility</Text>
            </View>
            <Text style={[{ fontSize: 13, color: C.textDim }]}>{warmupOpen ? '▲' : '▼'}</Text>
          </View>
          {warmupOpen && (
            <View style={[{ borderTopWidth: 1, borderTopColor: C.border, paddingTop: 10 }]}>
              <Text style={[{ fontSize: 12, color: C.textMuted, lineHeight: 18 }]}>{session.warmupProtocol}</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Exercises */}
        <Text style={[styles.cardLabel, { color: C.textDim, marginBottom: 8 }]}>EXERCISES</Text>
        {exercises.map(ex => {
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
                    <Text style={[styles.subTitle, { color: C.text }]}>{ex.name}</Text>
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
              <Text style={[{ fontSize: 11, color: C.textMuted }]}>{COOLDOWN_MIN} min · Static stretching</Text>
            </View>
            <Text style={[{ fontSize: 13, color: C.textDim }]}>{cooldownOpen ? '▲' : '▼'}</Text>
          </View>
          {cooldownOpen && (
            <View style={[{ borderTopWidth: 1, borderTopColor: C.border, paddingTop: 10 }]}>
              <Text style={[{ fontSize: 12, color: C.textMuted, lineHeight: 18 }]}>{session.cooldownProtocol}</Text>
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
          if (weightPickerFor) {
            setWeights(p => ({ ...p, [weightPickerFor.id]: v }));
            if (ownsActiveTrainingBlock) setActiveStrengthLoad(weightPickerFor.id, String(v));
          }
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
          if (rpePickerFor) {
            setRpe(p => ({ ...p, [rpePickerFor.id]: v }));
            if (ownsActiveTrainingBlock) setActiveStrengthRpe(rpePickerFor.id, v);
          }
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
  progressionBanner: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 10,
  },
  progressionLabel: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
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
