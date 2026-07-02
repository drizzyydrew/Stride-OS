import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { useAthleteStore } from '../../../src/store/athleteStore';
import { useCheckInStore } from '../../../src/store/checkInStore';
import { useStrengthStore } from '../../../src/store/strengthStore';
import { useProfileStore } from '../../../src/store/profileStore';

import { generateStrengthWeek } from '../../../src/utils/strengthEngine';
import {
  getStrengthPatternBalance,
  getStrengthAdherence,
} from '../../../src/utils/strengthHistory';

import ScreenLayout from '../../../src/layout/ScreenLayout';
import StrengthReadinessCard from '../../../src/components/strength/StrengthReadinessCard';
import StrengthWeekCard from '../../../src/components/strength/StrengthWeekCard';
import StrengthSessionCard from '../../../src/components/strength/StrengthSessionCard';
import StrengthPatternCard from '../../../src/components/strength/StrengthPatternCard';
import StrengthHistoryCard from '../../../src/components/strength/StrengthHistoryCard';
import StrengthCoachCard from '../../../src/components/strength/StrengthCoachCard';
import type { StrengthInsight } from '../../../src/components/strength/StrengthCoachCard';
import Card from '../../../src/components/ui/Card';

import { useThemeColors } from '../../../src/theme/ThemeContext';
import { spacing } from '../../../src/theme/spacing';
import { FontSize, FontWeight } from '../../../src/theme/tokens';
import { todayDateKey } from '../../../src/types/checkin';
import type { StrengthEngineInput } from '../../../src/types/strength';

function buildStrengthInsights(
  fatigue:        number,
  recovery:       number,
  adherence:      number,
  weeksToRace:    number,
  sessionsThisWeek: number,
  plannedSessions:  number,
): StrengthInsight[] {
  const insights: StrengthInsight[] = [];

  if (fatigue > 75) {
    insights.push({
      id: 'high_fatigue', category: 'readiness', priority: 'high',
      headline: 'High neuromuscular fatigue',
      body: 'Strength load should be reduced today. Prioritise movement quality over load.',
      action: 'Consider prehab or mobility session only.',
    });
  } else if (fatigue > 55) {
    insights.push({
      id: 'moderate_fatigue', category: 'readiness', priority: 'medium',
      headline: 'Moderate fatigue detected',
      body: 'Reduce working sets by 1 and avoid max effort sets today.',
    });
  }

  if (recovery < 45) {
    insights.push({
      id: 'low_recovery', category: 'readiness', priority: 'high',
      headline: 'Low recovery score',
      body: 'Your body is under-recovered. Lifting heavy today risks compounding fatigue.',
      action: 'Skip or substitute with activation work.',
    });
  }

  if (adherence < 0.6 && plannedSessions > 0) {
    insights.push({
      id: 'low_adherence', category: 'adherence', priority: 'medium',
      headline: 'Strength adherence below target',
      body: `Completing ${Math.round(adherence * 100)}% of planned sessions. Consistency builds the neuromuscular adaptations that improve running economy.`,
      action: 'Aim for even short prehab sessions on missed days.',
    });
  }

  if (weeksToRace <= 3 && weeksToRace > 0) {
    insights.push({
      id: 'race_proximity', category: 'phase', priority: 'medium',
      headline: `${weeksToRace} week${weeksToRace > 1 ? 's' : ''} to race`,
      body: 'Strength volume should be tapering. Focus on activation and movement prep to stay sharp without adding fatigue.',
    });
  }

  if (sessionsThisWeek >= plannedSessions && plannedSessions > 0) {
    insights.push({
      id: 'week_complete', category: 'adherence', priority: 'low',
      headline: 'Strength week complete',
      body: 'All planned sessions done. Extra lifting now adds fatigue with diminishing returns.',
    });
  }

  return insights;
}

