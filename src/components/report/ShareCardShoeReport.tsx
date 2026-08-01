import { StyleSheet, Text, View } from 'react-native';

import type { UnitSystem } from '../../store/settingsStore';
import {
  formatReportDistance,
  formatReportDuration,
  formatReportElevation,
  type StrideReport,
  type StrideReportShoeSummary,
} from '../../utils/strideReport';

type Props = {
  report: StrideReport;
  units: UnitSystem;
};

function shoeState(summary: StrideReportShoeSummary): string {
  if (summary.shoeId === null) return 'Unassigned';
  return summary.active ? 'Active' : 'Retired';
}

export default function ShareCardShoeReport({ report, units }: Props) {
  const shoe = report.shoeReport.mostUsed
    ?? report.shoeReport.highestElevation
    ?? report.shoeReport.longestRun
    ?? null;

  if (!shoe) {
    return (
      <View style={s.card} collapsable={false}>
        <Text style={s.eyebrow}>SHOE REPORT</Text>
        <Text style={s.title}>{report.range.label}</Text>
        <Text style={s.empty}>No assigned shoe mileage in this period yet.</Text>
        <Text style={s.footer}>Shoe photos, routes, locations, private notes, readiness, and symptoms are not included.</Text>
      </View>
    );
  }

  const stats = [
    ['Period', formatReportDistance(shoe.periodDistanceMiles, units)],
    ['Runs', `${shoe.periodRuns}`],
    ['Time', formatReportDuration(shoe.periodMinutes)],
    ['Elevation', formatReportElevation(shoe.periodElevationGainMeters, units)],
    ['Longest run', formatReportDistance(shoe.longestRunMiles, units)],
    ['Lifetime', formatReportDistance(shoe.lifetimeDistanceMiles, units)],
  ];

  return (
    <View style={s.card} collapsable={false}>
      <Text style={s.eyebrow}>SHOE REPORT</Text>
      <Text style={s.title} numberOfLines={2}>{shoe.label}</Text>
      <Text style={s.subtitle}>{shoeState(shoe)} · {report.range.label}</Text>
      <View style={s.grid}>
        {stats.map(([label, value]) => (
          <View key={label} style={s.stat}>
            <Text style={s.statLabel}>{label}</Text>
            <Text style={s.statValue}>{value}</Text>
          </View>
        ))}
      </View>
      {shoe.reminderStatus ? <Text style={s.reminder}>{shoe.reminderStatus}</Text> : null}
      <Text style={s.footer}>Photos excluded by default. Routes, locations, private notes, readiness, and symptoms are not included.</Text>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    width: '100%',
    borderRadius: 24,
    padding: 24,
    backgroundColor: '#0F1720',
    minHeight: 420,
  },
  eyebrow: {
    color: '#9FC8B7',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 2,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 31,
    lineHeight: 36,
    fontWeight: '900',
    marginTop: 10,
  },
  subtitle: {
    color: '#C8D3D0',
    fontSize: 15,
    fontWeight: '800',
    marginTop: 6,
  },
  empty: {
    color: '#FFFFFF',
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '900',
    marginTop: 34,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 22,
  },
  stat: {
    width: '47%',
    borderRadius: 8,
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  statLabel: {
    color: '#9FC8B7',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  statValue: {
    color: '#FFFFFF',
    fontSize: 21,
    lineHeight: 26,
    fontWeight: '900',
    marginTop: 5,
  },
  reminder: {
    color: '#F0D27A',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
    marginTop: 16,
  },
  footer: {
    color: '#C8D3D0',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 18,
  },
});
