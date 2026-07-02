import { Tabs } from 'expo-router';

import TabIcon from '../../src/navigation/TabIcon';
import { LAYOUT } from '../../src/constants/layout';
import { useThemeColors } from '../../src/theme/ThemeContext';

export default function TabsLayout() {
  const colors = useThemeColors();

  return (
    <Tabs
      screenOptions={{
        headerShown:             false,
        tabBarShowLabel:         false,
        tabBarActiveTintColor:   colors.primary,
        tabBarInactiveTintColor: colors.textDim,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor:  colors.border,
          borderTopWidth:  1,
          height:          LAYOUT.tabBarHeight,
          paddingBottom:   LAYOUT.tabBarPadBottom,
          paddingTop:      LAYOUT.tabBarPadTop,
        },
      }}
    >
      <Tabs.Screen
        name="dashboard/index"
        options={{
          title: 'Today',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              name="today-outline"
              label="Today"
              focused={focused}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="training"
        options={{
          title: 'Running',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              name="footsteps-outline"
              label="Running"
              focused={focused}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="strength"
        options={{
          title: 'Strength',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              name="fitness-outline"
              label="Strength"
              focused={focused}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="analytics/index"
        options={{
          title: 'Analytics',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              name="stats-chart-outline"
              label="Analytics"
              focused={focused}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="calendar"
        options={{
          title: 'Calendar',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              name="calendar-outline"
              label="Calendar"
              focused={focused}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="movement"
        options={{
          title: 'Movement',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              name="scan-outline"
              label="Movement"
              focused={focused}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="profile/index"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              name="person-outline"
              label="Profile"
              focused={focused}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}
