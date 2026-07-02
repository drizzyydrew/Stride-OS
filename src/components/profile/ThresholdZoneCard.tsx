import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Card from '../ui/Card';
import { formatPace } from '../../utils/calibrationEngine';
import { useThemeColors, zoneTint, zoneTintBg, type ThemeColors } from '../../theme/ThemeContext';
import { spacing } from '../../theme/spacing';
import { FontSize, FontWeight, Radius } from '../../theme/tokens';
import type { ThresholdZoneEntry } from '../../types/athlete';

type Props = {
  zones:              ThresholdZoneEntry[];
  thresholdPaceSec:   number;   // for display
  lthr:               number;   // for display
};

const ZONE_ORDER = ['1', '2', '3', '4', '5a', '5b', '5c'];

function ThresholdZoneRow({
  entry,
  isLast,
}: {
  entry:  ThresholdZoneEntry;
  isLast: boolean;
}) {
  const colors = useThemeColors();
  const row    = useMemo(() => createRowStyles(colors), [colors]);
  const idx    = Math.max(ZONE_ORDER.indexOf(entry.zone), 0);
  const color  = zoneTint(colors, idx, ZONE_ORDER.length);
  const bg     = zoneTintBg(colors, idx, ZONE_ORDER.length);

  // Build pace display string
  let paceStr = '';
  if (entry.paceMinSecPerMi === null && entry.paceMaxSecPerMi !== null) {
    paceStr = `Slower than ${formatPace(entry.paceMaxSecPerMi)}/mi`;
  } else if (entry.paceMaxSecPerMi === null && entry.paceMinSecPerMi !== null) {
    paceStr = `Faster than ${formatPace(entry.paceMinSecPerMi)}/mi`;
  } else if (entry.paceMinSecPerMi !== null && entry.paceMaxSecPerMi !== null) {
    paceStr = `${formatPace(entry.paceMinSecPerMi)}–${formatPace(entry.paceMaxSecPerMi)}/mi`;
  }

  // Build HR display string
  let hrStr = '';
  if (entry.hrMinBPM === null && entry.hrMaxBPM !== null) {
    hrStr = `< ${entry.hrMaxBPM} bpm`;
  } else if (entry.hrMaxBPM === null && entry.hrMinBPM !== null) {
    hrStr = `> ${entry.hrMinBPM} bpm`;
  } else if (entry.hrMinBPM !== null && entry.hrMaxBPM !== null) {
    hrStr = `${entry.hrMinBPM}–${entry.hrMaxBPM} bpm`;
  }

  return (
    <View style={[row.wrap, !isLast && row.bordered]}>
      <View style={[row.colorBar, { backgroundColor: color }]} />
      <View style={row.main}>
        <View style={row.nameRow}>
          <View style={[row.zoneBadge, { backgroundColor: bg }]}>
            <Text style={[row.zoneText, { color }]}>Z{entry.zone}</Text>
          </View>
          <Text style={[row.label, { color }]} numberOfLines={1}>{entry.label}</Text>
        </View>
        <View style={row.valuesRow}>
          {paceStr !== '' && (
            <View style={row.valueBlock}>
              <Text style={row.valueLabel}>Pace</Text>
              <Text style={row.value}>{paceStr}</Text>
            </View>
          )}
          {hrStr !== '' && (
            <View style={row.valueBlock}>
              <Text style={row.valueLabel}>HR</Text>
              <Text style={row.value}>{hrStr}</Text>
            </View>
          )}
        </View>
        <Text style={row.desc} numberOfLines={2}>{entry.description}</Text>
        <Text style={row.rpe}>RPE {entry.rpeRange[0]}–{entry.rpeRange[1]}</Text>
      </View>
    </View>
  );
}

