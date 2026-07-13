// ─── Angle Chart ────────────────────────────────────────────────────────────────
//
// Small line chart (victory-native / Skia) for one estimated metric over the
// clip, showing up to two sides (left/right, or a single center series like
// trunk lean) with distinct colors. Build 36 additions: a playhead line driven
// by the video player (`currentTimeMs`), tap/drag to seek (`onSeekMs` — the
// parent pauses the video), degree/seconds axis labels, a min/max ROM
// annotation, and a metric-specific y-domain so each chart is scaled sensibly.
//
// Honesty: gaps in the underlying series (a frame where the landmarks weren't
// confidently detected) are left as real gaps — `connectMissingData={false}`
// so the line breaks rather than fabricating a value across a period with no
// detection.

import { useMemo, useRef } from 'react';
import {
  PanResponder,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { CartesianChart, Line } from 'victory-native';

import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { FontSize, FontWeight } from '../../theme/tokens';
import type { AngleSeriesPoint } from '../../types/movement';

export type ChartLineSeries = {
  label: string;
  color: string;
  points: AngleSeriesPoint[];
};

type ChartRow = { t: number; a: number | null; b: number | null };

type Props = {
  title:   string;
  seriesA: ChartLineSeries;
  seriesB?: ChartLineSeries;
  note?:   string;
  /** Unit shown on the y-axis labels and ROM annotation. Default '°'. */
  unit?:   string;
  /** Explicit [min, max] y-domain for this metric. Auto-fit from data when omitted. */
  yDomain?: [number, number];
  /** Current player position — draws the playhead marker. */
  currentTimeMs?: number;
  /** Called with a target time (ms) when the user taps/drags the chart. The
   *  parent should seek AND pause the video. Omit to make the chart read-only. */
  onSeekMs?: (timeMs: number) => void;
};

const PAD_X = 10;   // horizontal domain padding (px) — must match domainPadding

function niceDomain(values: number[]): [number, number] {
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) return [min - 1, max + 1];
  const pad = (max - min) * 0.1;
  return [Math.floor(min - pad), Math.ceil(max + pad)];
}

