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
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';

import { useOnboardingStore } from '../../../src/store/onboardingStore';
import { useMovementStore }   from '../../../src/store/movementStore';
import { useAuthStore } from '../../../src/store/authStore';
import {
  checkAiCoachHealth,
  isAiCoachConfigured,
  sendCoachMessage,
  type AiCoachHealth,
  type CoachMessage,
} from '../../../src/lib/aiCoach';
import { supabase } from '../../../src/lib/supabase';
import { colors }   from '../../../src/theme/colors';
import { spacing }  from '../../../src/theme/spacing';
import { FontSize, FontWeight, Radius } from '../../../src/theme/tokens';

// ─── Types ────────────────────────────────────────────────────────────────────

type Role    = 'user' | 'assistant';
type Message = CoachMessage & { role: Role };
type CoachTab = 'chat' | 'video';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildSystemPrompt(
  data:      ReturnType<typeof useOnboardingStore.getState>['data'],
  riskFlags: ReturnType<typeof useMovementStore.getState>['getActiveRiskFlags'],
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

INSTRUCTIONS
- Give personalised, actionable advice grounded in this athlete's specific data.
- Be direct and concise. Use dashes for bullet points.
- When giving training, recovery, or injury-risk guidance, cite credible sports science sources such as PubMed-indexed research, ACSM, NSCA, or consensus guidelines in plain text.
- Do NOT use markdown: no # headers, no ## headers, no **bold**, no *italics*. Plain text only.
- Never give medical diagnoses. Recommend professional care for pain or injury concerns.
- If asked about paces or zones, calculate from their profile data.`;
}

// ─── Message bubble ───────────────────────────────────────────────────────────

function Bubble({ msg }: { msg: Message }) {
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
  const insets = useSafeAreaInsets();
  const data      = useOnboardingStore(s => s.data);
  const riskFlags = useMovementStore(s => s.getActiveRiskFlags);
  const addVideo = useMovementStore(s => s.addVideo);
  const updateVideo = useMovementStore(s => s.updateVideo);
  const videos = useMovementStore(s => s.videos);
  const user = useAuthStore(s => s.user);

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
      const system  = buildSystemPrompt(data, riskFlags);
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
    const ext = asset.uri.split('.').pop()?.split('?')[0] || 'mp4';
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
      const destDir = `${FileSystem.documentDirectory}movement-videos/`;
      await FileSystem.makeDirectoryAsync(destDir, { intermediates: true });
      const localDest = `${destDir}${videoId}.${ext}`;
      await FileSystem.copyAsync({ from: asset.uri, to: localDest });
      setSelectedVideoUri(localDest);

      let storagePath: string | undefined;
      if (user) {
        storagePath = `${user.id}/${videoId}.${ext}`;
        const response = await fetch(localDest);
        const blob = await response.blob();

        const { error: uploadError } = await supabase.storage
          .from('movement-videos')
          .upload(storagePath, blob, { contentType: `video/${ext}`, upsert: false });

        if (uploadError) {
          console.warn('Coach video upload error:', uploadError.message);
          storagePath = undefined;
        }
      }

      updateVideo(videoId, {
        uri: localDest,
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
          <Ionicons name="arrow-back" size={20} color={colors.primary} />
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
          <Text style={[s.segmentTxt, tab === 'chat' && s.segmentTxtActive]}>AI Coaching</Text>
        </Pressable>
        <Pressable
          style={[s.segmentBtn, tab === 'video' && s.segmentBtnActive]}
          onPress={() => setTab('video')}
        >
          <Text style={[s.segmentTxt, tab === 'video' && s.segmentTxtActive]}>Video Analysis</Text>
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
          <ActivityIndicator size="small" color={colors.primary} />
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
                  <ActivityIndicator size="small" color={colors.primary} />
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
              placeholderTextColor={colors.textSubtle}
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

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: spacing.lg,
    paddingBottom: 12,
  },
  headerLabel: {
    color: colors.textDim,
    fontSize: 11,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.9,
  },
  headerTitle: {
    color: colors.text,
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
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  segmentBtn: {
    flex: 1,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentBtnActive: { backgroundColor: colors.primaryDim },
  segmentTxt: { color: colors.textDim, fontSize: 11, fontWeight: FontWeight.bold },
  segmentTxtActive: { color: colors.primary },

  noKey: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    padding:        spacing.xl,
    gap:            spacing.md,
  },
  noKeyIcon:  { fontSize: 40 },
  noKeyTitle: { color: colors.text, fontSize: FontSize.lg, fontWeight: FontWeight.bold, textAlign: 'center' },
  noKeyDesc:  { color: colors.textMuted, fontSize: FontSize.sm, lineHeight: 20, textAlign: 'center' },
  retryBtn: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  retryTxt: { color: colors.onPrimary, fontSize: FontSize.sm, fontWeight: FontWeight.bold },

  messages:        { flex: 1 },
  messagesContent: { paddingHorizontal: 18, paddingBottom: spacing.xxl, gap: 8 },
  videoContent: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },

  contextCard: {
    backgroundColor: colors.primaryDim,
    borderColor: colors.primary,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: 4,
  },
  contextEyebrow: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  contextTxt: { color: colors.textMuted, fontSize: FontSize.xs, lineHeight: 18 },

  empty: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    gap: 4,
  },
  emptyTitle: { color: colors.text, fontSize: 13, fontWeight: FontWeight.bold },
  emptyDesc:  { color: colors.textMuted, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  suggestions: { gap: spacing.xs, width: '100%', marginTop: spacing.sm },
  suggestion: {
    backgroundColor:   colors.card,
    borderRadius:      Radius.sm,
    borderWidth:       1,
    borderColor:       colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.sm,
  },
  suggestionTxt: { color: colors.primary, fontSize: FontSize.sm },

  errorBox: {
    backgroundColor: colors.critical + '22',
    borderRadius:    Radius.sm,
    padding:         spacing.md,
    borderWidth:     1,
    borderColor:     colors.critical + '44',
  },
  errorTxt: { color: colors.critical, fontSize: FontSize.sm },

  videoDrop: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    alignItems: 'center',
    gap: spacing.xs,
  },
  videoIcon: { fontSize: 30 },
  videoTitle: { color: colors.textMuted, fontSize: FontSize.base, fontWeight: FontWeight.bold, textAlign: 'center' },
  videoDesc: { color: colors.textDim, fontSize: FontSize.xs, textAlign: 'center', marginBottom: spacing.sm },
  videoBtn: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: 22,
    paddingVertical: 10,
  },
  videoBtnTxt: { color: colors.onPrimary, fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  videoPreviewCard: {
    overflow: 'hidden',
    borderRadius: 16,
    backgroundColor: '#000',
    borderWidth: 1,
    borderColor: colors.border,
  },
  videoPreview: {
    width: '100%',
    height: 220,
    backgroundColor: '#000',
  },
  replaceVideoBtn: {
    backgroundColor: colors.card,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  replaceVideoTxt: {
    color: colors.primary,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },
  reviewCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: spacing.md,
    gap: spacing.sm,
  },
  reviewHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  reviewTitle: { color: colors.text, fontSize: FontSize.base, fontWeight: FontWeight.bold },
  reviewPill: {
    color: colors.accent,
    backgroundColor: colors.accentDim,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    fontSize: 10,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.5,
  },
  reviewTxt: { color: colors.textMuted, fontSize: FontSize.sm, lineHeight: 22 },
  recentTitle: { color: colors.text, fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  videoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.sm,
  },
  videoRowTitle: { color: colors.text, fontSize: FontSize.sm, fontWeight: FontWeight.bold, maxWidth: 260 },
  videoRowMeta: { color: colors.textMuted, fontSize: FontSize.xs, marginTop: 2 },
  videoRowChevron: { color: colors.primary, fontSize: 22 },
  secondaryBtn: {
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnTxt: { color: colors.primary, fontSize: FontSize.sm, fontWeight: FontWeight.bold },

  inputRow: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: 18,
    paddingVertical:   10,
    gap:               8,
    backgroundColor:   colors.bg,
  },
  input: {
    flex:              1,
    backgroundColor:   colors.card,
    borderRadius:      10,
    borderWidth:       1,
    borderColor:       colors.border,
    paddingHorizontal: 12,
    paddingVertical:   10,
    color:             colors.text,
    fontSize:          13,
    maxHeight:         120,
  },
  sendBtn: {
    width:           44,
    height:          44,
    borderRadius:    10,
    backgroundColor: colors.primary,
    alignItems:      'center',
    justifyContent:  'center',
  },
  sendBtnDisabled: { opacity: 0.4 },
  sendTxt: { color: '#000', fontSize: 18, fontWeight: FontWeight.black, lineHeight: 22 },
});

const b = StyleSheet.create({
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
  userBubble:      { backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  assistantBubble: { backgroundColor: colors.card, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: colors.border },
  txt:         { fontSize: FontSize.base, lineHeight: 22 },
  userTxt:     { color: '#000' },
  assistantTxt:{ color: colors.text },
});
