import { StyleSheet, Text, View } from 'react-native';

import Card from '../ui/Card';
import Badge from '../ui/Badge';
import { colors } from '../../theme/colors';
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

const PHASE_BADGE: Record<TrainingPhase, { bg: string; text: string; label: string }> = {
  base:   { bg: '#0C2340', text: '#60A5FA', label: 'Base'   },
  build:  { bg: '#1E3A8A', text: '#93C5FD', label: 'Build'  },
  peak:   { bg: '#3B0764', text: '#C084FC', label: 'Peak'   },
  deload: { bg: '#451A03', text: '#FCD34D', label: 'Deload' },
  taper:  { bg: '#052E16', text: '#4ADE80', label: 'Taper'  },
};

function recoveryColor(score: number): string {
  if (score >= 75) return colors.positive;
  if (score >= 50) return colors.warning;
  return colors.critical;
}

function fatigueColor(score: number): string {
  if (score > 70) return colors.critical;
  if (score > 45) return colors.warning;
  return colors.positive;
}

function MetricColumn({
  value,
  label,
  color,
}: {
  value: string | number;
  label: string;
  color?: string;
}) {
  return (
    <View style={styles.column}>
      <Text style={[styles.metricValue, color ? { color } : null]}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
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
  const phase = PHASE_BADGE[trainingPhase];

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
          color={recoveryColor(recoveryScore)}
        />
        <View style={styles.divider} />
        <MetricColumn
          value={fatigueScore}
          label="FATIGUE"
          color={fatigueColor(fatigueScore)}
        />
        <View style={styles.divider} />
        <MetricColumn
          value={`${motivation}/10`}
          label="MOTIVATION"
        />
      </View>

      <View style={styles.subRow}>
        <Text style={styles.subLabel}>Soreness</Text>
        <Text style={styles.subValue}>{soreness}/10</Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
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
