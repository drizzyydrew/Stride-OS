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

export type RunLevelBadgeState = 'unlocked' | 'locked' | 'share-transparent' | 'share-opaque';

export type Point = readonly [number, number];

export const RUN_LEVEL_VIEWBOX = 256;
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
  const transparent = state === 'share-transparent';
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

function escapeXml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function ringMarkup(level: RunLevelDefinition, state: RunLevelBadgeState): string {
  const tokens = runLevelBadgeTokens(level, state);
  return runLevelRingInsets(level).map((inset, index) => {
    const opacity = Math.max(0.16, tokens.ringOpacityBase - index * tokens.ringOpacityStep);
    const strokeId = `run-level-${level.slug}-${state}-ring-${index}`;
    const width = index === 0 ? 1.32 : 0.92;
    return `<path d="${runLevelRingPath(inset)}" fill="none" stroke="url(#${strokeId})" stroke-width="${(width + 1.8).toFixed(2)}" stroke-linecap="round" stroke-linejoin="round" stroke-opacity="${tokens.ringBloomOpacity.toFixed(2)}"/>
  <path d="${runLevelRingPath(inset)}" fill="none" stroke="url(#${strokeId})" stroke-width="${width.toFixed(2)}" stroke-linecap="round" stroke-linejoin="round" stroke-opacity="${opacity.toFixed(2)}"/>`;
  }).join('\n  ');
}

