// ─── Dion Instruction Card ───────────────────────────────────────────────────
//
// Renders an approved Dion production illustration from the manifest-backed
// registry (src/constants/dionImages.ts): resizeMode="contain" inside an
// asset-appropriate frame so no required joint is ever cropped, with
// an onError fallback to a structured placeholder (never a stick figure,
// never an invented person) if the bundled asset somehow fails to decode.
// `symptom_review` has no approved asset at all — image is null — so it
// always renders the placeholder.

import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useColors } from '../../theme/useColors';
import type { Palette } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { FontSize, FontWeight, Radius } from '../../theme/tokens';
import type { DionAssessmentImages, DionPhaseImage } from '../../constants/dionImages';
import { displayLabel } from '../../utils/displayLabels';

type Variant = 'compact' | 'full';

// Canonical production asset aspect ratio (864×1821 portrait) — every frame
// this component renders is sized to this ratio so contain-fit never crops
// a required joint regardless of the container's own width/height.
const ASSET_ASPECT_RATIO = 864 / 1821;
const BIKE_FIT_ASPECT_RATIO = 4 / 3;

type Props = {
  dion:      DionAssessmentImages;
  variant?:  Variant;
  /** Which phase to show as the hero image; defaults to `dion.primary`. */
  phase?:    DionPhaseImage;
  /** Show a horizontal strip of all approved phases below the hero (full variant only). */
  showPhaseStrip?: boolean;
};

export default function DionInstructionCard({ dion, variant = 'full', phase, showPhaseStrip = false }: Props) {
  const C = useColors();
  const s = makeStyles(C);
  const compact = variant === 'compact';
  const activePhase = phase ?? dion.primary;
  const landscape = dion.assessmentId === 'standalone_bike_fit';

  const frame = (
    <ImageFrame image={activePhase} compact={compact} landscape={landscape} viewLabel={dion.viewLabel} s={s} C={C} />
  );

  // Compact = a bare thumbnail meant to drop into an existing list row —
  // no outer card chrome, just the framing box.
  if (compact) {
    return (
      <View accessibilityLabel={activePhase.alt} accessible>
        {frame}
      </View>
    );
  }

  return (
    <View style={s.card} accessibilityLabel={activePhase.alt} accessible>
      {landscape ? (
        <>
          {frame}
          <View style={s.landscapeDetails}>
            <Text style={s.label}>CAMERA VIEW</Text>
            <Text style={s.viewLabelBig}>{dion.viewLabel}</Text>
            <Text style={s.distance}>{dion.recommendedDistance}</Text>
          </View>
        </>
      ) : (
        <View style={s.row}>
          {frame}
          <View style={s.details}>
            <Text style={s.label}>CAMERA VIEW</Text>
            <Text style={s.viewLabelBig}>{dion.viewLabel}</Text>
            <Text style={s.distance}>{dion.recommendedDistance}</Text>
          </View>
        </View>
      )}

      {dion.mustBeVisible.length > 0 && (
        <View style={s.mustBeVisibleBlock}>
          <Text style={s.label}>MUST BE VISIBLE</Text>
          <View style={s.chipRow}>
            {dion.mustBeVisible.map(item => (
              <View key={item} style={s.chip}>
                <Text style={s.chipTxt}>{item}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {showPhaseStrip && dion.phases.length > 1 && (
        <View style={s.phaseStripBlock}>
          <Text style={s.label}>PHASES</Text>
          <View style={s.phaseStrip}>
            {dion.phases.map(p => (
              <View key={p.assetId} style={s.phaseStripItem}>
                <ImageFrame image={p} compact landscape={landscape} s={s} C={C} thumbnail />
                <Text style={s.phaseStripLabel} numberOfLines={1}>{displayLabel(p.position)}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

function ImageFrame({
  image, compact, landscape, viewLabel, s, C, thumbnail,
}: {
  image:      DionPhaseImage;
  compact:    boolean;
  landscape?: boolean;
  viewLabel?: string;
  s:          ReturnType<typeof makeStyles>;
  C:          Palette;
  thumbnail?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const showPlaceholder = !image.image || failed;

  return (
    <View style={[
      s.frame,
      landscape
        ? compact
          ? (thumbnail ? s.frameThumbLandscape : s.frameCompactLandscape)
          : s.frameFullLandscape
        : compact
          ? (thumbnail ? s.frameThumb : s.frameCompact)
          : s.frameFull,
    ]}>
      {!showPlaceholder ? (
        <Image
          source={image.image as number}
          style={s.image}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
          accessibilityLabel={image.alt}
          onError={() => setFailed(true)}
        />
      ) : (
        <View style={s.placeholder}>
          <Ionicons name="body-outline" size={compact ? (thumbnail ? 14 : 18) : 26} color={C.textDim} />
          {!thumbnail && (
            <Text style={[s.viewLabel, compact && s.viewLabelCompact]} numberOfLines={2}>
              {viewLabel ?? ''}
            </Text>
          )}
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
    frame: {
      borderRadius:    Radius.md,
      borderWidth:     1.5,
      borderColor:     C.primary + '55',
      borderStyle:     'dashed',
      backgroundColor: C.bg,
      alignItems:      'center',
      justifyContent:  'center',
      overflow:        'hidden',
    },
    // Fixed 864:1821 aspect-ratio containers — contain-fit inside these never
    // crops a required joint regardless of the source asset's own framing.
    frameFull:    { width: 132, height: 132 / ASSET_ASPECT_RATIO },
    frameCompact: { width: 56, height: 56 / ASSET_ASPECT_RATIO, borderRadius: Radius.sm },
    frameThumb:   { width: 40, height: 40 / ASSET_ASPECT_RATIO, borderRadius: Radius.sm },
    frameFullLandscape: {
      width: '100%',
      aspectRatio: BIKE_FIT_ASPECT_RATIO,
      borderRadius: Radius.md,
    },
    frameCompactLandscape: {
      width: 72,
      aspectRatio: BIKE_FIT_ASPECT_RATIO,
      borderRadius: Radius.sm,
    },
    frameThumbLandscape: {
      width: 64,
      aspectRatio: BIKE_FIT_ASPECT_RATIO,
      borderRadius: Radius.sm,
    },
    image:        { width: '100%', height: '100%' },
    placeholder: {
      alignItems:        'center',
      justifyContent:    'center',
      gap:               4,
      paddingHorizontal: 6,
    },
    viewLabel: {
      color:      C.textDim,
      fontSize:   10,
      fontWeight: FontWeight.bold,
      textAlign:  'center',
    },
    viewLabelCompact: { fontSize: 8, lineHeight: 10 },
    details: { flex: 1, gap: 3 },
    landscapeDetails: { width: '100%', gap: 3, paddingTop: 2 },
    label: {
      color:         C.textDim,
      fontSize:      10,
      fontWeight:    FontWeight.black,
      letterSpacing: 0.6,
    },
    viewLabelBig: { color: C.text, fontSize: FontSize.base, fontWeight: FontWeight.bold },
    distance:     { color: C.textMuted, fontSize: FontSize.xs },
    mustBeVisibleBlock: { gap: 6 },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    chip: {
      backgroundColor:   C.primaryDim,
      borderRadius:      Radius.sm,
      paddingHorizontal: 8,
      paddingVertical:   4,
    },
    chipTxt: { color: C.primary, fontSize: 11, fontWeight: FontWeight.bold },
    phaseStripBlock: { gap: 6 },
    phaseStrip: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    phaseStripItem: { alignItems: 'center', gap: 3, minWidth: 48 },
    phaseStripLabel: { color: C.textMuted, fontSize: 9, textTransform: 'capitalize' },
  });
}
