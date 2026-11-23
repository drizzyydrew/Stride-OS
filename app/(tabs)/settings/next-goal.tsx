import { useEffect, useRef, useState } from 'react';
import { Keyboard, ScrollView, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';

import { ProfileSupportingGoals } from '../../../src/components/goals/SupportingGoals';
import type { GoalProfileId, GoalIntent } from '../../../src/types/goalIntent';
import { GOAL_PROFILE_OPTIONS, OUTDOOR_PROFILES, legacyGoalForProfile, profileForLegacyGoal, legacySupportingForIntent } from '../../../src/utils/goalIntent';
import PageSafeAreaView from '../../../src/components/layout/PageSafeAreaView';
import ScreenHeader from '../../../src/components/layout/ScreenHeader';
import StrideDateField from '../../../src/components/ui/StrideDateField';
import { GoalAction, GoalField, GoalMessage, GoalPicker, goalDate } from '../../../src/components/goals/GoalLifecycleCard';
import { useGoalLifecycle } from '../../../src/hooks/useGoalLifecycle';
import { continueOpenTraining, startNextGoal } from '../../../src/lib/goalLifecycle';
import { captureOwnerLease, ownerLeaseIsCurrent } from '../../../src/lib/localDataOwner';
import { useColors } from '../../../src/theme/useColors';
import type { RacePriority, TrainingGoalType } from '../../../src/types/plan';
import type { RaceDistance } from '../../../src/types/training';
import { addDaysToDateOnly, isValidDateOnly, todayDateOnly } from '../../../src/utils/dateOnly';
import { useProAccess } from '../../../src/hooks/useProAccess';
import ProAccessNotice from '../../../src/components/subscription/ProAccessNotice';
import { onboardingGoalDraft } from '../../../src/utils/pro-access';
import { useOnboardingStore } from '../../../src/store/onboardingStore';
import { useGoalArchiveStore } from '../../../src/store/goalArchiveStore';
import { normalizeGoalIntent } from '../../../src/utils/goalIntent';
import { useTrainingPlanStore } from '../../../src/store/trainingPlanStore';

const GOALS: { value: TrainingGoalType; label: string }[] = [
  { value: 'race_prep', label: 'Prepare for a race' },
  { value: 'general_running', label: 'Running' },
  { value: 'get_faster', label: 'Get faster' },
  { value: 'general_strength', label: 'Strength' },
  { value: 'hybrid', label: 'Hybrid · running and strength' },
];
const DISTANCES: { value: RaceDistance; label: string }[] = [
  { value: '5k', label: '5K' }, { value: '10k', label: '10K' },
  { value: 'half_marathon', label: 'Half marathon' }, { value: 'marathon', label: 'Marathon' },
];

export default function NextGoalScreen() {
  const lifecycle = useGoalLifecycle();
  const pro = useProAccess();
  const C = useColors();
  const router = useRouter();
  const params = useLocalSearchParams<{ focus?: string; source?: string; repeatArchiveId?: string }>();
  const archives = useGoalArchiveStore(state => state.archives);
  const repeatLoaded = useRef(false);
  const repeatOwner = useRef<string | null>(null);
  const operationId = useRef(`goal_form_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`);
  const [repeatReady, setRepeatReady] = useState(!params.repeatArchiveId);
  const [setupDraft] = useState(() => {
    const plan = useTrainingPlanStore.getState();
    return onboardingGoalDraft({ source: params.source, openTraining: plan.trainingMode === 'open',
      hasProgrammedBefore: !!(plan.programmingStartedAt || plan.goalBlockId || plan.activePresetGoal || plan.goalTitle),
      data: useOnboardingStore.getState().data, today: todayDateOnly() });
  });
  const [primaryProfile, setPrimaryProfile] = useState<GoalProfileId>(() => GOAL_PROFILE_OPTIONS.find(goal => goal.value === params.focus)?.value ?? profileForLegacyGoal(setupDraft?.goalType ?? GOALS.find(goal => goal.value === params.focus)?.value ?? 'general_running'));
  const [supportingProfiles, setSupportingProfiles] = useState<GoalProfileId[]>(() => (setupDraft?.secondaryGoalTypes ?? []).map(profileForLegacyGoal));
  const [season, setSeason] = useState<NonNullable<GoalIntent['season']>>('general');
  const [hasEvent, setHasEvent] = useState<'no' | 'yes'>('no');
  const [eventName, setEventName] = useState('');
  const [eventDate, setEventDate] = useState(() => addDaysToDateOnly(todayDateOnly(), 55));
  const intent: GoalIntent = { version: 1, priorities: [primaryProfile, ...supportingProfiles.filter(profile => profile !== primaryProfile)].slice(0, 3), season,
    ...(hasEvent === 'yes' && primaryProfile !== 'race_prep' ? { eventDate, eventName } : {}) };
  const [title, setTitle] = useState(setupDraft?.title ?? '');
  const [raceName, setRaceName] = useState(setupDraft?.raceName ?? '');
  const [distance, setDistance] = useState<RaceDistance>(setupDraft?.distance ?? '5k');
  const [priority, setPriority] = useState<RacePriority>(setupDraft?.priority ?? 'A');
  const [dateMode, setDateMode] = useState<'duration' | 'date'>('duration');
  const [weeks, setWeeks] = useState('8');
  const [endDate, setEndDate] = useState(() => addDaysToDateOnly(todayDateOnly(), 55));
  const [raceDate, setRaceDate] = useState(() => setupDraft?.raceDate ?? addDaysToDateOnly(todayDateOnly(), 56));
  const [busy, setBusy] = useState<'save' | 'skip' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const ready = lifecycle.status === 'ready' && lifecycle.isDefaultAthlete;
  const selectedGoalType = legacyGoalForProfile(primaryProfile);
  const isRace = primaryProfile === 'race_prep';
  useEffect(() => {
    if (!params.repeatArchiveId || repeatLoaded.current || !ready) return;
    const lease = captureOwnerLease();
    const archive = archives.find(item => item.id === params.repeatArchiveId && item.deletedAt === undefined && item.athleteId === 'athlete_default' && item.ownerUserId === lease?.ownerUserId);
    if (!archive || !lease || !ownerLeaseIsCurrent(lease)) return;
    const savedIntent = normalizeGoalIntent(archive.macroPlan?.goalIntent);
    const profile = savedIntent?.priorities[0] ?? profileForLegacyGoal(archive.goalType);
    setPrimaryProfile(profile); setSupportingProfiles(savedIntent?.priorities.slice(1) ?? []);
    setTitle(archive.metadata?.title ?? archive.title); setSeason(savedIntent?.season ?? 'general');
    const start = archive.metadata?.startDate ?? archive.startDate, end = archive.metadata?.endDate ?? archive.endDate;
    const duration = Math.ceil((new Date(`${end}T12:00:00`).getTime() - new Date(`${start}T12:00:00`).getTime() + 86400000) / (7 * 86400000));
    setWeeks(String(Math.min(104, Math.max(1, Number.isFinite(duration) ? duration : 8))));
    if (archive.race) { setRaceName(archive.race.name); setDistance(archive.race.distance); setPriority(archive.race.priority); }
    // Past event dates never carry forward or create an immediately expired plan.
    if (savedIntent?.eventDate && savedIntent.eventDate >= todayDateOnly()) { setHasEvent('yes'); setEventDate(savedIntent.eventDate); setEventName(savedIntent.eventName ?? ''); }
    else setHasEvent('no');
    repeatOwner.current = lease.ownerUserId; repeatLoaded.current = true; setRepeatReady(true);
  }, [params.repeatArchiveId, archives, ready]);
  const weekCount = /^\d+$/.test(weeks.trim()) ? Number(weeks.trim()) : NaN;
  const validWeeks = Number.isInteger(weekCount) && weekCount >= 1 && weekCount <= 104;
  const plannedEnd = isRace ? raceDate : dateMode === 'duration'
    ? validWeeks ? addDaysToDateOnly(todayDateOnly(), weekCount * 7 - 1) : '' : endDate;

  async function submit(skip: boolean) {
    if (inFlight.current || !ready || !skip && !repeatReady) return;
    setError(null);
    const today = todayDateOnly();
    let finalEnd = plannedEnd;
    if (!skip) {
      if (!title.trim()) { setError('Give this training block a title.'); return; }
      if (isRace && !raceName.trim()) { setError('Enter the race name so this event can be identified later.'); return; }
      if (!isRace && dateMode === 'duration') {
        if (!validWeeks) { setError('Enter a whole-number duration from 1 to 104 weeks.'); return; }
        finalEnd = addDaysToDateOnly(today, weekCount * 7 - 1);
      }
      if (!isValidDateOnly(finalEnd) || finalEnd < today) {
        setError('Choose a valid end date on or after today. Past dates cannot start a new goal.'); return;
      }
    }
    const lease = captureOwnerLease();
    if (!lease || !ownerLeaseIsCurrent(lease)) { setError('Your account is not ready. Unlock the device and retry. Your draft is still here.'); return; }
    if (!skip && params.repeatArchiveId && repeatOwner.current !== lease.ownerUserId) { setError('This saved goal belongs to a different account. Return to your goal history.'); return; }
    inFlight.current = true; setBusy(skip ? 'skip' : 'save'); Keyboard.dismiss();
    try {
      if (skip) await continueOpenTraining();
      else await startNextGoal({ title: title.trim(), goalType: selectedGoalType, goalIntent: intent, ...(params.repeatArchiveId ? { operationId: operationId.current } : {}), secondaryGoalTypes: legacySupportingForIntent(intent), endDate: finalEnd,
        ...(isRace ? { race: { name: raceName.trim(), date: finalEnd, distance, priority } } : {}) });
      if (!ownerLeaseIsCurrent(lease)) throw new Error('Your account changed. Sign in with the original account before continuing.');
      router.replace((skip ? '/(tabs)/activity' : '/(tabs)/dashboard') as never);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save your choice. Your draft is preserved; retry when ready.'); }
    finally { inFlight.current = false; setBusy(null); }
  }

  return (
    <PageSafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <Stack.Screen options={{ title: 'Your next goal' }} />
      <ScreenHeader title="Your next goal" eyebrow="AT YOUR PACE"
        onBack={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/dashboard' as never)} />
      <ScrollView keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets
        contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 18, gap: 20, paddingBottom: 48 }}>
        {!lifecycle.isDefaultAthlete ? <GoalMessage>New goals are currently available for the default athlete only. Existing history is not yet separated by athlete.</GoalMessage>
          : lifecycle.status === 'loading' ? <GoalMessage>Loading your training state…</GoalMessage>
            : lifecycle.status === 'error' ? <>
              <GoalMessage error>{lifecycle.error ?? 'Could not read saved training. Your draft is preserved.'}</GoalMessage>
              <GoalAction label="Retry loading" onPress={lifecycle.retry} />
            </> : null}
        <View pointerEvents={ready && !busy ? 'auto' : 'none'} style={{ gap: 20, opacity: ready ? 1 : 0.6 }}>
          {params.repeatArchiveId ? <GoalMessage>{repeatReady ? 'Repeat this goal with a fresh plan. Review the dates and priorities below; previous workouts and logged sets stay in history.' : 'Loading the saved goal for this account. If it was deleted or belongs to another account, return to your goal history.'}</GoalMessage> : null}
          <GoalMessage>A goal is optional. You can keep training without a plan and choose one later.</GoalMessage>
          <GoalPicker label="Primary goal" value={primaryProfile} options={GOAL_PROFILE_OPTIONS} onChange={profile => { setPrimaryProfile(profile); setSupportingProfiles(current => current.filter(id => id !== profile)); }} disabled={!ready || !!busy} />
          <ProfileSupportingGoals primary={primaryProfile} value={supportingProfiles} onChange={setSupportingProfiles} disabled={!ready || !!busy} />
          {primaryProfile === 'aerobic_base' && supportingProfiles.includes('get_faster') ? <GoalMessage>Easy-only base is your primary focus, so faster running stays preparatory for now. Change your primary goal when you want earned faster sessions.</GoalMessage> : null}
          {OUTDOOR_PROFILES.includes(primaryProfile) && supportingProfiles.some(profile => ['running','run_farther','get_faster','aerobic_base'].includes(profile)) ? <GoalMessage>Your outdoor goal keeps the main aerobic work. At most one supporting run fits when there are at least two aerobic slots; readiness and actual running history determine the dose. If time or recovery is limited, the supporting goal stays preparatory.</GoalMessage> : null}
          {OUTDOOR_PROFILES.includes(primaryProfile) ? <GoalPicker label="Training season" value={season} onChange={setSeason} disabled={!ready || !!busy} options={[
            { value: 'general', label: 'General preparation' }, { value: 'off_season', label: 'Off-season · build capacity' }, { value: 'in_season', label: 'In-season · support sport practice' },
          ]} /> : null}
          <GoalField label="Block title" value={title} onChange={setTitle} disabled={!ready || !!busy} placeholder="For example, winter running" />
          {isRace ? <>
            <GoalField label="Race name" value={raceName} onChange={setRaceName} disabled={!ready || !!busy} />
            <GoalPicker label="Race distance" value={distance} options={DISTANCES} onChange={setDistance} disabled={!ready || !!busy} />
            <GoalPicker label="Race priority" value={priority} onChange={setPriority} disabled={!ready || !!busy} options={[
              { value: 'A', label: 'A · primary goal race' }, { value: 'B', label: 'B · supporting event' }, { value: 'tune_up', label: 'Tune-up event' },
            ]} />
            <StrideDateField label="Race date" value={raceDate} onChange={setRaceDate} minDate={todayDateOnly()} disabled={!ready || !!busy} />
          </> : <>
            <GoalPicker label="Block length" value={dateMode} onChange={setDateMode} disabled={!ready || !!busy}
              options={[{ value: 'duration', label: 'Number of weeks' }, { value: 'date', label: 'Choose an end date' }]} />
            {dateMode === 'duration' ? <>
              <GoalField label="Duration in weeks · 1–104" value={weeks} onChange={setWeeks} numeric disabled={!ready || !!busy} />
              <GoalMessage>End date: {goalDate(plannedEnd)}</GoalMessage>
            </> : <StrideDateField label="Block end date" value={endDate} onChange={setEndDate} minDate={todayDateOnly()} disabled={!ready || !!busy} />}
          </>}
          {!isRace ? <>
            <GoalPicker label="Preparing for a specific event?" value={hasEvent} onChange={setHasEvent} disabled={!ready || !!busy} options={[
              { value: 'no', label: 'No event · keep building' }, { value: 'yes', label: 'Yes · prepare and freshen up for an event' },
            ]} />
            {hasEvent === 'yes' ? <>
              <GoalField label="Event name · optional" value={eventName} onChange={setEventName} disabled={!ready || !!busy} />
              <StrideDateField label="Event date · within this block" value={eventDate} onChange={setEventDate} minDate={todayDateOnly()} disabled={!ready || !!busy} />
            </> : <GoalMessage>A block end is a chance to review progress. Without an event, your plan will not force a peak or taper.</GoalMessage>}
          </> : null}
          <Text style={{ color: C.textMuted, fontSize: 14, lineHeight: 21 }}>Your archived training stays in history when you start a new goal.</Text>
        </View>
        {error ? <GoalMessage error>{error}</GoalMessage> : null}
        <ProAccessNotice access={pro} />
        <GoalAction label={busy === 'save' ? 'Saving goal…' : 'Start this goal'} onPress={() => { void submit(false); }} disabled={!ready || !repeatReady || !!busy || !pro.allowed} />
        <GoalAction label={busy === 'skip' ? 'Saving choice…' : 'Skip · keep training without a plan'} onPress={() => { void submit(true); }} disabled={!ready || !!busy} secondary />
        <GoalAction label="Explore beginner training paths" disabled={!ready || !!busy} secondary onPress={() => router.push('/(tabs)/activity/plans' as never)} />
      </ScrollView>
    </PageSafeAreaView>
  );
}
