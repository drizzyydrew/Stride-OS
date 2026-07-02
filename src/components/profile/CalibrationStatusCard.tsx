import { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import Card from '../ui/Card';
import { useThemeColors, type ThemeColors } from '../../theme/ThemeContext';
import { spacing } from '../../theme/spacing';
import { FontSize, FontWeight, Radius } from '../../theme/tokens';
import type { CalibrationOutput, CalibrationConfidence } from '../../types/athlete';

type Props = {
  calibration:    CalibrationOutput | null;
  onRecalibrate?: () => void;
};

function confidenceColorMap(colors: ThemeColors): Record<CalibrationConfidence, string> {
  return {
    high:      colors.positive,
    moderate:  colors.primary,
    low:       colors.warning,
    estimated: colors.textDim,
  };
}

function confidenceBgMap(colors: ThemeColors): Record<CalibrationConfidence, string> {
  return {
    high:      colors.positiveDim,
    moderate:  colors.primaryDim,
    low:       colors.warningDim,
    estimated: colors.border,
  };
}

const CONFIDENCE_LABEL: Record<CalibrationConfidence, string> = {
  high:      'HIGH CONFIDENCE',
  moderate:  'MODERATE',
  low:       'LOW CONFIDENCE',
  estimated: 'ESTIMATED',
};

const SOURCE_LABEL: Record<string, string> = {
  race_pr:         'Race PR',
  threshold_test:  'Threshold Test',
  estimated:       'Estimated',
  default:         'Population Default',
};

// Confidence ring (simple segmented arc via borders).
function ConfidenceRing({ score, color }: { score: number; color: string }) {
  const colors = useThemeColors();
  const ring   = useMemo(() => createRingStyles(colors), [colors]);
  const pct = Math.round(score);
  return (
    <View style={ring.wrap}>
      <View style={[ring.outer, { borderColor: color + '30' }]}>
        <View style={[ring.inner, { borderColor: color }]}>
          <Text style={[ring.score, { color }]}>{pct}</Text>
          <Text style={ring.maxLabel}>/100</Text>
        </View>
      </View>
    </View>
  );
}

function createRingStyles(colors: ThemeColors) {
  return StyleSheet.create({
  wrap: {
    alignItems: 'center',
  },
  outer: {
    width:        72,
    height:       72,
    borderRadius: 36,
    borderWidth:  3,
    alignItems:   'center',
    justifyContent: 'center',
  },
  inner: {
    width:        56,
    height:       56,
    borderRadius: 28,
    borderWidth:  3,
    alignItems:   'center',
    justifyContent: 'center',
  },
  score: {
    fontSize:   FontSize.md,
    fontWeight: FontWeight.black,
    lineHeight: 18,
  },
  maxLabel: {
    color:    colors.textSubtle,
    fontSize: 8,
    lineHeight: 10,
  },
  });
}

function MissingInputRow({ text }: { text: string }) {
  const colors = useThemeColors();
  const mi     = useMemo(() => createMiStyles(colors), [colors]);
  return (
    <View style={mi.row}>
      <View style={mi.dot} />
      <Text style={mi.text}>{text}</Text>
    </View>
  );
}

function createMiStyles(colors: ThemeColors) {
  return StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems:    'flex-start',
    gap:           spacing.sm,
  },
  dot: {
    width:        5,
    height:       5,
    borderRadius: 3,
    backgroundColor: colors.warning,
    marginTop:    6,
    flexShrink:   0,
  },
  text: {
    flex:       1,
    color:      colors.textDim,
    fontSize:   FontSize.sm,
    lineHeight: 19,
  },
  });
}

