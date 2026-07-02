import { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Card from '../ui/Card';
import { useThemeColors, zoneTint, type ThemeColors } from '../../theme/ThemeContext';
import { spacing } from '../../theme/spacing';
import { FontSize, FontWeight } from '../../theme/tokens';
import type { StrengthSession } from '../../types/strength';

type Props = {
  session:    StrengthSession;
  isComplete: boolean;
  onPress:    () => void;
};

const SESSION_TYPE_LABELS: Record<string, string> = {
  full_body:        'Full Body',
  lower_power:      'Lower Power',
  running_economy:  'Running Economy',
  prehab:           'Prehab',
  activation:       'Activation',
};

// Goals without a dedicated semantic meaning (success/warning/CTA/neutral)
// are categorical dots along the Sage tint ramp rather than invented hues
// (§3.1, §3.9) — the ramp order below is arbitrary but stable.
const CATEGORICAL_GOAL_ORDER = ['force_production', 'hypertrophy', 'tendon_capacity', 'injury_resilience', 'power'];

function goalConfig(goal: string, colors: ThemeColors): { color: string; bg: string } {
  switch (goal) {
    case 'running_economy':   return { color: colors.positive,  bg: colors.positiveDim };
    case 'maintenance':       return { color: colors.textMuted, bg: colors.border };
    case 'deload':            return { color: colors.warning,   bg: colors.warningDim };
    case 'taper_support':     return { color: colors.primary,   bg: colors.primaryDim };
    default: {
      const idx = CATEGORICAL_GOAL_ORDER.indexOf(goal);
      return { color: colors.text, bg: zoneTint(colors, idx === -1 ? 0 : idx, CATEGORICAL_GOAL_ORDER.length) };
    }
  }
}

export default function StrengthSessionCard({ session, isComplete, onPress }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const goal       = goalConfig(session.goal, colors);
  const typeLabel  = SESSION_TYPE_LABELS[session.sessionType] ?? session.sessionType;
  const setCount   = session.exercises.reduce((s, e) => s + e.sets, 0);

  return (
    <TouchableOpacity activeOpacity={0.88} onPress={onPress}>
      <Card style={{ ...styles.card, ...(isComplete ? styles.completeCard : {}) }}>
        {isComplete && (
          <View style={styles.completeBanner}>
            <Text style={styles.completeBannerText}>Completed</Text>
          </View>
        )}

        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={[styles.typeBadge, { backgroundColor: goal.bg }]}>
              <Text style={[styles.typeBadgeText, { color: goal.color }]}>{typeLabel}</Text>
            </View>
            <Text style={styles.duration}>{session.targetDuration} min</Text>
          </View>
          <Text style={styles.setCount}>{setCount} sets</Text>
        </View>

        <Text style={styles.title}>{session.title}</Text>
        <Text style={styles.purpose}>{session.purpose}</Text>

        <View style={styles.patterns}>
          {session.primaryPatterns.slice(0, 4).map(p => (
            <View key={p} style={styles.patternChip}>
              <Text style={styles.patternText}>{p.replace('_', ' ')}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.exerciseCount}>
          {session.exercises.length} exercises · {session.warmupProtocol ? 'Warm-up included' : 'No warm-up'}
        </Text>
      </Card>
    </TouchableOpacity>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  card:             { marginBottom: spacing.cardGap, position: 'relative', overflow: 'hidden' },
  completeCard:     { opacity: 0.65 },
  completeBanner:   { position: 'absolute', top: 0, right: 0, backgroundColor: colors.positiveDim, paddingHorizontal: spacing.sm, paddingVertical: 2, borderBottomLeftRadius: 6 },
  completeBannerText: { color: colors.positive, fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  header:           { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  headerLeft:       { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  typeBadge:        { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: 6 },
  typeBadgeText:    { fontSize: FontSize.xs, fontWeight: FontWeight.bold, textTransform: 'uppercase', letterSpacing: 0.5 },
  duration:         { color: colors.textDim, fontSize: FontSize.sm },
  setCount:         { color: colors.textMuted, fontSize: FontSize.sm },
  title:            { color: colors.text, fontSize: FontSize.md, fontWeight: FontWeight.bold, marginBottom: 4 },
  purpose:          { color: colors.textMuted, fontSize: FontSize.sm, lineHeight: 18, marginBottom: spacing.sm },
  patterns:         { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.sm },
  patternChip:      { backgroundColor: colors.border, borderRadius: 4, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  patternText:      { color: colors.textDim, fontSize: FontSize.xs, textTransform: 'capitalize' },
  exerciseCount:    { color: colors.textDim, fontSize: FontSize.xs },
  });
}
