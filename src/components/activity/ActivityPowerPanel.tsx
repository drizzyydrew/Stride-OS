import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Activity } from '../../types/activity';
import type { UnitSystem } from '../../store/settingsStore';
import { useActivityStore } from '../../store/activityStore';
import { useActiveProfile } from '../../store/profileStore';
import { useColors } from '../../theme/useColors';
import { devicePowerSummary, powerEstimateLabel, powerModelExclusionReason, validActivityPowerEstimate } from '../../utils/outdoorPower';
import { automaticPowerInputKey, withAutomaticActivityPower } from '../../utils/automaticActivityPower';
import { profilePowerMass } from '../../utils/profilePower';
import { storedClimbingWork } from '../../utils/climbingWork';

export default function ActivityPowerPanel({ activity, units }: { activity: Activity; units: UnitSystem }) {
  const C = useColors();
  const updateActivity = useActivityStore(state => state.updateActivity);
  const history = useActivityStore(state => state.activities);
  const profile = useActiveProfile();
  const mass = profilePowerMass(profile);
  const profileKey = mass ? `${mass.athleteId}:${mass.bodyMassKg}` : 'unavailable';
  const [saveError, setSaveError] = useState(false);
  const attempted = useRef<string | null>(null);
  const inputKey = useMemo(() => automaticPowerInputKey(activity), [activity]);
  useEffect(() => {
    const attemptKey = `${activity.id}:${inputKey}:${activity.metrics.powerEstimate?.computedAt ?? ''}:${profileKey}`;
    if (attempted.current === attemptKey) return;
    attempted.current = attemptKey;
    const metrics = withAutomaticActivityPower(activity, profile);
    if (metrics === activity.metrics) return;
    // Do not apply a stale render's metrics over a newer edit or recording enrichment.
    if (useActivityStore.getState().activities.find(item => item.id === activity.id) !== activity) return;
    try {
      updateActivity(activity.id, { metrics });
      setSaveError(false);
    } catch { setSaveError(true); }
  }, [activity, inputKey, profileKey, updateActivity]);

  const device = devicePowerSummary(activity);
  const entered = !device && ['cycling', 'indoor_cycling'].includes(activity.activityType)
    && Number.isFinite(activity.metrics.cyclingPowerWatts) && activity.metrics.cyclingPowerWatts! >= 0
    && activity.metrics.metricSources?.power !== 'model_estimate' ? activity.metrics.cyclingPowerWatts : undefined;
  const estimate = !device && entered == null && validActivityPowerEstimate(activity, activity.metrics.powerEstimate) ? activity.metrics.powerEstimate : undefined;
  const cycling = activity.activityType === 'cycling';
  const running = activity.activityType === 'running';
  const climbingOnly = activity.activityType === 'hiking' || activity.activityType === 'walking';
  const climbingWork = storedClimbingWork(activity);
  if (!cycling && !running && !climbingOnly && !device && entered == null) return null;
  const comparable = estimate ? history.filter(item => item.id !== activity.id
    && validActivityPowerEstimate(item, item.metrics.powerEstimate)
    && item.metrics.powerEstimate?.modelId === estimate.modelId && item.metrics.powerEstimate.version === estimate.version
    && item.metrics.powerEstimate.quantity === estimate.quantity)
    .sort((a, b) => b.startTime - a.startTime).slice(0, 5) : [];
  return <View style={[s.root, { borderColor: C.border }]}>
    <Text style={[s.heading, { color: C.text }]}>{climbingOnly ? 'Climbing work' : 'Power'}</Text>
    {device ? <>
      <Text selectable style={[s.value, { color: C.text }]}>{Math.round(device.watts)} W</Text>
      <Text style={[s.copy, { color: C.textDim }]}>{device.label} · {device.coverageRatio == null ? 'Coverage not recorded' : `${Math.round(device.coverageRatio * 100)}% sensor coverage`}</Text>
    </> : entered != null ? <>
      <Text selectable style={[s.value, { color: C.text }]}>{Math.round(entered)} W</Text>
      <Text style={[s.copy, { color: C.textDim }]}>Entered average power · sensor provenance unavailable</Text>
    </> : null}
    {estimate?.averageWatts != null ? <>
      <Text style={[s.copy, { color: C.primary }]}>{powerEstimateLabel(estimate)}</Text>
      <Text selectable style={[s.value, { color: C.text }]}>{Math.round(estimate.averageWatts)} W</Text>
      <Text style={[s.copy, { color: C.textDim }]}>Model {estimate.modelId} v{estimate.version} · {Math.round(estimate.coverageRatio * 100)}% GPS coverage</Text>
      {estimate.inputs.filter(input => input.unit === 'kg').map(input => <Text key={input.name} style={[s.copy, { color: C.textDim }]}>{input.name}: {input.value} kg</Text>)}
      {estimate.assumptions.map(note => <Text key={note} style={[s.copy, { color: C.textMuted }]}>{note}</Text>)}
    </> : null}
    {climbingWork != null ? <>
      <Text selectable style={[s.value, { color: C.text }]}>{Math.round(climbingWork.kilojoules)} kJ</Text>
      {climbingWork.averageClimbingWatts != null ? <>
        <Text selectable style={[s.value, { color: C.text }]}>{Math.round(climbingWork.averageClimbingWatts)} W</Text>
        <Text style={[s.copy, { color: C.textDim }]}>Average climbing-component power · {climbingWork.seconds} {climbingWork.timeBasis === 'active' ? 'active seconds' : climbingWork.timeBasis === 'elapsed' ? 'elapsed seconds, including pauses; active time unavailable' : 'seconds of activity duration; active time unavailable'}</Text>
      </> : <Text style={[s.copy, { color: C.textDim }]}>Climbing power unavailable without a valid positive time.</Text>}
      <Text style={[s.copy, { color: C.textMuted }]}>{climbingWork.note}</Text>
      <Text style={[s.copy, { color: C.textDim }]}>Mass snapshot: {(climbingWork.bodyMassKg * (units === 'metric' ? 1 : 2.20462)).toFixed(1)} {units === 'metric' ? 'kg' : 'lb'} · {climbingWork.weightProvenance.source === 'user_entered' ? 'user-entered profile weight' : 'inferred legacy non-default weight; entry date unknown'} · ascent source: {climbingWork.elevationSource}</Text>
    </> : null}
    {!device && entered == null && !estimate && !climbingWork ? <Text style={[s.copy, { color: C.textMuted }]}>
      {!mass ? 'A user-saved profile weight between 20 and 300 kg is required for an estimate.'
        : climbingOnly ? activity.metrics.elevationGainMeters === 0 ? 'Entered ascent is zero; no positive climbing work.' : 'Elevation gain is required for a climbing-work estimate.'
          : powerModelExclusionReason(activity) ?? 'An estimate requires at least 20 seconds and 70% usable recorded GPS speed and grade coverage. Unsupported speeds and grades remain unavailable.'}
    </Text> : null}
    {saveError ? <Text selectable style={[s.copy, { color: C.textMuted }]}>The automatic estimate could not be saved. Reopen this activity after history is available.</Text> : null}
    {comparable.length ? <>
      <Text style={[s.copy, { color: C.textDim }]}>SAME-MODEL HISTORY</Text>
      {comparable.map(item => <View key={item.id} style={s.historyRow}>
        <Text style={[s.copy, { color: C.textMuted }]}>{new Date(item.startTime).toLocaleDateString()}</Text>
        <Text style={[s.copy, { color: C.text }]}>{Math.round(item.metrics.powerEstimate!.averageWatts!)} W</Text>
      </View>)}
    </> : null}
  </View>;
}

const s = StyleSheet.create({
  root: { paddingVertical: 18, borderTopWidth: StyleSheet.hairlineWidth, gap: 10 },
  heading: { fontSize: 20, fontWeight: '700' }, value: { fontSize: 28, fontWeight: '700' },
  copy: { fontSize: 12, lineHeight: 18 }, historyRow: { flexDirection: 'row', justifyContent: 'space-between' },
});
