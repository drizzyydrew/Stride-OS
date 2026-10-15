import type { ApprovedBadgeState, ApprovedVector } from '../../src/achievements/shared/approvedVector';
import { LIFETIME_DISTANCE_RUNNING_DEFINITIONS } from '../../src/achievements/lifetimeDistanceRunning/lifetimeDistanceRunningDefinitions';
import { renderLifetimeDistanceRunningBadgeSvg } from '../../src/achievements/lifetimeDistanceRunning/lifetimeDistanceRunningArtwork';
import { APPROVED_ARTWORK as running } from '../../src/achievements/lifetimeDistanceRunning/approvedArtwork';
import { LIFETIME_DISTANCE_CYCLING_DEFINITIONS } from '../../src/achievements/lifetimeDistanceCycling/lifetimeDistanceCyclingDefinitions';
import { renderLifetimeDistanceCyclingBadgeSvg } from '../../src/achievements/lifetimeDistanceCycling/lifetimeDistanceCyclingArtwork';
import { APPROVED_ARTWORK as cycling } from '../../src/achievements/lifetimeDistanceCycling/approvedArtwork';
import { WEEKLY_DISTANCE_DEFINITIONS } from '../../src/achievements/weeklyDistance/weeklyDistanceDefinitions';
import { renderWeeklyDistanceBadgeSvg } from '../../src/achievements/weeklyDistance/weeklyDistanceArtwork';
import { APPROVED_ARTWORK as weekly } from '../../src/achievements/weeklyDistance/approvedArtwork';
import { MONTHLY_DISTANCE_DEFINITIONS } from '../../src/achievements/monthlyDistance/monthlyDistanceDefinitions';
import { renderMonthlyDistanceBadgeSvg } from '../../src/achievements/monthlyDistance/monthlyDistanceArtwork';
import { APPROVED_ARTWORK as monthly } from '../../src/achievements/monthlyDistance/approvedArtwork';
import { RUN_LEVEL_DEFINITIONS } from '../../src/achievements/runLevels/runLevelDefinitions';
import { renderRunLevelBadgeSvg } from '../../src/achievements/runLevels/runLevelArtwork';
import { APPROVED_ARTWORK as levels } from '../../src/achievements/runLevels/approvedArtwork';
import { STREAK_MILESTONE_DEFINITIONS } from '../../src/achievements/streaks/streakDefinitions';
import { renderStreakBadgeSvg } from '../../src/achievements/streaks/streakArtwork';
import { APPROVED_ARTWORK as streaks } from '../../src/achievements/streaks/approvedArtwork';
import { STRENGTH_ACHIEVEMENT_DEFINITIONS } from '../../src/achievements/strength/strengthDefinitions';
import { renderStrengthAchievementBadgeSvg } from '../../src/achievements/strength/strengthArtwork';
import { APPROVED_ARTWORK as strength } from '../../src/achievements/strength/approvedArtwork';
import { RECOVERY_ACHIEVEMENT_DEFINITIONS } from '../../src/achievements/recovery/recoveryDefinitions';
import { renderRecoveryAchievementBadgeSvg } from '../../src/achievements/recovery/recoveryArtwork';
import { APPROVED_ARTWORK as recovery } from '../../src/achievements/recovery/approvedArtwork';
import { CHALLENGE_PRESENTATION_DEFINITIONS } from '../../src/achievements/challenges/challengesDefinitions';
import { renderChallengeBadgeSvg } from '../../src/achievements/challenges/challengesArtwork';
import { APPROVED_ARTWORK as challenges } from '../../src/achievements/challenges/approvedArtwork';

type AssetDefinition = { id: string; artworkPath: string; lockedArtworkPath: string; shareTransparentSvgPath: string; unlockedPngPath: string; lockedPngPath: string; shareTransparentPngPath: string };
export type ApprovedAssetEntry = {
  family: string;
  id: string;
  units?: 'imperial' | 'metric';
  definition: AssetDefinition;
  artwork: ApprovedVector;
  render: (state: ApprovedBadgeState | 'share-opaque' | 'share-transparent', size?: number, compact?: boolean) => string;
};

