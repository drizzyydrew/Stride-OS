import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import Card from '../ui/Card';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { FontSize, FontWeight, Radius } from '../../theme/tokens';
import type {
  PhaseRationale,
  ProgressionSafeguard,
  PhaseIntegrityFlag,
  MesocyclePosition,
} from '../../types/periodization';
import type { TrainingPhase } from '../../types/training';

type Props = {
  rationale:      PhaseRationale;
  safeguards:     ProgressionSafeguard[];
  integrityFlags: PhaseIntegrityFlag[];
  mesocycle:      MesocyclePosition;
  trainingPhase:  TrainingPhase;
  weeksRemaining: number;
};

// ─── Phase badge colors ────────────────────────────────────────────────────────

const PHASE_COLOR: Record<TrainingPhase, string> = {
  base:   '#2563EB',
  build:  '#7C3AED',
  peak:   '#9333EA',
  deload: '#F59E0B',
  taper:  '#22C55E',
};

const PHASE_BG: Record<TrainingPhase, string> = {
  base:   '#0C1A3D',
  build:  '#1E0A4A',
  peak:   '#3B0764',
  deload: '#451A03',
  taper:  '#052E16',
};

const PHASE_NAME: Record<TrainingPhase, string> = {
  base:   'BASE',
  build:  'BUILD',
  peak:   'PEAK',
  deload: 'DELOAD',
  taper:  'TAPER',
};

// ─── Safeguard row ────────────────────────────────────────────────────────────

function SafeguardRow({ sg, isLast }: { sg: ProgressionSafeguard; isLast: boolean }) {
  const [open, setOpen] = useState(false);
  const color = sg.severity === 'critical' ? colors.critical : colors.warning;
  const bg    = sg.severity === 'critical' ? colors.criticalDim : colors.warningDim;

  return (
    <View style={[sgr.wrap, !isLast && sgr.bordered]}>
      <TouchableOpacity
        onPress={() => setOpen(o => !o)}
        activeOpacity={0.7}
        style={sgr.header}
      >
        <View style={[sgr.dot, { backgroundColor: color }]} />
        <Text style={[sgr.message, { flex: 1 }]}>{sg.message}</Text>
        <View style={[sgr.badge, { backgroundColor: bg }]}>
          <Text style={[sgr.badgeText, { color }]}>
            {sg.severity === 'critical' ? 'CRITICAL' : 'WATCH'}
          </Text>
        </View>
      </TouchableOpacity>
      {open && (
        <View style={[sgr.detail, { borderColor: color + '40' }]}>
          <Text style={sgr.rec}>{sg.recommendation}</Text>
        </View>
      )}
    </View>
  );
}

const sgr = StyleSheet.create({
  wrap: {
    gap: spacing.xs,
  },
  bordered: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom:     spacing.sm,
    marginBottom:      spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems:    'flex-start',
    gap:           spacing.sm,
  },
  dot: {
    width:        7,
    height:       7,
    borderRadius: 4,
    marginTop:    4,
    flexShrink:   0,
  },
  message: {
    color:      colors.textDim,
    fontSize:   FontSize.sm,
    lineHeight: 20,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical:   2,
    borderRadius:      Radius.sm,
    flexShrink:        0,
  },
  badgeText: {
    fontSize:      8,
    fontWeight:    FontWeight.black,
    letterSpacing: 0.5,
  },
  detail: {
    borderWidth:  1,
    borderRadius: Radius.sm,
    padding:      spacing.sm,
    marginLeft:   15,
  },
  rec: {
    color:      colors.textDim,
    fontSize:   FontSize.sm,
    lineHeight: 20,
  },
});

// ─── Integrity flag row ───────────────────────────────────────────────────────

function IntegrityFlagRow({ flag }: { flag: PhaseIntegrityFlag }) {
  const isProtected = flag.protected;
  const color       = isProtected ? colors.positive : '#60A5FA';
  const bg          = isProtected ? colors.positiveDim : colors.primaryDim;
  const icon        = isProtected ? '🔒' : '⚡';

  return (
    <View style={[ifr.wrap, { backgroundColor: bg, borderColor: color + '30' }]}>
      <Text style={ifr.icon}>{icon}</Text>
      <Text style={[ifr.message, { color }]}>{flag.message}</Text>
    </View>
  );
}

const ifr = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems:    'flex-start',
    gap:           spacing.sm,
    borderWidth:   1,
    borderRadius:  Radius.sm,
    padding:       spacing.sm,
  },
  icon: {
    fontSize:  12,
    flexShrink: 0,
  },
  message: {
    flex:       1,
    fontSize:   FontSize.sm,
    lineHeight: 20,
  },
});

// ─── Rationale section ────────────────────────────────────────────────────────

function RationaleSection({ label, body, accentColor }: {
  label:       string;
  body:        string;
  accentColor?: string;
}) {
  return (
    <View style={rs.wrap}>
      <Text style={[rs.label, accentColor ? { color: accentColor } : {}]}>{label}</Text>
      <Text style={rs.body}>{body}</Text>
    </View>
  );
}

const rs = StyleSheet.create({
  wrap: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop:     spacing.md,
    gap:            spacing.xs,
  },
  label: {
    color:         colors.textMuted,
    fontSize:      10,
    fontWeight:    FontWeight.black,
    letterSpacing: 0.7,
  },
  body: {
    color:      colors.textDim,
    fontSize:   FontSize.sm,
    lineHeight: 20,
  },
});

// ─── Main card ─────────────────────────────────────────────────────────────────

