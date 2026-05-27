// ─── Running Readiness Card ───────────────────────────────────────────────────
//
// Mirrors StrengthReadinessCard design for the Running/Training screen.
// Shows fatigue, recovery, soreness bars + readiness level + today's advice.

import { StyleSheet, Text, View } from 'react-native';
import Card from '../ui/Card';
import { colors }  from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { FontSize, FontWeight } from '../../theme/tokens';

type Props = {
  fatigue:     number;
  recovery:    number;
  soreness:    number | null;
  acwr:        number;
  isRestDay:   boolean;
  weeksToRace: number;
};

type ReadinessLevel = 'optimal' | 'good' | 'moderate' | 'low' | 'rest';

function getReadiness(
  fatigue:  number,
  recovery: number,
  soreness: number | null,
  acwr:     number,
): ReadinessLevel {
  if (fatigue > 85 || acwr > 1.5)                      return 'rest';
  if (soreness !== null && soreness >= 8)               return 'low';
  if (fatigue > 72 || recovery < 35)                   return 'low';
  if (fatigue > 58 || recovery < 52)                   return 'moderate';
  if (fatigue > 42 || recovery < 65)                   return 'good';
  return 'optimal';
}

const READINESS_CONFIG: Record<ReadinessLevel, {
  label:  string;
  color:  string;
  bg:     string;
  advice: string;
}> = {
  optimal:  {
    label:  'Optimal',
    color:  colors.positive,
    bg:     colors.positiveDim,
    advice: 'Body is primed — execute today\'s session at planned intensity.',
  },
  good: {
    label:  'Good',
    color:  '#60A5FA',
    bg:     '#0C2340',
    advice: 'Proceed as planned. Check in mid-run and ease off if needed.',
  },
  moderate: {
    label:  'Moderate',
    color:  colors.warning,
    bg:     colors.warningDim,
    advice: 'Run at the easier end of your target zone. Prioritize feel over pace.',
  },
  low: {
    label:  'Low',
    color:  '#FB923C',
    bg:     '#431407',
    advice: 'Recovery run or rest only. Pushing hard today risks compounding fatigue.',
  },
  rest: {
    label:  'Rest',
    color:  colors.critical,
    bg:     colors.criticalDim,
    advice: 'Take a full rest day. Accumulated fatigue is too high to train effectively.',
  },
};

function BarRow({
  label, value, max, color,
}: { label: string; value: number; max: number; color: string }) {
  const pct = Math.min(1, Math.max(0, value / max));
  return (
    <View style={s.barRow}>
      <Text style={s.barLabel}>{label}</Text>
      <View style={s.barTrack}>
        <View style={[s.barFill, {
          width:           `${pct * 100}%` as `${number}%`,
          backgroundColor: color,
        }]} />
      </View>
      <Text style={[s.barValue, { color }]}>{Math.round(value)}</Text>
    </View>
  );
}

export default function RunningReadinessCard({
  fatigue, recovery, soreness, acwr, isRestDay, weeksToRace,
}: Props) {
  const level  = getReadiness(fatigue, recovery, soreness, acwr);
  const config = READINESS_CONFIG[level];

  return (
    <Card style={s.card}>
      <View style={s.header}>
        <Text style={s.title}>Running Readiness</Text>
        <View style={[s.badge, { backgroundColor: config.bg }]}>
          <Text style={[s.badgeText, { color: config.color }]}>{config.label}</Text>
        </View>
      </View>

      <Text style={s.advice}>{config.advice}</Text>

      <View style={s.bars}>
        <BarRow
          label="Fatigue"
          value={100 - fatigue}
          max={100}
          color={fatigue > 70 ? colors.critical : colors.positive}
        />
        <BarRow
          label="Recovery"
          value={recovery}
          max={100}
          color={recovery < 40 ? colors.critical : colors.positive}
        />
        {soreness !== null && (
          <BarRow
            label="Soreness"
            value={10 - soreness}
            max={10}
            color={soreness >= 7 ? colors.warning : colors.positive}
          />
        )}
        <BarRow
          label="ACWR"
          value={Math.min(acwr, 2) * 50}
          max={100}
          color={acwr > 1.3 ? colors.critical : acwr > 1.1 ? colors.warning : colors.positive}
        />
      </View>

      {isRestDay && (
        <Text style={s.restNote}>Today is a planned rest day — use it for recovery.</Text>
      )}

      {weeksToRace <= 3 && weeksToRace > 0 && (
        <Text style={s.taper}>
          Race in {weeksToRace} week{weeksToRace > 1 ? 's' : ''} — protect freshness.
        </Text>
      )}
    </Card>
  );
}

const s = StyleSheet.create({
  card:      { marginBottom: spacing.cardGap },
  header:    {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    marginBottom:   spacing.sm,
  },
  title:     { color: colors.text, fontSize: FontSize.md, fontWeight: FontWeight.bold },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical:   3,
    borderRadius:      6,
  },
  badgeText: {
    fontSize:      FontSize.xs,
    fontWeight:    FontWeight.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  advice: {
    color:        colors.textMuted,
    fontSize:     FontSize.sm,
    marginBottom: spacing.md,
    lineHeight:   18,
  },
  bars:      { gap: spacing.sm },
  barRow:    { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  barLabel:  { color: colors.textDim, fontSize: FontSize.xs, width: 60 },
  barTrack: {
    flex:            1,
    height:          4,
    backgroundColor: colors.border,
    borderRadius:    2,
    overflow:        'hidden',
  },
  barFill:   { height: '100%', borderRadius: 2 },
  barValue: {
    fontSize:   FontSize.xs,
    fontWeight: FontWeight.medium,
    width:      28,
    textAlign:  'right',
  },
  restNote: {
    color:      '#60A5FA',
    fontSize:   FontSize.xs,
    marginTop:  spacing.sm,
    fontStyle:  'italic',
  },
  taper: {
    color:     colors.warning,
    fontSize:  FontSize.xs,
    marginTop: spacing.sm,
    fontStyle: 'italic',
  },
});
