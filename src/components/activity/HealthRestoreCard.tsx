import { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { getHealthKitWorkoutHistory, requestPermissions } from '../../lib/healthKit';
import { useActivityStore } from '../../store/activityStore';
import { useIntegrationsStore } from '../../store/integrationsStore';
import { useColors } from '../../theme/useColors';
import { buildHealthKitActivityDraft, isDuplicateHealthKitWorkout } from '../../utils/healthKitImport';

const RESTORE_DAYS = 3650;
const RESTORE_LIMIT = 2000;
const MIN_WORKOUT_SECONDS = 60;

/**
 * Rebuilds the Activity log from Apple Health: every workout saved there by
 * StrideOS, the StrideOS watch app, Apple Workout, or other apps, including
 * GPS routes. Skips anything already in the log, so it is safe to run again.
 */
export default function HealthRestoreCard({ compact = false }: { compact?: boolean }) {
  const C = useColors();
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);

  async function restore() {
    if (busy) return;
    setBusy(true);
    setProgress('Asking Apple Health…');
    try {
      const granted = await requestPermissions().catch(() => false);
      // The wipe also reset the "Apple Health connected" setting; restoring
      // reconnects it so live Health data and Health writes resume.
      if (granted) useIntegrationsStore.getState().setHealthKit(true);
      const candidates = await getHealthKitWorkoutHistory({
        days: RESTORE_DAYS,
        limit: RESTORE_LIMIT,
        includeRoutes: true,
        onProgress: (done, total) => setProgress(`Reading workouts ${done} / ${total}…`),
      });
      const store = useActivityStore.getState();
      let restored = 0;
      let withRoutes = 0;
      for (const candidate of candidates) {
        if (candidate.durationSeconds < MIN_WORKOUT_SECONDS) continue;
        if (isDuplicateHealthKitWorkout(candidate, useActivityStore.getState().activities)) continue;
        store.addActivity(buildHealthKitActivityDraft({ candidate }));
        restored += 1;
        if (candidate.routeCoordinates?.length) withRoutes += 1;
      }
      setProgress(null);
      Alert.alert(
        restored ? 'Activity log restored' : 'Nothing new to restore',
        restored
          ? `Restored ${restored} workout${restored === 1 ? '' : 's'} from Apple Health${withRoutes ? `, ${withRoutes} with GPS routes` : ''}.`
          : candidates.length
            ? 'Every Apple Health workout is already in your Activity log.'
            : 'No workouts were found in Apple Health. Check that StrideOS can read Workouts and Workout Routes in Settings → Health → Data Access & Devices.',
      );
    } catch (error) {
      setProgress(null);
      Alert.alert('Restore failed', error instanceof Error ? error.message : 'Apple Health could not be read.');
    } finally {
      setBusy(false);
    }
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
        onPress={restore}
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
