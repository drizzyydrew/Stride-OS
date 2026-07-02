import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import Card from '../ui/Card';
import { useThemeColors, type ThemeColors } from '../../theme/ThemeContext';
import { spacing } from '../../theme/spacing';
import { FontSize, FontWeight, Radius } from '../../theme/tokens';
import type {
  TrainingRecommendation,
  IntensityRecommendation,
  RecoveryRecommendation,
  InjuryRiskWarning,
  DeloadRecommendation,
} from '../../types/recommendation';
import type { WorkoutIntensity } from '../../types/training';

type Props = {
  rec:       TrainingRecommendation;
  checkedIn: boolean;  // when false, soreness/motivation used defaults — show accuracy note
};

// ─── Label maps ───────────────────────────────────────────────────────────────

const INTENSITY_LABEL: Record<WorkoutIntensity, string> = {
  rest:      'Rest',
  very_easy: 'Very Easy',
  easy:      'Easy',
  moderate:  'Moderate',
  hard:      'Hard',
  max:       'Max',
};

// "good" was previously a bespoke blue — Sage carries "state / in-progress"
// meaning per the design system, sitting between Positive (peak) and Warning (fair).
function readinessColor(colors: ThemeColors): Record<TrainingRecommendation['overallReadiness'], string> {
  return {
    peak: colors.positive,
    good: colors.sage,
    fair: colors.warning,
    poor: colors.critical,
  };
}

function readinessBg(colors: ThemeColors): Record<TrainingRecommendation['overallReadiness'], string> {
  return {
    peak: colors.positiveDim,
    good: colors.sage + '22',
    fair: colors.warningDim,
    poor: colors.criticalDim,
  };
}

function recoveryColor(colors: ThemeColors): Record<RecoveryRecommendation['priority'], string> {
  return {
    low:      colors.positive,
    moderate: colors.warning,
    high:     colors.critical,
    critical: colors.critical,
  };
}

function recoveryBg(colors: ThemeColors): Record<RecoveryRecommendation['priority'], string> {
  return {
    low:      colors.positiveDim,
    moderate: colors.warningDim,
    high:     colors.criticalDim,
    critical: colors.criticalDim,
  };
}

function adjustmentConfig(colors: ThemeColors): Record<
  IntensityRecommendation['adjustmentFromPlan'],
  { label: string; color: string; bg: string } | null
> {
  return {
    as_planned:    null,
    scale_down:    { label: 'Scale down',    color: colors.warning,  bg: colors.warningDim  },
    scale_up:      { label: 'Room to push',  color: colors.positive, bg: colors.positiveDim },
    swap_to_easy:  { label: 'Swap to easy',  color: colors.warning,  bg: colors.warningDim  },
    swap_to_rest:  { label: 'Consider rest', color: colors.critical, bg: colors.criticalDim },
  };
}

function riskColor(colors: ThemeColors): Record<InjuryRiskWarning['level'], string> {
  return {
    none:     colors.positive,
    elevated: colors.warning,
    high:     colors.critical,
  };
}

function deloadColor(colors: ThemeColors): Record<DeloadRecommendation['urgency'], string> {
  return {
    none:        colors.textDim,
    suggested:   colors.warning,
    recommended: colors.critical,
    mandatory:   colors.critical,
  };
}

function deloadBg(colors: ThemeColors): Record<DeloadRecommendation['urgency'], string> {
  return {
    none:        colors.border,
    suggested:   colors.warningDim,
    recommended: colors.criticalDim,
    mandatory:   colors.criticalDim,
  };
}

// ─── Sub-sections ─────────────────────────────────────────────────────────────

function ReadinessHeader({
  readinessScore,
  overallReadiness,
  colors,
  s,
}: Pick<TrainingRecommendation, 'readinessScore' | 'overallReadiness'> & {
  colors: ThemeColors;
  s: ReturnType<typeof createStyles>;
}) {
  const color = readinessColor(colors)[overallReadiness];
  const bg    = readinessBg(colors)[overallReadiness];
  const label = overallReadiness.charAt(0).toUpperCase() + overallReadiness.slice(1);

  return (
    <View style={s.headerRow}>
      <View>
        <Text style={s.cardTitle}>Recommendation</Text>
        <View style={s.scoreRow}>
          <Text style={[s.scoreValue, { color }]}>{readinessScore}</Text>
          <Text style={s.scoreUnit}>/100</Text>
        </View>
      </View>
      <View style={[s.badge, { backgroundColor: bg }]}>
        <Text style={[s.badgeText, { color }]}>{label.toUpperCase()}</Text>
      </View>
    </View>
  );
}

