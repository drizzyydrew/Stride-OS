import { useState } from 'react';
import { ActivityIndicator, Linking, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useColors } from '../../../src/theme/useColors';
import { useWeather } from '../../../src/hooks/useWeather';
import { formatTemp } from '../../../src/lib/weather';
import { useSettingsStore } from '../../../src/store/settingsStore';
import { useReadinessStore } from '../../../src/store/readinessStore';
import { todayDateKey } from '../../../src/types/checkin';
import { readinessTier, READINESS_INTERPRETATION } from '../../../src/utils/readinessScore';
import ReadinessCheckInCard from '../../../src/components/today/ReadinessCheckInCard';
import { LAYOUT } from '../../../src/constants/layout';
import { useWeekPlan } from '../../../src/hooks/useWeekPlan';
import { displayLabel } from '../../../src/utils/displayLabels';
import { useScheduledSessions } from '../../../src/hooks/useScheduledSessions';
import { describeRunWalk } from '../../../src/utils/scheduledSessions';

function lastUpdatedLabel(fetchedAt: number | null): string | null {
  if (fetchedAt === null) return null;
  const mins = Math.max(0, Math.round((Date.now() - fetchedAt) / 60000));
  if (mins < 1) return 'Updated just now';
  if (mins < 60) return `Updated ${mins}m ago`;
  return `Updated ${Math.round(mins / 60)}h ago`;
}

