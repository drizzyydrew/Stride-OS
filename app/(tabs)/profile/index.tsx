import { useCallback, useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { useAthleteStore }  from '../../../src/store/athleteStore';
import { useProfileStore, useActiveProfile, useCalibration } from '../../../src/store/profileStore';

import ScreenLayout          from '../../../src/layout/ScreenLayout';
import Card                  from '../../../src/components/ui/Card';
import FieldInput            from '../../../src/components/ui/FieldInput';
import FieldStepper          from '../../../src/components/ui/FieldStepper';
import FieldPicker           from '../../../src/components/ui/FieldPicker';

import ProfileOverviewCard       from '../../../src/components/profile/ProfileOverviewCard';
import CalibrationStatusCard     from '../../../src/components/profile/CalibrationStatusCard';
import PaceZoneCard              from '../../../src/components/profile/PaceZoneCard';
import HRZoneCard                from '../../../src/components/profile/HRZoneCard';
import TrainingAvailabilityCard  from '../../../src/components/profile/TrainingAvailabilityCard';
import RaceHistoryCard           from '../../../src/components/profile/RaceHistoryCard';

import { colors }   from '../../../src/theme/colors';
import { spacing }  from '../../../src/theme/spacing';
import { FontSize, FontWeight, Radius } from '../../../src/theme/tokens';

import type { Sex, TrainingDay, StandardDistance, RacePR } from '../../../src/types/athlete';
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
  { value: 'marathon',      label: 'Marathon',       meters: 42195     },
  { value: 'half_marathon', label: 'Half Marathon',  meters: 21097.5   },
  { value: '10k',           label: '10K',            meters: 10000     },
  { value: '5k',            label: '5K',             meters: 5000      },
  { value: '1_mile',        label: '1 Mile',         meters: 1609.344  },
  { value: '800m',          label: '800m',           meters: 800       },
];

// ─── Add-PR modal ─────────────────────────────────────────────────────────────

type AddPRModalProps = {
  visible:  boolean;
  onClose:  () => void;
  onSubmit: (pr: Omit<RacePR, 'id'>) => void;
};

