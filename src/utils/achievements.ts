import type { Activity } from '../types/activity';
import type { ScheduledSession } from './scheduledSessions';

export type AchievementId = string;

export type AchievementDefinition = {
  id: AchievementId;
  title: string;
  description: string;
  criteria: string;
  category?: AchievementCategory;
};

export type AchievementCategory =
  | 'healthy_progress'
  | 'personal_record'
  | 'monthly_distance'
  | 'consistency'
  | 'streak'
  | 'training_quality'
  | 'challenge'
  | 'stride_level'
  | 'cumulative_elevation'
  | 'firsts'
  | 'run_level'
  | 'lifetime_distance'
  | 'lifetime_running'
  | 'lifetime_cycling'
  | 'weekly_distance'
  | 'elevation'
  | 'strength'
  | 'recovery'
  | 'challenges';

export type PersonalRecord = {
  id: AchievementId;
  title: string;
  activityId: string;
  activityType: Activity['activityType'];
  value: number;
  unit: 'seconds' | 'meters';
  achievedAt: number;
  evidence: string;
};

export type MonthlyDistanceMilestone = {
  id: AchievementId;
  monthKey: string;
  thresholdMeters: number;
  distanceMeters: number;
  activityIds: string[];
};

export type ChallengeDefinition = {
  id: AchievementId;
  title: string;
  description: string;
  category: 'monthly_distance' | 'consistency' | 'balance';
  thresholdMeters?: number;
  requiredWeeks?: number;
};

export type ChallengeProgress = {
  definition: ChallengeDefinition;
  progress: number;
  target: number;
  complete: boolean;
  supportingActivityIds: string[];
};

export type StrideLevel = {
  id: AchievementId;
  title: string;
  tier: number;
  thresholdMeters: number;
  cumulativeMeters: number;
  complete: boolean;
};

export type CumulativeElevationAchievement = {
  id: AchievementId;
  slug: string;
  displayName: string;
  thresholdMeters: number;
  sourceValue: number;
  sourceUnit: 'ft' | 'm' | 'km';
  imperialDisplay: string;
  metricDisplay: string;
  measurementType: 'summit_elevation' | 'ocean_floor_to_summit' | 'martian_datum' | 'base_to_summit';
  measurementDescriptor: 'CUMULATIVE ELEVATION GAIN' | 'OCEAN FLOOR TO SUMMIT' | 'ABOVE MARTIAN DATUM' | 'BASE TO SUMMIT';
  authoritativeSource: string;
  sourceURL: string;
  sourceAccessDate: string;
  artworkPath: string;
  thumbnailPath: string;
  shareAssetPaths: {
    photographic: string;
    minimal: string;
    overlay: string;
  };
  sortOrder: number;
  cumulativeMeters: number;
  remainingMeters: number;
  progressRatio: number;
  complete: boolean;
  unlockedAt?: number;
  supportingActivityIds: string[];
};

export type StreakAchievementDefinition = {
  id: AchievementId;
  slug: string;
  displayName: string;
  thresholdDays: number;
  milestoneLabel: string;
  badgeText: string;
  tier: number;
  artworkPath: string;
  lockedArtworkPath: string;
  dominantHeatColor: string;
  shareAssetPaths: {
    cleanDark: string;
    overlay: string;
  };
  sortOrder: number;
};

export type StreakAchievement = StreakAchievementDefinition & {
  currentStreakDays: number;
  remainingDays: number;
  progressRatio: number;
  complete: boolean;
  unlockedAt?: number;
  supportingActivityIds: string[];
  state: 'locked' | 'earned' | 'current';
};

export type StreakAchievementSummary = {
  currentStreakDays: number;
  currentTier: StreakAchievement | null;
  nextTier: StreakAchievement | null;
  nextMilestone: StreakAchievement | null;
  progressRatio: number;
  daysRemaining: number;
  achievements: StreakAchievement[];
};

export type AchievementHubModel = {
  definitions: AchievementDefinition[];
  personalRecords: PersonalRecord[];
  monthlyMilestones: MonthlyDistanceMilestone[];
  consistencyAwards: AchievementAward[];
  challengeProgress: ChallengeProgress[];
  strideLevels: StrideLevel[];
  cumulativeElevation: CumulativeElevationAchievement[];
  streak: StreakAchievementSummary;
  shareable: AchievementDefinition[];
};

export const HEALTHY_ACHIEVEMENTS: AchievementDefinition[] = [
  { id: 'consistency_wins', title: 'Consistency Wins', description: 'Completed planned training consistently.', criteria: 'At least three completed training days in the last seven days.' },
  { id: 'long_run_builder', title: 'Long Run Builder', description: 'Built long-run durability gradually.', criteria: 'Complete a running session of at least 45 minutes without a skipped status.' },
  { id: 'recovery_master', title: 'Recovery Master', description: 'Used recovery appropriately.', criteria: 'Complete recovery, mobility, or active recovery work.' },
  { id: 'smart_progression', title: 'Smart Progression', description: 'Progressed without a large workload spike.', criteria: 'Complete at least four recent sessions while the seven-day load trend stays controlled.' },
  { id: 'strong_strides', title: 'Strong Strides', description: 'Completed running-economy or stride sessions appropriately.', criteria: 'Complete running-economy, strides, or coordinated strength support work.' },
  { id: 'foundation_builder', title: 'Foundation Builder', description: 'Completed an aerobic foundation phase.', criteria: 'Complete a foundation-focused session or foundation block work.' },
  { id: 'strength_supports_running', title: 'Strength Supports Running', description: 'Completed coordinated strength work.', criteria: 'Complete strength work alongside running or walking in the same seven-day period.' },
  { id: 'listened_to_your_body', title: 'Listened to Your Body', description: 'Used an appropriate adjustment instead of forcing training.', criteria: 'Log a modified, partial, stopped-early, or equivalent-substitute completion.' },
  { id: 'back_on_track', title: 'Back on Track', description: 'Returned consistently after an interruption.', criteria: 'Complete training after a gap of at least seven days.' },
  { id: 'deload_done_right', title: 'Deload Done Right', description: 'Completed a deload and returned appropriately.', criteria: 'Complete recovery-oriented work or lower-load training after a demanding period.' },
  { id: 'balanced_training', title: 'Balanced Training', description: 'Maintained appropriate hard/easy separation.', criteria: 'Complete endurance and strength/support work in the same week without rewarding excess volume.' },
  { id: 'quality_earned', title: 'Quality Earned', description: 'Reached appropriate eligibility before adding quality work.', criteria: 'Complete a controlled quality session after recent consistency exists.' },
  { id: 'easy_means_easy', title: 'Easy Means Easy', description: 'Kept an easy session controlled.', criteria: 'Complete an easy run at RPE 4 or lower.' },
];

