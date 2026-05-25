import { StyleSheet, Text, View } from 'react-native';

import Card from '../ui/Card';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { FontSize, FontWeight, Radius } from '../../theme/tokens';
import type { TimelineAnalysis, WeeklySnapshot } from '../../types/timeline';

type Props = {
  analysis: TimelineAnalysis;
};

// ─── Color helpers ─────────────────────────────────────────────────────────────

function recoveryColor(v: number): string {
  if (v >= 80) return colors.positive;
  if (v >= 65) return '#60A5FA';
  if (v >= 50) return colors.warning;
  return colors.critical;
}

// High fatigue = bad → invert scale so low is green, high is red.
function fatigueColor(v: number): string {
  if (v < 35) return colors.positive;
  if (v < 55) return '#60A5FA';
  if (v < 75) return colors.warning;
  return colors.critical;
}

function acwrColor(v: number): string {
  if (v < 0.8)  return colors.warning;   // under-training
  if (v <= 1.3) return colors.positive;  // optimal
  if (v <= 1.5) return colors.warning;   // elevated risk
  return colors.critical;                // high risk
}

function adherenceColor(v: number): string {
  if (v >= 0.85) return colors.positive;
  if (v >= 0.65) return '#60A5FA';
  if (v >= 0.50) return colors.warning;
  return colors.critical;
}

// ─── Sparkline dot chart ──────────────────────────────────────────────────────
// Pure View/absolute positioning — no SVG required.
// Each column is flex:1 with height CHART_H. A dot sits at absolute `top`
// proportional to the metric's normalized value within the visible range.
// Rolling-average dots are rendered at smaller size with reduced opacity.

const CHART_H   = 60;   // px — chart container height
const DOT_D     = 8;    // main dot diameter
const DOT_AVG   = 5;    // rolling-avg dot diameter
const MAX_WEEKS = 8;    // columns shown

interface SparkProps {
  snapshots:  WeeklySnapshot[];
  getValue:   (s: WeeklySnapshot) => number;
  getRollAvg: number[];           // pre-computed rolling averages
  colorFn:    (v: number) => string;
  invert?:    boolean;            // when true, lower value = higher dot (fatigue row)
}

function SparkLine({ snapshots, getValue, getRollAvg, colorFn, invert = false }: SparkProps) {
  const displaySnaps = snapshots.slice(-MAX_WEEKS);
  const values       = displaySnaps.map(getValue);
  const avgSlice     = getRollAvg.slice(-MAX_WEEKS);

  const allVals = [...values, ...avgSlice].filter(v => !isNaN(v));
  if (allVals.length === 0) return null;

  const minV  = Math.min(...allVals);
  const maxV  = Math.max(...allVals);
  const range = maxV - minV || 1;

  function dotTop(value: number, diameter: number): number {
    // norm: 0 = min value, 1 = max value
    const norm    = (value - minV) / range;
    // position: 1 = top of chart, 0 = bottom
    const pos     = invert ? norm : 1 - norm;
    // top offset from chart container (absolute positioning)
    return Math.max(0, Math.min(CHART_H - diameter, pos * (CHART_H - diameter)));
  }

  return (
    <View style={spark.chartArea}>
      {displaySnaps.map((snap, i) => {
        const v    = getValue(snap);
        const avg  = avgSlice[i];
        const col  = colorFn(v);
        const top  = dotTop(v, DOT_D);
        const aTop = avg != null ? dotTop(avg, DOT_AVG) : null;

        return (
          <View key={snap.week} style={spark.col}>
            {/* Rolling average dot (faint, behind) */}
            {aTop !== null && (
              <View
                style={[
                  spark.dotAvg,
                  { top: aTop, backgroundColor: col },
                ]}
              />
            )}
            {/* Main value dot */}
            <View
              style={[
                spark.dot,
                { top, backgroundColor: col },
              ]}
            />
          </View>
        );
      })}
    </View>
  );
}

const spark = StyleSheet.create({
  chartArea: {
    flexDirection: 'row',
    height:        CHART_H,
    gap:           2,
  },
  col: {
    flex:     1,
    height:   CHART_H,
    position: 'relative',
  },
  dot: {
    position:     'absolute',
    width:        DOT_D,
    height:       DOT_D,
    borderRadius: DOT_D / 2,
    alignSelf:    'center',
  },
  dotAvg: {
    position:     'absolute',
    width:        DOT_AVG,
    height:       DOT_AVG,
    borderRadius: DOT_AVG / 2,
    alignSelf:    'center',
    opacity:      0.35,
  },
});

// ─── Week label row ───────────────────────────────────────────────────────────

function WeekLabels({ snapshots }: { snapshots: WeeklySnapshot[] }) {
  const display = snapshots.slice(-MAX_WEEKS);
  const lastW   = display[display.length - 1]?.week;

  return (
    <View style={wl.row}>
      {display.map(s => (
        <View key={s.week} style={wl.col}>
          <Text style={[wl.label, s.week === lastW && wl.labelActive]}>
            {`W${s.week}`}
          </Text>
        </View>
      ))}
    </View>
  );
}

