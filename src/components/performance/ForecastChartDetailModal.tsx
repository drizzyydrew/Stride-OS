import Modal from '../ui/RecoverableModal';
import { Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import { useColors } from '../../theme/useColors';
import type { PerformanceForecastMetric } from '../../utils/trainingOutlook';

type Props = {
  metric: PerformanceForecastMetric | null;
  confidence: string;
  limitations: string;
  onClose: () => void;
};

// Minimal forecast line: no axes, grid, or score labels. Only the line, a
// faint start dot, and the key point (projected peak / race day / as-of)
// emphasized. Dates are rendered as text below, not inside the SVG.
function ForecastLine({
  metric,
  lineColor,
  faintColor,
}: {
  metric: PerformanceForecastMetric;
  lineColor: string;
  faintColor: string;
}) {
  const values = metric.chartValues.length > 1 ? metric.chartValues : [metric.chartValues[0] ?? 0, metric.chartValues[0] ?? 0];
  const width = 300;
  const height = 96;
  const pad = 8;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = Math.max(1, max - min);
  const points = values.map((value, index) => ({
    x: pad + (index * (width - pad * 2)) / Math.max(1, values.length - 1),
    // Keep the line in the middle 70% so a flat trend doesn't hug an edge.
    y: pad + height * 0.15 + (1 - (value - min) / span) * (height - pad * 2) * 0.7,
  }));
  // Smooth curve through the points (Catmull-Rom -> cubic Bezier).
  let d = `M ${points[0]!.x.toFixed(1)} ${points[0]!.y.toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[Math.max(0, i - 1)]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p3 = points[Math.min(points.length - 1, i + 2)]!;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  const keyIndex = Math.min(points.length - 1, Math.max(0, metric.keyPointIndex));
  const key = points[keyIndex]!;
  const first = points[0]!;

  return (
    <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} accessibilityElementsHidden>
      <Line x1={key.x} y1={key.y} x2={key.x} y2={height - 2} stroke={faintColor} strokeWidth={1} strokeDasharray="2 4" />
      <Path d={d} stroke={lineColor} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Circle cx={first.x} cy={first.y} r={3} fill={faintColor} />
      <Circle cx={key.x} cy={key.y} r={5} fill={lineColor} />
    </Svg>
  );
}

export default function ForecastChartDetailModal({ metric, confidence, limitations, onClose }: Props) {
  const C = useColors();
  const lineColor = metric?.key === 'training_load_trend' ? C.positive : C.primary;
  const firstDate = metric?.chartLabels[0];

  return (
    <Modal visible={Boolean(metric)} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessible={false}>
        <Pressable style={[styles.sheet, { backgroundColor: C.card, borderColor: C.border }]} onPress={event => event.stopPropagation()} accessible={false}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: C.text }]}>{metric?.label ?? 'Forecast'}</Text>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeButton, { backgroundColor: C.cardAlt, borderColor: C.border }]}
              accessibilityRole="button"
              accessibilityLabel="Close chart detail"
            >
              <Ionicons name="close" size={18} color={C.textMuted} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
            {metric ? (
              <>
                <View style={styles.hero}>
                  <View style={styles.heroLeft}>
                    <Text
                      style={[styles.percent, { color: C.text }]}
                      accessibilityLabel={`${metric.headlinePercent} percent`}
                    >
                      {metric.headlinePercent}%
                    </Text>
                    <Text style={[styles.explanation, { color: C.textMuted }]}>{metric.headlineExplanation}</Text>
                  </View>
                  <View style={styles.heroRight}>
                    <ForecastLine metric={metric} lineColor={lineColor} faintColor={C.textDim} />
                    <View style={styles.dateRow}>
                      <Text style={[styles.dateText, { color: C.textDim }]}>{firstDate ?? ''}</Text>
                      <Text style={[styles.dateText, { color: C.textDim }]}>{metric.chartLabels[metric.chartLabels.length - 1] ?? ''}</Text>
                    </View>
                  </View>
                </View>

                <View style={[styles.keyDate, { borderColor: C.border }]}>
                  <Text style={[styles.keyDateTitle, { color: C.textMuted }]}>{metric.keyDateTitle}</Text>
                  <Text style={[styles.keyDateValue, { color: lineColor }]}>{metric.keyDateLabel}</Text>
                </View>

                <Text style={[styles.summary, { color: C.text }]}>{metric.summary}</Text>
                <Text style={[styles.confidence, { color: C.textDim }]}>
                  Confidence: {confidence}. {limitations}
                </Text>
              </>
            ) : null}
          </ScrollView>
          <TouchableOpacity
            onPress={onClose}
            style={[styles.doneButton, { backgroundColor: C.primary }]}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Text style={[styles.doneText, { color: C.onPrimary ?? '#FFFFFF' }]}>Close</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.68)',
    justifyContent: 'center',
    padding: 20,
  },
  sheet: {
    maxHeight: '78%',
    borderWidth: 1,
    borderRadius: 18,
    padding: 18,
    borderCurve: 'continuous',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  title: {
    flex: 1,
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '800',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    maxHeight: 420,
  },
  bodyContent: {
    gap: 14,
    paddingBottom: 4,
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  heroLeft: {
    width: 104,
  },
  heroRight: {
    flex: 1,
  },
  percent: {
    fontSize: 40,
    lineHeight: 44,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  explanation: {
    fontSize: 11.5,
    lineHeight: 15,
    marginTop: 4,
  },
  dateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  dateText: {
    fontSize: 11,
    fontWeight: '600',
  },
  keyDate: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 10,
  },
  keyDateTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  keyDateValue: {
    fontSize: 16,
    fontWeight: '800',
  },
  summary: {
    fontSize: 14,
    lineHeight: 20,
  },
  confidence: {
    fontSize: 12,
    lineHeight: 17,
  },
  doneButton: {
    marginTop: 14,
    minHeight: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneText: {
    fontSize: 15,
    fontWeight: '800',
  },
});
