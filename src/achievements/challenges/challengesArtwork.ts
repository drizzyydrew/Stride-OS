import {
  CHALLENGE_ACHIEVEMENT_BY_ID,
  normalizeChallengeBadgeState,
  type ChallengeAchievementDefinition,
  type ChallengeAchievementId,
  type ChallengeBadgeInputState,
  type ChallengeBadgeState,
} from './challengesDefinitions';
import {
  CHALLENGES_COLORS,
  CHALLENGES_LOCKED_COLORS,
  CHALLENGES_NEAR_BLACK,
} from './challengesTokens';
import { challengeAchievementAccessibilityLabel } from './challengesUtils';

export type { ChallengeBadgeInputState, ChallengeBadgeState } from './challengesDefinitions';

export const CHALLENGES_VIEWBOX = 100;
export const CHALLENGES_HEXAGON_PATH =
  'M50 5.5 Q52.3 5.5 54.5 6.8 L85.7 24.8 Q88 26.1 88 28.8 L88 71.2 Q88 73.9 85.7 75.2 L54.5 93.2 Q52.3 94.5 50 94.5 Q47.7 94.5 45.5 93.2 L14.3 75.2 Q12 73.9 12 71.2 L12 28.8 Q12 26.1 14.3 24.8 L45.5 6.8 Q47.7 5.5 50 5.5 Z';
export const CHALLENGES_LABEL_FONT = "'Avenir Next', Inter, Arial, sans-serif";

