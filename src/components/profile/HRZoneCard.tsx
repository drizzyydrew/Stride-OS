import { StyleSheet, Text, View } from 'react-native';

import Card from '../ui/Card';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { FontSize, FontWeight, Radius } from '../../theme/tokens';
import type { HRZoneEntry, CalibrationOutput } from '../../types/athlete';

type Props = {
  calibration: CalibrationOutput;
};

const ZONE_COLOR: Record<number, string> = {
  1: '#4ADE80',
  2: '#60A5FA',
  3: '#818CF8',
  4: '#F59E0B',
  5: '#F87171',
};

const ZONE_BG: Record<number, string> = {
  1: '#052E16',
  2: '#0C1A3D',
  3: '#1E0A4A',
  4: '#451A03',
  5: '#450A0A',
};

function HRZoneRow({
  entry,
  isLast,
  hasHRMax,
}: {
  entry:    HRZoneEntry;
  isLast:   boolean;
  hasHRMax: boolean;
}) {
  const color = ZONE_COLOR[entry.zone] ?? colors.textDim;
  const bg    = ZONE_BG[entry.zone]    ?? colors.border;

  const bpmLabel = hasHRMax && entry.minBPM !== null && entry.maxBPM !== null
    ? `${entry.minBPM}–${entry.maxBPM} bpm`
    : `${entry.minPct}–${entry.maxPct}% HRmax`;

  return (
    <View style={[row.wrap, !isLast && row.bordered]}>
      <View style={[row.colorBar, { backgroundColor: color }]} />
      <View style={row.main}>
        <View style={row.labelRow}>
          <View style={[row.zoneBadge, { backgroundColor: bg }]}>
            <Text style={[row.zoneText, { color }]}>Z{entry.zone}</Text>
          </View>
          <Text style={[row.label, { color }]}>{entry.label}</Text>
          <Text style={row.rpe}>RPE {entry.rpeRange[0]}–{entry.rpeRange[1]}</Text>
        </View>
        <Text style={row.bpm}>{bpmLabel}</Text>
        <Text style={row.pct}>
          {entry.minPct}–{entry.maxPct}% of max heart rate
        </Text>
      </View>
    </View>
  );
}

const row = StyleSheet.create({
  wrap: {
    flexDirection:   'row',
    gap:             spacing.sm,
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
  zoneBadge: {
    paddingHorizontal: 5,
    paddingVertical:   1,
    borderRadius:      Radius.sm,
  },
  zoneText: {
    fontSize:      8,
    fontWeight:    FontWeight.black,
    letterSpacing: 0.4,
  },
  label: {
    fontSize:   FontSize.sm,
    fontWeight: FontWeight.black,
    flex:       1,
  },
  rpe: {
    color:    colors.textSubtle,
    fontSize: 9,
  },
  bpm: {
    color:      colors.text,
    fontSize:   FontSize.md,
    fontWeight: FontWeight.black,
  },
  pct: {
    color:    colors.textDim,
    fontSize: 9,
  },
});

export default function HRZoneCard({ calibration }: Props) {
  const hasHRMax = calibration.estimatedHRMax !== null;

  return (
    <Card style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionLabel}>HEART RATE ZONES</Text>
        {hasHRMax ? (
          <View style={styles.hrMaxBadge}>
            <Text style={styles.hrMaxText}>HRmax {calibration.estimatedHRMax}</Text>
          </View>
        ) : (
          <View style={[styles.hrMaxBadge, styles.hrMaxBadgeDim]}>
            <Text style={styles.hrMaxTextDim}>HRmax unknown</Text>
          </View>
        )}
      </View>

      <Text style={styles.helper}>
        {hasHRMax
          ? 'Zones derived from estimated max heart rate using Friel 5-zone model.'
          : 'Add age, measured HRmax, or threshold HR to see absolute BPM ranges.'}
      </Text>

      {calibration.hrZones.map((entry, i) => (
        <HRZoneRow
          key={entry.zone}
          entry={entry}
          isLast={i === calibration.hrZones.length - 1}
          hasHRMax={hasHRMax}
        />
      ))}

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Friel 5-zone model · Tanaka HRmax formula (208 − 0.7 × age)
        </Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    padding:  0,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection:   'row',
    justifyContent:  'space-between',
    alignItems:      'center',
    padding:         spacing.xl,
    paddingBottom:   spacing.sm,
  },
  sectionLabel: {
    color:         colors.textMuted,
    fontSize:      11,
    fontWeight:    FontWeight.medium,
    letterSpacing: 0.6,
  },
  hrMaxBadge: {
    backgroundColor:  colors.primaryDim,
    borderRadius:     Radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical:  3,
  },
  hrMaxBadgeDim: {
    backgroundColor: colors.border,
  },
  hrMaxText: {
    color:         colors.primary,
    fontSize:      10,
    fontWeight:    FontWeight.black,
    letterSpacing: 0.4,
  },
  hrMaxTextDim: {
    color:         colors.textSubtle,
    fontSize:      10,
    fontWeight:    FontWeight.black,
    letterSpacing: 0.4,
  },
  helper: {
    color:             colors.textSubtle,
    fontSize:          9,
    lineHeight:        13,
    paddingHorizontal: spacing.xl,
    marginBottom:      spacing.sm,
  },
  footer: {
    borderTopWidth:    1,
    borderTopColor:    colors.border,
    paddingVertical:   spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  footerText: {
    color:     colors.textSubtle,
    fontSize:  9,
    textAlign: 'center',
  },
});
