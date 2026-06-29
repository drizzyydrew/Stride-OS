import { useMemo, useState } from 'react';
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

import { useColors } from '../../../src/theme/useColors';
import { useSettingsStore } from '../../../src/store/settingsStore';
import { useWorkoutStore } from '../../../src/store/workoutStore';
import { useStrengthStore } from '../../../src/store/strengthStore';
import { useExerciseStore, type Exercise as LibraryExercise } from '../../../src/store/exerciseStore';
import { STRENGTH_EXERCISES } from '../../../src/utils/strengthEngine';
import { LAYOUT } from '../../../src/constants/layout';
import type { CompletedWorkoutRecord } from '../../../src/types/training';
import type { StrengthLogRecord } from '../../../src/types/strength';

type ActivityEntry =
  | { kind: 'run'; id: string; timestamp: number; record: CompletedWorkoutRecord }
  | { kind: 'strength'; id: string; timestamp: number; record: StrengthLogRecord };

const PROTOTYPE_EXERCISE_NAMES: Record<string, string> = {
  gs: 'Goblet Squat',
  rdl: 'Romanian Deadlift',
  gb: 'Glute Bridge',
  pl: 'Plank',
  dbr: 'Dumbbell Row',
  pu: 'Push-Up',
  ohp: 'Overhead Press',
  db2: 'Dead Bug',
};

const PROTOTYPE_EXERCISE_EXPLAIN: Record<string, string> = {
  gs: 'Hold a dumbbell at the chest and squat with control. Keep the chest tall and drive the knees over the toes.',
  rdl: 'Hinge at the hips with soft knees and keep the load close. You should feel the hamstrings and glutes, not the low back.',
  gb: 'Lie on your back, drive through the heels, and squeeze the glutes at the top. Pause briefly before lowering.',
  pl: 'Hold a straight line from head to heels. Breathe normally and brace the trunk without letting the hips sag.',
  dbr: 'Brace with one hand and row the dumbbell toward the hip. Keep the shoulder away from the ear.',
  pu: 'Keep a rigid plank and lower with control. Elbows should track about 45 degrees from the torso.',
  ohp: 'Press from shoulder height overhead while keeping ribs down and glutes lightly squeezed.',
  db2: 'Keep the low back pressed into the floor while extending opposite arm and leg slowly.',
};

function fmtDate(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    .format(new Date(timestamp || Date.now()));
}

function fmtPace(distanceMiles?: number, durationMin?: number) {
  if (!distanceMiles || !durationMin) return 'Pace --';
  const secPerMi = (durationMin * 60) / distanceMiles;
  const min = Math.floor(secPerMi / 60);
  const sec = Math.round(secPerMi % 60).toString().padStart(2, '0');
  return `${min}:${sec}/mi`;
}

function strengthName(record: StrengthLogRecord) {
  return record.sessionId
    .replace(/^strength_/, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase()) || 'Strength session';
}

