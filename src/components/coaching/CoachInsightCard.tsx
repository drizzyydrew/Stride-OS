import { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import Card from '../ui/Card';
import { useThemeColors, type ThemeColors } from '../../theme/ThemeContext';
import { spacing } from '../../theme/spacing';
import { FontSize, FontWeight, Radius } from '../../theme/tokens';
import type { CoachInsight, InsightSeverity } from '../../types/coaching';

type Props = {
  insight: CoachInsight;
};

// ─── Visual config ────────────────────────────────────────────────────────────

function severityColor(colors: ThemeColors): Record<InsightSeverity, string> {
  return {
    info:     colors.textDim,
    positive: colors.positive,
    caution:  colors.warning,
    warning:  colors.warning,
    critical: colors.critical,
  };
}

function severityBg(colors: ThemeColors): Record<InsightSeverity, string> {
  return {
    info:     colors.border,
    positive: colors.positiveDim,
    caution:  colors.warningDim,
    warning:  colors.warningDim,
    critical: colors.criticalDim,
  };
}

const SEVERITY_LABEL: Record<InsightSeverity, string> = {
  info:     'INFO',
  positive: 'GOOD',
  caution:  'NOTE',
  warning:  'CAUTION',
  critical: 'URGENT',
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function CoachInsightCard({ insight }: Props) {
  const [expanded, setExpanded] = useState(false);
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const accentColor = severityColor(colors)[insight.severity];
  const badgeBg     = severityBg(colors)[insight.severity];

  return (
    <Card style={styles.card}>
      {/* Tap target: header row */}
      <TouchableOpacity
        onPress={() => setExpanded(e => !e)}
        activeOpacity={0.7}
        style={styles.header}
      >
        {/* Left accent bar */}
        <View style={[styles.accentBar, { backgroundColor: accentColor }]} />

        <View style={styles.headerContent}>
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={expanded ? undefined : 2}>
              {insight.title}
            </Text>
            <View style={[styles.badge, { backgroundColor: badgeBg }]}>
              <Text style={[styles.badgeText, { color: accentColor }]}>
                {SEVERITY_LABEL[insight.severity]}
              </Text>
            </View>
          </View>

          <Text
            style={styles.body}
            numberOfLines={expanded ? undefined : 2}
          >
            {insight.body}
          </Text>

          <Text style={[styles.expandHint, { color: accentColor }]}>
            {expanded ? '↑ less' : '↓ why this matters'}
          </Text>
        </View>
      </TouchableOpacity>

      {/* Expanded: coaching explanation */}
      {expanded && (
        <View style={styles.expandedSection}>
          {/* Why */}
          <View style={styles.expandBlock}>
            <Text style={styles.expandLabel}>WHY THIS MATTERS</Text>
            <Text style={styles.expandBody}>{insight.why}</Text>
          </View>

          {/* Action */}
          <View style={[styles.expandBlock, styles.actionBlock, { borderColor: accentColor + '40' }]}>
            <Text style={[styles.expandLabel, { color: accentColor }]}>YOUR NEXT ACTION</Text>
            <Text style={[styles.expandBody, styles.actionText]}>{insight.action}</Text>
          </View>
        </View>
      )}
    </Card>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  card: {
    padding: 0,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    padding:       spacing.xl,
    gap:           spacing.md,
  },
  accentBar: {
    width:        3,
    borderRadius: 2,
    alignSelf:    'stretch',
    flexShrink:   0,
  },
  headerContent: {
    flex: 1,
    gap:  spacing.xs,
  },
  titleRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'flex-start',
    gap:            spacing.sm,
  },
  title: {
    flex:       1,
    color:      colors.text,
    fontSize:   FontSize.base,
    fontWeight: FontWeight.black,
    lineHeight: 20,
  },
  badge: {
    paddingHorizontal: 7,
    paddingVertical:   3,
    borderRadius:      Radius.sm,
    flexShrink:        0,
  },
  badgeText: {
    fontSize:      9,
    fontWeight:    FontWeight.black,
    letterSpacing: 0.7,
  },
  body: {
    color:      colors.textDim,
    fontSize:   FontSize.sm,
    lineHeight: 19,
  },
  expandHint: {
    fontSize:   11,
    fontWeight: FontWeight.medium,
    marginTop:  spacing.xs,
  },

  // Expanded section
  expandedSection: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.xl,
    paddingTop:        spacing.lg,
    paddingBottom:     spacing.xl,
    gap:               spacing.lg,
  },
  expandBlock: {
    gap: spacing.xs,
  },
  expandLabel: {
    color:         colors.textMuted,
    fontSize:      10,
    fontWeight:    FontWeight.black,
    letterSpacing: 0.7,
    marginBottom:  spacing.xs,
  },
  expandBody: {
    color:      colors.textDim,
    fontSize:   FontSize.sm,
    lineHeight: 20,
  },
  actionBlock: {
    borderWidth:   1,
    borderRadius:  Radius.sm,
    padding:       spacing.md,
  },
  actionText: {
    color: colors.text,
  },
  });
}
