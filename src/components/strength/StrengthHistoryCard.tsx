import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Card from '../ui/Card';
import { useThemeColors, type ThemeColors } from '../../theme/ThemeContext';
import { spacing } from '../../theme/spacing';
import { FontSize, FontWeight } from '../../theme/tokens';
import type { StrengthLogRecord } from '../../types/strength';

type Props = {
  history: StrengthLogRecord[];
  limit?:  number;
};

const TYPE_LABELS: Record<string, string> = {
  full_body:       'Full Body',
  lower_power:     'Lower Power',
  running_economy: 'Running Economy',
  prehab:          'Prehab',
  activation:      'Activation',
};

function formatRelativeDate(ts: number): string {
  const diffMs   = Date.now() - ts;
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7)  return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return `${Math.floor(diffDays / 30)}mo ago`;
}

export default function StrengthHistoryCard({ history, limit = 5 }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const recent = [...history]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, limit);

  if (recent.length === 0) {
    return (
      <Card style={styles.card}>
        <Text style={styles.title}>Strength History</Text>
        <Text style={styles.empty}>No strength sessions logged yet.</Text>
      </Card>
    );
  }

  return (
    <Card style={styles.card}>
      <Text style={styles.title}>Recent Sessions</Text>

      <View style={styles.list}>
        {recent.map((record, i) => {
          const completedSets = record.exercises.reduce(
            (s, e) => s + e.sets.filter(set => set.completed).length, 0,
          );
          const isSkipped = record.skipped === true;

          return (
            <View key={record.id} style={[styles.row, i < recent.length - 1 && styles.rowBorder]}>
              <View style={styles.rowLeft}>
                <Text style={styles.rowDate}>{formatRelativeDate(record.timestamp)}</Text>
                <Text style={[styles.rowType, isSkipped && styles.skipped]}>
                  {TYPE_LABELS[record.sessionType] ?? record.sessionType}
                  {isSkipped ? ' · Skipped' : ''}
                </Text>
              </View>

              {!isSkipped && (
                <View style={styles.rowRight}>
                  <Text style={styles.rowSets}>{completedSets} sets</Text>
                  {record.actualDuration !== undefined && (
                    <Text style={styles.rowDuration}>{record.actualDuration} min</Text>
                  )}
                  {record.overallRpe !== undefined && (
                    <View style={styles.rpeBadge}>
                      <Text style={styles.rpeText}>RPE {record.overallRpe}</Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          );
        })}
      </View>
    </Card>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  card:        { marginBottom: spacing.cardGap },
  title:       { color: colors.text, fontSize: FontSize.md, fontWeight: FontWeight.bold, marginBottom: spacing.md },
  empty:       { color: colors.textMuted, fontSize: FontSize.sm },
  list:        { gap: 0 },
  row:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm },
  rowBorder:   { borderBottomWidth: 1, borderBottomColor: colors.border },
  rowLeft:     { gap: 2 },
  rowDate:     { color: colors.textDim, fontSize: FontSize.xs },
  rowType:     { color: colors.text, fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  skipped:     { color: colors.textMuted, fontStyle: 'italic' },
  rowRight:    { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rowSets:     { color: colors.textMuted, fontSize: FontSize.xs },
  rowDuration: { color: colors.textDim, fontSize: FontSize.xs },
  rpeBadge:    { backgroundColor: colors.primaryDim, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  rpeText:     { color: colors.primary, fontSize: FontSize.xs, fontWeight: FontWeight.medium },
  });
}
