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
import { computeEstimatedAngles } from '../../../src/utils/poseAngles';
import { repConsistency } from '../../../src/utils/poseSequence';
import { ANALYSIS_KIND_INFO } from '../../../src/utils/movementEngine';
import SkeletonOverlay from '../../../src/components/movement/SkeletonOverlay';
import PoseOverlay from '../../../src/components/assessment/PoseOverlay';
import LandmarkEditor from '../../../src/components/movement/LandmarkEditor';
import AngleChart from '../../../src/components/movement/AngleChart';
import VideoScrubBar from '../../../src/components/movement/VideoScrubBar';
import { colors } from '../../../src/theme/colors';
import { spacing } from '../../../src/theme/spacing';
import { FontSize, FontWeight, Radius } from '../../../src/theme/tokens';
import type {
  AngleSeries,
  AnalysisConfidence,
  MovementAnalysisKind,
  PoseLandmarkRecord,
} from '../../../src/types/movement';

// ─── Constants ────────────────────────────────────────────────────────────────

const VIDEO_ESTIMATE_DISCLAIMER =
  'Angles and scores are estimates based on camera view and landmark detection. They are not exact clinical measurements.';

const STRENGTH_KINDS: MovementAnalysisKind[] = ['squat', 'deadlift', 'lunge_single_leg'];

type Section = 'overview' | 'video' | 'angles' | 'keyframes' | 'findings';

