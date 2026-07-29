import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';

import { useColors } from '../../../src/theme/useColors';
import { useThemeStore } from '../../../src/store/themeStore';
import { useSettingsStore, type ExperienceMode } from '../../../src/store/settingsStore';
import { useIntegrationsStore } from '../../../src/store/integrationsStore';
import { useOnboardingStore } from '../../../src/store/onboardingStore';
import { useAuthStore } from '../../../src/store/authStore';
import { useWorkoutStore } from '../../../src/store/workoutStore';
import { useStrengthStore } from '../../../src/store/strengthStore';
import { useProfileStore } from '../../../src/store/profileStore';
import { useAthleteStore } from '../../../src/store/athleteStore';
import { useCustomWorkoutStore } from '../../../src/store/customWorkoutStore';
import { useCheckInStore } from '../../../src/store/checkInStore';
import { useMovementStore } from '../../../src/store/movementStore';
import { useActionPlanStore } from '../../../src/store/actionPlanStore';
import { useReadinessStore } from '../../../src/store/readinessStore';
import { useTrainingPlanStore } from '../../../src/store/trainingPlanStore';
import { parseYMD } from '../../../src/utils/calendarEngine';
import type { TrainingGoalType, Race, RacePriority } from '../../../src/types/plan';
import type { RaceDistance } from '../../../src/types/training';
import { getAppleHealthWriteStatus, isAppleHealthAvailable, requestPermissions as requestHealthPermissions } from '../../../src/lib/healthKit';
import {
  clearTrainingNotifications,
  getNotificationAccessStatus,
  getTrainingNotificationScheduleStatus,
  scheduleTrainingNotifications,
  type TrainingNotificationScheduleStatus,
} from '../../../src/lib/notifications';
import { LAYOUT } from '../../../src/constants/layout';
import PickerWheel from '../../../src/components/ui/PickerWheel';
import { formatYMDForDisplay, parseDisplayDateToYMD } from '../../../src/utils/dateFormatting';
import StrideDateField from '../../../src/components/ui/StrideDateField';
import { todayDateOnly } from '../../../src/utils/dateOnly';
import { testVoiceCoaching } from '../../../src/lib/voiceCoach';

function formatHeight(heightCm: number, imperial: boolean) {
  if (!heightCm) return '';
  if (!imperial) return String(Math.round(heightCm));
  const totalInches = Math.round(heightCm / 2.54);
  const feet = Math.floor(totalInches / 12);
  const inches = totalInches % 12;
  return `${feet}'${inches}`;
}