export type ChallengesRenderTokens = {
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

export function challengeBadgeTokens(definition: ChallengeAchievementDefinition, state: ChallengeBadgeState): ChallengesRenderTokens {
  const locked = state === 'locked';
  const transparent = state === 'transparent';
  const colors = locked ? CHALLENGES_LOCKED_COLORS : CHALLENGES_COLORS[definition.colorToken];
  return {
    ...colors,
    fill: transparent ? 'transparent' : CHALLENGES_NEAR_BLACK,
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

function strokeAttrs(tokens: ChallengesRenderTokens, width = 1.6, opacity = tokens.glyphOpacity): string {
  return `stroke="${tokens.primary}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" stroke-opacity="${opacity}"`;
}

function keylineText(
  text: string,
  x: number,
  y: number,
  fontSize: number,
  weight: number,
  tracking: number,
  tokens: ChallengesRenderTokens,
  anchor: 'start' | 'middle' | 'end' = 'middle',
): string {
  return tokens.keylineOpacity > 0
    ? `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="${CHALLENGES_LABEL_FONT}" font-size="${fontSize}" font-weight="${weight}" letter-spacing="${tracking}" stroke="#030405" stroke-width="0.36" stroke-opacity="${tokens.keylineOpacity}" fill="none">${escapeXml(text)}</text>`
    : '';
}

function renderAugustBaseBuilder(tokens: ChallengesRenderTokens): string {
  return `<path d="M24 52 H76" fill="none" ${strokeAttrs(tokens, 1.3, tokens.glyphOpacity * 0.65)}/>
    <path d="M35 52 L46 30 L55 42 L62 32 L74 52 Z" fill="${tokens.primary}" fill-opacity="${tokens.glyphOpacity * 0.82}"/>
    <circle cx="30" cy="27" r="6.4" fill="none" ${strokeAttrs(tokens, 1.4)}/>
    <path d="M30 18.4 V21.4 M30 32.6 V35.6 M21.4 27 H24.4 M35.6 27 H38.6 M24.1 20.7 L26.2 22.8 M35.9 33.3 L33.8 31.2 M24.1 33.3 L26.2 31.2 M35.9 20.7 L33.8 22.8" fill="none" ${strokeAttrs(tokens, 0.95, tokens.glyphOpacity * 0.72)}/>
    <path d="M42.4 60 L47.4 52.4 L52.6 57.6 L58.6 48.6" fill="none" ${strokeAttrs(tokens, 1.9)}/>`;
}

function renderSeptemberConsistency(tokens: ChallengesRenderTokens): string {
  return `<rect x="30" y="26" width="40" height="36" rx="4" fill="none" ${strokeAttrs(tokens, 1.6)}/>
    <path d="M30 36 H70" fill="none" ${strokeAttrs(tokens, 1.4)}/>
    <path d="M39 21.5 V29.5 M61 21.5 V29.5" fill="none" ${strokeAttrs(tokens, 1.7)}/>
    <circle cx="39.5" cy="44" r="2.3" fill="${tokens.primary}" fill-opacity="${tokens.glyphOpacity}"/>
    <circle cx="50" cy="44" r="2.3" fill="${tokens.primary}" fill-opacity="${tokens.glyphOpacity}"/>
    <circle cx="60.5" cy="44" r="2.3" fill="${tokens.primary}" fill-opacity="${tokens.glyphOpacity}"/>
    <circle cx="39.5" cy="53.4" r="2.3" fill="${tokens.primary}" fill-opacity="${tokens.glyphOpacity * 0.65}"/>
    <circle cx="50" cy="53.4" r="2.3" fill="${tokens.primary}" fill-opacity="${tokens.glyphOpacity * 0.65}"/>
    <circle cx="60.5" cy="53.4" r="2.3" fill="${tokens.primary}" fill-opacity="${tokens.glyphOpacity * 0.65}"/>`;
}

function renderWinterStrengthBlock(tokens: ChallengesRenderTokens): string {
  return `<path d="M25 44 H75" fill="none" ${strokeAttrs(tokens, 3.3)}/>
    <path d="M33 35 V53 M40 31 V57 M60 31 V57 M67 35 V53" fill="none" ${strokeAttrs(tokens, 3.7)}/>
    <path d="M27 32 L24.5 28.6 M73 32 L75.5 28.6 M27 56 L24.5 59.4 M73 56 L75.5 59.4" fill="none" ${strokeAttrs(tokens, 1.1, tokens.glyphOpacity * 0.6)}/>`;
}

function renderSpringMileageBuild(tokens: ChallengesRenderTokens): string {
  return `<path d="M38 56 L47 36 L54 48 L61 38 L70 56 Z" fill="${tokens.primary}" fill-opacity="${tokens.glyphOpacity * 0.3}"/>
    <path d="M38 56 L47 36 L54 48 L61 38 L70 56" fill="none" ${strokeAttrs(tokens, 1.5)}/>
    <path d="M24 60.5 C32 55.5 36 62 44 58 C52 54 56 60 64 57 C70 54.6 73 57.5 76 55" fill="none" ${strokeAttrs(tokens, 1.75)}/>`;
}

function renderSummerLongRun(tokens: ChallengesRenderTokens): string {
  return `<path d="M27 46 A23 23 0 0 1 73 46" fill="none" ${strokeAttrs(tokens, 1.6)}/>
    <path d="M50 23 V29.5 M31.3 31.3 L35.6 35.6 M68.7 31.3 L64.4 35.6" fill="none" ${strokeAttrs(tokens, 1.25, tokens.glyphOpacity * 0.75)}/>
    <path d="M24 46 H76" fill="none" ${strokeAttrs(tokens, 1.4, tokens.glyphOpacity * 0.65)}/>
    <path d="M24 58 C33 52 38 60 47 55 C56 50 61 57 70 53 C73.4 51.4 74.8 52 76 53.6" fill="none" ${strokeAttrs(tokens, 1.75)}/>`;
}

function renderElevationMonth(tokens: ChallengesRenderTokens): string {
  return `<path d="M22 58 L35 36 L43 48 L52 32 L61 46 L68 38 L78 58 Z" fill="${tokens.primary}" fill-opacity="${tokens.glyphOpacity * 0.26}"/>
    <path d="M52 32 L61 46 L68 38 L78 58" fill="none" ${strokeAttrs(tokens, 1.3, tokens.glyphOpacity * 0.6)}/>
    <path d="M22 58 L35 36 L43 48 L52 32" fill="none" ${strokeAttrs(tokens, 1.7)}/>
    <path d="M30.5 41.2 H39.5" fill="none" ${strokeAttrs(tokens, 1.1, tokens.glyphOpacity * 0.55)}/>`;
}

function renderNumericBadge(definition: ChallengeAchievementDefinition, tokens: ChallengesRenderTokens): string {
  const number = definition.badgeNumber ?? '';
  const unit = definition.badgeUnit ?? '';
  const numberSize = number.length > 2 ? 17 : 20;
  return `${keylineText(number, 50, 46, numberSize, 800, 0, tokens)}
  <text x="50" y="46" text-anchor="middle" font-family="${CHALLENGES_LABEL_FONT}" font-size="${numberSize}" font-weight="800" fill="${tokens.text}" fill-opacity="${tokens.titleOpacity}">${escapeXml(number)}</text>
  ${keylineText(unit, 50, 55.5, 6.4, 900, 0.9, tokens)}
  <text x="50" y="55.5" text-anchor="middle" font-family="${CHALLENGES_LABEL_FONT}" font-size="6.4" font-weight="900" letter-spacing="0.9" fill="${tokens.text}" fill-opacity="${tokens.titleOpacity}">${escapeXml(unit)}</text>`;
}

function renderStrengthRun(tokens: ChallengesRenderTokens): string {
  return `<path d="M24 54 C24 50.5 27 48.5 31 49.5 L45 53.5 C47.5 54.2 48.5 56.5 46.5 58.5 L44 61 C42 63 38.5 63 36 61.5 L26 55.5 C24.8 54.8 24 54 24 54 Z" fill="none" ${strokeAttrs(tokens, 1.5)}/>
    <path d="M24 54 H20.5 M45.5 51.5 L49 47.5" fill="none" ${strokeAttrs(tokens, 1.3, tokens.glyphOpacity * 0.65)}/>
    <path d="M56 38 H80" fill="none" ${strokeAttrs(tokens, 2.9)}/>
    <path d="M60 32 V44 M65 30 V46 M71 30 V46 M76 32 V44" fill="none" ${strokeAttrs(tokens, 2.6)}/>`;
}

function renderRecoveryConsistency(tokens: ChallengesRenderTokens): string {
  return `<path d="M50 54 C38 45 32 38 32 30.5 C32 25.5 36 22 40.5 22 C44.5 22 48 24.5 50 28 C52 24.5 55.5 22 59.5 22 C64 22 68 25.5 68 30.5 C68 38 62 45 50 54 Z" fill="${tokens.primary}" fill-opacity="${tokens.glyphOpacity * 0.3}"/>
    <path d="M50 54 C38 45 32 38 32 30.5 C32 25.5 36 22 40.5 22 C44.5 22 48 24.5 50 28 C52 24.5 55.5 22 59.5 22 C64 22 68 25.5 68 30.5 C68 38 62 45 50 54 Z" fill="none" ${strokeAttrs(tokens, 1.5)}/>
    <path d="M38 63 A13 13 0 1 1 62 63" fill="none" ${strokeAttrs(tokens, 1.5)}/>
    <path d="M62 63 L66.5 60.5 L64.8 65.6" fill="none" ${strokeAttrs(tokens, 1.3)}/>`;
}

function renderGlyph(definition: ChallengeAchievementDefinition, tokens: ChallengesRenderTokens): string {
  if (definition.glyph === 'augustBaseBuilder') return renderAugustBaseBuilder(tokens);
  if (definition.glyph === 'septemberConsistency') return renderSeptemberConsistency(tokens);
  if (definition.glyph === 'winterStrengthBlock') return renderWinterStrengthBlock(tokens);
  if (definition.glyph === 'springMileageBuild') return renderSpringMileageBuild(tokens);
  if (definition.glyph === 'summerLongRun') return renderSummerLongRun(tokens);
  if (definition.glyph === 'elevationMonth') return renderElevationMonth(tokens);
  if (definition.glyph === 'numericBadge') return renderNumericBadge(definition, tokens);
  if (definition.glyph === 'strengthRun') return renderStrengthRun(tokens);
  return renderRecoveryConsistency(tokens);
}

function renderTitleLines(lines: readonly string[], tokens: ChallengesRenderTokens, compact: boolean, hasNumericGlyph: boolean): string {
  if (compact) return '';
  const startY = hasNumericGlyph ? (lines.length > 1 ? 68.5 : 71) : (lines.length > 1 ? 64 : 67);
  const lineHeight = lines.length > 1 ? 6.6 : 0;
  return lines.map((line, index) => {
    const y = startY + index * lineHeight;
    const size = line.length > 17 ? 4.4 : line.length > 13 ? 4.9 : 5.5;
    const tracking = line.length > 13 ? 0.12 : 0.28;
    return `${keylineText(line, 50, y, size, 900, tracking, tokens)}
  <text x="50" y="${y}" text-anchor="middle" font-family="${CHALLENGES_LABEL_FONT}" font-size="${size}" font-weight="900" letter-spacing="${tracking}" fill="${tokens.text}" fill-opacity="${tokens.titleOpacity}">${escapeXml(line)}</text>`;
  }).join('\n  ');
}

export function renderChallengeBadgeSvg(
  achievement: ChallengeAchievementId,
  state: ChallengeBadgeInputState = 'unlocked',
  options: { compact?: boolean; size?: number } = {},
): string {
  const definition = CHALLENGE_ACHIEVEMENT_BY_ID[achievement];
  const visualState = normalizeChallengeBadgeState(state);
  const compact = options.compact ?? false;
  const size = options.size ?? CHALLENGES_VIEWBOX;
  const tokens = challengeBadgeTokens(definition, visualState);
  const edgeId = `challenges-${definition.slug}-${visualState}-edge`;
  const glowId = `challenges-${definition.slug}-${visualState}-glow`;
  const label = challengeAchievementAccessibilityLabel(definition, visualState === 'locked' ? 'locked' : 'earned');
  const hasNumericGlyph = definition.glyph === 'numericBadge';
  const wordmarkY = definition.titleLines.length > 1 ? 77.2 : 74.5;
  const chevOneY = definition.titleLines.length > 1 ? 82.8 : 81.8;
  const chevTwoY = definition.titleLines.length > 1 ? 87.9 : 86.9;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${CHALLENGES_VIEWBOX} ${CHALLENGES_VIEWBOX}" fill="none" role="img" aria-label="${escapeXml(label)}">
  <defs>
    <linearGradient id="${edgeId}" x1="14" y1="7" x2="86" y2="93" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="${tokens.highlight}"/>
      <stop offset="0.54" stop-color="${tokens.primary}"/>
      <stop offset="1" stop-color="${tokens.shadow}"/>
    </linearGradient>
    <radialGradient id="${glowId}" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(50 41) rotate(90) scale(35 34)">
      <stop offset="0" stop-color="${tokens.glow}" stop-opacity="${visualState === 'locked' ? '0.1' : '0.3'}"/>
      <stop offset="0.64" stop-color="${tokens.glow}" stop-opacity="${visualState === 'transparent' ? '0.03' : '0.1'}"/>
      <stop offset="1" stop-color="${tokens.glow}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <path d="${CHALLENGES_HEXAGON_PATH}" fill="${tokens.fill}" fill-opacity="${tokens.fillOpacity}" stroke="url(#${edgeId})" stroke-width="2.2" stroke-linejoin="round" stroke-opacity="${tokens.borderOpacity}"/>
  <path d="${CHALLENGES_HEXAGON_PATH}" fill="none" stroke="${tokens.highlight}" stroke-width="0.62" stroke-linejoin="round" stroke-opacity="${tokens.secondaryOpacity}" transform="translate(0.9 0.9) scale(0.982)"/>
  <ellipse cx="50" cy="42" rx="31" ry="30" fill="url(#${glowId})" opacity="${tokens.ambientOpacity}"/>
  <g>
    ${renderGlyph(definition, tokens)}
  </g>
  ${renderTitleLines(definition.titleLines, tokens, compact, hasNumericGlyph)}
  ${compact ? '' : `
  ${tokens.keylineOpacity > 0 ? `<text x="50" y="${wordmarkY}" text-anchor="middle" font-family="${CHALLENGES_LABEL_FONT}" font-size="3.6" font-weight="900" letter-spacing="1.45" stroke="#030405" stroke-width="0.32" stroke-opacity="${tokens.keylineOpacity}" fill="none">STRIDEOS</text>` : ''}
  <text x="50" y="${wordmarkY}" text-anchor="middle" font-family="${CHALLENGES_LABEL_FONT}" font-size="3.6" font-weight="900" letter-spacing="1.45" fill="${tokens.text}" fill-opacity="${tokens.wordmarkOpacity}">STRIDEOS</text>
  <path d="M43.6 ${chevOneY} L50 ${chevOneY + 3.8} L56.4 ${chevOneY}" fill="none" stroke="${tokens.primary}" stroke-width="1.05" stroke-linecap="round" stroke-linejoin="round" stroke-opacity="${tokens.chevronOpacity}"/>
  <path d="M44.3 ${chevTwoY} L50 ${chevTwoY + 3.3} L55.7 ${chevTwoY}" fill="none" stroke="${tokens.highlight}" stroke-width="1.05" stroke-linecap="round" stroke-linejoin="round" stroke-opacity="${tokens.chevronOpacity}"/>`}
</svg>
`;
}
