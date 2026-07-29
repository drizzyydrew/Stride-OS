import { StyleSheet, Text, View } from 'react-native';

import type { UnitSystem } from '../../store/settingsStore';
import { formatReportDistance, type StrideReport } from '../../utils/strideReport';

type Props = {
  report: StrideReport;
  units: UnitSystem;
};

export default function ShareCardAchievementFocus({ report, units }: Props) {
  const achievement = report.healthyAchievements[0] ?? {
    value: 'Healthy Consistency',
    detail: 'Training that supports the next week, not just today.',
  };

  return (
    <View style={s.card} collapsable={false}>
      <Text style={s.eyebrow}>HEALTHY PROGRESS</Text>
      <Text style={s.title}>{achievement.value}</Text>
      <Text style={s.copy}>{achievement.detail}</Text>
      <View style={s.summary}>
        <Text style={s.summaryValue}>{report.totals.activeDays}</Text>
        <Text style={s.summaryLabel}>active days · {formatReportDistance(report.totals.distanceMiles, units)}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    width: '100%',
    borderRadius: 28,
    padding: 24,
    backgroundColor: '#8B927C',
    minHeight: 420,
    justifyContent: 'space-between',
  },
  eyebrow: {
    color: '#10130f',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 2,
  },
  title: {
    color: '#0a0a0a',
    fontSize: 38,
    fontWeight: '900',
    lineHeight: 44,
  },
  copy: {
    color: '#1c201a',
    fontSize: 17,
    lineHeight: 25,
    fontWeight: '700',
  },
  summary: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(10,10,10,0.2)',
    paddingTop: 18,
  },
  summaryValue: {
    color: '#0a0a0a',
    fontSize: 52,
    fontWeight: '900',
  },
  summaryLabel: {
    color: '#1c201a',
    fontSize: 15,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});
