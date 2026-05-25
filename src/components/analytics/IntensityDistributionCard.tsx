import { StyleSheet, Text, View } from 'react-native';

import Card from '../ui/Card';
import { colors } from '../../theme/colors';
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

const INTENSITY_META: Record<WorkoutIntensity, { label: string; color: string }> = {
  very_easy: { label: 'Very Easy', color: '#4ADE80' },
  easy:      { label: 'Easy',      color: '#60A5FA' },
  moderate:  { label: 'Moderate',  color: '#C084FC' },
  hard:      { label: 'Hard',      color: '#F87171' },
  max:       { label: 'Max',       color: '#FCA5A5' },
  rest:      { label: 'Rest',      color: '#5F6B7A' },
};

export default function IntensityDistributionCard({ distribution }: Props) {
  const { byIntensity, totalCount } = distribution;
  const active = INTENSITY_ORDER.filter(i => (byIntensity[i] ?? 0) > 0);

  return (
    <Card>
      <Text style={styles.title}>Intensity Distribution</Text>
      <Text style={styles.subtitle}>Last 30 days</Text>

      {totalCount === 0 ? (
        <Text style={styles.empty}>
          Complete workouts to see your training distribution.
        </Text>
      ) : (
        active.map(intensity => {
          const count = byIntensity[intensity] ?? 0;
          const pct   = Math.round((count / totalCount) * 100);
          const meta  = INTENSITY_META[intensity];
          // Flex-ratio bar: colored child fills count/totalCount of the track.
          // The remaining flex shows the track's background — no percentage widths needed.
          const emptyFlex = Math.max(0, totalCount - count);

          return (
            <View key={intensity} style={styles.row}>
              <Text style={styles.intensityLabel}>{meta.label}</Text>
              <View style={styles.barTrack}>
                <View
                  style={{
                    flex:            count,
                    height:          8,
                    backgroundColor: meta.color,
                    borderRadius:    Radius.sm,
                  }}
                />
                {emptyFlex > 0 ? <View style={{ flex: emptyFlex }} /> : null}
              </View>
              <Text style={styles.pct}>{pct}%</Text>
              <Text style={styles.count}>{count}</Text>
            </View>
          );
        })
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
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
