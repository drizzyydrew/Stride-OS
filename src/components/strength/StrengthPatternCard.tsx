import { StyleSheet, Text, View } from 'react-native';
import Card from '../ui/Card';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { FontSize, FontWeight } from '../../theme/tokens';
import type { MovementPattern } from '../../types/strength';

type Props = {
  patternBalance: Partial<Record<MovementPattern, number>>;
  days:           number;
};

const PATTERN_LABELS: Record<MovementPattern, string> = {
  squat:       'Squat',
  hinge:       'Hinge',
  lunge:       'Lunge',
  push:        'Push',
  pull:        'Pull',
  carry:       'Carry',
  trunk:       'Trunk',
  calf_ankle:  'Calf/Ankle',
  plyometric:  'Plyometric',
  mobility:    'Mobility',
};

const PATTERN_COLORS: Record<MovementPattern, string> = {
  squat:       '#818CF8',
  hinge:       '#60A5FA',
  lunge:       '#34D399',
  push:        '#F472B6',
  pull:        '#FB923C',
  carry:       '#A78BFA',
  trunk:       '#4ADE80',
  calf_ankle:  '#FCD34D',
  plyometric:  '#F87171',
  mobility:    '#94A3B8',
};

// Boyle-based targets for runners (% of total sets)
const IDEAL_SPLIT: Partial<Record<MovementPattern, number>> = {
  squat:       0.20,
  hinge:       0.22,
  lunge:       0.18,
  push:        0.08,
  pull:        0.10,
  trunk:       0.12,
  calf_ankle:  0.06,
  plyometric:  0.04,
};

export default function StrengthPatternCard({ patternBalance, days }: Props) {
  const total = Object.values(patternBalance).reduce((s, v) => s + (v ?? 0), 0);
  if (total === 0) {
    return (
      <Card style={styles.card}>
        <Text style={styles.title}>Pattern Balance</Text>
        <Text style={styles.empty}>No strength sessions in the last {days} days.</Text>
      </Card>
    );
  }

  const patterns = Object.entries(patternBalance) as [MovementPattern, number][];
  patterns.sort(([, a], [, b]) => b - a);

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>Pattern Balance</Text>
        <Text style={styles.subtitle}>Last {days}d</Text>
      </View>

      <View style={styles.rows}>
        {patterns.map(([pattern, sets]) => {
          const pct     = sets / total;
          const ideal   = IDEAL_SPLIT[pattern] ?? 0.05;
          const ratio   = ideal > 0 ? pct / ideal : 1;
          const color   = PATTERN_COLORS[pattern];
          const warning = ratio < 0.5 && ideal > 0;

          return (
            <View key={pattern} style={styles.row}>
              <Text style={[styles.patternLabel, warning && styles.warningLabel]}>
                {PATTERN_LABELS[pattern]}
              </Text>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${Math.min(100, pct * 100 / (Math.max(...Object.values(patternBalance).map(v => v ?? 0)) / total))}%` as `${number}%`, backgroundColor: color }]} />
              </View>
              <Text style={styles.setsLabel}>{sets}s</Text>
            </View>
          );
        })}
      </View>

      {/* Check for undertrained patterns */}
      {(() => {
        const undertrained = (Object.entries(IDEAL_SPLIT) as [MovementPattern, number][])
          .filter(([p, ideal]) => {
            const actual = ((patternBalance[p] ?? 0) / total);
            return ideal > 0.08 && actual < ideal * 0.5;
          })
          .map(([p]) => PATTERN_LABELS[p]);

        if (undertrained.length === 0) return null;
        return (
          <Text style={styles.warning}>
            Under-trained: {undertrained.join(', ')}
          </Text>
        );
      })()}
    </Card>
  );
}

const styles = StyleSheet.create({
  card:         { marginBottom: spacing.cardGap },
  header:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  title:        { color: colors.text, fontSize: FontSize.md, fontWeight: FontWeight.bold },
  subtitle:     { color: colors.textDim, fontSize: FontSize.xs },
  empty:        { color: colors.textMuted, fontSize: FontSize.sm, marginTop: spacing.sm },
  rows:         { gap: spacing.sm },
  row:          { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  patternLabel: { color: colors.textMuted, fontSize: FontSize.xs, width: 72 },
  warningLabel: { color: colors.warning },
  barTrack:     { flex: 1, height: 6, backgroundColor: colors.border, borderRadius: 3, overflow: 'hidden' },
  barFill:      { height: '100%', borderRadius: 3 },
  setsLabel:    { color: colors.textDim, fontSize: FontSize.xs, width: 24, textAlign: 'right' },
  warning:      { color: colors.warning, fontSize: FontSize.xs, marginTop: spacing.md, lineHeight: 16 },
});
