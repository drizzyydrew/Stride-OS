import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useColors } from '../../../src/theme/useColors';
import { LAYOUT } from '../../../src/constants/layout';
import { useActivityStore } from '../../../src/store/activityStore';
import { buildAdaptivePerformanceModel, type AdaptivePerformanceMetric } from '../../../src/utils/adaptivePerformance';
import { useReadinessStore } from '../../../src/store/readinessStore';
import { useRecalculationStore } from '../../../src/store/recalculationStore';
import { todayDateKey } from '../../../src/types/checkin';
import { useWeekPlan } from '../../../src/hooks/useWeekPlan';
import { buildPerformanceForecast, buildTrainingOutlook, type PerformanceForecastMetric } from '../../../src/utils/trainingOutlook';

type MetricOpen = 'aero' | 'ana' | 'proc' | null;
type PerformanceView = 'scores' | 'forecast';

interface MetricCardProps {
  title: string;
  subtitle: string;
  score: number | null;
  scoreColor: string;
  open: boolean;
  onToggle: () => void;
  explanation: string;
  ranges: { label: string; range: string; active: boolean }[];
}

function MetricCard({ title, subtitle, score, scoreColor, open, onToggle, explanation, ranges }: MetricCardProps) {
  const C = useColors();
  return (
    <TouchableOpacity
      style={[styles.metricCard, { backgroundColor: C.card, borderColor: C.border }]}
      onPress={onToggle}
      activeOpacity={0.8}
    >
      <View style={styles.metricCardRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.metricTitle, { color: C.text }]}>{title}</Text>
          <Text style={[styles.metricSubtitle, { color: C.textMuted }]}>{subtitle}</Text>
        </View>
        <View style={styles.metricRight}>
          <Text style={[styles.metricScore, { color: scoreColor }]}>{score ?? '--'}</Text>
          <Text style={[styles.metricChev, { color: C.textDim }]}>{open ? '▲' : '▼'}</Text>
        </View>
      </View>
      {open && (
        <View style={[styles.metricDetail, { borderTopColor: C.border }]}>
          <Text style={[styles.metricExplanation, { color: C.textMuted }]}>{explanation}</Text>
          {ranges.length > 0 ? <View style={styles.rangeRow}>
            {ranges.map(r => (
              <View
                key={r.label}
                style={[
                  styles.rangeBox,
                  r.active
                    ? { backgroundColor: C.primaryDim, borderWidth: 1, borderColor: C.primary }
                    : { backgroundColor: C.cardAlt },
                ]}
              >
                <Text style={[styles.rangeLabel, { color: C.textDim }]}>{r.label}</Text>
                <Text style={[styles.rangeValue, { color: r.active ? C.primary : C.textMuted }]}>{r.range}</Text>
              </View>
            ))}
          </View> : null}
        </View>
      )}
    </TouchableOpacity>
  );
}

function ForecastMetricCard({ metric }: { metric: PerformanceForecastMetric }) {
  const C = useColors();
  const maxValue = Math.max(1, ...metric.chartValues);
  return (
    <View style={[styles.metricCard, { backgroundColor: C.card, borderColor: C.border }]}>
      <View style={styles.metricCardRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.metricTitle, { color: C.text }]}>{metric.label}</Text>
          <Text style={[styles.metricSubtitle, { color: C.textMuted }]}>{metric.horizonLabel}</Text>
        </View>
        <View style={styles.metricRight}>
          <Text style={[styles.metricScoreSmall, { color: C.primary }]}>{metric.valueLabel}</Text>
        </View>
      </View>
      <View style={styles.forecastBars}>
        {metric.chartValues.map((value, index) => (
          <View key={`${metric.key}-${metric.chartLabels[index] ?? index}`} style={styles.forecastBarColumn}>
            <View style={[styles.forecastBarTrack, { backgroundColor: C.cardAlt }]}>
              <View
                style={[
                  styles.forecastBarFill,
                  {
                    height: `${Math.max(8, Math.round((Math.max(0, value) / maxValue) * 100))}%`,
                    backgroundColor: metric.key === 'training_load_trend' ? C.positive : C.primary,
                  },
                ]}
              />
            </View>
            <Text numberOfLines={1} style={[styles.forecastBarLabel, { color: C.textDim }]}>
              {metric.chartLabels[index] ?? `point ${index + 1}`}
            </Text>
          </View>
        ))}
      </View>
      <Text style={[styles.metricExplanation, { color: C.textMuted }]}>{metric.summary}</Text>
      <Text style={[styles.metricExplanation, { color: C.textDim }]}>{metric.info}</Text>
    </View>
  );
}

