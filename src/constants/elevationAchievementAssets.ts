import type { ImageSourcePropType } from 'react-native';

import type { AchievementId } from '../utils/achievements';

export const ELEVATION_ACHIEVEMENT_ARTWORK: Partial<Record<AchievementId, ImageSourcePropType>> = {
  elevation_mount_hood: require('../../assets/achievements/elevation/artwork/mount-hood.png'),
  elevation_mount_fuji: require('../../assets/achievements/elevation/artwork/mount-fuji.png'),
  elevation_mount_rainier: require('../../assets/achievements/elevation/artwork/mount-rainier.png'),
  elevation_kilimanjaro: require('../../assets/achievements/elevation/artwork/kilimanjaro.png'),
  elevation_denali: require('../../assets/achievements/elevation/artwork/denali.png'),
  elevation_aconcagua: require('../../assets/achievements/elevation/artwork/aconcagua.png'),
  elevation_mount_everest: require('../../assets/achievements/elevation/artwork/mount-everest.png'),
  elevation_mauna_kea: require('../../assets/achievements/elevation/artwork/mauna-kea.png'),
  elevation_ascraeus_mons: require('../../assets/achievements/elevation/artwork/ascraeus-mons.png'),
  elevation_olympus_mons: require('../../assets/achievements/elevation/artwork/olympus-mons.png'),
};

export function getElevationAchievementArtwork(id: AchievementId): ImageSourcePropType | null {
  return ELEVATION_ACHIEVEMENT_ARTWORK[id] ?? null;
}
