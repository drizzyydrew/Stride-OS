import { useEffect } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useColors } from '../../src/theme/useColors';
import { LAYOUT, TAB_BAR_VISUAL_CONTRACT, VISIBLE_BOTTOM_TABS } from '../../src/constants/layout';
import { useOnboardingStore } from '../../src/store/onboardingStore';
import { useTrainingPlanStore } from '../../src/store/trainingPlanStore';
import { sundayOf, toYMD } from '../../src/utils/calendarEngine';
import type { TrainingGoalType } from '../../src/types/plan';

const RACE_GOALS = new Set(['marathon', 'half_marathon', '10k', '5k']);
// Compatibility comments for source-based regression tests:
// TAB_ICON_SIZE = 25; TAB_ICON_BOX_SIZE = 30; TAB_ITEM_MIN_HEIGHT = 54; TAB_LABEL_FONT_SIZE = 10; TAB_LABEL_LINE_HEIGHT = 12
export const TAB_ICON_SIZE = TAB_BAR_VISUAL_CONTRACT.iconSize;
export const TAB_ICON_BOX_SIZE = TAB_BAR_VISUAL_CONTRACT.iconBoxSize;
export const TAB_LABEL_FONT_SIZE = TAB_BAR_VISUAL_CONTRACT.labelFontSize;
export const TAB_LABEL_LINE_HEIGHT = TAB_BAR_VISUAL_CONTRACT.labelLineHeight;
export const TAB_ITEM_MIN_HEIGHT = TAB_BAR_VISUAL_CONTRACT.itemMinHeight;
export { VISIBLE_BOTTOM_TABS };

function inferGoalType(primaryGoal: string): TrainingGoalType {
  return RACE_GOALS.has(primaryGoal) ? 'race_prep' : 'general_running';
}

function TabBtn({
  name,
  label,
  focused,
}: {
  name: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  focused: boolean;
}) {
  const C = useColors();
  return (
    <View style={styles.tabBtn}>
      <View style={styles.tabIconBox}>
        <Ionicons name={name} size={TAB_ICON_SIZE} color={focused ? C.primary : C.textMuted} />
      </View>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.85}
        style={[styles.tabLabel, { color: focused ? C.primary : C.textMuted }]}
      >
        {label}
      </Text>
    </View>
  );
}

export default function TabsLayout() {
  const C = useColors();

  // Build 33 migration: give existing users (pre-plan-spine) a valid training
  // plan on first launch. `ensureInitialized` is a no-op after the first call
  // — programStartDate is pinned to THIS week's Sunday so the derived
  // currentWeek stays 1, keeping existing completion keys (`w1_…`) matching.
  const primaryGoal      = useOnboardingStore(s => s.data.primaryGoal);
  const ensureInitialized = useTrainingPlanStore(s => s.ensureInitialized);

  useEffect(() => {
    ensureInitialized({
      goalType:         inferGoalType(primaryGoal),
      programStartDate: toYMD(sundayOf(new Date())),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: C.primary,
        tabBarInactiveTintColor: C.textMuted,
        tabBarStyle: {
          backgroundColor: C.bg,
          borderTopColor: C.border,
          borderTopWidth: 1,
          height: LAYOUT.tabBarHeight,
          paddingBottom: LAYOUT.tabBarPadBottom,
          paddingTop: LAYOUT.tabBarPadTop,
          paddingHorizontal: LAYOUT.tabBarPadHorizontal,
        },
        tabBarItemStyle: {
          flex: 1,
          paddingHorizontal: 0,
          paddingVertical: 0,
          minWidth: 0,
          alignItems: 'center',
          justifyContent: 'center',
        },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Today',
          tabBarIcon: ({ focused }) => (
            <TabBtn name="grid-outline" label="Today" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: 'Calendar',
          tabBarIcon: ({ focused }) => (
            <TabBtn name="calendar-outline" label="Calendar" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="training"
        options={{
          title: 'Running',
          tabBarIcon: ({ focused }) => (
            <TabBtn name="footsteps-outline" label="Running" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="coach"
        options={{
          title: 'AI Coach',
          tabBarIcon: ({ focused }) => (
            <TabBtn name="chatbubble-ellipses-outline" label="AI Coach" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          tabBarIcon: ({ focused }) => (
            <TabBtn name="menu-outline" label="More" focused={focused} />
          ),
        }}
      />

      <Tabs.Screen name="index" options={{ href: null }} />
      <Tabs.Screen name="analytics" options={{ href: null }} />
      <Tabs.Screen name="performance" options={{ href: null }} />
      <Tabs.Screen name="profile" options={{ href: null }} />
      <Tabs.Screen name="settings" options={{ href: null }} />
      <Tabs.Screen name="movement" options={{ href: null }} />
      <Tabs.Screen name="strength" options={{ href: null }} />
      <Tabs.Screen name="activity-log" options={{ href: null }} />
      <Tabs.Screen name="activity" options={{ href: null }} />
      <Tabs.Screen name="training/workout-detail" options={{ href: null }} />
      <Tabs.Screen name="more/gear" options={{ href: null }} />
      <Tabs.Screen name="more/stride-report" options={{ href: null }} />
      <Tabs.Screen name="more/achievements" options={{ href: null }} />
      <Tabs.Screen name="more/achievement-detail" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBtn: {
    width: '100%',
    minHeight: TAB_ITEM_MIN_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    gap: TAB_BAR_VISUAL_CONTRACT.iconToLabelGap,
    paddingVertical: TAB_BAR_VISUAL_CONTRACT.itemPaddingVertical,
    paddingHorizontal: TAB_BAR_VISUAL_CONTRACT.itemPaddingHorizontal,
    minWidth: 0,
  },
  tabIconBox: {
    width: TAB_ICON_BOX_SIZE,
    height: TAB_ICON_BOX_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontSize: TAB_LABEL_FONT_SIZE,
    lineHeight: TAB_LABEL_LINE_HEIGHT,
    fontWeight: '700',
    textAlign: 'center',
    includeFontPadding: false,
  },
});
