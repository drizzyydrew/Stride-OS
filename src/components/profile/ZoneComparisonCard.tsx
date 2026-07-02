import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Card from '../ui/Card';
import { formatPace, formatRaceTime } from '../../utils/calibrationEngine';
import { useThemeColors, zoneTint, type ThemeColors } from '../../theme/ThemeContext';
import { spacing } from '../../theme/spacing';
import { FontSize, FontWeight, Radius } from '../../theme/tokens';
import type { CalibrationOutput, ZoneMethod } from '../../types/athlete';

type Props = {
  calibration:     CalibrationOutput;
  onMethodChange?: (method: ZoneMethod) => void;
};

type MethodTab = {
  key:   ZoneMethod;
  label: string;
  short: string;
};

const METHODS: MethodTab[] = [
  { key: 'vdot',             label: 'VDOT',             short: 'VDOT'   },
  { key: 'tanaka_karvonen',  label: 'Tanaka + Karvonen', short: 'T+K'   },
  { key: 'manual_karvonen',  label: 'Manual + Karvonen', short: 'M+K'   },
  { key: 'threshold',        label: 'Threshold Test',    short: 'FTP'   },
  { key: 'race_prediction',  label: 'Race Predictions',  short: 'Races' },
];

const ZONE_STEPS = 5;

function PaceRow({ label, pace, color }: { label: string; pace: string; color: string }) {
  const colors  = useThemeColors();
  const compare = useMemo(() => createCompareStyles(colors), [colors]);
  return (
    <View style={compare.row}>
      <Text style={compare.rowLabel}>{label}</Text>
      <Text style={[compare.rowValue, { color }]}>{pace}</Text>
    </View>
  );
}

function HRRow({ label, bpm, color }: { label: string; bpm: string; color: string }) {
  const colors  = useThemeColors();
  const compare = useMemo(() => createCompareStyles(colors), [colors]);
  return (
    <View style={compare.row}>
      <Text style={compare.rowLabel}>{label}</Text>
      <Text style={[compare.rowValue, { color }]}>{bpm}</Text>
    </View>
  );
}

function VDOTPaceContent({ calibration }: { calibration: CalibrationOutput }) {
  const colors  = useThemeColors();
  const compare = useMemo(() => createCompareStyles(colors), [colors]);
  const keys = ['recovery', 'easy', 'marathon', 'threshold', 'vo2', 'rep'];
  return (
    <View style={compare.content}>
      <Text style={compare.sectionTitle}>Pace Zones · Jack Daniels VDOT {calibration.vdot.toFixed(1)}</Text>
      {keys.map((k, i) => {
        const z = calibration.paceZones[k];
        if (!z) return null;
        const color = zoneTint(colors, Math.min(i, ZONE_STEPS - 1), ZONE_STEPS);
        return (
          <PaceRow
            key={k}
            label={z.label}
            pace={`${formatPace(z.minSecPerMi)}–${formatPace(z.maxSecPerMi)}/mi`}
            color={color}
          />
        );
      })}
      <Text style={compare.citation}>Jack Daniels · Daniels' Running Formula, 2005</Text>
    </View>
  );
}

function KarvonenContent({ calibration, isManual }: { calibration: CalibrationOutput; isManual: boolean }) {
  const colors  = useThemeColors();
  const compare = useMemo(() => createCompareStyles(colors), [colors]);
  const zones = calibration.karvonenZones;
  if (!zones) {
    return (
      <View style={compare.content}>
        <Text style={compare.unavailable}>
          {isManual
            ? 'Enter your measured HRmax and resting HR to unlock Karvonen zones.'
            : 'Enter age and resting HR to unlock Tanaka + Karvonen zones.'}
        </Text>
        <Text style={compare.citation}>Karvonen et al. 1957 · Tanaka et al. 2001</Text>
      </View>
    );
  }

  return (
    <View style={compare.content}>
      <Text style={compare.sectionTitle}>
        {isManual ? 'Manual HRmax + Karvonen HRR' : 'Tanaka Estimated HRmax + Karvonen HRR'}
      </Text>
      <Text style={compare.subTitle}>{calibration.hrMaxSource}</Text>
      {zones.map((z, i) => {
        const color = zoneTint(colors, Math.min(i, ZONE_STEPS - 1), ZONE_STEPS);
        const bpmStr = z.minBPM !== null && z.maxBPM !== null
          ? `${z.minBPM}–${z.maxBPM} bpm`
          : `${Math.round(z.minPct * 100)}–${Math.round(z.maxPct * 100)}% HRR`;
        return <HRRow key={z.zone} label={`Z${z.zone} ${z.label}`} bpm={bpmStr} color={color} />;
      })}
      <Text style={compare.citation}>
        {isManual ? 'Karvonen HRR · Karvonen et al. 1957' : 'Tanaka et al. 2001 · Karvonen HRR method'}
      </Text>
    </View>
  );
}