export const PERSONAL_RECORD_DEFINITIONS: AchievementDefinition[] = [
  { id: 'pr_longest_run', title: 'Longest Run', description: 'Most time in one completed run.', criteria: 'Longest completed running duration.', category: 'personal_record' },
  { id: 'pr_farthest_run', title: 'Farthest Run', description: 'Most distance in one completed run.', criteria: 'Farthest completed running distance.', category: 'personal_record' },
  { id: 'pr_fastest_1k', title: 'Fastest 1K', description: 'Fastest valid continuous 1K effort.', criteria: 'Requires supported best-effort segment data; not awarded from fragmented totals.', category: 'personal_record' },
  { id: 'pr_fastest_mile', title: 'Fastest Mile', description: 'Fastest valid continuous mile effort.', criteria: 'Requires supported best-effort segment data; not awarded from fragmented totals.', category: 'personal_record' },
  { id: 'pr_fastest_5k', title: 'Fastest 5K', description: 'Fastest valid continuous 5K effort.', criteria: 'Requires supported best-effort segment data; not awarded from fragmented totals.', category: 'personal_record' },
  { id: 'pr_fastest_10k', title: 'Fastest 10K', description: 'Fastest valid continuous 10K effort.', criteria: 'Requires supported best-effort segment data; not awarded from fragmented totals.', category: 'personal_record' },
  { id: 'pr_longest_ride', title: 'Longest Ride', description: 'Farthest completed cycling activity.', criteria: 'Farthest completed ride with legitimate distance.', category: 'personal_record' },
  { id: 'pr_highest_ride_elevation', title: 'Highest Ride Climb', description: 'Most elevation gain in a completed ride.', criteria: 'Highest stored elevation gain for cycling.', category: 'personal_record' },
];

export const MONTHLY_DISTANCE_THRESHOLDS_KM = [10, 25, 50, 75, 100, 125, 150, 175, 200] as const;

const MONTHLY_DISTANCE_IDS: Record<number, AchievementId> = {
  10: 'monthly_run_10k',
  25: 'monthly_run_25k',
  50: 'monthly_run_50k',
  75: 'monthly_run_75k',
  100: 'monthly_run_100k',
  125: 'monthly_run_125k',
  150: 'monthly_run_150k',
  175: 'monthly_run_175k',
  200: 'monthly_run_200k',
};

export const CHALLENGE_DEFINITIONS: ChallengeDefinition[] = [
  { id: 'challenge_25k_month', title: '25K Month', description: 'Complete 25 kilometers of running in a calendar month.', category: 'monthly_distance', thresholdMeters: 25_000 },
  { id: 'challenge_50k_month', title: '50K Month', description: 'Complete 50 kilometers of running in a calendar month.', category: 'monthly_distance', thresholdMeters: 50_000 },
  { id: 'challenge_100k_month', title: '100K Month', description: 'Complete 100 kilometers of running in a calendar month.', category: 'monthly_distance', thresholdMeters: 100_000 },
  { id: 'challenge_four_week_consistency', title: 'Four-Week Consistency', description: 'Complete appropriate training in four consecutive weeks.', category: 'consistency', requiredWeeks: 4 },
  { id: 'challenge_strength_run_balance', title: 'Strength + Run Balance', description: 'Pair running or walking with strength support in the same week.', category: 'balance', requiredWeeks: 1 },
];

export const STRIDE_LEVEL_DEFINITIONS: Omit<StrideLevel, 'cumulativeMeters' | 'complete'>[] = [
  { id: 'stride_level_starter', title: 'Starter', tier: 1, thresholdMeters: 0 },
  { id: 'stride_level_pacesetter', title: 'Pacesetter', tier: 2, thresholdMeters: 50_000 },
  { id: 'stride_level_builder', title: 'Builder', tier: 3, thresholdMeters: 150_000 },
  { id: 'stride_level_endurer', title: 'Endurer', tier: 4, thresholdMeters: 400_000 },
  { id: 'stride_level_advancer', title: 'Advancer', tier: 5, thresholdMeters: 800_000 },
  { id: 'stride_level_elite', title: 'Elite', tier: 6, thresholdMeters: 1_600_000 },
  { id: 'stride_level_icon', title: 'Icon', tier: 7, thresholdMeters: 3_200_000 },
];

export const STREAK_ACHIEVEMENTS: StreakAchievementDefinition[] = [
  {
    id: 'streak_3_day',
    slug: '3-day',
    displayName: '3-Day Streak',
    thresholdDays: 3,
    milestoneLabel: '3 days',
    badgeText: '3',
    tier: 1,
    artworkPath: 'assets/achievements/streak/badges/streak-3-day.svg',
    lockedArtworkPath: 'assets/achievements/streak/badges/streak-3-day-locked.svg',
    dominantHeatColor: '#7A1717',
    shareAssetPaths: {
      cleanDark: 'assets/achievements/streak/share/streak-3-day-clean.svg',
      overlay: 'assets/achievements/streak/share/streak-3-day-overlay.svg',
    },
    sortOrder: 1,
  },
  {
    id: 'streak_1_week',
    slug: '1-week',
    displayName: '1-Week Streak',
    thresholdDays: 7,
    milestoneLabel: '7 days',
    badgeText: '7',
    tier: 2,
    artworkPath: 'assets/achievements/streak/badges/streak-1-week.svg',
    lockedArtworkPath: 'assets/achievements/streak/badges/streak-1-week-locked.svg',
    dominantHeatColor: '#B3221C',
    shareAssetPaths: {
      cleanDark: 'assets/achievements/streak/share/streak-1-week-clean.svg',
      overlay: 'assets/achievements/streak/share/streak-1-week-overlay.svg',
    },
    sortOrder: 2,
  },
  {
    id: 'streak_30_day',
    slug: '30-day',
    displayName: '30-Day Streak',
    thresholdDays: 30,
    milestoneLabel: '30 days',
    badgeText: '30',
    tier: 3,
    artworkPath: 'assets/achievements/streak/badges/streak-30-day.svg',
    lockedArtworkPath: 'assets/achievements/streak/badges/streak-30-day-locked.svg',
    dominantHeatColor: '#D9551D',
    shareAssetPaths: {
      cleanDark: 'assets/achievements/streak/share/streak-30-day-clean.svg',
      overlay: 'assets/achievements/streak/share/streak-30-day-overlay.svg',
    },
    sortOrder: 3,
  },
  {
    id: 'streak_50_day',
    slug: '50-day',
    displayName: '50-Day Streak',
    thresholdDays: 50,
    milestoneLabel: '50 days',
    badgeText: '50',
    tier: 4,
    artworkPath: 'assets/achievements/streak/badges/streak-50-day.svg',
    lockedArtworkPath: 'assets/achievements/streak/badges/streak-50-day-locked.svg',
    dominantHeatColor: '#F29A20',
    shareAssetPaths: {
      cleanDark: 'assets/achievements/streak/share/streak-50-day-clean.svg',
      overlay: 'assets/achievements/streak/share/streak-50-day-overlay.svg',
    },
    sortOrder: 4,
  },
  {
    id: 'streak_60_day',
    slug: '60-day',
    displayName: '60-Day Streak',
    thresholdDays: 60,
    milestoneLabel: '60 days',
    badgeText: '60',
    tier: 5,
    artworkPath: 'assets/achievements/streak/badges/streak-60-day.svg',
    lockedArtworkPath: 'assets/achievements/streak/badges/streak-60-day-locked.svg',
    dominantHeatColor: '#FFD449',
    shareAssetPaths: {
      cleanDark: 'assets/achievements/streak/share/streak-60-day-clean.svg',
      overlay: 'assets/achievements/streak/share/streak-60-day-overlay.svg',
    },
    sortOrder: 5,
  },
  {
    id: 'streak_90_day',
    slug: '90-day',
    displayName: '90-Day Streak',
    thresholdDays: 90,
    milestoneLabel: '90 days',
    badgeText: '90',
    tier: 6,
    artworkPath: 'assets/achievements/streak/badges/streak-90-day.svg',
    lockedArtworkPath: 'assets/achievements/streak/badges/streak-90-day-locked.svg',
    dominantHeatColor: '#FFF1BA',
    shareAssetPaths: {
      cleanDark: 'assets/achievements/streak/share/streak-90-day-clean.svg',
      overlay: 'assets/achievements/streak/share/streak-90-day-overlay.svg',
    },
    sortOrder: 6,
  },
  {
    id: 'streak_6_month',
    slug: '6-month',
    displayName: '6-Month Streak',
    thresholdDays: 183,
    milestoneLabel: '6 months',
    badgeText: '6M',
    tier: 7,
    artworkPath: 'assets/achievements/streak/badges/streak-6-month.svg',
    lockedArtworkPath: 'assets/achievements/streak/badges/streak-6-month-locked.svg',
    dominantHeatColor: '#FFFDF3',
    shareAssetPaths: {
      cleanDark: 'assets/achievements/streak/share/streak-6-month-clean.svg',
      overlay: 'assets/achievements/streak/share/streak-6-month-overlay.svg',
    },
    sortOrder: 7,
  },
];

