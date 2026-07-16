import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { LAYOUT } from '../../../src/constants/layout';
import { useColors } from '../../../src/theme/useColors';
import ScreenHeader from '../../../src/components/layout/ScreenHeader';

type NavItem = {
  label:       string;
  icon:        keyof typeof Ionicons.glyphMap;
  route:       string;
};

const ITEMS: NavItem[] = [
  {
    label:       'Activity',
    icon:        'pulse-outline',
    route:       '/(tabs)/activity',
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
  },
  {
    label:       'Adaptive Performance',
    icon:        'speedometer-outline',
    route:       '/(tabs)/performance',
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
          {ITEMS.map(item => (
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
});
