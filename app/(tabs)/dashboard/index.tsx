import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View, type DimensionValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, Line, Path, Polyline, Rect } from 'react-native-svg';

import { useColors } from '../../../src/theme/useColors';
import { useWeather } from '../../../src/hooks/useWeather';
import { formatTemp } from '../../../src/lib/weather';
import { useSettingsStore } from '../../../src/store/settingsStore';
import { useReadinessStore } from '../../../src/store/readinessStore';
import { useActivityStore } from '../../../src/store/activityStore';
import { useAchievementStore } from '../../../src/store/achievementStore';
import { useRecalculationStore } from '../../../src/store/recalculationStore';
import { todayDateKey } from '../../../src/types/checkin';
import ReadinessCheckInCard from '../../../src/components/today/ReadinessCheckInCard';
import { StreakBadge, StreakProgress, buildCurrentStreakSummary } from '../../../src/achievements/streaks';
import FeatureTourTarget from '../../../src/components/featureTour/FeatureTourTarget';
import { useFeatureTour } from '../../../src/components/featureTour/FeatureTourProvider';
import { LAYOUT } from '../../../src/constants/layout';
import { useWeekPlan } from '../../../src/hooks/useWeekPlan';
import { useScheduledSessions } from '../../../src/hooks/useScheduledSessions';
import { experienceModeAllows, useExperienceMode } from '../../../src/hooks/useExperienceMode';
import { actionLabelForScheduledSession, describeRunWalk } from '../../../src/utils/scheduledSessions';
import { activityTypeFromScheduledSession } from '../../../src/utils/activityCompletion';
import { US_AQI_BANDS, aqiVoiceOverLabel, getAqiScalePosition } from '../../../src/utils/aqi';
import { buildPerformanceForecast, buildTrainingOutlook, type PerformanceForecastMetric } from '../../../src/utils/trainingOutlook';
import { buildAchievementHubModel } from '../../../src/utils/achievements';

function lastUpdatedLabel(fetchedAt: number | null): string | null {
  if (fetchedAt === null) return null;
  const mins = Math.max(0, Math.round((Date.now() - fetchedAt) / 60000));
  if (mins < 1) return 'Updated just now';
  if (mins < 60) return `Updated ${mins}m ago`;
  return `Updated ${Math.round(mins / 60)}h ago`;
}

const SLEEP_QUALITY_LABELS: Record<number, string> = {
  1: 'Very poor',
  2: 'Poor',
  3: 'Fair',
  4: 'Good',
  5: 'Excellent',
};

const BODY_LABELS: Record<number, string> = {
  1: 'Very fatigued',
  2: 'Heavy or sore',
  3: 'A little stiff',
  4: 'Good',
  5: 'Fresh',
};

const ENERGY_LABELS: Record<number, string> = {
  1: 'Very low',
  2: 'Low',
  3: 'Normal',
  4: 'Good',
  5: 'High',
};

const STRESS_LABELS: Record<number, string> = {
  1: 'Very high',
  2: 'High',
  3: 'Moderate',
  4: 'Low',
  5: 'Very low',
};

