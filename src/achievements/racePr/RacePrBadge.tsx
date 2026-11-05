import { View, type StyleProp, type ViewStyle } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { renderRacePrBadgeSvg, RACE_PR_VIEWBOX } from './racePrArtwork';
import { RACE_PR_BY_ID, normalizeRacePrBadgeState, type RacePrAchievementId, type RacePrBadgeInputState } from './racePrDefinitions';

type Props = { achievement: RacePrAchievementId; state?: RacePrBadgeInputState; compact?: boolean; size?: number; style?: StyleProp<ViewStyle> };
export default function RacePrBadge({ achievement, state = 'unlocked', compact = false, size = 128, style }: Props) {
  const definition = RACE_PR_BY_ID[achievement];
  const resolved = normalizeRacePrBadgeState(state);
  return <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}
    accessibilityLabel={`${definition.distanceLabel} personal record, ${resolved === 'locked' ? 'not yet earned' : 'earned'}`}>
    <SvgXml xml={renderRacePrBadgeSvg(achievement, resolved, { compact, size: RACE_PR_VIEWBOX })} width={size} height={size} />
  </View>;
}
