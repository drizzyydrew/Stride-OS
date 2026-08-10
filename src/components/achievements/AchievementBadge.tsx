import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Polygon, Polyline, Rect, Stop } from 'react-native-svg';

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
  training_quality: { base: '#4E6A87', accent: '#F3F1EB', pop: '#DCC9B1', ink: '#0E0E0F', glow: '#A8B9A1' },
  challenge: { base: '#6F816E', accent: '#DCC9B1', pop: '#F3F1EB', ink: '#10100F', glow: '#4E6A87' },
  stride_level: { base: '#0E0E0F', accent: '#A8B9A1', pop: '#DCC9B1', ink: '#F3F1EB', glow: '#2D4256' },
};

const SIZE = {
  small: 58,
  medium: 78,
  large: 156,
};

function categoryFor(id: AchievementId, category?: AchievementCategory): AchievementCategory {
  if (category) return category;
  if (id.startsWith('pr_')) return 'personal_record';
  if (id.startsWith('monthly_')) return 'monthly_distance';
  if (id.startsWith('challenge_')) return 'challenge';
  if (id.startsWith('stride_level_')) return 'stride_level';
  if (id.includes('consistency') || id.includes('training_days')) return 'consistency';
  if (id.includes('easy') || id.includes('quality') || id.includes('deload') || id.includes('strength')) return 'training_quality';
  return 'healthy_progress';
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
