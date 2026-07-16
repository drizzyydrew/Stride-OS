import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useActiveActivityStore, type ActiveOutdoorType } from '../../../src/store/activeActivityStore';
import { useActivityStore } from '../../../src/store/activityStore';
import { effectiveAttachedRoute, useRouteStore } from '../../../src/store/routeStore';
import { useColors } from '../../../src/theme/useColors';
import { startActivityLocationTracking, stopActivityLocationTracking } from '../../../src/lib/activityGpsTracking';
import { endOutdoorLiveActivity, startOutdoorLiveActivity, updateOutdoorLiveActivity } from '../../../src/lib/runLiveActivity';
import { buildRouteGuidance } from '../../../src/lib/routing';
import { updateRouteGuidanceProgress, type RouteGuidancePlan } from '../../../src/lib/routeGuidance';
import { enqueueVoiceCue } from '../../../src/lib/voiceCue';
import { evaluateRunWalkCue, intervalAtElapsed } from '../../../src/utils/activityTracking';

const TYPES: { type: ActiveOutdoorType; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { type: 'running', label: 'Run', icon: 'walk-outline' },
  { type: 'walking', label: 'Walk', icon: 'footsteps-outline' },
  { type: 'cycling', label: 'Cycle', icon: 'bicycle-outline' },
  { type: 'hiking', label: 'Hike', icon: 'trail-sign-outline' },
  { type: 'downhill_skiing', label: 'Downhill Ski', icon: 'snow-outline' },
  { type: 'cross_country_skiing', label: 'XC Ski', icon: 'snow-outline' },
];

