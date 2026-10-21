import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { refreshActivityHealthDistance } from '../../lib/healthDistanceRefresh';
import { useColors } from '../../theme/useColors';
import HealthWorkoutRecovery from './HealthWorkoutRecovery';

export default function HealthDistanceRefresh({ activityId, linked = true, isCurrent }: { activityId: string; linked?: boolean; isCurrent: () => boolean }) {
  const C = useColors();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  // Keep a first-link picker mounted through early publication until durable acknowledgement.
  const [usingLinkedWorkout, setUsingLinkedWorkout] = useState(linked);
  const inFlight = useRef(false);
  const generation = useRef(0);
  useEffect(() => () => { generation.current += 1; }, []);
  async function refresh() {
    if (inFlight.current || !isCurrent()) return;
    const token = ++generation.current;
    const current = () => generation.current === token && isCurrent();
    inFlight.current = true;
    setBusy(true);
    setMessage(null);
    try {
      await refreshActivityHealthDistance(activityId, current);
      if (current()) setMessage('Health distance evidence saved. Your activity totals and edits were kept.');
    } catch (error) {
      if (current()) setMessage(error instanceof Error ? error.message : 'Health refresh could not be confirmed. Retry after unlocking your phone.');
    } finally {
      if (current()) { inFlight.current = false; setBusy(false); }
    }
  }
  if (!usingLinkedWorkout) return <View style={s.root}>
    <HealthWorkoutRecovery targetActivityId={activityId} isCurrent={isCurrent}
      onOpenChange={() => {}} onSavePending={() => setMessage('Saving the Health link and split evidence…')}
      onFailure={setMessage} onRecovered={id => {
        if (isCurrent() && id === activityId) { setUsingLinkedWorkout(true); setMessage('Health distance evidence saved. Your activity totals and edits were kept.'); }
      }} />
    {message ? <Text accessibilityLiveRegion="polite" style={[s.message, { color: C.textMuted }]}>{message}</Text> : null}
  </View>;
  return <View style={s.root}>
    <TouchableOpacity onPress={() => { void refresh(); }} disabled={busy} accessibilityRole="button"
      accessibilityLabel="Refresh splits from Apple Health" accessibilityState={{ busy, disabled: busy }}
      style={[s.button, { borderColor: C.border }]}>
      {busy ? <ActivityIndicator color={C.primary} /> : <Ionicons name="refresh-outline" size={20} color={C.primary} />}
      <Text style={[s.label, { color: C.primary }]}>{busy ? 'Reading Health distance…' : 'Refresh splits from Apple Health'}</Text>
    </TouchableOpacity>
    {message ? <Text accessibilityLiveRegion="polite" style={[s.message, { color: C.textMuted }]}>{message}</Text> : null}
  </View>;
}

const s = StyleSheet.create({
  root: { gap: 8 }, button: { minHeight: 48, padding: 12, borderWidth: 1, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  label: { fontSize: 15, fontWeight: '700', flexShrink: 1 }, message: { fontSize: 14, lineHeight: 21 },
});
