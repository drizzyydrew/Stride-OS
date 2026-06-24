import { StyleSheet, Text, View } from 'react-native';

import Card from '../ui/Card';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { FontSize, FontWeight, Radius } from '../../theme/tokens';
import type { HRZoneEntry, CalibrationOutput } from '../../types/athlete';

type Props = {
  calibration: CalibrationOutput;
  // Optional: pass karvonenZones to show Karvonen instead of Friel HRmax zones
  useKarvonen?: boolean;
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
    : `${Math.round(entry.minPct * 100)}–${Math.round(entry.maxPct * 100)}% HRmax`;

  return (
    <View style={[row.wrap, !isLast && row.bordered]}>
      <View style={[row.colorBar, { backgroundColor: color }]} />
      <View style={row.main}>
        {/* Zone name + badge row — RPE on its own line to prevent clipping */}
        <View style={row.nameRow}>
          <View style={[row.zoneBadge, { backgroundColor: bg }]}>
            <Text style={[row.zoneText, { color }]}>Z{entry.zone}</Text>
          </View>
          <Text style={[row.label, { color }]} numberOfLines={1}>{entry.label}</Text>
        </View>
        {/* BPM value — prominent */}
        <Text style={row.bpm}>{bpmLabel}</Text>
        {/* Percentage + RPE on same line, both small */}
        <View style={row.metaRow}>
          <Text style={row.pct}>
            {Math.round(entry.minPct * 100)}–{Math.round(entry.maxPct * 100)}% max
          </Text>
          <Text style={row.rpe}>RPE {entry.rpeRange[0]}–{entry.rpeRange[1]}</Text>
        </View>
      </View>
    </View>
  );
}

const row = StyleSheet.create({
  wrap: {
    flexDirection:     'row',
    gap:               spacing.sm,
    paddingVertical:   spacing.md,
    paddingHorizontal: spacing.xl,
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
    gap:  4,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.sm,
  },
  zoneBadge: {
    paddingHorizontal: 5,
    paddingVertical:   2,
    borderRadius:      Radius.sm,
    flexShrink:        0,
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
  bpm: {
    color:      colors.text,
    fontSize:   FontSize.md,
    fontWeight: FontWeight.black,
  },
  metaRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
  },
  pct: {
    color:    colors.textDim,
    fontSize: 9,
  },
  rpe: {
    color:    colors.textMuted,
    fontSize: 9,
  },
});

export default function HRZoneCard({ calibration, useKarvonen }: Props) {
  const zones   = useKarvonen && calibration.karvonenZones
    ? calibration.karvonenZones
    : calibration.hrZones;
  const hasHRMax = calibration.estimatedHRMax !== null
    || calibration.hrZones.some(z => z.minBPM !== null);

  const methodLabel = useKarvonen && calibration.karvonenZones
    ? 'Karvonen Heart-Rate Reserve'
    : 'Friel 5-zone model';

  const sourceLabel = useKarvonen && calibration.karvonenZones
    ? 'Karvonen HRR method · Karvonen et al. 1957'
    : `${calibration.hrMaxSource} · Tanaka et al. 2001`;

  return (
    <Card style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionLabel}>HEART RATE ZONES</Text>
        {hasHRMax ? (
          <View style={styles.hrMaxBadge}>
            <Text style={styles.hrMaxText}>
              {calibration.estimatedHRMax ? `HRmax ~${calibration.estimatedHRMax}` : 'HRmax set'}
            </Text>
          </View>
        ) : (
          <View style={[styles.hrMaxBadge, styles.hrMaxBadgeDim]}>
            <Text style={styles.hrMaxTextDim}>HRmax unknown</Text>
          </View>
        )}
      </View>

      <Text style={styles.helper}>
        {methodLabel} · {hasHRMax
          ? 'Zones calibrated to your heart rate data.'
          : 'Add age or measured HRmax to see absolute BPM ranges.'}
      </Text>

      {/* Source label */}
      <View style={styles.sourceRow}>
        <View style={styles.sourceDot} />
        <Text style={styles.sourceLabel}>{calibration.hrMaxSource}</Text>
      </View>

      {zones.map((entry, i) => (
        <HRZoneRow
          key={entry.zone}
          entry={entry}
          isLast={i === zones.length - 1}
          hasHRMax={hasHRMax}
        />
      ))}

      <View style={styles.footer}>
        <Text style={styles.footerText}>{sourceLabel}</Text>
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
    backgroundColor:   colors.primaryDim,
    borderRadius:      Radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical:   3,
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
    marginBottom:      spacing.xs,
  },
  sourceRow: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing.xs,
    paddingHorizontal: spacing.xl,
    marginBottom:      spacing.sm,
  },
  sourceDot: {
    width:  5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.primary,
    flexShrink: 0,
  },
  sourceLabel: {
    color:    colors.primary,
    fontSize: 9,
    flex:     1,
  },
  footer: {
    borderTopWidth:    1,
    borderTopColor:    colors.border,
    paddingVertical:   spacing.sm,
    paddingHorizontal: spacing.xl,
    marginTop:         spacing.xs,
  },
  footerText: {
    color:     colors.textSubtle,
    fontSize:  9,
    textAlign: 'center',
  },
});
