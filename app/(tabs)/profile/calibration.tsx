import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useMemo, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { LAYOUT } from '../../../src/constants/layout';
import { colors } from '../../../src/theme/colors';
import { useColors } from '../../../src/theme/useColors';
import { useActiveProfile, useProfileStore } from '../../../src/store/profileStore';
import { useAthleteStore } from '../../../src/store/athleteStore';
import { useWorkoutStore } from '../../../src/store/workoutStore';
import {
  STANDARD_DISTANCE_METERS,
  type RacePR,
  type StandardDistance,
  type ZoneMethod,
} from '../../../src/types/athlete';
import { formatPace, formatRaceTime, vdotFromRacePR } from '../../../src/utils/calibrationEngine';
import { formatYMDForDisplay, parseDisplayDateToYMD } from '../../../src/utils/dateFormatting';

const DISTANCES: { key: StandardDistance; label: string }[] = [
  { key: '5k', label: '5K' },
  { key: '10k', label: '10K' },
  { key: 'half_marathon', label: 'Half Marathon' },
  { key: 'marathon', label: 'Marathon' },
  { key: '1_mile', label: '1 Mile' },
  { key: '800m', label: '800m' },
];

const METHODS: { key: ZoneMethod; title: string; body: string }[] = [
  { key: 'vdot', title: 'VDOT Paces', body: 'Uses recent race PRs to estimate training paces and race predictions.' },
  { key: 'race_prediction', title: 'Race Prediction', body: 'Shows predicted race times from your current VDOT.' },
  { key: 'tanaka_karvonen', title: 'Tanaka + Karvonen', body: 'Estimates max HR from age, then builds HR zones from heart-rate reserve.' },
  { key: 'manual_karvonen', title: 'Measured HRmax + Karvonen', body: 'Uses your measured HR max and resting HR for heart-rate reserve zones.' },
  { key: 'threshold', title: 'Threshold Test', body: 'Uses a 30-minute field test to build threshold pace and LTHR zones.' },
];

function parseTimeToSeconds(value: string) {
  const parts = value.trim().split(':').map(Number);
  if (parts.some(n => !Number.isFinite(n))) return null;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return null;
}