export default function PeriodizationSummaryCard({
  rationale,
  safeguards,
  integrityFlags,
  mesocycle,
  trainingPhase,
  weeksRemaining,
}: Props) {
  const phaseColor = PHASE_COLOR[trainingPhase];
  const phaseBg    = PHASE_BG[trainingPhase];

  return (
    <Card>
      {/* Header: phase badge + mesocycle position + weeks remaining */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Text style={styles.sectionLabel}>PERIODIZATION SUMMARY</Text>
          <View style={styles.titleRow}>
            <View style={[styles.phaseBadge, { backgroundColor: phaseBg }]}>
              <Text style={[styles.phaseText, { color: phaseColor }]}>{PHASE_NAME[trainingPhase]}</Text>
            </View>
            <Text style={styles.title}>
              Block {mesocycle.blockNumber}  ·  W{mesocycle.weekInBlock}/4
              {mesocycle.isDeload ? '  (Deload)' : mesocycle.isLoadingPeak ? '  (Peak Load)' : ''}
            </Text>
          </View>
        </View>
        <View style={styles.weeksLeft}>
          <Text style={styles.weeksNum}>{weeksRemaining}</Text>
          <Text style={styles.weeksLabel}>wks left</Text>
        </View>
      </View>

      {/* Integrity flags — always show (protected before advisory) */}
      {integrityFlags.length > 0 && (
        <View style={styles.flagsSection}>
          <Text style={styles.flagsSectionLabel}>PHASE INTEGRITY</Text>
          <View style={styles.flagsList}>
            {integrityFlags
              .sort((a, b) => Number(b.protected) - Number(a.protected))
              .map(flag => (
                <IntegrityFlagRow key={flag.type} flag={flag} />
              ))}
          </View>
        </View>
      )}

      {/* Safeguards — only show when active */}
      {safeguards.length > 0 && (
        <View style={styles.safeguardsSection}>
          <View style={styles.safeguardsHeader}>
            <Text style={styles.safeguardsSectionLabel}>ACTIVE SAFEGUARDS</Text>
            <Text style={styles.safeguardsHint}>Tap to see recommendations</Text>
          </View>
          {safeguards.map((sg, i) => (
            <SafeguardRow key={sg.type} sg={sg} isLast={i === safeguards.length - 1} />
          ))}
        </View>
      )}

      {/* Rationale: key focus highlighted first */}
      <View style={styles.rationaleSection}>
        <View style={[styles.keyFocusBox, { borderColor: phaseColor + '40' }]}>
          <Text style={[styles.keyFocusLabel, { color: phaseColor }]}>KEY FOCUS THIS WEEK</Text>
          <Text style={[styles.keyFocusBody, { color: colors.text }]}>{rationale.keyFocus}</Text>
        </View>

        <RationaleSection label="WHY THIS PHASE" body={rationale.whyThisPhase} />
        <RationaleSection label="ADAPTATION TARGET" body={rationale.adaptationTarget} />
        <RationaleSection
          label="SUCCESS CRITERIA"
          body={rationale.successCriteria}
          accentColor={phaseColor}
        />
      </View>
    </Card>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  headerRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'flex-start',
    marginBottom:   spacing.lg,
  },
  headerLeft: {
    flex: 1,
    gap:  spacing.xs,
  },
  sectionLabel: {
    color:         colors.textMuted,
    fontSize:      11,
    fontWeight:    FontWeight.medium,
    letterSpacing: 0.6,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.sm,
    flexWrap:      'wrap',
  },
  phaseBadge: {
    paddingHorizontal: 8,
    paddingVertical:   3,
    borderRadius:      Radius.sm,
  },
  phaseText: {
    fontSize:      10,
    fontWeight:    FontWeight.black,
    letterSpacing: 0.7,
  },
  title: {
    color:      colors.text,
    fontSize:   FontSize.sm,
    fontWeight: FontWeight.bold,
  },
  weeksLeft: {
    alignItems: 'center',
    gap:        2,
  },
  weeksNum: {
    color:      colors.text,
    fontSize:   28,
    fontWeight: FontWeight.black,
    lineHeight: 30,
  },
  weeksLabel: {
    color:         colors.textMuted,
    fontSize:      9,
    fontWeight:    FontWeight.black,
    letterSpacing: 0.5,
  },
  flagsSection: {
    marginBottom: spacing.lg,
    gap:          spacing.sm,
  },
  flagsSectionLabel: {
    color:         colors.textMuted,
    fontSize:      10,
    fontWeight:    FontWeight.black,
    letterSpacing: 0.7,
  },
  flagsList: {
    gap: spacing.xs,
  },
  safeguardsSection: {
    borderWidth:   1,
    borderColor:   colors.warningDim,
    borderRadius:  Radius.sm,
    padding:       spacing.md,
    marginBottom:  spacing.lg,
    gap:           spacing.sm,
    backgroundColor: colors.warningDim + '40',
  },
  safeguardsHeader: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
  },
  safeguardsSectionLabel: {
    color:         colors.warning,
    fontSize:      10,
    fontWeight:    FontWeight.black,
    letterSpacing: 0.7,
  },
  safeguardsHint: {
    color:    colors.textSubtle,
    fontSize: 9,
  },
  rationaleSection: {
    gap: spacing.md,
  },
  keyFocusBox: {
    borderWidth:  1,
    borderRadius: Radius.sm,
    padding:      spacing.md,
    gap:          spacing.xs,
  },
  keyFocusLabel: {
    fontSize:      10,
    fontWeight:    FontWeight.black,
    letterSpacing: 0.7,
  },
  keyFocusBody: {
    fontSize:   FontSize.sm,
    lineHeight: 20,
  },
});
