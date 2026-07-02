import { StyleSheet, Text, View } from 'react-native';
import { useThemeColors, type ThemeColors } from '../../theme/ThemeContext';
import { Radius } from '../../theme/tokens';
import type { TrendDirection, TrendSeverity } from '../../types/analytics';

type Props = {
  direction: TrendDirection;
  severity:  TrendSeverity;
  slope:     number;
};

function severityColor(severity: TrendSeverity, colors: ThemeColors): string {
  if (severity === 'positive') return colors.positive;
  if (severity === 'neutral')  return colors.neutral;
  if (severity === 'warning')  return colors.warning;
  return colors.critical;
}

const DIRECTION_SYMBOL: Record<TrendDirection, string> = {
  up:   '↑',
  down: '↓',
  flat: '→',
};

function formatSlope(slope: number): string {
  const abs  = Math.abs(slope);
  const sign = slope >= 0 ? '+' : '−';
  return `${sign}${abs.toFixed(1)}/wk`;
}

export default function TrendPill({ direction, severity, slope }: Props) {
  const colors = useThemeColors();
  const color  = severityColor(severity, colors);
  const symbol = DIRECTION_SYMBOL[direction];

  return (
    <View style={[styles.pill, { backgroundColor: color + '22' }]}>
      <Text style={[styles.symbol, { color }]}>{symbol}</Text>
      <Text style={[styles.slope,  { color }]}>{formatSlope(slope)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: 10,
    paddingVertical:    4,
    borderRadius:      Radius.sm,
    gap:               4,
  },
  symbol: {
    fontSize:   14,
    fontWeight: '700',
  },
  slope: {
    fontSize:   12,
    fontWeight: '600',
  },
});
