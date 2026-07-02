import { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import Card from '../ui/Card';
import { useThemeColors, type ThemeColors } from '../../theme/ThemeContext';
import { spacing } from '../../theme/spacing';
import { FontSize, FontWeight, Radius } from '../../theme/tokens';
import type { TimelineSignal, TimelineSignalSeverity, TimelineSignalType } from '../../types/timeline';

type Props = {
  signals: TimelineSignal[];
};

// ─── Visual config ─────────────────────────────────────────────────────────────

function sevColor(colors: ThemeColors): Record<TimelineSignalSeverity, string> {
  return {
    critical: colors.critical,
    warning:  colors.warning,
    positive: colors.positive,
    info:     colors.textDim,
  };
}

function sevBg(colors: ThemeColors): Record<TimelineSignalSeverity, string> {
  return {
    critical: colors.criticalDim,
    warning:  colors.warningDim,
    positive: colors.positiveDim,
    info:     colors.border,
  };
}

const SEV_LABEL: Record<TimelineSignalSeverity, string> = {
  critical: 'URGENT',
  warning:  'WATCH',
  positive: 'GOOD',
  info:     'INFO',
};

const TYPE_ICON: Record<TimelineSignalType, string> = {
  hidden_fatigue:        '⚠',
  recovery_stagnation:   '⟳',
  improving_adaptation:  '↑',
  taper_freshness:       '✦',
  chronic_inconsistency: '≈',
  acwr_spike:            '⚡',
  effort_creep:          '↗',
};

// ─── Single signal row (expandable) ───────────────────────────────────────────

function SignalRow({ signal, isLast }: { signal: TimelineSignal; isLast: boolean }) {
  const colors = useThemeColors();
  const row    = useMemo(() => createRowStyles(colors), [colors]);
  const [open, setOpen] = useState(false);

  const color = sevColor(colors)[signal.severity];
  const bg    = sevBg(colors)[signal.severity];
  const icon  = TYPE_ICON[signal.type];

  return (
    <View style={[row.container, !isLast && row.bordered]}>
      {/* Tap target: header */}
      <TouchableOpacity
        onPress={() => setOpen(o => !o)}
        activeOpacity={0.7}
        style={row.header}
      >
        {/* Accent bar */}
        <View style={[row.accentBar, { backgroundColor: color }]} />

        {/* Icon + title */}
        <View style={row.main}>
          <View style={row.titleRow}>
            <View style={[row.iconBadge, { backgroundColor: bg }]}>
              <Text style={[row.iconText, { color }]}>{icon}</Text>
            </View>
            <Text style={row.title} numberOfLines={open ? undefined : 2}>
              {signal.title}
            </Text>
          </View>

          {/* Metadata: severity badge + weeks active */}
          <View style={row.meta}>
            <View style={[row.sevBadge, { backgroundColor: bg }]}>
              <Text style={[row.sevText, { color }]}>{SEV_LABEL[signal.severity]}</Text>
            </View>
            {signal.weeksActive > 1 && (
              <Text style={row.weeks}>{signal.weeksActive}w pattern</Text>
            )}
            <Text style={[row.expandHint, { color }]}>
              {open ? '↑ less' : '↓ details'}
            </Text>
          </View>
        </View>
      </TouchableOpacity>

      {/* Expanded: what changed / why / next */}
      {open && (
        <View style={row.expanded}>
          <View style={row.expandBlock}>
            <Text style={row.expandLabel}>WHAT CHANGED</Text>
            <Text style={row.expandBody}>{signal.whatChanged}</Text>
          </View>

          <View style={row.expandBlock}>
            <Text style={row.expandLabel}>WHY IT MATTERS</Text>
            <Text style={row.expandBody}>{signal.whyItMatters}</Text>
          </View>

          <View style={[row.expandBlock, row.nextBlock, { borderColor: color + '40' }]}>
            <Text style={[row.expandLabel, { color }]}>WHAT TO DO NEXT</Text>
            <Text style={[row.expandBody, { color: colors.text }]}>{signal.whatNext}</Text>
          </View>
        </View>
      )}
    </View>
  );
}

function createRowStyles(colors: ThemeColors) {
  return StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  bordered: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  header: {
    flexDirection:  'row',
    paddingVertical: spacing.md,
    gap:            spacing.sm,
  },
  accentBar: {
    width:        3,
    borderRadius: 2,
    alignSelf:    'stretch',
    flexShrink:   0,
  },
  main: {
    flex: 1,
    gap:  spacing.xs,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems:    'flex-start',
    gap:           spacing.sm,
  },
  iconBadge: {
    width:          22,
    height:         22,
    borderRadius:   Radius.sm,
    alignItems:     'center',
    justifyContent: 'center',
    flexShrink:     0,
  },
  iconText: {
    fontSize:   11,
    fontWeight: FontWeight.black,
  },
  title: {
    flex:       1,
    color:      colors.text,
    fontSize:   FontSize.base,
    fontWeight: FontWeight.bold,
    lineHeight: 20,
  },
  meta: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.sm,
    marginLeft:    30, // align with title (past iconBadge + gap)
  },
  sevBadge: {
    paddingHorizontal: 6,
    paddingVertical:   2,
    borderRadius:      Radius.sm,
  },
  sevText: {
    fontSize:      9,
    fontWeight:    FontWeight.black,
    letterSpacing: 0.6,
  },
  weeks: {
    color:    colors.textDim,
    fontSize: FontSize.sm,
  },
  expandHint: {
    fontSize:   11,
    fontWeight: FontWeight.medium,
    marginLeft: 'auto',
  },
  // Expanded section
  expanded: {
    borderTopWidth:    1,
    borderTopColor:    colors.border,
    paddingTop:        spacing.md,
    paddingBottom:     spacing.lg,
    paddingHorizontal: spacing.sm,
    gap:               spacing.md,
  },
  expandBlock: {
    gap: spacing.xs,
  },
  expandLabel: {
    color:         colors.textMuted,
    fontSize:      10,
    fontWeight:    FontWeight.black,
    letterSpacing: 0.7,
  },
  expandBody: {
    color:      colors.textDim,
    fontSize:   FontSize.sm,
    lineHeight: 20,
  },
  nextBlock: {
    borderWidth:  1,
    borderRadius: Radius.sm,
    padding:      spacing.md,
  },
  });
}

