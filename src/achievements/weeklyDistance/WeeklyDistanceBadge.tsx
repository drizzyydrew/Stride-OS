import { View, type StyleProp, type ViewStyle } from 'react-native';
import { SvgXml } from 'react-native-svg';
import type { UnitSystem } from '../../store/settingsStore';
import { WEEKLY_DISTANCE_BY_KM, normalizeWeeklyDistanceBadgeState, type WeeklyDistanceBadgeInputState, type WeeklyDistanceMilestoneKm } from './weeklyDistanceDefinitions';
import { renderWeeklyDistanceBadgeSvg } from './weeklyDistanceArtwork';
import { weeklyDistanceAchievementAccessibilityLabel } from './weeklyDistanceUtils';

type Props = { milestoneKm: WeeklyDistanceMilestoneKm; state?: WeeklyDistanceBadgeInputState; compact?: boolean; size?: number; remainingMeters?: number; unitSystem?: UnitSystem; style?: StyleProp<ViewStyle> };

export default function WeeklyDistanceBadge({ milestoneKm, state = 'unlocked', compact = false, size = 128, remainingMeters = 0, unitSystem = 'metric', style }: Props) {
  const definition = WEEKLY_DISTANCE_BY_KM[milestoneKm], visualState = normalizeWeeklyDistanceBadgeState(state);
  return (
    <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}
      accessibilityLabel={weeklyDistanceAchievementAccessibilityLabel(definition, visualState === 'locked' ? 'locked' : 'earned', unitSystem, remainingMeters)}>
      <SvgXml xml={renderWeeklyDistanceBadgeSvg(milestoneKm, visualState, { compact, remainingMeters, unitSystem })} width={size} height={size} />
    </View>
  );
}
