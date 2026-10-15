import GpsSignalChip from '../../../src/components/activity/GpsSignalChip';
import ActiveOutdoorSession, { type OutdoorSessionMetric } from '../../../src/components/activity/ActiveOutdoorSession';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import SafeAreaView from '../../../src/components/layout/PageSafeAreaView';
import { Ionicons } from '@expo/vector-icons';

import ScreenHeader from '../../../src/components/layout/ScreenHeader';
import {
  activeOutdoorElapsedSeconds,
  useActiveActivityStore,
  type ActiveOutdoorType,
} from '../../../src/store/activeActivityStore';
import { effectiveAttachedRoute, useRouteStore } from '../../../src/store/routeStore';
import { useColors } from '../../../src/theme/useColors';
import { startActivityLocationTracking } from '../../../src/lib/activityGpsTracking';
import {
  startOutdoorLiveActivity,
  updateOutdoorLiveActivity,
} from '../../../src/lib/runLiveActivity';
import { buildRouteGuidance } from '../../../src/lib/routing';
import { formatTurnAnnouncement, guidanceAlertCue, guidanceDisplayText, INITIAL_GUIDANCE_ALERT_STATE, isSilentGuidanceInstruction, turnAnnouncementPhase, updateRouteGuidanceProgress, type GuidanceAlertState, type RouteGuidancePlan, type RouteGuidanceProgress } from '../../../src/lib/routeGuidance';
import { enqueueVoiceCue } from '../../../src/lib/voiceCue';
import { evaluateRunWalkCue, intervalAtElapsed } from '../../../src/utils/activityTracking';
import { OUTDOOR_SPORTS } from '../../../src/utils/outdoorSports';
import { selectLiveTelemetry } from '../../../src/utils/outdoorTelemetry';
import { completeOutdoorCommand } from '../../../src/lib/outdoorCompletion';
import { captureOwnerLease, ownerLeaseIsCurrent } from '../../../src/lib/localDataOwner';
import { requestLocationRecovery } from '../../../src/lib/locationPermissionRecovery';
import { useActiveProfile } from '../../../src/store/profileStore';
import { liveCyclingPower } from '../../../src/utils/liveCyclingPower';
import { CYCLING_POWER_ASSUMPTIONS } from '../../../src/utils/outdoorPower';
import { useSettingsStore } from '../../../src/store/settingsStore';
import {
  activeSessionStoresHydrated,
  discardActiveSession,
  getConflictingActiveSession,
  isActiveSessionStale,
} from '../../../src/lib/activeSessionCoordinator';
import {
  addStrideWatchStatusListener,
  getStrideWatchStatus,
  pauseStrideWatchWorkout,
  resumeStrideWatchWorkout,
  setStrideWatchWorkoutContext,
  startStrideWatchWorkout,
} from '../../../modules/stride-watch-connectivity/src';

const TYPES: { type: ActiveOutdoorType; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { type: 'running', label: 'Run', icon: 'walk-outline' },
  { type: 'walking', label: 'Walk', icon: 'footsteps-outline' },
  { type: 'cycling', label: 'Cycle', icon: 'bicycle-outline' },
  { type: 'hiking', label: 'Hike', icon: 'trail-sign-outline' },
  { type: 'downhill_skiing', label: 'Downhill Ski', icon: 'snow-outline' },
  { type: 'cross_country_skiing', label: 'XC Ski', icon: 'snow-outline' },
  { type: 'snowboarding', label: 'Snowboard', icon: 'snow-outline' },
  { type: 'ski_touring', label: 'Ski Touring', icon: 'snow-outline' },
  { type: 'snowboard_touring', label: 'Snowboard Touring', icon: 'snow-outline' },
];

