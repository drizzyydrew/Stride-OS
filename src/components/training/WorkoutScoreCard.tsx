import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Card from '../ui/Card';
import ProgressBar from '../ui/ProgressBar';
import { useThemeColors, type ThemeColors } from '../../theme/ThemeContext';
import { spacing } from '../../theme/spacing';
import { FontSize, FontWeight } from '../../theme/tokens';
import type { WorkoutScore } from '../../types/workout';

type Props = { score: WorkoutScore };

type ScoreRow = {
  label:       string;
  value:       number;
  barColor:    string;
  description: string;
};

const RECOVERY_LABEL: Record<number, string> = {
  24: '24 h',
  36: '36 h',
  48: '48 h',
  72: '72 h',
};

export default function WorkoutScoreCard({ score }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const rows: ScoreRow[] = [
    {
      label:       'Training Load',
      value:       score.intendedLoad,
      barColor:    colors.primary,
      description: 'TSS-analog stress units',
    },
    {
      label:       'Fatigue Cost',
      value:       score.estimatedFatigueCost,
      barColor:    colors.critical,
      description: 'Expected fatigue impact',
    },
    {
      label:       'Adaptation Signal',
      value:       score.expectedAdaptation,
      barColor:    colors.positive,
      description: 'Positive adaptation strength',
    },
    {
      label:       'Execution Difficulty',
      value:       score.executionDifficulty,
      barColor:    colors.warning,
      description: 'How hard to execute correctly',
    },
  ];

  const recoveryLabel = RECOVERY_LABEL[score.recoveryDemandHours] ?? `${score.recoveryDemandHours} h`;

  return (
    <Card>
      <Text style={styles.heading}>Session Scores</Text>

      {rows.map(row => (
        <View key={row.label} style={styles.row}>
          <View style={styles.rowHeader}>
            <Text style={styles.rowLabel}>{row.label}</Text>
            <Text style={styles.rowValue}>{row.value}</Text>
          </View>
          <ProgressBar
            progress={row.value / 100}
            color={row.barColor}
            height={5}
            style={styles.bar}
          />
          <Text style={styles.rowDesc}>{row.description}</Text>
        </View>
      ))}

      <View style={styles.divider} />

      {/* Recovery demand + confidence */}
      <View style={styles.metaRow}>
        <View style={styles.metaCell}>
          <Text style={styles.metaLabel}>Recovery Demand</Text>
          <Text style={styles.metaValue}>{recoveryLabel}</Text>
        </View>
        <View style={styles.metaCell}>
          <Text style={styles.metaLabel}>Model Confidence</Text>
          <Text style={styles.metaValue}>{score.confidenceScore}%</Text>
        </View>
      </View>
    </Card>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  heading: {
    color:         colors.textDim,
    fontSize:      11,
    fontWeight:    FontWeight.medium,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom:  spacing.lg,
  },
  row: {
    marginBottom: spacing.lg,
  },
  rowHeader: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'baseline',
    marginBottom:   spacing.xs,
  },
  rowLabel: {
    color:      colors.text,
    fontSize:   FontSize.base,
    fontWeight: FontWeight.medium,
  },
  rowValue: {
    color:      colors.text,
    fontSize:   FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  bar: {
    marginBottom: spacing.xs,
  },
  rowDesc: {
    color:    colors.textDim,
    fontSize: 11,
  },
  divider: {
    height:          1,
    backgroundColor: colors.border,
    marginBottom:    spacing.lg,
  },
  metaRow: {
    flexDirection: 'row',
    gap:           spacing.xl,
  },
  metaCell: {
    flex: 1,
  },
  metaLabel: {
    color:         colors.textDim,
    fontSize:      11,
    fontWeight:    FontWeight.medium,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom:  4,
  },
  metaValue: {
    color:      colors.text,
    fontSize:   FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  });
}
