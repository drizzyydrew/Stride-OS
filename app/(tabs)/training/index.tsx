import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import MapView, { Marker, Polyline, type LatLng, type Region } from 'react-native-maps';

import { useColors } from '../../../src/theme/useColors';
import { spacing } from '../../../src/theme/spacing';
import { radiusTokens, typographyTokens } from '../../../src/theme/tokens';
import { useThemeMode } from '../../../src/store/themeStore';
import { useSettingsStore } from '../../../src/store/settingsStore';
import { evaluateRunReminders } from '../../../src/utils/runReminderScheduler';
import { enqueueVoiceCue } from '../../../src/lib/voiceCue';
import { useHydrationPlannerStore } from '../../../src/store/hydrationPlannerStore';
import HydrationPlannerScreen from './hydration';
import { useOnboardingStore } from '../../../src/store/onboardingStore';
import { useIntegrationsStore } from '../../../src/store/integrationsStore';
import { useActiveRunStore, type RunMode, type RunModeConfig } from '../../../src/store/activeRunStore';
import { useAthleteStore } from '../../../src/store/athleteStore';
import { useWorkoutStore } from '../../../src/store/workoutStore';
import { useCustomWorkoutStore } from '../../../src/store/customWorkoutStore';
import { useCalibration } from '../../../src/store/profileStore';
import { useWeekPlan } from '../../../src/hooks/useWeekPlan';
import { addDays as addCalendarDays, toYMD } from '../../../src/utils/calendarEngine';
import type { RichWorkout } from '../../../src/types/workout';
import PickerWheel from '../../../src/components/ui/PickerWheel';
import {
  effectiveAttachedRoute,
  useRouteStore,
  routeDistanceMiles,
  type RunRoute,
  type RoutePoint,
} from '../../../src/store/routeStore';
import { startLocationTracking, stopLocationTracking } from '../../../src/lib/gpsTracking';
import { getLatestHeartRateBpm } from '../../../src/lib/healthKit';
import { sendRunAlertNotification } from '../../../src/lib/notifications';
import { addRunIntentListener, endRunLiveActivity, startControlCommandPolling, startRunLiveActivity, updateRunLiveActivity } from '../../../src/lib/runLiveActivity';
import {
  calculateHydrationPlan,
  explainPlan,
  weatherBandForTemp,
  type CrampingFrequency,
  type FluidComfort,
  type HydrationGoal,
  type Saltiness,
  type Sweatiness,
} from '../../../src/utils/hydrationEngine';
import { LAYOUT } from '../../../src/constants/layout';

// ─── Sub-tab types ─────────────────────────────────────────────────────────────
type RunTab = 'plan' | 'active' | 'hydration' | 'routes';
type RunState = 'idle' | 'active' | 'paused';

type TrackingPermissionState = {
  foreground: Location.PermissionStatus | 'unknown';
  background: Location.PermissionStatus | 'unknown';
};

// ─── Run modes ─────────────────────────────────────────────────────────────────
const RUN_MODE_OPTIONS: { key: RunMode; label: string; icon: keyof typeof Ionicons.glyphMap; desc: string }[] = [
  { key: 'quick',    label: 'Quick Start', icon: 'flash-outline',   desc: 'GPS tracking starts immediately — no target.' },
  { key: 'time',     label: 'Time Goal',   icon: 'time-outline',    desc: 'Run for a set duration.' },
  { key: 'distance', label: 'Distance',    icon: 'flag-outline',    desc: 'Run to a set distance.' },
  { key: 'workout',  label: 'Workout',     icon: 'list-outline',    desc: "Follow today's structured plan." },
  { key: 'race',     label: 'Race',        icon: 'trophy-outline',  desc: 'Target pace, predicted finish, fueling cues.' },
];

const TIME_GOAL_VALUES = Array.from({ length: 35 }, (_, i) => 10 + i * 5);            // 10–180 min
const DISTANCE_GOAL_VALUES = (() => {
  const list: number[] = [];
  for (let v = 1; v <= 30; v += 0.5) list.push(Math.round(v * 10) / 10);
  for (const race of [3.1, 6.2, 13.1, 26.2]) if (!list.includes(race)) list.push(race);
  return list.sort((a, b) => a - b);
})();
const RACE_PACE_VALUES = Array.from({ length: 121 }, (_, i) => 300 + i * 5);           // 5:00–15:00 /mi

function todayWorkoutIndex(): number {
  // richWeek.workouts is Monday-indexed (see [dayIndex].tsx DAY_NAMES)
  return (new Date().getDay() + 6) % 7;
}

