import { LegacyBackControl } from '../../../src/components/layout/NavigationEscape';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useMemo } from 'react';
import { usePageSafeAreaInsets as useSafeAreaInsets } from '../../../src/components/layout/PageSafeAreaView';
import { usePathname, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

import { LAYOUT } from '../../../src/constants/layout';
import { colors } from '../../../src/theme/colors';
import { useColors } from '../../../src/theme/useColors';
import { useSettingsStore } from '../../../src/store/settingsStore';
import { useOnboardingStore } from '../../../src/store/onboardingStore';
import { useActiveProfile } from '../../../src/store/profileStore';
import { getProfileIdentity } from '../../../src/utils/profileIdentity';
import ProfileMeasurementEditor from '../../../src/components/profile/profile-measurement-editor';
import { useAthleteStore } from '../../../src/store/athleteStore';
import { useTrainingPlanStore } from '../../../src/store/trainingPlanStore';
import { useActivityStore } from '../../../src/store/activityStore';
import { useAchievementStore } from '../../../src/store/achievementStore';
import AchievementBadge from '../../../src/components/achievements/AchievementBadge';
import RunLevelProgress from '../../../src/achievements/runLevels/RunLevelProgress';
import { formatPace, formatRaceTime } from '../../../src/utils/calibrationEngine';
import { formatDistance } from '../../../src/lib/units';
import { displayLabel } from '../../../src/utils/displayLabels';
import { buildAchievementHubModel } from '../../../src/utils/achievements';

function metersToDisplay(meters: number, units: 'imperial' | 'metric'): string {
  return formatDistance(meters / 1609.344, units);
}

export default function ProfileScreen() {
  const C = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const withinSettings = usePathname().startsWith('/settings/');
  const { units } = useSettingsStore();
  const { data, updateData } = useOnboardingStore();
  const profile = useActiveProfile();
  const identity = getProfileIdentity(profile);
  const weeklyMileage = useAthleteStore(s => s.weeklyMileage);
  const savedGoalRace = useAthleteStore(s => s.goalRace);
  const trainingMode = useTrainingPlanStore(s => s.trainingMode);
  const goalRace = trainingMode === 'open' ? 'Open training' : savedGoalRace;
  const activities = useActivityStore(s => s.activities);
  const awarded = useAchievementStore(s => s.awarded);
  const hubModel = useMemo(() => buildAchievementHubModel(activities, awarded), [activities, awarded]);
  const activeRunLevel = [...hubModel.strideLevels].reverse().find(item => item.complete) ?? hubModel.strideLevels[0];
  const nextRunLevel = hubModel.strideLevels.find(item => !item.complete);

  const calibration = profile?.calibration ?? null;
  const racePredictions = calibration?.racePredictions?.slice(1, 5) ?? [];
  const methodLabel = displayLabel(calibration?.activeZoneMethod) || 'Estimated';
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

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: C.bg }}
      contentContainerStyle={{ paddingHorizontal: 18, paddingTop: insets.top + 6, paddingBottom: LAYOUT.screenPadBottom }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <LegacyBackControl onBack={() => withinSettings ? router.dismissTo('/(tabs)/settings')
          : router.canGoBack() ? router.back() : router.replace('/(tabs)/settings')} />
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
            accessibilityRole="button"
            accessibilityLabel="Change profile photo"
          >
            {data.profilePhotoUri ? (
              <Image source={{ uri: data.profilePhotoUri }} style={styles.avatarImage} />
            ) : (
              <Text style={{ fontSize: 20, fontWeight: '800', color: C.primary }}>{identity.initials}</Text>
            )}
            <View style={[styles.avatarAdd, { backgroundColor: C.primary }]}>
              <Text style={{ color: C.onPrimary, fontSize: 13, fontWeight: '800' }}>+</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={{ flex: 1, minWidth: 0, minHeight: 60, justifyContent: 'center' }}
            accessibilityRole="button" accessibilityLabel="Edit name and username"
            accessibilityHint="Opens your profile identity and visibility settings"
            onPress={() => router.push((withinSettings ? '/(tabs)/settings/profile-identity' : '/(tabs)/profile/edit-identity') as never)}>
            <Text style={[styles.profileName, { color: C.text }]}>{identity.primaryLabel}</Text>
            {identity.visibleName && identity.visibleUsername ? <Text style={[styles.caption, { color: C.textMuted }]}>{identity.visibleUsername}</Text> : null}
            <Text style={[styles.caption, { color: C.textMuted }]}>
              {Math.round(weeklyMileage)} mi/week · Goal {goalRace || 'general fitness'}
            </Text>
            <Text style={[styles.caption, { color: C.textDim }]}>Edit name &amp; username ›</Text>
          </TouchableOpacity>
        </View>

        {profile ? <ProfileMeasurementEditor key={`${profile.athleteId}:${profile.createdAt}`} profile={profile} units={units} /> : null}
      </View>

      <TouchableOpacity
        style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}
        onPress={() => router.push('/(tabs)/more/achievements' as any)}
        activeOpacity={0.78}
      >
        <View style={styles.cardHeaderRow}>
          <Text style={[styles.sectionLabel, { color: C.textDim }]}>RUN LEVEL</Text>
          <Ionicons name="chevron-forward" size={18} color={C.primary} />
        </View>
        <View style={styles.runLevelRow}>
          <AchievementBadge id={activeRunLevel?.id ?? 'run_level_foundation'} category="run_level" size="medium" unitSystem={units} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.profileName, { color: C.text }]}>{activeRunLevel?.title ?? 'Foundation'}</Text>
            <Text style={[styles.body, { color: C.textMuted }]}>
              {metersToDisplay(activeRunLevel?.cumulativeMeters ?? 0, units)} lifetime running
              {nextRunLevel ? ` · next at ${metersToDisplay(nextRunLevel.thresholdMeters, units)}` : ' · highest level reached'}
            </Text>
            <RunLevelProgress currentMeters={activeRunLevel?.cumulativeMeters ?? 0} units={units} style={{ marginTop: 8 }} />
          </View>
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}
        onPress={() => router.push((withinSettings ? '/(tabs)/settings/profile-calibration' : '/(tabs)/profile/calibration') as never)}
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
        onPress={() => router.push((withinSettings ? '/(tabs)/settings/profile-availability' : '/(tabs)/profile/availability') as never)}
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
        onPress={() => router.push('/(tabs)/activity' as any)}
        activeOpacity={0.78}
      >
        <View style={styles.cardHeaderRow}>
          <Text style={[styles.sectionLabel, { color: C.textDim }]}>TRAINING HISTORY</Text>
          <Ionicons name="chevron-forward" size={18} color={C.primary} />
        </View>
        <Text style={[styles.body, { color: C.textMuted }]}>
          Open Activity to review completed running, walking, cross-training, strength, and mobility history.
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
  runLevelRow: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  sectionLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' },
  metricsRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  metric: { flex: 1, minHeight: 58, borderRadius: 12, backgroundColor: 'rgba(127,127,127,0.12)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  metricValue: { fontSize: 16, fontWeight: '900', textTransform: 'capitalize' },
  metricLabel: { fontSize: 9, fontWeight: '800', color: colors.textDim, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 3 },
  body: { fontSize: 13, lineHeight: 19 },
  warning: { fontSize: 12, fontWeight: '700', marginTop: 10, lineHeight: 18 },
  predRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, paddingVertical: 9, borderBottomWidth: 1 },
  predName: { fontSize: 13, fontWeight: '800' },
  predValue: { fontSize: 12, fontWeight: '800', textAlign: 'right', flex: 1 },
});
