import { useRef, useState } from 'react';
import { Keyboard, ScrollView, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';

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

const GOALS: { value: TrainingGoalType; label: string }[] = [
  { value: 'race_prep', label: 'Prepare for a race' },
  { value: 'general_running', label: 'Running' },
  { value: 'general_strength', label: 'Strength' },
  { value: 'hybrid', label: 'Hybrid · running and strength' },
];
const DISTANCES: { value: RaceDistance; label: string }[] = [
  { value: '5k', label: '5K' }, { value: '10k', label: '10K' },
  { value: 'half_marathon', label: 'Half marathon' }, { value: 'marathon', label: 'Marathon' },
];

export default function NextGoalScreen() {
  const lifecycle = useGoalLifecycle();
  const C = useColors();
  const router = useRouter();
  const params = useLocalSearchParams<{ focus?: string }>();
  const [goalType, setGoalType] = useState<TrainingGoalType>(() => GOALS.find(goal => goal.value === params.focus)?.value ?? 'general_running');
  const [title, setTitle] = useState('');
  const [raceName, setRaceName] = useState('');
  const [distance, setDistance] = useState<RaceDistance>('5k');
  const [priority, setPriority] = useState<RacePriority>('A');
  const [dateMode, setDateMode] = useState<'duration' | 'date'>('duration');
  const [weeks, setWeeks] = useState('8');
  const [endDate, setEndDate] = useState(() => addDaysToDateOnly(todayDateOnly(), 55));
  const [raceDate, setRaceDate] = useState(() => addDaysToDateOnly(todayDateOnly(), 56));
  const [busy, setBusy] = useState<'save' | 'skip' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const ready = lifecycle.status === 'ready' && lifecycle.isDefaultAthlete;
  const isRace = goalType === 'race_prep';
  const weekCount = /^\d+$/.test(weeks.trim()) ? Number(weeks.trim()) : NaN;
  const validWeeks = Number.isInteger(weekCount) && weekCount >= 1 && weekCount <= 104;
  const plannedEnd = isRace ? raceDate : dateMode === 'duration'
    ? validWeeks ? addDaysToDateOnly(todayDateOnly(), weekCount * 7 - 1) : '' : endDate;

  async function submit(skip: boolean) {
    if (inFlight.current || !ready) return;
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
    inFlight.current = true; setBusy(skip ? 'skip' : 'save'); Keyboard.dismiss();
    try {
      if (skip) await continueOpenTraining();
      else await startNextGoal({ title: title.trim(), goalType, endDate: finalEnd,
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
          <GoalMessage>A goal is optional. You can keep training without a plan and choose one later.</GoalMessage>
          <GoalPicker label="Training focus" value={goalType} options={GOALS} onChange={setGoalType} disabled={!ready || !!busy} />
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
          <Text style={{ color: C.textMuted, fontSize: 14, lineHeight: 21 }}>Your archived training stays in history when you start a new goal.</Text>
        </View>
        {error ? <GoalMessage error>{error}</GoalMessage> : null}
        <GoalAction label={busy === 'save' ? 'Saving goal…' : 'Start this goal'} onPress={() => { void submit(false); }} disabled={!ready || !!busy} />
        <GoalAction label={busy === 'skip' ? 'Saving choice…' : 'Skip · keep training without a plan'} onPress={() => { void submit(true); }} disabled={!ready || !!busy} secondary />
        <GoalAction label="Explore beginner training paths" disabled={!ready || !!busy} secondary onPress={() => router.push('/(tabs)/activity/plans' as never)} />
      </ScrollView>
    </PageSafeAreaView>
  );
}
