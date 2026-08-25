// ─── Movement Lab — Video Analysis ─────────────────────────────────────────────
//
// Read-only view of a saved full-video MovementAnalysis (Build 34 / V2): the
// clip with a scrubbable skeleton overlay, angle-over-time charts, key
// moments, and rep/symmetry findings. Everything here is an estimate from
// on-device 2D pose detection — never a diagnosis, never an exact
// measurement. Full per-frame landmarks are file-backed and lazy-loaded only
// when the Video tab needs them; if that file is missing (e.g. an older
// analysis, or storage was cleared) the overlay degrades gracefully.

import { useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEvent } from 'expo';
import { VideoView, useVideoPlayer } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';
import type { PoseJoint, PoseSequenceResult } from 'stride-pose';

import { useMovementStore } from '../../../src/store/movementStore';
import { resolveDocumentUri } from '../../../src/lib/mediaPaths';
import { loadPoseSequence } from '../../../src/lib/poseSequenceStorage';
import { computeEstimatedAngles, computeFrontalMetrics } from '../../../src/utils/poseAngles';
import { analyzeSequence, buildRawSequenceMaterial, repConsistency } from '../../../src/utils/poseSequence';
import { ANALYSIS_KIND_INFO, buildSequenceFindings } from '../../../src/utils/movementEngine';
import {
  filterAngleSeries,
  filterEstimatedAngles,
  filterLandmarksForDisplay,
  movementOverlayConfiguration,
  requiresClosestSide,
} from '../../../src/utils/measurementMatrix';
import SkeletonOverlay from '../../../src/components/movement/SkeletonOverlay';
import PoseOverlay from '../../../src/components/assessment/PoseOverlay';
import LandmarkEditor from '../../../src/components/movement/LandmarkEditor';
import AngleChart from '../../../src/components/movement/AngleChart';
import VideoScrubBar from '../../../src/components/movement/VideoScrubBar';
import { colors } from '../../../src/theme/colors';
import { spacing } from '../../../src/theme/spacing';
import { FontSize, FontWeight, Radius } from '../../../src/theme/tokens';
import { displayLabel } from '../../../src/utils/displayLabels';
import type {
  AngleSeries,
  AngleSeriesPoint,
  AnalysisConfidence,
  MovementAnalysis,
  MovementAnalysisKind,
  PoseLandmarkRecord,
} from '../../../src/types/movement';

// ─── Constants ────────────────────────────────────────────────────────────────

const VIDEO_ESTIMATE_DISCLAIMER =
  'Angles and scores are estimates based on camera view and landmark detection. They are not exact clinical measurements.';

const STRENGTH_KINDS: MovementAnalysisKind[] = ['squat', 'deadlift', 'lunge', 'single_leg_control', 'lunge_single_leg'];

type Section = 'overview' | 'video' | 'angles' | 'keyframes' | 'findings';

const SECTIONS: { key: Section; label: string }[] = [
  { key: 'overview',  label: 'Overview' },
  { key: 'angles',    label: 'Angles' },
  { key: 'keyframes', label: 'Key Frames' },
  { key: 'findings',  label: 'Findings' },
];