function titleCaseFromId(id: string) {
  return id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function exerciseName(id: string, custom?: LibraryExercise) {
  return STRENGTH_EXERCISES[id]?.name ?? custom?.name ?? PROTOTYPE_EXERCISE_NAMES[id] ?? titleCaseFromId(id);
}

function explainExercise(id: string, custom?: LibraryExercise) {
  const ex = STRENGTH_EXERCISES[id];
  if (custom) {
    const muscles = custom.primaryMuscles.length ? ` Main muscles: ${custom.primaryMuscles.join(', ')}.` : '';
    return `${custom.notes || 'Custom exercise added by the user.'}${muscles}`;
  }
  if (PROTOTYPE_EXERCISE_EXPLAIN[id]) return PROTOTYPE_EXERCISE_EXPLAIN[id];
  if (!ex) return 'No logged history yet. Add this exercise to a strength session and complete it to start tracking sets, reps, weight, and RPE.';
  const cue = ex.coachingCues[0] ? ` Main cue: ${ex.coachingCues[0]}.` : '';
  return `${ex.rationale}${cue}`;
}

export default function ActivityLogScreen() {
  const C = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const units = useSettingsStore(s => s.units);
  const workoutHistory = useWorkoutStore(s => s.history);
  const strengthHistory = useStrengthStore(s => s.history);
  const exerciseLibrary = useExerciseStore(s => s.exercises);
  const addExercise = useExerciseStore(s => s.addExercise);
  const [query, setQuery] = useState('');
  const [expandedExerciseId, setExpandedExerciseId] = useState<string | null>(null);
  const [showAddExercise, setShowAddExercise] = useState(false);
  const [newExerciseName, setNewExerciseName] = useState('');
  const [newExerciseNotes, setNewExerciseNotes] = useState('');
  const [newExerciseMuscles, setNewExerciseMuscles] = useState('');
  const [newExercisePhotoUri, setNewExercisePhotoUri] = useState<string | null>(null);

  const exerciseById = useMemo(() => new Map(exerciseLibrary.map(ex => [ex.id, ex])), [exerciseLibrary]);

  const activities = useMemo<ActivityEntry[]>(() => [
    ...workoutHistory.map(record => ({
      kind: 'run' as const,
      id: `run--${record.id}`,
      timestamp: record.timestamp,
      record,
    })),
    ...strengthHistory.map(record => ({
      kind: 'strength' as const,
      id: `strength--${record.id}`,
      timestamp: record.timestamp,
      record,
    })),
  ].sort((a, b) => b.timestamp - a.timestamp), [strengthHistory, workoutHistory]);

  const exerciseRows = useMemo(() => {
    const byExercise = new Map<string, {
      id: string;
      name: string;
      latestDate: number;
      entries: { date: number; sets: string; weight?: string; rpe?: string }[];
    }>();

    strengthHistory.forEach(record => {
      if (record.skipped) return;
      record.exercises.forEach(exercise => {
        const detail = record.exerciseDetails?.find(d => d.exerciseId === exercise.exerciseId);
        const completedSets = exercise.sets.filter(set => set.completed);
        const setsText = completedSets.map(set => `${set.reps} reps`).join(', ') || 'No completed sets';
        const rpes = completedSets.map(set => set.rpe).filter((v): v is number => typeof v === 'number');
        const rpeText = rpes.length ? `RPE ${Math.round(rpes.reduce((s, v) => s + v, 0) / rpes.length)}` : undefined;
        const weightText = detail?.weightLb
          ? units === 'metric'
            ? `${Math.round(detail.weightLb * 0.453592)} kg`
            : `${detail.weightLb} lb`
          : completedSets.find(set => set.load)?.load;
        const row = byExercise.get(exercise.exerciseId) ?? {
          id: exercise.exerciseId,
          name: exerciseName(exercise.exerciseId, exerciseById.get(exercise.exerciseId)),
          latestDate: 0,
          entries: [],
        };
        row.latestDate = Math.max(row.latestDate, record.timestamp);
        row.entries.push({
          date: record.timestamp,
          sets: setsText,
          weight: weightText,
          rpe: rpeText,
        });
        byExercise.set(exercise.exerciseId, row);
      });
    });

    const q = query.trim().toLowerCase();
    const logged = Array.from(byExercise.values())
      .filter(row => row.name.toLowerCase().includes(q))
      .sort((a, b) => b.latestDate - a.latestDate);

    const loggedIds = new Set(logged.map(row => row.id));
    const customRows = exerciseLibrary
      .filter(ex => ex.isCustom)
      .filter(ex => !loggedIds.has(ex.id))
      .filter(ex => q.length === 0 || ex.name.toLowerCase().includes(q) || ex.primaryMuscles.some(m => m.toLowerCase().includes(q)))
      .map(ex => ({ id: ex.id, name: ex.name, latestDate: 0, entries: [] }));

    if (logged.length > 0 || customRows.length > 0 || q.length === 0) return [...logged, ...customRows];

    const builtInRows = Object.values(STRENGTH_EXERCISES)
      .filter(ex => ex.name.toLowerCase().includes(q))
      .map(ex => ({ id: ex.id, name: ex.name, latestDate: 0, entries: [] }));

    const prototypeRows = Object.entries(PROTOTYPE_EXERCISE_NAMES)
      .filter(([, name]) => name.toLowerCase().includes(q))
      .map(([id, name]) => ({ id, name, latestDate: 0, entries: [] }));

    return [...builtInRows, ...prototypeRows];
  }, [exerciseById, exerciseLibrary, query, strengthHistory, units]);

  async function pickExercisePhoto() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Allow photo library access to attach an exercise photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]?.uri) {
      setNewExercisePhotoUri(result.assets[0].uri);
    }
  }

  function saveCustomExercise() {
    const name = newExerciseName.trim();
    if (!name) {
      Alert.alert('Exercise name required', 'Add the exercise name before saving.');
      return;
    }
    const id = addExercise({
      name,
      category: 'lower',
      movementPattern: 'single_leg',
      primaryMuscles: newExerciseMuscles.split(',').map(m => m.trim()).filter(Boolean),
      notes: newExerciseNotes.trim() || undefined,
      photoUri: newExercisePhotoUri ?? undefined,
    });
    setExpandedExerciseId(id);
    setNewExerciseName('');
    setNewExerciseNotes('');
    setNewExerciseMuscles('');
    setNewExercisePhotoUri(null);
    setShowAddExercise(false);
  }

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: C.bg }]} edges={['top']}>
      <View style={[s.header, { paddingTop: Math.max(8, insets.top ? 0 : 8) }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.iconBtn} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={C.text} />
        </TouchableOpacity>
        <View style={s.headerCopy}>
          <Text style={[s.eyebrow, { color: C.textDim }]}>TRAINING</Text>
          <Text style={[s.title, { color: C.text }]}>Activity Log</Text>
        </View>
        <View style={s.iconBtn} />
      </View>

      <ScrollView
        contentContainerStyle={[s.scroll, { paddingBottom: LAYOUT.screenPadBottom }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[s.card, { backgroundColor: C.card, borderColor: C.border }]}>
          <View style={s.sectionHeader}>
            <Text style={[s.sectionLabel, { color: C.textDim }]}>COMPLETED SESSIONS</Text>
            <Text style={[s.count, { color: C.textMuted }]}>{activities.length}</Text>
          </View>
          {activities.length > 0 ? activities.map(entry => (
            <TouchableOpacity
              key={entry.id}
              style={[s.activityRow, { borderBottomColor: C.border }]}
              activeOpacity={0.75}
              onPress={() => router.push({ pathname: '/(tabs)/activity-log/[entryId]', params: { entryId: entry.id } } as any)}
            >
              <View style={[s.activityIcon, { backgroundColor: entry.record.skipped ? C.cardAlt : C.primaryDim }]}>
                <Ionicons
                  name={entry.kind === 'run' ? 'walk-outline' : 'barbell-outline'}
                  size={18}
                  color={entry.record.skipped ? C.textMuted : C.primary}
                />
              </View>
              <View style={s.activityText}>
                <Text style={[s.rowTitle, { color: C.text }]}>
                  {entry.kind === 'run'
                    ? entry.record.skipped ? 'Skipped run' : 'Run workout'
                    : entry.record.skipped ? 'Skipped strength' : strengthName(entry.record)}
                </Text>
                <Text style={[s.rowMeta, { color: C.textMuted }]}>
                  {entry.kind === 'run'
                    ? `${fmtDate(entry.timestamp)} · ${entry.record.actualDurationMinutes ?? entry.record.durationMinutes} min · ${entry.record.actualDistanceMiles ? fmtPace(entry.record.actualDistanceMiles, entry.record.actualDurationMinutes ?? entry.record.durationMinutes) : 'Distance --'}${entry.record.rpe ? ` · RPE ${entry.record.rpe}` : ''}`
                    : `${fmtDate(entry.timestamp)} · ${entry.record.actualDuration ?? entry.record.plannedDuration} min · ${entry.record.exercises.length} exercises${entry.record.overallRpe ? ` · RPE ${entry.record.overallRpe}` : ''}`}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={C.textMuted} />
            </TouchableOpacity>
          )) : (
            <Text style={[s.emptyText, { color: C.textMuted }]}>Completed runs and strength sessions will appear here after you mark them complete.</Text>
          )}
        </View>

        <View style={[s.card, { backgroundColor: C.card, borderColor: C.border }]}>
          <View style={s.sectionHeader}>
            <Text style={[s.sectionLabel, { color: C.textDim, marginBottom: 0 }]}>EXERCISE HISTORY</Text>
            <TouchableOpacity onPress={() => setShowAddExercise(open => !open)} activeOpacity={0.75}>
              <Text style={[s.addLink, { color: C.primary }]}>{showAddExercise ? 'Close' : '+ Add Exercise'}</Text>
            </TouchableOpacity>
          </View>
          {showAddExercise ? (
            <View style={[s.addExerciseBox, { backgroundColor: C.cardAlt, borderColor: C.border }]}>
              <TouchableOpacity style={[s.photoPicker, { borderColor: C.border, backgroundColor: C.card }]} onPress={pickExercisePhoto} activeOpacity={0.75}>
                {newExercisePhotoUri ? (
                  <Image source={{ uri: newExercisePhotoUri }} style={s.exercisePhoto} />
                ) : (
                  <>
                    <Ionicons name="image-outline" size={22} color={C.primary} />
                    <Text style={[s.photoText, { color: C.textMuted }]}>Photo optional</Text>
                  </>
                )}
              </TouchableOpacity>
              <View style={{ flex: 1, gap: 8 }}>
                <TextInput
                  value={newExerciseName}
                  onChangeText={setNewExerciseName}
                  placeholder="Exercise name"
                  placeholderTextColor={C.textMuted}
                  style={[s.addInput, { color: C.text, backgroundColor: C.card, borderColor: C.border }]}
                />
                <TextInput
                  value={newExerciseMuscles}
                  onChangeText={setNewExerciseMuscles}
                  placeholder="Muscles, comma separated"
                  placeholderTextColor={C.textMuted}
                  style={[s.addInput, { color: C.text, backgroundColor: C.card, borderColor: C.border }]}
                />
                <TextInput
                  value={newExerciseNotes}
                  onChangeText={setNewExerciseNotes}
                  placeholder="Description or cues"
                  placeholderTextColor={C.textMuted}
                  multiline
                  style={[s.addInput, s.addTextArea, { color: C.text, backgroundColor: C.card, borderColor: C.border }]}
                />
                <TouchableOpacity style={[s.saveExerciseBtn, { backgroundColor: C.primary }]} onPress={saveCustomExercise} activeOpacity={0.8}>
                  <Text style={[s.saveExerciseText, { color: C.onPrimary }]}>Save Exercise</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}
          <View style={[s.searchBox, { backgroundColor: C.cardAlt, borderColor: C.border }]}>
            <Ionicons name="search-outline" size={17} color={C.textMuted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search exercise"
              placeholderTextColor={C.textMuted}
              style={[s.searchInput, { color: C.text }]}
              autoCapitalize="none"
            />
          </View>

          {exerciseRows.length > 0 ? exerciseRows.map(row => {
            const custom = exerciseById.get(row.id);
            const expanded = expandedExerciseId === row.id;
            return (
              <TouchableOpacity
                key={row.id}
                style={[s.exerciseRow, { borderBottomColor: C.border }]}
                activeOpacity={0.78}
                onPress={() => setExpandedExerciseId(expanded ? null : row.id)}
              >
                <View style={s.exerciseHeaderRow}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[s.rowTitle, { color: C.text }]}>{row.name}</Text>
                    <Text style={[s.rowMeta, { color: C.textMuted }]}>
                      {row.entries.length ? `${row.entries.length} logged entr${row.entries.length === 1 ? 'y' : 'ies'}` : 'No completed sets yet'}
                    </Text>
                  </View>
                  <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={C.textMuted} />
                </View>
                {expanded ? (
                  <View style={[s.exerciseDetailBox, { backgroundColor: C.cardAlt }]}>
                    {custom?.photoUri ? <Image source={{ uri: custom.photoUri }} style={s.expandedPhoto} /> : null}
                    <Text style={[s.exerciseExplain, { color: C.textMuted }]}>{explainExercise(row.id, custom)}</Text>
                    {row.entries.length > 0 ? (
                      <ScrollView style={s.historyScroller} nestedScrollEnabled showsVerticalScrollIndicator>
                        {row.entries.map((entry, index) => (
                          <View key={`${row.id}-${entry.date}-${index}`} style={[s.historyLine, { borderBottomColor: C.border }]}>
                            <Text style={[s.rowMeta, { color: C.text }]}>
                              {fmtDate(entry.date)}
                            </Text>
                            <Text style={[s.rowMeta, { color: C.textMuted }]}>
                              {entry.sets}{entry.weight ? ` · ${entry.weight}` : ''}{entry.rpe ? ` · ${entry.rpe}` : ''}
                            </Text>
                          </View>
                        ))}
                      </ScrollView>
                    ) : (
                      <Text style={[s.rowMeta, { color: C.textMuted }]}>Complete this exercise in a strength session to start tracking sets, reps, weight, and RPE.</Text>
                    )}
                  </View>
                ) : null}
              </TouchableOpacity>
            );
          }) : (
            <Text style={[s.emptyText, { color: C.textMuted }]}>Search for an exercise to see its history, or complete a strength session to start building this log.</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingBottom: 12,
    gap: 8,
  },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1 },
  eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 2 },
  title: { fontSize: 32, fontWeight: '600', fontFamily: 'CormorantGaramond_700Bold' },
  scroll: { paddingHorizontal: 18, paddingTop: 8 },
  card: { borderWidth: 1, borderRadius: 12, padding: 16, marginBottom: 14 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  sectionLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 2, marginBottom: 12 },
  count: { fontSize: 12, fontWeight: '800' },
  addLink: { fontSize: 12, fontWeight: '900' },
  addExerciseBox: { flexDirection: 'row', gap: 12, borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 12 },
  photoPicker: { width: 86, minHeight: 112, borderWidth: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  exercisePhoto: { width: '100%', height: '100%' },
  photoText: { fontSize: 10, fontWeight: '700', marginTop: 4, textAlign: 'center' },
  addInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 9, fontSize: 13, fontWeight: '700' },
  addTextArea: { minHeight: 66, textAlignVertical: 'top' },
  saveExerciseBtn: { borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingVertical: 11 },
  saveExerciseText: { fontSize: 13, fontWeight: '900' },
  activityRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderBottomWidth: 1 },
  activityIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  activityText: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 15, fontWeight: '800' },
  rowMeta: { fontSize: 12, lineHeight: 18, marginTop: 2 },
  emptyText: { fontSize: 13, lineHeight: 20 },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 12 },
  searchInput: { flex: 1, fontSize: 14, padding: 0 },
  exerciseRow: { paddingVertical: 12, borderBottomWidth: 1 },
  exerciseHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  exerciseDetailBox: { borderRadius: 12, padding: 12, marginTop: 10, gap: 8 },
  exerciseExplain: { fontSize: 12, lineHeight: 18, marginTop: 6 },
  expandedPhoto: { width: '100%', height: 150, borderRadius: 10, marginBottom: 4 },
  historyScroller: { maxHeight: 180 },
  historyLine: { paddingVertical: 8, borderBottomWidth: 1 },
});
