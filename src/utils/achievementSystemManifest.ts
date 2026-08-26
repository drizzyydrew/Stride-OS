import {
  ACHIEVEMENT_SYSTEM_REGISTRY,
  auditAchievementRegistry,
  type AchievementDefinitionV2,
} from './achievementSystem';

export type AchievementAssetManifestEntry = {
  achievementId: string;
  category: AchievementDefinitionV2['category'];
  family: AchievementDefinitionV2['family'];
  artworkPath: string;
  lockedArtworkPath: string;
  version: number;
  lockedStatePolicy: 'desaturate_preview';
  shareEligibility: boolean;
  unitBehavior: AchievementDefinitionV2['unitBehavior'];
  threshold: number;
  thresholdUnit: AchievementDefinitionV2['thresholdUnit'];
  dominantColor: string;
  shareArtPath?: string;
  shareOverlayPath?: string;
  sourceReferenceNotes?: string;
  copyrightOriginalArtConfirmation: 'original_strideos_vector_or_owned_asset';
};

export const ACHIEVEMENT_ASSET_MANIFEST: AchievementAssetManifestEntry[] =
  ACHIEVEMENT_SYSTEM_REGISTRY.map(definition => ({
    achievementId: definition.id,
    category: definition.category,
    family: definition.family,
    artworkPath: definition.artworkPath,
    lockedArtworkPath: definition.lockedArtworkPath ?? definition.artworkPath,
    version: 1,
    lockedStatePolicy: 'desaturate_preview',
    shareEligibility: definition.shareCardEligibility,
    unitBehavior: definition.unitBehavior,
    threshold: definition.threshold,
    thresholdUnit: definition.thresholdUnit,
    dominantColor: definition.dominantColor,
    shareArtPath: definition.shareArtPath,
    shareOverlayPath: definition.shareOverlayPath,
    sourceReferenceNotes: definition.sourceNotes,
    copyrightOriginalArtConfirmation: 'original_strideos_vector_or_owned_asset',
  }));

export const ACHIEVEMENT_ASSET_MANIFEST_AUDIT = auditAchievementRegistry();

export function getAchievementManifestEntry(id: string): AchievementAssetManifestEntry | undefined {
  return ACHIEVEMENT_ASSET_MANIFEST.find(item => item.achievementId === id);
}
