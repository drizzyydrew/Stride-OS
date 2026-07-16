// ─── Movement Lab — Analyze ───────────────────────────────────────────────────
//
// Build 36 markerless analysis flow: Dion instruction card for the kind+view →
// TimedCaptureCamera (countdown + auto-stop) or a validated library import →
// automatic on-device pose analysis (Apple Vision via stride-pose) → matrix-
// filtered estimated angles + manual checklist → saved MovementAnalysis. Pose
// is best-effort: when it is unavailable or finds no person, the manual path
// stays fully usable and the record says so honestly.

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
import {
  MOVEMENT_VIDEO_PICKER_OPTIONS,
  prepareImportedMovementVideo,
} from '../../../src/lib/movementMediaImport';
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
import { classifyPoseConfidence, computeEstimatedAngles, computeFrontalMetrics } from '../../../src/utils/poseAngles';
import { analyzeSequence, buildRawSequenceMaterial } from '../../../src/utils/poseSequence';
import {
  canonicalView,
  determineClosestSide,
  filterAngleSeries,
  filterChecklistItemsForView,
  filterEstimatedAngles,
  filterLandmarksForDisplay,
  movementOverlayConfiguration,
  normalizeAnalysisKind,
} from '../../../src/utils/measurementMatrix';
import { decodeFailedError, validatePickedVideo } from '../../../src/utils/mediaValidation';
import { ANALYSIS_KIND_CAPTURE, IMPORT_LIMITS_COPY } from '../../../src/constants/captureConfig';
import { dionImagesForKind } from '../../../src/constants/dionImages';
import DionInstructionCard from '../../../src/components/movement/DionInstructionCard';
import TimedCaptureCamera, { type TimedCaptureResult } from '../../../src/components/movement/TimedCaptureCamera';
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

type CurrentMovementKind = Exclude<MovementAnalysisKind, 'lunge_single_leg'>;

const VALID_KINDS: CurrentMovementKind[] = ['running_gait', 'bike_fit', 'squat', 'deadlift', 'single_leg_control', 'lunge', 'general'];

// Default capture view per kind; angled views are not offered. 'general' starts unknown
// until the user picks a view below.
const KIND_CAMERA_VIEW: Record<CurrentMovementKind, MovementViewAngle> = {
  running_gait:        'side',
  bike_fit:            'side',
  squat:                'side',
  deadlift:             'side',
  single_leg_control:   'front',
  lunge:                'side',
  general:              'unknown',
};

// Kinds where lateral capture drives a closest-side, single-limb read —
// mirrors the "Lateral, lower-body kinds" rule in the measurement matrix.
const LATERAL_CLOSEST_SIDE_KINDS = new Set<MovementAnalysisKind>([
  'running_gait', 'bike_fit', 'squat', 'deadlift', 'lunge', 'single_leg_control',
]);

const GENERAL_VIEW_OPTIONS: { label: string; view: MovementViewAngle }[] = [
  { label: 'Direct lateral',  view: 'side' },
  { label: 'Direct frontal',  view: 'front' },
  { label: 'Direct posterior', view: 'rear' },
  { label: 'Unknown',         view: 'unknown' },
];

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
  'Trunk lean':    'trunk_angle',
  'Hip flexion':   'hip_angle',
  'Hip extension': 'hip_angle',
  'Knee flexion':  'knee_angle',
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
  captureMetadata: {
    cameraFacing: 'front' | 'back' | 'library' | 'unknown';
    isMirrored: boolean;
    orientationConfirmed: boolean;
  };
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

