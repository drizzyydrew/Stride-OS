import { useEffect, useRef, useState } from 'react';
import { Alert, ScrollView, Share, Text, View } from 'react-native';
import { router } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import ScreenHeader from '../../../src/components/layout/ScreenHeader';
import Button from '../../../src/components/ui/Button';
import { useColors } from '../../../src/theme/useColors';
import { useAuthStore } from '../../../src/store/authStore';
import { useMovementStore } from '../../../src/store/movementStore';
import { captureOwnerLease, ownerLeaseIsCurrent } from '../../../src/lib/localDataOwner';
import { resolveDocumentUri } from '../../../src/lib/mediaPaths';
import { getSupabaseAvailability } from '../../../src/lib/supabase';
import { deleteAnalysisMediaIfStored } from '../../../src/lib/movementVideoStorage';

/** Free owner data controls. No playback, thumbnails or interpreted results. */
export default function MovementDataControls() {
  const C = useColors();
  const owner = useAuthStore(state => state.user?.id ?? state.offlineOwnerId);
  useAuthStore(state => state.canAccessLocalData);
  const { videos, analyses, readinessAssessments } = useMovementStore();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const pending = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { pending.current = false; setBusy(false); setMessage(null); }, [owner]);
  const lease = captureOwnerLease();
  const run = async (action: (assertOwner: () => void) => Promise<void>) => {
    if (pending.current || !lease) return;
    pending.current = true;
    const assertOwner = () => { if (!ownerLeaseIsCurrent(lease)) throw new Error('Your account changed. Reopen data controls.'); };
    setBusy(true); setMessage(null);
    try { assertOwner(); await action(assertOwner); }
    catch { if (mounted.current && ownerLeaseIsCurrent(lease)) setMessage('This action could not be completed. Check your connection and try again.'); }
    finally { if (mounted.current && ownerLeaseIsCurrent(lease)) { pending.current = false; setBusy(false); } }
  };
  const exportRecords = () => run(async assertOwner => {
    if (!FileSystem.cacheDirectory) throw new Error('Sharing unavailable');
    assertOwner();
    const state = useMovementStore.getState();
    const uri = `${FileSystem.cacheDirectory}strideos-movement-export-${Date.now()}.json`;
    try {
      await FileSystem.writeAsStringAsync(uri, JSON.stringify({ exportedAt: new Date().toISOString(),
        videos: state.videos, sessions: state.sessions, analyses: state.analyses,
        readinessAssessments: state.readinessAssessments }, null, 2));
      assertOwner();
      await Share.share({ url: uri, title: 'Export your Movement Lab records' });
    } finally { await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => undefined); }
  });
  const exportMedia = (uri?: string, storagePath?: string) => run(async assertOwner => {
    const local = resolveDocumentUri(uri);
    if (local?.startsWith('file://') && (await FileSystem.getInfoAsync(local)).exists) {
      assertOwner(); await Share.share({ url: local, title: 'Export your original media' }); return;
    }
    const online = getSupabaseAvailability();
    if (!storagePath || storagePath.split('/')[0] !== lease?.ownerUserId
      || online.status !== 'available' || !FileSystem.cacheDirectory) throw new Error('Media unavailable');
    assertOwner();
    const { data, error } = await online.client.storage.from('movement-videos').createSignedUrl(storagePath, 120);
    if (error || !data?.signedUrl) throw new Error('Media export unavailable');
    assertOwner();
    const extension = storagePath.match(/\.([a-zA-Z0-9]{1,8})$/)?.[1] ?? 'mp4';
    const exported = `${FileSystem.cacheDirectory}strideos-media-export-${Date.now()}.${extension}`;
    try {
      await FileSystem.downloadAsync(data.signedUrl, exported); assertOwner();
      await Share.share({ url: exported, title: 'Export your original media' });
    } finally { await FileSystem.deleteAsync(exported, { idempotent: true }).catch(() => undefined); }
  });
  const confirmRemove = (kind: 'video' | 'analysis' | 'readiness', id: string) => Alert.alert(
    'Delete saved item?', 'This removes the saved StrideOS item and its app-owned media. Photo-library originals are not removed.',
    [{ text: 'Keep item', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => { void run(async assertOwner => {
      const state = useMovementStore.getState();
      if (kind === 'video') {
        const video = state.videos.find(item => item.id === id);
        if (!video) return;
        if (video.storagePath) {
          const online = getSupabaseAvailability();
          if (online.status !== 'available' || video.storagePath.split('/')[0] !== lease?.ownerUserId) throw new Error('Cloud deletion unavailable');
          const { error } = await online.client.storage.from('movement-videos').remove([video.storagePath]);
          if (error) throw error;
          assertOwner();
        }
        const local = resolveDocumentUri(video.uri);
        if (local && FileSystem.documentDirectory && local.startsWith(`${FileSystem.documentDirectory}movement-videos/`)) {
          await FileSystem.deleteAsync(local, { idempotent: true }); assertOwner();
        }
        state.deleteVideo(id);
      } else if (kind === 'analysis') {
        const analysis = state.analyses.find(item => item.id === id);
        if (!analysis) return;
        await deleteAnalysisMediaIfStored(analysis.mediaUri); assertOwner(); state.removeAnalysis(id);
      } else { assertOwner(); state.removeReadinessAssessment(id); }
    }); } }],
  );
  return <View style={{ flex: 1, backgroundColor: C.bg }}>
    <ScreenHeader eyebrow="YOUR DATA" title="Movement Lab data" onBack={() => router.back()} />
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 120 }}>
      <Text style={{ color: C.textMuted, lineHeight: 21 }}>Export or delete your saved records without Pro. Playback and results in Movement Lab require active Pro. Exported files are under your control.</Text>
      {!lease ? <Text style={{ color: C.text }}>Sign in with the account that owns this saved data.</Text> : <>
        <Button label="Export saved records" disabled={busy} onPress={() => { void exportRecords(); }} />
        <Text style={{ color: C.textMuted, lineHeight: 21 }}>The records export contains saved data and media references. Export original media files separately. Cloud-only video exports need an internet connection.</Text>
        {!videos.length && !analyses.length && !readinessAssessments.length ? <Text style={{ color: C.textMuted }}>No saved Movement Lab items.</Text> : null}
        {videos.map(item => <View key={item.id} style={{ borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 16, gap: 12 }}>
          <Text style={{ color: C.text, fontWeight: '700' }}>{item.title || 'Saved video'}</Text>
          <Button label="Export original media" variant="secondary" disabled={busy || (!resolveDocumentUri(item.uri) && !item.storagePath)} onPress={() => { void exportMedia(item.uri, item.storagePath); }} />
          <Button label="Delete saved item" variant="secondary" disabled={busy} onPress={() => confirmRemove('video', item.id)} />
        </View>)}
        {analyses.map(item => <View key={item.id} style={{ borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 16, gap: 12 }}>
          <Text style={{ color: C.text, fontWeight: '700' }}>Saved analysis · {new Date(item.createdAt).toLocaleDateString()}</Text>
          <Button label="Export original media" variant="secondary" disabled={busy || !resolveDocumentUri(item.mediaUri)} onPress={() => { void exportMedia(item.mediaUri); }} />
          <Button label="Delete saved item" variant="secondary" disabled={busy} onPress={() => confirmRemove('analysis', item.id)} />
        </View>)}
        {readinessAssessments.map(item => <View key={item.id} style={{ borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 16, gap: 12 }}>
          <Text style={{ color: C.text, fontWeight: '700' }}>Saved assessment · {new Date(item.createdAt).toLocaleDateString()}</Text>
          <Button label="Delete saved item" variant="secondary" disabled={busy} onPress={() => confirmRemove('readiness', item.id)} />
        </View>)}
      </>}
      {message ? <Text accessibilityRole="alert" style={{ color: C.critical }}>{message}</Text> : null}
    </ScrollView>
  </View>;
}
