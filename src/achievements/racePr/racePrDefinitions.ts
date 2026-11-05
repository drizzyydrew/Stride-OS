import { STANDARD_DISTANCE_METERS, type StandardDistance } from '../../types/athlete';

export type RacePrAchievementId =
  | 'race_pr_800m' | 'race_pr_1_mile' | 'race_pr_5k' | 'race_pr_10k'
  | 'race_pr_half_marathon' | 'race_pr_marathon';
export type RacePrBadgeState = 'unlocked' | 'locked' | 'transparent';
export type RacePrBadgeInputState = RacePrBadgeState | 'share-opaque' | 'share-transparent';
export function normalizeRacePrBadgeState(state?: RacePrBadgeInputState): RacePrBadgeState {
  if (state === 'locked') return 'locked';
  if (state === 'transparent' || state === 'share-transparent') return 'transparent';
  return 'unlocked';
}
export type RacePrDefinition = {
  id: RacePrAchievementId;
  distanceKey: StandardDistance;
  distanceMeters: number;
  slug: string;
  title: string;
  compactTitle: string;
  description: string;
  criteria: string;
  distanceLabel: string;
  faceLabel: string;
  artworkPath: string;
  lockedArtworkPath: string;
  unlockedPngPath: string;
  lockedPngPath: string;
  shareTransparentSvgPath: string;
  shareTransparentPngPath: string;
};
const entries: { id: RacePrAchievementId; distanceKey: StandardDistance; slug: string; distanceLabel: string; faceLabel: string }[] = [
  { id: 'race_pr_800m', distanceKey: '800m', slug: '800m', distanceLabel: '800 Meters', faceLabel: '800M' },
  { id: 'race_pr_1_mile', distanceKey: '1_mile', slug: '1-mile', distanceLabel: '1 Mile', faceLabel: '1MI' },
  { id: 'race_pr_5k', distanceKey: '5k', slug: '5k', distanceLabel: '5K', faceLabel: '5K' },
  { id: 'race_pr_10k', distanceKey: '10k', slug: '10k', distanceLabel: '10K', faceLabel: '10K' },
  { id: 'race_pr_half_marathon', distanceKey: 'half_marathon', slug: 'half-marathon', distanceLabel: 'Half Marathon', faceLabel: 'HM' },
  { id: 'race_pr_marathon', distanceKey: 'marathon', slug: 'marathon', distanceLabel: 'Marathon', faceLabel: 'MAR' },
];
const asset = (slug: string, state: RacePrBadgeState, ext: 'svg' | 'png') => `assets/achievements/race-pr/race-pr-${slug}-${state}.${ext}`;
export const RACE_PR_DEFINITIONS: readonly RacePrDefinition[] = entries.map(entry => ({
  ...entry, distanceMeters: STANDARD_DISTANCE_METERS[entry.distanceKey]!, title: `${entry.distanceLabel} PR`,
  compactTitle: `${entry.distanceLabel} PR`,
  description: `A personal best for ${entry.distanceLabel.toLowerCase()} from a confirmed race or time trial.`,
  criteria: `Save a valid elapsed ${entry.distanceLabel.toLowerCase()} result to establish your first personal best, then beat that time to celebrate another PR.`,
  artworkPath: asset(entry.slug, 'unlocked', 'svg'), lockedArtworkPath: asset(entry.slug, 'locked', 'svg'),
  unlockedPngPath: asset(entry.slug, 'unlocked', 'png'), lockedPngPath: asset(entry.slug, 'locked', 'png'),
  shareTransparentSvgPath: asset(entry.slug, 'transparent', 'svg'), shareTransparentPngPath: asset(entry.slug, 'transparent', 'png'),
}));
export const RACE_PR_BY_ID = Object.fromEntries(RACE_PR_DEFINITIONS.map(definition => [definition.id, definition])) as Record<RacePrAchievementId, RacePrDefinition>;
export function racePrDefinitionFromAchievementId(id: string): RacePrDefinition | null {
  return Object.prototype.hasOwnProperty.call(RACE_PR_BY_ID, id) ? RACE_PR_BY_ID[id as RacePrAchievementId] : null;
}
export function racePrAchievementIdForDistance(distance: StandardDistance): RacePrAchievementId | null {
  return RACE_PR_DEFINITIONS.find(definition => definition.distanceKey === distance)?.id ?? null;
}
