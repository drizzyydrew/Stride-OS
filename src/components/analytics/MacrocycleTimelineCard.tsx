import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import Card from '../ui/Card';
import { colors }  from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { FontSize, FontWeight, Radius } from '../../theme/tokens';
import type { TrainingPhase, RaceDistance } from '../../types/training';
import type { PhaseBlock }         from '../../types/training';
import type { MesocyclePosition }  from '../../types/periodization';

// ─── Props ─────────────────────────────────────────────────────────────────────

type Props = {
  currentWeek:  number;
  totalWeeks:   number;
  planPhases:   PhaseBlock[];
  raceDistance: RaceDistance;
  mesocycle:    MesocyclePosition;
  baseMileage:  number;   // current weekly mileage from athleteStore
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
  taper:  'TPR',
};

// ─── Key workout by phase ──────────────────────────────────────────────────────

const PHASE_KEY_WORKOUT: Record<TrainingPhase, string> = {
  base:   'Aerobic Base Run',
  build:  'Tempo / Threshold',
  peak:   'VO₂max Intervals',
  deload: 'Recovery Run',
  taper:  'Race-Pace Strides',
};

// ─── Run session counts by phase ──────────────────────────────────────────────

const PHASE_RUN_SESSIONS: Record<TrainingPhase, number> = {
  base:   4,
  build:  5,
  peak:   5,
  deload: 3,
  taper:  4,
};

// ─── Resolve phase for a given week ───────────────────────────────────────────

function resolveWeekPhase(week: number, planPhases: PhaseBlock[]): TrainingPhase {
  if (week % 4 === 0) {
    const gross = planPhases.find(b => week >= b.startWeek && week <= b.endWeek)?.phase;
    if (gross !== 'taper') return 'deload';
  }
  return planPhases.find(b => week >= b.startWeek && week <= b.endWeek)?.phase ?? 'base';
}

// ─── Week detail computation ──────────────────────────────────────────────────

type WeekDetail = {
  week:            number;
  phase:           TrainingPhase;
  isDeload:        boolean;
  isTaper:         boolean;
  isRaceWeek:      boolean;
  blockMultiplier: number;
  mileageTarget:   number;
  runSessions:     number;
  strengthSessions: number;
  keyWorkout:      string;
  hasLongRun:      boolean;
  note:            string | null;
};

function computeWeekDetail(
  week:        number,
  planPhases:  PhaseBlock[],
  baseMileage: number,
  totalWeeks:  number,
): WeekDetail {
  const phase        = resolveWeekPhase(week, planPhases);
  const weekInBlock  = ((week - 1) % 4) + 1;
  const multipliers  = [0.90, 0.95, 1.00, 0.65] as const;
  const blockMult    = multipliers[weekInBlock - 1] ?? 1.00;

  const isDeload   = phase === 'deload';
  const isTaper    = phase === 'taper';
  const isRaceWeek = week === totalWeeks;

  const mileageTarget  = Math.round(baseMileage * blockMult * 10) / 10;
  const runSessions    = PHASE_RUN_SESSIONS[phase];
  const strengthSessions = isDeload || isTaper ? 1 : 2;
  const hasLongRun     = !isDeload && !isRaceWeek;

  let note: string | null = null;
  if (isRaceWeek)     note = 'Race week — minimize stress, execute taper.';
  else if (isTaper)   note = 'Volume drops, intensity preserved. Protect freshness.';
  else if (isDeload)  note = 'Planned recovery block. Reduced load for adaptation.';

  return {
    week, phase, isDeload, isTaper, isRaceWeek,
    blockMultiplier: blockMult,
    mileageTarget,
    runSessions,
    strengthSessions,
    keyWorkout: PHASE_KEY_WORKOUT[phase],
    hasLongRun,
    note,
  };
}

// ─── Week cell ────────────────────────────────────────────────────────────────

