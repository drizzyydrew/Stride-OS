import { ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { LAYOUT } from '../../../src/constants/layout';
import { useSettingsStore } from '../../../src/store/settingsStore';
import { useColors } from '../../../src/theme/useColors';
import type { ActivityDetectionMode } from '../../../src/utils/activityDetection';
import type { AutoPauseMode } from '../../../src/utils/autoPause';
import type { TreadmillPhonePlacement } from '../../../src/utils/treadmillPlacement';

export default function WorkoutIntelligenceSettingsScreen() {
  const C = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const {
    liveActivitiesEnabled,
    setLiveActivitiesEnabled,
    autoPauseMode,
    setAutoPauseMode,
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
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={20} color={C.primary} />
        </TouchableOpacity>
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
        <Text style={[styles.caption, { color: C.textMuted }]}>
          Diagnostics were removed from Settings. TestFlight validation should verify Live Activity behavior on a physical device.
        </Text>
      </View>

      <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
        <Text style={[styles.sectionLabel, { color: C.textDim }]}>AUTO-PAUSE</Text>
        <Text style={[styles.caption, { color: C.textMuted, marginBottom: 12 }]}>
          Applies only to live GPS running and cycling workouts. StrideOS pauses after 2 seconds of stopped GPS movement and resumes after 2 seconds of renewed movement.
        </Text>
        <SegmentControl
          options={[
            { label: 'Off', value: 'off' },
            { label: 'Run', value: 'running_only' },
            { label: 'Ride', value: 'cycling_only' },
            { label: 'Both', value: 'running_and_cycling' },
          ]}
          value={autoPauseMode}
          onChange={value => setAutoPauseMode(value as AutoPauseMode)}
        />
        <View style={[styles.settingRow, { borderBottomColor: C.border, marginTop: 16 }]}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={[styles.settingTitle, { color: C.text }]}>Announce pause</Text>
            <Text style={[styles.caption, { color: C.textMuted }]}>Speaks "Workout paused" after auto-pause.</Text>
          </View>
          <Switch value={announceAutoPause} onValueChange={setAnnounceAutoPause} trackColor={{ false: C.cardAlt, true: C.primary }} thumbColor={C.card} />
        </View>
        <View style={styles.settingRow}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={[styles.settingTitle, { color: C.text }]}>Announce resume</Text>
            <Text style={[styles.caption, { color: C.textMuted }]}>Speaks "Workout resumed" after auto-resume.</Text>
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
