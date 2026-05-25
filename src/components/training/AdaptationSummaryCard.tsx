import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import Card from '../ui/Card';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { FontSize, FontWeight, Radius } from '../../theme/tokens';
import type {
  AdaptationResult,
  AdaptationTrigger,
  AdaptationChangeType,
  AdaptationTriggerType,
} from '../../types/adaptation';
import type { GeneratableWorkoutType } from '../../types/training';

type Props = {
  result:        AdaptationResult;
  onRecalculate: () => void;
  isLoading?:    boolean;
};

// ─── Display maps ─────────────────────────────────────────────────────────────

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const TYPE_LABEL: Record<GeneratableWorkoutType, string> = {
  recovery_run: 'Recovery Run',
  easy_run:     'Easy Run',
  long_run:     'Long Run',
  threshold:    'Threshold',
  vo2:          'VO2 Intervals',
  strides:      'Strides',
  rest:         'Rest',
};

const TRIGGER_LABEL: Record<AdaptationTriggerType, string> = {
  high_fatigue:         'High Fatigue',
  low_recovery:         'Low Recovery',
  missed_workouts:      'Missed Sessions',
  high_acwr:            'Load Spike',
  high_soreness:        'High Soreness',
  overreaching_pattern: 'Overreaching',
  plan_deload:          'Deload Week',
};

const CHANGE_PREFIX: Record<AdaptationChangeType, string> = {
  as_planned:            '',
  intensity_downgrade:   '↓',
  converted_to_easy:     '→',
  converted_to_recovery: '→',
  inserted_rest:         '→',
  long_run_reduced:      '↓',
  quality_protected:     '✓',
};

// ─── Severity derivation ──────────────────────────────────────────────────────

function deriveSeverity(triggers: AdaptationTrigger[]): 0 | 1 | 2 | 3 {
  const hasSevere     = triggers.some(t => t.severity === 'severe');
  const moderateCount = triggers.filter(t => t.severity === 'moderate').length;
  const hasMild       = triggers.some(t => t.severity === 'mild');
  if (hasSevere || moderateCount >= 2) return 3;
  if (moderateCount === 1)             return 2;
  if (hasMild)                         return 1;
  return 0;
}

const SEVERITY_LABEL  = ['On Track', 'Mild', 'Moderate', 'High'] as const;
const SEVERITY_COLOR  = [colors.positive, colors.warning, colors.warning, colors.critical] as const;
const SEVERITY_BG     = [colors.positiveDim, colors.warningDim, colors.warningDim, colors.criticalDim] as const;

// ─── Trigger chip ─────────────────────────────────────────────────────────────

function TriggerChip({ trigger }: { trigger: AdaptationTrigger }) {
  const color =
    trigger.severity === 'severe'   ? colors.critical :
    trigger.severity === 'moderate' ? colors.warning   :
    colors.textDim;
  const bg =
    trigger.severity === 'severe'   ? colors.criticalDim :
    trigger.severity === 'moderate' ? colors.warningDim   :
    colors.border;

  return (
    <View style={[styles.chip, { backgroundColor: bg }]}>
      <Text style={[styles.chipText, { color }]}>
        {TRIGGER_LABEL[trigger.type].toUpperCase()}
      </Text>
    </View>
  );
}

// ─── Change row ───────────────────────────────────────────────────────────────

function ChangeRow({ entry }: {
  entry: AdaptationResult['entries'][number];
}) {
  if (entry.change === 'as_planned' || entry.originalType === entry.adaptedType) return null;

  const isProtected = entry.change === 'quality_protected';
  const color = isProtected ? colors.positive : colors.warning;
  const prefix = CHANGE_PREFIX[entry.change];

  return (
    <View style={styles.changeRow}>
      <View style={styles.changeLeft}>
        <Text style={styles.dayTag}>{DAY_NAMES[entry.dayIndex]}</Text>
        <Text style={styles.changeFlow}>
          <Text style={styles.originalType}>{TYPE_LABEL[entry.originalType]}</Text>
          <Text style={[styles.changeArrow, { color }]}>{` ${prefix} `}</Text>
          <Text style={[styles.adaptedType, isProtected ? styles.protectedType : styles.modifiedType]}>
            {TYPE_LABEL[entry.adaptedType]}
          </Text>
        </Text>
      </View>
      {entry.reason.length > 0 && (
        <Text style={styles.changeReason} numberOfLines={2}>{entry.reason}</Text>
      )}
    </View>
  );
}

// ─── Main card ────────────────────────────────────────────────────────────────

