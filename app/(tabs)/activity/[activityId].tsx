import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useIsFocused, useRoute, useRouter } from 'expo-router';
import SafeAreaView from '../../../src/components/layout/PageSafeAreaView';
import { Ionicons } from '@expo/vector-icons';

import ScreenHeader from '../../../src/components/layout/ScreenHeader';
import { useActivityStore } from '../../../src/store/activityStore';
import { useColors } from '../../../src/theme/useColors';
import { resolveActivityDetail } from '../../../src/utils/activityResolution';
import { displayLabel } from '../../../src/utils/displayLabels';
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
import ActivityRouteReview from '../../../src/components/activity/ActivityRouteReview';
import ActivityPowerPanel from '../../../src/components/activity/ActivityPowerPanel';
import ShareOptionGrid from '../../../src/components/share/ShareOptionGrid';
import { analyzeSnowSegments, buildOutdoorSplits } from '../../../src/utils/outdoorAnalysis';
import { formatDistance } from '../../../src/lib/units';
import { recoverSavedActivity } from '../../../src/lib/savedActivityRecovery';
import HealthWorkoutRecovery from '../../../src/components/activity/HealthWorkoutRecovery';
import HealthDistanceRefresh from '../../../src/components/activity/HealthDistanceRefresh';
import { buildHealthDistanceSplits } from '../../../src/utils/healthDistanceSplits';
import { supportsHealthSplitRefresh } from '../../../src/utils/healthDistanceRefresh';

