// ─── AI Coach ─────────────────────────────────────────────────────────────────
//
// Chat interface powered by Claude. Builds a system prompt from the user's
// onboarding profile, movement risk flags, and training context so responses
// are personalised to that specific athlete.

import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useOnboardingStore } from '../../../src/store/onboardingStore';
import { useMovementStore }   from '../../../src/store/movementStore';
import { useMobilityStore, weeklyCompletionCount } from '../../../src/store/mobilityStore';
import { getMobilityWorkout } from '../../../src/constants/mobilityBank';
import { useWorkoutStore } from '../../../src/store/workoutStore';
import { useStrengthStore } from '../../../src/store/strengthStore';
import { useReadinessStore } from '../../../src/store/readinessStore';
import { useAthleteStore } from '../../../src/store/athleteStore';
import { useCheckInStore } from '../../../src/store/checkInStore';
import { useTrainingPlanStore } from '../../../src/store/trainingPlanStore';
import { useHydrationPlannerStore } from '../../../src/store/hydrationPlannerStore';
import { useActivityStore } from '../../../src/store/activityStore';
import { useTrainingPreferencesStore } from '../../../src/store/trainingPreferencesStore';
import { useBeginnerPlanStore } from '../../../src/store/beginnerPlanStore';
import { useSettingsStore } from '../../../src/store/settingsStore';
import { useWeekPlan } from '../../../src/hooks/useWeekPlan';
import { pickTargetRace } from '../../../src/utils/plan/macroPlanner';
import { buildCoachingInput } from '../../../src/utils/coachingInputBuilder';
import { buildBudgetedCoachPrompt } from '../../../src/utils/coachPromptBudget';
import { summarizeActivityLoad } from '../../../src/utils/activityLoad';
import {
  calculateHydrationPlan,
  GI_TOLERANCE_CARBS_GH,
  weatherBandForTemp,
} from '../../../src/utils/hydrationEngine';
import { buildCoachHandoff, ANALYSIS_KIND_INFO } from '../../../src/utils/movementEngine';
import type { MovementAnalysis } from '../../../src/types/movement';
import type { ReadinessAssessment } from '../../../src/types/movementReadiness';
import type { MobilityCompletion } from '../../../src/types/mobility';
import { generateCoachingOutput } from '../../../src/utils/coachEngine';
import WeeklyCoachCard from '../../../src/components/coaching/WeeklyCoachCard';
import CoachInsightsCard from '../../../src/components/coaching/CoachInsightsCard';
import RaceReadinessCard from '../../../src/components/coaching/RaceReadinessCard';
import { todayDateKey } from '../../../src/types/checkin';
import type { CompletedWorkoutRecord } from '../../../src/types/training';
import type { StrengthLogRecord, StrengthSession } from '../../../src/types/strength';
import {
  checkAiCoachHealth,
  isAiCoachConfigured,
  sendCoachMessage,
  type AiCoachHealth,
  type CoachMessage,
} from '../../../src/lib/aiCoach';
import { useColors } from '../../../src/theme/useColors';
import type { Palette } from '../../../src/theme/colors';
import { spacing }  from '../../../src/theme/spacing';
import { FontSize, FontWeight, Radius } from '../../../src/theme/tokens';
import { displayLabel } from '../../../src/utils/displayLabels';
import { formatYMDForDisplay } from '../../../src/utils/dateFormatting';
import { sanitizeCoachDisplayText } from '../../../src/utils/coachDisplay';
import { useScheduledSessions } from '../../../src/hooks/useScheduledSessions';

// ─── Types ────────────────────────────────────────────────────────────────────

type Role    = 'user' | 'assistant';
type Message = CoachMessage & { role: Role };
type CoachTab = 'chat' | 'insights' | 'video';

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Real training context so answers are grounded in what the athlete actually
// did — never generic advice when app data exists.
export type CoachRaceContext = {
  name:     string;
  date:     string;
  distance: string;
  priority: string;
  weeksOut: number;
};

export type CoachTrainingContext = {
  runHistory:      CompletedWorkoutRecord[];
  strengthHistory: StrengthLogRecord[];
  readinessLine:   string;
  fatigueScore:    number;
  recoveryScore:   number;
  currentWeek:     number;
  trainingPhase:   string;

  // Build 33 plan spine — grounds the coach in the actual macro plan rather
  // than letting it infer or invent one.
  goalType:         string;
  programStartDate: string | null;
  focus:            string;
  race:             CoachRaceContext | 'none';
  adaptations:      string[];
  todayWorkout:     { title: string; rationale: string; target?: string; mainSet?: string } | null;
};

function shortDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function buildTrainingContextBlock(ctx: CoachTrainingContext): string {
  const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;
  const runs = ctx.runHistory
    .filter(r => !r.skipped && r.timestamp >= cutoff)
    .sort((a, b) => b.timestamp - a.timestamp);
  const strength = ctx.strengthHistory
    .filter(r => !r.skipped && r.timestamp >= cutoff)
    .sort((a, b) => b.timestamp - a.timestamp);

  const totalMiles = runs.reduce((s, r) => s + (r.actualDistanceMiles ?? r.estimatedDistanceMiles ?? 0), 0);
  const runLines = runs.slice(0, 5).map(r => {
    const miles = r.actualDistanceMiles ?? r.estimatedDistanceMiles;
    const minutes = r.actualDurationMinutes ?? r.durationMinutes;
    return `  - ${shortDate(r.timestamp)}: ${displayLabel(r.type)}, ${miles ? `${miles.toFixed(1)} mi` : 'distance n/a'}, ${minutes} min${r.rpe ? `, RPE ${r.rpe}` : ''}`;
  });
  const strengthLines = strength.slice(0, 3).map(r =>
    `  - ${shortDate(r.timestamp)}: ${displayLabel(r.sessionType)}${r.actualDuration ? `, ${r.actualDuration} min` : ''}${r.overallRpe ? `, RPE ${r.overallRpe}` : ''}`,
  );

  return `RECENT TRAINING (last 14 days)
- Runs: ${runs.length} totaling ${totalMiles.toFixed(1)} miles.
${runLines.length ? runLines.join('\n') : '  - No runs logged in this window.'}
- Strength sessions: ${strength.length}.
${strengthLines.length ? strengthLines.join('\n') : '  - No strength sessions logged in this window.'}

CURRENT STATE
- Training week ${ctx.currentWeek}, phase: ${ctx.trainingPhase}
- Fatigue ${ctx.fatigueScore}/100 · Recovery ${ctx.recoveryScore}/100
- ${ctx.readinessLine}`;
}

