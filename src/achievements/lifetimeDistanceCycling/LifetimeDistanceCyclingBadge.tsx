import { View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, Ellipse, LinearGradient, Path, RadialGradient, Stop, Text as SvgText } from 'react-native-svg';

import type { UnitSystem } from '../../store/settingsStore';
import {
  LIFETIME_DISTANCE_CYCLING_BY_MILESTONE,
  type LifetimeDistanceCyclingBadgeState,
  type LifetimeDistanceCyclingMilestone,
} from './lifetimeDistanceCyclingDefinitions';
import {
  LIFETIME_DISTANCE_CYCLING_DIAMOND_PATH,
  LIFETIME_DISTANCE_CYCLING_LABEL_FONT,
  LIFETIME_DISTANCE_CYCLING_NUMBER_Y,
  LIFETIME_DISTANCE_CYCLING_NUMBER_FONT,
  LIFETIME_DISTANCE_CYCLING_VIEWBOX,
  lifetimeDistanceCyclingBadgeTokens,
  lifetimeDistanceCyclingNumberFontSize,
  lifetimeDistanceCyclingNumberX,
} from './lifetimeDistanceCyclingArtwork';
import {
  formatLifetimeCyclingMilestoneNumber,
  lifetimeCyclingAchievementAccessibilityLabel,
  lifetimeCyclingUnitLabel,
} from './lifetimeDistanceCyclingUtils';

type Props = {
  milestone: LifetimeDistanceCyclingMilestone;
  state?: LifetimeDistanceCyclingBadgeState;
  unitSystem?: UnitSystem;
  compact?: boolean;
  size?: number;
  remainingMeters?: number;
  style?: StyleProp<ViewStyle>;
};

export default function LifetimeDistanceCyclingBadge({
  milestone,
  state = 'unlocked',
  unitSystem = 'imperial',
  compact = false,
  size = 128,
  remainingMeters = 0,
  style,
}: Props) {
  const definition = LIFETIME_DISTANCE_CYCLING_BY_MILESTONE[milestone];
  const tokens = lifetimeDistanceCyclingBadgeTokens(definition, state);
  const number = formatLifetimeCyclingMilestoneNumber(definition.thresholdMiles, unitSystem);
  const unit = lifetimeCyclingUnitLabel(unitSystem);
  const numberSize = lifetimeDistanceCyclingNumberFontSize(number, compact);
  const numberX = lifetimeDistanceCyclingNumberX(number);
  const edgeId = `lc-${definition.slug}-${state}-${unit}-edge`;
  const glowId = `lc-${definition.slug}-${state}-${unit}-glow`;
  const stateForLabel = state === 'locked' ? 'locked' : 'earned';

  return (
    <View
      style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}
      accessibilityLabel={lifetimeCyclingAchievementAccessibilityLabel(definition, stateForLabel, unitSystem, remainingMeters)}
    >
      <Svg width={size} height={size} viewBox={`0 0 ${LIFETIME_DISTANCE_CYCLING_VIEWBOX} ${LIFETIME_DISTANCE_CYCLING_VIEWBOX}`}>
        <Defs>
          <LinearGradient id={edgeId} x1="17" y1="14" x2="84" y2="88" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={tokens.highlight} />
            <Stop offset="0.52" stopColor={tokens.primary} />
            <Stop offset="1" stopColor={tokens.shadow} />
          </LinearGradient>
          <RadialGradient id={glowId} cx="50" cy="42" r="35" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={tokens.glow} stopOpacity={state === 'locked' ? 0.18 : 0.38} />
            <Stop offset="0.55" stopColor={tokens.glow} stopOpacity={state === 'share-transparent' ? 0.05 : 0.13} />
            <Stop offset="1" stopColor={tokens.glow} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Path d={LIFETIME_DISTANCE_CYCLING_DIAMOND_PATH} fill={tokens.fill} fillOpacity={tokens.fillOpacity} stroke={`url(#${edgeId})`} strokeWidth={2.2} strokeLinejoin="round" strokeOpacity={tokens.borderOpacity} />
        <Ellipse cx={50} cy={43} rx={30} ry={25} fill={`url(#${glowId})`} opacity={tokens.ambientOpacity} />
        {tokens.keylineOpacity > 0 ? (
          <SvgText
            x={numberX}
            y={LIFETIME_DISTANCE_CYCLING_NUMBER_Y}
            textAnchor="middle"
            alignmentBaseline="middle"
            fontFamily={LIFETIME_DISTANCE_CYCLING_NUMBER_FONT}
            fontSize={numberSize}
            fontWeight="400"
            stroke="#030405"
            strokeWidth={1.1}
            strokeOpacity={tokens.keylineOpacity}
            fill="none"
          >
            {number}
          </SvgText>
        ) : null}
        <SvgText
          x={numberX}
          y={LIFETIME_DISTANCE_CYCLING_NUMBER_Y}
          textAnchor="middle"
          alignmentBaseline="middle"
          fontFamily={LIFETIME_DISTANCE_CYCLING_NUMBER_FONT}
          fontSize={numberSize}
          fontWeight="400"
          fill={tokens.primary}
          fillOpacity={tokens.numberOpacity}
        >
          {number}
        </SvgText>
        {tokens.keylineOpacity > 0 ? (
          <SvgText x={50} y={58.5} textAnchor="middle" fontFamily={LIFETIME_DISTANCE_CYCLING_LABEL_FONT} fontSize={7.4} fontWeight="800" letterSpacing={1.4} stroke="#030405" strokeWidth={0.5} strokeOpacity={tokens.keylineOpacity} fill="none">
            {unit}
          </SvgText>
        ) : null}
        <SvgText x={50} y={58.5} textAnchor="middle" fontFamily={LIFETIME_DISTANCE_CYCLING_LABEL_FONT} fontSize={7.4} fontWeight="800" letterSpacing={1.4} fill={tokens.primary} fillOpacity={tokens.unitOpacity}>
          {unit}
        </SvgText>
        {tokens.keylineOpacity > 0 ? (
          <SvgText x={50} y={68.5} textAnchor="middle" fontFamily={LIFETIME_DISTANCE_CYCLING_LABEL_FONT} fontSize={4.4} fontWeight="800" letterSpacing={1.7} stroke="#030405" strokeWidth={0.4} strokeOpacity={tokens.keylineOpacity} fill="none">
            STRIDEOS
          </SvgText>
        ) : null}
        <SvgText x={50} y={68.5} textAnchor="middle" fontFamily={LIFETIME_DISTANCE_CYCLING_LABEL_FONT} fontSize={4.4} fontWeight="800" letterSpacing={1.7} fill={tokens.primary} fillOpacity={tokens.wordmarkOpacity}>
          STRIDEOS
        </SvgText>
        <Path d="M42.5 76.8 L50 81.9 L57.5 76.8" fill="none" stroke={tokens.primary} strokeWidth={1.25} strokeLinecap="round" strokeLinejoin="round" strokeOpacity={tokens.chevronOpacity} />
        <Path d="M43 82.7 L50 87.2 L57 82.7" fill="none" stroke={tokens.highlight} strokeWidth={1.25} strokeLinecap="round" strokeLinejoin="round" strokeOpacity={tokens.chevronOpacity} />
      </Svg>
    </View>
  );
}
