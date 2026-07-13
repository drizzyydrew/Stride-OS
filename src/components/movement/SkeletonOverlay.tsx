// ─── Skeleton Overlay (video) ──────────────────────────────────────────────────
//
// SVG skeleton + angle-label overlay for the video scrub view. Landmarks are
// normalized 0…1 (origin top-left); the video renders with contentFit
// "contain", so — unlike a still where the container is sized to match the
// image aspect ratio exactly — the displayed video is typically letterboxed
// inside its container. This component computes that "contain" rect from the
// container size vs. the source media's aspect ratio and maps points into it,
// rather than assuming the container is fully filled.

import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Text as SvgText } from 'react-native-svg';

import { LANDMARK_CONFIDENCE_FLOOR, SKELETON_CONNECTIONS } from '../../utils/poseAngles';
import { colors } from '../../theme/colors';
import type { EstimatedAngle, PoseLandmarkRecord } from '../../types/movement';

type Props = {
  containerWidth:  number;
  containerHeight: number;
  mediaWidth:      number;   // source video/frame width (any unit — only the ratio matters)
  mediaHeight:     number;
  landmarks?:      PoseLandmarkRecord[];
  angles?:         EstimatedAngle[];
  showSkeleton:    boolean;
  showAngles:      boolean;
  connections?:    [string, string][];
};

const JOINT_RADIUS = 4;

/** Computes the letterboxed "contain" rect of `media` inside `container`. */
export function containRect(
  containerWidth: number, containerHeight: number,
  mediaWidth: number, mediaHeight: number,
): { x: number; y: number; width: number; height: number } {
  if (!containerWidth || !containerHeight || !mediaWidth || !mediaHeight) {
    return { x: 0, y: 0, width: containerWidth, height: containerHeight };
  }
  const containerAspect = containerWidth / containerHeight;
  const mediaAspect = mediaWidth / mediaHeight;

  if (mediaAspect > containerAspect) {
    // Media is relatively wider than the container → letterboxed top/bottom.
    const width = containerWidth;
    const height = containerWidth / mediaAspect;
    return { x: 0, y: (containerHeight - height) / 2, width, height };
  }
  // Media is relatively taller → letterboxed left/right (pillarboxed).
  const height = containerHeight;
  const width = containerHeight * mediaAspect;
  return { x: (containerWidth - width) / 2, y: 0, width, height };
}

function angleAnchorName(angle: EstimatedAngle): string | null {
  if (angle.side === 'center') return null;
  return `${angle.side}_${angle.joint}`;
}

export default function SkeletonOverlay({
  containerWidth,
  containerHeight,
  mediaWidth,
  mediaHeight,
  landmarks,
  angles,
  showSkeleton,
  showAngles,
  connections = SKELETON_CONNECTIONS,
}: Props) {
  const hasPose = (landmarks?.length ?? 0) > 0;
  if (!hasPose || (!showSkeleton && !showAngles) || !containerWidth || !containerHeight) return null;

  const rect = containRect(containerWidth, containerHeight, mediaWidth, mediaHeight);
  const byName = new Map<string, PoseLandmarkRecord>();
  for (const l of landmarks ?? []) byName.set(l.name, l);

  function shoulderMid(): { x: number; y: number } | null {
    const ls = byName.get('left_shoulder');
    const rs = byName.get('right_shoulder');
    if (!ls || !rs) return null;
    return { x: (ls.x + rs.x) / 2, y: (ls.y + rs.y) / 2 };
  }

  const px = (x: number) => rect.x + x * rect.width;
  const py = (y: number) => rect.y + y * rect.height;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg style={StyleSheet.absoluteFill} width={containerWidth} height={containerHeight}>
        {showSkeleton && connections.map(([a, b]) => {
          const ja = byName.get(a);
          const jb = byName.get(b);
          if (!ja || !jb) return null;
          if (ja.confidence < LANDMARK_CONFIDENCE_FLOOR || jb.confidence < LANDMARK_CONFIDENCE_FLOOR) return null;
          return (
            <Line
              key={`${a}-${b}`}
              x1={px(ja.x)} y1={py(ja.y)}
              x2={px(jb.x)} y2={py(jb.y)}
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
              cx={px(j.x)} cy={py(j.y)}
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
          const label = `${angle.name.replace(' flexion', '').replace(' angle', '')} ${Math.round(angle.degrees)}°`;
          const labelOffset = (i % 3) * 13;
          return (
            <SvgText
              key={`${angle.side}-${angle.name}-${i}`}
              x={px(anchor.x) + 8}
              y={py(anchor.y) - 6 - labelOffset}
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
    </View>
  );
}
