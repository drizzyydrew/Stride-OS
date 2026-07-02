import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import Card from '../ui/Card';
import { useThemeColors, type ThemeColors } from '../../theme/ThemeContext';
import { spacing } from '../../theme/spacing';
import { FontSize, FontWeight, Radius } from '../../theme/tokens';
import type { TimelineInterpretation, OverallState, TimelineAnalysis } from '../../types/timeline';

type Props = {
  analysis: TimelineAnalysis;
};

// ─── Visual config ─────────────────────────────────────────────────────────────

function stateColorMap(colors: ThemeColors): Record<OverallState, string> {
  return {
    thriving: colors.positive,
    adapting: colors.primary,
    stressed: colors.warning,
    at_risk:  colors.critical,
  };
}

function stateBgMap(colors: ThemeColors): Record<OverallState, string> {
  return {
    thriving: colors.positiveDim,
    adapting: colors.primaryDim,
    stressed: colors.warningDim,
    at_risk:  colors.criticalDim,
  };
}

const STATE_LABEL: Record<OverallState, string> = {
  thriving: 'THRIVING',
  adapting: 'ADAPTING',
  stressed: 'STRESSED',
  at_risk:  'AT RISK',
};

// ─── Rolling stats row ─────────────────────────────────────────────────────────

interface StatProps {
  label:  string;
  value:  string;
  color?: string;
}

function StatPill({ label, value, color }: StatProps) {
  const colors = useThemeColors();
  const pill   = useMemo(() => createPillStyles(colors), [colors]);

  return (
    <View style={pill.wrap}>
      <Text style={pill.label}>{label}</Text>
      <Text style={[pill.value, color ? { color } : {}]}>{value}</Text>
    </View>
  );
}

function createPillStyles(colors: ThemeColors) {
  return StyleSheet.create({
  wrap: {
    flex:            1,
    backgroundColor: colors.border,
    borderRadius:    Radius.sm,
    paddingVertical: spacing.sm,
    alignItems:      'center',
    gap:             2,
  },
  label: {
    color:         colors.textMuted,
    fontSize:      9,
    fontWeight:    FontWeight.black,
    letterSpacing: 0.5,
  },
  value: {
    color:      colors.text,
    fontSize:   FontSize.base,
    fontWeight: FontWeight.black,
  },
  });
}

// ─── Section block ─────────────────────────────────────────────────────────────

function Section({ label, body, accentColor }: {
  label:       string;
  body:        string;
  accentColor?: string;
}) {
  const colors  = useThemeColors();
  const section = useMemo(() => createSectionStyles(colors), [colors]);

  return (
    <View style={section.wrap}>
      <Text style={[section.label, accentColor ? { color: accentColor } : {}]}>{label}</Text>
      <Text style={section.body}>{body}</Text>
    </View>
  );
}

function createSectionStyles(colors: ThemeColors) {
  return StyleSheet.create({
  wrap: {
    paddingTop:     spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap:            spacing.xs,
  },
  label: {
    color:         colors.textMuted,
    fontSize:      10,
    fontWeight:    FontWeight.black,
    letterSpacing: 0.7,
  },
  body: {
    color:      colors.textDim,
    fontSize:   FontSize.sm,
    lineHeight: 20,
  },
  });
}

// ─── Main card ─────────────────────────────────────────────────────────────────

function slopeLabel(slope: number, unit = 'pts'): string {
  const sign = slope >= 0 ? '+' : '';
  return `${sign}${slope.toFixed(1)} ${unit}/wk`;
}

function dirLabel(direction: 'improving' | 'worsening' | 'stable'): string {
  return direction === 'improving' ? '↑' : direction === 'worsening' ? '↓' : '→';
}

