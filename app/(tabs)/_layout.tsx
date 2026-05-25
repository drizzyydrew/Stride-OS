import { Tabs } from 'expo-router';

import TabIcon from '../../src/navigation/TabIcon';
import { LAYOUT } from '../../src/constants/layout';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown:             false,
        tabBarShowLabel:         false,
        tabBarActiveTintColor:   '#FFFFFF',
        tabBarInactiveTintColor: '#3D4A5C',
        tabBarStyle: {
          backgroundColor: '#050B14',
          borderTopColor:  '#0D1520',
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
          title: 'Training',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              name="barbell-outline"
              label="Training"
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
