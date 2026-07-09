import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useColors } from '../../../src/theme/useColors';
import { LAYOUT } from '../../../src/constants/layout';
import { getMobilityWorkout, getMobilityExercise } from '../../../src/constants/mobilityBank';
import { useMobilityStore, lastCompletedAt } from '../../../src/store/mobilityStore';
import InfoButton from '../../../src/components/shared/InfoButton';

function formatDose(dose: { sets?: number; reps?: number; holdSec?: number; timeSec?: number; perSide?: boolean }): string {
  const parts: string[] = [];
  if (dose.sets) parts.push(`${dose.sets} set${dose.sets === 1 ? '' : 's'}`);
  if (dose.reps) parts.push(`${dose.reps} rep${dose.reps === 1 ? '' : 's'}`);
  if (dose.holdSec) parts.push(`${dose.holdSec}s hold`);
  if (dose.timeSec) parts.push(`${dose.timeSec}s`);
  let str = parts.join(' × ');
  if (dose.perSide) str += ' · each side';
  return str || '—';
}

export default function MobilityWorkoutScreen() {
  const C = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const completions = useMobilityStore(s => s.completions);

  const workout = id ? getMobilityWorkout(id) : undefined;
  const lastDone = workout ? lastCompletedAt(completions, workout.id) : null;

  if (!workout) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <View style={[styles.screenHeader, { paddingTop: insets.top + 6, backgroundColor: C.bg }]}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="arrow-back" size={20} color={C.primary} />
          </TouchableOpacity>
        </View>
        <View style={{ paddingHorizontal: 18 }}>
          <Text style={{ color: C.textMuted }}>Workout not found.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={[styles.screenHeader, { paddingTop: insets.top + 6, backgroundColor: C.bg }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={20} color={C.primary} />
        </TouchableOpacity>
        <View style={{ marginLeft: 10, flex: 1 }}>
          <Text style={[styles.headerLabel, { color: C.textDim }]}>MOBILITY</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={[styles.headerTitle, { color: C.text }]}>{workout.title}</Text>
            <InfoButton term="mobility" />
          </View>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: LAYOUT.screenPadBottom }}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
          <Text style={[styles.purpose, { color: C.textMuted }]}>{workout.purpose}</Text>
          <View style={styles.metaRow}>
            <View style={styles.metaCell}>
              <Text style={[styles.metaValue, { color: C.text }]}>{workout.durationMin}</Text>
              <Text style={[styles.metaLabel, { color: C.textDim }]}>MIN</Text>
            </View>
            <View style={[styles.metaDivider, { backgroundColor: C.border }]} />
            <View style={styles.metaCell}>
              <Text style={[styles.metaValue, { color: C.text }]}>{workout.exercises.length}</Text>
              <Text style={[styles.metaLabel, { color: C.textDim }]}>EXERCISES</Text>
            </View>
            <View style={[styles.metaDivider, { backgroundColor: C.border }]} />
            <View style={styles.metaCell}>
              <Text style={[{ fontSize: 12, fontWeight: '700', color: C.text, textAlign: 'center' }]}>{workout.recommendedFrequency}</Text>
              <Text style={[styles.metaLabel, { color: C.textDim }]}>FREQUENCY</Text>
            </View>
          </View>
          <Text style={[{ fontSize: 12, color: lastDone ? C.primary : C.textDim, marginTop: 10, fontWeight: '600' }]}>
            {lastDone ? `Last done ${new Date(lastDone).toLocaleDateString()}` : 'Not done yet'}
          </Text>
        </View>

        {/* Evidence rationale */}
        <View style={[styles.card, { backgroundColor: C.cardAlt, borderColor: C.border }]}>
          <Text style={[styles.cardLabel, { color: C.textDim, marginBottom: 6 }]}>WHY THIS WORKOUT</Text>
          <Text style={[{ fontSize: 12, color: C.textMuted, lineHeight: 18 }]}>{workout.evidenceRationale}</Text>
        </View>

        {workout.cautionNote && (
          <View style={[styles.card, { backgroundColor: C.warningDim, borderColor: C.warning }]}>
            <Text style={[{ fontSize: 12, color: C.warning, fontWeight: '700', marginBottom: 4 }]}>A NOTE BEFORE YOU START</Text>
            <Text style={[{ fontSize: 12, color: C.textMuted, lineHeight: 18 }]}>{workout.cautionNote}</Text>
          </View>
        )}

        {/* Exercise list */}
        <Text style={[styles.cardLabel, { color: C.textDim, marginBottom: 8, marginTop: 4 }]}>EXERCISES</Text>
        {workout.exercises.map((planned, i) => {
          const exercise = getMobilityExercise(planned.exerciseId);
          if (!exercise) return null;
          const dose = { ...exercise.dose, ...planned.dose };
          return (
            <View key={planned.exerciseId} style={[styles.exCard, { backgroundColor: C.card, borderColor: C.border }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <Text style={[{ fontSize: 10, fontWeight: '700', color: C.accent, letterSpacing: 0.4 }]}>{i + 1}. {exercise.targetArea.toUpperCase()}</Text>
                  <Text style={[styles.subTitle, { color: C.text, marginTop: 2 }]}>{exercise.name}</Text>
                </View>
                <Text style={[{ fontSize: 12, fontWeight: '700', color: C.primary }]}>{formatDose(dose)}</Text>
              </View>
              {planned.cues.length > 0 && (
                <View style={{ marginTop: 8 }}>
                  {planned.cues.map(c => (
                    <Text key={c} style={[{ fontSize: 12, color: C.textMuted, lineHeight: 17 }]}>· {c}</Text>
                  ))}
                </View>
              )}
            </View>
          );
        })}

        {/* Disclaimer footer */}
        <View style={[styles.disclaimerBox, { borderColor: C.border }]}>
          <Text style={[{ fontSize: 11, color: C.textDim, lineHeight: 16, textAlign: 'center' }]}>
            Mobility work supports training decisions. It is not a diagnosis or a substitute for clinical care. Stop if you feel sharp pain.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.startBtn, { backgroundColor: C.primary }]}
          activeOpacity={0.85}
          onPress={() => router.push({ pathname: '/(tabs)/strength/mobility-session', params: { id: workout.id } } as any)}
        >
          <Text style={[{ fontSize: 15, fontWeight: '700', color: C.onPrimary }]}>Start {workout.title}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingBottom: 10,
  },
  headerLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    fontFamily: 'CormorantGaramond_700Bold',
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 10,
  },
  cardLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  purpose: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 12,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaCell: {
    flex: 1,
    alignItems: 'center',
  },
  metaValue: {
    fontSize: 18,
    fontWeight: '800',
  },
  metaLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginTop: 2,
  },
  metaDivider: {
    width: 1,
    height: 30,
  },
  subTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  exCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 8,
  },
  disclaimerBox: {
    borderTopWidth: 1,
    paddingTop: 14,
    marginTop: 6,
    marginBottom: 16,
  },
  startBtn: {
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
});