// Grounds the coach in the actual macro plan — goal, phase, race timeline,
// this week's focus, any adaptations applied, and today's session + why.
function buildTrainingPlanBlock(ctx: CoachTrainingContext): string {
  const raceLine = ctx.race === 'none'
    ? 'No race currently scheduled.'
    : `${ctx.race.name} (${ctx.race.distance}) on ${formatYMDForDisplay(ctx.race.date)} — priority ${ctx.race.priority === 'tune_up' ? 'Tune-Up' : ctx.race.priority}, ${ctx.race.weeksOut} week(s) out.`;

  const adaptLines = ctx.adaptations.length
    ? ctx.adaptations.map(a => `  - ${a}`).join('\n')
    : '  - None this week.';

  const todayLine = ctx.todayWorkout
    ? `Today's session: ${ctx.todayWorkout.title}${ctx.todayWorkout.target ? ` — ${ctx.todayWorkout.target}` : ''}${ctx.todayWorkout.mainSet ? ` — ${ctx.todayWorkout.mainSet}` : ''}. Why: ${ctx.todayWorkout.rationale}`
    : "Today's session and why: Rest day — no structured session today.";

  return `TRAINING PLAN
- Goal type: ${ctx.goalType}
- Program start date: ${formatYMDForDisplay(ctx.programStartDate)}
- Current phase: ${ctx.trainingPhase}, week ${ctx.currentWeek}
- This week's focus: ${ctx.focus || 'n/a'}
- Race: ${raceLine}
- This week's adaptations:
${adaptLines}
- ${todayLine}`;
}

// Recent Movement Lab still-frame + video analyses, serialized via the coach
// handoff contract so the coach can discuss actual findings, not vague
// summaries. Capped to the last 3 analyses to keep the prompt compact.
function buildMovementLabBlock(analyses: MovementAnalysis[]): string {
  const recent = analyses.slice(-3).reverse();
  if (recent.length === 0) return 'MOVEMENT LAB ANALYSES\nNone recorded yet.';

  const lines = recent.map(a => {
    const h = buildCoachHandoff(a);
    const angles = h.detectedAngles.length
      ? h.detectedAngles.slice(0, 6).map(x => `${x.name} ${Math.round(x.degrees)}°`).join(', ')
      : 'none detected';
    const findings = h.checklistFindings.length
      ? h.checklistFindings.slice(0, 6).map(f => `${f.label}: ${f.value}${f.severity ? ` (${f.severity})` : ''}`).join('; ')
      : 'none recorded';
    const recs = h.recommendations.slice(0, 6).map(r => r.finding).join('; ') || 'none';

    const videoExtra = h.mediaType === 'video'
      ? [
          `\n  Sequence confidence: ${displayLabel(h.sequenceConfidence) || 'n/a'}.`,
          h.repSummary
            ? ` Reps: ${h.repSummary.count}, depth range ${Math.round(h.repSummary.depthRangeDeg[0])}–${Math.round(h.repSummary.depthRangeDeg[1])}°${h.repSummary.consistencyDeg !== undefined ? `, consistency spread ${h.repSummary.consistencyDeg}°` : ''}.`
            : '',
          h.symmetryNote ? `\n  Symmetry estimate: ${h.symmetryNote}` : '',
          h.keyFrameLabels?.length ? `\n  Key frames: ${h.keyFrameLabels.slice(0, 6).join(', ')}` : '',
          h.sequenceLimitations?.length ? `\n  Sequence limitations: ${h.sequenceLimitations.slice(0, 4).join(' ')}` : '',
        ].join('')
      : '';

    return `- ${shortDate(a.createdAt)} · ${displayLabel(h.analysisType)} (${displayLabel(h.cameraView)} view, ${displayLabel(h.mediaType)})
  Detection quality: ${h.detectionQuality}. Overall confidence: ${displayLabel(h.confidence)}.
  Estimated angles (camera-view estimates, not clinical measurements): ${angles}
  Checklist findings: ${findings}
  Flagged: ${recs}${h.userNotes ? `\n  Athlete notes: ${h.userNotes.slice(0, 500)}` : ''}${videoExtra}`;
  });

  return `MOVEMENT LAB ANALYSES (most recent first — joint angles are estimates from photos/video frames, not clinical measurements)
${lines.join('\n')}`;
}

// The specific analysis the athlete tapped "Discuss with AI Coach" on. The FULL
// buildCoachHandoff payload is injected into the system prompt only — never the
// visible input — so the coach can speak to this analysis in detail. Clearly
// labeled so it never reads as context for an unrelated later question.
function buildFocusedAnalysisBlock(analysis: MovementAnalysis): string {
  const h = buildCoachHandoff(analysis);
  // closestSide is added to CoachHandoff by Agent A; read defensively so this
  // renders whether or not that field is present yet.
  const closestSide = (h as { closestSide?: 'left' | 'right' }).closestSide;

  const angles = h.detectedAngles.length
    ? h.detectedAngles.slice(0, 3).map(x => `${x.name} ${Math.round(x.degrees)}° Estimated (${Math.round(x.confidence * 100)}% landmark confidence)`).join(', ')
    : 'none detected';
  const findings = h.checklistFindings.length
    ? h.checklistFindings.slice(0, 5).map(f => `${f.label}: ${f.value}${f.severity ? ` (${f.severity})` : ''}${f.note ? ` — ${f.note.slice(0, 120)}` : ''}`).join('; ')
    : 'none recorded';
  const recs = h.recommendations.length
    ? h.recommendations.slice(0, 5).map(r => `${r.finding}${r.meaning ? ` — ${r.meaning.slice(0, 150)}` : ''}${r.recommendation ? ` Suggested: ${r.recommendation.slice(0, 150)}` : ''}${r.confidence ? ` [${r.confidence} confidence]` : ''}`).join('\n    ')
    : 'none';

  const videoExtra = h.mediaType === 'video'
    ? [
        `\n  Sequence confidence: ${displayLabel(h.sequenceConfidence) || 'n/a'}.`,
        h.repSummary
          ? `\n  Reps detected: ${h.repSummary.count}, peak-flexion range ${Math.round(h.repSummary.depthRangeDeg[0])}–${Math.round(h.repSummary.depthRangeDeg[1])}°${h.repSummary.consistencyDeg !== undefined ? `, consistency spread ${h.repSummary.consistencyDeg}°` : ''}.`
          : '',
        h.symmetryNote ? `\n  Symmetry estimate: ${h.symmetryNote}` : '',
        h.keyFrameLabels?.length ? `\n  Key frames: ${h.keyFrameLabels.slice(0, 3).join(', ')}` : '',
        h.sequenceLimitations?.length ? `\n  Sequence limitations: ${h.sequenceLimitations.slice(0, 3).join(' ')}` : '',
      ].join('')
    : '';

  return `FOCUSED ANALYSIS (the analysis the athlete tapped "Discuss with AI Coach" on — ${shortDate(analysis.createdAt)}. Joint angles are estimated 2D projections from a phone camera, not clinical measurements.)
  Movement type: ${displayLabel(h.analysisType)}
  Camera view: ${displayLabel(h.cameraView)}${closestSide ? ` · Closest side to camera: ${closestSide}` : ''}
  Media type: ${displayLabel(h.mediaType)}
  Detection quality: ${h.detectionQuality}. Overall confidence: ${displayLabel(h.confidence)}.
  Landmark source: ${h.landmarkSource === 'user_corrected' ? 'user-corrected' : 'auto-detected'}.
  Manual corrections: ${h.manualCorrections.length ? h.manualCorrections.join('; ') : 'none'}.
  Manual review required: ${h.manualReviewRequired ? 'yes' : 'no'}.
  Estimated angles: ${angles}
  Checklist findings: ${findings}
  Automated findings and recommendations:
    ${recs}${videoExtra}${h.userNotes ? `\n  Athlete notes: ${h.userNotes.slice(0, 800)}` : ''}
  Limitations: ${h.limitations.length ? h.limitations.slice(0, 3).join(' ') : 'none noted'}`;
}

