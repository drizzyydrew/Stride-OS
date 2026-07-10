// ─── Running/Walking Readiness — Test Flow ────────────────────────────────────
//
// One screen per step: capture guidance BEFORE recording, then record/import
// video (or enter manually / skip). Video steps run the same on-device pose
// pipeline as Movement Lab video analysis (stride-pose → poseSequence →
// MovementAnalysis), linked by id. On the final step, scores every domain via
// src/utils/readinessEngine.ts and saves a ReadinessAssessment.

import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useMemo, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { detectPoseSequence } from 'stride-pose';

import { useColors } from '../../../src/theme/useColors';
import type { Palette } from '../../../src/theme/colors';
import { spacing } from '../../../src/theme/spacing';
import { FontSize, FontWeight, Radius } from '../../../src/theme/tokens';
import { LAYOUT } from '../../../src/constants/layout';
import { useMovementStore } from '../../../src/store/movementStore';
import { useMobilityStore } from '../../../src/store/mobilityStore';
import { resolveDocumentUri } from '../../../src/lib/mediaPaths';
import { copyAnalysisMediaToStorage } from '../../../src/lib/movementVideoStorage';
import { savePoseSequence } from '../../../src/lib/poseSequenceStorage';
import { analyzeSequence } from '../../../src/utils/poseSequence';
import { buildSequenceFindings } from '../../../src/utils/movementEngine';
import { assessSequenceCaptureQuality, type CaptureIssue, type CaptureQualityRating } from '../../../src/utils/captureQuality';
import { assessReadiness } from '../../../src/utils/readinessEngine';
import CaptureGuidanceCard from '../../../src/components/movement/CaptureGuidanceCard';
import type { MovementAnalysisKind, MovementViewAngle } from '../../../src/types/movement';
import type { ReadinessTestId, ReadinessTestMethod, ReadinessTestResult } from '../../../src/types/movementReadiness';

// ─── Step definitions ─────────────────────────────────────────────────────────

type StepKind = 'video' | 'video_checklist' | 'manual_pair_cm' | 'manual_pair_reps';

type StepDef = {
  key:           string;
  title:         string;
  kind:          StepKind;
  view:          'side' | 'front';
  analysisKind?: MovementAnalysisKind;
  testIds:       ReadinessTestId[];
  optional?:     boolean;
  instructions:  string[];
  mustBeVisible: string[];
};

type SingleLegChecklist = {
  pelvisLevel?: boolean;
  kneeTracksOverFoot?: boolean;
  trunkSteady?: boolean;
};

const STEPS: StepDef[] = [
  {
    key: 'squat_side', title: 'Bodyweight Squat', kind: 'video', view: 'side', analysisKind: 'squat',
    testIds: ['squat_side'],
    instructions: [
      'Film from directly the side, camera at hip height, 3–5 m away.',
      'Perform 3–5 slow, controlled bodyweight squats.',
      'Wear fitted clothing so your hips, knees, and ankles are visible.',
    ],
    mustBeVisible: ['Whole body', 'Hips', 'Knees', 'Ankles'],
  },
  {
    key: 'single_leg_squat', title: 'Single-Leg Squat', kind: 'video_checklist', view: 'front', analysisKind: 'lunge_single_leg',
    testIds: ['single_leg_squat'],
    instructions: [
      'Optional: film from directly in front for your own reference.',
      'Perform 3–5 slow single-leg squats per side, then answer the checklist below.',
    ],
    mustBeVisible: ['Whole body', 'Both knees', 'Pelvis'],
  },
  {
    key: 'split_stance_lunge', title: 'Split-Stance Lunge', kind: 'video', view: 'side', analysisKind: 'lunge_single_leg',
    testIds: ['split_stance_lunge'],
    instructions: [
      'Film from the side, camera at hip height.',
      'Step into a long split stance and lower gently 3–5 times per side.',
      'Keep your torso upright throughout.',
    ],
    mustBeVisible: ['Whole body', 'Hips', 'Knees'],
  },
  {
    key: 'knee_to_wall', title: 'Knee-to-Wall Ankle Check', kind: 'manual_pair_cm', view: 'side',
    testIds: ['knee_to_wall_left', 'knee_to_wall_right'],
    instructions: [
      'Kneel facing a wall, front foot a few inches back.',
      'Keeping your heel flat, drive your knee toward the wall.',
      'Measure the farthest your toes can be from the wall (cm) while your knee still touches it and your heel stays down.',
    ],
    mustBeVisible: [],
  },
  {
    key: 'heel_raise', title: 'Single-Leg Heel Raises', kind: 'manual_pair_reps', view: 'side',
    testIds: ['heel_raise_left', 'heel_raise_right'],
    instructions: [
      'Stand on one leg, holding a wall for light balance support.',
      'Rise onto the ball of your foot, then lower with control — repeat to fatigue.',
      'Count how many full-range reps you complete on each side.',
    ],
    mustBeVisible: [],
  },
  {
    key: 'gait_side_view', title: 'Easy Running/Walking Gait', kind: 'video', view: 'side', analysisKind: 'running_gait', optional: true,
    testIds: ['gait_side_view'],
    instructions: [
      'Film from the side on a treadmill, or with repeated passes at an easy pace.',
      'Capture at least 10–15 seconds of continuous movement.',
    ],
    mustBeVisible: ['Whole body', 'Both legs through a full stride'],
  },
];

