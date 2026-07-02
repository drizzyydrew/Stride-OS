import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Card from '../ui/Card';
import { useThemeColors, zoneTint, type ThemeColors } from '../../theme/ThemeContext';
import { spacing } from '../../theme/spacing';
import { FontSize, FontWeight } from '../../theme/tokens';
import type { StrengthWeek } from '../../types/strength';

type Props = {
  strengthWeek:      StrengthWeek;
  completedSessions: string[];
  currentWeek:       number;
};

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

// Goals without a dedicated semantic meaning (success/warning/CTA/neutral)
// are categorical dots along the Sage tint ramp rather than invented hues
// (§3.1, §3.9) — the ramp order below is arbitrary but stable, matching
// StrengthSessionCard's goal mapping.
const CATEGORICAL_GOAL_ORDER = ['force_production', 'hypertrophy', 'tendon_capacity', 'injury_resilience', 'power'];

function goalColorFor(goal: string, colors: ThemeColors): string {
  switch (goal) {
    case 'running_economy': return colors.positive;
    case 'maintenance':     return colors.textMuted;
    case 'deload':          return colors.warning;
    case 'taper_support':   return colors.primary;
    default: {
      const idx = CATEGORICAL_GOAL_ORDER.indexOf(goal);
      return zoneTint(colors, idx === -1 ? 0 : idx, CATEGORICAL_GOAL_ORDER.length);
    }
  }
}

export default function StrengthWeekCard({ strengthWeek, completedSessions, currentWeek }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const goalColor    = goalColorFor(strengthWeek.primaryGoal, colors);
  const completedSet = new Set(completedSessions);

  return (
    <Card style={{ ...styles.card, borderLeftColor: goalColor }}>
      <View style={styles.header}>
        <Text style={styles.title}>This Week</Text>
        <Text style={[styles.goal, { color: goalColor }]}>
          {strengthWeek.primaryGoal.replace(/_/g, ' ')}
        </Text>
      </View>

      {/* 7-day strip */}
      <View style={styles.dayStrip}>
        {DAY_LABELS.map((label, i) => {
          const sessionIndex = strengthWeek.sessionDays.indexOf(i);
          const hasSession   = sessionIndex !== -1;
          const session      = hasSession ? strengthWeek.sessions[sessionIndex] : null;
          const key          = session ? `sw${currentWeek}_${session.id}_${sessionIndex}` : null;
          const isDone       = key ? completedSet.has(key) : false;

          return (
            <View key={i} style={styles.dayCol}>
              <Text style={styles.dayLabel}>{label}</Text>
              <View style={[
                styles.dayDot,
                hasSession && { backgroundColor: isDone ? goalColor : colors.border, borderColor: goalColor, borderWidth: 1.5 },
                !hasSession && styles.restDot,
              ]}>
                {isDone && <View style={styles.checkDot} />}
              </View>
            </View>
          );
        })}
      </View>

      <View style={styles.stats}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{strengthWeek.sessions.length}</Text>
          <Text style={styles.statLabel}>Sessions</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statValue}>{strengthWeek.weeklyVolumeSets}</Text>
          <Text style={styles.statLabel}>Total Sets</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statValue}>
            {completedSessions.filter(k => k.startsWith(`sw${currentWeek}_`)).length}/{strengthWeek.sessions.length}
          </Text>
          <Text style={styles.statLabel}>Done</Text>
        </View>
      </View>

      <Text style={styles.phaseNote}>{strengthWeek.phaseNote}</Text>
    </Card>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  card:         { marginBottom: spacing.cardGap, borderLeftWidth: 3 },
  header:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  title:        { color: colors.text, fontSize: FontSize.md, fontWeight: FontWeight.bold },
  goal:         { fontSize: FontSize.sm, fontWeight: FontWeight.medium, textTransform: 'capitalize' },
  dayStrip:     { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.md },
  dayCol:       { alignItems: 'center', gap: 6 },
  dayLabel:     { color: colors.textDim, fontSize: FontSize.xs },
  dayDot:       { width: 24, height: 24, borderRadius: 12, backgroundColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  restDot:      { backgroundColor: colors.bg },
  checkDot:     { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.bg },
  stats:        { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  stat:         { flex: 1, alignItems: 'center' },
  statValue:    { color: colors.text, fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  statLabel:    { color: colors.textDim, fontSize: FontSize.xs },
  statDivider:  { width: 1, height: 28, backgroundColor: colors.border },
  phaseNote:    { color: colors.textMuted, fontSize: FontSize.xs, fontStyle: 'italic', marginTop: spacing.xs },
  });
}
