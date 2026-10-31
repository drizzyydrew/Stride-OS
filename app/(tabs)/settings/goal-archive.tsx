import { useMemo } from 'react';
import { FlatList, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';

import PageSafeAreaView from '../../../src/components/layout/PageSafeAreaView';
import ScreenHeader from '../../../src/components/layout/ScreenHeader';
import { GoalAction, GoalBackupStatus, GoalMessage, goalDate } from '../../../src/components/goals/GoalLifecycleCard';
import { useGoalLifecycle } from '../../../src/hooks/useGoalLifecycle';
import { useColors } from '../../../src/theme/useColors';

export default function GoalArchiveScreen() {
  const lifecycle = useGoalLifecycle();
  const C = useColors();
  const router = useRouter();
  const archives = useMemo(() => lifecycle.status === 'ready' && lifecycle.isDefaultAthlete
    ? [...lifecycle.archives].filter(item => item.athleteId === 'athlete_default').sort((a, b) => b.archivedAt - a.archivedAt)
    : [], [lifecycle.archives, lifecycle.isDefaultAthlete, lifecycle.status]);
  return (
    <PageSafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <Stack.Screen options={{ title: 'Training archive' }} />
      <ScreenHeader title="Training archive" eyebrow="YOUR TRAINING STORY"
        onBack={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/settings' as never)} />
      <FlatList data={archives} keyExtractor={item => item.id} contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: 18, gap: 16, paddingBottom: 40 }}
        ListHeaderComponent={<View style={{ gap: 10 }}>
          <GoalMessage>Past goals and recorded training, preserved as of the day each block was archived.</GoalMessage>
          {archives.length > 0 ? <GoalBackupStatus status={'syncStatus' in lifecycle ? lifecycle.syncStatus : undefined} /> : null}
        </View>}
        ListEmptyComponent={<View style={{ gap: 12 }}>
          {!lifecycle.isDefaultAthlete ? <GoalMessage>Archives are available for the default athlete only. Historical activities are not yet separated by athlete.</GoalMessage>
            : lifecycle.status === 'loading' ? <GoalMessage>Loading saved archives…</GoalMessage>
              : lifecycle.status === 'error' ? <>
                <GoalMessage error>{lifecycle.error ?? 'Could not load saved archives.'}</GoalMessage>
                <GoalAction label="Retry" onPress={lifecycle.retry} />
              </> : <>
                <GoalMessage>No archived blocks yet. Your existing activities remain in Activity history.</GoalMessage>
                <GoalAction label="View activity history" onPress={() => router.push('/(tabs)/activity' as never)} />
              </>}
        </View>}
        renderItem={({ item }) => <View style={{ backgroundColor: C.card, borderRadius: 16, padding: 18, borderWidth: 1, borderColor: C.border, gap: 10 }}>
          <Text accessibilityRole="header" selectable style={{ color: C.text, fontSize: 20, fontWeight: '700' }}>{item.title}</Text>
          <GoalMessage>{goalDate(item.startDate)} – {goalDate(item.endDate)}</GoalMessage>
          {item.closureReason ? <GoalMessage>Closed when you changed your training focus. The race result is separate.</GoalMessage> : null}
          {item.race && item.race.date > item.endDate ? <GoalMessage>Planned race date: {goalDate(item.race.date)}</GoalMessage> : null}
          <GoalMessage>{item.summary.completedActivities} completed · {item.summary.partialActivities} partial activities recorded during this window</GoalMessage>
          <GoalAction label={`View results: ${item.title}`} onPress={() => router.push({ pathname: '/(tabs)/settings/goal-archive-detail', params: { id: item.id } } as never)} />
        </View>} />
    </PageSafeAreaView>
  );
}
