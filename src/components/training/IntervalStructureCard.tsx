import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Card from '../ui/Card';
import { useThemeColors, type ThemeColors } from '../../theme/ThemeContext';
import { spacing } from '../../theme/spacing';
import { FontSize, FontWeight } from '../../theme/tokens';
import type { IntervalBlock } from '../../types/workout';

type Props = { intervals: IntervalBlock };

const REST_LABEL: Record<IntervalBlock['restType'], string> = {
  walk:           'Walk recovery',
  jog:            'Easy jog recovery',
  complete_rest:  'Full rest',
};

export default function IntervalStructureCard({ intervals }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const {
    setCount, repsPerSet, workLabel, restLabel, workPaceGuide,
    workHRZone, workRPE, restType, totalWorkMin, progressionNote,
  } = intervals;

  const setLabel = repsPerSet
    ? `${setCount} sets × ${repsPerSet} reps`
    : `${setCount} ×`;

  return (
    <Card>
      <Text style={styles.heading}>Interval Structure</Text>

      {/* Main interval spec */}
      <View style={styles.specRow}>
        <View style={styles.specBlock}>
          <Text style={styles.specLabel}>SETS</Text>
          <Text style={styles.specValue}>{setLabel}</Text>
        </View>
        <View style={styles.specBlock}>
          <Text style={styles.specLabel}>WORK</Text>
          <Text style={styles.specValue}>{workLabel}</Text>
        </View>
        <View style={styles.specBlock}>
          <Text style={styles.specLabel}>REST</Text>
          <Text style={styles.specValue}>{restLabel}</Text>
        </View>
      </View>

      <View style={styles.divider} />

      {/* Pace + intensity */}
      <View style={styles.intensityRow}>
        <View style={styles.intensityCell}>
          <Text style={styles.intensityLabel}>Target Pace</Text>
          <Text style={styles.intensityValue}>{workPaceGuide}</Text>
        </View>
        <View style={styles.intensityCell}>
          <Text style={styles.intensityLabel}>HR Zone</Text>
          <Text style={styles.intensityValue}>{workHRZone}</Text>
        </View>
        <View style={styles.intensityCell}>
          <Text style={styles.intensityLabel}>RPE</Text>
          <Text style={styles.intensityValue}>{workRPE[0]}–{workRPE[1]}</Text>
        </View>
      </View>

      <View style={styles.divider} />

      {/* Rest type + total work */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryCell}>
          <Text style={styles.summaryLabel}>Recovery</Text>
          <Text style={styles.summaryText}>{REST_LABEL[restType]}</Text>
        </View>
        <View style={styles.summaryCell}>
          <Text style={styles.summaryLabel}>Total Work</Text>
          <Text style={styles.summaryText}>{totalWorkMin} min</Text>
        </View>
      </View>

      {progressionNote && (
        <View style={styles.progressionRow}>
          <Text style={styles.progressionText}>{progressionNote}</Text>
        </View>
      )}
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
  specRow: {
    flexDirection: 'row',
    gap:           spacing.md,
    marginBottom:  spacing.lg,
  },
  specBlock: {
    flex:            1,
    backgroundColor: colors.border,
    borderRadius:    8,
    padding:         spacing.md,
    alignItems:      'center',
  },
  specLabel: {
    color:         colors.textDim,
    fontSize:      10,
    fontWeight:    FontWeight.medium,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom:  4,
  },
  specValue: {
    color:      colors.text,
    fontSize:   FontSize.base,
    fontWeight: FontWeight.bold,
    textAlign:  'center',
  },
  divider: {
    height:          1,
    backgroundColor: colors.border,
    marginBottom:    spacing.lg,
  },
  intensityRow: {
    flexDirection: 'row',
    gap:           spacing.xl,
    marginBottom:  spacing.lg,
  },
  intensityCell: {
    flex: 1,
  },
  intensityLabel: {
    color:         colors.textDim,
    fontSize:      11,
    fontWeight:    FontWeight.medium,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom:  4,
  },
  intensityValue: {
    color:      colors.text,
    fontSize:   FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  summaryRow: {
    flexDirection: 'row',
    gap:           spacing.xl,
  },
  summaryCell: {
    flex: 1,
  },
  summaryLabel: {
    color:         colors.textDim,
    fontSize:      11,
    fontWeight:    FontWeight.medium,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom:  4,
  },
  summaryText: {
    color:      colors.textMuted,
    fontSize:   FontSize.base,
    fontWeight: FontWeight.medium,
  },
  progressionRow: {
    marginTop:       spacing.lg,
    paddingTop:      spacing.md,
    borderTopWidth:  1,
    borderTopColor:  colors.border,
  },
  progressionText: {
    color:    colors.primary,
    fontSize: FontSize.sm,
  },
  });
}
