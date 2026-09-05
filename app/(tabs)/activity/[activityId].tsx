import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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
import { useSettingsStore } from '../../../src/store/settingsStore';
import { shareCardUnavailableReason, shareReportCard } from '../../../src/lib/shareCard';
import ShareStudio, {
  SHARE_STUDIO_FORMATS,
  SHARE_STUDIO_VARIANTS,
  type ShareStudioFormat,
  type ShareStudioVariant,
} from '../../../src/components/share/ShareStudio';
import { buildActivitySummary } from '../../../src/utils/activitySummary';
import { buildRunSplits } from '../../../src/utils/activitySplits';

export default function ActivityDetailScreen() {
  const C = useColors();
  const router = useRouter();
  const { activityId } = useLocalSearchParams<{ activityId?: string | string[] }>();
  const activities = useActivityStore(state => state.activities);
  const hydrationStatus = useActivityStore(state => state.hydrationStatus);
  const units = useSettingsStore(state => state.units);
  const showDataRichDetails = useExperienceModeAllows('data_rich');
  const [shareVariant, setShareVariant] = useState<ShareStudioVariant>('minimal_card');
  const [shareFormat, setShareFormat] = useState<ShareStudioFormat>('square');
  const [shareMessage, setShareMessage] = useState<string | null>(shareCardUnavailableReason());
  const [shareInteractionActive, setShareInteractionActive] = useState(false);
  const shareCardRef = useRef<View>(null);
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
  const summary = buildActivitySummary(activity, units, { dataRich: showDataRichDetails });
  const runSplits = buildRunSplits(activity, units);

  async function shareActivity() {
    try {
      setShareMessage(null);
      const result = await shareReportCard(shareCardRef, {
        fileName: `strideos-activity-${activity.id}-${shareVariant}`,
        message: `StrideOS ${summary.title}`,
      });
      setShareMessage(result.status === 'shared' ? 'Share PNG created.' : result.reason);
    } catch (error) {
      Alert.alert('Share unavailable', error instanceof Error ? error.message : 'StrideOS could not open the share sheet.');
    }
  }

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: C.bg }]} edges={['top']}>
      <ScreenHeader
        eyebrow="ACTIVITY DETAIL"
        title={displayLabel(activity.activityType)}
        onBack={() => router.back()}
        right={(
          <View style={s.headerActions}>
            <TouchableOpacity
              style={[s.iconButton, { backgroundColor: C.card, borderColor: C.border }]}
              onPress={shareActivity}
              accessibilityLabel="Share activity"
            >
              <Ionicons name="image-outline" size={18} color={C.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.editButton, { backgroundColor: C.card, borderColor: C.border }]}
              onPress={() => router.push({ pathname: '/(tabs)/activity/manual', params: { activityId: activity.id, scheduledSessionId: activity.scheduledSessionId } } as never)}
              accessibilityLabel="Edit activity"
            >
              <Text style={[s.editText, { color: C.primary }]}>Edit</Text>
            </TouchableOpacity>
          </View>
        )}
      />
      <ScrollView contentContainerStyle={s.content} scrollEnabled={!shareInteractionActive}>
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
          {summary.primary.map(({ label, value }) => (
            <View key={label} style={[s.metric, { backgroundColor: C.card, borderColor: C.border }]}>
              <Text style={[s.metricValue, { color: C.text }]}>{value}</Text>
              <Text style={[s.metricLabel, { color: C.textMuted }]}>{label}</Text>
            </View>
          ))}
        </View>
        {runSplits.length ? (
          <View style={[s.card, { backgroundColor: C.card, borderColor: C.border }]}>
            <Text style={[s.eyebrow, { color: C.textDim }]}>RUN SPLITS</Text>
            <View style={s.splitList}>
              {runSplits.map(split => {
                const trendColor = split.trend === 'faster'
                  ? '#9DB2A0'
                  : split.trend === 'slower'
                    ? '#D07063'
                    : C.textMuted;
                return (
                  <View key={`${split.label}-${split.index}`} style={[s.splitRow, { borderColor: C.border }]}>
                    <View>
                      <Text style={[s.splitLabel, { color: C.text }]}>{split.label}</Text>
                      <Text style={[s.splitDistance, { color: C.textMuted }]}>{split.distanceLabel}</Text>
                    </View>
                    <View style={s.splitRight}>
                      <Text style={[s.splitPace, { color: C.text }]}>{split.paceLabel}</Text>
                      <Text style={[s.splitTrend, { color: trendColor }]}>
                        {split.deltaLabel ?? 'Baseline'}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        ) : null}
        <View style={[s.card, { backgroundColor: C.card, borderColor: C.border }]}>
          <Text style={[s.eyebrow, { color: C.textDim }]}>SHARE IMAGE</Text>
          <View style={s.variantGrid}>
            {SHARE_STUDIO_VARIANTS.map(item => {
              const active = shareVariant === item.id;
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[s.variant, { backgroundColor: active ? C.primaryDim : C.cardAlt, borderColor: active ? C.primary : C.border }]}
                  onPress={() => setShareVariant(item.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Text style={[s.variantLabel, { color: C.text }]}>{item.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={s.variantGrid}>
            {SHARE_STUDIO_FORMATS.map(item => {
              const active = shareFormat === item.id;
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[s.variant, { backgroundColor: active ? C.primaryDim : C.cardAlt, borderColor: active ? C.primary : C.border }]}
                  onPress={() => setShareFormat(item.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Text style={[s.variantLabel, { color: C.text }]}>{item.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={s.sharePreview}>
            <ShareStudio
              activity={activity}
              units={units}
              variant={shareVariant}
              format={shareFormat}
              canvasRef={shareCardRef}
              onRoutePrivacyNotice={(message) => Alert.alert('Route sharing', message)}
              onInteractionActiveChange={setShareInteractionActive}
            />
          </View>
          <TouchableOpacity
            style={[s.sharePrimary, { backgroundColor: C.primary }]}
            onPress={shareActivity}
            accessibilityLabel="Create activity share PNG"
          >
            <Ionicons name="image-outline" size={17} color={C.onPrimary} />
            <Text style={[s.sharePrimaryText, { color: C.onPrimary }]}>Create Share PNG</Text>
          </TouchableOpacity>
          {shareMessage ? <Text style={[s.shareMessage, { color: C.textMuted }]}>{shareMessage}</Text> : null}
        </View>
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
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconButton: { width: 40, minHeight: 40, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
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
  bodyValue: { flexShrink: 1, marginLeft: 14, fontSize: 13, lineHeight: 20, textAlign: 'right' },
  variantGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  variant: { width: '31%', minHeight: 74, borderRadius: 12, borderWidth: 1, padding: 10 },
  variantLabel: { fontSize: 12, fontWeight: '900' },
  variantDescription: { fontSize: 10, lineHeight: 14, marginTop: 4 },
  sharePreview: { width: '100%', borderRadius: 18, overflow: 'hidden', marginTop: 4 },
  sharePrimary: { minHeight: 48, borderRadius: 13, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  sharePrimaryText: { fontSize: 14, fontWeight: '900' },
  shareMessage: { fontSize: 12, lineHeight: 17 },
  splitList: { gap: 8 },
  splitRow: { minHeight: 56, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  splitLabel: { fontSize: 14, fontWeight: '900' },
  splitDistance: { fontSize: 11, marginTop: 3, fontWeight: '700' },
  splitRight: { alignItems: 'flex-end' },
  splitPace: { fontSize: 15, fontWeight: '900' },
  splitTrend: { fontSize: 11, marginTop: 3, fontWeight: '900' },
});
