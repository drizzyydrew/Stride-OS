import { StyleSheet, Text, View } from 'react-native';

import Card from '../ui/Card';
import { colors } from '../../theme/colors';
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

const READINESS_COLOR: Record<TrainingRecommendation['overallReadiness'], string> = {
  peak: colors.positive,
  good: '#60A5FA',       // blue-400 — distinct from primary but on-brand
  fair: colors.warning,
  poor: colors.critical,
};

const READINESS_BG: Record<TrainingRecommendation['overallReadiness'], string> = {
  peak: colors.positiveDim,
  good: '#0C1A3D',
  fair: colors.warningDim,
  poor: colors.criticalDim,
};

const RECOVERY_COLOR: Record<RecoveryRecommendation['priority'], string> = {
  low:      colors.positive,
  moderate: colors.warning,
  high:     colors.critical,
  critical: colors.critical,
};

const RECOVERY_BG: Record<RecoveryRecommendation['priority'], string> = {
  low:      colors.positiveDim,
  moderate: colors.warningDim,
  high:     colors.criticalDim,
  critical: colors.criticalDim,
};

const ADJUSTMENT_CONFIG: Record<
  IntensityRecommendation['adjustmentFromPlan'],
  { label: string; color: string; bg: string } | null
> = {
  as_planned:    null,
  scale_down:    { label: 'Scale down',    color: colors.warning,  bg: colors.warningDim  },
  scale_up:      { label: 'Room to push',  color: colors.positive, bg: colors.positiveDim },
  swap_to_easy:  { label: 'Swap to easy',  color: colors.warning,  bg: colors.warningDim  },
  swap_to_rest:  { label: 'Consider rest', color: colors.critical, bg: colors.criticalDim },
};

const RISK_COLOR: Record<InjuryRiskWarning['level'], string> = {
  none:     colors.positive,
  elevated: colors.warning,
  high:     colors.critical,
};

const DELOAD_COLOR: Record<DeloadRecommendation['urgency'], string> = {
  none:        colors.textDim,
  suggested:   colors.warning,
  recommended: colors.critical,
  mandatory:   colors.critical,
};

const DELOAD_BG: Record<DeloadRecommendation['urgency'], string> = {
  none:        colors.border,
  suggested:   colors.warningDim,
  recommended: colors.criticalDim,
  mandatory:   colors.criticalDim,
};

// ─── Sub-sections ─────────────────────────────────────────────────────────────

function ReadinessHeader({
  readinessScore,
  overallReadiness,
}: Pick<TrainingRecommendation, 'readinessScore' | 'overallReadiness'>) {
  const color = READINESS_COLOR[overallReadiness];
  const bg    = READINESS_BG[overallReadiness];
  const label = overallReadiness.charAt(0).toUpperCase() + overallReadiness.slice(1);

  return (
    <View style={styles.headerRow}>
      <View>
        <Text style={styles.cardTitle}>Recommendation</Text>
        <View style={styles.scoreRow}>
          <Text style={[styles.scoreValue, { color }]}>{readinessScore}</Text>
          <Text style={styles.scoreUnit}>/100</Text>
        </View>
      </View>
      <View style={[styles.badge, { backgroundColor: bg }]}>
        <Text style={[styles.badgeText, { color }]}>{label.toUpperCase()}</Text>
      </View>
    </View>
  );
}

function IntensitySection({ rec }: { rec: IntensityRecommendation }) {
  const adj = ADJUSTMENT_CONFIG[rec.adjustmentFromPlan];

  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>TODAY'S RECOMMENDATION</Text>

      <View style={styles.intensityRow}>
        <Text style={styles.intensityValue}>
          {INTENSITY_LABEL[rec.recommendedIntensity]}
        </Text>
        {rec.recommendedDurationMinutes > 0 && (
          <Text style={styles.durationText}>
            {' · '}{rec.recommendedDurationMinutes} min
          </Text>
        )}
        {adj && (
          <View style={[styles.adjustmentChip, { backgroundColor: adj.bg }]}>
            <Text style={[styles.adjustmentText, { color: adj.color }]}>
              {adj.label.toUpperCase()}
            </Text>
          </View>
        )}
      </View>

      <Text style={styles.rationale}>{rec.rationale}</Text>
    </View>
  );
}

function RecoverySection({ rec }: { rec: RecoveryRecommendation }) {
  const color = RECOVERY_COLOR[rec.priority];
  const bg    = RECOVERY_BG[rec.priority];
  const label = rec.priority.charAt(0).toUpperCase() + rec.priority.slice(1);

  return (
    <View style={[styles.section, styles.sectionBordered]}>
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionLabel}>RECOVERY</Text>
        <View style={[styles.badge, { backgroundColor: bg }]}>
          <Text style={[styles.badgeText, { color }]}>{label.toUpperCase()}</Text>
        </View>
      </View>
      {rec.actions.map((action, i) => (
        <View key={i} style={styles.actionRow}>
          <View style={[styles.bullet, { backgroundColor: color }]} />
          <Text style={styles.actionText}>{action}</Text>
        </View>
      ))}
    </View>
  );
}

function InjuryRiskSection({ risk }: { risk: InjuryRiskWarning }) {
  if (risk.level === 'none') return null;

  const color    = RISK_COLOR[risk.level];
  const levelStr = risk.level === 'high' ? 'HIGH RISK' : 'ELEVATED RISK';

  return (
    <View style={[styles.section, styles.sectionBordered]}>
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionLabel}>INJURY RISK</Text>
        <Text style={[styles.riskLabel, { color }]}>{levelStr}</Text>
      </View>
      {risk.triggers.map((t, i) => (
        <View key={i} style={styles.actionRow}>
          <View style={[styles.bullet, { backgroundColor: color }]} />
          <Text style={styles.actionText}>{t}</Text>
        </View>
      ))}
      <Text style={[styles.rationale, { marginTop: spacing.sm }]}>{risk.advice}</Text>
    </View>
  );
}

function DeloadBanner({ deload }: { deload: DeloadRecommendation }) {
  if (!deload.shouldDeload || deload.urgency === 'none') return null;

  const color = DELOAD_COLOR[deload.urgency];
  const bg    = DELOAD_BG[deload.urgency];
  const urgencyLabel =
    deload.urgency === 'mandatory'   ? 'DELOAD MANDATORY'   :
    deload.urgency === 'recommended' ? 'DELOAD RECOMMENDED' :
    'DELOAD SUGGESTED';

  return (
    <View style={[styles.deloadBanner, { backgroundColor: bg }]}>
      <Text style={[styles.deloadLabel, { color }]}>{urgencyLabel}</Text>
      <Text style={[styles.deloadRationale, { color }]}>{deload.rationale}</Text>
    </View>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function RecommendationCard({ rec, checkedIn }: Props) {
  return (
    <Card>
      <ReadinessHeader
        readinessScore={rec.readinessScore}
        overallReadiness={rec.overallReadiness}
      />

      {!checkedIn && (
        <Text style={styles.checkInNote}>
          Check in for a more accurate recommendation
        </Text>
      )}

      <IntensitySection rec={rec.intensity} />
      <RecoverySection  rec={rec.recovery}  />
      <InjuryRiskSection risk={rec.injuryRisk} />
      <DeloadBanner deload={rec.deload} />
    </Card>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
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
