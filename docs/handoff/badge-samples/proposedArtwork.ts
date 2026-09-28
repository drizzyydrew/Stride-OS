import type { UnitSystem } from '/Users/drew/Developer/StrideOS_App_clean_build19_v3_foundation_local/src/store/settingsStore';
import {
  FIRST_ACHIEVEMENT_BY_ID,
  type FirstAchievementBadgeState,
  type FirstAchievementDefinition,
  type FirstAchievementId,
} from '/Users/drew/Developer/StrideOS_App_clean_build19_v3_foundation_local/src/achievements/firsts/firstsDefinitions';
import { FIRSTS_LOCKED_COLORS, FIRSTS_NEAR_BLACK } from '/Users/drew/Developer/StrideOS_App_clean_build19_v3_foundation_local/src/achievements/firsts/firstsTokens';
const FIRSTS_COLORS = { primary: '#E3BC7E', secondary: '#C1A276', highlight: '#F4DCA9', shadow: '#A8844F', glow: '#C99A55', text: '#E9C78C' };
import { firstAchievementAccessibilityLabel, firstAchievementBadgeShieldLabel } from '/Users/drew/Developer/StrideOS_App_clean_build19_v3_foundation_local/src/achievements/firsts/firstsUtils';

export type { FirstAchievementBadgeState } from '/Users/drew/Developer/StrideOS_App_clean_build19_v3_foundation_local/src/achievements/firsts/firstsDefinitions';

export const FIRSTS_VIEWBOX = 100;
export const FIRSTS_HEXAGON_PATH =
  'M 50 5.5 Q 52.12 5.5 54.14 6.8 L 82.84 24.8 Q 84.96 26.1 84.96 28.8 L 84.96 71.2 Q 84.96 73.9 82.84 75.2 L 54.14 93.2 Q 52.12 94.5 50 94.5 Q 47.88 94.5 45.86 93.2 L 17.16 75.2 Q 15.04 73.9 15.04 71.2 L 15.04 28.8 Q 15.04 26.1 17.16 24.8 L 45.86 6.8 Q 47.88 5.5 50 5.5Z';
export const FIRSTS_LABEL_FONT = "'Avenir Next', Inter, Arial, sans-serif";
export const FIRSTS_DISPLAY_FONT = "Didot, 'Bodoni 72', Georgia, serif";

export type FirstsRenderTokens = {
  primary: string;
  secondary: string;
  highlight: string;
  shadow: string;
  glow: string;
  text: string;
  fill: string;
  fillOpacity: number;
  borderOpacity: number;
  secondaryOpacity: number;
  ambientOpacity: number;
  glyphOpacity: number;
  titleOpacity: number;
  wordmarkOpacity: number;
  chevronOpacity: number;
  keylineOpacity: number;
};

export function firstsBadgeTokens(state: FirstAchievementBadgeState): FirstsRenderTokens {
  const visualState = state === 'share-opaque' ? 'unlocked' : state;
  const locked = visualState === 'locked';
  const transparent = visualState === 'share-transparent';
  const colors = locked ? FIRSTS_LOCKED_COLORS : FIRSTS_COLORS;
  return {
    ...colors,
    fill: transparent ? 'transparent' : FIRSTS_NEAR_BLACK,
    fillOpacity: transparent ? 0 : 1,
    borderOpacity: locked ? 0.48 : 1,
    secondaryOpacity: locked ? 0.24 : 0.36,
    ambientOpacity: locked ? 0.06 : transparent ? 0 : 0.18,
    glyphOpacity: locked ? 0.42 : 0.96,
    titleOpacity: locked ? 0.48 : 0.96,
    wordmarkOpacity: locked ? 0.32 : 0.76,
    chevronOpacity: locked ? 0.3 : 0.9,
    keylineOpacity: transparent ? 0.72 : 0,
  };
}

function escapeXml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function strokeAttrs(tokens: FirstsRenderTokens, width = 1.7): string {
  return `stroke="${tokens.primary}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" stroke-opacity="${tokens.glyphOpacity}"`;
}

