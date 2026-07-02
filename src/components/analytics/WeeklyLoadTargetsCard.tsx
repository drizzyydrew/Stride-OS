import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import Card from '../ui/Card';
import { useThemeColors, zoneTint, type ThemeColors } from '../../theme/ThemeContext';
import { spacing } from '../../theme/spacing';
import { FontSize, FontWeight, Radius } from '../../theme/tokens';
import type { WeeklyLoadTargets, IntensityTargets } from '../../types/periodization';
import type { TrainingPhase } from '../../types/training';

type Props = {
  targets:       WeeklyLoadTargets;
  trainingPhase: TrainingPhase;
  currentMiles:  number;   // athlete's actual weekly mileage (to show vs. target)
};

// ─── Mileage range strip ───────────────────────────────────────────────────────

function MileageRange({
  minMiles,
  targetMiles,
  maxMiles,
  currentMiles,
}: {
  minMiles:     number;
  targetMiles:  number;
  maxMiles:     number;
  currentMiles: number;
}) {
  const colors = useThemeColors();
  const mr     = useMemo(() => createMrStyles(colors), [colors]);

  // Normalize current vs. max for the indicator bar.
  const fraction = maxMiles > 0 ? Math.min(currentMiles / maxMiles, 1) : 0;
  const inRange  = currentMiles >= minMiles && currentMiles <= maxMiles;
  const overMax  = currentMiles > maxMiles;
  const dotColor = overMax ? colors.critical : inRange ? colors.positive : colors.warning;

  return (
    <View style={mr.wrap}>
      {/* Three labels */}
      <View style={mr.labelRow}>
        <Text style={mr.label}>MIN</Text>
        <Text style={[mr.label, { color: colors.primary }]}>TARGET</Text>
        <Text style={mr.label}>MAX</Text>
      </View>
      <View style={mr.valueRow}>
        <Text style={mr.value}>{minMiles}</Text>
        <Text style={[mr.value, { color: colors.primary, fontSize: FontSize.lg }]}>{targetMiles}</Text>
        <Text style={mr.value}>{maxMiles}</Text>
      </View>
      <Text style={mr.unit}>miles / week</Text>

      {/* Current mileage progress indicator */}
      <View style={mr.barBg}>
        <View style={[mr.barFill, { flex: fraction, backgroundColor: dotColor }]} />
        <View style={{ flex: 1 - fraction }} />
      </View>
      <View style={mr.currentRow}>
        <View style={[mr.currentDot, { backgroundColor: dotColor }]} />
        <Text style={[mr.currentLabel, { color: dotColor }]}>
          Current: {currentMiles} mi
          {inRange ? '  ✓ in range' : overMax ? '  ↑ over target' : '  below target'}
        </Text>
      </View>
    </View>
  );
}

function createMrStyles(colors: ThemeColors) {
  return StyleSheet.create({
  wrap: {
    gap: spacing.xs,
  },
  labelRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
  },
  label: {
    color:         colors.textMuted,
    fontSize:      9,
    fontWeight:    FontWeight.black,
    letterSpacing: 0.5,
  },
  valueRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'baseline',
  },
  value: {
    color:      colors.text,
    fontSize:   FontSize.base,
    fontWeight: FontWeight.black,
  },
  unit: {
    color:    colors.textSubtle,
    fontSize: 9,
    textAlign: 'center',
    marginTop: -4,
  },
  barBg: {
    flexDirection: 'row',
    height:        6,
    borderRadius:  3,
    backgroundColor: colors.border,
    overflow:      'hidden',
    marginTop:     spacing.xs,
  },
  barFill: {
    borderRadius: 3,
  },
  currentRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.xs,
  },
  currentDot: {
    width:        5,
    height:       5,
    borderRadius: 3,
  },
  currentLabel: {
    fontSize:   FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  });
}

// ─── Long run target ──────────────────────────────────────────────────────────

