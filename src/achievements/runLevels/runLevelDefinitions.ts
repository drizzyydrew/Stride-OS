import { RUN_LEVEL_COLORS, type RunLevelColorTokens } from './runLevelColors';
import { RUN_LEVEL_THRESHOLDS_MILES, runLevelMilesToMeters } from './runLevelThresholds';

export type RunLevelSlug =
  | 'foundation'
  | 'rhythm'
  | 'momentum'
  | 'durability'
  | 'engine'
  | 'peak'
  | 'summit';

export type RunLevelId =
  | 'run_level_foundation'
  | 'run_level_rhythm'
  | 'run_level_momentum'
  | 'run_level_durability'
  | 'run_level_engine'
  | 'run_level_peak'
  | 'run_level_summit';

export type RunLevelDefinition = {
  id: RunLevelId;
  slug: RunLevelSlug;
  title: string;
  titleUpper: string;
  tier: number;
  thresholdMiles: number;
  thresholdMeters: number;
  ringCount: number;
  colors: RunLevelColorTokens;
  artworkPath: string;
  lockedArtworkPath: string;
  shareTransparentSvgPath: string;
  shareTransparentPngPath: string;
  shareOpaqueSvgPath: string;
  shareOpaquePngPath: string;
};

const SLUGS: RunLevelSlug[] = [
  'foundation',
  'rhythm',
  'momentum',
  'durability',
  'engine',
  'peak',
  'summit',
];

const TITLES: Record<RunLevelSlug, string> = {
  foundation: 'Foundation',
  rhythm: 'Rhythm',
  momentum: 'Momentum',
  durability: 'Durability',
  engine: 'Engine',
  peak: 'Peak',
  summit: 'Summit',
};

export const RUN_LEVEL_DEFINITIONS: RunLevelDefinition[] = SLUGS.map((slug, index) => ({
  id: `run_level_${slug}` as RunLevelId,
  slug,
  title: TITLES[slug],
  titleUpper: TITLES[slug].toUpperCase(),
  tier: index + 1,
  thresholdMiles: RUN_LEVEL_THRESHOLDS_MILES[slug],
  thresholdMeters: runLevelMilesToMeters(RUN_LEVEL_THRESHOLDS_MILES[slug]),
  ringCount: [5, 5, 5, 5, 6, 6, 6][index],
  colors: RUN_LEVEL_COLORS[slug],
  artworkPath: `assets/achievements/system/run-levels/run-level-${slug}-unlocked.svg`,
  lockedArtworkPath: `assets/achievements/system/run-levels/run-level-${slug}-locked.svg`,
  shareTransparentSvgPath: `assets/achievements/system/run-levels/run-level-${slug}-share-transparent.svg`,
  shareTransparentPngPath: `assets/achievements/system/run-levels/run-level-${slug}-share-transparent.png`,
  shareOpaqueSvgPath: `assets/achievements/system/run-levels/run-level-${slug}-share-opaque.svg`,
  shareOpaquePngPath: `assets/achievements/system/run-levels/run-level-${slug}-share-opaque.png`,
}));

export const RUN_LEVEL_BY_SLUG = Object.fromEntries(
  RUN_LEVEL_DEFINITIONS.map(level => [level.slug, level]),
) as Record<RunLevelSlug, RunLevelDefinition>;

export const RUN_LEVEL_BY_ID = Object.fromEntries(
  RUN_LEVEL_DEFINITIONS.map(level => [level.id, level]),
) as Record<RunLevelId, RunLevelDefinition>;

export function isRunLevelId(id: string): id is RunLevelId {
  return id in RUN_LEVEL_BY_ID;
}

export function runLevelSlugFromId(id: string): RunLevelSlug | null {
  return isRunLevelId(id) ? RUN_LEVEL_BY_ID[id].slug : null;
}
