// ─── AI Coach ─────────────────────────────────────────────────────────────────
//
// Chat interface powered by Claude. Builds a system prompt from the user's
// onboarding profile, movement risk flags, and training context so responses
// are personalised to that specific athlete.

import {
  Alert,
  ActivityIndicator,
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
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { VideoView, useVideoPlayer } from 'expo-video';
import * as ImagePicker from 'expo-image-picker';

import { useOnboardingStore } from '../../../src/store/onboardingStore';
import { useMovementStore }   from '../../../src/store/movementStore';
import { useAuthStore } from '../../../src/store/authStore';
import { useWorkoutStore } from '../../../src/store/workoutStore';
import { useStrengthStore } from '../../../src/store/strengthStore';
import { useReadinessStore } from '../../../src/store/readinessStore';
import { useAthleteStore } from '../../../src/store/athleteStore';
import { useCheckInStore } from '../../../src/store/checkInStore';
import { useTrainingPlanStore } from '../../../src/store/trainingPlanStore';
import { useWeekPlan } from '../../../src/hooks/useWeekPlan';
import { pickTargetRace } from '../../../src/utils/plan/macroPlanner';
import { toYMD } from '../../../src/utils/calendarEngine';
import type { RichWorkout } from '../../../src/types/workout';
import { buildCoachingInput } from '../../../src/utils/coachingInputBuilder';
import { buildCoachHandoff } from '../../../src/utils/movementEngine';
import type { MovementAnalysis } from '../../../src/types/movement';
import { generateCoachingOutput } from '../../../src/utils/coachEngine';
import WeeklyCoachCard from '../../../src/components/coaching/WeeklyCoachCard';
import CoachInsightsCard from '../../../src/components/coaching/CoachInsightsCard';
import RaceReadinessCard from '../../../src/components/coaching/RaceReadinessCard';
import { todayDateKey } from '../../../src/types/checkin';
import type { CompletedWorkoutRecord } from '../../../src/types/training';
import type { StrengthLogRecord } from '../../../src/types/strength';
import {
  checkAiCoachHealth,
  isAiCoachConfigured,
  sendCoachMessage,
  type AiCoachHealth,
  type CoachMessage,
} from '../../../src/lib/aiCoach';
import { copyVideoToMovementStorage, uploadMovementVideo } from '../../../src/lib/movementVideoStorage';
import { useColors } from '../../../src/theme/useColors';
import type { Palette } from '../../../src/theme/colors';
import { spacing }  from '../../../src/theme/spacing';
import { FontSize, FontWeight, Radius } from '../../../src/theme/tokens';

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
  todayWorkout:     { title: string; rationale: string } | null;
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
    return `  - ${shortDate(r.timestamp)}: ${r.type.replace(/_/g, ' ')}, ${miles ? `${miles.toFixed(1)} mi` : 'distance n/a'}, ${minutes} min${r.rpe ? `, RPE ${r.rpe}` : ''}`;
  });
  const strengthLines = strength.slice(0, 3).map(r =>
    `  - ${shortDate(r.timestamp)}: ${r.sessionType.replace(/_/g, ' ')}${r.actualDuration ? `, ${r.actualDuration} min` : ''}${r.overallRpe ? `, RPE ${r.overallRpe}` : ''}`,
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
    : `${ctx.race.name} (${ctx.race.distance}) on ${ctx.race.date} — priority ${ctx.race.priority === 'tune_up' ? 'Tune-Up' : ctx.race.priority}, ${ctx.race.weeksOut} week(s) out.`;

  const adaptLines = ctx.adaptations.length
    ? ctx.adaptations.map(a => `  - ${a}`).join('\n')
    : '  - None this week.';

  const todayLine = ctx.todayWorkout
    ? `Today's session and why: ${ctx.todayWorkout.title} — ${ctx.todayWorkout.rationale}`
    : "Today's session and why: Rest day — no structured session today.";

  return `TRAINING PLAN
- Goal type: ${ctx.goalType}
- Program start date: ${ctx.programStartDate ?? 'not set yet'}
- Current phase: ${ctx.trainingPhase}, week ${ctx.currentWeek}
- This week's focus: ${ctx.focus || 'n/a'}
- Race: ${raceLine}
- This week's adaptations:
${adaptLines}
- ${todayLine}`;
}

