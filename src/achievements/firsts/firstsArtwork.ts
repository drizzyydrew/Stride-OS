import type { UnitSystem } from '../../store/settingsStore';
import {
  FIRST_ACHIEVEMENT_BY_ID,
  normalizeFirstAchievementBadgeState,
  type FirstAchievementBadgeInputState,
  type FirstAchievementBadgeState,
  type FirstAchievementDefinition,
  type FirstAchievementId,
} from './firstsDefinitions';
import {
  FIRSTS_COLORS,
  FIRSTS_LOCKED_COLORS,
  FIRSTS_NEAR_BLACK,
} from './firstsTokens';
import { firstAchievementAccessibilityLabel, firstAchievementBadgeShieldLabel } from './firstsUtils';
import { STRENGTH_DUMBBELL_SIGNATURE } from '../strength/strengthArtwork';

export type { FirstAchievementBadgeInputState, FirstAchievementBadgeState } from './firstsDefinitions';

export const FIRSTS_VIEWBOX = 100;
export const FIRSTS_HEXAGON_PATH =
  'M50 4 Q52.4 4 54.5 5.2 L84.8 22.6 Q87 23.9 87 26.5 L87 72 Q87 74.6 84.8 75.9 L54.5 93.8 Q52.4 95 50 95 Q47.6 95 45.5 93.8 L15.2 75.9 Q13 74.6 13 72 L13 26.5 Q13 23.9 15.2 22.6 L45.5 5.2 Q47.6 4 50 4 Z';
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
  const locked = state === 'locked';
  const transparent = state === 'transparent';
  const colors = locked ? FIRSTS_LOCKED_COLORS : FIRSTS_COLORS;
  return {
    ...colors,
    fill: transparent ? 'transparent' : FIRSTS_NEAR_BLACK,
    fillOpacity: transparent ? 0 : 1,
    borderOpacity: locked ? 0.48 : 1,
    secondaryOpacity: locked ? 0.24 : 0.32,
    ambientOpacity: locked ? 0.05 : transparent ? 0 : 0.11,
    glyphOpacity: locked ? 0.48 : 0.98,
    titleOpacity: locked ? 0.52 : 0.97,
    wordmarkOpacity: locked ? 0.34 : 0.78,
    chevronOpacity: locked ? 0.34 : 0.92,
    keylineOpacity: transparent ? 0.72 : 0,
  };
}

function escapeXml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function strokeAttrs(tokens: FirstsRenderTokens, width = 1.85): string {
  return `stroke="${tokens.primary}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" stroke-opacity="${tokens.glyphOpacity}"`;
}

function shield(label: string, tokens: FirstsRenderTokens): string {
  const fontSize = label.length >= 4 ? 12.1 : 13.9;
  return `<path d="M34.6 22.9 C39.2 24.5 44 24.2 50 20.9 C56 24.2 60.8 24.5 65.4 22.9 L65.4 38.8 C65.4 48.8 56 53.4 50 55.8 C44 53.4 34.6 48.8 34.6 38.8 Z" fill="none" ${strokeAttrs(tokens, 1.55)}/>
  <text x="50" y="39.8" text-anchor="middle" dominant-baseline="middle" font-family="${FIRSTS_LABEL_FONT}" font-size="${fontSize}" font-weight="600" fill="${tokens.primary}" fill-opacity="${tokens.glyphOpacity}">${escapeXml(label)}</text>`;
}

function personHead(cx: number, cy: number, r: number, tokens: FirstsRenderTokens): string {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" ${strokeAttrs(tokens, 1.55)}/>`;
}