function shield(label: string, tokens: FirstsRenderTokens): string {
  const fontSize = label.length >= 4 ? 12.4 : 14.2;
  return `<path d="M35.7 22.7 Q50 17.7 64.3 22.7 L64.3 38.6 Q64.3 48.1 50 54.2 Q35.7 48.1 35.7 38.6 Z" fill="none" ${strokeAttrs(tokens, 1.55)}/>
  <text x="50" y="39.7" text-anchor="middle" dominant-baseline="middle" font-family="${FIRSTS_DISPLAY_FONT}" font-size="${fontSize}" font-weight="700" fill="${tokens.primary}" fill-opacity="${tokens.glyphOpacity}">${escapeXml(label)}</text>`;
}

function personHead(cx: number, cy: number, r: number, tokens: FirstsRenderTokens): string {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" ${strokeAttrs(tokens, 1.55)}/>`;
}


// Outlined-silhouette figures (never stick figures): every body part is a
// capsule of real width; the mask keeps only a thin outline of their union,
// so overlapping limbs read as one body and the interior stays see-through.
type FigurePart = { d: string; width: number };
function outlinedFigure(id: string, parts: FigurePart[], head: { cx: number; cy: number; r: number }, tokens: FirstsRenderTokens, line = 0.95): string {
  const outer = parts.map(p => `<path d="${p.d}" fill="none" stroke="#fff" stroke-width="${p.width}" stroke-linecap="round" stroke-linejoin="round"/>`).join('');
  const inner = parts.map(p => `<path d="${p.d}" fill="none" stroke="#000" stroke-width="${Math.max(0.1, p.width - line * 2)}" stroke-linecap="round" stroke-linejoin="round"/>`).join('');
  return `<mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100"><rect width="100" height="100" fill="#000"/>${outer}${inner}</mask>
        <rect width="100" height="100" fill="${tokens.primary}" fill-opacity="${tokens.glyphOpacity}" mask="url(#${id})"/>
        <circle cx="${head.cx}" cy="${head.cy}" r="${head.r}" fill="none" stroke="${tokens.primary}" stroke-width="${line}" stroke-opacity="${tokens.glyphOpacity}"/>`;
}


// Outlined silhouette from real body-part shapes (tapered limbs, stout torso):
// shapes are filled + expanded by `line` in white, then the original shapes
// are knocked out in black, leaving one clean outline of their union. Shoes
// are solid. The head floats above the shoulders (no neck).
function outlinedShapes(id: string, shapes: string[], head: { cx: number; cy: number; r: number }, shoes: string, tokens: FirstsRenderTokens, line = 0.95): string {
  const outer = shapes.map(d => `<path d="${d}" fill="#fff" stroke="#fff" stroke-width="${line * 2}" stroke-linejoin="round"/>`).join('');
  const inner = shapes.map(d => `<path d="${d}" fill="#000"/>`).join('');
  return `<mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100"><rect width="100" height="100" fill="#000"/>${outer}${inner}<path d="${shoes}" fill="#fff" stroke="#fff" stroke-width="0.3" stroke-linejoin="round"/></mask>
        <rect width="100" height="100" fill="${tokens.primary}" fill-opacity="${tokens.glyphOpacity}" mask="url(#${id})"/>
        <circle cx="${head.cx}" cy="${head.cy}" r="${head.r}" fill="none" stroke="${tokens.primary}" stroke-width="${line}" stroke-opacity="${tokens.glyphOpacity}"/>`;
}

