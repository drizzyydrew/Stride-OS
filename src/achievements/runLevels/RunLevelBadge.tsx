import { View, type StyleProp, type ViewStyle } from 'react-native';
import { SvgXml } from 'react-native-svg';
import type { UnitSystem } from '../../store/settingsStore';
import { renderRunLevelBadgeSvg, runLevelBadgeAccessibilityLabel, normalizeRunLevelBadgeState, type RunLevelBadgeInputState } from './runLevelArtwork';
import type { RunLevelSlug } from './runLevelDefinitions';

type Props = { level: RunLevelSlug; state?: RunLevelBadgeInputState; size?: number; compact?: boolean; remainingMeters?: number; units?: UnitSystem; style?: StyleProp<ViewStyle> };

export default function RunLevelBadge({ level, state = 'unlocked', size = 128, compact = false, remainingMeters, units = 'imperial', style }: Props) {
  const resolvedState = normalizeRunLevelBadgeState(state);
  return (
    <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}
      accessibilityLabel={runLevelBadgeAccessibilityLabel(level, resolvedState, remainingMeters, units)}>
      <SvgXml xml={renderRunLevelBadgeSvg(level, resolvedState, { compact, remainingMeters, units })} width={size} height={size} />
    </View>
  );
}
