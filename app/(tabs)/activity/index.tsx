import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useActivityStore } from '../../../src/store/activityStore';
import { useColors } from '../../../src/theme/useColors';
import type { Activity, ActivityFilter, ActivityType } from '../../../src/types/activity';
import { activityMatchesFilter, summarizeActivityLoad } from '../../../src/utils/activityLoad';

const FILTERS: { key: ActivityFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'running', label: 'Running' },
  { key: 'walking', label: 'Walking' },
  { key: 'cycling', label: 'Cycling' },
  { key: 'swimming', label: 'Swimming' },
  { key: 'hiking', label: 'Hiking' },
  { key: 'skiing', label: 'Skiing' },
  { key: 'strength', label: 'Strength' },
  { key: 'mobility', label: 'Mobility' },
  { key: 'hiit_mixed', label: 'HIIT / Mixed' },
  { key: 'other', label: 'Other' },
];

function labelFor(type: ActivityType): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());
}

function iconFor(type: ActivityType): keyof typeof Ionicons.glyphMap {
  if (type === 'running' || type === 'walking' || type === 'hiking') return 'footsteps-outline';
  if (type === 'cycling' || type === 'indoor_cycling') return 'bicycle-outline';
  if (type === 'swimming') return 'water-outline';
  if (type.includes('skiing')) return 'snow-outline';
  if (type === 'strength') return 'barbell-outline';
  if (type === 'mobility') return 'body-outline';
  return 'fitness-outline';
}

function metricLine(activity: Activity): string {
  const duration = Math.round((activity.metrics.durationSeconds ?? 0) / 60);
  const distanceMiles = (activity.metrics.distanceMeters ?? 0) / 1609.344;
  const details = [`${duration} min`];
  if (distanceMiles > 0) details.push(`${distanceMiles.toFixed(2)} mi`);
  if (activity.rpe) details.push(`RPE ${activity.rpe}`);
  details.push(`Load ${Math.round(activity.trainingLoad.wholeBody)}`);
  return details.join(' · ');
}

