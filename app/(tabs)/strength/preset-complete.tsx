import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useColors } from '../../../src/theme/useColors';
import { useStrengthStore } from '../../../src/store/strengthStore';

export default function PresetCompleteScreen() {
  const C = useColors();
  const router = useRouter();
  const [rating, setRating] = useState<string | null>(null);
  const {
    name, duration, rpe, logId,
    completedSets, totalReps, externalLoadVolumeLb, bandSetsCount, bodyweightSetsCount, totalHoldSeconds, warmupSetsCount,
  } = useLocalSearchParams<{
    name: string; duration: string; rpe: string; logId: string;
    completedSets?: string; totalReps?: string; externalLoadVolumeLb?: string;
    bandSetsCount?: string; bodyweightSetsCount?: string; totalHoldSeconds?: string; warmupSetsCount?: string;
  }>();
  // Honest split — deliberately no single combined "volume" number.
  const summaryLines = [
    completedSets ? `${completedSets} sets · ${totalReps ?? 0} main reps` : null,
    externalLoadVolumeLb ? `External load: ${Number(externalLoadVolumeLb).toLocaleString()} lb` : null,
    bandSetsCount && Number(bandSetsCount) > 0 ? `Band sets: ${bandSetsCount} (not counted as load)` : null,
    bodyweightSetsCount && Number(bodyweightSetsCount) > 0 ? `Bodyweight sets: ${bodyweightSetsCount}` : null,
    totalHoldSeconds && Number(totalHoldSeconds) > 0 ? `Hold time: ${totalHoldSeconds}s` : null,
    warmupSetsCount && Number(warmupSetsCount) > 0 ? `Warm-up sets (excluded above): ${warmupSetsCount}` : null,
  ].filter((line): line is string => Boolean(line));
  const editLog = useStrengthStore(state => state.editLog);
  const savedLog = useStrengthStore(state => state.history.find(record => record.id === logId));

  function saveRating(nextRating: string) {
    setRating(nextRating);
    if (!logId) return;
    const baseNotes = savedLog?.notes?.replace(/ · Session feedback: (Too Easy|Just Right|Too Hard)\.?$/, '') ?? '';
    editLog(logId, { notes: `${baseNotes}${baseNotes ? ' · ' : ''}Session feedback: ${nextRating}.` });
  }
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: C.bg }]}>
      <View style={[styles.icon, { backgroundColor: C.primaryDim }]}>
        <Ionicons name="checkmark" size={38} color={C.primary} />
      </View>
      <Text style={[styles.eyebrow, { color: C.primary }]}>PRESET WORKOUT SAVED</Text>
      <Text style={[styles.title, { color: C.text }]}>{name}</Text>
      <Text style={[styles.summary, { color: C.textMuted }]}>{duration} min · Overall RPE {rpe}</Text>
      {summaryLines.length > 0 ? (
        <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border, marginTop: 14 }]}>
          <Text style={[styles.cardTitle, { color: C.text, marginBottom: 8 }]}>Session Summary</Text>
          {summaryLines.map(line => (
            <Text key={line} style={[styles.note, { color: C.textMuted, marginTop: 2 }]}>{line}</Text>
          ))}
        </View>
      ) : null}
      <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
        <Text style={[styles.cardTitle, { color: C.text }]}>How did the workout feel?</Text>
        <View style={styles.ratingRow}>
          {['Too Easy', 'Just Right', 'Too Hard'].map(label => (
            <TouchableOpacity
              key={label}
              onPress={() => saveRating(label)}
              style={[styles.rating, { backgroundColor: rating === label ? C.primaryDim : C.cardAlt, borderColor: rating === label ? C.primary : C.border }]}
            >
              <Text style={[styles.ratingText, { color: rating === label ? C.primary : C.textMuted }]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={[styles.note, { color: C.textMuted }]}>
          Your session, loads, RPE, and feedback are saved in Strength history. The Training Block Workout remains independent.
        </Text>
      </View>
      <TouchableOpacity style={[styles.button, { backgroundColor: C.primary }]} onPress={() => router.replace('/(tabs)/strength' as never)}>
        <Text style={[styles.buttonText, { color: C.onPrimary }]}>Done</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  icon: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  eyebrow: { fontSize: 10, fontWeight: '900', letterSpacing: 1.7 },
  title: { fontSize: 34, fontFamily: 'CormorantGaramond_700Bold', textAlign: 'center', marginTop: 6 },
  summary: { fontSize: 13, marginTop: 6 },
  card: { width: '100%', borderWidth: 1, borderRadius: 16, padding: 16, marginTop: 24 },
  cardTitle: { fontSize: 15, fontWeight: '900', textAlign: 'center' },
  ratingRow: { flexDirection: 'row', gap: 7, marginTop: 12 },
  rating: { flex: 1, minHeight: 42, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  ratingText: { fontSize: 11, fontWeight: '800', textAlign: 'center' },
  note: { fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 14 },
  button: { width: '100%', minHeight: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  buttonText: { fontSize: 14, fontWeight: '900' },
});
