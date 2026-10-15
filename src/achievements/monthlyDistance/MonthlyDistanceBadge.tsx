import { View, type StyleProp, type ViewStyle } from 'react-native';
import { SvgXml } from 'react-native-svg';
import type { UnitSystem } from '../../store/settingsStore';
import { MONTHLY_DISTANCE_BY_KM, normalizeMonthlyDistanceBadgeState, type MonthlyDistanceBadgeInputState, type MonthlyDistanceMilestoneKm } from './monthlyDistanceDefinitions';
import { renderMonthlyDistanceBadgeSvg } from './monthlyDistanceArtwork';
import { monthlyDistanceAchievementAccessibilityLabel } from './monthlyDistanceUtils';

type Props = { milestoneKm: MonthlyDistanceMilestoneKm; state?: MonthlyDistanceBadgeInputState; compact?: boolean; size?: number; remainingMeters?: number; unitSystem?: UnitSystem; style?: StyleProp<ViewStyle> };

export default function MonthlyDistanceBadge({ milestoneKm, state = 'unlocked', compact = false, size = 128, remainingMeters = 0, unitSystem = 'metric', style }: Props) {
  const definition = MONTHLY_DISTANCE_BY_KM[milestoneKm], visualState = normalizeMonthlyDistanceBadgeState(state);
  return (
    <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}
      accessibilityLabel={monthlyDistanceAchievementAccessibilityLabel(definition, visualState === 'locked' ? 'locked' : 'earned', unitSystem, remainingMeters)}>
      <SvgXml xml={renderMonthlyDistanceBadgeSvg(milestoneKm, visualState, { compact, remainingMeters, unitSystem })} width={size} height={size} />
    </View>
  );
}
