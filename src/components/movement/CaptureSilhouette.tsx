// ─── Capture Silhouette ────────────────────────────────────────────────────────
//
// A minimal stick-figure + viewfinder-frame guide shown before recording each
// readiness test — StrideOS design language (theme-driven line art), not a
// copy of any third-party app's silhouette guide.

import Svg, { Circle, Line, Rect } from 'react-native-svg';
import { useColors } from '../../theme/useColors';

type Props = {
  view:    'side' | 'front';
  width?:  number;
  height?: number;
};

const FRAME_CORNERS: [number, number, number, number][] = [
  [8, 8, 20, 8],     [8, 8, 8, 20],
  [112, 8, 100, 8],  [112, 8, 112, 20],
  [8, 152, 20, 152], [8, 152, 8, 140],
  [112, 152, 100, 152], [112, 152, 112, 140],
];

export default function CaptureSilhouette({ view, width = 96, height = 128 }: Props) {
  const C = useColors();

  return (
    <Svg width={width} height={height} viewBox="0 0 120 160">
      <Rect x={4} y={4} width={112} height={152} rx={10} stroke={C.border} strokeWidth={2} fill="none" />
      {FRAME_CORNERS.map(([x1, y1, x2, y2], i) => (
        <Line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={C.primary} strokeWidth={3} strokeLinecap="round" />
      ))}

      {view === 'side' ? (
        <>
          <Circle cx={60} cy={28} r={10} stroke={C.primary} strokeWidth={3} fill="none" />
          <Line x1={60} y1={38} x2={64} y2={82} stroke={C.primary} strokeWidth={3} strokeLinecap="round" />
          <Line x1={62} y1={50} x2={48} y2={70} stroke={C.primary} strokeWidth={3} strokeLinecap="round" />
          <Line x1={64} y1={82} x2={46} y2={116} stroke={C.primary} strokeWidth={3} strokeLinecap="round" />
          <Line x1={46} y1={116} x2={50} y2={140} stroke={C.primary} strokeWidth={3} strokeLinecap="round" />
          <Line x1={64} y1={82} x2={82} y2={112} stroke={C.primary} strokeWidth={3} strokeLinecap="round" />
          <Line x1={82} y1={112} x2={78} y2={140} stroke={C.primary} strokeWidth={3} strokeLinecap="round" />
        </>
      ) : (
        <>
          <Circle cx={60} cy={28} r={10} stroke={C.primary} strokeWidth={3} fill="none" />
          <Line x1={60} y1={38} x2={60} y2={84} stroke={C.primary} strokeWidth={3} strokeLinecap="round" />
          <Line x1={60} y1={48} x2={36} y2={78} stroke={C.primary} strokeWidth={3} strokeLinecap="round" />
          <Line x1={60} y1={48} x2={84} y2={78} stroke={C.primary} strokeWidth={3} strokeLinecap="round" />
          <Line x1={60} y1={84} x2={44} y2={140} stroke={C.primary} strokeWidth={3} strokeLinecap="round" />
          <Line x1={60} y1={84} x2={76} y2={140} stroke={C.primary} strokeWidth={3} strokeLinecap="round" />
        </>
      )}
    </Svg>
  );
}