function anglesForView(
  landmarks: PoseLandmarkRecord[],
  kind: MovementAnalysisKind,
  view: MovementViewAngle,
): EstimatedAngle[] {
  return view === 'front' || view === 'rear'
    ? computeFrontalMetrics(landmarks as never)
    : anglesFromLandmarks(landmarks, kind);
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function AnalyzeScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ kind?: string }>();
  const normalizedKind = normalizeAnalysisKind(params.kind ?? 'general');
  const kind: CurrentMovementKind = VALID_KINDS.includes(normalizedKind as CurrentMovementKind)
    ? (normalizedKind as CurrentMovementKind)
    : 'general';

  const info      = ANALYSIS_KIND_INFO[kind] ?? ANALYSIS_KIND_INFO.general;
  const addAnalysis    = useMovementStore(s => s.addAnalysis);
  const updateAnalysis = useMovementStore(s => s.updateAnalysis);

  const [setupOpen, setSetupOpen] = useState(false);

  // 'general' requires the user to pick a view before capture/analysis.
  const [generalView, setGeneralView] = useState<MovementViewAngle>('unknown');
  const view: MovementViewAngle = kind === 'general' ? generalView : KIND_CAMERA_VIEW[kind];
  const checklist = filterChecklistItemsForView(
    ANALYSIS_CHECKLISTS[kind] ?? ANALYSIS_CHECKLISTS.general,
    kind,
    view,
  );
  const dionEntry = dionImagesForKind(kind, view);
  const captureConfig = ANALYSIS_KIND_CAPTURE[kind];
  // Single-leg / split-stance kinds get one continuous take long enough to
  // cover both sides (10 s/side ⇒ 20 s continuous, per the capture-duration spec).
  const cameraDurationSec = captureConfig.perSide ? captureConfig.durationSec * 2 : captureConfig.durationSec;

  const [media, setMedia] = useState<MediaState | null>(null);
  const [frame, setFrame] = useState<FrameState | null>(null);
  const [frameBusy, setFrameBusy] = useState<number | null>(null); // timeMs being extracted
  const [showCamera, setShowCamera] = useState(false);
  const [cameraMode, setCameraMode] = useState<'video' | 'photo'>('video');
  const [importingVideo, setImportingVideo] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [retryVideoAsset, setRetryVideoAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);

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

  // Closest-side (lateral lower-body kinds only) — auto-detected from pose
  // confidence; the UI asks the athlete when confidence is low/absent.
  const [closestSide, setClosestSide] = useState<'left' | 'right' | null>(null);
  const [closestSideSource, setClosestSideSource] = useState<'auto' | 'user' | undefined>(undefined);
  const needsClosestSide = LATERAL_CLOSEST_SIDE_KINDS.has(kind) && canonicalView(view) === 'lateral';
  const processingClosestSide = closestSide && media?.captureMetadata.isMirrored
    ? closestSide === 'left' ? 'right' : 'left'
    : closestSide;

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

  const displayAngles = needsClosestSide
    ? filterEstimatedAngles(angles, kind, view, processingClosestSide ?? undefined)
    : filterEstimatedAngles(angles, kind, view);
  const displayLandmarks = filterLandmarksForDisplay(pose?.landmarks, kind, view, processingClosestSide ?? undefined);
  const overlayConfig = movementOverlayConfiguration(kind, view, processingClosestSide ?? undefined);

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
    setClosestSide(null);
    setClosestSideSource(undefined);
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
      captureMetadata: { cameraFacing: 'library', isMirrored: false, orientationConfirmed: false },
    });
    setFrame(null);
    resetPoseState();
  }

  async function pickPhoto(source: 'camera' | 'library') {
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

    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: false, quality: 0.9 };
    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);

    if (!result.canceled && result.assets.length > 0) {
      applyPickedAsset(result.assets[0], 'photo');
    }
  }

  async function prepareVideoAsset(asset: ImagePicker.ImagePickerAsset) {
    setImportingVideo(true);
    setImportError(null);
    setRetryVideoAsset(asset);
    const prepared = await prepareImportedMovementVideo({
      uri: asset.uri,
      duration: asset.duration,
      fileSize: asset.fileSize,
      mimeType: asset.mimeType,
      fileName: asset.fileName,
    });
    setImportingVideo(false);
    if (!prepared.ok) {
      setImportError(prepared.error.message);
      return;
    }
    setRetryVideoAsset(null);
    applyPickedAsset({
      ...asset,
      uri: prepared.video.uri,
      duration: prepared.video.duration,
      fileSize: prepared.video.fileSize ?? undefined,
      mimeType: prepared.video.mimeType ?? undefined,
      fileName: prepared.video.fileName,
    }, 'video');
  }

  async function pickVideoFromLibrary() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'StrideOS needs photo library access to choose a video for analysis.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync(MOVEMENT_VIDEO_PICKER_OPTIONS);
    if (result.canceled || result.assets.length === 0) return;
    await prepareVideoAsset(result.assets[0]);
  }

  async function handleCameraCaptured(result: TimedCaptureResult) {
    const { uri } = result;
    if (result.type === 'video') {
      const validationError = await validatePickedVideo({ uri });
      if (validationError) {
        Alert.alert("This clip can't be used", validationError.message);
        return;
      }
    }
    setShowCamera(false);
    setMedia({
      uri,
      type: result.type,
      width: result.width,
      height: result.height,
      captureMetadata: result.captureMetadata,
    });
    setFrame(null);
    resetPoseState();
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

  function applyClosestSideFromInput(input: PoseSequenceResult | PoseLandmarkRecord[]) {
    if (!needsClosestSide) return;
    if (!media?.captureMetadata.orientationConfirmed || media.captureMetadata.isMirrored) {
      setClosestSide(null);
      setClosestSideSource(undefined);
      return;
    }
    const detected = determineClosestSide(input);
    if (detected && detected.confidence === 'high') {
      setClosestSide(detected.side);
      setClosestSideSource('auto');
    } else {
      // Low/no confidence — leave unset so the UI prompts the athlete.
      setClosestSide(detected?.side ?? null);
      setClosestSideSource(undefined);
    }
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
        setAngles(anglesForView(landmarks, kind, view));
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
            setAngles(anglesForView(landmarks, kind, view));
            applyClosestSideFromInput(landmarks);
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
        setAngles(anglesForView(landmarks, kind, view));
        setConfidenceOverride(null);
        applyClosestSideFromInput(landmarks);
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
        maxDurationMs: 30_000,
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

      const detectedSide = needsClosestSide && media.captureMetadata.orientationConfirmed && !media.captureMetadata.isMirrored
        ? determineClosestSide(result)
        : null;
      const trustedSide = detectedSide?.confidence === 'high' ? detectedSide.side : undefined;
      const seq = analyzeSequence(result, kind, view, trustedSide);
      setSequenceResult(result);
      setSequenceAnalysis(seq);
      setConfidenceOverride(null);
      applyClosestSideFromInput(result);
      await extractFrame(preferredReferenceTime(result, seq), result, true, runId);
      if (isStaleRun(runId)) return;
      if (seq.confidence === 'manual_review') {
        setPoseMessage('Automatic video analysis needs human review. Adjust the reference markers or use the manual checklist fallback.');
        setManualReviewOpen(true);
      }
    } catch {
      if (!isStaleRun(runId)) {
        const error = decodeFailedError();
        setPoseMessage(error.message);
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

  useEffect(() => {
    if (!sequenceResult || !needsClosestSide) return;
    setSequenceAnalysis(analyzeSequence(sequenceResult, kind, view, processingClosestSide ?? undefined));
  }, [kind, needsClosestSide, processingClosestSide, sequenceResult, view]);

  useEffect(() => {
    if (!needsClosestSide || closestSideSource === 'user') return;
    const input = sequenceResult ?? pose?.landmarks;
    if (input && media?.captureMetadata.orientationConfirmed) applyClosestSideFromInput(input);
    // Orientation confirmation is the event that makes automatic anatomical
    // side detection safe for library media; mirrored media remains manual.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [media?.captureMetadata.isMirrored, media?.captureMetadata.orientationConfirmed, pose?.landmarks, sequenceResult]);

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
    setAngles(anglesForView(nextLandmarks, kind, view));
    setEditingMarkers(false);
  }

  // ── Save ────────────────────────────────────────────────────────────────────

  const closestSideUnresolved = needsClosestSide && hasAutomatedResults && !closestSide;
  const orientationUnconfirmed = Boolean(media && !media.captureMetadata.orientationConfirmed);

  async function handleSave() {
    if (!media || !canSave || saving || closestSideUnresolved || orientationUnconfirmed) return;
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
    const effectiveDisplayLandmarks = filterLandmarksForDisplay(effectiveLandmarks, kind, view, processingClosestSide ?? undefined);
    const rawAngles = effectiveLandmarks ? anglesForView(effectiveLandmarks, kind, view) : angles;
    const effectiveAngles = filterEstimatedAngles(rawAngles, kind, view, processingClosestSide ?? undefined);
    const effectiveAngleSeries = sequenceAnalysis?.angleSeries
      ? filterAngleSeries(sequenceAnalysis.angleSeries, kind, view, processingClosestSide ?? undefined)
      : undefined;
    const rawSequenceMaterial = sequenceResult
      ? buildRawSequenceMaterial(sequenceResult, kind, view)
      : undefined;

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

    const effectiveKeyFrames = sequenceAnalysis?.keyFrames.map(keyFrame => ({
      ...keyFrame,
      angles: keyFrame.angles
        ? filterEstimatedAngles(keyFrame.angles, kind, view, processingClosestSide ?? undefined)
        : undefined,
    }));
    const effectiveSymmetry = canonicalView(view) === 'lateral'
      ? undefined
      : sequenceAnalysis?.symmetryEstimates;

    const autoFindings = buildSequenceFindings(
      {
        estimatedAngles: effectiveAngles,
        angleSeries: effectiveAngleSeries,
        keyFrames: effectiveKeyFrames,
        repSummaries: sequenceAnalysis?.repSummaries,
        symmetryEstimates: effectiveSymmetry,
        sequenceConfidence: sequenceAnalysis?.confidence ?? confidence,
      },
      kind,
    );
    const normalizeSavedSideText = (value: string) => media.captureMetadata.isMirrored
      ? value.replace(/\bleft\b/gi, '__swap_side__').replace(/\bright\b/gi, 'left').replace(/__swap_side__/g, 'right')
      : value;
    const normalizedAutoFindings = autoFindings.map(recommendation => ({
      ...recommendation,
      finding: normalizeSavedSideText(recommendation.finding),
      meaning: normalizeSavedSideText(recommendation.meaning),
      recommendation: normalizeSavedSideText(recommendation.recommendation),
    }));
    const manualRecommendations = buildAnalysisRecommendations(kind, checklistFindings);

    const id = addAnalysis({
      type:              kind,
      mediaUri:          storedUri,
      sourceVideoUri:    mediaType === 'video' ? storedUri : storedSourceVideoUri,
      mediaType,
      cameraView:        view,
      closestSide:       closestSide ?? undefined,
      closestSideSource: closestSide ? closestSideSource : undefined,
      captureMetadata:   media.captureMetadata,
      rawLandmarks:      effectiveLandmarks,
      displayLandmarks:  effectiveDisplayLandmarks,
      landmarks:         effectiveDisplayLandmarks,
      autoLandmarks:     autoLandmarks.length > 0 ? autoLandmarks : undefined,
      correctedLandmarks: correctedLandmarks ?? undefined,
      landmarkSource:    correctedLandmarks ? 'user_corrected' : pose ? 'auto' : checklistFindings.length > 0 ? 'manual_review' : undefined,
      imageAspectRatio:  pose ? pose.imageWidth / pose.imageHeight : (frame ? frame.width / frame.height : (media.width && media.height ? media.width / media.height : undefined)),
      rawEstimatedAngles: rawAngles.length > 0 ? rawAngles : undefined,
      estimatedAngles:   effectiveAngles.length > 0 ? effectiveAngles : undefined,
      measurementConventionVersion: 2,
      checklistFindings,
      confidence:        sequenceAnalysis?.confidence ?? confidence,
      notes:             notes.trim() || undefined,
      recommendations:   [...normalizedAutoFindings, ...manualRecommendations],
      limitations,
      status:            (sequenceAnalysis?.confidence ?? confidence) === 'manual_review' ? 'needs_review' : 'complete',
      referenceFrameTimeMs: frame?.timeMs,
      referenceFrameUri: storedReferenceFrameUri,
      angleSeries:         effectiveAngleSeries,
      rawAngleSeries:      rawSequenceMaterial?.angleSeries,
      keyFrames:           effectiveKeyFrames,
      rawKeyFrames:        rawSequenceMaterial?.keyFrames,
      repSummaries:        sequenceAnalysis?.repSummaries,
      symmetryEstimates:   effectiveSymmetry,
      sequenceConfidence:  sequenceAnalysis?.confidence,
      sequenceLimitations: sequenceAnalysis?.limitations,
      analyzedDurationMs:  sequenceResult?.analyzedMs,
      videoDurationMs:     sequenceResult?.durationMs ?? media.durationMs,
      bikeFitPhases: kind === 'bike_fit' && sequenceAnalysis
        ? {
            topDeadCenterMs: sequenceAnalysis.keyFrames.find(keyFrame => keyFrame.label.includes('top pedal phase'))?.timeMs,
            bottomDeadCenterMs: sequenceAnalysis.keyFrames.find(keyFrame => keyFrame.label.includes('bottom pedal phase'))?.timeMs,
            source: 'estimated',
          }
        : undefined,
      viewFiltersMaterialized: false,
    } as never);

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

        {/* General upload: pick a view before anything else. */}
        {kind === 'general' && (
          <View style={s.card}>
            <Text style={s.cardLabel}>CAMERA VIEW</Text>
            <Text style={s.helper}>Pick the view that best matches how you filmed this clip.</Text>
            <View style={s.pills}>
              {GENERAL_VIEW_OPTIONS.map(opt => (
                <Pressable
                  key={opt.label}
                  style={[s.pill, generalView === opt.view && s.pillOn]}
                  onPress={() => setGeneralView(opt.view)}
                >
                  <Text style={[s.pillTxt, generalView === opt.view && s.pillOnTxt]}>{opt.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* Dion instruction card for the exact kind + view */}
        <DionInstructionCard dion={dionEntry} variant="full" />

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
            <View style={{ gap: spacing.sm }}>
              <View style={s.mediaBtnGrid}>
                <Pressable style={s.mediaBtn} onPress={() => { setCameraMode('video'); setShowCamera(true); }}>
                  <Text style={s.mediaBtnTxt}>Record Video</Text>
                </Pressable>
                <Pressable style={[s.mediaBtn, importingVideo && { opacity: 0.5 }]} onPress={pickVideoFromLibrary} disabled={importingVideo}>
                  <Text style={s.mediaBtnTxt}>{importingVideo ? 'Preparing…' : 'Choose Video'}</Text>
                </Pressable>
                <Pressable style={s.mediaBtn} onPress={() => { setCameraMode('photo'); setShowCamera(true); }}>
                  <Text style={s.mediaBtnTxt}>Take Photo</Text>
                </Pressable>
                <Pressable style={s.mediaBtn} onPress={() => pickPhoto('library')}>
                  <Text style={s.mediaBtnTxt}>Choose Photo</Text>
                </Pressable>
              </View>
              {importError ? (
                <View style={{ gap: spacing.xs }}>
                  <Text style={s.poseMessage}>{importError}</Text>
                  {retryVideoAsset ? (
                    <Pressable style={s.mediaActionBtn} onPress={() => void prepareVideoAsset(retryVideoAsset)} disabled={importingVideo}>
                      <Text style={s.mediaActionTxt}>Retry Video Import</Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}
              <Text style={s.importLimitsTxt}>{IMPORT_LIMITS_COPY}</Text>
            </View>
          ) : (
            <View style={{ gap: spacing.sm }}>
              {media.type === 'video' ? (
                <VideoView player={videoPlayer} style={s.videoPreview} contentFit="contain" nativeControls />
              ) : (
                <Image source={{ uri: media.uri }} style={[s.photoPreview, { aspectRatio: overlayAspectRatio }]} resizeMode="cover" />
              )}
              <View style={s.mediaActionsRow}>
                {media.type === 'video' && (
                  <Pressable style={s.mediaActionBtn} onPress={() => { setCameraMode('video'); setShowCamera(true); }}>
                    <Text style={s.mediaActionTxt}>Retake</Text>
                  </Pressable>
                )}
                <Pressable style={s.mediaActionBtn} onPress={() => pickPhoto(media.type === 'photo' ? 'library' : 'library')}>
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
        {media && !media.captureMetadata.orientationConfirmed ? (
          <View style={s.card}>
            <Text style={s.cardLabel}>CONFIRM MEDIA ORIENTATION</Text>
            <Text style={s.helper}>
              Library media does not reliably tell StrideOS whether it was saved mirrored. Confirm this before analysis is saved so anatomical left and right are never silently reversed.
            </Text>
            <View style={s.pills}>
              <Pressable
                style={s.pill}
                onPress={() => setMedia(current => current ? {
                  ...current,
                  captureMetadata: { ...current.captureMetadata, isMirrored: false, orientationConfirmed: true },
                } : current)}
              >
                <Text style={s.pillTxt}>Saved normally</Text>
              </Pressable>
              <Pressable
                style={s.pill}
                onPress={() => setMedia(current => current ? {
                  ...current,
                  captureMetadata: { ...current.captureMetadata, isMirrored: true, orientationConfirmed: true },
                } : current)}
              >
                <Text style={s.pillTxt}>Saved mirrored</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

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

        {/* Closest-side chooser — lateral lower-body kinds, low/no auto confidence */}
        {needsClosestSide && hasAutomatedResults && (
          <View style={s.card}>
            <Text style={s.cardLabel}>WHICH SIDE IS CLOSEST TO THE CAMERA?</Text>
            <Text style={s.helper}>
              {closestSideSource === 'auto'
                ? 'Detected automatically from this clip — change it if it looks wrong.'
                : 'Needed to show single-limb angles correctly for a lateral view.'}
            </Text>
            <View style={s.pills}>
              {(['left', 'right'] as const).map(side => (
                <Pressable
                  key={side}
                  style={[s.pill, closestSide === side && s.pillOn]}
                  onPress={() => { setClosestSide(side); setClosestSideSource('user'); }}
                >
                  <Text style={[s.pillTxt, closestSide === side && s.pillOnTxt]}>
                    {side === 'left' ? 'Left' : 'Right'}
                  </Text>
                </Pressable>
              ))}
            </View>
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
                landmarks={displayLandmarks ?? pose.landmarks}
                allowedLandmarkNames={overlayConfig.visibleJoints.filter(name => /_(shoulder|elbow|wrist|hip|knee|ankle)$/.test(name))}
                visibleConnections={overlayConfig.visibleConnections}
                onCancel={() => setEditingMarkers(false)}
                onSave={saveLandmarkCorrections}
              />
            ) : (
              <>
                <PoseOverlay
                  imageUri={analyzableStillUri}
                  aspectRatio={overlayAspectRatio}
                  landmarks={displayLandmarks ?? pose.landmarks}
                  angles={displayAngles}
                  showSkeleton={showSkeleton}
                  showAngles={showAngleLabels}
                  connections={overlayConfig.visibleConnections}
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
            {displayAngles.length > 0 && showAngleLabels ? (
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
        {pose && displayAngles.length > 0 ? (
          <View style={s.card}>
            <Text style={s.cardLabel}>ESTIMATED ANGLES</Text>
            {displayAngles.map((a, i) => {
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
          style={[s.primaryBtn, (!canSave || saving || closestSideUnresolved || orientationUnconfirmed) && { opacity: 0.4 }]}
          onPress={handleSave}
          disabled={!canSave || saving || closestSideUnresolved || orientationUnconfirmed}
        >
          <Text style={s.primaryBtnTxt}>{saving ? 'Saving…' : 'Save Analysis'}</Text>
        </Pressable>
        {!canSave && (
          <Text style={s.helper}>
            {!media ? 'Add a photo or video to save.' : 'Automatic analysis or one manual checklist answer is required to save.'}
          </Text>
        )}
        {canSave && closestSideUnresolved && (
          <Text style={s.helper}>Choose which side is closest to the camera above to save.</Text>
        )}
        {canSave && orientationUnconfirmed ? (
          <Text style={s.helper}>Confirm whether the saved media is mirrored before saving.</Text>
        ) : null}

        {/* Footer disclaimer */}
        <Text style={s.smallDisclaimer}>{MOVEMENT_SAFETY_DISCLAIMER}</Text>
      </ScrollView>

      <TimedCaptureCamera
        visible={showCamera}
        onClose={() => setShowCamera(false)}
        onCaptured={handleCameraCaptured}
        dion={dionEntry}
        title={info.title}
        durationSec={cameraDurationSec}
        captureMode={cameraMode}
      />
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
  importLimitsTxt: { color: colors.textSubtle, fontSize: 11, lineHeight: 16 },
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