const SECTIONS: { key: Section; label: string }[] = [
  { key: 'overview',  label: 'Overview' },
  { key: 'video',     label: 'Video' },
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

  // Lazy-load the full per-frame pose file only once the Video tab is opened —
  // angle series / key frames (inline on the analysis) work without it.
  useEffect(() => {
    if (section !== 'video' || sequenceState !== 'idle' || !analysis) return;
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
  }, [section, sequenceState, analysis]);

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
  const angleSeries = analysis.angleSeries ?? [];
  const keyFrames = analysis.keyFrames ?? [];
  const isStrength = STRENGTH_KINDS.includes(analysis.type);

  const durationMs = analysis.videoDurationMs && analysis.videoDurationMs > 0
    ? analysis.videoDurationMs
    : Math.round((player.duration || 0) * 1000);
  const currentMs = Math.round((currentTime || 0) * 1000);
  const progress = durationMs > 0 ? currentMs / durationMs : 0;

  function seekToFraction(fraction: number) {
    if (durationMs <= 0) return;
    player.currentTime = (fraction * durationMs) / 1000;
  }

  function seekToMs(timeMs: number) {
    player.pause();
    player.currentTime = timeMs / 1000;
    setSection('video');
  }

  function togglePlay() {
    if (isPlaying) player.pause(); else player.play();
  }

  function handleDelete() {
    removeAnalysis(analysis!.id);
    router.back();
  }

  function saveReferenceMarkerCorrections(nextLandmarks: PoseLandmarkRecord[], corrected: boolean) {
    updateAnalysis(analysis!.id, {
      landmarks: nextLandmarks,
      autoLandmarks: analysis!.autoLandmarks ?? analysis!.landmarks,
      correctedLandmarks: corrected ? nextLandmarks : undefined,
      landmarkSource: corrected ? 'user_corrected' : 'auto',
      estimatedAngles: computeEstimatedAngles(nextLandmarks as never, analysis!.type),
    });
    setEditingReferenceMarkers(false);
  }

  // ── Overlay data for the current scrub position ────────────────────────────

  const overlayFrame = sequenceState === 'loaded' ? nearestFrame(fullSequence, currentMs) : null;
  const overlayLandmarks: PoseLandmarkRecord[] | undefined = overlayFrame && overlayFrame.joints.length > 0
    ? overlayFrame.joints.map(j => ({ name: j.name, x: j.x, y: j.y, confidence: j.confidence }))
    : undefined;
  const overlayAngles = overlayFrame && overlayFrame.joints.length > 0
    ? computeEstimatedAngles(overlayFrame.joints as PoseJoint[], analysis.type)
    : undefined;
  const mediaAspect = fullSequence
    ? fullSequence.imageWidth / fullSequence.imageHeight
    : analysis.imageAspectRatio ?? 9 / 16;

  const currentReadout = overlayAngles && overlayAngles.length > 0
    ? overlayAngles.map(angle => ({
        label: `${angle.name}${angle.side !== 'center' ? ` — ${angle.side}` : ''}`,
        degrees: angle.degrees,
        source: 'current frame',
      }))
    : angleSeries
        .map(series => ({ series, degrees: nearestSeriesDegrees(series, currentMs) }))
        .filter((r): r is { series: AngleSeries; degrees: number } => r.degrees !== null)
        .map(r => ({
          label: `${r.series.name}${r.series.side !== 'center' ? ` — ${r.series.side}` : ''}`,
          degrees: r.degrees,
          source: 'smoothed series',
        }));

  const reps = analysis.repSummaries ?? [];
  const consistency = repConsistency(reps);
  const symmetry = analysis.symmetryEstimates ?? [];

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
              <Text style={s.detailLine}>Camera view: {analysis.cameraView.replace('_', ' ')}</Text>
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
                    onCancel={() => setEditingReferenceMarkers(false)}
                    onSave={saveReferenceMarkerCorrections}
                  />
                ) : (
                  <>
                    <PoseOverlay
                      imageUri={referenceFrameUri}
                      aspectRatio={analysis.imageAspectRatio ?? 3 / 4}
                      landmarks={analysis.landmarks}
                      angles={analysis.estimatedAngles}
                      showSkeleton
                      showAngles
                    />
                    <Text style={s.helper}>
                      {analysis.referenceFrameTimeMs !== undefined ? `Reference frame: ${formatTimeMs(analysis.referenceFrameTimeMs)}. ` : ''}
                      Marker confidence is stored with the saved landmarks.
                    </Text>
                    <Pressable style={s.secondaryActionBtn} onPress={() => setEditingReferenceMarkers(true)}>
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

        {/* ── Video ─────────────────────────────────────────────────────────── */}
        {section === 'video' && (
          <>
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
              onScrubEnd={seekToFraction}
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
                    {r.label}: {Math.round(r.degrees)}° Estimated ({r.source})
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
              <AngleChart
                title="Knee flexion"
                seriesA={{ label: 'Left', color: colors.chartSeriesPrimary, points: seriesFor(angleSeries, 'Knee flexion', 'left').points }}
                seriesB={{ label: 'Right', color: colors.chartSeriesSecondary, points: seriesFor(angleSeries, 'Knee flexion', 'right').points }}
              />
              <AngleChart
                title="Hip angle"
                seriesA={{ label: 'Left', color: colors.chartSeriesPrimary, points: seriesFor(angleSeries, 'Hip angle', 'left').points }}
                seriesB={{ label: 'Right', color: colors.chartSeriesSecondary, points: seriesFor(angleSeries, 'Hip angle', 'right').points }}
              />
              <AngleChart
                title="Trunk lean"
                seriesA={{ label: 'Trunk', color: colors.chartSeriesPrimary, points: seriesFor(angleSeries, 'Trunk lean', 'center').points }}
                note="Deviation of the shoulder–hip line from vertical."
              />
              <AngleChart
                title="Shoulder angle"
                seriesA={{ label: 'Left', color: colors.chartSeriesPrimary, points: seriesFor(angleSeries, 'Shoulder angle', 'left').points }}
                seriesB={{ label: 'Right', color: colors.chartSeriesSecondary, points: seriesFor(angleSeries, 'Shoulder angle', 'right').points }}
              />
              <AngleChart
                title="Elbow angle"
                seriesA={{ label: 'Left', color: colors.chartSeriesPrimary, points: seriesFor(angleSeries, 'Elbow angle', 'left').points }}
                seriesB={{ label: 'Right', color: colors.chartSeriesSecondary, points: seriesFor(angleSeries, 'Elbow angle', 'right').points }}
              />
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
                      {rep.hipAngleAtBottom !== undefined ? <Text style={s.detailLine}>Hip angle at bottom: ~{Math.round(rep.hipAngleAtBottom)}°</Text> : null}
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
        <Pressable style={s.primaryBtn} onPress={() => router.push('/(tabs)/coach')}>
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
