import { useEffect, useMemo, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import ScreenHeader from '../../../src/components/layout/ScreenHeader';
import { LAYOUT } from '../../../src/constants/layout';
import { useScheduledSessions } from '../../../src/hooks/useScheduledSessions';
import { useWeekPlan } from '../../../src/hooks/useWeekPlan';
import { getRecentHealthKitWorkoutCandidates, isAppleHealthAvailable, requestPermissions as requestHealthPermissions } from '../../../src/lib/healthKit';
import { useActivityStore } from '../../../src/store/activityStore';
import { useSettingsStore } from '../../../src/store/settingsStore';
import { useColors } from '../../../src/theme/useColors';
import { buildHealthKitActivityDraft, isDuplicateHealthKitWorkout, reconcileHealthKitWorkout, type HealthKitWorkoutCandidate } from '../../../src/utils/healthKitImport';
import { formatReportDistance } from '../../../src/utils/strideReport';

const FILTERS = [7, 30, 90] as const;

function durationLabel(seconds: number): string {
  const safe = Math.max(0, Math.round(seconds));
  const h = Math.floor(safe / 3600);
  const m = Math.round((safe % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m} min`;
}

function activityLabel(type: string): string {
  return type.split('_').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

export default function HealthSyncScreen() {
  const C = useColors();
  const insets = useSafeAreaInsets();
  const units = useSettingsStore(state => state.units);
  const healthWorkoutSyncMode = useSettingsStore(state => state.healthWorkoutSyncMode);
  const setHealthWorkoutSyncMode = useSettingsStore(state => state.setHealthWorkoutSyncMode);
  const activities = useActivityStore(state => state.activities);
  const addActivity = useActivityStore(state => state.addActivity);
  const weekPlan = useWeekPlan();
  const scheduled = useScheduledSessions(weekPlan);
  const visibleHealthWorkoutSyncMode = healthWorkoutSyncMode === 'automatic' ? 'review' : healthWorkoutSyncMode;
  const [filterDays, setFilterDays] = useState<typeof FILTERS[number]>(30);
  const [candidates, setCandidates] = useState<HealthKitWorkoutCandidate[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setStatus(null);
    try {
      if (Platform.OS !== 'ios') {
        setCandidates([]);
        setStatus('Apple Health workout import is available on iPhone builds only.');
        return;
      }
      const available = await isAppleHealthAvailable();
      if (!available) {
        setCandidates([]);
        setStatus('Apple Health is unavailable in this build or on this device.');
        return;
      }
      await requestHealthPermissions();
      const next = await getRecentHealthKitWorkoutCandidates(filterDays);
      setCandidates(next);
      setSelected(Object.fromEntries(next
        .filter(item => !isDuplicateHealthKitWorkout(item, activities))
        .map(item => [item.uuid, healthWorkoutSyncMode !== 'off'])));
      setStatus(next.length ? null : 'No eligible unsynced workouts found for this window.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not refresh Apple Health workouts.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    // refresh intentionally tracks filter changes; activities are read during action.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterDays]);

  useEffect(() => {
    if (healthWorkoutSyncMode === 'automatic') setHealthWorkoutSyncMode('review');
  }, [healthWorkoutSyncMode, setHealthWorkoutSyncMode]);

  const rows = useMemo(() => candidates.map(candidate => {
    const duplicate = isDuplicateHealthKitWorkout(candidate, activities);
    return {
      candidate,
      duplicate,
      reconciliation: reconcileHealthKitWorkout(candidate, scheduled.weekSessions),
    };
  }), [activities, candidates, scheduled.weekSessions]);

  const selectedCandidates = rows
    .filter(row => !row.duplicate && selected[row.candidate.uuid])
    .map(row => row.candidate);

  function syncCandidates(items: HealthKitWorkoutCandidate[]) {
    if (!items.length) {
      Alert.alert('Nothing to sync', 'Choose at least one unsynced workout.');
      return;
    }
    let count = 0;
    for (const candidate of items) {
      if (isDuplicateHealthKitWorkout(candidate, useActivityStore.getState().activities)) continue;
      const reconciliation = reconcileHealthKitWorkout(candidate, scheduled.weekSessions);
      addActivity(buildHealthKitActivityDraft({ candidate, reconciliation }));
      count += 1;
    }
    setSelected({});
    Alert.alert('Sync complete', `${count} workout${count === 1 ? '' : 's'} imported into Activity history.`);
  }

  return (
    <View style={[s.root, { backgroundColor: C.bg }]}>
      <View style={{ paddingTop: insets.top }}>
        <ScreenHeader eyebrow="HEALTH & FITNESS" title="Workout Sync" onBack={() => router.back()} />
      </View>
      <ScrollView
        contentContainerStyle={[s.content, { paddingBottom: LAYOUT.tabBarHeight + Math.max(insets.bottom, 16) + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[s.card, { backgroundColor: C.bg, borderColor: C.border }]}>
          <Text style={[s.title, { color: C.text }]}>Health Workout Sync</Text>
          <Text style={[s.copy, { color: C.textMuted }]}>Completed Health/Fitness workouts are reviewed before import. Routes and health details import only when authorized.</Text>
          <View style={s.pills}>
            {(['off', 'review'] as const).map(mode => (
              <Pressable
                key={mode}
                style={[s.pill, { borderColor: visibleHealthWorkoutSyncMode === mode ? C.primary : C.border, backgroundColor: visibleHealthWorkoutSyncMode === mode ? C.primaryDim : C.cardAlt }]}
                onPress={() => setHealthWorkoutSyncMode(mode)}
              >
                <Text style={[s.pillText, { color: visibleHealthWorkoutSyncMode === mode ? C.primary : C.textMuted }]}>{mode === 'review' ? 'Review' : 'Off'}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={[s.copy, { color: C.textMuted }]}>Automatic background import is not enabled yet.</Text>
        </View>

        <View style={s.toolbar}>
          <View style={s.pills}>
            {FILTERS.map(days => (
              <Pressable
                key={days}
                style={[s.pill, { borderColor: filterDays === days ? C.primary : C.border, backgroundColor: filterDays === days ? C.primaryDim : C.cardAlt }]}
                onPress={() => setFilterDays(days)}
              >
                <Text style={[s.pillText, { color: filterDays === days ? C.primary : C.textMuted }]}>{days}d</Text>
              </Pressable>
            ))}
          </View>
          <Pressable style={[s.refresh, { backgroundColor: C.primary }]} onPress={() => void refresh()}>
            <Ionicons name="refresh-outline" size={15} color={C.onPrimary} />
            <Text style={[s.refreshText, { color: C.onPrimary }]}>{loading ? 'Loading' : 'Refresh'}</Text>
          </Pressable>
        </View>

        {status ? <Text style={[s.copy, { color: C.textMuted }]}>{status}</Text> : null}

        {rows.map(row => {
          const { candidate, reconciliation, duplicate } = row;
          const distance = candidate.distanceMeters != null
            ? formatReportDistance(candidate.distanceMeters / 1609.344, units)
            : 'Distance unavailable';
          return (
            <Pressable
              key={`${candidate.sourceBundleIdentifier}:${candidate.uuid}`}
              style={[s.row, { backgroundColor: C.bg, borderColor: C.border }]}
              onPress={() => !duplicate && setSelected(current => ({ ...current, [candidate.uuid]: !current[candidate.uuid] }))}
            >
              <View style={[s.check, { borderColor: duplicate || selected[candidate.uuid] ? C.primary : C.border, backgroundColor: selected[candidate.uuid] || duplicate ? C.primaryDim : 'transparent' }]}>
                <Ionicons name={duplicate ? 'checkmark-done' : selected[candidate.uuid] ? 'checkmark' : 'ellipse-outline'} size={16} color={duplicate || selected[candidate.uuid] ? C.primary : C.textMuted} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.rowTitle, { color: C.text }]}>{activityLabel(candidate.activityType)}</Text>
                <Text style={[s.rowMeta, { color: C.textMuted }]}>
                  {new Date(candidate.startTime).toLocaleDateString()} - {durationLabel(candidate.durationSeconds)} - {distance}
                </Text>
                <Text style={[s.rowMeta, { color: C.textMuted }]}>
                  {candidate.sourceName ?? candidate.sourceBundleIdentifier} - {duplicate ? 'Imported' : reconciliation.status === 'matched' ? 'Matched planned workout' : reconciliation.status === 'ambiguous' ? 'Choose plan after import' : 'Unplanned'}
                </Text>
              </View>
            </Pressable>
          );
        })}

        <View style={s.actions}>
          <Pressable style={[s.action, { backgroundColor: C.primary }]} onPress={() => syncCandidates(selectedCandidates)}>
            <Text style={[s.actionText, { color: C.onPrimary }]}>Sync Selected</Text>
          </Pressable>
          <Pressable style={[s.action, { backgroundColor: C.cardAlt, borderColor: C.border, borderWidth: 1 }]} onPress={() => syncCandidates(rows.filter(row => !row.duplicate).map(row => row.candidate))}>
            <Text style={[s.actionText, { color: C.text }]}>Sync All</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 18, gap: 10 },
  card: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 8 },
  title: { fontSize: 17, fontWeight: '900' },
  copy: { fontSize: 12, lineHeight: 18 },
  toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 11, paddingVertical: 8 },
  pillText: { fontSize: 12, fontWeight: '800' },
  refresh: { minHeight: 38, borderRadius: 10, paddingHorizontal: 12, flexDirection: 'row', gap: 6, alignItems: 'center' },
  refreshText: { fontSize: 12, fontWeight: '900' },
  row: { borderWidth: 1, borderRadius: 14, padding: 12, flexDirection: 'row', gap: 10, alignItems: 'center' },
  check: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 14, fontWeight: '900' },
  rowMeta: { fontSize: 11, lineHeight: 16, marginTop: 2 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  action: { flex: 1, minHeight: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  actionText: { fontSize: 13, fontWeight: '900' },
});