function WeekCell({
  week,
  phase,
  isCurrent,
  isSelected,
  isDeloadBoundary,
  onPress,
}: {
  week:             number;
  phase:            TrainingPhase;
  isCurrent:        boolean;
  isSelected:       boolean;
  isDeloadBoundary: boolean;
  onPress:          () => void;
}) {
  const color = PHASE_COLOR[phase];
  const bg    = isSelected ? color + '33' : PHASE_BG[phase];

  return (
    <Pressable
      onPress={onPress}
      style={[
        cell.wrap,
        { backgroundColor: bg },
        isCurrent  && { borderColor: color, borderWidth: 2 },
        isSelected && { borderColor: color, borderWidth: 2, borderStyle: 'solid' },
        isDeloadBoundary && cell.deloadLeft,
      ]}
    >
      <Text style={[cell.num, { color: isCurrent || isSelected ? color : colors.textDim }]}>
        {week}
      </Text>
      {isCurrent && <View style={[cell.dot, { backgroundColor: color }]} />}
      {isSelected && !isCurrent && <View style={[cell.dot, { backgroundColor: color, opacity: 0.6 }]} />}
    </Pressable>
  );
}

const cell = StyleSheet.create({
  wrap: {
    width:          34,
    height:         44,
    borderRadius:   Radius.sm,
    alignItems:     'center',
    justifyContent: 'center',
    gap:            3,
  },
  deloadLeft: {
    borderLeftWidth:  1,
    borderLeftColor:  colors.border,
  },
  num: {
    fontSize:   10,
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

  return (
    <View style={[pg.wrap, { flex: weekCount }]}>
      <View style={[pg.bar, { backgroundColor: color }]} />
      <Text style={[pg.label, { color }]}>{PHASE_LABEL[phase]}</Text>
      <Text style={pg.weeks}>{weekCount}w</Text>
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
    textAlign:     'center',
  },
  weeks: {
    color:    colors.textSubtle,
    fontSize: 8,
  },
});

// ─── Week detail panel ─────────────────────────────────────────────────────────

function WeekDetailPanel({ detail }: { detail: WeekDetail }) {
  const color = PHASE_COLOR[detail.phase];
  const bg    = PHASE_BG[detail.phase];

  return (
    <View style={dp.wrap}>
      {/* Week header */}
      <View style={dp.header}>
        <View style={[dp.phaseBadge, { backgroundColor: bg }]}>
          <Text style={[dp.phaseLabel, { color }]}>
            {PHASE_LABEL[detail.phase]}
          </Text>
        </View>
        <Text style={dp.weekTitle}>
          Week {detail.week}
          {detail.isRaceWeek ? ' — Race Day' : detail.isDeload ? ' — Recovery' : detail.isTaper ? ' — Taper' : ''}
        </Text>
        <Text style={[dp.mileage, { color }]}>
          ~{detail.mileageTarget} mi
        </Text>
      </View>

      {/* Note if special week */}
      {detail.note && (
        <Text style={dp.note}>{detail.note}</Text>
      )}

      {/* Stats grid */}
      <View style={dp.grid}>
        <View style={dp.gridItem}>
          <Text style={dp.gridValue}>{detail.runSessions}</Text>
          <Text style={dp.gridLabel}>Runs</Text>
        </View>
        <View style={dp.gridDivider} />
        <View style={dp.gridItem}>
          <Text style={dp.gridValue}>{detail.strengthSessions}</Text>
          <Text style={dp.gridLabel}>Strength</Text>
        </View>
        <View style={dp.gridDivider} />
        <View style={dp.gridItem}>
          <Text style={dp.gridValue}>{detail.hasLongRun ? 'Yes' : 'No'}</Text>
          <Text style={dp.gridLabel}>Long Run</Text>
        </View>
        <View style={dp.gridDivider} />
        <View style={dp.gridItem}>
          <Text style={[dp.gridValue, { color: colors.textDim, fontSize: FontSize.xs }]}>
            {Math.round(detail.blockMultiplier * 100)}%
          </Text>
          <Text style={dp.gridLabel}>Block Load</Text>
        </View>
      </View>

      {/* Key workout */}
      <View style={[dp.keyRow, { borderLeftColor: color }]}>
        <Text style={dp.keyLabel}>KEY WORKOUT</Text>
        <Text style={[dp.keyWorkout, { color }]}>{detail.keyWorkout}</Text>
      </View>
    </View>
  );
}

const dp = StyleSheet.create({
  wrap: {
    marginTop:       spacing.md,
    borderTopWidth:  1,
    borderTopColor:  colors.border,
    paddingTop:      spacing.md,
    gap:             spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.sm,
  },
  phaseBadge: {
    borderRadius:      Radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical:   3,
  },
  phaseLabel: {
    fontSize:      9,
    fontWeight:    FontWeight.black,
    letterSpacing: 0.5,
  },
  weekTitle: {
    color:      colors.text,
    fontSize:   FontSize.sm,
    fontWeight: FontWeight.bold,
    flex:       1,
  },
  mileage: {
    fontSize:   FontSize.md,
    fontWeight: FontWeight.black,
  },
  note: {
    color:      colors.textMuted,
    fontSize:   FontSize.xs,
    lineHeight: 17,
    fontStyle:  'italic',
  },
  grid: {
    flexDirection: 'row',
    alignItems:    'center',
    borderWidth:   1,
    borderColor:   colors.border,
    borderRadius:  Radius.sm,
    paddingVertical: spacing.sm,
  },
  gridItem: {
    flex:       1,
    alignItems: 'center',
    gap:        2,
  },
  gridDivider: {
    width:           1,
    height:          28,
    backgroundColor: colors.border,
  },
  gridValue: {
    color:      colors.text,
    fontSize:   FontSize.base,
    fontWeight: FontWeight.black,
  },
  gridLabel: {
    color:         colors.textMuted,
    fontSize:      8,
    fontWeight:    FontWeight.black,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  keyRow: {
    borderLeftWidth:   3,
    paddingLeft:       spacing.sm,
    gap:               2,
  },
  keyLabel: {
    color:         colors.textMuted,
    fontSize:      8,
    fontWeight:    FontWeight.black,
    letterSpacing: 0.5,
  },
  keyWorkout: {
    fontSize:   FontSize.sm,
    fontWeight: FontWeight.bold,
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
  baseMileage,
}: Props) {
  const [selectedWeek, setSelectedWeek] = useState(currentWeek);

  const weeks      = Array.from({ length: totalWeeks }, (_, i) => i + 1);
  const weekDetail = computeWeekDetail(selectedWeek, planPhases, baseMileage, totalWeeks);

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
              isSelected={week === selectedWeek}
              isDeloadBoundary={week % 4 === 1 && week > 1}
              onPress={() => setSelectedWeek(week)}
            />
          );
        })}
        <View style={styles.raceEnd}>
          <Text style={styles.raceEndText}>🏁</Text>
        </View>
      </ScrollView>

      <Text style={styles.tapHint}>Tap any week to see details</Text>

      {/* Selected week detail panel */}
      <WeekDetailPanel detail={weekDetail} />

      {/* Mesocycle oscillation */}
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
    backgroundColor:  colors.primaryDim,
    borderRadius:     Radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical:  spacing.xs,
    alignItems:       'center',
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
    width:      28,
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
    gap:           4,
    paddingBottom: spacing.xs,
  },
  raceEnd: {
    width:          34,
    height:         44,
    alignItems:     'center',
    justifyContent: 'center',
  },
  raceEndText: {
    fontSize: 16,
  },
  tapHint: {
    color:        colors.textSubtle,
    fontSize:     9,
    textAlign:    'center',
    marginTop:    spacing.xs,
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
    flex:             1,
    backgroundColor:  colors.border,
    borderRadius:     Radius.sm,
    paddingVertical:  spacing.xs,
    alignItems:       'center',
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
