// ─── Angle Chart ────────────────────────────────────────────────────────────────
//
// Small line chart (victory-native / Skia) for one angle over the clip,
// showing up to two sides (left/right, or a single center series like trunk
// lean) with distinct colors. Gaps in the underlying series (a frame where
// the landmarks weren't confidently detected) are left as real gaps —
// `connectMissingData={false}` so the line breaks rather than fabricating
// a value across a period with no detection.

import { StyleSheet, Text, View } from 'react-native';
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
};

export default function AngleChart({ title, seriesA, seriesB, note }: Props) {
  const timesSet = new Set<number>();
  seriesA.points.forEach(p => timesSet.add(p.timeMs));
  seriesB?.points.forEach(p => timesSet.add(p.timeMs));
  const times = [...timesSet].sort((x, y) => x - y);

  const data: ChartRow[] = times.map(t => ({
    t,
    a: seriesA.points.find(p => p.timeMs === t)?.degrees ?? null,
    b: seriesB?.points.find(p => p.timeMs === t)?.degrees ?? null,
  }));

  const hasEnoughData = data.some(d => d.a !== null) || data.some(d => d.b !== null);

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

      {hasEnoughData && data.length >= 2 ? (
        <View style={s.chartBox}>
          <CartesianChart
            data={data}
            xKey="t"
            yKeys={['a', 'b']}
            domainPadding={{ top: 16, bottom: 16, left: 8, right: 8 }}
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
        </View>
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
    gap:             spacing.sm,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title:     { color: colors.text, fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  legend:    { flexDirection: 'row', gap: spacing.sm },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dot:        { width: 8, height: 8, borderRadius: 4 },
  legendTxt:  { color: colors.textMuted, fontSize: FontSize.xs },
  chartBox:   { height: 160 },
  emptyTxt:   { color: colors.textMuted, fontSize: FontSize.xs, lineHeight: 17 },
  note:       { color: colors.textSubtle, fontSize: FontSize.xs, lineHeight: 16 },
});