// Legacy 'lunge_single_leg' records still carry the retired combined title in
// ANALYSIS_KIND_INFO. Agent A's normalizeAnalysisKind
// (src/utils/measurementMatrix) will map these to single_leg_control / lunge;
// until that module lands this local fallback keeps the retired label out of the
// coach list. TODO(Build36): replace with normalizeAnalysisKind once available.
function analysisKindLabel(analysis: MovementAnalysis): string {
  if (analysis.type === 'lunge_single_leg') {
    return analysis.cameraView === 'side' ? 'Lunge' : 'Single-Leg Control';
  }
  return ANALYSIS_KIND_INFO[analysis.type]?.title ?? 'Movement Analysis';
}

// Latest Running/Walking Readiness Assessment — summary only, never raw data.
function buildReadinessBlock(assessment: ReadinessAssessment | undefined): string {
  if (!assessment) return 'RUNNING/WALKING READINESS ASSESSMENT\nNone recorded yet.';

  const domainLines = assessment.domainResults.map(d => {
    const sides = d.leftValue !== undefined || d.rightValue !== undefined
      ? ` (L ${d.leftValue ?? 'n/a'}${d.unit ?? ''} / R ${d.rightValue ?? 'n/a'}${d.unit ?? ''})`
      : '';
    return `  - ${displayLabel(d.domain)}: ${displayLabel(d.category)}${sides} — ${d.note}`;
  });

  const workoutTitles = assessment.recommendedMobilityWorkoutIds
    .map(id => getMobilityWorkout(id)?.title)
    .filter((t): t is string => Boolean(t));

  return `RUNNING/WALKING READINESS ASSESSMENT (${shortDate(assessment.createdAt)}, focus: ${assessment.activityFocus})
- Overall: ${displayLabel(assessment.overall)}
- Pain reported: ${assessment.painReported ? 'Yes — consult-a-clinician messaging was shown to the athlete' : 'No'}
- Athlete-reported symptom: ${assessment.symptom ? `${assessment.symptom.intensity}/10 at ${assessment.symptom.location}${assessment.symptom.notes ? ` — ${assessment.symptom.notes.slice(0, 300)}` : ''}` : 'none recorded'}
- Domains:
${domainLines.length ? domainLines.join('\n') : '  - none scored'}
- Key findings: ${assessment.keyFindings.length ? assessment.keyFindings.join('; ') : 'none'}
- Capture quality: ${assessment.captureQualitySummary}
- Recommended mobility work: ${workoutTitles.length ? workoutTitles.join(', ') : 'none'}`;
}

// Mobility recommendations + recent completions (last 14 days, capped to 5 lines).
function buildMobilityBlock(recommendedIds: string[], completions: MobilityCompletion[]): string {
  const recTitles = recommendedIds
    .map(id => getMobilityWorkout(id)?.title)
    .filter((t): t is string => Boolean(t));

  const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;
  const recent = completions
    .filter(c => c.completedAt >= cutoff)
    .sort((a, b) => b.completedAt - a.completedAt);
  const recentLines = recent.slice(0, 5).map(c =>
    `  - ${shortDate(c.completedAt)}: ${getMobilityWorkout(c.workoutId)?.title ?? c.workoutId}`,
  );

  return `MOBILITY
- Recommended workouts: ${recTitles.length ? recTitles.join(', ') : 'none currently recommended'}
- Completions in last 14 days: ${recent.length}
${recentLines.length ? recentLines.join('\n') : '  - none'}
- This week's completion count: ${weeklyCompletionCount(completions)}`;
}

