import ExerciseMuscleTags from './ExerciseMuscleTags';
import { useMemo, useRef, useState } from 'react';
import { Text, View, useWindowDimensions } from 'react-native';
import { Collapsible, Host, RNHostView, Switch } from '@expo/ui';
import { GoalAction, GoalPicker } from '../goals/GoalLifecycleCard';
import { useThemeMode } from '../../store/themeStore';
import { useColors } from '../../theme/useColors';
import { captureOwnerLease, ownerLeaseIsCurrent } from '../../lib/localDataOwner';
import { useActiveStrengthSessionStore } from '../../store/activeStrengthSessionStore';
import { saveStrengthPlanningPreferences, useOnboardingStore } from '../../store/onboardingStore';
import { useProfileStore } from '../../store/profileStore';
import { plyometricTask, calibratePlyometricReplacement } from '../../utils/plyometricCatalog';
import { STRENGTH_EXERCISES } from '../../utils/strengthEngine';
import { EXERCISE_ADAPTATION_OPTIONS, classifyExerciseStimulus, getExerciseAdjustment, remainingExerciseDoseEdits, type AdaptationExercise, type ExerciseAdjustmentReason } from '../../utils/exerciseAdaptation';
import type { ActiveStrengthExercise } from '../../utils/strengthSession';

const REASONS = [{ value: 'too_easy', label: 'Too easy' }, { value: 'too_hard', label: 'Too hard today' },
  { value: 'dislike', label: 'Prefer a different movement' }, { value: 'equipment', label: 'Equipment unavailable' }] as const;
type Choice = AdaptationExercise & { canonicalId?: string; reps?: string };
const ENGINE_OPTIONS: Choice[] = Object.values(STRENGTH_EXERCISES).flatMap(ex => ex.equipment.map(equipment => ({
  id: ex.equipment.length > 1 ? `${ex.id}__${equipment}` : ex.id,
  canonicalId: ex.id, name: ex.equipment.length > 1 ? `${ex.name} (${equipment})` : ex.name,
  equipment: [equipment, ...(['pull_band_row', 'pull_facepull', 'hinge_nordic'].includes(ex.id) ? ['secure_anchor']
    : ['squat_box', 'squat_bulgarian', 'hinge_hip_thrust'].includes(ex.id) ? ['bench']
      : ex.id === 'lunge_step_up' ? ['step'] : ex.id === 'plyo_box_jump' ? ['box'] : ex.id === 'pull_row' ? ['support'] : [])],
})));
const CANDIDATES: Choice[] = [...ENGINE_OPTIONS, ...EXERCISE_ADAPTATION_OPTIONS].filter((item, index, all) =>
  all.findIndex(other => other.name.toLowerCase() === item.name.toLowerCase()) === index);

