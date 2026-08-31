import {
  RECOVERY_ACHIEVEMENT_BY_ID,
  type RecoveryAchievementBadgeState,
  type RecoveryAchievementDefinition,
  type RecoveryAchievementId,
} from './recoveryDefinitions';
import {
  RECOVERY_COLORS,
  RECOVERY_LOCKED_COLORS,
  RECOVERY_NEAR_BLACK,
} from './recoveryTokens';
import { recoveryAchievementAccessibilityLabel } from './recoveryUtils';

export type { RecoveryAchievementBadgeState } from './recoveryDefinitions';

export const RECOVERY_VIEWBOX = 100;
export const RECOVERY_HEXAGON_PATH =
  'M50 5.5 Q52.3 5.5 54.5 6.8 L85.7 24.8 Q88 26.1 88 28.8 L88 71.2 Q88 73.9 85.7 75.2 L54.5 93.2 Q52.3 94.5 50 94.5 Q47.7 94.5 45.5 93.2 L14.3 75.2 Q12 73.9 12 71.2 L12 28.8 Q12 26.1 14.3 24.8 L45.5 6.8 Q47.7 5.5 50 5.5 Z';
export const RECOVERY_LABEL_FONT = "'Avenir Next', Inter, Arial, sans-serif";

export type RecoveryRenderTokens = {
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

export function recoveryBadgeTokens(state: RecoveryAchievementBadgeState): RecoveryRenderTokens {
  const visualState = state === 'share-opaque' ? 'unlocked' : state;
  const locked = visualState === 'locked';
  const transparent = visualState === 'share-transparent';
  const colors = locked ? RECOVERY_LOCKED_COLORS : RECOVERY_COLORS;
  return {
    ...colors,
    fill: transparent ? 'transparent' : RECOVERY_NEAR_BLACK,
    fillOpacity: transparent ? 0 : 1,
    borderOpacity: locked ? 0.48 : 1,
    secondaryOpacity: locked ? 0.24 : 0.34,
    ambientOpacity: locked ? 0.06 : transparent ? 0 : 0.18,
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

function svgTextContent(text: string): string {
  return escapeXml(text);
}

function strokeAttrs(tokens: RecoveryRenderTokens, width = 1.6, opacity = tokens.glyphOpacity): string {
  return `stroke="${tokens.primary}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" stroke-opacity="${opacity}"`;
}

function keylineText(
  text: string,
  x: number,
  y: number,
  fontSize: number,
  weight: number,
  tracking: number,
  tokens: RecoveryRenderTokens,
  wordSpacing = 0,
  anchor: 'start' | 'middle' | 'end' = 'middle',
): string {
  return tokens.keylineOpacity > 0
    ? `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="${RECOVERY_LABEL_FONT}" font-size="${fontSize}" font-weight="${weight}" letter-spacing="${tracking}" word-spacing="${wordSpacing}" stroke="#030405" stroke-width="0.36" stroke-opacity="${tokens.keylineOpacity}" fill="none">${svgTextContent(text)}</text>`
    : '';
}

function leaf(cx: number, cy: number, angle: number, tokens: RecoveryRenderTokens): string {
  return `<path d="M${cx} ${cy} C${cx - 3.5} ${cy - 4.5} ${cx - 7.5} ${cy - 1.5} ${cx - 5.1} ${cy + 3.2} C${cx - 1.7} ${cy + 2.4} ${cx + 1.1} ${cy - 0.4} ${cx} ${cy} Z" fill="${tokens.primary}" fill-opacity="${tokens.glyphOpacity}" transform="rotate(${angle} ${cx} ${cy})"/>`;
}

function star(cx: number, cy: number, size: number, tokens: RecoveryRenderTokens): string {
  return `<path d="M${cx} ${cy - size} L${cx + size * 0.32} ${cy - size * 0.24} L${cx + size} ${cy} L${cx + size * 0.32} ${cy + size * 0.24} L${cx} ${cy + size} L${cx - size * 0.32} ${cy + size * 0.24} L${cx - size} ${cy} L${cx - size * 0.32} ${cy - size * 0.24} Z" fill="${tokens.primary}" fill-opacity="${tokens.glyphOpacity}"/>`;
}

function renderRecoveryWeek(tokens: RecoveryRenderTokens): string {
  return `<path d="M24.1 40 H43.7 M56.3 40 H75.9" fill="none" ${strokeAttrs(tokens, 1.05, tokens.glyphOpacity * 0.75)}/>
    <path d="M36.7 40 Q50 17.8 63.3 40 Z" fill="${tokens.primary}" fill-opacity="${tokens.glyphOpacity * 0.85}"/>
    <path d="M50 18.4 V24.2 M33.8 23.7 L38.1 29 M66.2 23.7 L61.9 29 M26.9 33.1 L34.6 34.7 M73.1 33.1 L65.4 34.7" fill="none" ${strokeAttrs(tokens, 1.1, tokens.glyphOpacity * 0.75)}/>
    <path d="M41.4 45.6 C49.1 42.2 57.8 44.5 58.4 48.7 C59 53 47.1 50.3 43.1 55.3 C38.9 60.4 55.2 59.2 64.8 63.2" fill="none" ${strokeAttrs(tokens, 2.1)}/>`;
}

function renderSleepCycle(tokens: RecoveryRenderTokens): string {
  return `<path d="M32.2 43.7 C31 31.8 39.2 22.6 50.6 22.6 C58.1 22.6 64.1 26.5 67.6 32.2" fill="none" ${strokeAttrs(tokens, 1.75)}/>
    <path d="M67.6 32.2 L68.7 25.8 L73.7 30.4" fill="none" ${strokeAttrs(tokens, 1.55)}/>
    <path d="M67.8 38.2 C67.6 50.4 58.9 58.6 48 58.6 C40.2 58.6 34.1 54.8 30.6 48.6" fill="none" ${strokeAttrs(tokens, 1.75)}/>
    <path d="M30.6 48.6 L29.8 55.2 L24.5 50.8" fill="none" ${strokeAttrs(tokens, 1.55)}/>
    ${leaf(35.8, 51.7, -20, tokens)}
    ${leaf(29.6, 40.6, 30, tokens)}
    ${leaf(63.8, 43.8, 155, tokens)}
    ${leaf(68.8, 52.1, 205, tokens)}
    <path d="M50 52.5 V41.6 M50 41.6 C47.8 36.5 43.4 36.8 41.8 40.4 C45.6 40.5 48.4 42 50 45.2 M50 41.6 C52.2 36.5 56.6 36.8 58.2 40.4 C54.4 40.5 51.6 42 50 45.2" fill="none" ${strokeAttrs(tokens, 1.25)}/>`;
}

function renderSmartRest(tokens: RecoveryRenderTokens): string {
  return `${star(34.5, 31.8, 4.1, tokens)}
    ${star(50, 24.9, 5, tokens)}
    ${star(65.5, 31.8, 4.1, tokens)}
    <path d="M47 39.5 L50 43 L55.8 34.8" fill="none" ${strokeAttrs(tokens, 1.8)}/>
    <path d="M26.7 54.2 C34.8 45.8 43 47.2 50.7 53.9 C58.4 60.6 67.5 60.2 75.1 52.5" fill="none" ${strokeAttrs(tokens, 2.35)}/>
    <path d="M26.8 60.3 C35.1 52 43.1 53.4 50.7 59.8 C58.1 66.1 67.1 65.8 75.1 58.1" fill="none" ${strokeAttrs(tokens, 1.05, tokens.glyphOpacity * 0.55)}/>`;
}

function renderReadinessHammock(tokens: RecoveryRenderTokens): string {
  return `<path d="M28.2 22.8 V59.4 M71.8 22.8 V59.4" fill="none" ${strokeAttrs(tokens, 1.45)}/>
    <circle cx="28.2" cy="22.8" r="2.1" fill="${tokens.primary}" fill-opacity="${tokens.glyphOpacity}"/>
    <circle cx="71.8" cy="22.8" r="2.1" fill="${tokens.primary}" fill-opacity="${tokens.glyphOpacity}"/>
    <path d="M31.2 31.1 C41.7 43.6 58.3 43.6 68.8 31.1 C66.7 49.6 35.1 51.5 31.2 31.1 Z" fill="${tokens.primary}" fill-opacity="${tokens.glyphOpacity * 0.72}"/>
    <path d="M31.2 31.1 C41.7 43.6 58.3 43.6 68.8 31.1 M36.3 35.4 L45.1 45.7 M45.7 38.6 L52.2 46.8 M55 38.5 L60.7 44.8" fill="none" ${strokeAttrs(tokens, 1.05, tokens.glyphOpacity * 0.75)}/>`;
}

function renderSymptomsSignal(tokens: RecoveryRenderTokens): string {
  return `<path d="M25.2 59.7 L38.8 39.4 L46.7 51.2 L55.3 30.4 L76.1 59.7 Z" fill="${tokens.primary}" fill-opacity="${tokens.glyphOpacity * 0.28}"/>
    <path d="M25.2 59.7 L38.8 39.4 L46.7 51.2 L55.3 30.4 L76.1 59.7" fill="none" ${strokeAttrs(tokens, 1.35)}/>
    <path d="M55.3 30.4 V20.6 M55.3 20.6 H66.1 L62.4 24.1 L66.1 27.6 H55.3" fill="none" ${strokeAttrs(tokens, 1.45)}/>
    <path d="M33.6 59.7 L43.3 48.7 M48.2 59.7 L57.4 40.9 M64.8 59.7 L58.2 49" fill="none" ${strokeAttrs(tokens, 0.9, tokens.glyphOpacity * 0.55)}/>`;
}

function renderCheckInRipples(tokens: RecoveryRenderTokens): string {
  return `${star(50, 21.8, 4.1, tokens)}
    <path d="M45.6 42.9 C45.6 36.9 50 32.3 50 32.3 C50 32.3 54.4 36.9 54.4 42.9 C54.4 47.1 51.8 50.5 50 52 C48.2 50.5 45.6 47.1 45.6 42.9 Z" fill="${tokens.primary}" fill-opacity="${tokens.glyphOpacity * 0.82}"/>
    <ellipse cx="50" cy="53.1" rx="12.6" ry="4.9" fill="none" ${strokeAttrs(tokens, 1.35)}/>
    <ellipse cx="50" cy="53.2" rx="21.5" ry="8.4" fill="none" ${strokeAttrs(tokens, 1.05, tokens.glyphOpacity * 0.72)}/>
    <ellipse cx="50" cy="53.4" rx="29.4" ry="11.7" fill="none" ${strokeAttrs(tokens, 0.9, tokens.glyphOpacity * 0.42)}/>`;
}

function renderReturnedGradually(tokens: RecoveryRenderTokens): string {
  return `<ellipse cx="35.1" cy="60.5" rx="10.3" ry="3.5" fill="${tokens.primary}" fill-opacity="${tokens.glyphOpacity * 0.8}" transform="rotate(-5 35.1 60.5)"/>
    <ellipse cx="47.8" cy="51.9" rx="8.4" ry="3.1" fill="${tokens.primary}" fill-opacity="${tokens.glyphOpacity * 0.72}" transform="rotate(-4 47.8 51.9)"/>
    <ellipse cx="59.1" cy="43.9" rx="6.7" ry="2.6" fill="${tokens.primary}" fill-opacity="${tokens.glyphOpacity * 0.64}" transform="rotate(-3 59.1 43.9)"/>
    <ellipse cx="67.5" cy="36" rx="4.9" ry="2" fill="${tokens.primary}" fill-opacity="${tokens.glyphOpacity * 0.56}" transform="rotate(-2 67.5 36)"/>
    <path d="M63.6 27.1 C68.9 26.5 71.8 24.2 73.5 20.2 M63.6 31 C68.5 31.5 71.8 33.8 73.8 37.3 M60.4 29.2 C64.2 29.3 68.4 29.1 72.9 28.6" fill="none" ${strokeAttrs(tokens, 1.15, tokens.glyphOpacity * 0.72)}/>`;
}

function renderGlyph(definition: RecoveryAchievementDefinition, tokens: RecoveryRenderTokens): string {
  if (definition.glyph === 'recoveryWeek') return renderRecoveryWeek(tokens);
  if (definition.glyph === 'sleepCycle') return renderSleepCycle(tokens);
  if (definition.glyph === 'smartRest') return renderSmartRest(tokens);
  if (definition.glyph === 'readinessHammock') return renderReadinessHammock(tokens);
  if (definition.glyph === 'symptomsSignal') return renderSymptomsSignal(tokens);
  if (definition.glyph === 'checkInRipples') return renderCheckInRipples(tokens);
  return renderReturnedGradually(tokens);
}

function renderTitleLines(lines: readonly string[], tokens: RecoveryRenderTokens, compact: boolean): string {
  if (compact) return '';
  const startY = lines.length > 1 ? 64 : 67;
  const lineHeight = lines.length > 1 ? 6.7 : 0;
  return lines.map((line, index) => {
    const y = startY + index * lineHeight;
    const size = line.length > 17 ? 4.5 : line.length > 13 ? 5.0 : 5.6;
    const tracking = line.length > 13 ? 0.12 : 0.28;
    const words = line.split(' ');
    if (words.length === 2) {
      return `${keylineText(words[0], 48.7, y, size, 900, tracking, tokens, 0, 'end')}
  ${keylineText(words[1], 51.3, y, size, 900, tracking, tokens, 0, 'start')}
  <text x="48.7" y="${y}" text-anchor="end" font-family="${RECOVERY_LABEL_FONT}" font-size="${size}" font-weight="900" letter-spacing="${tracking}" fill="${tokens.text}" fill-opacity="${tokens.titleOpacity}">${svgTextContent(words[0])}</text>
  <text x="51.3" y="${y}" text-anchor="start" font-family="${RECOVERY_LABEL_FONT}" font-size="${size}" font-weight="900" letter-spacing="${tracking}" fill="${tokens.text}" fill-opacity="${tokens.titleOpacity}">${svgTextContent(words[1])}</text>`;
    }
    return `${keylineText(line, 50, y, size, 900, tracking, tokens)}
  <text x="50" y="${y}" text-anchor="middle" font-family="${RECOVERY_LABEL_FONT}" font-size="${size}" font-weight="900" letter-spacing="${tracking}" fill="${tokens.text}" fill-opacity="${tokens.titleOpacity}">${svgTextContent(line)}</text>`;
  }).join('\n  ');
}

export function renderRecoveryAchievementBadgeSvg(
  achievement: RecoveryAchievementId,
  state: RecoveryAchievementBadgeState = 'unlocked',
  options: { compact?: boolean; size?: number; remaining?: number } = {},
): string {
  const definition = RECOVERY_ACHIEVEMENT_BY_ID[achievement];
  const visualState = state === 'share-opaque' ? 'unlocked' : state;
  const compact = options.compact ?? false;
  const size = options.size ?? RECOVERY_VIEWBOX;
  const tokens = recoveryBadgeTokens(visualState);
  const edgeId = `recovery-${definition.slug}-${visualState}-edge`;
  const glowId = `recovery-${definition.slug}-${visualState}-glow`;
  const label = recoveryAchievementAccessibilityLabel(definition, visualState === 'locked' ? 'locked' : 'earned', options.remaining);
  const wordmarkY = definition.titleLines.length > 1 ? 77.2 : 74.5;
  const chevOneY = definition.titleLines.length > 1 ? 82.8 : 81.8;
  const chevTwoY = definition.titleLines.length > 1 ? 87.9 : 86.9;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${RECOVERY_VIEWBOX} ${RECOVERY_VIEWBOX}" fill="none" role="img" aria-label="${escapeXml(label)}">
  <defs>
    <linearGradient id="${edgeId}" x1="14" y1="7" x2="86" y2="93" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="${tokens.highlight}"/>
      <stop offset="0.54" stop-color="${tokens.primary}"/>
      <stop offset="1" stop-color="${tokens.shadow}"/>
    </linearGradient>
    <radialGradient id="${glowId}" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(50 41) rotate(90) scale(35 34)">
      <stop offset="0" stop-color="${tokens.glow}" stop-opacity="${visualState === 'locked' ? '0.1' : '0.3'}"/>
      <stop offset="0.64" stop-color="${tokens.glow}" stop-opacity="${visualState === 'share-transparent' ? '0.03' : '0.1'}"/>
      <stop offset="1" stop-color="${tokens.glow}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <path d="${RECOVERY_HEXAGON_PATH}" fill="${tokens.fill}" fill-opacity="${tokens.fillOpacity}" stroke="url(#${edgeId})" stroke-width="2.2" stroke-linejoin="round" stroke-opacity="${tokens.borderOpacity}"/>
  <path d="${RECOVERY_HEXAGON_PATH}" fill="none" stroke="${tokens.highlight}" stroke-width="0.62" stroke-linejoin="round" stroke-opacity="${tokens.secondaryOpacity}" transform="translate(0.9 0.9) scale(0.982)"/>
  <ellipse cx="50" cy="42" rx="31" ry="30" fill="url(#${glowId})" opacity="${tokens.ambientOpacity}"/>
  <g>
    ${renderGlyph(definition, tokens)}
  </g>
  ${renderTitleLines(definition.titleLines, tokens, compact)}
  ${compact ? '' : `
  ${tokens.keylineOpacity > 0 ? `<text x="50" y="${wordmarkY}" text-anchor="middle" font-family="${RECOVERY_LABEL_FONT}" font-size="3.6" font-weight="900" letter-spacing="1.45" stroke="#030405" stroke-width="0.32" stroke-opacity="${tokens.keylineOpacity}" fill="none">STRIDEOS</text>` : ''}
  <text x="50" y="${wordmarkY}" text-anchor="middle" font-family="${RECOVERY_LABEL_FONT}" font-size="3.6" font-weight="900" letter-spacing="1.45" fill="${tokens.text}" fill-opacity="${tokens.wordmarkOpacity}">STRIDEOS</text>
  <path d="M43.6 ${chevOneY} L50 ${chevOneY + 3.8} L56.4 ${chevOneY}" fill="none" stroke="${tokens.primary}" stroke-width="1.05" stroke-linecap="round" stroke-linejoin="round" stroke-opacity="${tokens.chevronOpacity}"/>
  <path d="M44.3 ${chevTwoY} L50 ${chevTwoY + 3.3} L55.7 ${chevTwoY}" fill="none" stroke="${tokens.highlight}" stroke-width="1.05" stroke-linecap="round" stroke-linejoin="round" stroke-opacity="${tokens.chevronOpacity}"/>`}
</svg>
`;
}
