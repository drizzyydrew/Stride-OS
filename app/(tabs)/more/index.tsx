import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColors } from '../../../src/theme/useColors';
import { spacing } from '../../../src/theme/spacing';
import { FontSize, FontWeight, Radius } from '../../../src/theme/tokens';

type NavItem = {
  label:       string;
  description: string;
  icon:        keyof typeof Ionicons.glyphMap;
  route:       string;
};

const NAV_ITEMS: NavItem[] = [
  {
    label:       'Running',
    description: 'Training plans, pace targets, GPS runs',
    icon:        'footsteps-outline',
    route:       '/(tabs)/training',
  },
  {
    label:       'Strength',
    description: 'Concurrent strength sessions',
    icon:        'fitness-outline',
    route:       '/(tabs)/strength',
  },
  {
    label:       'Analytics',
    description: 'Load, readiness, and performance trends',
    icon:        'stats-chart-outline',
    route:       '/(tabs)/analytics',
  },
  {
    label:       'Movement Lab',
    description: 'Gait analysis and video library',
    icon:        'scan-outline',
    route:       '/(tabs)/movement',
  },
  {
    label:       'Profile & Settings',
    description: 'Athlete profile, zones, appearance',
    icon:        'person-outline',
    route:       '/(tabs)/profile',
  },
];

export default function MoreScreen() {
  const c      = useColors();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { backgroundColor: c.bg }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Text style={[styles.title, { color: c.text }]}>More</Text>
        <Text style={[styles.subtitle, { color: c.textMuted }]}>All sections</Text>
      </View>

      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {NAV_ITEMS.map(item => (
          <Pressable
            key={item.route}
            style={({ pressed }) => [
              styles.row,
              { backgroundColor: c.card, borderColor: c.border },
              pressed && { opacity: 0.7 },
            ]}
            onPress={() => router.push(item.route as never)}
          >
            <View style={[styles.iconWrap, { backgroundColor: c.primaryDim }]}>
              <Ionicons name={item.icon} size={22} color={c.primary} />
            </View>
            <View style={styles.rowText}>
              <Text style={[styles.rowLabel, { color: c.text }]}>{item.label}</Text>
              <Text style={[styles.rowDesc, { color: c.textMuted }]}>{item.description}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={c.textSubtle} />
          </Pressable>
        ))}
        <View style={{ height: spacing.screenPadBottom }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    paddingHorizontal: spacing.xl,
    paddingBottom:     spacing.lg,
  },
  title: {
    fontSize:   42,
    fontWeight: FontWeight.black,
  },
  subtitle: {
    fontSize:  FontSize.sm,
    marginTop: 2,
  },
  list: {
    paddingHorizontal: spacing.xl,
    gap:               spacing.sm,
  },
  row: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            spacing.md,
    borderRadius:   Radius.md,
    borderWidth:    1,
    padding:        spacing.md,
  },
  iconWrap: {
    width:          44,
    height:         44,
    borderRadius:   Radius.sm,
    alignItems:     'center',
    justifyContent: 'center',
    flexShrink:     0,
  },
  rowText: {
    flex: 1,
    gap:  2,
  },
  rowLabel: {
    fontSize:   FontSize.base,
    fontWeight: FontWeight.bold,
  },
  rowDesc: {
    fontSize:   FontSize.xs,
    lineHeight: 16,
  },
});
