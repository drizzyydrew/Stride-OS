import { useEffect } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useColors } from '../../src/theme/useColors';
import { LAYOUT } from '../../src/constants/layout';
import { useOnboardingStore } from '../../src/store/onboardingStore';
import { useTrainingPlanStore } from '../../src/store/trainingPlanStore';
import { sundayOf, toYMD } from '../../src/utils/calendarEngine';
import type { TrainingGoalType } from '../../src/types/plan';

const RACE_GOALS = new Set(['marathon', 'half_marathon', '10k', '5k']);

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
      <Ionicons name={name} size={22} color={focused ? C.primary : C.textMuted} />
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
        },
      }}
    >
      <Tabs.Screen
        name="dashboard/index"
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
        name="coach"
        options={{
          title: 'AI Coach',
          tabBarIcon: ({ focused }) => (
            <TabBtn name="chatbubble-ellipses-outline" label="AI Coach" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="more/index"
        options={{
          title: 'More',
          tabBarStyle: { display: 'none' },
          tabBarIcon: ({ focused }) => (
            <TabBtn name="menu-outline" label="More" focused={focused} />
          ),
        }}
      />

      <Tabs.Screen name="index" options={{ href: null }} />
      <Tabs.Screen name="training" options={{ href: null }} />
      <Tabs.Screen name="strength" options={{ href: null }} />
      <Tabs.Screen name="analytics/index" options={{ href: null }} />
      <Tabs.Screen name="performance" options={{ href: null }} />
      <Tabs.Screen name="profile/index" options={{ href: null }} />
      <Tabs.Screen name="profile/calibration" options={{ href: null }} />
      <Tabs.Screen name="profile/availability" options={{ href: null }} />
      <Tabs.Screen name="settings" options={{ href: null }} />
      <Tabs.Screen name="movement" options={{ href: null }} />
      <Tabs.Screen name="activity-log/index" options={{ href: null }} />
      <Tabs.Screen name="activity-log/[entryId]" options={{ href: null }} />
      <Tabs.Screen name="activity" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
    paddingVertical: 4,
    minWidth: 64,
  },
  tabLabel: {
    fontSize: 9,
    fontWeight: '700',
    textAlign: 'center',
  },
});
