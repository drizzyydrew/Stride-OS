import { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import Card from '../ui/Card';
import { useActionPlanStore } from '../../store/actionPlanStore';
import { useThemeColors, type ThemeColors } from '../../theme/ThemeContext';
import { spacing } from '../../theme/spacing';
import { FontSize, FontWeight, Radius } from '../../theme/tokens';
import type { PlannedAction, ActionCategory, ActionDueWindow, ActionPriority } from '../../types/actionPlan';

type Props = {
  actions: PlannedAction[];
};

// ─── Visual config ────────────────────────────────────────────────────────────
// Category chips: only categories with a genuine physiological/status meaning
// (recovery, load) get a semantic status color; purely categorical tags
// (training, race prep) borrow Sage/Clay per the brand's state-vs-action split.

function categoryConfig(colors: ThemeColors): Record<ActionCategory, { label: string; color: string; bg: string }> {
  return {
    recovery:        { label: 'RECOVERY',     color: colors.positive, bg: colors.positiveDim },
    training:        { label: 'TRAINING',     color: colors.sage,     bg: colors.sage + '22' },
    load_management: { label: 'LOAD',         color: colors.warning,  bg: colors.warningDim  },
    race_prep:       { label: 'RACE PREP',    color: colors.primary,  bg: colors.primaryDim  },
    habit:           { label: 'HABIT',        color: colors.textMuted, bg: colors.border },
  };
}

function dueConfig(colors: ThemeColors): Record<ActionDueWindow, { label: string; color: string }> {
  return {
    today:     { label: 'TODAY',     color: colors.critical },
    this_week: { label: 'THIS WEEK', color: colors.warning  },
    next_week: { label: 'NEXT WEEK', color: colors.textDim  },
  };
}

function priorityDot(colors: ThemeColors): Record<ActionPriority, string> {
  return {
    high:   colors.critical,
    medium: colors.warning,
    low:    colors.positive,
  };
}

// ─── Single action row ────────────────────────────────────────────────────────

function ActionRow({ action, isLast }: { action: PlannedAction; isLast: boolean }) {
  const { isCompleted, completeAction } = useActionPlanStore();
  const completed = isCompleted(action.id);

  const colors = useThemeColors();
  const rowStyles = useMemo(() => createRowStyles(colors), [colors]);

  const category = categoryConfig(colors)[action.category];
  const due      = dueConfig(colors)[action.dueWindow];
  const dotColor = priorityDot(colors)[action.priority];

  return (
    <View style={[rowStyles.container, !isLast && rowStyles.bordered]}>
      {/* Priority dot */}
      <View style={[rowStyles.priorityDot, { backgroundColor: dotColor }]} />

      {/* Content */}
      <View style={rowStyles.content}>
        {/* Chips row */}
        <View style={rowStyles.chipsRow}>
          <View style={[rowStyles.chip, { backgroundColor: category.bg }]}>
            <Text style={[rowStyles.chipText, { color: category.color }]}>
              {category.label}
            </Text>
          </View>
          <Text style={[rowStyles.dueText, { color: due.color }]}>
            {due.label}
          </Text>
        </View>

        {/* Title */}
        <Text style={[rowStyles.title, completed && rowStyles.titleDone]}>
          {action.title}
        </Text>

        {/* Reason */}
        <Text style={rowStyles.reason}>{action.reason}</Text>
      </View>

      {/* Checkbox */}
      <TouchableOpacity
        onPress={() => !completed && completeAction(action.id)}
        activeOpacity={0.7}
        style={[rowStyles.checkbox, completed && rowStyles.checkboxDone]}
      >
        {completed && <Text style={rowStyles.checkmark}>✓</Text>}
      </TouchableOpacity>
    </View>
  );
}

function createRowStyles(colors: ThemeColors) {
  return StyleSheet.create({
  container: {
    flexDirection:  'row',
    alignItems:     'flex-start',
    paddingVertical: spacing.md,
    gap:             spacing.sm,
  },
  bordered: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  priorityDot: {
    width:        6,
    height:       6,
    borderRadius: 3,
    marginTop:    6,
    flexShrink:   0,
  },
  content: {
    flex: 1,
    gap:  spacing.xs,
  },
  chipsRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.sm,
  },
  chip: {
    paddingHorizontal: 6,
    paddingVertical:   2,
    borderRadius:      Radius.sm,
  },
  chipText: {
    fontSize:      9,
    fontWeight:    FontWeight.black,
    letterSpacing: 0.6,
  },
  dueText: {
    fontSize:      9,
    fontWeight:    FontWeight.black,
    letterSpacing: 0.6,
  },
  title: {
    color:      colors.text,
    fontSize:   FontSize.base,
    fontWeight: FontWeight.bold,
    lineHeight: 20,
  },
  titleDone: {
    color:              colors.textDim,
    textDecorationLine: 'line-through',
  },
  reason: {
    color:      colors.textDim,
    fontSize:   FontSize.sm,
    lineHeight: 18,
  },
  checkbox: {
    width:        22,
    height:       22,
    borderRadius: 11,
    borderWidth:  2,
    borderColor:  colors.border,
    alignItems:   'center',
    justifyContent: 'center',
    flexShrink:   0,
    marginTop:    2,
  },
  checkboxDone: {
    backgroundColor: colors.positive,
    borderColor:     colors.positive,
  },
  checkmark: {
    color:      colors.onAccent,
    fontSize:   11,
    fontWeight: FontWeight.black,
  },
  });
}

// ─── Main card ────────────────────────────────────────────────────────────────

export default function ActionPlanCard({ actions }: Props) {
  const { isCompleted } = useActionPlanStore();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  if (actions.length === 0) {
    return (
      <Card>
        <Text style={styles.sectionLabel}>ACTION PLAN</Text>
        <Text style={styles.empty}>
          No specific actions needed right now — keep doing what you're doing.
        </Text>
      </Card>
    );
  }

  const completedCount = actions.filter(a => isCompleted(a.id)).length;

  return (
    <Card>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.sectionLabel}>ACTION PLAN</Text>
        <Text style={styles.progress}>
          {completedCount}/{actions.length} done
        </Text>
      </View>

      {/* Actions */}
      {actions.map((action, i) => (
        <ActionRow
          key={action.id}
          action={action}
          isLast={i === actions.length - 1}
        />
      ))}
    </Card>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  header: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    marginBottom:   spacing.xs,
  },
  sectionLabel: {
    color:         colors.textMuted,
    fontSize:      11,
    fontWeight:    FontWeight.medium,
    letterSpacing: 0.6,
  },
  progress: {
    color:     colors.textDim,
    fontSize:  FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  empty: {
    color:      colors.textDim,
    fontSize:   FontSize.sm,
    lineHeight: 19,
    fontStyle:  'italic',
    marginTop:  spacing.xs,
  },
  });
}
