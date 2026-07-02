// ─── Onboarding Complete ────────────────────────────────────────────────────────
//
// Final onboarding step. Collects a name, then initializes the athlete profile
// with all data gathered across steps 1–8. Generates baseline calibration and
// navigates to the main dashboard.

import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';

import { useOnboardingStore } from '../../src/store/onboardingStore';
import { useProfileStore }    from '../../src/store/profileStore';
import { useAthleteStore }    from '../../src/store/athleteStore';
import { vdotFromRacePR, estimateHRMax } from '../../src/utils/calibrationEngine';
import { buildGoalRaceLabel } from '../../src/utils/goalRaceEngine';
import { useThemeColors, type ThemeColors } from '../../src/theme/ThemeContext';
import { spacing } from '../../src/theme/spacing';
import { FontSize, FontWeight, Radius } from '../../src/theme/tokens';
import type { RacePR } from '../../src/types/athlete';
import type { StandardDistance } from '../../src/types/athlete';

// ─── Distance lookup ──────────────────────────────────────────────────────────

const DISTANCE_METERS: Record<StandardDistance, number> = {
  marathon:      42195,
  half_marathon: 21097.5,
  '10k':         10000,
  '5k':          5000,
  '1_mile':      1609.344,
  '800m':        800,
};

const DISTANCE_LABELS: Record<StandardDistance, string> = {
  marathon:      'Marathon',
  half_marathon: 'Half Marathon',
  '10k':         '10K',
  '5k':          '5K',
  '1_mile':      '1 Mile',
  '800m':        '800m',
};

// ─── VO2 estimate heuristic (no PR) ──────────────────────────────────────────

function estimateVdotFromProfile(weeklyMiles: number, yearsRunning: number): number {
  let base: number;
  if      (weeklyMiles >= 50) base = 46;
  else if (weeklyMiles >= 40) base = 43;
  else if (weeklyMiles >= 30) base = 40;
  else if (weeklyMiles >= 20) base = 37;
  else if (weeklyMiles >= 10) base = 33;
  else                        base = 30;

  const yearBonus = Math.min(yearsRunning, 5);
  return Math.round(base + yearBonus);
}

// ─── Summary row ─────────────────────────────────────────────────────────────

function SummaryRow({ label, value }: { label: string; value: string }) {
  const colors = useThemeColors();
  const s = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={s.summaryRow}>
      <Text style={s.summaryLabel}>{label}</Text>
      <Text style={s.summaryValue}>{value}</Text>
    </View>
  );
}

// ─── Screen ──────────────────────────────────────────────────────────────────

const GOAL_LABELS: Record<string, string> = {
  marathon:          'Marathon',
  half_marathon:     'Half Marathon',
  '10k':             '10K',
  '5k':              '5K',
  general_fitness:   'General Fitness',
  health:            'Health & Wellness',
  return_to_running: 'Return to Running',
};

const STYLE_LABELS: Record<string, string> = {
  polarized:  'Polarized',
  threshold:  'Threshold',
  mixed:      'Mixed',
  base_only:  'Aerobic Base',
};

const STRENGTH_LABELS: Record<string, string> = {
  none:         'None',
  beginner:     'Beginner',
  intermediate: 'Intermediate',
  advanced:     'Advanced',
};

