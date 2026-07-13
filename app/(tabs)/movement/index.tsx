// ─── Movement Lab ─────────────────────────────────────────────────────────────
//
// Manual-first movement analysis. Users select a video from their camera roll,
// which uploads to Supabase Storage (private, per-user). Analysis observations
// are entered manually. Future AI hook: pose estimation (MediaPipe, MoveNet).

import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';

import { useMovementStore } from '../../../src/store/movementStore';
import { useAuthStore }     from '../../../src/store/authStore';
import { copyVideoToMovementStorage, uploadMovementVideo } from '../../../src/lib/movementVideoStorage';
import { ANALYSIS_KIND_INFO } from '../../../src/utils/movementEngine';
import { normalizeAnalysisKind } from '../../../src/utils/measurementMatrix';
import { dionImagesForKind } from '../../../src/constants/dionImages';
import DionInstructionCard from '../../../src/components/movement/DionInstructionCard';
import { colors }  from '../../../src/theme/colors';
import { spacing } from '../../../src/theme/spacing';
import { FontSize, FontWeight, Radius } from '../../../src/theme/tokens';
import type {
  AnalysisConfidence,
  MovementAnalysis,
  MovementAnalysisKind,
  MovementAnalysisType,
  MovementActivity,
  MovementViewAngle,
} from '../../../src/types/movement';
import type { ReadinessCategory } from '../../../src/types/movementReadiness';

// Default capture view per kind — used only to pick the right Dion thumbnail
// for the home-screen cards. Actual capture view is chosen on the analyze screen.
const KIND_DEFAULT_VIEW: Record<Exclude<MovementAnalysisKind, 'lunge_single_leg'>, MovementViewAngle> = {
  running_gait:        'side',
  squat:                'side',
  deadlift:             'side',
  single_leg_control:   'front',
  lunge:                'side',
  general:              'unknown',
};

// ─── Types ───────────────────────────────────────────────────────────────────

