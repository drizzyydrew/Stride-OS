import { LegacyBackControl } from '../../../src/components/layout/NavigationEscape';
import { ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { usePageSafeAreaInsets as useSafeAreaInsets } from '../../../src/components/layout/PageSafeAreaView';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Host, Switch as NativeSwitch } from '@expo/ui';

import { LAYOUT } from '../../../src/constants/layout';
import { useSettingsStore } from '../../../src/store/settingsStore';
import { useColors } from '../../../src/theme/useColors';
import type { ActivityDetectionMode } from '../../../src/utils/activityDetection';
import { isAutoPauseEnabled, type AutoPauseActivity } from '../../../src/utils/autoPause';
import { setActivityAutoPauseEnabled } from '../../../src/utils/autoPauseSettings';
import type { TreadmillPhonePlacement } from '../../../src/utils/treadmillPlacement';
import { useThemeMode } from '../../../src/store/themeStore';

export default function WorkoutIntelligenceSettingsScreen() {
  const C = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const theme = useThemeMode();
  const [autoPauseReady, setAutoPauseReady] = useState(() => useSettingsStore.persist.hasHydrated());
  const [savingAutoPause, setSavingAutoPause] = useState(false);
  const [autoPauseError, setAutoPauseError] = useState('');
  const saving = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    const loading = useSettingsStore.persist.onHydrate(() => setAutoPauseReady(false));
    const finished = useSettingsStore.persist.onFinishHydration(() => setAutoPauseReady(true));
    setAutoPauseReady(useSettingsStore.persist.hasHydrated());
    return () => { mounted.current = false; loading(); finished(); };
  }, []);
  async function changeAutoPause(activity: AutoPauseActivity, enabled: boolean) {
    if (saving.current || !useSettingsStore.persist.hasHydrated()) return;
    saving.current = true;
    setSavingAutoPause(true); setAutoPauseError('');
    try {
      const settings = useSettingsStore.getState();
      await settings.setAutoPauseMode(setActivityAutoPauseEnabled(settings.autoPauseMode, activity, enabled));
    } catch {
      if (mounted.current) setAutoPauseError('Your auto-pause choice could not be saved. Please try again.');
    } finally {
      saving.current = false;
      if (mounted.current) setSavingAutoPause(false);
    }
  }
  const {
    liveActivitiesEnabled,
    setLiveActivitiesEnabled,
    autoPauseMode,
    announceAutoPause,
    setAnnounceAutoPause,
    announceAutoResume,
    setAnnounceAutoResume,
    activityDetectionMode,
    setActivityDetectionMode,
    treadmillPhonePlacementDefault,
    setTreadmillPhonePlacementDefault,
  } = useSettingsStore();

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: C.bg }}
      contentContainerStyle={{ paddingHorizontal: 18, paddingTop: insets.top + 6, paddingBottom: LAYOUT.screenPadBottom }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <LegacyBackControl onBack={() => router.back()} />
        <View style={{ marginLeft: 10, flex: 1 }}>
          <Text style={[styles.headerLabel, { color: C.textDim }]}>SETTINGS</Text>
          <Text style={[styles.headerTitle, { color: C.text }]}>Workout Intelligence</Text>
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
        <Text style={[styles.sectionLabel, { color: C.textDim }]}>LIVE WORKOUTS</Text>
        <View style={[styles.settingRow, { borderBottomColor: C.border }]}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={[styles.settingTitle, { color: C.text }]}>Live Activities</Text>
            <Text style={[styles.caption, { color: C.textMuted }]}>
              Lock Screen and Dynamic Island cards for active workouts where iOS supports them.
            </Text>
          </View>
          <Switch
            value={liveActivitiesEnabled}
            onValueChange={setLiveActivitiesEnabled}
            trackColor={{ false: C.cardAlt, true: C.primary }}
            thumbColor={C.card}
          />
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
        <Text style={[styles.sectionLabel, { color: C.textDim }]}>AUTO-PAUSE</Text>
        <Text style={[styles.caption, { color: C.textMuted, marginBottom: 12 }]}>
          Applies only to live GPS running and cycling workouts. StrideOS pauses after 2 seconds of stopped GPS movement and resumes after 2 seconds of renewed movement.
        </Text>
        <Host matchContents={{ vertical: true }} colorScheme={theme} seedColor={C.primary} ignoreSafeArea="all" style={{ width: '100%' }}>
          <NativeSwitch label="Auto-pause runs" value={isAutoPauseEnabled(autoPauseMode, 'running')}
            disabled={!autoPauseReady || savingAutoPause} onValueChange={enabled => { void changeAutoPause('running', enabled); }} />
        </Host>
        <Host matchContents={{ vertical: true }} colorScheme={theme} seedColor={C.primary} ignoreSafeArea="all" style={{ width: '100%', marginTop: 12 }}>
          <NativeSwitch label="Auto-pause rides" value={isAutoPauseEnabled(autoPauseMode, 'cycling')}
            disabled={!autoPauseReady || savingAutoPause} onValueChange={enabled => { void changeAutoPause('cycling', enabled); }} />
        </Host>
        <Text style={[styles.caption, { color: C.textMuted, marginTop: 10 }]}>
          {!autoPauseReady ? 'Loading your saved preferences…' : 'These switches control recording. Turning one off keeps recording when you stop moving. A workout already paused stays paused until you tap Resume.'}
        </Text>
        {autoPauseError ? <Text accessibilityRole="alert" style={[styles.caption, { color: C.critical, marginTop: 8 }]}>{autoPauseError}</Text> : null}
        <Text style={[styles.sectionLabel, { color: C.textDim, marginTop: 20 }]}>VOICE ANNOUNCEMENTS</Text>
        <View style={[styles.settingRow, { borderBottomColor: C.border, marginTop: 16 }]}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={[styles.settingTitle, { color: C.text }]}>Announce pause</Text>
            <Text style={[styles.caption, { color: C.textMuted }]}>Speaks "Pausing workout" after auto-pause.</Text>
          </View>
          <Switch value={announceAutoPause} onValueChange={setAnnounceAutoPause} trackColor={{ false: C.cardAlt, true: C.primary }} thumbColor={C.card} />
        </View>
        <View style={styles.settingRow}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={[styles.settingTitle, { color: C.text }]}>Announce resume</Text>
            <Text style={[styles.caption, { color: C.textMuted }]}>Speaks "Resuming workout" after auto-resume.</Text>
          </View>
          <Switch value={announceAutoResume} onValueChange={setAnnounceAutoResume} trackColor={{ false: C.cardAlt, true: C.primary }} thumbColor={C.card} />
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
        <Text style={[styles.sectionLabel, { color: C.textDim }]}>START SUGGESTIONS</Text>
        <Text style={[styles.caption, { color: C.textMuted, marginBottom: 12 }]}>
          Optional prompts can suggest starting a workout after sustained movement evidence. StrideOS does not silently start or save workouts.
        </Text>
        <SegmentControl
          options={[
            { label: 'Off', value: 'off' },
            { label: 'Run', value: 'suggest_running' },
            { label: 'Ride', value: 'suggest_cycling' },
            { label: 'Both', value: 'suggest_running_and_cycling' },
          ]}
          value={activityDetectionMode}
          onChange={value => setActivityDetectionMode(value as ActivityDetectionMode)}
        />
      </View>

      <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
        <Text style={[styles.sectionLabel, { color: C.textDim }]}>TREADMILL DEFAULT</Text>
        <Text style={[styles.caption, { color: C.textMuted, marginBottom: 12 }]}>
          You can change this before every treadmill workout. Resting phone mode will not fabricate cadence or stride data.
        </Text>
        <SegmentControl
          options={[
            { label: 'On body', value: 'on_body' },
            { label: 'Resting', value: 'resting_on_treadmill' },
            { label: 'Sensor', value: 'connected_sensor' },
          ]}
          value={treadmillPhonePlacementDefault}
          onChange={value => setTreadmillPhonePlacementDefault(value as TreadmillPhonePlacement)}
        />
      </View>
    </ScrollView>
  );
}

function SegmentControl({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  const C = useColors();
  return (
    <View style={[styles.segCtrl, { backgroundColor: C.cardAlt }]}>
      {options.map(option => {
        const active = value === option.value;
        return (
          <TouchableOpacity
            key={option.value}
            style={[styles.segOption, active && { backgroundColor: C.primaryDim }]}
            onPress={() => onChange(option.value)}
            activeOpacity={0.7}
          >
            <Text style={[styles.segText, { color: active ? C.primary : C.textDim }]}>{option.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
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
    alignItems: 'center',
    gap: 12,
    paddingBottom: 14,
    marginBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'transparent',
  },
  settingTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  caption: {
    fontSize: 11,
    lineHeight: 16,
  },
  segCtrl: {
    flexDirection: 'row',
    borderRadius: 10,
    padding: 4,
    gap: 4,
  },
  segOption: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 8,
  },
  segText: {
    fontSize: 12,
    fontWeight: '900',
  },
});
