import { View, type StyleProp, type ViewStyle } from 'react-native';
import { SvgXml } from 'react-native-svg';

import {
  RECOVERY_ACHIEVEMENT_BY_ID,
  type RecoveryAchievementBadgeState,
  type RecoveryAchievementId,
} from './recoveryDefinitions';
import { RECOVERY_VIEWBOX, renderRecoveryAchievementBadgeSvg } from './recoveryArtwork';
import { recoveryAchievementAccessibilityLabel } from './recoveryUtils';

type Props = {
  achievement: RecoveryAchievementId;
  state?: RecoveryAchievementBadgeState;
  compact?: boolean;
  size?: number;
  remaining?: number;
  style?: StyleProp<ViewStyle>;
};

export default function RecoveryAchievementBadge({
  achievement,
  state = 'unlocked',
  compact = false,
  size = 128,
  remaining,
  style,
}: Props) {
  const definition = RECOVERY_ACHIEVEMENT_BY_ID[achievement];
  const visualState = state === 'share-opaque' ? 'unlocked' : state;
  return (
    <View
      style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}
      accessibilityLabel={recoveryAchievementAccessibilityLabel(definition, visualState === 'locked' ? 'locked' : 'earned', remaining)}
    >
      <SvgXml
        xml={renderRecoveryAchievementBadgeSvg(achievement, state, { compact, size: RECOVERY_VIEWBOX, remaining })}
        width={size}
        height={size}
      />
    </View>
  );
}
