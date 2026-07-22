import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import ScreenHeader from '../../../src/components/layout/ScreenHeader';
import { useWeekPlan } from '../../../src/hooks/useWeekPlan';
import { useScheduledSessions } from '../../../src/hooks/useScheduledSessions';
import { useColors } from '../../../src/theme/useColors';
import { plannedVersusCompletedComparison } from '../../../src/utils/activityCompletion';

export default function PlannedCompletedCompareScreen() {
  const C = useColors();
  const router = useRouter();
  const { scheduledSessionId } = useLocalSearchParams<{ scheduledSessionId?: string }>();
  const weekPlan = useWeekPlan();
  const scheduled = useScheduledSessions(weekPlan);
  const session = scheduledSessionId ? scheduled.getSessionById(scheduledSessionId) : null;
  const activity = scheduledSessionId ? scheduled.getCompletedActivityForScheduledSession(scheduledSessionId) : null;
  const rows = session ? plannedVersusCompletedComparison(session, activity) : [];

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: C.bg }]} edges={['top']}>
      <ScreenHeader eyebrow="ACTIVITY REVIEW" title="Planned vs. Completed" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={s.content}>
        {!session ? (
          <View style={[s.card, { backgroundColor: C.card, borderColor: C.border }]}>
            <Text style={[s.title, { color: C.text }]}>Scheduled session unavailable</Text>
            <Text style={[s.body, { color: C.textMuted }]}>
              We couldn’t resolve the planned workout. The completed Activity remains available in your Activity history.
            </Text>
            <TouchableOpacity style={[s.button, { backgroundColor: C.primary }]} onPress={() => router.replace('/(tabs)/activity' as never)}>
              <Text style={[s.buttonText, { color: C.onPrimary }]}>Back to Activity</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={[s.card, { backgroundColor: C.card, borderColor: C.border }]}>
              <Text style={[s.eyebrow, { color: C.textDim }]}>PLANNED PRESCRIPTION</Text>
              <Text style={[s.title, { color: C.text }]}>{session.title}</Text>
              <Text style={[s.body, { color: C.textMuted }]}>{session.purpose}</Text>
            </View>
            <View style={[s.card, { backgroundColor: C.card, borderColor: C.border }]}>
              <Text style={[s.eyebrow, { color: C.textDim }]}>COMPARISON</Text>
              {rows.map(row => (
                <Text key={row} style={[s.body, { color: C.textMuted }]}>{row}</Text>
              ))}
            </View>
            {activity ? (
              <TouchableOpacity
                style={[s.button, { backgroundColor: C.primary }]}
                onPress={() => router.push({ pathname: '/(tabs)/activity/[activityId]', params: { activityId: activity.id } } as never)}
              >
                <Text style={[s.buttonText, { color: C.onPrimary }]}>View Completed Activity</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[s.button, { backgroundColor: C.primary }]}
                onPress={() => router.push({ pathname: '/(tabs)/activity/manual', params: { scheduledSessionId } } as never)}
              >
                <Text style={[s.buttonText, { color: C.onPrimary }]}>Log Completion</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  content: { paddingHorizontal: 18, paddingBottom: 120 },
  card: { borderWidth: 1, borderRadius: 18, padding: 16, marginBottom: 12 },
  eyebrow: { fontSize: 10, fontWeight: '900', letterSpacing: 1.1, marginBottom: 8 },
  title: { fontSize: 22, fontWeight: '900', marginBottom: 8 },
  body: { fontSize: 13, lineHeight: 20, marginTop: 4 },
  button: { minHeight: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontSize: 14, fontWeight: '900' },
});