export default function PerformanceScreen() {
  const C = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ view?: string }>();
  const [open, setOpen] = useState<MetricOpen>(null);
  const [view, setView] = useState<PerformanceView>(params.view === 'forecast' ? 'forecast' : 'scores');
  const toggle = (key: MetricOpen) => setOpen(p => p === key ? null : key);
  const activities = useActivityStore(state => state.activities);
  const todayReadiness = useReadinessStore(state => state.todayReadiness);
  const decisionSnapshot = useRecalculationStore(state => state.decisionSnapshot);
  const weekPlan = useWeekPlan();
  const model = buildAdaptivePerformanceModel(activities);
  const hasCheckedInToday = todayReadiness?.date === todayDateKey();
  const readinessScore = hasCheckedInToday ? todayReadiness?.score : undefined;
  const trainingOutlook = buildTrainingOutlook({
    activities,
    currentWeek: weekPlan.metadata.currentWeek,
    trainingPhase: weekPlan.metadata.trainingPhase,
    focus: weekPlan.metadata.focus,
    weeksToRace: weekPlan.metadata.weeksToRace,
    readinessLabel: hasCheckedInToday ? todayReadiness?.details.label : undefined,
    readinessScore,
    decisionSnapshot,
  });
  const forecast = buildPerformanceForecast(trainingOutlook, {
    weeksToRace: weekPlan.metadata.weeksToRace,
    trainingPhase: weekPlan.metadata.trainingPhase,
    readinessScore,
    decisionSnapshot,
  });

  const scoreColor = (metric: AdaptivePerformanceMetric) =>
    metric.score == null ? C.textDim : metric.score >= 71 ? C.positive : metric.score >= 56 ? C.warning : C.textMuted;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: C.bg }}
      contentContainerStyle={{ padding: 18, paddingTop: insets.top + 8, paddingBottom: LAYOUT.screenPadBottom }}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={20} color={C.primary} />
        </TouchableOpacity>
        <View style={{ marginLeft: 10 }}>
          <Text style={[styles.headerLabel, { color: C.textDim }]}>ADAPTIVE</Text>
          <Text style={[styles.headerTitle, { color: C.text }]}>Endurance Performance</Text>
        </View>
      </View>

      <View style={[styles.segmented, { backgroundColor: C.card, borderColor: C.border }]}>
        {([
          ['scores', 'Scores'],
          ['forecast', 'Forecast'],
        ] as const).map(([key, label]) => (
          <TouchableOpacity
            key={key}
            onPress={() => setView(key)}
            style={[styles.segmentButton, view === key ? { backgroundColor: C.primaryDim } : null]}
            accessibilityRole="button"
            accessibilityState={{ selected: view === key }}
          >
            <Text style={[styles.segmentText, { color: view === key ? C.primary : C.textMuted }]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {view === 'forecast' ? (
        <>
          <View style={[styles.scoreCard, { backgroundColor: C.card, borderColor: C.border }]}>
            <Text style={[styles.scoreLabel, { color: C.textDim }]}>PERFORMANCE FORECAST</Text>
            <Text style={[styles.forecastHeadline, { color: C.text }]}>{forecast.confidence.toUpperCase()} CONFIDENCE</Text>
            <Text style={[styles.scoreCaption, { color: C.textMuted }]}>{forecast.summary}</Text>
            <Text style={[styles.scoreCaption, { color: C.textDim }]}>{forecast.limitations}</Text>
          </View>
          {forecast.metrics.map(metric => (
            <ForecastMetricCard key={metric.key} metric={metric} />
          ))}
        </>
      ) : (
        <>
      {/* Overall score */}
      <View style={[styles.scoreCard, { backgroundColor: C.card, borderColor: C.border }]}>
        <Text style={[styles.scoreLabel, { color: C.textDim }]}>{model.ready ? 'OVERALL SCORE' : 'NEEDS MORE WORKOUTS'}</Text>
        <Text style={[styles.scoreNum, { color: C.text }]}>{model.overallScore ?? '--'}</Text>
        <Text style={[styles.scoreCaption, { color: C.textMuted }]}>{model.caption}</Text>
        <View style={[styles.scoreBar, { backgroundColor: C.border }]}>
          <View style={[styles.scoreBarFill, { width: `${model.overallScore ?? 0}%`, backgroundColor: C.primary }]} />
        </View>
      </View>

      {model.metrics.map(metric => (
        <MetricCard
          key={metric.id}
          title={metric.title}
          subtitle={metric.subtitle}
          score={metric.score}
          scoreColor={scoreColor(metric)}
          open={open === metric.id}
          onToggle={() => toggle(metric.id)}
          explanation={metric.explanation}
          ranges={metric.ranges}
        />
      ))}
        </>
      )}
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
    fontSize: 24,
    fontWeight: '700',
    fontFamily: 'CormorantGaramond_700Bold',
  },
  scoreCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 20,
    marginBottom: 10,
    alignItems: 'center',
  },
  scoreLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  scoreNum: {
    fontSize: 72,
    fontWeight: '800',
    lineHeight: 80,
  },
  scoreCaption: {
    fontSize: 12,
    marginTop: 4,
    marginBottom: 12,
  },
  scoreBar: {
    width: '100%',
    height: 8,
    borderRadius: 999,
    overflow: 'hidden',
  },
  scoreBarFill: {
    height: '100%',
    borderRadius: 999,
  },
  metricCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 8,
  },
  metricCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metricTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  metricSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  metricRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metricScore: {
    fontSize: 28,
    fontWeight: '800',
  },
  metricScoreSmall: {
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'right',
  },
  metricChev: {
    fontSize: 13,
  },
  metricDetail: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  metricExplanation: {
    fontSize: 12,
    lineHeight: 19,
    marginBottom: 10,
  },
  rangeRow: {
    flexDirection: 'row',
    gap: 6,
  },
  rangeBox: {
    flex: 1,
    borderRadius: 8,
    padding: 8,
    alignItems: 'center',
  },
  rangeLabel: {
    fontSize: 9,
    fontWeight: '700',
    marginBottom: 3,
  },
  rangeValue: {
    fontSize: 11,
    fontWeight: '700',
  },
  segmented: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 12,
    padding: 4,
    marginBottom: 12,
  },
  segmentButton: {
    flex: 1,
    minHeight: 38,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentText: {
    fontSize: 12,
    fontWeight: '900',
  },
  forecastHeadline: {
    fontSize: 22,
    lineHeight: 27,
    fontWeight: '900',
    marginBottom: 8,
  },
  forecastBars: {
    minHeight: 96,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginTop: 14,
    marginBottom: 12,
  },
  forecastBarColumn: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    gap: 6,
  },
  forecastBarTrack: {
    width: '100%',
    height: 70,
    borderRadius: 9,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  forecastBarFill: {
    width: '100%',
    borderRadius: 9,
  },
  forecastBarLabel: {
    fontSize: 9,
    lineHeight: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
});
