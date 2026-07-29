import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import ScreenHeader from '../../../src/components/layout/ScreenHeader';
import StrideDateField from '../../../src/components/ui/StrideDateField';
import { useActivityStore } from '../../../src/store/activityStore';
import { useRecalculationStore } from '../../../src/store/recalculationStore';
import { useRouteStore } from '../../../src/store/routeStore';
import { useGearStore } from '../../../src/store/gearStore';
import { useColors } from '../../../src/theme/useColors';
import type { ActivitySubtype, ActivityType } from '../../../src/types/activity';
import { useWeekPlan } from '../../../src/hooks/useWeekPlan';
import { useScheduledSessions } from '../../../src/hooks/useScheduledSessions';
import {
  activityStatusForClassification,
  activityTypeFromScheduledSession,
  buildManualActivityDraft,
  calculatePaceOrSpeed,
  isPaceBasedActivity,
  isSpeedBasedActivity,
  type CompletionState,
} from '../../../src/utils/activityCompletion';
import { displayLabel } from '../../../src/utils/displayLabels';
import { categoryFromActivityType, categoryFromScheduledType, classifySubstitution } from '../../../src/utils/substitution';
import { formatPrescriptionWithSets } from '../../../src/utils/prescriptionFormat';
import { runRecalculation } from '../../../src/lib/recalculation';
import { dateOnlyToLocalTimestamp, timestampToDateOnly, todayDateOnly } from '../../../src/utils/dateOnly';

const TYPES: { key: string; type: ActivityType; subtype?: ActivitySubtype; label: string }[] = [
  { key: 'running', type: 'running', subtype: 'outdoor', label: 'Running' },
  { key: 'treadmill_running', type: 'running', subtype: 'treadmill', label: 'Treadmill' },
  { key: 'run_walk', type: 'running', subtype: 'run_walk', label: 'Run/Walk' },
  { key: 'walking', type: 'walking', subtype: 'outdoor', label: 'Walking' },
  { key: 'strength', type: 'strength', subtype: 'general', label: 'Strength Training' },
  { key: 'cycling', type: 'cycling', subtype: 'road', label: 'Outdoor Cycling' },
  { key: 'indoor_cycling', type: 'indoor_cycling', subtype: 'stationary', label: 'Indoor Cycling' },
  { key: 'swimming', type: 'swimming', subtype: 'pool', label: 'Swimming' },
  { key: 'hiking', type: 'hiking', subtype: 'outdoor', label: 'Hiking' },
  { key: 'downhill_skiing', type: 'downhill_skiing', subtype: 'general', label: 'Downhill Skiing' },
  { key: 'cross_country_skiing', type: 'cross_country_skiing', subtype: 'general', label: 'Cross-Country Skiing' },
  { key: 'snowboarding', type: 'snowboarding', subtype: 'general', label: 'Snowboarding' },
  { key: 'mobility', type: 'mobility', subtype: 'general', label: 'Mobility' },
  { key: 'elliptical', type: 'elliptical', subtype: 'indoor', label: 'Elliptical' },
  { key: 'rowing', type: 'rowing', subtype: 'indoor', label: 'Rowing' },
  { key: 'stair_climbing', type: 'stair_climbing', subtype: 'indoor', label: 'Stair Climbing' },
  { key: 'hiit', type: 'hiit', subtype: 'general', label: 'HIIT' },
  { key: 'mixed_modal', type: 'mixed_modal', subtype: 'crossfit', label: 'HIIT / Mixed Conditioning' },
  // Active Recovery isn't its own ActivityType (the union stays closed per
  // the execution-plan guardrail) — the honest mapping is 'other' with the
  // already-declared 'recovery' ActivitySubtype, distinct from a normal
  // easy walk/ride, mobility session, or unclassified 'Other' entry.
  { key: 'active_recovery', type: 'other', subtype: 'recovery', label: 'Active Recovery' },
  { key: 'other', type: 'other', subtype: 'general', label: 'Other' },
];

function numeric(value: string): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

