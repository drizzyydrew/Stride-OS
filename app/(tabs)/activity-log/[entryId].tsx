import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Polyline, type Region } from '../../../src/components/maps/MapComponents';

import { useColors } from '../../../src/theme/useColors';
import { useSettingsStore } from '../../../src/store/settingsStore';
import { useWorkoutStore } from '../../../src/store/workoutStore';
import { useStrengthStore } from '../../../src/store/strengthStore';
import { STRENGTH_EXERCISES } from '../../../src/utils/strengthEngine';
import { LAYOUT } from '../../../src/constants/layout';
import type { CompletedWorkoutRecord } from '../../../src/types/training';
import type { StrengthLogRecord } from '../../../src/types/strength';
import { displayLabel } from '../../../src/utils/displayLabels';

function fmtDate(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, { month: 'long', day: 'numeric', year: 'numeric' })
    .format(new Date(timestamp || Date.now()));
}

function fmtPace(distanceMiles?: number, durationMin?: number) {
  if (!distanceMiles || !durationMin) return '--';
  const secPerMi = (durationMin * 60) / distanceMiles;
  const min = Math.floor(secPerMi / 60);
  const sec = Math.round(secPerMi % 60).toString().padStart(2, '0');
  return `${min}:${sec}/mi`;
}

function runTitle(record: CompletedWorkoutRecord) {
  if (record.skipped) return 'Skipped run';
  return displayLabel(record.type);
}

function strengthTitle(record: StrengthLogRecord) {
  if (record.skipped) return 'Skipped strength';
  if (record.sessionId.includes('prototype-strength-lower')) return 'Lower Body & Core';
  if (record.sessionId.includes('prototype-strength-upper')) return 'Upper Body & Core';
  return displayLabel(record.sessionId.replace(/^strength_/, '')) || 'Strength session';
}

const DARK_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#1a1c15' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8B927C' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#14160F' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2E3127' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#111827' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#22281A' }] },
];

function routeRegion(points: { latitude: number; longitude: number }[]): Region {
  if (points.length === 0) {
    return { latitude: 44.0582, longitude: -121.3153, latitudeDelta: 0.045, longitudeDelta: 0.045 };
  }
  const lats = points.map(p => p.latitude);
  const lngs = points.map(p => p.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max((maxLat - minLat) * 1.6, 0.01),
    longitudeDelta: Math.max((maxLng - minLng) * 1.6, 0.01),
  };
}

function Stat({ label, value }: { label: string; value: string }) {
  const C = useColors();
  return (
    <View style={[s.stat, { backgroundColor: C.cardAlt, borderColor: C.border }]}>
      <Text style={[s.statValue, { color: C.text }]}>{value}</Text>
      <Text style={[s.statLabel, { color: C.textMuted }]}>{label}</Text>
    </View>
  );
}

function RunSummary({ record }: { record: CompletedWorkoutRecord }) {
  const C = useColors();
  const units = useSettingsStore(st => st.units);
  const distanceMiles = record.actualDistanceMiles ?? record.estimatedDistanceMiles;
  const durationMin = record.actualDurationMinutes ?? record.durationMinutes;
  const distance = units === 'metric'
    ? `${(distanceMiles * 1.609344).toFixed(1)} km`
    : `${distanceMiles.toFixed(1)} mi`;

  const routeCoords = (record.routeCoordinates ?? []).map(point => ({ latitude: point.lat, longitude: point.lng }));

  return (
    <>
      {routeCoords.length > 1 ? (
        <View style={[s.mapCard, { borderColor: C.border }]}>
          <MapView
            style={s.map}
            initialRegion={routeRegion(routeCoords)}
            customMapStyle={DARK_MAP_STYLE}
            scrollEnabled={false}
            zoomEnabled={false}
            rotateEnabled={false}
            pitchEnabled={false}
          >
            <Polyline coordinates={routeCoords} strokeColor={C.primary} strokeWidth={5} />
          </MapView>
        </View>
      ) : null}
      <View style={s.statGrid}>
        <Stat label="Duration" value={`${durationMin} min`} />
        <Stat label="Distance" value={distance} />
        <Stat label="Pace" value={fmtPace(distanceMiles, durationMin)} />
        <Stat label="RPE" value={record.rpe ? `${record.rpe}/10` : '--'} />
      </View>
      <View style={[s.card, { backgroundColor: C.card, borderColor: C.border }]}>
        <Text style={[s.sectionLabel, { color: C.textDim }]}>RUN DETAILS</Text>
        <Text style={[s.body, { color: C.textMuted }]}>
          Intensity: {displayLabel(record.intensity)} · Load: {Math.round(record.estimatedLoad)}
        </Text>
        <Text style={[s.body, { color: C.textMuted }]}>
          Heart rate: not saved for this log yet. Future live HealthKit run samples can be shown here when captured with the workout.
        </Text>
        {record.notes ? <Text style={[s.note, { color: C.text }]}>{record.notes}</Text> : null}
      </View>
    </>
  );
}

