import { View, type StyleProp, type ViewStyle } from 'react-native';
import { SvgXml } from 'react-native-svg';

import type { UnitSystem } from '../../store/settingsStore';
import {
  normalizeFirstAchievementBadgeState,
  type FirstAchievementBadgeInputState,
  type FirstAchievementId,
} from './firstsDefinitions';
import { FIRSTS_VIEWBOX, renderFirstAchievementBadgeSvg } from './firstsArtwork';
import { FIRST_ACHIEVEMENT_BY_ID } from './firstsDefinitions';
import { firstAchievementAccessibilityLabel } from './firstsUtils';

type Props = {
  achievement: FirstAchievementId;
  state?: FirstAchievementBadgeInputState;
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
  const resolvedState = normalizeFirstAchievementBadgeState(state);
  return (
    <View
      style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}
      accessibilityLabel={firstAchievementAccessibilityLabel(definition, resolvedState === 'locked' ? 'locked' : 'earned', unitSystem)}
    >
      <SvgXml
        xml={renderFirstAchievementBadgeSvg(achievement, resolvedState, { compact, size: FIRSTS_VIEWBOX, unitSystem })}
        width={size}
        height={size}
      />
    </View>
  );
}