function glyph(definition: FirstAchievementDefinition, tokens: FirstsRenderTokens, units: UnitSystem): string {
  const line = strokeAttrs(tokens);
  const fine = strokeAttrs(tokens, 1.2);
  switch (definition.glyph) {
    case 'journey':
      return `<path d="M25.4 34.4 H46.8" fill="none" ${fine}/>
        <path d="M30.3 34.4 Q36.1 23.5 42 34.4" fill="none" ${fine}/>
        <path d="M36.1 18.3 V23.9 M25.5 23.8 L29.4 27.4 M46.7 23.8 L42.8 27.4 M21.3 31.6 L27.2 32.4 M50.8 31.6 L45 32.4" fill="none" ${fine}/>
        <path d="M32.5 51.8 C41.2 43.6 56.9 48.4 62.5 38.2 C55.3 38.8 47 39 40.9 42.2 C35 45.4 31.2 49.3 25.7 49.8" fill="none" ${line}/>
        <circle cx="25.2" cy="49.8" r="1.8" fill="${tokens.primary}" fill-opacity="${tokens.glyphOpacity}"/>`;
    case 'run':
      return `<g stroke="${tokens.primary}" stroke-width="1.05" stroke-linecap="round" fill="none">
          <path d="M22.5 27.2 H38.6" stroke-opacity="${tokens.glyphOpacity * 0.95}"/>
          <path d="M18.4 31.2 H37.2" stroke-opacity="${tokens.glyphOpacity * 0.85}"/>
          <path d="M20.6 35.2 H36.8" stroke-opacity="${tokens.glyphOpacity * 0.75}"/>
          <path d="M24.2 39.2 H37.8" stroke-opacity="${tokens.glyphOpacity * 0.6}"/>
          <path d="M28.8 43.2 H38.4" stroke-opacity="${tokens.glyphOpacity * 0.45}"/>
        </g>
        <g transform="translate(51.5 34) scale(1.14) translate(-51.5 -34)">
        ${outlinedShapes(`run-${tokens.primary.slice(1)}-${tokens.fillOpacity}`, [
          'M51.60 24.60 L53.00 23.50 L55.40 23.20 L57.40 24.00 L57.60 25.40 L54.20 32.80 L51.20 34.00 L49.00 33.00 Z',
          'M55.28 26.32 L61.02 31.77 L66.85 28.18 L65.95 26.62 L61.38 29.03 L57.12 24.48 Z',
          'M53.32 23.93 L46.64 25.60 L42.55 30.18 L43.85 31.42 L47.76 27.60 L53.88 26.47 Z',
          'M51.31 32.97 L56.88 38.38 L55.45 46.45 L59.64 48.43 L61.73 48.40 L61.87 47.00 L60.16 46.57 L57.75 45.35 L59.92 37.62 L54.49 30.23 Z',
          'M48.53 30.94 L44.31 40.65 L39.14 44.79 L38.28 48.69 L39.72 49.11 L40.86 46.01 L46.49 42.55 L52.27 32.86 Z',
        ], { cx: 57.9, cy: 18.4, r: 3.2 }, 'M55.75 47.65 L59.37 49.35 L61.63 49.34 L61.97 46.06 L60.43 45.65 L57.45 44.15 Z M38.13 44.86 L37.37 48.43 L40.63 49.37 L41.87 45.94 Z', tokens)}
        </g>`;
    case 'walk':
      return `${personHead(50, 22.6, 3.2, tokens)}
        <path d="M49.2 29 L47.6 42.2 M47.6 42.2 L40.8 55.8 M47.6 42.2 L55.8 55.1 M48.5 32.8 L41.8 38.9 M49.5 33.1 L56.3 39.9" fill="none" ${line}/>`;
    case 'runWalk':
      return `${personHead(36.2, 24.5, 2.7, tokens)}
        <path d="M34.8 29.8 L30.7 38.9 L38 43.8 M31.2 38.6 L25.9 47.7 M38 43.8 L34.4 54.4 M36.7 32.2 L44.1 36.2" fill="none" ${fine}/>
        <path d="M43.8 52.7 C50.3 47.2 55.9 47.4 62.1 52.8" fill="none" ${fine} stroke-dasharray="1.1 2.7"/>
        ${personHead(66.3, 27, 2.6, tokens)}
        <path d="M65.4 32.2 L64.3 43.1 M64.3 43.1 L58.7 53.5 M64.3 43.1 L70.6 53.4 M65 35.2 L59.3 39.8 M65.5 35.3 L71.5 40.5" fill="none" ${fine}/>`;
    case 'ride':
      return `<circle cx="30.8" cy="43.8" r="9.2" fill="none" ${line}/>
        <circle cx="68.6" cy="43.8" r="9.2" fill="none" ${line}/>
        <path d="M30.8 43.8 L44.2 28.8 L52.4 43.8 L40.7 43.8 L49.2 31.9 L60.7 43.8 M44.2 28.8 H53.7 M58.8 27.3 H65.1 M65.1 27.3 L69.4 33.1 M42.3 27.1 H36.7 M50.5 43.8 H55" fill="none" ${fine}/>`;
    case 'mobility':
      return `<path d="M23.7 35.3 C29.3 23.9 38.5 18.3 49.7 18" fill="none" ${fine}/>
        ${personHead(50.2, 18.3, 2.9, tokens)}
        <path d="M48.9 24.3 L43.9 37.5 L35.7 49.7 M43.9 37.5 L57.4 50.1 M46.5 27.4 L38.4 34.1 M46.3 27.2 L53.4 17.8 M35.7 49.7 H25.3 M57.4 50.1 H69.4" fill="none" ${line}/>
        <circle cx="25.3" cy="49.7" r="1.8" fill="${tokens.primary}" fill-opacity="${tokens.glyphOpacity}"/>
        <circle cx="69.4" cy="50.1" r="1.8" fill="${tokens.primary}" fill-opacity="${tokens.glyphOpacity}"/>`;
    case 'race5k':
    case 'race10k':
    case 'halfMarathon':
    case 'marathon':
      return shield(firstAchievementBadgeShieldLabel(definition, units) ?? '', tokens);
    case 'route':
      return `<path d="M63.2 20.5 C70.1 20.5 75.2 25.7 75.2 32.1 C75.2 40.4 63.2 51.5 63.2 51.5 C63.2 51.5 51.3 40.4 51.3 32.1 C51.3 25.7 56.4 20.5 63.2 20.5 Z" fill="none" ${line}/>
        <circle cx="63.2" cy="31.4" r="3.5" fill="none" ${fine}/>
        <path d="M28.5 52.2 C34.9 46.9 44.8 49.3 51.9 44.8" fill="none" ${fine} stroke-dasharray="1.5 3"/>
        <circle cx="28.5" cy="52.2" r="1.9" fill="${tokens.primary}" fill-opacity="${tokens.glyphOpacity}"/>
        <circle cx="51.9" cy="44.8" r="1.9" fill="${tokens.primary}" fill-opacity="${tokens.glyphOpacity}"/>`;
    case 'structured':
      return `<rect x="31.4" y="22.4" width="37.2" height="34.8" rx="2.8" fill="none" ${line}/>
        <path d="M39.7 18.4 V27 M60.3 18.4 V27 M31.4 32.4 H68.6" fill="none" ${line}/>
        <rect x="38.2" y="38.2" width="4.5" height="4.5" rx="0.8" fill="none" ${fine}/>
        <rect x="48" y="38.2" width="4.5" height="4.5" rx="0.8" fill="none" ${fine}/>
        <rect x="57.8" y="38.2" width="4.5" height="4.5" rx="0.8" fill="none" ${fine}/>
        <rect x="38.2" y="48" width="4.5" height="4.5" rx="0.8" fill="none" ${fine}/>
        <rect x="48" y="48" width="4.5" height="4.5" rx="0.8" fill="none" ${fine}/>
        <rect x="57.8" y="48" width="4.5" height="4.5" rx="0.8" fill="none" ${fine}/>`;
    case 'adapted':
      return `<path d="M36.2 53.9 L39.2 43.5 L62.7 20 L70.3 27.6 L46.7 51.1 Z" fill="none" ${line}/>
        <path d="M58.9 23.8 L66.5 31.4 M39.2 43.5 L46.7 51.1 M34.3 56.1 L46.7 51.1" fill="none" ${fine}/>`;
    case 'strength':
      return `<path d="M25.3 40.5 H74.7 M33.5 31.6 V49.4 M38.8 28.7 V52.3 M61.2 28.7 V52.3 M66.5 31.6 V49.4 M29.2 35.2 V45.8 M70.8 35.2 V45.8" fill="none" ${line}/>`;
    case 'movementLab':
      return `<path d="M28.4 24.2 H36.6 M28.4 24.2 V32.4 M71.6 24.2 H63.4 M71.6 24.2 V32.4 M28.4 55.9 H36.6 M28.4 55.9 V47.7 M71.6 55.9 H63.4 M71.6 55.9 V47.7" fill="none" ${fine}/>
        ${personHead(50, 23.8, 2.6, tokens)}
        <circle cx="50" cy="31" r="1.5" fill="${tokens.primary}" fill-opacity="${tokens.glyphOpacity}"/>
        <circle cx="42.9" cy="32.6" r="1.5" fill="${tokens.primary}" fill-opacity="${tokens.glyphOpacity}"/>
        <circle cx="57.1" cy="32.6" r="1.5" fill="${tokens.primary}" fill-opacity="${tokens.glyphOpacity}"/>
        <circle cx="39.3" cy="40.6" r="1.5" fill="${tokens.primary}" fill-opacity="${tokens.glyphOpacity}"/>
        <circle cx="60.7" cy="40.6" r="1.5" fill="${tokens.primary}" fill-opacity="${tokens.glyphOpacity}"/>
        <circle cx="36.2" cy="49.1" r="1.5" fill="${tokens.primary}" fill-opacity="${tokens.glyphOpacity}"/>
        <circle cx="63.8" cy="49.1" r="1.5" fill="${tokens.primary}" fill-opacity="${tokens.glyphOpacity}"/>
        <circle cx="45.5" cy="45.2" r="1.5" fill="${tokens.primary}" fill-opacity="${tokens.glyphOpacity}"/>
        <circle cx="54.5" cy="45.2" r="1.5" fill="${tokens.primary}" fill-opacity="${tokens.glyphOpacity}"/>
        <circle cx="42.1" cy="55.2" r="1.5" fill="${tokens.primary}" fill-opacity="${tokens.glyphOpacity}"/>
        <circle cx="57.9" cy="55.2" r="1.5" fill="${tokens.primary}" fill-opacity="${tokens.glyphOpacity}"/>
        <path d="M42.9 32.6 L50 31 L57.1 32.6 M50 31 L50 40.1 L45.5 45.2 L42.1 55.2 M50 40.1 L54.5 45.2 L57.9 55.2 M42.9 32.6 L39.3 40.6 L36.2 49.1 M57.1 32.6 L60.7 40.6 L63.8 49.1 M45.5 45.2 H54.5" fill="none" ${strokeAttrs(tokens, 0.95)}/>`;
    default:
      return '';
  }
}

