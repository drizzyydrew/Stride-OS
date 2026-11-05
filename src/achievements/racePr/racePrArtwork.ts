import { FIRSTS_HEXAGON_PATH } from '../firsts/firstsArtwork';
import { FIRSTS_WORDMARK_PATH } from '../firsts/firstsTypography';
import { FIRSTS_COLORS, FIRSTS_LOCKED_COLORS, FIRSTS_NEAR_BLACK } from '../firsts/firstsTokens';
import { escapeBadgeXml } from '../shared/approvedVector';
import { RACE_PR_BY_ID, normalizeRacePrBadgeState, type RacePrAchievementId, type RacePrBadgeInputState } from './racePrDefinitions';
import { RACE_PR_TYPOGRAPHY } from './racePrTypography';

export const RACE_PR_VIEWBOX = 100;
/** New timing glyph; existing approved frame/wordmark/footer geometry is reused. */
export const RACE_PR_STOPWATCH = '<g data-glyph="stopwatch" fill="none" stroke="currentColor" stroke-width="1.05" stroke-linecap="round" stroke-linejoin="round"><circle cx="50" cy="34" r="16.5"/><path d="M46.6 12.7 H53.4 V15.1 H46.6 Z M50 15.1 V17.5 M62.6 20.3 L65.1 17.8 M64.1 16.8 L66.1 18.8 M50 22 V24.5 M50 44 V46.5"/></g>';
export const RACE_PR_CHEVRONS = 'M45.1 81.6 L50 84.5 L54.9 81.6 M45.4 85.2 L50 88 L54.6 85.2';
function lettering(item: { text: string; path: string }, key: string, fill: string): string {
  return `<path data-lettering="${key}" data-text="${escapeBadgeXml(item.text)}" fill="${fill}" stroke="none" d="${item.path}"/>`;
}
export function renderRacePrBadgeSvg(
  achievement: RacePrAchievementId, state: RacePrBadgeInputState = 'unlocked',
  options: { compact?: boolean; size?: number } = {},
): string {
  const definition = RACE_PR_BY_ID[achievement];
  const resolved = normalizeRacePrBadgeState(state);
  const palette = resolved === 'locked' ? FIRSTS_LOCKED_COLORS : FIRSTS_COLORS;
  const fill = resolved === 'transparent' ? 'none' : resolved === 'locked' ? '#090909' : FIRSTS_NEAR_BLACK;
  const type = RACE_PR_TYPOGRAPHY.badges[definition.slug as keyof typeof RACE_PR_TYPOGRAPHY.badges];
  const ns = `race-pr-${definition.slug}-${resolved}`;
  const label = `${definition.distanceLabel} personal record badge, ${resolved === 'locked' ? 'not yet earned' : 'earned'}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${options.size ?? 100}" height="${options.size ?? 100}" viewBox="0 0 100 100" fill="none" role="img" aria-label="${escapeBadgeXml(label)}">
  <defs><linearGradient id="${ns}-edge" x1="20" y1="4" x2="80" y2="95" gradientUnits="userSpaceOnUse"><stop stop-color="${palette.highlight}"/><stop offset=".5" stop-color="${palette.primary}"/><stop offset="1" stop-color="${palette.shadow}"/></linearGradient><radialGradient id="${ns}-ambient"><stop stop-color="${palette.primary}" stop-opacity=".025"/><stop offset="1" stop-color="${palette.primary}" stop-opacity="0"/></radialGradient></defs>
  <path data-frame="firsts-derived" d="${FIRSTS_HEXAGON_PATH}" fill="${fill}" stroke="url(#${ns}-edge)" stroke-width="1.02" stroke-linejoin="round"/>
  ${resolved === 'transparent' ? '' : `<ellipse cx="50" cy="35" rx="30" ry="27" fill="url(#${ns}-ambient)"/>`}
  ${options.compact ? '<g data-compact-layout="centered-timing" transform="translate(50 52.5) scale(1.3) translate(-50 -34)">' : '<g data-layout="full-timing">'}
  ${RACE_PR_STOPWATCH.replace(/currentColor/g, palette.primary)}
  ${lettering(type.face, 'distance-face', palette.primary)}
  </g>
  ${options.compact ? '' : `${lettering(type.title, 'distance-title', palette.text)}
  ${lettering(RACE_PR_TYPOGRAPHY.newPr, 'new-pr', palette.text)}
  <g data-wordmark="STRIDEOS">${FIRSTS_WORDMARK_PATH.replace(/currentColor/g, palette.text)}</g>
  <path data-chevrons="2" d="${RACE_PR_CHEVRONS}" stroke="${palette.primary}" stroke-width=".73" stroke-linecap="round" stroke-linejoin="round"/>`}
</svg>\n`.replace(/[ \t]+(?=\r?\n)/g, '');
}
