import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Polyline } from '../../../src/components/maps/MapComponents';
import { Ionicons } from '@expo/vector-icons';

import ScreenHeader from '../../../src/components/layout/ScreenHeader';
import { useActivityStore } from '../../../src/store/activityStore';
import { useColors } from '../../../src/theme/useColors';
import { resolveActivityDetail } from '../../../src/utils/activityResolution';
import { displayLabel } from '../../../src/utils/displayLabels';
import { useExperienceModeAllows } from '../../../src/hooks/useExperienceMode';

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
  const { activityId } = useLocalSearchParams<{ activityId?: string | string[] }>();
  const activities = useActivityStore(state => state.activities);
  const hydrationStatus = useActivityStore(state => state.hydrationStatus);
  const showDataRichDetails = useExperienceModeAllows('data_rich');
  const resolution = resolveActivityDetail(activities, activityId, hydrationStatus);
  if (resolution.status === 'loading') return (
    <SafeAreaView style={[s.safe, s.centered, { backgroundColor: C.bg }]}>
      <ActivityIndicator color={C.primary} />
      <Text style={[s.recoveryTitle, { color: C.text }]}>Loading activity</Text>
      <Text style={[s.recoveryBody, { color: C.textMuted }]}>Your activity history is still loading.</Text>
    </SafeAreaView>
  );
  if (resolution.status === 'unavailable') return (
    <SafeAreaView style={[s.safe, { backgroundColor: C.bg }]} edges={['top']}>
      <ScreenHeader title="Activity" eyebrow="ALL TRAINING" onBack={() => router.back()} />
      <View style={s.centered}>
        <View style={[s.recoveryCard, { backgroundColor: C.card, borderColor: C.border }]}>
          <Ionicons name="alert-circle-outline" size={30} color={C.primary} />
          <Text style={[s.recoveryTitle, { color: C.text }]}>Activity unavailable</Text>
          <Text style={[s.recoveryBody, { color: C.textMuted }]}>
            We couldn’t find this activity. It may have been removed or its data may not have finished loading.
          </Text>
          <TouchableOpacity
            style={[s.recoveryPrimary, { backgroundColor: C.primary }]}
            onPress={() => router.replace('/(tabs)/activity' as never)}
          >
            <Text style={[s.recoveryPrimaryText, { color: C.onPrimary }]}>Back to Activity</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.recoverySecondary, { borderColor: C.border }]}
            onPress={() => router.replace('/(tabs)/dashboard' as never)}
          >
            <Text style={[s.recoveryPrimaryText, { color: C.text }]}>Return to Today</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
  const activity = resolution.activity;

  const route = activity.metrics.routeCoordinates ?? [];
  const distanceMiles = (activity.metrics.distanceMeters ?? 0) / 1609.344;
  const isSpeed = activity.activityType === 'cycling'
    || activity.activityType.includes('skiing')
    || activity.activityType === 'snowboarding';
  const metricCards = [
    ['Duration', duration(activity.metrics.durationSeconds)],
    activity.metrics.distanceMeters ? ['Distance', `${distanceMiles.toFixed(2)} mi`] : null,
    isSpeed && activity.metrics.speed?.averageMetersPerSecond
      ? ['Average speed', `${(activity.metrics.speed.averageMetersPerSecond * 2.23694).toFixed(1)} mph`]
      : activity.metrics.pace?.averageSecondsPerKilometer
        ? ['Average pace', pace(activity.metrics.pace.averageSecondsPerKilometer)]
        : null,
    showDataRichDetails && activity.metrics.averageHeartRateBpm ? ['Average HR', `${activity.metrics.averageHeartRateBpm} bpm`] : null,
    showDataRichDetails && activity.metrics.maximumHeartRateBpm ? ['Maximum HR', `${activity.metrics.maximumHeartRateBpm} bpm`] : null,
    activity.metrics.elevationGainMeters ? ['Elevation gain', `${Math.round(activity.metrics.elevationGainMeters * 3.28084)} ft`] : null,
    activity.rpe ? ['RPE', `${activity.rpe}/10`] : null,
    showDataRichDetails ? ['Whole-body load', `${Math.round(activity.trainingLoad.wholeBody)}`] : null,
  ].filter((item): item is string[] => Boolean(item));

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: C.bg }]} edges={['top']}>
      <ScreenHeader
        eyebrow="ACTIVITY DETAIL"
        title={displayLabel(activity.activityType)}
        onBack={() => router.back()}
        right={(
          <TouchableOpacity
            style={[s.editButton, { backgroundColor: C.card, borderColor: C.border }]}
            onPress={() => router.push({ pathname: '/(tabs)/activity/manual', params: { activityId: activity.id, scheduledSessionId: activity.scheduledSessionId } } as never)}
            accessibilityLabel="Edit activity"
          >
            <Text style={[s.editText, { color: C.primary }]}>Edit</Text>
          </TouchableOpacity>
        )}
      />
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
        {showDataRichDetails && activity.metrics.heartRateZoneSeconds ? (
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
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, gap: 10 },
  recoveryCard: { width: '100%', maxWidth: 420, borderWidth: 1, borderRadius: 20, padding: 22, alignItems: 'center' },
  recoveryTitle: { fontSize: 24, fontWeight: '900', marginTop: 8, textAlign: 'center' },
  recoveryBody: { fontSize: 13, lineHeight: 20, textAlign: 'center', marginTop: 6, marginBottom: 18 },
  recoveryPrimary: { width: '100%', minHeight: 48, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  recoverySecondary: { width: '100%', minHeight: 48, borderRadius: 13, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  recoveryPrimaryText: { fontSize: 14, fontWeight: '900' },
  editButton: { minWidth: 64, minHeight: 40, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  editText: { fontSize: 13, fontWeight: '900' },
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
