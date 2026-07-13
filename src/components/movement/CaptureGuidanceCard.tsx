// ─── Capture Guidance Card ─────────────────────────────────────────────────────
//
// Shown BEFORE recording a readiness test or standalone analysis: the Dion
// registry illustration for the exact view required, plus the step's
// plain-language instructions and must-be-visible list.
//
// Contract (pinned, docs/build36-sequential-execution-plan.md §4.3):
//   { dion: DionAssessmentImages; instructions: string[]; mustBeVisible?: string[] }
// `mustBeVisible` defaults from `dion.mustBeVisible` when not supplied.

import { StyleSheet, Text, View } from 'react-native';
import { useColors } from '../../theme/useColors';
import type { Palette } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { FontSize, FontWeight } from '../../theme/tokens';
import type { DionAssessmentImages } from '../../constants/dionImages';
import DionInstructionCard from './DionInstructionCard';

type Props = {
  dion:          DionAssessmentImages;
  instructions:  string[];
  mustBeVisible?: string[];
};

export default function CaptureGuidanceCard({ dion, instructions, mustBeVisible }: Props) {
  const C = useColors();
  const s = makeStyles(C);
  const effectiveDion = mustBeVisible ? { ...dion, mustBeVisible } : dion;

  return (
    <View style={s.wrap}>
      <DionInstructionCard dion={effectiveDion} variant="full" showPhaseStrip />
      {instructions.length > 0 && (
        <View style={s.card}>
          <Text style={s.label}>HOW TO FILM</Text>
          {instructions.map((line, i) => (
            <Text key={i} style={s.bullet}>•  {line}</Text>
          ))}
        </View>
      )}
    </View>
  );
}

function makeStyles(C: Palette) {
  return StyleSheet.create({
    wrap: { gap: spacing.sm },
    card: {
      backgroundColor: C.card,
      borderRadius:    16,
      borderWidth:     1,
      borderColor:     C.border,
      padding:         spacing.md,
      gap:             spacing.xs,
    },
    label: { color: C.textDim, fontSize: 10, fontWeight: FontWeight.black, letterSpacing: 0.6 },
    bullet: { color: C.textMuted, fontSize: FontSize.xs, lineHeight: 17 },
  });
}
