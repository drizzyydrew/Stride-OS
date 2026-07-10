// ─── Movement Lab — Analyze ───────────────────────────────────────────────────
//
// V1.5 markerless analysis flow: pick/capture media → (video) extract a frame →
// on-device pose detection (Apple Vision via stride-pose) → estimated angles +
// manual checklist → saved MovementAnalysis. Pose is best-effort: when it is
// unavailable or finds no person, the manual path stays fully usable and the
// record says so honestly.

import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect, useRef, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { VideoView, useVideoPlayer } from 'expo-video';
import { detectPose, detectPoseSequence, isPoseEstimationAvailable } from 'stride-pose';

import { useMovementStore } from '../../../src/store/movementStore';
import { copyAnalysisMediaToStorage } from '../../../src/lib/movementVideoStorage';
import { savePoseSequence } from '../../../src/lib/poseSequenceStorage';
import {
  ANALYSIS_CHECKLISTS,
  ANALYSIS_KIND_INFO,
  ANGLE_ESTIMATE_DISCLAIMER,
  DETECTION_LIMITATIONS_NOTE,
  MOVEMENT_SAFETY_DISCLAIMER,
  NORMAL_CHECKLIST_VALUES,
  assessJointAngle,
  buildAnalysisRecommendations,
  buildSequenceFindings,
} from '../../../src/utils/movementEngine';
import { classifyPoseConfidence, computeEstimatedAngles } from '../../../src/utils/poseAngles';
import { analyzeSequence } from '../../../src/utils/poseSequence';
import PoseOverlay from '../../../src/components/assessment/PoseOverlay';
import LandmarkEditor from '../../../src/components/movement/LandmarkEditor';
import { colors }  from '../../../src/theme/colors';
import { spacing } from '../../../src/theme/spacing';
import { FontSize, FontWeight, Radius } from '../../../src/theme/tokens';
import type {
  AnalysisConfidence,
  ChecklistFinding,
  EstimatedAngle,
  FindingSeverity,
  MovementAnalysisKind,
  MovementViewAngle,
  PoseLandmarkRecord,
} from '../../../src/types/movement';
import type { PoseSequenceResult } from 'stride-pose';

// ─── Constants ────────────────────────────────────────────────────────────────

const VALID_KINDS: MovementAnalysisKind[] = ['running_gait', 'squat', 'deadlift', 'lunge_single_leg', 'general'];

const KIND_CAMERA_VIEW: Record<MovementAnalysisKind, MovementViewAngle> = {
  running_gait:     'side',
  squat:            '45_degree',
  deadlift:         'side',
  lunge_single_leg: 'front',
  general:          'unknown',
};

const CONFIDENCE_LABEL: Record<AnalysisConfidence, string> = {
  high:          'High confidence',
  moderate:      'Moderate confidence',
  low:           'Low confidence',
  manual_review: 'Manual review recommended',
};

const CONFIDENCE_OPTIONS: AnalysisConfidence[] = ['high', 'moderate', 'low', 'manual_review'];

const SEVERITY_OPTIONS: { label: string; value: FindingSeverity | null }[] = [
  { label: 'None',     value: null },
  { label: 'Mild',     value: 'low' },
  { label: 'Moderate', value: 'moderate' },
  { label: 'Severe',   value: 'high' },
];

// Estimated angle name → norm key, per analysis context.
const GAIT_NORM_KEYS: Record<string, string> = {
  'Knee flexion': 'knee_flexion',
  'Trunk lean':   'trunk_lean',
};
const LIFTING_NORM_KEYS: Record<string, string> = {
  'Trunk lean':   'trunk_angle',
  'Hip angle':    'hip_angle',
  'Knee flexion': 'knee_angle',
};

function angleConfidenceChip(c: number): { label: string; color: string } {
  if (c >= 0.75) return { label: 'High', color: colors.positive };
  if (c >= 0.5)  return { label: 'Med',  color: colors.warning };
  return { label: 'Low', color: colors.critical };
}

/** Abnormal answer = notable and not a "can't tell" answer → severity tag applies. */
function isAbnormalValue(value: string): boolean {
  return !NORMAL_CHECKLIST_VALUES.has(value) && value !== 'Unclear' && value !== 'Not visible';
}

type MediaState = {
  uri:         string;
  type:        'photo' | 'video';
  width?:      number;
  height?:     number;
  durationMs?: number;
};

type FrameState = {
  uri:    string;
  width:  number;
  height: number;
  timeMs: number;
};

type PoseState = {
  landmarks:   PoseLandmarkRecord[];
  imageWidth:  number;
  imageHeight: number;
};

type SequenceAnalysis = ReturnType<typeof analyzeSequence>;

function poseFromLandmarks(
  landmarks: PoseLandmarkRecord[] | undefined,
  imageWidth: number,
  imageHeight: number,
): PoseState | null {
  return landmarks && landmarks.length > 0 ? { landmarks, imageWidth, imageHeight } : null;
}

