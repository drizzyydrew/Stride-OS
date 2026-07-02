import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { router } from 'expo-router';

import { useAthleteStore }                                from '../../../src/store/athleteStore';
import { useProfileStore, useActiveProfile, useCalibration } from '../../../src/store/profileStore';
import { useOnboardingStore }                             from '../../../src/store/onboardingStore';

import ScreenLayout             from '../../../src/layout/ScreenLayout';
import Card                     from '../../../src/components/ui/Card';
import FieldInput               from '../../../src/components/ui/FieldInput';
import FieldStepper             from '../../../src/components/ui/FieldStepper';
import FieldPicker              from '../../../src/components/ui/FieldPicker';

import ProfileOverviewCard      from '../../../src/components/profile/ProfileOverviewCard';
import CalibrationStatusCard    from '../../../src/components/profile/CalibrationStatusCard';
import PaceZoneCard             from '../../../src/components/profile/PaceZoneCard';
import HRZoneCard               from '../../../src/components/profile/HRZoneCard';
import ThresholdZoneCard        from '../../../src/components/profile/ThresholdZoneCard';
import ZoneComparisonCard       from '../../../src/components/profile/ZoneComparisonCard';
import MAFCard                  from '../../../src/components/profile/MAFCard';
import SourcesMethodsCard       from '../../../src/components/profile/SourcesMethodsCard';
import TrainingAvailabilityCard from '../../../src/components/profile/TrainingAvailabilityCard';
import RaceHistoryCard          from '../../../src/components/profile/RaceHistoryCard';

import { formatPace }           from '../../../src/utils/calibrationEngine';
import { useThemeColors, type ThemeColors } from '../../../src/theme/ThemeContext';
import { spacing }              from '../../../src/theme/spacing';
import { FontSize, FontWeight, Radius } from '../../../src/theme/tokens';

import type {
  Sex, TrainingDay, StandardDistance, RacePR,
  MAFTestRecord, ThresholdTestData, ZoneMethod,
} from '../../../src/types/athlete';
import type { ProgressionLevel } from '../../../src/types/training';

// ─── Constants ────────────────────────────────────────────────────────────────

const SEX_OPTIONS: { value: Sex; label: string }[] = [
  { value: 'male',              label: 'Male'   },
  { value: 'female',            label: 'Female' },
  { value: 'non_binary',        label: 'Other'  },
  { value: 'prefer_not_to_say', label: '—'      },
];

const PROGRESSION_OPTIONS: { value: ProgressionLevel; label: string }[] = [
  { value: 'beginner',     label: 'Beginner'     },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced',     label: 'Advanced'     },
];