function StrengthSummary({ record }: { record: StrengthLogRecord }) {
  const C = useColors();
  const units = useSettingsStore(st => st.units);

  return (
    <>
      <View style={s.statGrid}>
        <Stat label="Duration" value={`${record.actualDuration ?? record.plannedDuration} min`} />
        <Stat label="Exercises" value={`${record.exercises.length}`} />
        <Stat label="RPE" value={record.overallRpe ? `${record.overallRpe}/10` : '--'} />
        <Stat label="Load" value={`${Math.round(record.estimatedLoad)}`} />
      </View>
      <View style={[s.card, { backgroundColor: C.card, borderColor: C.border }]}>
        <Text style={[s.sectionLabel, { color: C.textDim }]}>SETS, REPS, WEIGHT, RPE</Text>
        {record.exercises.length > 0 ? record.exercises.map(exercise => {
          const detail = record.exerciseDetails?.find(d => d.exerciseId === exercise.exerciseId);
          const name = STRENGTH_EXERCISES[exercise.exerciseId]?.name ?? displayLabel(exercise.exerciseId);
          const weight = detail?.weightLb
            ? units === 'metric'
              ? `${Math.round(detail.weightLb * 0.453592)} kg`
              : `${detail.weightLb} lb`
            : undefined;
          return (
            <View key={exercise.exerciseId} style={[s.exerciseBlock, { borderBottomColor: C.border }]}>
              <Text style={[s.exerciseTitle, { color: C.text }]}>{name}</Text>
              {exercise.sets.map((set, index) => (
                <Text key={`${exercise.exerciseId}-${index}`} style={[s.body, { color: C.textMuted }]}>
                  Set {index + 1}: {set.completed ? `${set.reps} reps` : 'not completed'}{weight ? ` · ${weight}` : set.load ? ` · ${set.load}` : ''}{set.rpe ? ` · RPE ${set.rpe}` : ''}
                </Text>
              ))}
            </View>
          );
        }) : (
          <Text style={[s.body, { color: C.textMuted }]}>{record.skippedReason ?? 'No completed exercises were saved for this session.'}</Text>
        )}
        {record.notes ? <Text style={[s.note, { color: C.text }]}>{record.notes}</Text> : null}
      </View>
    </>
  );
}

export default function ActivityDetailScreen() {
  const C = useColors();
  const router = useRouter();
  const { entryId } = useLocalSearchParams<{ entryId: string }>();
  const workoutHistory = useWorkoutStore(st => st.history);
  const strengthHistory = useStrengthStore(st => st.history);

  const entry = useMemo(() => {
    const raw = entryId ?? '';
    const [kind, ...rest] = raw.split('--');
    const id = rest.join('--');
    if (kind === 'run') {
      const record = workoutHistory.find(item => item.id === id);
      return record ? { kind, record } as const : null;
    }
    if (kind === 'strength') {
      const record = strengthHistory.find(item => item.id === id);
      return record ? { kind, record } as const : null;
    }
    return null;
  }, [entryId, strengthHistory, workoutHistory]);

  if (!entry) {
    return (
      <SafeAreaView style={[s.safe, { backgroundColor: C.bg }]}>
        <View style={s.center}>
          <Text style={[s.title, { color: C.text }]}>Workout not found</Text>
          <TouchableOpacity onPress={() => router.back()} style={[s.backPill, { backgroundColor: C.cardAlt }]}>
            <Text style={[s.backPillText, { color: C.text }]}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const timestamp = entry.record.timestamp;
  const title = entry.kind === 'run' ? runTitle(entry.record) : strengthTitle(entry.record);

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: C.bg }]} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.iconBtn} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={C.text} />
        </TouchableOpacity>
        <View style={s.headerCopy}>
          <Text style={[s.eyebrow, { color: C.textDim }]}>{entry.kind === 'run' ? 'RUN SUMMARY' : 'STRENGTH SUMMARY'}</Text>
          <Text style={[s.title, { color: C.text }]}>{title}</Text>
          <Text style={[s.subTitle, { color: C.textMuted }]}>{fmtDate(timestamp)}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={[s.scroll, { paddingBottom: LAYOUT.screenPadBottom }]} showsVerticalScrollIndicator={false}>
        {entry.kind === 'run' ? <RunSummary record={entry.record} /> : <StrengthSummary record={entry.record} />}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 18, paddingBottom: 12, gap: 8 },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1, minWidth: 0 },
  eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 2, marginTop: 4 },
  title: { fontSize: 30, fontFamily: 'CormorantGaramond_700Bold' },
  subTitle: { fontSize: 13, marginTop: 2 },
  scroll: { paddingHorizontal: 18, paddingTop: 8 },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  stat: { width: '47%', borderWidth: 1, borderRadius: 12, padding: 14, minHeight: 82, justifyContent: 'center' },
  statValue: { fontSize: 21, fontWeight: '900' },
  statLabel: { fontSize: 12, marginTop: 4 },
  card: { borderWidth: 1, borderRadius: 12, padding: 16, marginBottom: 14 },
  mapCard: { borderWidth: 1, borderRadius: 12, overflow: 'hidden', marginBottom: 14 },
  map: { height: 190, width: '100%' },
  sectionLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 2, marginBottom: 12 },
  body: { fontSize: 13, lineHeight: 20 },
  note: { fontSize: 13, lineHeight: 20, marginTop: 12, fontWeight: '700' },
  exerciseBlock: { paddingVertical: 12, borderBottomWidth: 1 },
  exerciseTitle: { fontSize: 15, fontWeight: '900', marginBottom: 4 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  backPill: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10, marginTop: 16 },
  backPillText: { fontSize: 14, fontWeight: '800' },
});
