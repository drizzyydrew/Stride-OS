import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Text, View, useWindowDimensions } from 'react-native';
import { Collapsible, Host, RNHostView } from '@expo/ui';
import { useFocusEffect } from 'expo-router';
import { GoalAction, GoalPicker } from '../goals/GoalLifecycleCard';
import { useColors } from '../../theme/useColors';
import { useThemeMode } from '../../store/themeStore';
import { useProfileStore } from '../../store/profileStore';
import { savePlyometricResponse, useStrengthStore } from '../../store/strengthStore';
import { captureOwnerLease, getLocalDataOwner, ownerLeaseIsCurrent } from '../../lib/localDataOwner';
import { reportablePlyometricExercises } from '../../utils/plyometricReporting';
import { IMPACT_RESPONSE_DELAY_MS, normalizePlyometricResponse, type PlyometricResponseFeedback } from '../../utils/plyometricFeedback';
import { getExercise } from '../../utils/strengthEngine';
import type { CompletedExercise, StrengthLogRecord } from '../../types/strength';

export default function PlyometricResponse({ recordId }: { recordId?: string }) {
  const C = useColors();
  const mode = useThemeMode();
  const { fontScale } = useWindowDimensions();
  const record = useStrengthStore(state => state.history.find(item => item.id === recordId));
  const athlete = useProfileStore(state => state.activeAthleteId);
  const [open, setOpen] = useState(false);
  const [ownerEpoch, setOwnerEpoch] = useState(0);
  const [now, setNow] = useState(Date.now);
  const [hydrated, setHydrated] = useState(() => useStrengthStore.persist.hasHydrated() && useProfileStore.persist.hasHydrated());
  useFocusEffect(useCallback(() => { setNow(Date.now()); }, [recordId]));
  useEffect(() => getLocalDataOwner()?.onLeaseInvalidated(() => {
    setOpen(false);
    setOwnerEpoch(epoch => epoch + 1);
  }), []);
  useEffect(() => {
    const update = () => setHydrated(useStrengthStore.persist.hasHydrated() && useProfileStore.persist.hasHydrated());
    const stops = [useStrengthStore.persist.onHydrate(() => setHydrated(false)), useStrengthStore.persist.onFinishHydration(update),
      useProfileStore.persist.onHydrate(() => setHydrated(false)), useProfileStore.persist.onFinishHydration(update)];
    update();
    return () => stops.forEach(stop => stop());
  }, []);
  const lease = captureOwnerLease();
  const ownerKey = lease ? `${lease.ownerUserId}:${lease.generation}:${ownerEpoch}` : null;
  const exercises = reportablePlyometricExercises(record, now);
  if (!ownerKey || !hydrated || !useStrengthStore.persist.hasHydrated() || !useProfileStore.persist.hasHydrated()
    || athlete !== 'athlete_default' || !record || !exercises.length) return null;
  return <View style={{ width: '100%', minWidth: 0, marginBottom: 14, borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 14 }}>
    <Host matchContents={{ vertical: true }} colorScheme={mode} seedColor={C.primary} style={{ width: '100%', minHeight: 44 }}>
      <Collapsible label="Jump response" isOpen={open} onOpenChange={value => { setNow(Date.now()); setOpen(value); }}
        labelStyle={{ color: C.text, fontSize: 14 * fontScale, fontWeight: '600' }}>
        {open ? <RNHostView matchContents={{ vertical: true }}><View style={{ width: '100%', minWidth: 0, gap: 14, paddingVertical: 12 }}>
          <Text style={{ color: C.textMuted, fontSize: 13, lineHeight: 20 }}>Optional: report how each completed jumping exercise felt. Future plans consider your response alongside training and recovery. Your saved workout stays unchanged.</Text>
          {exercises.map(exercise => <ExerciseJumpResponse key={`${ownerKey}:${record.id}:${exercise.exerciseId}`} record={record} exercise={exercise} now={now} />)}
        </View></RNHostView> : null}
      </Collapsible>
    </Host>
  </View>;
}