const ALL_DAYS: TrainingDay[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const STANDARD_DISTANCES: { value: StandardDistance | 'custom'; label: string; meters: number }[] = [
  { value: 'marathon',      label: 'Marathon',      meters: 42195    },
  { value: 'half_marathon', label: 'Half Marathon', meters: 21097.5  },
  { value: '10k',           label: '10K',           meters: 10000    },
  { value: '5k',            label: '5K',            meters: 5000     },
  { value: '1_mile',        label: '1 Mile',        meters: 1609.344 },
  { value: '800m',          label: '800m',          meters: 800      },
];

// ─── Add-PR modal ─────────────────────────────────────────────────────────────

type AddPRModalProps = {
  visible:  boolean;
  onClose:  () => void;
  onSubmit: (pr: Omit<RacePR, 'id'>) => void;
};

function AddPRModal({ visible, onClose, onSubmit }: AddPRModalProps) {
  const colors = useThemeColors();
  const modal  = useMemo(() => createModalStyles(colors), [colors]);

  const [distanceKey, setDistanceKey] = useState<StandardDistance | 'custom'>('5k');
  const [hours,   setHours]   = useState(0);
  const [minutes, setMinutes] = useState(25);
  const [seconds, setSeconds] = useState(0);
  const [dateStr, setDateStr] = useState('');
  const [official, setOfficial] = useState(true);

  function handleSubmit() {
    const dist = STANDARD_DISTANCES.find(d => d.value === distanceKey);
    if (!dist) return;
    const totalSeconds = hours * 3600 + minutes * 60 + seconds;
    if (totalSeconds <= 0) return;
    const today = new Date().toISOString().slice(0, 10);
    onSubmit({
      distanceKey,
      distanceLabel:  dist.label,
      distanceMeters: dist.meters,
      timeSeconds:    totalSeconds,
      date:           dateStr || today,
      official,
    });
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" transparent presentationStyle="overFullScreen">
      <View style={modal.overlay}>
        <View style={modal.sheet}>
          <Text style={modal.title}>Add Race PR</Text>

          <Text style={modal.fieldLabel}>DISTANCE</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={modal.pillScroll}>
            <View style={modal.pillRow}>
              {STANDARD_DISTANCES.map(d => {
                const active = distanceKey === d.value;
                return (
                  <Pressable
                    key={d.value}
                    onPress={() => setDistanceKey(d.value)}
                    style={[modal.pill, active && modal.pillActive]}
                  >
                    <Text style={[modal.pillText, active && modal.pillTextActive]}>{d.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>

          <Text style={modal.fieldLabel}>TIME</Text>
          <View style={modal.timeRow}>
            {([
              { label: 'hrs', val: hours,   setVal: setHours,   max: 9  },
              { label: 'min', val: minutes, setVal: setMinutes, max: 59 },
              { label: 'sec', val: seconds, setVal: setSeconds, max: 59 },
            ] as const).map((unit, i) => (
              <View key={unit.label} style={{ flexDirection: 'row', alignItems: 'center', flex: i === 0 ? 0 : 1 }}>
                {i > 0 && <Text style={modal.timeSep}>:</Text>}
                <View style={modal.timeUnit}>
                  <Text style={modal.timeValue}>{String(unit.val).padStart(2, '0')}</Text>
                  <Text style={modal.timeUnitLabel}>{unit.label}</Text>
                  <View style={modal.timeBtns}>
                    <Pressable style={modal.timeBtn} onPress={() => unit.setVal((v: number) => Math.max(0, v - 1))}>
                      <Text style={modal.timeBtnText}>−</Text>
                    </Pressable>
                    <Pressable style={modal.timeBtn} onPress={() => unit.setVal((v: number) => Math.min(unit.max, v + 1))}>
                      <Text style={modal.timeBtnText}>+</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            ))}
          </View>

          <FieldInput
            label="Race Date (YYYY-MM-DD)"
            value={dateStr}
            onChange={setDateStr}
            placeholder={new Date().toISOString().slice(0, 10)}
            autoCapitalize="none"
          />

          <View style={modal.toggleRow}>
            <Text style={modal.fieldLabel}>RESULT TYPE</Text>
            <View style={modal.togglePills}>
              <Pressable
                style={[modal.togglePill, official && modal.togglePillActive]}
                onPress={() => setOfficial(true)}
              >
                <Text style={[modal.togglePillText, official && modal.togglePillTextActive]}>Race Result</Text>
              </Pressable>
              <Pressable
                style={[modal.togglePill, !official && modal.togglePillActive]}
                onPress={() => setOfficial(false)}
              >
                <Text style={[modal.togglePillText, !official && modal.togglePillTextActive]}>Time Trial</Text>
              </Pressable>
            </View>
          </View>

          <View style={modal.actions}>
            <TouchableOpacity style={modal.cancelBtn} onPress={onClose}>
              <Text style={modal.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={modal.submitBtn} onPress={handleSubmit}>
              <Text style={modal.submitText}>Add PR</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Add-Threshold-Test modal ─────────────────────────────────────────────────

type AddThresholdTestModalProps = {
  visible:  boolean;
  onClose:  () => void;
  onSubmit: (test: Omit<ThresholdTestData, 'id'>) => void;
};

function AddThresholdTestModal({ visible, onClose, onSubmit }: AddThresholdTestModalProps) {
  const colors = useThemeColors();
  const modal  = useMemo(() => createModalStyles(colors), [colors]);

  const [dateStr,  setDateStr]  = useState('');
  const [avgHR,    setAvgHR]    = useState(162);
  const [paceMin,  setPaceMin]  = useState(7);
  const [paceSec,  setPaceSec]  = useState(30);
  const [notes,    setNotes]    = useState('');

  function handleSubmit() {
    const today   = new Date().toISOString().slice(0, 10);
    const secPerMi = paceMin * 60 + paceSec;
    if (avgHR < 100 || secPerMi <= 0) return;
    onSubmit({
      date:                      dateStr || today,
      avgHRLastTwentyMin:        avgHR,
      avgPaceSecPerMiLastTwenty: secPerMi,
      notes:                     notes.trim() || undefined,
    });
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" transparent presentationStyle="overFullScreen">
      <View style={modal.overlay}>
        <View style={modal.sheet}>
          <Text style={modal.title}>30-Min Threshold Test</Text>
          <Text style={modal.subtitle}>
            Record avg HR and pace from the last 20 minutes of your 30-minute max effort run.
          </Text>

          <FieldInput
            label="Date (YYYY-MM-DD)"
            value={dateStr}
            onChange={setDateStr}
            placeholder={new Date().toISOString().slice(0, 10)}
            autoCapitalize="none"
          />

          <View style={modal.stepperRow}>
            <Text style={modal.fieldLabel}>AVG HR (LAST 20 MIN)</Text>
            <View style={modal.stepperInline}>
              <Pressable style={modal.timeBtn} onPress={() => setAvgHR(v => Math.max(100, v - 1))}>
                <Text style={modal.timeBtnText}>−</Text>
              </Pressable>
              <Text style={modal.stepperValue}>{avgHR} bpm</Text>
              <Pressable style={modal.timeBtn} onPress={() => setAvgHR(v => Math.min(220, v + 1))}>
                <Text style={modal.timeBtnText}>+</Text>
              </Pressable>
            </View>
          </View>

          <Text style={modal.fieldLabel}>AVG PACE (LAST 20 MIN)</Text>
          <View style={modal.timeRow}>
            <View style={modal.timeUnit}>
              <Text style={modal.timeValue}>{String(paceMin).padStart(2, '0')}</Text>
              <Text style={modal.timeUnitLabel}>min</Text>
              <View style={modal.timeBtns}>
                <Pressable style={modal.timeBtn} onPress={() => setPaceMin(v => Math.max(3, v - 1))}>
                  <Text style={modal.timeBtnText}>−</Text>
                </Pressable>
                <Pressable style={modal.timeBtn} onPress={() => setPaceMin(v => Math.min(20, v + 1))}>
                  <Text style={modal.timeBtnText}>+</Text>
                </Pressable>
              </View>
            </View>
            <Text style={modal.timeSep}>:</Text>
            <View style={modal.timeUnit}>
              <Text style={modal.timeValue}>{String(paceSec).padStart(2, '0')}</Text>
              <Text style={modal.timeUnitLabel}>sec</Text>
              <View style={modal.timeBtns}>
                <Pressable style={modal.timeBtn} onPress={() => setPaceSec(v => Math.max(0, v - 1))}>
                  <Text style={modal.timeBtnText}>−</Text>
                </Pressable>
                <Pressable style={modal.timeBtn} onPress={() => setPaceSec(v => Math.min(59, v + 1))}>
                  <Text style={modal.timeBtnText}>+</Text>
                </Pressable>
              </View>
            </View>
            <Text style={modal.timeSuffix}>/mi</Text>
          </View>

          <FieldInput
            label="Notes (optional)"
            value={notes}
            onChange={setNotes}
            placeholder="Conditions, effort level, etc."
          />

          <View style={modal.actions}>
            <TouchableOpacity style={modal.cancelBtn} onPress={onClose}>
              <Text style={modal.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={modal.submitBtn} onPress={handleSubmit}>
              <Text style={modal.submitText}>Save Test</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Add-MAF-Test modal ───────────────────────────────────────────────────────

type AddMAFTestModalProps = {
  visible:  boolean;
  mafHR:    number;
  onClose:  () => void;
  onSubmit: (test: Omit<MAFTestRecord, 'id'>) => void;
};

function AddMAFTestModal({ visible, mafHR, onClose, onSubmit }: AddMAFTestModalProps) {
  const colors = useThemeColors();
  const modal  = useMemo(() => createModalStyles(colors), [colors]);

  const [dateStr,      setDateStr]      = useState('');
  const [distanceTenths, setDistanceTenths] = useState(40);  // 40 tenths = 4.0 miles
  const [durationMin,  setDurationMin]  = useState(40);
  const [hrDrift,      setHrDrift]      = useState(5);
  const [notes,        setNotes]        = useState('');

  const distanceMiles  = distanceTenths / 10;
  const avgPaceSecPerMi = durationMin > 0 && distanceMiles > 0
    ? Math.round((durationMin * 60) / distanceMiles)
    : 0;

  function handleSubmit() {
    if (distanceMiles <= 0 || durationMin <= 0) return;
    const today = new Date().toISOString().slice(0, 10);
    onSubmit({
      date:            dateStr || today,
      mafHR,
      distanceMiles,
      durationMin,
      avgPaceSecPerMi,
      hrDriftBPM:      hrDrift,
      notes:           notes.trim() || undefined,
    });
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" transparent presentationStyle="overFullScreen">
      <View style={modal.overlay}>
        <View style={modal.sheet}>
          <Text style={modal.title}>Log MAF Test</Text>
          <Text style={modal.subtitle}>
            Run at or below your MAF HR ({mafHR} bpm) for the full duration.
            HR drift = difference between first-half and second-half avg HR.
          </Text>

          <FieldInput
            label="Date (YYYY-MM-DD)"
            value={dateStr}
            onChange={setDateStr}
            placeholder={new Date().toISOString().slice(0, 10)}
            autoCapitalize="none"
          />

          <View style={modal.stepperRow}>
            <Text style={modal.fieldLabel}>DISTANCE (MILES)</Text>
            <View style={modal.stepperInline}>
              <Pressable style={modal.timeBtn} onPress={() => setDistanceTenths(v => Math.max(5, v - 5))}>
                <Text style={modal.timeBtnText}>−</Text>
              </Pressable>
              <Text style={modal.stepperValue}>{distanceMiles.toFixed(1)} mi</Text>
              <Pressable style={modal.timeBtn} onPress={() => setDistanceTenths(v => Math.min(200, v + 5))}>
                <Text style={modal.timeBtnText}>+</Text>
              </Pressable>
            </View>
          </View>

          <View style={modal.stepperRow}>
            <Text style={modal.fieldLabel}>DURATION (MINUTES)</Text>
            <View style={modal.stepperInline}>
              <Pressable style={modal.timeBtn} onPress={() => setDurationMin(v => Math.max(5, v - 1))}>
                <Text style={modal.timeBtnText}>−</Text>
              </Pressable>
              <Text style={modal.stepperValue}>{durationMin} min</Text>
              <Pressable style={modal.timeBtn} onPress={() => setDurationMin(v => Math.min(240, v + 1))}>
                <Text style={modal.timeBtnText}>+</Text>
              </Pressable>
            </View>
          </View>

          {avgPaceSecPerMi > 0 && (
            <Text style={modal.computedPace}>
              Avg pace: {formatPace(avgPaceSecPerMi)}/mi
            </Text>
          )}

          <View style={modal.stepperRow}>
            <Text style={modal.fieldLabel}>HR DRIFT (BPM)</Text>
            <View style={modal.stepperInline}>
              <Pressable style={modal.timeBtn} onPress={() => setHrDrift(v => Math.max(0, v - 1))}>
                <Text style={modal.timeBtnText}>−</Text>
              </Pressable>
              <Text style={modal.stepperValue}>+{hrDrift} bpm</Text>
              <Pressable style={modal.timeBtn} onPress={() => setHrDrift(v => Math.min(50, v + 1))}>
                <Text style={modal.timeBtnText}>+</Text>
              </Pressable>
            </View>
          </View>

          <FieldInput
            label="Notes (optional)"
            value={notes}
            onChange={setNotes}
            placeholder="Temperature, terrain, effort, etc."
          />

          <View style={modal.actions}>
            <TouchableOpacity style={modal.cancelBtn} onPress={onClose}>
              <Text style={modal.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={modal.submitBtn} onPress={handleSubmit}>
              <Text style={modal.submitText}>Save Test</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Shared modal stylesheet ──────────────────────────────────────────────────

function createModalStyles(colors: ThemeColors) {
  return StyleSheet.create({
  overlay: {
    flex:            1,
    justifyContent:  'flex-end',
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  sheet: {
    backgroundColor:      colors.card,
    borderTopLeftRadius:  16,
    borderTopRightRadius: 16,
    padding:              spacing.xl,
    gap:                  spacing.md,
    paddingBottom:        40,
  },
  title: {
    color:        colors.text,
    fontSize:     FontSize.lg,
    fontWeight:   FontWeight.black,
    marginBottom: spacing.xs,
  },
  subtitle: {
    color:      colors.textMuted,
    fontSize:   FontSize.xs,
    lineHeight: 16,
    marginTop:  -spacing.xs,
  },
  fieldLabel: {
    color:         colors.textMuted,
    fontSize:      10,
    fontWeight:    FontWeight.black,
    letterSpacing: 0.6,
  },
  pillScroll: { flexGrow: 0 },
  pillRow: { flexDirection: 'row', gap: spacing.xs },
  pill: {
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.sm,
    borderRadius:      Radius.sm,
    backgroundColor:   colors.border,
  },
  pillActive: {
    backgroundColor: colors.primaryDim,
    borderWidth:     1,
    borderColor:     colors.primary,
  },
  pillText: {
    color:      colors.textDim,
    fontSize:   FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  pillTextActive: {
    color:      colors.primary,
    fontWeight: FontWeight.bold,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.sm,
  },
  timeUnit: {
    flex:       1,
    alignItems: 'center',
    gap:        4,
  },
  timeValue: {
    color:      colors.text,
    fontSize:   28,
    fontWeight: FontWeight.black,
    lineHeight: 32,
  },
  timeUnitLabel: {
    color:    colors.textSubtle,
    fontSize: 9,
  },
  timeBtns: {
    flexDirection: 'row',
    gap:           spacing.xs,
  },
  timeBtn: {
    width:           32,
    height:          32,
    borderRadius:    Radius.sm,
    backgroundColor: colors.border,
    alignItems:      'center',
    justifyContent:  'center',
  },
  timeBtnText: {
    color:      colors.text,
    fontSize:   FontSize.md,
    fontWeight: FontWeight.bold,
  },
  timeSep: {
    color:      colors.textSubtle,
    fontSize:   24,
    fontWeight: FontWeight.black,
    marginTop:  -12,
  },
  timeSuffix: {
    color:      colors.textDim,
    fontSize:   FontSize.base,
    fontWeight: FontWeight.medium,
    marginTop:  -12,
  },
  stepperRow: {
    gap: spacing.xs,
  },
  stepperInline: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    backgroundColor: colors.bg,
    borderRadius:   Radius.sm,
    padding:        spacing.sm,
  },
  stepperValue: {
    color:      colors.text,
    fontSize:   FontSize.base,
    fontWeight: FontWeight.black,
  },
  computedPace: {
    color:    colors.primary,
    fontSize: FontSize.xs,
    marginTop: -spacing.sm,
  },
  toggleRow: { gap: spacing.xs },
  togglePills: {
    flexDirection: 'row',
    gap:           spacing.sm,
  },
  togglePill: {
    flex:            1,
    paddingVertical: spacing.sm,
    borderRadius:    Radius.sm,
    backgroundColor: colors.border,
    alignItems:      'center',
  },
  togglePillActive: {
    backgroundColor: colors.primaryDim,
    borderWidth:     1,
    borderColor:     colors.primary,
  },
  togglePillText: {
    color:      colors.textDim,
    fontSize:   FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  togglePillTextActive: {
    color:      colors.primary,
    fontWeight: FontWeight.bold,
  },
  actions: {
    flexDirection: 'row',
    gap:           spacing.sm,
    marginTop:     spacing.sm,
  },
  cancelBtn: {
    flex:            1,
    paddingVertical: spacing.md,
    borderRadius:    Radius.sm,
    backgroundColor: colors.border,
    alignItems:      'center',
  },
  cancelText: {
    color:    colors.textDim,
    fontSize: FontSize.base,
  },
  submitBtn: {
    flex:            1,
    paddingVertical: spacing.md,
    borderRadius:    Radius.sm,
    backgroundColor: colors.primary,
    alignItems:      'center',
  },
  submitText: {
    color:      colors.text,
    fontSize:   FontSize.base,
    fontWeight: FontWeight.bold,
  },
  });
}

// ─── Day selector ─────────────────────────────────────────────────────────────

function DaySelector({
  available,
  onChange,
}: {
  available: TrainingDay[];
  onChange:  (days: TrainingDay[]) => void;
}) {
  const colors = useThemeColors();
  const ds     = useMemo(() => createDsStyles(colors), [colors]);

  const activeSet = new Set(available);

  function toggle(day: TrainingDay) {
    if (activeSet.has(day)) {
      if (available.length <= 1) return;
      onChange(available.filter(d => d !== day));
    } else {
      onChange([...available, day]);
    }
  }

  return (
    <View>
      <Text style={ds.label}>AVAILABLE DAYS</Text>
      <View style={ds.row}>
        {ALL_DAYS.map(d => {
          const active = activeSet.has(d);
          return (
            <Pressable
              key={d}
              onPress={() => toggle(d)}
              style={[ds.cell, active && ds.cellActive]}
            >
              <Text style={[ds.text, active && ds.textActive]}>{d[0]}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function createDsStyles(colors: ThemeColors) {
  return StyleSheet.create({
  label: {
    color:         colors.textMuted,
    fontSize:      10,
    fontWeight:    FontWeight.black,
    letterSpacing: 0.6,
    marginBottom:  spacing.sm,
  },
  row: {
    flexDirection:  'row',
    justifyContent: 'space-between',
  },
  cell: {
    width:          36,
    height:         36,
    borderRadius:   18,
    borderWidth:    1,
    borderColor:    colors.border,
    alignItems:     'center',
    justifyContent: 'center',
  },
  cellActive: {
    backgroundColor: colors.primaryDim,
    borderColor:     colors.primary,
  },
  text: {
    color:      colors.textSubtle,
    fontSize:   FontSize.sm,
    fontWeight: FontWeight.black,
  },
  textActive: {
    color: colors.primary,
  },
  });
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const {
    athleteName,
    goalRace,
    weeklyMileage,
    currentWeek,
    progressionLevel,
    sleepHours,
    restingHRDelta,
    fatigueScore,
    recoveryScore,
    vo2Estimate,
    setAthleteName,
    setGoalRace,
    setWeeklyMileage,
    setCurrentWeek,
    setProgressionLevel,
    setSleepHours,
    setRestingHRDelta,
  } = useAthleteStore();

  const {
    initDefaultProfile, updateActive, addRacePR, removeRacePR, recalibrate,
    setThresholdTest, clearThresholdTest, addMAFTest, setZoneMethod,
  } = useProfileStore();

  const profile     = useActiveProfile();
  const calibration = useCalibration();

  const [localName,    setLocalName]    = useState(athleteName);
  const [localGoal,    setLocalGoal]    = useState(goalRace);
  const [showAddPR,    setShowAddPR]    = useState(false);
  const [showThreshold, setShowThreshold] = useState(false);
  const [showMAF,      setShowMAF]      = useState(false);

  useEffect(() => {
    initDefaultProfile(athleteName, vo2Estimate);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRecalibrate = useCallback(() => {
    recalibrate({
      weeklyMileage,
      currentPhase:         'base',
      recentWorkoutCount:   12,
      lastWorkoutDaysAgo:   1,
      currentFatigueScore:  fatigueScore,
      currentRecoveryScore: recoveryScore,
    });
  }, [recalibrate, weeklyMileage, fatigueScore, recoveryScore]);

  useEffect(() => {
    if (profile && !profile.calibration) {
      handleRecalibrate();
    }
  }, [profile?.athleteId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!profile) return null;

  function patchProfile(patch: Parameters<typeof updateActive>[0]) {
    updateActive(patch);
  }

  const mafHR = profile.age > 0 ? 180 - profile.age : 0;

  // Derive current LTHR and threshold pace for display
  const lthr           = profile.hrThreshold ?? profile.thresholdTest?.avgHRLastTwentyMin ?? null;
  const thresholdPaceSec = profile.thresholdPaceSecPerMi ?? profile.thresholdTest?.avgPaceSecPerMiLastTwenty ?? null;

  return (
    <ScreenLayout title="Profile">

      {/* ── Overview ──────────────────────────────────────────────────── */}
      <ProfileOverviewCard profile={profile} />

      {/* ── Identity ──────────────────────────────────────────────────── */}
      <SectionLabel label="Identity" />
      <Card>
        <View style={styles.fields}>
          <FieldInput
            label="Athlete Name"
            value={localName}
            onChange={setLocalName}
            onBlur={() => {
              const name = localName.trim() || athleteName;
              setAthleteName(name);
              patchProfile({ name });
            }}
            placeholder="Your name"
          />
          <FieldInput
            label="Goal Race"
            value={localGoal}
            onChange={setLocalGoal}
            onBlur={() => setGoalRace(localGoal.trim() || goalRace)}
            placeholder="e.g. Sub 4 Marathon"
            autoCapitalize="words"
          />
          <FieldStepper
            label="Age"
            display={profile.age > 0 ? `${profile.age} yrs` : '—'}
            onIncrease={() => patchProfile({ age: Math.min(99, profile.age + 1) })}
            onDecrease={() => patchProfile({ age: Math.max(14, profile.age - 1) })}
          />
          <FieldPicker
            label="Sex"
            value={profile.sex}
            options={SEX_OPTIONS}
            onChange={sex => patchProfile({ sex })}
          />
        </View>
      </Card>

      {/* ── Body Metrics ──────────────────────────────────────────────── */}
      <SectionLabel label="Body Metrics" />
      <Card>
        <View style={styles.fields}>
          <FieldStepper
            label="Height"
            display={
              profile.heightCm > 0
                ? `${Math.floor(profile.heightCm / 30.48)}'${Math.round((profile.heightCm % 30.48) / 2.54)}"`
                : '—'
            }
            onIncrease={() => patchProfile({ heightCm: profile.heightCm + 1 })}
            onDecrease={() => patchProfile({ heightCm: Math.max(100, profile.heightCm - 1) })}
          />
          <FieldStepper
            label="Weight"
            display={
              profile.weightKg > 0
                ? `${Math.round(profile.weightKg * 2.205)} lb`
                : '—'
            }
            onIncrease={() => patchProfile({ weightKg: +(profile.weightKg + 0.5).toFixed(1) })}
            onDecrease={() => patchProfile({ weightKg: +(Math.max(30, profile.weightKg - 0.5)).toFixed(1) })}
          />
          <FieldStepper
            label="Running Experience"
            display={profile.trainingAgeYears >= 1 ? `${profile.trainingAgeYears} yrs` : '<1 yr'}
            onIncrease={() => patchProfile({ trainingAgeYears: Math.min(50, profile.trainingAgeYears + 1) })}
            onDecrease={() => patchProfile({ trainingAgeYears: Math.max(0, profile.trainingAgeYears - 1) })}
          />
        </View>
      </Card>

      {/* ── Heart Rate & Physiology ───────────────────────────────────── */}
      <SectionLabel label="Heart Rate & Physiology" />
      <Card>
        <View style={styles.fields}>

          {/* HRmax source toggle */}
          <View style={styles.toggleGroup}>
            <Text style={styles.toggleGroupLabel}>HRMAX SOURCE</Text>
            <View style={styles.sourcePills}>
              <Pressable
                style={[styles.sourcePill, !profile.hrMaxManual && styles.sourcePillActive]}
                onPress={() => { patchProfile({ hrMaxManual: false }); handleRecalibrate(); }}
              >
                <Text style={[styles.sourcePillText, !profile.hrMaxManual && styles.sourcePillTextActive]}>
                  Auto-estimate (Tanaka)
                </Text>
              </Pressable>
              <Pressable
                style={[styles.sourcePill, profile.hrMaxManual && styles.sourcePillActive]}
                onPress={() => { patchProfile({ hrMaxManual: true }); handleRecalibrate(); }}
              >
                <Text style={[styles.sourcePillText, profile.hrMaxManual && styles.sourcePillTextActive]}>
                  I know my HRmax
                </Text>
              </Pressable>
            </View>
            {!profile.hrMaxManual && profile.age > 0 && (
              <Text style={styles.hrEstimate}>
                Tanaka 2001: {Math.round(208 - 0.7 * profile.age)} bpm (208 − 0.7 × {profile.age})
              </Text>
            )}
            {!profile.hrMaxManual && profile.age === 0 && (
              <Text style={styles.hrEstimateDim}>Enter age above to see Tanaka estimate</Text>
            )}
          </View>

          {/* Measured HRmax — only when manual mode */}
          {profile.hrMaxManual && (
            <FieldStepper
              label="Measured HRmax (bpm)"
              display={profile.hrMax !== null ? `${profile.hrMax} bpm` : 'Not set'}
              onIncrease={() => patchProfile({ hrMax: (profile.hrMax ?? 180) + 1 })}
              onDecrease={() => {
                const v = (profile.hrMax ?? 180) - 1;
                patchProfile({ hrMax: v < 100 ? null : v });
              }}
            />
          )}

          <FieldStepper
            label="Resting HR (bpm)"
            display={profile.hrResting !== null ? `${profile.hrResting} bpm` : 'Not set'}
            onIncrease={() => patchProfile({ hrResting: (profile.hrResting ?? 50) + 1 })}
            onDecrease={() => {
              const v = (profile.hrResting ?? 50) - 1;
              patchProfile({ hrResting: v < 30 ? null : v });
            }}
          />
          <FieldStepper
            label="Sleep Hours"
            display={`${sleepHours.toFixed(1)} hrs`}
            onIncrease={() => setSleepHours(+(Math.min(14, sleepHours + 0.5)).toFixed(1))}
            onDecrease={() => setSleepHours(+(Math.max(0, sleepHours - 0.5)).toFixed(1))}
          />
          <FieldStepper
            label="Resting HR Delta"
            display={`${restingHRDelta >= 0 ? '+' : ''}${restingHRDelta} bpm`}
            onIncrease={() => setRestingHRDelta(Math.min(30, restingHRDelta + 1))}
            onDecrease={() => setRestingHRDelta(Math.max(-10, restingHRDelta - 1))}
          />
        </View>
      </Card>

      {/* ── Threshold Test ────────────────────────────────────────────── */}
      <SectionLabel label="30-Min Threshold Test" />
      <Card>
        {profile.thresholdTest !== null ? (
          <View style={styles.fields}>
            <View style={styles.testResultRow}>
              <View style={styles.testResultStats}>
                <View style={styles.testStat}>
                  <Text style={styles.testStatValue}>
                    {profile.thresholdTest.avgHRLastTwentyMin} bpm
                  </Text>
                  <Text style={styles.testStatLabel}>LTHR</Text>
                </View>
                <View style={styles.testStatDivider} />
                <View style={styles.testStat}>
                  <Text style={styles.testStatValue}>
                    {formatPace(profile.thresholdTest.avgPaceSecPerMiLastTwenty)}/mi
                  </Text>
                  <Text style={styles.testStatLabel}>FT Pace</Text>
                </View>
                <View style={styles.testStatDivider} />
                <View style={styles.testStat}>
                  <Text style={styles.testStatValue}>{profile.thresholdTest.date}</Text>
                  <Text style={styles.testStatLabel}>Date</Text>
                </View>
              </View>
            </View>
            {profile.thresholdTest.notes ? (
              <Text style={styles.testNotes}>{profile.thresholdTest.notes}</Text>
            ) : null}
            <View style={styles.testActions}>
              <TouchableOpacity
                style={styles.testActionBtn}
                onPress={() => setShowThreshold(true)}
              >
                <Text style={styles.testActionBtnText}>Update Test</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.testActionBtn, styles.testActionBtnDanger]}
                onPress={() => {
                  clearThresholdTest(profile.athleteId);
                  handleRecalibrate();
                }}
              >
                <Text style={styles.testActionBtnDangerText}>Clear</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.fields}>
            <Text style={styles.testNote}>
              Run at maximum sustainable effort for 30 minutes. Record your average HR and
              pace from the last 20 minutes. These become your LTHR and functional threshold
              pace — the foundation of the 7-zone Friel system.
            </Text>
            <Text style={styles.testNoteRef}>Joe Friel 30-min threshold field test (Friel, "Fast After 50")</Text>
            <TouchableOpacity
              style={styles.logTestBtn}
              onPress={() => setShowThreshold(true)}
            >
              <Text style={styles.logTestBtnText}>+ Log Threshold Test</Text>
            </TouchableOpacity>
          </View>
        )}
      </Card>

      {/* ── Race History ──────────────────────────────────────────────── */}
      <SectionLabel label="Race History" />
      <RaceHistoryCard
        racePRs={profile.racePRs}
        onAdd={() => setShowAddPR(true)}
        onRemove={prId => {
          removeRacePR(profile.athleteId, prId);
          handleRecalibrate();
        }}
      />

      {/* ── Training Plan ─────────────────────────────────────────────── */}
      <SectionLabel label="Training Plan" />
      <Card>
        <View style={styles.fields}>
          <FieldStepper
            label="Weekly Mileage"
            display={`${weeklyMileage.toFixed(1)} mi`}
            onIncrease={() => setWeeklyMileage(+(weeklyMileage + 0.5).toFixed(1))}
            onDecrease={() => setWeeklyMileage(+(Math.max(5, weeklyMileage - 0.5)).toFixed(1))}
          />
          <FieldStepper
            label="Current Week"
            display={`Week ${currentWeek}`}
            onIncrease={() => setCurrentWeek(currentWeek + 1)}
            onDecrease={() => setCurrentWeek(Math.max(1, currentWeek - 1))}
          />
          <FieldPicker
            label="Progression Level"
            value={progressionLevel}
            options={PROGRESSION_OPTIONS}
            onChange={setProgressionLevel}
          />
          <FieldStepper
            label="Target Sessions / Week"
            display={`${profile.targetSessions} sessions`}
            onIncrease={() => patchProfile({ targetSessions: Math.min(7, profile.targetSessions + 1) })}
            onDecrease={() => patchProfile({ targetSessions: Math.max(3, profile.targetSessions - 1) })}
          />
          <DaySelector
            available={profile.availableDays}
            onChange={days => patchProfile({ availableDays: days })}
          />
        </View>
      </Card>
      <TrainingAvailabilityCard
        availableDays={profile.availableDays}
        targetSessions={profile.targetSessions}
      />

      {/* ── Sensitivity Tuning ────────────────────────────────────────── */}
      <SectionLabel label="Sensitivity Tuning" />
      <Card>
        <View style={styles.fields}>
          <FieldStepper
            label="Fatigue Sensitivity"
            display={profile.fatigueSensitivity.toFixed(1) + '×'}
            onIncrease={() =>
              patchProfile({ fatigueSensitivity: Math.min(2.0, +(profile.fatigueSensitivity + 0.1).toFixed(1)) })
            }
            onDecrease={() =>
              patchProfile({ fatigueSensitivity: Math.max(0.5, +(profile.fatigueSensitivity - 0.1).toFixed(1)) })
            }
          />
          <FieldStepper
            label="Recovery Responsiveness"
            display={profile.recoveryResponsiveness.toFixed(1) + '×'}
            onIncrease={() =>
              patchProfile({ recoveryResponsiveness: Math.min(2.0, +(profile.recoveryResponsiveness + 0.1).toFixed(1)) })
            }
            onDecrease={() =>
              patchProfile({ recoveryResponsiveness: Math.max(0.5, +(profile.recoveryResponsiveness - 0.1).toFixed(1)) })
            }
          />
          <FieldStepper
            label="Heat Sensitivity"
            display={profile.heatSensitivity.toFixed(1) + '×'}
            onIncrease={() =>
              patchProfile({ heatSensitivity: Math.min(2.0, +(profile.heatSensitivity + 0.1).toFixed(1)) })
            }
            onDecrease={() =>
              patchProfile({ heatSensitivity: Math.max(0.5, +(profile.heatSensitivity - 0.1).toFixed(1)) })
            }
          />
        </View>
        <Text style={styles.sensitivityNote}>
          1.0 = baseline. Increase fatigue sensitivity if you feel rundown faster than
          expected. Increase recovery responsiveness if you bounce back quickly.
        </Text>
      </Card>

      {/* ── Calibration ───────────────────────────────────────────────── */}
      <SectionLabel label="Calibration" />
      <CalibrationStatusCard
        calibration={calibration}
        onRecalibrate={handleRecalibrate}
      />

      {/* ── Zone data — only when calibration exists ──────────────────── */}
      {calibration && (
        <>
          {/* Zone Method Comparison */}
          <SectionLabel label="Zone Method Comparison" />
          <ZoneComparisonCard
            calibration={calibration}
            onMethodChange={(method: ZoneMethod) => {
              setZoneMethod(profile.athleteId, method);
              handleRecalibrate();
            }}
          />

          {/* VDOT Pace Zones */}
          <SectionLabel label="VDOT Pace Zones" />
          <PaceZoneCard calibration={calibration} />

          {/* HR Zones (Friel 5-zone) */}
          <SectionLabel label="HR Zones" />
          <HRZoneCard calibration={calibration} />

          {/* 7-Zone Threshold — only when threshold data is available */}
          {calibration.thresholdZones && lthr !== null && thresholdPaceSec !== null && (
            <>
              <SectionLabel label="7-Zone Threshold System" />
              <ThresholdZoneCard
                zones={calibration.thresholdZones}
                thresholdPaceSec={thresholdPaceSec}
                lthr={lthr}
              />
            </>
          )}
        </>
      )}

      {/* ── Aerobic Base Tracking (MAF) ───────────────────────────────── */}
      <SectionLabel label="Aerobic Base Tracking" />
      <MAFCard
        tests={profile.mafTests}
        mafHR={mafHR > 0 ? mafHR : undefined}
        onAdd={() => setShowMAF(true)}
      />

      {/* ── Sources & Methods ─────────────────────────────────────────── */}
      <SectionLabel label="Sources & Methods" />
      <SourcesMethodsCard />

      {/* ── Reset ─────────────────────────────────────────────────────── */}
      <SectionLabel label="Data & Privacy" />
      <ResetDataSection />

      {/* ── Modals ────────────────────────────────────────────────────── */}
      <AddPRModal
        visible={showAddPR}
        onClose={() => setShowAddPR(false)}
        onSubmit={pr => {
          addRacePR(profile.athleteId, { ...pr, id: `pr_${Date.now()}` });
          handleRecalibrate();
        }}
      />

      <AddThresholdTestModal
        visible={showThreshold}
        onClose={() => setShowThreshold(false)}
        onSubmit={test => {
          setThresholdTest(profile.athleteId, { ...test, id: `tt_${Date.now()}` });
          handleRecalibrate();
        }}
      />

      {mafHR > 0 && (
        <AddMAFTestModal
          visible={showMAF}
          mafHR={mafHR}
          onClose={() => setShowMAF(false)}
          onSubmit={test => {
            addMAFTest(profile.athleteId, { ...test, id: `maf_${Date.now()}` });
          }}
        />
      )}

    </ScreenLayout>
  );
}

function ResetDataSection() {
  const resetOnboarding = useOnboardingStore(s => s.resetOnboarding);

  function handleReset() {
    Alert.alert(
      'Reset StrideOS Data',
      'This will permanently delete all training data, profiles, and settings. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text:  'Reset Everything',
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.clear();
            useProfileStore.setState({ profiles: {}, activeAthleteId: 'athlete_default' });
            resetOnboarding();
            router.replace('/onboarding' as never);
          },
        },
      ],
    );
  }

  return (
    <View style={styles.resetCard}>
      <Text style={styles.resetTitle}>Reset StrideOS</Text>
      <Text style={styles.resetDesc}>
        Permanently deletes all local data: athlete profile, training history, calibration,
        and movement analyses. This cannot be undone.
      </Text>
      <Pressable style={styles.resetBtn} onPress={handleReset}>
        <Text style={styles.resetBtnTxt}>Reset All Data</Text>
      </Pressable>
    </View>
  );
}

function SectionLabel({ label }: { label: string }) {
  return <Text style={styles.sectionLabel}>{label}</Text>;
}

const styles = StyleSheet.create({
  sectionLabel: {
    color:         colors.textDim,
    fontSize:      FontSize.xs,
    fontWeight:    FontWeight.medium,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom:  spacing.sm,
    marginTop:     spacing.sm,
  },
  fields: {
    gap: spacing.xl,
  },
  sensitivityNote: {
    color:      colors.textSubtle,
    fontSize:   9,
    lineHeight: 13,
    marginTop:  spacing.md,
  },

  // HRmax source toggle
  toggleGroup: {
    gap: spacing.xs,
  },
  toggleGroupLabel: {
    color:         colors.textMuted,
    fontSize:      10,
    fontWeight:    FontWeight.black,
    letterSpacing: 0.6,
  },
  sourcePills: {
    flexDirection: 'row',
    gap:           spacing.sm,
  },
  sourcePill: {
    flex:              1,
    paddingVertical:   spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius:      Radius.sm,
    backgroundColor:   colors.border,
    alignItems:        'center',
  },
  sourcePillActive: {
    backgroundColor: colors.primaryDim,
    borderWidth:     1,
    borderColor:     colors.primary,
  },
  sourcePillText: {
    color:      colors.textDim,
    fontSize:   FontSize.xs,
    fontWeight: FontWeight.medium,
    textAlign:  'center',
  },
  sourcePillTextActive: {
    color:      colors.primary,
    fontWeight: FontWeight.bold,
  },
  hrEstimate: {
    color:    colors.primary,
    fontSize: FontSize.xs,
  },
  hrEstimateDim: {
    color:    colors.textSubtle,
    fontSize: FontSize.xs,
  },

  // Threshold test display
  testResultRow: {
    gap: spacing.sm,
  },
  testResultStats: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: colors.bg,
    borderRadius:    10,
    padding:         spacing.md,
  },
  testStat: {
    flex:       1,
    alignItems: 'center',
    gap:        2,
  },
  testStatValue: {
    color:      colors.text,
    fontSize:   FontSize.sm,
    fontWeight: FontWeight.black,
  },
  testStatLabel: {
    color:    colors.textSubtle,
    fontSize: 9,
  },
  testStatDivider: {
    width:           1,
    height:          28,
    backgroundColor: colors.border,
  },
  testNotes: {
    color:      colors.textMuted,
    fontSize:   FontSize.xs,
    lineHeight: 16,
    fontStyle:  'italic',
  },
  testActions: {
    flexDirection: 'row',
    gap:           spacing.sm,
  },
  testActionBtn: {
    flex:            1,
    paddingVertical: spacing.sm,
    borderRadius:    Radius.sm,
    backgroundColor: colors.border,
    alignItems:      'center',
  },
  testActionBtnDanger: {
    flex:            0,
    paddingHorizontal: spacing.lg,
    backgroundColor:   '#1F0707',
    borderWidth:       1,
    borderColor:       colors.critical,
  },
  testActionBtnText: {
    color:      colors.text,
    fontSize:   FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  testActionBtnDangerText: {
    color:      colors.critical,
    fontSize:   FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  testNote: {
    color:      colors.textMuted,
    fontSize:   FontSize.sm,
    lineHeight: 18,
  },
  testNoteRef: {
    color:      colors.textSubtle,
    fontSize:   8,
    fontStyle:  'italic',
    marginTop:  -spacing.sm,
  },
  logTestBtn: {
    paddingVertical: spacing.md,
    borderRadius:    Radius.sm,
    backgroundColor: colors.primaryDim,
    borderWidth:     1,
    borderColor:     colors.primary,
    alignItems:      'center',
  },
  logTestBtnText: {
    color:      colors.primary,
    fontSize:   FontSize.base,
    fontWeight: FontWeight.bold,
  },

  // Reset section
  resetCard: {
    backgroundColor: colors.card,
    borderRadius:    12,
    padding:         spacing.md,
    borderWidth:     1,
    borderColor:     colors.border,
    gap:             spacing.md,
  },
  resetTitle: {
    color:      colors.text,
    fontSize:   FontSize.base,
    fontWeight: FontWeight.bold,
  },
  resetDesc: {
    color:      colors.textMuted,
    fontSize:   FontSize.xs,
    lineHeight: 17,
  },
  resetBtn: {
    backgroundColor: '#1F0707',
    borderWidth:     1,
    borderColor:     colors.danger,
    borderRadius:    Radius.sm,
    paddingVertical: spacing.md,
    alignItems:      'center',
  },
  resetBtnTxt: {
    color:      colors.danger,
    fontSize:   FontSize.base,
    fontWeight: FontWeight.bold,
  },
});
