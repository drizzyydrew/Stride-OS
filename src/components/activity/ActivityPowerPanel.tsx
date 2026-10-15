import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { Activity } from '../../types/activity';
import type { UnitSystem } from '../../store/settingsStore';
import { useActivityStore } from '../../store/activityStore';
import { useOnboardingStore } from '../../store/onboardingStore';
import { useColors } from '../../theme/useColors';
import { devicePowerSummary, estimateActivityPower, estimateClimbingWork, powerEstimateLabel, powerModelExclusionReason } from '../../utils/outdoorPower';

export default function ActivityPowerPanel({ activity, units }: { activity: Activity; units: UnitSystem }) {
  const C = useColors();
  const updateActivity = useActivityStore(state => state.updateActivity);
  const history = useActivityStore(state => state.activities);
  const profileMass = useOnboardingStore(state => state.data.weightKg);
  const [body, setBody] = useState(String(Math.round(profileMass * (units === 'metric' ? 1 : 2.20462))));
  const [bike, setBike] = useState(units === 'metric' ? '10' : '22');
  const [climbingWork, setClimbingWork] = useState<ReturnType<typeof estimateClimbingWork>>(null);
  const device = devicePowerSummary(activity);
  const estimate = activity.metrics.powerEstimate;
  const cycling = activity.activityType === 'cycling';
  const running = activity.activityType === 'running';
  const climbingOnly = activity.activityType === 'hiking' || activity.activityType === 'walking';
  if (!cycling && !running && !climbingOnly) return null;
  function calculate() {
    const kg = Number(body) / (units === 'metric' ? 1 : 2.20462);
    const bikeKg = Number(bike) / (units === 'metric' ? 1 : 2.20462);
    if (!Number.isFinite(kg) || kg < 20 || kg > 300 || (cycling && (!Number.isFinite(bikeKg) || bikeKg < 1 || bikeKg > 60))) {
      Alert.alert('Check mass', 'Enter your body mass and, for cycling, the bicycle mass before calculating.');
      return;
    }
    if (climbingOnly) {
      const work = estimateClimbingWork(activity, kg);
      if (!work) {
        Alert.alert('Elevation unavailable', 'Recorded elevation gain is required for a climbing-work estimate.');
        return;
      }
      setClimbingWork(work);
      return;
    }
    const calculated = estimateActivityPower(activity, kg, bikeKg);
    if (!calculated) {
      Alert.alert('Estimate unavailable', powerModelExclusionReason(activity) ?? 'This model needs at least 20 seconds and 70% usable GPS speed/elevation coverage. Mixed run/walk, unsupported speeds, and extreme grades are not modeled.');
      return;
    }
    updateActivity(activity.id, { metrics: { ...activity.metrics, powerEstimate: calculated } });
  }
  const comparable = estimate ? history.filter(item => item.id !== activity.id
    && item.metrics.powerEstimate?.modelId === estimate.modelId && item.metrics.powerEstimate.version === estimate.version
    && item.metrics.powerEstimate.quantity === estimate.quantity && Number.isFinite(item.metrics.powerEstimate.averageWatts))
    .sort((a, b) => b.startTime - a.startTime).slice(0, 5) : [];
  return <View style={[s.root, { borderColor: C.border }]}>
    <Text style={[s.heading, { color: C.text }]}>{climbingOnly ? 'Climbing work' : 'Power'}</Text>
    {device ? <>
      <Text style={[s.value, { color: C.text }]}>{Math.round(device.watts)} W</Text>
      <Text style={[s.copy, { color: C.textDim }]}>{device.label} · {device.coverageRatio == null ? 'Coverage not recorded' : `${Math.round(device.coverageRatio * 100)}% sensor coverage`}</Text>
    </> : null}
    {estimate?.averageWatts != null ? <>
      <Text style={[s.copy, { color: C.primary }]}>{powerEstimateLabel(estimate)}</Text>
      <Text style={[s.value, { color: C.text }]}>{Math.round(estimate.averageWatts)} W</Text>
      <Text style={[s.copy, { color: C.textDim }]}>Model {estimate.modelId} v{estimate.version} · {Math.round(estimate.coverageRatio * 100)}% GPS coverage</Text>
      {estimate.assumptions.map(note => <Text key={note} style={[s.copy, { color: C.textMuted }]}>{note}</Text>)}
    </> : null}
    {climbingWork != null ? <>
      <Text style={[s.value, { color: C.text }]}>{Math.round(climbingWork.kilojoules)} kJ</Text>
      <Text style={[s.copy, { color: C.textMuted }]}>{climbingWork.note}</Text>
    </> : null}
    {!device && !estimate && !climbingOnly ? <Text style={[s.copy, { color: C.textMuted }]}>{running ? 'Device running power was not recorded. The optional GPS model estimates metabolic expenditure, not mechanical power or wearable-equivalent watts.' : 'Power-meter data was not recorded. The optional road-load model is experimental and assumes still air and road rolling resistance.'}</Text> : null}
    <View style={s.inputs}>
      <View style={s.field}>
        <Text style={[s.copy, { color: C.textDim }]}>Body mass ({units === 'metric' ? 'kg' : 'lb'})</Text>
        <TextInput value={body} onChangeText={setBody} keyboardType="decimal-pad" accessibilityLabel="Body mass for power estimate" style={[s.input, { color: C.text, borderColor: C.border }]} />
      </View>
      {cycling ? <View style={s.field}>
        <Text style={[s.copy, { color: C.textDim }]}>Bike mass ({units === 'metric' ? 'kg' : 'lb'})</Text>
        <TextInput value={bike} onChangeText={setBike} keyboardType="decimal-pad" accessibilityLabel="Bicycle mass for power estimate" style={[s.input, { color: C.text, borderColor: C.border }]} />
      </View> : null}
    </View>
    <Pressable onPress={calculate} accessibilityRole="button" style={[s.calculate, { backgroundColor: C.primary }]}>
      <Text style={[s.buttonText, { color: C.onPrimary }]}>{climbingOnly ? 'Calculate Climbing Work' : running ? 'Calculate Metabolic Estimate' : 'Calculate Road-Load Estimate'}</Text>
    </Pressable>
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
  copy: { fontSize: 12, lineHeight: 18 }, inputs: { flexDirection: 'row', gap: 12 },
  field: { flex: 1 }, input: { minHeight: 44, borderWidth: 1, borderRadius: 6, padding: 10, marginTop: 4 },
  calculate: { minHeight: 44, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 6, alignItems: 'center' },
  buttonText: { fontSize: 13, fontWeight: '700', textAlign: 'center' },
  historyRow: { flexDirection: 'row', justifyContent: 'space-between' },
});