function ThresholdContent({ calibration }: { calibration: CalibrationOutput }) {
  const colors  = useThemeColors();
  const compare = useMemo(() => createCompareStyles(colors), [colors]);
  const zones = calibration.thresholdZones;
  if (!zones) {
    return (
      <View style={compare.content}>
        <Text style={compare.unavailable}>
          Complete a 30-minute threshold field test to unlock 7-zone threshold system.
        </Text>
        <Text style={compare.citation}>Joe Friel 30-min threshold field test protocol</Text>
      </View>
    );
  }

  return (
    <View style={compare.content}>
      <Text style={compare.sectionTitle}>Friel 7-Zone · Threshold-Based</Text>
      {zones.map((z, i) => {
        const color = zoneTint(colors, i, zones.length);
        let paceStr = '';
        if (z.paceMinSecPerMi !== null && z.paceMaxSecPerMi !== null)
          paceStr = `${formatPace(z.paceMinSecPerMi)}–${formatPace(z.paceMaxSecPerMi)}/mi`;
        else if (z.paceMinSecPerMi === null && z.paceMaxSecPerMi !== null)
          paceStr = `< ${formatPace(z.paceMaxSecPerMi)}/mi`;
        else if (z.paceMaxSecPerMi === null && z.paceMinSecPerMi !== null)
          paceStr = `> ${formatPace(z.paceMinSecPerMi)}/mi`;
        const hrStr = z.hrMinBPM !== null && z.hrMaxBPM !== null
          ? ` · ${z.hrMinBPM}–${z.hrMaxBPM} bpm`
          : z.hrMaxBPM !== null ? ` · <${z.hrMaxBPM} bpm`
          : z.hrMinBPM !== null ? ` · >${z.hrMinBPM} bpm` : '';
        return (
          <PaceRow
            key={z.zone}
            label={`Z${z.zone} ${z.label}`}
            pace={`${paceStr}${hrStr}`}
            color={color}
          />
        );
      })}
      <Text style={compare.citation}>Joe Friel · "Fast After 50" · 30-min threshold field test</Text>
    </View>
  );
}

function RacePredictionContent({ calibration }: { calibration: CalibrationOutput }) {
  const colors  = useThemeColors();
  const compare = useMemo(() => createCompareStyles(colors), [colors]);
  const preds = calibration.racePredictions;
  if (!preds) {
    return (
      <View style={compare.content}>
        <Text style={compare.unavailable}>Add a race PR to generate VDOT race time predictions.</Text>
      </View>
    );
  }

  return (
    <View style={compare.content}>
      <Text style={compare.sectionTitle}>Race Time Predictions · VDOT {calibration.vdot.toFixed(1)}</Text>
      {preds.map((p, i) => {
        const color = zoneTint(colors, Math.min(i, ZONE_STEPS - 1), ZONE_STEPS);
        const pace  = p.predictedSeconds > 0
          ? `${formatRaceTime(p.predictedSeconds)} (${formatPace(p.predictedSeconds / (p.distanceMeters / 1609.344))}/mi)`
          : '—';
        return <PaceRow key={p.distanceKey} label={p.distance} pace={pace} color={color} />;
      })}
      <Text style={compare.citation}>Jack Daniels VDOT model · Daniels' Running Formula, 2005</Text>
    </View>
  );
}