function AddPRModal({ visible, onClose, onSubmit }: AddPRModalProps) {
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

          {/* Distance selector */}
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
                    <Text style={[modal.pillText, active && modal.pillTextActive]}>
                      {d.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>

          {/* Time input */}
          <Text style={modal.fieldLabel}>TIME</Text>
          <View style={modal.timeRow}>
            <View style={modal.timeUnit}>
              <Text style={modal.timeValue}>{String(hours).padStart(2, '0')}</Text>
              <Text style={modal.timeUnitLabel}>hrs</Text>
              <View style={modal.timeBtns}>
                <Pressable style={modal.timeBtn} onPress={() => setHours(h => Math.max(0, h - 1))}>
                  <Text style={modal.timeBtnText}>−</Text>
                </Pressable>
                <Pressable style={modal.timeBtn} onPress={() => setHours(h => Math.min(9, h + 1))}>
                  <Text style={modal.timeBtnText}>+</Text>
                </Pressable>
              </View>
            </View>
            <Text style={modal.timeSep}>:</Text>
            <View style={modal.timeUnit}>
              <Text style={modal.timeValue}>{String(minutes).padStart(2, '0')}</Text>
              <Text style={modal.timeUnitLabel}>min</Text>
              <View style={modal.timeBtns}>
                <Pressable style={modal.timeBtn} onPress={() => setMinutes(m => Math.max(0, m - 1))}>
                  <Text style={modal.timeBtnText}>−</Text>
                </Pressable>
                <Pressable style={modal.timeBtn} onPress={() => setMinutes(m => Math.min(59, m + 1))}>
                  <Text style={modal.timeBtnText}>+</Text>
                </Pressable>
              </View>
            </View>
            <Text style={modal.timeSep}>:</Text>
            <View style={modal.timeUnit}>
              <Text style={modal.timeValue}>{String(seconds).padStart(2, '0')}</Text>
              <Text style={modal.timeUnitLabel}>sec</Text>
              <View style={modal.timeBtns}>
                <Pressable style={modal.timeBtn} onPress={() => setSeconds(s => Math.max(0, s - 1))}>
                  <Text style={modal.timeBtnText}>−</Text>
                </Pressable>
                <Pressable style={modal.timeBtn} onPress={() => setSeconds(s => Math.min(59, s + 1))}>
                  <Text style={modal.timeBtnText}>+</Text>
                </Pressable>
              </View>
            </View>
          </View>

          {/* Date */}
          <FieldInput
            label="Race Date (YYYY-MM-DD)"
            value={dateStr}
            onChange={setDateStr}
            placeholder={new Date().toISOString().slice(0, 10)}
            autoCapitalize="none"
          />

          {/* Official toggle */}
          <View style={modal.toggleRow}>
            <Text style={modal.fieldLabel}>RESULT TYPE</Text>
            <View style={modal.togglePills}>
              <Pressable
                style={[modal.togglePill, official && modal.togglePillActive]}
                onPress={() => setOfficial(true)}
              >
                <Text style={[modal.togglePillText, official && modal.togglePillTextActive]}>
                  Race Result
                </Text>
              </Pressable>
              <Pressable
                style={[modal.togglePill, !official && modal.togglePillActive]}
                onPress={() => setOfficial(false)}
              >
                <Text style={[modal.togglePillText, !official && modal.togglePillTextActive]}>
                  Time Trial
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Actions */}
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

const modal = StyleSheet.create({
  overlay: {
    flex:            1,
    justifyContent:  'flex-end',
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius:  16,
    borderTopRightRadius: 16,
    padding:  spacing.xl,
    gap:      spacing.md,
    paddingBottom: 40,
  },
  title: {
    color:      colors.text,
    fontSize:   FontSize.lg,
    fontWeight: FontWeight.black,
    marginBottom: spacing.xs,
  },
  fieldLabel: {
    color:         colors.textMuted,
    fontSize:      10,
    fontWeight:    FontWeight.black,
    letterSpacing: 0.6,
  },
  pillScroll: {
    flexGrow: 0,
  },
  pillRow: {
    flexDirection: 'row',
    gap:           spacing.xs,
  },
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
  toggleRow: {
    gap: spacing.xs,
  },
  togglePills: {
    flexDirection: 'row',
    gap:           spacing.sm,
  },
  togglePill: {
    flex:          1,
    paddingVertical: spacing.sm,
    borderRadius:  Radius.sm,
    backgroundColor: colors.border,
    alignItems:    'center',
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

// ─── Day selector ─────────────────────────────────────────────────────────────

function DaySelector({
  available,
  onChange,
}: {
  available: TrainingDay[];
  onChange:  (days: TrainingDay[]) => void;
}) {
  const activeSet = new Set(available);

  function toggle(day: TrainingDay) {
    if (activeSet.has(day)) {
      if (available.length <= 1) return; // keep at least 1 day
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

const ds = StyleSheet.create({
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

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ProfileScreen() {
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

  const { initDefaultProfile, updateActive, addRacePR, removeRacePR, recalibrate } =
    useProfileStore();

  const profile     = useActiveProfile();
  const calibration = useCalibration();

  const [localName,    setLocalName]    = useState(athleteName);
  const [localGoal,    setLocalGoal]    = useState(goalRace);
  const [showAddPR,    setShowAddPR]    = useState(false);

  // Seed the profile store from athleteStore on first mount.
  useEffect(() => {
    initDefaultProfile(athleteName, vo2Estimate);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRecalibrate = useCallback(() => {
    recalibrate({
      weeklyMileage,
      currentPhase:        'base',
      recentWorkoutCount:  12,
      lastWorkoutDaysAgo:  1,
      currentFatigueScore: fatigueScore,
      currentRecoveryScore: recoveryScore,
    });
  }, [recalibrate, weeklyMileage, fatigueScore, recoveryScore]);

  // Auto-calibrate once if profile has no calibration yet.
  useEffect(() => {
    if (profile && !profile.calibration) {
      handleRecalibrate();
    }
  }, [profile?.athleteId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!profile) return null;

  function patchProfile(patch: Parameters<typeof updateActive>[0]) {
    updateActive(patch);
  }

  return (
    <ScreenLayout title="Profile">

      {/* ── Overview card ─────────────────────────── */}
      <ProfileOverviewCard profile={profile} />

      {/* ── Identity ─────────────────────────────── */}
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

      {/* ── Body Metrics ─────────────────────────── */}
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

      {/* ── Heart Rate & Physiology ──────────────── */}
      <SectionLabel label="Heart Rate & Physiology" />
      <Card>
        <View style={styles.fields}>
          <FieldStepper
            label="Measured HRmax (bpm)"
            display={profile.hrMax !== null ? `${profile.hrMax} bpm` : 'Not set'}
            onIncrease={() => patchProfile({ hrMax: (profile.hrMax ?? 180) + 1 })}
            onDecrease={() => {
              const v = (profile.hrMax ?? 180) - 1;
              patchProfile({ hrMax: v < 100 ? null : v });
            }}
          />
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
            label="Threshold HR (bpm)"
            display={profile.hrThreshold !== null ? `${profile.hrThreshold} bpm` : 'Not set'}
            onIncrease={() => patchProfile({ hrThreshold: (profile.hrThreshold ?? 160) + 1 })}
            onDecrease={() => {
              const v = (profile.hrThreshold ?? 160) - 1;
              patchProfile({ hrThreshold: v < 100 ? null : v });
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

      {/* ── Race PRs ─────────────────────────────── */}
      <SectionLabel label="Race History" />
      <RaceHistoryCard
        racePRs={profile.racePRs}
        onAdd={() => setShowAddPR(true)}
        onRemove={prId => {
          removeRacePR(profile.athleteId, prId);
          handleRecalibrate();
        }}
      />

      {/* ── Training Plan ─────────────────────────── */}
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

      {/* ── Sensitivity Tuning ───────────────────── */}
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

      {/* ── Calibration ──────────────────────────── */}
      <SectionLabel label="Calibration" />
      <CalibrationStatusCard
        calibration={calibration}
        onRecalibrate={handleRecalibrate}
      />

      {/* ── Pace Zones ───────────────────────────── */}
      {calibration && (
        <>
          <SectionLabel label="Pace Zones" />
          <PaceZoneCard calibration={calibration} />
        </>
      )}

      {/* ── HR Zones ─────────────────────────────── */}
      {calibration && (
        <>
          <SectionLabel label="HR Zones" />
          <HRZoneCard calibration={calibration} />
        </>
      )}

      {/* Add PR modal */}
      <AddPRModal
        visible={showAddPR}
        onClose={() => setShowAddPR(false)}
        onSubmit={pr => {
          addRacePR(profile.athleteId, {
            ...pr,
            id: `pr_${Date.now()}`,
          });
          handleRecalibrate();
        }}
      />

    </ScreenLayout>
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
});