const wl = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap:           2,
    marginTop:     spacing.xs,
  },
  col: {
    flex:       1,
    alignItems: 'center',
  },
  label: {
    color:      colors.textSubtle,
    fontSize:   8,
    fontWeight: FontWeight.medium,
  },
  labelActive: {
    color: colors.textDim,
  },
});

// ─── Heat cell strip (adherence + ACWR) ──────────────────────────────────────

interface HeatStripProps {
  snapshots:  WeeklySnapshot[];
  getValue:   (s: WeeklySnapshot) => number;
  formatVal:  (v: number) => string;
  colorFn:    (v: number) => string;
  label:      string;
}

function HeatStrip({ snapshots, getValue, formatVal, colorFn, label }: HeatStripProps) {
  const display = snapshots.slice(-MAX_WEEKS);

  return (
    <View style={hs.row}>
      <Text style={hs.rowLabel}>{label}</Text>
      <View style={hs.cells}>
        {display.map((snap) => {
          const v     = getValue(snap);
          const color = colorFn(v);
          return (
            <View key={snap.week} style={[hs.cell, { borderColor: color + '50' }]}>
              <Text style={[hs.cellText, { color }]}>{formatVal(v)}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const hs = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems:    'center',
    marginTop:     spacing.sm,
    gap:           spacing.sm,
  },
  rowLabel: {
    color:         colors.textMuted,
    fontSize:      9,
    fontWeight:    FontWeight.black,
    letterSpacing: 0.5,
    width:         44,
    textTransform: 'uppercase',
  },
  cells: {
    flex:          1,
    flexDirection: 'row',
    gap:           3,
  },
  cell: {
    flex:           1,
    paddingVertical: 3,
    borderRadius:   Radius.sm,
    borderWidth:    1,
    alignItems:     'center',
    justifyContent: 'center',
  },
  cellText: {
    fontSize:   8,
    fontWeight: FontWeight.black,
  },
});

// ─── Trend direction chip ─────────────────────────────────────────────────────

function DirectionChip({ label, direction, color }: {
  label:     string;
  direction: 'improving' | 'worsening' | 'stable';
  color:     string;
}) {
  const arrow = direction === 'improving' ? '↑' : direction === 'worsening' ? '↓' : '→';
  const bg    = direction === 'improving' ? colors.positiveDim :
                direction === 'worsening' ? colors.criticalDim :
                colors.border;
  return (
    <View style={[chip.wrap, { backgroundColor: bg }]}>
      <Text style={[chip.text, { color }]}>{label} {arrow}</Text>
    </View>
  );
}

const chip = StyleSheet.create({
  wrap: {
    paddingHorizontal: 8,
    paddingVertical:   3,
    borderRadius:      Radius.sm,
  },
  text: {
    fontSize:      9,
    fontWeight:    FontWeight.black,
    letterSpacing: 0.5,
  },
});

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyTimeline() {
  return (
    <Card>
      <Text style={empty.label}>READINESS TIMELINE</Text>
      <Text style={empty.title}>Building your trend data</Text>
      <Text style={empty.body}>
        Complete training sessions each week to unlock longitudinal trend charts,
        rolling averages, spike detection, and pattern analysis.
      </Text>
      <View style={empty.steps}>
        {['Week 1 — first snapshot', 'Week 2 — trend direction', 'Week 3+ — pattern detection'].map(
          (s, i) => (
            <View key={i} style={empty.step}>
              <View style={empty.bullet} />
              <Text style={empty.stepText}>{s}</Text>
            </View>
          ),
        )}
      </View>
    </Card>
  );
}

const empty = StyleSheet.create({
  label: {
    color:         colors.textMuted,
    fontSize:      11,
    fontWeight:    FontWeight.medium,
    letterSpacing: 0.6,
    marginBottom:  spacing.sm,
  },
  title: {
    color:        colors.text,
    fontSize:     FontSize.base,
    fontWeight:   FontWeight.black,
    marginBottom: spacing.sm,
  },
  body: {
    color:        colors.textDim,
    fontSize:     FontSize.sm,
    lineHeight:   19,
    marginBottom: spacing.md,
  },
  steps: {
    gap: spacing.xs,
  },
  step: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.sm,
  },
  bullet: {
    width:        5,
    height:       5,
    borderRadius: 3,
    backgroundColor: colors.textSubtle,
    flexShrink:   0,
  },
  stepText: {
    color:    colors.textDim,
    fontSize: FontSize.sm,
  },
});

// ─── Main card ─────────────────────────────────────────────────────────────────

export default function ReadinessTimelineCard({ analysis }: Props) {
  if (analysis.snapshots.length === 0) return <EmptyTimeline />;

  const { snapshots, fatigue, recovery, adherence, acwr } = analysis;

  return (
    <Card>
      {/* Header */}
      <View style={styles.headerRow}>
        <Text style={styles.sectionLabel}>READINESS TIMELINE</Text>
        <Text style={styles.weekCount}>{Math.min(snapshots.length, MAX_WEEKS)} wk</Text>
      </View>

      {/* Trend direction chips */}
      <View style={styles.chipsRow}>
        <DirectionChip
          label="Recovery"
          direction={recovery.direction}
          color={recoveryColor(snapshots[snapshots.length - 1]?.avgRecovery ?? 70)}
        />
        <DirectionChip
          label="Fatigue"
          direction={fatigue.direction}
          color={fatigueColor(snapshots[snapshots.length - 1]?.avgFatigue ?? 40)}
        />
        {adherence.values.length >= 2 && (
          <DirectionChip
            label="Adherence"
            direction={adherence.direction}
            color={adherenceColor(snapshots[snapshots.length - 1]?.adherence ?? 0.8)}
          />
        )}
      </View>

      {/* Row label + Recovery sparkline */}
      <View style={styles.sparkRow}>
        <Text style={styles.rowLabel}>REC</Text>
        <View style={styles.sparkWrap}>
          <SparkLine
            snapshots={snapshots}
            getValue={s => s.avgRecovery}
            getRollAvg={recovery.rollingAvg}
            colorFn={recoveryColor}
            invert={false}
          />
        </View>
      </View>

      {/* Row label + Fatigue sparkline (inverted: lower = higher dot) */}
      <View style={styles.sparkRow}>
        <Text style={styles.rowLabel}>FAT</Text>
        <View style={styles.sparkWrap}>
          <SparkLine
            snapshots={snapshots}
            getValue={s => s.avgFatigue}
            getRollAvg={fatigue.rollingAvg}
            colorFn={fatigueColor}
            invert={true}
          />
        </View>
      </View>

      {/* Week labels (shared X-axis) */}
      <View style={styles.xAxisWrap}>
        <View style={styles.rowLabelSpacer} />
        <View style={{ flex: 1 }}>
          <WeekLabels snapshots={snapshots} />
        </View>
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        <Text style={styles.legendText}>● Filled = actual  ● Faint = 3-wk avg</Text>
      </View>

      {/* Heat strips: Adherence + ACWR */}
      <View style={styles.heatSection}>
        <Text style={styles.heatSectionLabel}>WEEKLY BREAKDOWN</Text>
        <HeatStrip
          snapshots={snapshots}
          getValue={s => s.adherence}
          formatVal={v => `${Math.round(v * 100)}%`}
          colorFn={adherenceColor}
          label="ADH"
        />
        {acwr.values.length >= 2 && (
          <HeatStrip
            snapshots={snapshots}
            getValue={s => s.acwr}
            formatVal={v => v.toFixed(1)}
            colorFn={acwrColor}
            label="ACWR"
          />
        )}
      </View>

      {/* Spike indicator */}
      {(fatigue.hasSpike || recovery.hasSpike) && (
        <View style={styles.spikeAlert}>
          <Text style={styles.spikeText}>
            ⚡ {fatigue.hasSpike ? 'Fatigue spike' : 'Recovery drop'} detected this week
          </Text>
        </View>
      )}
    </Card>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  headerRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    marginBottom:   spacing.sm,
  },
  sectionLabel: {
    color:         colors.textMuted,
    fontSize:      11,
    fontWeight:    FontWeight.medium,
    letterSpacing: 0.6,
  },
  weekCount: {
    color:     colors.textDim,
    fontSize:  FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  chipsRow: {
    flexDirection: 'row',
    gap:           spacing.xs,
    marginBottom:  spacing.lg,
    flexWrap:      'wrap',
  },
  sparkRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.sm,
    marginBottom:  spacing.xs,
  },
  rowLabel: {
    color:         colors.textMuted,
    fontSize:      9,
    fontWeight:    FontWeight.black,
    letterSpacing: 0.5,
    width:         24,
    textTransform: 'uppercase',
  },
  sparkWrap: {
    flex: 1,
  },
  xAxisWrap: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.sm,
  },
  rowLabelSpacer: {
    width: 24,
  },
  legend: {
    marginTop:    spacing.xs,
    marginBottom: spacing.md,
  },
  legendText: {
    color:    colors.textSubtle,
    fontSize: 9,
    marginLeft: 32,
  },
  heatSection: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop:     spacing.md,
    gap:            spacing.xs,
  },
  heatSectionLabel: {
    color:         colors.textMuted,
    fontSize:      9,
    fontWeight:    FontWeight.black,
    letterSpacing: 0.6,
    marginBottom:  spacing.xs,
  },
  spikeAlert: {
    marginTop:       spacing.md,
    backgroundColor: colors.warningDim,
    borderRadius:    Radius.sm,
    padding:         spacing.sm,
  },
  spikeText: {
    color:      colors.warning,
    fontSize:   FontSize.sm,
    fontWeight: FontWeight.medium,
  },
});
