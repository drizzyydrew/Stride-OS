import { archiveFromLink } from '../../../src/utils/goal-archive-link';
import { useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';

import PageSafeAreaView from '../../../src/components/layout/PageSafeAreaView';
import ScreenHeader from '../../../src/components/layout/ScreenHeader';
import { GoalAction, GoalBackupStatus, GoalDisclosure, GoalField, GoalMessage, GoalPicker, goalDate } from '../../../src/components/goals/GoalLifecycleCard';
import { useGoalLifecycle } from '../../../src/hooks/useGoalLifecycle';
import { captureOwnerLease, ownerLeaseIsCurrent } from '../../../src/lib/localDataOwner';
import { useActivityStore } from '../../../src/store/activityStore';
import { useGoalArchiveStore } from '../../../src/store/goalArchiveStore';
import { useSettingsStore } from '../../../src/store/settingsStore';
import { useColors } from '../../../src/theme/useColors';
import type { GoalArchive } from '../../../src/types/goalArchive';

const RESULTS: { value: GoalArchive['result']['status']; label: string }[] = [
  { value: 'unrecorded', label: 'Result not recorded' }, { value: 'finished', label: 'Finished' },
  { value: 'did_not_finish', label: 'Did not finish · DNF' }, { value: 'did_not_start', label: 'Did not start · DNS' },
];

function elapsed(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value) || value < 0) return '—';
  const seconds = Math.round(value);
  return `${Math.floor(seconds / 3600)}:${String(Math.floor(seconds / 60) % 60).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

/** A result is an elapsed time, never a time-of-day or decimal-minute estimate. */
function parseElapsed(text: string): number | null {
  const clean = text.trim();
  if (!/^(?:\d+:[0-5]\d|\d+:[0-5]\d:[0-5]\d)$/.test(clean)) return null;
  const parts = clean.split(':');
  if ((parts.length !== 2 && parts.length !== 3) || parts.some(part => !/^\d+$/.test(part))) return null;
  const values = parts.map(Number);
  if (values.slice(1).some(value => value > 59)) return null;
  const seconds = parts.length === 3 ? values[0] * 3600 + values[1] * 60 + values[2] : values[0] * 60 + values[1];
  return Number.isSafeInteger(seconds) && seconds > 0 ? seconds : null;
}

function ArchiveBody({ archive }: { archive: GoalArchive }) {
  const C = useColors();
  const router = useRouter();
  const activities = useActivityStore(state => state.activities);
  const activityHydration = useActivityStore(state => state.hydrationStatus);
  const units = useSettingsStore(state => state.units);
  const saveResult = useGoalArchiveStore(state => state.saveResult);
  const [status, setStatus] = useState(archive.result.status);
  const [time, setTime] = useState(() => archive.result.timeSeconds == null ? '' : elapsed(archive.result.timeSeconds));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const inFlight = useRef(false);
  const metric = units === 'metric';
  const distance = (meters: number | null) => meters == null || !Number.isFinite(meters) ? '—'
    : `${(meters / (metric ? 1000 : 1609.344)).toLocaleString(undefined, { maximumFractionDigits: 2 })} ${metric ? 'km' : 'mi'}`;
  const number = (value: number | null) => value == null || !Number.isFinite(value) ? '—' : value.toLocaleString(undefined, { maximumFractionDigits: 1 });
  const section = { backgroundColor: C.card, borderColor: C.border, borderWidth: 1, borderRadius: 16, padding: 18, gap: 12 } as const;

  async function save() {
    if (inFlight.current) return;
    setError(null); setSaved(false);
    const seconds = status === 'finished' && time.trim() ? parseElapsed(time) : undefined;
    if (seconds === null) { setError('Enter a positive elapsed time as m:ss or hh:mm:ss, with seconds and hour-format minutes from 00 to 59.'); return; }
    const lease = captureOwnerLease();
    if (!lease || !ownerLeaseIsCurrent(lease) || lease.ownerUserId !== archive.ownerUserId) {
      setError('This archive’s owner must be signed in before saving. Your draft is preserved.'); return;
    }
    inFlight.current = true; setBusy(true);
    try {
      await saveResult(archive.id, { status, ...(seconds === undefined ? {} : { timeSeconds: seconds }), source: 'user', updatedAt: Date.now() }, lease);
      if (!ownerLeaseIsCurrent(lease)) throw new Error('Your account changed while saving. Reopen this archive with its original account.');
      setSaved(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'The result could not be saved. Your draft is still here.'); }
    finally { inFlight.current = false; setBusy(false); }
  }

  return <View style={{ gap: 20 }}>
    <Text selectable accessibilityRole="header" style={{ color: C.text, fontSize: 24, fontWeight: '700' }}>{archive.title}</Text>
    <GoalMessage>{goalDate(archive.startDate)} – {goalDate(archive.endDate)}</GoalMessage>
    {archive.closureReason ? <GoalMessage>Closed when you changed your training focus. The race result is separate.</GoalMessage> : null}
    {archive.race && archive.race.date > archive.endDate ? <GoalMessage>Planned race date: {goalDate(archive.race.date)}</GoalMessage> : null}
    <View style={section}>
      <Text accessibilityRole="header" style={{ color: C.text, fontSize: 19, fontWeight: '700' }}>Recorded training during this block</Text>
      <GoalMessage>Frozen as of {new Date(archive.archivedAt).toLocaleString()}. These are recorded activities within the date window, not adherence or plan-completion scores. Later imports and corrections do not rewrite this snapshot.</GoalMessage>
      <GoalMessage>Completed activities: {number(archive.summary.completedActivities)}{ '\n' }Partial activities: {number(archive.summary.partialActivities)}{ '\n' }Active days: {number(archive.summary.activeDays)}{ '\n' }Recorded distance: {distance(archive.summary.distanceMeters)}{ '\n' }Recorded duration: {elapsed(archive.summary.durationSeconds)}{ '\n' }Elevation gain: {archive.summary.elevationGainMeters == null ? '—' : `${number(archive.summary.elevationGainMeters / (metric ? 1 : 0.3048))} ${metric ? 'm' : 'ft'}`}{ '\n' }Recorded training load: {number(archive.summary.trainingLoad)}</GoalMessage>
      <GoalMessage>Distance recorded for {archive.summary.coverage.distanceActivities} activities; duration recorded for {archive.summary.coverage.durationActivities}. — means unavailable. Totals include known values only.</GoalMessage>
    </View>
    <View style={section}>
      <Text accessibilityRole="header" style={{ color: C.text, fontSize: 19, fontWeight: '700' }}>Result</Text>
      <GoalMessage>Saved result: {RESULTS.find(item => item.value === archive.result.status)?.label ?? 'Result not recorded'}{archive.result.timeSeconds == null ? '' : ` · ${elapsed(archive.result.timeSeconds)}`}</GoalMessage>
      <GoalMessage>A result is separate from the frozen training totals. No result does not mean DNF or DNS.</GoalMessage>
      <GoalPicker label="Result status" value={status} options={RESULTS} disabled={busy} onChange={value => { setStatus(value); setSaved(false); }} />
      {status === 'finished' ? <GoalField label="Finish time · optional" placeholder="m:ss or hh:mm:ss" value={time} disabled={busy} onChange={value => { setTime(value); setSaved(false); }} /> : null}
      {error ? <GoalMessage error>{error}</GoalMessage> : null}
      {saved ? <GoalMessage>Result saved. Archived training totals are unchanged.</GoalMessage> : null}
      <GoalAction label={busy ? 'Saving result…' : 'Save result'} disabled={busy} onPress={() => { void save(); }} />
    </View>
    <View style={section}>
      <GoalDisclosure label="Weekly recorded totals">
        <GoalMessage>Only weeks with recorded activities are listed; absent weeks have no recorded total.</GoalMessage>
        {archive.summary.weeks.length === 0 ? <GoalMessage>No weekly activity totals were recorded.</GoalMessage> : archive.summary.weeks.map(week =>
          <GoalMessage key={week.startDate}>Week of {goalDate(week.startDate)} · {week.activityCount} activities{ '\n' }{distance(week.distanceMeters)} · {elapsed(week.durationSeconds)}</GoalMessage>)}
      </GoalDisclosure>
      <GoalDisclosure label="Archived plan outline">
        <GoalMessage>This is the saved plan reference. It does not reconstruct historical prescriptions or prove which sessions were followed.</GoalMessage>
        {archive.macroPlan ? archive.macroPlan.weeks.map(week => <GoalMessage key={`${week.weekNumber}:${week.startDate}`}>Week {week.weekNumber} · {goalDate(week.startDate)} · {week.phase}{ '\n' }{week.focus}</GoalMessage>) : null}
        {archive.beginnerPlan ? <>
          <GoalMessage>Beginner path · {archive.beginnerPlan.durationWeeks} weeks · target {goalDate(archive.beginnerPlan.targetDate)}</GoalMessage>
          {archive.beginnerPlan.weeks.map(week => <View key={week.weekNumber} style={{ gap: 6 }}>
            <GoalMessage>Week {week.weekNumber}: {week.focus}</GoalMessage>
            {week.sessions.map(session => <GoalMessage key={session.id}>Day {session.dayIndex + 1} · {session.kind.replace(/_/g, ' ')} · {session.durationMinutes} min{ '\n' }{session.explanation}</GoalMessage>)}
          </View>)}
        </> : null}
        {!archive.macroPlan && !archive.beginnerPlan ? <GoalMessage>No plan outline was captured. Historical workouts have not been invented.</GoalMessage> : null}
      </GoalDisclosure>
      <GoalDisclosure label="Activities in this snapshot">
        <GoalMessage>Available links open the current activity record. Its details may have changed since this snapshot.</GoalMessage>
        {activityHydration !== 'ready' ? <GoalMessage>{activityHydration === 'error' ? 'Activity records could not be read. Unlock the device and retry loading this archive.' : 'Loading saved activity records…'}</GoalMessage>
          : archive.summary.activityIds.length === 0 ? <GoalMessage>No recorded activities in this window.</GoalMessage> : archive.summary.activityIds.map((id, index) => {
          const activity = activities.find(item => item.id === id);
          return activity ? <GoalAction key={id} label={`${index + 1}. ${activity.activityType.replace(/_/g, ' ')} · ${new Date(activity.startTime).toLocaleDateString()}`}
            secondary onPress={() => {
              const lease = captureOwnerLease();
              if (!lease || !ownerLeaseIsCurrent(lease) || lease.ownerUserId !== archive.ownerUserId) { setError('Sign in with this archive’s owner to open activity details.'); return; }
              if (!useActivityStore.getState().activities.some(item => item.id === id)) { setError('This activity is unavailable. It has not been restored or recreated.'); return; }
              router.push({ pathname: '/(tabs)/activity/[activityId]', params: { activityId: id } } as never);
            }} /> : <GoalMessage key={id}>Activity {index + 1} · Unavailable (deleted or not on this device)</GoalMessage>;
        })}
      </GoalDisclosure>
    </View>
    <GoalAction label="View all archives" secondary onPress={() => router.push('/(tabs)/settings/goal-archive' as never)} />
  </View>;
}

export default function GoalArchiveDetailScreen() {
  const lifecycle = useGoalLifecycle();
  const C = useColors();
  const router = useRouter();
  const params = useLocalSearchParams<{ archiveKey?: string | string[]; id?: string | string[] }>();
  const archive = lifecycle.status === 'ready' && lifecycle.isDefaultAthlete
    ? archiveFromLink(lifecycle.archives.filter(item => item.athleteId === 'athlete_default'), params) : undefined;
  return <PageSafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
    <Stack.Screen options={{ title: 'Archived block' }} />
    <ScreenHeader title="Archived block" eyebrow="TRAINING HISTORY"
      onBack={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/settings/goal-archive' as never)} />
    <ScrollView keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: 18, gap: 16, paddingBottom: 48 }}>
      {!lifecycle.isDefaultAthlete ? <GoalMessage>Archives are available for the default athlete only. Historical activities are not yet separated by athlete.</GoalMessage>
        : lifecycle.status === 'loading' ? <GoalMessage>Loading saved archive…</GoalMessage>
          : lifecycle.status === 'error' ? <>
            <GoalMessage error>{lifecycle.error ?? 'The saved archive could not be read.'}</GoalMessage>
            <GoalAction label="Retry" onPress={lifecycle.retry} />
          </> : archive ? <>
            <GoalBackupStatus status={'syncStatus' in lifecycle ? lifecycle.syncStatus : undefined} />
            <ArchiveBody key={`${archive.ownerUserId}:${archive.id}`} archive={archive} />
          </> : <>
            <GoalMessage>This archive is unavailable on this device, or the link is incomplete. No training data has been recreated.</GoalMessage>
            <GoalAction label="View training archive" onPress={() => router.replace('/(tabs)/settings/goal-archive' as never)} />
          </>}
    </ScrollView>
  </PageSafeAreaView>;
}
