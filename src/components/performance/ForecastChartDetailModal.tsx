import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useColors } from '../../theme/useColors';
import type { PerformanceForecastMetric } from '../../utils/trainingOutlook';
import { buildForecastChartDetail } from '../../utils/performanceForecastChart';

type Props = {
  metric: PerformanceForecastMetric | null;
  confidence: string;
  limitations: string;
  onClose: () => void;
};

export default function ForecastChartDetailModal({ metric, confidence, limitations, onClose }: Props) {
  const C = useColors();

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
