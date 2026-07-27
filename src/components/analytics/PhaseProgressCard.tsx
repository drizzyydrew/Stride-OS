import { StyleSheet, Text, View } from 'react-native';

import Card from '../ui/Card';
import Badge from '../ui/Badge';
import ProgressBar from '../ui/ProgressBar';
import StatRow from '../ui/StatRow';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { FontSize, FontWeight } from '../../theme/tokens';
import type { TrainingPhase } from '../../types/training';

type Props = {
  phase:          TrainingPhase;
  planProgress:   number;
  currentWeek:    number;
  totalWeeks:     number;
  weeksRemaining: number;
};

type PhaseMeta = { label: string; bg: string; text: string; barColor: string };

function getPhaseMeta(phase: TrainingPhase): PhaseMeta {
  const phaseColor = getPhaseColor(phase);
  return {
    label: phase === 'deload' ? 'Deload' : phase[0].toUpperCase() + phase.slice(1),
    bg: phaseColor.bg,
    text: phaseColor.text,
    barColor: phaseColor.accent,
  };
}

function getPhaseColor(phase: TrainingPhase) {
  switch (phase) {
    case 'foundation':
      return { accent: colors.chartSeriesPrimary, bg: colors.primaryDim, text: colors.primary };
    case 'base':
      return { accent: colors.chartSeriesPrimary, bg: colors.primaryDim, text: colors.primary };
    case 'aerobic_development':
      return { accent: colors.chartSeriesPrimary, bg: colors.primaryDim, text: colors.primary };
    case 'threshold':
    case 'vo2':
    case 'race_specific':
      return { accent: colors.chartSeriesSecondary, bg: colors.accentDim, text: colors.accent };
    case 'build':
      return { accent: colors.chartSeriesSecondary, bg: colors.accentDim, text: colors.accent };
    case 'peak':
      return { accent: colors.warning, bg: colors.warningDim, text: colors.warning };
    case 'deload':
      return { accent: colors.positive, bg: colors.positiveDim, text: colors.positive };
    case 'taper':
      return { accent: colors.critical, bg: colors.criticalDim, text: colors.critical };
    case 'transition':
    case 'recovery':
      return { accent: colors.positive, bg: colors.positiveDim, text: colors.positive };
  }
}

export default function PhaseProgressCard({
  phase,
  planProgress,
  currentWeek,
  totalWeeks,
  weeksRemaining,
}: Props) {
  const meta       = getPhaseMeta(phase);
  const progressPct = Math.round(Math.min(1, Math.max(0, planProgress)) * 100);

  return (
    <Card>
      <View style={styles.headerRow}>
        <Badge label={meta.label} bg={meta.bg} color={meta.text} />
        <Text style={styles.weekCount}>Week {currentWeek} / {totalWeeks}</Text>
      </View>

      <ProgressBar
        progress={planProgress}
        color={meta.barColor}
        style={{ marginBottom: spacing.md }}
      />

      <StatRow
        label={`${progressPct}% complete`}
        value={`${weeksRemaining} weeks to race`}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    marginBottom:   spacing.lg + 2,
  },
  weekCount: {
    color:      colors.text,
    fontSize:   FontSize.md,
    fontWeight: FontWeight.bold,
  },
});
