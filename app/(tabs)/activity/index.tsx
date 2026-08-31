import { useMemo, useState } from 'react';
import { Alert, FlatList, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Swipeable } from 'react-native-gesture-handler';

import ScreenHeader from '../../../src/components/layout/ScreenHeader';
import { useActivityStore } from '../../../src/store/activityStore';
import { useRecalculationStore } from '../../../src/store/recalculationStore';
import { runRecalculation } from '../../../src/lib/recalculation';
import { useColors } from '../../../src/theme/useColors';
import type { Activity, ActivityFilter, ActivityType } from '../../../src/types/activity';
import { activityMatchesFilter, summarizeActivityLoad } from '../../../src/utils/activityLoad';
import { filterActivities } from '../../../src/utils/activitySearch';
import { displayLabel } from '../../../src/utils/displayLabels';

function formatLastUpdated(lastRunAt: number | null): string {
  if (!lastRunAt) return 'Never run';
  const diffMs = Date.now() - lastRunAt;
  if (diffMs < 60_000) return 'Just now';
  if (diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)} min ago`;
  return new Date(lastRunAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

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

function isMeaningfulActivity(activity: Activity): boolean {
  const durationSeconds = activity.metrics.durationSeconds ?? activity.metrics.elapsedTimeSeconds ?? 0;
  const distanceMeters = activity.metrics.distanceMeters ?? 0;
  const load = activity.trainingLoad.wholeBody ?? 0;
  if (durationSeconds > 60) return true;
  if (distanceMeters > 80) return true;
  if (load > 8) return true;
  if (activity.source === 'tracked' && durationSeconds > 0) return true;
  return Boolean(activity.notes?.trim() || activity.scheduledSessionId);
}

export default function ActivityScreen() {
  const C = useColors();
  const router = useRouter();
  const activities = useActivityStore(state => state.activities);
  const removeActivity = useActivityStore(state => state.removeActivity);
  const recalculationStatus = useRecalculationStore(state => state.status);
  const recalculationLastRunAt = useRecalculationStore(state => state.lastRunAt);
  const recalculationError = useRecalculationStore(state => state.error);
  const [filter, setFilter] = useState<ActivityFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const meaningful = useMemo(() => activities.filter(isMeaningfulActivity), [activities]);
  const visible = useMemo(() => filterActivities(
    meaningful.filter(activity => activityMatchesFilter(activity, filter)),
    { query: searchQuery },
  ).sort((a, b) => b.startTime - a.startTime), [meaningful, filter, searchQuery]);
  const weekly = useMemo(() => summarizeActivityLoad(
    meaningful.filter(activity => Date.now() - activity.startTime <= 7 * 24 * 60 * 60 * 1000),
  ), [meaningful]);

  function confirmDeleteActivity(activity: Activity) {
    Alert.alert(
      'Delete this activity?',
      'This removes the activity from your history and recalculates affected load and analytics. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Activity',
          style: 'destructive',
          onPress: () => removeActivity(activity.id),
        },
      ],
    );
  }

  function renderActivityRow({ item: activity }: { item: Activity }) {
    return (
      <Swipeable
        overshootRight={false}
        renderRightActions={() => (
          <TouchableOpacity
            style={[s.deleteAction, { backgroundColor: C.critical }]}
            onPress={() => confirmDeleteActivity(activity)}
            accessibilityLabel={`Delete ${displayLabel(activity.activityType)} activity`}
          >
            <Ionicons name="trash-outline" size={20} color="#fff" />
            <Text style={s.deleteActionText}>Delete</Text>
          </TouchableOpacity>
        )}
      >
        <TouchableOpacity
          style={[s.activityCard, { backgroundColor: C.card, borderColor: C.border }]}
          onPress={() => router.push({ pathname: '/(tabs)/activity/[activityId]', params: { activityId: activity.id } } as never)}
          onLongPress={() => confirmDeleteActivity(activity)}
          delayLongPress={450}
          accessibilityHint="Double tap to open. Long press for activity actions including delete."
        >
          <View style={[s.activityIcon, { backgroundColor: C.primaryDim }]}>
            <Ionicons name={iconFor(activity.activityType)} size={20} color={C.primary} />
          </View>
          <View style={s.activityCopy}>
            <Text style={[s.activityTitle, { color: C.text }]}>
              {activity.subtype === 'run_walk' ? 'Run / Walk' : displayLabel(activity.activityType)}
            </Text>
            <Text style={[s.activityMeta, { color: C.textMuted }]}>
              {new Date(activity.startTime).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · {metricLine(activity)}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={C.textMuted} />
        </TouchableOpacity>
      </Swipeable>
    );
  }

  function renderEmptyState() {
    return (
      <View style={[s.empty, { backgroundColor: C.card, borderColor: C.border }]}>
        <Ionicons name="pulse-outline" size={26} color={C.primary} />
        <Text style={[s.activityTitle, { color: C.text }]}>
          {meaningful.length === 0 ? 'No activities yet' : 'No activities in this filter'}
        </Text>
        <Text style={[s.activityMeta, { color: C.textMuted, textAlign: 'center' }]}>
          {meaningful.length === 0
            ? 'Your completed runs, walks, rides, strength sessions, mobility sessions, and other training will appear here.'
            : 'Try another search or filter, or add a completed activity.'}
        </Text>
        <View style={s.emptyActions}>
          <TouchableOpacity
            style={[s.emptyAction, { backgroundColor: C.primary }]}
            onPress={() => router.push('/(tabs)/activity/start' as never)}
          >
            <Text style={[s.actionText, { color: C.onPrimary }]}>Start an Activity</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.emptyAction, { backgroundColor: C.cardAlt, borderColor: C.border }]}
            onPress={() => router.push('/(tabs)/dashboard' as never)}
          >
            <Text style={[s.actionText, { color: C.text }]}>View Today’s Plan</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  function renderListHeader() {
    return (
      <>
        <View style={s.actions}>
          <TouchableOpacity
            style={[s.action, { backgroundColor: C.primary }]}
            onPress={() => router.push('/(tabs)/activity/start' as never)}
          >
            <Ionicons name="navigate-outline" size={18} color={C.onPrimary} />
            <Text style={[s.actionText, { color: C.onPrimary }]}>Track Workout</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.action, { backgroundColor: C.card, borderColor: C.border }]}
            onPress={() => router.push('/(tabs)/activity/plans' as never)}
          >
            <Ionicons name="flag-outline" size={18} color={C.primary} />
            <Text style={[s.actionText, { color: C.text }]}>Training Paths</Text>
          </TouchableOpacity>
        </View>

        <View style={[s.refreshRow, { backgroundColor: C.card, borderColor: C.border }]}>
          <View style={{ flex: 1 }}>
            <Text style={[s.refreshLabel, { color: C.textDim }]}>
              {recalculationStatus === 'error' ? 'REFRESH FAILED' : 'ANALYTICS LAST UPDATED'}
            </Text>
            <Text style={[s.refreshValue, { color: recalculationStatus === 'error' ? C.critical : C.text }]}>
              {recalculationStatus === 'running' ? 'Refreshing…' : recalculationStatus === 'error' ? (recalculationError ?? 'Unknown error') : formatLastUpdated(recalculationLastRunAt)}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => runRecalculation('manual_refresh', activities)}
            style={[s.refreshButton, { backgroundColor: C.cardAlt, borderColor: C.border }]}
            accessibilityRole="button"
            accessibilityLabel="Refresh Training Plan"
            accessibilityHint="Recalculates future training guidance from chronologically sorted activity history."
            disabled={recalculationStatus === 'running'}
          >
            <Ionicons name="refresh-outline" size={16} color={C.primary} />
            <Text style={[s.refreshButtonText, { color: C.primary }]}>Refresh Training Plan</Text>
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

        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search activity history"
          placeholderTextColor={C.textDim}
          style={[s.searchInput, { backgroundColor: C.card, borderColor: C.border, color: C.text }]}
          accessibilityLabel="Search activity history"
        />

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
      </>
    );
  }

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: C.bg }]} edges={['top']}>
      <ScreenHeader
        eyebrow="ALL TRAINING"
        title="Activity"
        onBack={() => router.back()}
        right={(
          <TouchableOpacity onPress={() => router.push('/(tabs)/activity/manual' as never)} style={s.iconButton} accessibilityLabel="Log activity">
            <Ionicons name="add" size={25} color={C.primary} />
          </TouchableOpacity>
        )}
      />

      <FlatList
        data={visible}
        keyExtractor={item => item.id}
        renderItem={renderActivityRow}
        ListHeaderComponent={renderListHeader}
        ListEmptyComponent={renderEmptyState}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 18, paddingBottom: 120 },
  actions: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  refreshRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 14, padding: 12, marginBottom: 12 },
  refreshLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  refreshValue: { fontSize: 13, fontWeight: '700', marginTop: 3 },
  refreshButton: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9 },
  refreshButtonText: { fontSize: 12, fontWeight: '800' },
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
  searchInput: { minHeight: 46, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, fontSize: 14, fontWeight: '700', marginBottom: 12 },
  filters: { gap: 8, paddingBottom: 14 },
  filter: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 8 },
  filterText: { fontSize: 12, fontWeight: '800' },
  activityCard: { borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 12 },
  deleteAction: { width: 96, borderRadius: 16, marginBottom: 10, alignItems: 'center', justifyContent: 'center', gap: 3 },
  deleteActionText: { color: '#fff', fontSize: 12, fontWeight: '900' },
  activityIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  activityCopy: { flex: 1, minWidth: 0 },
  activityTitle: { fontSize: 15, fontWeight: '900' },
  activityMeta: { fontSize: 12, lineHeight: 17, marginTop: 3 },
  empty: { borderWidth: 1, borderRadius: 16, padding: 24, alignItems: 'center', gap: 8 },
  emptyActions: { alignSelf: 'stretch', gap: 8, marginTop: 8 },
  emptyAction: { minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
});