// ─── Main card ─────────────────────────────────────────────────────────────────

export default function TimelineSignalsCard({ signals }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  if (signals.length === 0) return null;

  const criticalCount = signals.filter(s => s.severity === 'critical').length;
  const warningCount  = signals.filter(s => s.severity === 'warning').length;
  const positiveCount = signals.filter(s => s.severity === 'positive').length;

  return (
    <Card style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.sectionLabel}>DETECTED PATTERNS</Text>
        <View style={styles.countRow}>
          {criticalCount > 0 && (
            <View style={[styles.countBadge, { backgroundColor: colors.criticalDim }]}>
              <Text style={[styles.countText, { color: colors.critical }]}>{criticalCount} URGENT</Text>
            </View>
          )}
          {warningCount > 0 && (
            <View style={[styles.countBadge, { backgroundColor: colors.warningDim }]}>
              <Text style={[styles.countText, { color: colors.warning }]}>{warningCount} WATCH</Text>
            </View>
          )}
          {positiveCount > 0 && (
            <View style={[styles.countBadge, { backgroundColor: colors.positiveDim }]}>
              <Text style={[styles.countText, { color: colors.positive }]}>{positiveCount} GOOD</Text>
            </View>
          )}
        </View>
      </View>

      {/* Signal rows */}
      {signals.map((signal, i) => (
        <SignalRow
          key={signal.type}
          signal={signal}
          isLast={i === signals.length - 1}
        />
      ))}

      {/* Footer: tap hint */}
      <Text style={styles.footerHint}>Tap any pattern to see details and next steps</Text>
    </Card>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  card: {
    padding: 0,
    overflow: 'hidden',
  },
  header: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    padding:        spacing.xl,
    paddingBottom:  spacing.md,
  },
  sectionLabel: {
    color:         colors.textMuted,
    fontSize:      11,
    fontWeight:    FontWeight.medium,
    letterSpacing: 0.6,
  },
  countRow: {
    flexDirection: 'row',
    gap:           spacing.xs,
  },
  countBadge: {
    paddingHorizontal: 6,
    paddingVertical:   3,
    borderRadius:      Radius.sm,
  },
  countText: {
    fontSize:      9,
    fontWeight:    FontWeight.black,
    letterSpacing: 0.5,
  },
  footerHint: {
    color:          colors.textSubtle,
    fontSize:       10,
    textAlign:      'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  });
}
