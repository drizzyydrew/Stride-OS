import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Polyline } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';

import { useActivityStore } from '../../../src/store/activityStore';
import { useColors } from '../../../src/theme/useColors';

function duration(seconds?: number): string {
  const total = Math.round(seconds ?? 0);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

function pace(secondsPerKm?: number): string {
  if (!secondsPerKm) return '--';
  const secondsPerMile = secondsPerKm * 1.609344;
  return `${Math.floor(secondsPerMile / 60)}:${String(Math.round(secondsPerMile % 60)).padStart(2, '0')}/mi`;
}

export default function ActivityDetailScreen() {
  const C = useColors();
  const router = useRouter();
  const { activityId } = useLocalSearchParams<{ activityId: string }>();
  const activity = useActivityStore(state => state.activities.find(item => item.id === activityId));
  if (!activity) return (
    <SafeAreaView style={[s.safe, { backgroundColor: C.bg }]}>
      <Text style={[s.title, { color: C.text }]}>Activity not found</Text>
    </SafeAreaView>
  );

  const route = activity.metrics.routeCoordinates ?? [];
  const distanceMiles = (activity.metrics.distanceMeters ?? 0) / 1609.344;
  const isSpeed = activity.activityType === 'cycling' || activity.activityType.includes('skiing');
  const metricCards = [
    ['Duration', duration(activity.metrics.durationSeconds)],
    activity.metrics.distanceMeters ? ['Distance', `${distanceMiles.toFixed(2)} mi`] : null,
    isSpeed && activity.metrics.speed?.averageMetersPerSecond
      ? ['Average speed', `${(activity.metrics.speed.averageMetersPerSecond * 2.23694).toFixed(1)} mph`]
      : activity.metrics.pace?.averageSecondsPerKilometer
        ? ['Average pace', pace(activity.metrics.pace.averageSecondsPerKilometer)]
        : null,
    activity.metrics.averageHeartRateBpm ? ['Average HR', `${activity.metrics.averageHeartRateBpm} bpm`] : null,
    activity.metrics.maximumHeartRateBpm ? ['Maximum HR', `${activity.metrics.maximumHeartRateBpm} bpm`] : null,
    activity.metrics.elevationGainMeters ? ['Elevation gain', `${Math.round(activity.metrics.elevationGainMeters * 3.28084)} ft`] : null,
    activity.rpe ? ['RPE', `${activity.rpe}/10`] : null,
    ['Whole-body load', `${Math.round(activity.trainingLoad.wholeBody)}`],
  ].filter((item): item is string[] => Boolean(item));

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: C.bg }]} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.iconButton}>
          <Ionicons name="chevron-back" size={24} color={C.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[s.eyebrow, { color: C.textDim }]}>ACTIVITY DETAIL</Text>
          <Text style={[s.title, { color: C.text }]}>
            {activity.activityType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
          </Text>
        </View>
      </View>
      <ScrollView contentContainerStyle={s.content}>
        {route.length > 1 ? (
          <View style={[s.mapCard, { borderColor: C.border }]}>
            <MapView
              style={s.map}
              initialRegion={{
                latitude: route[0].latitude,
                longitude: route[0].longitude,
                latitudeDelta: 0.04,
                longitudeDelta: 0.04,
              }}
              scrollEnabled={false}
              zoomEnabled={false}
            >
              <Polyline coordinates={route} strokeColor={C.primary} strokeWidth={5} />
            </MapView>
          </View>
        ) : null}
        <View style={s.grid}>
          {metricCards.map(([label, value]) => (
            <View key={label} style={[s.metric, { backgroundColor: C.card, borderColor: C.border }]}>
              <Text style={[s.metricValue, { color: C.text }]}>{value}</Text>
              <Text style={[s.metricLabel, { color: C.textMuted }]}>{label}</Text>
            </View>
          ))}
        </View>
        {activity.metrics.heartRateZoneSeconds ? (
          <View style={[s.card, { backgroundColor: C.card, borderColor: C.border }]}>
            <Text style={[s.eyebrow, { color: C.textDim }]}>HEART-RATE ZONES</Text>
            {Object.entries(activity.metrics.heartRateZoneSeconds).map(([zone, seconds]) => (
              <View key={zone} style={s.zoneRow}>
                <Text style={[s.body, { color: C.text }]}>Zone {zone}</Text>
                <Text style={[s.body, { color: C.textMuted }]}>{Math.round((seconds ?? 0) / 60)} min</Text>
              </View>
            ))}
          </View>
        ) : null}
        {activity.notes || activity.symptoms?.length ? (
          <View style={[s.card, { backgroundColor: C.card, borderColor: C.border }]}>
            <Text style={[s.eyebrow, { color: C.textDim }]}>NOTES</Text>
            {activity.notes ? <Text style={[s.body, { color: C.text }]}>{activity.notes}</Text> : null}
            {activity.symptoms?.length ? <Text style={[s.body, { color: C.textMuted }]}>Athlete-reported: {activity.symptoms.join(', ')}</Text> : null}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingBottom: 10 },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  title: { fontSize: 30, fontFamily: 'CormorantGaramond_700Bold' },
  content: { paddingHorizontal: 18, paddingBottom: 100 },
  mapCard: { height: 220, borderWidth: 1, borderRadius: 18, overflow: 'hidden', marginBottom: 14 },
  map: { flex: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  metric: { width: '48%', minHeight: 86, borderWidth: 1, borderRadius: 15, padding: 14, justifyContent: 'center' },
  metricValue: { fontSize: 21, fontWeight: '900' },
  metricLabel: { fontSize: 11, marginTop: 5 },
  card: { borderWidth: 1, borderRadius: 16, padding: 16, marginBottom: 12, gap: 10 },
  zoneRow: { flexDirection: 'row', justifyContent: 'space-between' },
  body: { fontSize: 13, lineHeight: 20 },
});