// Recent Movement Lab still-frame analyses, serialized via the coach handoff
// contract so the coach can discuss actual findings, not vague summaries.
function buildMovementLabBlock(analyses: MovementAnalysis[]): string {
  const recent = analyses.slice(-3).reverse();
  if (recent.length === 0) return 'MOVEMENT LAB ANALYSES\nNone recorded yet.';

  const lines = recent.map(a => {
    const h = buildCoachHandoff(a);
    const angles = h.detectedAngles.length
      ? h.detectedAngles.map(x => `${x.name} ${Math.round(x.degrees)}°`).join(', ')
      : 'none detected';
    const findings = h.checklistFindings.length
      ? h.checklistFindings.map(f => `${f.label}: ${f.value}${f.severity ? ` (${f.severity})` : ''}`).join('; ')
      : 'none recorded';
    const recs = h.recommendations.map(r => r.finding).join('; ') || 'none';
    return `- ${shortDate(a.createdAt)} · ${h.analysisType.replace(/_/g, ' ')} (${h.cameraView.replace(/_/g, ' ')} view, ${h.mediaType.replace(/_/g, ' ')})
  Detection quality: ${h.detectionQuality}. Overall confidence: ${h.confidence.replace(/_/g, ' ')}.
  Estimated angles (camera-view estimates, not clinical measurements): ${angles}
  Checklist findings: ${findings}
  Flagged: ${recs}${h.userNotes ? `\n  Athlete notes: ${h.userNotes}` : ''}`;
  });

  return `MOVEMENT LAB ANALYSES (most recent first — joint angles are estimates from photos/video frames, not clinical measurements)
${lines.join('\n')}`;
}

function buildSystemPrompt(
  data:        ReturnType<typeof useOnboardingStore.getState>['data'],
  riskFlags:   ReturnType<typeof useMovementStore.getState>['getActiveRiskFlags'],
  trainingCtx: CoachTrainingContext,
  analyses:    MovementAnalysis[],
): string {
  const flags   = riskFlags();
  const flagTxt = flags.length
    ? flags.map(f => `- ${f.sourceFinding} (${f.severity}): ${f.suggestion}`).join('\n')
    : 'None currently flagged.';

  const pr = data.hasPR && data.prTimeSeconds
    ? `${data.prDistance ?? ''} PR: ${Math.floor(data.prTimeSeconds / 60)}:${String(data.prTimeSeconds % 60).padStart(2, '0')}`
    : 'No PR on file';

  return `You are an expert running and movement coach. You are speaking directly with ${data.name || 'the athlete'}.

ATHLETE PROFILE
- Age: ${data.age}  Sex: ${data.sex}  Height: ${data.heightCm} cm  Weight: ${data.weightKg} kg
- Goal: ${data.primaryGoal}${data.goalRaceLabel ? ` — ${data.goalRaceLabel}` : ''}
- Running experience: ${data.yearsRunning} year(s), currently ~${data.weeklyMileage} miles/week
- Training style: ${data.trainingStyle}
- Training days: ${data.availableDays.join(', ')} (${data.targetSessions} sessions/week)
- Strength level: ${data.strengthLevel}
- ${pr}
${data.hrMax ? `- HR max: ${data.hrMax} bpm` : ''}${data.hrResting ? `  Resting HR: ${data.hrResting} bpm` : ''}
- Current injury: ${data.hasCurrentInjury ? data.injuryNotes || 'Yes (no details)' : 'None'}

MOVEMENT RISK FLAGS
${flagTxt}

${buildMovementLabBlock(analyses)}

${buildTrainingPlanBlock(trainingCtx)}

${buildTrainingContextBlock(trainingCtx)}

INSTRUCTIONS
- Give personalised, actionable advice grounded in this athlete's specific data.
- Structure meaningful answers as: what the data shows (observation), what it means (interpretation), what to do (recommendation).
- Reference the athlete's actual recent training, readiness, fatigue, and recovery numbers above whenever relevant. Never give generic advice when this data can ground the answer.
- When asked why a workout exists, answer from the TRAINING PLAN block (goal, phase, race timeline, recent readiness) — never invent a different plan.
- Be direct and concise. Use dashes for bullet points.
- When giving training, recovery, or injury-risk guidance, cite credible sports science sources such as PubMed-indexed research, ACSM, NSCA, or consensus guidelines in plain text.
- Do NOT use markdown: no # headers, no ## headers, no **bold**, no *italics*. Plain text only.
- Never give medical diagnoses. Recommend professional care for pain or injury concerns.
- If asked about paces or zones, calculate from their profile data.`;
}

// ─── Message bubble ───────────────────────────────────────────────────────────

