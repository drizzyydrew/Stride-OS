import { APPROVED_ARTWORK } from './approvedArtwork';
import { renderApprovedVector } from '../shared/approvedVector';
import {
  RUN_LEVEL_LOCKED_GRAY,
  RUN_LEVEL_NEAR_BLACK,
  RUN_LEVEL_PANEL_BLACK,
  type RunLevelColorTokens,
} from './runLevelColors';
import {
  RUN_LEVEL_BY_SLUG,
  type RunLevelDefinition,
  type RunLevelSlug,
} from './runLevelDefinitions';
type UnitSystem = 'imperial' | 'metric';

export type RunLevelBadgeState = 'unlocked' | 'locked' | 'transparent';

export type RunLevelBadgeInputState = RunLevelBadgeState | 'share-opaque' | 'share-transparent';

export function normalizeRunLevelBadgeState(state?: RunLevelBadgeInputState): RunLevelBadgeState {
  if (state === 'locked') return 'locked';
  if (state === 'transparent' || state === 'share-transparent') return 'transparent';
  return 'unlocked';
}

export type Point = readonly [number, number];

export const RUN_LEVEL_VIEWBOX = 100;
export const RUN_LEVEL_CENTER: Point = [128, 128];
export const RUN_LEVEL_OUTER_HEX: Point[] = [
  [128, 14],
  [226, 70],
  [226, 181],
  [128, 238],
  [30, 181],
  [30, 70],
];

export const RUN_LEVEL_MOUNTAIN = {
  rearMass: 'M61 141 C79 136 92 127 106 120 L121 130 L137 101 L154 124 L166 117 C176 128 187 136 197 141 C180 139 169 133 160 127 L149 140 L130 134 L116 141 L101 132 L84 141 Z',
  leftRear: 'M69 140 L103 120 L119 130 L107 137 L89 142 Z',
  leftFace: 'M83 140 L111 126 L123 132 L116 141 Z',
  centerShadow: 'M120 141 L137 101 L151 140 Z',
  centerFace: 'M121 140 L137 101 L131 128 L116 141 Z',
  centerHighlight: 'M137 101 L142 126 L151 140 L132 128 Z',
  rightRear: 'M145 140 L154 124 L190 141 L168 139 L158 132 Z',
  rightFace: 'M151 140 L160 130 L178 140 Z',
  ridge: 'M66 141 C82 136 94 129 106 120 M117 140 L137 101 L158 128 M146 136 L160 121 L193 141',
};

function pointString(points: readonly Point[]): string {
  return points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
}

function roundedPath(points: readonly Point[], radius: number): string {
  const commands: string[] = [];

  points.forEach((point, index) => {
    const previous = points[(index - 1 + points.length) % points.length];
    const next = points[(index + 1) % points.length];
    const prevVector = [previous[0] - point[0], previous[1] - point[1]] as const;
    const nextVector = [next[0] - point[0], next[1] - point[1]] as const;
    const prevLength = Math.hypot(prevVector[0], prevVector[1]);
    const nextLength = Math.hypot(nextVector[0], nextVector[1]);
    const corner = Math.min(radius, prevLength * 0.36, nextLength * 0.36);
    const start: Point = [
      point[0] + (prevVector[0] / prevLength) * corner,
      point[1] + (prevVector[1] / prevLength) * corner,
    ];
    const end: Point = [
      point[0] + (nextVector[0] / nextLength) * corner,
      point[1] + (nextVector[1] / nextLength) * corner,
    ];

    if (index === 0) commands.push(`M${start[0].toFixed(2)} ${start[1].toFixed(2)}`);
    else commands.push(`L${start[0].toFixed(2)} ${start[1].toFixed(2)}`);
    commands.push(`Q${point[0].toFixed(2)} ${point[1].toFixed(2)} ${end[0].toFixed(2)} ${end[1].toFixed(2)}`);
  });

  commands.push('Z');
  return commands.join(' ');
}

function roundedOpenPath(points: readonly Point[], radius: number): string {
  const commands: string[] = [`M${points[0][0].toFixed(2)} ${points[0][1].toFixed(2)}`];

  for (let index = 1; index < points.length - 1; index += 1) {
    const point = points[index];
    const previous = points[index - 1];
    const next = points[index + 1];
    const prevVector = [previous[0] - point[0], previous[1] - point[1]] as const;
    const nextVector = [next[0] - point[0], next[1] - point[1]] as const;
    const prevLength = Math.hypot(prevVector[0], prevVector[1]);
    const nextLength = Math.hypot(nextVector[0], nextVector[1]);
    const corner = Math.min(radius, prevLength * 0.36, nextLength * 0.36);
    const start: Point = [
      point[0] + (prevVector[0] / prevLength) * corner,
      point[1] + (prevVector[1] / prevLength) * corner,
    ];
    const end: Point = [
      point[0] + (nextVector[0] / nextLength) * corner,
      point[1] + (nextVector[1] / nextLength) * corner,
    ];

    commands.push(`L${start[0].toFixed(2)} ${start[1].toFixed(2)}`);
    commands.push(`Q${point[0].toFixed(2)} ${point[1].toFixed(2)} ${end[0].toFixed(2)} ${end[1].toFixed(2)}`);
  }

  const last = points[points.length - 1];
  commands.push(`L${last[0].toFixed(2)} ${last[1].toFixed(2)}`);
  return commands.join(' ');
}

