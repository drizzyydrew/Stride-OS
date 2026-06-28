import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as Speech from 'expo-speech';
import MapView, { Marker, Polyline, type LatLng, type Region } from 'react-native-maps';

import { useColors } from '../../../src/theme/useColors';
import { useSettingsStore } from '../../../src/store/settingsStore';
import { useOnboardingStore } from '../../../src/store/onboardingStore';
import { useIntegrationsStore } from '../../../src/store/integrationsStore';
import { useActiveRunStore } from '../../../src/store/activeRunStore';
import { useRouteStore, routeDistanceMiles, type RunRoute, type RoutePoint } from '../../../src/store/routeStore';
import { startLocationTracking, stopLocationTracking } from '../../../src/lib/gpsTracking';
import { getLatestHeartRateBpm } from '../../../src/lib/healthKit';
import { calcHydration } from '../../../src/utils/hydrationEngine';
import { LAYOUT } from '../../../src/constants/layout';

// ─── Sub-tab types ─────────────────────────────────────────────────────────────
type RunTab = 'plan' | 'active' | 'gps' | 'hydration' | 'routes';
type RunState = 'idle' | 'active' | 'paused';
type TrackingPermissionState = {
  foreground: Location.PermissionStatus | 'unknown';
  background: Location.PermissionStatus | 'unknown';
};

function fmt(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
    : `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

const BEND_REGION: Region = {
  latitude: 44.0582,
  longitude: -121.3153,
  latitudeDelta: 0.045,
  longitudeDelta: 0.045,
};

const DARK_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#1a1c15' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8B927C' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#14160F' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2E3127' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#111827' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#22281A' }] },
];

function paceLabel(secPerMile: number): string {
  if (!secPerMile || !Number.isFinite(secPerMile)) return '--:--';
  const m = Math.floor(secPerMile / 60);
  const s = Math.round(secPerMile % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function routeRegion(points: RoutePoint[]): Region {
  if (points.length === 0) return BEND_REGION;
  const lats = points.map(p => p.latitude);
  const lngs = points.map(p => p.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max((maxLat - minLat) * 1.6, 0.012),
    longitudeDelta: Math.max((maxLng - minLng) * 1.6, 0.012),
  };
}

function routePointsToLatLng(points: RoutePoint[]): LatLng[] {
  return points.map(({ latitude, longitude }) => ({ latitude, longitude }));
}

async function getTrackingPermissionState(): Promise<TrackingPermissionState> {
  const [foreground, background] = await Promise.all([
    Location.getForegroundPermissionsAsync(),
    Location.getBackgroundPermissionsAsync(),
  ]);
  return {
    foreground: foreground.status,
    background: background.status,
  };
}

async function requestTrackingPermissionState(): Promise<TrackingPermissionState> {
  const foreground = await Location.requestForegroundPermissionsAsync();
  if (foreground.status !== 'granted') {
    return {
      foreground: foreground.status,
      background: 'unknown',
    };
  }

  const background = await Location.requestBackgroundPermissionsAsync();
  return {
    foreground: foreground.status,
    background: background.status,
  };
}

function milesToMeters(miles: number): number {
  return miles * 1609.344;
}

function metersBetween(a: RoutePoint, b: RoutePoint): number {
  return milesToMeters(routeDistanceMiles([a, b]));
}

function closestRoutePoint(points: RoutePoint[], tap: RoutePoint): { point: RoutePoint; distanceMiles: number } | null {
  if (points.length === 0) return null;
  if (points.length === 1) return { point: points[0], distanceMiles: 0 };

  let accumulatedMiles = 0;
  let best = { point: points[0], distanceMiles: 0 };
  let bestMeters = Number.POSITIVE_INFINITY;
  for (let i = 1; i < points.length; i += 1) {
    const start = points[i - 1];
    const end = points[i];
    const latSpan = end.latitude - start.latitude;
    const lngSpan = end.longitude - start.longitude;
    const denominator = latSpan ** 2 + lngSpan ** 2;
    const ratio = denominator === 0
      ? 0
      : Math.max(0, Math.min(1, ((tap.latitude - start.latitude) * latSpan + (tap.longitude - start.longitude) * lngSpan) / denominator));
    const projected = {
      latitude: start.latitude + latSpan * ratio,
      longitude: start.longitude + lngSpan * ratio,
    };
    const meters = metersBetween(projected, tap);
    if (meters < bestMeters) {
      bestMeters = meters;
      best = {
        point: projected,
        distanceMiles: accumulatedMiles + routeDistanceMiles([start, projected]),
      };
    }
    accumulatedMiles += routeDistanceMiles([start, end]);
  }

  return best;
}

function routeProgressForLocation(route: RunRoute, point: RoutePoint): number {
  const closest = closestRoutePoint(route.points, point);
  return closest?.distanceMiles ?? 0;
}

function estimatedElevationProfile(gainFt: number, count = 14): number[] {
  const baseFt = 3445;
  const gain = Math.max(gainFt, 30);
  return Array.from({ length: count }, (_, index) => {
    const t = count <= 1 ? 0 : index / (count - 1);
    return Math.round(baseFt + Math.sin(t * Math.PI) * gain * 0.7 + t * gain * 0.3);
  });
}

function elevationGainFt(profileFt: number[]): number {
  return profileFt.reduce((total, point, index) => {
    if (index === 0) return total;
    return total + Math.max(0, point - profileFt[index - 1]);
  }, 0);
}

async function fetchElevationProfile(points: RoutePoint[]): Promise<{ profileFt: number[]; gainFt: number } | null> {
  if (points.length < 2) return null;
  const step = Math.max(1, Math.ceil(points.length / 15));
  const sample = points.filter((_, index) => index % step === 0);
  const last = points[points.length - 1];
  if (sample[sample.length - 1] !== last) sample.push(last);

  const latitudes = sample.map(point => point.latitude.toFixed(6)).join(',');
  const longitudes = sample.map(point => point.longitude.toFixed(6)).join(',');
  const response = await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${latitudes}&longitude=${longitudes}`);
  if (!response.ok) return null;

  const json = await response.json() as { elevation?: number[] };
  if (!Array.isArray(json.elevation) || json.elevation.length < 2) return null;

  const profileFt = json.elevation.map(meters => Math.round(meters * 3.28084));
  return {
    profileFt,
    gainFt: Math.round(elevationGainFt(profileFt)),
  };
}

function ElevationProfile({ profile, color }: { profile: number[]; color: string }) {
  if (profile.length < 2) return null;
  const min = Math.min(...profile);
  const max = Math.max(...profile);
  const range = Math.max(max - min, 10);

  return (
    <View style={styles.elevationProfile}>
      {profile.map((point, index) => {
        const heightPct = 24 + ((point - min) / range) * 76;
        return (
          <View
            key={`${point}-${index}`}
            style={[
              styles.elevationBar,
              {
                height: `${heightPct}%`,
                backgroundColor: color,
                opacity: 0.35 + (heightPct / 100) * 0.45,
              },
            ]}
          />
        );
      })}
    </View>
  );
}

function speakCue(text: string): void {
  Speech.stop();
  Speech.speak(text, { rate: 0.92, pitch: 1 });
}