// Live local weather card. Every displayed value is real fetched weather —
// on failure it shows the honest failure state (plus the last real reading
// flagged with its age) rather than substituting placeholder numbers.
function WeatherCard() {
  const C = useColors();
  const units = useSettingsStore(s => s.units);
  const { weather, status, loading, refreshing, isStale, fetchedAt, refresh } = useWeather();
  const [infoOpen, setInfoOpen] = useState(false);

  const statusLine =
    status === 'permission_denied'   ? 'Location access is off — StrideOS can’t read your local weather.'
    : status === 'location_unavailable' ? 'Couldn’t determine your location.'
    : status === 'service_unavailable'  ? 'Weather service unreachable.'
    : null;

  return (
    <View style={[styles.weatherCard, { backgroundColor: C.card, borderColor: C.border }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
          <Ionicons
            name={(weather?.icon ?? 'cloud-outline') as keyof typeof Ionicons.glyphMap}
            size={22}
            color={C.primary}
          />
          <View style={{ flex: 1 }}>
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
                <Text style={[styles.weatherSub, { color: weather.aqi ? C.textMuted : C.warning }]}>
                  {weather.aqi
                    ? `AQI ${weather.aqi.value} · ${weather.aqi.category} — ${weather.aqi.guidance}`
                    : 'AQI unavailable'}
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
        <TouchableOpacity onPress={refresh} disabled={refreshing} hitSlop={10} accessibilityLabel="Refresh weather">
          {refreshing && !loading ? (
            <ActivityIndicator size="small" color={C.textMuted} />
          ) : (
            <Ionicons name="refresh-outline" size={18} color={C.textMuted} />
          )}
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setInfoOpen(true)} hitSlop={10} accessibilityLabel="Weather and air quality information">
          <Ionicons name="information-circle-outline" size={18} color={C.textMuted} />
        </TouchableOpacity>
      </View>
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
              Temperature affects heat and cold stress. In warmer conditions, easy efforts may feel harder and hydration needs may increase. In cold conditions, warm up gradually and dress in layers.
            </Text>
            <Text style={[styles.infoCopy, { color: C.textMuted }]}>
              Humidity can reduce cooling and raise perceived effort. Adjust intensity when easy training no longer feels conversational.
            </Text>
            <Text style={[styles.infoCopy, { color: C.textMuted }]}>
              AQI describes outdoor air quality categories. Sensitive athletes may prefer lower intensity or indoor training on elevated AQI days. This guidance is informational and does not diagnose or replace medical advice.
            </Text>
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
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const todayReadiness = useReadinessStore(s => s.todayReadiness);
  const [editingCheckIn, setEditingCheckIn] = useState(false);
  const weekPlan = useWeekPlan();
  const scheduled = useScheduledSessions(weekPlan);
  const beforeStart = weekPlan.metadata.currentWeek === 0;
  const primarySession = scheduled.todayPrimary;
  const supportingSessions = scheduled.todaySessions.filter(session => session.priority === 'supporting');
  const optionalSessions = scheduled.todaySessions.filter(session => session.priority === 'optional');
  const hasStrengthToday = scheduled.todaySessions.some(session => session.activityType === 'strength');
  const phaseLabel = weekPlan.metadata.trainingPhase.charAt(0).toUpperCase() + weekPlan.metadata.trainingPhase.slice(1);

  const hasCheckedInToday = todayReadiness?.date === todayDateKey();
  const readiness = hasCheckedInToday ? todayReadiness!.score : null;
  const tier = readiness !== null ? readinessTier(readiness) : null;
  const showCheckInForm = !hasCheckedInToday || editingCheckIn;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: C.bg }}
      contentContainerStyle={{ paddingHorizontal: 16, paddingTop: insets.top + 20, paddingBottom: LAYOUT.screenPadBottom }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.headerRow}>
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

      {/* Weather — live local conditions (never hardcoded) */}
      <WeatherCard />

      {/* Readiness */}
      {showCheckInForm ? (
        <ReadinessCheckInCard
          initialValues={todayReadiness ?? undefined}
          onSaved={() => setEditingCheckIn(false)}
        />
      ) : (
        <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
          <View style={styles.cardHeaderRow}>
            <Text style={[styles.cardLabel, { color: C.textDim }]}>READINESS</Text>
            <View style={[styles.badge, { backgroundColor: C.primary }]}>
              <Text style={[styles.badgeText, { color: C.onPrimary }]}>{READINESS_INTERPRETATION[tier!].label}</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
            <Text style={[styles.bigNum, { color: C.text }]}>{readiness}</Text>
            <Text style={[styles.bigNumSub, { color: C.textMuted }]}>/ 100</Text>
          </View>
          <View style={[styles.progressBar, { backgroundColor: C.border }]}>
            <View style={[styles.progressFill, { width: `${readiness ?? 0}%`, backgroundColor: C.primary }]} />
          </View>
          <Text style={[styles.readinessInterpretation, { color: C.textMuted }]}>
            {READINESS_INTERPRETATION[tier!].message}
          </Text>
          <TouchableOpacity onPress={() => setEditingCheckIn(true)} style={{ marginTop: 10 }} hitSlop={8}>
            <Text style={[styles.updateCheckInText, { color: C.primary }]}>Update check-in</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Today's Plan */}
      <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
        <View style={styles.cardHeaderRow}>
          <Text style={[styles.workoutTitle, { color: C.text }]}>Today's Plan</Text>
          {!beforeStart && (
            <View style={[styles.badge, { backgroundColor: C.primaryDim }]}>
              <Text style={[styles.badgeText, { color: C.primary }]}>{phaseLabel.toUpperCase()}</Text>
            </View>
          )}
        </View>
        {beforeStart ? (
          <Text style={[styles.workoutMeta, { color: C.textMuted, marginBottom: 0 }]}>
            {weekPlan.metadata.startsOn
              ? `Your plan starts ${weekPlan.metadata.startsOn}.`
              : 'Set a program start date in Settings to see your plan here.'}
          </Text>
        ) : (
          <>
            <Text style={[styles.workoutMeta, { color: C.textMuted }]}>
              {primarySession
                ? `${primarySession.title} · ${primarySession.runWalk ? describeRunWalk(primarySession.runWalk) : `${primarySession.durationMinutes} min · ${primarySession.target}`}`
                : 'Rest day — no structured session.'}
            </Text>
            {primarySession ? (
              <Text style={[styles.workoutMeta, { color: C.textMuted }]}>
                {primarySession.purpose}
              </Text>
            ) : null}
            {supportingSessions.length > 0 ? (
              <Text style={[styles.workoutMeta, { color: C.textMuted }]}>
                Supporting: {supportingSessions.map(session => `${session.title} (${session.durationMinutes} min)`).join(' · ')}
              </Text>
            ) : null}
            {optionalSessions.length > 0 ? (
              <Text style={[styles.workoutMeta, { color: C.textMuted }]}>
                Optional recovery: {optionalSessions.map(session => session.title).join(' · ')}
              </Text>
            ) : null}
            <View style={styles.workoutBtns}>
              <TouchableOpacity
                style={[styles.workoutBtn, styles.workoutBtnPrimary, { backgroundColor: C.primary, borderColor: C.primary }]}
                onPress={() => router.push((
                  primarySession?.activityType === 'strength'
                    ? '/(tabs)/strength'
                    : primarySession?.activityType === 'run' || primarySession?.activityType === 'run_walk'
                      ? '/(tabs)/training'
                      : primarySession
                        ? '/(tabs)/activity/start'
                        : '/(tabs)/calendar'
                ) as never)}
                activeOpacity={0.8}
              >
                <Text style={[styles.workoutBtnText, { color: C.onPrimary }]}>
                  {primarySession?.activityType === 'strength'
                    ? 'View Strength Workout'
                    : primarySession?.activityType === 'run_walk'
                      ? 'Start Run/Walk'
                      : primarySession?.activityType === 'run'
                        ? 'Start Run'
                        : primarySession
                          ? `Start ${displayLabel(primarySession.activityType)}`
                          : "View Today's Plan"}
                </Text>
              </TouchableOpacity>
              {hasStrengthToday && (
                <TouchableOpacity
                  style={[styles.workoutBtn, styles.workoutBtnSecondary, { backgroundColor: 'transparent', borderColor: C.primary }]}
                  onPress={() => router.push('/(tabs)/strength')}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.workoutBtnText, { color: C.primary }]}>Strength</Text>
                </TouchableOpacity>
              )}
            </View>
          </>
        )}
      </View>

      {/* Performance Forecast */}
      <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
        <Text style={[styles.cardLabel, { color: C.textDim }]}>PERFORMANCE FORECAST</Text>
        <View style={styles.forecastRow}>
          <View style={[styles.forecastCell, { backgroundColor: C.cardAlt }]}>
            <Text style={[styles.forecastCellLabel, { color: C.textDim }]}>Peak Window</Text>
            <Text style={[styles.forecastCellNum, { color: C.text }]}>63</Text>
            <Text style={[styles.forecastCellUnit, { color: C.textMuted }]}>days</Text>
          </View>
          <View style={[styles.forecastCell, { backgroundColor: C.cardAlt }]}>
            <Text style={[styles.forecastCellLabel, { color: C.textDim }]}>Race Ready</Text>
            <Text style={[styles.forecastCellDate, { color: C.positive }]}>Aug 3</Text>
            <Text style={[styles.forecastCellUnit, { color: C.textMuted }]}>est.</Text>
          </View>
          <View style={[styles.forecastCell, { backgroundColor: C.cardAlt }]}>
            <Text style={[styles.forecastCellLabel, { color: C.textDim }]}>Load</Text>
            <Text style={[styles.forecastCellArrow, { color: C.warning }]}>↑</Text>
            <Text style={[styles.forecastCellUnit, { color: C.textMuted }]}>Ramping</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
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