function createCompareStyles(colors: ThemeColors) {
  return StyleSheet.create({
  content:      { paddingHorizontal: spacing.xl, paddingBottom: spacing.md },
  sectionTitle: { color: colors.textMuted, fontSize: 10, fontWeight: FontWeight.medium, letterSpacing: 0.5, marginBottom: spacing.sm },
  subTitle:     { color: colors.textDim, fontSize: 9, marginBottom: spacing.sm },
  row:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: colors.border },
  rowLabel:     { color: colors.textMuted, fontSize: FontSize.xs, flex: 1 },
  rowValue:     { fontSize: FontSize.xs, fontWeight: FontWeight.bold, flex: 1, textAlign: 'right' },
  unavailable:  { color: colors.textDim, fontSize: FontSize.sm, lineHeight: 18, marginBottom: spacing.sm },
  citation:     { color: colors.textSubtle, fontSize: 8, marginTop: spacing.md, fontStyle: 'italic' },
  });
}

function isMethodAvailable(method: ZoneMethod, calibration: CalibrationOutput): boolean {
  if (method === 'threshold' && !calibration.thresholdZones) return false;
  if ((method === 'tanaka_karvonen' || method === 'manual_karvonen') && !calibration.karvonenZones) return false;
  if (method === 'race_prediction' && (!calibration.racePredictions || calibration.racePredictions.length === 0)) return false;
  return true;
}

export default function ZoneComparisonCard({ calibration, onMethodChange }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [active, setActive] = useState<ZoneMethod>(calibration.activeZoneMethod);

  function handleSelect(method: ZoneMethod) {
    setActive(method);
    onMethodChange?.(method);
  }

  return (
    <Card style={styles.card}>
      <Text style={styles.title}>Zone Method Comparison</Text>
      <Text style={styles.subtitle}>Cycle through methods to compare zones and predictions.</Text>

      {/* Tab strip */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroll}>
        <View style={styles.tabs}>
          {METHODS.map(m => {
            const available = isMethodAvailable(m.key, calibration);
            const isActive  = active === m.key;
            return (
              <Pressable
                key={m.key}
                onPress={() => handleSelect(m.key)}
                style={[
                  styles.tab,
                  isActive && styles.tabActive,
                  !available && styles.tabDisabled,
                ]}
              >
                <Text style={[styles.tabText, isActive && styles.tabTextActive, !available && styles.tabTextDisabled]}>
                  {m.short}
                </Text>
                {!available && <Text style={styles.lockDot}>·</Text>}
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      {/* Content panel */}
      {active === 'vdot'            && <VDOTPaceContent calibration={calibration} />}
      {active === 'tanaka_karvonen' && <KarvonenContent calibration={calibration} isManual={false} />}
      {active === 'manual_karvonen' && <KarvonenContent calibration={calibration} isManual={true} />}
      {active === 'threshold'       && <ThresholdContent calibration={calibration} />}
      {active === 'race_prediction' && <RacePredictionContent calibration={calibration} />}

      {/* Confidence footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Active method: {METHODS.find(m => m.key === active)?.label} ·{' '}
          Confidence: {calibration.confidenceLabel.toUpperCase()}
        </Text>
      </View>
    </Card>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  card:              { padding: 0, overflow: 'hidden' },
  title:             { color: colors.text, fontSize: FontSize.md, fontWeight: FontWeight.bold, padding: spacing.xl, paddingBottom: spacing.xs },
  subtitle:          { color: colors.textMuted, fontSize: 9, paddingHorizontal: spacing.xl, marginBottom: spacing.sm },
  tabScroll:         { flexGrow: 0 },
  tabs:              { flexDirection: 'row', paddingHorizontal: spacing.xl, gap: spacing.xs, paddingBottom: spacing.md },
  tab:               { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: Radius.sm, backgroundColor: colors.border },
  tabActive:         { backgroundColor: colors.primaryDim, borderWidth: 1, borderColor: colors.primary },
  tabDisabled:       { opacity: 0.45 },
  tabText:           { color: colors.textDim, fontSize: FontSize.xs, fontWeight: FontWeight.medium },
  tabTextActive:     { color: colors.primary, fontWeight: FontWeight.bold },
  tabTextDisabled:   { color: colors.textSubtle },
  lockDot:           { color: colors.textSubtle, fontSize: 6 },
  footer:            { borderTopWidth: 1, borderTopColor: colors.border, paddingVertical: spacing.sm, paddingHorizontal: spacing.xl },
  footerText:        { color: colors.textSubtle, fontSize: 9, textAlign: 'center' },
  });
}
