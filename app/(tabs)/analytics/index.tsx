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
import InfoButton from '../../../src/components/shared/InfoButton';
import { calculateACWR } from '../../../src/utils/training/calculateACWR';
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
  const readinessHistory = useReadinessStore(s => s.history);

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

  // ── Training load (ACWR) ────────────────────────────────────────────────────
  const acwrResult = calculateACWR(completedRuns);
  const hasLoadHistory = completedRuns.some(r => Date.now() - r.timestamp <= 42 * 24 * 60 * 60 * 1000);
  const acwrZone = acwrResult.acwr > 1.5 ? 'spike' : acwrResult.acwr > 1.3 ? 'elevated' : acwrResult.acwr >= 0.8 ? 'optimal' : 'low';
  const acwrColor = acwrZone === 'optimal' ? C.positive : acwrZone === 'low' ? C.textMuted : acwrZone === 'elevated' ? C.warning : C.critical;
  const acwrCopy: Record<typeof acwrZone, { meaning: string; action: string }> = {
    spike:    { meaning: 'The last 7 days are much heavier than your 6-week average. This is a workload trend, not an injury prediction.', action: 'Review fatigue and recovery, then consider easing volume or intensity while the longer-term average catches up.' },
    elevated: { meaning: 'Recent load is rising faster than your 6-week average. The ratio cannot determine whether the change is safe for you.', action: 'Hold steady and review sleep, soreness, motivation, and session RPE before adding more load.' },
    optimal:  { meaning: 'Recent load is close to your 6-week average. This does not guarantee readiness or low risk.', action: 'Use this trend alongside recovery and how training feels before progressing.' },
    low:      { meaning: 'The last 7 days are lighter than your 6-week average, which may reflect recovery, tapering, missed sessions, or a planned reduction.', action: 'Check the plan context before deciding whether to rebuild gradually or keep the lighter week.' },
  };

  // ── Readiness trend ─────────────────────────────────────────────────────────
  const readinessInRange = readinessHistory.filter(r => {
    const t = new Date(`${r.date}T12:00:00`).getTime();
    return Date.now() - t <= days * 24 * 60 * 60 * 1000;
  });
  const readinessAvg = readinessInRange.length
    ? Math.round(readinessInRange.reduce((s, r) => s + r.score, 0) / readinessInRange.length)
    : null;
  const half = Math.floor(readinessInRange.length / 2);
  const readinessDelta = readinessInRange.length >= 4
    ? Math.round(
        readinessInRange.slice(half).reduce((s, r) => s + r.score, 0) / (readinessInRange.length - half) -
        readinessInRange.slice(0, half).reduce((s, r) => s + r.score, 0) / half,
      )
    : null;
  const maxReadiness = Math.max(1, ...readinessInRange.map(r => r.score));

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
          <Text style={styles.statCardLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} allowFontScaling={false}>
            <Text style={{ color: C.textDim }}>CONSISTENCY</Text>
          </Text>
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

      {/* Training load (ACWR) */}
      <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
        <View style={styles.cardHeaderRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={[styles.metaText, { color: C.textMuted }]}>Training Load</Text>
            <InfoButton term="acwr" size={15} />
          </View>
          {hasLoadHistory && (
            <Text style={[{ fontSize: 13, fontWeight: '800', color: acwrColor }]}>
              ACWR {acwrResult.acwr.toFixed(2)}
            </Text>
          )}
        </View>
        {!hasLoadHistory ? (
          <Text style={[styles.emptyText, { color: C.textMuted }]}>
            Log a few weeks of runs to compare your recent 7-day load with your 6-week average. ACWR is a trend indicator, not an injury predictor.
          </Text>
        ) : (
          <>
            <Text style={[styles.coachText, { color: C.textMuted, marginTop: 0 }]}>
              Last 7 days vs your 6-week base: {acwrCopy[acwrZone].meaning}
            </Text>
            <Text style={[styles.coachText, { color: C.textMuted }]}>
              What to do: {acwrCopy[acwrZone].action}
            </Text>
          </>
        )}
      </View>

      {/* Readiness */}
      <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
        <View style={styles.cardHeaderRow}>
          <Text style={[styles.metaText, { color: C.textMuted }]}>Readiness Trend</Text>
          {readinessAvg !== null && (
            <Text style={[{ fontSize: 13, fontWeight: '800', color: C.text }]}>avg {readinessAvg}/100</Text>
          )}
        </View>
        {readinessInRange.length === 0 ? (
          <Text style={[styles.emptyText, { color: C.textMuted }]}>
            {todayReadiness
              ? 'Your check-ins are now being tracked over time — come back after a few days to see the trend.'
              : 'No readiness check-ins yet. Complete a daily check-in on the Dashboard to start building this trend.'}
          </Text>
        ) : (
          <>
            <View style={[styles.barChart, { height: 56 }]}>
              {readinessInRange.slice(-21).map((r, i) => (
                <View
                  key={`${r.date}-${i}`}
                  style={[
                    styles.bar,
                    {
                      height: `${Math.max(6, (r.score / maxReadiness) * 100)}%`,
                      backgroundColor: r.score >= 70 ? C.positive : r.score >= 50 ? C.primary : C.warning,
                      opacity: 0.9,
                    },
                  ]}
                />
              ))}
            </View>
            <Text style={[styles.coachText, { color: C.textMuted }]}>
              {readinessInRange.length < 4
                ? `${readinessInRange.length} check-in${readinessInRange.length === 1 ? '' : 's'} so far — low confidence until there's about a week of data.`
                : readinessDelta !== null && readinessDelta <= -8
                  ? `Readiness has dropped ${Math.abs(readinessDelta)} points across this range — recovery isn't keeping up with stress. Bias the next few days easy and protect sleep.`
                  : readinessDelta !== null && readinessDelta >= 8
                    ? `Readiness is up ${readinessDelta} points across this range — you're absorbing training well. A good window for planned quality work.`
                    : 'Readiness is holding steady across this range — keep the current balance of stress and recovery.'}
            </Text>
          </>
        )}
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
    flexShrink: 1,
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
    paddingVertical: 14,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  statCardLabel: {
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.2,
    textAlign: 'center',
    width: '100%',
  },
  statCardVal: {
    fontSize: 22,
    fontWeight: '800',
  },
  adaptiveCard: {
    paddingBottom: 14,
  },
});