function LongRunRange({
  minMiles,
  targetMiles,
  maxMiles,
  pctOfWeekly,
}: {
  minMiles:    number;
  targetMiles: number;
  maxMiles:    number;
  pctOfWeekly: number;
}) {
  const colors = useThemeColors();
  const lr     = useMemo(() => createLrStyles(colors), [colors]);

  return (
    <View style={lr.wrap}>
      <View style={lr.header}>
        <Text style={lr.sectionLabel}>LONG RUN TARGET</Text>
        <Text style={lr.pct}>{Math.round(pctOfWeekly * 100)}% of weekly</Text>
      </View>
      <View style={lr.row}>
        <View style={lr.stat}>
          <Text style={lr.statValue}>{minMiles}</Text>
          <Text style={lr.statLabel}>MIN</Text>
        </View>
        <View style={lr.divider} />
        <View style={lr.stat}>
          <Text style={[lr.statValue, { color: colors.primary, fontSize: FontSize.lg }]}>{targetMiles}</Text>
          <Text style={lr.statLabel}>TARGET</Text>
        </View>
        <View style={lr.divider} />
        <View style={lr.stat}>
          <Text style={lr.statValue}>{maxMiles}</Text>
          <Text style={lr.statLabel}>MAX</Text>
        </View>
        <Text style={lr.unit}>mi</Text>
      </View>
    </View>
  );
}

function createLrStyles(colors: ThemeColors) {
  return StyleSheet.create({
  wrap: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop:     spacing.md,
    gap:            spacing.sm,
  },
  header: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
  },
  sectionLabel: {
    color:         colors.textMuted,
    fontSize:      9,
    fontWeight:    FontWeight.black,
    letterSpacing: 0.6,
  },
  pct: {
    color:    colors.textDim,
    fontSize: FontSize.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.sm,
  },
  stat: {
    flex:       1,
    alignItems: 'center',
    gap:        2,
  },
  statValue: {
    color:      colors.text,
    fontSize:   FontSize.base,
    fontWeight: FontWeight.black,
  },
  statLabel: {
    color:         colors.textMuted,
    fontSize:      8,
    fontWeight:    FontWeight.black,
    letterSpacing: 0.5,
  },
  divider: {
    width:           1,
    height:          32,
    backgroundColor: colors.border,
  },
  unit: {
    color:    colors.textSubtle,
    fontSize: FontSize.sm,
    width:    16,
  },
  });
}

// ─── Intensity distribution targets ───────────────────────────────────────────

const INTENSITY_ORDER: (keyof IntensityTargets)[] = ['easy', 'moderate', 'hard'];

function intensityColor(key: keyof IntensityTargets, colors: ThemeColors): string {
  return zoneTint(colors, INTENSITY_ORDER.indexOf(key), INTENSITY_ORDER.length);
}

const INTENSITY_LABELS = {
  easy:     'EASY',
  moderate: 'MOD',
  hard:     'HARD',
} as const;

