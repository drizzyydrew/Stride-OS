import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import RecoverableModal from '../ui/RecoverableModal';
import { createHealthWorkoutRecovery } from '../../lib/healthWorkoutRecovery';
import type { HealthKitWorkoutCandidate } from '../../utils/healthKitImport';
import { displayLabel } from '../../utils/displayLabels';
import { formatDuration } from '../../utils/activitySummary';
import { formatDistance } from '../../lib/units';
import { useSettingsStore } from '../../store/settingsStore';
import { useColors } from '../../theme/useColors';

type Props = {
  disabled?: boolean;
  isCurrent?: () => boolean;
  onOpenChange: (open: boolean) => void;
  onSavePending: () => void;
  onFailure: (message: string) => void;
  onRecovered: (id: string) => void;
};

export default function HealthWorkoutRecovery({ disabled, isCurrent = () => true, onOpenChange, onSavePending, onFailure, onRecovered }: Props) {
  const C = useColors();
  const units = useSettingsStore(state => state.units);
  const [visible, setVisible] = useState(false);
  const [days, setDays] = useState(30);
  const [rows, setRows] = useState<HealthKitWorkoutCandidate[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'saving' | 'error'>('ready');
  const [error, setError] = useState<string | null>(null);
  const request = useRef(0);
  const busy = useRef(false);
  const session = useRef<ReturnType<typeof createHealthWorkoutRecovery> | null>(null);
  useEffect(() => () => { request.current += 1; }, []);

  function close() {
    request.current += 1;
    session.current = null;
    busy.current = false;
    setVisible(false);
    onOpenChange(false);
  }
  async function load(period = days) {
    const generation = ++request.current;
    const current = () => request.current === generation && isCurrent();
    const recovery = createHealthWorkoutRecovery(current);
    session.current = recovery;
    busy.current = true;
    setDays(period);
    setRows([]);
    setError(null);
    setStatus('loading');
    setVisible(true);
    onOpenChange(true);
    try {
      const workouts = await recovery.listRecent(period);
      if (!current()) return;
      setRows(workouts);
      setStatus('ready');
    } catch (reason) {
      if (!current()) return;
      setError(reason instanceof Error ? reason.message : 'Apple Health could not be read.');
      setStatus('error');
    } finally {
      if (current()) busy.current = false;
    }
  }
  function choose(candidate: HealthKitWorkoutCandidate) {
    if (busy.current) return;
    const generation = request.current;
    const current = () => request.current === generation && isCurrent();
    const recovery = session.current;
    busy.current = true;
    Alert.alert('Restore this Health workout?',
      `${displayLabel(candidate.activityType)} · ${new Date(candidate.startTime).toLocaleString()} · ${formatDuration(candidate.durationSeconds)}\n\nRestores only this selected workout, including a previously removed entry. Existing activity edits are kept. The unresolved old link is not reassigned.`, [
        { text: 'Cancel', style: 'cancel', onPress: () => { if (current()) busy.current = false; } },
        { text: 'Restore', onPress: async () => {
          if (!current() || !recovery) return;
          setError(null);
          setStatus('saving');
          onSavePending();
          try {
            const id = await recovery.restoreSelected(candidate.uuid);
            if (!current()) return;
            setVisible(false);
            onRecovered(id);
          } catch (reason) {
            if (!current()) return;
            const message = reason instanceof Error ? reason.message : 'The workout could not be saved. Retry the same selection.';
            setError(message);
            setStatus('ready');
            onFailure(message);
          } finally {
            if (current()) busy.current = false;
          }
        } },
      ], { cancelable: false });
  }
  return <>
    <TouchableOpacity onPress={() => { if (!busy.current) void load(); }} disabled={disabled}
      accessibilityRole="button" accessibilityLabel="Find workout in Apple Health"
      style={[s.open, { borderColor: C.border, opacity: disabled ? 0.5 : 1 }]}>
      <Ionicons name="heart-circle-outline" size={22} color={C.primary} />
      <Text style={[s.openText, { color: C.primary }]}>Find workout in Apple Health</Text>
    </TouchableOpacity>
    <RecoverableModal visible={visible} onRequestClose={close}>
      <View style={[s.content, { backgroundColor: C.bg }]}>
        <Text accessibilityRole="header" style={[s.title, { color: C.text }]}>Apple Health workouts</Text>
        <View style={s.periods}>
          {[30, 365].map(period => <TouchableOpacity key={period} disabled={status === 'saving'}
            onPress={() => { void load(period); }} accessibilityRole="button" accessibilityState={{ selected: period === days }}
            style={[s.period, { backgroundColor: period === days ? C.primaryDim : C.cardAlt, borderColor: C.border }]}>
            <Text style={[s.periodText, { color: period === days ? C.primary : C.textMuted }]}>{period === 30 ? 'Past 30 days' : 'Past year'}</Text>
          </TouchableOpacity>)}
        </View>
        {status === 'loading' || status === 'saving' ? <View style={s.progress}>
          <ActivityIndicator color={C.primary} />
          <Text accessibilityLiveRegion="polite" style={[s.body, { color: C.textMuted }]}>{status === 'loading' ? 'Reading recent workouts…' : 'Reading selected workout and confirming save…'}</Text>
        </View> : null}
        {error ? <View style={s.progress}>
          <Text accessibilityLiveRegion="polite" style={[s.body, { color: C.textMuted }]}>{error}</Text>
          {status === 'error' ? <TouchableOpacity accessibilityRole="button" accessibilityLabel="Retry Apple Health search" onPress={() => { void load(); }} style={s.retry}>
            <Ionicons name="refresh" size={22} color={C.primary} />
            <Text style={[s.openText, { color: C.primary }]}>Retry</Text>
          </TouchableOpacity> : null}
        </View> : null}
        <FlatList data={rows} keyExtractor={item => item.uuid} style={s.list}
          ListEmptyComponent={status === 'ready' ? <Text style={[s.body, { color: C.textMuted }]}>No supported workouts returned for this period. Check Health read access or try another period.</Text> : null}
          renderItem={({ item }) => <TouchableOpacity disabled={status === 'saving'} onPress={() => choose(item)}
            accessibilityRole="button" style={[s.row, { borderColor: C.border }]}>
            <Text style={[s.rowTitle, { color: C.text }]}>{displayLabel(item.activityType)} · {new Date(item.startTime).toLocaleDateString()}</Text>
            <Text style={[s.body, { color: C.textMuted }]}>{new Date(item.startTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} · {formatDuration(item.durationSeconds)}{item.distanceMeters != null ? ` · ${formatDistance(item.distanceMeters / 1609.344, units)}` : ''}</Text>
            <Text style={[s.body, { color: C.textMuted }]}>{item.sourceName ?? item.sourceBundleIdentifier}{item.deviceName ? ` · ${item.deviceName}` : ''}</Text>
          </TouchableOpacity>} />
      </View>
    </RecoverableModal>
  </>;
}

const s = StyleSheet.create({
  content: { flex: 1, paddingHorizontal: 20 }, title: { fontSize: 22, fontWeight: '700', marginBottom: 16 },
  open: { minHeight: 48, borderWidth: 1, borderRadius: 8, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, alignSelf: 'stretch' },
  openText: { fontSize: 15, fontWeight: '700', flexShrink: 1 }, body: { fontSize: 14, lineHeight: 21, flexShrink: 1 },
  periods: { flexDirection: 'row', gap: 8, marginBottom: 12 }, period: { flex: 1, minHeight: 44, padding: 10, borderWidth: 1, borderRadius: 8, justifyContent: 'center' },
  periodText: { fontSize: 14, fontWeight: '700', textAlign: 'center' }, progress: { gap: 12, paddingVertical: 12 },
  retry: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8 }, list: { flex: 1 },
  row: { minHeight: 88, paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth, gap: 4 }, rowTitle: { fontSize: 17, fontWeight: '700' },
});
