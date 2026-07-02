import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import Card from '../ui/Card';
import { useThemeColors, type ThemeColors } from '../../theme/ThemeContext';
import { spacing } from '../../theme/spacing';
import { FontSize, FontWeight, Radius } from '../../theme/tokens';
import type { RaceTimePrediction, ForecastTrendDirection } from '../../types/forecast';

type Props = {
  predictions: RaceTimePrediction[];
  confidence:  number;
};

function trendColor(dir: ForecastTrendDirection, colors: ThemeColors): string {
  const TREND_COLOR: Record<ForecastTrendDirection, string> = {
    improving: colors.positive,
    stable:    colors.textDim,
    declining: colors.warning,
  };
  return TREND_COLOR[dir];
}

const TREND_SYMBOL: Record<ForecastTrendDirection, string> = {
  improving: '↑',
  stable:    '→',
  declining: '↓',
};

export default function RaceForecastCard({ predictions, confidence }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const shared = predictions[0];

  return (
    <Card>
      <View style={styles.header}>
        <Text style={styles.cardTitle}>RACE PREDICTIONS</Text>
        <View style={styles.confidenceBadge}>
          <Text style={styles.confidenceText}>{confidence}% CONFIDENCE</Text>
        </View>
      </View>

      {predictions.map(p => (
        <View key={p.distanceLabel} style={styles.row}>
          <Text style={styles.distanceLabel}>{p.distanceLabel}</Text>
          <View style={styles.right}>
            <Text style={styles.timeValue}>{p.formattedTime}</Text>
            <Text style={[styles.trendSymbol, { color: trendColor(p.trend, colors) }]}>
              {TREND_SYMBOL[p.trend]}
            </Text>
          </View>
        </View>
      ))}

      {shared && (
        <Text style={styles.explanation}>{shared.explanation}</Text>
      )}
    </Card>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  header: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    marginBottom:   spacing.lg,
  },
  cardTitle: {
    color:         colors.textMuted,
    fontSize:      11,
    fontWeight:    FontWeight.medium,
    letterSpacing: 0.6,
  },
  confidenceBadge: {
    backgroundColor:   colors.border,
    borderRadius:      Radius.sm,
    paddingHorizontal: 8,
    paddingVertical:   4,
  },
  confidenceText: {
    color:         colors.textDim,
    fontSize:      10,
    fontWeight:    FontWeight.black,
    letterSpacing: 0.6,
  },
  row: {
    flexDirection:   'row',
    justifyContent:  'space-between',
    alignItems:      'center',
    paddingVertical: spacing.sm,
    borderTopWidth:  1,
    borderTopColor:  colors.border,
  },
  distanceLabel: {
    color:      colors.textDim,
    fontSize:   FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  right: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.sm,
  },
  timeValue: {
    color:      colors.text,
    fontSize:   FontSize.lg,
    fontWeight: FontWeight.black,
  },
  trendSymbol: {
    fontSize:   FontSize.base,
    fontWeight: FontWeight.black,
    minWidth:   14,
    textAlign:  'center',
  },
  explanation: {
    color:      colors.textMuted,
    fontSize:   12,
    lineHeight: 17,
    marginTop:  spacing.md,
    fontStyle:  'italic',
  },
  });
}
