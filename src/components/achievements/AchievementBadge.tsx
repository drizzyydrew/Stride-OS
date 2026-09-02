import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Polygon, Polyline, Rect, Stop, Text as SvgText } from 'react-native-svg';

import {
  LifetimeDistanceCyclingBadge,
  lifetimeDistanceCyclingDefinitionFromAchievementId,
  type LifetimeDistanceCyclingBadgeState,
} from '../../achievements/lifetimeDistanceCycling';
import {
  LifetimeDistanceRunningBadge,
  lifetimeDistanceRunningDefinitionFromAchievementId,
  type LifetimeDistanceRunningBadgeState,
} from '../../achievements/lifetimeDistanceRunning';
import { RunLevelBadge as CanonicalRunLevelBadge, runLevelSlugFromId } from '../../achievements/runLevels';
import {
  WeeklyDistanceBadge,
  weeklyDistanceDefinitionFromAchievementId,
  type WeeklyDistanceBadgeState,
} from '../../achievements/weeklyDistance';
import {
  MonthlyDistanceBadge,
  monthlyDistanceDefinitionFromAchievementId,
  type MonthlyDistanceBadgeState,
} from '../../achievements/monthlyDistance';
import {
  StreakBadge as CanonicalStreakBadge,
  streakDefinitionFromAchievementId,
  type StreakBadgeState,
} from '../../achievements/streaks';
import {
  FirstAchievementBadge,
  firstAchievementDefinitionFromAchievementId,
  type FirstAchievementBadgeState,
} from '../../achievements/firsts';
import {
  StrengthAchievementBadge,
  strengthAchievementDefinitionFromAchievementId,
  type StrengthAchievementBadgeState,
} from '../../achievements/strength';
import {
  RecoveryAchievementBadge,
  recoveryAchievementDefinitionFromAchievementId,
  type RecoveryAchievementBadgeState,
} from '../../achievements/recovery';
import type { UnitSystem } from '../../store/settingsStore';
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
  unitSystem?: UnitSystem;
  badgeState?: LifetimeDistanceRunningBadgeState | LifetimeDistanceCyclingBadgeState | WeeklyDistanceBadgeState | MonthlyDistanceBadgeState | StreakBadgeState | FirstAchievementBadgeState | StrengthAchievementBadgeState | RecoveryAchievementBadgeState;
  remainingDays?: number;
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
  firsts: { base: '#0E0E0F', accent: '#B7835F', pop: '#DCC9B1', ink: '#F3F1EB', glow: '#2E2620' },
  run_level: { base: '#0E0E0F', accent: '#DCC9B1', pop: '#F3F1EB', ink: '#F3F1EB', glow: '#6F816E' },
  lifetime_distance: { base: '#0E0E0F', accent: '#4E8AAE', pop: '#DCC9B1', ink: '#F3F1EB', glow: '#2E9A98' },
  lifetime_running: { base: '#0E0E0F', accent: '#4E8AAE', pop: '#DCC9B1', ink: '#F3F1EB', glow: '#2E9A98' },
  lifetime_cycling: { base: '#0E0E0F', accent: '#657DB5', pop: '#DCC9B1', ink: '#F3F1EB', glow: '#8B4FA3' },
  weekly_distance: { base: '#0E0E0F', accent: '#5F7998', pop: '#F3F1EB', ink: '#F3F1EB', glow: '#DCC9B1' },
  elevation: { base: '#0E0E0F', accent: '#DCC9B1', pop: '#4E6A87', ink: '#F3F1EB', glow: '#6F816E' },
  strength: { base: '#0E0E0F', accent: '#94A0A6', pop: '#DCC9B1', ink: '#F3F1EB', glow: '#2D4256' },
  recovery: { base: '#0E0E0F', accent: '#8B9C7C', pop: '#C8D6BE', ink: '#F3F1EB', glow: '#2E9A98' },
  challenges: { base: '#0E0E0F', accent: '#D99A38', pop: '#F3F1EB', ink: '#F3F1EB', glow: '#C56B3E' },
};

