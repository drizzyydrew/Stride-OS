import { StyleSheet, Text, View } from 'react-native';

import Card from '../ui/Card';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { FontSize, FontWeight, Radius } from '../../theme/tokens';
import type { RaceReadinessSummary, RaceReadinessDimensions } from '../../types/coaching';

type Props = {
  readiness: RaceReadinessSummary;
};

// ─── Visual config ────────────────────────────────────────────────────────────

const LABEL_COLOR: Record<RaceReadinessSummary['label'], string> = {
  race_ready: colors.positive,
  on_track:   '#60A5FA',
  needs_work: colors.warning,
  not_ready:  colors.critical,
};

const LABEL_BG: Record<RaceReadinessSummary['label'], string> = {
  race_ready: colors.positiveDim,
  on_track:   '#0C1A3D',
  needs_work: colors.warningDim,
  not_ready:  colors.criticalDim,
};

const LABEL_TEXT: Record<RaceReadinessSummary['label'], string> = {
  race_ready: 'RACE READY',
  on_track:   'ON TRACK',
  needs_work: 'NEEDS WORK',
  not_ready:  'NOT READY',
};

const DIM_LABEL: Record<keyof RaceReadinessDimensions, string> = {
  aerobicBase: 'Aerobic Base',
  speedWork:   'Speed Work',
  recovery:    'Recovery',
  consistency: 'Consistency',
  peaking:     'Phase Alignment',
};

// ─── Dimension bar row ────────────────────────────────────────────────────────

function DimRow({ label, value }: { label: string; value: number }) {
  const color =
    value >= 75 ? colors.positive :
    value >= 55 ? '#60A5FA'       :
    value >= 40 ? colors.warning  :
    colors.critical;

  return (
    <View style={dimStyles.row}>
      <View style={dimStyles.labelWrap}>
        <Text style={dimStyles.label}>{label}</Text>
        <Text style={[dimStyles.value, { color }]}>{value}</Text>
      </View>
      <View style={dimStyles.track}>
        <View style={[dimStyles.fill, { flex: value, backgroundColor: color }]} />
        <View style={[dimStyles.empty, { flex: 100 - value }]} />
      </View>
    </View>
  );
}

const dimStyles = StyleSheet.create({
  row: {
    marginBottom: spacing.sm,
    gap:          spacing.xs,
  },
  labelWrap: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
  },
  label: {
    color:      colors.textDim,
    fontSize:   FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  value: {
    fontSize:   FontSize.sm,
    fontWeight: FontWeight.black,
  },
  track: {
    flexDirection: 'row',
    height:        5,
    borderRadius:  3,
    overflow:      'hidden',
    backgroundColor: colors.border,
  },
  fill: {
    borderRadius: 3,
  },
  empty: {
    backgroundColor: 'transparent',
  },
});

// ─── Main component ───────────────────────────────────────────────────────────

export default function RaceReadinessCard({ readiness }: Props) {
  const labelColor = LABEL_COLOR[readiness.label];
  const labelBg    = LABEL_BG[readiness.label];

  return (
    <Card>
      {/* Header */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.cardTitle}>RACE READINESS</Text>
          <View style={styles.scoreRow}>
            <Text style={[styles.score, { color: labelColor }]}>{readiness.overallScore}</Text>
            <Text style={styles.scoreUnit}>/100</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <View style={[styles.labelBadge, { backgroundColor: labelBg }]}>
            <Text style={[styles.labelText, { color: labelColor }]}>
              {LABEL_TEXT[readiness.label]}
            </Text>
          </View>
          <Text style={styles.confidence}>{readiness.confidence}% conf.</Text>
        </View>
      </View>

      {/* Summary */}
      <Text style={styles.summary}>{readiness.summary}</Text>

      {/* Dimensions */}
      <View style={styles.dimsSection}>
        <Text style={styles.sectionLabel}>READINESS DIMENSIONS</Text>
        {(Object.entries(readiness.dimensions) as [keyof RaceReadinessDimensions, number][]).map(
          ([key, value]) => (
            <DimRow key={key} label={DIM_LABEL[key]} value={value} />
          ),
        )}
      </View>

      {/* Key insights */}
      <View style={styles.insightsSection}>
        <Text style={styles.sectionLabel}>KEY OBSERVATIONS</Text>
        {readiness.keyInsights.map((insight, i) => (
          <View key={i} style={styles.insightRow}>
            <View style={[styles.bullet, { backgroundColor: labelColor }]} />
            <Text style={styles.insightText}>{insight}</Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  headerRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'flex-start',
    marginBottom:   spacing.md,
  },
  cardTitle: {
    color:         colors.textMuted,
    fontSize:      11,
    fontWeight:    FontWeight.medium,
    letterSpacing: 0.6,
    marginBottom:  4,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems:    'baseline',
  },
  score: {
    fontSize:   40,
    fontWeight: FontWeight.black,
    lineHeight: 46,
  },
  scoreUnit: {
    color:      colors.textDim,
    fontSize:   FontSize.base,
    fontWeight: FontWeight.medium,
    marginLeft: 3,
  },
  headerRight: {
    alignItems: 'flex-end',
    gap:        spacing.xs,
  },
  labelBadge: {
    paddingHorizontal: 10,
    paddingVertical:    5,
    borderRadius:       Radius.sm,
  },
  labelText: {
    fontSize:      11,
    fontWeight:    FontWeight.black,
    letterSpacing: 0.8,
  },
  confidence: {
    color:     colors.textMuted,
    fontSize:  11,
    fontWeight: FontWeight.medium,
  },
  summary: {
    color:        colors.textDim,
    fontSize:     FontSize.sm,
    lineHeight:   19,
    marginBottom: spacing.lg,
  },
  dimsSection: {
    marginBottom: spacing.lg,
  },
  sectionLabel: {
    color:         colors.textMuted,
    fontSize:      10,
    fontWeight:    FontWeight.black,
    letterSpacing: 0.7,
    marginBottom:  spacing.md,
  },
  insightsSection: {},
  insightRow: {
    flexDirection: 'row',
    alignItems:    'flex-start',
    gap:           spacing.sm,
    marginBottom:  spacing.xs,
  },
  bullet: {
    width:        5,
    height:       5,
    borderRadius: 3,
    marginTop:    7,
    flexShrink:   0,
  },
  insightText: {
    flex:       1,
    color:      colors.textDim,
    fontSize:   FontSize.sm,
    lineHeight: 19,
  },
});