const TOTAL_SCREENS = STEPS.length + 1; // + pain/review screen

// ─── Video capture block (shared by 'video' and 'video_checklist' steps) ────

type VideoResult = { analysisId: string; captureRating: CaptureQualityRating; issues: CaptureIssue[] };

function VideoCaptureBlock({
  analysisKind, view, result, onResult,
}: {
  analysisKind: MovementAnalysisKind;
  view:         MovementViewAngle;
  result:       VideoResult | null;
  onResult:     (r: VideoResult | null) => void;
}) {
  const C = useColors();
  const s = useMemo(() => makeStyles(C), [C]);
  const addAnalysis    = useMovementStore(st => st.addAnalysis);
  const updateAnalysis = useMovementStore(st => st.updateAnalysis);

  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ processed: number; total: number } | null>(null);

  async function pickAndAnalyze(source: 'camera' | 'library') {
    const perm = source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') {
      Alert.alert('Permission needed', 'StrideOS needs access to record or choose a video for this test.');
      return;
    }

    const picked = source === 'camera'
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['videos'], allowsEditing: false, quality: 0.9 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], allowsEditing: false, quality: 0.9 });
    if (picked.canceled || picked.assets.length === 0) return;

    setBusy(true);
    setProgress({ processed: 0, total: 1 });
    try {
      let storedUri = picked.assets[0].uri;
      try {
        storedUri = await copyAnalysisMediaToStorage(storedUri, `readiness_${Date.now()}`);
      } catch {
        // keep original URI
      }

      const seqResult = await detectPoseSequence(resolveDocumentUri(storedUri) ?? storedUri, {
        fps: 12, maxDurationMs: 30_000,
        onProgress: (processed, total) => setProgress({ processed, total }),
      });

      if (!seqResult || seqResult.frames.length === 0) {
        Alert.alert('Analysis failed', 'Could not analyze this video on-device. Try a shorter or steadier clip, or continue and enter this test manually.');
        return;
      }

      const quality = assessSequenceCaptureQuality(seqResult, view === 'front' ? 'front' : 'side');
      const seq = analyzeSequence(seqResult, analysisKind, view);
      const recommendations = buildSequenceFindings(
        {
          estimatedAngles: seq.keyFrames[0]?.angles,
          angleSeries: seq.angleSeries,
          keyFrames: seq.keyFrames,
          repSummaries: seq.repSummaries,
          symmetryEstimates: seq.symmetryEstimates,
          sequenceConfidence: seq.confidence,
        },
        analysisKind,
      );

      const id = addAnalysis({
        type: analysisKind, mediaUri: storedUri, mediaType: 'video', cameraView: view,
        checklistFindings: [], confidence: seq.confidence, recommendations,
        limitations: seq.limitations, status: seq.confidence === 'manual_review' ? 'needs_review' : 'complete',
        angleSeries: seq.angleSeries, keyFrames: seq.keyFrames, repSummaries: seq.repSummaries,
        symmetryEstimates: seq.symmetryEstimates, sequenceConfidence: seq.confidence,
        sequenceLimitations: seq.limitations, analyzedDurationMs: seqResult.analyzedMs, videoDurationMs: seqResult.durationMs,
      });

      try {
        const poseUri = await savePoseSequence(id, seqResult);
        updateAnalysis(id, { poseSequenceUri: poseUri });
      } catch {
        // angle series / key frames are already saved inline
      }

      onResult({ analysisId: id, captureRating: quality.rating, issues: quality.issues });
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  if (busy) {
    return (
      <View style={s.progressRow}>
        <ActivityIndicator size="small" color={C.primary} />
        <Text style={s.progressTxt}>
          Analyzing{progress?.total ? ` frame ${progress.processed} of ~${progress.total}` : '…'}
        </Text>
      </View>
    );
  }

  if (result) {
    return (
      <View style={s.resultBox}>
        <View style={s.resultTitleRow}>
          <Ionicons
            name={result.captureRating === 'good' ? 'checkmark-circle' : 'alert-circle'}
            size={16}
            color={result.captureRating === 'good' ? C.positive : result.captureRating === 'fair' ? C.warning : C.critical}
          />
          <Text style={s.resultTitle}>
            {result.captureRating === 'good' ? 'Good capture' : result.captureRating === 'fair' ? 'Fair capture' : 'Capture issues found'}
          </Text>
        </View>
        {result.issues.map((issue, i) => (
          <Text key={i} style={s.resultIssue}>•  {issue.message}</Text>
        ))}
        <Pressable style={s.retakeBtn} onPress={() => onResult(null)}>
          <Text style={s.retakeTxt}>Retake</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={s.mediaRow}>
      <Pressable style={s.mediaBtn} onPress={() => pickAndAnalyze('camera')}>
        <Text style={s.mediaBtnTxt}>Record Video</Text>
      </Pressable>
      <Pressable style={s.mediaBtn} onPress={() => pickAndAnalyze('library')}>
        <Text style={s.mediaBtnTxt}>Choose Video</Text>
      </Pressable>
    </View>
  );
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function ReadinessTestScreen() {
  const C = useColors();
  const insets = useSafeAreaInsets();
  const s = useMemo(() => makeStyles(C), [C]);
  const params = useLocalSearchParams<{ focus?: string }>();
  const focus: 'running' | 'walking' = params.focus === 'walking' ? 'walking' : 'running';

  const analyses = useMovementStore(st => st.analyses);
  const addReadinessAssessment = useMovementStore(st => st.addReadinessAssessment);
  const setRecommendedWorkouts = useMobilityStore(st => st.setRecommendedWorkouts);

  const [screenIndex, setScreenIndex] = useState(0); // 0..STEPS.length-1 = steps, STEPS.length = pain/review
  const [results, setResults] = useState<Record<string, ReadinessTestResult[]>>({});
  const [videoResults, setVideoResults] = useState<Record<string, VideoResult | null>>({});
  const [cmLeft, setCmLeft] = useState<Record<string, string>>({});
  const [cmRight, setCmRight] = useState<Record<string, string>>({});
  const [checklist, setChecklist] = useState<Record<string, SingleLegChecklist>>({});
  const [painReported, setPainReported] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

  const onFinalScreen = screenIndex >= STEPS.length;
  const step = onFinalScreen ? null : STEPS[screenIndex];

  function commitStepResults(key: string, stepResults: ReadinessTestResult[]) {
    setResults(prev => ({ ...prev, [key]: stepResults }));
  }

  function goNext() {
    setScreenIndex(i => Math.min(TOTAL_SCREENS - 1, i + 1));
  }
  function goBack() {
    if (screenIndex === 0) {
      router.back();
      return;
    }
    setScreenIndex(i => i - 1);
  }

  function handleSkipStep(current: StepDef) {
    commitStepResults(current.key, current.testIds.map(testId => ({ testId, method: 'manual' as ReadinessTestMethod, skipped: true })));
    goNext();
  }

  function handleContinueVideo(current: StepDef) {
    const vr = videoResults[current.key] ?? null;
    const method: ReadinessTestMethod = vr ? 'video' : 'manual';
    commitStepResults(current.key, current.testIds.map(testId => ({
      testId, method,
      analysisId: vr?.analysisId,
      captureRating: vr?.captureRating,
      skipped: !vr,
    })));
    goNext();
  }

  function handleContinueVideoChecklist(current: StepDef) {
    const vr = videoResults[current.key] ?? null;
    const list = checklist[current.key];
    const hasChecklist = Boolean(list && Object.values(list).some(value => value !== undefined));
    commitStepResults(current.key, current.testIds.map(testId => ({
      testId, method: 'manual',
      analysisId: vr?.analysisId,
      captureRating: vr?.captureRating,
      manualValues: hasChecklist ? { ...list } : undefined,
      skipped: !vr && !hasChecklist,
    })));
    goNext();
  }

  function handleContinueCm(current: StepDef) {
    const l = parseFloat(cmLeft[current.key] ?? '');
    const r = parseFloat(cmRight[current.key] ?? '');
    commitStepResults(current.key, [
      { testId: current.testIds[0], method: 'manual', manualValues: Number.isFinite(l) ? { cm: l } : undefined, skipped: !Number.isFinite(l) },
      { testId: current.testIds[1], method: 'manual', manualValues: Number.isFinite(r) ? { cm: r } : undefined, skipped: !Number.isFinite(r) },
    ]);
    goNext();
  }

  function handleContinueReps(current: StepDef) {
    const l = parseInt(cmLeft[current.key] ?? '', 10);
    const r = parseInt(cmRight[current.key] ?? '', 10);
    commitStepResults(current.key, [
      { testId: current.testIds[0], method: 'manual', manualValues: Number.isFinite(l) ? { reps: l } : undefined, skipped: !Number.isFinite(l) },
      { testId: current.testIds[1], method: 'manual', manualValues: Number.isFinite(r) ? { reps: r } : undefined, skipped: !Number.isFinite(r) },
    ]);
    goNext();
  }

  async function handleFinish() {
    if (saving) return;
    setSaving(true);
    try {
      const flatResults = Object.values(results).flat();
      const built = assessReadiness(focus, flatResults, analyses, painReported ?? false);
      const id = addReadinessAssessment(built);
      if (built.recommendedMobilityWorkoutIds.length > 0) {
        setRecommendedWorkouts(built.recommendedMobilityWorkoutIds, id);
      }
      router.replace({ pathname: '/(tabs)/movement/readiness-report', params: { id } } as never);
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={s.root}>
      <View style={[s.header, { paddingTop: insets.top + 6 }]}>
        <Pressable onPress={goBack} hitSlop={12}>
          <Ionicons name="arrow-back" size={20} color={C.primary} />
        </Pressable>
        <View style={{ marginLeft: 10, flex: 1 }}>
          <Text style={s.eyebrow}>STEP {screenIndex + 1} OF {TOTAL_SCREENS}</Text>
          <Text style={s.title}>{onFinalScreen ? 'Review' : step!.title}</Text>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: LAYOUT.screenPadBottom, gap: spacing.md }}
        showsVerticalScrollIndicator={false}
      >
        {!onFinalScreen && step && (
          <>
            {step.optional && (
              <View style={s.optionalPill}>
                <Text style={s.optionalPillTxt}>OPTIONAL</Text>
              </View>
            )}

            <CaptureGuidanceCard view={step.view} instructions={step.instructions} mustBeVisible={step.mustBeVisible} />

            {(step.kind === 'video' || step.kind === 'video_checklist') && step.analysisKind && (
              <View style={s.card}>
                <Text style={s.label}>RECORD OR IMPORT</Text>
                <VideoCaptureBlock
                  analysisKind={step.analysisKind}
                  view={step.view}
                  result={videoResults[step.key] ?? null}
                  onResult={r => setVideoResults(prev => ({ ...prev, [step.key]: r }))}
                />
              </View>
            )}

            {step.kind === 'video_checklist' && (
              <View style={s.card}>
                <Text style={s.label}>SINGLE-LEG SQUAT CHECKLIST</Text>
                {([
                  { key: 'pelvisLevel', label: 'Pelvis stayed level' },
                  { key: 'kneeTracksOverFoot', label: 'Knee tracked over the foot' },
                  { key: 'trunkSteady', label: 'Trunk stayed steady' },
                ] as const).map(item => {
                  const current = checklist[step.key]?.[item.key];
                  return (
                    <View key={item.key} style={s.checklistRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.checklistLabel}>{item.label}</Text>
                        {current === undefined ? <Text style={s.unansweredTxt}>Unanswered</Text> : null}
                      </View>
                      <View style={s.choiceRow}>
                        {[
                          { label: 'Yes', value: true },
                          { label: 'No', value: false },
                        ].map(choice => {
                          const active = current === choice.value;
                          return (
                            <Pressable
                              key={choice.label}
                              style={[s.choiceBtn, active && s.choiceBtnActive]}
                              onPress={() => setChecklist(prev => ({
                                ...prev,
                                [step.key]: {
                                  ...(prev[step.key] ?? {}),
                                  [item.key]: choice.value,
                                },
                              }))}
                            >
                              <Text style={[s.choiceTxt, active && s.choiceTxtActive]}>{choice.label}</Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            {step.kind === 'manual_pair_cm' && (
              <View style={s.card}>
                <Text style={s.label}>ENTER MANUALLY (CM)</Text>
                <View style={s.pairRow}>
                  <View style={s.pairCol}>
                    <Text style={s.pairLabel}>Left</Text>
                    <TextInput
                      style={s.numInput}
                      value={cmLeft[step.key] ?? ''}
                      onChangeText={v => setCmLeft(prev => ({ ...prev, [step.key]: v }))}
                      keyboardType="decimal-pad"
                      placeholder="cm"
                      placeholderTextColor={C.textSubtle}
                    />
                  </View>
                  <View style={s.pairCol}>
                    <Text style={s.pairLabel}>Right</Text>
                    <TextInput
                      style={s.numInput}
                      value={cmRight[step.key] ?? ''}
                      onChangeText={v => setCmRight(prev => ({ ...prev, [step.key]: v }))}
                      keyboardType="decimal-pad"
                      placeholder="cm"
                      placeholderTextColor={C.textSubtle}
                    />
                  </View>
                </View>
              </View>
            )}

            {step.kind === 'manual_pair_reps' && (
              <View style={s.card}>
                <Text style={s.label}>ENTER MANUALLY (REPS)</Text>
                <View style={s.pairRow}>
                  <View style={s.pairCol}>
                    <Text style={s.pairLabel}>Left</Text>
                    <TextInput
                      style={s.numInput}
                      value={cmLeft[step.key] ?? ''}
                      onChangeText={v => setCmLeft(prev => ({ ...prev, [step.key]: v }))}
                      keyboardType="number-pad"
                      placeholder="reps"
                      placeholderTextColor={C.textSubtle}
                    />
                  </View>
                  <View style={s.pairCol}>
                    <Text style={s.pairLabel}>Right</Text>
                    <TextInput
                      style={s.numInput}
                      value={cmRight[step.key] ?? ''}
                      onChangeText={v => setCmRight(prev => ({ ...prev, [step.key]: v }))}
                      keyboardType="number-pad"
                      placeholder="reps"
                      placeholderTextColor={C.textSubtle}
                    />
                  </View>
                </View>
              </View>
            )}

            <View style={s.actionRow}>
              <Pressable style={s.skipBtn} onPress={() => handleSkipStep(step)}>
                <Text style={s.skipTxt}>Skip</Text>
              </Pressable>
              <Pressable
                style={s.continueBtn}
                onPress={() => {
                  if (step.kind === 'video') handleContinueVideo(step);
                  else if (step.kind === 'video_checklist') handleContinueVideoChecklist(step);
                  else if (step.kind === 'manual_pair_cm') handleContinueCm(step);
                  else handleContinueReps(step);
                }}
              >
                <Text style={s.continueTxt}>Continue</Text>
              </Pressable>
            </View>
          </>
        )}

        {onFinalScreen && (
          <>
            <View style={s.card}>
              <Text style={s.label}>ONE LAST THING</Text>
              <Text style={s.explain}>Did anything hurt during these tests?</Text>
              <View style={s.toggleRow}>
                <Pressable
                  style={[s.toggleBtn, painReported === false && s.toggleBtnActive]}
                  onPress={() => setPainReported(false)}
                >
                  <Text style={[s.toggleTxt, painReported === false && s.toggleTxtActive]}>No</Text>
                </Pressable>
                <Pressable
                  style={[s.toggleBtn, painReported === true && s.toggleBtnActive]}
                  onPress={() => setPainReported(true)}
                >
                  <Text style={[s.toggleTxt, painReported === true && s.toggleTxtActive]}>Yes</Text>
                </Pressable>
              </View>
              {painReported && (
                <Text style={s.painNote}>
                  Your report will include a note to consult a clinician for pain or injury concerns.
                  StrideOS doesn't interpret pain.
                </Text>
              )}
            </View>

            <Pressable style={[s.continueBtnFull, saving && { opacity: 0.6 }]} onPress={handleFinish} disabled={saving}>
              {saving ? <ActivityIndicator size="small" color={C.onPrimary} /> : <Text style={s.continueTxt}>Finish & See Report</Text>}
            </Pressable>
          </>
        )}
      </ScrollView>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

function makeStyles(C: Palette) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: C.bg },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
    eyebrow: { color: C.textDim, fontSize: 10, fontWeight: FontWeight.black, letterSpacing: 0.6 },
    title: { color: C.text, fontSize: 20, fontWeight: FontWeight.black },
    card: {
      backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.border,
      padding: spacing.md, gap: spacing.sm,
    },
    label: { color: C.textDim, fontSize: 10, fontWeight: FontWeight.black, letterSpacing: 0.6 },
    explain: { color: C.textMuted, fontSize: FontSize.sm, lineHeight: 20 },
    optionalPill: { alignSelf: 'flex-start', backgroundColor: C.accentDim, borderRadius: Radius.sm, paddingHorizontal: 8, paddingVertical: 3 },
    optionalPillTxt: { color: C.accent, fontSize: 10, fontWeight: FontWeight.black, letterSpacing: 0.5 },

    mediaRow: { flexDirection: 'row', gap: spacing.sm },
    mediaBtn: { flex: 1, backgroundColor: C.border, borderRadius: Radius.sm, paddingVertical: spacing.md, alignItems: 'center' },
    mediaBtnTxt: { color: C.text, fontSize: FontSize.sm, fontWeight: FontWeight.bold },
    progressRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    progressTxt: { color: C.textMuted, fontSize: FontSize.xs },
    resultBox: { gap: spacing.xs },
    resultTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    resultTitle: { color: C.text, fontSize: FontSize.sm, fontWeight: FontWeight.bold },
    resultIssue: { color: C.textMuted, fontSize: FontSize.xs, lineHeight: 17 },
    retakeBtn: { alignSelf: 'flex-start', marginTop: 2 },
    retakeTxt: { color: C.primary, fontSize: FontSize.xs, fontWeight: FontWeight.bold },

    checklistRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
    checklistLabel: { color: C.text, fontSize: FontSize.sm, flex: 1 },
    unansweredTxt: { color: C.textSubtle, fontSize: FontSize.xs, marginTop: 2 },
    choiceRow: { flexDirection: 'row', gap: spacing.xs },
    choiceBtn: { backgroundColor: C.border, borderRadius: Radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 6 },
    choiceBtnActive: { backgroundColor: C.primaryDim, borderWidth: 1, borderColor: C.primary },
    choiceTxt: { color: C.textDim, fontSize: FontSize.xs, fontWeight: FontWeight.bold },
    choiceTxtActive: { color: C.primary },

    pairRow: { flexDirection: 'row', gap: spacing.md },
    pairCol: { flex: 1, gap: 4 },
    pairLabel: { color: C.textMuted, fontSize: FontSize.xs },
    numInput: {
      backgroundColor: C.bg, borderRadius: Radius.sm, borderWidth: 1, borderColor: C.border,
      color: C.text, fontSize: FontSize.base, padding: spacing.sm,
    },

    actionRow: { flexDirection: 'row', gap: spacing.sm },
    skipBtn: { paddingVertical: spacing.md, paddingHorizontal: spacing.lg },
    skipTxt: { color: C.textMuted, fontSize: FontSize.sm, fontWeight: FontWeight.bold },
    continueBtn: { flex: 1, backgroundColor: C.primary, borderRadius: Radius.sm, paddingVertical: spacing.md, alignItems: 'center' },
    continueBtnFull: { backgroundColor: C.primary, borderRadius: Radius.sm, paddingVertical: spacing.md, alignItems: 'center' },
    continueTxt: { color: C.onPrimary, fontSize: FontSize.base, fontWeight: FontWeight.bold },

    toggleRow: { flexDirection: 'row', gap: spacing.sm },
    toggleBtn: { flex: 1, paddingVertical: spacing.sm, borderRadius: Radius.sm, alignItems: 'center', backgroundColor: C.border },
    toggleBtnActive: { backgroundColor: C.primaryDim, borderWidth: 1, borderColor: C.primary },
    toggleTxt: { color: C.textDim, fontSize: FontSize.sm, fontWeight: FontWeight.bold },
    toggleTxtActive: { color: C.primary },
    painNote: { color: C.textSubtle, fontSize: FontSize.xs, lineHeight: 16 },
  });
}
