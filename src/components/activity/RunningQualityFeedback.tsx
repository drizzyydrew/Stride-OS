import { useEffect, useRef, useState } from 'react';
import { Text, View, useWindowDimensions } from 'react-native';
import { Collapsible, Host, RNHostView } from '@expo/ui';
import { GoalAction, GoalPicker } from '../goals/GoalLifecycleCard';
import { useColors } from '../../theme/useColors';
import { useThemeMode } from '../../store/themeStore';
import { useProfileStore } from '../../store/profileStore';
import { saveRunningQualityFeedback, useWorkoutStore } from '../../store/workoutStore';
import { captureOwnerLease, ownerLeaseIsCurrent, type OwnerLease } from '../../lib/localDataOwner';
import { canReportRunningQuality, confirmedPlannedRunningQuality, normalizeRunningQualityPrescription } from '../../utils/runningQualityFeedback';

export default function RunningQualityFeedback({ recordId }: { recordId?: string }) {
  const record = useWorkoutStore(state => state.history.find(item => item.id === recordId));
  const athlete = useProfileStore(state => state.activeAthleteId);
  const lease = captureOwnerLease();
  if (!lease || athlete !== 'athlete_default') return null;
  return <RunningFeedbackEditor key={`${lease.ownerUserId}:${lease.generation}:${recordId ?? ''}`} recordId={recordId} record={record} lease={lease} />;
}
function RunningFeedbackEditor({ recordId, record, lease }: { recordId?: string; record?: import('../../types/training').CompletedWorkoutRecord; lease: OwnerLease }) {
  const C = useColors();
  const mode = useThemeMode();
  const { fontScale } = useWindowDimensions();
  const athlete = useProfileStore(state => state.activeAthleteId);
  const saved = record?.runningQuality;
  const [open, setOpen] = useState(false);
  const [response, setResponse] = useState<'as_planned' | 'changed' | 'unsure'>('unsure');
  const [effort, setEffort] = useState('unknown');
  const [recovered, setRecovered] = useState('unknown');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const inFlight = useRef(false);
  const generation = useRef(0);
  useEffect(() => {
    const next = ++generation.current;
    setResponse(record?.runningQualityResponse?.value ?? (saved ? 'as_planned' : 'unsure')); setEffort(saved ? String(saved.rpe) : 'unknown');
    setRecovered(saved ? saved.comfortableRecovery ? 'yes' : 'no' : 'unknown');
    setMessage(''); setBusy(false);
    return () => { if (generation.current === next) generation.current++; };
  }, [recordId, record, saved]);
  const prescription = normalizeRunningQualityPrescription(record?.runningQualityPrescription);
  if (athlete !== 'athlete_default' || !canReportRunningQuality(record) || (!prescription && !saved)) return null;

  async function save(remove = false) {
    if (!alive.current || inFlight.current) return;
    if (!ownerLeaseIsCurrent(lease) || useWorkoutStore.getState().history.find(item => item.id === recordId) !== record || useProfileStore.getState().activeAthleteId !== 'athlete_default') { setMessage('Your account history is still restoring. Try again shortly.'); return; }
    if (!remove && response === 'as_planned' && (!prescription || effort === 'unknown' || recovered === 'unknown')) {
      setMessage('Choose effort and recovery, or leave this as not sure.'); return;
    }
    const request = generation.current;
    inFlight.current = true; setBusy(true); setMessage('');
    try {
      const feedback = !remove && record && response === 'as_planned' ? confirmedPlannedRunningQuality(record, response, Number(effort), recovered === 'yes') : undefined;
      if (!remove && response === 'as_planned' && !feedback) throw new Error('The original faster work does not fit this recorded run. Choose Changed or Not sure; no extra exposure will be credited.');
      await saveRunningQualityFeedback(recordId!, feedback ?? null, lease, { version: 1, source: 'athlete_reported',
        value: remove ? 'unsure' : response, recordedAt: Date.now() }, { expectedRecord: record!,
        isCurrent: () => alive.current && useProfileStore.getState().activeAthleteId === 'athlete_default' });
      if (ownerLeaseIsCurrent(lease) && generation.current === request) setMessage(remove || response !== 'as_planned' ? 'Feedback cleared. Future sessions stay conservative.' : 'Feedback saved. Future sessions can use your reported tolerance.');
    } catch (error) {
      if (generation.current === request) setMessage(error instanceof Error ? error.message : 'Could not confirm this report. Retry Save.');
    } finally { inFlight.current = false; if (generation.current === request) setBusy(false); }
  }
  return <View style={{ width: '100%', minWidth: 0, marginBottom: 14, borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 14 }}>
    <Host matchContents={{ vertical: true }} colorScheme={mode} seedColor={C.primary} style={{ width: '100%', minHeight: 44 }}>
      <Collapsible label={saved ? 'Workout feedback · saved' : 'Workout feedback'} isOpen={open} onOpenChange={setOpen}
        labelStyle={{ color: C.text, fontSize: 14 * fontScale, fontWeight: '600' }}>
        {open ? <RNHostView matchContents={{ vertical: true }}><View style={{ width: '100%', minWidth: 0, gap: 12, paddingVertical: 12 }}>
          <Text style={{ color: C.textMuted, fontSize: 13, lineHeight: 20 }}>Optional: did you follow the faster intervals in this workout? This records your answer, not a sensor measurement. If you changed the work or are unsure, the next plan stays conservative.</Text>
          {prescription ? <GoalPicker label="Faster intervals completed?" value={response} disabled={busy} onChange={setResponse} options={[
            { value: 'unsure', label: 'Not sure / not reported' }, { value: 'as_planned', label: 'Yes, all as planned' }, { value: 'changed', label: 'No, I changed or shortened them' },
          ]} /> : null}
          {response === 'as_planned' && prescription ? <>
          <GoalPicker label="Actual work effort (RPE)" value={effort} onChange={setEffort} disabled={busy} options={[
            { value: 'unknown', label: 'Not reported' }, ...Array.from({ length: 10 }, (_, i) => ({ value: String(i + 1), label: `${i + 1} / 10` })),
          ]} />
          <GoalPicker label="Comfortable recovery between repeats?" value={recovered} onChange={setRecovered} disabled={busy} options={[
            { value: 'unknown', label: 'Not reported' }, { value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' },
          ]} />
          </> : null}
          <GoalAction label={busy ? 'Saving feedback…' : 'Save feedback'} onPress={() => { void save(); }} disabled={busy} />
          {saved ? <GoalAction label="Clear feedback" secondary disabled={busy} onPress={() => { void save(true); }} /> : null}
          {message ? <Text accessibilityLiveRegion="polite" style={{ color: C.textMuted, fontSize: 13, lineHeight: 20 }}>{message}</Text> : null}
        </View></RNHostView> : null}
      </Collapsible>
    </Host>
  </View>;
}