const SIZE = {
  small: 58,
  medium: 78,
  large: 156,
};

const HEX_POINTS = [
  '56,5 100,31 100,81 56,107 12,81 12,31',
  '56,13 93,35 93,77 56,99 19,77 19,35',
  '56,21 86,39 86,73 56,91 26,73 26,39',
  '56,29 79,43 79,69 56,83 33,69 33,43',
];

function categoryFor(id: AchievementId, category?: AchievementCategory): AchievementCategory {
  if (category) return category;
  if (id === 'first_strength_session') return 'strength';
  if (id.startsWith('first_')) return 'firsts';
  if (id.startsWith('run_level_')) return 'run_level';
  if (id.startsWith('lifetime_run_')) return 'lifetime_running';
  if (id.startsWith('lifetime_cycle_')) return 'lifetime_cycling';
  if (id.startsWith('weekly_')) return 'weekly_distance';
  if (id.startsWith('strength_') || id === 'prehab_resilience_block') return 'strength';
  if (id.startsWith('recovery_')) return 'recovery';
  if (id.startsWith('challenge_')) return 'challenges';
  if (id.startsWith('pr_')) return 'personal_record';
  if (id.startsWith('monthly_')) return 'monthly_distance';
  if (id.startsWith('stride_level_')) return 'stride_level';
  if (id.startsWith('elevation_')) return 'cumulative_elevation';
  if (id.startsWith('streak_')) return 'streak';
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
  if (id.includes('half_marathon')) return '13.1';
  if (id.includes('marathon')) return '26.2';
  if (id.includes('movement_lab')) return 'LAB';
  if (id.includes('route')) return 'PIN';
  if (id.includes('structured')) return 'PLAN';
  if (id.includes('adapted')) return 'ADAPT';
  if (id.includes('treadmill')) return 'TM';
  if (id.includes('run_walk')) return 'R/W';
  if (id.includes('strength_100') || id.includes('100_sessions')) return '100';
  if (id.includes('strength_50') || id.includes('50_sessions')) return '50';
  if (id.includes('strength_25') || id.includes('25_sessions')) return '25';
  if (id.includes('strength_10') || id.includes('10_sessions')) return '10';
  if (id.includes('12_weeks')) return '12';
  if (id.includes('6_weeks')) return '6';
  if (id.includes('weekly_150k') || id.includes('150k')) return '150';
  if (id.includes('weekly_100k') || id.includes('100k')) return '100';
  if (id.includes('weekly_75k') || id.includes('75k')) return '75';
  if (id.includes('weekly_50k') || id.includes('50k')) return '50';
  if (id.includes('weekly_30k') || id.includes('30k')) return '30';
  if (id.includes('weekly_25k') || id.includes('25k')) return '25';
  if (id.includes('weekly_15k') || id.includes('15k')) return '15';
  if (id.includes('10k')) return '10';
  if (id.includes('5k')) return '5';
  const lifetime = id.match(/lifetime_(?:run|cycle)_([0-9_]+)_mi/);
  if (lifetime) return lifetime[1].replace('_', '.');
  if (id === 'first_run') return 'RUN';
  if (id === 'first_walk') return 'WALK';
  if (id === 'first_ride') return 'RIDE';
  if (id === 'first_activity') return '>>';
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

function levelTier(id: AchievementId): number {
  return ['foundation', 'rhythm', 'momentum', 'durability', 'engine', 'peak', 'summit']
    .findIndex(item => id.includes(item)) + 1 || 1;
}

function LegacyStrideLevelBadge({ id, earned, box }: { id: AchievementId; earned: boolean; box: number }) {
  const tier = levelTier(id);
  const ring = earned ? ['#F3F1EB', '#B7835F', '#8B9C7C', '#94A0A6', '#5F7998', '#6E4B36', '#DCC9B1'][tier - 1] ?? '#DCC9B1' : '#6F6A61';
  const opacity = earned ? 1 : 0.42;
  return (
    <View style={[styles.wrap, { width: box, height: box, opacity: earned ? 1 : 0.55 }]} accessibilityLabel={`StrideOS run level ${tier} badge`}>
      <Svg width={box} height={box} viewBox="0 0 112 112">
        <Polygon points={HEX_POINTS[0]} fill="#0A0A0A" stroke={ring} strokeWidth="2.4" opacity={opacity} />
        {HEX_POINTS.slice(1, Math.min(4, tier)).map((points, index) => (
          <Polygon key={points} points={points} fill="none" stroke={index === tier - 2 ? '#F3F1EB' : ring} strokeWidth="1.15" opacity={Math.max(0.2, opacity - index * 0.12)} />
        ))}
        <Path d="M31 70 L47 49 L56 61 L66 43 L84 70 Z" fill="none" stroke={ring} strokeWidth="2.2" opacity={opacity} />
        <SvgText x="56" y="61" textAnchor="middle" fontSize="11" fontWeight="900" fill={earned ? '#F3F1EB' : '#BDB5A9'} letterSpacing="1.1">STRIDEOS</SvgText>
        <Polyline points="44,72 50,76 44,80 54,80 60,76 54,72 64,72 70,76 64,80" stroke={ring} strokeWidth="2" fill="none" opacity={opacity} />
      </Svg>
    </View>
  );
}

function DiamondBadge({ id, category, tone, earned, box }: { id: AchievementId; category: AchievementCategory; tone: AchievementBadgeTone; earned: boolean; box: number }) {
  const mark = titleMark(id);
  const ring = earned ? tone.accent : '#6F6A61';
  const pop = earned ? tone.glow : '#8B8378';
  return (
    <View style={[styles.wrap, { width: box, height: box, opacity: earned ? 1 : 0.5 }]} accessibilityLabel={`${mark} lifetime distance badge`}>
      <Svg width={box} height={box} viewBox="0 0 112 112">
        <Defs>
          <LinearGradient id={`diamond-${id}`} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={earned ? tone.accent : '#514D47'} />
            <Stop offset="0.55" stopColor={earned ? tone.glow : '#2E2B27'} />
            <Stop offset="1" stopColor={earned ? tone.pop : '#6F6A61'} />
          </LinearGradient>
        </Defs>
        <Polygon points="56,5 107,56 56,107 5,56" fill="#0A0A0A" stroke={`url(#diamond-${id})`} strokeWidth="2.2" opacity={earned ? 1 : 0.62} />
        {category === 'lifetime_cycling' ? <Polygon points="56,19 93,56 56,93 19,56" fill="none" stroke={ring} strokeWidth="1.2" opacity={0.52} /> : null}
        <Path d="M25 72 C37 51, 50 80, 61 52 C70 31, 82 50, 88 35" stroke={pop} strokeWidth="3.4" strokeLinecap="round" fill="none" opacity={earned ? 0.72 : 0.28} />
        <SvgText x="56" y="55" textAnchor="middle" fontSize={mark.length > 4 ? 18 : 25} fontWeight="900" fill={earned ? '#F3F1EB' : '#CFC6BA'}>{mark}</SvgText>
        <SvgText x="56" y="70" textAnchor="middle" fontSize="8" fontWeight="900" fill={ring}>MI</SvgText>
        <Polyline points="44,84 50,88 44,92 54,92 60,88 54,84 64,84 70,88 64,92" stroke={ring} strokeWidth="1.7" fill="none" opacity={earned ? 0.9 : 0.38} />
      </Svg>
    </View>
  );
}

function OriginalHexBadge({ id, category, tone, earned, box, size }: { id: AchievementId; category: AchievementCategory; tone: AchievementBadgeTone; earned: boolean; box: number; size: AchievementBadgeSize }) {
  const mark = titleMark(id);
  const ring = earned ? tone.accent : '#6F6A61';
  const pop = earned ? tone.pop : '#8B8378';
  const muted = earned ? tone.glow : '#3A3732';
  const showMark = category !== 'recovery' && category !== 'firsts';
  return (
    <View style={[styles.wrap, { width: box, height: box, opacity: earned ? 1 : 0.5 }]} accessibilityLabel={`${mark} achievement badge`}>
      <Svg width={box} height={box} viewBox="0 0 112 112">
        <Polygon points={HEX_POINTS[0]} fill="#0A0A0A" stroke={ring} strokeWidth="2.2" opacity={earned ? 1 : 0.56} />
        <Polygon points={HEX_POINTS[1]} fill="none" stroke={muted} strokeWidth="1.1" opacity={earned ? 0.45 : 0.22} />
        {category === 'strength' ? (
          <>
            <Path d="M25 48 H33 M79 48 H87 M35 39 V57 M42 35 V61 M70 35 V61 M77 39 V57 M42 48 H70" stroke={pop} strokeWidth="4" strokeLinecap="round" />
            <SvgText x="56" y="76" textAnchor="middle" fontSize={mark.length > 2 ? 13 : 22} fontWeight="900" fill="#F3F1EB">{mark}</SvgText>
          </>
        ) : category === 'recovery' ? (
          <>
            <Path d="M30 73 C43 49, 55 81, 69 49 C74 38, 82 36, 88 42" stroke={pop} strokeWidth="5" strokeLinecap="round" fill="none" />
            <Circle cx="38" cy="37" r="10" fill={ring} opacity={0.8} />
            <Polyline points="53,31 60,25 67,31 60,37 53,31" stroke={muted} strokeWidth="2" fill="none" />
          </>
        ) : category === 'challenges' ? (
          <>
            <Path d="M31 78 C40 39, 74 39, 83 78" stroke={pop} strokeWidth="7" strokeLinecap="round" fill="none" />
            <Circle cx="57" cy="50" r="16" fill={ring} opacity={0.52} />
            <SvgText x="56" y="77" textAnchor="middle" fontSize={mark.length > 3 ? 10 : 15} fontWeight="900" fill="#F3F1EB">{mark}</SvgText>
          </>
        ) : category === 'firsts' ? (
          <>
            <Path d="M33 75 C42 45, 68 43, 80 25" stroke={pop} strokeWidth="4" strokeLinecap="round" fill="none" />
            <Circle cx="33" cy="75" r="5" fill={ring} />
            <Path d="M74 25 L83 24 L80 33" stroke={ring} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            <SvgText x="56" y="78" textAnchor="middle" fontSize={mark.length > 4 ? 9 : 12} fontWeight="900" fill="#F3F1EB">{mark}</SvgText>
          </>
        ) : (
          <BadgeMotif id={id} category={category} tone={{ ...tone, accent: ring, pop }} />
        )}
      </Svg>
      {showMark && size !== 'small' ? (
        <Text style={[styles.mark, { color: earned ? tone.ink : '#CFC6BA' }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.55}>
          {mark}
        </Text>
      ) : null}
    </View>
  );
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

export default function AchievementBadge({ id, category, earned = true, size = 'medium', unitSystem = 'imperial', badgeState, remainingDays = 0 }: Props) {
  const resolvedCategory = categoryFor(id, category);
  const tone = TONES[resolvedCategory];
  const dimmed = !earned;
  const box = SIZE[size];

  if (resolvedCategory === 'streak') {
    const definition = streakDefinitionFromAchievementId(id);
    const days = definition?.thresholdDays ?? Number(id.match(/streak_(\d+)_day/)?.[1] ?? 7);
    return (
      <CanonicalStreakBadge
        days={days}
        state={badgeState ?? (earned ? 'unlocked' : 'locked')}
        size={box}
        compact={size === 'small'}
        remainingDays={remainingDays}
      />
    );
  }
  if (resolvedCategory === 'firsts') {
    const definition = firstAchievementDefinitionFromAchievementId(id);
    if (definition) {
      return (
        <FirstAchievementBadge
          achievement={definition.id}
          state={badgeState ?? (earned ? 'unlocked' : 'locked')}
          size={box}
          compact={size === 'small'}
          unitSystem={unitSystem}
        />
      );
    }
  }
  if (resolvedCategory === 'strength') {
    const definition = strengthAchievementDefinitionFromAchievementId(id);
    if (definition) {
      return (
        <StrengthAchievementBadge
          achievement={definition.id}
          state={badgeState ?? (earned ? 'unlocked' : 'locked')}
          size={box}
          compact={size === 'small'}
        />
      );
    }
  }
  if (resolvedCategory === 'recovery') {
    const definition = recoveryAchievementDefinitionFromAchievementId(id);
    if (definition) {
      return (
        <RecoveryAchievementBadge
          achievement={definition.id}
          state={badgeState ?? (earned ? 'unlocked' : 'locked')}
          size={box}
          compact={size === 'small'}
        />
      );
    }
  }
  if (resolvedCategory === 'run_level') {
    const level = runLevelSlugFromId(id);
    if (level) {
      return <CanonicalRunLevelBadge level={level} state={earned ? 'unlocked' : 'locked'} size={box} compact={size === 'small'} />;
    }
  }
  if (resolvedCategory === 'stride_level') {
    return <LegacyStrideLevelBadge id={id} earned={earned} box={box} />;
  }
  if (resolvedCategory === 'lifetime_running' || (resolvedCategory === 'lifetime_distance' && id.startsWith('lifetime_run_'))) {
    const definition = lifetimeDistanceRunningDefinitionFromAchievementId(id);
    if (definition) {
      return (
        <LifetimeDistanceRunningBadge
          milestone={definition.thresholdMiles}
          state={badgeState ?? (earned ? 'unlocked' : 'locked')}
          unitSystem={unitSystem}
          size={box}
          compact={size === 'small'}
        />
      );
    }
  }
  if (resolvedCategory === 'lifetime_cycling' || (resolvedCategory === 'lifetime_distance' && id.startsWith('lifetime_cycle_'))) {
    const definition = lifetimeDistanceCyclingDefinitionFromAchievementId(id);
    if (definition) {
      return (
        <LifetimeDistanceCyclingBadge
          milestone={definition.thresholdMiles}
          state={badgeState ?? (earned ? 'unlocked' : 'locked')}
          unitSystem={unitSystem}
          size={box}
          compact={size === 'small'}
        />
      );
    }
  }
  if (resolvedCategory === 'weekly_distance') {
    const definition = weeklyDistanceDefinitionFromAchievementId(id);
    if (definition) {
      return (
        <WeeklyDistanceBadge
          milestoneKm={definition.thresholdKm}
          state={badgeState ?? (earned ? 'unlocked' : 'locked')}
          size={box}
          compact={size === 'small'}
          unitSystem={unitSystem}
        />
      );
    }
  }
  if (resolvedCategory === 'monthly_distance') {
    const definition = monthlyDistanceDefinitionFromAchievementId(id);
    if (definition) {
      return (
        <MonthlyDistanceBadge
          milestoneKm={definition.thresholdKm}
          state={badgeState ?? (earned ? 'unlocked' : 'locked')}
          size={box}
          compact={size === 'small'}
          unitSystem={unitSystem}
        />
      );
    }
  }
  if (resolvedCategory === 'lifetime_running' || resolvedCategory === 'lifetime_cycling' || resolvedCategory === 'lifetime_distance') {
    return <DiamondBadge id={id} category={resolvedCategory} tone={tone} earned={earned} box={box} />;
  }
  if (['strength', 'recovery', 'challenges'].includes(resolvedCategory)) {
    return <OriginalHexBadge id={id} category={resolvedCategory} tone={tone} earned={earned} box={box} size={size} />;
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
