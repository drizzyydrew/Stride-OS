import { StyleSheet, Text, View } from 'react-native';

import Card from '../ui/Card';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { FontSize, FontWeight, Radius } from '../../theme/tokens';
import type { ReadinessForecast, FatigueTrajectory, OverreachingRisk } from '../../types/forecast';

type Props = {
  readiness: ReadinessForecast;
  fatigue:   FatigueTrajectory;
  risk:      OverreachingRisk;
};

const RISK_COLOR: Record<OverreachingRisk['level'], string> = {
  low:      colors.positive,
  moderate: colors.warning,
  high:     colors.critical,
};

const RISK_BG: Record<OverreachingRisk['level'], string> = {
  low:      colors.positiveDim,
  moderate: colors.warningDim,
  high:     colors.criticalDim,
};

function dotColor(value: number): string {
  if (value > 70) return colors.critical;
  if (value > 50) return colors.warning;
  return colors.positive;
}

export default function ReadinessForecastCard({ readiness, fatigue, risk }: Props) {
  return (
    <Card>
      <Text style={styles.cardTitle}>PERFORMANCE FORECAST</Text>

      {/* Readiness peak */}
      <View style={styles.section}>
        <View style={styles.row}>
          <View>
            <Text style={styles.label}>Peak Readiness Window</Text>
            <Text style={styles.subtext}>
              {readiness.peakReadinessWeek === 0
                ? 'Now — current form is peak'
                : `+${readiness.peakReadinessWeek} week${readiness.peakReadinessWeek > 1 ? 's' : ''} from now`}
            </Text>
          </View>
          <Text style={styles.peakValue}>{readiness.projectedPeakValue}</Text>
        </View>
        <Text style={styles.explanation}>{readiness.explanation}</Text>
      </View>

      {/* Fatigue trajectory dots */}
      <View style={styles.section}>
        <View style={styles.row}>
          <Text style={styles.label}>Fatigue (next 4 weeks)</Text>
          <View style={styles.dotRow}>
            {fatigue.trajectory.map(pt => (
              <View
                key={pt.weeksFromNow}
                style={[styles.dot, { backgroundColor: dotColor(pt.value) }]}
              />
            ))}
          </View>
        </View>
        <Text style={styles.explanation}>{fatigue.explanation}</Text>
      </View>

      {/* Overreaching risk */}
      <View style={[styles.riskBanner, { backgroundColor: RISK_BG[risk.level] }]}>
        <View style={styles.riskHeader}>
          <Text style={styles.label}>Overreaching Risk</Text>
          <View style={[styles.riskBadge, { backgroundColor: RISK_COLOR[risk.level] + '22' }]}>
            <Text style={[styles.riskBadgeText, { color: RISK_COLOR[risk.level] }]}>
              {risk.level.toUpperCase()}
            </Text>
          </View>
        </View>
        <Text style={[styles.explanation, { color: colors.textDim }]}>{risk.explanation}</Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  cardTitle: {
    color:         colors.textMuted,
    fontSize:      11,
    fontWeight:    FontWeight.medium,
    letterSpacing: 0.6,
    marginBottom:  spacing.lg,
  },
  section: {
    marginBottom: spacing.lg,
  },
  row: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'flex-start',
    marginBottom:   spacing.xs,
  },
  label: {
    color:        colors.text,
    fontSize:     FontSize.sm,
    fontWeight:   FontWeight.bold,
    marginBottom: spacing.xs,
  },
  peakValue: {
    color:      colors.text,
    fontSize:   FontSize.xxl,
    fontWeight: FontWeight.black,
    lineHeight: 44,
  },
  subtext: {
    color:     colors.textDim,
    fontSize:  FontSize.sm,
  },
  explanation: {
    color:      colors.textMuted,
    fontSize:   12,
    lineHeight: 17,
    fontStyle:  'italic',
  },
  dotRow: {
    flexDirection: 'row',
    gap:           spacing.xs,
    alignItems:    'center',
    marginTop:     spacing.xs,
  },
  dot: {
    width:        10,
    height:       10,
    borderRadius: 5,
  },
  riskBanner: {
    borderRadius: Radius.sm,
    padding:      spacing.md,
  },
  riskHeader: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    marginBottom:   spacing.xs,
  },
  riskBadge: {
    paddingHorizontal: 8,
    paddingVertical:   3,
    borderRadius:      Radius.sm,
  },
  riskBadgeText: {
    fontSize:      10,
    fontWeight:    FontWeight.black,
    letterSpacing: 0.6,
  },
});
