// ─── Capture Guidance Card ─────────────────────────────────────────────────────
//
// Shown BEFORE recording a readiness test: camera setup, required view, and
// what must be visible, alongside a simple silhouette guide.

import { StyleSheet, Text, View } from 'react-native';
import { useColors } from '../../theme/useColors';
import type { Palette } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { FontSize, FontWeight } from '../../theme/tokens';
import CaptureSilhouette from './CaptureSilhouette';

type Props = {
  view:          'side' | 'front';
  instructions:  string[];
  mustBeVisible: string[];
};

export default function CaptureGuidanceCard({ view, instructions, mustBeVisible }: Props) {
  const C = useColors();
  const s = makeStyles(C);

  return (
    <View style={s.card}>
      <View style={s.row}>
        <CaptureSilhouette view={view} />
        <View style={s.list}>
          {instructions.map((line, i) => (
            <Text key={i} style={s.bullet}>•  {line}</Text>
          ))}
        </View>
      </View>
      {mustBeVisible.length > 0 && (
        <View style={s.mustBeVisibleRow}>
          <Text style={s.label}>MUST BE VISIBLE</Text>
          <Text style={s.mustBeVisible}>{mustBeVisible.join(' · ')}</Text>
        </View>
      )}
    </View>
  );
}

function makeStyles(C: Palette) {
  return StyleSheet.create({
    card: {
      backgroundColor: C.card,
      borderRadius:    16,
      borderWidth:     1,
      borderColor:     C.border,
      padding:         spacing.md,
      gap:             spacing.sm,
    },
    row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    list: { flex: 1, gap: 4 },
    bullet: { color: C.textMuted, fontSize: FontSize.xs, lineHeight: 17 },
    mustBeVisibleRow: { gap: 2 },
    label: { color: C.textDim, fontSize: 10, fontWeight: FontWeight.black, letterSpacing: 0.6 },
    mustBeVisible: { color: C.textMuted, fontSize: FontSize.xs },
  });
}
