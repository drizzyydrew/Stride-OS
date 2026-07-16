// ─── Movement Lab — Analysis Detail ───────────────────────────────────────────
//
// Read-only view of a saved MovementAnalysis: analyzed still with the skeleton
// overlay, estimated angles, checklist findings, and the Observation →
// Interpretation → Recommendation report. Recent analyses are also fed into
// the AI Coach system prompt, so "Discuss with AI Coach" opens a coach that
// already knows about this analysis.

import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState } from 'react';
import { VideoView, useVideoPlayer } from 'expo-video';

import { useMovementStore } from '../../../src/store/movementStore';
import { resolveDocumentUri } from '../../../src/lib/mediaPaths';
import { deleteAnalysisMediaIfStored } from '../../../src/lib/movementVideoStorage';
import {
  ANALYSIS_KIND_INFO,
  ANGLE_ESTIMATE_DISCLAIMER,
  MOVEMENT_SAFETY_DISCLAIMER,
} from '../../../src/utils/movementEngine';
import { computeEstimatedAngles, computeFrontalMetrics } from '../../../src/utils/poseAngles';
import {
  filterEstimatedAngles,
  filterLandmarksForDisplay,
  movementOverlayConfiguration,
} from '../../../src/utils/measurementMatrix';
import PoseOverlay from '../../../src/components/assessment/PoseOverlay';
import LandmarkEditor from '../../../src/components/movement/LandmarkEditor';
import { colors }  from '../../../src/theme/colors';
import { spacing } from '../../../src/theme/spacing';
import { FontSize, FontWeight, Radius } from '../../../src/theme/tokens';
import type { AnalysisConfidence, FindingSeverity, PoseLandmarkRecord } from '../../../src/types/movement';

// ─── Constants ────────────────────────────────────────────────────────────────

const CONFIDENCE_META: Record<AnalysisConfidence, { label: string; color: string }> = {
  high:          { label: 'High confidence',            color: colors.positive },
  moderate:      { label: 'Moderate confidence',        color: colors.warning },
  low:           { label: 'Low confidence',             color: colors.critical },
  manual_review: { label: 'Manual review recommended',  color: colors.textMuted },
};

const SEVERITY_META: Record<FindingSeverity, { label: string; color: string }> = {
  low:      { label: 'Mild',     color: colors.warning },
  moderate: { label: 'Moderate', color: colors.warning },
  high:     { label: 'Severe',   color: colors.critical },
};

const CAMERA_VIEW_LABELS: Record<string, string> = {
  side:      'Side view',
  front:     'Front view',
  rear:      'Rear view',
  unknown:   'View not specified',
};

