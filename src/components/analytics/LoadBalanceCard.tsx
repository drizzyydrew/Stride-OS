import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import Card from '../ui/Card';
import { useThemeColors, type ThemeColors } from '../../theme/ThemeContext';
import { spacing } from '../../theme/spacing';
import { FontSize, FontWeight } from '../../theme/tokens';
import type { TrainingLoad, TrendSeverity } from '../../types/analytics';

type Props = {
  load: TrainingLoad;
};

function acwrColorFor(sev: TrendSeverity, colors: ThemeColors): string {
  const ACWR_COLOR: Record<TrendSeverity, string> = {
    positive: colors.positive,
    neutral:  colors.neutral,
    warning:  colors.warning,
    critical: colors.critical,
  };
  return ACWR_COLOR[sev];
}

const ACWR_LABEL: Record<TrendSeverity, string> = {
  positive: 'Optimal Zone',
  neutral:  'Undertrained',
  warning:  'Elevated Risk',
  critical: 'High Risk',
};

function MetricColumn({ value, label, s }: { value: string; label: string; s: ReturnType<typeof createStyles> }) {
  return (
    <View style={s.column}>
      <Text style={s.columnValue}>{value}</Text>
      <Text style={s.columnLabel}>{label}</Text>
    </View>
  );
}

export default function LoadBalanceCard({ load }: Props) {
  const colors = useThemeColors();
  const s      = useMemo(() => createStyles(colors), [colors]);

  const acwrColor = acwrColorFor(load.acwrSeverity, colors);
  const acwrLabel = ACWR_LABEL[load.acwrSeverity];

  return (
    <Card>
      <Text style={s.title}>Training Load</Text>

      <View style={s.metricsRow}>
        <MetricColumn value={`${load.acute}`}   label="ACUTE (ATL)"   s={s} />
        <View style={s.divider} />
        <MetricColumn value={`${load.chronic}`} label="CHRONIC (CTL)" s={s} />
        <View style={s.divider} />
        <View style={s.column}>
          <Text style={[s.columnValue, { color: acwrColor }]}>
            {load.acwr.toFixed(2)}
          </Text>
          <Text style={s.columnLabel}>ACWR</Text>
        </View>
      </View>

      <View style={[s.acwrBadge, { backgroundColor: acwrColor + '18' }]}>
        <View style={[s.acwrDot, { backgroundColor: acwrColor }]} />
        <Text style={[s.acwrBadgeText, { color: acwrColor }]}>{acwrLabel}</Text>
        <Text style={s.acwrRange}> · Sweet spot: 0.8 – 1.3</Text>
      </View>
    </Card>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
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
}
