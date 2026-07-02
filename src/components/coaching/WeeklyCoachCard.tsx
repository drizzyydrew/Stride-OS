import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import Card from '../ui/Card';
import CoachInsightCard from './CoachInsightCard';
import { useThemeColors, type ThemeColors } from '../../theme/ThemeContext';
import { spacing } from '../../theme/spacing';
import { FontSize, FontWeight, Radius } from '../../theme/tokens';
import type { WeeklyCoachSummary, WeekGrade } from '../../types/coaching';

type Props = {
  summary: WeeklyCoachSummary;
};

// ─── Grade styling ────────────────────────────────────────────────────────────
// A-F grade is a status signal (great week → bad week), so it maps onto the
// same semantic scale used elsewhere: Positive/Sage/Warning/Critical — never
// a decorative rainbow.

function gradeColor(colors: ThemeColors): Record<WeekGrade, string> {
  return {
    A: colors.positive,
    B: colors.sage,
    C: colors.warning,
    D: colors.critical,
    F: colors.critical,
  };
}

function gradeBg(colors: ThemeColors): Record<WeekGrade, string> {
  return {
    A: colors.positiveDim,
    B: colors.sage + '22',
    C: colors.warningDim,
    D: colors.criticalDim,
    F: colors.criticalDim,
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function WeeklyCoachCard({ summary }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const gradeColorVal = gradeColor(colors)[summary.grade];
  const gradeBgVal    = gradeBg(colors)[summary.grade];

  return (
    <View>
      {/* Summary card */}
      <Card>
        {/* Header */}
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Text style={styles.cardTitle}>WEEKLY SUMMARY</Text>
            <Text style={styles.headline}>{summary.headline}</Text>
          </View>
          <View style={[styles.gradeBadge, { backgroundColor: gradeBgVal }]}>
            <Text style={[styles.gradeText, { color: gradeColorVal }]}>{summary.grade}</Text>
          </View>
        </View>

        {/* Observations */}
        <View style={styles.obsSection}>
          <Text style={styles.sectionLabel}>THIS WEEK</Text>
          {summary.observations.map((obs, i) => (
            <View key={i} style={styles.obsRow}>
              <View style={[styles.dot, { backgroundColor: gradeColorVal }]} />
              <Text style={styles.obsText}>{obs}</Text>
            </View>
          ))}
        </View>

        {/* Next week focus */}
        <View style={[styles.focusBanner, { borderColor: gradeColorVal + '33' }]}>
          <Text style={styles.sectionLabel}>NEXT WEEK PRIORITY</Text>
          <Text style={styles.focusText}>{summary.nextWeekFocus}</Text>
        </View>
      </Card>

      {/* Top insight — expandable coaching explanation */}
      {summary.topInsight && (
        <CoachInsightCard insight={summary.topInsight} />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  headerRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'flex-start',
    marginBottom:   spacing.lg,
    gap:            spacing.md,
  },
  headerLeft: {
    flex: 1,
    gap:  spacing.xs,
  },
  cardTitle: {
    color:         colors.textMuted,
    fontSize:      11,
    fontWeight:    FontWeight.medium,
    letterSpacing: 0.6,
  },
  headline: {
    color:      colors.text,
    fontSize:   FontSize.base,
    fontWeight: FontWeight.bold,
    lineHeight: 20,
  },
  gradeBadge: {
    width:         44,
    height:        44,
    borderRadius:  Radius.sm,
    alignItems:    'center',
    justifyContent:'center',
    flexShrink:    0,
  },
  gradeText: {
    fontSize:   28,
    fontWeight: FontWeight.black,
    lineHeight: 34,
  },

  // Observations
  obsSection: {
    marginBottom: spacing.lg,
  },
  sectionLabel: {
    color:         colors.textMuted,
    fontSize:      10,
    fontWeight:    FontWeight.black,
    letterSpacing: 0.7,
    marginBottom:  spacing.sm,
  },
  obsRow: {
    flexDirection: 'row',
    alignItems:    'flex-start',
    gap:           spacing.sm,
    marginBottom:  spacing.xs,
  },
  dot: {
    width:        5,
    height:       5,
    borderRadius: 3,
    marginTop:    7,
    flexShrink:   0,
  },
  obsText: {
    flex:       1,
    color:      colors.textDim,
    fontSize:   FontSize.sm,
    lineHeight: 19,
  },

  // Next week focus
  focusBanner: {
    borderWidth:  1,
    borderRadius: Radius.sm,
    padding:      spacing.md,
  },
  focusText: {
    color:      colors.text,
    fontSize:   FontSize.sm,
    lineHeight: 19,
    fontWeight: FontWeight.medium,
  },
  });
}
