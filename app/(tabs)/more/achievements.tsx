import { useMemo, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import ScreenHeader from '../../../src/components/layout/ScreenHeader';
import AchievementBadge from '../../../src/components/achievements/AchievementBadge';
import AchievementShareCard, {
  ACHIEVEMENT_SHARE_VARIANTS,
  type AchievementShareVariant,
} from '../../../src/components/achievements/AchievementShareCard';
import { LAYOUT } from '../../../src/constants/layout';
import { shareCardUnavailableReason, shareReportCard } from '../../../src/lib/shareCard';
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
  const [shareVariant, setShareVariant] = useState<AchievementShareVariant>('badge_square');
  const [selectedShareId, setSelectedShareId] = useState<string | null>(null);
  const [shareMessage, setShareMessage] = useState<string | null>(shareCardUnavailableReason());
  const shareRef = useRef<View>(null);
  const model = useMemo(
    () => buildAchievementHubModel(activities, awarded.map(item => item.id)),
    [activities, awarded],
  );

  const earnedIds = new Set(model.shareable.map(item => item.id));
  const selectedShareDefinition = model.shareable.find(item => item.id === (selectedShareId ?? model.shareable[0]?.id));
  const activeLevel = [...model.strideLevels].reverse().find(item => item.complete) ?? model.strideLevels[0];
  const nextLevel = model.strideLevels.find(item => !item.complete);
  const grouped = model.definitions.reduce<Record<string, AchievementDefinition[]>>((acc, definition) => {
    const category = definition.category ?? 'healthy_progress';
    acc[category] = [...(acc[category] ?? []), definition];
    return acc;
  }, {});

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
        <View style={[s.hero, { backgroundColor: C.card, borderColor: C.primary }]}>
          <AchievementBadge id={activeLevel?.id ?? 'stride_level_starter'} category="stride_level" size="medium" />
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
                <AchievementBadge id={record.id} category="personal_record" size="small" />
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
                <AchievementBadge id={milestone.id} category="monthly_distance" size="small" />
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
              <AchievementBadge id={item.definition.id} category="challenge" size="small" earned={item.complete} />
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
                    <AchievementBadge id={definition.id} category={definition.category} size="small" earned={earned} />
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
          <View style={[s.section, { borderColor: C.border }]}>
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
              <AchievementShareCard achievement={selectedShareDefinition} variant={shareVariant} />
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
          </View>
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
  chevrons: { fontSize: 17, fontWeight: '900', letterSpacing: 0 },
  chevronsSmall: { fontSize: 13, fontWeight: '900', letterSpacing: 0 },
  eyebrow: { fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  heroTitle: { fontSize: 26, fontFamily: 'CormorantGaramond_700Bold' },
  section: { borderTopWidth: 1, paddingTop: 14, marginTop: 4, marginBottom: 18 },
  sectionTitle: { fontSize: 18, fontWeight: '900', marginBottom: 10 },
  row: { borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  badgeRow: { borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowTitle: { fontSize: 14, fontWeight: '900' },
  body: { fontSize: 12, lineHeight: 18, marginTop: 2 },
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
