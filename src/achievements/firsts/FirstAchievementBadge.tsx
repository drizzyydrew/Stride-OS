import { View, type StyleProp, type ViewStyle } from 'react-native';
import { SvgXml } from 'react-native-svg';

import type { UnitSystem } from '../../store/settingsStore';
import {
  type FirstAchievementBadgeState,
  type FirstAchievementId,
} from './firstsDefinitions';
import { FIRSTS_VIEWBOX, renderFirstAchievementBadgeSvg } from './firstsArtwork';
import { FIRST_ACHIEVEMENT_BY_ID } from './firstsDefinitions';
import { firstAchievementAccessibilityLabel } from './firstsUtils';

type Props = {
  achievement: FirstAchievementId;
  state?: FirstAchievementBadgeState;
  compact?: boolean;
  size?: number;
  unitSystem?: UnitSystem;
  style?: StyleProp<ViewStyle>;
};

export default function FirstAchievementBadge({
  achievement,
  state = 'unlocked',
  compact = false,
  size = 128,
  unitSystem = 'imperial',
  style,
}: Props) {
  const definition = FIRST_ACHIEVEMENT_BY_ID[achievement];
  const visualState = state === 'share-opaque' ? 'unlocked' : state;
  return (
    <View
      style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}
      accessibilityLabel={firstAchievementAccessibilityLabel(definition, visualState === 'locked' ? 'locked' : 'earned', unitSystem)}
    >
      <SvgXml
        xml={renderFirstAchievementBadgeSvg(achievement, state, { compact, size: FIRSTS_VIEWBOX, unitSystem })}
        width={size}
        height={size}
      />
    </View>
  );
}
