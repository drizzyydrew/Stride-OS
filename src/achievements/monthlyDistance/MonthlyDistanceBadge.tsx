import { View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, Ellipse, LinearGradient, Path, RadialGradient, Stop, Text as SvgText } from 'react-native-svg';

import type { UnitSystem } from '../../store/settingsStore';
import {
  MONTHLY_DISTANCE_BY_KM,
  type MonthlyDistanceBadgeState,
  type MonthlyDistanceMilestoneKm,
} from './monthlyDistanceDefinitions';
import {
  MONTHLY_DISTANCE_HEXAGON_PATH,
  MONTHLY_DISTANCE_LABEL_FONT,
  MONTHLY_DISTANCE_NUMBER_FONT,
  MONTHLY_DISTANCE_VIEWBOX,
  monthlyDistanceBadgeTokens,
  monthlyDistanceNumberFontSize,
  monthlyDistanceNumberX,
} from './monthlyDistanceArtwork';
import {
  formatMonthlyDistanceBadgeText,
  monthlyDistanceAchievementAccessibilityLabel,
} from './monthlyDistanceUtils';

type Props = {
  milestoneKm: MonthlyDistanceMilestoneKm;
  state?: MonthlyDistanceBadgeState;
  compact?: boolean;
  size?: number;
  remainingMeters?: number;
  unitSystem?: UnitSystem;
  style?: StyleProp<ViewStyle>;
};

export default function MonthlyDistanceBadge({
  milestoneKm,
  state = 'unlocked',
  compact = false,
  size = 128,
  remainingMeters = 0,
  unitSystem = 'metric',
  style,
}: Props) {
  const definition = MONTHLY_DISTANCE_BY_KM[milestoneKm];
  const visualState = state === 'share-opaque' ? 'unlocked' : state;
  const tokens = monthlyDistanceBadgeTokens(definition, visualState);
  const number = formatMonthlyDistanceBadgeText(definition.thresholdKm);
  const numberSize = monthlyDistanceNumberFontSize(number, compact);
  const numberX = monthlyDistanceNumberX(number);
  const edgeId = `monthly-${definition.slug}-${visualState}-edge`;
  const glowId = `monthly-${definition.slug}-${visualState}-glow`;
  const stateForLabel = visualState === 'locked' ? 'locked' : 'earned';

  return (
    <View
      style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}
      accessibilityLabel={monthlyDistanceAchievementAccessibilityLabel(definition, stateForLabel, unitSystem, remainingMeters)}
    >
      <Svg width={size} height={size} viewBox={`0 0 ${MONTHLY_DISTANCE_VIEWBOX} ${MONTHLY_DISTANCE_VIEWBOX}`}>
        <Defs>
          <LinearGradient id={edgeId} x1="16" y1="10" x2="84" y2="90" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={tokens.highlight} />
            <Stop offset="0.55" stopColor={tokens.primary} />
            <Stop offset="1" stopColor={tokens.shadow} />
          </LinearGradient>
          <RadialGradient id={glowId} cx="50" cy="39" r="38" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={tokens.glow} stopOpacity={visualState === 'locked' ? 0.14 : 0.34} />
            <Stop offset="0.62" stopColor={tokens.glow} stopOpacity={visualState === 'share-transparent' ? 0.04 : 0.12} />
            <Stop offset="1" stopColor={tokens.glow} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Path d={MONTHLY_DISTANCE_HEXAGON_PATH} fill={tokens.fill} fillOpacity={tokens.fillOpacity} stroke={`url(#${edgeId})`} strokeWidth={2.35} strokeLinejoin="round" strokeOpacity={tokens.borderOpacity} />
        <Ellipse cx={50} cy={41} rx={30} ry={26} fill={`url(#${glowId})`} opacity={tokens.ambientOpacity} />
        {tokens.keylineOpacity > 0 ? (
          <SvgText x={numberX} y={39.5} textAnchor="middle" alignmentBaseline="middle" fontFamily={MONTHLY_DISTANCE_NUMBER_FONT} fontSize={numberSize} fontWeight="400" stroke="#030405" strokeWidth={1.1} strokeOpacity={tokens.keylineOpacity} fill="none">
            {number}
          </SvgText>
        ) : null}
        <SvgText x={numberX} y={39.5} textAnchor="middle" alignmentBaseline="middle" fontFamily={MONTHLY_DISTANCE_NUMBER_FONT} fontSize={numberSize} fontWeight="400" fill={tokens.primary} fillOpacity={tokens.numberOpacity}>
          {number}
        </SvgText>
        {tokens.keylineOpacity > 0 ? (
          <SvgText x={50} y={56.5} textAnchor="middle" fontFamily={MONTHLY_DISTANCE_LABEL_FONT} fontSize={7} fontWeight="800" letterSpacing={1.3} stroke="#030405" strokeWidth={0.5} strokeOpacity={tokens.keylineOpacity} fill="none">
            MONTH
          </SvgText>
        ) : null}
        <SvgText x={50} y={56.5} textAnchor="middle" fontFamily={MONTHLY_DISTANCE_LABEL_FONT} fontSize={7} fontWeight="800" letterSpacing={1.3} fill={tokens.primary} fillOpacity={tokens.labelOpacity}>
          MONTH
        </SvgText>
        {!compact ? (
          <>
            {tokens.keylineOpacity > 0 ? (
              <SvgText x={50} y={67} textAnchor="middle" fontFamily={MONTHLY_DISTANCE_LABEL_FONT} fontSize={4.4} fontWeight="800" letterSpacing={1.7} stroke="#030405" strokeWidth={0.4} strokeOpacity={tokens.keylineOpacity} fill="none">
                STRIDEOS
              </SvgText>
            ) : null}
            <SvgText x={50} y={67} textAnchor="middle" fontFamily={MONTHLY_DISTANCE_LABEL_FONT} fontSize={4.4} fontWeight="800" letterSpacing={1.7} fill={tokens.primary} fillOpacity={tokens.wordmarkOpacity}>
              STRIDEOS
            </SvgText>
            <Path d="M42.6 75.5 L50 80.3 L57.4 75.5" fill="none" stroke={tokens.primary} strokeWidth={1.22} strokeLinecap="round" strokeLinejoin="round" strokeOpacity={tokens.chevronOpacity} />
            <Path d="M43.1 81 L50 85.4 L56.9 81" fill="none" stroke={tokens.highlight} strokeWidth={1.22} strokeLinecap="round" strokeLinejoin="round" strokeOpacity={tokens.chevronOpacity} />
          </>
        ) : null}
      </Svg>
    </View>
  );
}
