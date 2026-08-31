import {
  STRENGTH_ACHIEVEMENT_BY_ID,
  type StrengthAchievementBadgeState,
  type StrengthAchievementDefinition,
  type StrengthAchievementId,
} from './strengthDefinitions';
import {
  STRENGTH_COLORS,
  STRENGTH_LOCKED_COLORS,
  STRENGTH_NEAR_BLACK,
} from './strengthTokens';
import { strengthAchievementAccessibilityLabel } from './strengthUtils';

export type { StrengthAchievementBadgeState } from './strengthDefinitions';

export const STRENGTH_VIEWBOX = 100;
export const STRENGTH_HEXAGON_PATH =
  'M50 5.5 Q52.3 5.5 54.5 6.8 L85.7 24.8 Q88 26.1 88 28.8 L88 71.2 Q88 73.9 85.7 75.2 L54.5 93.2 Q52.3 94.5 50 94.5 Q47.7 94.5 45.5 93.2 L14.3 75.2 Q12 73.9 12 71.2 L12 28.8 Q12 26.1 14.3 24.8 L45.5 6.8 Q47.7 5.5 50 5.5 Z';
export const STRENGTH_LABEL_FONT = "'Avenir Next', Inter, Arial, sans-serif";
export const STRENGTH_DISPLAY_FONT = "'Avenir Next', Inter, Arial, sans-serif";

export const STRENGTH_DUMBBELL_SIGNATURE =
  '<!-- strength-dumbbell-start --><g data-glyph="canonical-strength-dumbbell"><path d="M24.6 38.9 H75.4" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M31.1 31.8 V46 M36.2 29.4 V48.4 M63.8 29.4 V48.4 M68.9 31.8 V46 M27.1 34.9 V42.9 M72.9 34.9 V42.9" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"/><path d="M40.7 38.9 H59.3" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></g><!-- strength-dumbbell-end -->';

