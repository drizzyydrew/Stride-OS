import { View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, Ellipse, LinearGradient, Path, RadialGradient, Stop, Text as SvgText } from 'react-native-svg';

import {
  STREAK_FLAME_INNER_PATH,
  STREAK_FLAME_LEFT_PATH,
  STREAK_FLAME_OUTER_PATH,
  STREAK_FLAME_TRANSFORM,
  STREAK_HEXAGON_PATH,
  STREAK_LABEL_FONT,
  STREAK_NUMBER_FONT,
  STREAK_VIEWBOX,
  streakBadgeTokens,
  streakNumberFontSize,
  streakNumberX,
} from './streakArtwork';
import {
  STREAK_MILESTONE_BY_ID,
  type StreakBadgeState,
} from './streakDefinitions';
import { STREAK_PANEL_BLACK } from './streakTokens';
import { streakAchievementAccessibilityLabel } from './streakUtils';

type Props = {
  days: number;
  state?: StreakBadgeState;
  compact?: boolean;
  size?: number;
  remainingDays?: number;
  style?: StyleProp<ViewStyle>;
};

export default function StreakBadge({
  days,
  state = 'unlocked',
  compact = false,
  size = 128,
  remainingDays = 0,
  style,
}: Props) {
  const safeDays = Math.max(1, Math.floor(Number.isFinite(days) ? days : 1));
  const visualState = state === 'share-opaque' ? 'unlocked' : state;
  const tokens = streakBadgeTokens(safeDays, visualState);
  const text = String(safeDays);
  const numberSize = streakNumberFontSize(text, compact);
  const numberX = streakNumberX(text);
  const definition = Object.values(STREAK_MILESTONE_BY_ID).find(item => item.thresholdDays === safeDays);
  const stateForLabel = visualState === 'locked' ? 'locked' : 'earned';
  const edgeId = `streak-${safeDays}-${visualState}-edge`;
  const flameId = `streak-${safeDays}-${visualState}-flame`;
  const glowId = `streak-${safeDays}-${visualState}-glow`;

  return (
    <View
      style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}
      accessibilityLabel={streakAchievementAccessibilityLabel(safeDays, stateForLabel, remainingDays, definition?.subtitle)}
    >
      <Svg width={size} height={size} viewBox={`0 0 ${STREAK_VIEWBOX} ${STREAK_VIEWBOX}`}>
        <Defs>
          <LinearGradient id={edgeId} x1="17" y1="8" x2="84" y2="91" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={tokens.highlight} />
            <Stop offset="0.5" stopColor={tokens.primary} />
            <Stop offset="1" stopColor={tokens.shadow} />
          </LinearGradient>
          <LinearGradient id={flameId} x1="43" y1="19" x2="58" y2="72" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={tokens.center} />
            <Stop offset="0.42" stopColor={tokens.highlight} />
            <Stop offset="0.7" stopColor={tokens.primary} />
            <Stop offset="1" stopColor={tokens.shadow} />
          </LinearGradient>
          <RadialGradient id={glowId} cx="50" cy="43" r="38" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={tokens.glow} stopOpacity={visualState === 'locked' ? 0.13 : 0.36} />
            <Stop offset="0.66" stopColor={tokens.glow} stopOpacity={visualState === 'share-transparent' ? 0.04 : 0.12} />
            <Stop offset="1" stopColor={tokens.glow} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Path d={STREAK_HEXAGON_PATH} fill={tokens.fill} fillOpacity={tokens.fillOpacity} stroke={`url(#${edgeId})`} strokeWidth={2.35} strokeLinejoin="round" strokeOpacity={tokens.borderOpacity} />
        <Path d={STREAK_HEXAGON_PATH} fill="none" stroke={tokens.highlight} strokeWidth={0.75} strokeLinejoin="round" strokeOpacity={tokens.secondaryOpacity} transform="translate(0.9 0.9) scale(0.982)" />
        <Ellipse cx={50} cy={44} rx={31} ry={29} fill={`url(#${glowId})`} opacity={tokens.ambientOpacity} />
        <Path d={STREAK_FLAME_OUTER_PATH} fill={`url(#${flameId})`} opacity={tokens.flameOpacity} transform={STREAK_FLAME_TRANSFORM} />
        <Path d={STREAK_FLAME_LEFT_PATH} fill={tokens.primary} opacity={visualState === 'locked' ? 0.28 : 0.72} transform={STREAK_FLAME_TRANSFORM} />
        <Path d={STREAK_FLAME_INNER_PATH} fill={visualState === 'locked' ? '#111315' : STREAK_PANEL_BLACK} opacity={visualState === 'share-transparent' ? 0.18 : 0.92} transform={STREAK_FLAME_TRANSFORM} />
        <Path d={STREAK_FLAME_INNER_PATH} fill={tokens.center} opacity={visualState === 'locked' ? 0.22 : 0.18} transform={`${STREAK_FLAME_TRANSFORM} translate(1.1 -1.2) scale(0.94)`} />
        {tokens.keylineOpacity > 0 ? (
          <SvgText x={numberX} y={65.8} textAnchor="middle" alignmentBaseline="middle" fontFamily={STREAK_NUMBER_FONT} fontSize={numberSize} fontWeight="600" stroke="#030405" strokeWidth={1.05} strokeOpacity={tokens.keylineOpacity} fill="none">
            {text}
          </SvgText>
        ) : null}
        <SvgText x={numberX} y={65.8} textAnchor="middle" alignmentBaseline="middle" fontFamily={STREAK_NUMBER_FONT} fontSize={numberSize} fontWeight="600" fill={tokens.primary} fillOpacity={tokens.numberOpacity}>
          {text}
        </SvgText>
        {!compact ? (
          <>
            {tokens.keylineOpacity > 0 ? (
              <SvgText x={50} y={75.2} textAnchor="middle" fontFamily={STREAK_LABEL_FONT} fontSize={5.6} fontWeight="900" letterSpacing={0.7} stroke="#030405" strokeWidth={0.45} strokeOpacity={tokens.keylineOpacity} fill="none">
                DAY STREAK
              </SvgText>
            ) : null}
            <SvgText x={50} y={75.2} textAnchor="middle" fontFamily={STREAK_LABEL_FONT} fontSize={5.6} fontWeight="900" letterSpacing={0.7} fill={tokens.primary} fillOpacity={tokens.labelOpacity}>
              DAY STREAK
            </SvgText>
            {tokens.keylineOpacity > 0 ? (
              <SvgText x={50} y={82.8} textAnchor="middle" fontFamily={STREAK_LABEL_FONT} fontSize={3.6} fontWeight="900" letterSpacing={1.45} stroke="#030405" strokeWidth={0.35} strokeOpacity={tokens.keylineOpacity} fill="none">
                STRIDEOS
              </SvgText>
            ) : null}
            <SvgText x={50} y={82.8} textAnchor="middle" fontFamily={STREAK_LABEL_FONT} fontSize={3.6} fontWeight="900" letterSpacing={1.45} fill={tokens.primary} fillOpacity={tokens.wordmarkOpacity}>
              STRIDEOS
            </SvgText>
            <Path d="M43.6 86.8 L50 90.6 L56.4 86.8" fill="none" stroke={tokens.primary} strokeWidth={1.05} strokeLinecap="round" strokeLinejoin="round" strokeOpacity={tokens.chevronOpacity} />
            <Path d="M44.4 91 L50 94.3 L55.6 91" fill="none" stroke={tokens.highlight} strokeWidth={1.05} strokeLinecap="round" strokeLinejoin="round" strokeOpacity={tokens.chevronOpacity} />
          </>
        ) : null}
      </Svg>
    </View>
  );
}
