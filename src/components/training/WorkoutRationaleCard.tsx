import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Card from '../ui/Card';
import { useThemeColors, type ThemeColors } from '../../theme/ThemeContext';
import { spacing } from '../../theme/spacing';
import { FontSize, FontWeight } from '../../theme/tokens';
import type { RichWorkout } from '../../types/workout';

type Props = { workout: RichWorkout };

export default function WorkoutRationaleCard({ workout }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [showScience, setShowScience] = useState(false);

  const { rationale, instructions, executionCues, failureConditions, modifications } = workout;

  return (
    <Card>
      {/* Primary adaptation */}
      <View style={styles.adaptationRow}>
        <Text style={styles.sectionLabel}>Primary Adaptation</Text>
        <Text style={styles.adaptation}>{rationale.adaptation}</Text>
      </View>

      <View style={styles.divider} />

      {/* Execution steps */}
      <Text style={styles.sectionLabel}>Execution</Text>
      {instructions.map((step, i) => (
        <View key={i} style={styles.stepRow}>
          <Text style={styles.stepNum}>{i + 1}</Text>
          <Text style={styles.stepText}>{step}</Text>
        </View>
      ))}

      {/* Real-time cues */}
      {executionCues.length > 0 && (
        <>
          <View style={styles.divider} />
          <Text style={styles.sectionLabel}>Real-Time Cues</Text>
          {executionCues.map((cue, i) => (
            <View key={i} style={styles.cueRow}>
              <Text style={styles.cueDot}>›</Text>
              <Text style={styles.cueText}>{cue}</Text>
            </View>
          ))}
        </>
      )}

      {/* Failure conditions */}
      {failureConditions.length > 0 && (
        <>
          <View style={styles.divider} />
          <Text style={styles.sectionLabel}>Stop If</Text>
          {failureConditions.map((cond, i) => (
            <View key={i} style={styles.failRow}>
              <Text style={styles.failIcon}>!</Text>
              <Text style={styles.failText}>{cond}</Text>
            </View>
          ))}
        </>
      )}

      {/* Modifications */}
      {modifications.length > 0 && (
        <>
          <View style={styles.divider} />
          <Text style={styles.sectionLabel}>Modifications</Text>
          {modifications.map((mod, i) => (
            <View key={i} style={styles.modBlock}>
              <Text style={styles.modCondition}>{mod.condition}</Text>
              <Text style={styles.modAction}>→ {mod.action}</Text>
            </View>
          ))}
        </>
      )}

      {/* Science basis (collapsed by default) */}
      <View style={styles.divider} />
      <Pressable onPress={() => setShowScience(p => !p)} style={styles.scienceToggle}>
        <Text style={styles.scienceToggleText}>
          {showScience ? 'Hide' : 'Show'} science & research basis
        </Text>
      </Pressable>

      {showScience && (
        <View style={styles.scienceBlock}>
          <Text style={styles.scienceMechanism}>{rationale.mechanism}</Text>
          <View style={styles.scienceRow}>
            <Text style={styles.scienceMeta}>Timeframe: {rationale.timeframe}</Text>
          </View>
          <Text style={styles.scienceCitations}>{rationale.scienceBasis}</Text>
        </View>
      )}
    </Card>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  adaptationRow: {
    marginBottom: spacing.lg,
  },
  sectionLabel: {
    color:         colors.textDim,
    fontSize:      11,
    fontWeight:    FontWeight.medium,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom:  spacing.sm,
  },
  adaptation: {
    color:      colors.text,
    fontSize:   FontSize.md,
    fontWeight: FontWeight.bold,
    lineHeight: 22,
  },
  divider: {
    height:          1,
    backgroundColor: colors.border,
    marginTop:       spacing.lg,
    marginBottom:    spacing.lg,
  },
  stepRow: {
    flexDirection: 'row',
    gap:           spacing.md,
    marginBottom:  spacing.sm,
  },
  stepNum: {
    color:      colors.primary,
    fontSize:   FontSize.sm,
    fontWeight: FontWeight.bold,
    width:      18,
  },
  stepText: {
    flex:       1,
    color:      colors.textMuted,
    fontSize:   FontSize.base,
    lineHeight: 20,
  },
  cueRow: {
    flexDirection: 'row',
    gap:           spacing.sm,
    marginBottom:  spacing.xs,
  },
  cueDot: {
    color:      colors.positive,
    fontSize:   FontSize.base,
    fontWeight: FontWeight.bold,
    width:      14,
  },
  cueText: {
    flex:       1,
    color:      colors.textMuted,
    fontSize:   FontSize.base,
    lineHeight: 20,
  },
  failRow: {
    flexDirection:   'row',
    gap:             spacing.sm,
    marginBottom:    spacing.xs,
    backgroundColor: colors.criticalDim,
    borderRadius:    6,
    padding:         spacing.sm,
  },
  failIcon: {
    color:      colors.critical,
    fontSize:   FontSize.sm,
    fontWeight: FontWeight.bold,
    width:      14,
    textAlign:  'center',
  },
  failText: {
    flex:       1,
    color:      colors.critical,
    fontSize:   FontSize.sm,
    lineHeight: 18,
  },
  modBlock: {
    marginBottom:    spacing.md,
    backgroundColor: colors.border,
    borderRadius:    8,
    padding:         spacing.md,
  },
  modCondition: {
    color:        colors.textMuted,
    fontSize:     FontSize.sm,
    marginBottom: 4,
    fontStyle:    'italic',
  },
  modAction: {
    color:      colors.text,
    fontSize:   FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  scienceToggle: {
    alignSelf: 'flex-start',
  },
  scienceToggleText: {
    color:    colors.primary,
    fontSize: FontSize.sm,
  },
  scienceBlock: {
    marginTop:       spacing.md,
    backgroundColor: colors.border,
    borderRadius:    8,
    padding:         spacing.md,
  },
  scienceMechanism: {
    color:        colors.textMuted,
    fontSize:     FontSize.sm,
    lineHeight:   18,
    marginBottom: spacing.sm,
  },
  scienceRow: {
    marginBottom: spacing.xs,
  },
  scienceMeta: {
    color:     colors.textDim,
    fontSize:  FontSize.sm,
    fontStyle: 'italic',
  },
  scienceCitations: {
    color:     colors.textDim,
    fontSize:  11,
    lineHeight: 16,
    marginTop: spacing.xs,
  },
  });
}
