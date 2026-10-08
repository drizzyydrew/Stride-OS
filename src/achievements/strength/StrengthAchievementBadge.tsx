import { View, type StyleProp, type ViewStyle } from 'react-native';
import { SvgXml } from 'react-native-svg';

import {
  STRENGTH_ACHIEVEMENT_BY_ID,
  normalizeStrengthAchievementBadgeState,
  type StrengthAchievementBadgeInputState,
  type StrengthAchievementId,
} from './strengthDefinitions';
import { STRENGTH_VIEWBOX, renderStrengthAchievementBadgeSvg } from './strengthArtwork';
import { strengthAchievementAccessibilityLabel } from './strengthUtils';

type Props = {
  achievement: StrengthAchievementId;
  state?: StrengthAchievementBadgeInputState;
  compact?: boolean;
  size?: number;
  remaining?: number;
  style?: StyleProp<ViewStyle>;
};

export default function StrengthAchievementBadge({
  achievement,
  state = 'unlocked',
  compact = false,
  size = 128,
  remaining,
  style,
}: Props) {
  const definition = STRENGTH_ACHIEVEMENT_BY_ID[achievement];
  const resolvedState = normalizeStrengthAchievementBadgeState(state);
  return (
    <View
      style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}
      accessibilityLabel={strengthAchievementAccessibilityLabel(definition, resolvedState === 'locked' ? 'locked' : 'earned', remaining)}
    >
      <SvgXml
        xml={renderStrengthAchievementBadgeSvg(achievement, state, { compact, size: STRENGTH_VIEWBOX, remaining })}
        width={size}
        height={size}
      />
    </View>
  );
}