export const APPROVED_BADGE_ASSETS: ApprovedAssetEntry[] = [
  ...LIFETIME_DISTANCE_RUNNING_DEFINITIONS.flatMap(definition => (['imperial', 'metric'] as const).map(units => ({ family: 'lifetime-running', id: definition.id, units, definition, artwork: running[`${definition.id}:${units}`], render: (state, size, compact) => renderLifetimeDistanceRunningBadgeSvg(definition.thresholdMiles, state, { unitSystem: units, size, compact }) } satisfies ApprovedAssetEntry))),
  ...LIFETIME_DISTANCE_CYCLING_DEFINITIONS.flatMap(definition => (['imperial', 'metric'] as const).map(units => ({ family: 'lifetime-cycling', id: definition.id, units, definition, artwork: cycling[`${definition.id}:${units}`], render: (state, size, compact) => renderLifetimeDistanceCyclingBadgeSvg(definition.thresholdMiles, state, { unitSystem: units, size, compact }) } satisfies ApprovedAssetEntry))),
  ...WEEKLY_DISTANCE_DEFINITIONS.map(definition => ({ family: 'weekly-distance', id: definition.id, definition, artwork: weekly[definition.id], render: (state, size, compact) => renderWeeklyDistanceBadgeSvg(definition.thresholdKm, state, { size, compact }) } satisfies ApprovedAssetEntry)),
  ...MONTHLY_DISTANCE_DEFINITIONS.map(definition => ({ family: 'monthly-distance', id: definition.id, definition, artwork: monthly[definition.id], render: (state, size, compact) => renderMonthlyDistanceBadgeSvg(definition.thresholdKm, state, { size, compact }) } satisfies ApprovedAssetEntry)),
  ...RUN_LEVEL_DEFINITIONS.map(definition => ({ family: 'run-level', id: definition.id, definition, artwork: levels[definition.id], render: (state, size, compact) => renderRunLevelBadgeSvg(definition.slug, state, { size, compact }) } satisfies ApprovedAssetEntry)),
  ...STREAK_MILESTONE_DEFINITIONS.map(definition => ({ family: 'streak', id: definition.id, definition, artwork: streaks.daily, render: (state, size, compact) => renderStreakBadgeSvg(definition.thresholdDays, state, { size, compact }) } satisfies ApprovedAssetEntry)),
  ...STRENGTH_ACHIEVEMENT_DEFINITIONS.map(definition => ({ family: 'strength', id: definition.id, definition, artwork: strength[definition.id], render: (state, size, compact) => renderStrengthAchievementBadgeSvg(definition.id, state, { size, compact }) } satisfies ApprovedAssetEntry)),
  ...RECOVERY_ACHIEVEMENT_DEFINITIONS.map(definition => ({ family: 'recovery', id: definition.id, definition, artwork: recovery[definition.id], render: (state, size, compact) => renderRecoveryAchievementBadgeSvg(definition.id, state, { size, compact }) } satisfies ApprovedAssetEntry)),
  ...CHALLENGE_PRESENTATION_DEFINITIONS.map(definition => ({ family: 'challenges', id: definition.id, definition, artwork: challenges[definition.id], render: (state, size, compact) => renderChallengeBadgeSvg(definition.id, state, { size, compact }) } satisfies ApprovedAssetEntry)),
];

export const APPROVED_BADGE_STATES: ApprovedBadgeState[] = ['unlocked', 'locked', 'transparent'];
export function approvedAssetPaths(entry: ApprovedAssetEntry, state: ApprovedBadgeState): { svg: string; png: string } {
  const definition = entry.definition;
  const svg = state === 'locked' ? definition.lockedArtworkPath : state === 'transparent' ? definition.shareTransparentSvgPath : definition.artworkPath;
  const png = state === 'locked' ? definition.lockedPngPath : state === 'transparent' ? definition.shareTransparentPngPath : definition.unlockedPngPath;
  const metric = (file: string) => file.replace(/\/([^/]+)$/, '/metric/$1');
  return entry.units === 'metric' ? { svg: metric(svg), png: metric(png) } : { svg, png };
}
