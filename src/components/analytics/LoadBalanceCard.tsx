import { StyleSheet, Text, View } from 'react-native';

import Card from '../ui/Card';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { FontSize, FontWeight } from '../../theme/tokens';
import type { TrainingLoad, TrendSeverity } from '../../types/analytics';

type Props = {
  load: TrainingLoad;
};

const ACWR_COLOR: Record<TrendSeverity, string> = {
  positive: colors.positive,
  neutral:  colors.neutral,
  warning:  colors.warning,
  critical: colors.critical,
};

const ACWR_LABEL: Record<TrendSeverity, string> = {
  positive: 'Optimal Zone',
  neutral:  'Undertrained',
  warning:  'Elevated Risk',
  critical: 'High Risk',
};

function MetricColumn({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.column}>
      <Text style={styles.columnValue}>{value}</Text>
      <Text style={styles.columnLabel}>{label}</Text>
    </View>
  );
}

export default function LoadBalanceCard({ load }: Props) {
  const acwrColor = ACWR_COLOR[load.acwrSeverity];
  const acwrLabel = ACWR_LABEL[load.acwrSeverity];

  return (
    <Card>
      <Text style={styles.title}>Training Load</Text>

      <View style={styles.metricsRow}>
        <MetricColumn value={`${load.acute}`}   label="ACUTE (ATL)"   />
        <View style={styles.divider} />
        <MetricColumn value={`${load.chronic}`} label="CHRONIC (CTL)" />
        <View style={styles.divider} />
        <View style={styles.column}>
          <Text style={[styles.columnValue, { color: acwrColor }]}>
            {load.acwr.toFixed(2)}
          </Text>
          <Text style={styles.columnLabel}>ACWR</Text>
        </View>
      </View>

      <View style={[styles.acwrBadge, { backgroundColor: acwrColor + '18' }]}>
        <View style={[styles.acwrDot, { backgroundColor: acwrColor }]} />
        <Text style={[styles.acwrBadgeText, { color: acwrColor }]}>{acwrLabel}</Text>
        <Text style={styles.acwrRange}> · Sweet spot: 0.8 – 1.3</Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  title: {
    color:         colors.textMuted,
    fontSize:      FontSize.base,
    fontWeight:    FontWeight.medium,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom:  spacing.xl,
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems:    'center',
    marginBottom:  spacing.lg + 2,
  },
  column: {
    flex:       1,
    alignItems: 'center',
  },
  columnValue: {
    color:        colors.text,
    fontSize:     28,
    fontWeight:   FontWeight.black,
    marginBottom: spacing.xs,
  },
  columnLabel: {
    color:         colors.textDim,
    fontSize:      10,
    fontWeight:    FontWeight.medium,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  divider: {
    width:           1,
    height:          40,
    backgroundColor: colors.border,
    marginHorizontal: spacing.sm,
  },
  acwrBadge: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.sm,
    borderRadius:      10,
  },
  acwrDot: {
    width:       6,
    height:      6,
    borderRadius: 3,
    marginRight: spacing.sm,
  },
  acwrBadgeText: {
    fontSize:   FontSize.sm,
    fontWeight: FontWeight.bold,
  },
  acwrRange: {
    color:    colors.textDim,
    fontSize: 12,
  },
});
