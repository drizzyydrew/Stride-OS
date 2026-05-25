import { StyleSheet, Text, View } from 'react-native';

import Card from '../ui/Card';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { FontSize, FontWeight } from '../../theme/tokens';
import type { DataPoint } from '../../types/analytics';

type Props = {
  label:          string;
  data:           DataPoint[];
  unit?:          string;
  barColor?:      string;
  highlightColor?: string;
  helper?:        string;
};

const BAR_HEIGHT     = 80;
const MIN_BAR_HEIGHT = 4;

export default function BarChartCard({
  label,
  data,
  unit,
  barColor      = colors.primaryDim,
  highlightColor = colors.primary,
  helper,
}: Props) {
  if (data.length === 0) return null;

  const maxValue = Math.max(...data.map(d => d.value), 1);
  const lastWeek = data[data.length - 1]!.week;

  return (
    <Card>
      <View style={styles.headerRow}>
        <Text style={styles.label}>{label}</Text>
        {unit ? <Text style={styles.unit}>{unit}</Text> : null}
      </View>

      <View style={styles.chartArea}>
        {data.map((point) => {
          const isCurrentWeek = point.week === lastWeek;
          const barH = Math.max(MIN_BAR_HEIGHT, (point.value / maxValue) * BAR_HEIGHT);

          return (
            <View key={point.week} style={styles.barGroup}>
              <View style={styles.barContainer}>
                <View
                  style={[
                    styles.bar,
                    {
                      height:          barH,
                      backgroundColor: isCurrentWeek ? highlightColor : barColor,
                    },
                  ]}
                />
              </View>
              <Text style={[styles.weekLabel, isCurrentWeek && styles.weekLabelActive]}>
                {`W${point.week}`}
              </Text>
            </View>
          );
        })}
      </View>

      <View style={styles.footer}>
        <Text style={styles.minLabel}>0</Text>
        <Text style={styles.maxLabel}>{maxValue}{unit ?? ''}</Text>
      </View>

      {helper ? <Text style={styles.helper}>{helper}</Text> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    marginBottom:   spacing.xl,
  },
  label: {
    color:         colors.textMuted,
    fontSize:      FontSize.base,
    fontWeight:    FontWeight.medium,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  unit: {
    color:    colors.textDim,
    fontSize: FontSize.sm,
  },
  chartArea: {
    flexDirection: 'row',
    alignItems:    'flex-end',
    height:        BAR_HEIGHT,
    gap:           6,
  },
  barGroup: {
    flex:       1,
    alignItems: 'center',
  },
  barContainer: {
    width:          '100%',
    height:         BAR_HEIGHT,
    justifyContent: 'flex-end',
    alignItems:     'center',
  },
  bar: {
    width:        '72%',
    borderRadius: 4,
  },
  weekLabel: {
    color:      colors.textDim,
    fontSize:   9,
    marginTop:  6,
    fontWeight: FontWeight.medium,
  },
  weekLabelActive: {
    color:      colors.text,
    fontWeight: FontWeight.bold,
  },
  footer: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    marginTop:      spacing.xs,
  },
  minLabel: {
    color:    colors.textSubtle,
    fontSize: 10,
  },
  maxLabel: {
    color:    colors.textSubtle,
    fontSize: 10,
  },
  helper: {
    color:      colors.textDim,
    fontSize:   12,
    marginTop:  spacing.md,
    lineHeight: 17,
  },
});
