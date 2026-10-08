import { View, type StyleProp, type ViewStyle } from 'react-native';
import { SvgXml } from 'react-native-svg';

import type { UnitSystem } from '../../store/settingsStore';
import {
  normalizeLifetimeDistanceRunningBadgeState,
  type LifetimeDistanceRunningBadgeInputState,
  type LifetimeDistanceRunningMilestone,
} from './lifetimeDistanceRunningDefinitions';
import { LIFETIME_DISTANCE_RUNNING_VIEWBOX, renderLifetimeDistanceRunningBadgeSvg } from './lifetimeDistanceRunningArtwork';
import { lifetimeRunningAchievementAccessibilityLabel } from './lifetimeDistanceRunningUtils';
import { LIFETIME_DISTANCE_RUNNING_BY_MILESTONE } from './lifetimeDistanceRunningDefinitions';

type Props = {
  milestone: LifetimeDistanceRunningMilestone;
  state?: LifetimeDistanceRunningBadgeInputState;
  unitSystem?: UnitSystem;
  compact?: boolean;
  size?: number;
  remainingMeters?: number;
  style?: StyleProp<ViewStyle>;
};

export default function LifetimeDistanceRunningBadge({
  milestone,
  state: inputState = 'unlocked',
  unitSystem = 'imperial',
  compact = false,
  size = 128,
  remainingMeters = 0,
  style,
}: Props) {
  const resolvedState = normalizeLifetimeDistanceRunningBadgeState(inputState);
  const definition = LIFETIME_DISTANCE_RUNNING_BY_MILESTONE[milestone];
  const stateForLabel = resolvedState === 'locked' ? 'locked' : 'earned';

  return (
    <View
      style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}
      accessibilityLabel={lifetimeRunningAchievementAccessibilityLabel(definition, stateForLabel, unitSystem, remainingMeters)}
    >
      <SvgXml
        xml={renderLifetimeDistanceRunningBadgeSvg(milestone, resolvedState, { compact, size: LIFETIME_DISTANCE_RUNNING_VIEWBOX, unitSystem, remainingMeters })}
        width={size}
        height={size}
      />
    </View>
  );
}
