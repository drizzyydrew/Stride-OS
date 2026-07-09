import { Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useColors } from '../../theme/useColors';
import { findDefinition } from '../../constants/trainingDefinitions';

type Props = {
  visible: boolean;
  term:    string | null;
  onClose: () => void;
};

function Section({ label, body, color, muted }: { label: string; body: string; color: string; muted: string }) {
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={[styles.sectionLabel, { color }]}>{label}</Text>
      <Text style={[styles.sectionBody, { color: muted }]}>{body}</Text>
    </View>
  );
}

export default function TermDefinitionModal({ visible, term, onClose }: Props) {
  const C = useColors();
  const router = useRouter();
  const def = term ? findDefinition(term) : undefined;

  function askAiCoach() {
    if (!def) return;
    onClose();
    router.push({
      pathname: '/(tabs)/coach',
      params: { ask: `Explain what a ${def.label} is and how I should approach it for my current fitness level.` },
    } as any);
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: C.card, borderColor: C.border }]}>
          <View style={styles.handleRow}>
            <View style={[styles.handle, { backgroundColor: C.border }]} />
          </View>

          {def ? (
            <>
              <View style={styles.headerRow}>
                <Text style={[styles.title, { color: C.text }]}>{def.label}</Text>
                <TouchableOpacity onPress={onClose} hitSlop={10} style={{ padding: 4 }}>
                  <Ionicons name="close" size={20} color={C.textMuted} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 480 }}>
                <Section label="WHAT IS IT?" body={def.whatIsIt} color={C.primary} muted={C.textMuted} />
                <Section label="WHY ARE YOU DOING IT?" body={def.whyDoIt} color={C.primary} muted={C.textMuted} />
                <Section label="HOW DO YOU PERFORM IT?" body={def.howToPerform} color={C.primary} muted={C.textMuted} />
                <Section label="HOW SHOULD IT FEEL?" body={def.howItShouldFeel} color={C.primary} muted={C.textMuted} />

                <View style={{ marginBottom: 16 }}>
                  <Text style={[styles.sectionLabel, { color: C.primary }]}>COMMON MISTAKES</Text>
                  {def.commonMistakes.map(m => (
                    <Text key={m} style={[styles.sectionBody, { color: C.textMuted, marginTop: 2 }]}>• {m}</Text>
                  ))}
                </View>

                {def.beginnerModification ? (
                  <View style={[styles.beginnerBox, { backgroundColor: C.primaryDim }]}>
                    <Text style={[styles.sectionLabel, { color: C.primary, marginBottom: 4 }]}>BEGINNER MODIFICATION</Text>
                    <Text style={[styles.sectionBody, { color: C.textMuted }]}>{def.beginnerModification}</Text>
                  </View>
                ) : null}

                <View style={[styles.footer, { borderTopColor: C.border }]}>
                  <Text style={[styles.footerText, { color: C.textDim }]}>
                    Still unsure? Ask the AI Coach to explain this workout or adjust it for your current fitness level.
                  </Text>
                  <TouchableOpacity
                    style={[styles.coachBtn, { backgroundColor: C.primary }]}
                    onPress={askAiCoach}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="chatbubble-ellipses-outline" size={15} color={C.onPrimary} />
                    <Text style={[styles.coachBtnText, { color: C.onPrimary }]}>Ask AI Coach</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </>
          ) : (
            <View style={{ paddingVertical: 20 }}>
              <Text style={[styles.title, { color: C.text, marginBottom: 8 }]}>No definition found</Text>
              <Text style={[styles.sectionBody, { color: C.textMuted }]}>
                We don't have a definition for this term yet.
              </Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 36,
  },
  handleRow: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    fontFamily: 'CormorantGaramond_700Bold',
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  sectionBody: {
    fontSize: 13,
    lineHeight: 19,
  },
  beginnerBox: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  footer: {
    borderTopWidth: 1,
    paddingTop: 14,
    marginTop: 4,
  },
  footerText: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 10,
  },
  coachBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 42,
    borderRadius: 10,
  },
  coachBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