export default function AdaptationSummaryCard({ result, onRecalculate, isLoading }: Props) {
  const severity      = deriveSeverity(result.triggers);
  const severityLabel = SEVERITY_LABEL[severity];
  const severityColor = SEVERITY_COLOR[severity];
  const severityBg    = SEVERITY_BG[severity];

  const changedEntries = result.entries.filter(
    e => e.originalType !== e.adaptedType,
  );

  // Only show triggers with actionable severity (filter out as-info plan_deload when no changes)
  const displayTriggers = result.appliedCount > 0
    ? result.triggers
    : result.triggers.filter(t => t.type !== 'plan_deload');

  return (
    <Card>
      {/* Header */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.cardTitle}>WEEK ADAPTATION</Text>
          <Text style={styles.summary}>{result.summary}</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: severityBg }]}>
          <Text style={[styles.badgeText, { color: severityColor }]}>
            {severityLabel.toUpperCase()}
          </Text>
        </View>
      </View>

      {/* Trigger chips */}
      {displayTriggers.length > 0 && (
        <View style={styles.chipsSection}>
          <Text style={styles.sectionLabel}>TRIGGERS</Text>
          <View style={styles.chipRow}>
            {displayTriggers.map((t, i) => (
              <TriggerChip key={i} trigger={t} />
            ))}
          </View>
        </View>
      )}

      {/* Changed sessions */}
      {changedEntries.length > 0 && (
        <View style={styles.changesSection}>
          <Text style={styles.sectionLabel}>CHANGES</Text>
          {changedEntries.map((entry, i) => (
            <ChangeRow key={i} entry={entry} />
          ))}
        </View>
      )}

      {/* Missed sessions notice */}
      {result.missedCount > 0 && (
        <View style={styles.missedNotice}>
          <Text style={styles.missedText}>
            {result.missedCount} session{result.missedCount > 1 ? 's' : ''} missed this week —
            not rescheduled. Making up skipped hard sessions compounds acute load.
          </Text>
        </View>
      )}

      {/* Recalculate button */}
      <TouchableOpacity
        style={[styles.recalcButton, isLoading && styles.recalcDisabled]}
        onPress={onRecalculate}
        disabled={isLoading}
        activeOpacity={0.7}
      >
        <Text style={styles.recalcLabel}>
          {isLoading ? 'Recalculating…' : 'Recalculate Week'}
        </Text>
      </TouchableOpacity>
    </Card>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  headerRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'flex-start',
    marginBottom:   spacing.lg,
    gap:            spacing.md,
  },
  cardTitle: {
    color:         colors.textMuted,
    fontSize:      11,
    fontWeight:    FontWeight.medium,
    letterSpacing: 0.6,
    marginBottom:  6,
  },
  summary: {
    color:      colors.text,
    fontSize:   FontSize.base,
    fontWeight: FontWeight.medium,
    lineHeight: 20,
    maxWidth:   220,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical:    5,
    borderRadius:      Radius.sm,
    flexShrink:        0,
  },
  badgeText: {
    fontSize:      11,
    fontWeight:    FontWeight.black,
    letterSpacing: 0.8,
  },

  // Trigger chips
  chipsSection: {
    marginBottom: spacing.lg,
  },
  sectionLabel: {
    color:         colors.textMuted,
    fontSize:      11,
    fontWeight:    FontWeight.medium,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom:  spacing.sm,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           spacing.xs,
  },
  chip: {
    paddingHorizontal: 8,
    paddingVertical:   4,
    borderRadius:      Radius.sm,
  },
  chipText: {
    fontSize:      10,
    fontWeight:    FontWeight.black,
    letterSpacing: 0.6,
  },

  // Changes list
  changesSection: {
    marginBottom: spacing.md,
  },
  changeRow: {
    paddingVertical:  spacing.sm,
    borderTopWidth:   1,
    borderTopColor:   colors.border,
    gap:              spacing.xs,
  },
  changeLeft: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.sm,
    flexWrap:      'wrap',
  },
  dayTag: {
    color:         colors.textDim,
    fontSize:      11,
    fontWeight:    FontWeight.black,
    letterSpacing: 0.6,
    minWidth:      28,
  },
  changeFlow: {
    flexDirection: 'row',
    flexWrap:      'wrap',
  },
  originalType: {
    color:      colors.textDim,
    fontSize:   FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  changeArrow: {
    fontSize:   FontSize.sm,
    fontWeight: FontWeight.black,
  },
  adaptedType: {
    fontSize:   FontSize.sm,
    fontWeight: FontWeight.bold,
  },
  modifiedType: {
    color: colors.warning,
  },
  protectedType: {
    color: colors.positive,
  },
  changeReason: {
    color:      colors.textMuted,
    fontSize:   12,
    lineHeight: 17,
    paddingLeft: 40,
  },

  // Missed notice
  missedNotice: {
    backgroundColor: colors.border,
    borderRadius:    Radius.sm,
    padding:         spacing.md,
    marginBottom:    spacing.md,
  },
  missedText: {
    color:      colors.textDim,
    fontSize:   FontSize.sm,
    lineHeight: 18,
  },

  // Recalculate button
  recalcButton: {
    borderWidth:   1,
    borderColor:   colors.border,
    borderRadius:  Radius.sm,
    paddingVertical: spacing.sm,
    alignItems:    'center',
  },
  recalcDisabled: {
    opacity: 0.5,
  },
  recalcLabel: {
    color:         colors.textDim,
    fontSize:      FontSize.sm,
    fontWeight:    FontWeight.medium,
    letterSpacing: 0.3,
  },
});