export default function CalibrationStatusCard({ calibration, onRecalibrate }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  if (!calibration) {
    return (
      <Card>
        <Text style={styles.sectionLabel}>CALIBRATION</Text>
        <Text style={styles.uncalTitle}>Not yet calibrated</Text>
        <Text style={styles.uncalBody}>
          Calibration unlocks accurate pace zones, HR zones, and fitness tracking.
          Add a race PR or threshold pace to get started.
        </Text>
        {onRecalibrate && (
          <TouchableOpacity onPress={onRecalibrate} style={styles.calibrateBtn}>
            <Text style={styles.calibrateBtnText}>Run Calibration</Text>
          </TouchableOpacity>
        )}
      </Card>
    );
  }

  const color  = confidenceColorMap(colors)[calibration.confidenceLabel];
  const bg     = confidenceBgMap(colors)[calibration.confidenceLabel];
  const label  = CONFIDENCE_LABEL[calibration.confidenceLabel];
  const isStale = calibration.staleDays > 60;

  const daysAgo = calibration.staleDays === 999
    ? 'Never'
    : calibration.staleDays === 0
      ? 'Today'
      : `${calibration.staleDays}d ago`;

  return (
    <Card>
      {/* Header */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.sectionLabel}>CALIBRATION STATUS</Text>
          <View style={[styles.badge, { backgroundColor: bg }]}>
            <Text style={[styles.badgeText, { color }]}>{label}</Text>
          </View>
          <Text style={styles.meta}>
            Source: {SOURCE_LABEL[calibration.primarySource] ?? calibration.primarySource}
          </Text>
          <Text style={[styles.meta, isStale && { color: colors.warning }]}>
            Last updated: {daysAgo}{isStale ? ' — recalibrate recommended' : ''}
          </Text>
        </View>
        <ConfidenceRing score={calibration.confidenceScore} color={color} />
      </View>

      {/* VDOT display */}
      <View style={styles.vdotRow}>
        <View style={styles.vdotItem}>
          <Text style={styles.vdotValue}>{calibration.vdot.toFixed(1)}</Text>
          <Text style={styles.vdotLabel}>VDOT</Text>
        </View>
        {calibration.estimatedHRMax && (
          <>
            <View style={styles.vdotDivider} />
            <View style={styles.vdotItem}>
              <Text style={styles.vdotValue}>{calibration.estimatedHRMax}</Text>
              <Text style={styles.vdotLabel}>EST. HRmax</Text>
            </View>
          </>
        )}
        {(calibration.deconditioningFlags.length > 0 || calibration.fitnessImprovements.length > 0) && (
          <>
            <View style={styles.vdotDivider} />
            <View style={styles.vdotItem}>
              <Text style={[styles.vdotValue, {
                color: calibration.fitnessImprovements.length > 0 ? colors.positive : colors.warning,
              }]}>
                {calibration.fitnessImprovements.length > 0 ? '↑' : '↓'}
              </Text>
              <Text style={styles.vdotLabel}>TREND</Text>
            </View>
          </>
        )}
      </View>

      {/* Signals */}
      {calibration.fitnessImprovements.length > 0 && (
        <View style={[styles.signalBox, { borderColor: colors.positive + '40', backgroundColor: colors.positiveDim }]}>
          <Text style={[styles.signalLabel, { color: colors.positive }]}>FITNESS IMPROVING</Text>
          {calibration.fitnessImprovements.map((s, i) => (
            <Text key={i} style={[styles.signalText, { color: colors.positive }]}>• {s}</Text>
          ))}
        </View>
      )}

      {calibration.deconditioningFlags.length > 0 && (
        <View style={[styles.signalBox, { borderColor: colors.warning + '40', backgroundColor: colors.warningDim }]}>
          <Text style={[styles.signalLabel, { color: colors.warning }]}>DECONDITIONING SIGNAL</Text>
          {calibration.deconditioningFlags.map((s, i) => (
            <Text key={i} style={[styles.signalText, { color: colors.warning }]}>• {s}</Text>
          ))}
        </View>
      )}

      {/* Missing inputs */}
      {calibration.missingInputs.length > 0 && (
        <View style={styles.missingSection}>
          <Text style={styles.missingSectionLabel}>TO IMPROVE CALIBRATION</Text>
          <View style={styles.missingList}>
            {calibration.missingInputs.map((m, i) => (
              <MissingInputRow key={i} text={m} />
            ))}
          </View>
        </View>
      )}

      {onRecalibrate && (
        <TouchableOpacity onPress={onRecalibrate} style={styles.recalBtn}>
          <Text style={styles.recalBtnText}>Recalibrate Now</Text>
        </TouchableOpacity>
      )}
    </Card>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  sectionLabel: {
    color:         colors.textMuted,
    fontSize:      11,
    fontWeight:    FontWeight.medium,
    letterSpacing: 0.6,
    marginBottom:  spacing.sm,
  },
  headerRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'flex-start',
    marginBottom:   spacing.lg,
    gap:            spacing.md,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical:   3,
    borderRadius:      Radius.sm,
    alignSelf:         'flex-start',
    marginBottom:      spacing.sm,
  },
  badgeText: {
    fontSize:      10,
    fontWeight:    FontWeight.black,
    letterSpacing: 0.6,
  },
  meta: {
    color:    colors.textDim,
    fontSize: FontSize.sm,
    marginTop: 3,
  },
  vdotRow: {
    flexDirection:   'row',
    backgroundColor: colors.border,
    borderRadius:    Radius.sm,
    padding:         spacing.md,
    marginBottom:    spacing.md,
    alignItems:      'center',
  },
  vdotItem: {
    flex:       1,
    alignItems: 'center',
    gap:        2,
  },
  vdotDivider: {
    width:           1,
    height:          28,
    backgroundColor: colors.textSubtle,
    marginHorizontal: spacing.xs,
  },
  vdotValue: {
    color:      colors.text,
    fontSize:   FontSize.lg,
    fontWeight: FontWeight.black,
  },
  vdotLabel: {
    color:         colors.textMuted,
    fontSize:      8,
    fontWeight:    FontWeight.black,
    letterSpacing: 0.5,
  },
  signalBox: {
    borderWidth:  1,
    borderRadius: Radius.sm,
    padding:      spacing.sm,
    marginBottom: spacing.sm,
    gap:          spacing.xs,
  },
  signalLabel: {
    fontSize:      9,
    fontWeight:    FontWeight.black,
    letterSpacing: 0.5,
  },
  signalText: {
    fontSize:   FontSize.sm,
    lineHeight: 18,
  },
  missingSection: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop:     spacing.md,
    gap:            spacing.sm,
  },
  missingSectionLabel: {
    color:         colors.textMuted,
    fontSize:      10,
    fontWeight:    FontWeight.black,
    letterSpacing: 0.6,
  },
  missingList: {
    gap: spacing.xs,
  },
  recalBtn: {
    marginTop:         spacing.md,
    borderWidth:       1,
    borderColor:       colors.primary + '60',
    borderRadius:      Radius.sm,
    paddingVertical:   spacing.md,
    alignItems:        'center',
  },
  recalBtnText: {
    color:      colors.primary,
    fontSize:   FontSize.sm,
    fontWeight: FontWeight.bold,
  },
  uncalTitle: {
    color:        colors.text,
    fontSize:     FontSize.base,
    fontWeight:   FontWeight.black,
    marginBottom: spacing.sm,
  },
  uncalBody: {
    color:        colors.textDim,
    fontSize:     FontSize.sm,
    lineHeight:   19,
    marginBottom: spacing.md,
  },
  calibrateBtn: {
    backgroundColor: colors.primary,
    borderRadius:    Radius.sm,
    paddingVertical: spacing.md,
    alignItems:      'center',
  },
  calibrateBtnText: {
    color:      colors.text,
    fontSize:   FontSize.base,
    fontWeight: FontWeight.bold,
  },
  });
}