function formatReadinessSleep(totalMinutes: number): string {
  const safe = Math.max(0, Math.round(Number.isFinite(totalMinutes) ? totalMinutes : 0));
  const hours = Math.floor(safe / 60);
  const minutes = safe % 60;
  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} hr`;
  return `${hours} hr ${minutes} min`;
}

function readinessChoiceLabel(labels: Record<number, string>, value: unknown): string {
  return typeof value === 'number' && labels[Math.round(value)] ? labels[Math.round(value)] : 'Not recorded';
}

function recentTrainingLabel(value: number): string {
  if (value >= 80) return 'Light';
  if (value >= 60) return 'Manageable';
  if (value >= 40) return 'Demanding';
  return 'High';
}

function forecastIconName(key: string): keyof typeof Ionicons.glyphMap {
  if (key === 'peak_window') return 'calendar-outline';
  if (key === 'race_readiness') return 'speedometer-outline';
  return 'analytics-outline';
}

function ForecastMiniChart({
  metric,
  color,
  positive,
  muted,
}: {
  metric: PerformanceForecastMetric;
  color: string;
  positive: string;
  muted: string;
}) {
  const values = metric.chartValues.length > 0 ? metric.chartValues : [0];
  const maxValue = Math.max(1, ...values);

  if (metric.key === 'peak_window') {
    const points = values.map((value, index) => {
      const x = 18 + (index * (112 / Math.max(1, values.length - 1)));
      const y = 42 - (Math.min(maxValue, value) / maxValue) * 28;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
    return (
      <Svg width="100%" height="100%" viewBox="0 0 148 56">
        <Line x1="14" y1="44" x2="134" y2="44" stroke={muted} strokeWidth="1.2" opacity={0.26} strokeLinecap="round" />
        <Rect x="74" y="12" width="34" height="34" rx="9" fill={color} opacity={0.12} />
        <Polyline points={points} stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity={0.78} />
        {points.split(' ').map(point => {
          const [x, y] = point.split(',');
          return <Circle key={point} cx={x} cy={y} r="3.2" fill={color} opacity={0.9} />;
        })}
      </Svg>
    );
  }

  if (metric.key === 'race_readiness') {
    const readiness = Math.min(100, Math.max(0, values[values.length - 1] ?? 0));
    const needleX = 74 + Math.cos(Math.PI - (readiness / 100) * Math.PI) * 42;
    const needleY = 44 - Math.sin((readiness / 100) * Math.PI) * 32;
    return (
      <Svg width="100%" height="100%" viewBox="0 0 148 56">
        <Path d="M24 44a50 50 0 0 1 100 0" stroke={muted} strokeWidth="6" opacity={0.22} fill="none" strokeLinecap="round" />
        <Path d={`M24 44a50 50 0 0 1 ${Math.max(24, Math.min(124, needleX + 16)).toFixed(1)} ${Math.max(10, needleY + 4).toFixed(1)}`} stroke={color} strokeWidth="6" opacity={0.58} fill="none" strokeLinecap="round" />
        <Line x1="74" y1="44" x2={needleX.toFixed(1)} y2={needleY.toFixed(1)} stroke={color} strokeWidth="3" opacity={0.86} strokeLinecap="round" />
        <Circle cx="74" cy="44" r="4.5" fill={color} opacity={0.9} />
        {values.slice(0, 4).map((value, index) => (
          <Rect key={`${metric.key}-${index}`} x={28 + index * 23} y={42 - Math.max(5, value / 3)} width="9" height={Math.max(5, value / 3)} rx="4.5" fill={color} opacity={0.22 + index * 0.13} />
        ))}
      </Svg>
    );
  }

  const bars = values.map((value, index) => {
    const height = 8 + (Math.min(maxValue, value) / maxValue) * 30;
    return { x: 32 + index * 34, y: 44 - height, height, key: `${index}-${value}` };
  });
  return (
    <Svg width="100%" height="100%" viewBox="0 0 148 56">
      <Line x1="10" y1="44" x2="138" y2="44" stroke={muted} strokeWidth="1.5" opacity={0.22} strokeLinecap="round" />
      {bars.map(bar => (
        <Rect key={bar.key} x={bar.x} y={bar.y} width="13" height={bar.height} rx="6.5" fill={positive} opacity={0.34 + bar.x / 360} />
      ))}
      <Polyline points={bars.map(bar => `${bar.x + 6.5},${bar.y}`).join(' ')} stroke={positive} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity={0.74} />
      <Path d="M24 42c23-2 34-8 51-6 21 2 35-12 53-15" stroke={positive} strokeWidth="9" opacity={0.08} fill="none" strokeLinecap="round" />
    </Svg>
  );
}

function cleanFeelLine(target: string | undefined, durationMinutes: number | undefined): string {
  const fallback = 'Easy and restorative';
  if (!target) return fallback;
  if (!durationMinutes) return target;
  return target
    .replace(new RegExp(`^${durationMinutes}\\s*min\\s*[-·:]\\s*`, 'i'), '')
    .replace(new RegExp(`^${durationMinutes}\\s*minutes\\s*[-·:]\\s*`, 'i'), '')
    .trim() || target;
}

// Live local weather card. Every displayed value is real fetched weather —
// on failure it shows the honest failure state (plus the last real reading
// flagged with its age) rather than substituting placeholder numbers.
function WeatherCard() {
  const C = useColors();
  const units = useSettingsStore(s => s.units);
  const { weather, status, loading, refreshing, isStale, fetchedAt, refresh } = useWeather();
  const [infoOpen, setInfoOpen] = useState(false);
  const aqiPositionPct: DimensionValue = weather?.aqi ? `${Math.round(getAqiScalePosition(weather.aqi.value) * 100)}%` : '0%';

  const statusLine =
    status === 'permission_denied'   ? 'Location access is off — StrideOS can’t read your local weather.'
    : status === 'location_unavailable' ? 'Couldn’t determine your location.'
    : status === 'service_unavailable'  ? 'Weather service unreachable.'
    : null;

  return (
    <View
      style={[styles.weatherCard, { backgroundColor: C.card, borderColor: C.border }]}
      accessibilityLabel="Weather and air quality summary"
    >
      <View style={styles.weatherTopRow}>
        <View style={styles.weatherMain}>
          <Ionicons
            name={(weather?.icon ?? 'cloud-outline') as keyof typeof Ionicons.glyphMap}
            size={22}
            color={C.primary}
          />
          <View style={styles.weatherCopy}>
            {loading ? (
              <>
                <Text style={[styles.weatherTemp, { color: C.text }]}>Fetching local weather…</Text>
                <Text style={[styles.weatherSub, { color: C.textMuted }]}>Using your current location</Text>
              </>
            ) : weather ? (
              <>
                <Text style={[styles.weatherTemp, { color: C.text }]}>
                  {formatTemp(weather.tempF, units)} · {weather.conditionLabel}
                </Text>
                <Text style={[styles.weatherSub, { color: C.textMuted }]}>
                  Humidity {weather.humidity}% · {weather.runAdvice}
                </Text>
                <Text
                  style={[styles.weatherSub, { color: weather.aqi ? C.textMuted : C.warning }]}
                  accessibilityLabel={weather.aqi ? aqiVoiceOverLabel(weather.aqi.value) : 'AQI unavailable'}
                >
                  {weather.aqi ? `AQI ${weather.aqi.value} · ${weather.aqi.category}` : 'AQI unavailable'}
                </Text>
                <Text style={[styles.weatherSub, { color: isStale ? C.warning : C.textDim }]}>
                  {[weather.placeName, lastUpdatedLabel(fetchedAt), isStale ? 'Pull latest' : null]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
                {statusLine ? (
                  <Text style={[styles.weatherSub, { color: C.warning }]}>{statusLine}</Text>
                ) : null}
              </>
            ) : (
              <>
                <Text style={[styles.weatherTemp, { color: C.text }]}>Local weather unavailable</Text>
                <Text style={[styles.weatherSub, { color: C.textMuted }]}>{statusLine ?? 'Try again shortly.'}</Text>
              </>
            )}
          </View>
        </View>
        <TouchableOpacity
          onPress={(event) => {
            event.stopPropagation();
            refresh();
          }}
          disabled={refreshing}
          style={[styles.weatherAction, { backgroundColor: C.cardAlt, borderColor: C.border }]}
          accessibilityLabel="Refresh weather"
          accessibilityRole="button"
        >
          {refreshing && !loading ? (
            <ActivityIndicator size="small" color={C.textMuted} />
          ) : (
            <Ionicons name="refresh-outline" size={19} color={C.textMuted} />
          )}
        </TouchableOpacity>
      </View>
      <TouchableOpacity
        onPress={(event) => {
          event.stopPropagation();
          setInfoOpen(true);
        }}
        style={styles.weatherInfoRow}
        accessibilityLabel="Weather and AQI information"
        accessibilityRole="button"
      >
        <Ionicons name="information-circle-outline" size={17} color={C.textMuted} />
        <Text style={[styles.weatherInfoText, { color: C.textMuted }]}>Weather and AQI details</Text>
      </TouchableOpacity>
      {status === 'permission_denied' ? (
        <TouchableOpacity
          onPress={() => { void Linking.openSettings(); }}
          style={{ marginTop: 8, alignSelf: 'flex-start' }}
          hitSlop={8}
        >
          <Text style={[styles.localLabel, { color: C.primary }]}>OPEN SETTINGS</Text>
        </TouchableOpacity>
      ) : null}
      <Modal visible={infoOpen} transparent animationType="slide" onRequestClose={() => setInfoOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.infoSheet, { backgroundColor: C.card, borderColor: C.border }]}>
            <Text style={[styles.infoTitle, { color: C.text }]}>Weather and AQI</Text>
            <Text style={[styles.infoCopy, { color: C.textMuted }]}>
              AQI is the U.S. Air Quality Index. It summarizes outdoor air pollution on a 0–500 scale; higher values generally mean more reason to reduce exposure or intensity.
            </Text>
            {weather?.aqi ? (
              <View style={styles.aqiScaleBlock} accessibilityLabel={aqiVoiceOverLabel(weather.aqi.value)}>
                <View style={styles.aqiScaleTrack}>
                  {US_AQI_BANDS.map(band => (
                    <View
                      key={band.category}
                      style={[styles.aqiScaleSegment, { backgroundColor: band.color }]}
                      accessibilityLabel={`${band.category}, AQI ${band.min} to ${band.max}`}
                    />
                  ))}
                  <View style={[styles.aqiMarker, { left: aqiPositionPct, backgroundColor: C.text }]} />
                </View>
                <Text style={[styles.infoCopy, { color: C.text }]}>
                  Current AQI {weather.aqi.value}: {weather.aqi.category}
                </Text>
                <Text style={[styles.infoCopy, { color: C.textMuted }]}>{weather.aqi.guidance}</Text>
                <View style={styles.aqiBandList}>
                  {US_AQI_BANDS.map(band => (
                    <View key={band.category} style={styles.aqiBandRow}>
                      <View style={[styles.aqiDot, { backgroundColor: band.color }]} />
                      <Text style={[styles.aqiBandText, { color: C.textMuted }]}>
                        {band.min}–{band.max}: {band.category}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : (
              <Text style={[styles.infoCopy, { color: C.warning }]}>AQI unavailable</Text>
            )}
            <Text style={[styles.infoCopy, { color: C.textMuted }]}>
              Temperature affects heat and cold stress. In warmer conditions, easy efforts may feel harder and hydration needs may increase. In cold conditions, warm up gradually and dress in layers.
            </Text>
            <Text style={[styles.infoCopy, { color: C.textMuted }]}>
              Humidity can reduce cooling and raise perceived effort. Adjust intensity when easy training no longer feels conversational.
            </Text>
            <Text style={[styles.infoCopy, { color: C.textMuted }]}>
              Sensitive individuals may need to modify exposure earlier than others. Consider local alerts, symptoms, medication or clinician guidance, and whether indoor training is the more conservative option.
            </Text>
            <View style={[styles.attributionBox, { borderTopColor: C.border }]}>
              <Text style={[styles.attributionText, { color: C.textDim }]}>
                Weather data provided by {weather?.weatherProvider?.name ?? 'the configured weather provider'}.
              </Text>
              <Text style={[styles.attributionText, { color: C.textDim }]}>
                Air-quality data provided by {weather?.aqiProvider?.name ?? 'the configured AQI provider when available'}.
              </Text>
              <Text style={[styles.attributionText, { color: C.textDim }]}>
                {fetchedAt ? `Updated at ${new Date(fetchedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.` : 'Updated time unavailable.'}
              </Text>
            </View>
            <TouchableOpacity style={[styles.infoClose, { backgroundColor: C.primary }]} onPress={() => setInfoOpen(false)}>
              <Text style={[styles.workoutBtnText, { color: C.onPrimary }]}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function getDayLabel(): string {
  const now = new Date();
  const weekday = now.toLocaleDateString('en-US', { weekday: 'long' });
  const monthDay = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });

  return `${weekday} · ${monthDay}`;
}

export default function TodayScreen() {
  const C = useColors();
  useFeatureTour('today');
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const todayReadiness = useReadinessStore(s => s.todayReadiness);
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [editingCheckIn, setEditingCheckIn] = useState(false);
  const [whyOpen, setWhyOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [outlookOpen, setOutlookOpen] = useState(false);
  const [outlookRationaleOpen, setOutlookRationaleOpen] = useState(false);
  const [outlookHistoryOpen, setOutlookHistoryOpen] = useState(false);
  const [forecastDetailsOpen, setForecastDetailsOpen] = useState(false);
  const [moreOptionsOpen, setMoreOptionsOpen] = useState(false);
  const [openOptionSection, setOpenOptionSection] = useState<'today' | 'plan' | 'help' | null>(null);
  const experienceMode = useExperienceMode();
  const weekPlan = useWeekPlan();
  const scheduled = useScheduledSessions(weekPlan);
  const activities = useActivityStore(s => s.activities);
  const awarded = useAchievementStore(s => s.awarded);
  const decisionSnapshot = useRecalculationStore(s => s.decisionSnapshot);
  const beforeStart = weekPlan.metadata.currentWeek === 0;
  const primarySession = scheduled.activeTodayPrimary;
  const phaseLabel = weekPlan.metadata.trainingPhase.charAt(0).toUpperCase() + weekPlan.metadata.trainingPhase.slice(1);
  const streakModel = useMemo(
    () => buildAchievementHubModel(activities, awarded, { scheduledSessions: scheduled.weekSessions }).streak,
    [activities, awarded, scheduled.weekSessions],
  );
  const currentStreak = useMemo(
    () => buildCurrentStreakSummary(streakModel.currentStreakDays),
    [streakModel.currentStreakDays],
  );

  const hasCheckedInToday = todayReadiness?.date === todayDateKey();
  const readiness = hasCheckedInToday ? todayReadiness!.score : null;
  const showCheckInForm = !hasCheckedInToday || editingCheckIn;
  const recommendation = hasCheckedInToday ? todayReadiness!.details : null;
  const workoutDuration = primarySession?.runWalk
    ? describeRunWalk(primarySession.runWalk)
    : primarySession ? `${primarySession.durationMinutes} min` : 'Rest day';
  const workoutFeel = cleanFeelLine(primarySession?.target, primarySession?.durationMinutes);
  const showBalancedDetails = experienceModeAllows(experienceMode, 'balanced');
  const showDataRichDetails = experienceModeAllows(experienceMode, 'data_rich');
  const trainingOutlook = useMemo(() => buildTrainingOutlook({
    activities,
    currentWeek: weekPlan.metadata.currentWeek,
    trainingPhase: weekPlan.metadata.trainingPhase,
    focus: weekPlan.metadata.focus,
    weeksToRace: weekPlan.metadata.weeksToRace,
    readinessLabel: recommendation?.label,
    readinessScore: readiness ?? undefined,
    decisionSnapshot,
  }), [
    activities,
    weekPlan.metadata.currentWeek,
    weekPlan.metadata.trainingPhase,
    weekPlan.metadata.focus,
    weekPlan.metadata.weeksToRace,
    recommendation?.label,
    readiness,
    decisionSnapshot,
  ]);
  const performanceForecast = useMemo(() => buildPerformanceForecast(trainingOutlook, {
    weeksToRace: weekPlan.metadata.weeksToRace,
    trainingPhase: weekPlan.metadata.trainingPhase,
    readinessScore: readiness ?? undefined,
    decisionSnapshot,
  }), [
    trainingOutlook,
    weekPlan.metadata.weeksToRace,
    weekPlan.metadata.trainingPhase,
    readiness,
    decisionSnapshot,
  ]);
  const primaryDayIndex = primarySession
    ? (new Date(`${primarySession.date}T12:00:00`).getDay() + 6) % 7
    : null;

  function startWorkout() {
    if (primarySession?.completedActivityId) {
      router.push({ pathname: '/(tabs)/activity/[activityId]', params: { activityId: primarySession.completedActivityId } } as never);
      return;
    }
    if (primarySession?.activityType === 'strength') {
      router.push('/(tabs)/strength' as never);
      return;
    }
    if (primarySession?.activityType === 'run' || primarySession?.activityType === 'run_walk') {
      router.push('/(tabs)/training' as never);
      return;
    }
    if (primarySession?.activityType === 'cycling') {
      router.push({ pathname: '/(tabs)/activity/indoor-ride', params: { scheduledSessionId: primarySession.scheduledSessionId } } as never);
      return;
    }
    if (primarySession) {
      router.push({
        pathname: '/(tabs)/activity/start',
        params: {
          scheduledSessionId: primarySession.scheduledSessionId,
          activityType: activityTypeFromScheduledSession(primarySession),
          associatedTrainingBlockId: primarySession.trainingBlockId,
          associatedGoalId: primarySession.goalPlanId,
        },
      } as never);
      return;
    }
    router.push('/(tabs)/calendar' as never);
  }

  const optionSections = [
    {
      key: 'today' as const,
      title: 'Adjust Today',
      subtitle: "Change only today's workout or schedule.",
      icon: 'options-outline' as const,
      items: [
        { label: "Shorten today's session", action: () => router.push({ pathname: '/(tabs)/training/adapt', params: { mode: 'week', preferredAction: 'reduced', scheduledSessionId: primarySession?.scheduledSessionId } } as never) },
        { label: 'Reduce intensity', action: () => router.push({ pathname: '/(tabs)/training/adapt', params: { mode: 'health', scheduledSessionId: primarySession?.scheduledSessionId } } as never) },
        { label: "Move today's workout", action: () => router.push({ pathname: '/(tabs)/training/adapt', params: { mode: 'week', preferredAction: 'moved', scheduledSessionId: primarySession?.scheduledSessionId } } as never) },
        { label: 'Replace with an equivalent session', action: () => router.push({ pathname: '/(tabs)/training/adapt', params: { mode: 'week', preferredAction: 'reduced', scheduledSessionId: primarySession?.scheduledSessionId } } as never) },
        { label: 'Switch outdoor to treadmill', action: () => router.push('/(tabs)/training' as never) },
        { label: 'Skip today', action: () => router.push({ pathname: '/(tabs)/training/adapt', params: { mode: 'missed', scheduledSessionId: primarySession?.scheduledSessionId } } as never) },
        { label: 'Report limited time', action: () => router.push({ pathname: '/(tabs)/training/adapt', params: { mode: 'week', reason: 'limited_time', scheduledSessionId: primarySession?.scheduledSessionId } } as never) },
        { label: 'Report fatigue', action: () => router.push({ pathname: '/(tabs)/training/adapt', params: { mode: 'health', reason: 'fatigue', scheduledSessionId: primarySession?.scheduledSessionId } } as never) },
        { label: 'Report soreness', action: () => router.push({ pathname: '/(tabs)/training/adapt', params: { mode: 'health', reason: 'soreness', scheduledSessionId: primarySession?.scheduledSessionId } } as never) },
        { label: 'Report pain or symptoms', action: () => router.push({ pathname: '/(tabs)/training/adapt', params: { mode: 'health', reason: 'pain_or_symptoms', scheduledSessionId: primarySession?.scheduledSessionId } } as never) },
        { label: 'Report illness', action: () => router.push({ pathname: '/(tabs)/training/adapt', params: { mode: 'health', reason: 'illness', scheduledSessionId: primarySession?.scheduledSessionId } } as never) },
        { label: 'Report travel or schedule conflict', action: () => router.push({ pathname: '/(tabs)/training/adapt', params: { mode: 'week', reason: 'schedule_or_travel', scheduledSessionId: primarySession?.scheduledSessionId } } as never) },
      ],
    },
    {
      key: 'plan' as const,
      title: 'Adjust the Plan',
      subtitle: 'Update future training days, goals, or program structure.',
      icon: 'calendar-outline' as const,
      items: [
        { label: 'Change training days', action: () => router.push('/(tabs)/profile/availability' as never) },
        { label: 'Change long-run day', action: () => router.push('/(tabs)/profile/availability' as never) },
        { label: 'Add or remove strength days', action: () => router.push('/(tabs)/settings' as never) },
        { label: 'Update race or goal date', action: () => router.push('/(tabs)/settings' as never) },
        { label: 'Change goal', action: () => router.push('/(tabs)/activity/plans' as never) },
        { label: 'Pause plan', action: () => router.push({ pathname: '/(tabs)/training/adapt', params: { mode: 'week', reason: 'pause_plan' } } as never) },
        { label: 'Return after time off', action: () => router.push({ pathname: '/(tabs)/training/adapt', params: { mode: 'week', reason: 'return_after_time_off' } } as never) },
        { label: 'Rebuild the upcoming week', action: () => router.push({ pathname: '/(tabs)/training/adapt', params: { mode: 'week', preferredAction: 'rebuilt' } } as never) },
        { label: 'Rebuild the current block', action: () => router.push({ pathname: '/(tabs)/training/adapt', params: { mode: 'week', preferredAction: 'rebuilt_block' } } as never) },
      ],
    },
    {
      key: 'help' as const,
      title: 'Get Help',
      subtitle: 'Ask why something changed or get guidance.',
      icon: 'help-circle-outline' as const,
      items: [
        { label: 'Ask AI Coach', action: () => router.push({ pathname: '/(tabs)/coach', params: { ask: "Help me adapt today's workout." } } as never) },
        { label: 'Why is this workout scheduled?', action: () => router.push({ pathname: '/(tabs)/coach', params: { ask: 'Why is this workout scheduled today?' } } as never) },
        { label: 'Why did my plan change?', action: () => router.push({ pathname: '/(tabs)/coach', params: { ask: 'Why did my plan change?' } } as never) },
        { label: 'What should I do after a missed workout?', action: () => router.push({ pathname: '/(tabs)/coach', params: { ask: 'What should I do after a missed workout?' } } as never) },
        { label: 'Explain readiness', action: () => router.push({ pathname: '/(tabs)/coach', params: { ask: 'Explain my readiness.' } } as never) },
        { label: 'Explain Training Outlook', action: () => router.push({ pathname: '/(tabs)/coach', params: { ask: 'Explain my Training Outlook.' } } as never) },
        { label: 'Explain Performance Forecast', action: () => router.push({ pathname: '/(tabs)/coach', params: { ask: 'Explain my Performance Forecast.' } } as never) },
        { label: 'Technical help', action: () => router.push('/(tabs)/settings' as never) },
      ],
    },
  ];

  return (
    <View style={[styles.screen, { backgroundColor: C.bg }]}>
      {/* Header */}
      <View style={[styles.headerRow, styles.fixedHeader, { paddingTop: insets.top + 20, backgroundColor: C.bg, borderBottomColor: C.border }]}>
        <View>
          <Text style={[styles.headerDate, { color: C.textDim }]}>{getDayLabel()}</Text>
          <Text style={[styles.headerGreeting, { color: C.text }]}>Good morning, Drew.</Text>
        </View>
        <TouchableOpacity
          style={[styles.avatarBtn, { backgroundColor: C.card, borderColor: C.border }]}
          onPress={() => router.push('/(tabs)/profile')}
          activeOpacity={0.7}
        >
          <Ionicons name="person-outline" size={18} color={C.textMuted} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: LAYOUT.screenPadBottom }}
        showsVerticalScrollIndicator={false}
      >

      <WeatherCard />

      <TouchableOpacity
        style={[styles.currentStreakCard, { backgroundColor: C.card, borderColor: C.border }]}
        onPress={() => router.push('/(tabs)/more/achievements' as never)}
        activeOpacity={0.86}
        accessibilityRole="button"
        accessibilityLabel={currentStreak.accessibilityLabel}
      >
        <StreakBadge days={Math.max(1, currentStreak.days)} size={64} compact />
        <View style={styles.currentStreakCopy}>
          <View style={styles.cardHeaderRow}>
            <Text style={[styles.cardLabel, { color: C.textDim }]}>CURRENT STREAK</Text>
            <Text style={[styles.streakHeatLabel, { color: C.primary }]}>{currentStreak.heatTier.label.toUpperCase()}</Text>
          </View>
          <Text style={[styles.currentStreakTitle, { color: C.text }]}>{currentStreak.days} days</Text>
          <StreakProgress days={currentStreak.days} />
        </View>
      </TouchableOpacity>

      {/* One dominant answer for the day: what to do, how it should feel, and why. */}
      <FeatureTourTarget targetId="today.workout" style={[styles.primaryWorkoutCard, { backgroundColor: C.card, borderColor: C.primary }]}>
        <View style={styles.cardHeaderRow}>
          <Text style={[styles.cardLabel, { color: C.primary }]}>TODAY'S WORKOUT</Text>
          {!beforeStart && (
            <View style={[styles.badge, { backgroundColor: C.primaryDim }]}>
              <Text style={[styles.badgeText, { color: C.primary }]}>{phaseLabel.toUpperCase()}</Text>
            </View>
          )}
        </View>
        {beforeStart ? (
          <Text style={[styles.workoutMeta, { color: C.textMuted }]}>
            {weekPlan.metadata.startsOn
              ? `Your plan starts ${weekPlan.metadata.startsOn}.`
              : 'Set a program start date in Settings to see your plan here.'}
          </Text>
        ) : (
          <>
            <Text style={[styles.primaryWorkoutTitle, { color: C.text }]}>
              {primarySession?.title ?? 'Rest day'}
            </Text>
            <Text style={[styles.workoutMeta, { color: C.textMuted }]}>What: {workoutDuration}</Text>
            <Text style={[styles.workoutMeta, { color: C.textMuted }]}>Feel: {workoutFeel}</Text>
            <Text style={[styles.workoutMeta, { color: C.textMuted }]}>Why: {primarySession?.purpose ?? 'Recovery is part of training, too.'}</Text>
            {primarySession?.adaptationReason ? (
              <Text style={[styles.workoutChange, { color: C.warning }]}>
                What changed: {primarySession.adaptationReason}
              </Text>
            ) : null}
            <TouchableOpacity style={[styles.startButton, { backgroundColor: C.primary }]} onPress={startWorkout} activeOpacity={0.8}>
              <Text style={[styles.workoutBtnText, { color: C.onPrimary }]}>{actionLabelForScheduledSession(primarySession)}</Text>
            </TouchableOpacity>
            <View style={styles.secondaryActions}>
              <TouchableOpacity onPress={() => primaryDayIndex === null
                ? router.push('/(tabs)/training' as never)
                : router.push({ pathname: '/(tabs)/training/[dayIndex]', params: { dayIndex: String(primaryDayIndex) } } as never)}
              ><Text style={[styles.secondaryActionText, { color: C.primary }]}>View Details</Text></TouchableOpacity>
            </View>
            <TouchableOpacity
              onPress={() => setMoreOptionsOpen(open => !open)}
              style={[styles.moreOptionsButton, { borderColor: C.border, backgroundColor: C.cardAlt }]}
              activeOpacity={0.82}
              accessibilityRole="button"
              accessibilityLabel={moreOptionsOpen ? 'Hide more workout options' : 'Show more workout options'}
              accessibilityHint="Opens workout adjustment and help choices"
              accessibilityState={{ expanded: moreOptionsOpen }}
            >
              <Ionicons name="ellipsis-horizontal-circle-outline" size={18} color={C.primary} />
              <Text style={[styles.moreOptionsText, { color: C.text }]}>More Options</Text>
              <Ionicons name={moreOptionsOpen ? 'chevron-up' : 'chevron-down'} size={16} color={C.textMuted} />
            </TouchableOpacity>
            {moreOptionsOpen ? (
              <View style={styles.optionGroups}>
                {optionSections.map(section => {
                  const expanded = openOptionSection === section.key;
                  return (
                    <View key={section.key} style={styles.optionGroup}>
                      <TouchableOpacity
                        onPress={() => setOpenOptionSection(current => current === section.key ? null : section.key)}
                        style={[styles.optionDisclosureButton, { backgroundColor: C.cardAlt, borderColor: expanded ? C.primary : C.border }]}
                        activeOpacity={0.82}
                        accessibilityRole="button"
                        accessibilityLabel={section.title}
                        accessibilityHint={section.subtitle}
                        accessibilityState={{ expanded }}
                      >
                        <Ionicons name={section.icon} size={18} color={expanded ? C.primary : C.textMuted} />
                        <View style={styles.optionDisclosureCopy}>
                          <Text style={[styles.optionDisclosureTitle, { color: C.text }]}>{section.title}</Text>
                          <Text style={[styles.optionDisclosureSubtitle, { color: C.textMuted }]}>{section.subtitle}</Text>
                        </View>
                        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={C.textMuted} />
                      </TouchableOpacity>
                      {expanded ? (
                        <View style={styles.optionActionList}>
                          {section.items.map(item => (
                            <TouchableOpacity
                              key={item.label}
                              onPress={item.action}
                              style={[styles.optionActionButton, { backgroundColor: C.card, borderColor: C.border }]}
                              activeOpacity={0.82}
                              accessibilityRole="button"
                              accessibilityLabel={item.label}
                            >
                              <Text style={[styles.optionActionText, { color: C.text }]}>{item.label}</Text>
                              <Ionicons name="chevron-forward" size={16} color={C.textMuted} />
                            </TouchableOpacity>
                          ))}
                        </View>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            ) : null}
          </>
        )}
      </FeatureTourTarget>

      {/* Readiness stays supportive: interpretation first, numeric mechanics only on request. */}
      {showCheckInForm ? (
        <FeatureTourTarget targetId="today.readiness" style={[styles.checkInDisclosureCard, { backgroundColor: C.card, borderColor: C.border }]}>
          <TouchableOpacity
            onPress={() => setCheckInOpen(open => !open)}
            activeOpacity={0.84}
            style={styles.checkInDisclosureButton}
            accessibilityRole="button"
            accessibilityState={{ expanded: checkInOpen }}
            accessibilityLabel={checkInOpen ? 'Collapse daily check-in' : 'Expand daily check-in'}
            accessibilityHint="Opens the daily readiness questions"
          >
            <View style={styles.checkInDisclosureCopy}>
              <Text style={[styles.cardLabel, { color: C.textDim }]}>DAILY CHECK-IN</Text>
              <Text style={[styles.checkInDisclosureTitle, { color: C.text }]}>
                {editingCheckIn ? "Update today's readiness" : 'Quick readiness check'}
              </Text>
              <Text style={[styles.checkInDisclosureSub, { color: C.textMuted }]}>
                Sleep, body, energy, and stress stay tucked away until you open this.
              </Text>
            </View>
            <View style={[styles.checkInDisclosureIcon, { backgroundColor: C.primaryDim }]}>
              <Ionicons name={checkInOpen ? 'chevron-up' : 'chevron-down'} size={18} color={C.primary} />
            </View>
          </TouchableOpacity>
          {checkInOpen ? (
            <View style={styles.checkInFormWrap}>
              <ReadinessCheckInCard
                initialValues={todayReadiness ?? undefined}
                onSaved={() => {
                  setEditingCheckIn(false);
                  setCheckInOpen(false);
                }}
                embedded
              />
            </View>
          ) : null}
        </FeatureTourTarget>
      ) : (
        <FeatureTourTarget targetId="today.readiness" style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
          <Text style={[styles.cardLabel, { color: C.textDim }]}>TODAY'S READINESS</Text>
          <Text style={[styles.readinessLabel, { color: C.text }]}>{recommendation!.label}</Text>
          <Text style={[styles.readinessInterpretation, { color: C.textMuted }]}>{recommendation!.message}</Text>
          {showBalancedDetails ? (
            <TouchableOpacity onPress={() => setWhyOpen(open => !open)} style={styles.disclosureButton}>
              <Text style={[styles.updateCheckInText, { color: C.primary }]}>Why this recommendation {whyOpen ? '−' : '+'}</Text>
            </TouchableOpacity>
          ) : null}
          {showBalancedDetails && whyOpen ? (
            <View style={styles.readinessDetails}>
              <Text style={[styles.reasonText, { color: C.textMuted }]}>Sleep: {formatReadinessSleep(todayReadiness!.sleepMinutesTotal)}</Text>
              <Text style={[styles.reasonText, { color: C.textMuted }]}>Sleep quality: {readinessChoiceLabel(SLEEP_QUALITY_LABELS, todayReadiness!.sleepQuality)}</Text>
              <Text style={[styles.reasonText, { color: C.textMuted }]}>Body: {readinessChoiceLabel(BODY_LABELS, todayReadiness!.bodyStatus)}</Text>
              <Text style={[styles.reasonText, { color: C.textMuted }]}>Energy: {readinessChoiceLabel(ENERGY_LABELS, todayReadiness!.energy)}</Text>
              <Text style={[styles.reasonText, { color: C.textMuted }]}>Stress: {readinessChoiceLabel(STRESS_LABELS, todayReadiness!.stress)}</Text>
              <Text style={[styles.reasonText, { color: C.textMuted }]}>Recent training: {recentTrainingLabel(recommendation!.trainingRecoveryContribution)}</Text>
              <Text style={[styles.reasonText, { color: C.textMuted }]}>Recommendation: {recommendation!.message}</Text>
              {recommendation!.reasons.map(reason => <Text key={reason} style={[styles.reasonText, { color: C.textMuted }]}>• {reason}</Text>)}
            </View>
          ) : null}
          {showDataRichDetails ? (
            <TouchableOpacity onPress={() => setAdvancedOpen(open => !open)} style={styles.disclosureButton}>
              <Text style={[styles.advancedLink, { color: C.textDim }]}>Advanced details {advancedOpen ? '−' : '+'}</Text>
            </TouchableOpacity>
          ) : null}
          {showDataRichDetails && advancedOpen ? <Text style={[styles.advancedText, { color: C.textDim }]}>Readiness score {readiness}/100 · sleep {todayReadiness!.sleepMinutesTotal} min · sleep contribution {recommendation!.sleepContribution}/100 · {recommendation!.baselineSource === 'personal_28_day' ? 'your 28-day sleep baseline' : 'starter sleep baseline'} {recommendation!.baselineSleepMinutes} min.</Text> : null}
          <TouchableOpacity onPress={() => { setEditingCheckIn(true); setCheckInOpen(true); }} style={styles.disclosureButton} hitSlop={8}>
            <Text style={[styles.updateCheckInText, { color: C.primary }]}>Update check-in</Text>
          </TouchableOpacity>
        </FeatureTourTarget>
      )}

      {/* Training Outlook */}
      <FeatureTourTarget targetId="today.outlook" style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
        <Text style={[styles.cardLabel, { color: C.textDim }]}>TRAINING OUTLOOK</Text>
        <Text style={[styles.outlookTitle, { color: C.text }]}>{trainingOutlook.statusLabel}</Text>
        <Text style={[styles.outlookCopy, { color: C.textMuted }]}>{trainingOutlook.recommendation}</Text>
        <TouchableOpacity
          onPress={() => setOutlookOpen(open => !open)}
          style={styles.disclosureButton}
          accessibilityRole="button"
          accessibilityState={{ expanded: outlookOpen }}
        >
          <Text style={[styles.updateCheckInText, { color: C.primary }]}>Training Details {outlookOpen ? '−' : '+'}</Text>
        </TouchableOpacity>
        {showBalancedDetails && outlookOpen ? (
          <View style={styles.outlookDecisionStack}>
            <View style={[styles.outlookDecisionRow, { borderColor: C.border, backgroundColor: C.cardAlt }]}>
              <Text style={[styles.forecastCellLabel, { color: C.textDim }]}>Training Focus</Text>
              <Text style={[styles.outlookValue, { color: C.text }]}>{trainingOutlook.focus ?? 'Aerobic Foundation'}</Text>
            </View>
            <View style={[styles.outlookDecisionRow, { borderColor: C.border, backgroundColor: C.cardAlt }]}>
              <Text style={[styles.forecastCellLabel, { color: C.textDim }]}>Recommended Action</Text>
              <Text style={[styles.outlookValue, { color: C.text }]}>{trainingOutlook.recommendation}</Text>
            </View>
          </View>
        ) : null}
        {showBalancedDetails && outlookOpen ? (
          <TouchableOpacity
            onPress={() => setOutlookRationaleOpen(open => !open)}
            style={styles.disclosureButton}
            accessibilityRole="button"
            accessibilityState={{ expanded: outlookRationaleOpen }}
          >
            <Text style={[styles.updateCheckInText, { color: C.primary }]}>Why? {outlookRationaleOpen ? '−' : '+'}</Text>
          </TouchableOpacity>
        ) : null}
        {showBalancedDetails && outlookOpen && outlookRationaleOpen ? (
          <Text style={[styles.outlookCopy, { color: C.textMuted }]}>
            {trainingOutlook.focus ? `Why this is the focus: ${trainingOutlook.focus}. ` : 'Why this is the focus: build consistency before adding more stress. '}
            {trainingOutlook.message}
          </Text>
        ) : null}
        {showDataRichDetails && outlookOpen ? (
          <TouchableOpacity
            onPress={() => setOutlookHistoryOpen(open => !open)}
            style={styles.disclosureButton}
            accessibilityRole="button"
            accessibilityState={{ expanded: outlookHistoryOpen }}
          >
            <Text style={[styles.advancedLink, { color: C.textDim }]}>History and Confidence {outlookHistoryOpen ? '−' : '+'}</Text>
          </TouchableOpacity>
        ) : null}
        {showDataRichDetails && outlookOpen && outlookHistoryOpen ? (
          <View style={[styles.outlookDataBox, { borderTopColor: C.border }]}>
            <Text style={[styles.advancedText, { color: C.textDim }]}>
              History {trainingOutlook.historyWeeks} week{trainingOutlook.historyWeeks === 1 ? '' : 's'} · completed {trainingOutlook.completedActivities} · adherence and workload analysis update after completed, skipped, edited, deleted, backdated, deload, interruption, readiness, and plan-change events · confidence {trainingOutlook.confidence}
            </Text>
          </View>
        ) : null}
      </FeatureTourTarget>

      {/* Performance Forecast */}
      {showBalancedDetails ? <FeatureTourTarget targetId="today.forecast" style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
        <Text style={[styles.cardLabel, { color: C.textDim }]}>PERFORMANCE FORECAST</Text>
        <Text style={[styles.outlookCopy, { color: C.textMuted }]}>{performanceForecast.summary}</Text>
        <View style={styles.forecastSummaryGrid}>
          {performanceForecast.metrics.map(metric => (
            <View key={metric.key} style={[styles.forecastSummaryCell, { backgroundColor: C.cardAlt, borderColor: C.border }]}>
              <View style={styles.forecastMetricHeader}>
                <Text style={[styles.forecastCellLabel, { color: C.textDim }]}>{metric.label}</Text>
                <TouchableOpacity
                  onPress={() => Alert.alert(metric.label, `${metric.info}\n\nConfidence: ${performanceForecast.confidence}. ${performanceForecast.limitations}`)}
                  style={styles.metricInfoButton}
                  accessibilityRole="button"
                  accessibilityLabel={`About ${metric.label}`}
                  accessibilityHint="Explains contributing data, confidence, and limitations."
                >
                  <Ionicons name="information-circle-outline" size={19} color={C.primary} />
                </TouchableOpacity>
              </View>
              <View style={[styles.forecastVisual, { backgroundColor: C.bg, borderColor: C.border }]}>
                <View style={[styles.forecastIconBubble, { backgroundColor: C.primaryDim }]}>
                  <Ionicons name={forecastIconName(metric.key)} size={18} color={metric.key === 'training_load_trend' ? C.positive : C.primary} />
                </View>
                <View style={styles.forecastChart}>
                  <ForecastMiniChart metric={metric} color={C.primary} positive={C.positive} muted={C.textDim} />
                </View>
              </View>
              <Text style={[styles.forecastValue, { color: C.primary }]}>{metric.valueLabel}</Text>
              <Text style={[styles.forecastHorizon, { color: C.textDim }]}>{metric.horizonLabel}</Text>
              <Text style={[styles.forecastState, { color: C.text }]}>{metric.visualLabel ?? metric.state}</Text>
            </View>
          ))}
        </View>
        <TouchableOpacity
          onPress={() => router.push({ pathname: '/(tabs)/performance', params: { view: 'forecast' } } as never)}
          style={[styles.forecastDrillButton, { backgroundColor: C.cardAlt, borderColor: C.border }]}
          accessibilityRole="button"
          accessibilityLabel="Open full performance forecast"
        >
          <Text style={[styles.forecastDrillText, { color: C.primary }]}>Open Full Forecast</Text>
          <Ionicons name="arrow-forward" size={16} color={C.primary} />
        </TouchableOpacity>
        {showDataRichDetails ? (
          <TouchableOpacity
            onPress={() => setForecastDetailsOpen(open => !open)}
            style={styles.disclosureButton}
            accessibilityRole="button"
            accessibilityState={{ expanded: forecastDetailsOpen }}
          >
            <Text style={[styles.advancedLink, { color: C.textDim }]}>Forecast Details {forecastDetailsOpen ? '−' : '+'}</Text>
          </TouchableOpacity>
        ) : null}
        {showDataRichDetails && forecastDetailsOpen ? (
          <Text style={[styles.advancedText, { color: C.textDim }]}>
            {performanceForecast.metrics.map(metric => `${metric.label}: ${metric.summary}`).join(' ')} Forecast confidence {performanceForecast.confidence}. {performanceForecast.limitations}
          </Text>
        ) : null}
      </FeatureTourTarget> : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  fixedHeader: {
    zIndex: 10,
    marginBottom: 0,
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerDate: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  headerGreeting: {
    fontSize: 18,
    fontWeight: '600',
    fontFamily: 'CormorantGaramond_700Bold',
    lineHeight: 24,
    marginTop: 4,
  },
  avatarBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  currentStreakCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  currentStreakCopy: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  currentStreakTitle: {
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  streakHeatLabel: {
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  checkInDisclosureCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 16,
  },
  checkInDisclosureButton: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  checkInDisclosureCopy: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  checkInDisclosureTitle: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '800',
  },
  checkInDisclosureSub: {
    fontSize: 12,
    lineHeight: 17,
  },
  checkInDisclosureIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkInFormWrap: {
    marginTop: 14,
  },
  primaryWorkoutCard: {
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 18,
    marginBottom: 16,
  },
  weatherCard: {
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 16,
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
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  bigNum: {
    fontSize: 52,
    fontWeight: '800',
    lineHeight: 56,
  },
  bigNumSub: {
    fontSize: 13,
  },
  progressBar: {
    height: 7,
    borderRadius: 999,
    overflow: 'hidden',
    marginBottom: 10,
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
  readinessInterpretation: {
    fontSize: 13,
    fontWeight: '600',
  },
  updateCheckInText: {
    fontSize: 12,
    fontWeight: '700',
  },
  reminderSub: {
    fontSize: 12,
    marginTop: 2,
  },
  weatherTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  weatherMain: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  weatherCopy: {
    flex: 1,
    minWidth: 0,
  },
  weatherAction: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weatherInfoRow: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingRight: 12,
  },
  weatherInfoText: {
    fontSize: 11,
    fontWeight: '700',
  },
  weatherTemp: {
    fontSize: 15,
    fontWeight: '600',
    fontFamily: 'DMSans_400Regular',
  },
  weatherSub: {
    fontSize: 11,
    marginTop: 2,
    fontFamily: 'DMSans_400Regular',
  },
  localLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  infoSheet: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 1,
    padding: 18,
    paddingBottom: 38,
  },
  infoTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 10,
  },
  infoCopy: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 10,
  },
  aqiScaleBlock: {
    marginBottom: 12,
  },
  aqiScaleTrack: {
    height: 12,
    borderRadius: 999,
    flexDirection: 'row',
    overflow: 'hidden',
    marginBottom: 12,
  },
  aqiScaleSegment: {
    flex: 1,
  },
  aqiMarker: {
    position: 'absolute',
    top: -4,
    width: 4,
    height: 20,
    borderRadius: 2,
  },
  aqiBandList: {
    gap: 6,
    marginBottom: 2,
  },
  aqiBandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  aqiDot: {
    width: 9,
    height: 9,
    borderRadius: 999,
  },
  aqiBandText: {
    fontSize: 12,
    lineHeight: 16,
  },
  attributionBox: {
    borderTopWidth: 1,
    paddingTop: 10,
    marginTop: 2,
    marginBottom: 12,
    gap: 3,
  },
  attributionText: {
    fontSize: 11,
    lineHeight: 16,
  },
  infoClose: {
    minHeight: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  workoutTitle: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'DMSans_400Regular',
  },
  primaryWorkoutTitle: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 10,
  },
  workoutChange: {
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 16,
    fontStyle: 'italic',
  },
  startButton: {
    minHeight: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 14,
    rowGap: 10,
    marginTop: 14,
  },
  secondaryActionText: {
    fontSize: 12,
    fontWeight: '700',
  },
  moreOptionsButton: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 14,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  moreOptionsText: {
    fontSize: 13,
    fontWeight: '800',
    flex: 1,
  },
  optionGroups: {
    marginTop: 12,
    gap: 10,
  },
  optionGroup: {
    gap: 8,
  },
  optionDisclosureButton: {
    minHeight: 58,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  optionDisclosureCopy: {
    flex: 1,
    minWidth: 0,
  },
  optionDisclosureTitle: {
    fontSize: 13,
    fontWeight: '900',
  },
  optionDisclosureSubtitle: {
    fontSize: 11,
    lineHeight: 15,
    marginTop: 2,
  },
  optionActionList: {
    gap: 7,
  },
  optionActionButton: {
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  optionActionText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '800',
  },
  readinessLabel: {
    fontSize: 20,
    fontWeight: '800',
    marginTop: 5,
    marginBottom: 6,
  },
  disclosureButton: {
    alignSelf: 'flex-start',
    marginTop: 12,
  },
  readinessDetails: {
    marginTop: 6,
  },
  reasonText: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 6,
  },
  advancedLink: {
    fontSize: 11,
    fontWeight: '700',
  },
  advancedText: {
    fontSize: 11,
    lineHeight: 17,
    marginTop: 6,
  },
  outlookTitle: {
    fontSize: 21,
    fontWeight: '900',
    marginTop: 8,
    marginBottom: 6,
  },
  outlookCopy: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },
  outlookDataBox: {
    borderTopWidth: 1,
    marginTop: 12,
    paddingTop: 10,
  },
  outlookDecisionStack: {
    gap: 8,
    marginTop: 12,
  },
  outlookDecisionRow: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
  },
  outlookValue: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '900',
  },
  workoutMeta: {
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 12,
    fontFamily: 'DMSans_400Regular',
  },
  workoutBtns: {
    flexDirection: 'row',
    gap: 8,
  },
  workoutBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  workoutBtnPrimary: {},
  workoutBtnSecondary: {},
  workoutBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  forecastRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  forecastCell: {
    flex: 1,
    borderRadius: 12,
    padding: 12,
    minWidth: 0,
  },
  forecastCellLabel: {
    fontSize: 10,
    marginBottom: 6,
  },
  forecastCellNum: {
    fontSize: 30,
    fontWeight: '800',
    lineHeight: 34,
  },
  forecastCellDate: {
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 28,
  },
  performanceMetricList: {
    gap: 10,
    marginTop: 12,
  },
  performanceMetricRow: {
    minHeight: 72,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  forecastSummaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  forecastSummaryCell: {
    flexGrow: 1,
    flexBasis: 148,
    minWidth: 132,
    borderWidth: 1,
    borderRadius: 8,
    padding: 11,
  },
  forecastVisual: {
    height: 78,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 10,
    marginBottom: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    overflow: 'hidden',
  },
  forecastIconBubble: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  forecastChart: {
    flex: 1,
    alignSelf: 'stretch',
    minWidth: 0,
  },
  forecastMetricHeader: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 6,
  },
  forecastState: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '900',
    marginTop: 3,
  },
  forecastValue: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '900',
  },
  forecastHorizon: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '700',
    marginTop: 1,
  },
  forecastDrillButton: {
    marginTop: 12,
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  forecastDrillText: {
    fontSize: 13,
    fontWeight: '900',
  },
  metricInfoButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  forecastCellArrow: {
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 28,
  },
  forecastCellUnit: {
    fontSize: 10,
    marginTop: 2,
  },
});