function renderTitleLines(lines: readonly string[], tokens: FirstsRenderTokens, compact: boolean): string {
  if (compact) return '';
  const startY = lines.length > 1 ? 62.2 : 65.2;
  const lineHeight = lines.length > 1 ? 7.2 : 0;
  return lines.map((line, index) => {
    const y = startY + index * lineHeight;
    const size = line.length > 16 ? 5.8 : 7;
    const keyline = tokens.keylineOpacity > 0
      ? `<text x="50" y="${y}" text-anchor="middle" font-family="${FIRSTS_LABEL_FONT}" font-size="${size}" font-weight="900" letter-spacing="0.35" stroke="#030405" stroke-width="0.42" stroke-opacity="${tokens.keylineOpacity}" fill="none">${escapeXml(line)}</text>`
      : '';
    return `${keyline}<text x="50" y="${y}" text-anchor="middle" font-family="${FIRSTS_LABEL_FONT}" font-size="${size}" font-weight="500" letter-spacing="0.35" fill="${tokens.highlight}" fill-opacity="${tokens.titleOpacity}">${escapeXml(line)}</text>`;
  }).join('\n  ');
}

export function renderFirstAchievementBadgeSvg(
  achievement: FirstAchievementId,
  state: FirstAchievementBadgeState = 'unlocked',
  options: { compact?: boolean; size?: number; unitSystem?: UnitSystem } = {},
): string {
  const definition = FIRST_ACHIEVEMENT_BY_ID[achievement];
  const visualState = state === 'share-opaque' ? 'unlocked' : state;
  const compact = options.compact ?? false;
  const size = options.size ?? FIRSTS_VIEWBOX;
  const units = options.unitSystem ?? 'imperial';
  const tokens = firstsBadgeTokens(visualState);
  const edgeId = `firsts-${definition.slug}-${visualState}-edge`;
  const glowId = `firsts-${definition.slug}-${visualState}-glow`;
  const label = firstAchievementAccessibilityLabel(definition, visualState === 'locked' ? 'locked' : 'earned', units);
  const wordmarkY = definition.titleLines.length > 1 ? 76.6 : 74.2;
  const chevOneY = definition.titleLines.length > 1 ? 81.4 : 79.8;
  const chevTwoY = definition.titleLines.length > 1 ? 85.2 : 83.6;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${FIRSTS_VIEWBOX} ${FIRSTS_VIEWBOX}" fill="none" role="img" aria-label="${escapeXml(label)}">
  <defs>
    <linearGradient id="${edgeId}" x1="14" y1="7" x2="86" y2="93" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="${tokens.highlight}"/>
      <stop offset="0.54" stop-color="${tokens.primary}"/>
      <stop offset="1" stop-color="${tokens.shadow}"/>
    </linearGradient>
    <radialGradient id="${glowId}" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(50 42) rotate(90) scale(35 34)">
      <stop offset="0" stop-color="${tokens.glow}" stop-opacity="${visualState === 'locked' ? '0.12' : '0.33'}"/>
      <stop offset="0.64" stop-color="${tokens.glow}" stop-opacity="${visualState === 'share-transparent' ? '0.03' : '0.1'}"/>
      <stop offset="1" stop-color="${tokens.glow}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <path d="${FIRSTS_HEXAGON_PATH}" fill="${tokens.fill}" fill-opacity="${tokens.fillOpacity}" stroke="url(#${edgeId})" stroke-width="1.35" stroke-linejoin="round" stroke-opacity="${tokens.borderOpacity}"/>
  <ellipse cx="50" cy="42" rx="31" ry="30" fill="url(#${glowId})" opacity="${tokens.ambientOpacity}"/>
  <g transform="${definition.glyph === 'run' ? '' : 'translate(50 36.5) scale(1.22) translate(-50 -38.5)'}">
    ${glyph(definition, tokens, units)}
  </g>
  ${renderTitleLines(definition.titleLines, tokens, compact)}
  ${compact ? '' : `
  ${tokens.keylineOpacity > 0 ? `<text x="50" y="${wordmarkY}" text-anchor="middle" font-family="${FIRSTS_LABEL_FONT}" font-size="3.6" font-weight="900" letter-spacing="1.45" stroke="#030405" stroke-width="0.32" stroke-opacity="${tokens.keylineOpacity}" fill="none">STRIDEOS</text>` : ''}
  <text x="50" y="${wordmarkY}" text-anchor="middle" font-family="${FIRSTS_LABEL_FONT}" font-size="3.7" font-weight="600" letter-spacing="0.9" fill="${tokens.highlight}" fill-opacity="${tokens.wordmarkOpacity}">STRIDEOS</text>
  <path d="M43.6 ${chevOneY} L50 ${chevOneY + 3.8} L56.4 ${chevOneY}" fill="none" stroke="${tokens.primary}" stroke-width="0.95" stroke-linecap="round" stroke-linejoin="round" stroke-opacity="${tokens.chevronOpacity}"/>
  <path d="M44.3 ${chevTwoY} L50 ${chevTwoY + 3.3} L55.7 ${chevTwoY}" fill="none" stroke="${tokens.primary}" stroke-width="0.95" stroke-linecap="round" stroke-linejoin="round" stroke-opacity="${tokens.chevronOpacity}"/>`}
</svg>
`;
}
