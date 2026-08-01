import { StyleSheet, Text, View } from 'react-native';

import type { UnitSystem } from '../../store/settingsStore';
import { formatReportDistance, formatReportDuration, strideReportHighlightsForUnits, type StrideReport } from '../../utils/strideReport';

type Props = {
  report: StrideReport;
  units: UnitSystem;
};

export default function ShareCardCleanSummary({ report, units }: Props) {
  const highlights = strideReportHighlightsForUnits(report, units);
  return (
    <View style={s.card} collapsable={false}>
      <Text style={s.eyebrow}>STRIDEOS</Text>
      <Text style={s.title}>{report.range.label}</Text>
      <Text style={s.hero}>{formatReportDistance(report.totals.distanceMiles, units)}</Text>
      <Text style={s.subtitle}>
        {formatReportDuration(report.totals.trainingMinutes)} · {report.totals.activeDays} active days
      </Text>
      <View style={s.rule} />
      {highlights.slice(0, 3).map(item => (
        <View key={`${item.label}-${item.value}`} style={s.row}>
          <Text style={s.rowLabel}>{item.label}</Text>
          <Text style={s.rowValue}>{item.value}</Text>
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    width: '100%',
    borderRadius: 28,
    padding: 24,
    backgroundColor: '#EFE7DA',
    minHeight: 420,
    justifyContent: 'space-between',
  },
  eyebrow: {
    color: '#4D433E',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 2,
  },
  title: {
    color: '#0a0a0a',
    fontSize: 24,
    fontWeight: '900',
  },
  hero: {
    color: '#0a0a0a',
    fontSize: 58,
    fontWeight: '900',
  },
  subtitle: {
    color: '#4D433E',
    fontSize: 18,
    fontWeight: '700',
  },
  rule: {
    height: 1,
    backgroundColor: 'rgba(10,10,10,0.18)',
    marginVertical: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
    paddingVertical: 8,
  },
  rowLabel: {
    color: '#4D433E',
    fontSize: 14,
    fontWeight: '800',
  },
  rowValue: {
    color: '#0a0a0a',
    fontSize: 14,
    fontWeight: '900',
    textAlign: 'right',
    flexShrink: 1,
  },
});
