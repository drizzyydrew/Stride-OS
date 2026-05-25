import { StyleSheet, Text, View } from 'react-native';
import Card from '../ui/Card';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { FontSize, FontWeight } from '../../theme/tokens';
import type { StrengthWeek } from '../../types/strength';

type Props = {
  strengthWeek:      StrengthWeek;
  completedSessions: string[];
  currentWeek:       number;
};

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

const GOAL_COLORS: Record<string, string> = {
  force_production:  '#C084FC',
  hypertrophy:       '#60A5FA',
  tendon_capacity:   '#FB923C',
  running_economy:   colors.positive,
  injury_resilience: '#34D399',
  power:             '#F472B6',
  maintenance:       colors.textMuted,
  deload:            colors.warning,
  taper_support:     colors.primary,
};

export default function StrengthWeekCard({ strengthWeek, completedSessions, currentWeek }: Props) {
  const goalColor    = GOAL_COLORS[strengthWeek.primaryGoal] ?? colors.primary;
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

const styles = StyleSheet.create({
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
