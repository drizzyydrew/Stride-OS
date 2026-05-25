import { StyleSheet, Text, View } from 'react-native';
import Card from '../ui/Card';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { FontSize, FontWeight } from '../../theme/tokens';

type Props = {
  fatigue:       number;
  recovery:      number;
  soreness:      number | null;
  acwr:          number;
  weeksToRace:   number;
};

type ReadinessLevel = 'optimal' | 'good' | 'moderate' | 'low' | 'rest';

function getReadiness(fatigue: number, recovery: number, soreness: number | null, acwr: number): ReadinessLevel {
  if (fatigue > 82 || acwr > 1.4) return 'rest';
  if (soreness !== null && soreness >= 8) return 'low';
  if (fatigue > 70 || recovery < 38) return 'moderate';
  if (fatigue > 55 || recovery < 55) return 'good';
  return 'optimal';
}

const READINESS_CONFIG: Record<ReadinessLevel, { label: string; color: string; bg: string; advice: string }> = {
  optimal:  { label: 'Optimal',  color: colors.positive,  bg: colors.positiveDim, advice: 'Full sessions at planned intensity.' },
  good:     { label: 'Good',     color: '#60A5FA',         bg: '#0C2340',           advice: 'Full sessions. Monitor fatigue mid-session.' },
  moderate: { label: 'Moderate', color: colors.warning,    bg: colors.warningDim,   advice: 'Reduce load 10–15%. Focus on movement quality.' },
  low:      { label: 'Low',      color: '#FB923C',         bg: '#431407',           advice: 'Prehab or mobility only. Avoid heavy loading.' },
  rest:     { label: 'Rest',     color: colors.critical,   bg: colors.criticalDim,  advice: 'Skip strength today. Prioritize recovery.' },
};

function BarRow({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = Math.min(1, Math.max(0, value / max));
  return (
    <View style={styles.barRow}>
      <Text style={styles.barLabel}>{label}</Text>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${pct * 100}%` as `${number}%`, backgroundColor: color }]} />
      </View>
      <Text style={[styles.barValue, { color }]}>{Math.round(value)}</Text>
    </View>
  );
}

export default function StrengthReadinessCard({ fatigue, recovery, soreness, acwr, weeksToRace }: Props) {
  const level  = getReadiness(fatigue, recovery, soreness, acwr);
  const config = READINESS_CONFIG[level];

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>Strength Readiness</Text>
        <View style={[styles.badge, { backgroundColor: config.bg }]}>
          <Text style={[styles.badgeText, { color: config.color }]}>{config.label}</Text>
        </View>
      </View>

      <Text style={styles.advice}>{config.advice}</Text>

      <View style={styles.bars}>
        <BarRow label="Fatigue"  value={100 - fatigue}  max={100} color={fatigue > 70 ? colors.critical : colors.positive} />
        <BarRow label="Recovery" value={recovery}        max={100} color={recovery < 40 ? colors.critical : colors.positive} />
        {soreness !== null && (
          <BarRow label="Soreness" value={10 - soreness} max={10}  color={soreness >= 7 ? colors.warning : colors.positive} />
        )}
      </View>

      {weeksToRace <= 2 && weeksToRace > 0 && (
        <Text style={styles.taper}>Race in {weeksToRace}w — reduce load, prioritize activation.</Text>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card:      { marginBottom: spacing.cardGap },
  header:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  title:     { color: colors.text, fontSize: FontSize.md, fontWeight: FontWeight.bold },
  badge:     { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: 6 },
  badgeText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, textTransform: 'uppercase', letterSpacing: 0.5 },
  advice:    { color: colors.textMuted, fontSize: FontSize.sm, marginBottom: spacing.md, lineHeight: 18 },
  bars:      { gap: spacing.sm },
  barRow:    { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  barLabel:  { color: colors.textDim, fontSize: FontSize.xs, width: 60 },
  barTrack:  { flex: 1, height: 4, backgroundColor: colors.border, borderRadius: 2, overflow: 'hidden' },
  barFill:   { height: '100%', borderRadius: 2 },
  barValue:  { fontSize: FontSize.xs, fontWeight: FontWeight.medium, width: 28, textAlign: 'right' },
  taper:     { color: colors.warning, fontSize: FontSize.xs, marginTop: spacing.sm, fontStyle: 'italic' },
});