export default function TrendInterpretationCard({ analysis }: Props) {
  const colors  = useThemeColors();
  const styles  = useMemo(() => createStyles(colors), [colors]);
  const section = useMemo(() => createSectionStyles(colors), [colors]);

  if (!analysis.hasEnoughData && analysis.snapshots.length === 0) return null;

  const { interpretation, fatigue, recovery, adherence, snapshots } = analysis;
  const interp = interpretation;
  const stateColor = stateColorMap(colors)[interp.overallState];
  const stateBg    = stateBgMap(colors)[interp.overallState];

  // Latest snapshot for the stats row
  const latest = snapshots[snapshots.length - 1];

  return (
    <Card>
      {/* Header */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.sectionLabel}>TREND SUMMARY</Text>
          <Text style={styles.headline}>{interp.headline}</Text>
        </View>
        <View style={[styles.stateBadge, { backgroundColor: stateBg }]}>
          <Text style={[styles.stateText, { color: stateColor }]}>
            {STATE_LABEL[interp.overallState]}
          </Text>
        </View>
      </View>

      {/* Key metrics strip — current-week snapshot */}
      {latest && (
        <View style={styles.statsRow}>
          <StatPill
            label="FATIGUE"
            value={`${latest.avgFatigue.toFixed(0)} ${dirLabel(fatigue.direction)}`}
            color={
              fatigue.direction === 'improving' ? colors.positive :
              fatigue.direction === 'worsening' ? colors.critical :
              colors.textMuted
            }
          />
          <StatPill
            label="RECOVERY"
            value={`${latest.avgRecovery.toFixed(0)} ${dirLabel(recovery.direction)}`}
            color={
              recovery.direction === 'improving' ? colors.positive :
              recovery.direction === 'worsening' ? colors.critical :
              colors.textMuted
            }
          />
          <StatPill
            label="ADHERENCE"
            value={`${Math.round(latest.adherence * 100)}%`}
            color={adherenceColor(latest.adherence, colors)}
          />
          <StatPill
            label="ACWR"
            value={latest.acwr.toFixed(2)}
            color={acwrColor(latest.acwr, colors)}
          />
        </View>
      )}

      {/* OLS slope summary (only when ≥ 3 data points) */}
      {analysis.hasEnoughData && (
        <View style={styles.slopeRow}>
          <View style={styles.slopeItem}>
            <Text style={styles.slopeLabel}>FATIGUE TREND</Text>
            <Text style={[styles.slopeValue, {
              color: fatigue.slope > 0 ? colors.critical : colors.positive,
            }]}>
              {slopeLabel(fatigue.slopeRecent)}
            </Text>
          </View>
          <View style={styles.slopeDivider} />
          <View style={styles.slopeItem}>
            <Text style={styles.slopeLabel}>RECOVERY TREND</Text>
            <Text style={[styles.slopeValue, {
              color: recovery.slope > 0 ? colors.positive : colors.critical,
            }]}>
              {slopeLabel(recovery.slopeRecent)}
            </Text>
          </View>
          <View style={styles.slopeDivider} />
          <View style={styles.slopeItem}>
            <Text style={styles.slopeLabel}>ADHERENCE TREND</Text>
            <Text style={[styles.slopeValue, {
              color: adherence.slope >= 0 ? colors.positive : colors.warning,
            }]}>
              {slopeLabel(adherence.slopeRecent * 100, '%')}
            </Text>
          </View>
        </View>
      )}

      {/* Three-section interpretation */}
      <View style={styles.sections}>
        <Section label="WHAT CHANGED" body={interp.whatChanged} />
        <Section label="WHY IT MATTERS" body={interp.whyItMatters} />
        <View style={[section.wrap]}>
          <Text style={[section.label, { color: stateColor }]}>WHAT TO DO NEXT</Text>
          <View style={[styles.nextBox, { borderColor: stateColor + '40' }]}>
            <Text style={[styles.nextText, { color: colors.text }]}>{interp.whatNext}</Text>
          </View>
        </View>
      </View>
    </Card>
  );
}

// ─── Inline color helpers (avoid circular import) ─────────────────────────────

function adherenceColor(v: number, colors: ThemeColors): string {
  if (v >= 0.85) return colors.positive;
  if (v >= 0.65) return colors.primary;
  if (v >= 0.50) return colors.warning;
  return colors.critical;
}

function acwrColor(v: number, colors: ThemeColors): string {
  if (v < 0.8)  return colors.warning;
  if (v <= 1.3) return colors.positive;
  if (v <= 1.5) return colors.warning;
  return colors.critical;
}

// ─── Styles ────────────────────────────────────────────────────────────────────

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  headerRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'flex-start',
    marginBottom:   spacing.lg,
  },
  sectionLabel: {
    color:         colors.textMuted,
    fontSize:      11,
    fontWeight:    FontWeight.medium,
    letterSpacing: 0.6,
    marginBottom:  4,
  },
  headline: {
    color:      colors.text,
    fontSize:   FontSize.base,
    fontWeight: FontWeight.black,
    lineHeight: 20,
    maxWidth:   200,
  },
  stateBadge: {
    paddingHorizontal: 10,
    paddingVertical:    5,
    borderRadius:       Radius.sm,
  },
  stateText: {
    fontSize:      11,
    fontWeight:    FontWeight.black,
    letterSpacing: 0.8,
  },
  statsRow: {
    flexDirection: 'row',
    gap:           spacing.xs,
    marginBottom:  spacing.md,
  },
  slopeRow: {
    flexDirection:   'row',
    backgroundColor: colors.border,
    borderRadius:    Radius.sm,
    padding:         spacing.sm,
    marginBottom:    spacing.md,
    alignItems:      'center',
  },
  slopeItem: {
    flex:       1,
    alignItems: 'center',
    gap:        2,
  },
  slopeDivider: {
    width:           1,
    height:          28,
    backgroundColor: colors.textSubtle,
    marginHorizontal: spacing.xs,
  },
  slopeLabel: {
    color:         colors.textMuted,
    fontSize:      8,
    fontWeight:    FontWeight.black,
    letterSpacing: 0.5,
  },
  slopeValue: {
    fontSize:   FontSize.sm,
    fontWeight: FontWeight.black,
  },
  sections: {
    gap: spacing.md,
  },
  nextBox: {
    borderWidth:  1,
    borderRadius: Radius.sm,
    padding:      spacing.md,
  },
  nextText: {
    fontSize:   FontSize.sm,
    lineHeight: 20,
  },
  });
}