function parseHeightInput(value: string, imperial: boolean) {
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (!imperial) {
    const cm = Math.round(Number(trimmed));
    return Number.isFinite(cm) ? cm : null;
  }

  const feetInchesMatch = trimmed.match(/^(\d+)\s*(?:'|ft)?\s*(\d{0,2})?\s*(?:"|in)?$/i);
  if (feetInchesMatch) {
    const feet = Number(feetInchesMatch[1]);
    const inches = Number(feetInchesMatch[2] || 0);
    if (Number.isFinite(feet) && Number.isFinite(inches)) {
      return Math.round((feet * 12 + inches) * 2.54);
    }
  }

  const totalInches = Number(trimmed);
  return Number.isFinite(totalInches) ? Math.round(totalInches * 2.54) : null;
}

function formatWeight(weightKg: number, imperial: boolean) {
  if (!weightKg) return '';
  return imperial ? String(Math.round(weightKg * 2.20462)) : String(Math.round(weightKg));
}

function normalizeReminderTime(value: string) {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }

  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

const MINUTES_IN_DAY = Array.from({ length: 24 * 60 }, (_, index) => index);
const REMINDER_DAY_OPTIONS = [
  { value: 2, label: 'M' },
  { value: 3, label: 'T' },
  { value: 4, label: 'W' },
  { value: 5, label: 'T' },
  { value: 6, label: 'F' },
  { value: 7, label: 'S' },
  { value: 1, label: 'S' },
];

function reminderTimeToMinutes(time: string): number {
  const normalized = normalizeReminderTime(time) ?? '07:00';
  const [hour, minute] = normalized.split(':').map(Number);
  return hour * 60 + minute;
}

function minutesToReminderTime(total: number): string {
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function formatReminderTime(total: number): string {
  const hour24 = Math.floor(total / 60);
  const minute = total % 60;
  const suffix = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = hour24 % 12 || 12;
  return `${hour12}:${String(minute).padStart(2, '0')} ${suffix}`;
}

function formatHistoryDate(timestamp: number) {
  if (!timestamp) return 'Recent';
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(timestamp));
}

function isValidPlanDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  return !Number.isNaN(parseYMD(s).getTime());
}

function normalizeDisplayPlanDate(s: string): string | null {
  const parsed = parseDisplayDateToYMD(s);
  if (parsed && isValidPlanDate(parsed)) return parsed;
  if (isValidPlanDate(s)) return s;
  return null;
}

const GOAL_TYPE_OPTIONS: { key: TrainingGoalType; label: string }[] = [
  { key: 'general_running',  label: 'General Running' },
  { key: 'general_strength', label: 'General Strength' },
  { key: 'race_prep',        label: 'Race Prep' },
  { key: 'hybrid',           label: 'Hybrid' },
];

const RACE_DISTANCE_OPTIONS: { key: RaceDistance; label: string }[] = [
  { key: '5k',            label: '5K' },
  { key: '10k',           label: '10K' },
  { key: 'half_marathon', label: 'Half' },
  { key: 'marathon',      label: 'Full' },
];

const RACE_PRIORITY_OPTIONS: { key: RacePriority; label: string }[] = [
  { key: 'A',       label: 'A' },
  { key: 'B',       label: 'B' },
  { key: 'tune_up', label: 'Tune-Up' },
];

type RaceFormState = {
  id:       string | null; // null = adding a new race
  name:     string;
  date:     string;
  distance: RaceDistance;
  priority: RacePriority;
};

const EMPTY_RACE_FORM: RaceFormState = { id: null, name: '', date: todayDateOnly(), distance: 'half_marathon', priority: 'A' };

export default function SettingsScreen() {
  const C = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { mode } = useThemeStore();
  const {
    units,
    setUnits,
    experienceMode,
    setExperienceMode,
    voiceCueMode,
    voiceCuePreferences,
    setVoiceCueMode,
    setVoiceCuePreference,
  } = useSettingsStore();
  const integrations = useIntegrationsStore();
  const legacyMorningReminderEnabled = useReadinessStore(state => state.reminderEnabled);
  const signOut = useAuthStore(state => state.signOut);
  const { data, updateData } = useOnboardingStore();
  const workoutHistory = useWorkoutStore(state => state.history);
  const strengthHistory = useStrengthStore(state => state.history);

  const planGoalType     = useTrainingPlanStore(s => s.goalType);
  const planStartDate    = useTrainingPlanStore(s => s.programStartDate);
  const planRaces        = useTrainingPlanStore(s => s.races);
  const setPlanGoalType  = useTrainingPlanStore(s => s.setGoalType);
  const setPlanStartDate = useTrainingPlanStore(s => s.setProgramStartDate);
  const addPlanRace      = useTrainingPlanStore(s => s.addRace);
  const updatePlanRace   = useTrainingPlanStore(s => s.updateRace);
  const removePlanRace   = useTrainingPlanStore(s => s.removeRace);

  const [startDateDraft, setStartDateDraft] = useState(planStartDate ?? todayDateOnly());
  const [raceForm, setRaceForm] = useState<RaceFormState | null>(null);
  const [raceFormError, setRaceFormError] = useState('');

  const imp = units === 'imperial';
  const [busy, setBusy] = useState<string | null>(null);
  const [notificationSchedule, setNotificationSchedule] = useState<TrainingNotificationScheduleStatus | null>(null);
  const [ageInput, setAgeInput] = useState('');
  const [heightInput, setHeightInput] = useState('');
  const [weightInput, setWeightInput] = useState('');
  const [showNotificationTimePicker, setShowNotificationTimePicker] = useState(false);
  const [voiceTestResult, setVoiceTestResult] = useState<string | null>(null);

  function saveRaceForm() {
    if (!raceForm) return;
    if (!raceForm.name.trim()) { setRaceFormError('Give the race a name.'); return; }
    const normalizedDate = normalizeDisplayPlanDate(raceForm.date);
    if (!normalizedDate) { setRaceFormError('Choose a valid race date.'); return; }

    if (raceForm.id) {
      updatePlanRace(raceForm.id, {
        name: raceForm.name.trim(), date: normalizedDate,
        distance: raceForm.distance, priority: raceForm.priority,
      });
    } else {
      addPlanRace({
        name: raceForm.name.trim(), date: normalizedDate,
        distance: raceForm.distance, priority: raceForm.priority,
      });
    }
    setRaceForm(null);
    setRaceFormError('');
  }

  function renderRaceForm() {
    if (!raceForm) return null;
    return (
      <View style={{ gap: 10, marginTop: 8, padding: 12, borderRadius: 10, backgroundColor: C.cardAlt }}>
        <TextInput
          value={raceForm.name}
          onChangeText={v => setRaceForm(f => f && { ...f, name: v })}
          placeholder="Race name"
          placeholderTextColor={C.textDim}
          style={[styles.profileInput, { backgroundColor: C.card, borderColor: C.border, color: C.text }]}
        />
        <View style={styles.pillRow}>
          {RACE_DISTANCE_OPTIONS.map(d => (
            <TouchableOpacity
              key={d.key}
              style={[styles.pill, { backgroundColor: raceForm.distance === d.key ? C.primaryDim : C.card, borderColor: raceForm.distance === d.key ? C.primary : C.border }]}
              onPress={() => setRaceForm(f => f && { ...f, distance: d.key })}
            >
              <Text style={{ fontSize: 12, fontWeight: '700', color: raceForm.distance === d.key ? C.primary : C.textDim }}>{d.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <StrideDateField
          label="Race Date"
          value={normalizeDisplayPlanDate(raceForm.date) ?? todayDateOnly()}
          onChange={v => setRaceForm(f => f && { ...f, date: v })}
          title="Race Date"
          minDate={todayDateOnly()}
          error={raceFormError && !normalizeDisplayPlanDate(raceForm.date) ? raceFormError : null}
          accessibilityHint="Opens a calendar. Past race dates are disabled."
        />
        <View style={styles.pillRow}>
          {RACE_PRIORITY_OPTIONS.map(p => (
            <TouchableOpacity
              key={p.key}
              style={[styles.pill, { backgroundColor: raceForm.priority === p.key ? C.primaryDim : C.card, borderColor: raceForm.priority === p.key ? C.primary : C.border }]}
              onPress={() => setRaceForm(f => f && { ...f, priority: p.key })}
            >
              <Text style={{ fontSize: 12, fontWeight: '700', color: raceForm.priority === p.key ? C.primary : C.textDim }}>{p.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {raceFormError ? <Text style={{ fontSize: 11, color: C.critical }}>{raceFormError}</Text> : null}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity style={[styles.connectBtn, { backgroundColor: C.cardAlt, flex: 1 }]} onPress={() => { setRaceForm(null); setRaceFormError(''); }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: C.textMuted }}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.connectBtn, { backgroundColor: C.primary, flex: 1 }]} onPress={saveRaceForm}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: C.onPrimary }}>Save</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const currentNotificationPrefs = {
    enabled: integrations.notificationsEnabled,
    time: integrations.notificationTime,
    workout: integrations.workoutNotifications,
    readiness: integrations.readinessNotifications,
    readinessSchedule: integrations.readinessNotificationSchedule,
    readinessDays: integrations.readinessNotificationDays,
  };

  const notificationCaption = notificationSchedule && integrations.notificationsEnabled
    ? notificationSchedule.inSync
      ? `${notificationSchedule.scheduled} daily reminder${notificationSchedule.scheduled === 1 ? '' : 's'} scheduled`
      : 'Saved setting is being synced with iOS'
    : 'Workout reminders & readiness alerts';

  const recentTrainingHistory = useMemo(() => {
    const runs = workoutHistory.map(record => ({
      id: `run-${record.id}`,
      title: record.skipped ? 'Skipped run' : 'Run workout',
      meta: `${formatHistoryDate(record.timestamp)} · ${
        record.actualDurationMinutes ?? record.durationMinutes
      } min${record.actualDistanceMiles ? ` · ${(imp ? record.actualDistanceMiles : record.actualDistanceMiles * 1.609344).toFixed(1)} ${imp ? 'mi' : 'km'}` : ''}`,
      timestamp: record.timestamp,
      skipped: Boolean(record.skipped),
    }));

    const strength = strengthHistory.map(record => ({
      id: `strength-${record.id}`,
      title: record.skipped ? 'Skipped strength' : 'Strength session',
      meta: `${formatHistoryDate(record.timestamp)} · ${record.actualDuration ?? record.plannedDuration} min`,
      timestamp: record.timestamp,
      skipped: Boolean(record.skipped),
    }));

    return [...runs, ...strength]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 5);
  }, [imp, strengthHistory, workoutHistory]);

  useEffect(() => {
    setAgeInput(data.age ? String(data.age) : '');
    setHeightInput(formatHeight(data.heightCm, imp));
    setWeightInput(formatWeight(data.weightKg, imp));
  }, [data.age, data.heightCm, data.weightKg, imp]);

  useEffect(() => {
    if (!integrations.morningReminderMigratedV37) {
      integrations.migrateMorningReminderV37(legacyMorningReminderEnabled);
    }
  }, [integrations, legacyMorningReminderEnabled]);

  useEffect(() => {
    let cancelled = false;

    async function syncPermissionState() {
      if (integrations.locationEnabled) {
        const [foreground, background] = await Promise.all([
          Location.getForegroundPermissionsAsync(),
          Location.getBackgroundPermissionsAsync(),
        ]);
        if (!cancelled && (foreground.status !== 'granted' || background.status !== 'granted')) {
          integrations.setLocation(false);
        }
      }

      if (integrations.notificationsEnabled) {
        const hasNotifications = await getNotificationAccessStatus();
        if (!cancelled && !hasNotifications) {
          integrations.setNotifications(false);
          setNotificationSchedule(null);
          await clearTrainingNotifications().catch(() => undefined);
        } else if (!cancelled) {
          const scheduleStatus = await getTrainingNotificationScheduleStatus(currentNotificationPrefs);
          if (!scheduleStatus.inSync && scheduleStatus.expected > 0) {
            await scheduleTrainingNotifications(currentNotificationPrefs);
            const refreshed = await getTrainingNotificationScheduleStatus(currentNotificationPrefs);
            if (!cancelled) setNotificationSchedule(refreshed);
          } else {
            setNotificationSchedule(scheduleStatus);
          }
        }
      } else {
        const scheduleStatus = await getTrainingNotificationScheduleStatus(currentNotificationPrefs);
        if (scheduleStatus.scheduled > 0) {
          await clearTrainingNotifications().catch(() => undefined);
          const refreshed = await getTrainingNotificationScheduleStatus(currentNotificationPrefs);
          if (!cancelled) setNotificationSchedule(refreshed);
        } else if (!cancelled) {
          setNotificationSchedule(scheduleStatus);
        }
      }

      if (integrations.healthKitEnabled) {
        const canWriteHealth = Platform.OS === 'ios' && await getAppleHealthWriteStatus();
        if (!cancelled && !canWriteHealth) {
          integrations.setHealthKit(false);
        }
      }
    }

    syncPermissionState().catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [
    integrations.healthKitEnabled,
    integrations.locationEnabled,
    integrations.notificationsEnabled,
    integrations.notificationTime,
    integrations.workoutNotifications,
    integrations.readinessNotifications,
    integrations.readinessNotificationSchedule,
    integrations.readinessNotificationDays,
  ]);

  async function chooseProfilePhoto() {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission needed', 'StrideOS needs photo library access to update your profile photo.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });

      if (!result.canceled && result.assets[0]?.uri) {
        updateData({ profilePhotoUri: result.assets[0].uri });
      }
    } catch (error) {
      Alert.alert('Photo update failed', error instanceof Error ? error.message : 'Could not update your profile photo.');
    }
  }

  function commitAge() {
    const nextAge = Math.round(Number(ageInput));
    if (Number.isFinite(nextAge) && nextAge > 0 && nextAge < 120) {
      updateData({ age: nextAge });
      setAgeInput(String(nextAge));
    } else {
      setAgeInput(data.age ? String(data.age) : '');
    }
  }

  function commitHeight() {
    const heightCm = parseHeightInput(heightInput, imp);
    if (heightCm && heightCm > 90 && heightCm < 245) {
      updateData({ heightCm });
      setHeightInput(formatHeight(heightCm, imp));
    } else {
      setHeightInput(formatHeight(data.heightCm, imp));
    }
  }

  function commitWeight() {
    const value = Number(weightInput);
    if (!Number.isFinite(value) || value <= 0) {
      setWeightInput(formatWeight(data.weightKg, imp));
      return;
    }

    const weightKg = imp ? Math.round(value / 2.20462) : Math.round(value);
    if (weightKg > 25 && weightKg < 275) {
      updateData({ weightKg });
      setWeightInput(formatWeight(weightKg, imp));
    } else {
      setWeightInput(formatWeight(data.weightKg, imp));
    }
  }

  async function connectAppleHealth() {
    if (integrations.healthKitEnabled) {
      integrations.setHealthKit(false);
      Alert.alert('Apple Health disconnected', 'StrideOS will stop writing workouts to Apple Health.');
      return;
    }
    if (Platform.OS !== 'ios') {
      Alert.alert('Apple Health unavailable', 'Apple Health is only available on iPhone.');
      return;
    }
    setBusy('health');
    try {
      const available = await isAppleHealthAvailable();
      if (!available) {
        integrations.setHealthKit(false);
        Alert.alert(
          'Apple Health unavailable',
          'Apple Health is not available in this installed build or on this device. Install the newest TestFlight build on iPhone and try again.',
        );
        return;
      }
      const ok = await requestHealthPermissions();
      const canWrite = ok && await getAppleHealthWriteStatus();
      integrations.setHealthKit(canWrite);
      Alert.alert(canWrite ? 'Apple Health connected' : 'Apple Health unavailable', canWrite
        ? 'StrideOS can now read heart rate during runs and write completed workouts to Apple Health.'
        : 'Apple Health write permission was not granted. Enable workout write access in Apple Health settings.');
    } catch (error) {
      Alert.alert('Apple Health connection failed', error instanceof Error ? error.message : 'Could not connect Apple Health.');
    } finally {
      setBusy(null);
    }
  }

  async function setLocationEnabled(enabled: boolean) {
    if (!enabled) {
      integrations.setLocation(false);
      return;
    }
    const result = await Location.requestForegroundPermissionsAsync();
    if (result.status !== 'granted') {
      integrations.setLocation(false);
      Alert.alert('Location permission denied', 'Enable location in iOS Settings to use GPS run tracking.');
      return;
    }

    const background = await Location.requestBackgroundPermissionsAsync();
    const ok = background.status === 'granted';
    integrations.setLocation(ok);
    Alert.alert(
      ok ? 'GPS tracking ready' : 'Background location needed',
      ok
        ? 'StrideOS can track routes during runs, including when the screen locks.'
        : 'Foreground location is on, but background permission is needed for reliable GPS tracking when the screen locks.',
    );
  }

  async function applyNotifications(next = {
    enabled: integrations.notificationsEnabled,
    time: integrations.notificationTime,
    workout: integrations.workoutNotifications,
    readiness: integrations.readinessNotifications,
    readinessSchedule: integrations.readinessNotificationSchedule,
    readinessDays: integrations.readinessNotificationDays,
  }) {
    setBusy('notifications');
    try {
      if (next.enabled) {
        await scheduleTrainingNotifications(next);
      } else {
        await clearTrainingNotifications();
      }
      setNotificationSchedule(await getTrainingNotificationScheduleStatus(next));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not update notifications.';
      const denied = message.toLowerCase().includes('permission');
      Alert.alert(
        'Notification setup failed',
        denied ? `${message} You can restore access in iOS Settings.` : message,
        denied
          ? [
            { text: 'Not Now', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ]
          : [{ text: 'OK' }],
      );
      integrations.setNotifications(false);
      await clearTrainingNotifications().catch(() => undefined);
      setNotificationSchedule(null);
    } finally {
      setBusy(null);
    }
  }

  function updateNotificationEnabled(enabled: boolean) {
    integrations.setNotifications(enabled);
    applyNotifications({
      enabled,
      time: integrations.notificationTime,
      workout: integrations.workoutNotifications,
      readiness: integrations.readinessNotifications,
      readinessSchedule: integrations.readinessNotificationSchedule,
      readinessDays: integrations.readinessNotificationDays,
    });
  }

  function updateWorkoutNotifications(enabled: boolean) {
    integrations.setWorkoutNotifications(enabled);
    applyNotifications({
      enabled: integrations.notificationsEnabled,
      time: integrations.notificationTime,
      workout: enabled,
      readiness: integrations.readinessNotifications,
      readinessSchedule: integrations.readinessNotificationSchedule,
      readinessDays: integrations.readinessNotificationDays,
    });
  }

  function updateReadinessNotifications(enabled: boolean) {
    integrations.setReadinessNotifications(enabled);
    applyNotifications({
      enabled: integrations.notificationsEnabled,
      time: integrations.notificationTime,
      workout: integrations.workoutNotifications,
      readiness: enabled,
      readinessSchedule: integrations.readinessNotificationSchedule,
      readinessDays: integrations.readinessNotificationDays,
    });
  }

  function updateReadinessSchedule(schedule: 'daily' | 'weekdays' | 'custom') {
    integrations.setReadinessNotificationSchedule(schedule);
    applyNotifications({
      ...currentNotificationPrefs,
      readinessSchedule: schedule,
      readinessDays: integrations.readinessNotificationDays,
    });
  }

  function toggleReadinessDay(day: number) {
    const current = integrations.readinessNotificationDays;
    const next = current.includes(day) ? current.filter(value => value !== day) : [...current, day];
    if (next.length === 0) {
      Alert.alert('Choose at least one day', 'A custom reminder schedule needs at least one selected day.');
      return;
    }
    integrations.setReadinessNotificationDays(next);
    applyNotifications({ ...currentNotificationPrefs, readinessSchedule: 'custom', readinessDays: next });
  }

  function resetPlanData() {
    useWorkoutStore.setState({ completedWorkouts: [], history: [] });
    useStrengthStore.setState({ completedSessions: [], history: [] });
    useCustomWorkoutStore.setState({ logs: [], overrides: [] });
    useCheckInStore.setState({ todayCheckIn: null, postWorkoutNotes: [] });
    useMovementStore.setState({ videos: [], sessions: [] });
    useActionPlanStore.setState({ completedActionIds: [], dismissedActionIds: [] });
    useProfileStore.setState({ profiles: {}, activeAthleteId: 'athlete_default' });
    useAthleteStore.setState({
      athleteName: 'Athlete',
      goalRace: 'General Fitness',
      sleepHours: 7.5,
      restingHRDelta: 0,
      weeklyMileage: 20,
      fatigueScore: 30,
      recoveryScore: 70,
      vo2Estimate: 38,
      recentEasyLoad: 0,
      lastFatigueUpdate: Date.now(),
      currentWeek: 1,
      trainingPhase: 'base',
      progressionLevel: 'beginner',
    });
    useOnboardingStore.getState().resetOnboarding();
    router.replace('/onboarding');
  }

  function SegmentControl({
    options,
    value,
    onChange,
    activeTone = 'muted',
  }: {
    options: { label: string; value: string }[];
    value: string;
    onChange: (v: string) => void;
    activeTone?: 'muted' | 'primary';
  }) {
    return (
      <View style={[styles.segCtrl, { backgroundColor: C.cardAlt }]}>
        {options.map(opt => {
          const active = value === opt.value;
          const activeBg = activeTone === 'primary' ? C.primaryDim : C.card;
          const activeColor = activeTone === 'primary' ? C.primary : C.textDim;
          return (
            <TouchableOpacity
              key={opt.value}
              style={[styles.segOption, active && { backgroundColor: activeBg }]}
              onPress={() => onChange(opt.value)}
              activeOpacity={0.7}
            >
              <Text style={[styles.segText, { color: active ? activeColor : C.textDim, fontWeight: active ? '700' : '500' }]}>{opt.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: C.bg }}
      contentContainerStyle={{ paddingHorizontal: 18, paddingTop: insets.top + 6, paddingBottom: LAYOUT.screenPadBottom }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={20} color={C.primary} />
        </TouchableOpacity>
        <View style={{ marginLeft: 10 }}>
          <Text style={[styles.headerLabel, { color: C.textDim }]}>SETTINGS</Text>
          <Text style={[styles.headerTitle, { color: C.text }]}>Settings</Text>
        </View>
      </View>

      {/* User card */}
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
              <Text style={[{ fontSize: 20, fontWeight: '800', color: C.primary }]}>
                {(data.name || 'A').slice(0, 2).toUpperCase()}
              </Text>
            )}
            <View style={[styles.avatarAdd, { backgroundColor: C.primary }]}>
              <Text style={[{ color: C.onPrimary, fontSize: 13, fontWeight: '800' }]}>+</Text>
            </View>
          </TouchableOpacity>
          <View>
            <Text style={[{ fontSize: 16, fontWeight: '700', color: C.text }]}>{data.name || 'Athlete'}</Text>
            <Text style={[{ fontSize: 12, color: C.textMuted, marginTop: 2 }]}>
              Running since {new Date().getFullYear() - 5} · {imp ? '2,814 mi' : '4,529 km'}
            </Text>
            <Text style={[{ fontSize: 11, color: C.textDim, marginTop: 2 }]}>Tap photo to change</Text>
          </View>
        </View>
        <View style={{ gap: 10, marginTop: 4 }}>
          {[
            {
              label: 'Age',
              value: ageInput,
              onChangeText: setAgeInput,
              onBlur: commitAge,
              placeholder: '—',
              keyboardType: 'number-pad' as const,
              unit: 'yrs',
            },
            {
              label: 'Height',
              value: heightInput,
              onChangeText: setHeightInput,
              onBlur: commitHeight,
              placeholder: imp ? `5'10` : '178',
              keyboardType: 'default' as const,
              unit: imp ? 'ft/in' : 'cm',
            },
            {
              label: 'Weight',
              value: weightInput,
              onChangeText: setWeightInput,
              onBlur: commitWeight,
              placeholder: '—',
              keyboardType: 'number-pad' as const,
              unit: imp ? 'lbs' : 'kg',
            },
          ].map(f => (
            <View key={f.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Text style={[{ fontSize: 12, color: C.textMuted, width: 64 }]}>{f.label}</Text>
              <TextInput
                value={f.value}
                onChangeText={f.onChangeText}
                onBlur={f.onBlur}
                onSubmitEditing={f.onBlur}
                placeholder={f.placeholder}
                placeholderTextColor={C.textDim}
                keyboardType={f.keyboardType}
                style={[styles.profileInput, { backgroundColor: C.cardAlt, borderColor: C.border, color: C.text }]}
              />
              {f.unit ? <Text style={[{ fontSize: 12, color: C.textDim }]}>{f.unit}</Text> : null}
            </View>
          ))}
        </View>
      </View>

      {/* Appearance */}
      <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
        <Text style={[styles.sectionLabel, { color: C.textDim }]}>APPEARANCE</Text>
        <View style={[styles.settingRow, { borderBottomColor: C.border }]}>
          <View style={styles.settingCopy}>
            <Text style={[styles.settingTitle, { color: C.text }]}>Theme</Text>
            <Text style={[styles.settingCaption, { color: C.textMuted }]}>Changes the entire app</Text>
          </View>
          <SegmentControl
            options={[{ label: 'Dark', value: 'dark' }, { label: 'Light', value: 'light' }]}
            value={mode}
            onChange={v => useThemeStore.getState().setMode(v as any)}
          />
        </View>
        <View style={[styles.settingRow, { borderBottomColor: C.border }]}>
          <View style={styles.settingCopy}>
            <Text style={[styles.settingTitle, { color: C.text }]}>Units</Text>
            <Text style={[styles.settingCaption, { color: C.textMuted }]}>Updates distances & weights everywhere</Text>
          </View>
          <SegmentControl
            options={[{ label: 'mi/lb', value: 'imperial' }, { label: 'km/kg', value: 'metric' }]}
            value={units}
            onChange={v => setUnits(v as any)}
            activeTone="primary"
          />
        </View>
        <View style={[styles.settingRow, { flexDirection: 'column', alignItems: 'stretch', gap: 10 }]}>
          <View style={styles.settingCopy}>
            <Text style={[styles.settingTitle, { color: C.text }]}>Experience Mode</Text>
            <Text style={[styles.settingCaption, { color: C.textMuted }]}>Controls how much detail StrideOS shows by default. Data is not removed.</Text>
          </View>
          <SegmentControl
            options={[
              { label: 'Simple', value: 'simple' },
              { label: 'Balanced', value: 'balanced' },
              { label: 'Data-rich', value: 'data_rich' },
            ]}
            value={experienceMode}
            onChange={v => setExperienceMode(v as ExperienceMode)}
            activeTone="primary"
          />
        </View>
      </View>

      {/* Voice coaching */}
      <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
        <Text style={[styles.sectionLabel, { color: C.textDim }]}>VOICE COACHING</Text>
        <Text style={[styles.settingCaption, { color: C.textMuted, marginBottom: 10 }]}>
          Choose how often StrideOS speaks. The test button runs through the same delivery pipeline used during workouts.
        </Text>
        <SegmentControl
          options={[
            { label: 'Silent', value: 'silent' },
            { label: 'Minimal', value: 'minimal' },
            { label: 'Standard', value: 'standard' },
            { label: 'Coach', value: 'coach' },
          ]}
          value={voiceCueMode}
          onChange={value => setVoiceCueMode(value as typeof voiceCueMode)}
          activeTone="primary"
        />
        <View style={{ marginTop: 10 }}>
          {([
            ['interval', 'Interval changes'],
            ['pace', 'Pace alerts'],
            ['heartRate', 'Heart-rate alerts'],
            ['runWalk', 'Run/walk changes'],
            ['motivation', 'Motivation'],
            ['technique', 'Technique cues'],
            ['fueling', 'Fueling reminders'],
            ['hydration', 'Hydration reminders'],
            ['navigation', 'Route navigation'],
          ] as const).map(([key, label]) => (
            <View key={key} style={[styles.settingRow, { borderBottomColor: C.border }]}>
              <Text style={[styles.settingTitle, { color: C.text }]}>{label}</Text>
              <Switch
                value={voiceCuePreferences[key]}
                onValueChange={enabled => setVoiceCuePreference(key, enabled)}
                disabled={voiceCueMode === 'silent'}
                trackColor={{ false: C.border, true: C.primaryDim }}
                thumbColor={voiceCuePreferences[key] && voiceCueMode !== 'silent' ? C.primary : C.textDim}
              />
            </View>
          ))}
        </View>
        <TouchableOpacity
          style={[styles.testVoiceButton, { borderColor: C.primary, backgroundColor: C.primaryDim }]}
          activeOpacity={0.75}
          onPress={() => {
            const state = testVoiceCoaching();
            setVoiceTestResult(
              state === 'unavailable'
                ? 'Voice delivery is unavailable in this environment. Test on device before release.'
                : `Voice test ${state}.`,
            );
          }}
        >
          <Ionicons name="volume-high-outline" size={17} color={C.primary} />
          <Text style={[styles.testVoiceText, { color: C.primary }]}>Test Voice Coaching</Text>
        </TouchableOpacity>
        {voiceTestResult ? (
          <Text style={[styles.settingCaption, { color: C.textMuted, marginTop: 8 }]}>{voiceTestResult}</Text>
        ) : null}
      </View>

      {/* Training Definitions */}
      <TouchableOpacity
        style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}
        activeOpacity={0.75}
        onPress={() => router.push('/(tabs)/settings/training-definitions' as any)}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={[{ width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: C.primaryDim }]}>
            <Ionicons name="book-outline" size={18} color={C.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.settingTitle, { color: C.text }]}>Training Definitions</Text>
            <Text style={[styles.settingCaption, { color: C.textMuted }]}>What terms like "Strides" or "Zone 2" mean and how to do them</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={C.textMuted} />
        </View>
      </TouchableOpacity>

      {/* Training Plan */}
      <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
        <Text style={[styles.sectionLabel, { color: C.textDim }]}>TRAINING PLAN</Text>

        <View style={[styles.settingRow, { borderBottomColor: C.border, flexDirection: 'column', alignItems: 'stretch', gap: 8 }]}>
          <Text style={[styles.settingTitle, { color: C.text }]}>Goal</Text>
          <View style={styles.pillRow}>
            {GOAL_TYPE_OPTIONS.map(g => (
              <TouchableOpacity
                key={g.key}
                style={[styles.pill, { backgroundColor: planGoalType === g.key ? C.primaryDim : C.cardAlt, borderColor: planGoalType === g.key ? C.primary : C.border }]}
                onPress={() => setPlanGoalType(g.key)}
                activeOpacity={0.75}
              >
                <Text style={{ fontSize: 12, fontWeight: '700', color: planGoalType === g.key ? C.primary : C.textDim }}>{g.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={[styles.settingCaption, { color: C.textMuted }]}>Changing your goal reshapes the plan immediately — no regeneration needed.</Text>
        </View>

        <View style={[styles.settingRow, { borderBottomColor: C.border, flexDirection: 'column', alignItems: 'stretch', gap: 8 }]}>
          <Text style={[styles.settingTitle, { color: C.text }]}>Program Start Date</Text>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <StrideDateField
                label="Program Start Date"
                value={normalizeDisplayPlanDate(startDateDraft) ?? todayDateOnly()}
                onChange={setStartDateDraft}
                title="Program Start Date"
                helper="Supported training-engine dates are saved exactly as selected."
              />
            </View>
            {(() => {
              const normalizedStartDate = normalizeDisplayPlanDate(startDateDraft);
              return normalizedStartDate && normalizedStartDate !== (planStartDate ?? '') ? (
              <TouchableOpacity style={[styles.connectBtn, { backgroundColor: C.primary }]} onPress={() => setPlanStartDate(normalizedStartDate)} activeOpacity={0.8}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: C.onPrimary }}>Save</Text>
              </TouchableOpacity>
              ) : null;
            })()}
          </View>
          {startDateDraft && !normalizeDisplayPlanDate(startDateDraft) ? (
            <Text style={{ fontSize: 11, color: C.critical }}>Choose a valid program start date.</Text>
          ) : null}
        </View>

        <View style={{ paddingTop: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Text style={[styles.settingTitle, { color: C.text }]}>Races</Text>
            <TouchableOpacity onPress={() => { setRaceForm(raceForm ? null : { ...EMPTY_RACE_FORM, date: todayDateOnly() }); setRaceFormError(''); }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: C.primary }}>{raceForm ? 'Cancel' : '+ Add Race'}</Text>
            </TouchableOpacity>
          </View>

          {planRaces.length === 0 && !raceForm && (
            <Text style={[styles.settingCaption, { color: C.textMuted }]}>No races on your calendar yet.</Text>
          )}

          {planRaces.map((race: Race) => (
            raceForm?.id === race.id ? (
              <View key={race.id}>{renderRaceForm()}</View>
            ) : (
              <View key={race.id} style={[styles.settingRow, { borderBottomColor: C.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.settingTitle, { color: C.text }]}>{race.name}</Text>
                  <Text style={[styles.settingCaption, { color: C.textMuted }]}>
                    {RACE_DISTANCE_OPTIONS.find(d => d.key === race.distance)?.label ?? race.distance} · {formatYMDForDisplay(race.date)} · Priority {race.priority === 'tune_up' ? 'Tune-Up' : race.priority}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => { setRaceForm({ id: race.id, name: race.name, date: race.date, distance: race.distance, priority: race.priority }); setRaceFormError(''); }} style={{ padding: 6 }}>
                  <Ionicons name="pencil-outline" size={16} color={C.textMuted} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => removePlanRace(race.id)} style={{ padding: 6 }}>
                  <Ionicons name="trash-outline" size={16} color={C.critical} />
                </TouchableOpacity>
              </View>
            )
          ))}

          {raceForm && raceForm.id === null && renderRaceForm()}
        </View>
      </View>

      {/* Training history */}
      <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
        <TouchableOpacity
          style={styles.historyHeader}
          activeOpacity={0.75}
          onPress={() => router.push('/(tabs)/activity' as any)}
        >
          <Text style={[styles.sectionLabel, { color: C.textDim, marginBottom: 0 }]}>TRAINING HISTORY</Text>
          <View style={styles.historyHeaderLink}>
            <Text style={[styles.historyHeaderText, { color: C.primary }]}>Activity</Text>
            <Ionicons name="chevron-forward" size={16} color={C.primary} />
          </View>
        </TouchableOpacity>
        {recentTrainingHistory.length > 0 ? (
          recentTrainingHistory.map((item, index) => (
            <TouchableOpacity
              key={item.id}
              style={[
                styles.historyRow,
                index < recentTrainingHistory.length - 1 && { borderBottomColor: C.border, borderBottomWidth: 1 },
              ]}
              activeOpacity={0.75}
              onPress={() => router.push('/(tabs)/activity' as any)}
            >
              <View style={[styles.historyIcon, { backgroundColor: item.skipped ? C.cardAlt : C.primaryDim }]}>
                <Ionicons name={item.skipped ? 'remove-circle-outline' : 'checkmark-circle-outline'} size={18} color={item.skipped ? C.textMuted : C.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.settingTitle, { color: C.text }]}>{item.title}</Text>
                <Text style={[styles.settingCaption, { color: C.textMuted }]}>{item.meta}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={C.textMuted} />
            </TouchableOpacity>
          ))
        ) : (
          <Text style={[styles.settingCaption, { color: C.textMuted }]}>
            Completed runs and strength sessions will show up here after you log them.
          </Text>
        )}
      </View>

      {/* Integrations */}
      <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
        <Text style={[styles.sectionLabel, { color: C.textDim }]}>HEALTH DATA SYNC</Text>
        <View style={styles.settingRow}>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingRight: 12 }}>
            <View style={[{ width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: C.criticalDim }]}>
              <Text style={[{ fontSize: 17 }]}>♥</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.settingTitle, { color: C.text }]}>Apple Health</Text>
              <Text style={[styles.settingCaption, { color: C.textMuted }]}>Heart rate during runs, sleep, HRV, and workout saving</Text>
            </View>
          </View>
          <TouchableOpacity
            style={[styles.connectBtn, integrations.healthKitEnabled ? { backgroundColor: C.cardAlt } : { backgroundColor: C.critical }, busy === 'health' && { opacity: 0.6 }]}
            onPress={connectAppleHealth}
            disabled={busy === 'health'}
            activeOpacity={0.8}
          >
            <Text style={[{ fontSize: 12, fontWeight: '700', color: integrations.healthKitEnabled ? C.positive : C.onPrimary }]}>
              {busy === 'health' ? 'Connecting...' : integrations.healthKitEnabled ? '✓ Connected' : 'Connect'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Location */}
      <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
        <Text style={[styles.sectionLabel, { color: C.textDim }]}>LOCATION</Text>
        <View style={styles.settingRow}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={[styles.settingTitle, { color: C.text }]}>GPS Run Tracking</Text>
            <Text style={[styles.settingCaption, { color: C.textMuted }]}>Track your route and pace on a live map during runs</Text>
          </View>
          <Switch
            value={integrations.locationEnabled}
            onValueChange={setLocationEnabled}
            trackColor={{ false: C.cardAlt, true: C.primary }}
            thumbColor={C.card}
          />
        </View>
      </View>

      {/* Notifications */}
      <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
        <Text style={[styles.sectionLabel, { color: C.textDim }]}>NOTIFICATIONS</Text>
        <View style={[styles.settingRow, { borderBottomColor: C.border }]}>
          <View>
            <Text style={[styles.settingTitle, { color: C.text }]}>Enable Notifications</Text>
            <Text style={[styles.settingCaption, { color: notificationSchedule?.inSync === false && integrations.notificationsEnabled ? C.warning : C.textMuted }]}>
              {notificationCaption}
            </Text>
          </View>
          <Switch
            value={integrations.notificationsEnabled}
            onValueChange={updateNotificationEnabled}
            trackColor={{ false: C.cardAlt, true: C.primary }}
            thumbColor={C.card}
          />
        </View>
        {integrations.notificationsEnabled && (
          <>
            <View style={[styles.settingRow, { borderBottomColor: C.border }]}>
              <View>
                <Text style={[styles.settingTitle, { color: C.text }]}>Morning Readiness Reminder</Text>
                <Text style={[styles.settingCaption, { color: C.textMuted }]}>
                  Local time · {formatReminderTime(reminderTimeToMinutes(integrations.notificationTime))}
                </Text>
              </View>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={`Change morning readiness reminder time, currently ${formatReminderTime(reminderTimeToMinutes(integrations.notificationTime))}`}
                onPress={() => setShowNotificationTimePicker(true)}
                style={[styles.timeButton, { backgroundColor: C.cardAlt, borderColor: C.border }]}
              >
                <Text style={[styles.settingTitle, { color: C.primary }]}>Change</Text>
              </TouchableOpacity>
            </View>
            <View style={[styles.settingRow, { borderBottomColor: C.border }]}>
              <Text style={[styles.settingTitle, { color: C.text }]}>Workout reminders</Text>
              <Switch
                value={integrations.workoutNotifications}
                onValueChange={updateWorkoutNotifications}
                trackColor={{ false: C.cardAlt, true: C.primary }}
                thumbColor={C.card}
              />
            </View>
            <View style={styles.settingRow}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={[styles.settingTitle, { color: C.text }]}>Morning readiness check-in</Text>
                <Text style={[styles.settingCaption, { color: C.textMuted }]}>Enable or disable the morning prompt</Text>
              </View>
              <Switch
                value={integrations.readinessNotifications}
                onValueChange={updateReadinessNotifications}
                trackColor={{ false: C.cardAlt, true: C.primary }}
                thumbColor={C.card}
              />
            </View>
            {integrations.readinessNotifications ? (
              <View style={{ paddingTop: 12 }}>
                <Text style={[styles.settingCaption, { color: C.textMuted, marginBottom: 8 }]}>Schedule</Text>
                <View style={styles.pillRow}>
                  {([
                    { value: 'daily', label: 'Daily' },
                    { value: 'weekdays', label: 'Weekdays' },
                    { value: 'custom', label: 'Custom days' },
                  ] as const).map(option => {
                    const active = integrations.readinessNotificationSchedule === option.value;
                    return (
                      <TouchableOpacity
                        key={option.value}
                        style={[styles.pill, { backgroundColor: active ? C.primaryDim : C.cardAlt, borderColor: active ? C.primary : C.border }]}
                        onPress={() => updateReadinessSchedule(option.value)}
                      >
                        <Text style={{ fontSize: 12, fontWeight: '800', color: active ? C.primary : C.textMuted }}>{option.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {integrations.readinessNotificationSchedule === 'custom' ? (
                  <View style={styles.dayRow}>
                    {REMINDER_DAY_OPTIONS.map((day, index) => {
                      const active = integrations.readinessNotificationDays.includes(day.value);
                      return (
                        <TouchableOpacity
                          key={`${day.value}-${index}`}
                          accessibilityRole="button"
                          accessibilityState={{ selected: active }}
                          style={[styles.dayButton, { backgroundColor: active ? C.primary : C.cardAlt, borderColor: active ? C.primary : C.border }]}
                          onPress={() => toggleReadinessDay(day.value)}
                        >
                          <Text style={{ fontSize: 12, fontWeight: '900', color: active ? C.onPrimary : C.textMuted }}>{day.label}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ) : null}
                <Text style={[styles.settingCaption, { color: C.textMuted, marginTop: 10 }]}>
                  Notifications use device-local time. Changing the time or days cancels the old schedule before creating the new one, preventing duplicates.
                </Text>
              </View>
            ) : null}
          </>
        )}
      </View>

      {/* Danger zone */}
      <TouchableOpacity
        style={[styles.dangerBtn, { borderColor: C.warning, marginBottom: 10 }]}
        onPress={() =>
          Alert.alert(
            'Reset Plan',
            'This clears your plan, profile calibration, activity history, movement analysis, and onboarding answers so you can rebuild StrideOS from the start. You will stay signed in.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Reset Plan', style: 'destructive', onPress: resetPlanData },
            ],
          )
        }
        activeOpacity={0.8}
      >
        <Text style={{ fontSize: 14, fontWeight: '700', color: C.warning }}>Reset Plan</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.dangerBtn, { borderColor: C.critical }]}
        onPress={() =>
          Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Sign Out', style: 'destructive',
              onPress: async () => {
                integrations.setHealthKit(false);
                integrations.setLocation(false);
                integrations.setNotifications(false);
                await clearTrainingNotifications().catch(() => undefined);
                await signOut();
                router.replace('/auth/sign-in');
              },
            },
          ])
        }
        activeOpacity={0.8}
      >
        <Text style={[{ fontSize: 14, fontWeight: '700', color: C.critical }]}>Sign Out</Text>
      </TouchableOpacity>
      <PickerWheel
        visible={showNotificationTimePicker}
        title="Morning reminder time"
        values={MINUTES_IN_DAY}
        selectedValue={reminderTimeToMinutes(integrations.notificationTime)}
        formatValue={formatReminderTime}
        onClose={() => setShowNotificationTimePicker(false)}
        onConfirm={value => {
          const time = minutesToReminderTime(value);
          integrations.setNotificationTime(time);
          setShowNotificationTimePicker(false);
          applyNotifications({ ...currentNotificationPrefs, time });
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  headerLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '700',
    fontFamily: 'CormorantGaramond_700Bold',
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 10,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 14,
    marginBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'transparent',
  },
  settingCopy: {
    flex: 1,
    minWidth: 0,
    paddingRight: 8,
  },
  settingTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
  },
  historyHeaderLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  historyHeaderText: {
    fontSize: 12,
    fontWeight: '800',
  },
  historyIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingCaption: {
    fontSize: 11,
    marginTop: 2,
  },
  timeButton: {
    minHeight: 40,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
    marginTop: 10,
  },
  dayButton: {
    width: 38,
    height: 38,
    borderWidth: 1,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    padding: 8,
    paddingHorizontal: 10,
    fontSize: 13,
  },
  segCtrl: {
    flexDirection: 'row',
    borderRadius: 10,
    padding: 4,
    gap: 4,
    flexShrink: 0,
  },
  segOption: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  segText: {
    fontSize: 13,
  },
  connectBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  testVoiceButton: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  testVoiceText: {
    fontSize: 13,
    fontWeight: '800',
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 14,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
    position: 'relative',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 30,
  },
  avatarAdd: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerBtn: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
});