export default function StrengthScreen() {
  const router = useRouter();
  const colors = useThemeColors();

  const {
    fatigueScore, recoveryScore, trainingPhase, progressionLevel,
    weeklyMileage, currentWeek, goalRace,
  } = useAthleteStore();

  const todayCheckIn = useCheckInStore(s => s.todayCheckIn);
  const checkedIn    = todayCheckIn?.date === todayDateKey();
  const soreness     = checkedIn ? (todayCheckIn?.soreness ?? null) : null;

  const profile  = useProfileStore(s => s.getActiveProfile());
  const acwr     = 1.0;  // default — full ACWR calc not needed here without running history

  const { completedSessions, history } = useStrengthStore();

  const engineInput: StrengthEngineInput = {
    trainingPhase,
    progressionLevel,
    weeklyMileage,
    currentWeek,
    fatigueScore,
    recoveryScore,
    soreness,
    injuryRisk: profile?.returningFromInjury ?? false,
    acwr,
    weeksToRace: 0,
    availableTimeMin: 60,
    strengthHistory: history,
  };

  const strengthWeek = useMemo(() => generateStrengthWeek(engineInput), [
    trainingPhase, progressionLevel, weeklyMileage, currentWeek,
    fatigueScore, recoveryScore, soreness,
  ]);

  const patternBalance    = useMemo(() => getStrengthPatternBalance(history, 28), [history]);
  const adherence         = useMemo(() =>
    getStrengthAdherence(history, currentWeek, strengthWeek.sessions.length), [history, currentWeek, strengthWeek]);

  const sessionsThisWeek  = completedSessions.filter(k => k.startsWith(`sw${currentWeek}_`)).length;

  const insights = buildStrengthInsights(
    fatigueScore, recoveryScore, adherence,
    engineInput.weeksToRace, sessionsThisWeek, strengthWeek.sessions.length,
  );

  return (
    <ScreenLayout title="Strength">

      {/* Readiness */}
      <StrengthReadinessCard
        fatigue={fatigueScore}
        recovery={recoveryScore}
        soreness={soreness}
        acwr={acwr}
        weeksToRace={engineInput.weeksToRace}
      />

      {/* Week overview */}
      <StrengthWeekCard
        strengthWeek={strengthWeek}
        completedSessions={completedSessions}
        currentWeek={currentWeek}
      />

      {/* Phase rationale */}
      <Card style={[styles.rationaleCard, { borderLeftColor: colors.primary }]}>
        <Text style={[styles.rationaleNote, { color: colors.primary }]}>{strengthWeek.phaseNote}</Text>
        <Text style={[styles.rationaleText, { color: colors.textMuted }]}>{strengthWeek.phaseRationale}</Text>
      </Card>

      {/* Sessions */}
      <Text style={[styles.sectionHeader, { color: colors.textDim }]}>This Week's Sessions</Text>
      {strengthWeek.sessions.map((session, index) => {
        const key        = `sw${currentWeek}_${session.id}_${index}`;
        const isComplete = completedSessions.includes(key);
        return (
          <StrengthSessionCard
            key={session.id}
            session={session}
            isComplete={isComplete}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            onPress={() => (router as any).push(`/strength/${index}`)}
          />
        );
      })}

      {/* Pattern balance */}
      <StrengthPatternCard patternBalance={patternBalance} days={28} />

      {/* Coach insights */}
      <StrengthCoachCard insights={insights} />

      {/* History */}
      <StrengthHistoryCard history={history} limit={5} />

    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  rationaleCard: {
    marginBottom:    spacing.cardGap,
    borderLeftWidth: 3,
  },
  rationaleNote: {
    fontSize:     FontSize.sm,
    fontWeight:   FontWeight.medium,
    marginBottom: spacing.xs,
  },
  rationaleText: {
    fontSize:   FontSize.sm,
    lineHeight: 18,
  },
  sectionHeader: {
    fontSize:     FontSize.xs,
    fontWeight:   FontWeight.bold,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
});