function buildSystemPrompt(
  data:        ReturnType<typeof useOnboardingStore.getState>['data'],
  riskFlags:   ReturnType<typeof useMovementStore.getState>['getActiveRiskFlags'],
  trainingCtx: CoachTrainingContext,
  analyses:    MovementAnalysis[],
  readinessAssessment: ReadinessAssessment | undefined,
  mobilityRecommendedIds: string[],
  mobilityCompletions: MobilityCompletion[],
  focusedAnalysis: MovementAnalysis | undefined,
  question: string,
  hydrationContext: string,
  strengthContext: string,
): string {
  const flags   = riskFlags();
  const flagTxt = flags.length
    ? flags.map(f => `- ${f.sourceFinding} (${f.severity}): ${f.suggestion}`).join('\n')
    : 'None currently flagged.';

  const pr = data.hasPR && data.prTimeSeconds
    ? `${data.prDistance ?? ''} PR: ${Math.floor(data.prTimeSeconds / 60)}:${String(data.prTimeSeconds % 60).padStart(2, '0')}`
    : 'No PR on file';

  const feature = focusedAnalysis ? 'movement'
    : /hydrat|fuel|carb|sodium|fluid|sweat/i.test(question) ? 'hydration'
      : /strength|lift|preset|training block|sets|reps/i.test(question) ? 'strength'
        : /mobility|stretch|range of motion|warmup|warm-up/i.test(question) ? 'mobility'
          : /movement|gait|squat|deadlift|lunge|marker|angle/i.test(question) ? 'movement'
            : 'running';

  const athlete = `${data.name || 'Athlete'} · goal ${data.primaryGoal}${data.goalRaceLabel ? ` (${data.goalRaceLabel})` : ''} · ${data.weeklyMileage} mi/week · ${data.targetSessions} sessions/week · strength ${data.strengthLevel} · ${pr}. Current injury/symptom context: ${data.hasCurrentInjury ? data.injuryNotes || 'reported, no details' : 'none reported'}.`;
  const activityState = useActivityStore.getState();
  const preferences = useTrainingPreferencesStore.getState();
  const beginnerPlan = useBeginnerPlanStore.getState().activePlan;
  const recentActivities = [...activityState.activities]
    .sort((a, b) => b.startTime - a.startTime)
    .slice(0, 5);
  const load = summarizeActivityLoad(
    activityState.activities.filter(activity => Date.now() - activity.startTime <= 7 * 24 * 60 * 60 * 1000),
  );
  const activityContext = `PRIMARY ENDURANCE AND RECENT ACTIVITY
- Primary endurance mode: ${displayLabel(preferences.primaryEnduranceMode)}
- Active preset plan: ${beginnerPlan ? `${displayLabel(beginnerPlan.goal)} through ${formatYMDForDisplay(beginnerPlan.targetDate)}` : 'none'}
- Cross-training: ${preferences.crossTrainingDecision}${preferences.crossTrainingActivities.length ? `; preferred ${preferences.crossTrainingActivities.map(item => displayLabel(item.activityType)).join(', ')}` : ''}
- 7-day load: whole body ${Math.round(load.wholeBody)}, running ${Math.round(load.running)}, walking ${Math.round(load.walking)}, cross-training ${Math.round(load.crossTraining)}, strength ${Math.round(load.strength)}.
- Recent activity: ${recentActivities.length ? recentActivities.map(activity => `${displayLabel(activity.activityType)} ${Math.round((activity.metrics.durationSeconds ?? 0) / 60)} min${activity.rpe ? ` RPE ${activity.rpe}` : ''}`).join('; ') : 'none'}.
Cycling, swimming, and walking do not count as running mileage or running pace history. Workload trends do not predict injury.`;
  const featureContext = feature === 'movement'
    ? (focusedAnalysis ? buildFocusedAnalysisBlock(focusedAnalysis) : buildMovementLabBlock(analyses))
    : feature === 'hydration' ? hydrationContext
      : feature === 'strength' ? strengthContext
        : feature === 'mobility' ? buildMobilityBlock(mobilityRecommendedIds, mobilityCompletions)
          : `${buildTrainingPlanBlock(trainingCtx)}\n${buildTrainingContextBlock(trainingCtx)}`;

  return buildBudgetedCoachPrompt({
    question,
    sections: [
      {
        key: 'Coaching role',
        priority: 1,
        required: true,
        content: `You are the StrideOS running, strength, movement, mobility, hydration, and fueling coach speaking directly with ${data.name || 'the athlete'}. Give concise, personalized guidance using Observation → Interpretation → Recommendation.`,
      },
      {
        key: 'Safety and evidence rules',
        priority: 2,
        required: true,
        content: 'Never diagnose, predict injury, guarantee symptom prevention, or infer tissue loading, joint force, or pathology from app data. Movement values are estimated two-dimensional projections based on the available camera view. Use “may reflect,” “may be associated with,” “approximate,” and “manual review recommended.” For pain, injury, neurologic symptoms, or medical concerns, recommend a qualified clinician. Do not invent findings. Use plain text only: no markdown syntax, no emojis, no raw asterisks, and no backticks. When exact session data is present, use it directly; do not tell the athlete to check the app for the same details.',
      },
      {
        key: 'Essential athlete context',
        priority: 4,
        required: true,
        content: athlete,
      },
      {
        key: `${feature} context`,
        priority: 5,
        required: true,
        content: featureContext,
        compact: featureContext.slice(0, 1_400),
      },
      {
        key: 'Activity and goal context',
        priority: 6,
        content: activityContext,
        compact: `Mode ${preferences.primaryEnduranceMode}; plan ${beginnerPlan?.goal ?? 'none'}; loads total ${Math.round(load.wholeBody)}, run ${Math.round(load.running)}, walk ${Math.round(load.walking)}, cross ${Math.round(load.crossTraining)}, strength ${Math.round(load.strength)}.`,
      },
      {
        key: 'Symptoms and restrictions',
        priority: 7,
        content: `${buildReadinessBlock(readinessAssessment)}\nMovement considerations:\n${flagTxt}`,
        compact: data.hasCurrentInjury ? `Athlete-reported concern: ${data.injuryNotes || 'no details'}.` : 'No current injury reported.',
      },
      {
        key: 'Optional recent context',
        priority: 8,
        content: feature === 'running' ? buildTrainingContextBlock(trainingCtx) : buildTrainingPlanBlock(trainingCtx),
        compact: `Week ${trainingCtx.currentWeek}, ${trainingCtx.trainingPhase}; fatigue ${trainingCtx.fatigueScore}/100, recovery ${trainingCtx.recoveryScore}/100.`,
      },
    ],
  });
}