export default function CompleteScreen() {
  const colors = useThemeColors();
  const s = useMemo(() => createStyles(colors), [colors]);

  const { data, completeOnboarding } = useOnboardingStore();
  const {
    initDefaultProfile,
    updateActive,
    addRacePR,
    recalibrate,
    activeAthleteId,
  } = useProfileStore();
  const {
    setGoalRace,
    setWeeklyMileage: setAthleteWeeklyMileage,
    setAthleteName,
  } = useAthleteStore();

  const [name,     setName]     = useState('');
  const [building, setBuilding] = useState(false);

  const hasPR      = data.hasPR && data.prDistance !== null && data.prTimeSeconds > 0;
  const vdotCalc   = hasPR && data.prDistance
    ? vdotFromRacePR(DISTANCE_METERS[data.prDistance], data.prTimeSeconds)
    : null;
  const vdotFinal  = vdotCalc ?? estimateVdotFromProfile(data.weeklyMileage, data.yearsRunning);
  const hrMaxEst   = data.age > 0 ? estimateHRMax(data.age) : null;
  const displayName = name.trim() || 'Athlete';

  function formatTime(sec: number): string {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  async function handleBuild() {
    setBuilding(true);

    // 1. Create the athlete profile (no-op if already exists)
    initDefaultProfile(displayName, vdotFinal);

    // 2. Populate all onboarding fields
    updateActive({
      name:                  displayName,
      age:                   data.age,
      sex:                   data.sex,
      heightCm:              data.heightCm,
      weightKg:              data.weightKg,
      hrResting:             data.hrResting,
      hrMax:                 hrMaxEst,
      hrMaxManual:           false,
      trainingAgeYears:      data.yearsRunning,
      availableDays:         data.availableDays,
      targetSessions:        data.targetSessions,
      vo2Estimate:           vdotFinal,
      vdot:                  vdotFinal,
    });

    // 3. Record race PR if provided
    if (hasPR && data.prDistance) {
      const pr: RacePR = {
        id:             `pr_onboarding_${Date.now()}`,
        distanceKey:    data.prDistance,
        distanceLabel:  DISTANCE_LABELS[data.prDistance],
        distanceMeters: DISTANCE_METERS[data.prDistance],
        timeSeconds:    data.prTimeSeconds,
        date:           data.prDate || new Date().toISOString().split('T')[0],
        official:       false,
      };
      addRacePR(activeAthleteId, pr);
    }

    // 4. Run initial calibration with conservative defaults (no workout history yet)
    recalibrate({
      weeklyMileage:        data.weeklyMileage,
      currentPhase:         'base',
      recentWorkoutCount:   0,
      lastWorkoutDaysAgo:   7,
      currentFatigueScore:  30,
      currentRecoveryScore: 70,
    });

    // 5. Wire onboarding data to athleteStore (goal race + mileage + name)
    const goalRaceStr = buildGoalRaceLabel(
      data.primaryGoal,
      data.goalRaceLabel,
      data.prDistance,
      data.prTimeSeconds,
    );
    setGoalRace(goalRaceStr);
    setAthleteWeeklyMileage(data.weeklyMileage);
    setAthleteName(displayName);

    // 6. Mark onboarding complete — root layout will redirect to tabs
    completeOnboarding();

    setBuilding(false);
    router.replace('/(tabs)/dashboard');
  }

  return (
    <ScrollView
      style={s.root}
      contentContainerStyle={s.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={s.hero}>
        <Text style={s.heroEmoji}>✦</Text>
        <Text style={s.heroTitle}>Your plan is ready</Text>
        <Text style={s.heroSub}>
          StrideOS has everything it needs to calibrate your training system.
        </Text>
      </View>

      {/* Name input */}
      <View style={s.section}>
        <Text style={s.sectionLabel}>WHAT SHOULD WE CALL YOU?</Text>
        <TextInput
          style={s.nameInput}
          value={name}
          onChangeText={setName}
          placeholder="Your name or nickname"
          placeholderTextColor={colors.textSubtle}
          autoCapitalize="words"
          autoCorrect={false}
          returnKeyType="done"
        />
      </View>

      {/* Summary card */}
      <View style={s.summaryCard}>
        <Text style={s.summaryTitle}>PROFILE SUMMARY</Text>
        <SummaryRow label="Goal"           value={GOAL_LABELS[data.primaryGoal] ?? data.primaryGoal} />
        <SummaryRow label="Training style" value={STYLE_LABELS[data.trainingStyle] ?? data.trainingStyle} />
        <SummaryRow label="Strength"       value={STRENGTH_LABELS[data.strengthLevel] ?? data.strengthLevel} />
        <SummaryRow
          label="Experience"
          value={
            data.yearsRunning === 0
              ? '< 1 year running'
              : `${data.yearsRunning} yr${data.yearsRunning === 1 ? '' : 's'} · ${data.weeklyMileage} mi/wk`
          }
        />
        <SummaryRow
          label="Available days"
          value={`${data.availableDays.length} days · ${data.targetSessions} sessions/wk`}
        />
        {hasPR && data.prDistance && (
          <SummaryRow
            label={`${DISTANCE_LABELS[data.prDistance]} PR`}
            value={formatTime(data.prTimeSeconds)}
          />
        )}
        {vdotCalc ? (
          <SummaryRow label="VDOT (from PR)" value={vdotCalc.toFixed(1)} />
        ) : (
          <SummaryRow label="VDOT (estimated)" value={vdotFinal.toString()} />
        )}
        {hrMaxEst && (
          <SummaryRow label="Est. HRmax" value={`${hrMaxEst} bpm`} />
        )}
      </View>

      {/* What gets generated */}
      <View style={s.generatesCard}>
        <Text style={s.generatesTitle}>WHAT WE'RE BUILDING</Text>
        {[
          'Pace zones calibrated to your fitness',
          'Heart rate training zones',
          'Weekly training structure',
          'Fatigue & recovery thresholds',
          'Initial performance baseline',
        ].map(item => (
          <View key={item} style={s.generateRow}>
            <Text style={s.generateDot}>·</Text>
            <Text style={s.generateItem}>{item}</Text>
          </View>
        ))}
      </View>

      {/* CTA */}
      <Pressable
        style={[s.cta, building && s.ctaDisabled]}
        onPress={handleBuild}
        disabled={building}
      >
        {building
          ? <ActivityIndicator color={colors.bg} />
          : <Text style={s.ctaTxt}>Build My Training System</Text>
        }
      </Pressable>

      <Text style={s.disclaimer}>
        All calibration is local to your device. No account or internet connection required.
        You can refine every setting in Profile.
      </Text>
    </ScrollView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  root: {
    flex:            1,
    backgroundColor: colors.bg,
  },
  content: {
    padding:    spacing.lg,
    gap:        spacing.lg,
    paddingTop: 72,
  },
  hero: {
    alignItems: 'center',
    gap:        spacing.sm,
    paddingBottom: spacing.md,
  },
  heroEmoji: {
    fontSize:   40,
    color:      colors.primary,
    marginBottom: spacing.xs,
  },
  heroTitle: {
    color:      colors.text,
    fontSize:   28,
    fontWeight: FontWeight.black,
    textAlign:  'center',
  },
  heroSub: {
    color:      colors.textSubtle,
    fontSize:   FontSize.sm,
    lineHeight: 20,
    textAlign:  'center',
  },
  section: {
    gap: spacing.xs,
  },
  sectionLabel: {
    color:         colors.textMuted,
    fontSize:      10,
    fontWeight:    FontWeight.black,
    letterSpacing: 0.6,
  },
  nameInput: {
    backgroundColor: colors.card,
    borderRadius:    Radius.sm,
    borderWidth:     1,
    borderColor:     colors.border,
    color:           colors.text,
    fontSize:        FontSize.md,
    fontWeight:      FontWeight.bold,
    padding:         spacing.md,
  },
  summaryCard: {
    backgroundColor: colors.card,
    borderRadius:    12,
    padding:         spacing.md,
    borderWidth:     1,
    borderColor:     colors.border,
    gap:             spacing.sm,
  },
  summaryTitle: {
    color:         colors.textMuted,
    fontSize:      10,
    fontWeight:    FontWeight.black,
    letterSpacing: 0.6,
    marginBottom:  spacing.xs,
  },
  summaryRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
  },
  summaryLabel: {
    color:    colors.textSubtle,
    fontSize: FontSize.sm,
  },
  summaryValue: {
    color:      colors.text,
    fontSize:   FontSize.sm,
    fontWeight: FontWeight.bold,
  },
  generatesCard: {
    backgroundColor: colors.card,
    borderRadius:    12,
    padding:         spacing.md,
    borderWidth:     1,
    borderColor:     colors.border,
    gap:             spacing.xs,
  },
  generatesTitle: {
    color:         colors.textMuted,
    fontSize:      10,
    fontWeight:    FontWeight.black,
    letterSpacing: 0.6,
    marginBottom:  spacing.xs,
  },
  generateRow: {
    flexDirection: 'row',
    gap:           spacing.xs,
    alignItems:    'flex-start',
  },
  generateDot: {
    color:    colors.primary,
    fontSize: FontSize.base,
    fontWeight: FontWeight.black,
  },
  generateItem: {
    color:    colors.textSubtle,
    fontSize: FontSize.sm,
    flex:     1,
  },
  cta: {
    backgroundColor: colors.primary,
    borderRadius:    12,
    paddingVertical: spacing.lg,
    alignItems:      'center',
  },
  ctaDisabled: {
    opacity: 0.6,
  },
  ctaTxt: {
    color:      colors.bg,
    fontSize:   FontSize.base,
    fontWeight: FontWeight.black,
  },
  disclaimer: {
    color:      colors.textMuted,
    fontSize:   FontSize.xs,
    lineHeight: 18,
    textAlign:  'center',
    paddingBottom: spacing.xl,
  },
  });
}
