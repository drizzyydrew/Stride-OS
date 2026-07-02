import { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import Card from '../ui/Card';
import { useThemeColors, type ThemeColors } from '../../theme/ThemeContext';
import { spacing } from '../../theme/spacing';
import { FontSize, FontWeight, Radius } from '../../theme/tokens';
import type { TrainingDay } from '../../types/athlete';

type Props = {
  availableDays:  TrainingDay[];
  targetSessions: number;
  onEdit?:        () => void;
};

const ALL_DAYS: TrainingDay[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const SESSION_LABEL: Record<number, string> = {
  3: 'Minimum viable training',
  4: 'Recreational runner',
  5: 'Competitive amateur',
  6: 'Serious competitor',
  7: 'High-volume training',
};

function DayDot({ day, active }: { day: TrainingDay; active: boolean }) {
  const colors = useThemeColors();
  const dot    = useMemo(() => createDotStyles(colors), [colors]);
  return (
    <View style={[dot.wrap, active && dot.active]}>
      <Text style={[dot.label, active && dot.labelActive]}>{day[0]}</Text>
    </View>
  );
}

function createDotStyles(colors: ThemeColors) {
  return StyleSheet.create({
  wrap: {
    width:          32,
    height:         32,
    borderRadius:   16,
    borderWidth:    1,
    borderColor:    colors.border,
    alignItems:     'center',
    justifyContent: 'center',
  },
  active: {
    backgroundColor: colors.primaryDim,
    borderColor:     colors.primary,
  },
  label: {
    color:      colors.textSubtle,
    fontSize:   FontSize.sm,
    fontWeight: FontWeight.black,
  },
  labelActive: {
    color: colors.primary,
  },
  });
}

export default function TrainingAvailabilityCard({
  availableDays,
  targetSessions,
  onEdit,
}: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const activeSet = new Set(availableDays);
  const sessionNote = SESSION_LABEL[targetSessions] ?? `${targetSessions} sessions/week`;

  const longRunDay = availableDays.includes('Sat')
    ? 'Saturday'
    : availableDays.includes('Sun')
      ? 'Sunday'
      : availableDays[availableDays.length - 1] ?? '—';

  return (
    <Card>
      <View style={styles.headerRow}>
        <Text style={styles.sectionLabel}>TRAINING AVAILABILITY</Text>
        {onEdit && (
          <TouchableOpacity onPress={onEdit} style={styles.editBtn}>
            <Text style={styles.editBtnText}>Edit</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Day selector dots */}
      <View style={styles.daysRow}>
        {ALL_DAYS.map(d => (
          <DayDot key={d} day={d} active={activeSet.has(d)} />
        ))}
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCell}>
          <Text style={styles.statValue}>{availableDays.length}</Text>
          <Text style={styles.statLabel}>AVAILABLE DAYS</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statCell}>
          <Text style={styles.statValue}>{targetSessions}</Text>
          <Text style={styles.statLabel}>TARGET SESSIONS</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statCell}>
          <Text style={styles.statValue}>{longRunDay.slice(0, 3)}</Text>
          <Text style={styles.statLabel}>LONG RUN DAY</Text>
        </View>
      </View>

      {/* Session load note */}
      <View style={styles.noteBox}>
        <Text style={styles.noteText}>{sessionNote}</Text>
      </View>
    </Card>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  headerRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    marginBottom:   spacing.md,
  },
  sectionLabel: {
    color:         colors.textMuted,
    fontSize:      11,
    fontWeight:    FontWeight.medium,
    letterSpacing: 0.6,
  },
  editBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical:   3,
    borderRadius:      Radius.sm,
    borderWidth:       1,
    borderColor:       colors.border,
  },
  editBtnText: {
    color:    colors.textDim,
    fontSize: FontSize.sm,
  },
  daysRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    marginBottom:   spacing.md,
  },
  statsRow: {
    flexDirection:   'row',
    backgroundColor: colors.border,
    borderRadius:    Radius.sm,
    padding:         spacing.md,
    alignItems:      'center',
    marginBottom:    spacing.sm,
  },
  statCell: {
    flex:       1,
    alignItems: 'center',
    gap:        2,
  },
  statDivider: {
    width:           1,
    height:          28,
    backgroundColor: colors.textSubtle,
    marginHorizontal: spacing.xs,
  },
  statValue: {
    color:      colors.text,
    fontSize:   FontSize.lg,
    fontWeight: FontWeight.black,
  },
  statLabel: {
    color:         colors.textMuted,
    fontSize:      8,
    fontWeight:    FontWeight.black,
    letterSpacing: 0.5,
  },
  noteBox: {
    backgroundColor: colors.border,
    borderRadius:    Radius.sm,
    paddingVertical:   spacing.sm,
    paddingHorizontal: spacing.md,
  },
  noteText: {
    color:     colors.textDim,
    fontSize:  FontSize.sm,
    textAlign: 'center',
  },
  });
}