function ExerciseJumpResponse({ record, exercise, now }: { record: StrengthLogRecord; exercise: CompletedExercise; now: number }) {
  const C = useColors();
  const athlete = useProfileStore(state => state.activeAthleteId);
  const saved = useMemo(() => normalizePlyometricResponse(exercise.impactResponse, record.timestamp), [exercise.impactResponse, record.timestamp]);
  const [landing, setLanding] = useState<PlyometricResponseFeedback['landingControl']>('uncertain');
  const [symptoms, setSymptoms] = useState<PlyometricResponseFeedback['symptomsDuring']>('unknown');
  const [nextDay, setNextDay] = useState<PlyometricResponseFeedback['nextDayResponse']>('unknown');
  const [nextStep, setNextStep] = useState<NonNullable<PlyometricResponseFeedback['nextStep']>>('repeat');
  const [busy, setBusy] = useState(false);
  const [editorLease] = useState(captureOwnerLease);
  const [message, setMessage] = useState('');
  const inFlight = useRef(false);
  const generation = useRef(0);
  useEffect(() => {
    const current = ++generation.current;
    setLanding(saved?.landingControl ?? 'uncertain'); setSymptoms(saved?.symptomsDuring ?? 'unknown');
    setNextDay(saved?.nextDayResponse ?? 'unknown'); setNextStep(saved?.nextStep ?? 'repeat');
    setMessage(''); setBusy(false);
    return () => { if (generation.current === current) generation.current++; };
  }, [record.id, exercise.exerciseId, saved, athlete]);
  const nextDayReady = now - record.timestamp >= IMPACT_RESPONSE_DELAY_MS;
  async function save(remove = false) {
    if (inFlight.current) return;
    const lease = editorLease;
    if (!lease || !ownerLeaseIsCurrent(lease) || useProfileStore.getState().activeAthleteId !== 'athlete_default') {
      setMessage('Your account history is still restoring. Try again shortly.'); return;
    }
    const request = generation.current;
    const current = () => ownerLeaseIsCurrent(lease) && useProfileStore.getState().activeAthleteId === 'athlete_default' && generation.current === request;
    inFlight.current = true; setBusy(true); setMessage('');
    try {
      await savePlyometricResponse(record.id, exercise.exerciseId, remove ? null : { version: 1, source: 'athlete_reported',
        landingControl: landing, symptomsDuring: symptoms, nextDayResponse: nextDay, nextStep, reportedAt: Date.now() }, lease);
      if (current()) setMessage(remove ? 'Response removed.' : 'Response saved. Future generated workouts can consider your report and preference.');
    } catch (error) {
      if (current()) setMessage(error instanceof Error ? error.message : 'Could not confirm this response. Retry Save.');
    } finally { inFlight.current = false; if (current()) setBusy(false); }
  }
  return <View style={{ width: '100%', minWidth: 0, gap: 12, paddingVertical: 12, borderTopWidth: 1, borderTopColor: C.border }}>
    <Text style={{ color: C.text, fontSize: 16, fontWeight: '700' }}>{exercise.name ?? getExercise(exercise.exerciseId)?.name ?? 'Jump exercise'}{saved ? ' · saved' : ''}</Text>
    <GoalPicker label="Were your landings controlled?" value={landing} onChange={setLanding} disabled={busy} options={[
      { value: 'uncertain', label: 'Not reported / unsure' }, { value: 'controlled', label: 'Yes' }, { value: 'lost', label: 'No' },
    ]} />
    <GoalPicker label="Symptoms or pain during this exercise?" value={symptoms} onChange={setSymptoms} disabled={busy} options={[
      { value: 'unknown', label: 'Not reported / unsure' }, { value: 'none', label: 'No symptoms' }, { value: 'present', label: 'Symptoms present' },
    ]} />
    <GoalPicker label="Response at least 24 hours later" value={nextDay} onChange={setNextDay} disabled={busy || !nextDayReady} options={[
      { value: 'unknown', label: 'Not reported yet' }, ...(nextDayReady ? [
        { value: 'usual' as const, label: 'Back to my usual response' }, { value: 'worse' as const, label: 'More symptoms than usual' },
      ] : []),
    ]} />
    {!nextDayReady ? <Text style={{ color: C.textMuted, fontSize: 12, lineHeight: 18 }}>Leave this unknown until at least 24 hours after the workout. Reopen this page later to report what actually happened.</Text> : null}
    <GoalPicker label="Next time" value={nextStep} onChange={setNextStep} disabled={busy} options={[
      { value: 'repeat', label: 'Repeat this level' }, { value: 'easier', label: 'Make easier' }, { value: 'consider_harder', label: 'Consider harder' },
    ]} />
    <Text style={{ color: C.textMuted, fontSize: 12, lineHeight: 18 }}>Consider harder is a preference, not an automatic increase. Your completed work, reported response, preparation and recovery still guide the plan.</Text>
    <GoalAction label={busy ? 'Saving response…' : 'Save jump response'} onPress={() => { void save(); }} disabled={busy} />
    {saved ? <GoalAction label="Remove jump response" secondary onPress={() => { void save(true); }} disabled={busy} /> : null}
    {message ? <Text accessibilityLiveRegion="polite" style={{ color: C.textMuted, fontSize: 13, lineHeight: 20 }}>{message}</Text> : null}
  </View>;
}
