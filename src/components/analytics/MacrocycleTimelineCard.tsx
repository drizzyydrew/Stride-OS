import { ScrollView, StyleSheet, Text, View } from 'react-native';

import Card from '../ui/Card';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { FontSize, FontWeight, Radius } from '../../theme/tokens';
import type { TrainingPhase, RaceDistance } from '../../types/training';
import type { PhaseBlock } from '../../types/training';
import type { MesocyclePosition } from '../../types/periodization';

type Props = {
  currentWeek:  number;
  totalWeeks:   number;
  planPhases:   PhaseBlock[];
  raceDistance: RaceDistance;
  mesocycle:    MesocyclePosition;
};

// ─── Visual config ─────────────────────────────────────────────────────────────

const PHASE_COLOR: Record<TrainingPhase, string> = {
  base:   '#2563EB',
  build:  '#7C3AED',
  peak:   '#9333EA',
  deload: '#F59E0B',
  taper:  '#22C55E',
};

const PHASE_BG: Record<TrainingPhase, string> = {
  base:   '#0C1A3D',
  build:  '#1E0A4A',
  peak:   '#3B0764',
  deload: '#451A03',
  taper:  '#052E16',
};

const PHASE_LABEL: Record<TrainingPhase, string> = {
  base:   'BASE',
  build:  'BUILD',
  peak:   'PEAK',
  deload: 'DLD',
  taper:  'TAPER',
};

// ─── Resolve phase for a given week ───────────────────────────────────────────

function resolveWeekPhase(week: number, planPhases: PhaseBlock[]): TrainingPhase {
  if (week % 4 === 0) {
    const gross = planPhases.find(b => week >= b.startWeek && week <= b.endWeek)?.phase;
    if (gross !== 'taper') return 'deload';
  }
  return planPhases.find(b => week >= b.startWeek && week <= b.endWeek)?.phase ?? 'base';
}

// ─── Week cell ────────────────────────────────────────────────────────────────

function WeekCell({
  week,
  phase,
  isCurrent,
  isDeloadBoundary,
}: {
  week:             number;
  phase:            TrainingPhase;
  isCurrent:        boolean;
  isDeloadBoundary: boolean;
}) {
  const color = PHASE_COLOR[phase];
  const bg    = PHASE_BG[phase];

  return (
    <View style={[
      cell.wrap,
      { backgroundColor: bg },
      isCurrent && { borderColor: color, borderWidth: 2 },
      isDeloadBoundary && cell.deloadLeft,
    ]}>
      <Text style={[cell.num, { color: isCurrent ? color : colors.textDim }]}>
        {week}
      </Text>
      {isCurrent && <View style={[cell.dot, { backgroundColor: color }]} />}
    </View>
  );
}

const cell = StyleSheet.create({
  wrap: {
    width:          28,
    height:         36,
    borderRadius:   Radius.sm,
    alignItems:     'center',
    justifyContent: 'center',
    gap:            2,
  },
  deloadLeft: {
    borderLeftWidth:  1,
    borderLeftColor:  colors.border,
  },
  num: {
    fontSize:   9,
    fontWeight: FontWeight.black,
  },
  dot: {
    width:        4,
    height:       4,
    borderRadius: 2,
  },
});

// ─── Phase label group ────────────────────────────────────────────────────────

function PhaseGroup({ phase, startWeek, endWeek, totalWeeks }: {
  phase:      TrainingPhase;
  startWeek:  number;
  endWeek:    number;
  totalWeeks: number;
}) {
  const color     = PHASE_COLOR[phase];
  const weekCount = endWeek - startWeek + 1;
  const pct       = `${Math.round((weekCount / totalWeeks) * 100)}%`;

  return (
    <View style={[pg.wrap, { flex: weekCount }]}>
      <View style={[pg.bar, { backgroundColor: color }]} />
      <Text style={[pg.label, { color }]}>{PHASE_LABEL[phase]}</Text>
      <Text style={pg.weeks}>{weekCount}w · {pct}</Text>
    </View>
  );
}

const pg = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap:        spacing.xs,
  },
  bar: {
    height:       2,
    alignSelf:    'stretch',
    borderRadius: 1,
  },
  label: {
    fontSize:      8,
    fontWeight:    FontWeight.black,
    letterSpacing: 0.5,
  },
  weeks: {
    color:    colors.textSubtle,
    fontSize: 8,
  },
});

// ─── Race distance label ───────────────────────────────────────────────────────

const DISTANCE_LABEL: Record<RaceDistance, string> = {
  marathon:      'Marathon',
  half_marathon: 'Half Marathon',
  '10k':         '10K',
  '5k':          '5K',
};

// ─── Main card ─────────────────────────────────────────────────────────────────

