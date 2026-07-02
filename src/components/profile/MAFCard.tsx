import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Card from '../ui/Card';
import { formatPace } from '../../utils/calibrationEngine';
import { useThemeColors, type ThemeColors } from '../../theme/ThemeContext';
import { spacing } from '../../theme/spacing';
import { FontSize, FontWeight } from '../../theme/tokens';
import type { MAFTestRecord } from '../../types/athlete';

type Props = {
  tests:     MAFTestRecord[];
  mafHR?:    number;   // current MAF target HR (180 - age)
  onAdd?:    () => void;
};

function formatRelativeDate(dateStr: string): string {
  const ms   = new Date(dateStr).getTime();
  if (isNaN(ms)) return dateStr;
  const days = Math.floor((Date.now() - ms) / (24 * 60 * 60 * 1000));
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30)  return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

// Aerobic base quality from HR drift
function driftQuality(drift: number, colors: ThemeColors): { label: string; color: string } {
  if (drift <= 3)  return { label: 'Excellent', color: colors.positive };
  if (drift <= 7)  return { label: 'Good',      color: colors.primary  };
  if (drift <= 12) return { label: 'Fair',       color: colors.warning  };
  return             { label: 'Poor',       color: colors.critical };
}

export default function MAFCard({ tests, mafHR, onAdd }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const sorted = [...tests].sort((a, b) =>
    new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
  const latest = sorted[0] ?? null;

  // Compute pace trend (negative = improving = faster)
  let trend: number | null = null;
  if (sorted.length >= 2) {
    const first = sorted[sorted.length - 1];
    const last  = sorted[0];
    trend = last.avgPaceSecPerMi - first.avgPaceSecPerMi;  // negative = faster (improving)
  }

  return (
    <Card>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>MAF Aerobic Test</Text>
          {mafHR !== undefined && (
            <Text style={styles.mafHR}>Target: {mafHR} bpm</Text>
          )}
        </View>
        {onAdd && (
          <Text style={styles.addBtn} onPress={onAdd}>+ Log Test</Text>
        )}
      </View>

      <Text style={styles.note}>
        MAF tests track aerobic base development over time. Not used for training prescription.
        Lower HR drift indicates better aerobic efficiency.
      </Text>

      {latest !== null && (
        <View style={styles.latestCard}>
          <View style={styles.latestHeader}>
            <Text style={styles.latestLabel}>Latest Test</Text>
            <Text style={styles.latestDate}>{formatRelativeDate(latest.date)}</Text>
          </View>
          <View style={styles.latestStats}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{formatPace(latest.avgPaceSecPerMi)}</Text>
              <Text style={styles.statLabel}>avg pace/mi</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statValue}>{latest.mafHR}</Text>
              <Text style={styles.statLabel}>MAF HR</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={[styles.statValue, { color: driftQuality(latest.hrDriftBPM, colors).color }]}>
                +{latest.hrDriftBPM} bpm
              </Text>
              <Text style={styles.statLabel}>HR drift</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={[styles.statValue, { color: driftQuality(latest.hrDriftBPM, colors).color }]}>
                {driftQuality(latest.hrDriftBPM, colors).label}
              </Text>
              <Text style={styles.statLabel}>base quality</Text>
            </View>
          </View>
        </View>
      )}

      {trend !== null && (
        <View style={styles.trendRow}>
          <Text style={styles.trendLabel}>Trend across {sorted.length} tests:</Text>
          <Text style={[styles.trendValue, { color: trend < 0 ? colors.positive : colors.warning }]}>
            {trend < 0
              ? `↑ Improving ${Math.abs(trend)}s/mi faster`
              : trend > 0
              ? `↓ Declining ${trend}s/mi slower`
              : '→ Stable'}
          </Text>
        </View>
      )}

      {sorted.length === 0 && (
        <Text style={styles.empty}>No MAF tests logged yet. Log your first test to start tracking aerobic base development.</Text>
      )}

      {sorted.length > 0 && (
        <View style={styles.history}>
          {sorted.slice(0, 4).map((t, i) => (
            <View key={t.id} style={[styles.histRow, i < Math.min(sorted.length, 4) - 1 && styles.histBorder]}>
              <Text style={styles.histDate}>{formatRelativeDate(t.date)}</Text>
              <Text style={styles.histPace}>{formatPace(t.avgPaceSecPerMi)}/mi</Text>
              <Text style={styles.histDrift}>+{t.hrDriftBPM} bpm drift</Text>
            </View>
          ))}
        </View>
      )}

      <Text style={styles.citation}>
        MAF method: Maffetone, P. (2010). The Big Book of Endurance Training and Racing.
      </Text>
    </Card>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  header:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.xs },
  headerLeft:    { gap: 2 },
  title:         { color: colors.text, fontSize: FontSize.md, fontWeight: FontWeight.bold },
  mafHR:         { color: colors.primary, fontSize: FontSize.xs },
  addBtn:        { color: colors.primary, fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  note:          { color: colors.textMuted, fontSize: 9, lineHeight: 14, marginBottom: spacing.md },
  latestCard:    { backgroundColor: colors.bg, borderRadius: 10, padding: spacing.md, marginBottom: spacing.md },
  latestHeader:  { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm },
  latestLabel:   { color: colors.textDim, fontSize: FontSize.xs, fontWeight: FontWeight.medium },
  latestDate:    { color: colors.textDim, fontSize: FontSize.xs },
  latestStats:   { flexDirection: 'row', alignItems: 'center' },
  stat:          { flex: 1, alignItems: 'center', gap: 2 },
  statValue:     { color: colors.text, fontSize: FontSize.sm, fontWeight: FontWeight.black },
  statLabel:     { color: colors.textSubtle, fontSize: 8 },
  statDivider:   { width: 1, height: 28, backgroundColor: colors.border },
  trendRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  trendLabel:    { color: colors.textDim, fontSize: FontSize.xs },
  trendValue:    { fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  empty:         { color: colors.textMuted, fontSize: FontSize.sm, lineHeight: 18, marginBottom: spacing.md },
  history:       { borderTopWidth: 1, borderTopColor: colors.border, marginTop: spacing.sm },
  histRow:       { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm },
  histBorder:    { borderBottomWidth: 1, borderBottomColor: colors.border },
  histDate:      { color: colors.textDim, fontSize: FontSize.xs, width: 72 },
  histPace:      { color: colors.text, fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  histDrift:     { color: colors.textMuted, fontSize: FontSize.xs },
  citation:      { color: colors.textSubtle, fontSize: 8, marginTop: spacing.md, fontStyle: 'italic' },
  });
}
