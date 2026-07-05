import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Line, Polyline, Rect } from 'react-native-svg';

import { useTheme } from '../../theme';

export type ChartPoint = {
  x: number;
  y: number;
};

type ChartFrameProps = {
  title?: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function ChartFrame({ title, children, style }: ChartFrameProps) {
  const theme = useTheme();
  return (
    <View style={[styles.frame, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }, style]}>
      {title ? <Text style={[styles.title, { color: theme.colors.text }]}>{title}</Text> : null}
      {children}
    </View>
  );
}

type ChartGridProps = {
  width: number;
  height: number;
  rows?: number;
  columns?: number;
};

export function ChartGrid({ width, height, rows = 4, columns = 4 }: ChartGridProps) {
  const theme = useTheme();
  const rowLines = Array.from({ length: rows + 1 }, (_, i) => (height / rows) * i);
  const columnLines = Array.from({ length: columns + 1 }, (_, i) => (width / columns) * i);

  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
      {rowLines.map((y) => (
        <Line key={`r-${y}`} x1={0} x2={width} y1={y} y2={y} stroke={theme.colors.chartGrid} strokeWidth={1} />
      ))}
      {columnLines.map((x) => (
        <Line key={`c-${x}`} x1={x} x2={x} y1={0} y2={height} stroke={theme.colors.chartGrid} strokeWidth={1} />
      ))}
    </Svg>
  );
}

type LineChartPrimitiveProps = {
  points: ChartPoint[];
  width: number;
  height: number;
  color?: string;
  strokeWidth?: number;
};

export function LineChartPrimitive({
  points,
  width,
  height,
  color,
  strokeWidth = 3,
}: LineChartPrimitiveProps) {
  const theme = useTheme();
  const path = points.map((point) => `${point.x},${height - point.y}`).join(' ');

  return (
    <Svg width={width} height={height}>
      <Polyline points={path} fill="none" stroke={color ?? theme.colors.chartSeriesPrimary} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

type BarChartPrimitiveProps = {
  values: number[];
  width: number;
  height: number;
  color?: string;
  gap?: number;
};

export function BarChartPrimitive({
  values,
  width,
  height,
  color,
  gap = 6,
}: BarChartPrimitiveProps) {
  const theme = useTheme();
  const max = Math.max(...values, 1);
  const barWidth = (width - gap * Math.max(values.length - 1, 0)) / Math.max(values.length, 1);

  return (
    <Svg width={width} height={height}>
      {values.map((value, index) => {
        const barHeight = (value / max) * height;
        return (
          <Rect
            key={`${value}-${index}`}
            x={index * (barWidth + gap)}
            y={height - barHeight}
            width={barWidth}
            height={barHeight}
            rx={4}
            fill={color ?? theme.colors.chartSeriesPrimary}
          />
        );
      })}
    </Svg>
  );
}

const styles = StyleSheet.create({
  frame: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    gap: 12,
    borderCurve: 'continuous',
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
  },
});
