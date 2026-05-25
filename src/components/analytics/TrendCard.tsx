import { StyleSheet, Text, View } from 'react-native';

import Card from '../ui/Card';
import TrendPill from '../ui/TrendPill';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { FontSize, FontWeight } from '../../theme/tokens';
import type { MetricTrend, TrendSeverity } from '../../types/analytics';

type Props = {
  label:        string;
  value:        number | string;
  unit?:        string;
  trend:        MetricTrend;
  description?: string;
};

const SEVERITY_COLOR: Record<TrendSeverity, string> = {
  positive: colors.positive,
  neutral:  colors.neutral,
  warning:  colors.warning,
  critical: colors.critical,
};

export default function TrendCard({ label, value, unit, trend, description }: Props) {
  const color = SEVERITY_COLOR[trend.severity];

  return (
    <Card>
      <View style={styles.headerRow}>
        <Text style={styles.label}>{label}</Text>
        <TrendPill
          direction={trend.direction}
          severity={trend.severity}
          slope={trend.slope}
        />
      </View>

      <View style={styles.valueRow}>
        <Text style={styles.value}>{value}</Text>
        {unit ? <Text style={styles.unit}>{unit}</Text> : null}
      </View>

      {description ? (
        <Text style={styles.description}>{description}</Text>
      ) : (
        <Text style={[styles.description, { color }]}>
          {trend.changePercent >= 0 ? '+' : ''}{trend.changePercent.toFixed(1)}% from last week
        </Text>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    marginBottom:   spacing.md,
  },
  label: {
    color:         colors.textMuted,
    fontSize:      FontSize.base,
    fontWeight:    FontWeight.medium,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  valueRow: {
    flexDirection: 'row',
    alignItems:    'flex-end',
    gap:           6,
    marginBottom:  spacing.sm,
  },
  value: {
    color:      colors.text,
    fontSize:   FontSize.display,
    fontWeight: FontWeight.black,
    lineHeight: 52,
  },
  unit: {
    color:        colors.textMuted,
    fontSize:     FontSize.lg,
    fontWeight:   FontWeight.medium,
    marginBottom: 6,
  },
  description: {
    fontSize:   FontSize.sm,
    color:      colors.textDim,
    lineHeight: 18,
  },
});
