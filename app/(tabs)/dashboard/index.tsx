import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useColors } from '../../../src/theme/useColors';
import { useAthleteStore } from '../../../src/store/athleteStore';
import { useCheckInStore } from '../../../src/store/checkInStore';
import { LAYOUT } from '../../../src/constants/layout';

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
  const { recoveryScore, fatigueScore } = useAthleteStore();
  const todayCheckIn = useCheckInStore(s => s.todayCheckIn);

  const readiness = todayCheckIn ? Math.round((recoveryScore * 0.6) + ((100 - fatigueScore) * 0.4)) : 84;
  const readinessLabel = readiness >= 80 ? 'PRIMED' : readiness >= 65 ? 'READY' : readiness >= 50 ? 'MODERATE' : 'RECOVERY';

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: C.bg }}
      contentContainerStyle={{ paddingHorizontal: 18, paddingTop: insets.top + 6, paddingBottom: LAYOUT.screenPadBottom }}
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

      {/* Weather */}
      <View style={[styles.weatherCard, { backgroundColor: C.card, borderColor: C.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Ionicons name="sunny" size={22} color={C.warning} />
          <View>
            <Text style={[styles.weatherTemp, { color: C.text }]}>62°F · Partly Cloudy</Text>
            <Text style={[styles.weatherSub, { color: C.textMuted }]}>Humidity 45% · Great running conditions</Text>
          </View>
        </View>
        <Text style={[styles.localLabel, { color: C.textDim }]}>LOCAL</Text>
      </View>

      {/* Readiness */}
      <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
        <View style={styles.cardHeaderRow}>
          <Text style={[styles.cardLabel, { color: C.textDim }]}>READINESS</Text>
          <View style={[styles.badge, { backgroundColor: C.primaryDim }]}>
            <Text style={[styles.badgeText, { color: C.primary }]}>{readinessLabel}</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
          <Text style={[styles.bigNum, { color: C.text }]}>{readiness}</Text>
          <Text style={[styles.bigNumSub, { color: C.textMuted }]}>/ 100</Text>
          <Text style={[{ marginLeft: 'auto', fontSize: 12, fontWeight: '700', color: C.positive }]}>▲ 6 pts</Text>
        </View>
        <View style={[styles.progressBar, { backgroundColor: C.border }]}>
          <View style={[styles.progressFill, { width: `${readiness}%`, backgroundColor: C.primary }]} />
        </View>
        <View style={styles.statsRow}>
          <View style={[styles.statCol, { borderRightWidth: 1, borderRightColor: C.border }]}>
            <Text style={[styles.statLabel, { color: C.textDim }]}>HRV</Text>
            <Text style={[styles.statVal, { color: C.text }]}>62 ms</Text>
          </View>
          <View style={[styles.statCol, { borderRightWidth: 1, borderRightColor: C.border }]}>
            <Text style={[styles.statLabel, { color: C.textDim }]}>Sleep</Text>
            <Text style={[styles.statVal, { color: C.text }]}>7h 41m</Text>
          </View>
          <View style={styles.statCol}>
            <Text style={[styles.statLabel, { color: C.textDim }]}>RHR</Text>
            <Text style={[styles.statVal, { color: C.text }]}>48 bpm</Text>
          </View>
        </View>
      </View>

      {/* Today's Workout */}
      <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
        <View style={styles.cardHeaderRow}>
          <Text style={[styles.workoutTitle, { color: C.text }]}>Today's Workout</Text>
          <View style={[styles.badge, { backgroundColor: C.accentDim }]}>
            <Text style={[styles.badgeText, { color: C.accent }]}>Z2 RUN</Text>
          </View>
        </View>
        <Text style={[styles.workoutMeta, { color: C.textMuted }]}>Easy 6 mi · Zone 2 · HR under 155 bpm</Text>
        <View style={styles.workoutBtns}>
          <TouchableOpacity
            style={[styles.workoutBtn, styles.workoutBtnPrimary, { backgroundColor: C.primary }]}
            onPress={() => router.push('/(tabs)/training')}
            activeOpacity={0.8}
          >
            <Text style={[styles.workoutBtnText, { color: C.onPrimary }]}>Start Run</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.workoutBtn, { backgroundColor: C.border }]}
            onPress={() => router.push('/(tabs)/strength')}
            activeOpacity={0.8}
          >
            <Text style={[styles.workoutBtnText, { color: C.textMuted }]}>Strength</Text>
          </TouchableOpacity>
        </View>
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
    alignItems: 'center',
    marginBottom: 12,
  },
  headerDate: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.9,
  },
  headerGreeting: {
    fontSize: 26,
    fontWeight: '700',
    fontFamily: 'CormorantGaramond_700Bold',
    lineHeight: 32,
  },
  avatarBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    marginBottom: 10,
  },
  weatherCard: {
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 11,
    paddingHorizontal: 14,
    marginBottom: 10,
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
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
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
  statsRow: {
    flexDirection: 'row',
  },
  statCol: {
    flex: 1,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 10,
    marginBottom: 2,
  },
  statVal: {
    fontSize: 14,
    fontWeight: '700',
  },
  weatherTemp: {
    fontSize: 14,
    fontWeight: '700',
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
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  workoutBtnPrimary: {},
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
