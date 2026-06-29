import { View, StyleSheet, Text } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useColors } from '../../src/theme/useColors';
import { LAYOUT } from '../../src/constants/layout';

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
      <Tabs.Screen name="settings/index" options={{ href: null }} />
      <Tabs.Screen name="movement" options={{ href: null }} />
      <Tabs.Screen name="activity-log/index" options={{ href: null }} />
      <Tabs.Screen name="activity-log/[entryId]" options={{ href: null }} />
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