function createRowStyles(colors: ThemeColors) {
  return StyleSheet.create({
  wrap:      { flexDirection: 'row', gap: spacing.sm, paddingVertical: spacing.md },
  bordered:  { borderBottomWidth: 1, borderBottomColor: colors.border },
  colorBar:  { width: 3, borderRadius: 2, alignSelf: 'stretch', flexShrink: 0 },
  main:      { flex: 1, gap: 4 },
  nameRow:   { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  zoneBadge: { paddingHorizontal: 5, paddingVertical: 2, borderRadius: Radius.sm, flexShrink: 0 },
  zoneText:  { fontSize: 8, fontWeight: FontWeight.black, letterSpacing: 0.4 },
  label:     { fontSize: FontSize.sm, fontWeight: FontWeight.black, flex: 1 },
  valuesRow: { flexDirection: 'row', gap: spacing.xl },
  valueBlock:{ gap: 1 },
  valueLabel:{ color: colors.textDim, fontSize: 8, textTransform: 'uppercase', letterSpacing: 0.4 },
  value:     { color: colors.text, fontSize: FontSize.sm, fontWeight: FontWeight.black },
  desc:      { color: colors.textDim, fontSize: 9, lineHeight: 14 },
  rpe:       { color: colors.textMuted, fontSize: 9 },
  });
}

export default function ThresholdZoneCard({ zones, thresholdPaceSec, lthr }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Card style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionLabel}>THRESHOLD ZONES — 7-ZONE</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>Friel Method</Text>
        </View>
      </View>

      <View style={styles.refRow}>
        <View style={styles.refItem}>
          <Text style={styles.refLabel}>Threshold Pace</Text>
          <Text style={styles.refValue}>{formatPace(thresholdPaceSec)}/mi</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.refItem}>
          <Text style={styles.refLabel}>LTHR</Text>
          <Text style={styles.refValue}>{lthr} bpm</Text>
        </View>
      </View>

      <Text style={styles.helper}>
        Based on your 30-min threshold field test. Zones derived from % of threshold speed and LTHR.
      </Text>

      <View style={styles.sourceRow}>
        <View style={styles.sourceDot} />
        <Text style={styles.sourceLabel}>
          Field Test: 30-min threshold test · Joe Friel methodology
        </Text>
      </View>

      {zones.map((entry, i) => (
        <ThresholdZoneRow key={entry.zone} entry={entry} isLast={i === zones.length - 1} />
      ))}

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Threshold-based zones · FTP-style pace and LTHR percentage methodology
        </Text>
      </View>
    </Card>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  card:       { padding: 0, overflow: 'hidden' },
  headerRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.xl, paddingBottom: spacing.sm },
  sectionLabel: { color: colors.textMuted, fontSize: 11, fontWeight: FontWeight.medium, letterSpacing: 0.6 },
  badge:      { backgroundColor: colors.primaryDim, borderRadius: Radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  badgeText:  { color: colors.primary, fontSize: 10, fontWeight: FontWeight.black, letterSpacing: 0.4 },
  refRow:     { flexDirection: 'row', paddingHorizontal: spacing.xl, marginBottom: spacing.sm, gap: spacing.lg, alignItems: 'center' },
  refItem:    { gap: 2 },
  refLabel:   { color: colors.textDim, fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.4 },
  refValue:   { color: colors.text, fontSize: FontSize.base, fontWeight: FontWeight.black },
  divider:    { width: 1, height: 28, backgroundColor: colors.border },
  helper:     { color: colors.textSubtle, fontSize: 9, lineHeight: 13, paddingHorizontal: spacing.xl, marginBottom: spacing.xs },
  sourceRow:  { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.xl, marginBottom: spacing.sm },
  sourceDot:  { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.primary, flexShrink: 0 },
  sourceLabel:{ color: colors.primary, fontSize: 9, flex: 1 },
  footer:     { borderTopWidth: 1, borderTopColor: colors.border, paddingVertical: spacing.sm, paddingHorizontal: spacing.xl, marginTop: spacing.xs },
  footerText: { color: colors.textSubtle, fontSize: 9, textAlign: 'center' },
  });
}
