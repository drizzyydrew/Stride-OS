import { View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, Ellipse, LinearGradient, Path, Stop, Text as SvgText } from 'react-native-svg';

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
  const titleY = compact ? 178 : 174;

  return (
    <View
      style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}
      accessibilityLabel={runLevelBadgeAccessibilityLabel(level, state, remainingMeters, units)}
    >
      <Svg width={size} height={size} viewBox={`0 0 ${RUN_LEVEL_VIEWBOX} ${RUN_LEVEL_VIEWBOX}`}>
        <Defs>
          <LinearGradient id={edgeId} x1="42" y1="34" x2="214" y2="220" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={tokens.color.highlight} />
            <Stop offset="0.54" stopColor={tokens.color.outer} />
            <Stop offset="1" stopColor={tokens.color.shadow} />
          </LinearGradient>
          <LinearGradient id={interiorId} x1="128" y1="24" x2="128" y2="231" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={tokens.color.mid} stopOpacity={state === 'locked' ? 0.12 : state === 'share-transparent' ? 0 : 0.34} />
            <Stop offset="0.46" stopColor="#0D0E0E" stopOpacity={state === 'share-transparent' ? 0 : 0.96} />
            <Stop offset="1" stopColor="#080909" stopOpacity={state === 'share-transparent' ? 0 : 1} />
          </LinearGradient>
          <LinearGradient id={mountainId} x1="82" y1="86" x2="176" y2="146" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={tokens.color.highlight} />
            <Stop offset="0.48" stopColor={tokens.color.outer} />
            <Stop offset="1" stopColor={tokens.color.shadow} />
          </LinearGradient>
        </Defs>
        <Path d={runLevelHexPath(0)} fill={tokens.fill} fillOpacity={tokens.fillOpacity} stroke={`url(#${edgeId})`} strokeWidth={4.8} strokeLinejoin="round" strokeOpacity={tokens.outerOpacity} />
        <Path
          d={runLevelHexPath(7)}
          fill={state === 'share-transparent' ? 'transparent' : `url(#${interiorId})`}
          fillOpacity={tokens.innerFillOpacity}
          stroke={tokens.color.highlight}
          strokeWidth={1}
          strokeOpacity={tokens.outerOpacity * 0.55}
        />
        <Path d="M44 70 L128 23 L212 70" stroke={tokens.color.highlight} strokeWidth={1.15} strokeOpacity={tokens.outerOpacity * 0.28} />
        {runLevelRingInsets(definition).map((inset, index) => {
          const opacity = Math.max(0.16, tokens.ringOpacityBase - index * tokens.ringOpacityStep);
          const stroke = index % 3 === 0 ? tokens.color.highlight : index % 2 === 0 ? tokens.color.mid : tokens.color.outer;
          return (
            <Path
              key={inset}
              d={runLevelRingPath(inset)}
              fill="none"
              stroke={stroke}
              strokeWidth={index === 0 ? 2.4 : index < 3 ? 1.65 : 1.25}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeOpacity={opacity}
            />
          );
        })}
        <Ellipse cx={128} cy={129} rx={68} ry={31} fill={tokens.color.glow} opacity={tokens.glowOpacity} />
        <Path d={RUN_LEVEL_MOUNTAIN.back} fill={tokens.color.shadow} opacity={tokens.mountainOpacity * 0.52} />
        <Path d={RUN_LEVEL_MOUNTAIN.mainLeft} fill={`url(#${mountainId})`} opacity={tokens.mountainOpacity} />
        <Path d={RUN_LEVEL_MOUNTAIN.mainRight} fill={tokens.color.mid} opacity={tokens.mountainOpacity * 0.92} />
        <Path d={RUN_LEVEL_MOUNTAIN.centralCut} fill={tokens.color.highlight} opacity={tokens.mountainOpacity * 0.82} />
        <Path d={RUN_LEVEL_MOUNTAIN.leftCut} fill={tokens.color.shadow} opacity={tokens.mountainOpacity * 0.78} />
        <Path d={RUN_LEVEL_MOUNTAIN.rightCut} fill={tokens.color.highlight} opacity={tokens.mountainOpacity * 0.48} />
        <Path d={RUN_LEVEL_MOUNTAIN.ridge} fill="none" stroke={tokens.color.highlight} strokeWidth={2.05} strokeLinecap="round" strokeLinejoin="round" strokeOpacity={tokens.mountainOpacity * 0.7} />
        {tokens.keylineOpacity > 0 ? (
          <SvgText
            x={128}
            y={titleY}
            textAnchor="middle"
            fontFamily="Avenir Next, Inter, Arial, sans-serif"
            fontSize={definition.titleUpper.length > 8 ? 17 : 21}
            fontWeight="700"
            letterSpacing={1.15}
            stroke="#050505"
            strokeWidth={3}
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
          fontSize={definition.titleUpper.length > 8 ? 17 : 21}
          fontWeight="700"
          letterSpacing={1.15}
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
              fontSize={10}
              fontWeight="800"
              letterSpacing={3.2}
              fill={state === 'locked' ? RUN_LEVEL_LOCKED_GRAY : '#F3F1EB'}
              fillOpacity={tokens.wordmarkOpacity}
            >
              STRIDEOS
            </SvgText>
            <Path d="M103 210 L128 224 L153 210" fill="none" stroke={state === 'locked' ? RUN_LEVEL_LOCKED_GRAY : tokens.color.outer} strokeWidth={3.3} strokeLinecap="round" strokeLinejoin="round" strokeOpacity={tokens.chevronOpacity} />
            <Path d="M107 221 L128 233 L149 221" fill="none" stroke={state === 'locked' ? RUN_LEVEL_LOCKED_GRAY : tokens.color.highlight} strokeWidth={3.3} strokeLinecap="round" strokeLinejoin="round" strokeOpacity={tokens.chevronOpacity} />
          </>
        )}
      </Svg>
    </View>
  );
}