export function renderRunLevelBadgeSvg(
  levelSlug: RunLevelSlug,
  state: RunLevelBadgeState = 'unlocked',
  options: { compact?: boolean; size?: number } = {},
): string {
  const level = RUN_LEVEL_BY_SLUG[levelSlug];
  const tokens = runLevelBadgeTokens(level, state);
  const compact = options.compact ?? false;
  const size = options.size ?? RUN_LEVEL_VIEWBOX;
  const gradientId = `run-level-${level.slug}-${state}-mountain`;
  const mountainSideId = `run-level-${level.slug}-${state}-mountain-side`;
  const mountainShadowId = `run-level-${level.slug}-${state}-mountain-shadow`;
  const interiorId = `run-level-${level.slug}-${state}-interior`;
  const upperGlowId = `run-level-${level.slug}-${state}-upper-glow`;
  const mountainGlowId = `run-level-${level.slug}-${state}-mountain-glow`;
  const lowerFadeId = `run-level-${level.slug}-${state}-lower-fade`;
  const leftVignetteId = `run-level-${level.slug}-${state}-left-vignette`;
  const rightVignetteId = `run-level-${level.slug}-${state}-right-vignette`;
  const edgeId = `run-level-${level.slug}-${state}-edge`;
  const clipId = `run-level-${level.slug}-${state}-clip`;
  const label = runLevelBadgeAccessibilityLabel(level.slug, state);
  const outer = runLevelHexPath(0);
  const inner = runLevelHexPath(7);
  const titleY = compact ? 178 : 174;
  const titleSize = level.titleUpper.length > 8 ? 15.2 : 18.2;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${RUN_LEVEL_VIEWBOX} ${RUN_LEVEL_VIEWBOX}" fill="none" role="img" aria-label="${escapeXml(label)}">
  <defs>
    <clipPath id="${clipId}">
      <path d="${outer}"/>
    </clipPath>
    <linearGradient id="${edgeId}" x1="70" y1="20" x2="188" y2="233" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="${tokens.color.highlight}" stop-opacity="0.96"/>
      <stop offset="0.42" stop-color="${tokens.color.outer}" stop-opacity="0.9"/>
      <stop offset="1" stop-color="${tokens.color.shadow}" stop-opacity="0.68"/>
    </linearGradient>
    <linearGradient id="${interiorId}" x1="128" y1="24" x2="128" y2="231" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#111211" stop-opacity="${tokens.baseOpacity}"/>
      <stop offset="0.42" stop-color="${RUN_LEVEL_PANEL_BLACK}" stop-opacity="${tokens.baseOpacity}"/>
      <stop offset="1" stop-color="#050606" stop-opacity="${tokens.baseOpacity}"/>
    </linearGradient>
    <radialGradient id="${upperGlowId}" cx="50%" cy="29%" r="62%">
      <stop offset="0" stop-color="${tokens.color.mid}" stop-opacity="${tokens.upperGlowOpacity}"/>
      <stop offset="0.48" stop-color="${tokens.color.outer}" stop-opacity="${(tokens.upperGlowOpacity * 0.38).toFixed(2)}"/>
      <stop offset="1" stop-color="${tokens.color.shadow}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="${mountainGlowId}" cx="50%" cy="45%" r="33%">
      <stop offset="0" stop-color="${tokens.color.highlight}" stop-opacity="${tokens.mountainGlowOpacity}"/>
      <stop offset="0.52" stop-color="${tokens.color.outer}" stop-opacity="${(tokens.mountainGlowOpacity * 0.28).toFixed(2)}"/>
      <stop offset="1" stop-color="${tokens.color.outer}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="${lowerFadeId}" x1="128" y1="118" x2="128" y2="238" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#050606" stop-opacity="0"/>
      <stop offset="0.62" stop-color="#050606" stop-opacity="${(tokens.lowerFadeOpacity * 0.64).toFixed(2)}"/>
      <stop offset="1" stop-color="#050606" stop-opacity="${tokens.lowerFadeOpacity}"/>
    </linearGradient>
    <linearGradient id="${leftVignetteId}" x1="28" y1="128" x2="122" y2="128" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#050606" stop-opacity="${tokens.vignetteOpacity}"/>
      <stop offset="1" stop-color="#050606" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="${rightVignetteId}" x1="228" y1="128" x2="134" y2="128" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#050606" stop-opacity="${tokens.vignetteOpacity}"/>
      <stop offset="1" stop-color="#050606" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="${gradientId}" x1="82" y1="86" x2="176" y2="146" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="${tokens.color.highlight}" stop-opacity="0.98"/>
      <stop offset="0.48" stop-color="${tokens.color.outer}" stop-opacity="0.92"/>
      <stop offset="1" stop-color="${tokens.color.shadow}" stop-opacity="0.82"/>
    </linearGradient>
    <linearGradient id="${mountainSideId}" x1="104" y1="105" x2="178" y2="143" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="${tokens.color.highlight}" stop-opacity="0.62"/>
      <stop offset="0.5" stop-color="${tokens.color.mid}" stop-opacity="0.76"/>
      <stop offset="1" stop-color="${tokens.color.shadow}" stop-opacity="0.9"/>
    </linearGradient>
    <linearGradient id="${mountainShadowId}" x1="82" y1="118" x2="190" y2="145" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="${tokens.color.shadow}" stop-opacity="0.44"/>
      <stop offset="0.62" stop-color="#090A0A" stop-opacity="0.62"/>
      <stop offset="1" stop-color="${tokens.color.shadow}" stop-opacity="0.36"/>
    </linearGradient>
    ${runLevelRingInsets(level).map((_, index) => `<linearGradient id="run-level-${level.slug}-${state}-ring-${index}" x1="128" y1="28" x2="128" y2="178" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="${tokens.color.highlight}" stop-opacity="0.95"/>
      <stop offset="0.48" stop-color="${tokens.color.outer}" stop-opacity="0.78"/>
      <stop offset="1" stop-color="${tokens.color.shadow}" stop-opacity="0.28"/>
    </linearGradient>`).join('\n    ')}
  </defs>
  <path d="${outer}" fill="${tokens.fill}" fill-opacity="${tokens.fillOpacity}" stroke="url(#${edgeId})" stroke-width="3.1" stroke-linejoin="round" stroke-opacity="${tokens.outerOpacity}"/>
  <g clip-path="url(#${clipId})">
    <rect x="0" y="0" width="256" height="256" fill="${state === 'share-transparent' ? 'transparent' : `url(#${interiorId})`}" fill-opacity="${tokens.innerFillOpacity}"/>
    <rect x="0" y="0" width="256" height="256" fill="#050606" fill-opacity="${tokens.transparentWashOpacity}"/>
    <rect x="0" y="0" width="256" height="256" fill="url(#${upperGlowId})"/>
    <rect x="0" y="0" width="256" height="256" fill="url(#${mountainGlowId})"/>
    <rect x="0" y="0" width="256" height="256" fill="url(#${leftVignetteId})"/>
    <rect x="0" y="0" width="256" height="256" fill="url(#${rightVignetteId})"/>
    <rect x="0" y="0" width="256" height="256" fill="url(#${lowerFadeId})"/>
  </g>
  <path d="${inner}" fill="none" stroke="${tokens.color.highlight}" stroke-width="0.82" stroke-opacity="${tokens.innerEdgeOpacity}"/>
  ${ringMarkup(level, state)}
  <path d="${RUN_LEVEL_MOUNTAIN.rearMass}" fill="url(#${mountainShadowId})" opacity="${(tokens.mountainOpacity * 0.58).toFixed(2)}"/>
  <path d="${RUN_LEVEL_MOUNTAIN.leftRear}" fill="url(#${mountainShadowId})" opacity="${(tokens.mountainOpacity * 0.7).toFixed(2)}"/>
  <path d="${RUN_LEVEL_MOUNTAIN.leftFace}" fill="url(#${mountainSideId})" opacity="${(tokens.mountainOpacity * 0.88).toFixed(2)}"/>
  <path d="${RUN_LEVEL_MOUNTAIN.centerShadow}" fill="url(#${mountainShadowId})" opacity="${(tokens.mountainOpacity * 0.78).toFixed(2)}"/>
  <path d="${RUN_LEVEL_MOUNTAIN.centerFace}" fill="url(#${gradientId})" opacity="${tokens.mountainOpacity}"/>
  <path d="${RUN_LEVEL_MOUNTAIN.centerHighlight}" fill="url(#${mountainSideId})" opacity="${(tokens.mountainOpacity * 0.9).toFixed(2)}"/>
  <path d="${RUN_LEVEL_MOUNTAIN.rightRear}" fill="url(#${mountainShadowId})" opacity="${(tokens.mountainOpacity * 0.74).toFixed(2)}"/>
  <path d="${RUN_LEVEL_MOUNTAIN.rightFace}" fill="url(#${mountainSideId})" opacity="${(tokens.mountainOpacity * 0.72).toFixed(2)}"/>
  <path d="${RUN_LEVEL_MOUNTAIN.ridge}" fill="none" stroke="${tokens.color.highlight}" stroke-width="1.15" stroke-linecap="round" stroke-linejoin="round" stroke-opacity="${(tokens.mountainOpacity * 0.5).toFixed(2)}"/>
  ${tokens.keylineOpacity > 0 ? `<text x="128" y="${titleY}" text-anchor="middle" font-family="Avenir Next, Inter, Arial, sans-serif" font-size="${titleSize}" font-weight="500" letter-spacing="1.45" stroke="#050505" stroke-width="2" stroke-opacity="${tokens.keylineOpacity}" fill="none">${level.titleUpper}</text>` : ''}
  <text x="128" y="${titleY}" text-anchor="middle" font-family="Avenir Next, Inter, Arial, sans-serif" font-size="${titleSize}" font-weight="500" letter-spacing="1.45" fill="${state === 'locked' ? RUN_LEVEL_LOCKED_GRAY : tokens.color.highlight}" fill-opacity="${tokens.titleOpacity}">${level.titleUpper}</text>
  ${compact ? '' : `<text x="128" y="195" text-anchor="middle" font-family="Avenir Next, Inter, Arial, sans-serif" font-size="8.8" font-weight="700" letter-spacing="3.4" fill="${state === 'locked' ? RUN_LEVEL_LOCKED_GRAY : '#F3F1EB'}" fill-opacity="${tokens.wordmarkOpacity}">STRIDEOS</text>
  <path d="M105 211 L128 223 L151 211" fill="none" stroke="${state === 'locked' ? RUN_LEVEL_LOCKED_GRAY : tokens.color.outer}" stroke-width="2.05" stroke-linecap="round" stroke-linejoin="round" stroke-opacity="${tokens.chevronOpacity}"/>
  <path d="M109 221 L128 231 L147 221" fill="none" stroke="${state === 'locked' ? RUN_LEVEL_LOCKED_GRAY : tokens.color.highlight}" stroke-width="2.05" stroke-linecap="round" stroke-linejoin="round" stroke-opacity="${tokens.chevronOpacity}"/>`}
</svg>
`;
}