function glyph(definition: FirstAchievementDefinition, tokens: FirstsRenderTokens, units: UnitSystem): string {
  const line = strokeAttrs(tokens);
  const fine = strokeAttrs(tokens, 1.2);
  switch (definition.glyph) {
    case 'journey':
      return `<path d="M29.2 34.2 H48.4" fill="none" ${fine}/>
        <path d="M32.2 34.1 C34.2 27.8 39.7 27.8 42.1 34.1" fill="none" ${fine}/>
        <path d="M37.2 18.7 V23.7 M28.2 23.9 L31.9 27.2 M46.3 23.9 L42.7 27.2 M23.9 31.1 L29.4 32.1 M51 31.1 L45.6 32.1 M26.8 18.9 L30.8 24 M47.5 18.9 L43.6 24" fill="none" ${strokeAttrs(tokens, 1.05)}/>
        <path d="M31.3 52.6 C36.4 46.6 48.5 47.5 52.7 40.4 C48.3 40.1 43.8 40.7 39.4 42.7 M29.4 48.9 C36.9 45.5 42.5 42.7 49.1 38.6" fill="none" ${line}/>
        <circle cx="25.4" cy="50.5" r="1.9" fill="${tokens.primary}" fill-opacity="${tokens.glyphOpacity}"/>`;
    case 'run':
      return `<path d="M17.8 31.5 H30.6 M15.9 36.9 H29.1 M20.4 42.3 H30.1 M23.6 47.4 H31.6" fill="none" ${fine}/>
        ${personHead(48.2, 23.7, 3.2, tokens)}
        <path d="M46.3 29.4 L40.9 40.3 L49.7 46.4 M42.6 39.9 L34.8 49.7 L30.6 50.4 M49.7 46.4 L45 58.4 L41.1 60 M48.5 33 L58.1 37.9 M43.5 33.4 L36.3 35.5" fill="none" ${line}/>`;
    case 'walk':
      return `${personHead(50, 22.6, 3.2, tokens)}
        <path d="M49.1 29 L47.9 42.1 M47.9 42.1 L40.9 55.7 L37.9 56.3 M47.9 42.1 L56 55 L59.5 55.5 M48.5 32.8 L41.7 38.8 M49.6 33 L56.4 39.8" fill="none" ${line}/>`;
    case 'runWalk':
      return `${personHead(36.2, 24.5, 2.7, tokens)}
        <path d="M34.8 29.8 L30.7 38.9 L38 43.8 M31.2 38.6 L25.9 47.7 L23.7 48.5 M38 43.8 L34.4 54.4 L31.8 55.5 M36.7 32.2 L44.1 36.2 M26.5 34.3 H20.4 M29.1 39 H22.3" fill="none" ${fine}/>
        <path d="M43.8 52.7 C50.3 47.2 55.9 47.4 62.1 52.8" fill="none" ${strokeAttrs(tokens, 1.15)} stroke-dasharray="1.1 2.7"/>
        ${personHead(66.3, 27, 2.6, tokens)}
        <path d="M65.4 32.2 L64.3 43.1 M64.3 43.1 L58.7 53.5 M64.3 43.1 L70.6 53.4 M65 35.2 L59.3 39.8 M65.5 35.3 L71.5 40.5" fill="none" ${fine}/>`;
    case 'ride':
      return `<circle cx="30.8" cy="43.3" r="9" fill="none" ${line}/>
        <circle cx="68.3" cy="43.3" r="9" fill="none" ${line}/>
        <path d="M30.8 43.3 L43.8 28.5 L52.2 43.3 L40.5 43.3 L49.1 31.6 L60.6 43.3 M43.8 28.5 H53.2 M58.4 27.2 H64.9 M64.9 27.2 L69.1 32.8 M42 27 H36.6 M50.4 43.3 H55.2" fill="none" ${fine}/>`;
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
      return STRENGTH_DUMBBELL_SIGNATURE
        .replace(/stroke="currentColor"/g, `stroke="${tokens.primary}"`)
        .replace(/<g data-glyph="canonical-strength-dumbbell">/, `<g data-glyph="canonical-strength-dumbbell" opacity="${tokens.glyphOpacity}">`);
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
  const startY = lines.length > 1 ? 62.4 : 65.5;
  const lineHeight = lines.length > 1 ? 6.3 : 0;
  return lines.map((line, index) => {
    const y = startY + index * lineHeight;
    const size = line.length > 16 ? 4.7 : 5.5;
    const keyline = tokens.keylineOpacity > 0
      ? `<text x="50" y="${y}" text-anchor="middle" font-family="${FIRSTS_LABEL_FONT}" font-size="${size}" font-weight="600" letter-spacing="0.28" stroke="#030405" stroke-width="0.42" stroke-opacity="${tokens.keylineOpacity}" fill="none">${escapeXml(line)}</text>`
      : '';
    return `${keyline}<text x="50" y="${y}" text-anchor="middle" font-family="${FIRSTS_LABEL_FONT}" font-size="${size}" font-weight="600" letter-spacing="0.28" fill="${tokens.text}" fill-opacity="${tokens.titleOpacity}">${escapeXml(line)}</text>`;
  }).join('\n  ');
}

export function renderFirstAchievementBadgeSvg(
  achievement: FirstAchievementId,
  state: FirstAchievementBadgeInputState = 'unlocked',
  options: { compact?: boolean; size?: number; unitSystem?: UnitSystem } = {},
): string {
  const resolvedState = normalizeFirstAchievementBadgeState(state);
  const definition = FIRST_ACHIEVEMENT_BY_ID[achievement];
  const compact = options.compact ?? false;
  const size = options.size ?? FIRSTS_VIEWBOX;
  const units = options.unitSystem ?? 'imperial';
  const tokens = firstsBadgeTokens(resolvedState);
  const edgeId = `firsts-${definition.slug}-${resolvedState}-edge`;
  const glowId = `firsts-${definition.slug}-${resolvedState}-glow`;
  const label = firstAchievementAccessibilityLabel(definition, resolvedState === 'locked' ? 'locked' : 'earned', units);
  const wordmarkY = definition.titleLines.length > 1 ? 76.3 : 74.2;
  const chevOneY = definition.titleLines.length > 1 ? 82 : 81.5;
  const chevTwoY = definition.titleLines.length > 1 ? 87.2 : 86.7;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${FIRSTS_VIEWBOX} ${FIRSTS_VIEWBOX}" fill="none" role="img" aria-label="${escapeXml(label)}">
  <defs>
    <linearGradient id="${edgeId}" x1="14" y1="7" x2="86" y2="93" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="${tokens.highlight}"/>
      <stop offset="0.54" stop-color="${tokens.primary}"/>
      <stop offset="1" stop-color="${tokens.shadow}"/>
    </linearGradient>
    <radialGradient id="${glowId}" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(50 42) rotate(90) scale(35 34)">
      <stop offset="0" stop-color="${tokens.glow}" stop-opacity="${resolvedState === 'locked' ? '0.1' : '0.22'}"/>
      <stop offset="0.64" stop-color="${tokens.glow}" stop-opacity="${resolvedState === 'transparent' ? '0.03' : '0.08'}"/>
      <stop offset="1" stop-color="${tokens.glow}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <path d="${FIRSTS_HEXAGON_PATH}" fill="none" stroke="${tokens.glow}" stroke-width="4.2" stroke-linejoin="round" stroke-opacity="${resolvedState === 'transparent' ? 0 : 0.08}"/>
  <path d="${FIRSTS_HEXAGON_PATH}" fill="${tokens.fill}" fill-opacity="${tokens.fillOpacity}" stroke="url(#${edgeId})" stroke-width="2.15" stroke-linejoin="round" stroke-opacity="${tokens.borderOpacity}"/>
  <ellipse cx="50" cy="38" rx="30" ry="26" fill="url(#${glowId})" opacity="${tokens.ambientOpacity}"/>
  <g>
    ${glyph(definition, tokens, units)}
  </g>
  ${renderTitleLines(definition.titleLines, tokens, compact)}
  ${compact ? '' : `
  ${tokens.keylineOpacity > 0 ? `<text x="50" y="${wordmarkY}" text-anchor="middle" font-family="${FIRSTS_LABEL_FONT}" font-size="3.5" font-weight="700" letter-spacing="1.38" stroke="#030405" stroke-width="0.32" stroke-opacity="${tokens.keylineOpacity}" fill="none">STRIDEOS</text>` : ''}
  <text x="50" y="${wordmarkY}" text-anchor="middle" font-family="${FIRSTS_LABEL_FONT}" font-size="3.5" font-weight="700" letter-spacing="1.38" fill="${tokens.text}" fill-opacity="${tokens.wordmarkOpacity}">STRIDEOS</text>
  <path d="M43.6 ${chevOneY} L50 ${chevOneY + 3.8} L56.4 ${chevOneY}" fill="none" stroke="${tokens.primary}" stroke-width="1.05" stroke-linecap="round" stroke-linejoin="round" stroke-opacity="${tokens.chevronOpacity}"/>
  <path d="M44.3 ${chevTwoY} L50 ${chevTwoY + 3.3} L55.7 ${chevTwoY}" fill="none" stroke="${tokens.highlight}" stroke-width="1.05" stroke-linecap="round" stroke-linejoin="round" stroke-opacity="${tokens.chevronOpacity}"/>`}
</svg>
`;
}
