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
  back: 'M64 137 L91 121 L106 131 L123 98 L145 128 L160 118 L192 137 L171 136 L158 127 L149 137 L131 132 L118 137 L101 130 L83 137 Z',
  mainLeft: 'M70 137 L105 114 L121 126 L136 93 L143 137 Z',
  mainRight: 'M136 93 L154 123 L186 137 L148 137 Z',
  centralCut: 'M136 93 L124 125 L117 137 L106 127 Z',
  leftCut: 'M105 114 L95 133 L81 137 L114 126 Z',
  rightCut: 'M154 123 L166 137 L144 132 Z',
  ridge: 'M66 140 C82 136 94 128 106 117 M118 137 L136 93 L157 124 M146 133 L160 118 L190 140',
};

function pointString(points: readonly Point[]): string {
  return points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
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

export function runLevelRingInsets(level: RunLevelDefinition): number[] {
  return Array.from({ length: level.ringCount }, (_, index) => 12 + index * 9);
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
    innerFillOpacity: transparent ? 0 : 0.92,
    outerOpacity: locked ? 0.42 : 1,
    ringOpacityBase: locked ? 0.34 : 0.82,
    ringOpacityStep: locked ? 0.025 : 0.052,
    mountainOpacity: locked ? 0.32 : 1,
    titleOpacity: locked ? 0.42 : 1,
    wordmarkOpacity: locked ? 0.28 : 0.88,
    chevronOpacity: locked ? 0.28 : 0.9,
    glowOpacity: locked ? 0.08 : transparent ? 0.16 : 0.32,
    shadowOpacity: transparent ? 0.22 : 0.42,
    keylineOpacity: transparent ? 0.7 : 0,
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
    const stroke = index % 3 === 0 ? tokens.color.highlight : index % 2 === 0 ? tokens.color.mid : tokens.color.outer;
    const width = index === 0 ? 2.4 : index < 3 ? 1.65 : 1.25;
    return `<polygon points="${runLevelHexPointString(inset)}" fill="none" stroke="${stroke}" stroke-width="${width}" stroke-opacity="${opacity.toFixed(2)}"/>`;
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
  const interiorId = `run-level-${level.slug}-${state}-interior`;
  const edgeId = `run-level-${level.slug}-${state}-edge`;
  const label = runLevelBadgeAccessibilityLabel(level.slug, state);
  const outer = runLevelHexPointString(0);
  const inner = runLevelHexPointString(7);
  const titleY = compact ? 178 : 174;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${RUN_LEVEL_VIEWBOX} ${RUN_LEVEL_VIEWBOX}" fill="none" role="img" aria-label="${escapeXml(label)}">
  <defs>
    <linearGradient id="${edgeId}" x1="42" y1="34" x2="214" y2="220" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="${tokens.color.highlight}"/>
      <stop offset="0.54" stop-color="${tokens.color.outer}"/>
      <stop offset="1" stop-color="${tokens.color.shadow}"/>
    </linearGradient>
    <linearGradient id="${interiorId}" x1="128" y1="24" x2="128" y2="231" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="${tokens.color.mid}" stop-opacity="${state === 'locked' ? '0.12' : state === 'share-transparent' ? '0.00' : '0.34'}"/>
      <stop offset="0.46" stop-color="${RUN_LEVEL_PANEL_BLACK}" stop-opacity="${state === 'share-transparent' ? '0.00' : '0.96'}"/>
      <stop offset="1" stop-color="${RUN_LEVEL_NEAR_BLACK}" stop-opacity="${state === 'share-transparent' ? '0.00' : '1.00'}"/>
    </linearGradient>
    <linearGradient id="${gradientId}" x1="82" y1="86" x2="176" y2="146" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="${tokens.color.highlight}"/>
      <stop offset="0.48" stop-color="${tokens.color.outer}"/>
      <stop offset="1" stop-color="${tokens.color.shadow}"/>
    </linearGradient>
  </defs>
  <polygon points="${outer}" fill="${tokens.fill}" fill-opacity="${tokens.fillOpacity}" stroke="url(#${edgeId})" stroke-width="4.8" stroke-linejoin="round" stroke-opacity="${tokens.outerOpacity}"/>
  <polygon points="${inner}" fill="${state === 'share-transparent' ? 'transparent' : `url(#${interiorId})`}" fill-opacity="${tokens.innerFillOpacity}" stroke="${tokens.color.highlight}" stroke-width="1" stroke-opacity="${(tokens.outerOpacity * 0.55).toFixed(2)}"/>
  <path d="M44 70 L128 23 L212 70" stroke="${tokens.color.highlight}" stroke-width="1.15" stroke-opacity="${(tokens.outerOpacity * 0.28).toFixed(2)}"/>
  ${ringMarkup(level, state)}
  <ellipse cx="128" cy="129" rx="68" ry="31" fill="${tokens.color.glow}" opacity="${tokens.glowOpacity}"/>
  <path d="${RUN_LEVEL_MOUNTAIN.back}" fill="${tokens.color.shadow}" opacity="${(tokens.mountainOpacity * 0.52).toFixed(2)}"/>
  <path d="${RUN_LEVEL_MOUNTAIN.mainLeft}" fill="url(#${gradientId})" opacity="${tokens.mountainOpacity}"/>
  <path d="${RUN_LEVEL_MOUNTAIN.mainRight}" fill="${tokens.color.mid}" opacity="${(tokens.mountainOpacity * 0.92).toFixed(2)}"/>
  <path d="${RUN_LEVEL_MOUNTAIN.centralCut}" fill="${tokens.color.highlight}" opacity="${(tokens.mountainOpacity * 0.82).toFixed(2)}"/>
  <path d="${RUN_LEVEL_MOUNTAIN.leftCut}" fill="${tokens.color.shadow}" opacity="${(tokens.mountainOpacity * 0.78).toFixed(2)}"/>
  <path d="${RUN_LEVEL_MOUNTAIN.rightCut}" fill="${tokens.color.highlight}" opacity="${(tokens.mountainOpacity * 0.48).toFixed(2)}"/>
  <path d="${RUN_LEVEL_MOUNTAIN.ridge}" fill="none" stroke="${tokens.color.highlight}" stroke-width="2.05" stroke-linecap="round" stroke-linejoin="round" stroke-opacity="${(tokens.mountainOpacity * 0.7).toFixed(2)}"/>
  ${tokens.keylineOpacity > 0 ? `<text x="128" y="${titleY}" text-anchor="middle" font-family="Avenir Next, Inter, Arial, sans-serif" font-size="${level.titleUpper.length > 8 ? 17 : 21}" font-weight="700" letter-spacing="1.15" stroke="#050505" stroke-width="3" stroke-opacity="${tokens.keylineOpacity}" fill="none">${level.titleUpper}</text>` : ''}
  <text x="128" y="${titleY}" text-anchor="middle" font-family="Avenir Next, Inter, Arial, sans-serif" font-size="${level.titleUpper.length > 8 ? 17 : 21}" font-weight="700" letter-spacing="1.15" fill="${state === 'locked' ? RUN_LEVEL_LOCKED_GRAY : tokens.color.highlight}" fill-opacity="${tokens.titleOpacity}">${level.titleUpper}</text>
  ${compact ? '' : `<text x="128" y="195" text-anchor="middle" font-family="Avenir Next, Inter, Arial, sans-serif" font-size="10" font-weight="800" letter-spacing="3.2" fill="${state === 'locked' ? RUN_LEVEL_LOCKED_GRAY : '#F3F1EB'}" fill-opacity="${tokens.wordmarkOpacity}">STRIDEOS</text>
  <path d="M103 210 L128 224 L153 210" fill="none" stroke="${state === 'locked' ? RUN_LEVEL_LOCKED_GRAY : tokens.color.outer}" stroke-width="3.3" stroke-linecap="round" stroke-linejoin="round" stroke-opacity="${tokens.chevronOpacity}"/>
  <path d="M107 221 L128 233 L149 221" fill="none" stroke="${state === 'locked' ? RUN_LEVEL_LOCKED_GRAY : tokens.color.highlight}" stroke-width="3.3" stroke-linecap="round" stroke-linejoin="round" stroke-opacity="${tokens.chevronOpacity}"/>`}
</svg>
`;
}