function interpolatePoint(from: Point, to: Point, amount: number): Point {
  return [
    from[0] + (to[0] - from[0]) * amount,
    from[1] + (to[1] - from[1]) * amount,
  ];
}

export function runLevelHexPoints(inset: number): Point[] {
  const [cx, cy] = RUN_LEVEL_CENTER;
  const scale = Math.max(0.18, 1 - inset / 125);
  return RUN_LEVEL_OUTER_HEX.map(([x, y]) => [
    cx + (x - cx) * scale,
    cy + (y - cy) * scale,
  ] as const);
}

export function runLevelHexPointString(inset: number): string {
  return pointString(runLevelHexPoints(inset));
}

export function runLevelHexPath(inset: number): string {
  return roundedPath(runLevelHexPoints(inset), Math.max(3.25, 8 - inset * 0.035));
}

export function runLevelRingPath(inset: number): string {
  const [top, upperRight, lowerRight, , lowerLeft, upperLeft] = runLevelHexPoints(inset);
  const leftStart = interpolatePoint(lowerLeft, upperLeft, 0.38);
  const rightEnd = interpolatePoint(upperRight, lowerRight, 0.62);
  return roundedOpenPath([leftStart, upperLeft, top, upperRight, rightEnd], Math.max(2.8, 6.5 - inset * 0.03));
}

export function runLevelRingInsets(level: RunLevelDefinition): number[] {
  return Array.from({ length: level.ringCount }, (_, index) => 14 + index * 9.6);
}

export function runLevelBadgeTokens(level: RunLevelDefinition, state: RunLevelBadgeState) {
  const locked = state === 'locked';
  const transparent = state === 'transparent';
  const color: RunLevelColorTokens = locked
    ? {
        outer: RUN_LEVEL_LOCKED_GRAY,
        mid: '#777873',
        highlight: '#C4C1B9',
        shadow: '#4B4D4B',
        glow: '#8B8B86',
      }
    : level.colors;

  return {
    color,
    fill: transparent ? 'transparent' : RUN_LEVEL_NEAR_BLACK,
    fillOpacity: transparent ? 0 : 1,
    innerFill: transparent ? 'transparent' : RUN_LEVEL_PANEL_BLACK,
    innerFillOpacity: transparent ? 0 : 1,
    baseOpacity: transparent ? 0 : locked ? 0.9 : 1,
    upperGlowOpacity: locked ? 0.16 : transparent ? 0.28 : 0.38,
    mountainGlowOpacity: locked ? 0.1 : transparent ? 0.18 : 0.24,
    transparentWashOpacity: transparent ? 0.12 : 0,
    vignetteOpacity: transparent ? 0.18 : locked ? 0.44 : 0.58,
    lowerFadeOpacity: transparent ? 0.08 : locked ? 0.36 : 0.52,
    outerOpacity: locked ? 0.46 : 0.96,
    innerEdgeOpacity: locked ? 0.22 : 0.34,
    ringOpacityBase: locked ? 0.36 : 0.86,
    ringOpacityStep: locked ? 0.03 : 0.09,
    ringBloomOpacity: locked ? 0.06 : transparent ? 0.1 : 0.13,
    mountainOpacity: locked ? 0.44 : 0.98,
    titleOpacity: locked ? 0.48 : 0.92,
    wordmarkOpacity: locked ? 0.3 : 0.72,
    chevronOpacity: locked ? 0.34 : 0.78,
    shadowOpacity: transparent ? 0.18 : 0.46,
    keylineOpacity: transparent ? 0.58 : 0,
  };
}

export function runLevelBadgeAccessibilityLabel(
  level: RunLevelSlug,
  state: RunLevelBadgeState,
  remainingMeters?: number,
  units: UnitSystem = 'imperial',
): string {
  const definition = RUN_LEVEL_BY_SLUG[level];
  if (state !== 'locked') return `${definition.title} run level. Unlocked.`;
  if (typeof remainingMeters === 'number' && remainingMeters > 0) {
    const remaining = units === 'metric'
      ? `${Math.ceil(remainingMeters / 1000).toLocaleString()} kilometers`
      : `${Math.ceil(remainingMeters / 1609.344).toLocaleString()} miles`;
    return `${definition.title} run level. Locked. ${remaining} remaining.`;
  }
  return `${definition.title} run level. Locked.`;
}

export function renderRunLevelBadgeSvg(
  levelSlug: RunLevelSlug,
  state: RunLevelBadgeInputState = 'unlocked',
  options: { compact?: boolean; size?: number; remainingMeters?: number; units?: UnitSystem } = {},
): string {
  const definition = RUN_LEVEL_BY_SLUG[levelSlug];
  const visualState = normalizeRunLevelBadgeState(state);
  return renderApprovedVector(APPROVED_ARTWORK[definition.id], visualState, {
    ...options,
    label: runLevelBadgeAccessibilityLabel(levelSlug, visualState, options.remainingMeters, options.units),
    namespace: `run-level-${levelSlug}-${visualState}`,
  });
}
