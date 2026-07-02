import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import { useThemeColors, zoneTint, type ThemeColors } from '../../theme/ThemeContext';
import { spacing } from '../../theme/spacing';
import { FontSize, FontWeight } from '../../theme/tokens';
import type { RichWorkout } from '../../types/workout';
import type { WorkoutIntensity } from '../../types/training';

type Props = { workout: RichWorkout };

type BadgeStyle = { bg: string; text: string; label: string };

// Intensity is a single-accent ramp (rest → max), never a red/green traffic
// light (§3.7, §3.9 of the design system) — Sage at increasing opacity via
// `zoneTint`. "Rest" sits outside the effort ramp entirely (neutral tone).
const INTENSITY_ORDER: WorkoutIntensity[] = ['very_easy', 'easy', 'moderate', 'hard', 'max'];
const INTENSITY_LABEL: Record<WorkoutIntensity, string> = {
  rest:      'Rest',
  very_easy: 'Very Easy',
  easy:      'Easy',
  moderate:  'Moderate',
  hard:      'Hard',
  max:       'Max',
};

function intensityBadge(intensity: WorkoutIntensity, colors: ThemeColors): BadgeStyle {
  if (intensity === 'rest') {
    return { bg: colors.border, text: colors.textDim, label: INTENSITY_LABEL.rest };
  }
  const idx = INTENSITY_ORDER.indexOf(intensity);
  return {
    bg:    zoneTint(colors, idx, INTENSITY_ORDER.length),
    text:  colors.text,
    label: INTENSITY_LABEL[intensity],
  };
}

function StatCell({ label, value, sub, styles }: {
  label: string; value: string; sub?: string; styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.statCell}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
      {sub ? <Text style={styles.statSub}>{sub}</Text> : null}
    </View>
  );
}

export default function WorkoutDetailCard({ workout }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const badge     = intensityBadge(workout.intensity, colors);
  const zoneColor = zoneTint(colors, (workout.hrZoneTarget - 1) % 5, 5);
  const isRest    = workout.type === 'rest';

  return (
    <Card>
      {/* Header */}
      <View style={styles.headerRow}>
        <Badge label={badge.label} bg={badge.bg} color={badge.text} />
        <Text style={styles.duration}>
          {isRest ? 'Rest Day' : `${workout.durationMinutes} min`}
        </Text>
      </View>

      <Text style={styles.title}>{workout.title}</Text>
      <Text style={styles.purpose}>{workout.purpose}</Text>

      {!isRest && (
        <>
          <View style={styles.divider} />

          {/* Stat grid */}
          <View style={styles.statGrid}>
            <StatCell
              label="Pace Target"
              value={workout.paceGuidance.targetPace}
              styles={styles}
            />
            <StatCell
              label={`HR Zone ${workout.hrZoneTarget}`}
              value={`Zone ${workout.hrZoneTarget}`}
              sub={`RPE ${workout.rpeRange[0]}–${workout.rpeRange[1]}`}
              styles={styles}
            />
          </View>

          {/* Zone color indicator */}
          <View style={[styles.zoneBar, { backgroundColor: zoneColor }]} />

          {/* Environment adjustment notice */}
          {workout.environmentAdjustment?.applied && (
            <View style={styles.envRow}>
              <Text style={styles.envText}>
                ⚠ {workout.environmentAdjustment.note}
              </Text>
              {workout.environmentAdjustment.adjustedPaceRange && (
                <Text style={styles.envAdjusted}>
                  Adjusted: {workout.paceGuidance.targetPace}
                </Text>
              )}
            </View>
          )}

          <View style={styles.divider} />

          {/* Warmup / Cooldown row */}
          <View style={styles.segRow}>
            <View style={styles.seg}>
              <Text style={styles.segLabel}>Warmup</Text>
              <Text style={styles.segDur}>{workout.warmup.duration}</Text>
              <Text style={styles.segPace}>{workout.warmup.paceGuide}</Text>
            </View>
            <View style={styles.segDivider} />
            <View style={styles.seg}>
              <Text style={styles.segLabel}>Cooldown</Text>
              <Text style={styles.segDur}>{workout.cooldown.duration}</Text>
              <Text style={styles.segPace}>{workout.cooldown.paceGuide}</Text>
            </View>
          </View>
        </>
      )}

      {workout.progressionNote && (
        <View style={styles.progressionRow}>
          <Text style={styles.progressionText}>{workout.progressionNote}</Text>
        </View>
      )}
    </Card>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  headerRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    marginBottom:   14,
  },
  duration: {
    color:      colors.text,
    fontSize:   FontSize.xl,
    fontWeight: FontWeight.bold,
  },
  title: {
    color:        colors.text,
    fontSize:     24,
    fontWeight:   FontWeight.black,
    marginBottom: 8,
  },
  purpose: {
    color:        colors.textMuted,
    fontSize:     FontSize.base,
    lineHeight:   20,
    marginBottom: spacing.lg,
  },
  divider: {
    height:          1,
    backgroundColor: colors.border,
    marginBottom:    spacing.lg,
  },
  statGrid: {
    flexDirection: 'row',
    gap:           spacing.xl,
    marginBottom:  spacing.md,
  },
  statCell: {
    flex: 1,
  },
  statLabel: {
    color:         colors.textDim,
    fontSize:      11,
    fontWeight:    FontWeight.medium,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom:  4,
  },
  statValue: {
    color:      colors.text,
    fontSize:   FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  statSub: {
    color:     colors.textMuted,
    fontSize:  FontSize.sm,
    marginTop: 2,
  },
  zoneBar: {
    height:        3,
    borderRadius:  2,
    marginBottom:  spacing.lg,
    opacity:       0.6,
  },
  envRow: {
    backgroundColor: colors.warningDim,
    borderRadius:    8,
    padding:         spacing.md,
    marginBottom:    spacing.lg,
  },
  envText: {
    color:    colors.warning,
    fontSize: FontSize.sm,
  },
  envAdjusted: {
    color:     colors.text,
    fontSize:  FontSize.sm,
    marginTop: 4,
    fontWeight: FontWeight.medium,
  },
  segRow: {
    flexDirection: 'row',
    gap:           spacing.lg,
  },
  seg: {
    flex: 1,
  },
  segDivider: {
    width:           1,
    backgroundColor: colors.border,
  },
  segLabel: {
    color:         colors.textDim,
    fontSize:      11,
    fontWeight:    FontWeight.medium,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom:  4,
  },
  segDur: {
    color:      colors.text,
    fontSize:   FontSize.md,
    fontWeight: FontWeight.bold,
  },
  segPace: {
    color:     colors.textMuted,
    fontSize:  FontSize.sm,
    marginTop: 2,
  },
  progressionRow: {
    marginTop:       spacing.lg,
    paddingTop:      spacing.md,
    borderTopWidth:  1,
    borderTopColor:  colors.border,
  },
  progressionText: {
    color:    colors.primary,
    fontSize: FontSize.sm,
  },
  });
}