// Legacy records may persist an angled capture view; render it with a plain
// label rather than the retired capture wording.
function cameraViewLabel(view: string): string {
  return CAMERA_VIEW_LABELS[view] ?? 'Angled view';
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function AnalysisDetailScreen() {
  const insets = useSafeAreaInsets();
  const { analysisId } = useLocalSearchParams<{ analysisId?: string }>();
  const analysis = useMovementStore(s => s.analyses.find(a => a.id === analysisId));
  const removeAnalysis = useMovementStore(s => s.removeAnalysis);
  const updateAnalysis = useMovementStore(s => s.updateAnalysis);

  const [showSkeleton, setShowSkeleton] = useState(true);
  const [showAngles,   setShowAngles]   = useState(true);
  const [editingMarkers, setEditingMarkers] = useState(false);

  const mediaUri = resolveDocumentUri(analysis?.mediaUri) ?? analysis?.mediaUri;
  const referenceFrameUri = resolveDocumentUri(analysis?.referenceFrameUri) ?? mediaUri;
  const videoPlayer = useVideoPlayer(analysis?.mediaType === 'video' ? mediaUri ?? null : null);

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
  const confidenceMeta = CONFIDENCE_META[analysis.confidence];
  const hasPose = (analysis.landmarks?.length ?? 0) > 0;
  const angles = analysis.estimatedAngles ?? [];
  const overlayConfig = movementOverlayConfiguration(analysis.type, analysis.cameraView, analysis.closestSide);
  const aspectRatio = analysis.imageAspectRatio ?? 3 / 4;
  const overlayUri = referenceFrameUri ?? mediaUri ?? analysis.mediaUri;

  function saveLandmarkCorrections(nextLandmarks: PoseLandmarkRecord[], corrected: boolean) {
    const rawLandmarks = analysis!.captureMetadata?.isMirrored
      ? nextLandmarks.map(landmark => ({
          ...landmark,
          name: landmark.name.replace(/^left_/, '__swap_').replace(/^right_/, 'left_').replace(/^__swap_/, 'right_'),
        }))
      : nextLandmarks;
    const rawAngles = analysis!.cameraView === 'front' || analysis!.cameraView === 'rear'
      ? computeFrontalMetrics(rawLandmarks as never)
      : computeEstimatedAngles(rawLandmarks as never, analysis!.type);
    const displayLandmarks = filterLandmarksForDisplay(
      nextLandmarks,
      analysis!.type,
      analysis!.cameraView,
      analysis!.closestSide,
    );
    updateAnalysis(analysis!.id, {
      rawLandmarks,
      displayLandmarks,
      landmarks: displayLandmarks,
      autoLandmarks: analysis!.autoLandmarks ?? analysis!.landmarks,
      correctedLandmarks: corrected ? nextLandmarks : undefined,
      landmarkSource: corrected ? 'user_corrected' : 'auto',
      rawEstimatedAngles: rawAngles,
      estimatedAngles: filterEstimatedAngles(rawAngles, analysis!.type, analysis!.cameraView, analysis!.closestSide),
    });
    setEditingMarkers(false);
  }

  function handleDelete() {
    Alert.alert('Delete analysis?', 'This removes the analysis record. The photo or video stays in your library.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void deleteAnalysisMediaIfStored(analysis!.mediaUri);
          removeAnalysis(analysis!.id);
          router.back();
        },
      },
    ]);
  }

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
          <Text style={s.eyebrow}>MOVEMENT LAB · ANALYSIS</Text>
          <Text style={s.title}>{info.title}</Text>
          <Text style={s.subTitle}>
            {formatDate(analysis.createdAt)} · {cameraViewLabel(analysis.cameraView)}
          </Text>
        </View>

        {/* Confidence */}
        <View style={[s.confidenceBanner, { borderColor: confidenceMeta.color + '55', backgroundColor: confidenceMeta.color + '14' }]}>
          <Text style={[s.confidenceTxt, { color: confidenceMeta.color }]}>{confidenceMeta.label}</Text>
          {analysis.status === 'needs_review' ? (
            <Text style={s.helper}>Pose detection was limited — findings below rely on the manual checklist.</Text>
          ) : null}
        </View>

        {/* Media with overlay */}
        <View style={s.card}>
          <Text style={s.cardLabel}>{hasPose ? 'DETECTED POSE' : 'ANALYZED MEDIA'}</Text>
          {hasPose ? (
            <>
              {editingMarkers ? (
                <LandmarkEditor
                  imageUri={overlayUri}
                  aspectRatio={aspectRatio}
                  autoLandmarks={analysis.autoLandmarks ?? analysis.landmarks ?? []}
                  landmarks={analysis.landmarks ?? []}
                  allowedLandmarkNames={overlayConfig.visibleJoints.filter(name =>
                    /_(shoulder|elbow|wrist|hip|knee|ankle)$/.test(name),
                  )}
                  visibleConnections={overlayConfig.visibleConnections}
                  onCancel={() => setEditingMarkers(false)}
                  onSave={saveLandmarkCorrections}
                />
              ) : (
                <>
                  <PoseOverlay
                    imageUri={overlayUri}
                    aspectRatio={aspectRatio}
                    landmarks={analysis.landmarks}
                    angles={angles}
                    showSkeleton={showSkeleton}
                    showAngles={showAngles}
                    connections={overlayConfig.visibleConnections}
                  />
                  <View style={s.toggleRow}>
                    <View style={s.toggleItem}>
                      <Text style={s.toggleLabel}>Skeleton</Text>
                      <Switch value={showSkeleton} onValueChange={setShowSkeleton} trackColor={{ true: colors.primary }} />
                    </View>
                    <View style={s.toggleItem}>
                      <Text style={s.toggleLabel}>Angles</Text>
                      <Switch value={showAngles} onValueChange={setShowAngles} trackColor={{ true: colors.primary }} />
                    </View>
                  </View>
                  <Pressable style={s.secondaryActionBtn} onPress={() => setEditingMarkers(true)}>
                    <Text style={s.secondaryActionTxt}>Adjust Markers</Text>
                  </Pressable>
                </>
              )}
            </>
          ) : analysis.mediaType === 'video' ? (
            <>
              <VideoView player={videoPlayer} style={s.video} contentFit="contain" nativeControls />
              <Text style={s.helper}>Assessed manually from video — no frame was extracted for pose detection.</Text>
            </>
          ) : (
            <>
              <Image source={{ uri: overlayUri }} style={[s.photo, { aspectRatio }]} resizeMode="cover" />
              <Text style={s.helper}>No pose landmarks on this analysis — assessed manually.</Text>
            </>
          )}
        </View>

        {/* Estimated angles */}
        {angles.length > 0 ? (
          <View style={s.card}>
            <Text style={s.cardLabel}>ESTIMATED ANGLES</Text>
            {angles.map((a, i) => (
              <View key={`${a.side}-${a.name}-${i}`} style={s.angleRow}>
                <View style={s.angleTopRow}>
                  <Text style={s.angleName}>
                    {a.name}{a.side !== 'center' ? ` — ${a.side}` : ''}
                  </Text>
                  <Text style={s.angleDeg}>{Math.round(a.degrees)}°</Text>
                </View>
                {a.note ? <Text style={s.noteTxt}>{a.note}</Text> : null}
              </View>
            ))}
            <Text style={s.smallDisclaimer}>{ANGLE_ESTIMATE_DISCLAIMER}</Text>
          </View>
        ) : null}

        {/* Checklist findings */}
        {analysis.checklistFindings.length > 0 ? (
          <View style={s.card}>
            <Text style={s.cardLabel}>CHECKLIST FINDINGS</Text>
            {analysis.checklistFindings.map(f => {
              const sev = f.severity ? SEVERITY_META[f.severity] : null;
              return (
                <View key={f.itemId} style={s.findingRow}>
                  <Text style={s.findingLabel}>{f.label}</Text>
                  <View style={s.findingValueRow}>
                    <Text style={s.findingValue}>{f.value}</Text>
                    {sev ? (
                      <View style={[s.chip, { backgroundColor: sev.color + '22' }]}>
                        <Text style={[s.chipTxt, { color: sev.color }]}>{sev.label}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>
        ) : null}

        {/* Report: Observation → Interpretation → Recommendation */}
        {analysis.recommendations.length > 0 ? (
          <View style={s.card}>
            <Text style={s.cardLabel}>WHAT THIS MEANS</Text>
            {analysis.recommendations.map((r, i) => (
              <View key={i} style={s.recBlock}>
                <Text style={s.recFinding}>{r.finding}</Text>
                {r.meaning ? <Text style={s.recMeaning}>{r.meaning}</Text> : null}
                {r.recommendation ? <Text style={s.recAction}>{r.recommendation}</Text> : null}
              </View>
            ))}
          </View>
        ) : null}

        {/* Notes */}
        {analysis.notes ? (
          <View style={s.card}>
            <Text style={s.cardLabel}>NOTES</Text>
            <Text style={s.noteTxt}>{analysis.notes}</Text>
          </View>
        ) : null}

        {/* Limitations */}
        {analysis.limitations.length > 0 ? (
          <View style={s.card}>
            <Text style={s.cardLabel}>LIMITATIONS</Text>
            {analysis.limitations.map((l, i) => (
              <Text key={i} style={s.noteTxt}>•  {l}</Text>
            ))}
          </View>
        ) : null}

        {/* Coach handoff */}
        <Pressable
          style={s.primaryBtn}
          onPress={() => router.push({
            pathname: '/(tabs)/coach',
            params: {
              ask: `Review this ${info.title} analysis. Explain the most important findings, what they may mean for my training, and the 2–3 most useful next steps.`,
              analysisId: analysis.id,
            },
          })}
        >
          <Text style={s.primaryBtnTxt}>Discuss with AI Coach</Text>
        </Pressable>
        <Text style={s.helper}>
          Your recent Movement Lab analyses are shared with the AI Coach automatically — ask about this one directly.
        </Text>

        {/* Delete */}
        <Pressable style={s.deleteBtn} onPress={handleDelete}>
          <Text style={s.deleteBtnTxt}>Delete Analysis</Text>
        </Pressable>

        <Text style={s.smallDisclaimer}>{MOVEMENT_SAFETY_DISCLAIMER}</Text>
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
  title:    { color: colors.text, fontSize: 22, fontWeight: FontWeight.black },
  subTitle: { color: colors.textMuted, fontSize: FontSize.xs },
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
  helper: { color: colors.textMuted, fontSize: FontSize.xs, lineHeight: 17 },
  photo: {
    width:           '100%',
    borderRadius:    Radius.md,
    backgroundColor: '#000',
  },
  video: {
    width:           '100%',
    height:          220,
    borderRadius:    Radius.md,
    backgroundColor: '#000',
    overflow:        'hidden',
  },
  toggleRow:   { flexDirection: 'row', gap: spacing.lg },
  toggleItem:  { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  toggleLabel: { color: colors.textMuted, fontSize: FontSize.sm },
  secondaryActionBtn: {
    alignSelf:         'flex-start',
    backgroundColor:   colors.border,
    borderRadius:      Radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.xs,
  },
  secondaryActionTxt: { color: colors.textMuted, fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  angleRow:    { gap: 2, paddingVertical: spacing.xs, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  angleTopRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  angleName:   { color: colors.text, fontSize: FontSize.sm, flex: 1, textTransform: 'capitalize' },
  angleDeg:    { color: colors.text, fontSize: FontSize.base, fontWeight: FontWeight.black },
  findingRow:      { gap: 2, paddingVertical: spacing.xs, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  findingLabel:    { color: colors.textMuted, fontSize: FontSize.xs },
  findingValueRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  findingValue:    { color: colors.text, fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  chip:    { borderRadius: Radius.sm, paddingHorizontal: 6, paddingVertical: 2 },
  chipTxt: { fontSize: 10, fontWeight: FontWeight.black },
  recBlock:   { gap: spacing.xs, paddingVertical: spacing.xs, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  recFinding: { color: colors.text, fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  recMeaning: { color: colors.textMuted, fontSize: FontSize.xs, lineHeight: 17 },
  recAction:  { color: colors.primary, fontSize: FontSize.xs, lineHeight: 17 },
  noteTxt: { color: colors.textMuted, fontSize: FontSize.xs, lineHeight: 17 },
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