const CONFIDENCE_META: Record<AnalysisConfidence, { label: string; color: string }> = {
  high:          { label: 'High confidence',            color: colors.positive },
  moderate:      { label: 'Moderate confidence',        color: colors.warning },
  low:           { label: 'Low confidence',             color: colors.critical },
  manual_review: { label: 'Manual review recommended',  color: colors.textMuted },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTimeMs(ms: number): string {
  const totalSec = Math.max(0, ms) / 1000;
  const m = Math.floor(totalSec / 60);
  const sec = totalSec - m * 60;
  return `${m}:${sec < 10 ? '0' : ''}${sec.toFixed(1)}`;
}

function nearestFrame(sequence: PoseSequenceResult | null, timeMs: number) {
  if (!sequence || sequence.frames.length === 0) return null;
  let best = sequence.frames[0];
  let bestDiff = Math.abs(best.timeMs - timeMs);
  for (const f of sequence.frames) {
    const diff = Math.abs(f.timeMs - timeMs);
    if (diff < bestDiff) { bestDiff = diff; best = f; }
  }
  return best;
}

function nearestSeriesDegrees(series: AngleSeries, timeMs: number, toleranceMs = 500): number | null {
  let best: number | null = null;
  let bestDiff = Infinity;
  for (const p of series.points) {
    if (p.degrees === null) continue;
    const diff = Math.abs(p.timeMs - timeMs);
    if (diff < bestDiff) { bestDiff = diff; best = p.degrees; }
  }
  return best !== null && bestDiff <= toleranceMs ? best : null;
}

function seriesFor(series: AngleSeries[], name: string, side: AngleSeries['side']): AngleSeries {
  return series.find(s => s.name === name && s.side === side) ?? { name, joint: '', side, points: [] };
}

function seriesSummary(series: AngleSeries): string | null {
  const values = series.points.map(p => p.degrees).filter((value): value is number => value !== null);
  if (values.length === 0) return null;
  return `${series.name}${series.side !== 'center' ? ` — ${series.side}` : ''}: ${Math.round(Math.min(...values))}° to ${Math.round(Math.max(...values))}° Estimated`;
}

function estimatedBikeFitPhases(series: AngleSeries[]): MovementAnalysis['bikeFitPhases'] {
  const knee = series.find(item => item.name === 'Knee flexion' && item.side !== 'center');
  const values = (knee?.points ?? []).filter(
    (point): point is AngleSeriesPoint & { degrees: number } => point.degrees !== null,
  );
  if (values.length === 0) return undefined;
  const top = values.reduce((a, b) => b.degrees > a.degrees ? b : a);
  const bottom = values.reduce((a, b) => b.degrees < a.degrees ? b : a);
  return {
    topDeadCenterMs: top.timeMs,
    bottomDeadCenterMs: bottom.timeMs,
    source: 'estimated',
  };
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function VideoAnalysisScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const analysis = useMovementStore(s => s.analyses.find(a => a.id === id));
  const removeAnalysis = useMovementStore(s => s.removeAnalysis);
  const updateAnalysis = useMovementStore(s => s.updateAnalysis);

  const [section, setSection] = useState<Section>('overview');
  const [showSkeleton, setShowSkeleton] = useState(true);
  const [showAngleLabels, setShowAngleLabels] = useState(true);
  const [videoBox, setVideoBox] = useState<{ w: number; h: number } | null>(null);
  const [editingReferenceMarkers, setEditingReferenceMarkers] = useState(false);
  const [scrubInteractionActive, setScrubInteractionActive] = useState(false);

  const [fullSequence, setFullSequence] = useState<PoseSequenceResult | null>(null);
  const [sequenceState, setSequenceState] = useState<'idle' | 'loading' | 'loaded' | 'unavailable'>('idle');

  const mediaUri = resolveDocumentUri(analysis?.mediaUri) ?? analysis?.mediaUri;
  const referenceFrameUri = resolveDocumentUri(analysis?.referenceFrameUri);

  const player = useVideoPlayer(analysis?.mediaType === 'video' ? mediaUri ?? null : null, p => {
    p.timeUpdateEventInterval = 0.15;
    p.loop = false;
  });

  const { currentTime } = useEvent(player, 'timeUpdate', {
    currentTime: 0, currentLiveTimestamp: null, currentOffsetFromLive: null, bufferedPosition: 0,
  });
  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: false });

  // Load pose data once for the synchronized video workspace. Inline angle
  // series and key frames remain usable when the file is unavailable.
  useEffect(() => {
    if (sequenceState !== 'idle' || !analysis) return;
    if (!analysis.poseSequenceUri) {
      setSequenceState('unavailable');
      return;
    }
    setSequenceState('loading');
    let cancelled = false;
    loadPoseSequence(analysis.poseSequenceUri).then(result => {
      if (cancelled) return;
      if (result) {
        setFullSequence(result);
        setSequenceState('loaded');
      } else {
        setSequenceState('unavailable');
      }
    });
    return () => { cancelled = true; };
  }, [sequenceState, analysis]);

  if (!analysis) {
    return (
      <View style={[s.root, s.missingWrap, { paddingTop: insets.top + spacing.xl }]}>
        <Text style={s.missingTitle}>Analysis not found</Text>
        <Text style={s.helper}>It may have been deleted.</Text>
        <Pressable style={s.primaryBtn} onPress={() => router.back()}>
          <Text style={s.primaryBtnTxt}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const info = ANALYSIS_KIND_INFO[analysis.type];
  const confidence = analysis.sequenceConfidence ?? analysis.confidence;
  const confidenceMeta = CONFIDENCE_META[confidence];
  const limitations = analysis.sequenceLimitations ?? analysis.limitations;
  const closestSideRequired = requiresClosestSide(analysis.type, analysis.cameraView);
  const processingClosestSide = analysis.closestSide && analysis.captureMetadata?.isMirrored
    ? analysis.closestSide === 'left' ? 'right' : 'left'
    : analysis.closestSide;
  const referenceOverlayConfig = movementOverlayConfiguration(analysis.type, analysis.cameraView, analysis.closestSide);
  const liveOverlayConfig = movementOverlayConfiguration(analysis.type, analysis.cameraView, processingClosestSide);
  const angleSeries = filterAngleSeries(
    analysis.angleSeries ?? [],
    analysis.type,
    analysis.cameraView,
    analysis.closestSide,
  );
  const keyFrames = (analysis.keyFrames ?? [])
    .map(keyFrame => ({
      ...keyFrame,
      angles: keyFrame.angles
        ? filterEstimatedAngles(keyFrame.angles, analysis.type, analysis.cameraView, analysis.closestSide)
        : undefined,
    }))
    .filter(keyFrame => {
      if (!closestSideRequired || !analysis.closestSide) return true;
      const farSide = analysis.closestSide === 'left' ? 'right' : 'left';
      return !keyFrame.label.toLowerCase().includes(`— ${farSide}`);
    });
  const isStrength = STRENGTH_KINDS.includes(analysis.type);
  const editableReferenceLandmarks = referenceOverlayConfig.visibleJoints.filter(name =>
    /_(shoulder|elbow|wrist|hip|knee|ankle)$/.test(name),
  );

  const durationMs = analysis.videoDurationMs && analysis.videoDurationMs > 0
    ? analysis.videoDurationMs
    : Math.round((player.duration || 0) * 1000);
  const currentMs = Math.round((currentTime || 0) * 1000);
  const progress = durationMs > 0 ? currentMs / durationMs : 0;

  function seekToFraction(fraction: number) {
    if (durationMs <= 0) return;
    player.pause();
    player.currentTime = (fraction * durationMs) / 1000;
  }

  function seekToMs(timeMs: number) {
    player.pause();
    player.currentTime = timeMs / 1000;
  }

  function togglePlay() {
    if (isPlaying) player.pause(); else player.play();
  }

  function handleDelete() {
    removeAnalysis(analysis!.id);
    router.back();
  }

  function saveReferenceMarkerCorrections(nextLandmarks: PoseLandmarkRecord[], corrected: boolean) {
    const rawLandmarks = analysis!.captureMetadata?.isMirrored
      ? nextLandmarks.map(landmark => ({
          ...landmark,
          name: landmark.name.replace(/^left_/, '__swap_').replace(/^right_/, 'left_').replace(/^__swap_/, 'right_'),
        }))
      : nextLandmarks;
    const rawAngles = analysis!.cameraView === 'front' || analysis!.cameraView === 'rear'
      ? computeFrontalMetrics(rawLandmarks as never)
      : computeEstimatedAngles(rawLandmarks as never, analysis!.type);
    updateAnalysis(analysis!.id, {
      rawLandmarks,
      landmarks: filterLandmarksForDisplay(nextLandmarks, analysis!.type, analysis!.cameraView, analysis!.closestSide),
      autoLandmarks: analysis!.autoLandmarks ?? analysis!.landmarks,
      correctedLandmarks: corrected ? nextLandmarks : undefined,
      landmarkSource: corrected ? 'user_corrected' : 'auto',
      rawEstimatedAngles: rawAngles,
      estimatedAngles: filterEstimatedAngles(rawAngles, analysis!.type, analysis!.cameraView, analysis!.closestSide),
      measurementConventionVersion: 2,
    });
    setEditingReferenceMarkers(false);
  }

  function changeClosestSide(side: 'left' | 'right') {
    const rawAngles = analysis!.rawEstimatedAngles ?? analysis!.estimatedAngles ?? [];
    const processingSide = analysis!.captureMetadata?.isMirrored
      ? side === 'left' ? 'right' : 'left'
      : side;
    const nextSequence = fullSequence
      ? analyzeSequence(fullSequence, analysis!.type, analysis!.cameraView, processingSide)
      : null;
    const rawSequenceMaterial = fullSequence
      ? buildRawSequenceMaterial(fullSequence, analysis!.type, analysis!.cameraView)
      : null;
    const nextAngles = filterEstimatedAngles(rawAngles, analysis!.type, analysis!.cameraView, processingSide);
    const nextSequenceFields = nextSequence ? {
      angleSeries: nextSequence.angleSeries,
      rawAngleSeries: rawSequenceMaterial?.angleSeries,
      keyFrames: nextSequence.keyFrames,
      rawKeyFrames: rawSequenceMaterial?.keyFrames,
      repSummaries: nextSequence.repSummaries,
      symmetryEstimates: undefined,
      sequenceConfidence: nextSequence.confidence,
      sequenceLimitations: nextSequence.limitations,
      viewFiltersMaterialized: false,
    } : {
      angleSeries: filterAngleSeries(
        analysis!.rawAngleSeries ?? analysis!.angleSeries ?? [],
        analysis!.type,
        analysis!.cameraView,
        processingSide,
      ),
      keyFrames: analysis!.rawKeyFrames
        ?.filter(frame => !frame.label.toLowerCase().includes(`— ${processingSide === 'left' ? 'right' : 'left'}`))
        .map(frame => ({
          ...frame,
          landmarks: filterLandmarksForDisplay(frame.landmarks, analysis!.type, analysis!.cameraView, processingSide),
          angles: frame.angles
            ? filterEstimatedAngles(frame.angles, analysis!.type, analysis!.cameraView, processingSide)
            : undefined,
        })),
      symmetryEstimates: undefined,
      viewFiltersMaterialized: false,
    };
    const materializedSeries = nextSequence?.angleSeries ?? nextSequenceFields.angleSeries ?? [];
    const manualRecommendations = analysis!.recommendations.filter(recommendation =>
      recommendation.finding !== 'Estimated joint-angle ranges over the clip'
      && !recommendation.finding.startsWith('Estimated ')
      && !recommendation.finding.startsWith('Estimated left/right'),
    );
    const autoRecommendations = buildSequenceFindings({
      estimatedAngles: nextAngles,
      angleSeries: nextSequence?.angleSeries,
      keyFrames: nextSequence?.keyFrames,
      repSummaries: nextSequence?.repSummaries,
      symmetryEstimates: undefined,
      sequenceConfidence: nextSequence?.confidence ?? analysis!.sequenceConfidence,
    }, analysis!.type);
    const normalizeSavedSideText = (value: string) => analysis!.captureMetadata?.isMirrored
      ? value.replace(/\bleft\b/gi, '__swap_side__').replace(/\bright\b/gi, 'left').replace(/__swap_side__/g, 'right')
      : value;
    const normalizedAutoRecommendations = autoRecommendations.map(recommendation => ({
      ...recommendation,
      finding: normalizeSavedSideText(recommendation.finding),
      meaning: normalizeSavedSideText(recommendation.meaning),
      recommendation: normalizeSavedSideText(recommendation.recommendation),
    }));

    updateAnalysis(analysis!.id, {
      closestSide: side,
      closestSideSource: 'user',
      estimatedAngles: nextAngles,
      measurementConventionVersion: 2,
      ...nextSequenceFields,
      bikeFitPhases: analysis!.type === 'bike_fit' && nextSequence
        ? {
            topDeadCenterMs: nextSequence.keyFrames.find(frame => frame.label.includes('top pedal phase'))?.timeMs,
            bottomDeadCenterMs: nextSequence.keyFrames.find(frame => frame.label.includes('bottom pedal phase'))?.timeMs,
            source: 'estimated',
          }
        : analysis!.type === 'bike_fit'
          ? estimatedBikeFitPhases(materializedSeries)
          : analysis!.bikeFitPhases,
      recommendations: [...normalizedAutoRecommendations, ...manualRecommendations],
    });
  }

  // ── Overlay data for the current scrub position ────────────────────────────

  const overlayFrame = sequenceState === 'loaded' ? nearestFrame(fullSequence, currentMs) : null;
  const overlayLandmarks: PoseLandmarkRecord[] | undefined = overlayFrame && overlayFrame.joints.length > 0
    ? filterLandmarksForDisplay(
        overlayFrame.joints.map(j => ({ name: j.name, x: j.x, y: j.y, confidence: j.confidence })),
        analysis.type,
        analysis.cameraView,
        processingClosestSide,
      )
    : undefined;
  const rawOverlayAngles = overlayFrame && overlayFrame.joints.length > 0
    ? (analysis.cameraView === 'front' || analysis.cameraView === 'rear'
      ? computeFrontalMetrics(overlayFrame.joints as PoseJoint[])
      : computeEstimatedAngles(overlayFrame.joints as PoseJoint[], analysis.type))
    : undefined;
  const overlayAngles = rawOverlayAngles
    ? filterEstimatedAngles(rawOverlayAngles, analysis.type, analysis.cameraView, processingClosestSide)
    : undefined;
  const mediaAspect = fullSequence
    ? fullSequence.imageWidth / fullSequence.imageHeight
    : analysis.imageAspectRatio ?? 9 / 16;

  const currentReadout = overlayAngles && overlayAngles.length > 0
    ? overlayAngles.map(angle => ({
        label: `${angle.name}${angle.side !== 'center' ? ` — ${angle.side}` : ''}`,
        degrees: angle.degrees,
      }))
    : angleSeries
        .map(series => ({ series, degrees: nearestSeriesDegrees(series, currentMs) }))
        .filter((r): r is { series: AngleSeries; degrees: number } => r.degrees !== null)
        .map(r => ({
          label: `${r.series.name}${r.series.side !== 'center' ? ` — ${r.series.side}` : ''}`,
          degrees: r.degrees,
        }));

  const reps = analysis.repSummaries ?? [];
  const consistency = repConsistency(reps);
  const symmetry = analysis.cameraView === 'side' ? [] : analysis.symmetryEstimates ?? [];

  return (
    <View style={s.root}>
      <ScrollView
        contentContainerStyle={[s.content, { paddingTop: insets.top + spacing.md }]}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!scrubInteractionActive && !editingReferenceMarkers}
      >

        {/* Header */}
        <View style={s.headerRow}>
          <Pressable onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 16, right: 16 }}>
            <Text style={s.back}>‹ Back</Text>
          </Pressable>
        </View>
        <View style={s.titleBlock}>
          <Text style={s.eyebrow}>MOVEMENT LAB · VIDEO ANALYSIS</Text>
          <Text style={s.title}>{info.title}</Text>
        </View>

        {/* Segmented control */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.segScroll} contentContainerStyle={s.segRow}>
          {SECTIONS.map(opt => (
            <Pressable
              key={opt.key}
              style={[s.segPill, section === opt.key && s.segPillOn]}
              onPress={() => setSection(opt.key)}
            >
              <Text style={[s.segPillTxt, section === opt.key && s.segPillOnTxt]}>{opt.label}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* ── Overview ──────────────────────────────────────────────────────── */}
        {section === 'overview' && (
          <>
            <View style={[s.confidenceBanner, { borderColor: confidenceMeta.color + '55', backgroundColor: confidenceMeta.color + '14' }]}>
              <Text style={[s.confidenceTxt, { color: confidenceMeta.color }]}>{confidenceMeta.label}</Text>
            </View>
            <View style={s.card}>
              <Text style={s.cardLabel}>DETAILS</Text>
              <Text style={s.detailLine}>Type: {info.title}</Text>
              <Text style={s.detailLine}>Recorded: {new Date(analysis.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</Text>
              <Text style={s.detailLine}>Camera view: {displayLabel(analysis.cameraView)}</Text>
              {durationMs > 0 ? <Text style={s.detailLine}>Clip length analyzed: {formatTimeMs(analysis.analyzedDurationMs ?? durationMs)}{analysis.videoDurationMs && analysis.analyzedDurationMs && analysis.analyzedDurationMs < analysis.videoDurationMs ? ` of ${formatTimeMs(analysis.videoDurationMs)}` : ''}</Text> : null}
            </View>
            {referenceFrameUri && (analysis.landmarks?.length ?? 0) > 0 ? (
              <View style={s.card}>
                <Text style={s.cardLabel}>{analysis.landmarkSource === 'user_corrected' ? 'USER-CORRECTED REFERENCE MARKERS' : 'REFERENCE FRAME MARKERS'}</Text>
                {editingReferenceMarkers ? (
                  <LandmarkEditor
                    imageUri={referenceFrameUri}
                    aspectRatio={analysis.imageAspectRatio ?? 3 / 4}
                    autoLandmarks={analysis.autoLandmarks ?? analysis.landmarks ?? []}
                    landmarks={analysis.landmarks ?? []}
                    allowedLandmarkNames={editableReferenceLandmarks}
                    visibleConnections={referenceOverlayConfig.visibleConnections}
                    onCancel={() => setEditingReferenceMarkers(false)}
                    onSave={saveReferenceMarkerCorrections}
                  />
                ) : (
                  <>
                    <PoseOverlay
                      imageUri={referenceFrameUri}
                      aspectRatio={analysis.imageAspectRatio ?? 3 / 4}
                      landmarks={analysis.landmarks}
                      angles={filterEstimatedAngles(
                        analysis.estimatedAngles ?? [],
                        analysis.type,
                        analysis.cameraView,
                        analysis.closestSide,
                      )}
                      showSkeleton
                      showAngles
                      connections={referenceOverlayConfig.visibleConnections}
                    />
                    <Text style={s.helper}>
                      {analysis.referenceFrameTimeMs !== undefined ? `Reference frame: ${formatTimeMs(analysis.referenceFrameTimeMs)}. ` : ''}
                      Marker confidence is stored with the saved landmarks.
                    </Text>
                    <Pressable
                      style={s.secondaryActionBtn}
                      onPress={() => {
                        player.pause();
                        setEditingReferenceMarkers(true);
                      }}
                    >
                      <Text style={s.secondaryActionTxt}>Adjust Markers</Text>
                    </Pressable>
                  </>
                )}
              </View>
            ) : null}
            {limitations.length > 0 && (
              <View style={s.card}>
                <Text style={s.cardLabel}>LIMITATIONS</Text>
                {limitations.map((l, i) => <Text key={i} style={s.noteTxt}>•  {l}</Text>)}
              </View>
            )}
          </>
        )}

        {/* ── Synchronized video workspace ─────────────────────────────────── */}
        {(
          <>
            {closestSideRequired && !analysis.closestSide ? (
              <View style={s.card}>
                <Text style={s.cardLabel}>SIDE CLOSEST TO THE CAMERA</Text>
                <Text style={s.helper}>Choose the visible limb before reviewing lateral joint estimates.</Text>
                <View style={s.toggleRow}>
                  {(['left', 'right'] as const).map(side => (
                    <Pressable
                      key={side}
                      style={s.secondaryActionBtn}
                      onPress={() => changeClosestSide(side)}
                    >
                      <Text style={s.secondaryActionTxt}>{side === 'left' ? 'Left side' : 'Right side'}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : closestSideRequired ? (
              <Pressable
                style={s.secondaryActionBtn}
                onPress={() => changeClosestSide(analysis.closestSide === 'left' ? 'right' : 'left')}
              >
                <Text style={s.secondaryActionTxt}>Closest limb: {analysis.closestSide} · Change</Text>
              </Pressable>
            ) : null}
            <View
              style={s.videoWrap}
              onLayout={(e: LayoutChangeEvent) => setVideoBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
            >
              <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="contain" nativeControls={false} />
              {videoBox ? (
                <SkeletonOverlay
                  containerWidth={videoBox.w}
                  containerHeight={videoBox.h}
                  mediaWidth={mediaAspect}
                  mediaHeight={1}
                  landmarks={overlayLandmarks}
                  angles={overlayAngles}
                  showSkeleton={showSkeleton}
                  showAngles={showAngleLabels}
                  connections={liveOverlayConfig.visibleConnections}
                />
              ) : null}
            </View>

            <View style={s.transportRow}>
              <Pressable style={s.playBtn} onPress={togglePlay}>
                <Ionicons name={isPlaying ? 'pause' : 'play'} size={22} color={colors.onPrimary} />
              </Pressable>
              <Text style={s.timeTxt}>{formatTimeMs(currentMs)} / {formatTimeMs(durationMs)}</Text>
            </View>
            <VideoScrubBar
              progress={progress}
              onScrub={seekToFraction}
              onScrubStart={() => setScrubInteractionActive(true)}
              onScrubEnd={fraction => {
                seekToFraction(fraction);
                setScrubInteractionActive(false);
              }}
              onScrubCancel={() => setScrubInteractionActive(false)}
              markers={durationMs > 0 ? keyFrames.map(k => k.timeMs / durationMs) : []}
            />

            <View style={s.toggleRow}>
              <View style={s.toggleItem}>
                <Text style={s.toggleLabel}>Skeleton</Text>
                <Switch
                  value={showSkeleton}
                  onValueChange={setShowSkeleton}
                  trackColor={{ true: colors.primary }}
                  disabled={sequenceState !== 'loaded'}
                />
              </View>
              <View style={s.toggleItem}>
                <Text style={s.toggleLabel}>Angles</Text>
                <Switch
                  value={showAngleLabels}
                  onValueChange={setShowAngleLabels}
                  trackColor={{ true: colors.primary }}
                  disabled={sequenceState !== 'loaded'}
                />
              </View>
            </View>

            {sequenceState === 'loading' ? (
              <Text style={s.helper}>Loading frame-by-frame pose data…</Text>
            ) : sequenceState === 'unavailable' ? (
              <Text style={s.poseMessage}>Skeleton overlay isn't available for this analysis — the saved pose data couldn't be found. The clip and angle charts still work.</Text>
            ) : null}

            {currentReadout.length > 0 ? (
              <View style={s.card}>
                <Text style={s.cardLabel}>CURRENT FRAME</Text>
                {currentReadout.map((r, i) => (
                  <Text key={i} style={s.detailLine}>
                    {r.label}: {Math.round(r.degrees)}° Estimated
                  </Text>
                ))}
              </View>
            ) : null}
          </>
        )}

        {/* ── Angles ────────────────────────────────────────────────────────── */}
        {section === 'angles' && (
          angleSeries.length > 0 ? (
            <>
              {[...new Set(angleSeries.map(item => item.name))].map(name => {
                const lines = angleSeries.filter(item => item.name === name);
                const first = lines[0];
                const second = lines[1];
                return (
                  <AngleChart
                    key={name}
                    title={`${name} · Estimated`}
                    seriesA={{ label: first.side === 'center' ? 'Current' : first.side, color: colors.chartSeriesPrimary, points: first.points }}
                    seriesB={second ? { label: second.side, color: colors.chartSeriesSecondary, points: second.points } : undefined}
                    currentTimeMs={currentMs}
                    onSeekMs={seekToMs}
                    onSeekStart={() => setScrubInteractionActive(true)}
                    onSeekEnd={() => setScrubInteractionActive(false)}
                    onSeekCancel={() => setScrubInteractionActive(false)}
                  />
                );
              })}
              <View style={s.card}>
                <Text style={s.cardLabel}>MIN/MAX RANGES</Text>
                {angleSeries
                  .map(seriesSummary)
                  .filter((summary): summary is string => Boolean(summary))
                  .map((summary, i) => <Text key={i} style={s.detailLine}>{summary}</Text>)}
              </View>
              <Text style={s.smallDisclaimer}>
                Gaps mean the landmarks needed for that angle weren't confidently detected in those frames — never guessed or interpolated.
              </Text>
            </>
          ) : (
            <View style={s.card}>
              <Text style={s.helper}>No angle series were captured for this clip.</Text>
            </View>
          )
        )}

        {/* ── Key Frames ────────────────────────────────────────────────────── */}
        {section === 'keyframes' && (
          keyFrames.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.keyFrameRow}>
              {keyFrames.map(kf => (
                <Pressable key={kf.id} style={s.keyFrameCard} onPress={() => seekToMs(kf.timeMs)}>
                  <Text style={s.keyFrameLabel} numberOfLines={2}>{kf.label}</Text>
                  <Text style={s.keyFrameTime}>{formatTimeMs(kf.timeMs)}</Text>
                  {(kf.angles ?? []).slice(0, 4).map((angle, i) => (
                    <Text key={`${angle.side}-${angle.name}-${i}`} style={s.keyFrameAngle}>
                      {angle.name}{angle.side !== 'center' ? ` ${angle.side}` : ''}: {Math.round(angle.degrees)}° Estimated
                    </Text>
                  ))}
                  <Text style={s.keyFrameTap}>Tap to seek ›</Text>
                </Pressable>
              ))}
            </ScrollView>
          ) : (
            <View style={s.card}>
              <Text style={s.helper}>No key moments were detected for this clip.</Text>
            </View>
          )
        )}

        {/* ── Findings / Recommendations ────────────────────────────────────── */}
        {section === 'findings' && (
          <>
            {isStrength ? (
              reps.length > 0 ? (
                <View style={s.card}>
                  <Text style={s.cardLabel}>REPS DETECTED · {reps.length}</Text>
                  {reps.map(rep => (
                    <View key={rep.index} style={s.repRow}>
                      <Text style={s.repTitle}>Rep {rep.index + 1}</Text>
                      <Text style={s.detailLine}>Depth (peak knee flexion): ~{Math.round(rep.peakFlexionDeg)}°</Text>
                      <Text style={s.detailLine}>Duration: {(rep.durationMs / 1000).toFixed(1)}s</Text>
                      {rep.hipMotionAtBottom ? (
                        <Text style={s.detailLine}>
                          {rep.hipMotionAtBottom.name === 'Hip extension' ? 'Hip Extension' : 'Hip Flexion'} at bottom: ~{Math.round(rep.hipMotionAtBottom.degrees)}° Estimated
                        </Text>
                      ) : null}
                      {rep.trunkAngleAtBottom !== undefined ? <Text style={s.detailLine}>Trunk lean at bottom: ~{Math.round(rep.trunkAngleAtBottom)}°</Text> : null}
                    </View>
                  ))}
                  {consistency !== undefined ? (
                    <Text style={s.helper}>
                      Rep-to-rep depth may vary by about {Math.round(consistency)}° across reps — an estimate from single-camera video, not a lab measurement.
                    </Text>
                  ) : null}
                </View>
              ) : (
                <View style={s.card}>
                  <Text style={s.helper}>
                    No individual reps were confidently detected in this clip. This can happen with partial reps, an
                    unusual camera angle, or lower detection confidence — the Angles tab may still be useful, and a
                    refilm from the side can help.
                  </Text>
                </View>
              )
            ) : analysis.type === 'bike_fit' ? (
              <View style={s.card}>
                <Text style={s.cardLabel}>PEDAL PHASE REVIEW</Text>
                <Text style={s.detailLine}>
                  Top phase: {analysis.bikeFitPhases?.topDeadCenterMs !== undefined
                    ? formatTimeMs(analysis.bikeFitPhases.topDeadCenterMs)
                    : 'Manual confirmation required'}
                </Text>
                <Text style={s.detailLine}>
                  Bottom phase: {analysis.bikeFitPhases?.bottomDeadCenterMs !== undefined
                    ? formatTimeMs(analysis.bikeFitPhases.bottomDeadCenterMs)
                    : 'Manual confirmation required'}
                </Text>
                <Text style={s.helper}>
                  Phase timing is estimated from the visible closest-side knee cycle. Confirm the frames manually before using the angle estimates. This does not replace an in-person bike fit.
                </Text>
              </View>
            ) : analysis.type === 'running_gait' ? (
              symmetry.length > 0 ? (
                symmetry.map((sym, i) => (
                  <View key={i} style={s.card}>
                    <Text style={s.cardLabel}>SYMMETRY ESTIMATE</Text>
                    <Text style={s.detailLine}>{sym.metric} — left ~{Math.round(sym.leftValue)}°, right ~{Math.round(sym.rightValue)}°</Text>
                    <Text style={s.helper}>{sym.note}</Text>
                  </View>
                ))
              ) : (
                <View style={s.card}>
                  <Text style={s.helper}>Not enough confidently-detected frames on both sides to estimate left/right symmetry for this clip.</Text>
                </View>
              )
            ) : analysis.recommendations.length === 0 ? (
              <View style={s.card}>
                <Text style={s.helper}>No automated findings for this clip — review the Angles and Video tabs directly.</Text>
              </View>
            ) : null}
            {analysis.recommendations.length > 0 ? (
              <View style={s.card}>
                <Text style={s.cardLabel}>WHAT THIS MEANS</Text>
                {analysis.recommendations.map((r, i) => (
                  <View key={i} style={s.recBlock}>
                    <Text style={s.recFinding}>{r.finding}</Text>
                    {r.confidence ? <Text style={s.helper}>Confidence: {r.confidence}</Text> : null}
                    {r.meaning ? <Text style={s.recMeaning}>{r.meaning}</Text> : null}
                    {r.recommendation ? <Text style={s.recAction}>{r.recommendation}</Text> : null}
                  </View>
                ))}
              </View>
            ) : null}
          </>
        )}

        {/* Coach handoff */}
        <Pressable
          style={s.primaryBtn}
          onPress={() => router.push({
            pathname: '/(tabs)/coach',
            params: { ask: 'Review this Movement Lab analysis.', analysisId: analysis.id },
          } as never)}
        >
          <Text style={s.primaryBtnTxt}>Discuss with AI Coach</Text>
        </Pressable>

        {/* Delete */}
        <Pressable style={s.deleteBtn} onPress={handleDelete}>
          <Text style={s.deleteBtnTxt}>Delete Analysis</Text>
        </Pressable>

        <Text style={s.smallDisclaimer}>{VIDEO_ESTIMATE_DISCLAIMER}</Text>
      </ScrollView>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: 120, gap: spacing.md },
  missingWrap:  { alignItems: 'center', gap: spacing.md, padding: spacing.lg },
  missingTitle: { color: colors.text, fontSize: FontSize.lg, fontWeight: FontWeight.bold },
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
  segScroll: { flexGrow: 0 },
  segRow:    { flexDirection: 'row', gap: spacing.xs, paddingVertical: 2 },
  segPill: {
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.xs,
    borderRadius:      20,
    backgroundColor:   colors.border,
  },
  segPillOn: {
    backgroundColor: colors.primaryDim,
    borderWidth:     1,
    borderColor:     colors.primary,
  },
  segPillTxt:   { color: colors.textDim, fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  segPillOnTxt: { color: colors.primary },
  confidenceBanner: {
    borderRadius: 12,
    borderWidth:  1,
    padding:      spacing.md,
    gap:          spacing.xs,
  },
  confidenceTxt: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  card: {
    backgroundColor: colors.card,
    borderRadius:    12,
    padding:         spacing.md,
    borderWidth:     1,
    borderColor:     colors.border,
    gap:             spacing.sm,
  },
  cardLabel: {
    color:         colors.textMuted,
    fontSize:      10,
    fontWeight:    FontWeight.black,
    letterSpacing: 0.6,
  },
  detailLine: { color: colors.text, fontSize: FontSize.sm },
  helper:     { color: colors.textMuted, fontSize: FontSize.xs, lineHeight: 17 },
  noteTxt:    { color: colors.textMuted, fontSize: FontSize.xs, lineHeight: 17 },
  poseMessage: { color: colors.warning, fontSize: FontSize.xs, lineHeight: 17 },
  videoWrap: {
    width:           '100%',
    height:          260,
    borderRadius:    Radius.md,
    backgroundColor: '#000',
    overflow:        'hidden',
  },
  transportRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.xs },
  playBtn: {
    width:           40,
    height:          40,
    borderRadius:    20,
    backgroundColor: colors.primary,
    alignItems:      'center',
    justifyContent:  'center',
  },
  timeTxt: { color: colors.textMuted, fontSize: FontSize.xs },
  toggleRow:  { flexDirection: 'row', gap: spacing.lg },
  toggleItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  toggleLabel: { color: colors.textMuted, fontSize: FontSize.sm },
  keyFrameRow: { flexDirection: 'row', gap: spacing.sm, paddingRight: spacing.lg },
  keyFrameCard: {
    width:           160,
    backgroundColor: colors.card,
    borderRadius:    12,
    padding:         spacing.md,
    borderWidth:     1,
    borderColor:     colors.border,
    gap:             4,
  },
  keyFrameLabel: { color: colors.text, fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  keyFrameTime:  { color: colors.textMuted, fontSize: FontSize.xs },
  keyFrameAngle: { color: colors.textMuted, fontSize: 10, lineHeight: 14 },
  keyFrameTap:   { color: colors.primary, fontSize: FontSize.xs, marginTop: 2 },
  repRow:    { gap: 2, paddingVertical: spacing.xs, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  repTitle:  { color: colors.text, fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  recBlock:   { gap: spacing.xs, paddingVertical: spacing.xs, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  recFinding: { color: colors.text, fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  recMeaning: { color: colors.textMuted, fontSize: FontSize.xs, lineHeight: 17 },
  recAction:  { color: colors.primary, fontSize: FontSize.xs, lineHeight: 17 },
  secondaryActionBtn: {
    alignSelf:         'flex-start',
    backgroundColor:   colors.border,
    borderRadius:      Radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.xs,
  },
  secondaryActionTxt: { color: colors.textMuted, fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius:    Radius.sm,
    paddingVertical: spacing.md,
    alignItems:      'center',
  },
  primaryBtnTxt: { color: colors.onPrimary, fontSize: FontSize.base, fontWeight: FontWeight.bold },
  deleteBtn: {
    borderRadius:    Radius.sm,
    borderWidth:     1,
    borderColor:     colors.critical + '66',
    paddingVertical: spacing.md,
    alignItems:      'center',
  },
  deleteBtnTxt:    { color: colors.critical, fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  smallDisclaimer: { color: colors.textSubtle, fontSize: FontSize.xs, lineHeight: 16 },
});
