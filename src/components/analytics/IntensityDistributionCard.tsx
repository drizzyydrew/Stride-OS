import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import Card from '../ui/Card';
import { useThemeColors, zoneTint, type ThemeColors } from '../../theme/ThemeContext';
import { spacing } from '../../theme/spacing';
import { FontSize, FontWeight, Radius } from '../../theme/tokens';
import type { TrainingDistribution } from '../../types/history';
import type { WorkoutIntensity } from '../../types/training';

type Props = {
  distribution: TrainingDistribution;
};

// Display order: easy → hard spectrum, rest at end (it's not a training intensity)
const INTENSITY_ORDER: WorkoutIntensity[] = [
  'very_easy', 'easy', 'moderate', 'hard', 'max', 'rest',
];

// Intensity spectrum (excluding 'rest', which is not a training intensity)
// gets a single Sage accent at increasing opacity — never a rainbow (§3.7, §3.9).
const INTENSITY_TINT_ORDER: WorkoutIntensity[] = ['very_easy', 'easy', 'moderate', 'hard', 'max'];

const INTENSITY_LABEL: Record<WorkoutIntensity, string> = {
  very_easy: 'Very Easy',
  easy:      'Easy',
  moderate:  'Moderate',
  hard:      'Hard',
  max:       'Max',
  rest:      'Rest',
};

function intensityColor(intensity: WorkoutIntensity, colors: ThemeColors): string {
  if (intensity === 'rest') return colors.textDim;
  const idx = INTENSITY_TINT_ORDER.indexOf(intensity);
  return zoneTint(colors, idx, INTENSITY_TINT_ORDER.length);
}

export default function IntensityDistributionCard({ distribution }: Props) {
  const colors = useThemeColors();
  const s      = useMemo(() => createStyles(colors), [colors]);

  const { byIntensity, totalCount } = distribution;
  const active = INTENSITY_ORDER.filter(i => (byIntensity[i] ?? 0) > 0);

  return (
    <Card>
      <Text style={s.title}>Intensity Distribution</Text>
      <Text style={s.subtitle}>Last 30 days</Text>

      {totalCount === 0 ? (
        <Text style={s.empty}>
          Complete workouts to see your training distribution.
        </Text>
      ) : (
        active.map(intensity => {
          const count = byIntensity[intensity] ?? 0;
          const pct   = Math.round((count / totalCount) * 100);
          const label = INTENSITY_LABEL[intensity];
          const color = intensityColor(intensity, colors);
          // Flex-ratio bar: colored child fills count/totalCount of the track.
          // The remaining flex shows the track's background — no percentage widths needed.
          const emptyFlex = Math.max(0, totalCount - count);

          return (
            <View key={intensity} style={s.row}>
              <Text style={s.intensityLabel}>{label}</Text>
              <View style={s.barTrack}>
                <View
                  style={{
                    flex:            count,
                    height:          8,
                    backgroundColor: color,
                    borderRadius:    Radius.sm,
                  }}
                />
                {emptyFlex > 0 ? <View style={{ flex: emptyFlex }} /> : null}
              </View>
              <Text style={s.pct}>{pct}%</Text>
              <Text style={s.count}>{count}</Text>
            </View>
          );
        })
      )}
    </Card>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  title: {
    color:         colors.textMuted,
    fontSize:      FontSize.base,
    fontWeight:    FontWeight.medium,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom:  4,
  },
  subtitle: {
    color:        colors.textDim,
    fontSize:     FontSize.xs,
    marginBottom: spacing.xl,
  },
  empty: {
    color:      colors.textDim,
    fontSize:   FontSize.sm,
    lineHeight: 18,
  },
  row: {
    flexDirection: 'row',
    alignItems:    'center',
    marginBottom:  spacing.md,
  },
  intensityLabel: {
    width:      76,
    color:      colors.textMuted,
    fontSize:   FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  barTrack: {
    flex:            1,
    flexDirection:   'row',
    height:          8,
    backgroundColor: colors.border,
    borderRadius:    Radius.sm,
    overflow:        'hidden',
    marginHorizontal: spacing.md,
  },
  pct: {
    width:      34,
    color:      colors.textDim,
    fontSize:   FontSize.xs,
    fontWeight: FontWeight.medium,
    textAlign:  'right',
  },
  count: {
    width:     24,
    color:     colors.textSubtle,
    fontSize:  FontSize.xs,
    textAlign: 'right',
  },
  });
}
