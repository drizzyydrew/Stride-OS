import { useEffect, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { LAYOUT } from '../../../src/constants/layout';
import { useColors } from '../../../src/theme/useColors';
import ScreenHeader from '../../../src/components/layout/ScreenHeader';
import { experienceModeAllows, useExperienceMode } from '../../../src/hooks/useExperienceMode';
import type { ExperienceMode } from '../../../src/store/settingsStore';
import { useActivityStore } from '../../../src/store/activityStore';
import { useAchievementStore } from '../../../src/store/achievementStore';
import { evaluateAchievementAwards, HEALTHY_ACHIEVEMENTS } from '../../../src/utils/achievements';

type NavItem = {
  label:       string;
  icon:        keyof typeof Ionicons.glyphMap;
  route:       string;
  minMode?:    ExperienceMode;
};

const ITEMS: NavItem[] = [
  {
    label:       'Activity',
    icon:        'pulse-outline',
    route:       '/(tabs)/activity',
  },
  {
    label:       'Gear',
    icon:        'trail-sign-outline',
    route:       '/(tabs)/more/gear',
  },
  {
    label:       'Stride Report',
    icon:        'share-social-outline',
    route:       '/(tabs)/more/stride-report',
  },
  {
    label:       'Achievements',
    icon:        'sparkles-outline',
    route:       '/(tabs)/more/achievements',
  },
  {
    label:       'Movement Lab',
    icon:        'body-outline',
    route:       '/(tabs)/movement',
  },
  {
    label:       'Analytics',
    icon:        'stats-chart-outline',
    route:       '/(tabs)/analytics',
    minMode:     'balanced',
  },
  {
    label:       'Adaptive Performance',
    icon:        'speedometer-outline',
    route:       '/(tabs)/performance',
    minMode:     'balanced',
  },
  {
    label:       'Profile',
    icon:        'person-outline',
    route:       '/(tabs)/profile',
  },
  {
    label:       'Settings',
    icon:        'settings-outline',
    route:       '/(tabs)/settings',
  },
];

export default function MoreScreen() {
  const insets = useSafeAreaInsets();
  const C = useColors();
  const experienceMode = useExperienceMode();
  const visibleItems = ITEMS.filter(item => !item.minMode || experienceModeAllows(experienceMode, item.minMode));
  const activities = useActivityStore(state => state.activities);
  const awarded = useAchievementStore(state => state.awarded);
  const recordAwards = useAchievementStore(state => state.recordAwards);
  const earnedAwards = useMemo(
    () => evaluateAchievementAwards(activities, awarded.map(item => item.id)),
    [activities, awarded],
  );
  const earnedIds = useMemo(() => earnedAwards.map(item => item.id), [earnedAwards]);
  const newestAchievement = HEALTHY_ACHIEVEMENTS.find(item => earnedIds.includes(item.id));

  useEffect(() => {
    recordAwards(earnedAwards);
  }, [earnedAwards, recordAwards]);

  return (
    <View style={[s.root, { backgroundColor: C.bg }]}>
      <View style={{ paddingTop: insets.top }}>
        <ScreenHeader eyebrow="STRIDEOS" title="More" />
      </View>
      <ScrollView
        contentContainerStyle={[
          s.content,
          { paddingBottom: LAYOUT.tabBarHeight + Math.max(insets.bottom, 16) + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.grid}>
          {visibleItems.map(item => (
            <Pressable
              key={item.route}
              style={({ pressed }) => [
                s.card,
                { backgroundColor: C.bg, borderColor: C.border },
                pressed && s.cardPressed,
              ]}
              onPress={() => router.push(item.route as any)}
            >
              <Ionicons name={item.icon} size={20} color={C.primary} />
              <Text style={[s.label, { color: C.text }]}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
        {newestAchievement ? (
          <View style={[s.achievementCard, { backgroundColor: C.bg, borderColor: C.border }]}>
            <Text style={[s.eyebrow, { color: C.textDim }]}>HEALTHY PROGRESS</Text>
            <Text style={[s.achievementTitle, { color: C.text }]}>{newestAchievement.title}</Text>
            <Text style={[s.achievementCopy, { color: C.textMuted }]}>{newestAchievement.description}</Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 18,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  card: {
    width: '48%',
    minHeight: 84,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    gap: 6,
  },
  cardPressed: {
    opacity: 0.7,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
  },
  achievementCard: {
    marginTop: 14,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  achievementTitle: {
    fontSize: 16,
    fontWeight: '900',
    marginTop: 6,
  },
  achievementCopy: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
});
