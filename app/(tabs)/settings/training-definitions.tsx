import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useColors } from '../../../src/theme/useColors';
import { LAYOUT } from '../../../src/constants/layout';
import { TRAINING_DEFINITIONS, type TermCategory, type TermDefinition } from '../../../src/constants/trainingDefinitions';
import TermDefinitionModal from '../../../src/components/shared/TermDefinitionModal';

const CATEGORY_ORDER: TermCategory[] = ['running', 'concept', 'strength', 'mobility'];
const CATEGORY_LABELS: Record<TermCategory, string> = {
  running: 'Running',
  concept: 'Concepts',
  strength: 'Strength',
  mobility: 'Mobility',
};

// Terms not in the canonical Build 34 term list (bonus workout-type coverage)
// don't need their own section row here — they're reachable via InfoButton.
const HIDDEN_KEYS = new Set(['strength_training_overview', 'cross_training', 'rest']);

export default function TrainingDefinitionsScreen() {
  const C = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [activeTerm, setActiveTerm] = useState<string | null>(null);

  const sections = useMemo(() => {
    const visible = TRAINING_DEFINITIONS.filter(d => !HIDDEN_KEYS.has(d.key));
    return CATEGORY_ORDER.map(category => ({
      category,
      items: visible.filter(d => d.category === category),
    })).filter(s => s.items.length > 0);
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={[styles.header, { paddingTop: insets.top + 6, backgroundColor: C.bg }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={20} color={C.primary} />
        </TouchableOpacity>
        <View style={{ marginLeft: 10, flex: 1 }}>
          <Text style={[styles.headerLabel, { color: C.textDim }]}>SETTINGS</Text>
          <Text style={[styles.headerTitle, { color: C.text }]}>Training Definitions</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: LAYOUT.screenPadBottom }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.intro, { color: C.textMuted }]}>
          A quick reference for the terms you'll see across your training plan, strength sessions, and mobility work.
        </Text>

        {sections.map(section => (
          <View key={section.category} style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
            <Text style={[styles.sectionLabel, { color: C.textDim }]}>{CATEGORY_LABELS[section.category].toUpperCase()}</Text>
            {section.items.map((item: TermDefinition, i) => (
              <TouchableOpacity
                key={item.key}
                style={[
                  styles.row,
                  i < section.items.length - 1 && { borderBottomWidth: 1, borderBottomColor: C.border },
                ]}
                activeOpacity={0.7}
                onPress={() => setActiveTerm(item.key)}
              >
                <Text style={[styles.rowTitle, { color: C.text }]}>{item.label}</Text>
                <Ionicons name="chevron-forward" size={16} color={C.textMuted} />
              </TouchableOpacity>
            ))}
          </View>
        ))}
      </ScrollView>

      <TermDefinitionModal visible={activeTerm !== null} term={activeTerm} onClose={() => setActiveTerm(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingBottom: 10,
  },
  headerLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    fontFamily: 'CormorantGaramond_700Bold',
  },
  intro: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 14,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
});