export default function MacrocycleTimelineCard({
  currentWeek,
  totalWeeks,
  planPhases,
  raceDistance,
  mesocycle,
}: Props) {
  const weeks = Array.from({ length: totalWeeks }, (_, i) => i + 1);

  return (
    <Card>
      {/* Header */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.sectionLabel}>MACROCYCLE PLAN</Text>
          <Text style={styles.title}>{DISTANCE_LABEL[raceDistance]} · {totalWeeks} Weeks</Text>
        </View>
        <View style={styles.blockBadge}>
          <Text style={styles.blockText}>BLOCK {mesocycle.blockNumber}</Text>
          <Text style={styles.blockSub}>WK {mesocycle.weekInBlock}/4</Text>
        </View>
      </View>

      {/* Phase label strip */}
      <View style={styles.phaseStrip}>
        {planPhases.map(pb => (
          <PhaseGroup
            key={pb.phase}
            phase={pb.phase}
            startWeek={pb.startWeek}
            endWeek={pb.endWeek}
            totalWeeks={totalWeeks}
          />
        ))}
        {/* Race end marker */}
        <View style={styles.raceMarker}>
          <View style={[styles.raceBar, { backgroundColor: colors.positive }]} />
          <Text style={[styles.raceLabel, { color: colors.positive }]}>RACE</Text>
        </View>
      </View>

      {/* Week cell strip (scrollable) */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.weekStrip}
      >
        {weeks.map(week => {
          const phase = resolveWeekPhase(week, planPhases);
          return (
            <WeekCell
              key={week}
              week={week}
              phase={phase}
              isCurrent={week === currentWeek}
              isDeloadBoundary={week % 4 === 1 && week > 1}
            />
          );
        })}
        {/* Race day pill */}
        <View style={styles.raceEnd}>
          <Text style={styles.raceEndText}>🏁</Text>
        </View>
      </ScrollView>

      {/* Mesocycle oscillation legend */}
      <View style={styles.oscRow}>
        <Text style={styles.oscLabel}>BLOCK OSCILLATION</Text>
        <View style={styles.oscBars}>
          {(['W1 90%', 'W2 95%', 'W3 100%', 'W4 65%'] as const).map((label, i) => {
            const isActive = mesocycle.weekInBlock === i + 1;
            return (
              <View key={i} style={[styles.oscItem, isActive && styles.oscActive]}>
                <Text style={[styles.oscItemText, isActive && { color: colors.primary }]}>
                  {label}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* Phase legend */}
      <View style={styles.legendRow}>
        {planPhases.map(pb => (
          <View key={pb.phase} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: PHASE_COLOR[pb.phase] }]} />
            <Text style={styles.legendText}>{PHASE_LABEL[pb.phase]}</Text>
          </View>
        ))}
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: PHASE_COLOR.deload }]} />
          <Text style={styles.legendText}>DLD</Text>
        </View>
      </View>
    </Card>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  headerRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'flex-start',
    marginBottom:   spacing.lg,
  },
  sectionLabel: {
    color:         colors.textMuted,
    fontSize:      11,
    fontWeight:    FontWeight.medium,
    letterSpacing: 0.6,
    marginBottom:  4,
  },
  title: {
    color:      colors.text,
    fontSize:   FontSize.base,
    fontWeight: FontWeight.black,
  },
  blockBadge: {
    backgroundColor: colors.primaryDim,
    borderRadius:    Radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.xs,
    alignItems:      'center',
  },
  blockText: {
    color:         colors.primary,
    fontSize:      10,
    fontWeight:    FontWeight.black,
    letterSpacing: 0.6,
  },
  blockSub: {
    color:    colors.textDim,
    fontSize: 9,
  },
  phaseStrip: {
    flexDirection: 'row',
    marginBottom:  spacing.sm,
    alignItems:    'flex-end',
  },
  raceMarker: {
    width:      20,
    alignItems: 'center',
    gap:        spacing.xs,
  },
  raceBar: {
    height:       2,
    alignSelf:    'stretch',
    borderRadius: 1,
  },
  raceLabel: {
    fontSize:      7,
    fontWeight:    FontWeight.black,
    letterSpacing: 0.3,
  },
  weekStrip: {
    flexDirection: 'row',
    gap:           3,
    paddingBottom: spacing.sm,
  },
  raceEnd: {
    width:          28,
    height:         36,
    alignItems:     'center',
    justifyContent: 'center',
  },
  raceEndText: {
    fontSize: 14,
  },
  oscRow: {
    borderTopWidth:  1,
    borderTopColor:  colors.border,
    paddingTop:      spacing.md,
    marginTop:       spacing.sm,
    gap:             spacing.sm,
  },
  oscLabel: {
    color:         colors.textMuted,
    fontSize:      9,
    fontWeight:    FontWeight.black,
    letterSpacing: 0.6,
  },
  oscBars: {
    flexDirection: 'row',
    gap:           spacing.xs,
  },
  oscItem: {
    flex:            1,
    backgroundColor: colors.border,
    borderRadius:    Radius.sm,
    paddingVertical: spacing.xs,
    alignItems:      'center',
  },
  oscActive: {
    backgroundColor: colors.primaryDim,
  },
  oscItemText: {
    color:      colors.textDim,
    fontSize:   9,
    fontWeight: FontWeight.black,
  },
  legendRow: {
    flexDirection: 'row',
    gap:           spacing.md,
    marginTop:     spacing.sm,
    flexWrap:      'wrap',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.xs,
  },
  legendDot: {
    width:        6,
    height:       6,
    borderRadius: 3,
  },
  legendText: {
    color:    colors.textDim,
    fontSize: 9,
  },
});
