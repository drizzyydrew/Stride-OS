import { Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useEffect, useMemo, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

import { LAYOUT } from '../../../src/constants/layout';
import { useColors } from '../../../src/theme/useColors';
import { useSettingsStore } from '../../../src/store/settingsStore';
import { useOnboardingStore } from '../../../src/store/onboardingStore';
import { useActiveProfile } from '../../../src/store/profileStore';
import { useAthleteStore } from '../../../src/store/athleteStore';
import { formatPace, formatRaceTime } from '../../../src/utils/calibrationEngine';

function formatHeight(heightCm: number, imperial: boolean) {
  if (!heightCm) return '';
  if (!imperial) return String(Math.round(heightCm));
  const totalInches = Math.round(heightCm / 2.54);
  return `${Math.floor(totalInches / 12)}'${totalInches % 12}`;
}

function parseHeightInput(value: string, imperial: boolean) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!imperial) {
    const cm = Math.round(Number(trimmed));
    return Number.isFinite(cm) ? cm : null;
  }
  const match = trimmed.match(/^(\d+)\s*(?:'|ft)?\s*(\d{0,2})?\s*(?:"|in)?$/i);
  if (match) return Math.round((Number(match[1]) * 12 + Number(match[2] || 0)) * 2.54);
  const inches = Number(trimmed);
  return Number.isFinite(inches) ? Math.round(inches * 2.54) : null;
}

function formatWeight(weightKg: number, imperial: boolean) {
  if (!weightKg) return '';
  return imperial ? String(Math.round(weightKg * 2.20462)) : String(Math.round(weightKg));
}

export default function ProfileScreen() {
  const C = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { units } = useSettingsStore();
  const imp = units === 'imperial';
  const { data, updateData } = useOnboardingStore();
  const profile = useActiveProfile();
  const weeklyMileage = useAthleteStore(s => s.weeklyMileage);
  const goalRace = useAthleteStore(s => s.goalRace);

  const [ageInput, setAgeInput] = useState('');
  const [heightInput, setHeightInput] = useState('');
  const [weightInput, setWeightInput] = useState('');

  useEffect(() => {
    setAgeInput(data.age ? String(data.age) : '');
    setHeightInput(formatHeight(data.heightCm, imp));
    setWeightInput(formatWeight(data.weightKg, imp));
  }, [data.age, data.heightCm, data.weightKg, imp]);

  const calibration = profile?.calibration ?? null;
  const racePredictions = calibration?.racePredictions?.slice(1, 5) ?? [];
  const methodLabel = calibration?.activeZoneMethod?.replace(/_/g, ' ') ?? 'Estimated';
  const stalePrs = useMemo(() => {
    const cutoff = Date.now() - 18 * 30 * 24 * 60 * 60 * 1000;
    return (profile?.racePRs ?? []).filter(pr => new Date(`${pr.date}T00:00:00`).getTime() < cutoff).length;
  }, [profile?.racePRs]);

  async function chooseProfilePhoto() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]?.uri) {
      updateData({ profilePhotoUri: result.assets[0].uri });
    }
  }

  function commitAge() {
    const nextAge = Math.round(Number(ageInput));
    if (Number.isFinite(nextAge) && nextAge > 0 && nextAge < 120) updateData({ age: nextAge });
    else setAgeInput(data.age ? String(data.age) : '');
  }

  function commitHeight() {
    const heightCm = parseHeightInput(heightInput, imp);
    if (heightCm && heightCm > 90 && heightCm < 245) updateData({ heightCm });
    else setHeightInput(formatHeight(data.heightCm, imp));
  }

  function commitWeight() {
    const value = Number(weightInput);
    const weightKg = imp ? Math.round(value / 2.20462) : Math.round(value);
    if (Number.isFinite(weightKg) && weightKg > 25 && weightKg < 275) updateData({ weightKg });
    else setWeightInput(formatWeight(data.weightKg, imp));
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: C.bg }}
      contentContainerStyle={{ paddingHorizontal: 18, paddingTop: insets.top + 6, paddingBottom: LAYOUT.screenPadBottom }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={20} color={C.primary} />
        </TouchableOpacity>
        <View style={{ marginLeft: 10 }}>
          <Text style={[styles.headerLabel, { color: C.textDim }]}>PROFILE</Text>
          <Text style={[styles.headerTitle, { color: C.text }]}>Athlete Profile</Text>
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
        <View style={[styles.userRow, { borderBottomColor: C.border }]}>
          <TouchableOpacity
            style={[styles.avatar, { backgroundColor: C.primaryDim, borderColor: C.primary }]}
            onPress={chooseProfilePhoto}
            activeOpacity={0.8}
          >
            {data.profilePhotoUri ? (
              <Image source={{ uri: data.profilePhotoUri }} style={styles.avatarImage} />
            ) : (
              <Text style={{ fontSize: 20, fontWeight: '800', color: C.primary }}>{(data.name || 'A').slice(0, 2).toUpperCase()}</Text>
            )}
            <View style={[styles.avatarAdd, { backgroundColor: C.primary }]}>
              <Text style={{ color: C.onPrimary, fontSize: 13, fontWeight: '800' }}>+</Text>
            </View>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[styles.profileName, { color: C.text }]}>{data.name || profile?.name || 'Athlete'}</Text>
            <Text style={[styles.caption, { color: C.textMuted }]}>
              {Math.round(weeklyMileage)} mi/week · Goal {goalRace || 'general fitness'}
            </Text>
            <Text style={[styles.caption, { color: C.textDim }]}>Tap photo to change</Text>
          </View>
        </View>

        <View style={{ gap: 10, marginTop: 4 }}>
          {[
            { label: 'Age', value: ageInput, onChangeText: setAgeInput, onBlur: commitAge, unit: 'yrs', keyboardType: 'number-pad' as const },
            { label: 'Height', value: heightInput, onChangeText: setHeightInput, onBlur: commitHeight, unit: imp ? 'ft/in' : 'cm', keyboardType: 'default' as const },
            { label: 'Weight', value: weightInput, onChangeText: setWeightInput, onBlur: commitWeight, unit: imp ? 'lbs' : 'kg', keyboardType: 'number-pad' as const },
          ].map(f => (
            <View key={f.label} style={styles.inputRow}>
              <Text style={[styles.inputLabel, { color: C.textMuted }]}>{f.label}</Text>
              <TextInput
                value={f.value}
                onChangeText={f.onChangeText}
                onBlur={f.onBlur}
                onSubmitEditing={f.onBlur}
                keyboardType={f.keyboardType}
                style={[styles.profileInput, { backgroundColor: C.cardAlt, borderColor: C.border, color: C.text }]}
              />
              <Text style={[styles.unit, { color: C.textDim }]}>{f.unit}</Text>
            </View>
          ))}
        </View>
      </View>

      <TouchableOpacity
        style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}
        onPress={() => router.push('/(tabs)/profile/calibration' as any)}
        activeOpacity={0.78}
      >
        <View style={styles.cardHeaderRow}>
          <Text style={[styles.sectionLabel, { color: C.textDim }]}>PERFORMANCE CALIBRATION</Text>
          <Ionicons name="chevron-forward" size={18} color={C.primary} />
        </View>
        <View style={styles.metricsRow}>
          <Metric label="VDOT" value={calibration ? calibration.vdot.toFixed(1) : '--'} color={C.text} />
          <Metric label="Confidence" value={calibration ? calibration.confidenceLabel : 'estimated'} color={C.text} />
          <Metric label="Method" value={methodLabel} color={C.text} />
        </View>
        <Text style={[styles.body, { color: C.textMuted }]}>
          Add PRs, threshold tests, MAF tests, resting HR, and HR max to update pace zones, HR zones, race predictions, and weekly training targets.
        </Text>
        {stalePrs > 0 ? (
          <Text style={[styles.warning, { color: C.warning }]}>
            {stalePrs} PR {stalePrs === 1 ? 'is' : 'are'} older than 18 months. Re-test or add a recent result when possible.
          </Text>
        ) : null}
      </TouchableOpacity>

      {racePredictions.length > 0 && (
        <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
          <Text style={[styles.sectionLabel, { color: C.textDim }]}>RACE PREDICTIONS</Text>
          {racePredictions.map(pred => (
            <View key={pred.distanceKey} style={[styles.predRow, { borderBottomColor: C.border }]}>
              <Text style={[styles.predName, { color: C.text }]}>{pred.distance}</Text>
              <Text style={[styles.predValue, { color: C.primary }]}>
                {formatRaceTime(pred.predictedSeconds)} · {formatPace(pred.predictedSeconds / (pred.distanceMeters / 1609.344))}/mi
              </Text>
            </View>
          ))}
        </View>
      )}

      <TouchableOpacity
        style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}
        onPress={() => router.push('/(tabs)/profile/availability' as any)}
        activeOpacity={0.78}
      >
        <View style={styles.cardHeaderRow}>
          <Text style={[styles.sectionLabel, { color: C.textDim }]}>TRAINING AVAILABILITY</Text>
          <Ionicons name="chevron-forward" size={18} color={C.primary} />
        </View>
        <View style={styles.metricsRow}>
          <Metric label="Overall" value={`${data.availableDays.length} days`} color={C.text} />
          <Metric label="Run" value={`${(data.runDays ?? []).length} days`} color={C.text} />
          <Metric label="Lift" value={`${(data.liftDays ?? []).length} days`} color={C.text} />
        </View>
        <Text style={[styles.body, { color: C.textMuted }]}>
          Change training days here to rebuild this week’s run and strength schedule around what you can actually do.
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}
        onPress={() => router.push('/(tabs)/activity-log' as any)}
        activeOpacity={0.78}
      >
        <View style={styles.cardHeaderRow}>
          <Text style={[styles.sectionLabel, { color: C.textDim }]}>TRAINING HISTORY</Text>
          <Ionicons name="chevron-forward" size={18} color={C.primary} />
        </View>
        <Text style={[styles.body, { color: C.textMuted }]}>
          Open the activity log to review completed runs, strength sessions, and exercise history.
        </Text>
      </TouchableOpacity>
    </ScrollView>
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
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  headerLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.9, textTransform: 'uppercase' },
  headerTitle: { fontSize: 26, fontWeight: '700', fontFamily: 'CormorantGaramond_700Bold' },
  card: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 10 },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 14, paddingBottom: 14, borderBottomWidth: 1 },
  avatar: { width: 60, height: 60, borderRadius: 30, borderWidth: 2, alignItems: 'center', justifyContent: 'center', overflow: 'visible', position: 'relative' },
  avatarImage: { width: '100%', height: '100%', borderRadius: 30 },
  avatarAdd: { position: 'absolute', bottom: -1, right: -1, width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  profileName: { fontSize: 16, fontWeight: '800' },
  caption: { fontSize: 12, marginTop: 2 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  inputLabel: { fontSize: 12, width: 64 },
  profileInput: { flex: 1, borderWidth: 1, borderRadius: 8, padding: 8, paddingHorizontal: 10, fontSize: 13 },
  unit: { fontSize: 12, width: 38 },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 },
  sectionLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' },
  metricsRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  metric: { flex: 1, minHeight: 58, borderRadius: 12, backgroundColor: 'rgba(127,127,127,0.12)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  metricValue: { fontSize: 16, fontWeight: '900', textTransform: 'capitalize' },
  metricLabel: { fontSize: 9, fontWeight: '800', color: '#8B927F', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 3 },
  body: { fontSize: 13, lineHeight: 19 },
  warning: { fontSize: 12, fontWeight: '700', marginTop: 10, lineHeight: 18 },
  predRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, paddingVertical: 9, borderBottomWidth: 1 },
  predName: { fontSize: 13, fontWeight: '800' },
  predValue: { fontSize: 12, fontWeight: '800', textAlign: 'right', flex: 1 },
});