function buildHydrationContext(
  data: ReturnType<typeof useOnboardingStore.getState>['data'],
): string {
  const planner = useHydrationPlannerStore.getState();
  const settings = useSettingsStore.getState();
  const durationMin = planner.durationMin ?? Math.max(30, Math.round(planner.distanceMi * 10));
  const humidityBand = planner.humidityPct >= 85 ? 'very_high'
    : planner.humidityPct >= 65 ? 'high'
      : planner.humidityPct >= 35 ? 'moderate'
        : 'low';
  const categoryTolerance = planner.giTolerance === 'unsure'
    ? undefined
    : GI_TOLERANCE_CARBS_GH[planner.giTolerance];
  const carbToleranceGh = planner.carbToleranceMode === 'known'
    ? planner.knownCarbToleranceGh ?? undefined
    : planner.carbToleranceMode === 'category'
      ? categoryTolerance
      : undefined;
  const plan = calculateHydrationPlan({
    distanceMiles: planner.distanceMi,
    durationMin,
    bodyWeightKg: data.weightKg || 70,
    effort: planner.effort,
    weatherBand: weatherBandForTemp(planner.tempF),
    temperatureF: planner.tempF,
    humidityBand,
    sweatiness: planner.sweatiness,
    sweatRateTestLh: planner.sweatRateMode === 'known' ? planner.sweatRateLh : undefined,
    saltiness: planner.saltiness,
    sweatSodiumMgL: planner.sweatSodiumMgL ?? undefined,
    cramping: planner.cramping,
    carbToleranceGh,
    fluidComfort: planner.fluidComfort,
    goal: planner.goal,
  });

  return `HYDRATION AND FUELING PLAN
- Expected duration: ${durationMin} min for ${planner.distanceMi.toFixed(2)} mi.
- Environment: ${planner.tempF}°F, ${planner.humidityPct}% humidity (${planner.weatherSource === 'current_location' ? 'current-location weather' : 'manual weather'}).
- Fluid: ${plan.range.fluidLowL.toFixed(2)}–${plan.range.fluidHighL.toFixed(2)} L/hr (${Math.round(plan.range.fluidLowL * 33.814)}–${Math.round(plan.range.fluidHighL * 33.814)} oz/hr).
- Carbohydrate: ${plan.range.carbsLowG}–${plan.range.carbsHighG} g/hr.
- Sodium intake: ${plan.range.sodiumLowMg}–${plan.range.sodiumHighMg} mg/hr. Sweat sodium concentration: ${Math.round(plan.physiology.sweatSodiumMgL)} mg/L.
- Hydration reminder: ${planner.hydrationReminderEnabled ? `${planner.hydrationReminderIntervalMin} min (${planner.hydrationReminderSelection})` : 'off'}.
- Fuel reminder: ${planner.fuelReminderEnabled ? `${planner.fuelReminderIntervalMin || settings.fuelingReminderIntervalMin} min (${planner.fuelReminderSelection})` : 'off'}.
- Confidence: ${plan.confidence.label}. This is an approximate training plan, not a medical prescription or guarantee of symptom prevention.`;
}

function buildStrengthContext(
  trainingCtx: CoachTrainingContext,
  strengthSession: StrengthSession | undefined,
): string {
  const recent = trainingCtx.strengthHistory
    .filter(record => !record.skipped)
    .sort((a, b) => b.timestamp - a.timestamp)[0];
  const exercises = strengthSession?.exercises
    .slice(0, 6)
    .map(item => `${item.exercise.name} ${item.sets}×${item.repRange[0]}–${item.repRange[1]}`)
    .join(', ');

  return `STRENGTH CONTEXT
- Current option: ${strengthSession ? `Training Block Workout — ${strengthSession.title}` : 'No Training Block Workout scheduled'}.
- Purpose: ${strengthSession?.purpose ?? 'No scheduled session purpose available.'}
- Main exercises: ${exercises || 'none scheduled'}.
- Current session state: no active-session details supplied to this handoff.
- Most recent completed strength session: ${recent ? `${shortDate(recent.timestamp)}, ${displayLabel(recent.sessionType)}${recent.overallRpe ? `, RPE ${recent.overallRpe}` : ''}` : 'none logged'}.`;
}

// ─── Message bubble ───────────────────────────────────────────────────────────

function Bubble({ msg }: { msg: Message }) {
  const C = useColors();
  const b = useMemo(() => makeBubbleStyles(C), [C]);
  const isUser = msg.role === 'user';
  return (
    <View style={[b.wrap, isUser ? b.userWrap : b.assistantWrap]}>
      {!isUser && <Text style={b.avatar}>AI</Text>}
      <View style={[b.bubble, isUser ? b.userBubble : b.assistantBubble]}>
        <Text style={[b.txt, isUser ? b.userTxt : b.assistantTxt]}>{isUser ? msg.content : sanitizeCoachDisplayText(msg.content)}</Text>
      </View>
    </View>
  );
}