// 'other' now covers two picker entries (Active Recovery + generic Other) —
// resolve by subtype when known, otherwise fall back to the generic 'general'
// entry so pre-existing "Other" activities/links never silently relabel as
// Active Recovery.
function findTypeEntry(type: string | undefined, subtype: string | undefined): typeof TYPES[number] | undefined {
  if (!type) return undefined;
  const matches = TYPES.filter(item => item.type === type);
  if (matches.length <= 1) return matches[0];
  return matches.find(item => item.subtype === subtype) ?? matches.find(item => item.subtype === 'general') ?? matches[0];
}

function draftIsIndoor(activityKey: string, activityType: ActivityType, pool: boolean): boolean {
  return activityKey === 'treadmill_running'
    || activityType === 'indoor_cycling'
    || activityType === 'elliptical'
    || activityType === 'rowing'
    || activityType === 'stair_climbing'
    || activityType === 'strength'
    || activityType === 'mobility'
    || (activityType === 'swimming' && pool);
}

export default function ManualActivityScreen() {
  const C = useColors();
  const router = useRouter();
  const params = useLocalSearchParams<{
    scheduledSessionId?: string;
    activityId?: string;
    activityType?: string;
    mode?: string;
  }>();
  const weekPlan = useWeekPlan();
  const scheduled = useScheduledSessions(weekPlan);
  const activities = useActivityStore(state => state.activities);
  const addActivity = useActivityStore(state => state.addActivity);
  const recalculationStatus = useRecalculationStore(state => state.status);
  const recalculationError = useRecalculationStore(state => state.error);
  const routes = useRouteStore(state => state.routes);
  const shoes = useGearStore(state => state.shoes);
  const defaultShoeId = useGearStore(state => state.defaultShoeId);
  const scheduledSession = params.scheduledSessionId ? scheduled.getSessionById(params.scheduledSessionId) : null;
  const linkedActivity = params.scheduledSessionId
    ? scheduled.getCompletedActivityForScheduledSession(params.scheduledSessionId)
    : null;
  const editedActivity = params.activityId
    ? activities.find(activity => activity.id === params.activityId)
    : null;
  const prefillActivity = editedActivity ?? linkedActivity;
  // An explicit ?activityType= param (e.g. the indoor-ride screen's "Log
  // Completed Ride" link) only wins when there's nothing to prefill from —
  // an existing linked/edited activity's own type always takes priority.
  const paramTypeKey = !prefillActivity ? findTypeEntry(params.activityType, undefined)?.key : undefined;
  const initialType = prefillActivity?.activityType ?? activityTypeFromScheduledSession(scheduledSession);
  const initialKey = scheduledSession?.activityType === 'run_walk' || prefillActivity?.subtype === 'run_walk'
    ? 'run_walk'
    : prefillActivity?.subtype === 'treadmill'
      ? 'treadmill_running'
      : paramTypeKey
        ?? findTypeEntry(initialType, prefillActivity?.subtype)?.key
        ?? 'running';
  const initialDurationSeconds = prefillActivity?.metrics.durationSeconds ?? (scheduledSession ? scheduledSession.durationMinutes * 60 : 45 * 60);
  const initialStartTime = prefillActivity?.startTime ?? Date.now();

  const [activityKey, setActivityKey] = useState(initialKey);
  const selectedType = TYPES.find(item => item.key === activityKey) ?? TYPES[0]!;
  const activityType = selectedType.type;
  const [completionState, setCompletionState] = useState<CompletionState>(prefillActivity?.status === 'partial' ? 'partial' : 'completed_as_planned');
  const [durationMinutes, setDurationMinutes] = useState(String(Math.round(initialDurationSeconds / 60)));
  const [activityDate, setActivityDate] = useState(timestampToDateOnly(initialStartTime));
  const [refreshResult, setRefreshResult] = useState<'idle' | 'success' | 'error'>('idle');
  const [distance, setDistance] = useState('');
  const [distanceUnit, setDistanceUnit] = useState<'mi' | 'km'>('mi');
  const [averageHr, setAverageHr] = useState('');
  const [maximumHr, setMaximumHr] = useState('');
  const [rpe, setRpe] = useState('5');
  const [laps, setLaps] = useState('');
  const [cadence, setCadence] = useState('');
  const [power, setPower] = useState('');
  const [rounds, setRounds] = useState('');
  const [notes, setNotes] = useState('');
  const [routeId, setRouteId] = useState<string | null>(prefillActivity?.metrics.routeId ?? null);
  const [shoeId, setShoeId] = useState<string | null>(prefillActivity?.shoeId ?? defaultShoeId ?? null);
  const [pool, setPool] = useState(true);
  const hydratedRef = useRef(false);

  useEffect(() => {
    if (hydratedRef.current || !prefillActivity) return;
    hydratedRef.current = true;
    setDurationMinutes(String(Math.round((prefillActivity.metrics.durationSeconds ?? 0) / 60)));
    if (prefillActivity.metrics.distanceMeters) setDistance((prefillActivity.metrics.distanceMeters / 1609.344).toFixed(2));
    if (prefillActivity.metrics.averageHeartRateBpm) setAverageHr(String(prefillActivity.metrics.averageHeartRateBpm));
    if (prefillActivity.metrics.maximumHeartRateBpm) setMaximumHr(String(prefillActivity.metrics.maximumHeartRateBpm));
    if (prefillActivity.rpe) setRpe(String(prefillActivity.rpe));
    if (prefillActivity.notes) setNotes(prefillActivity.notes);
    setActivityDate(timestampToDateOnly(prefillActivity.startTime));
  }, [prefillActivity]);

  const isSwim = activityType === 'swimming';
  const isBike = activityType === 'cycling' || activityType === 'indoor_cycling';
  const isMixed = activityType === 'hiit' || activityType === 'mixed_modal';
  const isStrength = activityType === 'strength';
  // Distance/pace only mean something for activities actually measured that
  // way — strength, mobility, HIIT/mixed conditioning, and Active Recovery
  // never force a running-only distance+pace UI onto the athlete.
  const showDistancePace = isPaceBasedActivity(activityType) || isSpeedBasedActivity(activityType) || isSwim;
  const showShoePicker = ['running', 'walking', 'hiking'].includes(activityType);
  const paceOrSpeed = useMemo(() => calculatePaceOrSpeed(
    activityType,
    numeric(distance),
    distanceUnit,
    Math.round((numeric(durationMinutes) ?? 0) * 60),
    distanceUnit,
  ), [activityType, distance, distanceUnit, durationMinutes]);

  // When the athlete is logging against a scheduled session whose category
  // doesn't match what they actually picked (e.g. the schedule says a run,
  // they're logging cycling), the substitution matrix decides the default
  // classification — never a silent 'completed_as_prescribed'. Gated pairs
  // (e.g. running -> cycling) need an explicit chooser before the log can
  // count toward the scheduled session at all.
  const scheduledCategory = scheduledSession ? categoryFromScheduledType(scheduledSession.activityType) : null;
  const actualCategory = categoryFromActivityType(activityType, selectedType.subtype);
  const categoryMismatch = Boolean(scheduledSession) && scheduledCategory !== actualCategory;

  async function refreshTrainingPlan() {
    setRefreshResult('idle');
    try {
      await runRecalculation('manual_refresh', activities);
      setRefreshResult('success');
    } catch {
      setRefreshResult('error');
    }
  }

  function commitSave(options: { unlinkSchedule?: boolean; classification?: ReturnType<typeof classifySubstitution>['classification'] } = {}) {
    const minutes = numeric(durationMinutes) ?? 1;
    const effectiveScheduledSession = options.unlinkSchedule ? null : scheduledSession;
    const startTime = dateOnlyToLocalTimestamp(activityDate);
    const draft = buildManualActivityDraft(effectiveScheduledSession, {
      activityType,
      completionState,
      startTime,
      durationMinutes: minutes,
      distance: numeric(distance),
      distanceUnit,
      averageHeartRateBpm: numeric(averageHr),
      maximumHeartRateBpm: numeric(maximumHr),
      rpe: Math.max(1, Math.min(10, numeric(rpe) ?? 5)),
      cadenceRpm: isBike ? numeric(cadence) : undefined,
      routeId: draftIsIndoor(selectedType.key, activityType, pool) ? undefined : routeId ?? undefined,
      notes,
      indoor: activityType === 'indoor_cycling'
        || selectedType.subtype === 'treadmill'
        || activityType === 'elliptical'
        || activityType === 'rowing'
        || activityType === 'stair_climbing'
        || activityType === 'strength'
        || activityType === 'mobility'
        || (isSwim && pool),
    });
    const activityId = addActivity({
      ...draft,
      id: prefillActivity?.id,
      subtype: isSwim ? (pool ? 'pool' : 'open_water') : selectedType.subtype ?? draft.subtype,
      completionClassification: options.classification ?? draft.completionClassification,
      status: options.classification ? activityStatusForClassification(options.classification) : draft.status,
      shoeId: showShoePicker ? shoeId ?? undefined : undefined,
      metrics: {
        ...draft.metrics,
        routeCoordinates: routeId && !draftIsIndoor(selectedType.key, activityType, pool)
          ? routes.find(route => route.id === routeId)?.points.map(point => ({ ...point, timestamp: Date.now() }))
          : undefined,
        cadenceRpm: isBike ? numeric(cadence) : draft.metrics.cadenceRpm,
        cyclingPowerWatts: isBike ? numeric(power) : undefined,
        swimming: isSwim ? {
          environment: pool ? 'pool' : 'open_water',
          distanceUnit: 'yd',
          laps: numeric(laps),
        } : undefined,
        mixedModal: isMixed ? { rounds: numeric(rounds) } : undefined,
      },
    });
    router.replace({ pathname: '/(tabs)/activity/[activityId]', params: { activityId } } as never);
  }

  function save() {
    if (!categoryMismatch || !scheduledCategory) {
      commitSave();
      return;
    }
    const substitution = classifySubstitution({
      scheduledCategory,
      actualCategory,
      intentMatch: false, // manual entry doesn't know finer same-category intent — matrix falls back conservatively
    });
    if (!substitution.requiresExplicitAcceptance) {
      commitSave({ classification: substitution.classification });
      return;
    }
    Alert.alert(
      'This doesn’t match the scheduled session',
      'The scheduled session is a different type of workout. How should this be recorded?',
      [
        {
          text: 'Count Toward Scheduled Workout as Substitute',
          onPress: () => commitSave({ classification: 'equivalent_substitute' }),
        },
        {
          text: 'Log as Separate Activity',
          onPress: () => commitSave({ unlinkSchedule: true, classification: undefined }),
        },
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  }

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: C.bg }]} edges={['top']}>
      <KeyboardAvoidingView style={s.safe} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScreenHeader
          eyebrow={scheduledSession ? 'WORKOUT COMPLETION' : 'QUICK ENTRY'}
          title={scheduledSession ? 'Complete Workout' : prefillActivity ? 'Edit Activity' : 'Log Activity'}
          onBack={() => router.back()}
          right={(
            <TouchableOpacity onPress={save} style={[s.saveButton, { backgroundColor: C.primary }]}>
              <Text style={[s.saveText, { color: C.onPrimary }]}>Save</Text>
            </TouchableOpacity>
          )}
        />
        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
          {scheduledSession ? (
            <View style={[s.card, { backgroundColor: C.card, borderColor: C.border }]}>
              <Text style={[s.label, { color: C.textDim, marginTop: 0 }]}>PLANNED WORKOUT</Text>
              <Text style={[s.fieldTitle, { color: C.text }]}>{scheduledSession.title}</Text>
              <Text style={[s.helper, { color: C.textMuted }]}>
                {scheduledSession.durationMinutes} min · {scheduledSession.target}
              </Text>
              {scheduledSession.runWalk ? (
                <Text style={[s.helper, { color: C.textMuted }]}>
                  {scheduledSession.runWalk.rounds} rounds · {scheduledSession.runWalk.runSeconds} sec run / {scheduledSession.runWalk.walkSeconds} sec walk
                </Text>
              ) : null}
              {scheduledSession.strengthSession ? (
                <Text style={[s.helper, { color: C.textMuted }]}>
                  {scheduledSession.strengthSession.exercises.length} exercises · prescribed work is preserved separately from this activity log.
                </Text>
              ) : null}
            </View>
          ) : null}

          <Text style={[s.label, { color: C.textDim }]}>WHEN</Text>
          <View style={s.grid}>
            <View style={s.fullWidthField}>
              <StrideDateField
                label="Activity Date"
                value={activityDate}
                onChange={setActivityDate}
                title="Activity Date"
                maxDate={todayDateOnly()}
                helper="Backdated activities stay on the selected calendar day and can refresh future plan decisions."
                accessibilityHint="Opens a calendar. Future activity dates are disabled."
              />
            </View>
          </View>

          <Text style={[s.label, { color: C.textDim }]}>COMPLETION STATE</Text>
          <View style={s.pills}>
            {[
              ['completed_as_planned', 'As planned'],
              ['modified', 'Modified'],
              ['partial', 'Partial'],
              ['stopped_early', 'Stopped early'],
            ].map(([key, label]) => (
              <TouchableOpacity
                key={key}
                onPress={() => setCompletionState(key as CompletionState)}
                style={[s.pill, {
                  backgroundColor: key === completionState ? C.primaryDim : C.card,
                  borderColor: key === completionState ? C.primary : C.border,
                }]}
              >
                <Text style={[s.pillText, { color: key === completionState ? C.primary : C.textMuted }]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[s.label, { color: C.textDim }]}>ACTIVITY</Text>
          <View style={s.pills}>
            {TYPES.map(item => (
              <TouchableOpacity
                key={item.key}
                onPress={() => setActivityKey(item.key)}
                style={[s.pill, {
                  backgroundColor: item.key === activityKey ? C.primaryDim : C.card,
                  borderColor: item.key === activityKey ? C.primary : C.border,
                }]}
              >
                <Text style={[s.pillText, { color: item.key === activityKey ? C.primary : C.textMuted }]}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {isSwim ? (
            <View style={[s.card, { backgroundColor: C.card, borderColor: C.border }]}>
              <View style={s.row}>
                <View>
                  <Text style={[s.fieldTitle, { color: C.text }]}>Pool swim</Text>
                  <Text style={[s.helper, { color: C.textMuted }]}>Turn off for open water.</Text>
                </View>
                <Switch value={pool} onValueChange={setPool} trackColor={{ true: C.primary }} />
              </View>
            </View>
          ) : null}

          <View style={s.grid}>
            <Field label="Duration" value={durationMinutes} onChange={setDurationMinutes} suffix="min" />
            {showDistancePace ? <Field label="Distance" value={distance} onChange={setDistance} suffix={distanceUnit} optional /> : null}
            <Field label="Average HR" value={averageHr} onChange={setAverageHr} suffix="bpm" optional />
            <Field label="Maximum HR" value={maximumHr} onChange={setMaximumHr} suffix="bpm" optional />
            <Field label="RPE" value={rpe} onChange={setRpe} suffix="/10" />
            {isSwim ? <Field label="Laps" value={laps} onChange={setLaps} optional /> : null}
            {isBike ? <Field label="Cadence" value={cadence} onChange={setCadence} suffix="rpm" optional /> : null}
            {isBike ? <Field label="Average power" value={power} onChange={setPower} suffix="W" optional /> : null}
            {isMixed ? <Field label="Rounds" value={rounds} onChange={setRounds} optional /> : null}
          </View>
          {showDistancePace ? (
            <View style={s.unitRow}>
              <TouchableOpacity
                style={[s.unitButton, { backgroundColor: distanceUnit === 'mi' ? C.primaryDim : C.card, borderColor: distanceUnit === 'mi' ? C.primary : C.border }]}
                onPress={() => setDistanceUnit('mi')}
              >
                <Text style={[s.pillText, { color: distanceUnit === 'mi' ? C.primary : C.textMuted }]}>Miles</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.unitButton, { backgroundColor: distanceUnit === 'km' ? C.primaryDim : C.card, borderColor: distanceUnit === 'km' ? C.primary : C.border }]}
                onPress={() => setDistanceUnit('km')}
              >
                <Text style={[s.pillText, { color: distanceUnit === 'km' ? C.primary : C.textMuted }]}>Kilometers</Text>
              </TouchableOpacity>
              <View style={[s.paceBadge, { backgroundColor: C.card, borderColor: C.border }]}>
                <Text style={[s.fieldLabel, { color: C.textDim }]}>{paceOrSpeed.kind === 'speed' ? 'AVG SPEED' : 'AVG PACE'}</Text>
                <Text style={[s.paceText, { color: C.text }]}>{paceOrSpeed.label}</Text>
              </View>
            </View>
          ) : null}
          {isStrength && scheduledSession?.strengthSession ? (
            <View style={[s.card, { backgroundColor: C.card, borderColor: C.border }]}>
              <Text style={[s.label, { color: C.textDim, marginTop: 0 }]}>PRESCRIBED STRENGTH WORK</Text>
              {scheduledSession.strengthSession.exercises.map(item => (
                <Text key={item.exercise.id} style={[s.helper, { color: C.textMuted }]}>
                  {displayLabel(item.exercise.name)} · {formatPrescriptionWithSets(item.sets, item.repScheme, `${item.repRange[0]}-${item.repRange[1]} reps`)}
                </Text>
              ))}
            </View>
          ) : null}
          {showDistancePace && !draftIsIndoor(selectedType.key, activityType, pool) ? (
            <>
              <Text style={[s.label, { color: C.textDim }]}>OPTIONAL ROUTE</Text>
              <View style={s.pills}>
                <TouchableOpacity
                  onPress={() => setRouteId(null)}
                  style={[s.pill, {
                    backgroundColor: routeId === null ? C.primaryDim : C.card,
                    borderColor: routeId === null ? C.primary : C.border,
                  }]}
                >
                  <Text style={[s.pillText, { color: routeId === null ? C.primary : C.textMuted }]}>No route</Text>
                </TouchableOpacity>
                {routes.slice(0, 6).map(route => (
                  <TouchableOpacity
                    key={route.id}
                    onPress={() => setRouteId(route.id)}
                    style={[s.pill, {
                      backgroundColor: routeId === route.id ? C.primaryDim : C.card,
                      borderColor: routeId === route.id ? C.primary : C.border,
                    }]}
                  >
                    <Text style={[s.pillText, { color: routeId === route.id ? C.primary : C.textMuted }]}>{route.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          ) : null}
          {showShoePicker && shoes.length > 0 ? (
            <>
              <Text style={[s.label, { color: C.textDim }]}>SHOES</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.shoeSelector}>
                <TouchableOpacity
                  onPress={() => setShoeId(null)}
                  style={[s.shoeChoice, {
                    backgroundColor: shoeId === null ? C.primaryDim : C.card,
                    borderColor: shoeId === null ? C.primary : C.border,
                  }]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: shoeId === null }}
                >
                  <View style={[s.shoeThumb, { backgroundColor: C.cardAlt }]}>
                    <Ionicons name="remove-circle-outline" size={22} color={shoeId === null ? C.primary : C.textMuted} />
                  </View>
                  <Text style={[s.pillText, { color: shoeId === null ? C.primary : C.textMuted }]}>No shoe</Text>
                </TouchableOpacity>
                {shoes.filter(shoe => shoe.active).map(shoe => (
                  <TouchableOpacity
                    key={shoe.id}
                    onPress={() => setShoeId(shoe.id)}
                    style={[s.shoeChoice, {
                      backgroundColor: shoeId === shoe.id ? C.primaryDim : C.card,
                      borderColor: shoeId === shoe.id ? C.primary : C.border,
                    }]}
                    accessibilityRole="button"
                    accessibilityLabel={`Select ${shoe.brand} ${shoe.model}`}
                    accessibilityState={{ selected: shoeId === shoe.id }}
                  >
                    <View style={[s.shoeThumb, { backgroundColor: C.cardAlt }]}>
                      {shoe.imageUri ? (
                        <Image source={{ uri: shoe.imageUri }} style={s.shoeImage} resizeMode="cover" />
                      ) : (
                        <Ionicons name="walk-outline" size={22} color={shoeId === shoe.id ? C.primary : C.textMuted} />
                      )}
                    </View>
                    <Text style={[s.pillText, { color: shoeId === shoe.id ? C.primary : C.textMuted }]}>{shoe.brand} {shoe.model}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </>
          ) : null}
          <Text style={[s.label, { color: C.textDim }]}>NOTES</Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            multiline
            placeholder="How did it feel? Add useful context."
            placeholderTextColor={C.textMuted}
            style={[s.notes, { color: C.text, backgroundColor: C.card, borderColor: C.border }]}
          />
          <Text style={[s.helper, { color: C.textMuted }]}>
            Only useful fields are saved. Missing optional metrics remain absent rather than appearing as blank cards.
            {scheduledSession ? ' Planned workout details stay unchanged; this record stores what you actually completed.' : ''}
          </Text>
          <TouchableOpacity
            onPress={refreshTrainingPlan}
            disabled={recalculationStatus === 'running'}
            activeOpacity={0.76}
            style={[s.refreshPlanButton, { backgroundColor: C.card, borderColor: refreshResult === 'error' ? C.critical : C.border }]}
            accessibilityRole="button"
            accessibilityLabel="Refresh Training Plan"
            accessibilityHint="Recalculates future training guidance from chronologically sorted activity history."
          >
            <View style={[s.refreshIcon, { backgroundColor: C.primaryDim }]}>
              <Ionicons name="refresh-outline" size={18} color={C.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.fieldTitle, { color: C.text }]}>Refresh Training Plan</Text>
              <Text style={[s.helper, { color: refreshResult === 'error' ? C.critical : C.textMuted }]}>
                {recalculationStatus === 'running'
                  ? 'Refreshing future planning, adherence, load, gear mileage, reports, and coach context...'
                  : refreshResult === 'success'
                    ? 'Training plan refreshed from saved history.'
                    : refreshResult === 'error'
                      ? recalculationError ?? 'Refresh failed. Try again after saving.'
                      : 'Use after entering, editing, or deleting backdated activity history.'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={C.textMuted} />
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ label, value, onChange, suffix, optional }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  suffix?: string;
  optional?: boolean;
}) {
  const C = useColors();
  return (
    <View style={[s.field, { backgroundColor: C.card, borderColor: C.border }]}>
      <Text style={[s.fieldLabel, { color: C.textDim }]}>{label.toUpperCase()}{optional ? ' · OPTIONAL' : ''}</Text>
      <View style={s.fieldRow}>
        <TextInput value={value} onChangeText={onChange} keyboardType="decimal-pad" placeholder="--" placeholderTextColor={C.textMuted} style={[s.input, { color: C.text }]} />
        {suffix ? <Text style={[s.suffix, { color: C.textMuted }]}>{suffix}</Text> : null}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  saveButton: { minWidth: 70, minHeight: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  saveText: { fontSize: 13, fontWeight: '900' },
  content: { paddingHorizontal: 18, paddingBottom: 120 },
  label: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2, marginBottom: 9, marginTop: 10 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  pill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  pillText: { fontSize: 12, fontWeight: '800' },
  card: { borderWidth: 1, borderRadius: 15, padding: 14, marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  timeZoneCard: { borderWidth: 1, borderRadius: 15, padding: 13, marginBottom: 10, flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  fieldTitle: { fontSize: 14, fontWeight: '900' },
  helper: { fontSize: 11, lineHeight: 16, marginTop: 5 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  fullWidthField: { width: '100%' },
  unitRow: { flexDirection: 'row', alignItems: 'stretch', gap: 8, marginTop: 10, marginBottom: 4, flexWrap: 'wrap' },
  unitButton: { minHeight: 42, borderRadius: 13, borderWidth: 1, paddingHorizontal: 13, alignItems: 'center', justifyContent: 'center' },
  paceBadge: { minHeight: 42, borderRadius: 13, borderWidth: 1, paddingHorizontal: 13, justifyContent: 'center', flexGrow: 1 },
  paceText: { fontSize: 16, fontWeight: '900', marginTop: 2 },
  field: { width: '48%', borderWidth: 1, borderRadius: 15, padding: 13, minHeight: 78 },
  fieldLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 0.7 },
  fieldRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 5 },
  input: { flex: 1, fontSize: 21, fontWeight: '900', padding: 0 },
  suffix: { fontSize: 12, fontWeight: '700' },
  notes: { minHeight: 110, borderWidth: 1, borderRadius: 15, padding: 14, textAlignVertical: 'top', fontSize: 14 },
  shoeSelector: { gap: 10, paddingRight: 18, paddingBottom: 4 },
  shoeChoice: { width: 132, minHeight: 122, borderWidth: 1, borderRadius: 16, padding: 12, justifyContent: 'space-between' },
  shoeThumb: { height: 56, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginBottom: 10, overflow: 'hidden' },
  shoeImage: { width: '100%', height: '100%' },
  refreshPlanButton: { minHeight: 70, borderWidth: 1, borderRadius: 16, padding: 13, flexDirection: 'row', gap: 12, alignItems: 'center', marginTop: 14 },
  refreshIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
});