// ─── Plan Tab ─────────────────────────────────────────────────────────────────
function PlanTab() {
  const C = useColors();
  const { units } = useSettingsStore();
  const imp = units === 'imperial';
  const ex6 = imp ? '6 mi' : '9.7 km';
  const pace = imp ? "9'14\"" : "5'44\"";
  const pUnit = imp ? '/mi' : '/km';

  const paceZones = [
    { zone: 'Recovery', label: 'Zone 1', pace: imp ? ">11'00\"" : ">6'50\"", active: false },
    { zone: 'Easy Aerobic', label: 'Zone 2 · Today', pace: pace, active: true },
    { zone: 'Moderate', label: 'Zone 3', pace: imp ? "8'40\"" : "5'23\"", active: false },
    { zone: 'Threshold', label: 'Zone 4', pace: imp ? "7'30\"" : "4'39\"", active: false },
    { zone: 'VO₂ Max', label: 'Zone 5', pace: imp ? "6'20\"" : "3'56\"", active: false },
    { zone: 'Anaerobic', label: 'Zone 6', pace: imp ? "<5'50\"" : "<3'37\"", active: false },
  ];

  const days = [
    { label: 'Mo', name: imp ? '4 mi' : '6.4 km', zone: 'Z2', done: true },
    { label: 'Tu', name: 'Int', zone: 'Z4', done: true },
    { label: 'We', name: 'Rest', zone: 'Off', done: true },
    { label: 'Th', name: ex6, zone: 'Z2', today: true },
    { label: 'Fr', name: 'Str', zone: 'Z3', future: true },
    { label: 'Sa', name: imp ? '12 mi' : '19.3 km', zone: 'Z2', future: true },
    { label: 'Su', name: 'Rest', zone: 'Off', future: true },
  ];

  return (
    <ScrollView contentContainerStyle={styles.runScrollContent} showsVerticalScrollIndicator={false}>
      {/* Week mini-calendar */}
      <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
        <View style={styles.cardHeaderRow}>
          <Text style={[styles.cardLabel, { color: C.textDim }]}>THIS WEEK</Text>
          <Text style={[{ fontSize: 11, color: C.textMuted }]}>Jun 22–28</Text>
        </View>
        <View style={styles.dayRow}>
          {days.map(d => (
            <View
              key={d.label}
              style={[
                styles.dayCol,
                d.today && { backgroundColor: C.primaryDim, borderRadius: 8, paddingVertical: 2 },
                d.future && { opacity: 0.5 },
              ]}
            >
              <Text style={[styles.dayLabel, { color: d.today ? C.primary : d.done ? C.positive : C.textDim }]}>{d.label}</Text>
              <Text style={[styles.dayName, { color: C.text, fontSize: 10 }]}>{d.name}</Text>
              <View style={[styles.dayZoneBadge, { backgroundColor: d.today ? C.primaryDim : C.cardAlt }]}>
                <Text style={[{ fontSize: 8, fontWeight: '700', color: d.today ? C.primary : C.textDim }]}>{d.zone}</Text>
              </View>
              {d.done ? (
                <Text style={[{ fontSize: 12, color: C.positive }]}>✓</Text>
              ) : d.today ? (
                <Text style={[{ fontSize: 8, fontWeight: '700', color: C.primary }]}>NOW</Text>
              ) : (
                <Text style={[{ fontSize: 12, color: C.textDim }]}>–</Text>
              )}
            </View>
          ))}
        </View>
      </View>

      {/* Today's Run */}
      <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
        <Text style={[styles.cardLabel, { color: C.textDim }]}>TODAY'S RUN</Text>
        <Text style={[styles.subTitle, { color: C.text, marginTop: 8 }]}>Easy Run · Zone 2</Text>
        <Text style={[{ fontSize: 13, color: C.textMuted, marginBottom: 10 }]}>{ex6} · HR under 155 bpm</Text>
        <View style={[styles.paceBox, { backgroundColor: C.cardAlt }]}>
          <Text style={[{ fontSize: 10, fontWeight: '700', color: C.textDim, letterSpacing: 0.7, marginBottom: 6 }]}>TARGET PACE</Text>
          <Text style={[{ fontSize: 26, fontWeight: '800', color: C.text }]}>{pace}<Text style={[{ fontSize: 13, color: C.textMuted }]}> {pUnit}</Text></Text>
          <View style={[{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: C.border }]}>
            <Text style={[{ fontSize: 11, color: C.textMuted, lineHeight: 16 }]}>Relaxed conversational effort — not sprinting.</Text>
          </View>
        </View>
      </View>

      {/* Cadence */}
      <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
        <Text style={[styles.cardLabel, { color: C.textDim }]}>CADENCE TARGET</Text>
        <Text style={[{ fontSize: 22, fontWeight: '800', color: C.text, marginTop: 6 }]}>172 spm</Text>
        <Text style={[{ fontSize: 11, color: C.textMuted, marginTop: 4 }]}>160+ is efficient; 170–180 is optimal for most runners.</Text>
      </View>

      {/* Pace zones */}
      <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
        <Text style={[styles.cardLabel, { color: C.textDim }]}>V·DOT PACE ZONES</Text>
        <View style={{ gap: 6, marginTop: 10 }}>
          {paceZones.map(z => (
            <View
              key={z.zone}
              style={[
                styles.zoneRow,
                z.active
                  ? { backgroundColor: C.primaryDim, borderWidth: 1.5, borderColor: C.primary }
                  : { backgroundColor: C.cardAlt },
              ]}
            >
              <View>
                <Text style={[{ fontSize: 13, fontWeight: '700', color: C.text }]}>{z.zone}</Text>
                <Text style={[{ fontSize: 11, color: C.textMuted }]}>{z.label}</Text>
              </View>
              <Text style={[{ fontSize: 13, fontWeight: '700', color: z.active ? C.primary : C.textMuted }]}>{z.pace} {pUnit}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* HR Zones */}
      <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
        <Text style={[styles.cardLabel, { color: C.textDim }]}>HEART RATE ZONES</Text>
        <View style={{ gap: 6, marginTop: 10 }}>
          {[
            { name: 'Zone 1 · Recovery', range: '< 114 bpm', dot: '#8B9080', active: false },
            { name: 'Zone 2 · Easy Aerobic', range: '114–133 bpm · Today\'s target', dot: C.primary, active: true },
            { name: 'Zone 3 · Moderate', range: '133–152 bpm', dot: C.warning, active: false },
            { name: 'Zone 4 · Threshold', range: '152–171 bpm', dot: C.critical, active: false },
            { name: 'Zone 5 · Max', range: '171+ bpm', dot: '#B84040', active: false },
          ].map(z => (
            <View
              key={z.name}
              style={[
                styles.zoneRow,
                z.active
                  ? { backgroundColor: C.primaryDim, borderWidth: 1.5, borderColor: C.primary }
                  : { backgroundColor: C.cardAlt },
              ]}
            >
              <View>
                <Text style={[{ fontSize: 13, fontWeight: '700', color: C.text }]}>{z.name}</Text>
                <Text style={[{ fontSize: 11, color: C.textMuted }]}>{z.range}</Text>
              </View>
              <View style={[{ width: 10, height: 10, borderRadius: 5, backgroundColor: z.dot }]} />
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

// ─── Active Tab ────────────────────────────────────────────────────────────────
function ActiveTab() {
  const C = useColors();
  const { units } = useSettingsStore();
  const healthKitEnabled = useIntegrationsStore(s => s.healthKitEnabled);
  const imp = units === 'imperial';
  const {
    isActive,
    isPaused,
    startTime,
    pausedAt,
    pausedDurationMs,
    distanceMiles,
    currentPaceSecPerMile,
    coordinates,
    startRun,
    pauseRun,
    resumeRun,
    finishRun,
    cancelRun,
  } = useActiveRunStore();
  const selectedRouteId = useRouteStore(s => s.selectedRouteId);
  const selectedRoute = useRouteStore(s => s.routes.find(r => r.id === selectedRouteId) ?? null);
  const [elapsed, setElapsed] = useState(0);
  const [heartRateBpm, setHeartRateBpm] = useState<number | null>(null);
  const [routeSegmentIndex, setRouteSegmentIndex] = useState(0);
  const segmentStartRef = useRef<{ index: number; time: number } | null>(null);
  const maxRouteProgressRef = useRef(0);
  const runState: RunState = !isActive ? 'idle' : isPaused ? 'paused' : 'active';

  useEffect(() => {
    const tick = () => {
      const currentPausedMs = isPaused && pausedAt ? Date.now() - pausedAt : 0;
      setElapsed(startTime ? Math.max(0, Math.floor((Date.now() - startTime - pausedDurationMs - currentPausedMs) / 1000)) : 0);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [isPaused, pausedAt, pausedDurationMs, startTime]);

  useEffect(() => {
    let cancelled = false;

    async function refreshHeartRate() {
      if (!healthKitEnabled || !isActive || isPaused || Platform.OS !== 'ios') {
        if (!cancelled) setHeartRateBpm(null);
        return;
      }

      const latest = await getLatestHeartRateBpm().catch(() => null);
      if (!cancelled) setHeartRateBpm(latest);
    }

    refreshHeartRate();
    const id = setInterval(refreshHeartRate, 10000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [healthKitEnabled, isActive, isPaused]);

  useEffect(() => {
    setRouteSegmentIndex(0);
    maxRouteProgressRef.current = 0;
    segmentStartRef.current = isActive ? { index: 0, time: Date.now() } : null;
  }, [isActive, selectedRoute?.id]);

  async function start() {
    try {
      setRouteSegmentIndex(0);
      maxRouteProgressRef.current = 0;
      segmentStartRef.current = { index: 0, time: Date.now() };
      startRun(null);
      await startLocationTracking();
      if (selectedRoute) {
        speakCue(`Starting route: ${selectedRoute.name}. ${selectedRoute.segments.length} interval markers set.`);
      }
    } catch (error) {
      cancelRun();
      setRouteSegmentIndex(0);
      maxRouteProgressRef.current = 0;
      segmentStartRef.current = null;
      Alert.alert('Location unavailable', error instanceof Error ? error.message : 'Could not start GPS tracking.');
    }
  }

  function pause() {
    pauseRun();
  }

  function resume() {
    resumeRun();
  }

  async function stop() {
    finishRun();
    setRouteSegmentIndex(0);
    maxRouteProgressRef.current = 0;
    segmentStartRef.current = null;
    await stopLocationTracking().catch(console.warn);
  }

  async function cancel() {
    cancelRun();
    setRouteSegmentIndex(0);
    maxRouteProgressRef.current = 0;
    segmentStartRef.current = null;
    await stopLocationTracking().catch(console.warn);
  }

  const dist = imp ? distanceMiles : distanceMiles * 1.609344;
  const distStr = dist.toFixed(2);
  const distUnit = imp ? 'mi' : 'km';
  const pace = imp ? paceLabel(currentPaceSecPerMile) : paceLabel(currentPaceSecPerMile / 1.609344);
  const avgPaceSecPerMile = distanceMiles > 0 && elapsed > 0 ? elapsed / distanceMiles : 0;
  const avgPace = imp ? paceLabel(avgPaceSecPerMile) : paceLabel(avgPaceSecPerMile / 1.609344);
  const routeCoords = selectedRoute ? routePointsToLatLng(selectedRoute.points) : [];
  const liveCoords = coordinates.map(c => ({ latitude: c.lat, longitude: c.lng }));
  const region = liveCoords.length ? routeRegion(liveCoords) : selectedRoute ? routeRegion(selectedRoute.points) : BEND_REGION;
  const currentPoint = coordinates.length ? {
    latitude: coordinates[coordinates.length - 1].lat,
    longitude: coordinates[coordinates.length - 1].lng,
  } : null;
  const routeProgress = selectedRoute && currentPoint ? routeProgressForLocation(selectedRoute, currentPoint) : 0;
  const nextSegment = selectedRoute?.segments[routeSegmentIndex] ?? null;

  useEffect(() => {
    if (!selectedRoute || !currentPoint || !nextSegment || !isActive || isPaused) return;
    maxRouteProgressRef.current = Math.max(maxRouteProgressRef.current, routeProgress);
    if (maxRouteProgressRef.current + 0.03 < nextSegment.distanceMiles) return;

    const distanceToMarker = metersBetween(currentPoint, nextSegment.point);
    if (distanceToMarker > 75) return;

    const now = Date.now();
    const segStart = segmentStartRef.current?.index === routeSegmentIndex
      ? segmentStartRef.current.time
      : startTime ?? now;
    const previousDistance = routeSegmentIndex > 0 ? selectedRoute.segments[routeSegmentIndex - 1].distanceMiles : 0;
    const segmentMiles = Math.max(0.01, nextSegment.distanceMiles - previousDistance);
    const elapsedSeconds = Math.max(1, Math.floor((now - segStart) / 1000));
    const segmentPace = paceLabel(elapsedSeconds / segmentMiles);

    speakCue(`End of segment ${routeSegmentIndex + 1}. Pace: ${segmentPace} per mile.`);
    const nextIndex = routeSegmentIndex + 1;
    setRouteSegmentIndex(nextIndex);
    segmentStartRef.current = { index: nextIndex, time: now };
  }, [selectedRoute?.id, currentPoint?.latitude, currentPoint?.longitude, nextSegment?.label, nextSegment?.distanceMiles, isActive, isPaused, routeProgress, routeSegmentIndex, startTime]);

  return (
    <ScrollView contentContainerStyle={styles.runScrollContent} showsVerticalScrollIndicator={false}>
      <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border, alignItems: 'center' }]}>
        <Text style={[styles.cardLabel, { color: C.textDim }]}>ELAPSED TIME</Text>
        <Text style={[styles.timerDisplay, { color: C.text }]}>{fmt(elapsed)}</Text>
        {selectedRoute ? (
          <Text style={[{ fontSize: 12, color: C.textMuted, marginTop: -8, marginBottom: 12 }]}>
            Route: {selectedRoute.name}
          </Text>
        ) : null}
        {selectedRoute && nextSegment ? (
          <View style={[styles.routeProgressCard, { backgroundColor: C.cardAlt }]}>
            <Text style={[styles.metricLabel, { color: C.textDim }]}>NEXT SEGMENT</Text>
            <Text style={[styles.routeProgressTitle, { color: C.text }]}>
              Segment {nextSegment.label} · {Math.max(0, nextSegment.distanceMiles - routeProgress).toFixed(2)} mi away
            </Text>
            <Text style={[styles.metricUnit, { color: C.textMuted }]}>
              {routeProgress.toFixed(2)} / {selectedRoute.distanceMiles.toFixed(1)} mi route progress
            </Text>
          </View>
        ) : null}
        <View style={styles.metricRow}>
          {[
            { label: 'MILE PACE', value: pace, unit: imp ? '/mi' : '/km' },
            { label: 'AVG PACE',  value: avgPace, unit: imp ? '/mi' : '/km' },
            { label: 'DISTANCE',  value: distStr, unit: distUnit },
          ].map(m => (
            <View key={m.label} style={[styles.metricCell, { backgroundColor: C.cardAlt }]}>
              <Text style={[styles.metricLabel, { color: C.textDim }]}>{m.label}</Text>
              <Text style={[styles.metricVal, { color: C.text }]}>{m.value}</Text>
              <Text style={[styles.metricUnit, { color: C.textMuted }]}>{m.unit}</Text>
            </View>
          ))}
        </View>
        <View style={styles.metricRow}>
          <View style={[styles.hrCell, { backgroundColor: C.cardAlt }]}>
            <Ionicons name="heart" size={16} color={C.critical} />
            <View>
              <Text style={[styles.metricLabel, { color: C.textDim }]}>HEART RATE</Text>
              <Text style={[{ fontSize: 17, fontWeight: '800', color: C.text }]}>
                {heartRateBpm ?? '--'} <Text style={[{ fontSize: 10, color: C.textMuted }]}>bpm</Text>
              </Text>
            </View>
          </View>
          <View style={[styles.metricCell, { backgroundColor: C.accentDim, borderWidth: 1, borderColor: C.accent }]}>
            <Text style={[styles.metricLabel, { color: C.textDim }]}>ZONE</Text>
            <Text style={[{ fontSize: 17, fontWeight: '800', color: C.accent }]}>Z2</Text>
            <Text style={[styles.metricUnit, { color: C.textMuted }]}>TARGET</Text>
          </View>
          <View style={[styles.metricCell, { backgroundColor: C.cardAlt }]}>
            <Text style={[styles.metricLabel, { color: C.textDim }]}>CADENCE</Text>
            <Text style={[{ fontSize: 12, fontWeight: '800', color: C.text }]}>172</Text>
          </View>
        </View>
        {runState === 'idle' && (
          <TouchableOpacity style={[styles.bigBtn, { backgroundColor: C.primary }]} onPress={start} activeOpacity={0.8}>
            <Text style={[styles.bigBtnText, { color: C.onPrimary }]}>Start Run</Text>
          </TouchableOpacity>
        )}
        {runState === 'active' && (
          <View style={styles.btnRow}>
            <TouchableOpacity style={[styles.halfBtn, { backgroundColor: C.warning }]} onPress={pause} activeOpacity={0.8}>
              <Text style={[styles.bigBtnText, { color: '#14160F' }]}>Pause</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.halfBtn, { backgroundColor: C.critical }]} onPress={stop} activeOpacity={0.8}>
              <Text style={[styles.bigBtnText, { color: '#F3F1E9' }]}>Stop</Text>
            </TouchableOpacity>
          </View>
        )}
        {runState === 'paused' && (
          <View style={styles.btnRow}>
            <TouchableOpacity style={[styles.halfBtn, { backgroundColor: C.positive }]} onPress={resume} activeOpacity={0.8}>
              <Text style={[styles.bigBtnText, { color: '#14160F' }]}>Resume</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.halfBtn, { backgroundColor: C.critical }]} onPress={stop} activeOpacity={0.8}>
              <Text style={[styles.bigBtnText, { color: '#F3F1E9' }]}>Finish</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border, padding: 0, overflow: 'hidden' }]}>
        <View style={[{ padding: 10, paddingHorizontal: 14 }, styles.cardHeaderRow]}>
          <Text style={[styles.subTitle, { color: C.text }]}>Live Map</Text>
          <Text style={[{ fontSize: 11, color: isActive ? C.positive : C.textMuted }]}>
            {isActive ? isPaused ? 'Paused' : 'Tracking' : 'Ready'}
          </Text>
        </View>
        <MapView
          style={styles.map}
          initialRegion={region}
          region={liveCoords.length > 0 ? region : undefined}
          customMapStyle={DARK_MAP_STYLE}
          showsUserLocation
          followsUserLocation={isActive}
        >
          {routeCoords.length > 1 ? (
            <Polyline coordinates={routeCoords} strokeColor={C.textMuted} strokeWidth={3} lineDashPattern={[8, 8]} />
          ) : null}
          {selectedRoute?.segments.map(segment => (
            <Marker
              key={segment.label}
              coordinate={segment.point}
              title={`Segment ${segment.label}`}
              description={`${segment.distanceMiles.toFixed(2)} mi from start`}
              pinColor={C.warning}
            />
          ))}
          {liveCoords.length > 1 ? (
            <Polyline coordinates={liveCoords} strokeColor={C.primary} strokeWidth={5} />
          ) : null}
          {liveCoords.length > 0 ? (
            <Marker coordinate={liveCoords[liveCoords.length - 1]} title="Current position" />
          ) : null}
        </MapView>
      </View>

      {/* Lock screen widget preview */}
      <View style={[styles.lockWidget, { backgroundColor: '#0f0f14' }]}>
        <Text style={[styles.lockLabel]}>Lock Screen Widget Preview</Text>
        <View style={styles.lockRow}>
          <View style={styles.lockStat}>
            <Text style={styles.lockStatLabel}>PACE</Text>
            <Text style={styles.lockStatVal}>{pace}</Text>
            <Text style={styles.lockStatUnit}>{imp ? '/mi' : '/km'}</Text>
          </View>
          <View style={styles.lockDivider} />
          <View style={styles.lockStat}>
            <Text style={styles.lockStatLabel}>HR</Text>
            <Text style={[styles.lockStatVal, { color: '#FF6B6B' }]}>{heartRateBpm ?? '--'}</Text>
            <Text style={styles.lockStatUnit}>bpm</Text>
          </View>
          <View style={styles.lockDivider} />
          <View style={styles.lockStat}>
            <Text style={styles.lockStatLabel}>DIST</Text>
            <Text style={styles.lockStatVal}>{distStr}</Text>
            <Text style={styles.lockStatUnit}>{distUnit}</Text>
          </View>
        </View>
        <Text style={styles.lockCaption}>Requires Apple Watch · StrideOS Live Activity</Text>
      </View>
      {isActive ? (
        <TouchableOpacity style={[styles.bigBtn, { backgroundColor: C.cardAlt }]} onPress={cancel} activeOpacity={0.8}>
          <Text style={[styles.bigBtnText, { color: C.textMuted }]}>Cancel Run</Text>
        </TouchableOpacity>
      ) : null}
    </ScrollView>
  );
}

// ─── Hydration Tab ────────────────────────────────────────────────────────────
function HydrationTab() {
  const C = useColors();
  const { units } = useSettingsStore();
  const weightKg = useOnboardingStore(s => s.data.weightKg || 70);
  const imp = units === 'imperial';
  const waterUnit = imp ? 'oz' : 'mL';
  const wtUnit = imp ? 'lbs' : 'kg';
  const [durationInput, setDurationInput] = useState('90');
  const [tempInput, setTempInput] = useState('65');
  const [humidity, setHumidity] = useState<number | null>(null);
  const [weatherBusy, setWeatherBusy] = useState(false);
  const [weatherNote, setWeatherNote] = useState('Manual temp');
  const [preWt, setPreWt] = useState('');
  const [postWt, setPostWt] = useState('');
  const [waterOz, setWaterOz] = useState('');
  const [result, setResult] = useState<string | null>(null);

  const durationMin = Math.max(10, Math.round(Number(durationInput) || 90));
  const tempF = Math.max(20, Math.min(115, Math.round(Number(tempInput) || 65)));
  const fuelPlan = useMemo(
    () => calcHydration(weightKg, durationMin, tempF),
    [durationMin, tempF, weightKg],
  );
  const tempPct = Math.round((fuelPlan.tempMultiplier - 1) * 100);

  function fluidLabel(oz: number) {
    return imp ? `${Math.round(oz)} oz` : `${Math.round(oz * 29.5735)} mL`;
  }

  async function useCurrentWeather() {
    setWeatherBusy(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Location needed', 'Allow location to use current weather for your fuel plan.');
        return;
      }

      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = location.coords;
      const response = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${latitude.toFixed(4)}&longitude=${longitude.toFixed(4)}&current=temperature_2m,relative_humidity_2m&temperature_unit=fahrenheit`,
      );
      if (!response.ok) throw new Error('Weather lookup failed.');
      const json = await response.json() as {
        current?: { temperature_2m?: number; relative_humidity_2m?: number };
      };
      const nextTemp = json.current?.temperature_2m;
      const nextHumidity = json.current?.relative_humidity_2m;
      if (typeof nextTemp !== 'number') throw new Error('No current temperature found.');

      setTempInput(String(Math.round(nextTemp)));
      setHumidity(typeof nextHumidity === 'number' ? Math.round(nextHumidity) : null);
      setWeatherNote('Using current location');
    } catch (error) {
      Alert.alert('Weather unavailable', error instanceof Error ? error.message : 'Could not load current weather.');
    } finally {
      setWeatherBusy(false);
    }
  }

  function calcSweat() {
    const pre = parseFloat(preWt || '0');
    const post = parseFloat(postWt || '0');
    const water = parseFloat(waterOz || '0');
    if (!pre || !post) return;
    const lostLbs = (pre - post) * (imp ? 1 : 2.205);
    const netLost = Math.max(0, lostLbs * 16 - water);
    setResult(`Sweat loss: ${Math.round(netLost)} ${waterUnit}/hr · Replace ${Math.round(netLost * 0.5)} ${waterUnit} within 2 hrs`);
  }

  return (
    <ScrollView contentContainerStyle={styles.runScrollContent} showsVerticalScrollIndicator={false}>
      <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
        <View style={styles.cardHeaderRow}>
          <Text style={[styles.cardLabel, { color: C.textDim }]}>RUN FUEL PLANNER</Text>
          <TouchableOpacity onPress={useCurrentWeather} disabled={weatherBusy} activeOpacity={0.8}>
            <Text style={[{ fontSize: 11, fontWeight: '800', color: C.primary }]}>
              {weatherBusy ? 'Loading...' : 'Use location'}
            </Text>
          </TouchableOpacity>
        </View>
        <View style={{ gap: 8 }}>
          <View style={styles.inputRow}>
            <Text style={[{ fontSize: 12, color: C.textMuted, width: 110 }]}>Run duration</Text>
            <TextInput
              value={durationInput}
              onChangeText={setDurationInput}
              keyboardType="number-pad"
              placeholder="90"
              placeholderTextColor={C.textDim}
              style={[styles.input, { backgroundColor: C.cardAlt, borderColor: C.border, color: C.text }]}
            />
            <Text style={[{ fontSize: 12, color: C.textDim }]}>min</Text>
          </View>
          <View style={styles.inputRow}>
            <Text style={[{ fontSize: 12, color: C.textMuted, width: 110 }]}>Temperature</Text>
            <TextInput
              value={tempInput}
              onChangeText={(value) => { setTempInput(value); setWeatherNote('Manual temp'); setHumidity(null); }}
              keyboardType="number-pad"
              placeholder="65"
              placeholderTextColor={C.textDim}
              style={[styles.input, { backgroundColor: C.cardAlt, borderColor: C.border, color: C.text }]}
            />
            <Text style={[{ fontSize: 12, color: C.textDim }]}>°F</Text>
          </View>
        </View>
        <Text style={[{ fontSize: 11, color: C.textDim, lineHeight: 17, marginTop: 8 }]}>
          {weatherNote}{humidity !== null ? ` · Humidity ${humidity}%` : ''}{tempPct > 0 ? ` · +${tempPct}% heat adjustment` : ''}
        </Text>
      </View>

      <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
        <Text style={[styles.cardLabel, { color: C.textDim }]}>TARGETS FOR THIS RUN</Text>
        <View style={styles.fuelGrid}>
          <View style={[styles.fuelCell, { backgroundColor: C.cardAlt }]}>
            <Text style={[styles.metricLabel, { color: C.textDim }]}>FLUID</Text>
            <Text style={[styles.fuelValue, { color: C.text }]}>{fluidLabel(fuelPlan.totalWaterOz)}</Text>
            <Text style={[styles.metricUnit, { color: C.textMuted }]}>{fluidLabel(fuelPlan.totalWaterOz / Math.max(0.25, durationMin / 60))}/hr</Text>
          </View>
          <View style={[styles.fuelCell, { backgroundColor: C.cardAlt }]}>
            <Text style={[styles.metricLabel, { color: C.textDim }]}>SODIUM</Text>
            <Text style={[styles.fuelValue, { color: C.text }]}>{Math.round(fuelPlan.sodiumMg)} mg</Text>
            <Text style={[styles.metricUnit, { color: C.textMuted }]}>{Math.round(fuelPlan.sodiumMg / Math.max(0.25, durationMin / 60))} mg/hr</Text>
          </View>
          <View style={[styles.fuelCell, { backgroundColor: C.primaryDim, borderWidth: 1, borderColor: C.primary }]}>
            <Text style={[styles.metricLabel, { color: C.textDim }]}>CARBS</Text>
            <Text style={[styles.fuelValue, { color: C.primary }]}>{Math.round(fuelPlan.carbsRecommendedG)} g</Text>
            <Text style={[styles.metricUnit, { color: C.textMuted }]}>
              {fuelPlan.carbRate.recommendedGPerHr} g/hr target
            </Text>
          </View>
        </View>
        <View style={[styles.paceBox, { backgroundColor: C.cardAlt, marginTop: 10 }]}>
          <Text style={[{ fontSize: 12, color: C.textMuted, lineHeight: 18 }]}>
            Carb range: {Math.round(fuelPlan.carbsMinG)}-{Math.round(fuelPlan.carbsMaxG)} g total
            ({fuelPlan.carbRate.minGPerHr}-{fuelPlan.carbRate.maxGPerHr} g/hr). Practice higher targets before race day.
          </Text>
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
        <Text style={[styles.subTitle, { color: C.text, marginBottom: 10 }]}>Every 20 Minutes</Text>
        <View style={styles.fuelGrid}>
          <View style={[styles.fuelCell, { backgroundColor: C.cardAlt }]}>
            <Text style={[styles.metricLabel, { color: C.textDim }]}>FLUID</Text>
            <Text style={[styles.fuelValue, { color: C.text }]}>{fluidLabel(fuelPlan.perInterval.waterOz)}</Text>
          </View>
          <View style={[styles.fuelCell, { backgroundColor: C.cardAlt }]}>
            <Text style={[styles.metricLabel, { color: C.textDim }]}>SODIUM</Text>
            <Text style={[styles.fuelValue, { color: C.text }]}>{Math.round(fuelPlan.perInterval.sodiumMg)} mg</Text>
          </View>
          <View style={[styles.fuelCell, { backgroundColor: C.cardAlt }]}>
            <Text style={[styles.metricLabel, { color: C.textDim }]}>CARBS</Text>
            <Text style={[styles.fuelValue, { color: C.text }]}>{Math.round(fuelPlan.perInterval.carbsRecommendedG)} g</Text>
          </View>
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
        <Text style={[styles.subTitle, { color: C.text, marginBottom: 6 }]}>Calculate Your Sweat Rate</Text>
        <Text style={[{ fontSize: 12, color: C.textMuted, lineHeight: 19, marginBottom: 10 }]}>
          Weigh yourself before a 60-min run. Do not drink water during. Weigh yourself after. Then calculate total sweat loss and replace 50–80% per hour.
        </Text>
        {[
          { label: 'Pre-run weight', value: preWt, set: setPreWt },
          { label: 'Post-run weight', value: postWt, set: setPostWt },
          { label: 'Water consumed', value: waterOz, set: setWaterOz },
        ].map(f => (
          <View key={f.label} style={[styles.inputRow, { marginBottom: 8 }]}>
            <Text style={[{ fontSize: 12, color: C.textMuted, width: 110 }]}>{f.label}</Text>
            <TextInput
              value={f.value}
              onChangeText={f.set}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor={C.textDim}
              style={[styles.input, { backgroundColor: C.cardAlt, borderColor: C.border, color: C.text }]}
            />
            <Text style={[{ fontSize: 12, color: C.textDim }]}>{wtUnit}</Text>
          </View>
        ))}
        <TouchableOpacity style={[styles.bigBtn, { backgroundColor: C.primary }]} onPress={calcSweat} activeOpacity={0.8}>
          <Text style={[styles.bigBtnText, { color: C.onPrimary }]}>Calculate</Text>
        </TouchableOpacity>
        {result && (
          <View style={[styles.paceBox, { backgroundColor: C.primaryDim, borderWidth: 1, borderColor: C.primary, marginTop: 10 }]}>
            <Text style={[{ fontSize: 12, color: C.text, lineHeight: 18 }]}>{result}</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

// ─── Routes Tab ───────────────────────────────────────────────────────────────
function RoutesTab({ onStartRoute }: { onStartRoute: () => void }) {
  const C = useColors();
  const { units } = useSettingsStore();
  const imp = units === 'imperial';
  const isActive = useActiveRunStore(s => s.isActive);
  const startRun = useActiveRunStore(s => s.startRun);
  const cancelRun = useActiveRunStore(s => s.cancelRun);
  const routes = useRouteStore(s => s.routes);
  const selectedRouteId = useRouteStore(s => s.selectedRouteId);
  const selectRoute = useRouteStore(s => s.selectRoute);
  const addRoute = useRouteStore(s => s.addRoute);
  const [expanded, setExpanded] = useState<string | null>(selectedRouteId);
  const [subTab, setSubTab] = useState<'list' | 'build'>('list');
  const [folderFilter, setFolderFilter] = useState<RunRoute['folder'] | 'all'>('all');
  const [builderName, setBuilderName] = useState('');
  const [builderFolder, setBuilderFolder] = useState<RunRoute['folder']>('custom');
  const [builderPoints, setBuilderPoints] = useState<RoutePoint[]>([]);
  const [builderMode, setBuilderMode] = useState<'point' | 'interval'>('point');
  const [builderSegments, setBuilderSegments] = useState<RunRoute['segments']>([]);
  const [builderElevationProfile, setBuilderElevationProfile] = useState<number[]>([]);
  const [builderElevationGainFt, setBuilderElevationGainFt] = useState(0);

  const filteredRoutes = routes.filter(route => folderFilter === 'all' || route.folder === folderFilter);
  const builderDistance = routeDistanceMiles(builderPoints);
  const builderFallbackGainFt = Math.round(builderDistance * 48);
  const builderProfile = builderElevationProfile.length >= 2
    ? builderElevationProfile
    : builderPoints.length >= 2
      ? estimatedElevationProfile(builderFallbackGainFt)
      : [];
  const builderGainFt = builderElevationProfile.length >= 2 ? builderElevationGainFt : builderFallbackGainFt;

  useEffect(() => {
    let cancelled = false;

    if (builderPoints.length < 2) {
      setBuilderElevationProfile([]);
      setBuilderElevationGainFt(0);
      return () => {
        cancelled = true;
      };
    }

    fetchElevationProfile(builderPoints).then(elevation => {
      if (cancelled) return;
      if (elevation) {
        setBuilderElevationProfile(elevation.profileFt);
        setBuilderElevationGainFt(elevation.gainFt);
      } else {
        setBuilderElevationProfile([]);
        setBuilderElevationGainFt(0);
      }
    }).catch(() => {
      if (!cancelled) {
        setBuilderElevationProfile([]);
        setBuilderElevationGainFt(0);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [builderPoints]);

  async function addCurrentPoint() {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Location needed', 'Enable location to add your current point to this route.');
      return;
    }
    const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    setBuilderPoints(points => [...points, {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    }]);
  }

  async function saveBuilderRoute() {
    if (builderPoints.length < 2) {
      Alert.alert('Add at least two points', 'Tap the map or use your current location to build a route.');
      return;
    }
    const miles = routeDistanceMiles(builderPoints);
    const fallbackGainFt = Math.round(miles * 48);
    let elevation = builderElevationProfile.length >= 2
      ? { profileFt: builderElevationProfile, gainFt: builderElevationGainFt }
      : null;
    if (!elevation) {
      try {
        elevation = await fetchElevationProfile(builderPoints);
      } catch {
        elevation = null;
      }
    }
    const elevationProfileFt = elevation?.profileFt ?? estimatedElevationProfile(fallbackGainFt);
    const id = addRoute({
      name: builderName.trim() || 'Custom Route',
      folder: builderFolder,
      difficulty: 'Custom',
      distanceMiles: miles,
      elevationGainFt: elevation?.gainFt ?? fallbackGainFt,
      elevationProfileFt,
      estimatedMinutes: Math.max(1, Math.round(miles * 9.5)),
      segments: builderSegments,
      points: builderPoints,
    });
    setExpanded(id);
    setBuilderName('');
    setBuilderPoints([]);
    setBuilderSegments([]);
    setBuilderElevationProfile([]);
    setBuilderElevationGainFt(0);
    setBuilderMode('point');
    setSubTab('list');
  }

  function handleBuilderMapPress(point: RoutePoint) {
    if (builderMode === 'point') {
      setBuilderPoints(points => [...points, point]);
      return;
    }

    if (builderPoints.length < 2) {
      Alert.alert('Add route points first', 'Add at least two route points before placing interval markers.');
      return;
    }

    const closest = closestRoutePoint(builderPoints, point);
    if (!closest) return;
    const label = String.fromCharCode(65 + builderSegments.length);
    setBuilderSegments(segments => [
      ...segments,
      {
        label,
        distanceMiles: closest.distanceMiles,
        point: closest.point,
      },
    ]);
  }

  function undoBuilderPoint() {
    const nextPoints = builderPoints.slice(0, -1);
    const nextDistance = routeDistanceMiles(nextPoints);
    setBuilderPoints(nextPoints);
    setBuilderSegments(segments => segments.filter(segment => segment.distanceMiles <= nextDistance));
  }

  function clearBuilderRoute() {
    setBuilderPoints([]);
    setBuilderSegments([]);
    setBuilderElevationProfile([]);
    setBuilderElevationGainFt(0);
    setBuilderMode('point');
  }

  async function startRoute(route: RunRoute) {
    selectRoute(route.id);
    if (isActive) {
      onStartRoute();
      return;
    }

    try {
      startRun(null);
      await startLocationTracking();
      speakCue(route.segments.length > 0
        ? `Starting route: ${route.name}. ${route.segments.length} interval markers set.`
        : `Starting route: ${route.name}.`);
      onStartRoute();
    } catch (error) {
      cancelRun();
      Alert.alert('Location unavailable', error instanceof Error ? error.message : 'Could not start GPS tracking.');
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.runScrollContent} showsVerticalScrollIndicator={false}>
      <View style={[styles.subTabBar, { marginHorizontal: 0, backgroundColor: C.card, borderColor: C.border }]}>
        {[
          { key: 'list' as const, label: 'My Routes' },
          { key: 'build' as const, label: 'Build Route' },
        ].map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.subTab, subTab === tab.key && { backgroundColor: C.primaryDim }]}
            onPress={() => setSubTab(tab.key)}
            activeOpacity={0.7}
          >
            <Text style={[styles.subTabText, { color: subTab === tab.key ? C.primary : C.textDim }]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {subTab === 'list' ? (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 10 }}>
            {[
              { key: 'all' as const, label: 'All' },
              { key: 'easy' as const, label: 'Easy' },
              { key: 'tempo' as const, label: 'Tempo' },
              { key: 'long' as const, label: 'Long Run' },
              { key: 'custom' as const, label: 'Custom' },
            ].map(chip => (
              <TouchableOpacity
                key={chip.key}
                style={[
                  styles.routeChip,
                  {
                    backgroundColor: folderFilter === chip.key ? C.primaryDim : C.cardAlt,
                    borderColor: folderFilter === chip.key ? C.primary : 'transparent',
                  },
                ]}
                onPress={() => setFolderFilter(chip.key)}
              >
                <Text style={[styles.routeChipText, { color: folderFilter === chip.key ? C.primary : C.textMuted }]}>{chip.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {filteredRoutes.map(r => {
            const isExpanded = expanded === r.id;
            const dist = imp ? r.distanceMiles : r.distanceMiles * 1.609344;
            const elev = imp ? r.elevationGainFt : r.elevationGainFt * 0.3048;
            return (
        <TouchableOpacity
          key={r.id}
          style={[styles.card, { backgroundColor: isExpanded ? C.primaryDim : C.card, borderColor: isExpanded ? C.primary : C.border, borderWidth: isExpanded ? 1.5 : 1 }]}
          onPress={() => {
            setExpanded(p => p === r.id ? null : r.id);
            selectRoute(r.id);
          }}
          activeOpacity={0.8}
        >
          <View style={styles.cardHeaderRow}>
            <Text style={[styles.subTitle, { color: C.text }]}>{r.name}</Text>
            <View style={[styles.badge, { backgroundColor: C.cardAlt }]}>
              <Text style={[styles.badgeText, { color: C.textMuted }]}>{r.difficulty}</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
            <Text style={[{ fontSize: 12, color: C.textMuted }]}>{dist.toFixed(1)} {imp ? 'mi' : 'km'}</Text>
            <Text style={[{ fontSize: 12, color: C.textMuted }]}>+{Math.round(elev)} {imp ? 'ft' : 'm'} gain</Text>
            <Text style={[{ fontSize: 12, color: C.textMuted }]}>{r.estimatedMinutes} min</Text>
            <Text style={[{ fontSize: 12, color: C.textMuted }]}>{r.segments.length} segments</Text>
          </View>
          {isExpanded && (
            <View style={[{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.border }]}>
              <MapView
                style={styles.routePreviewMap}
                initialRegion={routeRegion(r.points)}
                customMapStyle={DARK_MAP_STYLE}
                scrollEnabled={false}
                zoomEnabled={false}
                pitchEnabled={false}
                rotateEnabled={false}
              >
                <Polyline coordinates={routePointsToLatLng(r.points)} strokeColor={C.primary} strokeWidth={4} />
                {r.points[0] ? <Marker coordinate={r.points[0]} title="Start" /> : null}
                {r.segments.map(segment => (
                  <Marker
                    key={segment.label}
                    coordinate={segment.point}
                    title={`Segment ${segment.label}`}
                    description={`${segment.distanceMiles.toFixed(2)} mi from start`}
                    pinColor={C.warning}
                  />
                ))}
              </MapView>
              {r.segments.length ? (
                <View style={{ gap: 6, marginBottom: 10 }}>
                  <Text style={[styles.cardLabel, { color: C.textDim }]}>INTERVALS</Text>
                  {r.segments.map(segment => (
                    <View key={segment.label} style={[styles.zoneRow, { backgroundColor: C.cardAlt }]}>
                      <Text style={[{ fontSize: 12, fontWeight: '700', color: C.text }]}>Segment {segment.label}</Text>
                      <Text style={[{ fontSize: 12, color: C.textMuted }]}>{segment.distanceMiles.toFixed(2)} mi from start</Text>
                    </View>
                  ))}
                </View>
              ) : null}
              <View style={{ marginBottom: 10 }}>
                <Text style={[styles.cardLabel, { color: C.textDim, marginBottom: 6 }]}>ELEVATION PROFILE</Text>
                <ElevationProfile profile={r.elevationProfileFt ?? estimatedElevationProfile(r.elevationGainFt)} color={C.primary} />
              </View>
              <TouchableOpacity
                style={[styles.bigBtn, { backgroundColor: C.primary }]}
                onPress={() => startRoute(r)}
                activeOpacity={0.8}
              >
                <Text style={[styles.bigBtnText, { color: C.onPrimary }]}>Start on This Route</Text>
              </TouchableOpacity>
            </View>
          )}
        </TouchableOpacity>
            );
          })}
        </>
      ) : (
        <>
          <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border, padding: 0, overflow: 'hidden' }]}>
            <View style={[{ padding: 12 }, styles.cardHeaderRow]}>
              <Text style={[styles.subTitle, { color: C.text }]}>Build Route</Text>
              <Text style={[{ fontSize: 11, color: C.textMuted }]}>{builderPoints.length} points · {builderSegments.length} intervals</Text>
            </View>
            <View style={[styles.builderToolbar, { backgroundColor: C.cardAlt }]}>
              <TouchableOpacity
                style={[styles.builderModeBtn, { backgroundColor: builderMode === 'point' ? C.primary : 'transparent' }]}
                onPress={() => setBuilderMode('point')}
                activeOpacity={0.8}
              >
                <Text style={[styles.builderModeTxt, { color: builderMode === 'point' ? C.onPrimary : C.textMuted }]}>Add Point</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.builderModeBtn, { backgroundColor: builderMode === 'interval' ? C.warning : 'transparent' }]}
                onPress={() => setBuilderMode('interval')}
                activeOpacity={0.8}
              >
                <Text style={[styles.builderModeTxt, { color: builderMode === 'interval' ? '#14160F' : C.textMuted }]}>Add Interval</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.builderIconBtn, { backgroundColor: C.card }]} onPress={undoBuilderPoint}>
                <Text style={[styles.builderModeTxt, { color: C.textMuted }]}>←</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.builderIconBtn, { backgroundColor: C.card }]} onPress={clearBuilderRoute}>
                <Text style={[styles.builderModeTxt, { color: C.textMuted }]}>Clr</Text>
              </TouchableOpacity>
            </View>
            <MapView
              style={styles.builderMap}
              initialRegion={builderPoints.length ? routeRegion(builderPoints) : BEND_REGION}
              customMapStyle={DARK_MAP_STYLE}
              onPress={(event) => handleBuilderMapPress(event.nativeEvent.coordinate)}
              showsUserLocation
            >
              {builderPoints.map((point, index) => (
                <Marker key={`${point.latitude}-${point.longitude}-${index}`} coordinate={point} title={`Point ${index + 1}`} />
              ))}
              {builderPoints.length > 1 ? (
                <Polyline coordinates={routePointsToLatLng(builderPoints)} strokeColor={C.primary} strokeWidth={4} />
              ) : null}
              {builderSegments.map(segment => (
                <Marker
                  key={segment.label}
                  coordinate={segment.point}
                  title={`Segment ${segment.label}`}
                  description={`${segment.distanceMiles.toFixed(2)} mi from start`}
                  pinColor={C.warning}
                />
              ))}
            </MapView>
          </View>

          <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
            <View style={styles.metricRow}>
              <View style={[styles.metricCell, { backgroundColor: C.cardAlt }]}>
                <Text style={[styles.metricLabel, { color: C.textDim }]}>DISTANCE</Text>
                <Text style={[styles.metricVal, { color: C.text }]}>
                  {(imp ? builderDistance : builderDistance * 1.609344).toFixed(2)}
                </Text>
                <Text style={[styles.metricUnit, { color: C.textMuted }]}>{imp ? 'mi' : 'km'}</Text>
              </View>
              <View style={[styles.metricCell, { backgroundColor: C.cardAlt }]}>
                <Text style={[styles.metricLabel, { color: C.textDim }]}>ELEV GAIN</Text>
                <Text style={[styles.metricVal, { color: C.text }]}>+{Math.round(imp ? builderGainFt : builderGainFt * 0.3048)}</Text>
                <Text style={[styles.metricUnit, { color: C.textMuted }]}>{imp ? 'ft' : 'm'} {builderElevationProfile.length >= 2 ? '' : 'est.'}</Text>
              </View>
              <View style={[styles.metricCell, { backgroundColor: C.cardAlt }]}>
                <Text style={[styles.metricLabel, { color: C.textDim }]}>INTERVALS</Text>
                <Text style={[styles.metricVal, { color: C.text }]}>{builderSegments.length}</Text>
                <Text style={[styles.metricUnit, { color: C.textMuted }]}>markers</Text>
              </View>
            </View>
            {builderProfile.length >= 2 ? (
              <View style={[styles.intervalPanel, { backgroundColor: C.cardAlt }]}>
                <Text style={[styles.cardLabel, { color: C.textDim }]}>ELEVATION PROFILE</Text>
                <ElevationProfile profile={builderProfile} color={C.primary} />
              </View>
            ) : null}
            {builderSegments.length ? (
              <View style={[styles.intervalPanel, { backgroundColor: C.cardAlt }]}>
                <Text style={[styles.cardLabel, { color: C.textDim }]}>INTERVAL MARKERS</Text>
                {builderSegments.map(segment => (
                  <View key={segment.label} style={styles.intervalRow}>
                    <Text style={[{ fontSize: 12, fontWeight: '700', color: C.text }]}>Segment {segment.label}</Text>
                    <TouchableOpacity onPress={() => setBuilderSegments(segments => segments.filter(item => item.label !== segment.label))}>
                      <Text style={[{ fontSize: 11, fontWeight: '700', color: C.primary }]}>
                        {segment.distanceMiles.toFixed(2)} mi · Remove
                      </Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            ) : null}
            <TextInput
              value={builderName}
              onChangeText={setBuilderName}
              placeholder="Route name..."
              placeholderTextColor={C.textDim}
              style={[styles.input, { width: '100%', marginBottom: 10, backgroundColor: C.cardAlt, borderColor: C.border, color: C.text }]}
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 10 }}>
              {[
                { key: 'easy' as const, label: 'Easy' },
                { key: 'tempo' as const, label: 'Tempo' },
                { key: 'long' as const, label: 'Long' },
                { key: 'custom' as const, label: 'Custom' },
              ].map(folder => (
                <TouchableOpacity
                  key={folder.key}
                  style={[styles.routeChip, { backgroundColor: builderFolder === folder.key ? C.primaryDim : C.cardAlt, borderColor: builderFolder === folder.key ? C.primary : 'transparent' }]}
                  onPress={() => setBuilderFolder(folder.key)}
                >
                  <Text style={[styles.routeChipText, { color: builderFolder === folder.key ? C.primary : C.textMuted }]}>{folder.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={styles.btnRow}>
              <TouchableOpacity style={[styles.halfBtn, { backgroundColor: C.cardAlt }]} onPress={addCurrentPoint} activeOpacity={0.8}>
                <Text style={[styles.bigBtnText, { color: C.text }]}>Add Point</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.halfBtn, { backgroundColor: C.cardAlt }]}
                onPress={undoBuilderPoint}
                activeOpacity={0.8}
              >
                <Text style={[styles.bigBtnText, { color: C.text }]}>Undo</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={[styles.bigBtn, { backgroundColor: C.primary, marginTop: 8 }]} onPress={saveBuilderRoute} activeOpacity={0.8}>
              <Text style={[styles.bigBtnText, { color: C.onPrimary }]}>Save Route</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </ScrollView>
  );
}

// ─── GPS Tab ─────────────────────────────────────────────────────────────────
function GPSTab() {
  const C = useColors();
  const { units } = useSettingsStore();
  const imp = units === 'imperial';
  const {
    isActive,
    isPaused,
    startTime,
    distanceMiles,
    currentPaceSecPerMile,
    coordinates,
  } = useActiveRunStore();
  const selectedRouteId = useRouteStore(s => s.selectedRouteId);
  const selectedRoute = useRouteStore(s => s.routes.find(r => r.id === selectedRouteId) ?? null);
  const [permission, setPermission] = useState<TrackingPermissionState>({ foreground: 'unknown', background: 'unknown' });
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    getTrackingPermissionState()
      .then(setPermission)
      .catch(() => setPermission({ foreground: 'unknown', background: 'unknown' }));
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      setElapsed(startTime ? Math.max(0, Math.floor((Date.now() - startTime) / 1000)) : 0);
    }, 1000);
    return () => clearInterval(id);
  }, [startTime]);

  async function requestLocation() {
    const result = await requestTrackingPermissionState();
    setPermission(result);
  }

  const liveCoords = coordinates.map(c => ({ latitude: c.lat, longitude: c.lng }));
  const routeCoords = selectedRoute ? routePointsToLatLng(selectedRoute.points) : [];
  const region = liveCoords.length ? routeRegion(liveCoords) : selectedRoute ? routeRegion(selectedRoute.points) : BEND_REGION;
  const dist = imp ? distanceMiles : distanceMiles * 1.609344;
  const pace = imp ? paceLabel(currentPaceSecPerMile) : paceLabel(currentPaceSecPerMile / 1.609344);
  const foregroundReady = permission.foreground === 'granted';
  const trackingReady = foregroundReady && permission.background === 'granted';
  const gpsStatus = isActive
    ? isPaused ? 'Paused' : 'GPS active'
    : trackingReady ? 'Tracking ready' : foregroundReady ? 'Background needed' : 'Location off';
  const gpsStatusColor = isActive || trackingReady ? C.positive : foregroundReady ? C.warning : C.textMuted;

  return (
    <ScrollView contentContainerStyle={styles.runScrollContent} showsVerticalScrollIndicator={false}>
      <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border, padding: 0, overflow: 'hidden' }]}>
        <View style={[{ padding: 10, paddingHorizontal: 14 }, styles.cardHeaderRow]}>
          <Text style={[styles.subTitle, { color: C.text }]}>Live Map</Text>
          <Text style={[{ fontSize: 11, color: gpsStatusColor }]}>
            {gpsStatus}
          </Text>
        </View>
        <MapView
          style={styles.map}
          initialRegion={region}
          region={liveCoords.length > 0 ? region : undefined}
          customMapStyle={DARK_MAP_STYLE}
          showsUserLocation={foregroundReady}
          followsUserLocation={isActive}
          onMapReady={() => {
            if (permission.foreground === 'unknown') {
              getTrackingPermissionState()
                .then(setPermission)
                .catch(() => undefined);
            }
          }}
        >
          {routeCoords.length > 1 ? (
            <Polyline coordinates={routeCoords} strokeColor={C.textMuted} strokeWidth={3} lineDashPattern={[8, 8]} />
          ) : null}
          {selectedRoute?.segments.map(segment => (
            <Marker
              key={segment.label}
              coordinate={segment.point}
              title={`Segment ${segment.label}`}
              description={`${segment.distanceMiles.toFixed(2)} mi from start`}
              pinColor={C.warning}
            />
          ))}
          {liveCoords.length > 1 ? (
            <Polyline coordinates={liveCoords} strokeColor={C.primary} strokeWidth={5} />
          ) : null}
          {routeCoords[0] ? <Marker coordinate={routeCoords[0]} title={selectedRoute?.name ?? 'Route start'} /> : null}
          {liveCoords.length > 0 ? <Marker coordinate={liveCoords[liveCoords.length - 1]} title="Current position" /> : null}
        </MapView>
        {!trackingReady ? (
          <View style={[styles.mapOverlay, { backgroundColor: C.card + 'E6' }]}>
            <Ionicons name="location-outline" size={32} color={C.primary} />
            <Text style={[{ fontSize: 13, fontWeight: '700', color: C.text, marginTop: 10 }]}>
              {foregroundReady ? 'Allow background location to keep recording' : 'Turn on location to track your run'}
            </Text>
            <Text style={[{ fontSize: 11, color: C.textMuted, textAlign: 'center', marginTop: 4, lineHeight: 16 }]}>
              StrideOS needs Always/background access so GPS continues when the screen locks.
            </Text>
            <TouchableOpacity style={[styles.mapOverlayBtn, { backgroundColor: C.primary }]} onPress={requestLocation} activeOpacity={0.8}>
              <Text style={[{ fontSize: 12, fontWeight: '800', color: C.onPrimary }]}>
                {foregroundReady ? 'Enable Background' : 'Enable Location'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
      <View style={styles.metricRow}>
        {[
          { label: 'DISTANCE', value: dist.toFixed(2), unit: imp ? 'mi' : 'km' },
          { label: 'PACE', value: pace, unit: imp ? '/mi' : '/km' },
          { label: 'TIME', value: fmt(elapsed), unit: '' },
        ].map(m => (
          <View key={m.label} style={[styles.metricCellWide, { backgroundColor: C.card, borderColor: C.border }]}>
            <Text style={[styles.metricLabel, { color: C.textDim }]}>{m.label}</Text>
            <Text style={[{ fontSize: 22, fontWeight: '800', color: C.text }]}>{m.value}</Text>
            {m.unit ? <Text style={[styles.metricUnit, { color: C.textMuted }]}>{m.unit}</Text> : null}
          </View>
        ))}
      </View>
      {selectedRoute ? (
        <View style={[styles.card, { backgroundColor: C.primaryDim, borderColor: C.primary }]}>
          <Text style={[styles.cardLabel, { color: C.primary }]}>SELECTED ROUTE</Text>
          <Text style={[styles.subTitle, { color: C.text, marginTop: 6 }]}>{selectedRoute.name}</Text>
          <Text style={[{ fontSize: 12, color: C.textMuted, marginTop: 4 }]}>
            {selectedRoute.distanceMiles.toFixed(1)} mi · +{selectedRoute.elevationGainFt} ft · {selectedRoute.estimatedMinutes} min
          </Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function RunningScreen() {
  const C = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [tab, setTab] = useState<RunTab>('plan');

  const TABS: { key: RunTab; label: string }[] = [
    { key: 'plan',      label: 'Plan' },
    { key: 'active',    label: 'Active' },
    { key: 'gps',       label: 'GPS' },
    { key: 'hydration', label: 'Hydration' },
    { key: 'routes',    label: 'Routes' },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Header */}
      <View style={[styles.screenHeader, { paddingTop: insets.top + 6, backgroundColor: C.bg }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={20} color={C.primary} />
        </TouchableOpacity>
        <View style={{ marginLeft: 10 }}>
          <Text style={[styles.headerLabel, { color: C.textDim }]}>RUNNING</Text>
          <Text style={[styles.headerTitle, { color: C.text }]}>Training Run</Text>
        </View>
      </View>

      {/* Sub-tab bar */}
      <View style={[styles.subTabBar, { backgroundColor: C.card, borderColor: C.border }]}>
        {TABS.map(t => (
          <TouchableOpacity
            key={t.key}
            style={[styles.subTab, tab === t.key && { backgroundColor: C.primaryDim }]}
            onPress={() => setTab(t.key)}
            activeOpacity={0.7}
          >
            <Text style={[styles.subTabText, { color: tab === t.key ? C.primary : C.textDim }]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      <View style={{ flex: 1, paddingHorizontal: 18, paddingBottom: LAYOUT.tabBarPadBottom }}>
        {tab === 'plan'      && <PlanTab />}
        {tab === 'active'    && <ActiveTab />}
        {tab === 'gps'       && <GPSTab />}
        {tab === 'hydration' && <HydrationTab />}
        {tab === 'routes'    && <RoutesTab onStartRoute={() => setTab('active')} />}
      </View>
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
  subTabBar: {
    flexDirection: 'row',
    marginHorizontal: 18,
    borderRadius: 12,
    borderWidth: 1,
    padding: 4,
    gap: 4,
    marginBottom: 14,
  },
  subTab: {
    flex: 1,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subTabText: {
    fontSize: 11,
    fontWeight: '700',
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    marginBottom: 10,
  },
  runScrollContent: {
    paddingBottom: LAYOUT.screenPadBottom,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
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
  paceBox: {
    borderRadius: 10,
    padding: 12,
  },
  dayRow: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 6,
  },
  dayCol: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 2,
  },
  dayLabel: {
    fontSize: 9,
    fontWeight: '700',
    marginBottom: 3,
  },
  dayName: {
    fontWeight: '600',
    marginBottom: 3,
  },
  dayZoneBadge: {
    paddingHorizontal: 3,
    paddingVertical: 1,
    borderRadius: 4,
    marginBottom: 3,
  },
  zoneRow: {
    borderRadius: 10,
    padding: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timerDisplay: {
    fontSize: 64,
    fontWeight: '800',
    lineHeight: 72,
    marginBottom: 14,
    fontVariant: ['tabular-nums'],
  },
  metricRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
    width: '100%',
  },
  metricCell: {
    flex: 1,
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
  },
  metricCellWide: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    alignItems: 'center',
  },
  hrCell: {
    flex: 2,
    borderRadius: 10,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metricLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  metricVal: {
    fontSize: 18,
    fontWeight: '800',
  },
  metricUnit: {
    fontSize: 9,
  },
  fuelGrid: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 10,
  },
  fuelCell: {
    flex: 1,
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
    minHeight: 82,
    justifyContent: 'center',
  },
  fuelValue: {
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 3,
  },
  routeProgressCard: {
    width: '100%',
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
  },
  routeProgressTitle: {
    fontSize: 13,
    fontWeight: '800',
    marginTop: 2,
  },
  bigBtn: {
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  bigBtnText: {
    fontSize: 16,
    fontWeight: '700',
  },
  btnRow: {
    flexDirection: 'row',
    gap: 8,
    width: '100%',
  },
  halfBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockWidget: {
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },
  lockLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: 'rgba(255,255,255,0.45)',
    textAlign: 'center',
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  lockRow: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  lockStat: {
    alignItems: 'center',
  },
  lockStatLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 0.5,
  },
  lockStatVal: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
    lineHeight: 28,
  },
  lockStatUnit: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.5)',
  },
  lockDivider: {
    width: 1,
    height: 38,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  lockCaption: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.35)',
    textAlign: 'center',
    marginTop: 8,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    padding: 8,
    paddingHorizontal: 10,
    fontSize: 13,
    fontFamily: 'System',
  },
  elevationProfile: {
    height: 60,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
    overflow: 'hidden',
  },
  elevationBar: {
    flex: 1,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
  map: {
    height: 240,
    width: '100%',
  },
  routePreviewMap: {
    height: 170,
    borderRadius: 12,
    marginBottom: 10,
    overflow: 'hidden',
  },
  builderMap: {
    height: 260,
    width: '100%',
  },
  builderToolbar: {
    flexDirection: 'row',
    gap: 5,
    padding: 6,
  },
  builderModeBtn: {
    flex: 1,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  builderIconBtn: {
    width: 36,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  builderModeTxt: {
    fontSize: 11,
    fontWeight: '800',
  },
  intervalPanel: {
    borderRadius: 10,
    padding: 10,
    gap: 6,
    marginBottom: 10,
  },
  intervalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  mapOverlay: {
    position: 'absolute',
    left: 16,
    right: 16,
    top: 68,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
  },
  mapOverlayBtn: {
    marginTop: 12,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  routeChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  routeChipText: {
    fontSize: 11,
    fontWeight: '800',
  },
});
