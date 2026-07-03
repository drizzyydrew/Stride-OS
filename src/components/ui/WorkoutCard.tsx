import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import Card from './Card';
import Badge from './Badge';
import Button from './Button';

import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { FontSize, FontWeight } from '../../theme/tokens';
import type { Workout, WorkoutIntensity } from '../../types/training';

type Props = {
  workout:    Workout;
  isComplete: boolean;
  onComplete: () => void;
};

type BadgeStyle = { bg: string; text: string; label: string };

const INTENSITY_BADGE: Record<WorkoutIntensity, BadgeStyle> = {
  rest:      { bg: colors.cardAlt,     text: colors.textDim,  label: 'Rest'      },
  very_easy: { bg: colors.positiveDim, text: colors.positive, label: 'Very Easy' },
  easy:      { bg: colors.primaryDim,  text: colors.primary,  label: 'Easy'      },
  moderate:  { bg: colors.accentDim,   text: colors.accent,   label: 'Moderate'  },
  hard:      { bg: colors.warningDim,  text: colors.warning,  label: 'Hard'      },
  max:       { bg: colors.criticalDim, text: colors.critical, label: 'Max'       },
};

export default function WorkoutCard({ workout, isComplete, onComplete }: Props) {
  const badge  = INTENSITY_BADGE[workout.intensity];
  const isRest = workout.type === 'rest';

  const buttonLabel = isComplete
    ? isRest ? 'Rest Logged' : 'Completed'
    : isRest ? 'Log Rest Day' : 'Complete Workout';

  return (
    <Card style={isComplete ? styles.cardComplete : undefined}>

      <View style={styles.headerRow}>
        <Badge label={badge.label} bg={badge.bg} color={badge.text} />
        <View style={styles.durationWrap}>
          {isComplete ? (
            <Ionicons name="checkmark-circle" size={16} color={colors.positive} />
          ) : null}
          <Text style={[styles.duration, isComplete && styles.durationDone]}>
            {isRest ? '—' : `${workout.durationMinutes} min`}
          </Text>
        </View>
      </View>

      <Text style={styles.title}>{workout.title}</Text>
      <Text style={styles.description}>{workout.description}</Text>

      {!isRest && (
        <>
          <View style={styles.divider} />
          <View style={styles.paceRow}>
            <Text style={styles.paceLabel}>{workout.paceGuidance.label}</Text>
            <Text style={styles.paceTarget}>{workout.paceGuidance.targetPace}</Text>
          </View>
          <Text style={styles.paceDescription}>{workout.paceGuidance.description}</Text>
        </>
      )}

      <Button
        label={buttonLabel}
        onPress={onComplete}
        disabled={isComplete}
        variant={isComplete ? 'secondary' : 'primary'}
        style={{ marginTop: spacing.xs }}
      />

    </Card>
  );
}

const styles = StyleSheet.create({
  cardComplete: {
    opacity: 0.55,
  },
  headerRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    marginBottom:   14,
  },
  durationWrap: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           6,
  },
  duration: {
    color:      colors.text,
    fontSize:   FontSize.xl,
    fontWeight: FontWeight.bold,
  },
  durationDone: {
    color:    colors.textMuted,
    fontSize: FontSize.lg,
  },
  title: {
    color:        colors.text,
    fontSize:     24,
    fontWeight:   FontWeight.black,
    marginBottom: 10,
  },
  description: {
    color:        colors.textMuted,
    fontSize:     FontSize.base,
    lineHeight:   21,
    marginBottom: spacing.xl,
  },
  divider: {
    height:          1,
    backgroundColor: colors.border,
    marginBottom:    spacing.lg,
  },
  paceRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'flex-end',
    marginBottom:   6,
  },
  paceLabel: {
    color:         colors.textDim,
    fontSize:      12,
    fontWeight:    FontWeight.medium,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  paceTarget: {
    color:      colors.text,
    fontSize:   FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  paceDescription: {
    color:        colors.textDim,
    fontSize:     FontSize.sm,
    lineHeight:   18,
    marginBottom: spacing.xl,
  },
});
