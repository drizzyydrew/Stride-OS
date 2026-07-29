import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import ScreenHeader from '../../../src/components/layout/ScreenHeader';
import { useColors } from '../../../src/theme/useColors';
import { spacing } from '../../../src/theme/spacing';
import { radiusTokens, typographyTokens } from '../../../src/theme/tokens';
import { useWeekPlan } from '../../../src/hooks/useWeekPlan';
import { useScheduledSessions } from '../../../src/hooks/useScheduledSessions';
import { describeRunWalk } from '../../../src/utils/scheduledSessions';

function line(label: string, value: string | undefined | null): { label: string; value: string } | null {
  if (!value) return null;
  return { label, value };
}

export default function ScheduledWorkoutDetailScreen() {
  const C = useColors();
  const router = useRouter();
  const { scheduledSessionId } = useLocalSearchParams<{ scheduledSessionId?: string }>();
  const weekPlan = useWeekPlan();
  const scheduled = useScheduledSessions(weekPlan);
  const session = scheduledSessionId ? scheduled.getSessionById(scheduledSessionId) : null;
  const workout = session?.richWorkout ?? null;

  const rows = session ? [
    line('Training phase', session.trainingPhase),
    line('Training focus', session.trainingFocus),
    line('Purpose', session.purpose),
    line('Estimated duration', `${session.durationMinutes} min`),
    line('Estimated distance', session.distanceMiles ? `${session.distanceMiles.toFixed(2)} mi` : workout?.targetDistance ? `${workout.targetDistance.toFixed(2)} mi` : null),
    line('Warm-up', session.runWalk ? `${session.runWalk.warmupMinutes} minutes comfortable walking` : session.warmup ?? workout?.warmup.instructions),
    line('Main set', session.runWalk ? `Repeat ${session.runWalk.rounds} times: run ${Math.round(session.runWalk.runSeconds / 60 * 10) / 10} min, walk ${Math.round(session.runWalk.walkSeconds / 60 * 10) / 10} min.` : session.mainSet ?? workout?.mainSet.map(segment => segment.instructions).join(' ')),
    line('Cool-down', session.runWalk ? `${session.runWalk.cooldownMinutes} minutes easy walking` : session.cooldown ?? workout?.cooldown.instructions),
    line('Target RPE', session.rpeTarget ?? (workout ? `${workout.rpeRange[0]}-${workout.rpeRange[1]}` : null)),
    line('Pace guidance', session.runWalk ? `${session.runWalk.pace} effort. Use broad estimates only until your history supports tighter ranges.` : session.paceTarget ?? workout?.paceGuidance.targetPace),
    line('Heart-rate guidance', session.hrTarget ?? (workout ? `Zone ${workout.hrZoneTarget}` : null)),
    line('Talk test', session.runWalk ? 'You should be able to speak in short sentences during run portions and fully recover during walks.' : 'Stay conversational unless the workout explicitly asks for quality work.'),
    line('Terrain', session.activityType === 'run' || session.activityType === 'run_walk' ? 'Prefer predictable footing. Keep hills easy unless hills are prescribed.' : null),
    line('Treadmill equivalent', session.activityType === 'run' || session.activityType === 'run_walk' ? 'Use the same time and effort. Add a gentle 0.5-1% incline only if it keeps the effort controlled.' : null),
    line('Why today', session.adaptationReason ?? 'This session follows the current plan phase, focus, and weekly schedule.'),
    line('Adaptation context', session.adaptationReason ? 'Updated after a plan decision.' : 'Maintain current progression unless completion history or readiness suggests otherwise.'),
    line('Confidence', session.runWalk ? 'Limited-history pace guidance: effort, RPE, and talk test are primary.' : workout?.paceGuidance.description),
  ].filter(Boolean) as { label: string; value: string }[] : [];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: C.bg }]} edges={['top']}>
      <ScreenHeader eyebrow="WORKOUT DETAILS" title={session?.title ?? 'Workout'} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {!session ? (
          <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
            <Text style={[styles.title, { color: C.text }]}>Workout unavailable</Text>
            <Text style={[styles.body, { color: C.textMuted }]}>The scheduled session could not be resolved from the current canonical plan.</Text>
          </View>
        ) : (
          <>
            <View style={[styles.hero, { backgroundColor: C.card, borderColor: C.primary }]}>
              <Ionicons name="clipboard-outline" size={20} color={C.primary} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.title, { color: C.text }]}>{session.title}</Text>
                <Text style={[styles.body, { color: C.textMuted }]}>
                  {session.runWalk ? describeRunWalk(session.runWalk) : session.target}
                </Text>
              </View>
            </View>
            {rows.map(item => (
              <View key={item.label} style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
                <Text style={[styles.label, { color: C.textDim }]}>{item.label.toUpperCase()}</Text>
                <Text style={[styles.body, { color: C.text }]}>{item.value}</Text>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { paddingHorizontal: 18, paddingBottom: 120 },
  hero: { borderWidth: 1.5, borderRadius: radiusTokens.lg, padding: spacing.lg, marginBottom: spacing.md, flexDirection: 'row', gap: spacing.md },
  card: { borderWidth: 1, borderRadius: radiusTokens.md, padding: spacing.lg, marginBottom: spacing.sm },
  title: { fontSize: typographyTokens.sizes.sectionTitle, fontWeight: typographyTokens.weights.black },
  label: { fontSize: typographyTokens.sizes.metricLabel, fontWeight: typographyTokens.weights.black, letterSpacing: 0.7, marginBottom: spacing.xs },
  body: { fontSize: typographyTokens.sizes.body, lineHeight: 20, fontWeight: typographyTokens.weights.medium },
});
