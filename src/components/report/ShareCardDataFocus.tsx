import { StyleSheet, Text, View } from 'react-native';

import type { UnitSystem } from '../../store/settingsStore';
import { formatReportDistance, formatReportDuration, formatReportElevation, type StrideReport } from '../../utils/strideReport';

type Props = {
  report: StrideReport;
  units: UnitSystem;
};

export default function ShareCardDataFocus({ report, units }: Props) {
  const stats = [
    ['Distance', formatReportDistance(report.totals.distanceMiles, units)],
    ['Training', formatReportDuration(report.totals.trainingMinutes)],
    ['Runs', `${report.totals.runs}`],
    ['Active days', `${report.totals.activeDays}`],
    ['Elevation', formatReportElevation(report.totals.elevationGainMeters, units)],
    ['Strength', `${report.totals.strengthSessions}`],
  ];

  return (
    <View style={s.card} collapsable={false}>
      <Text style={s.eyebrow}>TRAINING DATA</Text>
      <Text style={s.title}>{report.range.label}</Text>
      <View style={s.grid}>
        {stats.map(([label, value]) => (
          <View key={label} style={s.stat}>
            <Text style={s.statLabel}>{label}</Text>
            <Text style={s.statValue}>{value}</Text>
          </View>
        ))}
      </View>
      <Text style={s.footer}>Private notes, routes, symptoms, and exact locations are not included.</Text>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    width: '100%',
    borderRadius: 28,
    padding: 24,
    backgroundColor: '#111111',
    minHeight: 420,
  },
  eyebrow: {
    color: '#DCC0A7',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 2,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '900',
    marginTop: 8,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 24,
  },
  stat: {
    width: '47%',
    borderRadius: 18,
    padding: 14,
    backgroundColor: '#202020',
  },
  statLabel: {
    color: '#999999',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  statValue: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
    marginTop: 6,
  },
  footer: {
    color: '#CCCCCC',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 22,
  },
});