function IntensitySection({ rec, colors, s }: { rec: IntensityRecommendation; colors: ThemeColors; s: ReturnType<typeof createStyles> }) {
  const adj = adjustmentConfig(colors)[rec.adjustmentFromPlan];

  return (
    <View style={s.section}>
      <Text style={s.sectionLabel}>TODAY'S RECOMMENDATION</Text>

      <View style={s.intensityRow}>
        <Text style={s.intensityValue}>
          {INTENSITY_LABEL[rec.recommendedIntensity]}
        </Text>
        {rec.recommendedDurationMinutes > 0 && (
          <Text style={s.durationText}>
            {' · '}{rec.recommendedDurationMinutes} min
          </Text>
        )}
        {adj && (
          <View style={[s.adjustmentChip, { backgroundColor: adj.bg }]}>
            <Text style={[s.adjustmentText, { color: adj.color }]}>
              {adj.label.toUpperCase()}
            </Text>
          </View>
        )}
      </View>

      <Text style={s.rationale}>{rec.rationale}</Text>
    </View>
  );
}

function RecoverySection({ rec, colors, s }: { rec: RecoveryRecommendation; colors: ThemeColors; s: ReturnType<typeof createStyles> }) {
  const color = recoveryColor(colors)[rec.priority];
  const bg    = recoveryBg(colors)[rec.priority];
  const label = rec.priority.charAt(0).toUpperCase() + rec.priority.slice(1);

  return (
    <View style={[s.section, s.sectionBordered]}>
      <View style={s.sectionHeaderRow}>
        <Text style={s.sectionLabel}>RECOVERY</Text>
        <View style={[s.badge, { backgroundColor: bg }]}>
          <Text style={[s.badgeText, { color }]}>{label.toUpperCase()}</Text>
        </View>
      </View>
      {rec.actions.map((action, i) => (
        <View key={i} style={s.actionRow}>
          <View style={[s.bullet, { backgroundColor: color }]} />
          <Text style={s.actionText}>{action}</Text>
        </View>
      ))}
    </View>
  );
}

function InjuryRiskSection({ risk, colors, s }: { risk: InjuryRiskWarning; colors: ThemeColors; s: ReturnType<typeof createStyles> }) {
  if (risk.level === 'none') return null;

  const color    = riskColor(colors)[risk.level];
  const levelStr = risk.level === 'high' ? 'HIGH RISK' : 'ELEVATED RISK';

  return (
    <View style={[s.section, s.sectionBordered]}>
      <View style={s.sectionHeaderRow}>
        <Text style={s.sectionLabel}>INJURY RISK</Text>
        <Text style={[s.riskLabel, { color }]}>{levelStr}</Text>
      </View>
      {risk.triggers.map((t, i) => (
        <View key={i} style={s.actionRow}>
          <View style={[s.bullet, { backgroundColor: color }]} />
          <Text style={s.actionText}>{t}</Text>
        </View>
      ))}
      <Text style={[s.rationale, { marginTop: spacing.sm }]}>{risk.advice}</Text>
    </View>
  );
}