function IntensityDistributionTarget({ targets }: { targets: IntensityTargets }) {
  const colors = useThemeColors();
  const id     = useMemo(() => createIdStyles(colors), [colors]);

  const items = (
    [
      ['easy',     targets.easy],
      ['moderate', targets.moderate],
      ['hard',     targets.hard],
    ] as [keyof IntensityTargets, number][]
  ).filter(([, v]) => v > 0);

  return (
    <View style={id.wrap}>
      <Text style={id.sectionLabel}>TARGET INTENSITY DISTRIBUTION</Text>

      {/* Proportional bar */}
      <View style={id.bar}>
        {items.map(([key, frac]) => (
          <View
            key={key}
            style={[id.barSegment, { flex: frac, backgroundColor: intensityColor(key, colors) }]}
          />
        ))}
      </View>

      {/* Labels */}
      <View style={id.labelRow}>
        {items.map(([key, frac]) => (
          <View key={key} style={[id.labelItem, { flex: frac }]}>
            <Text style={[id.labelPct, { color: intensityColor(key, colors) }]}>
              {Math.round(frac * 100)}%
            </Text>
            <Text style={id.labelName}>{INTENSITY_LABELS[key]}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function createIdStyles(colors: ThemeColors) {
  return StyleSheet.create({
  wrap: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop:     spacing.md,
    gap:            spacing.sm,
  },
  sectionLabel: {
    color:         colors.textMuted,
    fontSize:      9,
    fontWeight:    FontWeight.black,
    letterSpacing: 0.6,
  },
  bar: {
    flexDirection: 'row',
    height:        8,
    borderRadius:  4,
    overflow:      'hidden',
    gap:           1,
  },
  barSegment: {
    height: 8,
  },
  labelRow: {
    flexDirection: 'row',
  },
  labelItem: {
    alignItems: 'center',
    gap:        2,
  },
  labelPct: {
    fontSize:   FontSize.sm,
    fontWeight: FontWeight.black,
  },
  labelName: {
    color:         colors.textSubtle,
    fontSize:      8,
    fontWeight:    FontWeight.black,
    letterSpacing: 0.4,
  },
  });
}

// ─── Adaptive ceiling badge ───────────────────────────────────────────────────

function CeilingBadge({ ceiling, reason }: { ceiling: number; reason?: string }) {
  const colors = useThemeColors();
  const cb     = useMemo(() => createCbStyles(colors), [colors]);

  if (ceiling >= 1.0) return null;

  const pct   = Math.round(ceiling * 100);
  const color = ceiling < 0.75 ? colors.critical : ceiling < 0.88 ? colors.warning : colors.primary;
  const bg    = ceiling < 0.75 ? colors.criticalDim : ceiling < 0.88 ? colors.warningDim : colors.primaryDim;

  return (
    <View style={[cb.wrap, { backgroundColor: bg, borderColor: color + '40' }]}>
      <View style={[cb.dot, { backgroundColor: color }]} />
      <View style={cb.content}>
        <Text style={[cb.title, { color }]}>Adaptive Ceiling: {pct}%</Text>
        {reason && <Text style={cb.reason}>{reason}</Text>}
      </View>
    </View>
  );
}

function createCbStyles(colors: ThemeColors) {
  return StyleSheet.create({
  wrap: {
    flexDirection:  'row',
    alignItems:     'flex-start',
    gap:            spacing.sm,
    borderWidth:    1,
    borderRadius:   Radius.sm,
    padding:        spacing.md,
    marginTop:      spacing.sm,
  },
  dot: {
    width:        8,
    height:       8,
    borderRadius: 4,
    marginTop:    2,
    flexShrink:   0,
  },
  content: {
    flex: 1,
    gap:  2,
  },
  title: {
    fontSize:   FontSize.sm,
    fontWeight: FontWeight.black,
  },
  reason: {
    color:    colors.textDim,
    fontSize: FontSize.sm,
  },
  });
}

// ─── Load range strip ─────────────────────────────────────────────────────────

function LoadRange({ min, max }: { min: number; max: number }) {
  const colors = useThemeColors();
  const lo     = useMemo(() => createLoStyles(colors), [colors]);

  return (
    <View style={lo.wrap}>
      <Text style={lo.label}>TARGET TSS RANGE</Text>
      <Text style={lo.value}>{min} – {max}</Text>
    </View>
  );
}

function createLoStyles(colors: ThemeColors) {
  return StyleSheet.create({
  wrap: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop:     spacing.md,
  },
  label: {
    color:         colors.textMuted,
    fontSize:      9,
    fontWeight:    FontWeight.black,
    letterSpacing: 0.6,
  },
  value: {
    color:      colors.text,
    fontSize:   FontSize.sm,
    fontWeight: FontWeight.black,
  },
  });
}

// ─── Main card ─────────────────────────────────────────────────────────────────

const PHASE_LABEL_MAP: Record<TrainingPhase, string> = {
  base:   'Base Phase Targets',
  build:  'Build Phase Targets',
  peak:   'Peak Phase Targets',
  deload: 'Deload Week Targets',
  taper:  'Taper Week Targets',
};

export default function WeeklyLoadTargetsCard({ targets, trainingPhase, currentMiles }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Card>
      {/* Header */}
      <View style={styles.headerRow}>
        <Text style={styles.sectionLabel}>WEEKLY TARGETS</Text>
        <Text style={styles.phaseLabel}>{PHASE_LABEL_MAP[trainingPhase]}</Text>
      </View>

      {/* Adaptive ceiling — shown first if active */}
      <CeilingBadge ceiling={targets.adaptiveCeiling} reason={targets.ceilingReason} />

      {/* Mileage range */}
      <View style={{ marginTop: targets.adaptiveCeiling < 1 ? spacing.md : 0 }}>
        <MileageRange
          minMiles={targets.minMiles}
          targetMiles={targets.targetMiles}
          maxMiles={targets.maxMiles}
          currentMiles={currentMiles}
        />
      </View>

      {/* Long run target */}
      <LongRunRange
        minMiles={targets.longRun.minMiles}
        targetMiles={targets.longRun.targetMiles}
        maxMiles={targets.longRun.maxMiles}
        pctOfWeekly={targets.longRun.pctOfWeekly}
      />

      {/* Intensity distribution */}
      <IntensityDistributionTarget targets={targets.intensity} />

      {/* TSS range */}
      <LoadRange min={targets.targetLoadRange[0]} max={targets.targetLoadRange[1]} />
    </Card>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  headerRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    marginBottom:   spacing.lg,
  },
  sectionLabel: {
    color:         colors.textMuted,
    fontSize:      11,
    fontWeight:    FontWeight.medium,
    letterSpacing: 0.6,
  },
  phaseLabel: {
    color:      colors.textDim,
    fontSize:   FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  });
}