function fmtClockDuration(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;
}

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
  { elementType: 'geometry', stylers: [{ color: '#141414' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8B927C' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0a0a0a' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2a2a2a' }] },
  { featureType: 'road', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#111820' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#1a241a' }] },
];

const LIGHT_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#EFE7DA' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#708489' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#f5ede0' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#FFF9EF' }] },
  { featureType: 'road', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#DDE7E2' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#DCE7CF' }] },
];

const MAP_TOOL_SIZE = 44;
const RUN_PRIMARY_CONTROL_SIZE = 68;

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

function ElevationPlaceholder({ label }: { label?: string }) {
  const C = useColors();
  return (
    <View style={[styles.elevationPlaceholder, { backgroundColor: C.bg, borderColor: C.border }]}>
      <Text style={[{ fontSize: 12, color: C.textMuted }]}>{label ?? 'Elevation profile coming soon'}</Text>
    </View>
  );
}

function RunStat({
  label,
  value,
  unit,
  color,
  muted,
}: {
  label: string;
  value: string;
  unit: string;
  color: string;
  muted: string;
}) {
  return (
    <View style={styles.runStatCell}>
      <Text style={[styles.runSecondaryValue, { color }]}>
        {value} <Text style={[styles.runSecondaryUnit, { color: muted }]}>{unit}</Text>
      </Text>
      <Text style={[styles.runMetricLabel, { color: muted }]}>{label}</Text>
    </View>
  );
}

function speakCue(text: string): void {
  enqueueVoiceCue(text);
}

type LiveZoneStatus = {
  label: string;
  detail: string;
  tone: 'in' | 'near' | 'out' | 'unknown';
  guidance: 'high' | 'low' | null;
};

function zoneStatusForHeartRate(
  heartRateBpm: number | null,
  targetZone: number,
  zones?: { zone: number; label: string; minBPM: number | null; maxBPM: number | null }[] | null,
): LiveZoneStatus {
  const target = zones?.find(z => z.zone === targetZone);
  if (!heartRateBpm || !target || target.minBPM == null || target.maxBPM == null) {
    return { label: `Z${targetZone}`, detail: 'TARGET', tone: 'unknown', guidance: null };
  }

  const current = zones?.find(z =>
    (z.minBPM == null || heartRateBpm >= z.minBPM) &&
    (z.maxBPM == null || heartRateBpm <= z.maxBPM),
  );
  const below = heartRateBpm < target.minBPM;
  const above = heartRateBpm > target.maxBPM;
  const delta = below ? target.minBPM - heartRateBpm : above ? heartRateBpm - target.maxBPM : 0;
  const tone: LiveZoneStatus['tone'] = delta === 0 ? 'in' : delta <= 5 ? 'near' : 'out';

  return {
    label: current ? `Z${current.zone}` : `Z${targetZone}`,
    detail: delta === 0 ? target.label : `${delta} bpm ${above ? 'high' : 'low'}`,
    tone,
    guidance: above ? 'high' : below ? 'low' : null,
  };
}

// ─── Plan Tab ─────────────────────────────────────────────────────────────────
function PlanTab() {
  const C = useColors();
  const router = useRouter();
  const mode = useThemeMode();
  const { units } = useSettingsStore();
  const imp = units === 'imperial';
  const pUnit = imp ? '/mi' : '/km';

  const weekPlan = useWeekPlan();
  const beforeStart = weekPlan.metadata.currentWeek === 0;
  const todayYMD = toYMD(new Date());
  const customLogs = useCustomWorkoutStore(s => s.logs);
  const notTodayLogIds = useCustomWorkoutStore(s => s.notTodayLogIds);
  const markNotToday = useCustomWorkoutStore(s => s.markNotToday);
  const restoreLegacyLogToday = useCustomWorkoutStore(s => s.restoreLegacyLogToday);
  const customRuns = useCustomWorkoutStore(s => s.customRuns);
  const selectedTodayCustomRunId = useCustomWorkoutStore(s => s.selectedTodayCustomRunId);
  const selectedTodayDate = useCustomWorkoutStore(s => s.selectedTodayDate);
  const dismissedTodayCustomRunId = useCustomWorkoutStore(s => s.dismissedTodayCustomRunId);
  const selectCustomRunToday = useCustomWorkoutStore(s => s.selectCustomRunToday);
  const dismissCustomRunToday = useCustomWorkoutStore(s => s.dismissCustomRunToday);
  const restoreCustomRunToday = useCustomWorkoutStore(s => s.restoreCustomRunToday);
  const selectedCustomRunToday = selectedTodayDate === todayYMD
    ? customRuns.find(run => run.id === selectedTodayCustomRunId)
    : undefined;
  const dismissedCustomRunToday = selectedTodayDate === todayYMD
    ? customRuns.find(run => run.id === dismissedTodayCustomRunId)
    : undefined;
  const legacyCustomRunToday = customLogs.find(log =>
    log.date === todayYMD
    && log.category === 'running'
    && !notTodayLogIds.includes(log.id),
  );
  const dismissedLegacyRun = customLogs.find(log =>
    log.date === todayYMD && log.category === 'running' && notTodayLogIds.includes(log.id),
  );
  const customRunToday = selectedCustomRunToday ?? legacyCustomRunToday;

  // Single source of truth for "today's workout": the calendar map's real
  // date entry, falling back to the Monday-indexed richWeek slot only if the
  // date lookup comes up empty.
  const todayEntries = weekPlan.calendarMap.get(todayYMD) ?? [];
  const todayRunEntry = todayEntries.find(e => e.type === 'run');
  const todayRaceEntry = todayEntries.find(e => e.type === 'race');
  const todayWorkout: RichWorkout | null =
    (todayRunEntry?.workout as RichWorkout | undefined)
    ?? weekPlan.richWeek.workouts[todayWorkoutIndex()]
    ?? null;
  const isRestToday = !todayRaceEntry && todayEntries.length === 0;

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const date = addCalendarDays(weekPlan.weekStartDate, i);
      const dateYMD = toYMD(date);
      const entries = weekPlan.calendarMap.get(dateYMD) ?? [];
      const primary = entries[0];
      const isToday = dateYMD === todayYMD;
      const isPast = dateYMD < todayYMD;
      return {
        key: dateYMD,
        label: date.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 2),
        name: primary ? primary.label : 'Rest',
        zone: primary ? (primary.type === 'strength' ? 'Lift' : primary.type === 'race' ? 'Race' : 'Run') : 'Off',
        done: isPast && (primary ? primary.completed : true),
        missed: !!primary?.missed,
        today: isToday,
        future: dateYMD > todayYMD,
      };
    });
  }, [weekPlan.calendarMap, weekPlan.weekStartDate, todayYMD]);

  const activeZoneKey  = !beforeStart && todayWorkout ? todayWorkout.zone : null;
  const activeHrZone   = !beforeStart && todayWorkout ? todayWorkout.hrZoneTarget : null;

  const paceZones: { zone: string; label: string; pace: string; zoneKey: string }[] = [
    { zone: 'Recovery',     label: 'Zone 1', pace: imp ? ">11'00\"" : ">6'50\"", zoneKey: 'recovery'  },
    { zone: 'Easy Aerobic', label: 'Zone 2', pace: imp ? "9'14\""   : "5'44\"",  zoneKey: 'easy'      },
    { zone: 'Moderate',     label: 'Zone 3', pace: imp ? "8'40\""   : "5'23\"",  zoneKey: 'aerobic'   },
    { zone: 'Threshold',    label: 'Zone 4', pace: imp ? "7'30\""   : "4'39\"",  zoneKey: 'threshold' },
    { zone: 'VO₂ Max',      label: 'Zone 5', pace: imp ? "6'20\""   : "3'56\"",  zoneKey: 'vo2'       },
    { zone: 'Anaerobic',    label: 'Zone 6', pace: imp ? "<5'50\""  : "<3'37\"", zoneKey: 'anaerobic' },
  ];

  return (
    <ScrollView contentContainerStyle={styles.runScrollContent} showsVerticalScrollIndicator={false}>
      {/* Week mini-calendar */}
      <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
        <View style={styles.cardHeaderRow}>
          <Text style={[styles.cardLabel, { color: C.textDim }]}>THIS WEEK</Text>
          <Text style={[{ fontSize: 11, color: C.textMuted }]}>
            {weekPlan.weekStartDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            {' – '}
            {addCalendarDays(weekPlan.weekStartDate, 6).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </Text>
        </View>
        {beforeStart ? (
          <Text style={[{ fontSize: 12, color: C.textMuted, marginTop: 8, lineHeight: 17 }]}>
            {weekPlan.metadata.startsOn
              ? `Your plan starts ${weekPlan.metadata.startsOn}.`
              : 'Set a program start date in Settings to see your week here.'}
          </Text>
        ) : (
          <>
            <View style={styles.dayRow}>
              {weekDays.map(d => (
                <View
                  key={d.key}
                  style={[
                    styles.dayCol,
                    d.today && { backgroundColor: C.primary, borderRadius: 8, paddingVertical: 8 },
                    d.future && { opacity: 0.5 },
                  ]}
                >
                  <Text style={[styles.dayLabel, { color: d.today ? C.onPrimary : d.done ? C.positive : d.missed ? C.critical : C.textDim }]}>{d.label}</Text>
                  <Text style={[styles.dayName, { color: d.today ? C.onPrimary : C.text, fontSize: 10 }]} numberOfLines={1}>{d.name}</Text>
                  <View style={[styles.dayZoneBadge, { backgroundColor: d.today ? 'rgba(10,10,10,0.14)' : C.cardAlt }]}>
                    <Text style={[{ fontSize: 8, fontWeight: '700', color: d.today ? C.onPrimary : C.textDim }]}>{d.zone}</Text>
                  </View>
                  {d.done ? (
                    <Text style={[{ fontSize: 12, color: C.positive }]}>✓</Text>
                  ) : d.missed ? (
                    <Text style={[{ fontSize: 10, color: C.critical }]}>✕</Text>
                  ) : d.today ? (
                    <Text style={[{ fontSize: 8, fontWeight: '700', color: C.onPrimary }]}>NOW</Text>
                  ) : (
                    <Text style={[{ fontSize: 12, color: C.textDim }]}>–</Text>
                  )}
                </View>
              ))}
            </View>
            {weekPlan.metadata.focus ? (
              <View style={{ marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: C.border }}>
                <Text style={[{ fontSize: 12, color: C.textMuted, lineHeight: 17 }]}>{weekPlan.metadata.focus}</Text>
                {weekPlan.adaptations.length > 0 && (
                  <View style={{ marginTop: 8, gap: 4 }}>
                    {weekPlan.adaptations.map((note, i) => (
                      <Text key={i} style={[{ fontSize: 11, color: C.textDim, lineHeight: 15 }]}>· {note}</Text>
                    ))}
                  </View>
                )}
              </View>
            ) : null}
          </>
        )}
      </View>

      {/* Today's Run */}
      {beforeStart ? (
        <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
          <Text style={[styles.cardLabel, { color: C.textDim }]}>TODAY'S RUN</Text>
          <Text style={[styles.subTitle, { color: C.text, marginTop: 8 }]}>
            {weekPlan.metadata.startsOn ? `Your plan starts ${weekPlan.metadata.startsOn}` : 'Your plan hasn\'t started yet'}
          </Text>
          <Text style={[{ fontSize: 13, color: C.textMuted, marginTop: 6, lineHeight: 18 }]}>
            Set a goal and program start date in onboarding or Settings to see a personalized week here.
          </Text>
        </View>
      ) : customRunToday ? (
        <View style={[styles.card, { backgroundColor: C.card, borderColor: C.primary, borderWidth: 1.5 }]}>
          <Text style={[styles.cardLabel, { color: C.textDim }]}>TODAY'S CUSTOM RUN</Text>
          <Text style={[styles.subTitle, { color: C.text, marginTop: 8 }]}>
            {'name' in customRunToday
              ? customRunToday.name
              : customRunToday.notes?.split(' — ')[0] || customRunToday.runType?.replace(/_/g, ' ') || 'Custom Run'}
          </Text>
          <Text style={[{ fontSize: 13, color: C.textMuted, marginTop: 6 }]}>
            {customRunToday.durationMinutes ? `${Math.round(customRunToday.durationMinutes)} min` : ''}
            {customRunToday.durationMinutes && customRunToday.distanceMiles ? ' · ' : ''}
            {customRunToday.distanceMiles ? `${customRunToday.distanceMiles.toFixed(2)} mi` : ''}
          </Text>
          <TouchableOpacity
            style={{ alignSelf: 'flex-start', marginTop: 12, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, backgroundColor: C.cardAlt }}
            onPress={() => 'parameters' in customRunToday ? dismissCustomRunToday(todayYMD) : markNotToday(customRunToday.id)}
          >
            <Text style={{ color: C.textMuted, fontSize: 12, fontWeight: '700' }}>Not Today</Text>
          </TouchableOpacity>
          {'parameters' in customRunToday ? (
            <TouchableOpacity
              style={{ alignSelf: 'flex-start', marginTop: 8, paddingVertical: 6, paddingHorizontal: 10 }}
              onPress={() => router.push({ pathname: '/(tabs)/training/run-creator', params: { editId: customRunToday.id } } as never)}
            >
              <Text style={{ color: C.primary, fontSize: 12, fontWeight: '700' }}>Edit Workout</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : todayRaceEntry ? (
        <View style={[styles.card, { backgroundColor: C.card, borderColor: '#DCC0A7', borderWidth: 1.5 }]}>
          <Text style={[styles.cardLabel, { color: C.textDim }]}>TODAY'S RUN</Text>
          <Text style={[styles.subTitle, { color: C.text, marginTop: 8 }]}>{todayRaceEntry.label}</Text>
          <Text style={[{ fontSize: 13, color: C.textMuted, marginTop: 6 }]}>Good luck out there — trust your training.</Text>
        </View>
      ) : isRestToday || !todayWorkout || todayWorkout.type === 'rest' ? (
        <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
          <Text style={[styles.cardLabel, { color: C.textDim }]}>TODAY'S RUN</Text>
          <Text style={[styles.subTitle, { color: C.text, marginTop: 8 }]}>Rest Day</Text>
          <Text style={[{ fontSize: 13, color: C.textMuted, marginTop: 6 }]}>No structured session today — prioritize sleep and recovery.</Text>
        </View>
      ) : (
        <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
          <Text style={[styles.cardLabel, { color: C.textDim }]}>TODAY'S RUN</Text>
          <Text style={[styles.subTitle, { color: C.text, marginTop: 8 }]}>{todayWorkout.title}</Text>
          <Text style={[{ fontSize: 13, color: C.textMuted, marginBottom: 10 }]}>{todayWorkout.purpose}</Text>
          <View style={[styles.paceBox, { backgroundColor: C.cardAlt }]}>
            <Text style={[{ fontSize: 10, fontWeight: '700', color: C.textDim, letterSpacing: 0.7, marginBottom: 6 }]}>TARGET PACE</Text>
            <Text style={[{ fontSize: 26, fontWeight: '800', color: C.text }]}>{todayWorkout.paceGuidance.targetPace}</Text>
            <View style={[{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: C.border }]}>
              <Text style={[{ fontSize: 11, color: C.textMuted, lineHeight: 16 }]}>{todayWorkout.paceGuidance.description}</Text>
            </View>
          </View>
        </View>
      )}

      {!customRunToday && (dismissedCustomRunToday || dismissedLegacyRun) ? (
        <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
          <Text style={[styles.cardLabel, { color: C.textDim }]}>CUSTOM RUN SAVED</Text>
          <Text style={[{ fontSize: 13, color: C.textMuted, marginTop: 6, lineHeight: 18 }]}>Your custom run was removed from today only. The workout, route, logs, and generated plan were not deleted.</Text>
          <TouchableOpacity
            style={{ alignSelf: 'flex-start', marginTop: 10, paddingVertical: 7, paddingHorizontal: 11, borderRadius: 8, backgroundColor: C.primaryDim }}
            onPress={() => dismissedCustomRunToday
              ? restoreCustomRunToday(todayYMD)
              : dismissedLegacyRun ? restoreLegacyLogToday(dismissedLegacyRun.id) : undefined}
          >
            <Text style={{ color: C.primary, fontSize: 12, fontWeight: '700' }}>Restore for Today</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {customRuns.length > 0 ? (
        <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
          <Text style={[styles.cardLabel, { color: C.textDim }]}>SAVED CUSTOM RUNS</Text>
          <View style={{ gap: 8, marginTop: 8 }}>
            {customRuns.slice(0, 5).map(run => (
              <TouchableOpacity
                key={run.id}
                style={{ paddingVertical: 9, paddingHorizontal: 10, borderRadius: 8, backgroundColor: C.cardAlt }}
                onPress={() => selectCustomRunToday(run.id, todayYMD)}
              >
                <Text style={{ color: C.text, fontSize: 13, fontWeight: '700' }}>{run.name}</Text>
                <Text style={{ color: C.textMuted, fontSize: 11, marginTop: 2 }}>{run.durationMinutes} min · {run.distanceMiles.toFixed(2)} mi · Select for today</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ) : null}

      {/* Pace zones */}
      <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
        <Text style={[styles.cardLabel, { color: C.textDim }]}>V·DOT PACE ZONES</Text>
        <View style={{ gap: 6, marginTop: 10 }}>
          {paceZones.map(z => {
            const active = z.zoneKey === activeZoneKey;
            return (
              <View
                key={z.zone}
                style={[
                  styles.zoneRow,
                  active
                    ? { backgroundColor: C.primaryDim, borderWidth: 1.5, borderColor: C.primary }
                    : { backgroundColor: C.cardAlt },
                ]}
              >
                <View>
                  <Text style={[{ fontSize: 13, fontWeight: '700', color: C.text }]}>{z.zone}</Text>
                  <Text style={[{ fontSize: 11, color: C.textMuted }]}>{z.label}{active ? ' · Today' : ''}</Text>
                </View>
                <Text style={[{ fontSize: 13, fontWeight: '700', color: active ? C.primary : C.textMuted }]}>{z.pace} {pUnit}</Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* HR Zones */}
      <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
        <Text style={[styles.cardLabel, { color: C.textDim }]}>HEART RATE ZONES</Text>
        <View style={{ gap: 6, marginTop: 10 }}>
          {[
            { name: 'Zone 1 · Recovery', range: '< 114 bpm', dot: '#8B9080', hrZone: 1 },
            { name: 'Zone 2 · Easy Aerobic', range: '114–133 bpm', dot: C.primary, hrZone: 2 },
            { name: 'Zone 3 · Moderate', range: '133–152 bpm', dot: C.warning, hrZone: 3 },
            { name: 'Zone 4 · Threshold', range: '152–171 bpm', dot: C.critical, hrZone: 4 },
            { name: 'Zone 5 · Max', range: '171+ bpm', dot: '#B84040', hrZone: 5 },
          ].map(z => {
            const active = z.hrZone === activeHrZone;
            return (
              <View
                key={z.name}
                style={[
                  styles.zoneRow,
                  active
                    ? { backgroundColor: C.primaryDim, borderWidth: 1.5, borderColor: C.primary }
                    : { backgroundColor: C.cardAlt },
                ]}
              >
                <View>
                  <Text style={[{ fontSize: 13, fontWeight: '700', color: C.text }]}>{z.name}</Text>
                  <Text style={[{ fontSize: 11, color: C.textMuted }]}>{z.range}{active ? " · Today's target" : ''}</Text>
                </View>
                <View style={[{ width: 10, height: 10, borderRadius: 5, backgroundColor: z.dot }]} />
              </View>
            );
          })}
        </View>
      </View>
    </ScrollView>
  );
}

// ─── Active Tab ────────────────────────────────────────────────────────────────
function ActiveTab({ onFinished, fullScreen = false }: { onFinished?: () => void; fullScreen?: boolean }) {
  const C = useColors();
  const router = useRouter();
  const mode = useThemeMode();
  const insets = useSafeAreaInsets();
  const { units } = useSettingsStore();
  const healthKitEnabled = useIntegrationsStore(s => s.healthKitEnabled);
  const calibration = useCalibration();
  const {
    fatigueScore,
    recoveryScore,
    currentWeek,
    setFatigueScore,
    setRecentEasyLoad,
  } = useAthleteStore();
  const manualLogRun = useWorkoutStore(s => s.manualLog);
  const editRunLog = useWorkoutStore(s => s.editLog);
  const imp = units === 'imperial';
  const plannerReminder = useHydrationPlannerStore();
  const plannerWeightKg = useOnboardingStore(s => s.data.weightKg || 70);
  const {
    isActive,
    isPaused,
    startTime,
    pausedAt,
    pausedDurationMs,
    distanceMiles,
    currentPaceSecPerMile,
    averagePaceSecPerMile,
    elevationGainFt,
    coordinates,
    runMode,
    goalMinutes,
    goalMiles,
    targetPaceSecPerMile,
    plannedWorkout,
    startRun,
    pauseRun,
    resumeRun,
    finishRun,
    cancelRun,
  } = useActiveRunStore();
  const { richWeek } = useWeekPlan();
  const todayPlannedWorkout = richWeek.workouts[todayWorkoutIndex()] ?? null;
  const routeAttachment = useRouteStore(s => s.routeAttachment);
  const attachedRoute = useRouteStore(s => s.routes.find(r => r.id === s.routeAttachment.routeId) ?? null);
  const selectedRoute = effectiveAttachedRoute(attachedRoute, routeAttachment);
  const detachRouteFromToday = useRouteStore(s => s.detachRouteFromToday);
  const reverseAttachedRoute = useRouteStore(s => s.reverseAttachedRoute);
  const [showRouteActions, setShowRouteActions] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [heartRateBpm, setHeartRateBpm] = useState<number | null>(null);
  const [permission, setPermission] = useState<TrackingPermissionState>({ foreground: 'unknown', background: 'unknown' });
  const [routeSegmentIndex, setRouteSegmentIndex] = useState(0);
  const [pendingMode, setPendingMode] = useState<RunMode>('quick');
  const [goalMinutesInput, setGoalMinutesInput] = useState(45);
  const [goalMilesInput, setGoalMilesInput] = useState(5);
  const [raceMilesInput, setRaceMilesInput] = useState(13.1);
  const [racePaceSecInput, setRacePaceSecInput] = useState(540);
  const [goalPickerFor, setGoalPickerFor] = useState<null | 'time' | 'distance' | 'raceDist' | 'racePace'>(null);
  const segmentStartRef = useRef<{ index: number; time: number } | null>(null);
  const maxRouteProgressRef = useRef(0);
  const lastHrAlertRef = useRef(0);
  const reminderCueRef = useRef({ lastHydrationCueSec: 0, lastFuelCueSec: 0 });
  const goalDoneRef = useRef(false);
  const activeMapRef = useRef<MapView>(null);
  const [mapType, setMapType] = useState<'standard' | 'hybrid'>('standard');
  const runState: RunState = !isActive ? 'idle' : isPaused ? 'paused' : 'active';

  async function centerOnMyLocation() {
    const lastCoord = coordinates.at(-1);
    let target = lastCoord ? { latitude: lastCoord.lat, longitude: lastCoord.lng } : null;
    if (!target) {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).catch(() => null);
      if (!location) return;
      target = { latitude: location.coords.latitude, longitude: location.coords.longitude };
    }
    activeMapRef.current?.animateToRegion({ ...target, latitudeDelta: 0.012, longitudeDelta: 0.012 }, 350);
  }

  useEffect(() => {
    getTrackingPermissionState()
      .then(setPermission)
      .catch(() => setPermission({ foreground: 'unknown', background: 'unknown' }));
  }, []);

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

  useEffect(() => {
    setRouteSegmentIndex(0);
    maxRouteProgressRef.current = 0;
    segmentStartRef.current = selectedRoute && isActive ? { index: 0, time: Date.now() } : null;
  }, [routeAttachment.direction, routeAttachment.status]);

  function removeRouteFromToday() {
    detachRouteFromToday();
    setShowRouteActions(false);
    setRouteSegmentIndex(0);
    maxRouteProgressRef.current = 0;
    segmentStartRef.current = null;
    speakCue('Route guidance stopped. Continuing in free run mode.');
  }

  // Lock screen button intents. Two channels:
  // 1. Native event listeners — fire only if an intent ever executes in the
  //    app's own process.
  // 2. App Group command polling — the reliable path. Intents run in the
  //    WIDGET process and can only leave a command in the shared store;
  //    without this poll the app never hears lock-screen presses and its
  //    per-second Live Activity updates immediately revert the widget state.
  useEffect(() => {
    const subs = [
      addRunIntentListener('onPauseIntent',  () => { if (isActive && !isPaused) pauseRun(); }),
      addRunIntentListener('onResumeIntent', () => { if (isActive && isPaused) resumeRun(); }),
      addRunIntentListener('onStopIntent',   () => { if (isActive) stop(); }),
    ];
    const stopPolling = isActive
      ? startControlCommandPolling({
          pause:  () => { if (isActive && !isPaused) pauseRun(); },
          resume: () => { if (isActive && isPaused) resumeRun(); },
          stop:   () => { if (isActive) stop(); },
        })
      : null;
    return () => {
      subs.forEach(s => s.remove());
      stopPolling?.();
    };
  }, [isActive, isPaused]);

  async function start() {
    try {
      const nextPermission = await requestTrackingPermissionState();
      setPermission(nextPermission);
      if (nextPermission.foreground !== 'granted' || nextPermission.background !== 'granted') {
        Alert.alert(
          'Background location needed',
          'StrideOS needs Always/background location to keep recording the route when the phone locks.',
        );
        return;
      }
      setRouteSegmentIndex(0);
      maxRouteProgressRef.current = 0;
      segmentStartRef.current = { index: 0, time: Date.now() };
      reminderCueRef.current = { lastHydrationCueSec: 0, lastFuelCueSec: 0 };
      goalDoneRef.current = false;

      const startWorkout = pendingMode === 'workout' ? todayPlannedWorkout : null;
      // Picker values are in display units; the store always holds miles and sec/mi.
      const toMiles = (v: number) => imp ? v : v / 1.609344;
      const toSecPerMile = (v: number) => imp ? v : v * 1.609344;
      const config: RunModeConfig =
        pendingMode === 'time'     ? { mode: 'time', goalMinutes: goalMinutesInput } :
        pendingMode === 'distance' ? { mode: 'distance', goalMiles: toMiles(goalMilesInput) } :
        pendingMode === 'race'     ? { mode: 'race', goalMiles: toMiles(raceMilesInput), targetPaceSecPerMile: toSecPerMile(racePaceSecInput) } :
        pendingMode === 'workout' && startWorkout ? { mode: 'workout' } :
        { mode: 'quick' };
      startRun(startWorkout, config);
      await startRunLiveActivity({
        elapsedSeconds: 0,
        distanceMiles: 0,
        averagePace: '--:--',
        heartRateBpm: null,
        zoneLabel: 'Zone --',
        zoneStatus: 'unknown',
        isPaused: false,
      }).catch(console.warn);
      await startLocationTracking();
      const unitWord = imp ? 'mile' : 'kilometer';
      if (config.mode === 'time') {
        speakCue(`Starting a ${goalMinutesInput} minute run. Settle into a rhythm.`);
      } else if (config.mode === 'distance') {
        speakCue(`Starting a ${goalMilesInput} ${unitWord} run. Start easy.`);
      } else if (config.mode === 'race') {
        speakCue(`Race mode. Target pace ${paceLabel(racePaceSecInput)} per ${unitWord} over ${raceMilesInput} ${unitWord}s. Hold back the first ${unitWord}.`);
      } else if (config.mode === 'workout' && startWorkout) {
        speakCue(`Starting ${startWorkout.title}. ${startWorkout.purpose ?? ''}`);
      } else if (selectedRoute) {
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
    const finalElapsed = elapsed;
    const finalDurationMin = Math.max(1, Math.round(finalElapsed / 60));
    const finalDistanceMiles = Math.round(distanceMiles * 100) / 100;
    const routeCoordinates = [...coordinates];

    await endRunLiveActivity({ ...liveActivitySnapshot, isPaused: false }).catch(console.warn);
    finishRun();
    setElapsed(0);
    setRouteSegmentIndex(0);
    maxRouteProgressRef.current = 0;
    segmentStartRef.current = null;
    await stopLocationTracking().catch(console.warn);
    onFinished?.();

    if (finalElapsed >= 300) {
      const id = `gps_run_${Date.now()}`;
      const modeNote =
        runMode === 'time' && goalMinutes ? ` · Time goal ${goalMinutes} min` :
        runMode === 'distance' && goalMiles ? ` · Distance goal ${goalMiles.toFixed(1)} mi` :
        runMode === 'race' && goalMiles ? ` · Race ${goalMiles.toFixed(1)} mi${targetPaceSecPerMile ? ` @ target ${paceLabel(targetPaceSecPerMile)}/mi` : ''}` :
        runMode === 'workout' && plannedWorkout ? ` · Workout: ${plannedWorkout.title}` :
        '';
      manualLogRun(
        {
          completionKey: id,
          type: runMode === 'race' ? 'tempo' : runMode === 'workout' && plannedWorkout ? plannedWorkout.type : 'easy_run',
          intensity: runMode === 'race' ? 'hard' : 'easy',
          durationMinutes: finalDurationMin,
          distanceMiles: Math.max(0, finalDistanceMiles),
          notes: `Saved from live GPS tracking${modeNote}${selectedRoute ? ` · Route: ${selectedRoute.name}` : ''}.`,
        },
        currentWeek,
        fatigueScore,
        recoveryScore,
        setFatigueScore,
        setRecentEasyLoad,
      );
      editRunLog(id, {
        actualDurationMinutes: finalDurationMin,
        actualDistanceMiles: finalDistanceMiles,
        routeCoordinates,
      });
      Alert.alert('Run saved', `${finalDurationMin} min · ${finalDistanceMiles.toFixed(2)} mi saved to Activity Log.`);
    } else {
      Alert.alert('Run discarded', 'Runs under 5 minutes are not saved.');
    }
  }

  const dist = imp ? distanceMiles : distanceMiles * 1.609344;
  const distStr = dist.toFixed(2);
  const distUnit = imp ? 'mi' : 'km';
  const pace = imp ? paceLabel(currentPaceSecPerMile) : paceLabel(currentPaceSecPerMile / 1.609344);
  const avgPaceSecPerMile = averagePaceSecPerMile || (distanceMiles > 0 && elapsed > 0 ? elapsed / distanceMiles : 0);
  const avgPace = imp ? paceLabel(avgPaceSecPerMile) : paceLabel(avgPaceSecPerMile / 1.609344);
  const targetZone = 2;
  const zoneStatus = zoneStatusForHeartRate(heartRateBpm, targetZone, calibration?.hrZones);
  const zoneToneColor = zoneStatus.tone === 'in'
    ? C.positive
    : zoneStatus.tone === 'near'
      ? C.warning
      : zoneStatus.tone === 'out'
        ? C.critical
        : C.accent;
  const liveActivitySnapshot = {
    elapsedSeconds: elapsed,
    distanceMiles,
    averagePace: avgPace,
    heartRateBpm,
    zoneLabel: zoneStatus.label,
    zoneStatus: zoneStatus.tone,
    isPaused,
  };
  const routeCoords = selectedRoute ? routePointsToLatLng(selectedRoute.points) : [];
  const liveCoords = coordinates.map(c => ({ latitude: c.lat, longitude: c.lng }));
  const region = liveCoords.length ? routeRegion(liveCoords) : selectedRoute ? routeRegion(selectedRoute.points) : BEND_REGION;
  const mapStyle = mode === 'light' ? LIGHT_MAP_STYLE : DARK_MAP_STYLE;
  const currentPoint = coordinates.length ? {
    latitude: coordinates[coordinates.length - 1].lat,
    longitude: coordinates[coordinates.length - 1].lng,
  } : null;
  const routeProgress = selectedRoute && currentPoint ? routeProgressForLocation(selectedRoute, currentPoint) : 0;
  const nextSegment = selectedRoute?.segments[routeSegmentIndex] ?? null;
  // Live GPS climb while running; planned-route gain as the idle preview.
  const elevationDisplay = isActive
    ? Math.round(imp ? elevationGainFt : elevationGainFt * 0.3048).toString()
    : selectedRoute
      ? Math.round(imp ? selectedRoute.elevationGainFt : selectedRoute.elevationGainFt * 0.3048).toString()
      : '--';
  const elevationUnit = imp ? 'ft' : 'm';

  // ── Goal progress (mode-specific) ────────────────────────────────────────────
  const goalRemainingSec = runMode === 'time' && goalMinutes ? Math.max(0, goalMinutes * 60 - elapsed) : null;
  const goalRemainingMiles = (runMode === 'distance' || runMode === 'race') && goalMiles
    ? Math.max(0, goalMiles - distanceMiles)
    : null;
  const effectivePaceSec = averagePaceSecPerMile > 0
    ? averagePaceSecPerMile
    : runMode === 'race' && targetPaceSecPerMile ? targetPaceSecPerMile : 0;
  const predictedFinishSec = runMode === 'race' && goalMiles && effectivePaceSec > 0
    ? goalMiles * effectivePaceSec
    : null;
  const estRemainingSec = runMode === 'distance' && goalRemainingMiles !== null && effectivePaceSec > 0
    ? goalRemainingMiles * effectivePaceSec
    : null;
  const racePaceDeltaSec = runMode === 'race' && targetPaceSecPerMile && averagePaceSecPerMile > 0
    ? Math.round(averagePaceSecPerMile - targetPaceSecPerMile)
    : null;
  const goalProgressPct = runMode === 'time' && goalMinutes
    ? Math.min(100, (elapsed / (goalMinutes * 60)) * 100)
    : (runMode === 'distance' || runMode === 'race') && goalMiles
      ? Math.min(100, (distanceMiles / goalMiles) * 100)
      : null;
  const secondaryMetrics = [
    { label: 'Avg Pace', value: avgPace, unit: imp ? '/mi' : '/km' },
    { label: 'Heart Rate', value: heartRateBpm ? String(heartRateBpm) : '--', unit: 'bpm' },
    { label: 'Elev Gain', value: elevationDisplay, unit: elevationUnit },
  ];
  const mapLineColor = C.chartSeriesPrimary;
  const plannedRouteColor = C.chartSeriesSecondary;
  const panelBg = mode === 'light' ? C.cardAlt : C.bg;
  const softPanelBg = mode === 'light' ? C.card : C.cardElevated;

  const distDisplayFactor = imp ? 1 : 1.609344;
  const goalPanel = isActive && runMode !== 'quick' ? (
    <View style={[styles.goalPanel, { backgroundColor: C.cardAlt, borderColor: C.border }]}>
      <View style={styles.goalPanelHeader}>
        <Text style={[styles.metricLabel, { color: C.textDim }]}>
          {runMode === 'time' ? 'TIME GOAL' : runMode === 'distance' ? 'DISTANCE GOAL' : runMode === 'race' ? 'RACE PLAN' : 'STRUCTURED WORKOUT'}
        </Text>
        {goalProgressPct !== null ? (
          <Text style={[styles.goalPanelPct, { color: C.primary }]}>{Math.round(goalProgressPct)}%</Text>
        ) : null}
      </View>
      {goalProgressPct !== null ? (
        <View style={[styles.goalProgressTrack, { backgroundColor: C.border }]}>
          <View style={[styles.goalProgressFill, { backgroundColor: C.primary, width: `${goalProgressPct}%` }]} />
        </View>
      ) : null}
      {runMode === 'time' && goalRemainingSec !== null ? (
        <Text style={[styles.goalPanelLine, { color: C.text }]}>
          {fmtClockDuration(goalRemainingSec)} <Text style={{ color: C.textMuted }}>remaining of {goalMinutes} min</Text>
        </Text>
      ) : null}
      {runMode === 'distance' && goalRemainingMiles !== null ? (
        <Text style={[styles.goalPanelLine, { color: C.text }]}>
          {(goalRemainingMiles * distDisplayFactor).toFixed(2)} {distUnit} to go
          <Text style={{ color: C.textMuted }}>
            {estRemainingSec !== null ? ` · ~${fmtClockDuration(estRemainingSec)} at current pace` : ' · pace settling in'}
          </Text>
        </Text>
      ) : null}
      {runMode === 'race' ? (
        <>
          <Text style={[styles.goalPanelLine, { color: C.text }]}>
            Target {targetPaceSecPerMile ? paceLabel(imp ? targetPaceSecPerMile : targetPaceSecPerMile / 1.609344) : '--:--'} {imp ? '/mi' : '/km'}
            <Text style={{
              color: racePaceDeltaSec === null ? C.textMuted : Math.abs(racePaceDeltaSec) <= 10 ? C.positive : racePaceDeltaSec > 0 ? C.warning : C.accent,
            }}>
              {racePaceDeltaSec === null
                ? ' · pace settling in'
                : Math.abs(racePaceDeltaSec) <= 10
                  ? ' · on pace'
                  : racePaceDeltaSec > 0
                    ? ` · ${Math.round(Math.abs(racePaceDeltaSec) / distDisplayFactor)}s/${distUnit} behind`
                    : ` · ${Math.round(Math.abs(racePaceDeltaSec) / distDisplayFactor)}s/${distUnit} ahead`}
            </Text>
          </Text>
          <Text style={[styles.goalPanelLine, { color: C.textMuted }]}>
            {predictedFinishSec !== null ? `Predicted finish ${fmtClockDuration(predictedFinishSec)}` : 'Predicted finish pending'}
            {goalRemainingMiles !== null ? ` · ${(goalRemainingMiles * distDisplayFactor).toFixed(2)} ${distUnit} to go` : ''}
          </Text>
        </>
      ) : null}
      {runMode === 'workout' && plannedWorkout ? (
        <>
          <Text style={[styles.goalPanelLine, { color: C.text }]}>{plannedWorkout.title}</Text>
          <Text style={[styles.goalPanelLine, { color: C.textMuted }]} numberOfLines={2}>
            {plannedWorkout.paceRange
              ? `Target ${paceLabel(plannedWorkout.paceRange.minSecPerMi)}–${paceLabel(plannedWorkout.paceRange.maxSecPerMi)} /mi · Zone ${plannedWorkout.hrZoneTarget}`
              : plannedWorkout.purpose}
          </Text>
          {plannedWorkout.intervals ? (
            <Text style={[styles.goalPanelLine, { color: C.textMuted }]}>
              {plannedWorkout.intervals.setCount}× {plannedWorkout.intervals.workLabel} · rest {plannedWorkout.intervals.restLabel}
            </Text>
          ) : null}
        </>
      ) : null}
    </View>
  ) : null;

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

  useEffect(() => {
    if (!isActive || isPaused || !heartRateBpm || zoneStatus.guidance !== 'high' || zoneStatus.tone !== 'out') return;
    const now = Date.now();
    if (now - lastHrAlertRef.current < 2 * 60 * 1000) return;
    lastHrAlertRef.current = now;
    const message = `Heart rate is ${zoneStatus.detail}. Slow down slightly to return to Zone ${targetZone}.`;
    speakCue(message);
    sendRunAlertNotification(message).catch(() => undefined);
  }, [heartRateBpm, isActive, isPaused, zoneStatus.detail, zoneStatus.guidance, zoneStatus.tone]);

  const activeReminderPlan = useMemo(() => calculateHydrationPlan({
    distanceMiles: plannerReminder.distanceMi,
    durationMin: plannerReminder.durationMin ?? 60,
    bodyWeightKg: plannerWeightKg,
    effort: plannerReminder.effort,
    weatherBand: weatherBandForTemp(plannerReminder.tempF),
    temperatureF: plannerReminder.tempF,
    humidityBand: plannerReminder.humidityPct >= 80 ? 'very_high' : plannerReminder.humidityPct >= 65 ? 'high' : plannerReminder.humidityPct < 35 ? 'low' : 'moderate',
    sweatiness: plannerReminder.sweatiness,
    sweatRateTestLh: plannerReminder.sweatRateMode === 'known' ? plannerReminder.sweatRateLh : undefined,
    saltiness: plannerReminder.saltiness,
    sweatSodiumMgL: plannerReminder.sweatSodiumMgL ?? undefined,
    cramping: plannerReminder.cramping,
    carbToleranceGh: plannerReminder.carbToleranceMode === 'known'
      ? plannerReminder.knownCarbToleranceGh ?? undefined
      : undefined,
    fluidComfort: plannerReminder.fluidComfort,
    goal: plannerReminder.goal,
  }), [plannerReminder, plannerWeightKg]);

  // Hydration and fuel are independent schedules. Simultaneous cues are merged.
  useEffect(() => {
    const cue = evaluateRunReminders({
      ...reminderCueRef.current,
      elapsedSeconds: elapsed,
      isActive,
      isPaused,
      hydrationEnabled: plannerReminder.hydrationReminderEnabled,
      hydrationIntervalMin: plannerReminder.hydrationReminderIntervalMin,
      fuelEnabled: plannerReminder.fuelReminderEnabled,
      fuelIntervalMin: plannerReminder.fuelReminderIntervalMin,
      fluidOzPerHour: activeReminderPlan.hourly.fluidOz,
      carbsGPerHour: activeReminderPlan.hourly.carbsG,
    });
    if (cue) {
      reminderCueRef.current = cue.nextState;
      speakCue(cue.spokenText);
      sendRunAlertNotification(cue.visualText).catch(() => undefined);
    }
  }, [activeReminderPlan.hourly.carbsG, activeReminderPlan.hourly.fluidOz, elapsed, isActive, isPaused, plannerReminder]);

  // Goal completion announcements (once per run)
  useEffect(() => {
    if (!isActive || goalDoneRef.current) return;
    if (runMode === 'time' && goalMinutes && elapsed >= goalMinutes * 60) {
      goalDoneRef.current = true;
      speakCue(`Time goal complete: ${goalMinutes} minutes. Finish whenever you're ready.`);
    } else if ((runMode === 'distance' || runMode === 'race') && goalMiles && distanceMiles >= goalMiles) {
      goalDoneRef.current = true;
      const goalDisplay = imp ? goalMiles : goalMiles * 1.609344;
      speakCue(runMode === 'race'
        ? 'Race distance complete. Strong execution.'
        : `Distance goal reached: ${Math.round(goalDisplay * 10) / 10} ${imp ? 'miles' : 'kilometers'}. Nice work.`);
    }
  }, [elapsed, distanceMiles, isActive, runMode, goalMinutes, goalMiles, imp]);

  useEffect(() => {
    if (!isActive) return;
    updateRunLiveActivity(liveActivitySnapshot).catch(() => undefined);
  }, [
    isActive,
    isPaused,
    elapsed,
    distanceMiles,
    avgPace,
    heartRateBpm,
    zoneStatus.label,
    zoneStatus.tone,
  ]);

  const mapNode = (followsUser: boolean) => (
    <MapView
      ref={activeMapRef}
      style={styles.activeRunMapFill}
      initialRegion={region}
      region={liveCoords.length > 0 ? region : undefined}
      customMapStyle={mapStyle}
      mapType={mapType}
      showsUserLocation
      followsUserLocation={followsUser}
    >
      {routeCoords.length > 1 ? (
        <Polyline coordinates={routeCoords} strokeColor={plannedRouteColor} strokeWidth={3} lineDashPattern={[8, 8]} />
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
        <Polyline coordinates={liveCoords} strokeColor={mapLineColor} strokeWidth={5} />
      ) : null}
      {liveCoords.length > 0 ? (
        <Marker coordinate={liveCoords[liveCoords.length - 1]} title="Current position" />
      ) : null}
    </MapView>
  );

  if (runState === 'paused') {
    return (
      <View style={[styles.activeRunRoot, { paddingTop: insets.top, backgroundColor: panelBg }]}>
        <View style={styles.activeMapShellFill}>
          {mapNode(false)}
        </View>
        <View style={[styles.runControlPanel, { backgroundColor: panelBg, borderTopColor: C.border, paddingBottom: insets.bottom + spacing.md }]}>
          <Text style={[styles.pausedStateLabel, { color: C.accent }]}>PAUSED</Text>
          <View style={styles.runPrimaryRow}>
            <View>
              <Text style={[styles.runPrimaryValue, { color: C.text }]}>{fmt(elapsed)}</Text>
              <Text style={[styles.runMetricLabel, { color: C.textMuted }]}>Time</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[styles.runPrimaryValue, { color: C.accent }]}>{distStr}<Text style={styles.runPrimaryUnit}> {distUnit}</Text></Text>
              <Text style={[styles.runMetricLabel, { color: C.textMuted }]}>Distance</Text>
            </View>
          </View>
          <View style={[styles.runDivider, { backgroundColor: C.border }]} />
          <View style={styles.runSecondaryRow}>
            {secondaryMetrics.map(metric => (
              <RunStat key={metric.label} {...metric} color={C.text} muted={C.textMuted} />
            ))}
          </View>
          {goalPanel}
          <View style={styles.runStatusChipRow}>
            <View style={[styles.runStatusChip, { backgroundColor: zoneToneColor + '22', borderColor: zoneToneColor }]}>
              <Text style={[styles.runStatusChipText, { color: zoneToneColor }]}>{zoneStatus.label} · {zoneStatus.detail}</Text>
            </View>
            <View style={[styles.runStatusChip, { backgroundColor: C.cardAlt, borderColor: C.border }]}>
              <Text style={[styles.runStatusChipText, { color: permission.background === 'granted' ? C.positive : C.warning }]}>
                GPS {permission.background === 'granted' ? 'Ready' : 'Setup'}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={[styles.resumePill, { backgroundColor: C.positive }]}
            onPress={resume}
            activeOpacity={0.82}
            accessibilityRole="button"
            accessibilityLabel="Resume run"
          >
            <Ionicons name="play" size={18} color={C.onPrimary} />
            <Text style={[styles.resumePillText, { color: C.onPrimary }]}>RESUME RUN</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.stopRunPill, { backgroundColor: C.critical }]}
            onPress={stop}
            activeOpacity={0.82}
            accessibilityRole="button"
            accessibilityLabel="Stop run"
          >
            <Ionicons name="stop-circle" size={18} color="#FFFFFF" />
            <Text style={styles.stopRunPillText}>STOP RUN</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.activeRunRoot, { paddingTop: fullScreen ? insets.top : 0, backgroundColor: panelBg }]}>
      <View style={styles.activeMapShellFill}>
        {mapNode(isActive)}
        <View style={styles.mapToolStack}>
          <TouchableOpacity
            style={[styles.mapToolButton, { backgroundColor: softPanelBg, borderColor: C.border }]}
            onPress={centerOnMyLocation}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Center map on my location"
          >
            <Ionicons name="navigate-outline" size={19} color={C.text} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.mapToolButton, { backgroundColor: mapType === 'hybrid' ? C.primaryDim : softPanelBg, borderColor: mapType === 'hybrid' ? C.primary : C.border }]}
            onPress={() => setMapType(t => (t === 'standard' ? 'hybrid' : 'standard'))}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Toggle satellite map"
          >
            <Ionicons name="layers-outline" size={19} color={mapType === 'hybrid' ? C.primary : C.text} />
          </TouchableOpacity>
        </View>
        {permission.background !== 'granted' ? (
          <View style={[styles.mapOverlay, { backgroundColor: mode === 'light' ? C.card : C.cardElevated }]}>
            <Ionicons name="location-outline" size={32} color={C.accent} />
            <Text style={[styles.mapOverlayTitle, { color: C.text }]}>
              Enable background location
            </Text>
            <Text style={[styles.mapOverlayCopy, { color: C.textMuted }]}>
              This lets StrideOS keep recording your route and distance when the phone locks.
            </Text>
            <TouchableOpacity
              style={[styles.mapOverlayBtn, { backgroundColor: C.primary }]}
              onPress={async () => setPermission(await requestTrackingPermissionState())}
              activeOpacity={0.8}
            >
              <Text style={[styles.mapOverlayButtonText, { color: C.onPrimary }]}>Enable GPS Tracking</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>

      <View style={[styles.runControlPanel, { backgroundColor: panelBg, borderTopColor: C.border, paddingBottom: (fullScreen ? insets.bottom : 0) + spacing.md }]}>
        <View style={styles.runPrimaryRow}>
          <View>
            <Text style={[styles.runPrimaryValue, { color: C.text }]}>{fmt(elapsed)}</Text>
            <Text style={[styles.runMetricLabel, { color: C.textMuted }]}>Time</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[styles.runPrimaryValue, { color: C.accent }]}>{distStr}<Text style={styles.runPrimaryUnit}> {distUnit}</Text></Text>
            <Text style={[styles.runMetricLabel, { color: C.textMuted }]}>Distance</Text>
          </View>
        </View>
        <View style={[styles.runDivider, { backgroundColor: C.border }]} />
        <View style={styles.runSecondaryRow}>
          {secondaryMetrics.map(metric => (
            <RunStat key={metric.label} {...metric} color={C.text} muted={C.textMuted} />
          ))}
        </View>
        {goalPanel}
        {runState === 'active' && heartRateBpm ? (
          <View style={styles.runStatusChipRow}>
            <View style={[styles.runStatusChip, { backgroundColor: zoneToneColor + '22', borderColor: zoneToneColor }]}>
              <Text style={[styles.runStatusChipText, { color: zoneToneColor }]}>{zoneStatus.label} · {zoneStatus.detail}</Text>
            </View>
          </View>
        ) : null}
        {runState === 'idle' ? (
          <>
            {/* Run mode selector */}
            <View style={styles.modeRow}>
              {RUN_MODE_OPTIONS.map(option => {
                const active = pendingMode === option.key;
                return (
                  <TouchableOpacity
                    key={option.key}
                    style={[
                      styles.modeChip,
                      {
                        backgroundColor: active ? C.primaryDim : C.cardAlt,
                        borderColor: active ? C.primary : C.border,
                      },
                    ]}
                    onPress={() => setPendingMode(option.key)}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel={`${option.label} run mode`}
                  >
                    <Ionicons name={option.icon} size={16} color={active ? C.primary : C.textMuted} />
                    <Text style={[styles.modeChipText, { color: active ? C.primary : C.textMuted }]}>{option.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={[styles.modeDesc, { color: C.textDim }]}>
              {RUN_MODE_OPTIONS.find(o => o.key === pendingMode)?.desc}
            </Text>

            {/* Mode configuration */}
            {pendingMode === 'time' ? (
              <TouchableOpacity
                style={[styles.goalConfigRow, { backgroundColor: C.cardAlt, borderColor: C.border }]}
                onPress={() => setGoalPickerFor('time')}
                activeOpacity={0.8}
              >
                <Text style={[styles.goalConfigLabel, { color: C.textMuted }]}>Duration</Text>
                <Text style={[styles.goalConfigValue, { color: C.text }]}>{goalMinutesInput} min ›</Text>
              </TouchableOpacity>
            ) : null}
            {pendingMode === 'distance' ? (
              <TouchableOpacity
                style={[styles.goalConfigRow, { backgroundColor: C.cardAlt, borderColor: C.border }]}
                onPress={() => setGoalPickerFor('distance')}
                activeOpacity={0.8}
              >
                <Text style={[styles.goalConfigLabel, { color: C.textMuted }]}>Distance</Text>
                <Text style={[styles.goalConfigValue, { color: C.text }]}>{goalMilesInput} {distUnit} ›</Text>
              </TouchableOpacity>
            ) : null}
            {pendingMode === 'race' ? (
              <>
                <TouchableOpacity
                  style={[styles.goalConfigRow, { backgroundColor: C.cardAlt, borderColor: C.border }]}
                  onPress={() => setGoalPickerFor('raceDist')}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.goalConfigLabel, { color: C.textMuted }]}>Race distance</Text>
                  <Text style={[styles.goalConfigValue, { color: C.text }]}>{raceMilesInput} {distUnit} ›</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.goalConfigRow, { backgroundColor: C.cardAlt, borderColor: C.border }]}
                  onPress={() => setGoalPickerFor('racePace')}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.goalConfigLabel, { color: C.textMuted }]}>Target pace</Text>
                  <Text style={[styles.goalConfigValue, { color: C.text }]}>{paceLabel(racePaceSecInput)} {imp ? '/mi' : '/km'} ›</Text>
                </TouchableOpacity>
                <Text style={[styles.modeDesc, { color: C.textDim }]}>
                  Goal finish ~{fmtClockDuration(raceMilesInput * racePaceSecInput)} · hydration every {plannerReminder.hydrationReminderIntervalMin} min · fuel every {plannerReminder.fuelReminderIntervalMin} min
                </Text>
              </>
            ) : null}
            {pendingMode === 'workout' ? (
              todayPlannedWorkout ? (
                <View style={[styles.goalConfigRow, { backgroundColor: C.cardAlt, borderColor: C.border }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.goalConfigValue, { color: C.text }]}>{todayPlannedWorkout.title}</Text>
                    <Text style={[styles.goalConfigLabel, { color: C.textMuted }]} numberOfLines={2}>
                      {todayPlannedWorkout.purpose}
                    </Text>
                  </View>
                </View>
              ) : (
                <Text style={[styles.modeDesc, { color: C.textDim }]}>
                  No structured workout planned today — starting will track a free run instead.
                </Text>
              )
            ) : null}

            <TouchableOpacity
              style={[styles.startRunPill, { backgroundColor: C.primary }]}
              onPress={start}
              activeOpacity={0.82}
              accessibilityRole="button"
              accessibilityLabel="Start run"
            >
              <Ionicons name="play" size={20} color={C.onPrimary} />
              <Text style={[styles.resumePillText, { color: C.onPrimary }]}>
                {pendingMode === 'race' ? 'START RACE' : 'START RUN'}
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity
              style={[styles.pauseCircle, { backgroundColor: C.primary }]}
              onPress={pause}
              activeOpacity={0.82}
              accessibilityRole="button"
              accessibilityLabel="Pause run"
            >
              <Ionicons name="pause" size={28} color={C.onPrimary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.stopRunPill, { backgroundColor: C.critical }]}
              onPress={stop}
              activeOpacity={0.82}
              accessibilityRole="button"
              accessibilityLabel="Stop run"
            >
              <Ionicons name="stop-circle" size={18} color="#FFFFFF" />
              <Text style={styles.stopRunPillText}>STOP RUN</Text>
            </TouchableOpacity>
          </>
        )}
        {!isActive ? (
          <View style={styles.activeMetaRow}>
            <Text style={[styles.activeMetaText, { color: C.textMuted }]}>
              GPS ready when background permission is enabled.
            </Text>
          </View>
        ) : null}
        {selectedRoute && nextSegment ? (
          <TouchableOpacity
            style={[styles.relocatedRoutePanel, { backgroundColor: C.cardAlt, borderColor: C.border }]}
            onPress={() => setShowRouteActions(true)}
            accessibilityRole="button"
            accessibilityLabel={`Route actions for ${selectedRoute.name}`}
          >
            <Text style={[styles.metricLabel, { color: C.textDim }]}>NEXT SEGMENT</Text>
            <Text style={[styles.routeProgressTitle, { color: C.text }]}>
              Segment {nextSegment.label} · {Math.max(0, nextSegment.distanceMiles - routeProgress).toFixed(2)} mi away
            </Text>
            <Text style={[styles.metricUnit, { color: C.textMuted }]}>
              {routeProgress.toFixed(2)} / {selectedRoute.distanceMiles.toFixed(1)} mi route progress
            </Text>
            <Ionicons name="ellipsis-horizontal-circle-outline" size={20} color={C.primary} style={{ position: 'absolute', right: 12, top: 12 }} />
          </TouchableOpacity>
        ) : selectedRoute ? (
          <TouchableOpacity
            style={[styles.relocatedRoutePanel, { backgroundColor: C.cardAlt, borderColor: C.border }]}
            onPress={() => setShowRouteActions(true)}
            accessibilityRole="button"
            accessibilityLabel={`Route actions for ${selectedRoute.name}`}
          >
            <Text style={[styles.metricLabel, { color: C.textDim }]}>SELECTED ROUTE</Text>
            <Text style={[styles.routeProgressTitle, { color: C.text }]}>{selectedRoute.name}</Text>
            <Text style={[styles.metricUnit, { color: C.textMuted }]}>
              {selectedRoute.distanceMiles.toFixed(1)} mi · +{selectedRoute.elevationGainFt} ft · {selectedRoute.estimatedMinutes} min
            </Text>
            <Ionicons name="ellipsis-horizontal-circle-outline" size={20} color={C.primary} style={{ position: 'absolute', right: 12, top: 12 }} />
          </TouchableOpacity>
        ) : null}
      </View>

      <Modal visible={showRouteActions} transparent animationType="slide" onRequestClose={() => setShowRouteActions(false)}>
        <TouchableOpacity style={styles.pointMenuOverlay} activeOpacity={1} onPress={() => setShowRouteActions(false)}>
          <View style={[styles.pointMenuSheet, { backgroundColor: C.card, borderColor: C.border, paddingBottom: insets.bottom + 18 }]}>
            <Text style={[styles.subTitle, { color: C.text }]}>{selectedRoute?.name}</Text>
            <Text style={[styles.metricUnit, { color: C.textMuted, marginBottom: 8 }]}>
              {selectedRoute?.distanceMiles.toFixed(1)} mi · {routeAttachment.direction === 'reverse' ? 'Reversed' : 'Forward'}
            </Text>
            <TouchableOpacity
              style={[styles.pointMenuRow, { borderBottomColor: C.border }]}
              onPress={() => {
                setShowRouteActions(false);
                if (selectedRoute) router.push({ pathname: '/(tabs)/training/route-detail', params: { routeId: selectedRoute.id } } as never);
              }}
            >
              <Text style={{ color: C.text, fontWeight: '700' }}>View Route Details</Text>
              <Ionicons name="chevron-forward" size={18} color={C.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.pointMenuRow, { borderBottomColor: C.border }]}
              onPress={() => { reverseAttachedRoute(); setShowRouteActions(false); }}
            >
              <Text style={{ color: C.text, fontWeight: '700' }}>Reverse Route</Text>
              <Ionicons name="swap-horizontal-outline" size={19} color={C.primary} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.pointMenuRow, { borderBottomColor: C.border }]} onPress={removeRouteFromToday}>
              <Text style={{ color: C.critical, fontWeight: '700' }}>Remove From Today&apos;s Run</Text>
              <Ionicons name="remove-circle-outline" size={19} color={C.critical} />
            </TouchableOpacity>
            <TouchableOpacity style={{ paddingVertical: 14, alignItems: 'center' }} onPress={() => setShowRouteActions(false)}>
              <Text style={{ color: C.textMuted, fontWeight: '700' }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Goal pickers */}
      <PickerWheel
        visible={goalPickerFor === 'time'}
        title="Run duration (minutes)"
        values={TIME_GOAL_VALUES}
        selectedValue={goalMinutesInput}
        formatValue={v => `${v} min`}
        onConfirm={v => { setGoalMinutesInput(v); setGoalPickerFor(null); }}
        onClose={() => setGoalPickerFor(null)}
      />
      <PickerWheel
        visible={goalPickerFor === 'distance'}
        title={`Run distance (${distUnit})`}
        values={DISTANCE_GOAL_VALUES}
        selectedValue={goalMilesInput}
        formatValue={v => `${v} ${distUnit}`}
        onConfirm={v => { setGoalMilesInput(v); setGoalPickerFor(null); }}
        onClose={() => setGoalPickerFor(null)}
      />
      <PickerWheel
        visible={goalPickerFor === 'raceDist'}
        title={`Race distance (${distUnit})`}
        values={DISTANCE_GOAL_VALUES}
        selectedValue={raceMilesInput}
        formatValue={v => `${v} ${distUnit}`}
        onConfirm={v => { setRaceMilesInput(v); setGoalPickerFor(null); }}
        onClose={() => setGoalPickerFor(null)}
      />
      <PickerWheel
        visible={goalPickerFor === 'racePace'}
        title={`Target pace (${imp ? 'per mile' : 'per km'})`}
        values={RACE_PACE_VALUES}
        selectedValue={racePaceSecInput}
        formatValue={v => `${paceLabel(v)} ${imp ? '/mi' : '/km'}`}
        onConfirm={v => { setRacePaceSecInput(v); setGoalPickerFor(null); }}
        onClose={() => setGoalPickerFor(null)}
      />
    </View>
  );
}

// ─── Hydration Tab ────────────────────────────────────────────────────────────
function HydrationTabLegacy() {
  const C = useColors();
  const router = useRouter();
  const { units } = useSettingsStore();
  const weightKg = useOnboardingStore(s => s.data.weightKg || 70);
  const imp = units === 'imperial';
  const wtUnit = imp ? 'lbs' : 'kg';
  const distUnit = imp ? 'mi' : 'km';
  const [runType, setRunType] = useState<'Easy' | 'Long' | 'Workout' | 'Race'>('Long');
  const [goal, setGoal] = useState<HydrationGoal>('strong');
  const [distanceInput, setDistanceInput] = useState('8');
  const [durationInput, setDurationInput] = useState('90');
  const [tempInput, setTempInput] = useState('65');
  const [humidity, setHumidity] = useState<number | null>(null);
  const [weatherBusy, setWeatherBusy] = useState(false);
  const [weatherNote, setWeatherNote] = useState('Manual temp');
  const [effort, setEffort] = useState(5);
  const [sweatiness, setSweatiness] = useState<Sweatiness>('average');
  const [saltiness, setSaltiness] = useState<Saltiness>('moderate');
  const [cramping, setCramping] = useState<CrampingFrequency>('rarely');
  const [fluidComfort, setFluidComfort] = useState<FluidComfort>('moderate');
  const [carbTolerance, setCarbTolerance] = useState('60');
  const [sweatRate, setSweatRate] = useState('');
  const [sweatSodium, setSweatSodium] = useState('');
  const [preWt, setPreWt] = useState('');
  const [postWt, setPostWt] = useState('');
  const [waterOz, setWaterOz] = useState('');
  const [result, setResult] = useState<string | null>(null);

  const distance = Math.max(0, Number(distanceInput) || 0);
  const distanceMiles = imp ? distance : distance / 1.609344;
  const durationMin = Math.max(10, Math.round(Number(durationInput) || 90));
  const tempF = Math.max(20, Math.min(115, Math.round(Number(tempInput) || 65)));
  const hydrationInput = useMemo(() => ({
    distanceMiles,
    durationMin,
    bodyWeightKg: weightKg,
    effort,
    weatherBand: weatherBandForTemp(tempF),
    temperatureF: tempF,
    humidityBand: (humidity === null ? 'moderate' : humidity >= 80 ? 'very_high' : humidity >= 60 ? 'high' : humidity <= 35 ? 'low' : 'moderate') as 'moderate' | 'very_high' | 'high' | 'low',
    sunExposure: 'mixed' as const,
    sweatiness,
    saltiness,
    cramping,
    fluidComfort,
    carbToleranceGh: Number(carbTolerance) || undefined,
    sweatRateTestLh: Number(sweatRate) || undefined,
    sweatSodiumMgL: Number(sweatSodium) || undefined,
    goal,
  }), [
    carbTolerance, cramping, distanceMiles, durationMin, effort, fluidComfort,
    goal, humidity, saltiness, sweatRate, sweatiness, sweatSodium, tempF, weightKg,
  ]);
  const fuelPlan = useMemo(() => calculateHydrationPlan(hydrationInput), [hydrationInput]);
  const planWhy = useMemo(() => explainPlan(hydrationInput, fuelPlan), [hydrationInput, fuelPlan]);

  function fluidRangeLabel(lowL: number, highL: number) {
    return imp
      ? `${Math.round(lowL * 33.814)}-${Math.round(highL * 33.814)} oz/hr`
      : `${Math.round(lowL * 1000)}-${Math.round(highL * 1000)} mL/hr`;
  }

  function fluidTotalLabel(liters: number) {
    return imp ? `${Math.round(liters * 33.814)} oz` : `${liters.toFixed(1)} L`;
  }

  function SelectPills<T extends string>({
    value, options, onChange,
  }: {
    value: T;
    options: { label: string; value: T }[];
    onChange: (value: T) => void;
  }) {
    return (
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, flex: 1 }}>
        {options.map(option => {
          const active = option.value === value;
          return (
            <TouchableOpacity
              key={option.value}
              onPress={() => onChange(option.value)}
              style={{
                paddingHorizontal: 9,
                paddingVertical: 7,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: active ? C.primary : C.border,
                backgroundColor: active ? C.primaryDim : C.cardAlt,
              }}
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: 11, fontWeight: '800', color: active ? C.primary : C.textMuted }}>
                {option.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
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
    const sweatLh = Math.max(0, (netLost / 33.814) / Math.max(0.25, durationMin / 60));
    setSweatRate(sweatLh.toFixed(2));
    setResult(`Estimated sweat rate: ${sweatLh.toFixed(2)} L/hr. The plan above now uses this value as a stronger personalization input.`);
  }

  return (
    <ScrollView contentContainerStyle={styles.runScrollContent} showsVerticalScrollIndicator={false}>
      <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
        <View style={styles.cardHeaderRow}>
          <Text style={[styles.cardLabel, { color: C.textDim }]}>RUN HYDRATION PLANNER</Text>
          <TouchableOpacity onPress={useCurrentWeather} disabled={weatherBusy} activeOpacity={0.8}>
            <Text style={[{ fontSize: 11, fontWeight: '800', color: C.primary }]}>
              {weatherBusy ? 'Loading...' : 'Use location'}
            </Text>
          </TouchableOpacity>
        </View>
        <View style={{ gap: 8 }}>
          <View style={styles.inputRow}>
            <Text style={[{ fontSize: 12, color: C.textMuted, width: 110 }]}>Run type</Text>
            <SelectPills
              value={runType}
              onChange={setRunType}
              options={[
                { label: 'Easy', value: 'Easy' },
                { label: 'Long', value: 'Long' },
                { label: 'Workout', value: 'Workout' },
                { label: 'Race', value: 'Race' },
              ]}
            />
          </View>
          <View style={styles.inputRow}>
            <Text style={[{ fontSize: 12, color: C.textMuted, width: 110 }]}>Distance</Text>
            <TextInput
              value={distanceInput}
              onChangeText={setDistanceInput}
              keyboardType="numeric"
              placeholder="8"
              placeholderTextColor={C.textDim}
              style={[styles.input, { backgroundColor: C.cardAlt, borderColor: C.border, color: C.text }]}
            />
            <Text style={[{ fontSize: 12, color: C.textDim }]}>{distUnit}</Text>
          </View>
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
          {weatherNote}{humidity !== null ? ` · Humidity ${humidity}%` : ''} · {fuelPlan.confidence.label}
        </Text>
      </View>

      <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
        <Text style={[styles.cardLabel, { color: C.textDim }]}>EFFORT + CONDITIONS</Text>
        <View style={{ gap: 10, marginTop: 8 }}>
          <View style={styles.inputRow}>
            <Text style={[{ fontSize: 12, color: C.textMuted, width: 110 }]}>Effort</Text>
            <TouchableOpacity style={[styles.stepBtn, { backgroundColor: C.cardAlt }]} onPress={() => setEffort(v => Math.max(1, v - 1))}>
              <Ionicons name="remove" size={16} color={C.text} />
            </TouchableOpacity>
            <Text style={[{ minWidth: 44, textAlign: 'center', fontSize: 16, fontWeight: '900', color: C.text }]}>{effort}/10</Text>
            <TouchableOpacity style={[styles.stepBtn, { backgroundColor: C.cardAlt }]} onPress={() => setEffort(v => Math.min(10, v + 1))}>
              <Ionicons name="add" size={16} color={C.text} />
            </TouchableOpacity>
          </View>
          <View style={styles.inputRow}>
            <Text style={[{ fontSize: 12, color: C.textMuted, width: 110 }]}>Goal</Text>
            <SelectPills
              value={goal}
              onChange={setGoal}
              options={[
                { label: 'Finish', value: 'finish' },
                { label: 'Strong', value: 'strong' },
                { label: 'Race', value: 'race_limit' },
              ]}
            />
          </View>
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
        <Text style={[styles.cardLabel, { color: C.textDim }]}>YOUR SWEAT PROFILE</Text>
        <View style={{ gap: 10, marginTop: 8 }}>
          <View style={styles.inputRow}>
            <Text style={[{ fontSize: 12, color: C.textMuted, width: 110 }]}>Sweatiness</Text>
            <SelectPills
              value={sweatiness}
              onChange={setSweatiness}
              options={[
                { label: 'Low', value: 'low' },
                { label: 'Average', value: 'average' },
                { label: 'High', value: 'high' },
                { label: 'Very high', value: 'very_high' },
              ]}
            />
          </View>
          <View style={styles.inputRow}>
            <Text style={[{ fontSize: 12, color: C.textMuted, width: 110 }]}>Saltiness</Text>
            <SelectPills
              value={saltiness}
              onChange={setSaltiness}
              options={[
                { label: 'Low', value: 'low' },
                { label: 'Moderate', value: 'moderate' },
                { label: 'Salty', value: 'salty' },
                { label: 'Very salty', value: 'very_salty' },
              ]}
            />
          </View>
          <View style={styles.inputRow}>
            <Text style={[{ fontSize: 12, color: C.textMuted, width: 110 }]}>Cramping</Text>
            <SelectPills
              value={cramping}
              onChange={setCramping}
              options={[
                { label: 'Never', value: 'never' },
                { label: 'Rarely', value: 'rarely' },
                { label: 'Sometimes', value: 'sometimes' },
                { label: 'Often', value: 'often' },
              ]}
            />
          </View>
          <View style={styles.inputRow}>
            <Text style={[{ fontSize: 12, color: C.textMuted, width: 110 }]}>Sweat rate</Text>
            <TextInput
              value={sweatRate}
              onChangeText={setSweatRate}
              keyboardType="numeric"
              placeholder="optional"
              placeholderTextColor={C.textDim}
              style={[styles.input, { backgroundColor: C.cardAlt, borderColor: C.border, color: C.text }]}
            />
            <Text style={[{ fontSize: 12, color: C.textDim }]}>L/hr</Text>
          </View>
          <View style={styles.inputRow}>
            <Text style={[{ fontSize: 12, color: C.textMuted, width: 110 }]}>Sweat sodium</Text>
            <TextInput
              value={sweatSodium}
              onChangeText={setSweatSodium}
              keyboardType="numeric"
              placeholder="optional"
              placeholderTextColor={C.textDim}
              style={[styles.input, { backgroundColor: C.cardAlt, borderColor: C.border, color: C.text }]}
            />
            <Text style={[{ fontSize: 12, color: C.textDim }]}>mg/L</Text>
          </View>
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
        <Text style={[styles.cardLabel, { color: C.textDim }]}>GUT + CARRY PLAN</Text>
        <View style={{ gap: 10, marginTop: 8 }}>
          <View style={styles.inputRow}>
            <Text style={[{ fontSize: 12, color: C.textMuted, width: 110 }]}>Carb tolerance</Text>
            <TextInput
              value={carbTolerance}
              onChangeText={setCarbTolerance}
              keyboardType="number-pad"
              placeholder="60"
              placeholderTextColor={C.textDim}
              style={[styles.input, { backgroundColor: C.cardAlt, borderColor: C.border, color: C.text }]}
            />
            <Text style={[{ fontSize: 12, color: C.textDim }]}>g/hr</Text>
          </View>
          <View style={styles.inputRow}>
            <Text style={[{ fontSize: 12, color: C.textMuted, width: 110 }]}>Fluid comfort</Text>
            <SelectPills
              value={fluidComfort}
              onChange={setFluidComfort}
              options={[
                { label: 'Small sips', value: 'low' },
                { label: 'Moderate', value: 'moderate' },
                { label: 'Drink well', value: 'high' },
              ]}
            />
          </View>
          <Text style={[{ fontSize: 11, color: C.textDim, lineHeight: 17 }]}>
            Use bottles, gels, drink mix, or aid stations. Count carbs and sodium separately even when one product contains both.
          </Text>
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
        <Text style={[styles.cardLabel, { color: C.textDim }]}>TARGET RANGES FOR THIS RUN</Text>
        <View style={styles.fuelGrid}>
          <View style={[styles.fuelCell, { backgroundColor: C.cardAlt }]}>
            <Text style={[styles.metricLabel, { color: C.textDim }]}>CARBS</Text>
            <Text style={[styles.fuelValue, { color: C.text }]}>{fuelPlan.range.carbsLowG}-{fuelPlan.range.carbsHighG} g/hr</Text>
            <Text style={[styles.metricUnit, { color: C.textMuted }]}>{fuelPlan.totals.carbsG} g total</Text>
          </View>
          <View style={[styles.fuelCell, { backgroundColor: C.cardAlt }]}>
            <Text style={[styles.metricLabel, { color: C.textDim }]}>FLUID</Text>
            <Text style={[styles.fuelValue, { color: C.text }]}>{fluidRangeLabel(fuelPlan.range.fluidLowL, fuelPlan.range.fluidHighL)}</Text>
            <Text style={[styles.metricUnit, { color: C.textMuted }]}>{fluidTotalLabel(fuelPlan.totals.fluidL)} total</Text>
          </View>
          <View style={[styles.fuelCell, { backgroundColor: C.primaryDim, borderWidth: 1, borderColor: C.primary }]}>
            <Text style={[styles.metricLabel, { color: C.textDim }]}>SODIUM</Text>
            <Text style={[styles.fuelValue, { color: C.primary }]}>{fuelPlan.range.sodiumLowMg}-{fuelPlan.range.sodiumHighMg} mg/hr</Text>
            <Text style={[styles.metricUnit, { color: C.textMuted }]}>{fuelPlan.totals.sodiumMg} mg total</Text>
          </View>
        </View>
        <View style={[styles.paceBox, { backgroundColor: C.cardAlt, marginTop: 10 }]}>
          <Text style={[{ fontSize: 12, color: C.textMuted, lineHeight: 18 }]}>
            Start target: {fuelPlan.hourly.carbsG} g carbs/hr · {fuelPlan.hourly.fluidOz} oz fluid/hr · {fuelPlan.hourly.sodiumMg} mg sodium/hr.
            Drink sodium concentration: {fuelPlan.hourly.sodiumMgPerL} mg/L.
          </Text>
        </View>
        <View style={[styles.paceBox, { backgroundColor: C.primaryDim, borderWidth: 1, borderColor: C.primary, marginTop: 10 }]}>
          <Text style={[{ fontSize: 10, fontWeight: '700', color: C.primary, letterSpacing: 0.7, marginBottom: 4 }]}>WHY THESE TARGETS</Text>
          <Text style={[{ fontSize: 12, color: C.textMuted, lineHeight: 18 }]}>{planWhy}</Text>
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
        <Text style={[styles.subTitle, { color: C.text, marginBottom: 10 }]}>Before, During, After</Text>
        <Text style={[{ fontSize: 12, color: C.textMuted, lineHeight: 19 }]}>
          Before: {fuelPlan.preRun ? `${fuelPlan.preRun.fluidMl[0]}-${fuelPlan.preRun.fluidMl[1]} mL with sodium ${fuelPlan.preRun.timing}` : 'Start normally hydrated. No special preload needed.'}
        </Text>
        <Text style={[{ fontSize: 12, color: C.textMuted, lineHeight: 19, marginTop: 6 }]}>
          During: {fuelPlan.execution.join(' ')}
        </Text>
        <Text style={[{ fontSize: 12, color: C.textMuted, lineHeight: 19, marginTop: 6 }]}>
          After: Rehydrate about {fuelPlan.postRun.estimatedFluidL[0]}-{fuelPlan.postRun.estimatedFluidL[1]} L over the next few hours. Include sodium or salty food.
        </Text>
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

      <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
        <Text style={[styles.subTitle, { color: C.text, marginBottom: 6 }]}>Warnings + Confidence</Text>
        <Text style={[{ fontSize: 12, color: C.textMuted, lineHeight: 19 }]}>
          Sweat rate: {fuelPlan.physiology.sweatRateLh} L/hr · Sweat sodium: {fuelPlan.physiology.sweatSodiumMgL} mg/L · Confidence: {fuelPlan.confidence.score}/100
        </Text>
        {[...fuelPlan.warnings, ...fuelPlan.notes].slice(0, 5).map(item => (
          <Text key={item} style={[{ fontSize: 12, color: C.textMuted, lineHeight: 19, marginTop: 6 }]}>• {item}</Text>
        ))}
        <Text style={[{ fontSize: 11, color: C.textDim, lineHeight: 17, marginTop: 8 }]}>
          This is a performance-planning estimate, not medical advice. Test it in training and do not force fluid beyond thirst or gut comfort.
        </Text>
      </View>
    </ScrollView>
  );
}

function HydrationTab() {
  return <HydrationPlannerScreen embedded />;
}

// ─── Routes Tab ───────────────────────────────────────────────────────────────
function RoutesTab({ onStartRoute }: { onStartRoute: () => void }) {
  const C = useColors();
  const router = useRouter();
  const { units } = useSettingsStore();
  const imp = units === 'imperial';
  const isActive = useActiveRunStore(s => s.isActive);
  const startRun = useActiveRunStore(s => s.startRun);
  const cancelRun = useActiveRunStore(s => s.cancelRun);
  const routes = useRouteStore(s => s.routes);
  const selectedRouteId = useRouteStore(s => s.selectedRouteId);
  const attachRoute = useRouteStore(s => s.attachRoute);
  const [expanded, setExpanded] = useState<string | null>(selectedRouteId);
  const [folderFilter, setFolderFilter] = useState<RunRoute['folder'] | 'all'>('all');

  const filteredRoutes = routes.filter(route => folderFilter === 'all' || route.folder === folderFilter);

  async function startRoute(route: RunRoute) {
    attachRoute(route.id);
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
      {/* Full-screen Route Builder: the single route-creation entry point.
          (The old inline builder was removed as redundant — Build 31.) */}
      <TouchableOpacity
            style={[styles.card, { backgroundColor: C.primaryDim, borderColor: C.primary, flexDirection: 'row', alignItems: 'center', gap: 12 }]}
            onPress={() => router.push('/(tabs)/training/route-builder' as any)}
            activeOpacity={0.85}
          >
            <Ionicons name="map-outline" size={22} color={C.primary} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.subTitle, { color: C.text }]}>Route Builder</Text>
              <Text style={[{ fontSize: 11, color: C.textMuted, marginTop: 2 }]}>
                Snap-to-path routing, draggable points, elevation, and saved route details.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={C.primary} />
          </TouchableOpacity>

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
                {r.elevationProfileFt && r.elevationProfileFt.length >= 2 ? (
                  <ElevationProfile profile={r.elevationProfileFt} color={C.primary} />
                ) : (
                  <ElevationPlaceholder />
                )}
              </View>
              <TouchableOpacity
                style={[styles.bigBtn, { backgroundColor: C.primary }]}
                onPress={() => startRoute(r)}
                activeOpacity={0.8}
              >
                <Text style={[styles.bigBtnText, { color: C.onPrimary }]}>Start on This Route</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.bigBtn, { backgroundColor: C.cardAlt, marginTop: 8 }]}
                onPress={() => router.push({ pathname: '/(tabs)/training/route-detail', params: { routeId: r.id } } as any)}
                activeOpacity={0.8}
              >
                <Text style={[styles.bigBtnText, { color: C.text }]}>View Details</Text>
              </TouchableOpacity>
            </View>
          )}
        </TouchableOpacity>
            );
          })}
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
  const routeAttachment = useRouteStore(s => s.routeAttachment);
  const attachedRoute = useRouteStore(s => s.routes.find(r => r.id === s.routeAttachment.routeId) ?? null);
  const selectedRoute = effectiveAttachedRoute(attachedRoute, routeAttachment);
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
  const navigation = useNavigation();
  const [tab, setTab] = useState<RunTab>('plan');
  const isActive = useActiveRunStore(s => s.isActive);
  const isPaused = useActiveRunStore(s => s.isPaused);
  const isRunning = isActive || isPaused;

  const TABS: { key: RunTab; label: string }[] = [
    { key: 'plan',      label: 'Plan' },
    { key: 'active',    label: 'Active' },
    { key: 'hydration', label: 'Hydration' },
    { key: 'routes',    label: 'Routes' },
  ];

  // While a run is active/paused, hand the whole screen over to the tracking
  // UI: hide this screen's own header/sub-tab chrome and the app's bottom
  // tab bar so it behaves like a native full-screen run tracker.
  useEffect(() => {
    const parent = navigation.getParent();
    if (!parent) return;
    parent.setOptions({ tabBarStyle: isRunning ? { display: 'none' } : undefined });
    return () => parent.setOptions({ tabBarStyle: undefined });
  }, [isRunning, navigation]);

  if (isRunning) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <ActiveTab onFinished={() => setTab('plan')} fullScreen />
      </View>
    );
  }

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
      <View style={{ flex: 1, paddingHorizontal: 16, paddingBottom: LAYOUT.tabBarPadBottom }}>
        {tab === 'plan'      && <PlanTab />}
        {tab === 'active'    && <ActiveTab onFinished={() => setTab('plan')} />}
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
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '600',
    fontFamily: 'CormorantGaramond_700Bold',
  },
  subTabBar: {
    flexDirection: 'row',
    marginHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    padding: 4,
    gap: 4,
    marginBottom: 16,
  },
  subTab: {
    flex: 1,
    height: 30,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subTabText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  runScrollContent: {
    paddingBottom: LAYOUT.screenPadBottom,
  },
  activeRunRoot: {
    flex: 1,
    overflow: 'hidden',
  },
  activeMapShellFill: {
    flex: 1,
  },
  activeRunMapFill: {
    flex: 1,
    width: '100%',
  },
  mapToolStack: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    gap: spacing.sm,
  },
  mapToolButton: {
    width: MAP_TOOL_SIZE,
    height: MAP_TOOL_SIZE,
    borderRadius: MAP_TOOL_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  runControlPanel: {
    marginTop: -radiusTokens.lg,
    borderTopLeftRadius: radiusTokens.xl,
    borderTopRightRadius: radiusTokens.xl,
    borderTopWidth: 1,
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
  },
  runPrimaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: spacing.xl,
  },
  runPrimaryValue: {
    fontSize: typographyTokens.sizes.metricPrimary,
    lineHeight: Math.round(typographyTokens.sizes.metricPrimary * 1.12),
    fontWeight: typographyTokens.weights.black,
    fontVariant: typographyTokens.variants.tabular,
  },
  runPrimaryUnit: {
    fontSize: typographyTokens.sizes.rowLabel,
    fontWeight: typographyTokens.weights.bold,
  },
  runMetricLabel: {
    fontSize: typographyTokens.sizes.metricLabel,
    fontWeight: typographyTokens.weights.bold,
    marginTop: spacing.xs / 2,
  },
  runDivider: {
    height: 1,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  runSecondaryRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  runStatCell: {
    flex: 1,
    minWidth: 0,
  },
  runSecondaryValue: {
    fontSize: typographyTokens.sizes.rowLabel,
    lineHeight: Math.round(typographyTokens.sizes.rowLabel * typographyTokens.lineHeights.normal),
    fontWeight: typographyTokens.weights.black,
    fontVariant: typographyTokens.variants.tabular,
  },
  runSecondaryUnit: {
    fontSize: typographyTokens.sizes.metricLabel,
    fontWeight: typographyTokens.weights.bold,
  },
  runStatusChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  runStatusChip: {
    borderWidth: 1,
    borderRadius: radiusTokens.pill,
    paddingHorizontal: spacing.sm + spacing.xs / 2,
    paddingVertical: spacing.xs + 1,
  },
  runStatusChipText: {
    fontSize: typographyTokens.sizes.metricLabel,
    fontWeight: typographyTokens.weights.black,
  },
  modeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs + 2,
    marginTop: spacing.md,
  },
  modeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: radiusTokens.pill,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 2,
  },
  modeChipText: {
    fontSize: typographyTokens.sizes.metricLabel,
    fontWeight: typographyTokens.weights.black,
  },
  modeDesc: {
    fontSize: 11,
    lineHeight: 16,
    marginTop: spacing.xs + 2,
  },
  goalConfigRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radiusTokens.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    marginTop: spacing.sm,
  },
  goalConfigLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  goalConfigValue: {
    fontSize: 14,
    fontWeight: '800',
  },
  goalPanel: {
    borderWidth: 1,
    borderRadius: radiusTokens.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    marginTop: spacing.md,
    gap: 6,
  },
  goalPanelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  goalPanelPct: {
    fontSize: 12,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  goalProgressTrack: {
    height: 5,
    borderRadius: 3,
    overflow: 'hidden',
  },
  goalProgressFill: {
    height: '100%',
    borderRadius: 3,
  },
  goalPanelLine: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
  },
  pauseCircle: {
    width: RUN_PRIMARY_CONTROL_SIZE,
    height: RUN_PRIMARY_CONTROL_SIZE,
    borderRadius: RUN_PRIMARY_CONTROL_SIZE / 2,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  startRunPill: {
    height: 48,
    borderRadius: radiusTokens.md,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  activeMetaRow: {
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  activeMetaText: {
    fontSize: typographyTokens.sizes.metricLabel,
    lineHeight: Math.round(typographyTokens.sizes.metricLabel * typographyTokens.lineHeights.body),
  },
  relocatedRoutePanel: {
    borderWidth: 1,
    borderRadius: radiusTokens.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  pausedStateLabel: {
    fontSize: typographyTokens.sizes.metricLabel,
    fontWeight: typographyTokens.weights.black,
    letterSpacing: 0.8,
    marginBottom: spacing.xs,
  },
  resumePill: {
    height: 48,
    borderRadius: radiusTokens.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  resumePillText: {
    fontSize: typographyTokens.sizes.rowLabel,
    fontWeight: typographyTokens.weights.black,
  },
  stopRunPill: {
    height: 48,
    borderRadius: radiusTokens.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  stopRunPillText: {
    fontSize: typographyTokens.sizes.rowLabel,
    fontWeight: typographyTokens.weights.black,
    color: '#FFFFFF',
  },
  mapOverlayTitle: {
    fontSize: typographyTokens.sizes.helper,
    fontWeight: typographyTokens.weights.bold,
    marginTop: spacing.sm,
  },
  mapOverlayCopy: {
    fontSize: typographyTokens.sizes.metricLabel,
    textAlign: 'center',
    marginTop: spacing.xs,
    lineHeight: Math.round(typographyTokens.sizes.metricLabel * typographyTokens.lineHeights.body),
  },
  mapOverlayButtonText: {
    fontSize: typographyTokens.sizes.caption,
    fontWeight: typographyTokens.weights.black,
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
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  subTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  paceBox: {
    borderRadius: 10,
    padding: 12,
  },
  dayRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 10,
  },
  dayCol: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 8,
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
    borderRadius: 10,
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
    borderRadius: 10,
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
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockWidget: {
    borderRadius: 12,
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
    borderRadius: 10,
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
  stepBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
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
  elevationPlaceholder: {
    height: 60,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  travelModePill: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 7,
    alignItems: 'center',
  },
  futureActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    marginTop: 10,
    paddingTop: 10,
  },
  pointMenuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  pointMenuSheet: {
    borderWidth: 1,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 18,
  },
  pointMenuRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    paddingVertical: 12,
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
    borderRadius: 12,
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
