import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { LAYOUT } from '../../../src/constants/layout';
import { colors } from '../../../src/theme/colors';
import { useColors } from '../../../src/theme/useColors';
import { useOnboardingStore } from '../../../src/store/onboardingStore';
import { useActiveProfile, useProfileStore } from '../../../src/store/profileStore';
import { useAthleteStore } from '../../../src/store/athleteStore';
import type { TrainingDay } from '../../../src/types/athlete';

const DAYS: TrainingDay[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function toggleDay(list: TrainingDay[], day: TrainingDay) {
  return list.includes(day) ? list.filter(d => d !== day) : [...list, day];
}

function sortedDays(days: TrainingDay[]) {
  const order = new Map(DAYS.map((day, index) => [day, index]));
  return [...new Set(days)].sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0));
}

export default function AvailabilityScreen() {
  const C = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data, updateData } = useOnboardingStore();
  const profile = useActiveProfile();
  const updateActive = useProfileStore(s => s.updateActive);
  const weeklyMileage = useAthleteStore(s => s.weeklyMileage);
  const goalRace = useAthleteStore(s => s.goalRace);

  const availableDays = data.availableDays?.length ? data.availableDays : profile?.availableDays ?? [];
  const runDays = data.runDays?.length ? data.runDays : profile?.runDays ?? availableDays;
  const liftDays = data.liftDays ?? profile?.liftDays ?? [];

  function save(nextAvailable = availableDays, nextRun = runDays, nextLift = liftDays) {
    const cleanAvailable = sortedDays(nextAvailable);
    const cleanRun = sortedDays(nextRun.filter(day => cleanAvailable.includes(day)));
    const cleanLift = sortedDays(nextLift.filter(day => cleanAvailable.includes(day)));

    if (cleanAvailable.length === 0 || cleanRun.length === 0) {
      Alert.alert('Training days needed', 'Choose at least one overall available day and one run day.');
      return;
    }

    updateData({
      availableDays: cleanAvailable,
      runDays: cleanRun,
      liftDays: cleanLift,
      targetSessions: cleanRun.length + cleanLift.length,
    });
    updateActive({
      availableDays: cleanAvailable,
      runDays: cleanRun,
      liftDays: cleanLift,
      targetSessions: cleanRun.length + cleanLift.length,
    });
  }

  function toggleAvailable(day: TrainingDay) {
    const nextAvailable = sortedDays(toggleDay(availableDays, day));
    const nextRun = runDays.filter(d => nextAvailable.includes(d));
    const nextLift = liftDays.filter(d => nextAvailable.includes(d));
    save(nextAvailable, nextRun.length ? nextRun : nextAvailable.slice(0, 1), nextLift);
  }

  function toggleRun(day: TrainingDay) {
    if (!availableDays.includes(day)) return;
    const nextRun = sortedDays(toggleDay(runDays, day));
    save(availableDays, nextRun, liftDays);
  }

  function toggleLift(day: TrainingDay) {
    if (!availableDays.includes(day)) return;
    save(availableDays, runDays, sortedDays(toggleDay(liftDays, day)));
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: C.bg }}
      contentContainerStyle={{ paddingHorizontal: 18, paddingTop: insets.top + 6, paddingBottom: LAYOUT.screenPadBottom }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={20} color={C.primary} />
        </TouchableOpacity>
        <View style={{ marginLeft: 10 }}>
          <Text style={[styles.headerLabel, { color: C.textDim }]}>PROFILE</Text>
          <Text style={[styles.headerTitle, { color: C.text }]}>Training Availability</Text>
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
        <Text style={[styles.sectionLabel, { color: C.textDim }]}>PLAN IMPACT</Text>
        <View style={styles.metricsRow}>
          <Metric label="Overall" value={`${availableDays.length}`} color={C.text} />
          <Metric label="Run Days" value={`${runDays.length}`} color={C.text} />
          <Metric label="Lift Days" value={`${liftDays.length}`} color={C.text} />
        </View>
        <Text style={[styles.body, { color: C.textMuted }]}>
          These choices rebuild the weekly layout for {goalRace || 'your goal'} at about {Math.round(weeklyMileage)} mi/week. Run days determine where runs land; lift days determine where strength sessions land.
        </Text>
      </View>

      <DaySection
        C={C}
        title="Overall Available Days"
        body="Days you can train at all. Run and lift days must sit inside this list."
        selected={availableDays}
        onToggle={toggleAvailable}
      />
      <DaySection
        C={C}
        title="Run Days"
        body="StrideOS schedules running workouts on these days and adjusts the number of run sessions to match."
        selected={runDays}
        disabled={day => !availableDays.includes(day)}
        onToggle={toggleRun}
      />
      <DaySection
        C={C}
        title="Lift Days"
        body="Strength sessions prefer these days. If fewer lift days are selected, the strength plan uses fewer sessions."
        selected={liftDays}
        disabled={day => !availableDays.includes(day)}
        onToggle={toggleLift}
      />

      <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
        <Text style={[styles.sectionLabel, { color: C.textDim }]}>HOW THIS CHANGES THE PLAN</Text>
        <Text style={[styles.body, { color: C.textMuted }]}>
          More run days spreads mileage out. Fewer run days concentrates the most important sessions first, usually long run plus quality or easy aerobic work. Strength sessions are reduced when lift availability is low so the app does not stack extra work into days you cannot train.
        </Text>
      </View>
    </ScrollView>
  );
}

function DaySection({
  C,
  title,
  body,
  selected,
  disabled,
  onToggle,
}: {
  C: ReturnType<typeof useColors>;
  title: string;
  body: string;
  selected: TrainingDay[];
  disabled?: (day: TrainingDay) => boolean;
  onToggle: (day: TrainingDay) => void;
}) {
  return (
    <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
      <Text style={[styles.sectionLabel, { color: C.textDim }]}>{title}</Text>
      <Text style={[styles.body, { color: C.textMuted }]}>{body}</Text>
      <View style={styles.dayGrid}>
        {DAYS.map(day => {
          const active = selected.includes(day);
          const blocked = disabled?.(day) ?? false;
          return (
            <TouchableOpacity
              key={day}
              style={[
                styles.dayBtn,
                { borderColor: active ? C.primary : C.border, backgroundColor: active ? C.primaryDim : C.cardAlt, opacity: blocked ? 0.35 : 1 },
              ]}
              onPress={() => onToggle(day)}
              disabled={blocked}
              activeOpacity={0.75}
            >
              <Text style={[styles.dayText, { color: active ? C.primary : C.textMuted }]}>{day}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function Metric({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.metric}>
      <Text style={[styles.metricValue, { color }]}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  headerLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.9, textTransform: 'uppercase' },
  headerTitle: { fontSize: 26, fontWeight: '700', fontFamily: 'CormorantGaramond_700Bold' },
  card: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 10 },
  sectionLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10 },
  body: { fontSize: 13, lineHeight: 19, marginBottom: 12 },
  metricsRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  metric: { flex: 1, minHeight: 58, borderRadius: 12, backgroundColor: 'rgba(127,127,127,0.12)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  metricValue: { fontSize: 20, fontWeight: '900' },
  metricLabel: { fontSize: 9, fontWeight: '800', color: colors.textDim, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 3 },
  dayGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dayBtn: { width: '30.5%', borderWidth: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  dayText: { fontSize: 13, fontWeight: '900' },
});