function Bubble({ msg }: { msg: Message }) {
  const C = useColors();
  const b = useMemo(() => makeBubbleStyles(C), [C]);
  const isUser = msg.role === 'user';
  return (
    <View style={[b.wrap, isUser ? b.userWrap : b.assistantWrap]}>
      {!isUser && <Text style={b.avatar}>🏃</Text>}
      <View style={[b.bubble, isUser ? b.userBubble : b.assistantBubble]}>
        <Text style={[b.txt, isUser ? b.userTxt : b.assistantTxt]}>{msg.content}</Text>
      </View>
    </View>
  );
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
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
  const data      = useOnboardingStore(s => s.data);
  const riskFlags = useMovementStore(s => s.getActiveRiskFlags);
  const addVideo = useMovementStore(s => s.addVideo);
  const updateVideo = useMovementStore(s => s.updateVideo);
  const videos = useMovementStore(s => s.videos);
  const movementAnalyses = useMovementStore(s => s.analyses);
  const user = useAuthStore(s => s.user);
  const runHistory = useWorkoutStore(s => s.history);
  const strengthHistory = useStrengthStore(s => s.history);
  const todayReadiness = useReadinessStore(s => s.todayReadiness);
  const fatigueScore = useAthleteStore(s => s.fatigueScore);
  const recoveryScore = useAthleteStore(s => s.recoveryScore);
  const currentWeek = useAthleteStore(s => s.currentWeek);
  const trainingPhase = useAthleteStore(s => s.trainingPhase);

  // ── Plan spine — grounds the coach in the real macro plan ──────────────────
  const weekPlan          = useWeekPlan();
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
    const todayYMD = toYMD(new Date());
    const todayEntries = weekPlan.calendarMap.get(todayYMD) ?? [];
    const todayRunEntry = todayEntries.find(e => e.type === 'run');
    const workout = (todayRunEntry?.workout as RichWorkout | undefined)
      ?? weekPlan.richWeek.workouts[(new Date().getDay() + 6) % 7]
      ?? null;
    if (!workout || workout.type === 'rest') return null;
    return { title: workout.title, rationale: workout.purpose };
  }, [weekPlan.calendarMap, weekPlan.richWeek]);

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
  const [videoBusy, setVideoBusy] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [selectedVideoUri, setSelectedVideoUri] = useState<string | null>(null);
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
  const [coachHealth, setCoachHealth] = useState<AiCoachHealth | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const selectedVideoPlayer = useVideoPlayer(selectedVideoUri);
  const recentVideos = useMemo(() => videos.slice(-3).reverse(), [videos]);

  const isConfigured = isAiCoachConfigured();
  const coachReady = isConfigured && coachHealth?.ok;
  const contextSummary = buildContextSummary(data);
  const s = useMemo(() => makeStyles(C), [C]);
  const b = useMemo(() => makeBubbleStyles(C), [C]);

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
      const system  = buildSystemPrompt(data, riskFlags, trainingCtx, movementAnalyses);
      const reply = await sendCoachMessage(updated, system);
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to reach AI coach.');
    } finally {
      setLoading(false);
    }
  }

  async function pickCoachVideo() {
    setVideoError(null);

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'StrideOS needs access to your photo library to select a coach review video.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      allowsEditing: false,
      quality: 1,
    });

    if (result.canceled || result.assets.length === 0) return;

    setVideoBusy(true);

    const asset = result.assets[0];
    const videoId = addVideo({
      uri: asset.uri,
      title: `Coach review ${todayISO()}`,
      date: todayISO(),
      analysisType: 'running_gait',
      activity: 'running',
      view: 'side',
      notes: 'Uploaded from AI Coach video analysis.',
      submittedForAnalysis: true,
      analysisStatus: 'pending',
    });
    setSelectedVideoId(videoId);
    setSelectedVideoUri(asset.uri);

    try {
      const { localUri, ext, contentType } = await copyVideoToMovementStorage(asset.uri, videoId, asset.fileName ?? asset.uri);
      setSelectedVideoUri(localUri);
      updateVideo(videoId, {
        uri: localUri,
        submittedForAnalysis: true,
        analysisStatus: 'pending',
      });

      let storagePath: string | undefined;
      if (user) {
        storagePath = `${user.id}/${videoId}.${ext}`;
        try {
          await uploadMovementVideo(localUri, storagePath, contentType);
        } catch (uploadError) {
          console.warn('Coach video upload error:', uploadError);
          storagePath = undefined;
        }
      }

      updateVideo(videoId, {
        uri: localUri,
        storagePath,
        submittedForAnalysis: true,
        analysisStatus: 'pending',
      });
    } catch (e) {
      setVideoError(e instanceof Error ? e.message : 'Video upload failed.');
      updateVideo(videoId, {
        submittedForAnalysis: true,
        analysisStatus: 'pending',
      });
    } finally {
      setVideoBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={90}
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
          <Text style={s.noKeyIcon}>🔑</Text>
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
            contentContainerStyle={s.messagesContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={s.contextCard}>
              <Text style={s.contextEyebrow}>Your Training Context</Text>
              <Text style={s.contextTxt}>{contextSummary}</Text>
            </View>

            {messages.length === 0 && (
              <View style={s.empty}>
                <Text style={s.emptyTitle}>Ask your AI Coach</Text>
                <Text style={s.emptyDesc}>
                  Questions about training, recovery, nutrition, pacing, or injury prevention -
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
                <Text style={b.avatar}>🏃</Text>
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

          <View style={s.inputRow}>
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
            <Text style={s.contextEyebrow}>Video Upload</Text>
            <Text style={s.contextTxt}>
              Upload a running or strength video for coach review. It is stored in Movement Lab so your
              findings, risk flags, and training context stay in one place.
            </Text>
          </View>

          {selectedVideoUri ? (
            <View style={s.videoPreviewCard}>
              <VideoView
                player={selectedVideoPlayer}
                style={s.videoPreview}
                contentFit="contain"
                nativeControls
              />
              <Pressable style={s.replaceVideoBtn} onPress={pickCoachVideo} disabled={videoBusy}>
                <Text style={s.replaceVideoTxt}>{videoBusy ? 'Uploading...' : 'Replace video'}</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable style={s.videoDrop} onPress={pickCoachVideo} disabled={videoBusy}>
              <Text style={s.videoIcon}>🎥</Text>
              <Text style={s.videoTitle}>Upload a running or strength video</Text>
              <Text style={s.videoDesc}>For form analysis and feedback</Text>
              <View style={[s.videoBtn, videoBusy && { opacity: 0.6 }]}>
                <Text style={s.videoBtnTxt}>{videoBusy ? 'Uploading...' : 'Choose Video'}</Text>
              </View>
            </Pressable>
          )}

          {videoError ? (
            <View style={s.errorBox}>
              <Text style={s.errorTxt}>{videoError}</Text>
            </View>
          ) : null}

          <View style={s.reviewCard}>
            <View style={s.reviewHead}>
              <Text style={s.reviewTitle}>Coach Video Review</Text>
              <Text style={s.reviewPill}>COMING SOON</Text>
            </View>
            <Text style={s.reviewTxt}>
              Get personalized video feedback from certified running coaches. Upload a clip and receive
              detailed analysis of your form, pacing, and technique within the app.
            </Text>
          </View>

          {selectedVideoId ? (
            <Pressable
              style={s.secondaryBtn}
              onPress={() => router.push({ pathname: '/(tabs)/movement/[videoId]', params: { videoId: selectedVideoId } })}
            >
              <Text style={s.secondaryBtnTxt}>Open Full Analysis</Text>
            </Pressable>
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
                    <Text style={s.videoRowMeta}>{video.date} · {video.activity.replace(/_/g, ' ')}</Text>
                  </View>
                  <Text style={s.videoRowChevron}>›</Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          <Pressable style={s.secondaryBtn} onPress={() => router.push('/(tabs)/movement')}>
            <Text style={s.secondaryBtnTxt}>Open Movement Lab</Text>
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

  videoDrop: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: C.border,
    borderRadius: 14,
    backgroundColor: C.card,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    alignItems: 'center',
    gap: spacing.xs,
  },
  videoIcon: { fontSize: 30 },
  videoTitle: { color: C.textMuted, fontSize: FontSize.base, fontWeight: FontWeight.bold, textAlign: 'center' },
  videoDesc: { color: C.textDim, fontSize: FontSize.xs, textAlign: 'center', marginBottom: spacing.sm },
  videoBtn: {
    backgroundColor: C.primary,
    borderRadius: 10,
    paddingHorizontal: 22,
    paddingVertical: 10,
  },
  videoBtnTxt: { color: C.onPrimary, fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  videoPreviewCard: {
    overflow: 'hidden',
    borderRadius: 16,
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.border,
  },
  videoPreview: {
    width: '100%',
    height: 220,
    backgroundColor: C.bg,
  },
  replaceVideoBtn: {
    backgroundColor: C.card,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  replaceVideoTxt: {
    color: C.primary,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },
  reviewCard: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 16,
    padding: spacing.md,
    gap: spacing.sm,
  },
  reviewHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  reviewTitle: { color: C.text, fontSize: FontSize.base, fontWeight: FontWeight.bold },
  reviewPill: {
    color: C.accent,
    backgroundColor: C.accentDim,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    fontSize: 10,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.5,
  },
  reviewTxt: { color: C.textMuted, fontSize: FontSize.sm, lineHeight: 22 },
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
  secondaryBtn: {
    height: 44,
    borderRadius: 12,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnTxt: { color: C.primary, fontSize: FontSize.sm, fontWeight: FontWeight.bold },

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
