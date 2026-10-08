import { View, type StyleProp, type ViewStyle } from 'react-native';
import { SvgXml } from 'react-native-svg';

import {
  CHALLENGE_ACHIEVEMENT_BY_ID,
  normalizeChallengeBadgeState,
  type ChallengeAchievementId,
  type ChallengeBadgeInputState,
} from './challengesDefinitions';
import { CHALLENGES_VIEWBOX, renderChallengeBadgeSvg } from './challengesArtwork';
import { challengeAchievementAccessibilityLabel } from './challengesUtils';

type Props = {
  achievement: ChallengeAchievementId;
  state?: ChallengeBadgeInputState;
  compact?: boolean;
  size?: number;
  style?: StyleProp<ViewStyle>;
};

export default function ChallengeBadge({
  achievement,
  state = 'unlocked',
  compact = false,
  size = 128,
  style,
}: Props) {
  const definition = CHALLENGE_ACHIEVEMENT_BY_ID[achievement];
  const visualState = normalizeChallengeBadgeState(state);
  return (
    <View
      style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}
      accessibilityLabel={challengeAchievementAccessibilityLabel(definition, visualState === 'locked' ? 'locked' : 'earned')}
    >
      <SvgXml
        xml={renderChallengeBadgeSvg(achievement, state, { compact, size: CHALLENGES_VIEWBOX })}
        width={size}
        height={size}
      />
    </View>
  );
}
