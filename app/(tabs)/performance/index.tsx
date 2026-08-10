import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useColors } from '../../../src/theme/useColors';
import { LAYOUT } from '../../../src/constants/layout';
import { useActivityStore } from '../../../src/store/activityStore';
import { buildAdaptivePerformanceModel, type AdaptivePerformanceMetric } from '../../../src/utils/adaptivePerformance';

type MetricOpen = 'aero' | 'ana' | 'proc' | null;

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

export default function PerformanceScreen() {
  const C = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [open, setOpen] = useState<MetricOpen>(null);
  const toggle = (key: MetricOpen) => setOpen(p => p === key ? null : key);
  const activities = useActivityStore(state => state.activities);
  const model = buildAdaptivePerformanceModel(activities);

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
});