const FEET_PER_METER = 3.28084;

type CumulativeElevationDefinition = Omit<
  CumulativeElevationAchievement,
  'cumulativeMeters' | 'remainingMeters' | 'progressRatio' | 'complete' | 'unlockedAt' | 'supportingActivityIds'
>;

export const CUMULATIVE_ELEVATION_ACHIEVEMENTS: CumulativeElevationDefinition[] = [
  {
    id: 'elevation_mount_hood',
    slug: 'mount-hood',
    displayName: 'Mount Hood',
    thresholdMeters: 11_240 / FEET_PER_METER,
    sourceValue: 11_240,
    sourceUnit: 'ft',
    imperialDisplay: '11,240 ft',
    metricDisplay: '3,426 m',
    measurementType: 'summit_elevation',
    measurementDescriptor: 'CUMULATIVE ELEVATION GAIN',
    authoritativeSource: 'USGS Mount Hood volcano page',
    sourceURL: 'https://www.usgs.gov/volcanoes/mount-hood',
    sourceAccessDate: '2026-08-19',
    artworkPath: 'assets/achievements/elevation/artwork/mount-hood.png',
    thumbnailPath: 'assets/achievements/elevation/thumbnails/mount-hood.png',
    shareAssetPaths: {
      photographic: 'assets/achievements/elevation/share/mount-hood.png',
      minimal: 'assets/achievements/elevation/share/mount-hood.png',
      overlay: 'assets/achievements/elevation/share/mount-hood.png',
    },
    sortOrder: 1,
  },
  {
    id: 'elevation_mount_fuji',
    slug: 'mount-fuji',
    displayName: 'Mount Fuji',
    thresholdMeters: 3_776,
    sourceValue: 3_776,
    sourceUnit: 'm',
    imperialDisplay: '12,388 ft',
    metricDisplay: '3,776 m',
    measurementType: 'summit_elevation',
    measurementDescriptor: 'CUMULATIVE ELEVATION GAIN',
    authoritativeSource: 'Geospatial Information Authority of Japan / official Fuji climbing site',
    sourceURL: 'https://www.gsi.go.jp/WNEW/PRESS-RELEASE/keikaku61003.html',
    sourceAccessDate: '2026-08-19',
    artworkPath: 'assets/achievements/elevation/artwork/mount-fuji.png',
    thumbnailPath: 'assets/achievements/elevation/thumbnails/mount-fuji.png',
    shareAssetPaths: {
      photographic: 'assets/achievements/elevation/share/mount-fuji.png',
      minimal: 'assets/achievements/elevation/share/mount-fuji.png',
      overlay: 'assets/achievements/elevation/share/mount-fuji.png',
    },
    sortOrder: 2,
  },
  {
    id: 'elevation_mount_rainier',
    slug: 'mount-rainier',
    displayName: 'Mount Rainier',
    thresholdMeters: 14_410 / FEET_PER_METER,
    sourceValue: 14_410,
    sourceUnit: 'ft',
    imperialDisplay: '14,410 ft',
    metricDisplay: '4,392 m',
    measurementType: 'summit_elevation',
    measurementDescriptor: 'CUMULATIVE ELEVATION GAIN',
    authoritativeSource: 'USGS Mount Rainier page / NPS Mount Rainier volcano page',
    sourceURL: 'https://www.usgs.gov/volcanoes/mount-rainier',
    sourceAccessDate: '2026-08-19',
    artworkPath: 'assets/achievements/elevation/artwork/mount-rainier.png',
    thumbnailPath: 'assets/achievements/elevation/thumbnails/mount-rainier.png',
    shareAssetPaths: {
      photographic: 'assets/achievements/elevation/share/mount-rainier.png',
      minimal: 'assets/achievements/elevation/share/mount-rainier.png',
      overlay: 'assets/achievements/elevation/share/mount-rainier.png',
    },
    sortOrder: 3,
  },
  {
    id: 'elevation_kilimanjaro',
    slug: 'kilimanjaro',
    displayName: 'Kilimanjaro',
    thresholdMeters: 5_895,
    sourceValue: 5_895,
    sourceUnit: 'm',
    imperialDisplay: '19,341 ft',
    metricDisplay: '5,895 m',
    measurementType: 'summit_elevation',
    measurementDescriptor: 'CUMULATIVE ELEVATION GAIN',
    authoritativeSource: 'Tanzania National Parks Kilimanjaro page',
    sourceURL: 'https://www.tanzaniaparks.go.tz/nationalparks/kilimanjaro',
    sourceAccessDate: '2026-08-19',
    artworkPath: 'assets/achievements/elevation/artwork/kilimanjaro.png',
    thumbnailPath: 'assets/achievements/elevation/thumbnails/kilimanjaro.png',
    shareAssetPaths: {
      photographic: 'assets/achievements/elevation/share/kilimanjaro.png',
      minimal: 'assets/achievements/elevation/share/kilimanjaro.png',
      overlay: 'assets/achievements/elevation/share/kilimanjaro.png',
    },
    sortOrder: 4,
  },
  {
    id: 'elevation_denali',
    slug: 'denali',
    displayName: 'Denali',
    thresholdMeters: 20_310 / FEET_PER_METER,
    sourceValue: 20_310,
    sourceUnit: 'ft',
    imperialDisplay: '20,310 ft',
    metricDisplay: '6,190 m',
    measurementType: 'summit_elevation',
    measurementDescriptor: 'CUMULATIVE ELEVATION GAIN',
    authoritativeSource: 'NPS Denali summit survey / USGS 2015 elevation release',
    sourceURL: 'https://www.nps.gov/articles/denali-crp-summit-survey.htm',
    sourceAccessDate: '2026-08-19',
    artworkPath: 'assets/achievements/elevation/artwork/denali.png',
    thumbnailPath: 'assets/achievements/elevation/thumbnails/denali.png',
    shareAssetPaths: {
      photographic: 'assets/achievements/elevation/share/denali.png',
      minimal: 'assets/achievements/elevation/share/denali.png',
      overlay: 'assets/achievements/elevation/share/denali.png',
    },
    sortOrder: 5,
  },
  {
    id: 'elevation_aconcagua',
    slug: 'aconcagua',
    displayName: 'Aconcagua',
    thresholdMeters: 6_960.8,
    sourceValue: 6_960.8,
    sourceUnit: 'm',
    imperialDisplay: '22,837 ft',
    metricDisplay: '6,960.8 m',
    measurementType: 'summit_elevation',
    measurementDescriptor: 'CUMULATIVE ELEVATION GAIN',
    authoritativeSource: 'Instituto Geografico Nacional Argentina',
    sourceURL: 'https://www.ign.gob.ar/Novedades/NuevaAlturaAconcagua',
    sourceAccessDate: '2026-08-19',
    artworkPath: 'assets/achievements/elevation/artwork/aconcagua.png',
    thumbnailPath: 'assets/achievements/elevation/thumbnails/aconcagua.png',
    shareAssetPaths: {
      photographic: 'assets/achievements/elevation/share/aconcagua.png',
      minimal: 'assets/achievements/elevation/share/aconcagua.png',
      overlay: 'assets/achievements/elevation/share/aconcagua.png',
    },
    sortOrder: 6,
  },
  {
    id: 'elevation_mount_everest',
    slug: 'mount-everest',
    displayName: 'Mount Everest',
    thresholdMeters: 8_848.86,
    sourceValue: 8_848.86,
    sourceUnit: 'm',
    imperialDisplay: '29,032 ft',
    metricDisplay: '8,848.86 m',
    measurementType: 'summit_elevation',
    measurementDescriptor: 'CUMULATIVE ELEVATION GAIN',
    authoritativeSource: '2020 Nepal-China joint height announcement, reported by China SCIO',
    sourceURL: 'https://english.scio.gov.cn/in-depth/2020-12/24/content_77046507.htm',
    sourceAccessDate: '2026-08-19',
    artworkPath: 'assets/achievements/elevation/artwork/mount-everest.png',
    thumbnailPath: 'assets/achievements/elevation/thumbnails/mount-everest.png',
    shareAssetPaths: {
      photographic: 'assets/achievements/elevation/share/mount-everest.png',
      minimal: 'assets/achievements/elevation/share/mount-everest.png',
      overlay: 'assets/achievements/elevation/share/mount-everest.png',
    },
    sortOrder: 7,
  },
  {
    id: 'elevation_mauna_kea',
    slug: 'mauna-kea',
    displayName: 'Mauna Kea',
    thresholdMeters: 33_500 / FEET_PER_METER,
    sourceValue: 33_500,
    sourceUnit: 'ft',
    imperialDisplay: '33,500 ft',
    metricDisplay: '10,211 m',
    measurementType: 'ocean_floor_to_summit',
    measurementDescriptor: 'OCEAN FLOOR TO SUMMIT',
    authoritativeSource: 'USGS Hawaiian Volcano Observatory FAQ',
    sourceURL: 'https://www.usgs.gov/faqs/how-big-are-hawaiian-volcanoes',
    sourceAccessDate: '2026-08-19',
    artworkPath: 'assets/achievements/elevation/artwork/mauna-kea.png',
    thumbnailPath: 'assets/achievements/elevation/thumbnails/mauna-kea.png',
    shareAssetPaths: {
      photographic: 'assets/achievements/elevation/share/mauna-kea.png',
      minimal: 'assets/achievements/elevation/share/mauna-kea.png',
      overlay: 'assets/achievements/elevation/share/mauna-kea.png',
    },
    sortOrder: 8,
  },
  {
    id: 'elevation_ascraeus_mons',
    slug: 'ascraeus-mons',
    displayName: 'Ascraeus Mons',
    thresholdMeters: 18_225,
    sourceValue: 18_225,
    sourceUnit: 'm',
    imperialDisplay: '59,793 ft',
    metricDisplay: '18,225 m',
    measurementType: 'martian_datum',
    measurementDescriptor: 'ABOVE MARTIAN DATUM',
    authoritativeSource: 'NASA/JPL THEMIS image notes',
    sourceURL: 'https://www.jpl.nasa.gov/images/pia24141-ascraeus-mons/',
    sourceAccessDate: '2026-08-19',
    artworkPath: 'assets/achievements/elevation/artwork/ascraeus-mons.png',
    thumbnailPath: 'assets/achievements/elevation/thumbnails/ascraeus-mons.png',
    shareAssetPaths: {
      photographic: 'assets/achievements/elevation/share/ascraeus-mons.png',
      minimal: 'assets/achievements/elevation/share/ascraeus-mons.png',
      overlay: 'assets/achievements/elevation/share/ascraeus-mons.png',
    },
    sortOrder: 9,
  },
  {
    id: 'elevation_olympus_mons',
    slug: 'olympus-mons',
    displayName: 'Olympus Mons',
    thresholdMeters: 40_000,
    sourceValue: 40,
    sourceUnit: 'km',
    imperialDisplay: '131,234 ft+',
    metricDisplay: '40 km+',
    measurementType: 'base_to_summit',
    measurementDescriptor: 'BASE TO SUMMIT',
    authoritativeSource: 'NASA Mars facts / NASA-JPL Olympus Mons caldera note',
    sourceURL: 'https://science.nasa.gov/mars/facts/',
    sourceAccessDate: '2026-08-19',
    artworkPath: 'assets/achievements/elevation/artwork/olympus-mons.png',
    thumbnailPath: 'assets/achievements/elevation/thumbnails/olympus-mons.png',
    shareAssetPaths: {
      photographic: 'assets/achievements/elevation/share/olympus-mons.png',
      minimal: 'assets/achievements/elevation/share/olympus-mons.png',
      overlay: 'assets/achievements/elevation/share/olympus-mons.png',
    },
    sortOrder: 10,
  },
];

