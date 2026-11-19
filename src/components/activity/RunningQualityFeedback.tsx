import { useEffect, useRef, useState } from 'react';
import { Text, View, useWindowDimensions } from 'react-native';
import { Collapsible, Host, RNHostView } from '@expo/ui';
import { GoalAction, GoalField, GoalPicker } from '../goals/GoalLifecycleCard';
import { useColors } from '../../theme/useColors';
import { useThemeMode } from '../../store/themeStore';
import { useProfileStore } from '../../store/profileStore';
import { saveRunningQualityFeedback, useWorkoutStore } from '../../store/workoutStore';
import { captureOwnerLease, ownerLeaseIsCurrent } from '../../lib/localDataOwner';
import { canReportRunningQuality } from '../../utils/runningQualityFeedback';
import type { RunningQualityFeedback as Report } from '../../types/training';

export default function RunningQualityFeedback({ recordId }: { recordId?: string }) {
  const C = useColors();
  const mode = useThemeMode();
  const { fontScale } = useWindowDimensions();
  const record = useWorkoutStore(state => state.history.find(item => item.id === recordId));
  const athlete = useProfileStore(state => state.activeAthleteId);
  const saved = record?.runningQuality;
  const [open, setOpen] = useState(false);
  const [rung, setRung] = useState<Report['rung'] | 'unknown'>('unknown');
  const [reps, setReps] = useState('');
  const [seconds, setSeconds] = useState('');
  const [effort, setEffort] = useState('unknown');
  const [recovered, setRecovered] = useState('unknown');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const inFlight = useRef(false);
  const generation = useRef(0);
  useEffect(() => {
    const next = ++generation.current;
    setRung(saved?.rung ?? 'unknown'); setReps(saved ? String(saved.completedReps) : '');
    setSeconds(saved ? String(saved.workSeconds) : ''); setEffort(saved ? String(saved.rpe) : 'unknown');
    setRecovered(saved ? saved.comfortableRecovery ? 'yes' : 'no' : 'unknown');
    setMessage(''); setBusy(false);
    return () => { if (generation.current === next) generation.current++; };
  }, [recordId, saved]);
  if (athlete !== 'athlete_default' || !canReportRunningQuality(record)) return null;

  async function save(remove = false) {
    if (inFlight.current) return;
    const lease = captureOwnerLease();
    if (!lease || useProfileStore.getState().activeAthleteId !== 'athlete_default') { setMessage('Your account history is still restoring. Try again shortly.'); return; }
    if (!remove && (rung === 'unknown' || effort === 'unknown' || recovered === 'unknown' || !reps.trim() || !seconds.trim())) {
      setMessage('Choose the type of work, completed repeats, seconds per repeat, effort and recovery.'); return;
    }
    const request = generation.current;
    inFlight.current = true; setBusy(true); setMessage('');
    try {
      await saveRunningQualityFeedback(recordId!, remove ? null : {
        version: 1, source: 'athlete_reported', rung: rung as Report['rung'], completedReps: Number(reps),
        workSeconds: Number(seconds), rpe: Number(effort), comfortableRecovery: recovered === 'yes', recordedAt: Date.now(),
      }, lease);
      if (ownerLeaseIsCurrent(lease) && generation.current === request) setMessage(remove ? 'Report removed.' : 'Report saved. Future generated sessions can use this reported work.');
    } catch (error) {
      if (generation.current === request) setMessage(error instanceof Error ? error.message : 'Could not confirm this report. Retry Save.');
    } finally { inFlight.current = false; if (generation.current === request) setBusy(false); }
  }
  return <View style={{ width: '100%', minWidth: 0, marginBottom: 14, borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 14 }}>
    <Host matchContents={{ vertical: true }} colorScheme={mode} seedColor={C.primary} style={{ width: '100%', minHeight: 44 }}>
      <Collapsible label={saved ? 'Faster-work report · saved' : 'Faster-work report'} isOpen={open} onOpenChange={setOpen}
        labelStyle={{ color: C.text, fontSize: 14 * fontScale, fontWeight: '600' }}>
        {open ? <RNHostView matchContents={{ vertical: true }}><View style={{ width: '100%', minWidth: 0, gap: 12, paddingVertical: 12 }}>
          <Text style={{ color: C.textMuted, fontSize: 13, lineHeight: 20 }}>Optional: report only the faster work you actually completed. This helps future plans choose a suitable next step. It does not change your recorded distance or pace.</Text>
          <GoalPicker label="Type of faster work" value={rung} disabled={busy} onChange={setRung} options={[
            { value: 'unknown', label: 'Choose work type' }, { value: 'strides', label: 'Relaxed strides' },
            { value: 'gentle_fartlek', label: 'Gentle faster repeats' }, { value: 'tempo_threshold', label: 'Controlled tempo / threshold' },
            { value: 'intervals', label: 'Aerobic-power intervals' }, { value: 'norwegian_4x4', label: 'Norwegian 4 × 4 minutes' },
          ]} />
          <GoalField label="Repeats actually completed" value={reps} onChange={setReps} numeric disabled={busy} placeholder="For example, 4" />
          <GoalField label="Work seconds per repeat" value={seconds} onChange={setSeconds} numeric disabled={busy} placeholder="For example, 180 for 3 minutes" />
          <GoalPicker label="Actual work effort (RPE)" value={effort} onChange={setEffort} disabled={busy} options={[
            { value: 'unknown', label: 'Not reported' }, ...Array.from({ length: 10 }, (_, i) => ({ value: String(i + 1), label: `${i + 1} / 10` })),
          ]} />
          <GoalPicker label="Comfortable recovery between repeats?" value={recovered} onChange={setRecovered} disabled={busy} options={[
            { value: 'unknown', label: 'Not reported' }, { value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' },
          ]} />
          <GoalAction label={busy ? 'Saving report…' : 'Save report'} onPress={() => { void save(); }} disabled={busy} />
          {saved ? <GoalAction label="Remove report" secondary disabled={busy} onPress={() => { void save(true); }} /> : null}
          {message ? <Text accessibilityLiveRegion="polite" style={{ color: C.textMuted, fontSize: 13, lineHeight: 20 }}>{message}</Text> : null}
        </View></RNHostView> : null}
      </Collapsible>
    </Host>
  </View>;
}