function parsePaceToSeconds(value: string) {
  const seconds = parseTimeToSeconds(value);
  return seconds && seconds > 180 && seconds < 1800 ? seconds : null;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function CalibrationScreen() {
  const C = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const profile = useActiveProfile();
  const weeklyMileage = useAthleteStore(s => s.weeklyMileage);
  const trainingPhase = useAthleteStore(s => s.trainingPhase);
  const fatigueScore = useAthleteStore(s => s.fatigueScore);
  const recoveryScore = useAthleteStore(s => s.recoveryScore);
  const history = useWorkoutStore(s => s.history);

  const addRacePR = useProfileStore(s => s.addRacePR);
  const removeRacePR = useProfileStore(s => s.removeRacePR);
  const updateActive = useProfileStore(s => s.updateActive);
  const setZoneMethod = useProfileStore(s => s.setZoneMethod);
  const setThresholdTest = useProfileStore(s => s.setThresholdTest);
  const clearThresholdTest = useProfileStore(s => s.clearThresholdTest);
  const addMAFTest = useProfileStore(s => s.addMAFTest);
  const removeMAFTest = useProfileStore(s => s.removeMAFTest);
  const recalibrate = useProfileStore(s => s.recalibrate);

  const [distance, setDistance] = useState<StandardDistance>('5k');
  const [prTime, setPrTime] = useState('');
  const [prDate, setPrDate] = useState(formatYMDForDisplay(today()));
  const [restingHr, setRestingHr] = useState(profile?.hrResting ? String(profile.hrResting) : '');
  const [maxHr, setMaxHr] = useState(profile?.hrMax ? String(profile.hrMax) : '');
  const [thresholdHr, setThresholdHr] = useState(profile?.thresholdTest?.avgHRLastTwentyMin ? String(profile.thresholdTest.avgHRLastTwentyMin) : '');
  const [thresholdPace, setThresholdPace] = useState(profile?.thresholdTest?.avgPaceSecPerMiLastTwenty ? formatPace(profile.thresholdTest.avgPaceSecPerMiLastTwenty) : '');
  const [mafDistance, setMafDistance] = useState('3');
  const [mafDuration, setMafDuration] = useState('');
  const [mafDrift, setMafDrift] = useState('5');

  const calibration = profile?.calibration ?? null;
  const recentWorkoutCount = useMemo(() => {
    const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;
    return history.filter(item => item.timestamp >= cutoff).length;
  }, [history]);
  const lastWorkoutDaysAgo = useMemo(() => {
    const latest = history.reduce((max, item) => Math.max(max, item.timestamp), 0);
    if (!latest) return 7;
    return Math.max(0, Math.round((Date.now() - latest) / (24 * 60 * 60 * 1000)));
  }, [history]);

  function runRecalibration() {
    recalibrate({
      weeklyMileage,
      currentPhase: trainingPhase,
      recentWorkoutCount,
      lastWorkoutDaysAgo,
      currentFatigueScore: fatigueScore,
      currentRecoveryScore: recoveryScore,
    });
  }

  function addPr() {
    if (!profile) return;
    const seconds = parseTimeToSeconds(prTime);
    if (!seconds || seconds <= 0) {
      Alert.alert('Use a valid PR time', 'Enter time as MM:SS or H:MM:SS.');
      return;
    }
    const meters = STANDARD_DISTANCE_METERS[distance];
    if (!meters) return;
    const label = DISTANCES.find(d => d.key === distance)?.label ?? distance;
    const pr: RacePR = {
      id: `pr_${Date.now()}`,
      distanceKey: distance,
      distanceLabel: label,
      distanceMeters: meters,
      timeSeconds: seconds,
      date: parseDisplayDateToYMD(prDate) ?? today(),
      official: true,
    };
    addRacePR(profile.athleteId, pr);
    setPrTime('');
    setTimeout(runRecalibration, 0);
  }

  function saveHrData(method?: ZoneMethod) {
    const hrResting = Number(restingHr);
    const hrMax = Number(maxHr);
    updateActive({
      hrResting: Number.isFinite(hrResting) && hrResting > 25 && hrResting < 120 ? hrResting : null,
      hrMax: Number.isFinite(hrMax) && hrMax > 120 && hrMax < 230 ? hrMax : profile?.hrMax ?? null,
      hrMaxManual: method === 'manual_karvonen' ? true : profile?.hrMaxManual ?? false,
    });
    if (profile && method) setZoneMethod(profile.athleteId, method);
    setTimeout(runRecalibration, 0);
  }

  function chooseMethod(method: ZoneMethod) {
    if (!profile) return;
    if (method === 'manual_karvonen') saveHrData(method);
    else {
      if (method === 'tanaka_karvonen') updateActive({ hrMaxManual: false });
      setZoneMethod(profile.athleteId, method);
      setTimeout(runRecalibration, 0);
    }
  }

  function saveThreshold() {
    if (!profile) return;
    const hr = Number(thresholdHr);
    const pace = parsePaceToSeconds(thresholdPace);
    if (!Number.isFinite(hr) || hr < 100 || hr > 220 || !pace) {
      Alert.alert('Check threshold test', 'Use average HR and pace from the last 20 minutes of a 30-minute hard field test.');
      return;
    }
    setThresholdTest(profile.athleteId, {
      id: `threshold_${Date.now()}`,
      date: today(),
      avgHRLastTwentyMin: Math.round(hr),
      avgPaceSecPerMiLastTwenty: pace,
    });
    setZoneMethod(profile.athleteId, 'threshold');
    setTimeout(runRecalibration, 0);
  }

  function saveMaf() {
    if (!profile) return;
    const miles = Number(mafDistance);
    const duration = Number(mafDuration);
    const drift = Number(mafDrift);
    if (!Number.isFinite(miles) || miles <= 0 || !Number.isFinite(duration) || duration <= 0) {
      Alert.alert('Check MAF test', 'Enter distance and total duration for the test.');
      return;
    }
    const mafHR = Math.max(100, 180 - profile.age);
    addMAFTest(profile.athleteId, {
      id: `maf_${Date.now()}`,
      date: today(),
      mafHR,
      distanceMiles: miles,
      durationMin: duration,
      avgPaceSecPerMi: Math.round((duration * 60) / miles),
      hrDriftBPM: Number.isFinite(drift) ? Math.round(drift) : 0,
    });
    setTimeout(runRecalibration, 0);
  }

  if (!profile) {
    return (
      <View style={[styles.center, { backgroundColor: C.bg }]}>
        <Text style={[styles.title, { color: C.text }]}>No profile found</Text>
        <Text style={[styles.body, { color: C.textMuted }]}>Reset onboarding from Settings to rebuild the athlete profile.</Text>
      </View>
    );
  }

  const sortedPrs = [...profile.racePRs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const mafTests = [...profile.mafTests].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: C.bg }}
      contentContainerStyle={{ paddingHorizontal: 18, paddingTop: insets.top + 6, paddingBottom: LAYOUT.screenPadBottom }}
      showsVerticalScrollIndicator={false}
    >
      <Header C={C} title="Performance Calibration" onBack={() => router.back()} />

      <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
        <Text style={[styles.sectionLabel, { color: C.textDim }]}>CURRENT MODEL</Text>
        <View style={styles.metricsRow}>
          <Metric label="VDOT" value={calibration ? calibration.vdot.toFixed(1) : '--'} color={C.text} />
          <Metric label="HR Max" value={calibration?.estimatedHRMax ? String(calibration.estimatedHRMax) : maxHr || '--'} color={C.text} />
          <Metric label="Confidence" value={calibration?.confidenceLabel ?? 'estimated'} color={C.text} />
        </View>
        <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: C.primary }]} onPress={runRecalibration}>
          <Text style={[styles.primaryText, { color: C.onPrimary }]}>Recalculate Paces + Zones</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
        <Text style={[styles.sectionLabel, { color: C.textDim }]}>METHOD TO USE</Text>
        {METHODS.map(method => {
          const active = profile.activeZoneMethod === method.key;
          return (
            <TouchableOpacity
              key={method.key}
              style={[styles.methodRow, { borderColor: active ? C.primary : C.border, backgroundColor: active ? C.primaryDim : C.cardAlt }]}
              onPress={() => chooseMethod(method.key)}
              activeOpacity={0.78}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.methodTitle, { color: C.text }]}>{method.title}</Text>
                <Text style={[styles.caption, { color: C.textMuted }]}>{method.body}</Text>
              </View>
              {active ? <Ionicons name="checkmark-circle" size={20} color={C.primary} /> : null}
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
        <Text style={[styles.sectionLabel, { color: C.textDim }]}>RACE PRS + VDOT</Text>
        <Text style={[styles.body, { color: C.textMuted }]}>
          Add recent race results or time trials. StrideOS uses the best valid PR to update VDOT, training paces, and race predictions. PRs older than 18 months are treated as less reliable.
        </Text>
        <View style={styles.pills}>
          {DISTANCES.map(item => (
            <TouchableOpacity
              key={item.key}
              style={[styles.pill, { backgroundColor: distance === item.key ? C.primaryDim : C.cardAlt, borderColor: distance === item.key ? C.primary : C.border }]}
              onPress={() => setDistance(item.key)}
            >
              <Text style={[styles.pillText, { color: distance === item.key ? C.primary : C.textMuted }]}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.formRow}>
          <Field C={C} label="Time" value={prTime} onChangeText={setPrTime} placeholder="22:30" />
          <Field C={C} label="Date" value={prDate} onChangeText={setPrDate} placeholder="MM-DD-YYYY" />
        </View>
        <TouchableOpacity style={[styles.secondaryBtn, { borderColor: C.primary }]} onPress={addPr}>
          <Text style={[styles.secondaryText, { color: C.primary }]}>Add PR</Text>
        </TouchableOpacity>
        {sortedPrs.map(pr => {
          const stale = Date.now() - new Date(`${pr.date}T00:00:00`).getTime() > 18 * 30 * 24 * 60 * 60 * 1000;
          return (
            <View key={pr.id} style={[styles.listRow, { borderBottomColor: C.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowTitle, { color: C.text }]}>{pr.distanceLabel} · {formatRaceTime(pr.timeSeconds)}</Text>
                <Text style={[styles.caption, { color: stale ? C.warning : C.textMuted }]}>
                  {formatYMDForDisplay(pr.date)} · VDOT {vdotFromRacePR(pr.distanceMeters, pr.timeSeconds).toFixed(1)}{stale ? ' · may be stale' : ''}
                </Text>
              </View>
              <TouchableOpacity onPress={() => { removeRacePR(profile.athleteId, pr.id); setTimeout(runRecalibration, 0); }}>
                <Ionicons name="trash-outline" size={18} color={C.critical} />
              </TouchableOpacity>
            </View>
          );
        })}
      </View>

      <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
        <Text style={[styles.sectionLabel, { color: C.textDim }]}>HEART RATE ZONES</Text>
        <Text style={[styles.body, { color: C.textMuted }]}>
          Tanaka estimates HRmax from age. Karvonen uses HR reserve, so resting HR improves accuracy. Use measured HRmax only if you have tested it safely.
        </Text>
        <View style={styles.formRow}>
          <Field C={C} label="Resting HR" value={restingHr} onChangeText={setRestingHr} placeholder="52" keyboardType="number-pad" />
          <Field C={C} label="Measured HRmax" value={maxHr} onChangeText={setMaxHr} placeholder="188" keyboardType="number-pad" />
        </View>
        <TouchableOpacity style={[styles.secondaryBtn, { borderColor: C.primary }]} onPress={() => saveHrData()}>
          <Text style={[styles.secondaryText, { color: C.primary }]}>Save HR Data</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
        <Text style={[styles.sectionLabel, { color: C.textDim }]}>THRESHOLD FIELD TEST</Text>
        <Text style={[styles.body, { color: C.textMuted }]}>
          Warm up, then run 30 minutes as hard as you can sustain. Record average HR and pace for the last 20 minutes. This estimates lactate threshold HR and threshold pace.
        </Text>
        <View style={styles.formRow}>
          <Field C={C} label="Last 20 min HR" value={thresholdHr} onChangeText={setThresholdHr} placeholder="172" keyboardType="number-pad" />
          <Field C={C} label="Last 20 min pace" value={thresholdPace} onChangeText={setThresholdPace} placeholder="7:10" />
        </View>
        <View style={styles.buttonRow}>
          <TouchableOpacity style={[styles.secondaryBtn, { borderColor: C.primary, flex: 1 }]} onPress={saveThreshold}>
            <Text style={[styles.secondaryText, { color: C.primary }]}>Save Threshold Test</Text>
          </TouchableOpacity>
          {profile.thresholdTest ? (
            <TouchableOpacity style={[styles.secondaryBtn, { borderColor: C.critical, flex: 1 }]} onPress={() => { clearThresholdTest(profile.athleteId); setTimeout(runRecalibration, 0); }}>
              <Text style={[styles.secondaryText, { color: C.critical }]}>Clear</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
        <Text style={[styles.sectionLabel, { color: C.textDim }]}>MAF TEST</Text>
        <Text style={[styles.body, { color: C.textMuted }]}>
          Run the same route at about 180 minus age bpm. Over time, faster pace with less HR drift suggests aerobic improvement. It is a trend test, not the main prescription system.
        </Text>
        <View style={styles.formRow}>
          <Field C={C} label="Miles" value={mafDistance} onChangeText={setMafDistance} keyboardType="decimal-pad" />
          <Field C={C} label="Minutes" value={mafDuration} onChangeText={setMafDuration} keyboardType="decimal-pad" />
          <Field C={C} label="HR drift" value={mafDrift} onChangeText={setMafDrift} keyboardType="number-pad" />
        </View>
        <TouchableOpacity style={[styles.secondaryBtn, { borderColor: C.primary }]} onPress={saveMaf}>
          <Text style={[styles.secondaryText, { color: C.primary }]}>Log MAF Test</Text>
        </TouchableOpacity>
        {mafTests.slice(0, 4).map(test => (
          <View key={test.id} style={[styles.listRow, { borderBottomColor: C.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowTitle, { color: C.text }]}>{test.date} · {formatPace(test.avgPaceSecPerMi)}/mi</Text>
              <Text style={[styles.caption, { color: C.textMuted }]}>MAF {test.mafHR} bpm · +{test.hrDriftBPM} bpm drift</Text>
            </View>
            <TouchableOpacity onPress={() => removeMAFTest(profile.athleteId, test.id)}>
              <Ionicons name="trash-outline" size={18} color={C.critical} />
            </TouchableOpacity>
          </View>
        ))}
      </View>

      {calibration?.racePredictions?.length ? (
        <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
          <Text style={[styles.sectionLabel, { color: C.textDim }]}>PREDICTED RACE TIMES</Text>
          {calibration.racePredictions.map(pred => (
            <View key={pred.distanceKey} style={[styles.listRow, { borderBottomColor: C.border }]}>
              <Text style={[styles.rowTitle, { color: C.text }]}>{pred.distance}</Text>
              <Text style={[styles.rowTitle, { color: C.primary }]}>
                {formatRaceTime(pred.predictedSeconds)}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}

function Header({ C, title, onBack }: { C: ReturnType<typeof useColors>; title: string; onBack: () => void }) {
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={onBack} hitSlop={12}>
        <Ionicons name="arrow-back" size={20} color={C.primary} />
      </TouchableOpacity>
      <View style={{ marginLeft: 10 }}>
        <Text style={[styles.headerLabel, { color: C.textDim }]}>PROFILE</Text>
        <Text style={[styles.headerTitle, { color: C.text }]}>{title}</Text>
      </View>
    </View>
  );
}

function Field({
  C,
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
}: {
  C: ReturnType<typeof useColors>;
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'number-pad' | 'decimal-pad';
}) {
  return (
    <View style={{ flex: 1, minWidth: 96 }}>
      <Text style={[styles.fieldLabel, { color: C.textMuted }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={C.textDim}
        keyboardType={keyboardType ?? 'default'}
        style={[styles.input, { color: C.text, backgroundColor: C.cardAlt, borderColor: C.border }]}
      />
    </View>
  );
}

function Metric({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.metric}>
      <Text style={[styles.metricValue, { color }]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  headerLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.9, textTransform: 'uppercase' },
  headerTitle: { fontSize: 26, fontWeight: '700', fontFamily: 'CormorantGaramond_700Bold' },
  card: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 10 },
  sectionLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10 },
  title: { fontSize: 22, fontWeight: '900', marginBottom: 8 },
  body: { fontSize: 13, lineHeight: 19, marginBottom: 12 },
  caption: { fontSize: 11, lineHeight: 16, marginTop: 2 },
  metricsRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  metric: { flex: 1, minHeight: 58, borderRadius: 12, backgroundColor: 'rgba(127,127,127,0.12)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  metricValue: { fontSize: 16, fontWeight: '900', textTransform: 'capitalize' },
  metricLabel: { fontSize: 9, fontWeight: '800', color: colors.textDim, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 3 },
  methodRow: { flexDirection: 'row', gap: 10, alignItems: 'center', borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 8 },
  methodTitle: { fontSize: 14, fontWeight: '900' },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  pill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  pillText: { fontSize: 12, fontWeight: '800' },
  formRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 10 },
  fieldLabel: { fontSize: 11, fontWeight: '800', marginBottom: 5 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 9, fontSize: 13, fontWeight: '700' },
  primaryBtn: { borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  primaryText: { fontSize: 13, fontWeight: '900' },
  secondaryBtn: { borderWidth: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center', paddingHorizontal: 12 },
  secondaryText: { fontSize: 13, fontWeight: '900' },
  buttonRow: { flexDirection: 'row', gap: 10 },
  listRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingVertical: 10, borderBottomWidth: 1 },
  rowTitle: { fontSize: 13, fontWeight: '900' },
});
