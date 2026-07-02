import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import Card from '../ui/Card';
import Badge from '../ui/Badge';
import ProgressBar from '../ui/ProgressBar';
import StatRow from '../ui/StatRow';
import { useThemeColors, zoneTint, type ThemeColors } from '../../theme/ThemeContext';
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

// Phases never get a rainbow of hues (§3.7, §3.9) — a single Sage accent at
// increasing opacity per phase communicates progression through the macrocycle.
const PHASE_TINT_ORDER: TrainingPhase[] = ['base', 'build', 'peak', 'deload', 'taper'];
const PHASE_LABELS: Record<TrainingPhase, string> = {
  base:   'Base',
  build:  'Build',
  peak:   'Peak',
  deload: 'Deload',
  taper:  'Taper',
};

function phaseMeta(phase: TrainingPhase, colors: ThemeColors): PhaseMeta {
  const idx   = PHASE_TINT_ORDER.indexOf(phase);
  const text  = zoneTint(colors, idx, PHASE_TINT_ORDER.length);
  const steps = Math.max(PHASE_TINT_ORDER.length - 1, 1);
  const t     = Math.min(Math.max(idx / steps, 0), 1);
  const alpha = 0.10 + t * 0.18; // 10%..28%
  const hex   = Math.round(alpha * 255).toString(16).padStart(2, '0').toUpperCase();
  return { label: PHASE_LABELS[phase], bg: `${colors.sage}${hex}`, text, barColor: text };
}

export default function PhaseProgressCard({
  phase,
  planProgress,
  currentWeek,
  totalWeeks,
  weeksRemaining,
}: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const meta       = phaseMeta(phase, colors);
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

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
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
}
