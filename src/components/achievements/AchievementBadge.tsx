import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Polygon, Polyline, Rect, Stop, Text as SvgText } from 'react-native-svg';

import { STREAK_ACHIEVEMENTS } from '../../utils/achievements';
import type { AchievementCategory, AchievementId } from '../../utils/achievements';

type AchievementBadgeTone = {
  base: string;
  accent: string;
  pop: string;
  ink: string;
  glow: string;
};

export type AchievementBadgeSize = 'small' | 'medium' | 'large';

type Props = {
  id: AchievementId;
  category?: AchievementCategory;
  earned?: boolean;
  size?: AchievementBadgeSize;
};

const TONES: Record<AchievementCategory, AchievementBadgeTone> = {
  healthy_progress: { base: '#DCC9B1', accent: '#6F816E', pop: '#2D4256', ink: '#10100F', glow: '#F3F1EB' },
  personal_record: { base: '#0E0E0F', accent: '#DCC9B1', pop: '#E08A5C', ink: '#F3F1EB', glow: '#4E6A87' },
  monthly_distance: { base: '#2D4256', accent: '#A8B9A1', pop: '#DCC9B1', ink: '#F3F1EB', glow: '#6F816E' },
  consistency: { base: '#A8B9A1', accent: '#2D4256', pop: '#F3F1EB', ink: '#0E0E0F', glow: '#DCC9B1' },
  streak: { base: '#0E0E0F', accent: '#DCC9B1', pop: '#F29A20', ink: '#F3F1EB', glow: '#FFF1BA' },
  training_quality: { base: '#4E6A87', accent: '#F3F1EB', pop: '#DCC9B1', ink: '#0E0E0F', glow: '#A8B9A1' },
  challenge: { base: '#6F816E', accent: '#DCC9B1', pop: '#F3F1EB', ink: '#10100F', glow: '#4E6A87' },
  stride_level: { base: '#0E0E0F', accent: '#A8B9A1', pop: '#DCC9B1', ink: '#F3F1EB', glow: '#2D4256' },
  cumulative_elevation: { base: '#0E0E0F', accent: '#DCC9B1', pop: '#4E6A87', ink: '#F3F1EB', glow: '#6F816E' },
};

const SIZE = {
  small: 58,
  medium: 78,
  large: 156,
};

const STREAK_HEAT: Record<string, {
  outer: string;
  mid: string;
  core: string;
  ring: string;
  glow: string;
  ink: string;
  ringCount: number;
}> = {
  streak_3_day: { outer: '#421010', mid: '#7A1717', core: '#B43A28', ring: '#7A1717', glow: '#2A0B0B', ink: '#F3D0BC', ringCount: 1 },
  streak_1_week: { outer: '#65110F', mid: '#B3221C', core: '#D9551D', ring: '#B3221C', glow: '#541313', ink: '#F7D8C0', ringCount: 2 },
  streak_30_day: { outer: '#8F2513', mid: '#D9551D', core: '#F29A20', ring: '#D9551D', glow: '#792113', ink: '#FFE0B0', ringCount: 2 },
  streak_50_day: { outer: '#B84C14', mid: '#F29A20', core: '#FFD449', ring: '#F29A20', glow: '#9A3E11', ink: '#FFF0C7', ringCount: 3 },
  streak_60_day: { outer: '#D98216', mid: '#FFD449', core: '#FFF1BA', ring: '#FFD449', glow: '#B76A12', ink: '#17120B', ringCount: 3 },
  streak_90_day: { outer: '#E8BB63', mid: '#FFF1BA', core: '#FFFDF3', ring: '#FFF1BA', glow: '#C99C50', ink: '#17120B', ringCount: 3 },
  streak_6_month: { outer: '#F2DFB8', mid: '#FFFDF3', core: '#FFFFFF', ring: '#FFFDF3', glow: '#DCC9B1', ink: '#11100E', ringCount: 4 },
};

const HEX_POINTS = [
  '56,5 100,31 100,81 56,107 12,81 12,31',
  '56,13 93,35 93,77 56,99 19,77 19,35',
  '56,21 86,39 86,73 56,91 26,73 26,39',
  '56,29 79,43 79,69 56,83 33,69 33,43',
];

function categoryFor(id: AchievementId, category?: AchievementCategory): AchievementCategory {
  if (category) return category;
  if (id.startsWith('pr_')) return 'personal_record';
  if (id.startsWith('monthly_')) return 'monthly_distance';
  if (id.startsWith('challenge_')) return 'challenge';
  if (id.startsWith('stride_level_')) return 'stride_level';
  if (id.startsWith('elevation_')) return 'cumulative_elevation';
  if (id.startsWith('streak_')) return 'streak';
  if (id.includes('consistency') || id.includes('training_days')) return 'consistency';
  if (id.includes('easy') || id.includes('quality') || id.includes('deload') || id.includes('strength')) return 'training_quality';
  return 'healthy_progress';
}