function anglesFromLandmarks(landmarks: PoseLandmarkRecord[], kind: MovementAnalysisKind): EstimatedAngle[] {
  return computeEstimatedAngles(landmarks as never, kind);
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function AnalyzeScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ kind?: string }>();
  const kind: MovementAnalysisKind = VALID_KINDS.includes(params.kind as MovementAnalysisKind)
    ? (params.kind as MovementAnalysisKind)
    : 'general';

  const info      = ANALYSIS_KIND_INFO[kind];
  const checklist = ANALYSIS_CHECKLISTS[kind];
  const addAnalysis    = useMovementStore(s => s.addAnalysis);
  const updateAnalysis = useMovementStore(s => s.updateAnalysis);

  const [setupOpen, setSetupOpen] = useState(false);

  const [media, setMedia] = useState<MediaState | null>(null);
  const [frame, setFrame] = useState<FrameState | null>(null);
  const [frameBusy, setFrameBusy] = useState<number | null>(null); // timeMs being extracted

  const [pose,           setPose]           = useState<PoseState | null>(null);
  const [autoLandmarks,  setAutoLandmarks]  = useState<PoseLandmarkRecord[]>([]);
  const [correctedLandmarks, setCorrectedLandmarks] = useState<PoseLandmarkRecord[] | null>(null);
  const [angles,         setAngles]         = useState<EstimatedAngle[]>([]);
  const [detecting,      setDetecting]      = useState(false);
  const [poseMessage,    setPoseMessage]    = useState<string | null>(null);
  const [showSkeleton,   setShowSkeleton]   = useState(true);
  const [showAngleLabels, setShowAngleLabels] = useState(true);
  const [editingMarkers, setEditingMarkers] = useState(false);
  const [manualReviewOpen, setManualReviewOpen] = useState(false);

  const [answers,    setAnswers]    = useState<Record<string, string>>({});
  const [severities, setSeverities] = useState<Record<string, FindingSeverity | null>>({});
  const [notes,      setNotes]      = useState('');
  const [confidenceOverride, setConfidenceOverride] = useState<AnalysisConfidence | null>(null);
  const [saving, setSaving] = useState(false);

  const [analyzingVideo, setAnalyzingVideo] = useState(false);
  const [seqProgress, setSeqProgress] = useState<{ processed: number; total: number } | null>(null);
  const [sequenceResult, setSequenceResult] = useState<PoseSequenceResult | null>(null);
  const [sequenceAnalysis, setSequenceAnalysis] = useState<SequenceAnalysis | null>(null);
  const analysisRunRef = useRef(0);

  const videoPlayer = useVideoPlayer(media?.type === 'video' ? media.uri : null);

  const poseAvailable = isPoseEstimationAvailable();
  const analyzableStillUri = media?.type === 'photo' ? media.uri : frame?.uri ?? null;
  const autoConfidence: AnalysisConfidence = pose ? classifyPoseConfidence(pose.landmarks as never) : 'manual_review';
  const confidence = confidenceOverride ?? autoConfidence;
  const answeredCount = Object.keys(answers).length;
  const hasAutomatedResults = Boolean(pose || sequenceAnalysis);
  const canSave = Boolean(media) && (hasAutomatedResults || answeredCount >= 1);

  const overlayAspectRatio = pose
    ? pose.imageWidth / pose.imageHeight
    : frame
      ? frame.width / frame.height
      : media?.width && media?.height
        ? media.width / media.height
        : 3 / 4;

  // ── Media selection ─────────────────────────────────────────────────────────

  function resetPoseState() {
    setPose(null);
    setAutoLandmarks([]);
    setCorrectedLandmarks(null);
    setAngles([]);
    setPoseMessage(null);
    setConfidenceOverride(null);
    setEditingMarkers(false);
    setSequenceResult(null);
    setSequenceAnalysis(null);
    setManualReviewOpen(false);
    setDetecting(false);
    setAnalyzingVideo(false);
    setSeqProgress(null);
    setFrameBusy(null);
  }

  // Every analysis run (auto-started or button-started) registers a run id;
  // async completions check it before touching state so results from a
  // replaced media file are discarded instead of applied.
  function beginAnalysisRun(): number {
    analysisRunRef.current += 1;
    return analysisRunRef.current;
  }

  function isStaleRun(runId: number): boolean {
    return analysisRunRef.current !== runId;
  }

  function applyPickedAsset(asset: ImagePicker.ImagePickerAsset, type: 'photo' | 'video') {
    setMedia({
      uri:        asset.uri,
      type,
      width:      asset.width || undefined,
      height:     asset.height || undefined,
      durationMs: asset.duration ?? undefined,
    });
    setFrame(null);
    resetPoseState();
  }

  async function pickMedia(source: 'camera' | 'library', type: 'photo' | 'video') {
    if (source === 'camera') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'StrideOS needs camera access to record for analysis.');
        return;
      }
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'StrideOS needs photo library access to choose media for analysis.');
        return;
      }
    }

    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes:    type === 'video' ? ['videos'] : ['images'],
      allowsEditing: false,
      quality:       0.9,
    };

    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);

    if (!result.canceled && result.assets.length > 0) {
      applyPickedAsset(result.assets[0], type);
    }
  }

  function removeMedia() {
    setMedia(null);
    setFrame(null);
    resetPoseState();
  }

  // ── Frame extraction ────────────────────────────────────────────────────────

  const frameTimesMs: { label: string; timeMs: number }[] = (() => {
    if (!media || media.type !== 'video') return [];
    const d = media.durationMs;
    if (d && d > 0) {
      return [0, 0.25, 0.5, 0.75].map(f => ({
        label:  f === 0 ? 'Start' : `${Math.round(f * 100)}%`,
        timeMs: Math.floor(d * f),
      }));
    }
    return [0, 1000, 2000, 3000].map(t => ({ label: `${t / 1000}s`, timeMs: t }));
  })();

  function nearestSequenceFrame(result: PoseSequenceResult | null, timeMs: number) {
    if (!result?.frames.length) return null;
    let best = result.frames[0];
    let bestDiff = Math.abs(best.timeMs - timeMs);
    for (const frameResult of result.frames) {
      const diff = Math.abs(frameResult.timeMs - timeMs);
      if (diff < bestDiff) {
        best = frameResult;
        bestDiff = diff;
      }
    }
    return best;
  }

  function preferredReferenceTime(result: PoseSequenceResult, seq: SequenceAnalysis): number {
    const deepest = seq.keyFrames.find(item => item.label === 'Deepest position');
    if (deepest) return deepest.timeMs;
    if (seq.keyFrames.length > 0 && result.durationMs) {
      const mid = result.durationMs / 2;
      return seq.keyFrames.reduce((best, item) =>
        Math.abs(item.timeMs - mid) < Math.abs(best.timeMs - mid) ? item : best,
      ).timeMs;
    }
    return Math.floor((result.durationMs || media?.durationMs || 0) / 2);
  }

  async function extractFrame(
    timeMs: number,
    resultOverride?: PoseSequenceResult | null,
    skipStandaloneDetection = false,
    runId: number = analysisRunRef.current,
  ) {
    if (!media || media.type !== 'video') return;
    setFrameBusy(timeMs);
    try {
      const { uri, width, height } = await VideoThumbnails.getThumbnailAsync(media.uri, {
        time:    timeMs,
        quality: 0.9,
      });
      if (isStaleRun(runId)) return;
      setFrame({ uri, width, height, timeMs });
      const seqFrame = nearestSequenceFrame(resultOverride ?? sequenceResult, timeMs);
      if (seqFrame?.joints.length) {
        const landmarks = seqFrame.joints.map(j => ({ name: j.name, x: j.x, y: j.y, confidence: j.confidence }));
        setAutoLandmarks(landmarks);
        setCorrectedLandmarks(null);
        setPose(poseFromLandmarks(landmarks, width, height));
        setAngles(anglesFromLandmarks(landmarks, kind));
        setPoseMessage(null);
      } else if (!skipStandaloneDetection) {
        setAutoLandmarks([]);
        setCorrectedLandmarks(null);
        setPose(null);
        setAngles([]);
        setPoseMessage(null);
        // Automatic-first: no sequence data at this moment, so run still-pose
        // detection on the extracted frame instead of waiting for a button tap.
        if (poseAvailable) {
          const result = await detectPose(uri);
          if (isStaleRun(runId)) return;
          if (result && result.joints.length > 0) {
            const landmarks = result.joints.map(j => ({ name: j.name, x: j.x, y: j.y, confidence: j.confidence }));
            setAutoLandmarks(landmarks);
            setPose({ landmarks, imageWidth: result.imageWidth, imageHeight: result.imageHeight });
            setAngles(computeEstimatedAngles(result.joints, kind));
          } else {
            setPoseMessage('No person detected in this frame — try another moment or continue manually.');
            setManualReviewOpen(true);
          }
        }
      }
    } catch {
      if (!isStaleRun(runId)) {
        Alert.alert('Frame extraction failed', 'Could not extract a frame from this video. Try a different time or clip.');
      }
    } finally {
      if (!isStaleRun(runId)) setFrameBusy(null);
    }
  }

  // ── Pose detection ──────────────────────────────────────────────────────────

  async function handleDetectPose(runId: number = analysisRunRef.current) {
    if (!analyzableStillUri || detecting) return;
    setDetecting(true);
    setPoseMessage(null);
    try {
      const result = await detectPose(analyzableStillUri);
      if (isStaleRun(runId)) return;
      if (!result || result.joints.length === 0) {
        setPose(null);
        setAutoLandmarks([]);
        setCorrectedLandmarks(null);
        setAngles([]);
        setPoseMessage('No person detected — check framing and lighting, or continue manually.');
        setManualReviewOpen(true);
      } else {
        const landmarks = result.joints.map(j => ({ name: j.name, x: j.x, y: j.y, confidence: j.confidence }));
        setAutoLandmarks(landmarks);
        setCorrectedLandmarks(null);
        setPose({ landmarks, imageWidth: result.imageWidth, imageHeight: result.imageHeight });
        setAngles(computeEstimatedAngles(result.joints, kind));
        setConfidenceOverride(null);
      }
    } finally {
      if (!isStaleRun(runId)) setDetecting(false);
    }
  }

  async function handleAnalyzeVideo(runId: number = analysisRunRef.current) {
    if (!media || media.type !== 'video') return;
    const mediaUri = media.uri;
    setAnalyzingVideo(true);
    setSeqProgress({ processed: 0, total: 1 });
    setPoseMessage(null);
    setSequenceResult(null);
    setSequenceAnalysis(null);
    try {
      const result = await detectPoseSequence(mediaUri, {
        fps: 12,
        maxDurationMs: 60_000,
        onProgress: (processed, total) => {
          if (!isStaleRun(runId)) setSeqProgress({ processed, total });
        },
      });
      if (isStaleRun(runId)) return;

      if (!result || result.frames.length === 0) {
        setPoseMessage('Could not analyze this video automatically. Use the manual checklist fallback or try a shorter, steadier clip.');
        setManualReviewOpen(true);
        return;
      }

      const view = KIND_CAMERA_VIEW[kind];
      const seq = analyzeSequence(result, kind, view);
      setSequenceResult(result);
      setSequenceAnalysis(seq);
      setConfidenceOverride(null);
      await extractFrame(preferredReferenceTime(result, seq), result, true, runId);
      if (isStaleRun(runId)) return;
      if (seq.confidence === 'manual_review') {
        setPoseMessage('Automatic video analysis needs human review. Adjust the reference markers or use the manual checklist fallback.');
        setManualReviewOpen(true);
      }
    } finally {
      if (!isStaleRun(runId)) {
        setAnalyzingVideo(false);
        setSeqProgress(null);
      }
    }
  }

  useEffect(() => {
    const runId = beginAnalysisRun();
    if (!media) return;
    if (!poseAvailable) {
      // No on-device detection in this build — the manual checklist IS the
      // workflow, so open it instead of leaving the screen empty.
      setManualReviewOpen(true);
      return;
    }

    const run = media.type === 'photo' ? handleDetectPose(runId) : handleAnalyzeVideo(runId);
    void run.catch(() => {
      if (isStaleRun(runId)) return;
      setPoseMessage('Automatic analysis did not complete. Use manual review or try a different clip.');
      setManualReviewOpen(true);
      setDetecting(false);
      setAnalyzingVideo(false);
      setSeqProgress(null);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [media?.uri]);

  // ── Checklist ───────────────────────────────────────────────────────────────

  function selectAnswer(itemId: string, value: string) {
    setAnswers(prev => ({ ...prev, [itemId]: value }));
    if (!isAbnormalValue(value)) {
      setSeverities(prev => {
        const next = { ...prev };
        delete next[itemId];
        return next;
      });
    }
  }

  function saveLandmarkCorrections(nextLandmarks: PoseLandmarkRecord[], corrected: boolean) {
    if (!pose) return;
    const nextPose = { ...pose, landmarks: nextLandmarks };
    setPose(nextPose);
    setCorrectedLandmarks(corrected ? nextLandmarks : null);
    setAngles(anglesFromLandmarks(nextLandmarks, kind));
    setEditingMarkers(false);
  }

  // ── Save ────────────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!media || !canSave || saving) return;
    setSaving(true);

    const checklistFindings: ChecklistFinding[] = checklist
      .filter(item => answers[item.id] !== undefined)
      .map(item => {
        const value = answers[item.id];
        const severity = severities[item.id] ?? undefined;
        return { itemId: item.id, label: item.label, value, severity: severity ?? undefined };
      });

    const limitations: string[] = sequenceAnalysis
      ? [...sequenceAnalysis.limitations]
      : [DETECTION_LIMITATIONS_NOTE];
    if (!pose) {
      limitations.push('Pose detection unavailable — manual analysis only.');
    } else {
      limitations.push('No foot landmarks — ankle angle not estimated.');
    }

    const mediaType = media.type === 'photo' ? 'photo' : sequenceAnalysis ? 'video' : frame ? 'video_frame' : 'video';
    const mediaUri  = media.type === 'photo' ? media.uri : mediaType === 'video_frame' && frame ? frame.uri : media.uri;
    const effectiveLandmarks = correctedLandmarks ?? pose?.landmarks;
    const effectiveAngles = effectiveLandmarks ? anglesFromLandmarks(effectiveLandmarks, kind) : angles;

    // Picker/thumbnail URIs live in the purgeable OS cache — copy the analyzed
    // media into documents so the saved record keeps working. On copy failure
    // fall back to the original URI rather than blocking the save.
    let storedUri = mediaUri;
    try {
      storedUri = await copyAnalysisMediaToStorage(mediaUri, `analysis_${Date.now()}`);
    } catch {
      // keep original URI
    }

    let storedReferenceFrameUri: string | undefined;
    let storedSourceVideoUri: string | undefined;
    const referenceFrameUri = frame?.uri ?? (media.type === 'photo' ? media.uri : undefined);
    if (referenceFrameUri) {
      try {
        storedReferenceFrameUri = media.type === 'photo' && referenceFrameUri === mediaUri
          ? storedUri
          : await copyAnalysisMediaToStorage(referenceFrameUri, `analysis_ref_${Date.now()}`);
      } catch {
        storedReferenceFrameUri = referenceFrameUri;
      }
    }
    if (media.type === 'video' && mediaType === 'video_frame') {
      try {
        storedSourceVideoUri = await copyAnalysisMediaToStorage(media.uri, `analysis_source_${Date.now()}`);
      } catch {
        storedSourceVideoUri = media.uri;
      }
    }

    const autoFindings = buildSequenceFindings(
      {
        estimatedAngles: effectiveAngles,
        angleSeries: sequenceAnalysis?.angleSeries,
        keyFrames: sequenceAnalysis?.keyFrames,
        repSummaries: sequenceAnalysis?.repSummaries,
        symmetryEstimates: sequenceAnalysis?.symmetryEstimates,
        sequenceConfidence: sequenceAnalysis?.confidence ?? confidence,
      },
      kind,
    );
    const manualRecommendations = buildAnalysisRecommendations(kind, checklistFindings);

    const id = addAnalysis({
      type:              kind,
      mediaUri:          storedUri,
      sourceVideoUri:    mediaType === 'video' ? storedUri : storedSourceVideoUri,
      mediaType,
      cameraView:        KIND_CAMERA_VIEW[kind],
      landmarks:         effectiveLandmarks,
      autoLandmarks:     autoLandmarks.length > 0 ? autoLandmarks : undefined,
      correctedLandmarks: correctedLandmarks ?? undefined,
      landmarkSource:    correctedLandmarks ? 'user_corrected' : pose ? 'auto' : checklistFindings.length > 0 ? 'manual_review' : undefined,
      imageAspectRatio:  pose ? pose.imageWidth / pose.imageHeight : (frame ? frame.width / frame.height : (media.width && media.height ? media.width / media.height : undefined)),
      estimatedAngles:   effectiveAngles.length > 0 ? effectiveAngles : undefined,
      checklistFindings,
      confidence:        sequenceAnalysis?.confidence ?? confidence,
      notes:             notes.trim() || undefined,
      recommendations:   [...autoFindings, ...manualRecommendations],
      limitations,
      status:            (sequenceAnalysis?.confidence ?? confidence) === 'manual_review' ? 'needs_review' : 'complete',
      referenceFrameTimeMs: frame?.timeMs,
      referenceFrameUri: storedReferenceFrameUri,
      angleSeries:         sequenceAnalysis?.angleSeries,
      keyFrames:           sequenceAnalysis?.keyFrames,
      repSummaries:        sequenceAnalysis?.repSummaries,
      symmetryEstimates:   sequenceAnalysis?.symmetryEstimates,
      sequenceConfidence:  sequenceAnalysis?.confidence,
      sequenceLimitations: sequenceAnalysis?.limitations,
      analyzedDurationMs:  sequenceResult?.analyzedMs,
      videoDurationMs:     sequenceResult?.durationMs ?? media.durationMs,
    });

    if (sequenceResult) {
      try {
        const poseUri = await savePoseSequence(id, sequenceResult);
        updateAnalysis(id, { poseSequenceUri: poseUri });
      } catch {
        // Inline angle/key-frame data remains available if the raw pose file cannot be written.
      }
    }

    setSaving(false);
    router.replace({
      pathname: mediaType === 'video' ? '/(tabs)/movement/video-analysis' : '/(tabs)/movement/analysis-detail',
      params: mediaType === 'video' ? { id } : { analysisId: id },
    } as never);
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const normContext: 'gait' | 'lifting' | null =
    kind === 'running_gait' ? 'gait' :
    kind === 'squat' || kind === 'deadlift' ? 'lifting' :
    null;
  const normKeys = normContext === 'gait' ? GAIT_NORM_KEYS : normContext === 'lifting' ? LIFTING_NORM_KEYS : {};

  return (
    <View style={s.root}>
      <ScrollView contentContainerStyle={[s.content, { paddingTop: insets.top + spacing.md }]} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={s.headerRow}>
          <Pressable onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 16, right: 16 }}>
            <Text style={s.back}>‹ Back</Text>
          </Pressable>
        </View>
        <View style={s.titleBlock}>
          <Text style={s.eyebrow}>MOVEMENT LAB</Text>
          <Text style={s.title}>{info.title}</Text>
        </View>

        {/* Setup card */}
        <View style={s.card}>
          <Pressable style={s.cardHeaderRow} onPress={() => setSetupOpen(o => !o)}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={s.cardLabel}>SETUP</Text>
              <Text style={s.cameraAngle}>{info.cameraAngle}</Text>
            </View>
            <Text style={s.disclosure}>{setupOpen ? '−' : '+'}</Text>
          </Pressable>
          {setupOpen && (
            <View style={{ gap: spacing.sm }}>
              {info.setup.map((line, i) => (
                <Text key={i} style={s.bullet}>•  {line}</Text>
              ))}
              <Text style={[s.cardLabel, { marginTop: spacing.xs }]}>WHAT STRIDEOS ANALYZES</Text>
              {info.analyzes.map((line, i) => (
                <Text key={i} style={s.bullet}>•  {line}</Text>
              ))}
            </View>
          )}
        </View>

        {/* Media card */}
        <View style={s.card}>
          <Text style={s.cardLabel}>MEDIA</Text>
          {!media ? (
            <View style={s.mediaBtnGrid}>
              <Pressable style={s.mediaBtn} onPress={() => pickMedia('camera', 'video')}>
                <Text style={s.mediaBtnTxt}>Record Video</Text>
              </Pressable>
              <Pressable style={s.mediaBtn} onPress={() => pickMedia('library', 'video')}>
                <Text style={s.mediaBtnTxt}>Choose Video</Text>
              </Pressable>
              <Pressable style={s.mediaBtn} onPress={() => pickMedia('camera', 'photo')}>
                <Text style={s.mediaBtnTxt}>Take Photo</Text>
              </Pressable>
              <Pressable style={s.mediaBtn} onPress={() => pickMedia('library', 'photo')}>
                <Text style={s.mediaBtnTxt}>Choose Photo</Text>
              </Pressable>
            </View>
          ) : (
            <View style={{ gap: spacing.sm }}>
              {media.type === 'video' ? (
                <VideoView player={videoPlayer} style={s.videoPreview} contentFit="contain" nativeControls />
              ) : (
                <Image source={{ uri: media.uri }} style={[s.photoPreview, { aspectRatio: overlayAspectRatio }]} resizeMode="cover" />
              )}
              <View style={s.mediaActionsRow}>
                <Pressable style={s.mediaActionBtn} onPress={() => pickMedia('library', media.type)}>
                  <Text style={s.mediaActionTxt}>Replace</Text>
                </Pressable>
                <Pressable style={s.mediaActionBtn} onPress={removeMedia}>
                  <Text style={[s.mediaActionTxt, { color: colors.critical }]}>Remove</Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>

        {/* Automatic video analysis — the primary path for video clips */}
        {media?.type === 'video' && poseAvailable && (
          <View style={s.card}>
            <Text style={s.cardLabel}>AUTOMATIC VIDEO ANALYSIS</Text>
            <Text style={s.helper}>
              Runs automatically when you add a clip: joint angles across the whole video,
              angle-over-time charts, key moments, and (for strength kinds) rep detection.
            </Text>
            {analyzingVideo ? (
              <View style={{ gap: spacing.xs }}>
                <View style={s.progressTrack}>
                  <View
                    style={[
                      s.progressFill,
                      { width: `${seqProgress ? Math.min(100, (seqProgress.processed / Math.max(1, seqProgress.total)) * 100) : 0}%` },
                    ]}
                  />
                </View>
                <Text style={s.helper}>
                  Analyzing frame {seqProgress?.processed ?? 0}{seqProgress?.total ? ` of ~${seqProgress.total}` : ''}…
                </Text>
              </View>
            ) : (
              <Pressable
                style={[sequenceAnalysis ? s.mediaActionBtn : s.primaryBtn, (detecting || frameBusy !== null) && { opacity: 0.5 }]}
                onPress={() => handleAnalyzeVideo()}
                disabled={detecting || frameBusy !== null}
              >
                <Text style={sequenceAnalysis ? s.mediaActionTxt : s.primaryBtnTxt}>
                  {sequenceAnalysis ? 'Re-run Automatic Analysis' : 'Analyze Full Video'}
                </Text>
              </Pressable>
            )}
          </View>
        )}

        {/* Reference frame (advanced, video only) */}
        {media?.type === 'video' && (
          <View style={s.card}>
            <Text style={s.cardLabel}>REFERENCE FRAME · ADVANCED</Text>
            <Text style={s.helper}>
              Pick a different moment to use as the reference frame for still-pose markers and angles.
            </Text>
            <View style={s.pills}>
              {frameTimesMs.map(t => (
                <Pressable
                  key={t.timeMs}
                  style={[s.pill, frame?.timeMs === t.timeMs && s.pillOn]}
                  onPress={() => extractFrame(t.timeMs)}
                  disabled={frameBusy !== null || analyzingVideo}
                >
                  {frameBusy === t.timeMs ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Text style={[s.pillTxt, frame?.timeMs === t.timeMs && s.pillOnTxt]}>{t.label}</Text>
                  )}
                </Pressable>
              ))}
            </View>
            {frame && !pose ? (
              <Image source={{ uri: frame.uri }} style={[s.photoPreview, { aspectRatio: frame.width / frame.height }]} resizeMode="cover" />
            ) : null}
          </View>
        )}

        {/* Detect pose */}
        {analyzableStillUri ? (
          poseAvailable ? (
            <View style={{ gap: spacing.sm }}>
              <Pressable style={[s.primaryBtn, detecting && { opacity: 0.6 }]} onPress={() => handleDetectPose()} disabled={detecting}>
                {detecting ? (
                  <View style={s.btnRow}>
                    <ActivityIndicator size="small" color={colors.onPrimary} />
                    <Text style={s.primaryBtnTxt}>Detecting…</Text>
                  </View>
                ) : (
                  <Text style={s.primaryBtnTxt}>{pose ? 'Re-run Pose Detection' : 'Detect Pose'}</Text>
                )}
              </Pressable>
              {poseMessage ? <Text style={s.poseMessage}>{poseMessage}</Text> : null}
            </View>
          ) : (
            <View style={s.card}>
              <Text style={s.helper}>
                On-device pose detection isn't available in this build — complete the manual analysis below.
              </Text>
            </View>
          )
        ) : null}

        {/* Overlay */}
        {pose && analyzableStillUri ? (
          <View style={s.card}>
            <Text style={s.cardLabel}>{correctedLandmarks ? 'USER-CORRECTED MARKERS' : 'DETECTED BODY MARKERS'}</Text>
            {editingMarkers ? (
              <LandmarkEditor
                imageUri={analyzableStillUri}
                aspectRatio={overlayAspectRatio}
                autoLandmarks={autoLandmarks.length > 0 ? autoLandmarks : pose.landmarks}
                landmarks={pose.landmarks}
                onCancel={() => setEditingMarkers(false)}
                onSave={saveLandmarkCorrections}
              />
            ) : (
              <>
                <PoseOverlay
                  imageUri={analyzableStillUri}
                  aspectRatio={overlayAspectRatio}
                  landmarks={pose.landmarks}
                  angles={angles}
                  showSkeleton={showSkeleton}
                  showAngles={showAngleLabels}
                />
                <View style={s.toggleRow}>
                  <View style={s.toggleItem}>
                    <Text style={s.toggleLabel}>Skeleton</Text>
                    <Switch value={showSkeleton} onValueChange={setShowSkeleton} trackColor={{ true: colors.primary }} />
                  </View>
                  <View style={s.toggleItem}>
                    <Text style={s.toggleLabel}>Angles</Text>
                    <Switch value={showAngleLabels} onValueChange={setShowAngleLabels} trackColor={{ true: colors.primary }} />
                  </View>
                </View>
                <Pressable style={s.secondaryActionBtn} onPress={() => setEditingMarkers(true)}>
                  <Text style={s.secondaryActionTxt}>Adjust Markers</Text>
                </Pressable>
              </>
            )}
            {angles.length > 0 && showAngleLabels ? (
              <Text style={s.smallDisclaimer}>{ANGLE_ESTIMATE_DISCLAIMER}</Text>
            ) : null}
          </View>
        ) : null}

        {sequenceAnalysis ? (
          <View style={s.card}>
            <Text style={s.cardLabel}>AUTOMATED VIDEO FINDINGS</Text>
            <Text style={s.helper}>
              Reference frame {frame ? `${Math.round(frame.timeMs / 100) / 10}s` : 'selected'} · {CONFIDENCE_LABEL[sequenceAnalysis.confidence]}
            </Text>
            <View style={s.mediaActionsRow}>
              {sequenceAnalysis.keyFrames.slice(0, 4).map(keyFrame => (
                <Pressable
                  key={keyFrame.id}
                  style={[s.mediaActionBtn, frame?.timeMs === keyFrame.timeMs && s.pillOn]}
                  onPress={() => extractFrame(keyFrame.timeMs, sequenceResult, true)}
                  disabled={frameBusy !== null}
                >
                  <Text style={[s.mediaActionTxt, frame?.timeMs === keyFrame.timeMs && s.pillOnTxt]}>
                    {keyFrame.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            {sequenceAnalysis.repSummaries.length > 0 ? (
              <Text style={s.helper}>{sequenceAnalysis.repSummaries.length} estimated reps detected.</Text>
            ) : null}
            {sequenceAnalysis.symmetryEstimates[0] ? (
              <Text style={s.helper}>{sequenceAnalysis.symmetryEstimates[0].note}</Text>
            ) : null}
          </View>
        ) : null}

        {/* Estimated angles */}
        {pose && angles.length > 0 ? (
          <View style={s.card}>
            <Text style={s.cardLabel}>ESTIMATED ANGLES</Text>
            {angles.map((a, i) => {
              const chip = angleConfidenceChip(a.confidence);
              const normKey = normKeys[a.name];
              const assessment = normContext && normKey ? assessJointAngle(normKey, Math.round(a.degrees), normContext) : null;
              return (
                <View key={`${a.side}-${a.name}-${i}`} style={s.angleRow}>
                  <View style={s.angleTopRow}>
                    <Text style={s.angleName}>
                      {a.name}{a.side !== 'center' ? ` — ${a.side}` : ''}
                    </Text>
                    <Text style={s.angleDeg}>{Math.round(a.degrees)}°</Text>
                    <View style={[s.chip, { backgroundColor: chip.color + '22' }]}>
                      <Text style={[s.chipTxt, { color: chip.color }]}>{chip.label}</Text>
                    </View>
                  </View>
                  {assessment ? <Text style={s.angleNote}>{assessment.note}</Text> : a.note ? <Text style={s.angleNote}>{a.note}</Text> : null}
                </View>
              );
            })}
            <Text style={s.smallDisclaimer}>{ANGLE_ESTIMATE_DISCLAIMER}</Text>
          </View>
        ) : null}

        {/* Checklist */}
        <View style={s.card}>
          <Pressable style={s.cardHeaderRow} onPress={() => setManualReviewOpen(open => !open)}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={s.cardLabel}>MANUAL REVIEW · {answeredCount} OF {checklist.length} ANSWERED</Text>
              <Text style={s.helper}>Optional fallback for unclear automatic results.</Text>
            </View>
            <Text style={s.disclosure}>{manualReviewOpen ? '−' : '+'}</Text>
          </Pressable>
          {manualReviewOpen && checklist.map(item => {
            const selected = answers[item.id];
            const abnormal = selected !== undefined && isAbnormalValue(selected);
            return (
              <View key={item.id} style={s.checkItem}>
                <Text style={s.checkLabel}>{item.label}</Text>
                <View style={s.pills}>
                  {item.options.map(opt => (
                    <Pressable
                      key={opt}
                      style={[s.pill, selected === opt && s.pillOn]}
                      onPress={() => selectAnswer(item.id, opt)}
                    >
                      <Text style={[s.pillTxt, selected === opt && s.pillOnTxt]}>{opt}</Text>
                    </Pressable>
                  ))}
                </View>
                {abnormal && (
                  <View style={s.severityRow}>
                    <Text style={s.severityLabel}>Severity</Text>
                    <View style={s.pills}>
                      {SEVERITY_OPTIONS.map(opt => {
                        const on = (severities[item.id] ?? null) === opt.value;
                        return (
                          <Pressable
                            key={opt.label}
                            style={[s.pillSm, on && s.pillOn]}
                            onPress={() => setSeverities(prev => ({ ...prev, [item.id]: opt.value }))}
                          >
                            <Text style={[s.pillTxt, on && s.pillOnTxt]}>{opt.label}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {/* Notes */}
        <View style={s.card}>
          <Text style={s.cardLabel}>NOTES</Text>
          <TextInput
            style={s.notesInput}
            value={notes}
            onChangeText={setNotes}
            placeholder="Context, pain, fatigue, load, shoes…"
            placeholderTextColor={colors.textSubtle}
            multiline
            textAlignVertical="top"
          />
        </View>

        {/* Confidence */}
        <View style={s.card}>
          <Text style={s.cardLabel}>ANALYSIS CONFIDENCE</Text>
          <Text style={s.helper}>
            {pose
              ? 'Auto-rated from pose detection quality. Tap to override.'
              : 'No pose detection ran — manual review recommended unless you override.'}
          </Text>
          <View style={s.pills}>
            {CONFIDENCE_OPTIONS.map(opt => (
              <Pressable
                key={opt}
                style={[s.pill, confidence === opt && s.pillOn]}
                onPress={() => setConfidenceOverride(opt)}
              >
                <Text style={[s.pillTxt, confidence === opt && s.pillOnTxt]}>{CONFIDENCE_LABEL[opt]}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Save */}
        <Pressable
          style={[s.primaryBtn, (!canSave || saving) && { opacity: 0.4 }]}
          onPress={handleSave}
          disabled={!canSave || saving}
        >
          <Text style={s.primaryBtnTxt}>{saving ? 'Saving…' : 'Save Analysis'}</Text>
        </Pressable>
        {!canSave && (
          <Text style={s.helper}>
            {!media ? 'Add a photo or video to save.' : 'Automatic analysis or one manual checklist answer is required to save.'}
          </Text>
        )}

        {/* Footer disclaimer */}
        <Text style={s.smallDisclaimer}>{MOVEMENT_SAFETY_DISCLAIMER}</Text>
      </ScrollView>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: 120, gap: spacing.md },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  back:      { color: colors.primary, fontSize: FontSize.base },
  titleBlock: { gap: 2 },
  eyebrow: {
    color:         colors.textMuted,
    fontSize:      10,
    fontWeight:    FontWeight.black,
    letterSpacing: 0.6,
  },
  title: { color: colors.text, fontSize: 22, fontWeight: FontWeight.black },
  card: {
    backgroundColor: colors.card,
    borderRadius:    12,
    padding:         spacing.md,
    borderWidth:     1,
    borderColor:     colors.border,
    gap:             spacing.sm,
  },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  cardLabel: {
    color:         colors.textMuted,
    fontSize:      10,
    fontWeight:    FontWeight.black,
    letterSpacing: 0.6,
  },
  cameraAngle: { color: colors.text, fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  disclosure:  { color: colors.textSubtle, fontSize: 20, fontWeight: FontWeight.bold },
  bullet:      { color: colors.textMuted, fontSize: FontSize.xs, lineHeight: 17 },
  helper:      { color: colors.textMuted, fontSize: FontSize.xs, lineHeight: 17 },
  mediaBtnGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  mediaBtn: {
    flexGrow:        1,
    flexBasis:       '45%',
    backgroundColor: colors.border,
    borderRadius:    Radius.sm,
    paddingVertical: spacing.md,
    alignItems:      'center',
  },
  mediaBtnTxt: { color: colors.text, fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  videoPreview: {
    width:           '100%',
    height:          220,
    borderRadius:    Radius.md,
    backgroundColor: '#000',
    overflow:        'hidden',
  },
  photoPreview: {
    width:           '100%',
    borderRadius:    Radius.md,
    backgroundColor: '#000',
  },
  mediaActionsRow: { flexDirection: 'row', gap: spacing.sm },
  mediaActionBtn: {
    backgroundColor:   colors.border,
    borderRadius:      Radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.xs,
  },
  mediaActionTxt: { color: colors.textMuted, fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  secondaryActionBtn: {
    alignSelf:        'flex-start',
    backgroundColor:  colors.border,
    borderRadius:     Radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.xs,
  },
  secondaryActionTxt: { color: colors.textMuted, fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  pill: {
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.xs,
    borderRadius:      20,
    backgroundColor:   colors.border,
  },
  pillSm: {
    paddingHorizontal: spacing.sm,
    paddingVertical:   4,
    borderRadius:      20,
    backgroundColor:   colors.border,
  },
  pillOn: {
    backgroundColor: colors.primaryDim,
    borderWidth:     1,
    borderColor:     colors.primary,
  },
  pillTxt:   { color: colors.textDim, fontSize: FontSize.xs },
  pillOnTxt: { color: colors.primary, fontWeight: FontWeight.bold },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius:    Radius.sm,
    paddingVertical: spacing.md,
    alignItems:      'center',
  },
  primaryBtnTxt: { color: colors.onPrimary, fontSize: FontSize.base, fontWeight: FontWeight.bold },
  btnRow:        { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  poseMessage:   { color: colors.warning, fontSize: FontSize.xs, lineHeight: 17 },
  progressTrack: {
    height:          6,
    borderRadius:    3,
    backgroundColor: colors.border,
    overflow:        'hidden',
  },
  progressFill: {
    height:          6,
    borderRadius:    3,
    backgroundColor: colors.primary,
  },
  toggleRow:  { flexDirection: 'row', gap: spacing.lg },
  toggleItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  toggleLabel: { color: colors.textMuted, fontSize: FontSize.sm },
  smallDisclaimer: { color: colors.textSubtle, fontSize: FontSize.xs, lineHeight: 16 },
  angleRow:    { gap: 2, paddingVertical: spacing.xs, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  angleTopRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  angleName:   { color: colors.text, fontSize: FontSize.sm, flex: 1, textTransform: 'capitalize' },
  angleDeg:    { color: colors.text, fontSize: FontSize.base, fontWeight: FontWeight.black },
  chip:        { borderRadius: Radius.sm, paddingHorizontal: 6, paddingVertical: 2 },
  chipTxt:     { fontSize: 10, fontWeight: FontWeight.black },
  angleNote:   { color: colors.textMuted, fontSize: FontSize.xs, lineHeight: 16 },
  checkItem:  { gap: spacing.xs, paddingVertical: spacing.xs },
  checkLabel: { color: colors.text, fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  severityRow:   { gap: spacing.xs, marginTop: 2 },
  severityLabel: { color: colors.textMuted, fontSize: FontSize.xs },
  notesInput: {
    backgroundColor: colors.bg,
    borderRadius:    Radius.sm,
    borderWidth:     1,
    borderColor:     colors.border,
    color:           colors.text,
    fontSize:        FontSize.base,
    padding:         spacing.md,
    minHeight:       90,
  },
});
