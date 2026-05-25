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

const PHASE_META: Record<TrainingPhase, PhaseMeta> = {
  base:   { label: 'Base',   bg: '#0C2340', text: '#60A5FA', barColor: '#2563EB' },
  build:  { label: 'Build',  bg: '#1E3A8A', text: '#93C5FD', barColor: '#3B82F6' },
  peak:   { label: 'Peak',   bg: '#3B0764', text: '#C084FC', barColor: '#9333EA' },
  deload: { label: 'Deload', bg: '#451A03', text: '#FCD34D', barColor: '#F59E0B' },
  taper:  { label: 'Taper',  bg: '#052E16', text: '#4ADE80', barColor: '#22C55E' },
};

export default function PhaseProgressCard({
  phase,
  planProgress,
  currentWeek,
  totalWeeks,
  weeksRemaining,
}: Props) {
  const meta       = PHASE_META[phase];
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
