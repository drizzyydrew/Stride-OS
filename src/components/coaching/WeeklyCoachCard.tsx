import { StyleSheet, Text, View } from 'react-native';

import Card from '../ui/Card';
import CoachInsightCard from './CoachInsightCard';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { FontSize, FontWeight, Radius } from '../../theme/tokens';
import type { WeeklyCoachSummary, WeekGrade } from '../../types/coaching';

type Props = {
  summary: WeeklyCoachSummary;
};

// ─── Grade styling ────────────────────────────────────────────────────────────

const GRADE_COLOR: Record<WeekGrade, string> = {
  A: '#4ADE80',   // green
  B: '#60A5FA',   // blue
  C: '#F59E0B',   // amber
  D: '#F87171',   // red-light
  F: '#DC2626',   // red
};

const GRADE_BG: Record<WeekGrade, string> = {
  A: '#052E16',
  B: '#0C1A3D',
  C: '#451A03',
  D: '#450A0A',
  F: '#450A0A',
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function WeeklyCoachCard({ summary }: Props) {
  const gradeColor = GRADE_COLOR[summary.grade];
  const gradeBg    = GRADE_BG[summary.grade];

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
          <View style={[styles.gradeBadge, { backgroundColor: gradeBg }]}>
            <Text style={[styles.gradeText, { color: gradeColor }]}>{summary.grade}</Text>
          </View>
        </View>

        {/* Observations */}
        <View style={styles.obsSection}>
          <Text style={styles.sectionLabel}>THIS WEEK</Text>
          {summary.observations.map((obs, i) => (
            <View key={i} style={styles.obsRow}>
              <View style={[styles.dot, { backgroundColor: gradeColor }]} />
              <Text style={styles.obsText}>{obs}</Text>
            </View>
          ))}
        </View>

        {/* Next week focus */}
        <View style={[styles.focusBanner, { borderColor: gradeColor + '33' }]}>
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

const styles = StyleSheet.create({
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