export default function ActivityScreen() {
  const C = useColors();
  const router = useRouter();
  const activities = useActivityStore(state => state.activities);
  const [filter, setFilter] = useState<ActivityFilter>('all');
  const visible = useMemo(() => activities
    .filter(activity => activityMatchesFilter(activity, filter))
    .sort((a, b) => b.startTime - a.startTime), [activities, filter]);
  const weekly = useMemo(() => summarizeActivityLoad(
    activities.filter(activity => Date.now() - activity.startTime <= 7 * 24 * 60 * 60 * 1000),
  ), [activities]);

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: C.bg }]} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.iconButton} accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={24} color={C.text} />
        </TouchableOpacity>
        <View style={s.headerCopy}>
          <Text style={[s.eyebrow, { color: C.textDim }]}>ALL TRAINING</Text>
          <Text style={[s.title, { color: C.text }]}>Activity</Text>
        </View>
        <TouchableOpacity onPress={() => router.push('/(tabs)/activity/manual' as never)} style={s.iconButton} accessibilityLabel="Log activity">
          <Ionicons name="add" size={25} color={C.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <View style={s.actions}>
          <TouchableOpacity
            style={[s.action, { backgroundColor: C.primary }]}
            onPress={() => router.push('/(tabs)/activity/start' as never)}
          >
            <Ionicons name="navigate-outline" size={18} color={C.onPrimary} />
            <Text style={[s.actionText, { color: C.onPrimary }]}>Track Outdoor</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.action, { backgroundColor: C.card, borderColor: C.border }]}
            onPress={() => router.push('/(tabs)/activity/plans' as never)}
          >
            <Ionicons name="flag-outline" size={18} color={C.primary} />
            <Text style={[s.actionText, { color: C.text }]}>Preset Plans</Text>
          </TouchableOpacity>
        </View>

        <View style={[s.loadCard, { backgroundColor: C.card, borderColor: C.border }]}>
          <View style={s.row}>
            <View>
              <Text style={[s.cardLabel, { color: C.textDim }]}>7-DAY WHOLE-BODY LOAD</Text>
              <Text style={[s.loadValue, { color: C.text }]}>{Math.round(weekly.wholeBody)}</Text>
            </View>
            <TouchableOpacity onPress={() => router.push('/(tabs)/activity/preferences' as never)}>
              <Text style={[s.link, { color: C.primary }]}>Training preferences</Text>
            </TouchableOpacity>
          </View>
          <View style={s.loadGrid}>
            <Text style={[s.loadSmall, { color: C.textMuted }]}>Running {Math.round(weekly.running)}</Text>
            <Text style={[s.loadSmall, { color: C.textMuted }]}>Walking {Math.round(weekly.walking)}</Text>
            <Text style={[s.loadSmall, { color: C.textMuted }]}>Cross {Math.round(weekly.crossTraining)}</Text>
            <Text style={[s.loadSmall, { color: C.textMuted }]}>Strength {Math.round(weekly.strength)}</Text>
          </View>
          <Text style={[s.limitation, { color: C.textMuted }]}>
            Workload is a trend for planning and recovery—not an injury predictor. Cycling or swimming distance is never converted into running mileage.
          </Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filters}>
          {FILTERS.map(item => (
            <TouchableOpacity
              key={item.key}
              style={[
                s.filter,
                {
                  backgroundColor: filter === item.key ? C.primaryDim : C.card,
                  borderColor: filter === item.key ? C.primary : C.border,
                },
              ]}
              onPress={() => setFilter(item.key)}
            >
              <Text style={[s.filterText, { color: filter === item.key ? C.primary : C.textMuted }]}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {visible.map(activity => (
          <TouchableOpacity
            key={activity.id}
            style={[s.activityCard, { backgroundColor: C.card, borderColor: C.border }]}
            onPress={() => router.push({ pathname: '/(tabs)/activity/[activityId]', params: { activityId: activity.id } } as never)}
          >
            <View style={[s.activityIcon, { backgroundColor: C.primaryDim }]}>
              <Ionicons name={iconFor(activity.activityType)} size={20} color={C.primary} />
            </View>
            <View style={s.activityCopy}>
              <Text style={[s.activityTitle, { color: C.text }]}>
                {activity.subtype === 'run_walk' ? 'Run / Walk' : labelFor(activity.activityType)}
              </Text>
              <Text style={[s.activityMeta, { color: C.textMuted }]}>
                {new Date(activity.startTime).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · {metricLine(activity)}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={C.textMuted} />
          </TouchableOpacity>
        ))}

        {visible.length === 0 ? (
          <View style={[s.empty, { backgroundColor: C.card, borderColor: C.border }]}>
            <Ionicons name="pulse-outline" size={26} color={C.primary} />
            <Text style={[s.activityTitle, { color: C.text }]}>No activities in this filter</Text>
            <Text style={[s.activityMeta, { color: C.textMuted }]}>Track outdoors or add a quick manual entry.</Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingBottom: 10 },
  headerCopy: { flex: 1 },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.4 },
  title: { fontSize: 32, fontFamily: 'CormorantGaramond_700Bold' },
  content: { paddingHorizontal: 18, paddingBottom: 120 },
  actions: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  action: { flex: 1, minHeight: 50, borderWidth: 1, borderColor: 'transparent', borderRadius: 14, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
  actionText: { fontSize: 13, fontWeight: '800' },
  loadCard: { borderWidth: 1, borderRadius: 18, padding: 16, marginBottom: 14 },
  row: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  cardLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  loadValue: { fontSize: 42, fontWeight: '900', marginTop: 2 },
  link: { fontSize: 12, fontWeight: '800' },
  loadGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 },
  loadSmall: { fontSize: 12, fontWeight: '700' },
  limitation: { fontSize: 11, lineHeight: 16, marginTop: 10 },
  filters: { gap: 8, paddingBottom: 14 },
  filter: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 8 },
  filterText: { fontSize: 12, fontWeight: '800' },
  activityCard: { borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 12 },
  activityIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  activityCopy: { flex: 1, minWidth: 0 },
  activityTitle: { fontSize: 15, fontWeight: '900' },
  activityMeta: { fontSize: 12, lineHeight: 17, marginTop: 3 },
  empty: { borderWidth: 1, borderRadius: 16, padding: 24, alignItems: 'center', gap: 8 },
});