type AddVideoForm = {
  title:        string;
  date:         string;
  analysisType: MovementAnalysisType;
  activity:     MovementActivity;
  view:         MovementViewAngle;
  notes:        string;
  localUri?:    string;
  fileName?:    string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const ANALYSIS_TYPES: { key: MovementAnalysisType; label: string }[] = [
  { key: 'running_gait',      label: 'Running Gait' },
  { key: 'lifting_mechanics', label: 'Lifting'       },
  { key: 'mobility',          label: 'Mobility'      },
  { key: 'other',             label: 'Other'         },
];

const ACTIVITIES: { key: MovementActivity; label: string }[] = [
  { key: 'running',    label: 'Running'   },
  { key: 'walking',    label: 'Walking'   },
  { key: 'squat',      label: 'Squat'     },
  { key: 'deadlift',   label: 'Deadlift'  },
  { key: 'lunge',      label: 'Lunge'     },
  { key: 'step_down',  label: 'Step Down' },
  { key: 'jump',       label: 'Jump'      },
  { key: 'other',      label: 'Other'     },
];

const VIEW_ANGLES: { key: MovementViewAngle; label: string }[] = [
  { key: 'side',      label: 'Side'    },
  { key: 'front',     label: 'Front'   },
  { key: 'rear',      label: 'Rear'    },
  { key: 'unknown',   label: 'Unknown' },
];

const ACTIVITY_LABELS: Record<MovementActivity, string> = {
  running:    'Running',
  walking:    'Walking',
  squat:      'Squat',
  deadlift:   'Deadlift',
  lunge:      'Lunge',
  step_down:  'Step Down',
  jump:       'Jump',
  press:      'Press',
  pull:       'Pull',
  calf_raise: 'Calf Raise',
  other:      'Other',
};

const TYPE_LABELS: Record<MovementAnalysisType, string> = {
  running_gait:      'Running Gait',
  lifting_mechanics: 'Lifting',
  mobility:          'Mobility',
  other:             'Other',
};

// Build 36 taxonomy — six standalone analyses, order matches the Movement
// Lab home cards. Categories come from ANALYSIS_KIND_INFO (Agent A).
const ANALYSIS_KINDS: Exclude<MovementAnalysisKind, 'lunge_single_leg'>[] = [
  'running_gait',
  'squat',
  'deadlift',
  'single_leg_control',
  'lunge',
  'general',
];

const CONFIDENCE_META: Record<AnalysisConfidence, { label: string; color: string }> = {
  high:          { label: 'High',          color: colors.positive },
  moderate:      { label: 'Moderate',      color: colors.warning },
  low:           { label: 'Low',           color: colors.critical },
  manual_review: { label: 'Manual review', color: colors.textMuted },
};

const READINESS_CATEGORY_META: Record<ReadinessCategory, { label: string; color: string }> = {
  good:            { label: 'Good',                    color: colors.positive },
  monitor:         { label: 'Monitor',                 color: colors.warning },
  needs_attention: { label: 'Needs attention',          color: colors.critical },
  manual_review:   { label: 'Manual review',            color: colors.textMuted },
};

// ─── Readiness entry card ─────────────────────────────────────────────────────

function ReadinessEntryCard() {
  const readinessAssessments = useMovementStore(s => s.readinessAssessments);
  const latest = readinessAssessments.length
    ? [...readinessAssessments].sort((a, b) => b.createdAt - a.createdAt)[0]
    : undefined;

  return (
    <Pressable style={vc.card} onPress={() => router.push('/(tabs)/movement/readiness' as never)}>
      <View style={vc.iconBox}>
        <Ionicons name="body" size={22} color={colors.primary} />
      </View>
      <View style={vc.info}>
        <Text style={vc.title}>Running/Walking Readiness</Text>
        <Text style={vc.sub}>Ankle, hip, squat, and control checks built for gait and training readiness</Text>
      </View>
      {latest && (
        <View style={[vc.confChip, { backgroundColor: READINESS_CATEGORY_META[latest.overall].color + '22' }]}>
          <Text style={[vc.confChipTxt, { color: READINESS_CATEGORY_META[latest.overall].color }]}>
            {READINESS_CATEGORY_META[latest.overall].label}
          </Text>
        </View>
      )}
      <Text style={vc.chevron}>›</Text>
    </Pressable>
  );
}


// ─── Add Video Modal ──────────────────────────────────────────────────────────

function AddVideoModal({
  visible,
  onClose,
  onAdd,
  uploading,
}: {
  visible:   boolean;
  onClose:   () => void;
  onAdd:     (form: AddVideoForm) => void;
  uploading: boolean;
}) {
  const today = new Date().toISOString().split('T')[0];
  const [form, setForm] = useState<AddVideoForm>({
    title:        '',
    date:         today,
    analysisType: 'running_gait',
    activity:     'running',
    view:         'side',
    notes:        '',
  });

  function patch<K extends keyof AddVideoForm>(key: K, val: AddVideoForm[K]) {
    setForm(prev => ({ ...prev, [key]: val }));
  }

  async function handlePickVideo() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'StrideOS needs access to your photo library to select a video.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      allowsEditing: false,
      quality: 1,
    });

    if (!result.canceled && result.assets.length > 0) {
      const asset = result.assets[0];
      const ext      = asset.uri.split('.').pop() ?? 'mp4';
      const fileName = `video_${Date.now()}.${ext}`;
      patch('localUri',  asset.uri);
      patch('fileName',  fileName);
    }
  }

  function handleAdd() {
    if (!form.title.trim()) return;
    onAdd(form);
    setForm({
      title: '', date: today, analysisType: 'running_gait',
      activity: 'running', view: 'side', notes: '',
      localUri: undefined, fileName: undefined,
    });
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={m.root}>
        <View style={m.header}>
          <Pressable onPress={onClose} disabled={uploading}>
            <Text style={[m.cancel, uploading && { opacity: 0.4 }]}>Cancel</Text>
          </Pressable>
          <Text style={m.title}>New Analysis</Text>
          <Pressable onPress={handleAdd} disabled={!form.title.trim() || uploading}>
            <Text style={[m.add, (!form.title.trim() || uploading) && m.addDisabled]}>
              {uploading ? 'Uploading…' : 'Add'}
            </Text>
          </Pressable>
        </View>

        <ScrollView style={m.body} showsVerticalScrollIndicator={false}>
          <View style={m.section}>
            <Text style={m.label}>TITLE</Text>
            <TextInput
              style={m.input}
              value={form.title}
              onChangeText={v => patch('title', v)}
              placeholder="e.g. Easy run gait check, Back squat"
              placeholderTextColor={colors.textSubtle}
            />
          </View>

          <View style={m.section}>
            <Text style={m.label}>ANALYSIS TYPE</Text>
            <View style={m.pills}>
              {ANALYSIS_TYPES.map(opt => (
                <Pressable
                  key={opt.key}
                  style={[m.pill, form.analysisType === opt.key && m.pillActive]}
                  onPress={() => patch('analysisType', opt.key)}
                >
                  <Text style={[m.pillTxt, form.analysisType === opt.key && m.pillTxtActive]}>
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={m.section}>
            <Text style={m.label}>ACTIVITY</Text>
            <View style={m.pills}>
              {ACTIVITIES.map(opt => (
                <Pressable
                  key={opt.key}
                  style={[m.pill, form.activity === opt.key && m.pillActive]}
                  onPress={() => patch('activity', opt.key)}
                >
                  <Text style={[m.pillTxt, form.activity === opt.key && m.pillTxtActive]}>
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={m.section}>
            <Text style={m.label}>CAMERA ANGLE</Text>
            <View style={m.pills}>
              {VIEW_ANGLES.map(opt => (
                <Pressable
                  key={opt.key}
                  style={[m.pill, form.view === opt.key && m.pillActive]}
                  onPress={() => patch('view', opt.key)}
                >
                  <Text style={[m.pillTxt, form.view === opt.key && m.pillTxtActive]}>
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={m.section}>
            <Text style={m.label}>NOTES (OPTIONAL)</Text>
            <TextInput
              style={[m.input, m.inputMulti]}
              value={form.notes}
              onChangeText={v => patch('notes', v)}
              placeholder="Warm-up miles, how you felt, injury context..."
              placeholderTextColor={colors.textSubtle}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          <View style={m.section}>
            <Text style={m.label}>VIDEO (OPTIONAL)</Text>
            <Pressable style={m.videoPicker} onPress={handlePickVideo}>
              {form.localUri ? (
                <View style={m.videoPickerSelected}>
                  <Text style={m.videoPickerIcon}>🎥</Text>
                  <Text style={m.videoPickerTxt} numberOfLines={1}>{form.fileName}</Text>
                  <Text style={m.videoPickerChange}>Change</Text>
                </View>
              ) : (
                <View style={m.videoPickerEmpty}>
                  <Text style={m.videoPickerIcon}>📹</Text>
                  <Text style={m.videoPickerTxt}>Choose from camera roll</Text>
                </View>
              )}
            </Pressable>
            {uploading && (
              <View style={m.uploadRow}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={m.uploadTxt}>Uploading video securely…</Text>
              </View>
            )}
          </View>

          <View style={m.aiNote}>
            <Text style={m.aiNoteTitle}>Structured video analysis</Text>
            <Text style={m.aiNoteSub}>
              Upload a clip, tag the movement context, then open the analysis to record
              gait, lifting, and joint-angle findings in one place.
            </Text>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Video card ───────────────────────────────────────────────────────────────

function VideoCard({ video }: { video: { id: string; title: string; date: string; analysisType: MovementAnalysisType; activity: MovementActivity } }) {
  return (
    <Pressable
      style={vc.card}
      onPress={() => router.push({ pathname: '/(tabs)/movement/[videoId]', params: { videoId: video.id } })}
    >
      <View style={vc.iconBox}>
        <Text style={vc.icon}>
          {video.analysisType === 'running_gait' ? '🏃' : video.analysisType === 'lifting_mechanics' ? '🏋️' : '📐'}
        </Text>
      </View>
      <View style={vc.info}>
        <Text style={vc.title}>{video.title}</Text>
        <Text style={vc.sub}>{TYPE_LABELS[video.analysisType]} · {ACTIVITY_LABELS[video.activity]}</Text>
        <Text style={vc.date}>{video.date}</Text>
      </View>
      <Text style={vc.chevron}>›</Text>
    </Pressable>
  );
}

// ─── Saved analysis card ──────────────────────────────────────────────────────

function AnalysisCard({ analysis }: { analysis: MovementAnalysis }) {
  // Legacy 'lunge_single_leg' records normalize to single_leg_control/lunge
  // by camera view so old analyses keep rendering safely after the taxonomy split.
  const normKind = normalizeAnalysisKind(analysis.type, analysis.cameraView);
  const info = ANALYSIS_KIND_INFO[normKind] ?? ANALYSIS_KIND_INFO.general;
  const dionEntry = dionImagesForKind(normKind, analysis.cameraView);
  const isVideo = analysis.mediaType === 'video';
  const conf = CONFIDENCE_META[isVideo ? (analysis.sequenceConfidence ?? analysis.confidence) : analysis.confidence];
  const date = new Date(analysis.createdAt).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
  });
  return (
    <Pressable
      style={vc.card}
      onPress={() => isVideo
        ? router.push({ pathname: '/(tabs)/movement/video-analysis', params: { id: analysis.id } } as never)
        : router.push({ pathname: '/(tabs)/movement/analysis-detail', params: { analysisId: analysis.id } } as never)
      }
    >
      <DionInstructionCard dion={dionEntry} variant="compact" />
      <View style={vc.info}>
        <View style={vc.titleRow}>
          <Text style={vc.title}>{info.title}</Text>
          {isVideo && (
            <View style={vc.videoBadge}>
              <Ionicons name="videocam" size={10} color={colors.primary} />
              <Text style={vc.videoBadgeTxt}>VIDEO</Text>
            </View>
          )}
        </View>
        <Text style={vc.sub}>
          {isVideo
            ? `${analysis.keyFrames?.length ?? 0} key frames${analysis.repSummaries?.length ? ` · ${analysis.repSummaries.length} reps` : ''}`
            : analysis.landmarks?.length ? 'Pose detected' : 'Manual analysis'}
          {!isVideo && analysis.checklistFindings.length ? ` · ${analysis.checklistFindings.length} findings` : ''}
        </Text>
        <Text style={vc.date}>{date}</Text>
      </View>
      <View style={[vc.confChip, { backgroundColor: conf.color + '22' }]}>
        <Text style={[vc.confChipTxt, { color: conf.color }]}>{conf.label}</Text>
      </View>
      <Text style={vc.chevron}>›</Text>
    </Pressable>
  );
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function MovementIndexScreen() {
  const { videos, addVideo, updateVideo, analyses } = useMovementStore();
  const user = useAuthStore(s => s.user);
  const [showAdd,   setShowAdd]   = useState(false);
  const [uploading, setUploading] = useState(false);
  const [legacyOpen, setLegacyOpen] = useState(false);

  async function handleAdd(form: AddVideoForm) {
    // addVideo returns the ID it assigns — capture it so updateVideo targets the right record
    const videoId = addVideo({
      uri:          '',
      title:        form.title,
      date:         form.date,
      analysisType: form.analysisType,
      activity:     form.activity,
      view:         form.view,
      notes:        form.notes || undefined,
    });

    setShowAdd(false);

    if (!form.localUri) return;

    setUploading(true);
    try {
      const { localUri, ext, contentType } = await copyVideoToMovementStorage(form.localUri, videoId, form.fileName);

      // Save local URI immediately so video is playable even if cloud upload fails
      updateVideo(videoId, { uri: localUri });

      if (!user) return;

      const storagePath = `${user.id}/${videoId}.${ext}`;
      try {
        await uploadMovementVideo(localUri, storagePath, contentType);
        updateVideo(videoId, { storagePath });
      } catch (uploadError) {
        console.warn('Supabase upload error:', uploadError);
      }
    } catch (err) {
      console.warn('Video upload failed:', err);
    } finally {
      setUploading(false);
    }
  }

  return (
    <View style={s.root}>
      <View style={s.header}>
        <Text style={s.headerTitle}>Movement Lab</Text>
        <Pressable style={s.addBtn} onPress={() => setShowAdd(true)}>
          <Text style={s.addBtnTxt}>+ Add</Text>
        </Pressable>
      </View>

      {uploading && (
        <View style={s.uploadBanner}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={s.uploadBannerTxt}>Uploading video…</Text>
        </View>
      )}

      <ScrollView style={s.list} contentContainerStyle={s.listContent} showsVerticalScrollIndicator={false}>
        {/* Running/Walking Readiness — single clean entry point */}
        <ReadinessEntryCard />

        {/* Markerless analysis — pick a movement type */}
        <Text style={s.sectionLabel}>ANALYZE A MOVEMENT</Text>
        <View style={s.cards}>
          {ANALYSIS_KINDS.map(kind => {
            const info = ANALYSIS_KIND_INFO[kind];
            const dionEntry = dionImagesForKind(kind, KIND_DEFAULT_VIEW[kind]);
            return (
              <Pressable
                key={kind}
                style={s.kindCard}
                onPress={() => router.push({ pathname: '/(tabs)/movement/analyze', params: { kind } } as never)}
              >
                <DionInstructionCard dion={dionEntry} variant="compact" />
                <View style={s.kindInfo}>
                  <Text style={s.kindCategory}>{info.category?.toUpperCase() ?? ''}</Text>
                  <Text style={s.kindTitle}>{info.title}</Text>
                  <Text style={s.kindCamera}>{dionEntry.viewLabel}</Text>
                  <Text style={s.kindAnalyzes} numberOfLines={2}>
                    {info.analyzes.slice(0, 3).join(' · ')}
                  </Text>
                </View>
                <Text style={vc.chevron}>›</Text>
              </Pressable>
            );
          })}
        </View>

        {/* Saved still-frame analyses */}
        {analyses.length > 0 && (
          <>
            <Text style={s.sectionLabel}>SAVED ANALYSES</Text>
            <View style={s.cards}>
              {[...analyses].reverse().map(a => <AnalysisCard key={a.id} analysis={a} />)}
            </View>
          </>
        )}

        {/* Legacy video workspace — pre-markerless upload flow, kept for backward
            compatibility with existing video sessions but visually demoted. */}
        <Pressable style={s.legacyHeaderRow} onPress={() => setLegacyOpen(o => !o)}>
          <Text style={s.legacySectionLabel}>LEGACY VIDEO WORKSPACE</Text>
          <Text style={s.legacyDisclosure}>{legacyOpen ? '−' : '+'}</Text>
        </Pressable>
        {legacyOpen && (
        <>
        <View style={s.legacyBanner}>
          <Text style={s.legacyBannerSub}>
            Record video in your camera app, upload it here, and keep gait, lift, and
            joint-angle notes tied to the athlete profile.
          </Text>
        </View>

        {videos.length === 0 ? (
          <View style={s.empty}>
            <Text style={s.emptyIcon}>📹</Text>
            <Text style={s.emptyTitle}>No video sessions yet</Text>
            <Text style={s.emptyDesc}>
              Add a video session to keep longer clips and structured notes tied to
              your athlete profile.
            </Text>
            <Pressable style={s.emptyBtn} onPress={() => setShowAdd(true)}>
              <Text style={s.emptyBtnTxt}>Add Video Session</Text>
            </Pressable>
          </View>
        ) : (
          <View style={s.cards}>
            {videos.map(v => <VideoCard key={v.id} video={v} />)}
          </View>
        )}
        </>
        )}
      </ScrollView>

      <AddVideoModal
        visible={showAdd}
        onClose={() => setShowAdd(false)}
        onAdd={handleAdd}
        uploading={uploading}
      />
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:           { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop:        spacing.xxl + spacing.xl,
    paddingBottom:     spacing.md,
  },
  headerTitle: { color: colors.text, fontSize: 22, fontWeight: FontWeight.black },
  addBtn: {
    backgroundColor:   colors.primary,
    borderRadius:      Radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.xs,
  },
  addBtnTxt: { color: colors.text, fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  uploadBanner: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical:   spacing.xs,
    backgroundColor:   colors.primaryDim,
    borderBottomWidth: 1,
    borderBottomColor: colors.primary + '44',
  },
  uploadBannerTxt: { color: colors.primary, fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  list:        { flex: 1 },
  listContent: { padding: spacing.lg, paddingBottom: 120, gap: spacing.md },
  sectionLabel: {
    color:         colors.textMuted,
    fontSize:      10,
    fontWeight:    FontWeight.black,
    letterSpacing: 0.6,
    marginTop:     spacing.xs,
  },
  kindCard: {
    backgroundColor: colors.card,
    borderRadius:    12,
    padding:         spacing.md,
    borderWidth:     1,
    borderColor:     colors.border,
    flexDirection:   'row',
    alignItems:      'center',
    gap:             spacing.md,
  },
  kindInfo:     { flex: 1, gap: 2 },
  kindCategory: { color: colors.textSubtle, fontSize: 9, fontWeight: FontWeight.black, letterSpacing: 0.5 },
  kindTitle:    { color: colors.text, fontSize: FontSize.base, fontWeight: FontWeight.bold },
  kindCamera:   { color: colors.primary, fontSize: FontSize.xs },
  kindAnalyzes: { color: colors.textMuted, fontSize: FontSize.xs, lineHeight: 15 },
  aiBanner: {
    backgroundColor: colors.card,
    borderRadius:    12,
    padding:         spacing.md,
    borderWidth:     1,
    borderColor:     colors.border,
    gap:             spacing.xs,
  },
  aiBannerTitle: { color: colors.primary, fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  aiBannerSub:   { color: colors.textMuted, fontSize: FontSize.xs, lineHeight: 17 },
  legacyHeaderRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    marginTop:      spacing.sm,
  },
  legacySectionLabel: {
    color:         colors.textSubtle,
    fontSize:      10,
    fontWeight:    FontWeight.bold,
    letterSpacing: 0.6,
  },
  legacyDisclosure: { color: colors.textSubtle, fontSize: 16, fontWeight: FontWeight.bold },
  legacyBanner: {
    backgroundColor: colors.cardAlt,
    borderRadius:    12,
    padding:         spacing.md,
    borderWidth:     1,
    borderColor:     colors.border,
  },
  legacyBannerSub: { color: colors.textSubtle, fontSize: FontSize.xs, lineHeight: 16 },
  empty: { alignItems: 'center', paddingTop: spacing.xxxl, gap: spacing.md },
  emptyIcon:    { fontSize: 48 },
  emptyTitle:   { color: colors.text, fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  emptyDesc:    { color: colors.textMuted, fontSize: FontSize.sm, lineHeight: 20, textAlign: 'center' },
  emptyBtn: {
    backgroundColor:   colors.primary,
    borderRadius:      Radius.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical:   spacing.md,
    marginTop:         spacing.sm,
  },
  emptyBtnTxt: { color: colors.text, fontSize: FontSize.base, fontWeight: FontWeight.bold },
  cards:       { gap: spacing.sm },
});

const vc = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius:    12,
    padding:         spacing.md,
    borderWidth:     1,
    borderColor:     colors.border,
    flexDirection:   'row',
    alignItems:      'center',
    gap:             spacing.md,
  },
  iconBox: {
    width:           44,
    height:          44,
    borderRadius:    10,
    backgroundColor: colors.border,
    alignItems:      'center',
    justifyContent:  'center',
  },
  icon:    { fontSize: 22 },
  info:    { flex: 1, gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  title:   { color: colors.text, fontSize: FontSize.base, fontWeight: FontWeight.bold },
  videoBadge: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               3,
    paddingHorizontal: 6,
    paddingVertical:   2,
    borderRadius:      Radius.sm,
    backgroundColor:   colors.primaryDim,
  },
  videoBadgeTxt: { color: colors.primary, fontSize: 9, fontWeight: FontWeight.black, letterSpacing: 0.4 },
  sub:     { color: colors.textMuted, fontSize: FontSize.xs },
  date:    { color: colors.textSubtle, fontSize: FontSize.xs },
  chevron: { color: colors.textSubtle, fontSize: 22 },
  confChip:    { borderRadius: Radius.sm, paddingHorizontal: 6, paddingVertical: 2 },
  confChipTxt: { fontSize: 10, fontWeight: FontWeight.black },
});

const m = StyleSheet.create({
  root:   { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop:        spacing.xl,
    paddingBottom:     spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  cancel:     { color: colors.textMuted, fontSize: FontSize.base },
  title:      { color: colors.text, fontSize: FontSize.base, fontWeight: FontWeight.bold },
  add:        { color: colors.primary, fontSize: FontSize.base, fontWeight: FontWeight.bold },
  addDisabled:{ opacity: 0.4 },
  body:       { flex: 1 },
  section: {
    padding:           spacing.lg,
    gap:               spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  label: {
    color:         colors.textMuted,
    fontSize:      10,
    fontWeight:    FontWeight.black,
    letterSpacing: 0.6,
  },
  input: {
    backgroundColor: colors.card,
    borderRadius:    Radius.sm,
    borderWidth:     1,
    borderColor:     colors.border,
    color:           colors.text,
    fontSize:        FontSize.base,
    padding:         spacing.md,
  },
  inputMulti: { minHeight: 80 },
  pills:      { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  pill: {
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.xs,
    borderRadius:      20,
    backgroundColor:   colors.border,
  },
  pillActive: {
    backgroundColor: colors.primaryDim,
    borderWidth:     1,
    borderColor:     colors.primary,
  },
  pillTxt:       { color: colors.textDim, fontSize: FontSize.sm },
  pillTxtActive: { color: colors.primary, fontWeight: FontWeight.bold },
  videoPicker: {
    backgroundColor: colors.card,
    borderRadius:    Radius.sm,
    borderWidth:     1,
    borderColor:     colors.border,
    padding:         spacing.md,
  },
  videoPickerEmpty: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.sm,
  },
  videoPickerSelected: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.sm,
  },
  videoPickerIcon: { fontSize: 20 },
  videoPickerTxt: {
    color:    colors.text,
    fontSize: FontSize.sm,
    flex:     1,
  },
  videoPickerChange: {
    color:      colors.primary,
    fontSize:   FontSize.xs,
    fontWeight: FontWeight.bold,
  },
  uploadRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.sm,
    marginTop:     spacing.xs,
  },
  uploadTxt: { color: colors.primary, fontSize: FontSize.xs },
  aiNote: {
    margin:          spacing.lg,
    backgroundColor: colors.card,
    borderRadius:    12,
    padding:         spacing.md,
    borderWidth:     1,
    borderColor:     colors.border,
    gap:             spacing.xs,
  },
  aiNoteTitle: { color: colors.primary, fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  aiNoteSub:   { color: colors.textMuted, fontSize: FontSize.xs, lineHeight: 17 },
});
