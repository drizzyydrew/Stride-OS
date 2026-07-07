// ─── Pose Overlay ─────────────────────────────────────────────────────────────
//
// Renders an analyzed still with the detected skeleton + estimated angle labels
// drawn on top. Shared by the analyze flow and analysis-detail screens.
// Landmarks are normalized 0…1 (origin top-left) and scaled to the rendered
// image size. Segments/joints below the confidence floor are dimmed or hidden.

import { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Text as SvgText } from 'react-native-svg';

import { LANDMARK_CONFIDENCE_FLOOR, SKELETON_CONNECTIONS } from '../../utils/poseAngles';
import { colors } from '../../theme/colors';
import type { EstimatedAngle, PoseLandmarkRecord } from '../../types/movement';

type Props = {
  imageUri:     string;
  aspectRatio:  number;                    // width / height of the analyzed image
  landmarks?:   PoseLandmarkRecord[];
  angles?:      EstimatedAngle[];
  showSkeleton: boolean;
  showAngles:   boolean;
};

const JOINT_RADIUS = 4;

/** Landmark name for the vertex of an estimated angle (label anchor). */
function angleAnchorName(angle: EstimatedAngle): string | null {
  if (angle.side === 'center') return null; // trunk — anchored at shoulder midpoint
  return `${angle.side}_${angle.joint}`;
}

export default function PoseOverlay({
  imageUri,
  aspectRatio,
  landmarks,
  angles,
  showSkeleton,
  showAngles,
}: Props) {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  const byName = new Map<string, PoseLandmarkRecord>();
  for (const l of landmarks ?? []) byName.set(l.name, l);

  const hasPose = (landmarks?.length ?? 0) > 0;

  function shoulderMid(): { x: number; y: number } | null {
    const ls = byName.get('left_shoulder');
    const rs = byName.get('right_shoulder');
    if (!ls || !rs) return null;
    return { x: (ls.x + rs.x) / 2, y: (ls.y + rs.y) / 2 };
  }

  return (
    <View
      style={[styles.container, { aspectRatio }]}
      onLayout={e => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
    >
      <Image source={{ uri: imageUri }} style={styles.image} resizeMode="cover" />

      {hasPose && size && (showSkeleton || showAngles) ? (
        <Svg
          style={StyleSheet.absoluteFill}
          width={size.w}
          height={size.h}
          pointerEvents="none"
        >
          {showSkeleton && SKELETON_CONNECTIONS.map(([a, b]) => {
            const ja = byName.get(a);
            const jb = byName.get(b);
            if (!ja || !jb) return null;
            if (ja.confidence < LANDMARK_CONFIDENCE_FLOOR || jb.confidence < LANDMARK_CONFIDENCE_FLOOR) return null;
            return (
              <Line
                key={`${a}-${b}`}
                x1={ja.x * size.w}
                y1={ja.y * size.h}
                x2={jb.x * size.w}
                y2={jb.y * size.h}
                stroke={colors.primary}
                strokeWidth={2}
                strokeOpacity={0.9}
              />
            );
          })}

          {showSkeleton && (landmarks ?? []).map(j => {
            const low = j.confidence < LANDMARK_CONFIDENCE_FLOOR;
            return (
              <Circle
                key={j.name}
                cx={j.x * size.w}
                cy={j.y * size.h}
                r={JOINT_RADIUS}
                fill={low ? 'none' : colors.primary}
                stroke={colors.primary}
                strokeWidth={1.5}
                opacity={low ? 0.4 : 1}
              />
            );
          })}

          {showAngles && (angles ?? []).map((angle, i) => {
            const anchorName = angleAnchorName(angle);
            const anchor = anchorName ? byName.get(anchorName) : shoulderMid();
            if (!anchor) return null;
            const label = `${angle.name.split(' ')[0]} ${Math.round(angle.degrees)}°`;
            return (
              <SvgText
                key={`${angle.side}-${angle.name}-${i}`}
                x={anchor.x * size.w + 8}
                y={anchor.y * size.h - 6}
                fill="#FFFFFF"
                stroke="#000000"
                strokeWidth={0.4}
                fontSize={11}
                fontWeight="bold"
              >
                {label}
              </SvgText>
            );
          })}
        </Svg>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width:           '100%',
    borderRadius:    12,
    overflow:        'hidden',
    backgroundColor: '#000',
  },
  image: {
    width:  '100%',
    height: '100%',
  },
});
