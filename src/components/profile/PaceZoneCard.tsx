import { StyleSheet, Text, View } from 'react-native';

import Card from '../ui/Card';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { FontSize, FontWeight, Radius } from '../../theme/tokens';
import { formatPace } from '../../utils/calibrationEngine';
import type { PaceZoneEntry, CalibrationOutput } from '../../types/athlete';

type Props = {
  calibration: CalibrationOutput;
};

const ZONE_COLOR: Record<string, string> = {
  recovery:  '#4ADE80',
  easy:      '#60A5FA',
  marathon:  '#818CF8',
  threshold: '#F59E0B',
  vo2:       '#F87171',
  rep:       '#FCA5A5',
};

const ZONE_BG: Record<string, string> = {
  recovery:  '#052E16',
  easy:      '#0C1A3D',
  marathon:  '#1E0A4A',
  threshold: '#451A03',
  vo2:       '#450A0A',
  rep:       '#3B0404',
};

const ZONE_ORDER = ['recovery', 'easy', 'marathon', 'threshold', 'vo2', 'rep'];

function PaceZoneRow({
  zoneKey,
  entry,
  isLast,
}: {
  zoneKey: string;
  entry:   PaceZoneEntry;
  isLast:  boolean;
}) {
  const color = ZONE_COLOR[zoneKey] ?? colors.textDim;
  const bg    = ZONE_BG[zoneKey]    ?? colors.border;

  return (
    <View style={[row.wrap, !isLast && row.bordered]}>
      <View style={[row.colorBar, { backgroundColor: color }]} />
      <View style={row.main}>
        <View style={row.labelRow}>
          <Text style={[row.label, { color }]}>{entry.label}</Text>
          <View style={[row.hrBadge, { backgroundColor: bg }]}>
            <Text style={[row.hrBadgeText, { color }]}>Z{entry.hrZone}</Text>
          </View>
          <Text style={row.rpe}>RPE {entry.rpeRange[0]}–{entry.rpeRange[1]}</Text>
        </View>
        <Text style={row.pace}>
          {formatPace(entry.minSecPerMi)}–{formatPace(entry.maxSecPerMi)}/mi
        </Text>
        <Text style={row.desc}>{entry.description}</Text>
      </View>
    </View>
  );
}

const row = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    gap:           spacing.sm,
    paddingVertical: spacing.md,
  },
  bordered: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  colorBar: {
    width:        3,
    borderRadius: 2,
    alignSelf:    'stretch',
    flexShrink:   0,
  },
  main: {
    flex: 1,
    gap:  spacing.xs,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.sm,
  },
  label: {
    fontSize:   FontSize.sm,
    fontWeight: FontWeight.black,
    flex:       1,
  },
  hrBadge: {
    paddingHorizontal: 5,
    paddingVertical:   1,
    borderRadius:      Radius.sm,
  },
  hrBadgeText: {
    fontSize:      8,
    fontWeight:    FontWeight.black,
    letterSpacing: 0.4,
  },
  rpe: {
    color:    colors.textSubtle,
    fontSize: 9,
  },
  pace: {
    color:      colors.text,
    fontSize:   FontSize.md,
    fontWeight: FontWeight.black,
  },
  desc: {
    color:      colors.textDim,
    fontSize:   9,
    lineHeight: 14,
  },
});

export default function PaceZoneCard({ calibration }: Props) {
  const orderedKeys = ZONE_ORDER.filter(k => calibration.paceZones[k]);

  return (
    <Card style={styles.card}>
      {/* Header */}
      <View style={styles.headerRow}>
        <Text style={styles.sectionLabel}>PACE ZONES</Text>
        <View style={styles.vdotBadge}>
          <Text style={styles.vdotText}>VDOT {calibration.vdot.toFixed(1)}</Text>
        </View>
      </View>

      <Text style={styles.helper}>
        Derived from Jack Daniels VDOT model. Zones calibrated to your current fitness level.
      </Text>

      {/* Zone rows */}
      {orderedKeys.map((key, i) => {
        const entry = calibration.paceZones[key];
        if (!entry) return null;
        return (
          <PaceZoneRow
            key={key}
            zoneKey={key}
            entry={entry}
            isLast={i === orderedKeys.length - 1}
          />
        );
      })}

      {/* Confidence footnote */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Confidence: {calibration.confidenceLabel.toUpperCase()} ·{' '}
          Source: {calibration.primarySource.replace(/_/g, ' ')}
        </Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 0,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    padding:        spacing.xl,
    paddingBottom:  spacing.sm,
  },
  sectionLabel: {
    color:         colors.textMuted,
    fontSize:      11,
    fontWeight:    FontWeight.medium,
    letterSpacing: 0.6,
  },
  vdotBadge: {
    backgroundColor: colors.primaryDim,
    borderRadius:    Radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical:   3,
  },
  vdotText: {
    color:         colors.primary,
    fontSize:      10,
    fontWeight:    FontWeight.black,
    letterSpacing: 0.4,
  },
  helper: {
    color:           colors.textSubtle,
    fontSize:        9,
    lineHeight:      13,
    paddingHorizontal: spacing.xl,
    marginBottom:    spacing.sm,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  footerText: {
    color:    colors.textSubtle,
    fontSize: 9,
    textAlign: 'center',
  },
});