export type StrengthRenderTokens = {
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

export function strengthBadgeTokens(state: StrengthAchievementBadgeState): StrengthRenderTokens {
  const visualState = state === 'share-opaque' ? 'unlocked' : state;
  const locked = visualState === 'locked';
  const transparent = visualState === 'share-transparent';
  const colors = locked ? STRENGTH_LOCKED_COLORS : STRENGTH_COLORS;
  return {
    ...colors,
    fill: transparent ? 'transparent' : STRENGTH_NEAR_BLACK,
    fillOpacity: transparent ? 0 : 1,
    borderOpacity: locked ? 0.48 : 1,
    secondaryOpacity: locked ? 0.24 : 0.34,
    ambientOpacity: locked ? 0.06 : transparent ? 0 : 0.16,
    glyphOpacity: locked ? 0.42 : 0.96,
    titleOpacity: locked ? 0.48 : 0.96,
    wordmarkOpacity: locked ? 0.32 : 0.76,
    chevronOpacity: locked ? 0.3 : 0.88,
    keylineOpacity: transparent ? 0.72 : 0,
  };
}

function escapeXml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function strokeAttrs(tokens: StrengthRenderTokens, width = 1.6): string {
  return `stroke="${tokens.primary}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" stroke-opacity="${tokens.glyphOpacity}"`;
}

function keylineText(text: string, x: number, y: number, fontSize: number, weight: number, tracking: number, tokens: StrengthRenderTokens): string {
  return tokens.keylineOpacity > 0
    ? `<text x="${x}" y="${y}" text-anchor="middle" font-family="${STRENGTH_LABEL_FONT}" font-size="${fontSize}" font-weight="${weight}" letter-spacing="${tracking}" stroke="#030405" stroke-width="0.36" stroke-opacity="${tokens.keylineOpacity}" fill="none">${escapeXml(text)}</text>`
    : '';
}

export function renderStrengthDumbbellGlyph(tokens: StrengthRenderTokens): string {
  return STRENGTH_DUMBBELL_SIGNATURE
    .replace(/stroke="currentColor"/g, `stroke="${tokens.primary}"`)
    .replace(/<g data-glyph="canonical-strength-dumbbell">/, `<g data-glyph="canonical-strength-dumbbell" opacity="${tokens.glyphOpacity}">`);
}

function renderConsistencyGlyph(definition: StrengthAchievementDefinition, tokens: StrengthRenderTokens): string {
  const number = definition.badgeNumber ?? '';
  const star = `M73.1 22.5 L75.1 27 L79.8 28.8 L75.2 30.5 L73.1 35 L71.1 30.5 L66.4 28.8 L71 27 Z`;
  return `<text x="30.4" y="34.2" text-anchor="middle" font-family="${STRENGTH_DISPLAY_FONT}" font-size="${number.length > 1 ? 12.2 : 13.4}" font-weight="800" fill="${tokens.text}" fill-opacity="${tokens.titleOpacity}">${escapeXml(number)}</text>
    <text x="30.4" y="41.7" text-anchor="middle" font-family="${STRENGTH_LABEL_FONT}" font-size="3.5" font-weight="900" letter-spacing="0.15" fill="${tokens.text}" fill-opacity="${tokens.wordmarkOpacity}">TOTAL</text>
    <path d="M29.5 55.3 C39.2 54.4 42.1 51.6 48.2 51.3 L54.6 45.7 L61.1 48.3 C65.6 41.5 68.9 33.7 73.1 28.8" fill="none" ${strokeAttrs(tokens, 1.45)}/>
    <path d="${star}" fill="${tokens.primary}" fill-opacity="${tokens.glyphOpacity}"/>
    <path d="M73.1 18.5 V21.2 M82.1 28.8 H79.8 M78.8 21.9 L76.8 24 M80 35.9 L77.5 33.2" fill="none" ${strokeAttrs(tokens, 0.95)}/>`;
}

function renderShoe(tokens: StrengthRenderTokens): string {
  return `<path d="M22.5 45.4 C28.3 46.8 36.7 47.1 46.4 44.7 C44 40.8 40.5 38.2 36 36.2 L33.1 32.5 C31.8 30.8 28.7 32 29.5 34.1 L30.9 38.1 C27.1 39.9 24.5 42 22.5 45.4 Z" fill="none" ${strokeAttrs(tokens, 1.35)}/>
    <path d="M27.2 42.2 C33.5 44 39.1 43.5 45 41.8 M34.1 36.5 L31.7 39 M38 38 L35.6 40.5" fill="none" ${strokeAttrs(tokens, 0.9)}/>`;
}

function renderCompactDumbbell(tokens: StrengthRenderTokens): string {
  return `<g transform="translate(26 33) scale(0.66)" opacity="${tokens.glyphOpacity}">
    <path d="M24.6 38.9 H75.4 M31.1 31.8 V46 M36.2 29.4 V48.4 M63.8 29.4 V48.4 M68.9 31.8 V46 M27.1 34.9 V42.9 M72.9 34.9 V42.9 M40.7 38.9 H59.3" fill="none" stroke="${tokens.primary}" stroke-width="2.35" stroke-linecap="round" stroke-linejoin="round"/>
  </g>`;
}

function renderStrengthRunGlyph(tokens: StrengthRenderTokens): string {
  return `<g>${renderShoe(tokens)}${renderCompactDumbbell(tokens)}</g>`;
}

function renderStructuredGlyph(tokens: StrengthRenderTokens): string {
  const fine = strokeAttrs(tokens, 1.05);
  return `<rect x="31.4" y="22.4" width="37.2" height="34.8" rx="2.8" fill="none" ${strokeAttrs(tokens, 1.55)}/>
    <path d="M39.7 18.4 V27 M60.3 18.4 V27 M31.4 32.4 H68.6" fill="none" ${strokeAttrs(tokens, 1.45)}/>
    <rect x="38.2" y="38.2" width="4.5" height="4.5" rx="0.8" fill="none" ${fine}/>
    <rect x="48" y="38.2" width="4.5" height="4.5" rx="0.8" fill="none" ${fine}/>
    <rect x="57.8" y="38.2" width="4.5" height="4.5" rx="0.8" fill="none" ${fine}/>
    <rect x="38.2" y="48" width="4.5" height="4.5" rx="0.8" fill="none" ${fine}/>
    <rect x="48" y="48" width="4.5" height="4.5" rx="0.8" fill="none" ${fine}/>
    <rect x="57.8" y="48" width="4.5" height="4.5" rx="0.8" fill="none" ${fine}/>`;
}

function renderPrehabGlyph(tokens: StrengthRenderTokens): string {
  return `<path d="M34.8 23.6 Q50 18.3 65.2 23.6 L65.2 41.5 Q65.2 52.6 50 59.5 Q34.8 52.6 34.8 41.5 Z" fill="none" ${strokeAttrs(tokens, 1.5)}/>
    <path d="M42.1 35.1 L50 39.9 L57.9 35.1 M42.1 42.2 L50 47 L57.9 42.2 M42.1 49.3 L50 54.1 L57.9 49.3" fill="none" ${strokeAttrs(tokens, 1.45)}/>`;
}

function renderGlyph(definition: StrengthAchievementDefinition, tokens: StrengthRenderTokens): string {
  if (definition.glyph === 'sessionDumbbell') return renderStrengthDumbbellGlyph(tokens);
  if (definition.glyph === 'consistentWeeks') return renderConsistencyGlyph(definition, tokens);
  if (definition.glyph === 'strengthRunWeek') return renderStrengthRunGlyph(tokens);
  if (definition.glyph === 'structuredWorkout') return renderStructuredGlyph(tokens);
  return renderPrehabGlyph(tokens);
}

function renderSessionText(definition: StrengthAchievementDefinition, tokens: StrengthRenderTokens, compact: boolean): string {
  if (compact) {
    if (!definition.badgeNumber) return '';
    return `<text x="50" y="62" text-anchor="middle" font-family="${STRENGTH_DISPLAY_FONT}" font-size="${definition.badgeNumber.length > 2 ? 9.4 : 11.4}" font-weight="800" fill="${tokens.text}" fill-opacity="${tokens.titleOpacity}">${escapeXml(definition.badgeNumber)}</text>`;
  }
  if (!definition.badgeNumber) {
    return renderTitleLines(definition.titleLines, tokens, false, 58.8);
  }
  const numberSize = definition.badgeNumber.length > 2 ? 10.2 : 11.8;
  return `${keylineText(definition.badgeNumber, 50, 56.2, numberSize, 800, 0, tokens)}
  <text x="50" y="56.2" text-anchor="middle" font-family="${STRENGTH_DISPLAY_FONT}" font-size="${numberSize}" font-weight="800" fill="${tokens.text}" fill-opacity="${tokens.titleOpacity}">${escapeXml(definition.badgeNumber)}</text>
  ${keylineText(definition.badgeUnit ?? '', 50, 65.3, 6.2, 900, 0.45, tokens)}
  <text x="50" y="65.3" text-anchor="middle" font-family="${STRENGTH_LABEL_FONT}" font-size="6.2" font-weight="900" letter-spacing="0.45" fill="${tokens.text}" fill-opacity="${tokens.titleOpacity}">${escapeXml(definition.badgeUnit ?? '')}</text>`;
}

function renderTitleLines(lines: readonly string[], tokens: StrengthRenderTokens, compact: boolean, startY = 65.2): string {
  if (compact) return '';
  const lineHeight = lines.length > 1 ? 6.8 : 0;
  return lines.map((line, index) => {
    const y = startY + index * lineHeight;
    const size = line.length > 17 ? 4.8 : 5.6;
    return `${keylineText(line, 50, y, size, 900, 0.26, tokens)}
  <text x="50" y="${y}" text-anchor="middle" font-family="${STRENGTH_LABEL_FONT}" font-size="${size}" font-weight="900" letter-spacing="0.26" fill="${tokens.text}" fill-opacity="${tokens.titleOpacity}">${escapeXml(line)}</text>`;
  }).join('\n  ');
}

function renderLowerText(definition: StrengthAchievementDefinition, tokens: StrengthRenderTokens, compact: boolean): string {
  if (definition.glyph === 'sessionDumbbell') return renderSessionText(definition, tokens, compact);
  return renderTitleLines(definition.titleLines, tokens, compact);
}

export function strengthSessionDumbbellFragment(svg: string): string | null {
  return svg.match(/<!-- strength-dumbbell-start -->([\s\S]*?)<!-- strength-dumbbell-end -->/)?.[0] ?? null;
}

export function renderStrengthAchievementBadgeSvg(
  achievement: StrengthAchievementId,
  state: StrengthAchievementBadgeState = 'unlocked',
  options: { compact?: boolean; size?: number; remaining?: number } = {},
): string {
  const definition = STRENGTH_ACHIEVEMENT_BY_ID[achievement];
  const visualState = state === 'share-opaque' ? 'unlocked' : state;
  const compact = options.compact ?? false;
  const size = options.size ?? STRENGTH_VIEWBOX;
  const tokens = strengthBadgeTokens(visualState);
  const edgeId = `strength-${definition.slug}-${visualState}-edge`;
  const glowId = `strength-${definition.slug}-${visualState}-glow`;
  const label = strengthAchievementAccessibilityLabel(definition, visualState === 'locked' ? 'locked' : 'earned', options.remaining);
  const wordmarkY = definition.titleLines.length > 1 || definition.glyph !== 'sessionDumbbell' ? 77.2 : 74.4;
  const chevOneY = definition.titleLines.length > 1 || definition.glyph !== 'sessionDumbbell' ? 82.7 : 81.7;
  const chevTwoY = definition.titleLines.length > 1 || definition.glyph !== 'sessionDumbbell' ? 87.8 : 86.8;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${STRENGTH_VIEWBOX} ${STRENGTH_VIEWBOX}" fill="none" role="img" aria-label="${escapeXml(label)}">
  <defs>
    <linearGradient id="${edgeId}" x1="14" y1="7" x2="86" y2="93" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="${tokens.highlight}"/>
      <stop offset="0.55" stop-color="${tokens.primary}"/>
      <stop offset="1" stop-color="${tokens.shadow}"/>
    </linearGradient>
    <radialGradient id="${glowId}" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(50 39) rotate(90) scale(34 33)">
      <stop offset="0" stop-color="${tokens.glow}" stop-opacity="${visualState === 'locked' ? '0.1' : '0.28'}"/>
      <stop offset="0.64" stop-color="${tokens.glow}" stop-opacity="${visualState === 'share-transparent' ? '0.03' : '0.09'}"/>
      <stop offset="1" stop-color="${tokens.glow}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <path d="${STRENGTH_HEXAGON_PATH}" fill="${tokens.fill}" fill-opacity="${tokens.fillOpacity}" stroke="url(#${edgeId})" stroke-width="2.2" stroke-linejoin="round" stroke-opacity="${tokens.borderOpacity}"/>
  <path d="${STRENGTH_HEXAGON_PATH}" fill="none" stroke="${tokens.highlight}" stroke-width="0.62" stroke-linejoin="round" stroke-opacity="${tokens.secondaryOpacity}" transform="translate(0.9 0.9) scale(0.982)"/>
  <ellipse cx="50" cy="40" rx="30" ry="29" fill="url(#${glowId})" opacity="${tokens.ambientOpacity}"/>
  <g>
    ${renderGlyph(definition, tokens)}
  </g>
  ${renderLowerText(definition, tokens, compact)}
  ${compact ? '' : `
  ${tokens.keylineOpacity > 0 ? `<text x="50" y="${wordmarkY}" text-anchor="middle" font-family="${STRENGTH_LABEL_FONT}" font-size="3.6" font-weight="900" letter-spacing="1.45" stroke="#030405" stroke-width="0.32" stroke-opacity="${tokens.keylineOpacity}" fill="none">STRIDEOS</text>` : ''}
  <text x="50" y="${wordmarkY}" text-anchor="middle" font-family="${STRENGTH_LABEL_FONT}" font-size="3.6" font-weight="900" letter-spacing="1.45" fill="${tokens.text}" fill-opacity="${tokens.wordmarkOpacity}">STRIDEOS</text>
  <path d="M43.6 ${chevOneY} L50 ${chevOneY + 3.8} L56.4 ${chevOneY}" fill="none" stroke="${tokens.primary}" stroke-width="1.05" stroke-linecap="round" stroke-linejoin="round" stroke-opacity="${tokens.chevronOpacity}"/>
  <path d="M44.3 ${chevTwoY} L50 ${chevTwoY + 3.3} L55.7 ${chevTwoY}" fill="none" stroke="${tokens.highlight}" stroke-width="1.05" stroke-linecap="round" stroke-linejoin="round" stroke-opacity="${tokens.chevronOpacity}"/>`}
</svg>
`;
}
