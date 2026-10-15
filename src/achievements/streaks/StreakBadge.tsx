import { View, type StyleProp, type ViewStyle } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { renderStreakBadgeSvg, safeStreakDays } from './streakArtwork';
import { normalizeStreakBadgeState, STREAK_MILESTONE_BY_ID, type StreakBadgeInputState } from './streakDefinitions';
import { streakAchievementAccessibilityLabel } from './streakUtils';

type Props = { days: number; state?: StreakBadgeInputState; compact?: boolean; size?: number; remainingDays?: number; style?: StyleProp<ViewStyle> };

export default function StreakBadge({ days, state = 'unlocked', compact = false, size = 128, remainingDays = 0, style }: Props) {
  const count = safeStreakDays(days), visualState = normalizeStreakBadgeState(state);
  const definition = Object.values(STREAK_MILESTONE_BY_ID).find(item => item.thresholdDays === count);
  return (
    <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}
      accessibilityLabel={streakAchievementAccessibilityLabel(count, visualState === 'locked' ? 'locked' : 'earned', remainingDays, definition?.subtitle)}>
      <SvgXml xml={renderStreakBadgeSvg(count, visualState, { compact, remainingDays })} width={size} height={size} />
    </View>
  );
}