export const BUILD57_ACHIEVEMENT_DEFINITIONS: AchievementDefinition[] = [
  ...HEALTHY_ACHIEVEMENTS.map(item => ({ ...item, category: item.category ?? 'healthy_progress' as const })),
  ...PERSONAL_RECORD_DEFINITIONS,
  ...MONTHLY_DISTANCE_THRESHOLDS_KM.map(km => ({
    id: MONTHLY_DISTANCE_IDS[km],
    title: `${km}K Month`,
    description: `${km} kilometers completed in one calendar month.`,
    criteria: 'Sum completed running distance by calendar month using canonical meters.',
    category: 'monthly_distance' as const,
  })),
  { id: 'three_training_days_week', title: 'Three Training Days', description: 'Three completed training days in a calendar week.', criteria: 'Three distinct completed training dates in the same week.', category: 'consistency' },
  { id: 'three_week_consistency', title: '3-Week Consistency', description: 'Appropriate training consistency for three consecutive weeks.', criteria: 'At least three completed training days in each of three consecutive weeks.', category: 'consistency' },
  { id: 'four_week_consistency', title: '4-Week Consistency', description: 'Appropriate training consistency for four consecutive weeks.', criteria: 'At least three completed training days in each of four consecutive weeks.', category: 'consistency' },
  { id: 'six_week_consistency', title: '6-Week Consistency', description: 'Appropriate training consistency for six consecutive weeks.', criteria: 'At least three completed training days in each of six consecutive weeks.', category: 'consistency' },
  { id: 'three_month_consistency', title: '3-Month Consistency', description: 'Sustained training rhythm for three months.', criteria: 'At least three completed training days in each of twelve consecutive weeks.', category: 'consistency' },
  { id: 'six_month_consistency', title: '6-Month Consistency', description: 'Sustained training rhythm for six months.', criteria: 'At least three completed training days in each of twenty-four consecutive weeks.', category: 'consistency' },
  ...STREAK_ACHIEVEMENTS.map(item => ({
    id: item.id,
    title: item.displayName,
    description: "Consistency built by following the athlete's actual training schedule.",
    criteria: `Maintain schedule adherence for ${item.milestoneLabel}; planned rest, recovery, taper, and confirmed adaptations preserve the streak.`,
    category: 'streak' as const,
  })),
  ...STRIDE_LEVEL_DEFINITIONS.map(level => ({
    id: level.id,
    title: `Stride Level: ${level.title}`,
    description: 'Long-term distance progression on the Stride Path.',
    criteria: `Reach ${Math.round(level.thresholdMeters / 1000)} kilometers of cumulative running, walking, hiking, or cycling distance.`,
    category: 'stride_level' as const,
  })),
  ...CUMULATIVE_ELEVATION_ACHIEVEMENTS.map(item => ({
    id: item.id,
    title: item.displayName,
    description: `${item.imperialDisplay} ${item.measurementDescriptor.toLowerCase()}.`,
    criteria: `Reach ${item.imperialDisplay} of eligible cumulative elevation gain using stored activity elevation data.`,
    category: 'cumulative_elevation' as const,
  })),
  ...CHALLENGE_DEFINITIONS.map(challenge => ({
    id: challenge.id,
    title: challenge.title,
    description: challenge.description,
    criteria: challenge.category === 'monthly_distance'
      ? `Complete ${Math.round((challenge.thresholdMeters ?? 0) / 1000)} kilometers in a month.`
      : challenge.description,
    category: 'challenge' as const,
  })),
];

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

