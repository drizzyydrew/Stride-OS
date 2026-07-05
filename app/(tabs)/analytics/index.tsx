import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';

import { useColors } from '../../../src/theme/useColors';
import { useSettingsStore } from '../../../src/store/settingsStore';
import { useWorkoutStore } from '../../../src/store/workoutStore';
import { useStrengthStore } from '../../../src/store/strengthStore';
import { useReadinessStore } from '../../../src/store/readinessStore';
import { LAYOUT } from '../../../src/constants/layout';
import TrendPill from '../../../src/components/ui/TrendPill';
import {
  RANGE_DAYS,
  RANGE_LABEL,
  bucketUnitFor,
  filterSince,
  filterPreviousPeriod,
  buildBuckets,
  computeAdherencePct,
  summarizeTrend,
  computeLoadPatternSeverity,
  runDistance,
  computeAvgPaceMinPerMile,
  formatPace,
  describeVolumeTrend,
  describeTrainingLoadPattern,
  type RangeKey,
} from '../../../src/utils/analyticsRangeEngine';

const RANGES: RangeKey[] = ['4W', '8W', '12W', '6M', '1Y'];

export default function AnalyticsScreen() {
  const C = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { units } = useSettingsStore();
  const imp = units === 'imperial';
  const distUnit = imp ? 'mi' : 'km';
  const distFactor = imp ? 1 : 1.60934; // miles are the stored unit; convert for display

  const [range, setRange] = useState<RangeKey>('8W');

  const workoutHistory   = useWorkoutStore(s => s.history);
  const strengthHistory  = useStrengthStore(s => s.history);
  const todayReadiness   = useReadinessStore(s => s.todayReadiness);

  const days = RANGE_DAYS[range];
  const unit = bucketUnitFor(range);

  const completedRuns = workoutHistory.filter(r => !r.skipped);
  const runsInRange   = filterSince(completedRuns, days);
  const runBuckets    = buildBuckets(runsInRange, range, runDistance);
  const runTrend      = summarizeTrend(runBuckets);
  const runAdherence  = computeAdherencePct(runBuckets);
  const maxBucketVal  = Math.max(1, ...runBuckets.map(b => b.value));

  const totalMiles = runsInRange.reduce((s, r) => s + runDistance(r), 0);
  const totalDistDisplay = `${(totalMiles * distFactor).toFixed(1)} ${distUnit}`;

  const avgPace     = computeAvgPaceMinPerMile(runsInRange);
  const prevRuns    = filterPreviousPeriod(completedRuns, days);
  const prevAvgPace = computeAvgPaceMinPerMile(prevRuns);
  const paceDeltaSec = avgPace != null && prevAvgPace != null
    ? Math.round((prevAvgPace - avgPace) * 60)
    : null;

  const strengthCompleted   = strengthHistory.filter(r => !r.skipped);
  const hasStrengthHistory  = strengthCompleted.length > 0;
  const strengthInRange     = filterSince(strengthCompleted, days);
  const strengthBuckets     = buildBuckets(strengthInRange, range, () => 1);
  const strengthAdherence   = computeAdherencePct(strengthBuckets);
  const strengthTrend       = summarizeTrend(strengthBuckets);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: C.bg }}
      contentContainerStyle={{ paddingHorizontal: 18, paddingTop: insets.top + 6, paddingBottom: LAYOUT.screenPadBottom }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={20} color={C.primary} />
        </TouchableOpacity>
        <View style={{ marginLeft: 10 }}>
          <Text style={[styles.headerLabel, { color: C.textDim }]}>ANALYTICS</Text>
          <Text style={[styles.headerTitle, { color: C.text }]}>{RANGE_LABEL[range]}</Text>
        </View>
      </View>

      {/* Time range filter */}
      <View style={styles.rangeRow}>
        {RANGES.map(r => (
          <TouchableOpacity
            key={r}
            style={[
              styles.rangePill,
              { backgroundColor: C.card, borderColor: C.border },
              r === range && { backgroundColor: C.primaryDim, borderColor: C.primary },
            ]}
            onPress={() => setRange(r)}
            activeOpacity={0.8}
          >
            <Text style={[styles.rangePillTxt, { color: r === range ? C.primary : C.textDim }]}>{r}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Training Load */}
      <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
        <View style={styles.cardHeaderRow}>
          <Text style={[styles.metaText, { color: C.textMuted }]}>Running Volume</Text>
          {runsInRange.length > 0 && (
            <TrendPill direction={runTrend.direction} severity={runTrend.severity} slope={runTrend.slope} />
          )}
        </View>

        {runsInRange.length === 0 ? (
          <Text style={[styles.emptyText, { color: C.textMuted }]}>
            No logged runs in this range yet. Log a few runs to see your volume trend here.
          </Text>
        ) : (
          <>
            <View style={styles.barChart}>
              {runBuckets.map((b, i) => (
                <View
                  key={i}
                  style={[
                    styles.bar,
                    {
                      height: `${Math.max(4, (b.value / maxBucketVal) * 100)}%`,
                      backgroundColor: C.primary,
                      opacity: 0.35 + (0.65 * (i + 1)) / runBuckets.length,
                    },
                  ]}
                />
              ))}
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
              {runBuckets.map((b, i) => (
                <Text key={i} style={[{ fontSize: 10, color: C.textDim }]}>{b.label}</Text>
              ))}
            </View>
            <Text style={[styles.coachText, { color: C.textMuted }]}>
              {describeVolumeTrend(runTrend, runAdherence, unit, unit === 'week' ? 'Weekly mileage' : 'Monthly mileage')}
            </Text>
            {unit === 'week' && runAdherence >= 40 && (
              <Text style={[styles.coachText, { color: C.textMuted }]}>
                {describeTrainingLoadPattern(computeLoadPatternSeverity(runBuckets.map(b => b.value)))}
              </Text>
            )}
          </>
        )}
      </View>

      {/* Avg Pace */}
      <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
        <Text style={[styles.metaText, { color: C.textDim, marginBottom: 4 }]}>Avg Pace · {RANGE_LABEL[range]}</Text>
        {avgPace == null ? (
          <Text style={[styles.emptyText, { color: C.textMuted }]}>
            Not enough logged runs yet to calculate an average pace.
          </Text>
        ) : (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={[{ fontSize: 36, fontWeight: '800', color: C.text, lineHeight: 40 }]}>
              {formatPace(avgPace)}<Text style={[{ fontSize: 14, fontWeight: '400', color: C.textMuted }]}> /mi</Text>
            </Text>
            {paceDeltaSec != null && paceDeltaSec !== 0 && (
              <Text style={[{ fontSize: 13, fontWeight: '700', color: paceDeltaSec > 0 ? C.positive : C.warning }]}>
                {paceDeltaSec > 0 ? '↓' : '↑'} {Math.abs(paceDeltaSec)}s {paceDeltaSec > 0 ? 'faster' : 'slower'} vs prior period
              </Text>
            )}
          </View>
        )}
      </View>

      {/* Stats row */}
      <View style={styles.statRow}>
        <View style={[styles.statCard, { backgroundColor: C.card, borderColor: C.border }]}>
          <Text style={[styles.statCardLabel, { color: C.textDim }]}>TOTAL</Text>
          <Text style={[styles.statCardVal, { color: C.text }]}>{totalDistDisplay}</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: C.card, borderColor: C.border }]}>
          <Text style={[styles.statCardLabel, { color: C.textDim }]}>RUNS</Text>
          <Text style={[styles.statCardVal, { color: C.text }]}>{runsInRange.length}</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: C.card, borderColor: C.border }]}>
          <Text style={[styles.statCardLabel, { color: C.textDim }]}>CONSISTENCY</Text>
          <Text style={[styles.statCardVal, { color: C.text }]}>{runsInRange.length > 0 ? `${runAdherence}%` : '—'}</Text>
        </View>
      </View>

      {/* Strength consistency — only shown if the athlete has ever logged strength */}
      {hasStrengthHistory && (
        <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
          <View style={styles.cardHeaderRow}>
            <Text style={[styles.metaText, { color: C.textMuted }]}>Strength Consistency</Text>
            {strengthInRange.length > 0 && (
              <TrendPill direction={strengthTrend.direction} severity={strengthTrend.severity} slope={strengthTrend.slope} />
            )}
          </View>
          {strengthInRange.length === 0 ? (
            <Text style={[styles.emptyText, { color: C.textMuted }]}>
              No logged strength sessions in this range yet.
            </Text>
          ) : (
            <Text style={[styles.coachText, { color: C.textMuted, marginTop: 0 }]}>
              {strengthInRange.length} session{strengthInRange.length === 1 ? '' : 's'} logged, {strengthAdherence}% of {unit === 'week' ? 'weeks' : 'months'} in this range.
            </Text>
          )}
        </View>
      )}

      {/* Readiness */}
      <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
        <Text style={[styles.metaText, { color: C.textMuted, marginBottom: 4 }]}>Readiness Trend</Text>
        <Text style={[styles.emptyText, { color: C.textMuted }]}>
          {todayReadiness
            ? "Readiness is only tracked day-to-day right now — check back after more daily check-ins to see a trend here."
            : 'No readiness check-ins yet. Complete a daily check-in on the Dashboard to start building this trend.'}
        </Text>
      </View>

      {/* Heart Rate Zones — not tracked yet */}
      <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
        <Text style={[styles.metaText, { color: C.textMuted, marginBottom: 4 }]}>Heart Rate Zones</Text>
        <Text style={[styles.emptyText, { color: C.textMuted }]}>
          Heart rate zone analysis needs per-run HR data, which isn't tracked yet.
        </Text>
      </View>

      {/* Adaptive Performance */}
      <TouchableOpacity
        style={[styles.card, styles.adaptiveCard, { backgroundColor: C.card, borderColor: C.border }]}
        onPress={() => router.push('/(tabs)/performance' as any)}
        activeOpacity={0.84}
      >
        <View style={styles.cardHeaderRow}>
          <Text style={[styles.metaText, { color: C.textMuted }]}>Adaptive Performance</Text>
          <Text style={[{ fontSize: 12, fontWeight: '700', color: C.primary }]}>Open →</Text>
        </View>
        <Text style={[{ fontSize: 12, color: C.textMuted, lineHeight: 18 }]}>
          See your full aerobic, anaerobic, and processing breakdown.
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
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
  rangeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  rangePill: {
    flex: 1,
    borderRadius: 999,
    borderWidth: 1,
    paddingVertical: 8,
    alignItems: 'center',
  },
  rangePillTxt: {
    fontSize: 12,
    fontWeight: '700',
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 10,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  metaText: {
    fontSize: 12,
    fontWeight: '700',
  },
  emptyText: {
    fontSize: 12,
    lineHeight: 18,
  },
  coachText: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 10,
  },
  barChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 80,
    gap: 5,
  },
  bar: {
    flex: 1,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  statRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  statCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    alignItems: 'center',
  },
  statCardLabel: {
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statCardVal: {
    fontSize: 22,
    fontWeight: '800',
  },
  adaptiveCard: {
    paddingBottom: 14,
  },
});
