import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { restoreHealthActivityHistory } from '../../lib/healthActivityRestore';
import { useColors } from '../../theme/useColors';

/**
 * Rebuilds the Activity log from Apple Health: every workout saved there by
 * StrideOS, the StrideOS watch app, Apple Workout, or other apps, including
 * GPS routes. Skips anything already in the log, so it is safe to run again.
 */
export default function HealthRestoreCard({ compact = false }: { compact?: boolean }) {
  const C = useColors();
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const inFlight = useRef(false);

  async function restore() {
    setBusy(true);
    setProgress('Asking Apple Health…');
    try {
      const result = await restoreHealthActivityHistory((done, total, phase) => setProgress(`${phase === 'saving' ? 'Saving' : 'Reading'} workouts ${done} / ${total}…`));
      const { restored, withRoutes } = result;
      setProgress(null);
      Alert.alert(
        restored ? 'Activity log restored' : result.sampleCount ? 'Restore complete' : 'No readable workouts returned',
        restored
          ? `Restored ${restored} workout${restored === 1 ? '' : 's'} from Apple Health${withRoutes ? `, ${withRoutes} with GPS routes` : ''}.`
          : result.sampleCount
            ? `${result.alreadyPresent} workout${result.alreadyPresent === 1 ? ' is' : 's are'} already saved. ${result.skippedCount + result.tooShort} unsupported, invalid, or under-one-minute workout${result.skippedCount + result.tooShort === 1 ? ' was' : 's were'} skipped.`
            : 'Apple Health returned no readable workouts. This does not mean your race is missing from Health. Enable StrideOS read access to Workouts and Workout Routes in Health > profile > Apps > StrideOS, then retry with your iPhone unlocked. Connected alone does not confirm read access.',
      );
    } catch (error) {
      setProgress(null);
      Alert.alert('Restore failed', error instanceof Error ? error.message : 'Apple Health could not be read.');
    } finally {
      setBusy(false);
      inFlight.current = false;
    }
  }

  function confirmRestore() {
    if (inFlight.current) return;
    inFlight.current = true;
    Alert.alert('Restore from Apple Health?',
      'Adds missing supported workouts saved in Apple Health, including workouts previously removed from Activity. Existing activity edits are kept. Nothing in Apple Health is changed.', [
        { text: 'Cancel', style: 'cancel', onPress: () => { inFlight.current = false; } },
        { text: 'Restore', onPress: () => { void restore(); } },
      ], { cancelable: false });
  }

  return (
    <View style={[styles.card, compact && styles.compact, { backgroundColor: C.cardAlt, borderColor: C.border }]}>
      {!compact ? (
        <Text style={[styles.body, { color: C.textMuted }]}>
          Missing history? Rebuild your Activity log from the workouts saved in Apple Health, including GPS routes.
        </Text>
      ) : null}
      <TouchableOpacity
        style={[styles.button, { backgroundColor: C.primaryDim, opacity: busy ? 0.7 : 1 }]}
        onPress={confirmRestore}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel="Restore activity history from Apple Health"
      >
        {busy ? <ActivityIndicator size="small" color={C.primary} /> : <Ionicons name="heart-circle-outline" size={18} color={C.primary} />}
        <Text style={[styles.buttonText, { color: C.primary }]}>{busy ? (progress ?? 'Restoring…') : 'Restore from Apple Health'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 10, marginTop: 12, alignSelf: 'stretch' },
  compact: { padding: 0, borderWidth: 0, backgroundColor: 'transparent' },
  body: { fontSize: 13, lineHeight: 18 },
  button: { minHeight: 44, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 12 },
  buttonText: { fontSize: 14, fontWeight: '700' },
});
