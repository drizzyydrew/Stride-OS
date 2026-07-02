import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import Card from '../ui/Card';
import Badge from '../ui/Badge';
import { useThemeColors, type ThemeColors } from '../../theme/ThemeContext';
import { spacing } from '../../theme/spacing';
import { FontSize, FontWeight } from '../../theme/tokens';
import type { TrainingPhase } from '../../types/training';

type Props = {
  recoveryScore:  number;
  fatigueScore:   number;
  trainingPhase:  TrainingPhase;
  soreness:       number;
  motivation:     number;
};

// Phase badges: base/build are "in motion" training states (Sage), peak is
// the athlete's focal push (Clay), deload/taper map to their literal
// warning/positive semantics rather than a decorative per-phase rainbow.
function phaseBadge(colors: ThemeColors): Record<TrainingPhase, { bg: string; text: string; label: string }> {
  return {
    base:   { bg: colors.sage + '22',    text: colors.sage,     label: 'Base'   },
    build:  { bg: colors.sage + '22',    text: colors.sage,     label: 'Build'  },
    peak:   { bg: colors.primaryDim,     text: colors.primary,  label: 'Peak'   },
    deload: { bg: colors.warningDim,     text: colors.warning,  label: 'Deload' },
    taper:  { bg: colors.positiveDim,    text: colors.positive, label: 'Taper'  },
  };
}

function recoveryColor(score: number, colors: ThemeColors): string {
  if (score >= 75) return colors.positive;
  if (score >= 50) return colors.warning;
  return colors.critical;
}

function fatigueColor(score: number, colors: ThemeColors): string {
  if (score > 70) return colors.critical;
  if (score > 45) return colors.warning;
  return colors.positive;
}

function MetricColumn({
  value,
  label,
  color,
  s,
}: {
  value: string | number;
  label: string;
  color?: string;
  s: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={s.column}>
      <Text style={[s.metricValue, color ? { color } : null]}>{value}</Text>
      <Text style={s.metricLabel}>{label}</Text>
    </View>
  );
}

export default function ReadinessCard({
  recoveryScore,
  fatigueScore,
  trainingPhase,
  soreness,
  motivation,
}: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const phase  = phaseBadge(colors)[trainingPhase];

  return (
    <Card>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Readiness</Text>
        <Badge label={phase.label} bg={phase.bg} color={phase.text} />
      </View>

      <View style={styles.metricsRow}>
        <MetricColumn
          value={recoveryScore}
          label="RECOVERY"
          color={recoveryColor(recoveryScore, colors)}
          s={styles}
        />
        <View style={styles.divider} />
        <MetricColumn
          value={fatigueScore}
          label="FATIGUE"
          color={fatigueColor(fatigueScore, colors)}
          s={styles}
        />
        <View style={styles.divider} />
        <MetricColumn
          value={`${motivation}/10`}
          label="MOTIVATION"
          s={styles}
        />
      </View>

      <View style={styles.subRow}>
        <Text style={styles.subLabel}>Soreness</Text>
        <Text style={styles.subValue}>{soreness}/10</Text>
      </View>
    </Card>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  headerRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    marginBottom:   spacing.xl,
  },
  title: {
    color:      colors.textMuted,
    fontSize:   FontSize.base,
    fontWeight: FontWeight.medium,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems:    'center',
    marginBottom:  spacing.lg,
  },
  column: {
    flex:       1,
    alignItems: 'center',
    gap:        4,
  },
  metricValue: {
    color:      colors.text,
    fontSize:   28,
    fontWeight: FontWeight.black,
  },
  metricLabel: {
    color:         colors.textDim,
    fontSize:      10,
    fontWeight:    FontWeight.medium,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  divider: {
    width:           1,
    height:          44,
    backgroundColor: colors.border,
    marginHorizontal: spacing.sm,
  },
  subRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    paddingTop:     spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  subLabel: {
    color:    colors.textDim,
    fontSize: FontSize.sm,
  },
  subValue: {
    color:    colors.textMuted,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
});
