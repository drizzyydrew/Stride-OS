import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { LAYOUT } from '../../../src/constants/layout';
import { useColors } from '../../../src/theme/useColors';

type NavItem = {
  label:       string;
  icon:        keyof typeof Ionicons.glyphMap;
  route:       string;
};

const ITEMS: NavItem[] = [
  {
    label:       'Running',
    icon:        'footsteps-outline',
    route:       '/(tabs)/training',
  },
  {
    label:       'Strength',
    icon:        'fitness-outline',
    route:       '/(tabs)/strength',
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
    <View style={s.root}>
      <Pressable
        style={s.backdrop}
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel="Close More"
      />
      <View
        style={[
          s.sheet,
          {
            backgroundColor: C.card,
            paddingBottom: Math.max(insets.bottom + 28, LAYOUT.screenPadBottom),
          },
        ]}
      >
        <View style={[s.sheetHandle, { backgroundColor: C.border }]} />
        <Text style={[s.headerLabel, { color: C.textDim }]}>MORE</Text>
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
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  sheet: {
    paddingHorizontal: 18,
    paddingTop: 18,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 18,
  },
  headerLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 12,
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
