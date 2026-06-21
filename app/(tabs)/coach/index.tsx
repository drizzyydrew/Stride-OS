// ─── AI Coach ─────────────────────────────────────────────────────────────────
//
// Chat interface powered by Claude. Builds a system prompt from the user's
// onboarding profile, movement risk flags, and training context so responses
// are personalised to that specific athlete.

import {
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
import { useRef, useState } from 'react';

import { useOnboardingStore } from '../../../src/store/onboardingStore';
import { useMovementStore }   from '../../../src/store/movementStore';
import { colors }   from '../../../src/theme/colors';
import { spacing }  from '../../../src/theme/spacing';
import { FontSize, FontWeight, Radius } from '../../../src/theme/tokens';

// ─── Types ────────────────────────────────────────────────────────────────────

type Role    = 'user' | 'assistant';
type Message = { role: Role; content: string };

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
- Be direct and concise. Use dashes for bullet points. Emojis are fine but use them sparingly.
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

// ─── Screen ──────────────────────────────────────────────────────────────────

// On native: call Anthropic directly (no CORS). On web: route through Supabase Edge Function.
const SUPABASE_URL   = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const EDGE_FN_URL    = `${SUPABASE_URL}/functions/v1/ai-coach`;
const ANTHROPIC_URL  = 'https://api.anthropic.com/v1/messages';
const API_KEY        = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY ?? '';
const SUPABASE_ANON  = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

const isWeb = Platform.OS === 'web';

export default function CoachScreen() {
  const data      = useOnboardingStore(s => s.data);
  const riskFlags = useMovementStore(s => s.getActiveRiskFlags);

  const [messages,  setMessages]  = useState<Message[]>([]);
  const [input,     setInput]     = useState('');
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const noKey = !API_KEY;

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
      let res: Response;

      if (isWeb) {
        // Web: proxy through Supabase Edge Function to avoid CORS
        res = await fetch(EDGE_FN_URL, {
          method:  'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey':       SUPABASE_ANON,
            'authorization': `Bearer ${SUPABASE_ANON}`,
          },
          body: JSON.stringify({ messages: updated, system }),
        });
      } else {
        // Native: call Anthropic directly
        res = await fetch(ANTHROPIC_URL, {
          method:  'POST',
          headers: {
            'Content-Type':      'application/json',
            'x-api-key':         API_KEY,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model:      'claude-haiku-4-5-20251001',
            max_tokens: 1024,
            system,
            messages:   updated,
          }),
        });
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: { message?: string } }).error?.message ?? `HTTP ${res.status}`);
      }

      const json = await res.json() as { content: { text: string }[] };
      const reply = json.content?.[0]?.text ?? '(no response)';
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to reach AI coach.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={90}
    >
      <View style={s.header}>
        <Text style={s.headerTitle}>AI Coach</Text>
        <Text style={s.headerSub}>Powered by Claude · Personal to your profile</Text>
      </View>

      {noKey ? (
        <View style={s.noKey}>
          <Text style={s.noKeyIcon}>🔑</Text>
          <Text style={s.noKeyTitle}>API key required</Text>
          <Text style={s.noKeyDesc}>
            Add your Anthropic API key to the .env file:{'\n\n'}
            EXPO_PUBLIC_ANTHROPIC_API_KEY=sk-ant-...{'\n\n'}
            Then restart the dev server.
          </Text>
        </View>
      ) : (
        <>
          <ScrollView
            ref={scrollRef}
            style={s.messages}
            contentContainerStyle={s.messagesContent}
            showsVerticalScrollIndicator={false}
          >
            {messages.length === 0 && (
              <View style={s.empty}>
                <Text style={s.emptyIcon}>💬</Text>
                <Text style={s.emptyTitle}>Ask your coach anything</Text>
                <Text style={s.emptyDesc}>
                  I know your goals, training history, and movement patterns.
                  Try: "What pace should my easy runs be?" or "How do I fix my overstriding?"
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
      )}
    </KeyboardAvoidingView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop:        spacing.xxl + spacing.xl,
    paddingBottom:     spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap:               2,
  },
  headerTitle: { color: colors.text, fontSize: 22, fontWeight: FontWeight.black },
  headerSub:   { color: colors.textMuted, fontSize: FontSize.xs },

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

  messages:        { flex: 1 },
  messagesContent: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.sm },

  empty: { alignItems: 'center', paddingTop: spacing.xxl, gap: spacing.md },
  emptyIcon:  { fontSize: 40 },
  emptyTitle: { color: colors.text, fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  emptyDesc:  { color: colors.textMuted, fontSize: FontSize.sm, lineHeight: 20, textAlign: 'center' },
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

  inputRow: {
    flexDirection:     'row',
    alignItems:        'flex-end',
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.sm,
    borderTopWidth:    1,
    borderTopColor:    colors.border,
    gap:               spacing.sm,
    backgroundColor:   colors.bg,
  },
  input: {
    flex:              1,
    backgroundColor:   colors.card,
    borderRadius:      20,
    borderWidth:       1,
    borderColor:       colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.sm,
    color:             colors.text,
    fontSize:          FontSize.base,
    maxHeight:         120,
  },
  sendBtn: {
    width:           40,
    height:          40,
    borderRadius:    20,
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
