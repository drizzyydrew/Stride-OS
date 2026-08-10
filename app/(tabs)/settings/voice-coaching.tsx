import { useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { LAYOUT } from '../../../src/constants/layout';
import { useSettingsStore, type VoiceCueMode, type VoiceCuePreferences } from '../../../src/store/settingsStore';
import { useColors } from '../../../src/theme/useColors';
import { testVoiceCoaching } from '../../../src/lib/voiceCoach';

const MODE_OPTIONS: { value: VoiceCueMode; label: string; example: string; detail: string }[] = [
  {
    value: 'silent',
    label: 'Silent',
    example: 'No spoken cues.',
    detail: 'Keeps workouts quiet. Live Activity, haptics, and on-screen workout state still update.',
  },
  {
    value: 'minimal',
    label: 'Minimal',
    example: 'Starting workout. Walk for forty-five seconds. Drink when you can.',
    detail: 'Only workout-critical changes: starts, interval/run-walk changes, route prompts, fueling, and hydration.',
  },
  {
    value: 'standard',
    label: 'Standard',
    example: 'Mile 2 complete. Split pace 9:12. Heart rate back in target zone.',
    detail: 'Adds pace and heart-rate alerts to the minimal workout cues.',
  },
  {
    value: 'coach',
    label: 'Coach',
    example: 'Starting workout. Keep this first mile controlled. Tall posture, quiet shoulders.',
    detail: 'Uses every enabled cue type, including technique and motivation.',
  },
];

const CUE_OPTIONS: { key: keyof VoiceCuePreferences; label: string; detail: string }[] = [
  { key: 'interval', label: 'Workout starts and intervals', detail: 'Start cue, segment changes, and structured-workout transitions.' },
  { key: 'pace', label: 'Pace and distance', detail: 'Split pace, average pace, elapsed time, and pace alerts during outdoor runs.' },
  { key: 'heartRate', label: 'Heart rate', detail: 'Target-zone changes when a real heart-rate source is connected.' },
  { key: 'runWalk', label: 'Run/walk changes', detail: 'Run and walk transitions for run-walk workouts.' },
  { key: 'motivation', label: 'Motivation', detail: 'Occasional coach-style prompts in Coach mode.' },
  { key: 'technique', label: 'Technique', detail: 'Form cues such as posture, cadence, and relaxation.' },
  { key: 'fueling', label: 'Fueling', detail: 'Carbohydrate reminders from the run fueling plan.' },
  { key: 'hydration', label: 'Hydration', detail: 'Fluid and sodium reminders from the hydration plan.' },
  { key: 'navigation', label: 'Route guidance', detail: 'Route alerts and off-route prompts when route guidance is active.' },
];

export default function VoiceCoachingSettingsScreen() {
  const C = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const {
    units,
    voiceCueMode,
    voiceCuePreferences,
    voiceDistanceUpdateInterval,
    setVoiceCueMode,
    setVoiceCuePreference,
    setVoiceDistanceUpdateInterval,
  } = useSettingsStore();
  const [testResult, setTestResult] = useState<string | null>(null);

  const distanceHalf = units === 'imperial' ? '0.5 mi' : '0.5 km';
  const distanceOne = units === 'imperial' ? '1 mi' : '1 km';

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
          <Text style={[styles.headerTitle, { color: C.text }]}>Voice Coaching</Text>
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
        <Text style={[styles.sectionLabel, { color: C.textDim }]}>MODE</Text>
        <View style={styles.modeGrid}>
          {MODE_OPTIONS.map(option => {
            const active = voiceCueMode === option.value;
            return (
              <TouchableOpacity
                key={option.value}
                style={[styles.modeCard, { backgroundColor: active ? C.primaryDim : C.cardAlt, borderColor: active ? C.primary : C.border }]}
                onPress={() => setVoiceCueMode(option.value)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                activeOpacity={0.75}
              >
                <View style={styles.modeHeader}>
                  <Text style={[styles.modeTitle, { color: active ? C.primary : C.text }]}>{option.label}</Text>
                  {active ? <Ionicons name="checkmark-circle" size={17} color={C.primary} /> : null}
                </View>
                <Text style={[styles.modeDetail, { color: C.textMuted }]}>{option.detail}</Text>
                <Text style={[styles.example, { color: active ? C.primary : C.textDim }]}>{option.example}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
        <Text style={[styles.sectionLabel, { color: C.textDim }]}>DISTANCE UPDATES</Text>
        <Text style={[styles.caption, { color: C.textMuted }]}>
          During every outdoor run, StrideOS can speak distance, split pace, average pace, and elapsed time.
        </Text>
        <SegmentControl
          options={[{ label: distanceHalf, value: 'half' }, { label: distanceOne, value: 'one' }]}
          value={voiceDistanceUpdateInterval}
          onChange={value => setVoiceDistanceUpdateInterval(value as typeof voiceDistanceUpdateInterval)}
        />
      </View>

      <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
        <Text style={[styles.sectionLabel, { color: C.textDim }]}>CUE TYPES</Text>
        {CUE_OPTIONS.map((option, index) => (
          <View key={option.key} style={[styles.settingRow, index < CUE_OPTIONS.length - 1 && { borderBottomColor: C.border }]}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={[styles.settingTitle, { color: C.text }]}>{option.label}</Text>
              <Text style={[styles.caption, { color: C.textMuted }]}>{option.detail}</Text>
            </View>
            <Switch
              value={voiceCuePreferences[option.key]}
              onValueChange={enabled => setVoiceCuePreference(option.key, enabled)}
              disabled={voiceCueMode === 'silent'}
              trackColor={{ false: C.border, true: C.primaryDim }}
              thumbColor={voiceCuePreferences[option.key] && voiceCueMode !== 'silent' ? C.primary : C.textDim}
            />
          </View>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.testButton, { backgroundColor: C.primaryDim, borderColor: C.primary }]}
        activeOpacity={0.75}
        onPress={() => {
          const state = testVoiceCoaching();
          setTestResult(state === 'unavailable' ? 'Voice is unavailable in this environment. Test on device before release.' : `Voice test ${state}.`);
        }}
      >
        <Ionicons name="volume-high-outline" size={18} color={C.primary} />
        <Text style={[styles.testText, { color: C.primary }]}>Preview Current Voice Setup</Text>
      </TouchableOpacity>
      {testResult ? <Text style={[styles.caption, { color: C.textMuted, marginTop: 8 }]}>{testResult}</Text> : null}
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
  modeGrid: {
    gap: 10,
  },
  modeCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  modeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  modeTitle: {
    fontSize: 15,
    fontWeight: '900',
  },
  modeDetail: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 5,
  },
  example: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '800',
    marginTop: 8,
  },
  caption: {
    fontSize: 11,
    lineHeight: 16,
    marginTop: 2,
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
  segCtrl: {
    flexDirection: 'row',
    borderRadius: 10,
    padding: 4,
    gap: 4,
    marginTop: 12,
  },
  segOption: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
  },
  segText: {
    fontSize: 13,
    fontWeight: '800',
  },
  testButton: {
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  testText: {
    fontSize: 13,
    fontWeight: '900',
  },
});