function completedActivities(activities: readonly Activity[]): Activity[] {
  return activities
    .filter(activity => activity.status !== 'skipped')
    .sort((a, b) => a.startTime - b.startTime);
}

function distanceMeters(activity: Activity): number {
  const value = activity.metrics.distanceMeters ?? 0;
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function durationSeconds(activity: Activity): number {
  const value = activity.metrics.durationSeconds ?? 0;
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function monthKey(timeMs: number): string {
  const date = new Date(timeMs);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function weekKey(timeMs: number): string {
  const date = new Date(timeMs);
  const day = date.getDay();
  const monday = new Date(date);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(date.getDate() - ((day + 6) % 7));
  return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
}

function bestBy<T>(items: readonly T[], score: (item: T) => number): T | null {
  let best: T | null = null;
  let bestScore = -Infinity;
  for (const item of items) {
    const next = score(item);
    if (next > bestScore) {
      best = item;
      bestScore = next;
    }
  }
  return best;
}

function addRecord(records: PersonalRecord[], record: PersonalRecord | null): void {
  if (record) records.push(record);
}

export function calculatePersonalRecords(activities: readonly Activity[]): PersonalRecord[] {
  const completed = completedActivities(activities);
  const runs = completed.filter(activity => activity.activityType === 'running');
  const rides = completed.filter(activity => activity.activityType === 'cycling' || activity.activityType === 'indoor_cycling');
  const records: PersonalRecord[] = [];
  const longestRun = bestBy(runs, durationSeconds);
  addRecord(records, longestRun && durationSeconds(longestRun) > 0 ? {
    id: 'pr_longest_run',
    title: 'Longest Run',
    activityId: longestRun.id,
    activityType: longestRun.activityType,
    value: durationSeconds(longestRun),
    unit: 'seconds',
    achievedAt: longestRun.startTime,
    evidence: 'completed running duration',
  } : null);
  const farthestRun = bestBy(runs, distanceMeters);
  addRecord(records, farthestRun && distanceMeters(farthestRun) > 0 ? {
    id: 'pr_farthest_run',
    title: 'Farthest Run',
    activityId: farthestRun.id,
    activityType: farthestRun.activityType,
    value: distanceMeters(farthestRun),
    unit: 'meters',
    achievedAt: farthestRun.startTime,
    evidence: 'completed running distance',
  } : null);
  const longestRide = bestBy(rides, distanceMeters);
  addRecord(records, longestRide && distanceMeters(longestRide) > 0 ? {
    id: 'pr_longest_ride',
    title: 'Longest Ride',
    activityId: longestRide.id,
    activityType: longestRide.activityType,
    value: distanceMeters(longestRide),
    unit: 'meters',
    achievedAt: longestRide.startTime,
    evidence: 'completed cycling distance',
  } : null);
  const climbingRide = bestBy(rides, activity => activity.metrics.elevationGainMeters ?? 0);
  addRecord(records, climbingRide && (climbingRide.metrics.elevationGainMeters ?? 0) > 0 ? {
    id: 'pr_highest_ride_elevation',
    title: 'Highest Ride Climb',
    activityId: climbingRide.id,
    activityType: climbingRide.activityType,
    value: climbingRide.metrics.elevationGainMeters ?? 0,
    unit: 'meters',
    achievedAt: climbingRide.startTime,
    evidence: 'stored cycling elevation gain',
  } : null);
  return records;
}

export function calculateMonthlyDistanceMilestones(activities: readonly Activity[]): MonthlyDistanceMilestone[] {
  const byMonth = new Map<string, { distanceMeters: number; activityIds: string[] }>();
  for (const activity of completedActivities(activities)) {
    if (activity.activityType !== 'running') continue;
    const distance = distanceMeters(activity);
    if (distance <= 0) continue;
    const key = monthKey(activity.startTime);
    const current = byMonth.get(key) ?? { distanceMeters: 0, activityIds: [] };
    current.distanceMeters += distance;
    current.activityIds.push(activity.id);
    byMonth.set(key, current);
  }
  const milestones: MonthlyDistanceMilestone[] = [];
  for (const [key, value] of byMonth) {
    for (const km of MONTHLY_DISTANCE_THRESHOLDS_KM) {
      const thresholdMeters = km * 1000;
      if (value.distanceMeters >= thresholdMeters) {
        milestones.push({
          id: MONTHLY_DISTANCE_IDS[km],
          monthKey: key,
          thresholdMeters,
          distanceMeters: value.distanceMeters,
          activityIds: value.activityIds,
        });
      }
    }
  }
  return milestones.sort((a, b) => a.monthKey.localeCompare(b.monthKey) || a.thresholdMeters - b.thresholdMeters);
}

function completedTrainingDaysByWeek(activities: readonly Activity[]): Map<string, Set<string>> {
  const weeks = new Map<string, Set<string>>();
  for (const activity of completedActivities(activities)) {
    const date = new Date(activity.startTime);
    const dateKey = date.toDateString();
    const key = weekKey(activity.startTime);
    const days = weeks.get(key) ?? new Set<string>();
    days.add(dateKey);
    weeks.set(key, days);
  }
  return weeks;
}

function latestConsecutiveQualifiedWeeks(activities: readonly Activity[], now: number): number {
  const weeks = completedTrainingDaysByWeek(activities);
  let count = 0;
  const cursor = new Date(now);
  cursor.setHours(0, 0, 0, 0);
  cursor.setDate(cursor.getDate() - ((cursor.getDay() + 6) % 7));
  while (count < 60) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`;
    if ((weeks.get(key)?.size ?? 0) < 3) break;
    count += 1;
    cursor.setTime(cursor.getTime() - WEEK_MS);
  }
  return count;
}

export function calculateConsistencyAwards(
  activities: readonly Activity[],
  now = Date.now(),
): AchievementAward[] {
  const awards: AchievementAward[] = [];
  const weekCount = latestConsecutiveQualifiedWeeks(activities, now);
  const ids: [AchievementId, number][] = [
    ['three_week_consistency', 3],
    ['four_week_consistency', 4],
    ['six_week_consistency', 6],
    ['three_month_consistency', 12],
    ['six_month_consistency', 24],
  ];
  const recentIds = completedActivities(activities)
    .filter(activity => now - activity.startTime <= Math.max(weekCount, 1) * WEEK_MS)
    .map(activity => activity.id);
  if (completedTrainingDaysByWeek(activities).size && [...completedTrainingDaysByWeek(activities).values()].some(days => days.size >= 3)) {
    awards.push({ id: 'three_training_days_week', supportingActivityIds: recentIds.slice(0, 6), supportingSessionIds: [] });
  }
  for (const [id, threshold] of ids) {
    if (weekCount >= threshold) {
      awards.push({ id, supportingActivityIds: recentIds.slice(0, 20), supportingSessionIds: [] });
    }
  }
  return awards;
}

export function calculateStrideLevels(activities: readonly Activity[]): StrideLevel[] {
  const cumulativeMeters = completedActivities(activities)
    .filter(activity => ['running', 'walking', 'hiking', 'cycling', 'indoor_cycling'].includes(activity.activityType))
    .reduce((sum, activity) => sum + distanceMeters(activity), 0);
  return STRIDE_LEVEL_DEFINITIONS.map(level => ({
    ...level,
    cumulativeMeters,
    complete: cumulativeMeters >= level.thresholdMeters,
  }));
}

function eligibleElevationGainMeters(activity: Activity): number {
  if (activity.status === 'skipped') return 0;
  const source = activity.metrics.metricSources?.elevation;
  if (source === 'prescribed_estimate' || source === 'unavailable') return 0;
  const value = activity.metrics.elevationGainMeters ?? 0;
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export function calculateCumulativeElevationAchievements(
  activities: readonly Activity[],
): CumulativeElevationAchievement[] {
  const seenHealthKitWorkoutUuids = new Set<string>();
  const eligible = completedActivities(activities)
    .filter(activity => {
      const uuid = activity.healthKit?.workoutUuid;
      if (!uuid) return true;
      if (seenHealthKitWorkoutUuids.has(uuid)) return false;
      seenHealthKitWorkoutUuids.add(uuid);
      return true;
    })
    .map(activity => ({
      activity,
      elevationMeters: eligibleElevationGainMeters(activity),
    }))
    .filter(item => item.elevationMeters > 0);

  let cumulativeMeters = 0;
  const crossing = new Map<AchievementId, { unlockedAt: number; supportingActivityIds: string[] }>();
  const supportingActivityIds: string[] = [];

  for (const item of eligible) {
    cumulativeMeters += item.elevationMeters;
    supportingActivityIds.push(item.activity.id);
    for (const definition of CUMULATIVE_ELEVATION_ACHIEVEMENTS) {
      if (!crossing.has(definition.id) && cumulativeMeters >= definition.thresholdMeters) {
        crossing.set(definition.id, {
          unlockedAt: item.activity.startTime,
          supportingActivityIds: [...supportingActivityIds],
        });
      }
    }
  }

  return CUMULATIVE_ELEVATION_ACHIEVEMENTS.map(definition => {
    const unlocked = crossing.get(definition.id);
    const complete = Boolean(unlocked);
    const progressRatio = definition.thresholdMeters > 0
      ? Math.min(1, cumulativeMeters / definition.thresholdMeters)
      : 1;
    return {
      ...definition,
      cumulativeMeters,
      remainingMeters: Math.max(0, definition.thresholdMeters - cumulativeMeters),
      progressRatio,
      complete,
      unlockedAt: unlocked?.unlockedAt,
      supportingActivityIds: unlocked?.supportingActivityIds ?? eligible.map(item => item.activity.id),
    };
  });
}

export type AchievementAwardReference = AchievementId | {
  id: AchievementId;
  awardedAt?: number;
  supportingActivityIds?: string[];
  supportingSessionIds?: string[];
};

export type AchievementEvaluationOptions = {
  now?: number;
  scheduledSessions?: readonly ScheduledSession[];
};

function achievementIdFromReference(item: AchievementAwardReference): AchievementId {
  return typeof item === 'string' ? item : item.id;
}

function existingAwardDateMap(existing: readonly AchievementAwardReference[]): Map<AchievementId, number> {
  const dates = new Map<AchievementId, number>();
  for (const item of existing) {
    if (typeof item !== 'string' && typeof item.awardedAt === 'number') {
      dates.set(item.id, item.awardedAt);
    }
  }
  return dates;
}

function resolveEvaluationOptions(nowOrOptions?: number | AchievementEvaluationOptions): Required<AchievementEvaluationOptions> {
  if (typeof nowOrOptions === 'number') return { now: nowOrOptions, scheduledSessions: [] };
  return {
    now: nowOrOptions?.now ?? Date.now(),
    scheduledSessions: nowOrOptions?.scheduledSessions ?? [],
  };
}

function localDateKey(timeMs: number): string {
  const date = new Date(timeMs);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function localDateMs(dateKey: string): number {
  const [year = 1970, month = 1, day = 1] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day).getTime();
}

function addDateKey(dateKey: string, days: number): string {
  const date = new Date(localDateMs(dateKey));
  date.setDate(date.getDate() + days);
  return localDateKey(date.getTime());
}

function isCompletedForStreak(activity: Activity): boolean {
  return activity.status !== 'skipped' && activity.completionClassification !== 'skipped';
}

function isSkippedRequiredActivity(activity: Activity): boolean {
  return Boolean(activity.scheduled || activity.scheduledSessionId) && (
    activity.status === 'skipped' || activity.completionClassification === 'skipped'
  );
}

function isRecoveryPreservingSession(session: ScheduledSession): boolean {
  const text = `${session.activityType} ${session.subtype} ${session.title} ${session.purpose} ${session.adaptationReason ?? ''}`.toLowerCase();
  return session.priority === 'optional'
    || session.activityType === 'rest'
    || session.activityType === 'mobility'
    || /rest|recovery|mobility|taper|deload/.test(text);
}

function isRequiredStreakSession(session: ScheduledSession): boolean {
  if (isRecoveryPreservingSession(session)) return false;
  if (session.status === 'optional' || session.status === 'replaced' || session.status === 'moved') return false;
  return session.priority === 'primary' || session.priority === 'supporting';
}

function isSessionCompletedForStreak(session: ScheduledSession, activitiesForDay: readonly Activity[]): boolean {
  if (session.status === 'completed' || session.status === 'partial' || Boolean(session.completedActivityId)) return true;
  return activitiesForDay.some(activity =>
    activity.scheduledSessionId === session.scheduledSessionId && isCompletedForStreak(activity));
}

type StreakDayOutcome = {
  breaks: boolean;
  startsOrCounts: boolean;
  supportingActivityIds: string[];
};

function streakOutcomeForDay(
  dateKey: string,
  todayKey: string,
  activitiesForDay: readonly Activity[],
  sessionsForDay: readonly ScheduledSession[],
): StreakDayOutcome {
  const supportingActivityIds = activitiesForDay.filter(isCompletedForStreak).map(activity => activity.id);
  if (activitiesForDay.some(isSkippedRequiredActivity)) {
    return { breaks: true, startsOrCounts: false, supportingActivityIds };
  }

  const required = sessionsForDay.filter(isRequiredStreakSession);
  if (required.length === 0) {
    return {
      breaks: false,
      startsOrCounts: supportingActivityIds.length > 0 || sessionsForDay.length > 0,
      supportingActivityIds,
    };
  }

  const allComplete = required.every(session => isSessionCompletedForStreak(session, activitiesForDay));
  if (allComplete) {
    return { breaks: false, startsOrCounts: true, supportingActivityIds };
  }

  const requiredMissed = required.some(session => session.status === 'missed' || session.status === 'skipped');
  if (requiredMissed || dateKey < todayKey) {
    return { breaks: true, startsOrCounts: false, supportingActivityIds };
  }

  return { breaks: false, startsOrCounts: false, supportingActivityIds };
}

export function calculateStreakAchievements(
  activities: readonly Activity[],
  options: AchievementEvaluationOptions = {},
  existing: readonly AchievementAwardReference[] = [],
): StreakAchievementSummary {
  const { now, scheduledSessions } = resolveEvaluationOptions(options);
  const todayKey = localDateKey(now);
  const activitiesByDate = new Map<string, Activity[]>();
  const sessionsByDate = new Map<string, ScheduledSession[]>();
  const existingDates = existingAwardDateMap(existing);

  for (const activity of activities) {
    if (activity.startTime > now) continue;
    const key = localDateKey(activity.startTime);
    activitiesByDate.set(key, [...(activitiesByDate.get(key) ?? []), activity]);
  }
  for (const session of scheduledSessions) {
    if (session.date > todayKey) continue;
    sessionsByDate.set(session.date, [...(sessionsByDate.get(session.date) ?? []), session]);
  }

  const dateKeys = [...new Set([...activitiesByDate.keys(), ...sessionsByDate.keys()])].sort();
  if (!dateKeys.length) {
    const achievements = STREAK_ACHIEVEMENTS.map(definition => ({
      ...definition,
      currentStreakDays: 0,
      remainingDays: definition.thresholdDays,
      progressRatio: 0,
      complete: false,
      unlockedAt: existingDates.get(definition.id),
      supportingActivityIds: [],
      state: 'locked' as const,
    }));
    return {
      currentStreakDays: 0,
      currentTier: null,
      nextTier: achievements[0] ?? null,
      nextMilestone: achievements[0] ?? null,
      progressRatio: 0,
      daysRemaining: achievements[0]?.remainingDays ?? 0,
      achievements,
    };
  }

  let cursor = dateKeys[0]!;
  let currentStreakDays = 0;
  let segmentStarted = false;
  let segmentSupportingActivityIds: string[] = [];
  const earnedAt = new Map<AchievementId, number>(existingDates);
  const supportByAward = new Map<AchievementId, string[]>();

  while (cursor <= todayKey) {
    const activitiesForDay = activitiesByDate.get(cursor) ?? [];
    const sessionsForDay = sessionsByDate.get(cursor) ?? [];
    const outcome = streakOutcomeForDay(cursor, todayKey, activitiesForDay, sessionsForDay);

    if (outcome.breaks) {
      currentStreakDays = 0;
      segmentStarted = false;
      segmentSupportingActivityIds = [];
    } else if (segmentStarted || outcome.startsOrCounts) {
      segmentStarted = true;
      if (outcome.startsOrCounts || currentStreakDays > 0) {
        currentStreakDays += 1;
      }
      segmentSupportingActivityIds = [...segmentSupportingActivityIds, ...outcome.supportingActivityIds];
      for (const definition of STREAK_ACHIEVEMENTS) {
        if (!earnedAt.has(definition.id) && currentStreakDays >= definition.thresholdDays) {
          earnedAt.set(definition.id, localDateMs(cursor));
          supportByAward.set(definition.id, [...segmentSupportingActivityIds]);
        }
      }
    }

    cursor = addDateKey(cursor, 1);
  }

  const currentDefinition = [...STREAK_ACHIEVEMENTS].reverse()
    .find(definition => currentStreakDays >= definition.thresholdDays)
    ?? null;
  const nextDefinition = STREAK_ACHIEVEMENTS.find(definition => currentStreakDays < definition.thresholdDays) ?? null;
  const progressBase = currentDefinition?.thresholdDays ?? 0;
  const progressTarget = nextDefinition?.thresholdDays ?? currentDefinition?.thresholdDays ?? 1;
  const denominator = Math.max(1, progressTarget - progressBase);
  const progressRatio = nextDefinition
    ? Math.max(0, Math.min(1, (currentStreakDays - progressBase) / denominator))
    : 1;

  const achievements = STREAK_ACHIEVEMENTS.map(definition => {
    const unlockedAt = earnedAt.get(definition.id);
    const complete = Boolean(unlockedAt) || currentStreakDays >= definition.thresholdDays;
    const state: StreakAchievement['state'] = currentDefinition?.id === definition.id
      ? 'current'
      : complete
        ? 'earned'
        : 'locked';
    return {
      ...definition,
      currentStreakDays,
      remainingDays: Math.max(0, definition.thresholdDays - currentStreakDays),
      progressRatio: Math.min(1, currentStreakDays / definition.thresholdDays),
      complete,
      unlockedAt: unlockedAt ?? (currentStreakDays >= definition.thresholdDays ? now : undefined),
      supportingActivityIds: supportByAward.get(definition.id) ?? segmentSupportingActivityIds,
      state,
    };
  });

  return {
    currentStreakDays,
    currentTier: currentDefinition ? achievements.find(item => item.id === currentDefinition.id) ?? null : null,
    nextTier: nextDefinition ? achievements.find(item => item.id === nextDefinition.id) ?? null : null,
    nextMilestone: nextDefinition ? achievements.find(item => item.id === nextDefinition.id) ?? null : null,
    progressRatio,
    daysRemaining: nextDefinition ? Math.max(0, nextDefinition.thresholdDays - currentStreakDays) : 0,
    achievements,
  };
}

export function calculateChallengeProgress(
  activities: readonly Activity[],
  now = Date.now(),
): ChallengeProgress[] {
  const currentMonth = monthKey(now);
  const currentMonthRuns = completedActivities(activities)
    .filter(activity => activity.activityType === 'running' && monthKey(activity.startTime) === currentMonth);
  const currentMonthDistance = currentMonthRuns.reduce((sum, activity) => sum + distanceMeters(activity), 0);
  const consistencyWeeks = latestConsecutiveQualifiedWeeks(activities, now);
  const recent = completedActivities(activities).filter(activity => now - activity.startTime <= WEEK_MS);
  const hasBalance = recent.some(activity => ['running', 'walking'].includes(activity.activityType))
    && recent.some(activity => activity.activityType === 'strength');
  return CHALLENGE_DEFINITIONS.map(definition => {
    if (definition.category === 'monthly_distance') {
      const target = definition.thresholdMeters ?? 0;
      return {
        definition,
        progress: Math.min(currentMonthDistance, target),
        target,
        complete: currentMonthDistance >= target,
        supportingActivityIds: currentMonthRuns.map(activity => activity.id),
      };
    }
    if (definition.category === 'consistency') {
      const target = definition.requiredWeeks ?? 1;
      return {
        definition,
        progress: Math.min(consistencyWeeks, target),
        target,
        complete: consistencyWeeks >= target,
        supportingActivityIds: recent.map(activity => activity.id),
      };
    }
    return {
      definition,
      progress: hasBalance ? 1 : 0,
      target: 1,
      complete: hasBalance,
      supportingActivityIds: recent.map(activity => activity.id),
    };
  });
}

export function buildAchievementHubModel(
  activities: readonly Activity[],
  existing: readonly AchievementAwardReference[] = [],
  nowOrOptions: number | AchievementEvaluationOptions = Date.now(),
): AchievementHubModel {
  const options = resolveEvaluationOptions(nowOrOptions);
  const existingIds = existing.map(achievementIdFromReference);
  const healthyAwards = evaluateAchievementAwards(activities, existingIds, options);
  const personalRecords = calculatePersonalRecords(activities);
  const monthlyMilestones = calculateMonthlyDistanceMilestones(activities);
  const consistencyAwards = calculateConsistencyAwards(activities, options.now);
  const challengeProgress = calculateChallengeProgress(activities, options.now);
  const strideLevels = calculateStrideLevels(activities);
  const cumulativeElevation = calculateCumulativeElevationAchievements(activities);
  const streak = calculateStreakAchievements(activities, options, existing);
  const earnedIds = new Set<AchievementId>([
    ...healthyAwards.map(item => item.id),
    ...personalRecords.map(item => item.id),
    ...monthlyMilestones.map(item => item.id),
    ...consistencyAwards.map(item => item.id),
    ...challengeProgress.filter(item => item.complete).map(item => item.definition.id),
    ...strideLevels.filter(item => item.complete).map(item => item.id),
    ...cumulativeElevation.filter(item => item.complete).map(item => item.id),
    ...streak.achievements.filter(item => item.complete).map(item => item.id),
  ]);
  return {
    definitions: BUILD57_ACHIEVEMENT_DEFINITIONS,
    personalRecords,
    monthlyMilestones,
    consistencyAwards,
    challengeProgress,
    strideLevels,
    cumulativeElevation,
    streak,
    shareable: BUILD57_ACHIEVEMENT_DEFINITIONS.filter(item => earnedIds.has(item.id)),
  };
}

export function evaluateAchievements(
  activities: readonly Activity[],
  existing: readonly AchievementId[] = [],
  nowOrOptions: number | AchievementEvaluationOptions = Date.now(),
): AchievementId[] {
  return evaluateAchievementAwards(activities, existing, nowOrOptions).map(award => award.id);
}

export type AchievementAward = {
  id: AchievementId;
  supportingActivityIds: string[];
  supportingSessionIds: string[];
};

export function evaluateAchievementAwards(
  activities: readonly Activity[],
  existing: readonly AchievementId[] = [],
  nowOrOptions: number | AchievementEvaluationOptions = Date.now(),
): AchievementAward[] {
  const options = resolveEvaluationOptions(nowOrOptions);
  const completed = completedActivities(activities);
  const awards = new Set<AchievementId>(existing);
  const support = new Map<AchievementId, AchievementAward>();
  const last7 = completed.filter(activity => options.now - activity.startTime <= 7 * DAY_MS);
  const award = (id: AchievementId, matches: readonly Activity[]) => {
    awards.add(id);
    if (existing.includes(id)) return;
    support.set(id, {
      id,
      supportingActivityIds: matches.map(activity => activity.id),
      supportingSessionIds: matches.map(activity => activity.scheduledSessionId).filter((value): value is string => Boolean(value)),
    });
  };

  const longRun = completed.find(activity => activity.activityType === 'running' && (activity.metrics.durationSeconds ?? 0) >= 45 * 60);
  if (longRun) {
    award('long_run_builder', [longRun]);
  }
  const easy = completed.find(activity => activity.activityType === 'running' && activity.rpe !== undefined && activity.rpe <= 4);
  if (easy) {
    award('easy_means_easy', [easy]);
  }
  const strength = completed.find(activity => activity.activityType === 'strength');
  if (strength) {
    award('strong_strides', [strength]);
  }
  const recovery = completed.find(activity => activity.activityType === 'mobility' || activity.subtype === 'recovery');
  if (recovery) {
    award('recovery_master', [recovery]);
    award('deload_done_right', [recovery]);
  }
  const foundation = completed.find(activity => /foundation|base/i.test(`${activity.notes ?? ''} ${activity.scheduledSessionId ?? ''}`));
  if (foundation) {
    award('foundation_builder', [foundation]);
  }
  if (new Set(last7.map(activity => new Date(activity.startTime).toDateString())).size >= 3) {
    award('consistency_wins', last7.slice(0, 3));
  }
  const adjusted = completed.find(activity => ['modified', 'partial', 'stopped_early', 'equivalent_substitute'].includes(activity.completionClassification ?? ''));
  if (adjusted) {
    award('listened_to_your_body', [adjusted]);
  }
  if (completed.length >= 2) {
    const gaps = completed.slice(1).map((activity, index) => activity.startTime - completed[index].startTime);
    const gapIndex = gaps.findIndex(gap => gap >= 7 * DAY_MS);
    if (gapIndex >= 0) award('back_on_track', [completed[gapIndex + 1]]);
  }
  if (
    last7.some(activity => ['running', 'walking'].includes(activity.activityType))
    && last7.some(activity => activity.activityType === 'strength')
  ) {
    award('balanced_training', last7.filter(activity => ['running', 'walking', 'strength'].includes(activity.activityType)).slice(0, 3));
    award('strength_supports_running', last7.filter(activity => ['running', 'walking', 'strength'].includes(activity.activityType)).slice(0, 3));
  }
  if (last7.length >= 4) {
    award('smart_progression', last7.slice(0, 4));
  }
  const quality = completed.find(activity => /stride|quality|interval|tempo/i.test(`${activity.notes ?? ''} ${activity.subtype ?? ''}`));
  if (quality && last7.length >= 3) {
    award('quality_earned', [quality]);
  }
  const streak = calculateStreakAchievements(activities, options, existing);
  for (const item of streak.achievements) {
    if (item.complete) {
      award(item.id, completed.filter(activity => item.supportingActivityIds.includes(activity.id)));
    }
  }

  return [...awards].map(id => support.get(id) ?? { id, supportingActivityIds: [], supportingSessionIds: [] });
}
