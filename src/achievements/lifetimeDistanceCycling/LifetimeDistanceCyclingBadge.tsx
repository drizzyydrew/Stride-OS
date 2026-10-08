import { View, type StyleProp, type ViewStyle } from 'react-native';
import { SvgXml } from 'react-native-svg';

import type { UnitSystem } from '../../store/settingsStore';
import {
  normalizeLifetimeDistanceCyclingBadgeState,
  type LifetimeDistanceCyclingBadgeInputState,
  type LifetimeDistanceCyclingMilestone,
} from './lifetimeDistanceCyclingDefinitions';
import { LIFETIME_DISTANCE_CYCLING_VIEWBOX, renderLifetimeDistanceCyclingBadgeSvg } from './lifetimeDistanceCyclingArtwork';
import { lifetimeCyclingAchievementAccessibilityLabel } from './lifetimeDistanceCyclingUtils';
import { LIFETIME_DISTANCE_CYCLING_BY_MILESTONE } from './lifetimeDistanceCyclingDefinitions';

type Props = {
  milestone: LifetimeDistanceCyclingMilestone;
  state?: LifetimeDistanceCyclingBadgeInputState;
  unitSystem?: UnitSystem;
  compact?: boolean;
  size?: number;
  remainingMeters?: number;
  style?: StyleProp<ViewStyle>;
};

export default function LifetimeDistanceCyclingBadge({
  milestone,
  state: inputState = 'unlocked',
  unitSystem = 'imperial',
  compact = false,
  size = 128,
  remainingMeters = 0,
  style,
}: Props) {
  const resolvedState = normalizeLifetimeDistanceCyclingBadgeState(inputState);
  const definition = LIFETIME_DISTANCE_CYCLING_BY_MILESTONE[milestone];
  const stateForLabel = resolvedState === 'locked' ? 'locked' : 'earned';

  return (
    <View
      style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}
      accessibilityLabel={lifetimeCyclingAchievementAccessibilityLabel(definition, stateForLabel, unitSystem, remainingMeters)}
    >
      <SvgXml
        xml={renderLifetimeDistanceCyclingBadgeSvg(milestone, resolvedState, { compact, size: LIFETIME_DISTANCE_CYCLING_VIEWBOX, unitSystem, remainingMeters })}
        width={size}
        height={size}
      />
    </View>
  );
}
