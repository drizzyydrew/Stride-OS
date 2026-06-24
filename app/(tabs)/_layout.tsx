import { Tabs } from 'expo-router';

import TabIcon from '../../src/navigation/TabIcon';
import { LAYOUT } from '../../src/constants/layout';
import { useThemeStore } from '../../src/store/themeStore';
import { getColors } from '../../src/theme/colors';

export default function TabsLayout() {
  const mode   = useThemeStore(s => s.mode);
  const colors = getColors(mode);

  return (
    <Tabs
      screenOptions={{
        headerShown:             false,
        tabBarShowLabel:         false,
        tabBarActiveTintColor:   colors.text,
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
      {/* ── Visible tabs (3) ─────────────────────────────────── */}
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
        name="more/index"
        options={{
          title: 'More',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              name="apps-outline"
              label="More"
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

      {/* ── Hidden tabs — routes still accessible via router.push ── */}
      <Tabs.Screen name="training"        options={{ href: null }} />
      <Tabs.Screen name="strength"        options={{ href: null }} />
      <Tabs.Screen name="analytics/index" options={{ href: null }} />
      <Tabs.Screen name="calendar"        options={{ href: null }} />
      <Tabs.Screen name="movement"        options={{ href: null }} />
      <Tabs.Screen name="coach"           options={{ href: null }} />
    </Tabs>
  );
}