export default function ActivityDetailScreen() {
  const C = useColors();
  const router = useRouter();
  const focused = useIsFocused();
  const focusSession = useMemo(() => ({ active: focused }), [focused]);
  useLayoutEffect(() => () => { focusSession.active = false; }, [focusSession]);
  // IDs already contain encoded recording lineage; do not URI-decode them again.
  const { activityId } = (useRoute().params ?? {}) as { activityId?: string | string[] };
  const activities = useActivityStore(state => state.activities);
  const hydrationStatus = useActivityStore(state => state.hydrationStatus);
  const units = useSettingsStore(state => state.units);
  const [shareVariant, setShareVariant] = useState<ShareStudioVariant>('minimal_card');
  const [shareFormat, setShareFormat] = useState<ShareStudioFormat>('square');
  const [shareMessage, setShareMessage] = useState<string | null>(shareCardUnavailableReason());
  const [shareInteractionActive, setShareInteractionActive] = useState(false);
  const shareCardRef = useRef<View>(null);
  const [recovering, setRecovering] = useState(false);
  const [recoveryMessage, setRecoveryMessage] = useState<string | null>(null);
  const [healthRecoveryOpen, setHealthRecoveryOpen] = useState(false);
  const [healthRecoveryUnconfirmed, setHealthRecoveryUnconfirmed] = useState(false);
  const recoveryRequest = useRef(0);
  const recoveryInFlight = useRef(false);
  const requestedId = (Array.isArray(activityId) ? activityId[0] : activityId)?.trim();
  const latestRequestedId = useRef(requestedId);
  useLayoutEffect(() => { latestRequestedId.current = requestedId; }, [requestedId]);
  const healthRequestIsCurrent = () => focusSession.active && latestRequestedId.current === requestedId;
  useEffect(() => {
    recoveryRequest.current += 1;
    recoveryInFlight.current = false;
    setRecovering(false);
    setRecoveryMessage(null);
    setHealthRecoveryOpen(false);
    setHealthRecoveryUnconfirmed(false);
    return () => { recoveryRequest.current += 1; };
  }, [requestedId]);
  async function retrySavedActivity() {
    if (recoveryInFlight.current) return;
    recoveryInFlight.current = true;
    const request = ++recoveryRequest.current;
    setRecovering(true);
    setRecoveryMessage(null);
    try {
      const recoveredId = await recoverSavedActivity(requestedId);
      if (request !== recoveryRequest.current) return;
      if (recoveredId) {
        setHealthRecoveryOpen(false);
        setHealthRecoveryUnconfirmed(false);
        router.replace({ pathname: '/(tabs)/activity/[activityId]', params: { activityId: recoveredId } } as never);
      }
      else setRecoveryMessage('No exact saved run was found for this link. Your other activities have not been changed. Use Find workout in Apple Health below to select the original workout.');
    } catch (error) {
      if (request === recoveryRequest.current) setRecoveryMessage(error instanceof Error ? error.message : 'Recovery could not finish. Your saved history has not been cleared.');
    } finally {
      if (request === recoveryRequest.current) { recoveryInFlight.current = false; setRecovering(false); }
    }
  }
  function confirmRestore() {
    const request = recoveryRequest.current;
    Alert.alert('Restore saved recording?', 'This restores the exact run saved on this phone, including an entry previously removed from Activity. It does not start a new recording or change other activities.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Restore', onPress: () => { if (request === recoveryRequest.current) void retrySavedActivity(); } },
    ]);
  }
  const resolution = resolveActivityDetail(activities, activityId, hydrationStatus);
  if (resolution.status !== 'resolved' || healthRecoveryOpen || healthRecoveryUnconfirmed) return (
    <SafeAreaView style={[s.safe, { backgroundColor: C.bg }]} edges={['top']}>
      <ScreenHeader title="Activity" eyebrow="ALL TRAINING" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={s.recoveryContent}>
        <View style={[s.recoveryCard, { backgroundColor: C.card, borderColor: C.border }]}>
          {resolution.status === 'loading' ? <ActivityIndicator color={C.primary} /> : <Ionicons name="alert-circle-outline" size={30} color={C.primary} />}
          <Text style={[s.recoveryTitle, { color: C.text }]}>{resolution.status === 'loading' ? 'Loading activity' : hydrationStatus === 'error' ? 'Activity history not loaded' : resolution.status === 'resolved' ? 'Confirming recovery' : 'Activity unavailable'}</Text>
          <Text style={[s.recoveryBody, { color: C.textMuted }]}>
            {resolution.status === 'loading' ? 'Your saved activity history is still loading.'
              : hydrationStatus === 'error' ? 'Your saved history could not be read. This does not mean the recording was deleted.'
                : resolution.status === 'resolved' ? 'The selected workout must finish saving before it can be opened.'
                  : 'This activity link could not be resolved. Look for a local recording or select the original workout in Apple Health.'}
          </Text>
          {resolution.status !== 'loading' ? (
            <TouchableOpacity style={[s.recoveryPrimary, { backgroundColor: C.primary }]} onPress={confirmRestore}
              disabled={recovering} accessibilityRole="button" accessibilityLabel="Restore saved recording" accessibilityState={{ busy: recovering, disabled: recovering }}>
              {recovering ? <ActivityIndicator color={C.onPrimary} /> : <Text style={[s.recoveryPrimaryText, { color: C.onPrimary }]}>Restore from this phone</Text>}
            </TouchableOpacity>
          ) : null}
          {recoveryMessage ? <Text accessibilityLiveRegion="polite" style={[s.recoveryBody, { color: C.textMuted }]}>{recoveryMessage}</Text> : null}
          {resolution.status !== 'loading' ? <HealthWorkoutRecovery key={`${requestedId}:${focused}`} disabled={recovering}
            isCurrent={healthRequestIsCurrent}
            onOpenChange={open => { if (healthRequestIsCurrent()) setHealthRecoveryOpen(open); }}
            onSavePending={() => {
              if (!healthRequestIsCurrent()) return;
              setHealthRecoveryUnconfirmed(true);
              setRecoveryMessage('The selected Health workout is not yet confirmed saved. If recovery is closed, reopen it and retry the same workout.');
            }}
            onFailure={message => { if (healthRequestIsCurrent()) setRecoveryMessage(message); }}
            onRecovered={id => {
              if (!healthRequestIsCurrent()) return;
              setHealthRecoveryUnconfirmed(false);
              setHealthRecoveryOpen(false);
              setRecoveryMessage(null);
              router.replace({ pathname: '/(tabs)/activity/[activityId]', params: { activityId: id } } as never);
            }} /> : null}
          <TouchableOpacity
            style={[s.recoverySecondary, { borderColor: C.border }]}
            onPress={() => router.replace('/(tabs)/activity' as never)}
          >
            <Text style={[s.recoveryPrimaryText, { color: C.text }]}>Back to Activity</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.recoverySecondary, { borderColor: C.border }]}
            onPress={() => router.replace('/(tabs)/dashboard' as never)}
          >
            <Text style={[s.recoveryPrimaryText, { color: C.text }]}>Return to Today</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
  const activity = resolution.activity;

  const summary = buildActivitySummary(activity, units, { dataRich: true });
  const healthSplits = buildHealthDistanceSplits(activity, units);
  const outdoorSplits = healthSplits ? healthSplits.splits : buildOutdoorSplits(activity, units);
  const runSplits = outdoorSplits.length ? outdoorSplits.map(split => ({
    index: split.index, label: `${units === 'metric' ? 'Km' : 'Mile'} ${split.index}${split.complete ? '' : ' (partial)'}`,
    distanceLabel: formatDistance(split.distanceMeters / 1609.344, units), paceLabel: split.paceLabel,
    trend: 'even' as const, deltaLabel: split.averageHeartRateBpm == null ? 'HR unavailable' : `${split.averageHeartRateBpm} bpm`,
  })) : healthSplits ? [] : buildRunSplits(activity, units);
  const snowSegments = analyzeSnowSegments(activity);
  const descents = snowSegments.filter(segment => segment.kind === 'descent');

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
        {recovering || recoveryMessage ? (
          <View style={s.recoveryStatus} accessibilityLiveRegion="polite">
            {recovering ? <>
              <ActivityIndicator color={C.primary} />
              <Text style={[s.body, { color: C.textMuted }]}>Restoring saved recording. Waiting for save confirmation.</Text>
            </> : <>
              <Text style={[s.body, { color: C.textMuted }]}>{recoveryMessage}</Text>
              <TouchableOpacity style={[s.recoverySecondary, { borderColor: C.border }]} onPress={confirmRestore}
                accessibilityRole="button" accessibilityLabel="Restore saved recording">
                <Text style={[s.recoveryPrimaryText, { color: C.text }]}>Retry saving recovered recording</Text>
              </TouchableOpacity>
            </>}
          </View>
        ) : null}
        <ActivityRouteReview activity={activity} units={units} onInteractionActiveChange={setShareInteractionActive} />
        <View style={s.grid}>
          {summary.primary.map(({ label, value }) => (
            <View key={label} style={[s.metric, { backgroundColor: C.card, borderColor: C.border }]}>
              <Text style={[s.metricValue, { color: C.text }]}>{value}</Text>
              <Text style={[s.metricLabel, { color: C.textMuted }]}>{label}</Text>
            </View>
          ))}
        </View>
        {supportsHealthSplitRefresh(activity)
          ? <HealthDistanceRefresh key={`${activity.id}:${focused}`} activityId={activity.id} linked={Boolean(activity.healthKit)} isCurrent={healthRequestIsCurrent} /> : null}
        {runSplits.length || healthSplits ? (
          <View style={[s.card, { backgroundColor: C.card, borderColor: C.border }]}>
            <Text style={[s.eyebrow, { color: C.textDim }]}>DISTANCE SPLITS</Text>
            {healthSplits ? <Text style={[s.body, { color: C.textMuted }]}>{healthSplits.status === 'complete'
              ? 'Health distance-derived · approximate split boundaries'
              : healthSplits.reason ?? 'Health distance coverage is incomplete. Split paces are unavailable.'}</Text> : null}
            {healthSplits && activity.metrics.healthKitDistance?.totalDistanceMeters != null ? <Text style={[s.body, { color: C.textMuted }]}>
              Original Health distance: {formatDistance(activity.metrics.healthKitDistance.totalDistanceMeters / 1609.344, units)}
            </Text> : null}
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
        {summary.sections.map(section => <View key={section.title} style={{ paddingVertical: 14, gap: 10 }}>
          <Text style={[s.eyebrow, { color: C.textDim }]}>{section.title.toUpperCase()}</Text>
          {section.metrics.map(metric => <View key={metric.label} style={s.zoneRow}>
            <Text style={[s.body, { color: C.textMuted }]}>{metric.label}</Text>
            <Text style={[s.bodyValue, { color: C.text }]}>{metric.value}</Text>
          </View>)}
        </View>)}
        {snowSegments.length ? <View style={{ paddingVertical: 16, gap: 10 }}>
          <Text style={[s.eyebrow, { color: C.textDim }]}>ESTIMATED TERRAIN SEGMENTS</Text>
          <Text style={[s.body, { color: C.text }]}>{descents.length} descents · {snowSegments.length - descents.length} ascents</Text>
          <Text style={[s.body, { color: C.textMuted }]}>GPS/elevation classification, not confirmed lift or human-powered climbing. Short/noisy segments and recording gaps are excluded.</Text>
          {descents.length ? <Text style={[s.body, { color: C.text }]}>Longest descent {formatDistance(Math.max(...descents.map(segment => segment.distanceMeters)) / 1609.344, units)} · Largest vertical descent {Math.round(Math.max(...descents.map(segment => segment.elevationMeters)) * (units === 'metric' ? 1 : 3.28084))} {units === 'metric' ? 'm' : 'ft'}</Text> : null}
          {snowSegments.map((segment, index) => <View key={segment.id} style={s.zoneRow}>
            <Text style={[s.body, { color: C.textMuted }]}>{index + 1}. {segment.kind === 'descent' ? 'Descent' : 'Ascent'}</Text>
            <Text style={[s.bodyValue, { color: C.text }]}>{formatDistance(segment.distanceMeters / 1609.344, units)} · {Math.round(segment.elevationMeters * (units === 'metric' ? 1 : 3.28084))} {units === 'metric' ? 'm' : 'ft'}</Text>
          </View>)}
        </View> : null}
        <ActivityPowerPanel key={activity.id} activity={activity} units={units} />
        <View style={[s.card, { backgroundColor: C.card, borderColor: C.border }]}>
          <Text style={[s.eyebrow, { color: C.textDim }]}>SHARE IMAGE</Text>
          <ShareOptionGrid options={SHARE_STUDIO_VARIANTS} value={shareVariant} onChange={setShareVariant} />
          <ShareOptionGrid options={SHARE_STUDIO_FORMATS} value={shareFormat} onChange={setShareFormat} />
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
  recoveryContent: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 24, paddingBottom: 40 },
  recoveryStatus: { gap: 10, paddingVertical: 16 },
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
  body: { fontSize: 13, lineHeight: 20, flexShrink: 1 },
  bodyValue: { flexShrink: 1, marginLeft: 14, fontSize: 13, lineHeight: 20, textAlign: 'right' },
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
