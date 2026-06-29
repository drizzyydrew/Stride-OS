import { useMemo, useState } from 'react';
import {
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

import { useColors } from '../../../src/theme/useColors';
import { useSettingsStore } from '../../../src/store/settingsStore';
import { useWorkoutStore } from '../../../src/store/workoutStore';
import { useStrengthStore } from '../../../src/store/strengthStore';
import { STRENGTH_EXERCISES } from '../../../src/utils/strengthEngine';
import { LAYOUT } from '../../../src/constants/layout';
import type { CompletedWorkoutRecord } from '../../../src/types/training';
import type { StrengthLogRecord } from '../../../src/types/strength';

type ActivityEntry =
  | { kind: 'run'; id: string; timestamp: number; record: CompletedWorkoutRecord }
  | { kind: 'strength'; id: string; timestamp: number; record: StrengthLogRecord };

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

function exerciseName(id: string) {
  return STRENGTH_EXERCISES[id]?.name ?? id.replace(/_/g, ' ');
}

function explainExercise(id: string) {
  const ex = STRENGTH_EXERCISES[id];
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
  const [query, setQuery] = useState('');

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
          name: exerciseName(exercise.exerciseId),
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

    if (logged.length > 0 || q.length === 0) return logged;

    return Object.values(STRENGTH_EXERCISES)
      .filter(ex => ex.name.toLowerCase().includes(q))
      .map(ex => ({ id: ex.id, name: ex.name, latestDate: 0, entries: [] }));
  }, [query, strengthHistory, units]);

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
          <Text style={[s.sectionLabel, { color: C.textDim }]}>EXERCISE HISTORY</Text>
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

          {exerciseRows.length > 0 ? exerciseRows.map(row => (
            <View key={row.id} style={[s.exerciseRow, { borderBottomColor: C.border }]}>
              <Text style={[s.rowTitle, { color: C.text }]}>{row.name}</Text>
              {row.entries.length > 0 ? (
                row.entries.slice(0, 3).map((entry, index) => (
                  <Text key={`${row.id}-${entry.date}-${index}`} style={[s.rowMeta, { color: C.textMuted }]}>
                    {fmtDate(entry.date)} · {entry.sets}{entry.weight ? ` · ${entry.weight}` : ''}{entry.rpe ? ` · ${entry.rpe}` : ''}
                  </Text>
                ))
              ) : (
                <>
                  <Text style={[s.rowMeta, { color: C.textMuted }]}>You have not completed this exercise yet.</Text>
                  <Text style={[s.exerciseExplain, { color: C.textMuted }]}>{explainExercise(row.id)}</Text>
                </>
              )}
            </View>
          )) : (
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
  activityRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderBottomWidth: 1 },
  activityIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  activityText: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 15, fontWeight: '800' },
  rowMeta: { fontSize: 12, lineHeight: 18, marginTop: 2 },
  emptyText: { fontSize: 13, lineHeight: 20 },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 12 },
  searchInput: { flex: 1, fontSize: 14, padding: 0 },
  exerciseRow: { paddingVertical: 12, borderBottomWidth: 1 },
  exerciseExplain: { fontSize: 12, lineHeight: 18, marginTop: 6 },
});