function StreakBadge({ id, earned, box }: { id: AchievementId; earned: boolean; box: number }) {
  const definition = STREAK_ACHIEVEMENTS.find(item => item.id === id);
  const heat = STREAK_HEAT[id] ?? STREAK_HEAT.streak_3_day;
  const locked = !earned;
  const flameId = `streak-flame-${id}-${locked ? 'locked' : 'earned'}`;
  const fillId = `streak-fill-${id}-${locked ? 'locked' : 'earned'}`;
  const ringColor = locked ? '#6F6A61' : heat.ring;
  const coreColor = locked ? '#C7BBA9' : heat.core;
  const midColor = locked ? '#7F756A' : heat.mid;
  const outerColor = locked ? '#393530' : heat.outer;
  const ink = locked ? '#D8D0C1' : heat.ink;
  const ringOpacity = locked ? 0.42 : 0.88;
  const glowOpacity = locked ? 0.12 : 0.32 + Math.min(0.22, (definition?.tier ?? 1) * 0.025);
  const rings = HEX_POINTS.slice(0, heat.ringCount);

  return (
    <View style={[styles.wrap, { width: box, height: box }]} accessibilityLabel={`${definition?.displayName ?? 'Streak'} achievement badge`}>
      <Svg width={box} height={box} viewBox="0 0 112 112">
        <Defs>
          <LinearGradient id={fillId} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#080808" />
            <Stop offset="0.62" stopColor="#11100E" />
            <Stop offset="1" stopColor={locked ? '#201D1A' : '#211712'} />
          </LinearGradient>
          <LinearGradient id={flameId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={coreColor} />
            <Stop offset="0.48" stopColor={midColor} />
            <Stop offset="1" stopColor={outerColor} />
          </LinearGradient>
        </Defs>
        <Polygon points={HEX_POINTS[0]} fill={`url(#${fillId})`} stroke={ringColor} strokeWidth="2.8" opacity={locked ? 0.72 : 1} />
        <Polygon points="56,10 95,33 95,79 56,102 17,79 17,33" fill="#0E0E0F" opacity={locked ? 0.8 : 0.93} />
        <Circle cx="56" cy="58" r="34" fill={locked ? '#28241F' : heat.glow} opacity={glowOpacity} />
        {rings.map((points, index) => (
          <Polygon
            key={points}
            points={points}
            fill="none"
            stroke={index === 0 ? ringColor : index === rings.length - 1 ? coreColor : '#DCC9B1'}
            strokeWidth={index === 0 ? 2.1 : 1.15}
            opacity={Math.max(0.22, ringOpacity - index * 0.15)}
          />
        ))}
        <Path
          d="M56 18 C47 31 39 41 39 58 C39 73 48 83 56 91 C64 83 74 74 75 59 C76 47 69 39 66 29 C62 36 59 40 58 46 C54 37 59 27 56 18 Z"
          fill={`url(#${flameId})`}
          opacity={locked ? 0.64 : 1}
        />
        <Path
          d="M56 43 C50 52 47 60 49 68 C51 76 56 81 56 81 C61 76 65 70 65 63 C65 56 61 51 59 45 C57 49 56 53 56 57 C53 52 55 47 56 43 Z"
          fill={coreColor}
          opacity={locked ? 0.56 : 0.95}
        />
        <SvgText
          x="56"
          y="77"
          textAnchor="middle"
          fontSize={definition?.badgeText === '6M' ? 18 : 20}
          fontWeight="900"
          fill={ink}
          stroke="#0E0E0F"
          strokeWidth={0.7}
        >
          {definition?.badgeText ?? ''}
        </SvgText>
      </Svg>
    </View>
  );
}

function motifFor(id: AchievementId, category: AchievementCategory): 'track' | 'mountain' | 'moon' | 'bolt' | 'path' | 'rings' | 'flag' {
  if (id.includes('elevation') || id.includes('climb')) return 'mountain';
  if (id.includes('recovery') || id.includes('deload') || id.includes('easy')) return 'moon';
  if (id.includes('fastest') || id.includes('quality') || id.includes('strides')) return 'bolt';
  if (category === 'monthly_distance' || category === 'stride_level') return 'path';
  if (category === 'consistency') return 'rings';
  if (category === 'challenge') return 'flag';
  return 'track';
}

function titleMark(id: AchievementId): string {
  if (id.includes('10k')) return '10';
  if (id.includes('5k')) return '5';
  if (id.includes('1k')) return '1';
  if (id.includes('200k')) return '200';
  if (id.includes('175k')) return '175';
  if (id.includes('150k')) return '150';
  if (id.includes('125k')) return '125';
  if (id.includes('100k')) return '100';
  if (id.includes('75k')) return '75';
  if (id.includes('50k')) return '50';
  if (id.includes('25k')) return '25';
  if (id.includes('starter')) return 'I';
  if (id.includes('pacesetter')) return 'II';
  if (id.includes('builder')) return 'III';
  if (id.includes('endurer')) return 'IV';
  if (id.includes('advancer')) return 'V';
  if (id.includes('elite')) return 'VI';
  if (id.includes('icon')) return 'VII';
  if (id.startsWith('elevation_')) return 'MT';
  return '>>';
}

function BadgeMotif({ id, category, tone }: { id: AchievementId; category: AchievementCategory; tone: AchievementBadgeTone }) {
  const motif = motifFor(id, category);
  if (motif === 'mountain') {
    return (
      <>
        <Path d="M22 72 L43 38 L56 57 L68 44 L92 72 Z" fill={tone.pop} opacity={0.95} />
        <Path d="M43 38 L50 52 L37 52 Z" fill={tone.glow} opacity={0.9} />
        <Polyline points="21,78 38,74 52,80 68,74 91,79" stroke={tone.accent} strokeWidth={5} strokeLinecap="round" fill="none" />
      </>
    );
  }
  if (motif === 'moon') {
    return (
      <>
        <Circle cx="55" cy="54" r="28" fill={tone.pop} />
        <Circle cx="66" cy="43" r="28" fill={tone.base} />
        <Polyline points="26,76 42,68 58,76 76,68 91,76" stroke={tone.accent} strokeWidth={5} strokeLinecap="round" fill="none" />
      </>
    );
  }
  if (motif === 'bolt') {
    return (
      <>
        <Polygon points="57,19 31,61 53,58 45,93 83,46 60,50" fill={tone.pop} />
        <Polyline points="18,78 30,72 42,78 54,72 66,78 78,72 90,78" stroke={tone.accent} strokeWidth={4} strokeLinecap="round" fill="none" />
      </>
    );
  }
  if (motif === 'path') {
    return (
      <>
        <Path d="M25 84 C34 54, 55 77, 54 45 C53 25, 84 26, 88 45" stroke={tone.pop} strokeWidth={8} strokeLinecap="round" fill="none" />
        <Circle cx="26" cy="84" r="6" fill={tone.accent} />
        <Circle cx="88" cy="45" r="6" fill={tone.accent} />
        <Polyline points="27,28 43,28 59,28 75,28 91,28" stroke={tone.glow} strokeWidth={4} strokeLinecap="round" fill="none" opacity={0.9} />
      </>
    );
  }
  if (motif === 'rings') {
    return (
      <>
        <Circle cx="39" cy="56" r="20" stroke={tone.pop} strokeWidth={7} fill="none" />
        <Circle cx="70" cy="56" r="20" stroke={tone.accent} strokeWidth={7} fill="none" />
        <Polyline points="28,84 42,78 56,84 70,78 84,84" stroke={tone.glow} strokeWidth={5} strokeLinecap="round" fill="none" />
      </>
    );
  }
  if (motif === 'flag') {
    return (
      <>
        <Path d="M34 85 V26" stroke={tone.ink} strokeWidth={6} strokeLinecap="round" />
        <Path d="M37 28 C53 20, 66 38, 83 29 V62 C66 71, 52 52, 37 61 Z" fill={tone.pop} />
        <Polyline points="22,86 38,78 54,86 70,78 88,86" stroke={tone.accent} strokeWidth={5} strokeLinecap="round" fill="none" />
      </>
    );
  }
  return (
    <>
      <Path d="M23 75 C31 39, 78 39, 88 75" stroke={tone.pop} strokeWidth={8} strokeLinecap="round" fill="none" />
      <Path d="M33 75 C39 54, 72 54, 78 75" stroke={tone.accent} strokeWidth={5} strokeLinecap="round" fill="none" />
      <Circle cx="23" cy="75" r="5" fill={tone.glow} />
      <Circle cx="88" cy="75" r="5" fill={tone.glow} />
    </>
  );
}

export default function AchievementBadge({ id, category, earned = true, size = 'medium' }: Props) {
  const resolvedCategory = categoryFor(id, category);
  const tone = TONES[resolvedCategory];
  const dimmed = !earned;
  const box = SIZE[size];

  if (resolvedCategory === 'streak') {
    return <StreakBadge id={id} earned={earned} box={box} />;
  }

  return (
    <View
      style={[
        styles.wrap,
        { width: box, height: box, opacity: dimmed ? 0.45 : 1 },
      ]}
      accessibilityLabel={`${titleMark(id)} achievement badge`}
    >
      <Svg width={box} height={box} viewBox="0 0 112 112">
        <Defs>
          <LinearGradient id={`badge-${id}`} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={tone.base} />
            <Stop offset="0.58" stopColor={tone.glow} />
            <Stop offset="1" stopColor={tone.accent} />
          </LinearGradient>
        </Defs>
        <Rect x="7" y="7" width="98" height="98" rx="23" fill={`url(#badge-${id})`} />
        <Rect x="13" y="13" width="86" height="86" rx="18" fill={tone.base} opacity={0.74} />
        <Polyline points="21,21 30,21 39,21 48,21 57,21" stroke={tone.accent} strokeWidth={5} strokeLinecap="round" />
        <BadgeMotif id={id} category={resolvedCategory} tone={tone} />
      </Svg>
      {size !== 'small' ? (
        <Text style={[styles.mark, { color: tone.ink }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.55}>
          {titleMark(id)}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  mark: {
    position: 'absolute',
    bottom: 12,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0,
  },
});
