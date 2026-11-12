import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useRoute, useRouter } from 'expo-router';
import PageSafeAreaView from '../../../src/components/layout/PageSafeAreaView';
import ScreenHeader from '../../../src/components/layout/ScreenHeader';
import RaceLinkEditor from '../../../src/components/activity/RaceLinkEditor';
import { GoalAction, GoalMessage } from '../../../src/components/goals/GoalLifecycleCard';
import { useActivityStore } from '../../../src/store/activityStore';
import { useGoalArchiveStore } from '../../../src/store/goalArchiveStore';
import { useTrainingPlanStore } from '../../../src/store/trainingPlanStore';
import { useProfileStore } from '../../../src/store/profileStore';
import { useAuthStore } from '../../../src/store/authStore';
import { useSettingsStore } from '../../../src/store/settingsStore';
import { useColors } from '../../../src/theme/useColors';
import { captureOwnerLease, ownerLeaseIsCurrent } from '../../../src/lib/localDataOwner';
import { archiveFromLink } from '../../../src/utils/goal-archive-link';
import { isValidRaceActivityLink, raceEventSnapshot, raceLinkEvents } from '../../../src/utils/raceLink';
import { LAYOUT } from '../../../src/constants/layout';

export default function LinkRaceScreen() {
  const C = useColors();
  const router = useRouter();
  // Preserve opaque activity IDs. Do not apply another URI decode.
  const params = (useRoute().params ?? {}) as { activityId?: string; raceId?: string; archiveKey?: string };
  const access = useAuthStore(state => state.canAccessLocalData);
  const owner = useAuthStore(state => state.user?.id ?? state.offlineOwnerId);
  const athleteId = useProfileStore(state => state.activeAthleteId);
  const units = useSettingsStore(state => state.units);
  const races = useTrainingPlanStore(state => state.races);
  const activities = useActivityStore(state => state.activities);
  const activityStatus = useActivityStore(state => state.hydrationStatus);
  const archiveState = useGoalArchiveStore();
  const [readError, setReadError] = useState<string | null>(null);
  const [, refreshHydration] = useState(0);
  useEffect(() => {
    const stops = [useProfileStore.persist, useTrainingPlanStore.persist].map(store => store.onFinishHydration(() => refreshHydration(value => value + 1)));
    return () => { stops.forEach(stop => stop()); };
  }, []);
  async function load() {
    const lease = captureOwnerLease();
    if (!lease || !ownerLeaseIsCurrent(lease) || athleteId !== 'athlete_default') return;
    setReadError(null);
    try {
      if (useActivityStore.getState().hydrationStatus === 'error') await useActivityStore.persist.rehydrate();
      if (!ownerLeaseIsCurrent(lease)) return;
      await useGoalArchiveStore.getState().load(lease);
    }
    catch (error) { if (ownerLeaseIsCurrent(lease)) setReadError(error instanceof Error ? error.message : 'Saved races could not be loaded.'); }
  }
  useEffect(() => { if (access && athleteId === 'athlete_default') void load(); }, [access, owner, athleteId]);
  const ready = access && !!owner && athleteId === 'athlete_default' && activityStatus === 'ready'
    && useProfileStore.persist.hasHydrated() && useTrainingPlanStore.persist.hasHydrated()
    && archiveState.status === 'ready' && archiveState.ownerUserId === owner;
  const archives = ready ? archiveState.archives.filter(archive => archive.ownerUserId === owner && archive.athleteId === 'athlete_default') : [];
  const archive = params.archiveKey ? archiveFromLink(archives, { archiveKey: params.archiveKey }) : undefined;
  const events = ready ? raceLinkEvents(races, archives, owner!) : [];
  if (archive?.race) {
    const frozen = raceEventSnapshot(archive.race);
    const at = events.findIndex(event => event.id === frozen.id);
    if (at < 0) events.push(frozen); else events[at] = frozen;
  }
  const currentLink = activities.find(activity => activity.id === params.activityId)?.raceLink;
  if (ready && !params.archiveKey && !params.raceId && isValidRaceActivityLink(currentLink, owner!)) {
    const at = events.findIndex(event => event.id === currentLink.event.id);
    if (at < 0) events.push(currentLink.event); else events[at] = currentLink.event;
  }
  const runs = activities.filter(activity => activity.activityType === 'running');
  const close = () => router.canGoBack() ? router.back() : router.replace('/(tabs)/activity' as never);
  const blocked = !access || athleteId !== 'athlete_default' || activityStatus === 'error' || archiveState.status === 'error' || !!readError;
  const missingArchive = ready && !!params.archiveKey && !archive;
  return <PageSafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
    <ScreenHeader title="Race result" eyebrow="SAVED RUN" />
    <ScrollView keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: 18, paddingBottom: LAYOUT.screenPadBottom }}>
      {!ready ? <View style={{ gap: 14 }}>
        <GoalMessage>{!access ? 'Sign in with the account that owns this run.' : athleteId !== 'athlete_default'
          ? 'Race links are available for the default athlete. Saved runs are not yet separated by athlete.'
          : readError ?? (blocked ? 'Saved running history and races could not be loaded. Your saved records have not been changed.' : 'Loading saved runs and races…')}</GoalMessage>
        {blocked && access && athleteId === 'athlete_default' ? <GoalAction label="Retry loading races" onPress={() => { void load(); }} /> : null}
        <GoalAction label="Back" secondary onPress={close} />
      </View> : missingArchive ? <View style={{ gap: 14 }}>
        <GoalMessage>This archive link is unavailable. Open the archive again to link a saved run.</GoalMessage>
        <GoalAction label="Back" secondary onPress={close} />
      </View> : runs.length === 0 || events.length === 0 ? <View style={{ gap: 14 }}>
        <GoalMessage>{runs.length === 0 ? 'Save a running activity before linking a race.' : 'No saved or archived races are available to link.'}</GoalMessage>
        <GoalAction label="Done" secondary onPress={close} />
      </View> : <RaceLinkEditor key={`${owner}:${params.activityId ?? ''}:${params.raceId ?? archive?.race?.id ?? ''}:${archive?.id ?? ''}`}
        ownerUserId={owner!} units={units} activities={runs} archives={archives} events={events} initialActivityId={params.activityId}
        initialEventId={params.raceId ?? archive?.race?.id} archive={archive} onClose={close} />}
    </ScrollView>
  </PageSafeAreaView>;
}
