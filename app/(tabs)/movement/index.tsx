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
import * as FileSystem  from 'expo-file-system/legacy';

import { useMovementStore } from '../../../src/store/movementStore';
import { useAuthStore }     from '../../../src/store/authStore';
import { supabase }         from '../../../src/lib/supabase';
import { colors }  from '../../../src/theme/colors';
import { spacing } from '../../../src/theme/spacing';
import { FontSize, FontWeight, Radius } from '../../../src/theme/tokens';
import type { MovementAnalysisType, MovementActivity, MovementViewAngle } from '../../../src/types/movement';

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
  { key: '45_degree', label: '45°'     },
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

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function MovementIndexScreen() {
  const { videos, addVideo, updateVideo } = useMovementStore();
  const user = useAuthStore(s => s.user);
  const [showAdd,   setShowAdd]   = useState(false);
  const [uploading, setUploading] = useState(false);

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

    if (!form.localUri || !user) return;

    setUploading(true);
    try {
      const destDir = `${FileSystem.documentDirectory}movement-videos/`;
      await FileSystem.makeDirectoryAsync(destDir, { intermediates: true });
      const ext       = form.fileName?.split('.').pop() ?? 'mp4';
      const localDest = `${destDir}${videoId}.${ext}`;
      await FileSystem.copyAsync({ from: form.localUri, to: localDest });

      const storagePath = `${user.id}/${videoId}.${ext}`;
      const response    = await fetch(localDest);
      const blob        = await response.blob();

      // Save local URI immediately so video is playable even if cloud upload fails
      updateVideo(videoId, { uri: localDest });

      const { error: uploadError } = await supabase.storage
        .from('movement-videos')
        .upload(storagePath, blob, { contentType: `video/${ext}`, upsert: false });

      if (uploadError) {
        console.warn('Supabase upload error:', uploadError.message);
      } else {
        updateVideo(videoId, { storagePath });
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
        <View style={s.aiBanner}>
          <Text style={s.aiBannerTitle}>Video analysis workspace</Text>
          <Text style={s.aiBannerSub}>
            Record video in your camera app, upload it here, and keep gait, lift, and
            joint-angle notes tied to the athlete profile.
          </Text>
        </View>

        {videos.length === 0 ? (
          <View style={s.empty}>
            <Text style={s.emptyIcon}>📹</Text>
            <Text style={s.emptyTitle}>No analyses yet</Text>
            <Text style={s.emptyDesc}>
              Add your first movement analysis to start tracking gait patterns,
              lifting mechanics, and joint angles.
            </Text>
            <Pressable style={s.emptyBtn} onPress={() => setShowAdd(true)}>
              <Text style={s.emptyBtnTxt}>Add First Analysis</Text>
            </Pressable>
          </View>
        ) : (
          <View style={s.cards}>
            {videos.map(v => <VideoCard key={v.id} video={v} />)}
          </View>
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
  title:   { color: colors.text, fontSize: FontSize.base, fontWeight: FontWeight.bold },
  sub:     { color: colors.textMuted, fontSize: FontSize.xs },
  date:    { color: colors.textSubtle, fontSize: FontSize.xs },
  chevron: { color: colors.textSubtle, fontSize: 22 },
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
