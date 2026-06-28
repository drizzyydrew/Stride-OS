import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useColors } from '../../../src/theme/useColors';
import { LAYOUT } from '../../../src/constants/layout';

type MetricOpen = 'aero' | 'ana' | 'proc' | null;

interface MetricCardProps {
  title: string;
  subtitle: string;
  score: number;
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
          <Text style={[styles.metricScore, { color: scoreColor }]}>{score}</Text>
          <Text style={[styles.metricChev, { color: C.textDim }]}>{open ? '▲' : '▼'}</Text>
        </View>
      </View>
      {open && (
        <View style={[styles.metricDetail, { borderTopColor: C.border }]}>
          <Text style={[styles.metricExplanation, { color: C.textMuted }]}>{explanation}</Text>
          <View style={styles.rangeRow}>
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
          </View>
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

  const SCORE = 82;

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
        <Text style={[styles.scoreLabel, { color: C.textDim }]}>OVERALL SCORE</Text>
        <Text style={[styles.scoreNum, { color: C.text }]}>{SCORE}</Text>
        <Text style={[styles.scoreCaption, { color: C.textMuted }]}>Updates as you train and improve</Text>
        <View style={[styles.scoreBar, { backgroundColor: C.border }]}>
          <View style={[styles.scoreBarFill, { width: `${SCORE}%`, backgroundColor: C.primary }]} />
        </View>
      </View>

      {/* Aerobic Power */}
      <MetricCard
        title="Aerobic Power"
        subtitle="VO₂max-derived capacity"
        score={82}
        scoreColor={C.positive}
        open={open === 'aero'}
        onToggle={() => toggle('aero')}
        explanation="82 = Strong. Aerobic Power measures how efficiently your body uses oxygen to produce energy at high intensity — derived from your VO₂max. Improve with consistent Zone 2 training and VO₂max intervals."
        ranges={[
          { label: 'DEVELOPING', range: '0–55', active: false },
          { label: 'GOOD',       range: '55–70', active: false },
          { label: 'STRONG',     range: '70–85', active: true },
          { label: 'ELITE',      range: '85+', active: false },
        ]}
      />

      {/* Anaerobic Battery */}
      <MetricCard
        title="Anaerobic Battery"
        subtitle="High-intensity capacity"
        score={71}
        scoreColor={C.warning}
        open={open === 'ana'}
        onToggle={() => toggle('ana')}
        explanation="71 = Good. Anaerobic Battery is your capacity for hard efforts above lactate threshold — surges, sprints, and finishing kicks. Build it with short, intense intervals (400m repeats, hill sprints at Z5–Z6)."
        ranges={[
          { label: 'LIMITED',  range: '0–50', active: false },
          { label: 'MODERATE', range: '50–65', active: false },
          { label: 'GOOD',     range: '65–80', active: true },
          { label: 'ELITE',    range: '80+', active: false },
        ]}
      />

      {/* Processing Power */}
      <MetricCard
        title="Processing Power"
        subtitle="Neuromuscular efficiency"
        score={88}
        scoreColor={C.accent}
        open={open === 'proc'}
        onToggle={() => toggle('proc')}
        explanation="88 = Excellent. Processing Power reflects how efficiently your nervous system coordinates movement under fatigue — running economy and neuromuscular coordination. Improve with strides, drills, and strength training."
        ranges={[
          { label: 'FAIR',      range: '0–60', active: false },
          { label: 'GOOD',      range: '60–80', active: false },
          { label: 'EXCELLENT', range: '80+', active: true },
        ]}
      />
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
