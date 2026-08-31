import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { buildCurrentStreakSummary, formatStreakRemaining } from './streakUtils';
import { STREAK_HEAT_COLORS } from './streakTokens';

type Props = {
  days: number;
  style?: StyleProp<ViewStyle>;
};

export default function StreakProgress({ days, style }: Props) {
  const summary = buildCurrentStreakSummary(days);
  const color = STREAK_HEAT_COLORS[summary.heatTier.token].primary;
  const width = `${Math.round(summary.progressRatio * 100)}%` as `${number}%`;

  return (
    <View style={[styles.wrap, style]} accessibilityLabel={summary.accessibilityLabel}>
      <View style={styles.track}>
        <View style={[styles.fill, { width, backgroundColor: color }]} />
      </View>
      <Text style={[styles.copy, { color }]}>
        {summary.nextMilestone ? `${formatStreakRemaining(summary.daysRemaining)} until ${summary.nextMilestone.thresholdDays}` : '365-day milestone achieved'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  track: {
    height: 5,
    borderRadius: 999,
    backgroundColor: '#2A2D2F',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 999,
  },
  copy: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
  },
});
