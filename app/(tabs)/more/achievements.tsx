import { useMemo } from 'react';
import { ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import ScreenHeader from '../../../src/components/layout/ScreenHeader';
import { LAYOUT } from '../../../src/constants/layout';
import { useActivityStore } from '../../../src/store/activityStore';
import { useAchievementStore } from '../../../src/store/achievementStore';
import { useSettingsStore } from '../../../src/store/settingsStore';
import { useColors } from '../../../src/theme/useColors';
import {
  buildAchievementHubModel,
  BUILD57_ACHIEVEMENT_DEFINITIONS,
  type AchievementCategory,
  type AchievementDefinition,
} from '../../../src/utils/achievements';
import { formatDistance } from '../../../src/lib/units';
import { formatDuration, formatElevationMeters } from '../../../src/utils/activitySummary';

const CATEGORY_LABELS: Record<AchievementCategory, string> = {
  healthy_progress: 'Healthy Progress',
  personal_record: 'Personal Records',
  monthly_distance: 'Monthly Distance',
  consistency: 'Consistency',
  training_quality: 'Training Quality',
  challenge: 'Challenges',
  stride_level: 'Stride Levels',
};

function metersToDisplay(meters: number, units: 'imperial' | 'metric'): string {
  return formatDistance(meters / 1609.344, units);
}

function definitionFor(id: string): AchievementDefinition | undefined {
  return BUILD57_ACHIEVEMENT_DEFINITIONS.find(item => item.id === id);
}

export default function AchievementHubScreen() {
  const C = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const activities = useActivityStore(state => state.activities);
  const awarded = useAchievementStore(state => state.awarded);
  const units = useSettingsStore(state => state.units);
  const model = useMemo(
    () => buildAchievementHubModel(activities, awarded.map(item => item.id)),
    [activities, awarded],
  );

  const earnedIds = new Set(model.shareable.map(item => item.id));
  const activeLevel = [...model.strideLevels].reverse().find(item => item.complete) ?? model.strideLevels[0];
  const nextLevel = model.strideLevels.find(item => !item.complete);
  const grouped = model.definitions.reduce<Record<string, AchievementDefinition[]>>((acc, definition) => {
    const category = definition.category ?? 'healthy_progress';
    acc[category] = [...(acc[category] ?? []), definition];
    return acc;
  }, {});

  async function shareAchievement(definition: AchievementDefinition) {
    await Share.share({
      message: `StrideOS\n${definition.title}\n${definition.description}`,
    });
  }

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: C.bg }]} edges={['top']}>
      <ScreenHeader eyebrow="STRIDEOS" title="Achievements" onBack={() => router.back()} />
      <ScrollView
        contentContainerStyle={[s.content, { paddingBottom: LAYOUT.tabBarHeight + Math.max(insets.bottom, 16) + 28 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[s.hero, { backgroundColor: C.card, borderColor: C.primary }]}>
          <View style={[s.levelBadge, { backgroundColor: C.primaryDim, borderColor: C.primary }]}>
            <Text style={[s.chevrons, { color: C.primary }]}>{'>>>>>'}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[s.eyebrow, { color: C.textDim }]}>STRIDE PATH</Text>
            <Text style={[s.heroTitle, { color: C.text }]}>{activeLevel?.title ?? 'Starter'}</Text>
            <Text style={[s.body, { color: C.textMuted }]}>
              {metersToDisplay(activeLevel?.cumulativeMeters ?? 0, units)} cumulative movement
              {nextLevel ? ` - next at ${metersToDisplay(nextLevel.thresholdMeters, units)}` : ' - highest level reached'}
            </Text>
          </View>
        </View>

        {model.personalRecords.length ? (
          <View style={[s.section, { borderColor: C.border }]}>
            <Text style={[s.sectionTitle, { color: C.text }]}>Personal Records</Text>
            {model.personalRecords.map(record => (
              <View key={record.id} style={[s.row, { borderColor: C.border }]}>
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
          if (!definitions.length || category === 'challenge' || category === 'personal_record' || category === 'monthly_distance') return null;
          return (
            <View key={category} style={[s.section, { borderColor: C.border }]}>
              <Text style={[s.sectionTitle, { color: C.text }]}>{CATEGORY_LABELS[category]}</Text>
              {definitions.map(definition => {
                const earned = earnedIds.has(definition.id);
                return (
                  <View key={definition.id} style={[s.badgeRow, { backgroundColor: earned ? C.primaryDim : C.cardAlt, borderColor: earned ? C.primary : C.border }]}>
                    <View style={[s.miniMark, { borderColor: earned ? C.primary : C.textDim }]}>
                      <Text style={[s.miniChevron, { color: earned ? C.primary : C.textDim }]}>{'>'}</Text>
                    </View>
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
  levelBadge: { width: 70, height: 70, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  chevrons: { fontSize: 17, fontWeight: '900', letterSpacing: 0 },
  chevronsSmall: { fontSize: 13, fontWeight: '900', letterSpacing: 0 },
  miniMark: { width: 30, height: 30, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  miniChevron: { fontSize: 18, fontWeight: '900' },
  eyebrow: { fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  heroTitle: { fontSize: 26, fontFamily: 'CormorantGaramond_700Bold' },
  section: { borderTopWidth: 1, paddingTop: 14, marginTop: 4, marginBottom: 18 },
  sectionTitle: { fontSize: 18, fontWeight: '900', marginBottom: 10 },
  row: { borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  badgeRow: { borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowTitle: { fontSize: 14, fontWeight: '900' },
  body: { fontSize: 12, lineHeight: 18, marginTop: 2 },
  iconBtn: { width: 38, height: 38, borderRadius: 11, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  footnote: { fontSize: 11, lineHeight: 16, marginTop: -8, marginBottom: 18 },
});
