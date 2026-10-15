import { APPROVED_ARTWORK } from './approvedArtwork';
import { APPROVED_STREAK_DIGITS } from './approvedDigits';
import { renderApprovedVector, escapeBadgeXml } from '../shared/approvedVector';
import { STREAK_MILESTONE_BY_ID, streakHeatTierForDays, normalizeStreakBadgeState, type StreakBadgeInputState, type StreakBadgeState } from './streakDefinitions';
import { STREAK_HEAT_COLORS } from './streakTokens';
import { streakAchievementAccessibilityLabel } from './streakUtils';

export type { StreakBadgeInputState, StreakBadgeState } from './streakDefinitions';
export const STREAK_VIEWBOX = 100;

export function safeStreakDays(days: number): number {
  return Number.isFinite(days) ? Math.max(1, Math.min(Number.MAX_SAFE_INTEGER, Math.floor(days))) : 1;
}

export function streakBadgeTokens(days: number, state: StreakBadgeState) {
  return state === 'locked'
    ? { primary: '#888888', highlight: '#AAAAAA', shadow: '#5E5E5E', center: '#999999' }
    : STREAK_HEAT_COLORS[streakHeatTierForDays(days).token];
}

export function streakNumberLayout(days: number) {
  const text = String(safeStreakDays(days));
  const digits = APPROVED_STREAK_DIGITS.digits;
  let cursor = 0, left = Infinity, right = -Infinity, bottom = Infinity, top = -Infinity;
  const positions = [...text].map(character => {
    const glyph = digits[character as keyof typeof digits];
    const x = cursor;
    left = Math.min(left, x + glyph.bounds[0]);
    right = Math.max(right, x + glyph.bounds[2]);
    bottom = Math.min(bottom, glyph.bounds[1]);
    top = Math.max(top, glyph.bounds[3]);
    cursor += glyph.advance;
    return { glyph, x };
  });
  const scale = Math.min(17.8 / APPROVED_STREAK_DIGITS.unitsPerEm, 34 / (right - left));
  const x = 50 - (left + right) / 2 * scale;
  const y = 64.7492 + bottom * scale;
  return { text, positions, scale, x, y, bounds: [left * scale + x, y - top * scale, right * scale + x, y - bottom * scale] };
}

export function streakNumberFontSize(text: string, _compact = false): number {
  return streakNumberLayout(Number(text)).scale * APPROVED_STREAK_DIGITS.unitsPerEm;
}
export function streakNumberX(_text: string): number { return 50; }

export function renderStreakBadgeSvg(
  days: number,
  state: StreakBadgeInputState = 'unlocked',
  options: { compact?: boolean; size?: number; remainingDays?: number } = {},
): string {
  const count = safeStreakDays(days), visualState = normalizeStreakBadgeState(state);
  const colors = STREAK_HEAT_COLORS[streakHeatTierForDays(count).token];
  const base = STREAK_HEAT_COLORS.streakHeatGreen;
  const paint = Object.fromEntries(Object.keys(base).map(key => [base[key as keyof typeof base], colors[key as keyof typeof colors]]));
  const definition = Object.values(STREAK_MILESTONE_BY_ID).find(item => item.thresholdDays === count);
  const layout = streakNumberLayout(count);
  const numberColor = visualState === 'locked' ? '#AAAAAA' : colors.primary;
  const numberMarkup = count === 3 ? undefined
    : `<g data-lettering="number" data-text="${layout.text}" fill="${escapeBadgeXml(numberColor)}" transform="translate(${layout.x} ${layout.y}) scale(${layout.scale} ${-layout.scale})">${layout.positions.map(({ glyph, x }) => `<path d="${glyph.path}" transform="translate(${x} 0)"/>`).join('')}</g>`;
  return renderApprovedVector(APPROVED_ARTWORK.daily, visualState, {
    ...options, paint, numberMarkup,
    label: streakAchievementAccessibilityLabel(count, visualState === 'locked' ? 'locked' : 'earned', options.remainingDays, definition?.subtitle),
    namespace: `streak-${count}-${visualState}`,
  });
}
