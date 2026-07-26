// ─── Angle Chart ────────────────────────────────────────────────────────────────
//
// Small line chart for one estimated metric over the clip, showing up to two
// sides (left/right, or a single center series like trunk lean) with distinct
// colors. Build 36 additions: a playhead line driven
// by the video player (`currentTimeMs`), tap/drag to seek (`onSeekMs` — the
// parent pauses the video), degree/seconds axis labels, a min/max ROM
// annotation, and a metric-specific y-domain so each chart is scaled sensibly.
//
// Honesty: gaps in the underlying series (a frame where the landmarks weren't
// confidently detected) are left as real gaps — `connectMissingData={false}`
// so the line breaks rather than fabricating a value across a period with no
// detection.

import { useMemo, useRef, useState } from 'react';
import {
  PanResponder,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import Svg, { Line as SvgLine, Polyline } from 'react-native-svg';

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
type PlotPoint = { x: number; y: number };

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
  onSeekStart?: () => void;
  onSeekEnd?: () => void;
  onSeekCancel?: () => void;
};

const PAD_X = 10;
const PAD_Y = 8;
const CHART_HEIGHT = 160;

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
  title,
  seriesA,
  seriesB,
  note,
  unit = '°',
  yDomain,
  currentTimeMs,
  onSeekMs,
  onSeekStart,
  onSeekEnd,
  onSeekCancel,
}: Props) {
  const chartWidthRef = useRef(0);
  const [chartWidth, setChartWidth] = useState(0);

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
  const ySpan = Math.max(1, yHi - yLo);

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
      onPanResponderGrant: (evt) => {
        onSeekStart?.();
        onSeekMs?.(timeFromX(evt.nativeEvent.locationX));
      },
      onPanResponderMove:  (evt) => onSeekMs?.(timeFromX(evt.nativeEvent.locationX)),
      onPanResponderRelease: () => onSeekEnd?.(),
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
      onPanResponderTerminate: () => onSeekCancel?.(),
    }),
    [onSeekCancel, onSeekEnd, onSeekMs, onSeekStart, span, tMin],
  );

  function handleChartLayout(e: LayoutChangeEvent) {
    const width = e.nativeEvent.layout.width;
    chartWidthRef.current = width;
    setChartWidth(width);
  }

  function toPlotPoint(row: ChartRow, value: number): PlotPoint {
    const plotW = Math.max(1, chartWidth - 2 * PAD_X);
    const plotH = Math.max(1, CHART_HEIGHT - 2 * PAD_Y);
    const x = PAD_X + (span > 0 ? ((row.t - tMin) / span) * plotW : plotW / 2);
    const y = PAD_Y + ((yHi - value) / ySpan) * plotH;
    return { x, y };
  }

  function lineSegments(key: 'a' | 'b'): PlotPoint[][] {
    const segments: PlotPoint[][] = [];
    let current: PlotPoint[] = [];

    data.forEach((row) => {
      const value = row[key];
      if (value === null) {
        if (current.length > 1) segments.push(current);
        current = [];
        return;
      }

      current.push(toPlotPoint(row, value));
    });

    if (current.length > 1) segments.push(current);
    return segments;
  }

  const canRenderChart = chartWidth > 0;
  const seriesASegments = canRenderChart ? lineSegments('a') : [];
  const seriesBSegments = seriesB && canRenderChart ? lineSegments('b') : [];

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
              {canRenderChart ? (
                <Svg width={chartWidth} height={CHART_HEIGHT}>
                  {[0, 0.5, 1].map((fraction) => (
                    <SvgLine
                      key={`grid-${fraction}`}
                      x1={PAD_X}
                      x2={chartWidth - PAD_X}
                      y1={PAD_Y + fraction * (CHART_HEIGHT - 2 * PAD_Y)}
                      y2={PAD_Y + fraction * (CHART_HEIGHT - 2 * PAD_Y)}
                      stroke={colors.border}
                      strokeOpacity={0.55}
                      strokeWidth={1}
                    />
                  ))}
                  {seriesASegments.map((segment, index) => (
                    <Polyline
                      key={`a-${index}`}
                      points={segment.map(point => `${point.x},${point.y}`).join(' ')}
                      fill="none"
                      stroke={seriesA.color}
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  ))}
                  {seriesBSegments.map((segment, index) => (
                    <Polyline
                      key={`b-${index}`}
                      points={segment.map(point => `${point.x},${point.y}`).join(' ')}
                      fill="none"
                      stroke={seriesB?.color}
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  ))}
                </Svg>
              ) : null}

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
  chartBox:   { flex: 1, height: CHART_HEIGHT, position: 'relative' },
  playhead:   { position: 'absolute', top: 0, bottom: 0, width: 1.5, backgroundColor: colors.text, opacity: 0.65 },
  xAxis:      { flexDirection: 'row', justifyContent: 'space-between', paddingLeft: 34 },
  axisTxt:    { color: colors.textSubtle, fontSize: 10 },
  rom:        { color: colors.textMuted, fontSize: FontSize.xs, lineHeight: 16 },
  emptyTxt:   { color: colors.textMuted, fontSize: FontSize.xs, lineHeight: 17 },
  note:       { color: colors.textSubtle, fontSize: FontSize.xs, lineHeight: 16 },
});
