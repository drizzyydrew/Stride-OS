// ─── Indoor Cycling: Live Screen ──────────────────────────────────────────
//
// Free ride, scheduled workout, or a shortcut to log a ride already
// completed elsewhere. No GPS, no map, no location permission — everything
// here is manual entry or a HealthKit heart-rate poll.
//
// Honesty rule (release gate): distance is NEVER computed from HR, duration,
// or power. It is either what the athlete entered from the bike/trainer's
// own display, or it is honestly absent. See src/utils/indoorRide.ts.

import { useEffect, useState } from 'react';
import { Alert, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import ScreenHeader from '../../../src/components/layout/ScreenHeader';
import { useColors } from '../../../src/theme/useColors';
import { spacing } from '../../../src/theme/spacing';
import { FontSize, FontWeight, Radius } from '../../../src/theme/tokens';
import {
  activeIndoorRideElapsedSeconds,
  useActiveIndoorRideStore,
} from '../../../src/store/activeIndoorRideStore';
import { useActivityStore } from '../../../src/store/activityStore';
import { useIntegrationsStore } from '../../../src/store/integrationsStore';
import { useSettingsStore } from '../../../src/store/settingsStore';
import { useCalibration } from '../../../src/store/profileStore';
import { useWeekPlan } from '../../../src/hooks/useWeekPlan';
import { useScheduledSessions } from '../../../src/hooks/useScheduledSessions';
import { getLatestHeartRateSample } from '../../../src/lib/healthKit';
import {
  endOutdoorLiveActivity,
  startOutdoorLiveActivity,
  updateOutdoorLiveActivity,
} from '../../../src/lib/runLiveActivity';
import {
  activeSessionStoresHydrated,
  discardActiveSession,
  getConflictingActiveSession,
  isActiveSessionStale,
} from '../../../src/lib/activeSessionCoordinator';
import { buildIndoorRideActivityDraft } from '../../../src/utils/indoorRide';
import { summarizeIndoorHeartRate } from '../../../src/utils/indoorHeartRate';
import { clampStepIndex, flattenWorkoutSteps, totalRemainingMinutes } from '../../../src/utils/workoutSteps';
import { zoneStatusForHeartRate } from '../../../src/utils/heartRateZones';
import { milesToKm } from '../../../src/utils/units';

const DISTANCE_UNAVAILABLE_COPY =
  "Live distance is unavailable. Enter the bike or trainer's displayed distance during or after the session.";

function timeLabel(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`;
}

export default function IndoorRideScreen() {
  const C = useColors();
  const router = useRouter();
  const params = useLocalSearchParams<{ scheduledSessionId?: string }>();

  const ride = useActiveIndoorRideStore();
  const addActivity = useActivityStore(state => state.addActivity);
  const healthKitEnabled = useIntegrationsStore(state => state.healthKitEnabled);
  const calibration = useCalibration();
  const { units } = useSettingsStore();
  const imperial = units === 'imperial';

  const weekPlan = useWeekPlan();
  const scheduled = useScheduledSessions(weekPlan);
  const paramSession = params.scheduledSessionId ? scheduled.getSessionById(params.scheduledSessionId) : null;
  const todayCyclingSession = scheduled.todaySessions.find(session => session.activityType === 'cycling') ?? null;
  const scheduledCandidate = paramSession ?? todayCyclingSession;
  const scheduledCompletedActivityId = scheduledCandidate
    ? scheduled.getCompletedActivityForScheduledSession(scheduledCandidate.scheduledSessionId)?.id
    : undefined;

  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [cadenceInput, setCadenceInput] = useState('');
  const [powerInput, setPowerInput] = useState('');
  const [resistanceInput, setResistanceInput] = useState('');
  const [rpeInput, setRpeInput] = useState('');
  const [distanceModalOpen, setDistanceModalOpen] = useState(false);
  const [distanceInput, setDistanceInput] = useState('');
  const [distanceUnitInput, setDistanceUnitInput] = useState<'mi' | 'km'>(imperial ? 'mi' : 'km');
  const steps = ride.plannedWorkout ? flattenWorkoutSteps(ride.plannedWorkout) : [];
  const stepIndex = clampStepIndex(steps, ride.currentIntervalIndex);
  const currentStep = steps[stepIndex] ?? null;
  const remainingMinutes = steps.length ? totalRemainingMinutes(steps, stepIndex) : null;

  useEffect(() => {
    if (!ride.isActive || ride.isPaused || !ride.startedAt) return;
    const timer = setInterval(
      () => setElapsedSeconds(activeIndoorRideElapsedSeconds(useActiveIndoorRideStore.getState())),
      1000,
    );
    return () => clearInterval(timer);
  }, [ride.isActive, ride.isPaused, ride.pausedDurationMs, ride.startedAt]);

  useEffect(() => {
    if (ride.isActive && ride.startedAt) {
      setElapsedSeconds(activeIndoorRideElapsedSeconds(ride));
    }
    // Only re-sync from the store on activity/instance transitions — not on
    // every tick (the 1s timer above already owns that).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ride.isActive, ride.workoutInstanceId]);

  useEffect(() => {
    if (!ride.isActive || !ride.workoutInstanceId) return;
    const miles = ride.equipmentDistance
      ? (ride.equipmentDistance.unit === 'mi' ? ride.equipmentDistance.value : ride.equipmentDistance.value / 1.609344)
      : 0;
    void updateOutdoorLiveActivity({
      sessionId: ride.workoutInstanceId,
      workoutInstanceId: ride.workoutInstanceId,
      sessionSource: 'outdoor',
      activityName: 'Indoor Ride',
      activityType: 'indoor_cycling',
      elapsedSeconds,
      distanceMiles: miles,
      averageSpeedMph: miles > 0 && elapsedSeconds > 0 ? miles / (elapsedSeconds / 3600) : 0,
      heartRateBpm: ride.heartRateBpm,
      isPaused: ride.isPaused,
      currentInterval: currentStep?.label,
      cueText: ride.equipmentDistance == null ? 'Distance unavailable until entered from equipment.' : 'Equipment distance',
    }).catch(() => undefined);
  }, [currentStep?.label, elapsedSeconds, ride.equipmentDistance, ride.heartRateBpm, ride.isActive, ride.isPaused, ride.workoutInstanceId]);

  useEffect(() => {
    let cancelled = false;
    async function refreshHeartRate() {
      if (!healthKitEnabled || !ride.isActive || ride.isPaused || Platform.OS !== 'ios') {
        if (!cancelled) ride.setHeartRateBpm(null);
        return;
      }
      const latest = await getLatestHeartRateSample().catch(() => null);
      if (!cancelled) ride.setHeartRateBpm(latest?.bpm ?? null, latest?.sampledAt);
    }
    refreshHeartRate();
    const timer = setInterval(refreshHeartRate, 10_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [ride.isActive, ride.isPaused, healthKitEnabled]);

  const targetZone = 2;
  const zoneStatus = zoneStatusForHeartRate(ride.heartRateBpm, targetZone, calibration?.hrZones);
  const zoneToneColor = zoneStatus.tone === 'in'
    ? C.positive
    : zoneStatus.tone === 'near'
      ? C.warning
      : zoneStatus.tone === 'out'
        ? C.critical
        : C.textMuted;

  const distanceDisplay = ride.equipmentDistance
    ? (ride.equipmentDistance.unit === 'mi'
      ? (imperial ? ride.equipmentDistance.value : milesToKm(ride.equipmentDistance.value) ?? 0)
      : (imperial ? (ride.equipmentDistance.value / 1.609344) : ride.equipmentDistance.value))
    : null;

  async function beginRide(config: { scheduledSessionId?: string | null; plannedWorkout?: typeof ride.plannedWorkout }) {
    if (!activeSessionStoresHydrated()) {
      Alert.alert('Restoring session', 'StrideOS is restoring your active-session state. Try again in a moment.');
      return;
    }
    const conflict = getConflictingActiveSession('indoor_ride');
    if (conflict) {
      const stale = isActiveSessionStale();
      Alert.alert(
        'Another session is active',
        stale
          ? `${conflict.name} started a while ago and is still open. Continue it, or end it and start this ride.`
          : `${conflict.name} is still in progress. Continue it or end it before starting an indoor ride.`,
        [
          { text: 'Continue Current Session', onPress: () => router.push(conflict.route as never) },
          {
            text: 'End Previous Session and Start New',
            style: 'destructive',
            onPress: () => { void discardActiveSession(conflict).then(() => beginRide(config)); },
          },
          { text: 'Cancel', style: 'cancel' },
        ],
      );
      return;
    }
    ride.startRide(config);
    const started = useActiveIndoorRideStore.getState();
    await startOutdoorLiveActivity({
      sessionId: started.workoutInstanceId ?? '',
      workoutInstanceId: started.workoutInstanceId ?? undefined,
      sessionSource: 'outdoor',
      activityName: 'Indoor Ride',
      activityType: 'indoor_cycling',
      elapsedSeconds: 0,
      distanceMiles: 0,
      averageSpeedMph: 0,
      heartRateBpm: null,
      isPaused: false,
      cueText: 'Distance unavailable until entered from equipment.',
    }).catch(() => undefined);
    setElapsedSeconds(0);
    setCadenceInput('');
    setPowerInput('');
    setResistanceInput('');
    setRpeInput('');
  }

  function logCompletedRide() {
    router.push({
      pathname: '/(tabs)/activity/manual',
      params: {
        activityType: 'indoor_cycling',
        ...(scheduledCandidate && !scheduledCompletedActivityId
          ? { scheduledSessionId: scheduledCandidate.scheduledSessionId }
          : {}),
      },
    } as never);
  }

  function commitCadence() {
    const parsed = parseFloat(cadenceInput);
    ride.setCadenceRpm(Number.isFinite(parsed) && parsed >= 0 ? parsed : null);
  }
  function commitPower() {
    const parsed = parseFloat(powerInput);
    ride.setPowerWatts(Number.isFinite(parsed) && parsed >= 0 ? parsed : null);
  }
  function commitResistance() {
    ride.setResistanceLevel(resistanceInput.trim() || null);
  }
  function commitRpe() {
    const parsed = parseFloat(rpeInput);
    ride.setRpe(Number.isFinite(parsed) ? Math.max(1, Math.min(10, Math.round(parsed))) : null);
  }

  function openDistanceModal() {
    setDistanceUnitInput(ride.equipmentDistance?.unit ?? (imperial ? 'mi' : 'km'));
    setDistanceInput(ride.equipmentDistance ? String(ride.equipmentDistance.value) : '');
    setDistanceModalOpen(true);
  }
  function confirmDistance() {
    const parsed = parseFloat(distanceInput);
    if (Number.isFinite(parsed) && parsed > 0) {
      ride.setEquipmentDistance({ value: parsed, unit: distanceUnitInput });
    }
    setDistanceModalOpen(false);
  }

  function finish() {
    Alert.alert(
      'Finish ride?',
      ride.equipmentDistance == null
        ? `Save this ride to your unified history? ${DISTANCE_UNAVAILABLE_COPY}`
        : 'Save this ride to your unified history?',
      [
        { text: 'Keep Riding', style: 'cancel' },
        { text: 'Save and Finish', onPress: () => void saveAndFinish() },
      ],
    );
  }

  async function saveAndFinish() {
    const state = useActiveIndoorRideStore.getState();
    if (!state.isActive) return;
    const elapsed = activeIndoorRideElapsedSeconds(state);
    const startedAtMs = state.startedAt ?? Date.now() - elapsed * 1000;
    const heartRateSummary = summarizeIndoorHeartRate({
      samples: state.heartRateSamples,
      startedAtMs,
      endedAtMs: startedAtMs + elapsed * 1000,
      zones: calibration?.hrZones?.filter((zone): zone is typeof zone & { zone: 1 | 2 | 3 | 4 | 5 } =>
        zone.zone >= 1 && zone.zone <= 5,
      ),
    });
    const scheduledSession = state.scheduledSessionId ? scheduled.getSessionById(state.scheduledSessionId) : null;
    const draft = buildIndoorRideActivityDraft({
      startedAtMs,
      elapsedSeconds: elapsed,
      scheduledSessionId: state.scheduledSessionId,
      associatedTrainingBlockId: scheduledSession?.trainingBlockId,
      associatedGoalId: scheduledSession?.goalPlanId,
      // Average is present only when timestamped samples cover enough of the
      // session. The summary still retains source and gap metadata otherwise.
      averageHeartRateBpm: heartRateSummary?.averageHeartRateBpm,
      maximumHeartRateBpm: heartRateSummary?.maximumHeartRateBpm,
      heartRateSummary,
      cadenceRpm: state.cadenceRpm,
      powerWatts: state.powerWatts,
      resistanceLevel: state.resistanceLevel,
      rpe: state.rpe,
      equipmentDistance: state.equipmentDistance,
    });
    await endOutdoorLiveActivity({
      sessionId: state.workoutInstanceId ?? '',
      workoutInstanceId: state.workoutInstanceId ?? undefined,
      sessionSource: 'outdoor',
      activityName: 'Indoor Ride',
      activityType: 'indoor_cycling',
      elapsedSeconds: elapsed,
      distanceMiles: state.equipmentDistance
        ? (state.equipmentDistance.unit === 'mi' ? state.equipmentDistance.value : state.equipmentDistance.value / 1.609344)
        : 0,
      averageSpeedMph: 0,
      heartRateBpm: state.heartRateBpm,
      isPaused: false,
    }).catch(() => undefined);
    const activityId = addActivity(draft);
    ride.finishRide();
    router.replace({ pathname: '/(tabs)/activity/[activityId]', params: { activityId } } as never);
  }

  function cancel() {
    Alert.alert('Cancel ride?', 'This discards the in-progress ride without saving it.', [
      { text: 'Keep Riding', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: () => {
          const state = useActiveIndoorRideStore.getState();
          void endOutdoorLiveActivity({
            sessionId: state.workoutInstanceId ?? '',
            workoutInstanceId: state.workoutInstanceId ?? undefined,
            sessionSource: 'outdoor',
            activityName: 'Indoor Ride',
            activityType: 'indoor_cycling',
            elapsedSeconds: activeIndoorRideElapsedSeconds(state),
            distanceMiles: 0,
            averageSpeedMph: 0,
            heartRateBpm: state.heartRateBpm,
            isPaused: false,
          }).catch(() => undefined).finally(() => ride.cancelRide());
        },
      },
    ]);
  }

  // ── Idle state ────────────────────────────────────────────────────────
  if (!ride.isActive) {
    return (
      <SafeAreaView style={[s.safe, { backgroundColor: C.bg }]} edges={['top']}>
        <ScreenHeader eyebrow="INDOOR CYCLING" title="Indoor Ride" onBack={() => router.back()} />
        <ScrollView contentContainerStyle={s.content}>
          <TouchableOpacity
            onPress={() => void beginRide({})}
            style={[s.primaryButton, { backgroundColor: C.primary }]}
            accessibilityRole="button"
            accessibilityLabel="Start free ride"
          >
            <Ionicons name="bicycle-outline" size={20} color={C.onPrimary} />
            <Text style={[s.primaryButtonText, { color: C.onPrimary }]}>Start Free Ride</Text>
          </TouchableOpacity>

          {scheduledCandidate ? (
            scheduledCompletedActivityId ? (
              <TouchableOpacity
                onPress={() => router.push({ pathname: '/(tabs)/activity/[activityId]', params: { activityId: scheduledCompletedActivityId } } as never)}
                style={[s.secondaryButton, { backgroundColor: C.card, borderColor: C.border }]}
              >
                <Ionicons name="checkmark-circle-outline" size={18} color={C.positive} />
                <Text style={[s.secondaryButtonText, { color: C.text }]}>View Completed Ride</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={() => void beginRide({
                  scheduledSessionId: scheduledCandidate.scheduledSessionId,
                  plannedWorkout: scheduledCandidate.richWorkout ?? null,
                })}
                style={[s.secondaryButton, { backgroundColor: C.card, borderColor: C.border }]}
              >
                <Ionicons name="calendar-outline" size={18} color={C.text} />
                <View style={{ flex: 1 }}>
                  <Text style={[s.secondaryButtonText, { color: C.text }]}>Start Scheduled Workout</Text>
                  <Text style={[s.helper, { color: C.textMuted }]}>
                    {scheduledCandidate.title} · {scheduledCandidate.durationMinutes} min
                  </Text>
                </View>
              </TouchableOpacity>
            )
          ) : null}

          <TouchableOpacity
            onPress={logCompletedRide}
            style={[s.secondaryButton, { backgroundColor: C.card, borderColor: C.border }]}
          >
            <Ionicons name="create-outline" size={18} color={C.text} />
            <Text style={[s.secondaryButtonText, { color: C.text }]}>Log Completed Ride</Text>
          </TouchableOpacity>

          <View style={[s.noticeCard, { backgroundColor: C.cardAlt, borderColor: C.border }]}>
            <Text style={[s.noticeText, { color: C.textMuted }]}>{DISTANCE_UNAVAILABLE_COPY}</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Live state ────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={[s.safe, { backgroundColor: C.bg }]} edges={['top']}>
      <View style={s.activeHeader}>
        <Text style={[s.eyebrow, { color: C.primary }]}>{ride.isPaused ? 'PAUSED' : 'INDOOR RIDE'}</Text>
        <Text style={[s.timer, { color: C.text }]}>{timeLabel(elapsedSeconds)}</Text>
      </View>

      <ScrollView contentContainerStyle={s.content}>
        {currentStep ? (
          <View style={[s.card, { backgroundColor: C.card, borderColor: C.border }]}>
            <View style={s.row}>
              <Text style={[s.cardTitle, { color: C.text }]}>{currentStep.label}</Text>
              <Text style={[s.helper, { color: C.textMuted }]}>{stepIndex + 1}/{steps.length}</Text>
            </View>
            <Text style={[s.helper, { color: C.textMuted, marginTop: 5 }]} numberOfLines={2}>{currentStep.instructions}</Text>
            <View style={s.row}>
              <Text style={[s.helper, { color: C.textMuted }]}>
                {currentStep.durationMinutes != null ? `${currentStep.durationMinutes} min` : 'Duration varies'}
              </Text>
              {remainingMinutes != null ? (
                <Text style={[s.helper, { color: C.textMuted }]}>{remainingMinutes} min remaining</Text>
              ) : null}
            </View>
            {stepIndex < steps.length - 1 ? (
              <TouchableOpacity style={[s.smallBtn, { borderColor: C.border }]} onPress={ride.advanceInterval} accessibilityRole="button" accessibilityLabel="Advance to next interval">
                <Text style={[s.smallBtnText, { color: C.text }]}>Next Interval</Text>
                <Ionicons name="chevron-forward" size={14} color={C.text} />
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        <View style={[s.card, { backgroundColor: C.card, borderColor: C.border }]}>
          <Text style={[s.label, { color: C.textDim }]}>DISTANCE</Text>
          {ride.equipmentDistance ? (
            <Text style={[s.metricValue, { color: C.text }]}>
              {distanceDisplay?.toFixed(2)} {imperial ? 'mi' : 'km'}
              <Text style={[s.helper, { color: C.textMuted }]}>  · from equipment display</Text>
            </Text>
          ) : (
            <Text style={[s.helper, { color: C.warning }]}>{DISTANCE_UNAVAILABLE_COPY}</Text>
          )}
          <TouchableOpacity style={[s.smallBtn, { borderColor: C.border, marginTop: spacing.sm }]} onPress={openDistanceModal} accessibilityRole="button" accessibilityLabel="Enter bike or trainer displayed distance">
            <Text style={[s.smallBtnText, { color: C.text }]}>{ride.equipmentDistance ? 'Update Distance' : 'Enter Distance'}</Text>
            <Ionicons name="create-outline" size={14} color={C.text} />
          </TouchableOpacity>
        </View>

        {ride.heartRateBpm ? (
          <View style={[s.statusChip, { backgroundColor: zoneToneColor + '22', borderColor: zoneToneColor }]}>
            <Text style={[s.statusChipText, { color: C.text }]}>{ride.heartRateBpm} bpm · {zoneStatus.label} · {zoneStatus.detail}</Text>
          </View>
        ) : healthKitEnabled ? (
          <Text style={[s.helper, { color: C.textMuted }]}>Waiting for a heart-rate reading…</Text>
        ) : null}

        <View style={s.grid}>
          <LiveField
            label="Cadence"
            value={cadenceInput}
            onChange={setCadenceInput}
            onCommit={commitCadence}
            suffix="rpm"
            placeholder={ride.cadenceRpm != null ? String(ride.cadenceRpm) : '--'}
          />
          <LiveField
            label="Power"
            value={powerInput}
            onChange={setPowerInput}
            onCommit={commitPower}
            suffix="W"
            placeholder={ride.powerWatts != null ? String(ride.powerWatts) : '--'}
          />
          <LiveField
            label="Resistance"
            value={resistanceInput}
            onChange={setResistanceInput}
            onCommit={commitResistance}
            placeholder={ride.resistanceLevel ?? '--'}
            keyboardType="default"
          />
          <LiveField
            label="RPE"
            value={rpeInput}
            onChange={setRpeInput}
            onCommit={commitRpe}
            suffix="/10"
            placeholder={ride.rpe != null ? String(ride.rpe) : '--'}
          />
        </View>
      </ScrollView>

      <View style={s.controls}>
        <TouchableOpacity onPress={ride.isPaused ? ride.resume : ride.pause} style={[s.control, { backgroundColor: C.card, borderColor: C.border }]}>
          <Ionicons name={ride.isPaused ? 'play' : 'pause'} size={22} color={C.text} />
          <Text style={[s.controlText, { color: C.text }]}>{ride.isPaused ? 'Resume' : 'Pause'}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={finish} style={[s.control, { backgroundColor: C.primary }]}>
          <Ionicons name="stop" size={22} color={C.onPrimary} />
          <Text style={[s.controlText, { color: C.onPrimary }]}>Finish</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity onPress={cancel} style={s.cancelLink} accessibilityRole="button" accessibilityLabel="Cancel ride without saving">
        <Text style={[s.cancelLinkText, { color: C.textMuted }]}>Cancel ride without saving</Text>
      </TouchableOpacity>

      <Modal visible={distanceModalOpen} transparent animationType="fade" onRequestClose={() => setDistanceModalOpen(false)}>
        <View style={s.modalOverlay}>
          <View style={[s.modalCard, { backgroundColor: C.card, borderColor: C.border }]}>
            <Text style={[s.modalTitle, { color: C.text }]}>Bike/trainer displayed distance</Text>
            <Text style={[s.modalCopy, { color: C.textMuted }]}>Enter what the bike or trainer's own display shows.</Text>
            <View style={s.unitToggleRow}>
              {(['mi', 'km'] as const).map(unit => (
                <TouchableOpacity
                  key={unit}
                  onPress={() => setDistanceUnitInput(unit)}
                  style={[s.unitToggle, { backgroundColor: distanceUnitInput === unit ? C.primaryDim : C.cardAlt, borderColor: distanceUnitInput === unit ? C.primary : C.border }]}
                >
                  <Text style={[s.smallBtnText, { color: distanceUnitInput === unit ? C.primary : C.textMuted }]}>{unit === 'mi' ? 'Miles' : 'Kilometers'}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={[s.input, { color: C.text, borderColor: C.border, backgroundColor: C.cardAlt }]}
              value={distanceInput}
              onChangeText={setDistanceInput}
              keyboardType="decimal-pad"
              placeholder={`e.g. ${distanceUnitInput === 'mi' ? '8.5' : '13.7'}`}
              placeholderTextColor={C.textMuted}
              autoFocus
            />
            <View style={s.modalActions}>
              <TouchableOpacity style={[s.modalBtn, { backgroundColor: C.cardAlt }]} onPress={() => setDistanceModalOpen(false)}>
                <Text style={[s.modalBtnText, { color: C.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.modalBtn, { backgroundColor: C.primary }]} onPress={confirmDistance}>
                <Text style={[s.modalBtnText, { color: C.onPrimary }]}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function LiveField({ label, value, onChange, onCommit, suffix, placeholder, keyboardType = 'decimal-pad' }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onCommit: () => void;
  suffix?: string;
  placeholder?: string;
  keyboardType?: 'decimal-pad' | 'default';
}) {
  const C = useColors();
  return (
    <View style={[s.field, { backgroundColor: C.card, borderColor: C.border }]}>
      <Text style={[s.fieldLabel, { color: C.textDim }]}>{label.toUpperCase()}</Text>
      <View style={s.fieldRow}>
        <TextInput
          value={value}
          onChangeText={onChange}
          onBlur={onCommit}
          onSubmitEditing={onCommit}
          keyboardType={keyboardType}
          placeholder={placeholder ?? '--'}
          placeholderTextColor={C.textMuted}
          style={[s.input2, { color: C.text }]}
        />
        {suffix ? <Text style={[s.suffix, { color: C.textMuted }]}>{suffix}</Text> : null}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  content: { paddingHorizontal: 18, paddingBottom: 140, gap: spacing.sm },
  primaryButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 54, borderRadius: Radius.lg, marginTop: spacing.sm },
  primaryButtonText: { fontSize: FontSize.base, fontWeight: FontWeight.black },
  secondaryButton: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 58, borderWidth: 1, borderRadius: Radius.lg, paddingHorizontal: spacing.md },
  secondaryButtonText: { fontSize: FontSize.base, fontWeight: FontWeight.bold },
  helper: { fontSize: FontSize.xs, lineHeight: 16 },
  noticeCard: { borderWidth: 1, borderRadius: Radius.md, padding: spacing.sm, marginTop: spacing.xs },
  noticeText: { fontSize: FontSize.xs, lineHeight: 17 },
  activeHeader: { alignItems: 'center', padding: 20 },
  eyebrow: { fontSize: 10, fontWeight: FontWeight.black, letterSpacing: 1.3 },
  timer: { fontSize: 53, fontWeight: FontWeight.black, marginTop: 6 },
  card: { borderWidth: 1, borderRadius: Radius.lg, padding: spacing.md, gap: 6, marginBottom: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { fontSize: FontSize.base, fontWeight: FontWeight.bold },
  label: { fontSize: 10, fontWeight: FontWeight.black, letterSpacing: 0.6 },
  metricValue: { fontSize: FontSize.xl, fontWeight: FontWeight.black, marginTop: 4 },
  smallBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, borderWidth: 1, borderRadius: Radius.sm, paddingVertical: 8 },
  smallBtnText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  statusChip: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: 20, paddingHorizontal: spacing.sm, paddingVertical: 5, marginBottom: spacing.sm },
  statusChipText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  field: { width: '48%', borderWidth: 1, borderRadius: Radius.md, padding: 13, minHeight: 78 },
  fieldLabel: { fontSize: 9, fontWeight: FontWeight.bold, letterSpacing: 0.7 },
  fieldRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 5 },
  input2: { flex: 1, fontSize: 21, fontWeight: FontWeight.black, padding: 0 },
  suffix: { fontSize: 12, fontWeight: FontWeight.bold },
  controls: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 10 },
  control: { flex: 1, minHeight: 58, borderWidth: 1, borderRadius: Radius.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  controlText: { fontSize: FontSize.sm, fontWeight: FontWeight.black },
  cancelLink: { alignItems: 'center', paddingVertical: 14 },
  cancelLinkText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  modalCard: { width: '100%', maxWidth: 360, borderRadius: Radius.lg, borderWidth: 1, padding: spacing.lg, gap: spacing.sm },
  modalTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  modalCopy: { fontSize: FontSize.sm },
  unitToggleRow: { flexDirection: 'row', gap: spacing.sm },
  unitToggle: { flex: 1, borderWidth: 1, borderRadius: Radius.sm, paddingVertical: 8, alignItems: 'center' },
  input: { borderWidth: 1, borderRadius: Radius.sm, paddingHorizontal: spacing.sm, paddingVertical: spacing.sm, fontSize: FontSize.lg },
  modalActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  modalBtn: { flex: 1, borderRadius: Radius.sm, paddingVertical: spacing.sm, alignItems: 'center' },
  modalBtnText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
});