function fmtTime(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

export default function AngleChart({
  title, seriesA, seriesB, note, unit = '°', yDomain, currentTimeMs, onSeekMs,
}: Props) {
  const chartWidthRef = useRef(0);

  const timesSet = new Set<number>();
  seriesA.points.forEach(p => timesSet.add(p.timeMs));
  seriesB?.points.forEach(p => timesSet.add(p.timeMs));
  const times = [...timesSet].sort((x, y) => x - y);

  const data: ChartRow[] = times.map(t => ({
    t,
    a: seriesA.points.find(p => p.timeMs === t)?.degrees ?? null,
    b: seriesB?.points.find(p => p.timeMs === t)?.degrees ?? null,
  }));

  const realValues = data.flatMap(d => [d.a, d.b].filter((v): v is number => v !== null));
  const hasEnoughData = realValues.length > 0 && data.length >= 2;

  const tMin = times[0] ?? 0;
  const tMax = times[times.length - 1] ?? 0;
  const span = tMax - tMin;

  const [yLo, yHi] = yDomain ?? (realValues.length > 0 ? niceDomain(realValues) : [0, 1]);
  const yMid = Math.round((yLo + yHi) / 2);

  const rom = realValues.length > 0
    ? { min: Math.round(Math.min(...realValues)), max: Math.round(Math.max(...realValues)) }
    : null;

  // ── Playhead position within the plot area ────────────────────────────────
  const playheadFraction = currentTimeMs !== undefined && span > 0
    ? Math.min(1, Math.max(0, (currentTimeMs - tMin) / span))
    : null;

  function timeFromX(x: number): number {
    const w = chartWidthRef.current;
    const plotW = Math.max(1, w - 2 * PAD_X);
    const frac = Math.min(1, Math.max(0, (x - PAD_X) / plotW));
    return tMin + frac * span;
  }

  const panResponder = useMemo(
    () => PanResponder.create({
      onStartShouldSetPanResponder: () => !!onSeekMs,
      onMoveShouldSetPanResponder: () => !!onSeekMs,
      onPanResponderGrant: (evt) => onSeekMs?.(timeFromX(evt.nativeEvent.locationX)),
      onPanResponderMove:  (evt) => onSeekMs?.(timeFromX(evt.nativeEvent.locationX)),
    }),
    [onSeekMs, span, tMin],
  );

  function handleChartLayout(e: LayoutChangeEvent) {
    chartWidthRef.current = e.nativeEvent.layout.width;
  }

  return (
    <View style={s.card}>
      <View style={s.headerRow}>
        <Text style={s.title}>{title}</Text>
        <View style={s.legend}>
          <View style={s.legendItem}>
            <View style={[s.dot, { backgroundColor: seriesA.color }]} />
            <Text style={s.legendTxt}>{seriesA.label}</Text>
          </View>
          {seriesB ? (
            <View style={s.legendItem}>
              <View style={[s.dot, { backgroundColor: seriesB.color }]} />
              <Text style={s.legendTxt}>{seriesB.label}</Text>
            </View>
          ) : null}
        </View>
      </View>

      {hasEnoughData ? (
        <>
          <View style={s.plotRow}>
            {/* Y-axis labels (degrees) */}
            <View style={s.yAxis}>
              <Text style={s.axisTxt}>{yHi}{unit}</Text>
              <Text style={s.axisTxt}>{yMid}{unit}</Text>
              <Text style={s.axisTxt}>{yLo}{unit}</Text>
            </View>

            {/* Chart + playhead + seek overlay */}
            <View style={s.chartBox} onLayout={handleChartLayout} {...panResponder.panHandlers}>
              <CartesianChart
                data={data}
                xKey="t"
                yKeys={['a', 'b']}
                domain={{ y: [yLo, yHi] }}
                domainPadding={{ top: 8, bottom: 8, left: PAD_X, right: PAD_X }}
              >
                {({ points }) => (
                  <>
                    <Line points={points.a} color={seriesA.color} strokeWidth={2} curveType="natural" connectMissingData={false} />
                    {seriesB ? (
                      <Line points={points.b} color={seriesB.color} strokeWidth={2} curveType="natural" connectMissingData={false} />
                    ) : null}
                  </>
                )}
              </CartesianChart>

              {playheadFraction !== null ? (
                <View
                  pointerEvents="none"
                  style={[
                    s.playhead,
                    { left: `${playheadFraction * 100}%` },
                  ]}
                />
              ) : null}
            </View>
          </View>

          {/* X-axis labels (seconds) */}
          <View style={s.xAxis}>
            <Text style={s.axisTxt}>{fmtTime(tMin)}</Text>
            <Text style={s.axisTxt}>{fmtTime(tMin + span / 2)}</Text>
            <Text style={s.axisTxt}>{fmtTime(tMax)}</Text>
          </View>

          {rom ? (
            <Text style={s.rom}>Estimated range: {rom.min}{unit} to {rom.max}{unit}{onSeekMs ? ' · tap the chart to scrub the video' : ''}</Text>
          ) : null}
        </>
      ) : (
        <Text style={s.emptyTxt}>Not enough confidently-detected frames to chart {title.toLowerCase()}.</Text>
      )}

      {note ? <Text style={s.note}>{note}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius:    12,
    padding:         spacing.md,
    borderWidth:     1,
    borderColor:     colors.border,
    gap:             spacing.xs,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title:     { color: colors.text, fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  legend:    { flexDirection: 'row', gap: spacing.sm },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dot:        { width: 8, height: 8, borderRadius: 4 },
  legendTxt:  { color: colors.textMuted, fontSize: FontSize.xs },
  plotRow:    { flexDirection: 'row', alignItems: 'stretch' },
  yAxis:      { width: 34, height: 160, justifyContent: 'space-between', paddingVertical: 6, alignItems: 'flex-end', paddingRight: 4 },
  chartBox:   { flex: 1, height: 160, position: 'relative' },
  playhead:   { position: 'absolute', top: 0, bottom: 0, width: 1.5, backgroundColor: colors.text, opacity: 0.65 },
  xAxis:      { flexDirection: 'row', justifyContent: 'space-between', paddingLeft: 34 },
  axisTxt:    { color: colors.textSubtle, fontSize: 10 },
  rom:        { color: colors.textMuted, fontSize: FontSize.xs, lineHeight: 16 },
  emptyTxt:   { color: colors.textMuted, fontSize: FontSize.xs, lineHeight: 17 },
  note:       { color: colors.textSubtle, fontSize: FontSize.xs, lineHeight: 16 },
});
