import { View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { ClipPath, Defs, G, LinearGradient, Path, RadialGradient, Rect, Stop, Text as SvgText } from 'react-native-svg';

import {
  RUN_LEVEL_MOUNTAIN,
  RUN_LEVEL_VIEWBOX,
  runLevelBadgeAccessibilityLabel,
  runLevelBadgeTokens,
  runLevelHexPath,
  runLevelRingPath,
  runLevelRingInsets,
  type RunLevelBadgeState,
} from './runLevelArtwork';
import {
  RUN_LEVEL_BY_SLUG,
  type RunLevelSlug,
} from './runLevelDefinitions';
import { RUN_LEVEL_LOCKED_GRAY } from './runLevelColors';
import type { UnitSystem } from '../../store/settingsStore';

type Props = {
  level: RunLevelSlug;
  state?: RunLevelBadgeState;
  size?: number;
  compact?: boolean;
  remainingMeters?: number;
  units?: UnitSystem;
  style?: StyleProp<ViewStyle>;
};

export default function RunLevelBadge({
  level,
  state = 'unlocked',
  size = 128,
  compact = false,
  remainingMeters,
  units = 'imperial',
  style,
}: Props) {
  const definition = RUN_LEVEL_BY_SLUG[level];
  const tokens = runLevelBadgeTokens(definition, state);
  const edgeId = `rl-${level}-${state}-edge`;
  const interiorId = `rl-${level}-${state}-interior`;
  const mountainId = `rl-${level}-${state}-mountain`;
  const mountainSideId = `rl-${level}-${state}-mountain-side`;
  const mountainShadowId = `rl-${level}-${state}-mountain-shadow`;
  const upperGlowId = `rl-${level}-${state}-upper-glow`;
  const mountainGlowId = `rl-${level}-${state}-mountain-glow`;
  const lowerFadeId = `rl-${level}-${state}-lower-fade`;
  const leftVignetteId = `rl-${level}-${state}-left-vignette`;
  const rightVignetteId = `rl-${level}-${state}-right-vignette`;
  const clipId = `rl-${level}-${state}-clip`;
  const titleY = compact ? 178 : 174;
  const titleSize = definition.titleUpper.length > 8 ? 15.2 : 18.2;

  return (
    <View
      style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}
      accessibilityLabel={runLevelBadgeAccessibilityLabel(level, state, remainingMeters, units)}
    >
      <Svg width={size} height={size} viewBox={`0 0 ${RUN_LEVEL_VIEWBOX} ${RUN_LEVEL_VIEWBOX}`}>
        <Defs>
          <ClipPath id={clipId}>
            <Path d={runLevelHexPath(0)} />
          </ClipPath>
          <LinearGradient id={edgeId} x1="70" y1="20" x2="188" y2="233" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={tokens.color.highlight} stopOpacity={0.96} />
            <Stop offset="0.42" stopColor={tokens.color.outer} stopOpacity={0.9} />
            <Stop offset="1" stopColor={tokens.color.shadow} stopOpacity={0.68} />
          </LinearGradient>
          <LinearGradient id={interiorId} x1="128" y1="24" x2="128" y2="231" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor="#111211" stopOpacity={tokens.baseOpacity} />
            <Stop offset="0.42" stopColor="#0D0E0E" stopOpacity={tokens.baseOpacity} />
            <Stop offset="1" stopColor="#050606" stopOpacity={tokens.baseOpacity} />
          </LinearGradient>
          <RadialGradient id={upperGlowId} cx="50%" cy="29%" r="62%">
            <Stop offset="0" stopColor={tokens.color.mid} stopOpacity={tokens.upperGlowOpacity} />
            <Stop offset="0.48" stopColor={tokens.color.outer} stopOpacity={tokens.upperGlowOpacity * 0.38} />
            <Stop offset="1" stopColor={tokens.color.shadow} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id={mountainGlowId} cx="50%" cy="45%" r="33%">
            <Stop offset="0" stopColor={tokens.color.highlight} stopOpacity={tokens.mountainGlowOpacity} />
            <Stop offset="0.52" stopColor={tokens.color.outer} stopOpacity={tokens.mountainGlowOpacity * 0.28} />
            <Stop offset="1" stopColor={tokens.color.outer} stopOpacity={0} />
          </RadialGradient>
          <LinearGradient id={lowerFadeId} x1="128" y1="118" x2="128" y2="238" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor="#050606" stopOpacity={0} />
            <Stop offset="0.62" stopColor="#050606" stopOpacity={tokens.lowerFadeOpacity * 0.64} />
            <Stop offset="1" stopColor="#050606" stopOpacity={tokens.lowerFadeOpacity} />
          </LinearGradient>
          <LinearGradient id={leftVignetteId} x1="28" y1="128" x2="122" y2="128" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor="#050606" stopOpacity={tokens.vignetteOpacity} />
            <Stop offset="1" stopColor="#050606" stopOpacity={0} />
          </LinearGradient>
          <LinearGradient id={rightVignetteId} x1="228" y1="128" x2="134" y2="128" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor="#050606" stopOpacity={tokens.vignetteOpacity} />
            <Stop offset="1" stopColor="#050606" stopOpacity={0} />
          </LinearGradient>
          <LinearGradient id={mountainId} x1="82" y1="86" x2="176" y2="146" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={tokens.color.highlight} stopOpacity={0.98} />
            <Stop offset="0.48" stopColor={tokens.color.outer} stopOpacity={0.92} />
            <Stop offset="1" stopColor={tokens.color.shadow} stopOpacity={0.82} />
          </LinearGradient>
          <LinearGradient id={mountainSideId} x1="104" y1="105" x2="178" y2="143" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={tokens.color.highlight} stopOpacity={0.62} />
            <Stop offset="0.5" stopColor={tokens.color.mid} stopOpacity={0.76} />
            <Stop offset="1" stopColor={tokens.color.shadow} stopOpacity={0.9} />
          </LinearGradient>
          <LinearGradient id={mountainShadowId} x1="82" y1="118" x2="190" y2="145" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={tokens.color.shadow} stopOpacity={0.44} />
            <Stop offset="0.62" stopColor="#090A0A" stopOpacity={0.62} />
            <Stop offset="1" stopColor={tokens.color.shadow} stopOpacity={0.36} />
          </LinearGradient>
          {runLevelRingInsets(definition).map((_, index) => (
            <LinearGradient key={index} id={`rl-${level}-${state}-ring-${index}`} x1="128" y1="28" x2="128" y2="178" gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor={tokens.color.highlight} stopOpacity={0.95} />
              <Stop offset="0.48" stopColor={tokens.color.outer} stopOpacity={0.78} />
              <Stop offset="1" stopColor={tokens.color.shadow} stopOpacity={0.28} />
            </LinearGradient>
          ))}
        </Defs>
        <Path d={runLevelHexPath(0)} fill={tokens.fill} fillOpacity={tokens.fillOpacity} stroke={`url(#${edgeId})`} strokeWidth={3.1} strokeLinejoin="round" strokeOpacity={tokens.outerOpacity} />
        <G clipPath={`url(#${clipId})`}>
          <Rect x={0} y={0} width={256} height={256} fill={state === 'share-transparent' ? 'transparent' : `url(#${interiorId})`} fillOpacity={tokens.innerFillOpacity} />
          <Rect x={0} y={0} width={256} height={256} fill="#050606" fillOpacity={tokens.transparentWashOpacity} />
          <Rect x={0} y={0} width={256} height={256} fill={`url(#${upperGlowId})`} />
          <Rect x={0} y={0} width={256} height={256} fill={`url(#${mountainGlowId})`} />
          <Rect x={0} y={0} width={256} height={256} fill={`url(#${leftVignetteId})`} />
          <Rect x={0} y={0} width={256} height={256} fill={`url(#${rightVignetteId})`} />
          <Rect x={0} y={0} width={256} height={256} fill={`url(#${lowerFadeId})`} />
        </G>
        <Path d={runLevelHexPath(7)} fill="none" stroke={tokens.color.highlight} strokeWidth={0.82} strokeOpacity={tokens.innerEdgeOpacity} />
        {runLevelRingInsets(definition).map((inset, index) => {
          const opacity = Math.max(0.16, tokens.ringOpacityBase - index * tokens.ringOpacityStep);
          const ringId = `rl-${level}-${state}-ring-${index}`;
          return (
            <G key={inset}>
              <Path
                d={runLevelRingPath(inset)}
                fill="none"
                stroke={`url(#${ringId})`}
                strokeWidth={index === 0 ? 3.12 : 2.72}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeOpacity={tokens.ringBloomOpacity}
              />
              <Path
                d={runLevelRingPath(inset)}
                fill="none"
                stroke={`url(#${ringId})`}
                strokeWidth={index === 0 ? 1.32 : 0.92}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeOpacity={opacity}
              />
            </G>
          );
        })}
        <Path d={RUN_LEVEL_MOUNTAIN.rearMass} fill={`url(#${mountainShadowId})`} opacity={tokens.mountainOpacity * 0.58} />
        <Path d={RUN_LEVEL_MOUNTAIN.leftRear} fill={`url(#${mountainShadowId})`} opacity={tokens.mountainOpacity * 0.7} />
        <Path d={RUN_LEVEL_MOUNTAIN.leftFace} fill={`url(#${mountainSideId})`} opacity={tokens.mountainOpacity * 0.88} />
        <Path d={RUN_LEVEL_MOUNTAIN.centerShadow} fill={`url(#${mountainShadowId})`} opacity={tokens.mountainOpacity * 0.78} />
        <Path d={RUN_LEVEL_MOUNTAIN.centerFace} fill={`url(#${mountainId})`} opacity={tokens.mountainOpacity} />
        <Path d={RUN_LEVEL_MOUNTAIN.centerHighlight} fill={`url(#${mountainSideId})`} opacity={tokens.mountainOpacity * 0.9} />
        <Path d={RUN_LEVEL_MOUNTAIN.rightRear} fill={`url(#${mountainShadowId})`} opacity={tokens.mountainOpacity * 0.74} />
        <Path d={RUN_LEVEL_MOUNTAIN.rightFace} fill={`url(#${mountainSideId})`} opacity={tokens.mountainOpacity * 0.72} />
        <Path d={RUN_LEVEL_MOUNTAIN.ridge} fill="none" stroke={tokens.color.highlight} strokeWidth={1.15} strokeLinecap="round" strokeLinejoin="round" strokeOpacity={tokens.mountainOpacity * 0.5} />
        {tokens.keylineOpacity > 0 ? (
          <SvgText
            x={128}
            y={titleY}
            textAnchor="middle"
            fontFamily="Avenir Next, Inter, Arial, sans-serif"
            fontSize={titleSize}
            fontWeight="500"
            letterSpacing={1.45}
            stroke="#050505"
            strokeWidth={2}
            strokeOpacity={tokens.keylineOpacity}
            fill="none"
          >
            {definition.titleUpper}
          </SvgText>
        ) : null}
        <SvgText
          x={128}
          y={titleY}
          textAnchor="middle"
          fontFamily="Avenir Next, Inter, Arial, sans-serif"
          fontSize={titleSize}
          fontWeight="500"
          letterSpacing={1.45}
          fill={state === 'locked' ? RUN_LEVEL_LOCKED_GRAY : tokens.color.highlight}
          fillOpacity={tokens.titleOpacity}
        >
          {definition.titleUpper}
        </SvgText>
        {compact ? null : (
          <>
            <SvgText
              x={128}
              y={195}
              textAnchor="middle"
              fontFamily="Avenir Next, Inter, Arial, sans-serif"
              fontSize={8.8}
              fontWeight="700"
              letterSpacing={3.4}
              fill={state === 'locked' ? RUN_LEVEL_LOCKED_GRAY : '#F3F1EB'}
              fillOpacity={tokens.wordmarkOpacity}
            >
              STRIDEOS
            </SvgText>
            <Path d="M105 211 L128 223 L151 211" fill="none" stroke={state === 'locked' ? RUN_LEVEL_LOCKED_GRAY : tokens.color.outer} strokeWidth={2.05} strokeLinecap="round" strokeLinejoin="round" strokeOpacity={tokens.chevronOpacity} />
            <Path d="M109 221 L128 231 L147 221" fill="none" stroke={state === 'locked' ? RUN_LEVEL_LOCKED_GRAY : tokens.color.highlight} strokeWidth={2.05} strokeLinecap="round" strokeLinejoin="round" strokeOpacity={tokens.chevronOpacity} />
          </>
        )}
      </Svg>
    </View>
  );
}
