import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useState } from 'react';

import { colors }  from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { FontSize, FontWeight, Radius } from '../../theme/tokens';
import type { PerformanceDimension, PerformanceProfile } from '../../types/performance';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 75) return colors.positive;
  if (score >= 50) return colors.warning;
  return colors.critical;
}

function confidenceLabel(c: PerformanceDimension['confidence']): string {
  switch (c) {
    case 'high':      return 'High confidence';
    case 'moderate':  return 'Moderate';
    case 'low':       return 'Low confidence';
    case 'estimated': return 'Estimated';
  }
}

function deltaLabel(delta?: number): string {
  if (delta === undefined) return '';
  if (delta > 0) return `▲ ${delta}`;
  if (delta < 0) return `▼ ${Math.abs(delta)}`;
  return '—';
}

// ─── Single dimension row ─────────────────────────────────────────────────────

function DimensionRow({
  dim,
  expanded,
  onPress,
}: {
  dim:      PerformanceDimension;
  expanded: boolean;
  onPress:  () => void;
}) {
  const color = scoreColor(dim.score);
  const fillPct = `${Math.round(dim.score)}%` as const;

  return (
    <Pressable style={d.wrapper} onPress={onPress}>
      <View style={d.row}>
        {/* Score bar */}
        <View style={d.barContainer}>
          <View style={[d.barFill, { width: fillPct, backgroundColor: color }]} />
        </View>

        {/* Label + score */}
        <View style={d.labelRow}>
          <Text style={d.label}>{dim.label}</Text>
          <View style={d.right}>
            {dim.delta !== undefined && (
              <Text style={[
                d.delta,
                { color: dim.delta > 0 ? colors.positive : dim.delta < 0 ? colors.critical : colors.textMuted },
              ]}>
                {deltaLabel(dim.delta)}
              </Text>
            )}
            <Text style={[d.score, { color }]}>{Math.round(dim.score)}</Text>
          </View>
        </View>
      </View>

      {expanded && (
        <View style={d.detail}>
          <View style={d.detailRow}>
            <Text style={d.detailKey}>Confidence</Text>
            <Text style={d.detailVal}>{confidenceLabel(dim.confidence)}</Text>
          </View>
          <View style={d.detailRow}>
            <Text style={d.detailKey}>Source</Text>
            <Text style={d.detailVal}>{dim.source}</Text>
          </View>
          <Text style={d.rationale}>{dim.rationale}</Text>
          {dim.missingData && dim.missingData.length > 0 && (
            <View style={d.missingBox}>
              <Text style={d.missingLabel}>Would improve with:</Text>
              {dim.missingData.map(m => (
                <Text key={m} style={d.missingItem}>· {m}</Text>
              ))}
            </View>
          )}
        </View>
      )}
    </Pressable>
  );
}

// ─── Main card ────────────────────────────────────────────────────────────────

type Props = {
  profile:    PerformanceProfile;
  compact?:   boolean;
};

export default function PerformanceScoreCard({ profile, compact = false }: Props) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const overallColor = scoreColor(profile.overallScore);

  const qualityColor = {
    high:         colors.positive,
    moderate:     colors.warning,
    low:          colors.critical,
    insufficient: colors.textDim,
  }[profile.dataQuality];

  function toggle(key: string) {
    setExpandedKey(prev => prev === key ? null : key);
  }

  return (
    <View style={s.card}>
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>Performance Profile</Text>
          <Text style={s.headerSub}>
            {new Date(profile.lastCalculatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </Text>
        </View>
        <View style={s.overallBox}>
          <Text style={[s.overallScore, { color: overallColor }]}>
            {Math.round(profile.overallScore)}
          </Text>
          <Text style={s.overallLabel}>Overall</Text>
        </View>
      </View>

      {/* Data quality badge */}
      <View style={[s.qualityBadge, { backgroundColor: qualityColor + '22' }]}>
        <Text style={[s.qualityTxt, { color: qualityColor }]}>
          Data quality: {profile.dataQuality}
        </Text>
      </View>

      {/* Dimensions */}
      <View style={s.dims}>
        {profile.dimensions.map(dim => (
          <DimensionRow
            key={dim.key}
            dim={dim}
            expanded={!compact && expandedKey === dim.key}
            onPress={() => toggle(dim.key)}
          />
        ))}
      </View>

      {!compact && (
        <Text style={s.footnote}>
          Tap any dimension to see the scoring rationale and data sources.
          Scores improve as you log more workouts and check-ins.
        </Text>
      )}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius:    12,
    padding:         spacing.md,
    borderWidth:     1,
    borderColor:     colors.border,
    gap:             spacing.md,
  },
  header: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'flex-start',
  },
  headerTitle: {
    color:      colors.text,
    fontSize:   FontSize.base,
    fontWeight: FontWeight.black,
  },
  headerSub: {
    color:    colors.textMuted,
    fontSize: FontSize.xs,
  },
  overallBox: {
    alignItems: 'center',
    gap:        2,
  },
  overallScore: {
    fontSize:   FontSize.xxl,
    fontWeight: FontWeight.black,
    lineHeight: 40,
  },
  overallLabel: {
    color:    colors.textMuted,
    fontSize: FontSize.xs,
  },
  qualityBadge: {
    alignSelf:         'flex-start',
    borderRadius:      Radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical:   2,
  },
  qualityTxt: {
    fontSize:   FontSize.xs,
    fontWeight: FontWeight.bold,
  },
  dims: {
    gap: spacing.sm,
  },
  footnote: {
    color:      colors.textMuted,
    fontSize:   FontSize.xs,
    lineHeight: 17,
  },
});

const d = StyleSheet.create({
  wrapper: {
    gap: spacing.xs,
  },
  row: {
    gap: 4,
  },
  barContainer: {
    height:          4,
    backgroundColor: colors.border,
    borderRadius:    2,
    overflow:        'hidden',
  },
  barFill: {
    height:       '100%',
    borderRadius: 2,
  },
  labelRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
  },
  label: {
    color:    colors.textMuted,
    fontSize: FontSize.xs,
  },
  right: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.xs,
  },
  delta: {
    fontSize:   FontSize.xs,
    fontWeight: FontWeight.bold,
  },
  score: {
    fontSize:   FontSize.sm,
    fontWeight: FontWeight.black,
  },
  detail: {
    backgroundColor: colors.border,
    borderRadius:    Radius.sm,
    padding:         spacing.sm,
    gap:             spacing.xs,
  },
  detailRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
  },
  detailKey:  { color: colors.textMuted, fontSize: FontSize.xs },
  detailVal:  { color: colors.text,      fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  rationale:  { color: colors.textSubtle, fontSize: FontSize.xs, lineHeight: 17 },
  missingBox: { gap: 2 },
  missingLabel:{ color: colors.primary, fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  missingItem: { color: colors.textMuted, fontSize: FontSize.xs },
});
