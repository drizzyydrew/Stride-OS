import { useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { StrideWatchStatus } from '../../../modules/stride-watch-connectivity/src';
import { useColors } from '../../theme/useColors';
import { createWatchStartCoordinator, watchAvailability, type WatchAvailabilityOptions, type WatchStartRequest } from '../../utils/watchAvailability';

export function useWatchStartRequest(onStatus: (status: StrideWatchStatus) => void, workoutInstanceId?: string | null) {
  const [coordinator] = useState(createWatchStartCoordinator);
  const pending = useRef(new Set<string>());
  const [requestingId, setRequestingId] = useState<string | null>(null);
  const [failure, setFailure] = useState<{ id: string; message: string } | null>(null);
  async function request(input: WatchStartRequest) {
    if (pending.current.has(input.workoutInstanceId) || !input.isCurrent()) return;
    pending.current.add(input.workoutInstanceId);
    setRequestingId(input.workoutInstanceId);
    setFailure(null);
    try {
      const status = await coordinator.request(input);
      if (status && input.isCurrent()) {
        setFailure(status.lastError ? { id: input.workoutInstanceId, message: status.lastError } : null);
        onStatus(status);
      }
    } finally {
      pending.current.delete(input.workoutInstanceId);
      setRequestingId(current => current === input.workoutInstanceId ? null : current);
    }
  }
  return { request, busy: !!workoutInstanceId && requestingId === workoutInstanceId,
    requestError: failure && failure.id === workoutInstanceId ? failure.message : null };
}

export default function WatchConnectionStatus({ status, onRetry, ...options }: WatchAvailabilityOptions & {
  status: StrideWatchStatus;
  onRetry: () => void;
}) {
  const C = useColors();
  const { width, fontScale } = useWindowDimensions();
  const [showDetails, setShowDetails] = useState(false);
  const availability = watchAvailability(status, options);
  const errors = [...new Set([options.requestError, status.lastError].filter((value): value is string => !!value))];
  const separateControls = fontScale >= 1.3 || width < 360;
  const controls = options.requesting || availability.retryable || errors.length ? <View style={styles.controls}>
    {options.requesting ? <View style={styles.retry}><ActivityIndicator color={C.primary} /></View>
      : availability.retryable ? <TouchableOpacity onPress={onRetry} accessibilityRole="button"
        accessibilityLabel="Retry Apple Watch start" accessibilityHint="Unlock your watch and open StrideOS first"
        style={styles.retry}>
        <Ionicons name="refresh-outline" size={23} color={C.primary} />
      </TouchableOpacity> : null}
    {errors.length ? <TouchableOpacity onPress={() => setShowDetails(value => !value)} accessibilityRole="button"
      accessibilityLabel={showDetails ? 'Hide Watch error details' : 'Show Watch error details'}
      accessibilityState={{ expanded: showDetails }} style={styles.retry}>
      <Ionicons name="information-circle-outline" size={22} color={C.textMuted} />
    </TouchableOpacity> : null}
  </View> : null;
  return <View style={[styles.container, { borderColor: C.border }]}>
    <View style={styles.row}>
      <Ionicons name="watch-outline" size={19} color={C.primary} />
      <View style={styles.body} accessibilityLiveRegion="polite">
        <Text style={[styles.title, { color: C.text }]}>Apple Watch</Text>
        <Text style={[styles.text, { color: C.textMuted }]}>{availability.title}</Text>
        {availability.detail ? <Text style={[styles.text, { color: C.textMuted }]}>{availability.detail}</Text> : null}
      </View>
      {!separateControls ? controls : null}
    </View>
    {separateControls ? controls : null}
    {showDetails && errors.length ? <View style={styles.details}>
      {errors.map(error => <Text selectable key={error} style={[styles.text, { color: C.warning }]}>{error}</Text>)}
    </View> : null}
  </View>;
}

const styles = StyleSheet.create({
  container: { paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  body: { flex: 1, minWidth: 0, gap: 3 },
  title: { fontSize: 14, fontWeight: '700' },
  text: { fontSize: 13 },
  controls: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', alignSelf: 'flex-end', gap: 4 },
  retry: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  details: { paddingBottom: 12, gap: 6 },
});