function buildContextSummary(data: ReturnType<typeof useOnboardingStore.getState>['data']): string {
  const parts = [
    data.primaryGoal ? `Goal ${data.primaryGoal}` : null,
    data.goalRaceLabel ? `Race ${data.goalRaceLabel}` : null,
    data.weeklyMileage ? `${data.weeklyMileage} mi/week` : null,
    data.targetSessions ? `${data.targetSessions} sessions/week` : null,
    data.trainingStyle ? `Style ${data.trainingStyle}` : null,
    data.hrResting ? `RHR ${data.hrResting} bpm` : null,
  ].filter(Boolean);

  return parts.length > 0
    ? parts.join(' · ')
    : 'Readiness, training history, movement findings, and profile data feed this chat.';
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function CoachScreen() {
  const C = useColors();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ ask?: string; analysisId?: string }>();
  const data      = useOnboardingStore(s => s.data);
  const riskFlags = useMovementStore(s => s.getActiveRiskFlags);
  const videos = useMovementStore(s => s.videos);
  const movementAnalyses = useMovementStore(s => s.analyses);
  const readinessAssessments = useMovementStore(s => s.readinessAssessments);
  const latestReadinessAssessment = useMemo(
    () => (readinessAssessments.length ? [...readinessAssessments].sort((a, b) => b.createdAt - a.createdAt)[0] : undefined),
    [readinessAssessments],
  );
  const mobilityRecommendedIds = useMobilityStore(s => s.recommendedWorkoutIds);
  const mobilityCompletions = useMobilityStore(s => s.completions);
  const runHistory = useWorkoutStore(s => s.history);
  const strengthHistory = useStrengthStore(s => s.history);
  const todayReadiness = useReadinessStore(s => s.todayReadiness);
  const fatigueScore = useAthleteStore(s => s.fatigueScore);
  const recoveryScore = useAthleteStore(s => s.recoveryScore);
  const currentWeek = useAthleteStore(s => s.currentWeek);
  const trainingPhase = useAthleteStore(s => s.trainingPhase);

  // ── Plan spine — grounds the coach in the real macro plan ──────────────────
  const weekPlan          = useWeekPlan();
  const scheduled         = useScheduledSessions(weekPlan);
  const { richWeek, weeksToRace } = weekPlan;
  const planGoalType      = useTrainingPlanStore(s => s.goalType);
  const planStartDate     = useTrainingPlanStore(s => s.programStartDate);
  const planRaces         = useTrainingPlanStore(s => s.races);

  const targetRaceCtx: CoachRaceContext | 'none' = useMemo(() => {
    if (planGoalType !== 'race_prep' || !planStartDate) return 'none';
    const race = pickTargetRace(planRaces, planStartDate);
    if (!race) return 'none';
    return {
      name: race.name, date: race.date, distance: race.distance,
      priority: race.priority, weeksOut: weekPlan.weeksToRace,
    };
  }, [planGoalType, planStartDate, planRaces, weekPlan.weeksToRace]);

  const todayWorkoutCtx = useMemo(() => {
    const session = scheduled.todayPrimary;
    if (!session) return null;
    const prescription = session.runWalk
      ? `Total ${session.runWalk.totalMinutes} min; warm-up ${session.runWalk.warmupMinutes} min; ${session.runWalk.rounds} rounds of ${session.runWalk.runSeconds} sec run / ${session.runWalk.walkSeconds} sec walk; cooldown ${session.runWalk.cooldownMinutes} min; ${session.runWalk.hrZone}; RPE ${session.runWalk.rpe}.`
      : `${session.durationMinutes} min; ${session.target}; ${session.hrTarget ?? ''}; ${session.rpeTarget ?? ''}.`;
    return { title: session.title, rationale: `${session.purpose} ${prescription}` };
  }, [scheduled.todayPrimary]);

  const trainingCtx: CoachTrainingContext = useMemo(() => ({
    runHistory,
    strengthHistory,
    readinessLine: todayReadiness?.date === todayDateKey()
      ? `Today's readiness check-in: ${todayReadiness.score}/100`
      : 'No readiness check-in yet today.',
    fatigueScore,
    recoveryScore,
    currentWeek,
    trainingPhase,
    goalType:         planGoalType,
    programStartDate: planStartDate,
    focus:            weekPlan.metadata.focus,
    race:             targetRaceCtx,
    adaptations:      weekPlan.adaptations,
    todayWorkout:     todayWorkoutCtx,
  }), [
    runHistory, strengthHistory, todayReadiness, fatigueScore, recoveryScore, currentWeek, trainingPhase,
    planGoalType, planStartDate, weekPlan.metadata.focus, targetRaceCtx, weekPlan.adaptations, todayWorkoutCtx,
  ]);

  // ── Insights (deterministic coach engine over real history) ────────────────
  const goalRace = useAthleteStore(s => s.goalRace);
  const progressionLevel = useAthleteStore(s => s.progressionLevel);
  const weeklyMileage = useAthleteStore(s => s.weeklyMileage);
  const todayCheckIn = useCheckInStore(s => s.todayCheckIn);
  const completedWorkouts = useWorkoutStore(s => s.completedWorkouts);

  const coaching = useMemo(() => {
    const checkedIn = todayCheckIn?.date === todayDateKey();
    const todayIdx = (new Date().getDay() + 6) % 7; // richWeek.workouts is Monday-indexed
    const todayWorkout = richWeek.workouts[todayIdx] ?? null;
    const todayKey = todayWorkout ? `w${currentWeek}_${todayWorkout.id}_${todayIdx}` : '';
    return generateCoachingOutput(buildCoachingInput({
      athleteName: data.name || 'Athlete',
      goalRace,
      currentWeek,
      trainingPhase,
      progressionLevel,
      weeklyMileage,
      fatigueScore,
      recoveryScore,
      soreness: checkedIn ? (todayCheckIn?.soreness ?? null) : null,
      motivation: checkedIn ? (todayCheckIn?.motivation ?? null) : null,
      checkedIn,
      todayWorkoutType: todayWorkout?.type ?? 'rest',
      isRestDay: !todayWorkout || todayWorkout.type === 'rest',
      isTodayComplete: todayKey ? completedWorkouts.includes(todayKey) : false,
      weeksRemaining: weeksToRace,
      plannedSessionsPerWeek: data.targetSessions || 4,
      history: runHistory,
    }));
  }, [
    completedWorkouts, currentWeek, data.name, data.targetSessions, fatigueScore, goalRace,
    progressionLevel, recoveryScore, richWeek, runHistory, todayCheckIn, trainingPhase,
    weeklyMileage, weeksToRace,
  ]);
  const historyWeekCount = useMemo(
    () => new Set(runHistory.filter(r => !r.skipped).map(r => r.week)).size,
    [runHistory],
  );

  const [tab,       setTab]       = useState<CoachTab>('chat');
  const [messages,  setMessages]  = useState<Message[]>([]);
  const [input,     setInput]     = useState('');
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  // The analysis the athlete tapped "Discuss with AI Coach" on. Captured from
  // the deep-link param and kept in state past the param-clear so it grounds
  // the next question without leaking into the visible input.
  const [focusAnalysisId, setFocusAnalysisId] = useState<string | null>(null);
  const [coachHealth, setCoachHealth] = useState<AiCoachHealth | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const recentVideos = useMemo(() => videos.slice(-3).reverse(), [videos]);
  const recentAnalyses = useMemo(
    () => [...movementAnalyses].sort((a, b) => b.createdAt - a.createdAt).slice(0, 5),
    [movementAnalyses],
  );

  const isConfigured = isAiCoachConfigured();
  const coachReady = isConfigured && coachHealth?.ok;
  const contextSummary = buildContextSummary(data);
  const s = useMemo(() => makeStyles(C), [C]);
  const b = useMemo(() => makeBubbleStyles(C), [C]);

  // Deep-link handoff (e.g. TermDefinitionModal, readiness report "Ask AI
  // Coach", Movement Lab "Discuss with AI Coach"): prefill the ask param into
  // the input without auto-sending and capture any analysisId into state before
  // clearing the params so they don't refire on the next render. analysisId is
  // read alongside ask so a later ask-only handoff clears any stale focus.
  useEffect(() => {
    if (!params.ask && !params.analysisId) return;
    setTab('chat');
    if (params.ask) setInput(params.ask);
    setFocusAnalysisId(params.analysisId ?? null);
    router.setParams({ ask: undefined, analysisId: undefined });
  }, [params.ask, params.analysisId]);

  useEffect(() => {
    let cancelled = false;
    if (!isConfigured || tab !== 'chat') return;

    setHealthLoading(true);
    checkAiCoachHealth()
      .then(result => {
        if (!cancelled) setCoachHealth(result);
      })
      .finally(() => {
        if (!cancelled) setHealthLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isConfigured, tab]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message   = { role: 'user', content: text };
    const updated: Message[] = [...messages, userMsg];
    setMessages(updated);
    setInput('');
    setLoading(true);
    setError(null);

    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      const focusedAnalysis = focusAnalysisId
        ? movementAnalyses.find(a => a.id === focusAnalysisId)
        : undefined;
      const system  = buildSystemPrompt(
        data, riskFlags, trainingCtx, movementAnalyses,
        latestReadinessAssessment, mobilityRecommendedIds, mobilityCompletions,
        focusedAnalysis, text, buildHydrationContext(data),
        buildStrengthContext(trainingCtx, weekPlan.strengthWeek.sessions[0]),
      );
      const reply = sanitizeCoachDisplayText(await sendCoachMessage(updated, system));
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to reach AI coach.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <View style={[s.header, { paddingTop: insets.top + 6 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={20} color={C.primary} />
        </Pressable>
        <View>
          <Text style={s.headerLabel}>AI COACH</Text>
          <Text style={s.headerTitle}>AI Coaching</Text>
        </View>
      </View>

      <View style={s.segment}>
        <Pressable
          style={[s.segmentBtn, tab === 'chat' && s.segmentBtnActive]}
          onPress={() => setTab('chat')}
        >
          <Text style={[s.segmentTxt, tab === 'chat' && s.segmentTxtActive]}>Ask Coach</Text>
        </Pressable>
        <Pressable
          style={[s.segmentBtn, tab === 'insights' && s.segmentBtnActive]}
          onPress={() => setTab('insights')}
        >
          <Text style={[s.segmentTxt, tab === 'insights' && s.segmentTxtActive]}>Insights</Text>
        </Pressable>
        <Pressable
          style={[s.segmentBtn, tab === 'video' && s.segmentBtnActive]}
          onPress={() => setTab('video')}
        >
          <Text style={[s.segmentTxt, tab === 'video' && s.segmentTxtActive]}>Video</Text>
        </Pressable>
      </View>

      {tab === 'chat' && (!isConfigured || (coachHealth && !coachHealth.ok)) ? (
        <View style={s.noKey}>
          <Ionicons name="key-outline" size={38} color={C.primary} />
          <Text style={s.noKeyTitle}>Coach setup required</Text>
          <Text style={s.noKeyDesc}>
            {!isConfigured
              ? 'Add your Supabase URL and anon key to the app .env file.'
              : coachHealth?.error ?? 'Set ANTHROPIC_API_KEY as a Supabase Edge Function secret.'}
            {' '}This keeps the Anthropic key out of the iOS app.
          </Text>
          {isConfigured && (
            <Pressable
              style={s.retryBtn}
              onPress={async () => {
                setHealthLoading(true);
                setCoachHealth(await checkAiCoachHealth());
                setHealthLoading(false);
              }}
            >
              <Text style={s.retryTxt}>{healthLoading ? 'Checking...' : 'Check Again'}</Text>
            </Pressable>
          )}
        </View>
      ) : tab === 'chat' && (healthLoading || !coachHealth) ? (
        <View style={s.noKey}>
          <ActivityIndicator size="small" color={C.primary} />
          <Text style={s.noKeyTitle}>Checking coach connection</Text>
          <Text style={s.noKeyDesc}>Verifying the Supabase Edge Function and model setup.</Text>
        </View>
      ) : tab === 'chat' ? (
        <>
          <ScrollView
            ref={scrollRef}
            style={s.messages}
            contentContainerStyle={[s.messagesContent, { paddingBottom: spacing.xxl + insets.bottom + 84 }]}
            showsVerticalScrollIndicator={false}
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
            onScrollBeginDrag={() => Keyboard.dismiss()}
          >
            <View style={s.contextCard}>
              <Text style={s.contextEyebrow}>Your Training Context</Text>
              <Text style={s.contextTxt}>{contextSummary}</Text>
            </View>

            {messages.length === 0 && (
              <View style={s.empty}>
                <Text style={s.emptyTitle}>Ask your AI Coach</Text>
                <Text style={s.emptyDesc}>
                  Questions about training, recovery, nutrition, pacing, symptoms, or returning to training -
                  answered using your real data.
                </Text>
                <View style={s.suggestions}>
                  {[
                    'What should my easy run pace be?',
                    'How do I increase mileage safely?',
                    'Give me a warmup routine',
                  ].map(q => (
                    <Pressable key={q} style={s.suggestion} onPress={() => setInput(q)}>
                      <Text style={s.suggestionTxt}>{q}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            {messages.map((msg, i) => <Bubble key={i} msg={msg} />)}

            {loading && (
              <View style={[b.wrap, b.assistantWrap]}>
                <Text style={b.avatar}>AI</Text>
                <View style={[b.bubble, b.assistantBubble]}>
                  <ActivityIndicator size="small" color={C.primary} />
                </View>
              </View>
            )}

            {error && (
              <View style={s.errorBox}>
                <Text style={s.errorTxt}>{error}</Text>
              </View>
            )}
          </ScrollView>

          <View style={[s.inputRow, { paddingBottom: insets.bottom + 10 }]}>
            <TextInput
              style={s.input}
              value={input}
              onChangeText={setInput}
              placeholder="Ask your coach..."
              placeholderTextColor={C.textSubtle}
              multiline
              maxLength={1000}
              onSubmitEditing={sendMessage}
              returnKeyType="send"
            />
            <Pressable
              style={[s.sendBtn, (!input.trim() || loading) && s.sendBtnDisabled]}
              onPress={sendMessage}
              disabled={!input.trim() || loading}
            >
              <Text style={s.sendTxt}>↑</Text>
            </Pressable>
          </View>
        </>
      ) : tab === 'insights' ? (
        <ScrollView style={s.messages} contentContainerStyle={s.videoContent} showsVerticalScrollIndicator={false}>
          <View style={s.contextCard}>
            <Text style={s.contextEyebrow}>Training Insights</Text>
            <Text style={s.contextTxt}>
              {historyWeekCount >= 2
                ? 'Generated from your real training history, recovery, and load — every insight explains what it sees, why it matters, and what to do.'
                : `Based on ${historyWeekCount === 0 ? 'no' : 'limited'} logged training so far — treat these as low-confidence until more sessions are logged.`}
            </Text>
          </View>
          <WeeklyCoachCard summary={coaching.weeklySummary} />
          <CoachInsightsCard insights={coaching.allInsights} maxVisible={4} />
          <RaceReadinessCard readiness={coaching.raceReadiness} />
        </ScrollView>
      ) : (
        <ScrollView style={s.messages} contentContainerStyle={s.videoContent} showsVerticalScrollIndicator={false}>
          <View style={s.contextCard}>
            <Text style={s.contextEyebrow}>Movement Lab</Text>
            <Text style={s.contextTxt}>
              Movement Lab is the single home for recording, importing, and analyzing your movement.
              Your saved analyses feed this chat automatically — open one below or tap "Discuss with AI
              Coach" from any analysis to ask about it here.
            </Text>
          </View>

          {recentAnalyses.length > 0 ? (
            <View style={s.reviewCard}>
              <Text style={s.recentTitle}>Recent Saved Analyses</Text>
              {recentAnalyses.map(a => (
                <Pressable
                  key={a.id}
                  style={s.videoRow}
                  onPress={() => a.mediaType === 'video'
                    ? router.push({ pathname: '/(tabs)/movement/video-analysis', params: { id: a.id } } as never)
                    : router.push({ pathname: '/(tabs)/movement/analysis-detail', params: { analysisId: a.id } } as never)
                  }
                >
                  <View>
                    <Text style={s.videoRowTitle} numberOfLines={1}>{analysisKindLabel(a)}</Text>
                    <Text style={s.videoRowMeta}>{shortDate(a.createdAt)} · {displayLabel(a.mediaType)}</Text>
                  </View>
                  <Text style={s.videoRowChevron}>›</Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          {recentVideos.length > 0 ? (
            <View style={s.reviewCard}>
              <Text style={s.recentTitle}>Recent Movement Lab Videos</Text>
              {recentVideos.map(video => (
                <Pressable
                  key={video.id}
                  style={s.videoRow}
                  onPress={() => router.push({ pathname: '/(tabs)/movement/[videoId]', params: { videoId: video.id } })}
                >
                  <View>
                    <Text style={s.videoRowTitle} numberOfLines={1}>{video.title}</Text>
                    <Text style={s.videoRowMeta}>{video.date} · {displayLabel(video.activity)}</Text>
                  </View>
                  <Text style={s.videoRowChevron}>›</Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          <Pressable style={s.openLabBtn} onPress={() => router.push('/(tabs)/movement')}>
            <Text style={s.openLabBtnTxt}>Open Movement Lab</Text>
          </Pressable>
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

function makeStyles(C: Palette) {
  return StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: spacing.lg,
    paddingBottom: 12,
  },
  headerLabel: {
    color: C.textDim,
    fontSize: 11,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.9,
  },
  headerTitle: {
    color: C.text,
    fontSize: 26,
    fontWeight: FontWeight.bold,
    fontFamily: 'CormorantGaramond_700Bold',
  },

  segment: {
    flexDirection: 'row',
    gap: 4,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    marginBottom: 14,
    padding: 4,
    backgroundColor: C.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  segmentBtn: {
    flex: 1,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentBtnActive: { backgroundColor: C.primaryDim },
  segmentTxt: { color: C.textDim, fontSize: 11, fontWeight: FontWeight.bold },
  segmentTxtActive: { color: C.primary },

  noKey: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    padding:        spacing.xl,
    gap:            spacing.md,
  },
  noKeyIcon:  { fontSize: 40 },
  noKeyTitle: { color: C.text, fontSize: FontSize.lg, fontWeight: FontWeight.bold, textAlign: 'center' },
  noKeyDesc:  { color: C.textMuted, fontSize: FontSize.sm, lineHeight: 20, textAlign: 'center' },
  retryBtn: {
    backgroundColor: C.primary,
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  retryTxt: { color: C.onPrimary, fontSize: FontSize.sm, fontWeight: FontWeight.bold },

  messages:        { flex: 1 },
  messagesContent: { paddingHorizontal: 18, paddingBottom: spacing.xxl, gap: 8 },
  videoContent: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },

  contextCard: {
    backgroundColor: C.primaryDim,
    borderColor: C.primary,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: 4,
  },
  contextEyebrow: {
    color: C.primary,
    fontSize: 10,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  contextTxt: { color: C.textMuted, fontSize: FontSize.xs, lineHeight: 18 },

  empty: {
    alignItems: 'center',
    backgroundColor: C.card,
    borderColor: C.border,
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    gap: 4,
  },
  emptyTitle: { color: C.text, fontSize: 13, fontWeight: FontWeight.bold },
  emptyDesc:  { color: C.textMuted, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  suggestions: { gap: spacing.xs, width: '100%', marginTop: spacing.sm },
  suggestion: {
    backgroundColor:   C.card,
    borderRadius:      Radius.sm,
    borderWidth:       1,
    borderColor:       C.border,
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.sm,
  },
  suggestionTxt: { color: C.primary, fontSize: FontSize.sm },

  errorBox: {
    backgroundColor: C.critical + '22',
    borderRadius:    Radius.sm,
    padding:         spacing.md,
    borderWidth:     1,
    borderColor:     C.critical + '44',
  },
  errorTxt: { color: C.critical, fontSize: FontSize.sm },

  reviewCard: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 16,
    padding: spacing.md,
    gap: spacing.sm,
  },
  recentTitle: { color: C.text, fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  videoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: C.border,
    gap: spacing.sm,
  },
  videoRowTitle: { color: C.text, fontSize: FontSize.sm, fontWeight: FontWeight.bold, maxWidth: 260 },
  videoRowMeta: { color: C.textMuted, fontSize: FontSize.xs, marginTop: 2 },
  videoRowChevron: { color: C.primary, fontSize: 22 },
  openLabBtn: {
    height: 48,
    borderRadius: 12,
    backgroundColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  openLabBtnTxt: { color: C.onPrimary, fontSize: FontSize.base, fontWeight: FontWeight.bold },

  inputRow: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: 18,
    paddingVertical:   10,
    gap:               8,
    backgroundColor:   C.bg,
  },
  input: {
    flex:              1,
    backgroundColor:   C.card,
    borderRadius:      10,
    borderWidth:       1,
    borderColor:       C.border,
    paddingHorizontal: 12,
    paddingVertical:   10,
    color:             C.text,
    fontSize:          13,
    maxHeight:         120,
  },
  sendBtn: {
    width:           44,
    height:          44,
    borderRadius:    10,
    backgroundColor: C.primary,
    alignItems:      'center',
    justifyContent:  'center',
  },
  sendBtnDisabled: { opacity: 0.4 },
  sendTxt: { color: C.onPrimary, fontSize: 18, fontWeight: FontWeight.black, lineHeight: 22 },
  });
}

function makeBubbleStyles(C: Palette) {
  return StyleSheet.create({
  wrap:          { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.xs },
  userWrap:      { justifyContent: 'flex-end' },
  assistantWrap: { justifyContent: 'flex-start' },
  avatar:        { fontSize: 20, marginBottom: 2 },
  bubble: {
    maxWidth:          '80%',
    borderRadius:      18,
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.sm,
  },
  userBubble:      { backgroundColor: C.primary, borderBottomRightRadius: 4 },
  assistantBubble: { backgroundColor: C.card, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: C.border },
  txt:         { fontSize: FontSize.base, lineHeight: 22 },
  userTxt:     { color: C.onPrimary },
  assistantTxt:{ color: C.text },
  });
}