export default function ExerciseAdjustment({ exercise, workoutInstanceId, showMuscleTags=true }: { exercise: ActiveStrengthExercise; workoutInstanceId: string; showMuscleTags?:boolean }) {
  const C = useColors();
  const mode = useThemeMode();
  const { fontScale } = useWindowDimensions();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ExerciseAdjustmentReason>('too_hard');
  const [selected, setSelected] = useState('');
  const [setupConfirmed, setSetupConfirmed] = useState(false);
  const [future, setFuture] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');
  const busy = useRef(false);
  const markedComplete = useActiveStrengthSessionStore(state => state.session?.workoutInstanceId === workoutInstanceId
    && state.session.completedExerciseIds.includes(exercise.id));
  const source = { id: exercise.canonicalExerciseId ?? exercise.id, name: exercise.name, equipment: exercise.equipment, repScheme: exercise.repScheme };
  const adjustment = useMemo(() => getExerciseAdjustment({ exercise: source, reason, candidates: CANDIDATES }), [exercise, reason]);
  const candidate = adjustment.options.find(item => item.id === selected) as Choice | undefined;
  const originalId = exercise.substitutedFromPrescription?.exerciseId ?? source.id;
  const canRemember = Boolean(candidate?.canonicalId && STRENGTH_EXERCISES[originalId] && STRENGTH_EXERCISES[candidate.canonicalId]
    && STRENGTH_EXERCISES[candidate.canonicalId]!.equipment.length === 1
    && candidate.canonicalId !== originalId
    && useProfileStore.getState().activeAthleteId === 'athlete_default');
  const hasFutureChoice = Boolean(useOnboardingStore.getState().data.strengthExercisePreferences?.[originalId]);
  const edits = reason === 'too_easy' || reason === 'too_hard' ? remainingExerciseDoseEdits(exercise, reason) : [];
  const power = adjustment.profile?.stimulus === 'power';
  const copy = { color: C.textMuted, fontSize: 13, lineHeight: 20, flexShrink: 1 as const };

  function active() {
    const state = useActiveStrengthSessionStore.getState();
    const session = state.session;
    if (!session || session.workoutInstanceId !== workoutInstanceId) return null;
    const current = session.exercises.find(item => item.id === exercise.id);
    if (!current || session.completedExerciseIds.includes(exercise.id) || current.skipped) return null;
    return { state, session, current };
  }
  function adjustDose() {
    const lease = captureOwnerLease();
    const current = active();
    if (!lease || !ownerLeaseIsCurrent(lease) || !current || (reason !== 'too_easy' && reason !== 'too_hard')) return;
    // Faster contacts and power do not progress by accumulating fatigue.
    if (power && reason === 'too_easy') return;
    const changes = remainingExerciseDoseEdits(current.current, reason);
    changes.forEach(change => current.state.editSet(exercise.id, change.id, change.patch));
    if (changes.length) useActiveStrengthSessionStore.setState(state => state.session?.workoutInstanceId === workoutInstanceId
      ? { session: { ...state.session, exercises: state.session.exercises.map(item => item.id === exercise.id
        ? { ...item, modifiedTargets: true, notes: `${item.notes ?? ''} Remaining targets adjusted for today: ${reason.replace(/_/g, ' ')}.`.trim() } : item) } } : state);
    setStatus(changes.length ? 'Remaining targets updated for today. Completed sets and recorded effort were kept.' : 'Use the set editor to choose a manageable target.');
  }
  async function changeExercise() {
    if (!candidate || !setupConfirmed || busy.current) return;
    const lease = captureOwnerLease();
    if (!lease || !ownerLeaseIsCurrent(lease) || !active()) return;
    busy.current = true; setSaving(true); setStatus('');
    let remembered = false;
    try {
      if (future && canRemember) {
        await saveStrengthPlanningPreferences({ strengthExercisePreferences: { [originalId]: candidate.canonicalId! } }, lease);
        remembered = true;
      }
      const current = active();
      if (!ownerLeaseIsCurrent(lease) || !current) throw new Error('Workout changed');
      const profile = classifyExerciseStimulus(candidate);
      const suggested = EXERCISE_ADAPTATION_OPTIONS.find(item => item.name.toLowerCase() === candidate.name.toLowerCase());
      const catalogTask=plyometricTask(candidate.canonicalId ?? candidate.id);
      const calibrated=catalogTask ? calibratePlyometricReplacement(catalogTask,current.current.setEntries.filter(set=>!set.completed && !set.isWarmup).map(set=>set.reps),reason==='too_hard') : null;
      const repScheme = calibrated?.repScheme ?? suggested?.repScheme ?? (profile?.stimulus === 'power'
        ? { kind: 'reps' as const, repsMin: 3, repsMax: 5 } : { kind: 'reps' as const, repsMin: 8, repsMax: 12 });
      const remaining = current.current.setEntries.filter(set => !set.completed && !set.isWarmup).length;
      current.state.substituteExercise(exercise.id, {
        canonicalExerciseId: candidate.canonicalId ?? candidate.id, name: candidate.name, equipment: [...candidate.equipment ?? []],
        repScheme, plannedSets: Math.max(1, remaining), plannedReps: calibrated?.reps ?? suggested?.reps ?? (profile?.stimulus === 'power' ? '3–5' : '8–12'),
        notes: `Chosen because: ${REASONS.find(item => item.value === reason)?.label}. ${adjustment.calibration}`,
      });
      const updated = useActiveStrengthSessionStore.getState().session;
      if (updated === current.session) throw new Error('No remaining work');
      setStatus(remembered ? 'Changed for today and saved for compatible future generated workouts.' : 'Changed for this workout. Calibrate the new setup before working sets.');
      setSelected(''); setSetupConfirmed(false); setFuture(false);
    } catch {
      setStatus(remembered ? 'Future preference saved. This workout changed; reopen its current exercise before adjusting it.' : 'Could not confirm the change. Your workout was kept; retry when it is ready.');
    } finally { busy.current = false; setSaving(false); }
  }

  async function resetFutureChoice() {
    const lease = captureOwnerLease();
    if (!lease || busy.current) return;
    busy.current = true; setSaving(true);
    try {
      await saveStrengthPlanningPreferences({ strengthExercisePreferences: { [originalId]: null } }, lease);
      if (ownerLeaseIsCurrent(lease)) setStatus('Future generated workouts will use the plan’s default selection. Today’s workout was kept.');
    } catch { setStatus('Could not confirm the future choice. Please retry.'); }
    finally { busy.current = false; setSaving(false); }
  }

  if (markedComplete || exercise.skipped) return <View>{showMuscleTags?<ExerciseMuscleTags exercise={exercise} />:null}<Text style={copy}>Recorded work is kept. Adjust a remaining exercise when needed.</Text></View>;
  return <View>{showMuscleTags?<ExerciseMuscleTags exercise={exercise} />:null}<Host matchContents={{ vertical: true }} colorScheme={mode} seedColor={C.primary} ignoreSafeArea="all" style={{ width: '100%', minHeight: 44 }}>
    <Collapsible label="Adjust exercise" labelStyle={{ color: C.primary, fontSize: 14 * fontScale, fontWeight: '600' }} isOpen={open} onOpenChange={setOpen}>
      {open ? <RNHostView matchContents={{ vertical: true }}><View style={{ width: '100%', minWidth: 0, gap: 12, paddingVertical: 12 }}>
        <GoalPicker label="What would help?" value={reason} options={REASONS} disabled={saving} onChange={value => { setReason(value); setSelected(''); setSetupConfirmed(false); setStatus(''); }} />
        <Text style={copy}>{adjustment.guidance}</Text>
        {adjustment.profile ? <Text style={copy}>Purpose: {adjustment.profile.target}.</Text> : null}
        {edits.length && !(power && reason === 'too_easy') ? <GoalAction label={reason === 'too_easy' ? 'Slightly increase remaining targets' : 'Reduce remaining targets'} onPress={adjustDose} disabled={saving} secondary /> : null}
        <Text style={copy}>{adjustment.fallback}</Text>
        {adjustment.options.length ? <>
          <GoalPicker label="Compatible movement" value={selected} disabled={saving} options={[{ value: '', label: 'Keep current movement' }, ...adjustment.options.map(item => ({ value: item.id, label: plyometricTask(item.id) ? `${item.name} · ${plyometricTask(item.id)!.tier} demand` : item.name }))]}
            onChange={value => { setSelected(value); setSetupConfirmed(false); setFuture(false); setStatus(''); }} />
          {candidate ? <>
            <Text style={copy}>Required setup: {(candidate.equipment ?? ['bodyweight']).join(', ').replace(/_/g, ' ')}. {adjustment.calibration}</Text>
            <Host matchContents={{ vertical: true }} colorScheme={mode} seedColor={C.primary} ignoreSafeArea="all" style={{ width: '100%', minHeight: 44 }}>
              <Switch label="I can use this equipment and setup" value={setupConfirmed} onValueChange={setSetupConfirmed} disabled={saving} />
            </Host>
            {canRemember ? <Host matchContents={{ vertical: true }} colorScheme={mode} seedColor={C.primary} ignoreSafeArea="all" style={{ width: '100%', minHeight: 44 }}>
              <Switch label="Use in future generated workouts" value={future} onValueChange={setFuture} disabled={saving} />
            </Host> : <Text style={copy}>This choice applies to this workout only.</Text>}
            <GoalAction label={saving ? 'Saving choice…' : 'Use this movement'} onPress={() => { void changeExercise(); }} disabled={saving || !setupConfirmed} secondary />
          </> : null}
        </> : null}
        {hasFutureChoice ? <GoalAction label="Use plan’s default in future" onPress={() => { void resetFutureChoice(); }} disabled={saving} secondary /> : null}
        {status ? <Text accessibilityRole="alert" style={copy}>{status}</Text> : null}
      </View></RNHostView> : null}
    </Collapsible>
  </Host></View>;
}
