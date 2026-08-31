import { useMemo, useRef, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import ScreenHeader from '../../../src/components/layout/ScreenHeader';
import AchievementBadge from '../../../src/components/achievements/AchievementBadge';
import AchievementShareCard, {
  ACHIEVEMENT_SHARE_VARIANTS,
  type AchievementShareVariant,
} from '../../../src/components/achievements/AchievementShareCard';
import RunLevelProgress from '../../../src/achievements/runLevels/RunLevelProgress';
import { StreakBadge, StreakProgress } from '../../../src/achievements/streaks';
import FeatureTourTarget from '../../../src/components/featureTour/FeatureTourTarget';
import { useFeatureTour } from '../../../src/components/featureTour/FeatureTourProvider';
import { LAYOUT } from '../../../src/constants/layout';
import { getElevationAchievementArtwork } from '../../../src/constants/elevationAchievementAssets';
import { useScheduledSessions } from '../../../src/hooks/useScheduledSessions';
import { useWeekPlan } from '../../../src/hooks/useWeekPlan';
import { shareCardUnavailableReason, shareReportCard } from '../../../src/lib/shareCard';
import { useActivityStore } from '../../../src/store/activityStore';
import { useAchievementStore } from '../../../src/store/achievementStore';
import { useAssessmentStore } from '../../../src/store/assessmentStore';
import { useReadinessStore } from '../../../src/store/readinessStore';
import { useSettingsStore } from '../../../src/store/settingsStore';
import { useColors } from '../../../src/theme/useColors';
import {
  buildAchievementHubModel,
  BUILD57_ACHIEVEMENT_DEFINITIONS,
  type AchievementCategory,
  type AchievementDefinition,
  type CumulativeElevationAchievement,
  type StreakAchievement,
} from '../../../src/utils/achievements';
import {
  ACHIEVEMENT_SYSTEM_CATEGORY_LABELS,
  achievementFamilyLabel,
  achievementShareAllowed,
  evaluateAchievementSystem,
  type AchievementFamily,
  type EvaluatedAchievement,
} from '../../../src/utils/achievementSystem';
import { formatDistance } from '../../../src/lib/units';
import { formatDuration, formatElevationMeters } from '../../../src/utils/activitySummary';

const CATEGORY_LABELS: Partial<Record<AchievementCategory, string>> = {
  healthy_progress: 'Healthy Progress',
  personal_record: 'Personal Records',
  monthly_distance: 'Monthly Distance',
  consistency: 'Consistency',
  streak: 'Streaks',
  training_quality: 'Training Quality',
  challenge: 'Challenges',
  stride_level: 'Stride Levels',
  cumulative_elevation: 'Cumulative Elevation',
};

function metersToDisplay(meters: number, units: 'imperial' | 'metric'): string {
  return formatDistance(meters / 1609.344, units);
}

function definitionFor(id: string): AchievementDefinition | undefined {
  return BUILD57_ACHIEVEMENT_DEFINITIONS.find(item => item.id === id);
}

function elevationThresholdDisplay(item: CumulativeElevationAchievement, units: 'imperial' | 'metric'): string {
  return units === 'metric' ? item.metricDisplay : item.imperialDisplay;
}

function streakThresholdDisplay(item: StreakAchievement): string {
  return `${item.thresholdDays} days`;
}

function shortDate(timeMs: number | undefined): string {
  if (!timeMs) return '';
  return new Date(timeMs).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

const FAMILY_FILTERS: Array<'all' | AchievementFamily> = [
  'all',
  'recent',
  'run_levels',
  'firsts',
  'lifetime_running',
  'lifetime_cycling',
  'weekly_distance',
  'elevation',
  'strength',
  'streaks',
  'recovery',
  'challenges',
];

function familyFilterLabel(filter: 'all' | AchievementFamily): string {
  return filter === 'all' ? 'All' : ACHIEVEMENT_SYSTEM_CATEGORY_LABELS[filter];
}

function canonicalListForFilter(achievements: readonly EvaluatedAchievement[], filter: 'all' | AchievementFamily): EvaluatedAchievement[] {
  const sorted = [...achievements].sort((a, b) => {
    if (a.state !== b.state) return a.state === 'earned' ? -1 : b.state === 'earned' ? 1 : 0;
    return (a.tier ?? 99) - (b.tier ?? 99) || a.title.localeCompare(b.title);
  });
  if (filter === 'all') return sorted;
  if (filter === 'recent') {
    return sorted
      .filter(item => item.state !== 'locked')
      .sort((a, b) => (b.achievedDate ?? 0) - (a.achievedDate ?? 0));
  }
  return sorted.filter(item => item.family === filter);
}

export default function AchievementHubScreen() {
  const C = useColors();
  useFeatureTour('achievements');
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const activities = useActivityStore(state => state.activities);
  const awarded = useAchievementStore(state => state.awarded);
  const readinessHistory = useReadinessStore(state => state.history);
  const assessmentResults = useAssessmentStore(state => state.results);
  const units = useSettingsStore(state => state.units);
  const [shareVariant, setShareVariant] = useState<AchievementShareVariant>('badge_square');
  const [selectedShareId, setSelectedShareId] = useState<string | null>(null);
  const [shareMessage, setShareMessage] = useState<string | null>(shareCardUnavailableReason());
  const [showStreakLadder, setShowStreakLadder] = useState(false);
  const [familyFilter, setFamilyFilter] = useState<'all' | AchievementFamily>('all');
  const shareRef = useRef<View>(null);
  const weekPlan = useWeekPlan();
  const { weekSessions } = useScheduledSessions(weekPlan);
  const model = useMemo(
    () => buildAchievementHubModel(activities, awarded, { scheduledSessions: weekSessions }),
    [activities, awarded, weekSessions],
  );

  const earnedIds = new Set(model.shareable.map(item => item.id));
  const selectedShareDefinition = model.shareable.find(item => item.id === (selectedShareId ?? model.shareable[0]?.id));
  const selectedElevationShare = model.cumulativeElevation.find(item => item.id === selectedShareDefinition?.id);
  const selectedStreakShare = model.streak.achievements.find(item => item.id === selectedShareDefinition?.id);
  const activeLevel = [...model.strideLevels].reverse().find(item => item.complete) ?? model.strideLevels[0];
  const nextLevel = model.strideLevels.find(item => !item.complete);
  const nextElevation = model.cumulativeElevation.find(item => !item.complete);
  const grouped = model.definitions.reduce<Record<string, AchievementDefinition[]>>((acc, definition) => {
    const category = definition.category ?? 'healthy_progress';
    acc[category] = [...(acc[category] ?? []), definition];
    return acc;
  }, {});
  const canonicalAchievements = useMemo(() => evaluateAchievementSystem({
    activities,
    awarded,
    units,
    scheduledSessions: weekSessions,
    readinessHistory,
    assessmentResults,
  }), [activities, assessmentResults, awarded, readinessHistory, units, weekSessions]);
  const canonicalVisible = canonicalListForFilter(canonicalAchievements, familyFilter);

  function shareAchievement(definition: AchievementDefinition) {
    setSelectedShareId(definition.id);
    setShareMessage(null);
    requestAnimationFrame(() => {
      void (async () => {
        try {
          const result = await shareReportCard(shareRef, {
            fileName: `strideos-achievement-${definition.id}-${shareVariant}`,
            message: `StrideOS achievement: ${definition.title}`,
          });
          setShareMessage(result.status === 'shared' ? 'Achievement PNG created.' : result.reason);
        } catch (error) {
          Alert.alert('Share unavailable', error instanceof Error ? error.message : 'StrideOS could not create this achievement image.');
        }
      })();
    });
  }

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: C.bg }]} edges={['top']}>
      <ScreenHeader eyebrow="STRIDEOS" title="Achievements" onBack={() => router.back()} />
      <ScrollView
        contentContainerStyle={[s.content, { paddingBottom: LAYOUT.tabBarHeight + Math.max(insets.bottom, 16) + 28 }]}
        showsVerticalScrollIndicator={false}
      >
        <FeatureTourTarget targetId="achievements.hub" style={[s.hero, { backgroundColor: C.card, borderColor: C.primary }]}>
          <AchievementBadge id={activeLevel?.id ?? 'run_level_foundation'} category="run_level" size="medium" unitSystem={units} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[s.eyebrow, { color: C.textDim }]}>STRIDE PATH</Text>
            <Text style={[s.heroTitle, { color: C.text }]}>{activeLevel?.title ?? 'Starter'}</Text>
            <Text style={[s.body, { color: C.textMuted }]}>
              {metersToDisplay(activeLevel?.cumulativeMeters ?? 0, units)} lifetime running
              {nextLevel ? ` - next at ${metersToDisplay(nextLevel.thresholdMeters, units)}` : ' - highest level reached'}
            </Text>
            <RunLevelProgress currentMeters={activeLevel?.cumulativeMeters ?? 0} units={units} style={s.runLevelProgress} />
          </View>
        </FeatureTourTarget>

        <View style={[s.section, { borderColor: C.border }]}>
          <View style={s.sectionHeaderRow}>
            <Text style={[s.sectionTitle, { color: C.text }]}>Achievement System</Text>
            <Text style={[s.chevronsSmall, { color: C.primary }]}>{'>>>>>'}</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterRail}>
            {FAMILY_FILTERS.map(filter => {
              const active = familyFilter === filter;
              return (
                <TouchableOpacity
                  key={filter}
                  style={[s.filterChip, { backgroundColor: active ? C.primaryDim : C.card, borderColor: active ? C.primary : C.border }]}
                  onPress={() => setFamilyFilter(filter)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Text style={[s.filterText, { color: active ? C.primary : C.textMuted }]}>{familyFilterLabel(filter)}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          {canonicalVisible.slice(0, familyFilter === 'all' ? 36 : canonicalVisible.length).map(item => {
            const earned = item.state !== 'locked';
            return (
              <TouchableOpacity
                key={item.id}
                style={[s.badgeRow, { backgroundColor: earned ? C.primaryDim : C.cardAlt, borderColor: earned ? C.primary : C.border }]}
                onPress={() => router.push({ pathname: '/(tabs)/more/achievement-detail', params: { id: item.id } } as never)}
                accessibilityRole="button"
                accessibilityLabel={item.accessibilityLabel}
              >
                <AchievementBadge id={item.id} category={item.category} size="small" earned={earned} unitSystem={units} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[s.rowTitle, { color: C.text }]}>{item.title}</Text>
                  <Text style={[s.body, { color: C.textMuted }]}>
                    {achievementFamilyLabel(item.family)} - {earned && item.achievedDate ? `Earned ${shortDate(item.achievedDate)}` : item.displayRemaining}
                  </Text>
                  <View style={[s.progressTrack, { backgroundColor: C.card }]}>
                    <View style={[s.progressFill, { width: `${Math.round(item.progressPercentage * 100)}%` as `${number}%`, backgroundColor: earned ? C.primary : C.textDim }]} />
                  </View>
                </View>
                <Ionicons name={achievementShareAllowed(item) ? 'share-outline' : 'chevron-forward'} size={18} color={earned ? C.primary : C.textDim} />
              </TouchableOpacity>
            );
          })}
          {familyFilter === 'all' && canonicalVisible.length > 36 ? (
            <Text style={[s.body, { color: C.textMuted }]}>Use a family filter to browse all {canonicalVisible.length} canonical achievements.</Text>
          ) : null}
        </View>

        <View style={[s.section, { borderColor: C.border }]}>
          <TouchableOpacity
            style={[s.streakSummary, { backgroundColor: C.card, borderColor: C.border }]}
            onPress={() => setShowStreakLadder(value => !value)}
            accessibilityRole="button"
            accessibilityLabel="Open Streak achievement ladder"
          >
              <StreakBadge days={Math.max(1, model.streak.currentStreakDays)} size={78} compact={model.streak.currentStreakDays >= 1000} />
            <View style={s.streakSummaryCopy}>
              <View style={s.sectionHeaderRow}>
                <Text style={[s.eyebrow, { color: C.textDim }]}>CURRENT STREAK</Text>
                <Text style={[s.chevronsSmall, { color: C.primary }]}>{'>>>>>'}</Text>
              </View>
              <Text style={[s.streakCount, { color: C.text }]}>{model.streak.currentStreakDays} days</Text>
              <View style={s.streakStatGrid}>
                <View style={s.streakStat}>
                  <Text style={[s.streakStatLabel, { color: C.textDim }]}>CURRENT TIER</Text>
                  <Text style={[s.streakStatValue, { color: C.text }]}>{model.streak.currentTier?.displayName ?? 'Building'}</Text>
                </View>
                <View style={s.streakStat}>
                  <Text style={[s.streakStatLabel, { color: C.textDim }]}>NEXT</Text>
                  <Text style={[s.streakStatValue, { color: C.text }]}>{model.streak.nextMilestone?.displayName ?? 'Complete'}</Text>
                </View>
              </View>
              <Text style={[s.body, { color: C.textMuted }]}>
                {model.streak.nextMilestone ? `${model.streak.daysRemaining} days remaining` : 'Highest streak tier reached'}
              </Text>
              <StreakProgress days={model.streak.currentStreakDays} />
            </View>
          </TouchableOpacity>

          {showStreakLadder ? (
            <View style={s.streakLadder}>
              {model.streak.achievements.map(item => {
                const selected = item.state === 'current';
                return (
                  <View
                    key={item.id}
                    style={[
                      s.streakLadderRow,
                      {
                        backgroundColor: selected ? C.primaryDim : C.card,
                        borderColor: selected ? C.primary : item.complete ? item.dominantHeatColor : C.border,
                      },
                    ]}
                  >
                    <AchievementBadge id={item.id} category="streak" size="small" earned={item.complete} unitSystem={units} remainingDays={item.remainingDays} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={[s.rowTitle, { color: C.text }]}>{item.displayName}</Text>
                      <Text style={[s.body, { color: C.textMuted }]}>{streakThresholdDisplay(item)}</Text>
                      {item.complete && item.unlockedAt ? (
                        <Text style={[s.body, { color: C.textMuted }]}>Earned {shortDate(item.unlockedAt)}</Text>
                      ) : (
                        <Text style={[s.body, { color: C.textMuted }]}>Locked</Text>
                      )}
                    </View>
                    {item.complete ? (
                      <TouchableOpacity
                        style={[s.iconBtn, { backgroundColor: C.cardAlt, borderColor: C.border }]}
                        onPress={() => {
                          const definition = definitionFor(item.id);
                          if (definition) void shareAchievement(definition);
                        }}
                        accessibilityLabel={`Share ${item.displayName}`}
                      >
                        <Ionicons name="share-outline" size={17} color={C.primary} />
                      </TouchableOpacity>
                    ) : (
                      <View style={[s.dormantDot, { borderColor: C.textDim }]} />
                    )}
                  </View>
                );
              })}
            </View>
          ) : null}
        </View>

        <FeatureTourTarget targetId="achievements.elevation" style={[s.section, { borderColor: C.border }]}>
          <View style={s.sectionHeaderRow}>
            <Text style={[s.sectionTitle, { color: C.text }]}>Cumulative Elevation</Text>
            <Text style={[s.chevronsSmall, { color: C.primary }]}>{'>>>>>'}</Text>
          </View>
          {nextElevation ? (
            <View style={[s.nextMountainCard, { backgroundColor: C.card, borderColor: C.border }]}>
              <View style={s.nextMountainTop}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[s.eyebrow, { color: C.textDim }]}>NEXT LANDMARK</Text>
                  <Text style={[s.mountainTitle, { color: C.text }]}>{nextElevation.displayName}</Text>
                  <Text style={[s.body, { color: C.textMuted }]}>
                    {formatElevationMeters(nextElevation.cumulativeMeters, units)} / {elevationThresholdDisplay(nextElevation, units)}
                  </Text>
                </View>
                <Text style={[s.remaining, { color: C.primary }]}>
                  {formatElevationMeters(nextElevation.remainingMeters, units)} to go
                </Text>
              </View>
              <View style={[s.progressTrack, { backgroundColor: C.cardAlt }]}>
                <View style={[s.progressFill, { width: `${Math.round(nextElevation.progressRatio * 100)}%` as `${number}%`, backgroundColor: C.primary }]} />
              </View>
            </View>
          ) : (
            <View style={[s.nextMountainCard, { backgroundColor: C.card, borderColor: C.primary }]}>
              <Text style={[s.mountainTitle, { color: C.text }]}>Olympus Mons reached</Text>
              <Text style={[s.body, { color: C.textMuted }]}>Highest cumulative elevation landmark unlocked.</Text>
            </View>
          )}
          <View style={s.mountainGrid}>
            {model.cumulativeElevation.map(item => {
              const artwork = getElevationAchievementArtwork(item.id);
              const definition = definitionFor(item.id);
              return (
                <View key={item.id} style={[s.mountainCard, { backgroundColor: C.card, borderColor: item.complete ? C.primary : C.border }]}>
                  {artwork ? (
                    <Image source={artwork} style={[s.mountainImage, { opacity: item.complete ? 1 : 0.48 }]} resizeMode="cover" />
                  ) : (
                    <View style={[s.mountainImage, { backgroundColor: C.cardAlt }]} />
                  )}
                  <View style={s.mountainShade} />
                  {!item.complete ? (
                    <View style={[s.lockPill, { backgroundColor: C.card }]}>
                      <View style={[s.dormantDotSmall, { borderColor: C.textMuted }]} />
                      <Text style={[s.lockText, { color: C.textMuted }]}>DORMANT</Text>
                    </View>
                  ) : null}
                  <View style={s.mountainCopy}>
                    <Text style={s.mountainName}>{item.displayName.toUpperCase()}</Text>
                    <Text style={s.mountainValue}>{elevationThresholdDisplay(item, units).toUpperCase()}</Text>
                    <Text style={s.mountainDescriptor}>{item.measurementDescriptor}</Text>
                    {item.complete ? (
                      <Text style={s.mountainDate}>Unlocked {shortDate(item.unlockedAt)}</Text>
                    ) : (
                      <Text style={s.mountainDate}>{formatElevationMeters(item.remainingMeters, units)} remaining</Text>
                    )}
                  </View>
                  {item.complete && definition ? (
                    <TouchableOpacity
                      style={s.mountainShare}
                      onPress={() => { void shareAchievement(definition); }}
                      accessibilityLabel={`Share ${item.displayName} elevation achievement`}
                    >
                      <Ionicons name="share-outline" size={17} color="#F3F1EB" />
                    </TouchableOpacity>
                  ) : null}
                </View>
              );
            })}
          </View>
        </FeatureTourTarget>

        {model.personalRecords.length ? (
          <View style={[s.section, { borderColor: C.border }]}>
            <Text style={[s.sectionTitle, { color: C.text }]}>Personal Records</Text>
            {model.personalRecords.map(record => (
              <View key={record.id} style={[s.row, { borderColor: C.border }]}>
                <AchievementBadge id={record.id} category="personal_record" size="small" unitSystem={units} />
                <View style={{ flex: 1 }}>
                  <Text style={[s.rowTitle, { color: C.text }]}>{record.title}</Text>
                  <Text style={[s.body, { color: C.textMuted }]}>
                    {record.unit === 'seconds' ? formatDuration(record.value) : metersToDisplay(record.value, units)}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[s.iconBtn, { backgroundColor: C.cardAlt, borderColor: C.border }]}
                  onPress={() => {
                    const definition = definitionFor(record.id);
                    if (definition) void shareAchievement(definition);
                  }}
                  accessibilityLabel={`Share ${record.title}`}
                >
                  <Ionicons name="share-outline" size={17} color={C.primary} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        ) : null}

        {model.monthlyMilestones.length ? (
          <View style={[s.section, { borderColor: C.border }]}>
            <Text style={[s.sectionTitle, { color: C.text }]}>Monthly Distance</Text>
            {model.monthlyMilestones.slice(-6).reverse().map(milestone => (
              <View key={`${milestone.id}:${milestone.monthKey}`} style={[s.row, { borderColor: C.border }]}>
                <AchievementBadge id={milestone.id} category="monthly_distance" size="small" unitSystem={units} />
                <View style={{ flex: 1 }}>
                  <Text style={[s.rowTitle, { color: C.text }]}>{Math.round(milestone.thresholdMeters / 1000)}K Month</Text>
                  <Text style={[s.body, { color: C.textMuted }]}>{milestone.monthKey} - {metersToDisplay(milestone.distanceMeters, units)}</Text>
                </View>
                <Text style={[s.chevronsSmall, { color: C.primary }]}>{'>>>>>'}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={[s.section, { borderColor: C.border }]}>
          <Text style={[s.sectionTitle, { color: C.text }]}>Challenges</Text>
          {model.challengeProgress.map(item => (
            <View key={item.definition.id} style={[s.row, { borderColor: C.border }]}>
              <AchievementBadge id={item.definition.id} category="challenge" size="small" earned={item.complete} unitSystem={units} />
              <View style={{ flex: 1 }}>
                <Text style={[s.rowTitle, { color: C.text }]}>{item.definition.title}</Text>
                <Text style={[s.body, { color: C.textMuted }]}>
                  {item.definition.thresholdMeters
                    ? `${metersToDisplay(item.progress, units)} / ${metersToDisplay(item.target, units)}`
                    : `${item.progress} / ${item.target}`}
                </Text>
              </View>
              <Ionicons name={item.complete ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={item.complete ? C.positive : C.textDim} />
            </View>
          ))}
        </View>

        {(Object.keys(CATEGORY_LABELS) as AchievementCategory[]).map(category => {
          const definitions = grouped[category] ?? [];
          if (!definitions.length || category === 'challenge' || category === 'personal_record' || category === 'monthly_distance' || category === 'cumulative_elevation' || category === 'streak') return null;
          return (
            <View key={category} style={[s.section, { borderColor: C.border }]}>
              <Text style={[s.sectionTitle, { color: C.text }]}>{CATEGORY_LABELS[category]}</Text>
              {definitions.map(definition => {
                const earned = earnedIds.has(definition.id);
                return (
                  <View key={definition.id} style={[s.badgeRow, { backgroundColor: earned ? C.primaryDim : C.cardAlt, borderColor: earned ? C.primary : C.border }]}>
                    <AchievementBadge id={definition.id} category={definition.category} size="small" earned={earned} unitSystem={units} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={[s.rowTitle, { color: C.text }]}>{definition.title}</Text>
                      <Text style={[s.body, { color: C.textMuted }]}>{definition.description}</Text>
                    </View>
                    {earned ? (
                      <TouchableOpacity onPress={() => { void shareAchievement(definition); }} accessibilityLabel={`Share ${definition.title}`}>
                        <Ionicons name="share-outline" size={18} color={C.primary} />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                );
              })}
            </View>
          );
        })}

        {selectedShareDefinition ? (
          <FeatureTourTarget targetId="achievements.share" style={[s.section, { borderColor: C.border }]}>
            <Text style={[s.sectionTitle, { color: C.text }]}>Share Achievement</Text>
            <View style={s.variantGrid}>
              {ACHIEVEMENT_SHARE_VARIANTS.map(item => {
                const active = shareVariant === item.id;
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[s.variant, { backgroundColor: active ? C.primaryDim : C.card, borderColor: active ? C.primary : C.border }]}
                    onPress={() => setShareVariant(item.id)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                  >
                    <Text style={[s.variantLabel, { color: C.text }]}>{item.label}</Text>
                    <Text style={[s.variantDescription, { color: C.textMuted }]}>{item.description}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View ref={shareRef} collapsable={false} style={s.sharePreview}>
              <AchievementShareCard
                achievement={selectedShareDefinition}
                variant={shareVariant}
                units={units}
                detail={
                  selectedElevationShare
                    ? `${elevationThresholdDisplay(selectedElevationShare, units)} ${selectedElevationShare.measurementDescriptor}`
                    : selectedStreakShare
                      ? selectedStreakShare.milestoneLabel.toUpperCase()
                      : undefined
                }
              />
            </View>
            <TouchableOpacity
              style={[s.sharePrimary, { backgroundColor: C.primary }]}
              onPress={() => { void shareAchievement(selectedShareDefinition); }}
              accessibilityLabel={`Create ${selectedShareDefinition.title} achievement PNG`}
            >
              <Ionicons name="image-outline" size={17} color={C.onPrimary} />
              <Text style={[s.sharePrimaryText, { color: C.onPrimary }]}>Create Achievement PNG</Text>
            </TouchableOpacity>
            {shareMessage ? <Text style={[s.shareMessage, { color: C.textMuted }]}>{shareMessage}</Text> : null}
          </FeatureTourTarget>
        ) : null}

        {model.personalRecords.some(record => record.id === 'pr_highest_ride_elevation') ? (
          <Text style={[s.footnote, { color: C.textDim }]}>
            Elevation records use stored elevation gain, displayed here as {formatElevationMeters(100, units).replace('100', units === 'metric' ? 'meters' : 'feet')}.
          </Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  content: { paddingHorizontal: 18 },
  hero: { borderWidth: 1.5, borderRadius: 16, padding: 16, flexDirection: 'row', gap: 14, alignItems: 'center', marginBottom: 14 },
  runLevelProgress: { marginTop: 10 },
  chevrons: { fontSize: 17, fontWeight: '900', letterSpacing: 0 },
  chevronsSmall: { fontSize: 13, fontWeight: '900', letterSpacing: 0 },
  eyebrow: { fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  heroTitle: { fontSize: 26, fontFamily: 'CormorantGaramond_700Bold' },
  section: { borderTopWidth: 1, paddingTop: 14, marginTop: 4, marginBottom: 18 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '900', marginBottom: 10 },
  filterRail: { gap: 8, paddingBottom: 10 },
  filterChip: { minHeight: 36, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  filterText: { fontSize: 12, fontWeight: '900' },
  streakSummary: { borderWidth: 1, borderRadius: 16, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 14 },
  streakSummaryCopy: { flex: 1, minWidth: 0, gap: 8 },
  streakCount: { fontSize: 30, lineHeight: 34, fontWeight: '900', fontVariant: ['tabular-nums'] },
  streakStatGrid: { flexDirection: 'row', gap: 10 },
  streakStat: { flex: 1, minWidth: 0 },
  streakStatLabel: { fontSize: 9, lineHeight: 12, fontWeight: '900', letterSpacing: 0.8 },
  streakStatValue: { fontSize: 12, lineHeight: 16, fontWeight: '900' },
  streakLadder: { gap: 10, marginTop: 12 },
  streakLadderRow: { borderWidth: 1, borderRadius: 14, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  nextMountainCard: { borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 12 },
  nextMountainTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 12 },
  mountainTitle: { fontSize: 24, fontFamily: 'CormorantGaramond_700Bold' },
  remaining: { fontSize: 12, lineHeight: 17, fontWeight: '900', textAlign: 'right', maxWidth: 118 },
  progressTrack: { height: 8, borderRadius: 999, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 999 },
  mountainGrid: { gap: 12 },
  mountainCard: { minHeight: 320, borderWidth: 1, borderRadius: 18, overflow: 'hidden' },
  mountainImage: { ...StyleSheet.absoluteFill, width: '100%', height: '100%' },
  mountainShade: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0, 0, 0, 0.24)' },
  lockPill: { position: 'absolute', top: 14, left: 14, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7, flexDirection: 'row', alignItems: 'center', gap: 5 },
  lockText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  mountainCopy: { position: 'absolute', left: 18, right: 18, bottom: 18 },
  mountainName: { color: '#F3F1EB', fontSize: 32, lineHeight: 36, fontFamily: 'CormorantGaramond_700Bold' },
  mountainValue: { color: '#F3F1EB', fontSize: 19, fontWeight: '900', letterSpacing: 0.8, marginTop: 3 },
  mountainDescriptor: { color: '#DCC9B1', fontSize: 11, lineHeight: 15, fontWeight: '900', letterSpacing: 1.1, marginTop: 6 },
  mountainDate: { color: 'rgba(243, 241, 235, 0.82)', fontSize: 12, lineHeight: 17, fontWeight: '800', marginTop: 8 },
  mountainShare: { position: 'absolute', top: 14, right: 14, width: 38, height: 38, borderRadius: 999, backgroundColor: 'rgba(14, 14, 15, 0.72)', alignItems: 'center', justifyContent: 'center' },
  row: { borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  badgeRow: { borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowTitle: { fontSize: 14, fontWeight: '900' },
  body: { fontSize: 12, lineHeight: 18, marginTop: 2 },
  dormantDot: { width: 18, height: 18, borderRadius: 999, borderWidth: 2, opacity: 0.62 },
  dormantDotSmall: { width: 11, height: 11, borderRadius: 999, borderWidth: 1.5, opacity: 0.72 },
  iconBtn: { width: 38, height: 38, borderRadius: 11, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  variantGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  variant: { width: '31%', minHeight: 74, borderRadius: 12, borderWidth: 1, padding: 10 },
  variantLabel: { fontSize: 12, fontWeight: '900' },
  variantDescription: { fontSize: 10, lineHeight: 14, marginTop: 4 },
  sharePreview: { width: '100%', borderRadius: 18, overflow: 'hidden', marginBottom: 12 },
  sharePrimary: { minHeight: 48, borderRadius: 13, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  sharePrimaryText: { fontSize: 14, fontWeight: '900' },
  shareMessage: { fontSize: 12, lineHeight: 17, marginTop: 8 },
  footnote: { fontSize: 11, lineHeight: 16, marginTop: -8, marginBottom: 18 },
});