function time(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function supportsRunWalk(type: ActiveOutdoorType): boolean {
  return type === 'running' || type === 'walking';
}

export default function StartOutdoorActivityScreen() {
  const C = useColors();
  const router = useRouter();
  const params = useLocalSearchParams<{
    scheduledSessionId?: string;
    activityType?: string;
    associatedTrainingBlockId?: string;
    associatedGoalId?: string;
  }>();
  const units = useSettingsStore(state => state.units);
  const active = useActiveActivityStore();
  const profile = useActiveProfile();
  const [confirmedCyclingMass, setConfirmedCyclingMass] = useState<{ id: string; massKg: number } | null>(null);
  const routes = useRouteStore(state => state.routes);
  const attachment = useRouteStore(state => state.routeAttachment);
  const attached = effectiveAttachedRoute(routes.find(route => route.id === attachment.routeId) ?? null, attachment);
  const paramActivityType = TYPES.find(item => item.type === params.activityType)?.type;
  const [selectedType, setSelectedType] = useState<ActiveOutdoorType>(paramActivityType ?? 'walking');
  const [runWalk, setRunWalk] = useState(false);
  const compatibleRunWalk = runWalk && supportsRunWalk(selectedType);
  const launchName = compatibleRunWalk ? 'Run / Walk' : TYPES.find(item => item.type === selectedType)?.label ?? 'Activity';
  const [navigationMode, setNavigationMode] = useState<'off' | 'walking' | 'cycling'>('off');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [outdoorWatchStatus, setOutdoorWatchStatus] = useState(getStrideWatchStatus);
  const telemetry = selectLiveTelemetry({
    rawHeartRateSamples: active.lastHeartRateSample && !active.isPaused ? [active.lastHeartRateSample] : [],
    cadenceSamples: active.lastCadenceSample && !active.isPaused ? [active.lastCadenceSample] : [],
    powerSamples: active.lastPowerSample && !active.isPaused ? [active.lastPowerSample] : [],
  }, active.startedAt ?? Date.now(), Date.now());
  const { heartRateBpm, heartRateSample, cadenceSample, powerSample } = telemetry;
  const modeledPower = !powerSample && confirmedCyclingMass?.id === active.workoutInstanceId
    ? liveCyclingPower({ activityType: active.activityType, isPaused: active.isPaused,
      points: active.aggregate.points, recordingPauses: active.recordingPauses,
      bodyMassKg: confirmedCyclingMass.massKg, bikeMassKg: 10, now: Date.now() }) : null;
  const shownPower = powerSample ?? modeledPower;
  const [guidance, setGuidance] = useState<RouteGuidancePlan | null>(null);
  const previousElapsed = useRef(0);
  const guidanceAlert = useRef<GuidanceAlertState>(INITIAL_GUIDANCE_ALERT_STATE);
  const lastAnnouncedStep = useRef<string | null>(null);
  const previousGuidanceProgress = useRef<RouteGuidanceProgress | null>(null);
  const saveInFlightRef = useRef(false);
  const beginInFlightRef = useRef(false);

  const activeSeconds = activeOutdoorElapsedSeconds(active);
  const miles = active.aggregate.distanceMeters / 1609.344;
  const secPerMile = Number.isFinite(active.aggregate.averageMetersPerSecond) && active.aggregate.averageMetersPerSecond > 0
    ? Math.round(1609.344 / active.aggregate.averageMetersPerSecond) : 0;
  const speedBased = OUTDOOR_SPORTS[active.activityType].speedBased;
  const intervals = useMemo(() => compatibleRunWalk
    ? Array.from({ length: 12 }, (_, index) => ({ kind: index % 2 === 0 ? 'run' as const : 'walk' as const, durationSeconds: index % 2 === 0 ? 60 : 90 }))
    : [], [compatibleRunWalk]);

  function selectSport(type: ActiveOutdoorType) {
    setSelectedType(type);
    if (!supportsRunWalk(type)) setRunWalk(false);
  }

  useEffect(() => {
    if (!active.isActive) return;
    setOutdoorWatchStatus(getStrideWatchStatus());
    const subscription = addStrideWatchStatusListener(setOutdoorWatchStatus);
    return () => subscription?.remove();
  }, [active.isActive]);

  useEffect(() => {
    if (!active.isActive || active.isPaused || !active.startedAt) return;
    const timer = setInterval(() => setElapsedSeconds(
      activeOutdoorElapsedSeconds(useActiveActivityStore.getState()),
    ), 1000);
    return () => clearInterval(timer);
  }, [active.isActive, active.isPaused, active.pausedDurationMs, active.startedAt]);

  useEffect(() => {
    if (!active.isActive || !active.intervalPromptsEnabled || active.runWalkIntervals.length === 0) return;
    const cue = evaluateRunWalkCue({
      intervals: active.runWalkIntervals,
      elapsedSeconds,
      previousElapsedSeconds: previousElapsed.current,
    });
    previousElapsed.current = elapsedSeconds;
    if (cue) enqueueVoiceCue(cue.text, 'runWalk');
  }, [active.intervalPromptsEnabled, active.isActive, active.runWalkIntervals, elapsedSeconds]);

  useEffect(() => {
    if (!active.isActive || !active.navigationPromptsEnabled || !guidance || !active.aggregate.points.length) return;
    const point = active.aggregate.points.at(-1)!;
    const progress = updateRouteGuidanceProgress({ point, plan: guidance, previous: previousGuidanceProgress.current });
    previousGuidanceProgress.current = progress;
    const turnText = progress.nextInstruction && progress.distanceToNextStepMeters != null
      ? formatTurnAnnouncement(progress.nextInstruction, progress.distanceToNextStepMeters)
      : progress.nextInstruction;
    active.setNextInstruction(guidanceDisplayText(progress));
    const alert = guidanceAlertCue(progress, guidanceAlert.current, Date.now());
    guidanceAlert.current = alert.state;
    if (progress.isOffRoute || progress.isWrongWay) {
      if (alert.cue) enqueueVoiceCue(alert.cue, 'navigation');
    } else if (
      turnText
      && !isSilentGuidanceInstruction(progress.nextInstruction)
      && progress.distanceToNextStepMeters != null
      && progress.distanceToNextStepMeters <= 320
      && lastAnnouncedStep.current !== `${progress.nextStepIndex}:${turnAnnouncementPhase(progress.distanceToNextStepMeters)}`
    ) {
      lastAnnouncedStep.current = `${progress.nextStepIndex}:${turnAnnouncementPhase(progress.distanceToNextStepMeters)}`;
      enqueueVoiceCue(turnText, 'navigation');
    }
  }, [active.aggregate.points.length, active.isActive, active.navigationPromptsEnabled, guidance]);

  useEffect(() => {
    if (!active.isActive) return;
    const interval = active.runWalkIntervals.length ? intervalAtElapsed(active.runWalkIntervals, elapsedSeconds) : null;
    void updateOutdoorLiveActivity({
      sessionId: active.workoutInstanceId ?? active.activityId ?? '',
      workoutInstanceId: active.workoutInstanceId ?? undefined,
      sessionSource: 'outdoor',
      activityName: active.name,
      activityType: active.runWalkIntervals.length ? 'run_walk' : active.activityType,
      elapsedSeconds,
      distanceMiles: miles,
      averagePace: secPerMile ? `${Math.floor(secPerMile / 60)}:${String(Math.round(secPerMile % 60)).padStart(2, '0')}` : '--:--',
      averageSpeedMph: active.aggregate.averageMetersPerSecond * 2.23694,
      heartRateBpm,
      heartRateObservedAt: heartRateSample?.timestamp,
      unitSystem: units,
      cadenceValue: cadenceSample?.kind === 'steps' ? cadenceSample.cadenceSpm : cadenceSample?.cadenceRpm,
      cadenceUnit: cadenceSample?.kind === 'steps' ? 'spm' : 'rpm',
      cadenceObservedAt: cadenceSample?.timestamp,
      powerWatts: shownPower?.watts,
      powerKind: shownPower?.kind,
      powerObservedAt: shownPower?.timestamp,
      isPaused: active.isPaused,
      currentInterval: interval ? active.runWalkIntervals[interval.index]?.kind === 'run' ? 'Run' : 'Walk' : undefined,
      nextTransition: interval ? `${interval.intervalRemaining}s` : undefined,
      navigationInstruction: active.nextInstruction ?? undefined,
      elevationGainMeters: active.aggregate.elevationGainMeters,
      elevationLossMeters: active.aggregate.elevationLossMeters,
    }).catch(() => undefined);
  }, [active.aggregate.averageMetersPerSecond, active.isActive, active.isPaused, active.name, active.nextInstruction, active.runWalkIntervals, active.activityType, active.workoutInstanceId, elapsedSeconds, heartRateBpm, heartRateSample, cadenceSample, shownPower?.watts, shownPower?.timestamp, shownPower?.kind, units, miles, secPerMile]);

  async function begin() {
    if (beginInFlightRef.current) return;
    beginInFlightRef.current = true;
    try { await beginActivity(); }
    catch (error) { Alert.alert('Activity could not start', error instanceof Error ? error.message : 'Try again after checking location permissions.'); }
    finally { beginInFlightRef.current = false; }
  }

  async function beginActivity() {
    if (!activeSessionStoresHydrated()) {
      Alert.alert('Restoring session', 'StrideOS is restoring your active-session state. Try again in a moment.');
      return;
    }
    const conflict = getConflictingActiveSession('outdoor');
    if (conflict) {
      const stale = isActiveSessionStale();
      Alert.alert(
        'Another session is active',
        stale
          ? `${conflict.name} started a while ago and is still open. Continue it, or end it and start this activity.`
          : `${conflict.name} is still in progress. Continue it or end it before starting another outdoor activity.`,
        [
          {
            text: 'Continue Current Session',
            onPress: () => router.push(conflict.route as never),
          },
          {
            text: 'End Previous Session and Start New',
            style: 'destructive',
            onPress: () => { void discardActiveSession(conflict).then(() => begin()); },
          },
          { text: 'Cancel', style: 'cancel' },
        ],
      );
      return;
    }
    const permissions = await requestLocationRecovery();
    if (permissions.foreground !== 'granted' || permissions.background !== 'granted') return;
    // A permission sheet can outlive the session state that opened it.
    if (getConflictingActiveSession('outdoor') || useActiveActivityStore.getState().isActive) return;
    const mode = navigationMode === 'off'
      ? 'off'
      : selectedType === 'cycling'
        ? 'cycling'
        : 'walking';
    active.start({
      activityType: selectedType,
      subtype: compatibleRunWalk ? 'run_walk' : 'outdoor',
      name: launchName,
      runWalkIntervals: intervals,
      routeId: attached?.id,
      navigationMode: attached ? mode : 'off',
      scheduledSessionId: params.scheduledSessionId,
      associatedTrainingBlockId: params.associatedTrainingBlockId,
      associatedGoalId: params.associatedGoalId,
    });
    previousElapsed.current = 0;
    previousGuidanceProgress.current = null;
    lastAnnouncedStep.current = null;
    setElapsedSeconds(0);
    // Start GPS before any route-guidance lookup: guidance may call Apple Maps
    // directions, which waits on the network and must never delay recording
    // (offline starts were recording nothing until that request timed out).
    const startedId = useActiveActivityStore.getState().workoutInstanceId;
    try { await startActivityLocationTracking(); }
    catch (error) {
      const current = useActiveActivityStore.getState();
      if (current.workoutInstanceId === startedId) {
        if (current.aggregate.points.length === 0) current.discard();
        else current.pause();
      }
      Alert.alert('GPS recording unavailable', error instanceof Error ? error.message : 'Tracking could not start. Check location permissions and try again.');
      return;
    }
    if (attached && mode !== 'off') {
      const plan = await buildRouteGuidance(attached.points, mode, attached.maneuvers).catch(() => null);
      setGuidance(plan);
    } else {
      setGuidance(null);
    }
    const started = useActiveActivityStore.getState();
    await startOutdoorLiveActivity({
      sessionId: started.workoutInstanceId ?? started.activityId ?? '',
      workoutInstanceId: started.workoutInstanceId ?? undefined,
      sessionSource: 'outdoor',
      activityName: launchName,
      activityType: compatibleRunWalk ? 'run_walk' : selectedType,
      elapsedSeconds: 0,
      distanceMiles: 0,
      heartRateBpm: null,
      unitSystem: units,
      isPaused: false,
      elevationGainMeters: 0,
      elevationLossMeters: 0,
    }).catch(() => undefined);
    {
      await setStrideWatchWorkoutContext({ unitSystem: units }).catch(() => undefined);
      await startStrideWatchWorkout({
        workoutKind: compatibleRunWalk ? 'run' : OUTDOOR_SPORTS[selectedType].watchKind,
        workoutInstanceId: started.workoutInstanceId ?? null,
        title: launchName,
        environment: 'outdoor',
        targetZone: null,
      }).then(status => {
        if (status.lastError) Alert.alert('Watch unavailable', `${status.lastError} Phone recording continues.`);
      }).catch(() => undefined);
    }
    enqueueVoiceCue(
      compatibleRunWalk ? 'Begin running.' : `${launchName} started.`,
      compatibleRunWalk ? 'runWalk' : 'motivation',
    );
  }

  async function saveAndFinish() {
    if (saveInFlightRef.current) return;
    const lease = captureOwnerLease();
    const latest = useActiveActivityStore.getState();
    if (!lease || !latest.isActive || !latest.workoutInstanceId) return;
    saveInFlightRef.current = true;
    try {
      await completeOutdoorCommand({ workoutInstanceId: latest.workoutInstanceId,
        endedAt: latest.completionRequestedAt ?? Date.now() });
      if (!ownerLeaseIsCurrent(lease)) return;
      const current = useActiveActivityStore.getState();
      if (current.isActive && current.workoutInstanceId !== latest.workoutInstanceId) return;
      router.replace('/(tabs)/activity' as never);
    } catch (error) {
      if (ownerLeaseIsCurrent(lease)) Alert.alert('Finish retained for retry', error instanceof Error ? error.message : 'The original End snapshot is retained.');
    } finally {
      saveInFlightRef.current = false;
    }
  }

  function finish() {
    Alert.alert('Finish activity?', 'Save this activity to your unified history?', [
      { text: 'Keep Going', style: 'cancel' },
      {
        text: 'Save and Finish',
        onPress: () => {
          void saveAndFinish();
        },
      },
    ]);
  }

  if (!active.isActive) {
    return (
      <SafeAreaView style={[s.safe, { backgroundColor: C.bg }]} edges={['top']}>
        <ScreenHeader
          eyebrow="OUTDOOR TRACKING"
          title="Choose Activity"
          onBack={() => router.back()}
        />
        <ScrollView contentContainerStyle={s.content}>
          <View style={s.typeGrid}>
            {TYPES.map(item => (
              <TouchableOpacity key={item.type} onPress={() => selectSport(item.type)} accessibilityRole="button" accessibilityLabel={item.label} accessibilityState={{ selected: selectedType === item.type }} style={[s.typeCard, { backgroundColor: selectedType === item.type ? C.primaryDim : C.card, borderColor: selectedType === item.type ? C.primary : C.border }]}>
                <Ionicons name={item.icon} size={24} color={selectedType === item.type ? C.primary : C.textMuted} />
                <Text style={[s.typeText, { color: C.text }]}>{item.label}</Text>
              </TouchableOpacity>
            ))}
            {/* Distinct choice, not a selectedType option — routes straight to
                the indoor-ride live screen instead of starting GPS tracking. */}
            <TouchableOpacity
              onPress={() => router.push({
                pathname: '/(tabs)/activity/indoor-ride',
                params: params.scheduledSessionId ? { scheduledSessionId: params.scheduledSessionId } : undefined,
              } as never)}
              style={[s.typeCard, { backgroundColor: C.card, borderColor: C.border }]}
              accessibilityRole="button"
              accessibilityLabel="Indoor cycling — no GPS"
            >
              <Ionicons name="bicycle" size={24} color={C.textMuted} />
              <Text style={[s.typeText, { color: C.text }]}>Indoor Cycling</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/training/run-creator' as never)}
            style={[s.builderCard, { backgroundColor: C.card, borderColor: C.primary }]}
            accessibilityRole="button"
            accessibilityLabel="Build workout"
          >
            <View style={{ flex: 1 }}>
              <Text style={[s.cardTitle, { color: C.text }]}>Build Workout</Text>
              <Text style={[s.helper, { color: C.textMuted }]}>Create a custom run, interval session, or structured workout.</Text>
            </View>
            <Ionicons name="construct-outline" size={22} color={C.primary} />
          </TouchableOpacity>
          {supportsRunWalk(selectedType) ? (
            <View style={[s.card, { backgroundColor: C.card, borderColor: C.border }]}>
              <View style={s.row}>
                <View style={{ flex: 1 }}>
                  <Text style={[s.cardTitle, { color: C.text }]}>Run / Walk intervals</Text>
                  <Text style={[s.helper, { color: C.textMuted }]}>Spoken transitions persist across pause and resume.</Text>
                </View>
                <Switch accessibilityLabel="Run and walk intervals" value={compatibleRunWalk} onValueChange={setRunWalk} trackColor={{ true: C.primary }} />
              </View>
            </View>
          ) : null}
          <View style={[s.card, { backgroundColor: C.card, borderColor: C.border }]}>
            <Text style={[s.cardTitle, { color: C.text }]}>Directions</Text>
            <Text style={[s.helper, { color: C.textMuted }]}>{attached ? `${attached.name} · ${attached.distanceMiles.toFixed(1)} mi` : 'Attach a saved route to enable directions.'}</Text>
            <View style={s.navPills}>
              {(['off', 'walking', 'cycling'] as const).map(mode => (
                <TouchableOpacity key={mode} disabled={!attached} onPress={() => setNavigationMode(mode)} accessibilityRole="button" accessibilityLabel={mode === 'off' ? 'Directions off' : mode === 'walking' ? 'Run or walk directions' : 'Cycling directions'} accessibilityState={{ selected: navigationMode === mode, disabled: !attached }} style={[s.navPill, { opacity: attached ? 1 : 0.45, backgroundColor: navigationMode === mode ? C.primaryDim : C.cardAlt, borderColor: navigationMode === mode ? C.primary : C.border }]}>
                  <Text style={[s.navText, { color: navigationMode === mode ? C.primary : C.textMuted }]}>{mode === 'off' ? 'Off' : mode === 'walking' ? 'Run / Walk' : 'Cycling'}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <TouchableOpacity onPress={() => void begin()} accessibilityRole="button" accessibilityLabel={`Start ${launchName}`} style={[s.startButton, { backgroundColor: C.primary }]}>
            <Text style={[s.startText, { color: C.onPrimary }]}>Start {launchName}</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const displaySeconds = active.isPaused ? activeSeconds : elapsedSeconds || activeSeconds;
  const speedValue = (metersPerSecond: number) => Number.isFinite(metersPerSecond) && metersPerSecond >= 0
    ? `${(metersPerSecond * (units === 'metric' ? 3.6 : 2.23694)).toFixed(1)} ${units === 'metric' ? 'km/h' : 'mph'}` : '--';
  const paceValue = (metersPerSecond: number) => {
    if (!Number.isFinite(metersPerSecond) || metersPerSecond <= 0) return '--';
    const seconds = Math.round((units === 'metric' ? 1000 : 1609.344) / metersPerSecond);
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')} /${units === 'metric' ? 'km' : 'mi'}`;
  };
  const hasAltitude = active.aggregate.points.some(point => Number.isFinite(point.altitudeMeters));
  const altitudeValue = (meters: number) => hasAltitude ? `${Math.round(meters * (units === 'metric' ? 1 : 3.28084))} ${units === 'metric' ? 'm' : 'ft'}` : '--';
  const averageSpeed = displaySeconds > 0 ? active.aggregate.distanceMeters / displaySeconds : 0;
  const primaryMetrics: OutdoorSessionMetric[] = [
    { label: speedBased ? 'Avg speed' : 'Avg pace', value: speedBased ? speedValue(averageSpeed) : paceValue(averageSpeed) },
    { label: 'Heart rate', value: heartRateBpm == null ? '--' : `${Math.round(heartRateBpm)} bpm`,
      detail: heartRateSample?.source === 'apple_watch' ? 'Apple Watch' : heartRateSample ? 'HR sensor' : undefined },
    { label: 'Elevation gain', value: altitudeValue(active.aggregate.elevationGainMeters) },
  ];
  const additionalMetrics: OutdoorSessionMetric[] = [
    { label: speedBased ? 'Current speed' : 'Current pace', value: active.isPaused ? '--' : speedBased
      ? speedValue(active.aggregate.currentMetersPerSecond) : paceValue(active.aggregate.currentMetersPerSecond) },
    { label: 'Elevation loss', value: altitudeValue(active.aggregate.elevationLossMeters) },
  ];
  if (['running', 'walking', 'cycling', 'hiking'].includes(active.activityType)) additionalMetrics.push({ label: 'Cadence',
    value: cadenceSample == null ? '--' : cadenceSample.kind === 'steps' ? `${Math.round(cadenceSample.cadenceSpm)} spm` : `${Math.round(cadenceSample.cadenceRpm)} rpm` });
  if (active.activityType === 'running' || active.activityType === 'cycling') additionalMetrics.push({
    label: shownPower?.kind === 'measured' ? 'Measured power' : active.activityType === 'cycling' ? 'Estimated cycling power' : 'Device power (est.)',
    value: shownPower == null ? '--' : `${Math.round(shownPower.watts)} W`,
  });
  const currentInterval = active.runWalkIntervals.length ? intervalAtElapsed(active.runWalkIntervals, displaySeconds) : null;
  const watchRecording = active.watchRecording?.workoutInstanceId === active.workoutInstanceId ? active.watchRecording : undefined;
  const watchStatusText = !outdoorWatchStatus.isSupported ? 'Watch connection unavailable' : !outdoorWatchStatus.isPaired ? 'No paired Apple Watch'
    : !outdoorWatchStatus.isWatchAppInstalled ? 'Install StrideOS on Apple Watch'
    : outdoorWatchStatus.isReachable ? 'Connected' : 'Watch app not reachable';

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: C.bg }]} edges={['top', 'bottom']}>
      <ActiveOutdoorSession name={active.name} activityType={active.activityType} paused={active.isPaused}
        ending={active.completionRequestedAt != null}
        startedAt={active.startedAt} points={active.aggregate.points} recordingPauses={active.recordingPauses}
        timeLabel={time(displaySeconds)} distanceLabel={(miles * (units === 'metric' ? 1.609344 : 1)).toFixed(2)} distanceUnit={units === 'metric' ? 'km' : 'mi'}
        primaryMetrics={primaryMetrics} additionalMetrics={additionalMetrics}
        gpsStatus={<GpsSignalChip active={active.isActive} paused={active.isPaused} lastGoodFixAt={active.lastGoodFixAt} startedAt={active.startedAt} />}
        watchStatus={watchStatusText} watchDetail={outdoorWatchStatus.lastError || (watchRecording ? `Recording confirmed: ${watchRecording.state}` : 'Recording not yet confirmed')}
        interval={currentInterval ? { name: active.runWalkIntervals[currentInterval.index]?.kind === 'run' ? 'Run' : 'Walk', remaining: currentInterval.intervalRemaining } : undefined}
        instruction={active.nextInstruction}
        powerSettings={active.activityType === 'cycling' ? (
          <View style={{ marginBottom: 16 }}>
            <TouchableOpacity accessibilityRole="checkbox"
              accessibilityLabel={`Estimate cycling power using profile mass ${profile?.weightKg ?? 'unavailable'} kilograms`}
              accessibilityState={{ checked: confirmedCyclingMass?.id === active.workoutInstanceId, disabled: !active.workoutInstanceId || !Number.isFinite(profile?.weightKg) || profile!.weightKg < 20 || profile!.weightKg > 300 }}
              disabled={!active.workoutInstanceId || !Number.isFinite(profile?.weightKg) || profile!.weightKg < 20 || profile!.weightKg > 300}
              onPress={() => setConfirmedCyclingMass(confirmedCyclingMass?.id === active.workoutInstanceId ? null
                : { id: active.workoutInstanceId!, massKg: profile!.weightKg })}
              style={[s.row, { minHeight: 44, justifyContent: 'flex-start' }]}>
              <Ionicons name={confirmedCyclingMass?.id === active.workoutInstanceId ? 'checkbox' : 'square-outline'} size={24} color={C.primary} />
              <Text style={{ color: C.text, flex: 1 }}>Estimate using profile mass: {profile?.weightKg ?? '--'} kg</Text>
            </TouchableOpacity>
            {confirmedCyclingMass?.id === active.workoutInstanceId ? <>
              <Text style={[s.helper, { color: C.textMuted }]}>Confirmed profile mass {confirmedCyclingMass.massKg} kg; assumed bike mass 10 kg. Steady-speed approximation.</Text>
              {CYCLING_POWER_ASSUMPTIONS.map(assumption => <Text key={assumption} style={[s.helper, { color: C.textMuted }]}>{assumption}</Text>)}
              {!shownPower ? <Text style={[s.helper, { color: C.textMuted }]}>Unavailable: fresh continuous GPS, usable altitude and good horizontal accuracy are required.</Text> : null}
            </> : null}
          </View>
        ) : null}
        coachingControls={<>
          <View style={s.promptRow}><Text style={[s.promptLabel, { color: C.text }]}>Interval voice prompts</Text><Switch accessibilityLabel="Interval voice prompts" disabled={!active.runWalkIntervals.length} value={active.intervalPromptsEnabled} onValueChange={active.setIntervalPromptsEnabled} trackColor={{ true: C.primary }} /></View>
          <View style={s.promptRow}><Text style={[s.promptLabel, { color: C.text }]}>Navigation prompts</Text><Switch accessibilityLabel="Navigation prompts" disabled={active.navigationMode === 'off'} value={active.navigationPromptsEnabled} onValueChange={active.setNavigationPromptsEnabled} trackColor={{ true: C.primary }} /></View>
        </>}
        onPauseResume={() => {
          const latest = useActiveActivityStore.getState();
          if (!latest.isActive || latest.completionRequestedAt != null || latest.workoutInstanceId !== active.workoutInstanceId) return;
          if (latest.isPaused) {
            latest.resume();
            resumeStrideWatchWorkout().catch(() => undefined);
          } else {
            latest.pause();
            pauseStrideWatchWorkout().catch(() => undefined);
          }
        }} onFinish={finish} />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  eyebrow: { fontSize: 10, fontWeight: '900', letterSpacing: 1.3 },
  title: { fontSize: 30, fontFamily: 'CormorantGaramond_700Bold' },
  content: { paddingHorizontal: 18, paddingBottom: 120 },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  typeCard: { width: '48%', minHeight: 92, borderWidth: 1, borderRadius: 17, padding: 15, justifyContent: 'space-between' },
  typeText: { fontSize: 14, fontWeight: '900' },
  card: { borderWidth: 1, borderRadius: 17, padding: 16, marginBottom: 12 },
  builderCard: { minHeight: 78, borderWidth: 1, borderRadius: 17, padding: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  cardTitle: { fontSize: 15, fontWeight: '900' },
  helper: { fontSize: 12, lineHeight: 17, marginTop: 5 },
  navPills: { flexDirection: 'row', gap: 8, marginTop: 13 },
  navPill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 8 },
  navText: { fontSize: 11, fontWeight: '800' },
  startButton: { minHeight: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  startText: { fontSize: 15, fontWeight: '900' },
  promptRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  promptLabel: { fontSize: 13, flex: 1 },
});
