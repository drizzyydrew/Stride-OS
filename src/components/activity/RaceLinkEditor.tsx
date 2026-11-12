import { useEffect, useRef, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { GoalAction, GoalDisclosure, GoalField, GoalMessage, GoalPicker, goalDate } from '../goals/GoalLifecycleCard';
import { useFixedBackAction } from '../layout/NavigationEscape';
import RaceEventPicker from './RaceEventPicker';
import { formatDistance } from '../../lib/units';
import type { UnitSystem } from '../../store/settingsStore';
import { captureOwnerLease, ownerLeaseIsCurrent } from '../../lib/localDataOwner';
import { saveLink, unlinkLink } from '../../lib/raceActivityLink';
import { RACE_RESULT_OPTIONS, recordedRaceElapsedSeconds } from '../../utils/raceLink';
import { parseRaceElapsedTime } from '../../utils/racePerformance';
import { todayDateOnly } from '../../utils/dateOnly';
import { formatRaceTime } from '../../utils/calibrationEngine';
import { useColors } from '../../theme/useColors';
import type { Activity } from '../../types/activity';
import type { GoalArchive } from '../../types/goalArchive';
import type { RaceActivityLink, RaceEventSnapshot } from '../../types/raceLink';

type Props = {
  ownerUserId: string;
  units: UnitSystem;
  events: readonly RaceEventSnapshot[];
  activities: readonly Activity[];
  archives: readonly GoalArchive[];
  initialActivityId?: string;
  initialEventId?: string;
  archive?: GoalArchive;
  onClose: () => void;
};
const OUTCOMES = RACE_RESULT_OPTIONS.filter((option): option is { value: RaceActivityLink['outcome']; label: string } => option.value !== 'did_not_start');
const CONFIRM = [{ value: 'no', label: 'No' }, { value: 'yes', label: 'Yes, I confirm' }] as const;

export function usesRecordedRaceTime(activity: Activity | undefined, recorded: number | null): boolean {
  return recorded != null && (!activity?.raceResult || activity.raceResult.timingSource === 'recorded_elapsed'
    && activity.raceResult.elapsedTimeSeconds === recorded);
}

export default function RaceLinkEditor({ ownerUserId, units, events, activities, archives, initialActivityId, initialEventId, archive, onClose }: Props) {
  const C = useColors();
  const initial = activities.find(activity => activity.id === initialActivityId);
  const initialRecorded = initial ? recordedRaceElapsedSeconds(initial) : null;
  const [activityId, setActivityId] = useState(initial?.id ?? '');
  const [eventId, setEventId] = useState(initialEventId ?? initial?.raceLink?.event.id ?? '');
  const [outcome, setOutcome] = useState<RaceActivityLink['outcome']>(initial?.raceLink?.outcome ?? 'finished');
  const [time, setTime] = useState(initial?.raceResult ? formatRaceTime(initial.raceResult.elapsedTimeSeconds)
    : initialRecorded == null ? '' : formatRaceTime(initialRecorded));
  const [useRecorded, setUseRecorded] = useState(usesRecordedRaceTime(initial, initialRecorded));
  const [timeEdited, setTimeEdited] = useState(false);
  const [confirmDate, setConfirmDate] = useState<'no' | 'yes'>('no');
  const [confirmReplacement, setConfirmReplacement] = useState<'no' | 'yes'>('no');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const inFlight = useRef(false);
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);
  const activity = activities.find(item => item.id === activityId);
  // An existing Activity retains its recorded event snapshot even if the plan
  // later reuses that ID with edited dates, name or course distance.
  const recordedEvent = !initialEventId && activity?.raceLink?.ownerUserId === ownerUserId ? activity.raceLink.event : undefined;
  const selectableEvents = recordedEvent ? [...events.filter(item => item.id !== recordedEvent.id), recordedEvent] : events;
  const event = selectableEvents.find(item => item.id === eventId);
  const recorded = activity ? recordedRaceElapsedSeconds(activity) : null;
  const dateMismatch = !!activity && !!event && todayDateOnly(new Date(activity.startTime)) !== event.date;
  const replacesActivity = !!activity && (!!activity.raceLink && !!event && (activity.raceLink.event.id !== event.id || activity.raceLink.event.name !== event.name || activity.raceLink.event.date !== event.date || activity.raceLink.event.distance !== event.distance || activity.raceLink.event.distanceMeters !== event.distanceMeters)
    || !!activity.raceResult && !activity.raceLink);
  const replacesArchive = archives.some(item => item.race?.id === eventId && (item.result.source === 'user' && (item.result.status !== 'unrecorded' || item.result.timeSeconds !== undefined) || item.result.source === 'activity_link' && item.result.linkedActivityId !== activityId));
  const replacesOtherRun = activities.some(item => item.id !== activityId && item.raceLink?.ownerUserId === ownerUserId && item.raceLink.event.id === eventId);
  const needsReplacement = replacesActivity || replacesArchive || replacesOtherRun;
  const snapshot = JSON.stringify({ activityId, eventId, outcome, time, useRecorded, timeEdited, confirmDate, confirmReplacement });
  const savedSnapshot = useRef(snapshot);
  const dirty = snapshot !== savedSnapshot.current;

  function close() {
    if (inFlight.current) { Alert.alert('Saving race result', 'Wait for the save confirmation before leaving.'); return; }
    if (!dirty) { onClose(); return; }
    Alert.alert('Leave without saving?', 'Your changes to this race link have not been saved.', [
      { text: 'Keep editing', style: 'cancel' }, { text: 'Leave', style: 'destructive', onPress: onClose },
    ]);
  }
  useFixedBackAction(close);

  function selectActivity(id: string) {
    const selected = activities.find(item => item.id === id);
    const elapsed = selected ? recordedRaceElapsedSeconds(selected) : null;
    setActivityId(id);
    if (!initialEventId) setEventId(selected?.raceLink?.event.id ?? '');
    setOutcome(selected?.raceLink?.outcome ?? 'finished');
    setTime(selected?.raceResult ? formatRaceTime(selected.raceResult.elapsedTimeSeconds) : elapsed == null ? '' : formatRaceTime(elapsed));
    setUseRecorded(usesRecordedRaceTime(selected, elapsed));
    setTimeEdited(false);
    setConfirmDate('no'); setConfirmReplacement('no'); setError(null); setMessage(null);
  }

  async function save() {
    if (inFlight.current) return;
    setError(null); setMessage(null);
    if (!activity || !event) { setError('Choose a saved run and a race.'); return; }
    if (outcome === 'finished' && !useRecorded && !timeEdited && activity.raceResult?.timingSource === 'recorded_elapsed') {
      setError('The recorded elapsed time has changed or is unavailable. Choose the current recorded time or enter an official finish time before saving.'); return;
    }
    const elapsedTimeSeconds = outcome === 'finished' && !useRecorded && time.trim() ? parseRaceElapsedTime(time) : undefined;
    if (elapsedTimeSeconds === null || outcome === 'finished' && (useRecorded && recorded == null || !useRecorded && !time.trim() && recorded != null)) {
      setError('Enter a positive elapsed finish time as MM:SS or H:MM:SS.'); return;
    }
    if (dateMismatch && confirmDate !== 'yes') { setError('Confirm that this run belongs to the race on the different date.'); return; }
    if (needsReplacement && confirmReplacement !== 'yes') { setError('Confirm replacement of the existing race result.'); return; }
    const lease = captureOwnerLease();
    if (!lease || !ownerLeaseIsCurrent(lease) || lease.ownerUserId !== ownerUserId) { setError('Reopen this page with the account that owns this activity.'); return; }
    inFlight.current = true; setBusy(true);
    try {
      await saveLink({ activityId: activity.id, event, outcome,
        ...(elapsedTimeSeconds === undefined ? {} : { elapsedTimeSeconds }),
        confirmDateMismatch: confirmDate === 'yes', replaceExisting: confirmReplacement === 'yes', archiveId: archive?.id }, lease);
      if (!ownerLeaseIsCurrent(lease)) throw new Error('Your account changed while saving. Reopen this activity to check its race result.');
      if (alive.current) { savedSnapshot.current = snapshot; setMessage('Race result saved on this device.'); }
    } catch (cause) { if (alive.current) setError(cause instanceof Error ? cause.message : 'The race result could not be saved. Your draft is still here.'); }
    finally { inFlight.current = false; if (alive.current) setBusy(false); }
  }

  function unlink() {
    if (!activity?.raceLink || inFlight.current) return;
    const selectedId = activity.id;
    Alert.alert('Unlink this race?', 'The saved run and its recorded metrics will stay in Activity.', [
      { text: 'Cancel', style: 'cancel' }, { text: 'Unlink', style: 'destructive', onPress: () => { void (async () => {
        const lease = captureOwnerLease();
        if (!lease || !ownerLeaseIsCurrent(lease) || lease.ownerUserId !== ownerUserId) { setError('Reopen this page with the account that owns this activity.'); return; }
        inFlight.current = true; setBusy(true); setError(null); setMessage(null);
        try {
          await unlinkLink(selectedId, lease);
          if (!ownerLeaseIsCurrent(lease)) throw new Error('Your account changed. Reopen this activity to check its race link.');
          if (alive.current) { savedSnapshot.current = snapshot; setMessage('Race unlinked. The saved run is unchanged.'); }
        } catch (cause) { if (alive.current) setError(cause instanceof Error ? cause.message : 'The race could not be unlinked.'); }
        finally { inFlight.current = false; if (alive.current) setBusy(false); }
      })(); } },
    ]);
  }

  return <View style={{ gap: 18, minWidth: 0, width: '100%' }}>
    <GoalMessage>Choose a race and a saved run.</GoalMessage>
    <RaceEventPicker value={eventId || null} events={selectableEvents} disabled={busy} onChange={next => { setEventId(next?.id ?? ''); setConfirmDate('no'); setConfirmReplacement('no'); setMessage(null); }} />
    <GoalPicker label="Saved run" value={activity?.id ?? ''} disabled={busy} onChange={selectActivity}
      options={[{ value: '', label: 'Choose a saved run' }, ...activities.map(item => ({ value: item.id,
        label: `${goalDate(todayDateOnly(new Date(item.startTime)))} · ${new Date(item.startTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} · ${item.metrics.distanceMeters == null ? 'Distance unavailable' : formatDistance(item.metrics.distanceMeters / 1609.344, units)}` }))]} />
    {activity ? <GoalMessage>Run recorded {new Date(activity.startTime).toLocaleString()}{'\n'}Recorded elapsed: {recorded == null ? 'Unavailable' : formatRaceTime(recorded)}</GoalMessage> : null}
    <GoalPicker label="Race result" value={outcome} options={OUTCOMES} disabled={busy} onChange={value => { setOutcome(value); setMessage(null); }} />
    {outcome === 'finished' ? <View style={{ gap: 10 }}>
      <GoalField label={recorded == null ? "Elapsed finish time · optional" : "Elapsed finish time"} value={time} onChange={value => { setTime(value); setUseRecorded(false); setTimeEdited(true); setMessage(null); }} disabled={busy} placeholder="MM:SS or H:MM:SS" />
      <GoalMessage>{useRecorded ? 'Using the run’s full recorded elapsed time, including stops.' : !time.trim() && recorded == null ? 'No trustworthy recorded elapsed time is available. Add your official time, or save a finished result without a time.' : 'Using the finish time entered here. The run’s recorded metrics stay unchanged.'}</GoalMessage>
      {recorded != null && !useRecorded ? <GoalAction label="Use recorded elapsed time" secondary disabled={busy} onPress={() => { setUseRecorded(true); setTimeEdited(false); setTime(formatRaceTime(recorded)); setMessage(null); }} /> : null}
    </View> : null}
    {dateMismatch ? <View style={{ gap: 10 }}>
      <GoalMessage>The race date is {goalDate(event!.date)}. This run was recorded on {goalDate(todayDateOnly(new Date(activity!.startTime)))}.</GoalMessage>
      <GoalPicker label="This run belongs to the race on the different date" value={confirmDate} options={CONFIRM} onChange={setConfirmDate} disabled={busy} />
    </View> : null}
    {needsReplacement ? <View style={{ gap: 10 }}>
      <GoalMessage>{replacesOtherRun ? 'This race is linked to another saved run. Replacing it removes that earlier association.' : 'This will replace an existing race result or race association.'}</GoalMessage>
      <GoalPicker label="Replace the existing race result" value={confirmReplacement} options={CONFIRM} onChange={setConfirmReplacement} disabled={busy} />
    </View> : null}
    {error ? <GoalMessage error>{error}</GoalMessage> : null}
    {message ? <GoalMessage>{message}</GoalMessage> : null}
    <GoalAction label={busy ? 'Saving…' : 'Save race result'} disabled={busy || !activity || !event} onPress={() => { void save(); }} />
    <GoalAction label="Done" secondary disabled={busy} onPress={close} />
    <GoalDisclosure label="More options">
      {activity?.raceLink ? <GoalAction label="Unlink race" secondary disabled={busy} onPress={unlink} /> : null}
      <Text style={{ color: C.textDim, fontSize: 13, lineHeight: 19 }}>Recorded distance, timing, route and sensor data are kept with the run.</Text>
    </GoalDisclosure>
  </View>;
}
