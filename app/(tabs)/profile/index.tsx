import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
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
import { useSettingsStore } from '../../../src/store/settingsStore';
import { useIntegrationsStore } from '../../../src/store/integrationsStore';
import { useOnboardingStore } from '../../../src/store/onboardingStore';
import { useAuthStore } from '../../../src/store/authStore';
import { useWorkoutStore } from '../../../src/store/workoutStore';
import { useStrengthStore } from '../../../src/store/strengthStore';
import { getAppleHealthWriteStatus, isAppleHealthAvailable, requestPermissions as requestHealthPermissions } from '../../../src/lib/healthKit';
import {
  clearTrainingNotifications,
  getNotificationAccessStatus,
  getTrainingNotificationScheduleStatus,
  scheduleTrainingNotifications,
  type TrainingNotificationScheduleStatus,
} from '../../../src/lib/notifications';
import { LAYOUT } from '../../../src/constants/layout';

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

function formatHistoryDate(timestamp: number) {
  if (!timestamp) return 'Recent';
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(timestamp));
}

export default function ProfileScreen() {
  const C = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { mode } = useThemeStore();
  const { units, setUnits } = useSettingsStore();
  const integrations = useIntegrationsStore();
  const signOut = useAuthStore(state => state.signOut);
  const { data, updateData } = useOnboardingStore();
  const workoutHistory = useWorkoutStore(state => state.history);
  const strengthHistory = useStrengthStore(state => state.history);

  const imp = units === 'imperial';
  const [busy, setBusy] = useState<string | null>(null);
  const [notificationSchedule, setNotificationSchedule] = useState<TrainingNotificationScheduleStatus | null>(null);
  const [ageInput, setAgeInput] = useState('');
  const [heightInput, setHeightInput] = useState('');
  const [weightInput, setWeightInput] = useState('');
  const [notificationTimeDraft, setNotificationTimeDraft] = useState(integrations.notificationTime);

  const currentNotificationPrefs = {
    enabled: integrations.notificationsEnabled,
    time: integrations.notificationTime,
    workout: integrations.workoutNotifications,
    readiness: integrations.readinessNotifications,
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
    setNotificationTimeDraft(integrations.notificationTime);
  }, [integrations.notificationTime]);

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
      Alert.alert('Notification setup failed', error instanceof Error ? error.message : 'Could not update notifications.');
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
    });
  }

  function updateWorkoutNotifications(enabled: boolean) {
    integrations.setWorkoutNotifications(enabled);
    applyNotifications({
      enabled: integrations.notificationsEnabled,
      time: integrations.notificationTime,
      workout: enabled,
      readiness: integrations.readinessNotifications,
    });
  }

  function updateReadinessNotifications(enabled: boolean) {
    integrations.setReadinessNotifications(enabled);
    applyNotifications({
      enabled: integrations.notificationsEnabled,
      time: integrations.notificationTime,
      workout: integrations.workoutNotifications,
      readiness: enabled,
    });
  }

  function commitNotificationTime() {
    const normalized = normalizeReminderTime(notificationTimeDraft);
    if (!normalized) {
      setNotificationTimeDraft(integrations.notificationTime);
      Alert.alert('Use a valid time', 'Enter reminder time as HH:MM, like 07:00 or 18:30.');
      return;
    }

    integrations.setNotificationTime(normalized);
    setNotificationTimeDraft(normalized);
    applyNotifications({
      enabled: integrations.notificationsEnabled,
      time: normalized,
      workout: integrations.workoutNotifications,
      readiness: integrations.readinessNotifications,
    });
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
          <Text style={[styles.headerLabel, { color: C.textDim }]}>PROFILE</Text>
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
        <View style={styles.settingRow}>
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
      </View>

      {/* Training history */}
      <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
        <Text style={[styles.sectionLabel, { color: C.textDim }]}>TRAINING HISTORY</Text>
        {recentTrainingHistory.length > 0 ? (
          recentTrainingHistory.map((item, index) => (
            <View
              key={item.id}
              style={[
                styles.historyRow,
                index < recentTrainingHistory.length - 1 && { borderBottomColor: C.border, borderBottomWidth: 1 },
              ]}
            >
              <View style={[styles.historyIcon, { backgroundColor: item.skipped ? C.cardAlt : C.primaryDim }]}>
                <Ionicons name={item.skipped ? 'remove-circle-outline' : 'checkmark-circle-outline'} size={18} color={item.skipped ? C.textMuted : C.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.settingTitle, { color: C.text }]}>{item.title}</Text>
                <Text style={[styles.settingCaption, { color: C.textMuted }]}>{item.meta}</Text>
              </View>
            </View>
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
            <View style={[{ width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ff3b30' }]}>
              <Text style={[{ fontSize: 17 }]}>♥</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.settingTitle, { color: C.text }]}>Apple Health</Text>
              <Text style={[styles.settingCaption, { color: C.textMuted }]}>Heart rate during runs, sleep, HRV, and workout saving</Text>
            </View>
          </View>
          <TouchableOpacity
            style={[styles.connectBtn, integrations.healthKitEnabled ? { backgroundColor: C.cardAlt } : { backgroundColor: '#ff3b30' }, busy === 'health' && { opacity: 0.6 }]}
            onPress={connectAppleHealth}
            disabled={busy === 'health'}
            activeOpacity={0.8}
          >
            <Text style={[{ fontSize: 12, fontWeight: '700', color: integrations.healthKitEnabled ? C.positive : '#fff' }]}>
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
            thumbColor="#fff"
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
            thumbColor="#fff"
          />
        </View>
        {integrations.notificationsEnabled && (
          <>
            <View style={[styles.settingRow, { borderBottomColor: C.border }]}>
              <View>
                <Text style={[styles.settingTitle, { color: C.text }]}>Daily reminder time</Text>
                <Text style={[styles.settingCaption, { color: C.textMuted }]}>Morning prompt to log readiness</Text>
              </View>
              <TextInput
                value={notificationTimeDraft}
                onChangeText={setNotificationTimeDraft}
                onBlur={commitNotificationTime}
                onSubmitEditing={commitNotificationTime}
                style={[{ backgroundColor: C.cardAlt, borderWidth: 1, borderColor: C.border, borderRadius: 8, padding: 6, paddingHorizontal: 10, fontSize: 13, color: C.text }]}
              />
            </View>
            <View style={[styles.settingRow, { borderBottomColor: C.border }]}>
              <Text style={[styles.settingTitle, { color: C.text }]}>Workout reminders</Text>
              <Switch
                value={integrations.workoutNotifications}
                onValueChange={updateWorkoutNotifications}
                trackColor={{ false: C.cardAlt, true: C.primary }}
                thumbColor="#fff"
              />
            </View>
            <View style={styles.settingRow}>
              <Text style={[styles.settingTitle, { color: C.text }]}>Readiness check-in</Text>
              <Switch
                value={integrations.readinessNotifications}
                onValueChange={updateReadinessNotifications}
                trackColor={{ false: C.cardAlt, true: C.primary }}
                thumbColor="#fff"
              />
            </View>
          </>
        )}
      </View>

      {/* Danger zone */}
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