function DeloadBanner({ deload, colors, s }: { deload: DeloadRecommendation; colors: ThemeColors; s: ReturnType<typeof createStyles> }) {
  if (!deload.shouldDeload || deload.urgency === 'none') return null;

  const color = deloadColor(colors)[deload.urgency];
  const bg    = deloadBg(colors)[deload.urgency];
  const urgencyLabel =
    deload.urgency === 'mandatory'   ? 'DELOAD MANDATORY'   :
    deload.urgency === 'recommended' ? 'DELOAD RECOMMENDED' :
    'DELOAD SUGGESTED';

  return (
    <View style={[s.deloadBanner, { backgroundColor: bg }]}>
      <Text style={[s.deloadLabel, { color }]}>{urgencyLabel}</Text>
      <Text style={[s.deloadRationale, { color }]}>{deload.rationale}</Text>
    </View>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function RecommendationCard({ rec, checkedIn }: Props) {
  const colors = useThemeColors();
  const s = useMemo(() => createStyles(colors), [colors]);

  return (
    <Card>
      <ReadinessHeader
        readinessScore={rec.readinessScore}
        overallReadiness={rec.overallReadiness}
        colors={colors}
        s={s}
      />

      {!checkedIn && (
        <Text style={s.checkInNote}>
          Check in for a more accurate recommendation
        </Text>
      )}

      <IntensitySection rec={rec.intensity} colors={colors} s={s} />
      <RecoverySection  rec={rec.recovery}  colors={colors} s={s} />
      <InjuryRiskSection risk={rec.injuryRisk} colors={colors} s={s} />
      <DeloadBanner deload={rec.deload} colors={colors} s={s} />
    </Card>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  // Header
  headerRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'flex-start',
    marginBottom:   spacing.lg,
  },
  cardTitle: {
    color:        colors.textMuted,
    fontSize:     FontSize.base,
    fontWeight:   FontWeight.medium,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom:  4,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems:    'baseline',
  },
  scoreValue: {
    fontSize:   36,
    fontWeight: FontWeight.black,
    lineHeight: 40,
  },
  scoreUnit: {
    color:      colors.textDim,
    fontSize:   FontSize.base,
    fontWeight: FontWeight.medium,
    marginLeft: 3,
  },

  // Shared badge (readiness + recovery priority)
  badge: {
    paddingHorizontal: 10,
    paddingVertical:    5,
    borderRadius:      Radius.sm,
  },
  badgeText: {
    fontSize:      11,
    fontWeight:    FontWeight.black,
    letterSpacing: 0.8,
  },

  // Check-in note
  checkInNote: {
    color:        colors.textDim,
    fontSize:     FontSize.sm,
    fontStyle:    'italic',
    marginBottom: spacing.lg,
  },

  // Sections
  section: {
    marginBottom: spacing.md,
  },
  sectionBordered: {
    paddingTop:     spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  sectionHeaderRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    marginBottom:   spacing.sm,
  },
  sectionLabel: {
    color:         colors.textMuted,
    fontSize:      11,
    fontWeight:    FontWeight.medium,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },

  // Intensity row
  intensityRow: {
    flexDirection: 'row',
    alignItems:    'center',
    flexWrap:      'wrap',
    gap:           spacing.xs,
    marginBottom:  spacing.sm,
  },
  intensityValue: {
    color:      colors.text,
    fontSize:   FontSize.xl,
    fontWeight: FontWeight.black,
  },
  durationText: {
    color:      colors.textDim,
    fontSize:   FontSize.xl,
    fontWeight: FontWeight.medium,
  },
  adjustmentChip: {
    paddingHorizontal: 8,
    paddingVertical:   3,
    borderRadius:      Radius.sm,
    marginLeft:        spacing.xs,
  },
  adjustmentText: {
    fontSize:      10,
    fontWeight:    FontWeight.black,
    letterSpacing: 0.6,
  },

  // Rationale
  rationale: {
    color:      colors.textDim,
    fontSize:   FontSize.sm,
    lineHeight: 19,
  },

  // Recovery actions
  actionRow: {
    flexDirection: 'row',
    alignItems:    'flex-start',
    gap:           spacing.sm,
    marginBottom:  spacing.xs,
  },
  bullet: {
    width:     5,
    height:    5,
    borderRadius: 3,
    marginTop: 6,
    flexShrink: 0,
  },
  actionText: {
    flex:       1,
    color:      colors.textMuted,
    fontSize:   FontSize.sm,
    lineHeight: 19,
  },

  // Injury risk label
  riskLabel: {
    fontSize:      11,
    fontWeight:    FontWeight.black,
    letterSpacing: 0.6,
  },

  // Deload banner
  deloadBanner: {
    borderRadius: Radius.sm,
    padding:      spacing.md,
    marginTop:    spacing.sm,
  },
  deloadLabel: {
    fontSize:      11,
    fontWeight:    FontWeight.black,
    letterSpacing: 0.8,
    marginBottom:  spacing.xs,
  },
  deloadRationale: {
    fontSize:   FontSize.sm,
    lineHeight: 19,
    opacity:    0.85,
  },
  });
}