function time(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export default function StartOutdoorActivityScreen() {
  const C = useColors();
  const router = useRouter();
  const addActivity = useActivityStore(state => state.addActivity);
  const active = useActiveActivityStore();
  const routes = useRouteStore(state => state.routes);
  const attachment = useRouteStore(state => state.routeAttachment);
  const attached = effectiveAttachedRoute(routes.find(route => route.id === attachment.routeId) ?? null, attachment);
  const [selectedType, setSelectedType] = useState<ActiveOutdoorType>('walking');
  const [runWalk, setRunWalk] = useState(false);
  const [navigationMode, setNavigationMode] = useState<'off' | 'walking' | 'cycling'>('off');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [guidance, setGuidance] = useState<RouteGuidancePlan | null>(null);
  const previousElapsed = useRef(0);
  const lastAnnouncedStep = useRef<string | null>(null);

  const activeSeconds = active.startedAt
    ? Math.max(0, Math.floor((Date.now() - active.startedAt - active.pausedDurationMs) / 1000))
    : 0;
  const miles = active.aggregate.distanceMeters / 1609.344;
  const mph = active.aggregate.currentMetersPerSecond * 2.23694;
  const secPerMile = active.aggregate.currentMetersPerSecond > 0 ? 1609.344 / active.aggregate.currentMetersPerSecond : 0;
  const speedBased = active.activityType === 'cycling' || active.activityType.includes('skiing');
  const intervals = useMemo(() => runWalk
    ? Array.from({ length: 12 }, (_, index) => ({ kind: index % 2 === 0 ? 'run' as const : 'walk' as const, durationSeconds: index % 2 === 0 ? 60 : 90 }))
    : [], [runWalk]);

  useEffect(() => {
    if (!active.isActive || active.isPaused || !active.startedAt) return;
    const timer = setInterval(() => setElapsedSeconds(Math.max(0, Math.floor(
      (Date.now() - active.startedAt! - active.pausedDurationMs) / 1000,
    ))), 1000);
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
    if (cue) enqueueVoiceCue(cue.text);
  }, [active.intervalPromptsEnabled, active.isActive, active.runWalkIntervals, elapsedSeconds]);

  useEffect(() => {
    if (!active.isActive || !guidance || !active.aggregate.points.length) return;
    const point = active.aggregate.points.at(-1)!;
    const progress = updateRouteGuidanceProgress({ point, plan: guidance });
    active.setNextInstruction(progress.isOffRoute ? 'You appear to be off route.' : progress.nextInstruction);
    if (progress.isOffRoute) {
      enqueueVoiceCue('You appear to be off route.');
    } else if (
      progress.nextInstruction
      && progress.distanceToNextStepMeters != null
      && progress.distanceToNextStepMeters <= 100
      && lastAnnouncedStep.current !== progress.nextInstruction
    ) {
      lastAnnouncedStep.current = progress.nextInstruction;
      enqueueVoiceCue(progress.nextInstruction);
    }
  }, [active.aggregate.points.length, active.isActive, guidance]);

  useEffect(() => {
    if (!active.isActive) return;
    const interval = active.runWalkIntervals.length ? intervalAtElapsed(active.runWalkIntervals, elapsedSeconds) : null;
    void updateOutdoorLiveActivity({
      activityName: active.name,
      activityType: active.runWalkIntervals.length ? 'run_walk' : active.activityType,
      elapsedSeconds,
      distanceMiles: miles,
      averagePace: secPerMile ? `${Math.floor(secPerMile / 60)}:${String(Math.round(secPerMile % 60)).padStart(2, '0')}` : '--:--',
      averageSpeedMph: active.aggregate.averageMetersPerSecond * 2.23694,
      heartRateBpm: null,
      isPaused: active.isPaused,
      currentInterval: interval ? active.runWalkIntervals[interval.index]?.kind === 'run' ? 'Run' : 'Walk' : undefined,
      nextTransition: interval ? `${interval.intervalRemaining}s` : undefined,
      navigationInstruction: active.nextInstruction ?? undefined,
    }).catch(() => undefined);
  }, [active.aggregate.averageMetersPerSecond, active.isActive, active.isPaused, active.name, active.nextInstruction, active.runWalkIntervals, active.activityType, elapsedSeconds, miles, secPerMile]);

  async function begin() {
    const mode = navigationMode === 'off'
      ? 'off'
      : selectedType === 'cycling'
        ? 'cycling'
        : 'walking';
    active.start({
      activityType: selectedType,
      subtype: runWalk ? 'run_walk' : 'outdoor',
      name: runWalk ? 'Run / Walk' : TYPES.find(item => item.type === selectedType)?.label,
      runWalkIntervals: runWalk ? intervals : [],
      routeId: attached?.id,
      navigationMode: attached ? mode : 'off',
    });
    previousElapsed.current = 0;
    setElapsedSeconds(0);
    if (attached && mode !== 'off') {
      const plan = await buildRouteGuidance(attached.points, mode);
      setGuidance(plan);
    }
    await startActivityLocationTracking();
    await startOutdoorLiveActivity({
      activityName: runWalk ? 'Run / Walk' : TYPES.find(item => item.type === selectedType)?.label ?? 'Activity',
      activityType: runWalk ? 'run_walk' : selectedType,
      elapsedSeconds: 0,
      distanceMiles: 0,
      heartRateBpm: null,
      isPaused: false,
    }).catch(() => undefined);
    enqueueVoiceCue(runWalk ? 'Begin running.' : `${TYPES.find(item => item.type === selectedType)?.label ?? 'Activity'} started.`);
  }

  function finish() {
    Alert.alert('Finish activity?', 'Save this activity to your unified history?', [
      { text: 'Keep Going', style: 'cancel' },
      {
        text: 'Save and Finish',
        onPress: async () => {
          await stopActivityLocationTracking().catch(() => undefined);
          await endOutdoorLiveActivity({
            activityName: active.name,
            activityType: active.runWalkIntervals.length ? 'run_walk' : active.activityType,
            elapsedSeconds,
            distanceMiles: miles,
            averageSpeedMph: active.aggregate.averageMetersPerSecond * 2.23694,
            heartRateBpm: null,
            isPaused: false,
          }).catch(() => undefined);
          addActivity({
            id: active.activityId ?? undefined,
            activityType: active.activityType,
            subtype: active.runWalkIntervals.length ? 'run_walk' : active.subtype,
            source: 'tracked',
            status: 'completed',
            scheduled: false,
            startTime: active.startedAt ?? Date.now() - elapsedSeconds * 1000,
            endTime: Date.now(),
            indoor: false,
            metrics: {
              durationSeconds: elapsedSeconds,
              elapsedTimeSeconds: elapsedSeconds,
              activeTimeSeconds: elapsedSeconds,
              distanceMeters: active.aggregate.distanceMeters,
              elevationGainMeters: active.aggregate.elevationGainMeters,
              elevationLossMeters: active.aggregate.elevationLossMeters,
              speed: {
                currentMetersPerSecond: active.aggregate.currentMetersPerSecond,
                averageMetersPerSecond: active.aggregate.averageMetersPerSecond,
                maximumMetersPerSecond: active.aggregate.maximumMetersPerSecond,
              },
              pace: speedBased ? undefined : {
                currentSecondsPerKilometer: active.aggregate.currentMetersPerSecond ? 1000 / active.aggregate.currentMetersPerSecond : undefined,
                averageSecondsPerKilometer: active.aggregate.averageMetersPerSecond ? 1000 / active.aggregate.averageMetersPerSecond : undefined,
              },
              routeId: active.routeId ?? undefined,
              routeCoordinates: active.aggregate.points,
              runWalkIntervals: active.runWalkIntervals.length ? active.runWalkIntervals : undefined,
            },
          });
          active.discard();
          router.replace('/(tabs)/activity' as never);
        },
      },
    ]);
  }

  if (!active.isActive) {
    return (
      <SafeAreaView style={[s.safe, { backgroundColor: C.bg }]} edges={['top']}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.iconButton}><Ionicons name="close" size={24} color={C.text} /></TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[s.eyebrow, { color: C.textDim }]}>OUTDOOR TRACKING</Text>
            <Text style={[s.title, { color: C.text }]}>Choose Activity</Text>
          </View>
        </View>
        <ScrollView contentContainerStyle={s.content}>
          <View style={s.typeGrid}>
            {TYPES.map(item => (
              <TouchableOpacity key={item.type} onPress={() => setSelectedType(item.type)} style={[s.typeCard, { backgroundColor: selectedType === item.type ? C.primaryDim : C.card, borderColor: selectedType === item.type ? C.primary : C.border }]}>
                <Ionicons name={item.icon} size={24} color={selectedType === item.type ? C.primary : C.textMuted} />
                <Text style={[s.typeText, { color: C.text }]}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {selectedType === 'running' || selectedType === 'walking' ? (
            <View style={[s.card, { backgroundColor: C.card, borderColor: C.border }]}>
              <View style={s.row}>
                <View style={{ flex: 1 }}>
                  <Text style={[s.cardTitle, { color: C.text }]}>Run / Walk intervals</Text>
                  <Text style={[s.helper, { color: C.textMuted }]}>Spoken transitions persist across pause and resume.</Text>
                </View>
                <Switch value={runWalk} onValueChange={setRunWalk} trackColor={{ true: C.primary }} />
              </View>
            </View>
          ) : null}
          <View style={[s.card, { backgroundColor: C.card, borderColor: C.border }]}>
            <Text style={[s.cardTitle, { color: C.text }]}>Directions</Text>
            <Text style={[s.helper, { color: C.textMuted }]}>{attached ? `${attached.name} · ${attached.distanceMiles.toFixed(1)} mi` : 'Attach a saved route to enable directions.'}</Text>
            <View style={s.navPills}>
              {(['off', 'walking', 'cycling'] as const).map(mode => (
                <TouchableOpacity key={mode} disabled={!attached} onPress={() => setNavigationMode(mode)} style={[s.navPill, { opacity: attached ? 1 : 0.45, backgroundColor: navigationMode === mode ? C.primaryDim : C.cardAlt, borderColor: navigationMode === mode ? C.primary : C.border }]}>
                  <Text style={[s.navText, { color: navigationMode === mode ? C.primary : C.textMuted }]}>{mode === 'off' ? 'Off' : mode === 'walking' ? 'Run / Walk' : 'Cycling'}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <TouchableOpacity onPress={() => void begin()} style={[s.startButton, { backgroundColor: C.primary }]}>
            <Text style={[s.startText, { color: C.onPrimary }]}>Start {runWalk ? 'Run / Walk' : TYPES.find(item => item.type === selectedType)?.label}</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: C.bg }]} edges={['top']}>
      <View style={s.activeHeader}>
        <Text style={[s.eyebrow, { color: C.primary }]}>{active.isPaused ? 'PAUSED' : 'ACTIVE'}</Text>
        <Text style={[s.activeTitle, { color: C.text }]}>{active.name}</Text>
        <Text style={[s.timer, { color: C.text }]}>{time(elapsedSeconds || activeSeconds)}</Text>
      </View>
      <View style={s.stats}>
        <Stat label="Distance" value={`${miles.toFixed(2)} mi`} />
        <Stat label={speedBased ? 'Speed' : 'Pace'} value={speedBased ? `${mph.toFixed(1)} mph` : secPerMile ? `${Math.floor(secPerMile / 60)}:${String(Math.round(secPerMile % 60)).padStart(2, '0')}/mi` : '--'} />
        <Stat label="Elevation" value={`${Math.round(active.aggregate.elevationGainMeters * 3.28084)} ft`} />
      </View>
      <ScrollView contentContainerStyle={s.content}>
        {active.runWalkIntervals.length ? (
          <View style={[s.card, { backgroundColor: C.card, borderColor: C.border }]}>
            <Text style={[s.eyebrow, { color: C.textDim }]}>CURRENT INTERVAL</Text>
            <Text style={[s.intervalTitle, { color: C.text }]}>
              {active.runWalkIntervals[intervalAtElapsed(active.runWalkIntervals, elapsedSeconds).index]?.kind === 'run' ? 'Run' : 'Walk'}
            </Text>
            <Text style={[s.helper, { color: C.textMuted }]}>{intervalAtElapsed(active.runWalkIntervals, elapsedSeconds).intervalRemaining} seconds remaining</Text>
          </View>
        ) : null}
        {active.nextInstruction ? (
          <View style={[s.card, { backgroundColor: C.primaryDim, borderColor: C.primary }]}>
            <Text style={[s.eyebrow, { color: C.primary }]}>NEXT TURN</Text>
            <Text style={[s.cardTitle, { color: C.text }]}>{active.nextInstruction}</Text>
          </View>
        ) : null}
        <View style={[s.card, { backgroundColor: C.card, borderColor: C.border }]}>
          <View style={s.row}><Text style={[s.cardTitle, { color: C.text }]}>Interval voice prompts</Text><Switch value={active.intervalPromptsEnabled} onValueChange={active.setIntervalPromptsEnabled} trackColor={{ true: C.primary }} /></View>
          <View style={[s.divider, { backgroundColor: C.border }]} />
          <View style={s.row}><Text style={[s.cardTitle, { color: C.text }]}>Pace / effort coaching</Text><Switch value={active.paceCoachingEnabled} onValueChange={active.setPaceCoachingEnabled} trackColor={{ true: C.primary }} /></View>
        </View>
      </ScrollView>
      <View style={s.controls}>
        <TouchableOpacity onPress={active.isPaused ? active.resume : active.pause} style={[s.control, { backgroundColor: C.card, borderColor: C.border }]}>
          <Ionicons name={active.isPaused ? 'play' : 'pause'} size={24} color={C.text} />
          <Text style={[s.controlText, { color: C.text }]}>{active.isPaused ? 'Resume' : 'Pause'}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={finish} style={[s.control, { backgroundColor: C.critical }]}>
          <Ionicons name="stop" size={24} color="#fff" />
          <Text style={[s.controlText, { color: '#fff' }]}>Complete</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const C = useColors();
  return <View style={[s.stat, { backgroundColor: C.card, borderColor: C.border }]}><Text style={[s.statValue, { color: C.text }]}>{value}</Text><Text style={[s.statLabel, { color: C.textMuted }]}>{label}</Text></View>;
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingBottom: 10 },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { fontSize: 10, fontWeight: '900', letterSpacing: 1.3 },
  title: { fontSize: 30, fontFamily: 'CormorantGaramond_700Bold' },
  content: { paddingHorizontal: 18, paddingBottom: 120 },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  typeCard: { width: '48%', minHeight: 92, borderWidth: 1, borderRadius: 17, padding: 15, justifyContent: 'space-between' },
  typeText: { fontSize: 14, fontWeight: '900' },
  card: { borderWidth: 1, borderRadius: 17, padding: 16, marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  cardTitle: { fontSize: 15, fontWeight: '900' },
  helper: { fontSize: 12, lineHeight: 17, marginTop: 5 },
  navPills: { flexDirection: 'row', gap: 8, marginTop: 13 },
  navPill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 8 },
  navText: { fontSize: 11, fontWeight: '800' },
  startButton: { minHeight: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  startText: { fontSize: 15, fontWeight: '900' },
  activeHeader: { alignItems: 'center', padding: 20 },
  activeTitle: { fontSize: 22, fontWeight: '900', marginTop: 5 },
  timer: { fontSize: 53, fontWeight: '900', marginTop: 6 },
  stats: { flexDirection: 'row', gap: 8, paddingHorizontal: 14, marginBottom: 12 },
  stat: { flex: 1, minHeight: 82, borderWidth: 1, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  statValue: { fontSize: 16, fontWeight: '900' },
  statLabel: { fontSize: 10, marginTop: 4 },
  intervalTitle: { fontSize: 34, fontWeight: '900', marginTop: 7 },
  divider: { height: 1, marginVertical: 14 },
  controls: { flexDirection: 'row', gap: 10, padding: 16 },
  control: { flex: 1, minHeight: 58, borderWidth: 1, borderRadius: 17, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  controlText: { fontSize: 14, fontWeight: '900' },
});
