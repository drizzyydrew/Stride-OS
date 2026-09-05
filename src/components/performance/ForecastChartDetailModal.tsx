import { useEffect, useMemo, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, Line, Polyline, Rect, Text as SvgText } from 'react-native-svg';

import { useColors } from '../../theme/useColors';
import type { PerformanceForecastMetric } from '../../utils/trainingOutlook';
import { buildForecastChartDetail, formatForecastChartValue } from '../../utils/performanceForecastChart';

type Props = {
  metric: PerformanceForecastMetric | null;
  confidence: string;
  limitations: string;
  onClose: () => void;
};

type LegendKey = 'series' | 'x' | 'y' | 'confidence';

function ForecastDetailChart({
  metric,
  lineColor,
  mutedColor,
  textColor,
  bgColor,
}: {
  metric: PerformanceForecastMetric;
  lineColor: string;
  mutedColor: string;
  textColor: string;
  bgColor: string;
}) {
  const values = metric.chartValues.length > 0 ? metric.chartValues : [0];
  const maxValue = Math.max(1, ...values);
  const minValue = Math.min(0, ...values);
  const span = Math.max(1, maxValue - minValue);
  const chart = { width: 320, height: 220, left: 46, right: 18, top: 22, bottom: 52 };
  const plotWidth = chart.width - chart.left - chart.right;
  const plotHeight = chart.height - chart.top - chart.bottom;
  const points = values.map((value, index) => {
    const x = chart.left + (index * (plotWidth / Math.max(1, values.length - 1)));
    const y = chart.top + (1 - ((value - minValue) / span)) * plotHeight;
    return { x, y, value, label: metric.chartLabels[index] ?? `P${index + 1}` };
  });
  const polyline = points.map(point => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ');

  return (
    <View style={[styles.chartFrame, { backgroundColor: bgColor, borderColor: mutedColor }]}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${chart.width} ${chart.height}`}>
        <Line x1={chart.left} y1={chart.top} x2={chart.left} y2={chart.top + plotHeight} stroke={mutedColor} strokeWidth="1.4" opacity={0.7} />
        <Line x1={chart.left} y1={chart.top + plotHeight} x2={chart.left + plotWidth} y2={chart.top + plotHeight} stroke={mutedColor} strokeWidth="1.4" opacity={0.7} />
        {[0, 0.5, 1].map(ratio => {
          const y = chart.top + plotHeight * ratio;
          const value = maxValue - span * ratio;
          return (
            <SvgText key={`y-${ratio}`} x={chart.left - 8} y={y + 4} fill={textColor} fontSize="9" fontWeight="700" textAnchor="end" opacity={0.72}>
              {formatForecastChartValue(metric, value)}
            </SvgText>
          );
        })}
        {metric.key === 'training_load_trend' ? points.map(point => (
          <Rect
            key={`bar-${point.label}`}
            x={point.x - 12}
            y={point.y}
            width="24"
            height={chart.top + plotHeight - point.y}
            rx="7"
            fill={lineColor}
            opacity={0.24}
          />
        )) : null}
        <Polyline points={polyline} stroke={lineColor} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity={0.92} />
        {points.map(point => (
          <Circle key={`point-${point.label}`} cx={point.x} cy={point.y} r="5" fill={lineColor} stroke="#0E0E0F" strokeWidth="2" />
        ))}
        {points.map(point => (
          <SvgText key={`x-${point.label}`} x={point.x} y={chart.height - 26} fill={textColor} fontSize="9" fontWeight="800" textAnchor="middle" opacity={0.76}>
            {point.label.toUpperCase()}
          </SvgText>
        ))}
        <SvgText x={chart.left + plotWidth / 2} y={chart.height - 7} fill={textColor} fontSize="10" fontWeight="900" textAnchor="middle" opacity={0.82}>
          {metric.chartXAxisLabel}
        </SvgText>
        <SvgText x="12" y={chart.top + plotHeight / 2} fill={textColor} fontSize="10" fontWeight="900" textAnchor="middle" rotation="-90" origin={`12 ${chart.top + plotHeight / 2}`} opacity={0.82}>
          {metric.chartYAxisLabel}
        </SvgText>
      </Svg>
    </View>
  );
}

export default function ForecastChartDetailModal({ metric, confidence, limitations, onClose }: Props) {
  const C = useColors();
  const [selectedLegend, setSelectedLegend] = useState<LegendKey>('series');
  const legendCopy = useMemo(() => {
    if (!metric) return '';
    if (selectedLegend === 'x') return metric.chartXAxisLabel;
    if (selectedLegend === 'y') return metric.chartYAxisLabel;
    if (selectedLegend === 'confidence') return `Confidence: ${confidence}. ${limitations}`;
    return `The ${metric.chartValueUnit} series plots ${metric.chartLabels.length} current data point${metric.chartLabels.length === 1 ? '' : 's'} used by ${metric.label}.`;
  }, [confidence, limitations, metric, selectedLegend]);

  useEffect(() => {
    setSelectedLegend('series');
  }, [metric?.key]);

  return (
    <Modal visible={Boolean(metric)} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { backgroundColor: C.card, borderColor: C.border }]}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.kicker, { color: C.textDim }]}>CHART DETAIL</Text>
              <Text style={[styles.title, { color: C.text }]}>{metric?.label ?? 'Forecast Chart'}</Text>
            </View>
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
                <ForecastDetailChart
                  metric={metric}
                  lineColor={metric.key === 'training_load_trend' ? C.positive : C.primary}
                  mutedColor={C.border}
                  textColor={C.textMuted}
                  bgColor={C.bg}
                />
                <View style={styles.legendRow}>
                  {([
                    ['series', metric.chartValueUnit.toUpperCase()],
                    ['x', 'X-AXIS'],
                    ['y', 'Y-AXIS'],
                    ['confidence', 'CONFIDENCE'],
                  ] as Array<[LegendKey, string]>).map(([key, label]) => {
                    const active = selectedLegend === key;
                    return (
                      <TouchableOpacity
                        key={key}
                        onPress={() => setSelectedLegend(key)}
                        style={[styles.legendChip, { borderColor: active ? C.primary : C.border, backgroundColor: active ? C.primaryDim : C.cardAlt }]}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        accessibilityLabel={`${label} legend explanation`}
                      >
                        <Text style={[styles.legendText, { color: active ? C.primary : C.textMuted }]}>{label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <Text selectable style={[styles.legendCopy, { color: C.textMuted }]}>{legendCopy}</Text>
                <View style={[styles.axisBox, { backgroundColor: C.cardAlt, borderColor: C.border }]}>
                  <Text style={[styles.axisLabel, { color: C.primary }]}>X-axis</Text>
                  <Text style={[styles.axisValue, { color: C.textMuted }]}>{metric.chartXAxisLabel}</Text>
                </View>
                <View style={[styles.axisBox, { backgroundColor: C.cardAlt, borderColor: C.border }]}>
                  <Text style={[styles.axisLabel, { color: C.primary }]}>Y-axis</Text>
                  <Text style={[styles.axisValue, { color: C.textMuted }]}>{metric.chartYAxisLabel}</Text>
                </View>
                <Text selectable style={[styles.detailText, { color: C.textMuted }]}>
                  {buildForecastChartDetail(metric)}
                </Text>
                <Text style={[styles.limitations, { color: C.textDim }]}>
                  Confidence: {confidence}. {limitations}
                </Text>
              </>
            ) : null}
          </ScrollView>
        </View>
      </View>
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
    padding: 16,
    borderCurve: 'continuous',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  kicker: {
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
  title: {
    fontSize: 21,
    lineHeight: 26,
    fontWeight: '900',
    marginTop: 2,
  },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    maxHeight: 420,
  },
  bodyContent: {
    gap: 10,
    paddingBottom: 4,
  },
  chartFrame: {
    height: 238,
    borderWidth: 1,
    borderRadius: 14,
    padding: 8,
    overflow: 'hidden',
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  legendChip: {
    minHeight: 32,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  legendText: {
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  legendCopy: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
  },
  axisBox: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  axisLabel: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  axisValue: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
    marginTop: 4,
  },
  detailText: {
    fontSize: 13,
    lineHeight: 20,
  },
  limitations: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },
});
