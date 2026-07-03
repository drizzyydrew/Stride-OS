import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useColors } from '../../../src/theme/useColors';
import { useSettingsStore } from '../../../src/store/settingsStore';
import { LAYOUT } from '../../../src/constants/layout';

const WEEK_HEIGHTS = [52, 62, 57, 71, 75, 68, 85, 100];
const WEEK_OPACITIES = [0.35, 0.44, 0.52, 0.62, 0.70, 0.78, 0.88, 1];

export default function AnalyticsScreen() {
  const C = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { units } = useSettingsStore();
  const imp = units === 'imperial';
  const pace = imp ? "9'14\"" : "5'44\"";
  const pUnit = imp ? '/mi' : '/km';
  const totalDist = imp ? '18.4 mi' : '29.6 km';

  const hrZones = [
    { width: 8,  color: C.textDim },
    { width: 62, color: C.primary },
    { width: 18, color: C.warning },
    { width: 10, color: C.accent },
    { width: 2,  color: C.critical },
  ];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: C.bg }}
      contentContainerStyle={{ paddingHorizontal: 18, paddingTop: insets.top + 6, paddingBottom: LAYOUT.screenPadBottom }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={20} color={C.primary} />
        </TouchableOpacity>
        <View style={{ marginLeft: 10 }}>
          <Text style={[styles.headerLabel, { color: C.textDim }]}>ANALYTICS</Text>
          <Text style={[styles.headerTitle, { color: C.text }]}>Last 8 Weeks</Text>
        </View>
      </View>

      {/* Training Load */}
      <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
        <View style={styles.cardHeaderRow}>
          <Text style={[styles.metaText, { color: C.textMuted }]}>Training Load</Text>
          <Text style={[{ fontSize: 12, fontWeight: '700', color: C.positive }]}>↑ Progressing</Text>
        </View>
        <View style={[styles.barChart]}>
          {WEEK_HEIGHTS.map((h, i) => (
            <View
              key={i}
              style={[
                styles.bar,
                {
                  height: `${h}%`,
                  backgroundColor: C.primary,
                  opacity: WEEK_OPACITIES[i],
                },
              ]}
            />
          ))}
        </View>
        <View style={[{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }]}>
          {['W1','W2','W3','W4','W5','W6','W7','W8'].map(w => (
            <Text key={w} style={[{ fontSize: 10, color: C.textDim }]}>{w}</Text>
          ))}
        </View>
      </View>

      {/* Avg Pace */}
      <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
        <View>
          <Text style={[styles.metaText, { color: C.textDim, marginBottom: 4 }]}>Avg Pace · Last 4 Weeks</Text>
          <Text style={[{ fontSize: 36, fontWeight: '800', color: C.text, lineHeight: 40 }]}>
            {pace}<Text style={[{ fontSize: 14, fontWeight: '400', color: C.textMuted }]}> {pUnit}</Text>
          </Text>
        </View>
        <Text style={[{ fontSize: 13, fontWeight: '700', color: C.positive }]}>↓ 0:22 faster</Text>
      </View>

      {/* Stats row */}
      <View style={styles.statRow}>
        <View style={[styles.statCard, { backgroundColor: C.card, borderColor: C.border }]}>
          <Text style={[styles.statCardLabel, { color: C.textDim }]}>TOTAL</Text>
          <Text style={[styles.statCardVal, { color: C.text }]}>{totalDist}</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: C.card, borderColor: C.border }]}>
          <Text style={[styles.statCardLabel, { color: C.textDim }]}>RUNS</Text>
          <Text style={[styles.statCardVal, { color: C.text }]}>42</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: C.card, borderColor: C.border }]}>
          <Text style={[styles.statCardLabel, { color: C.textDim }]}>PR 5K</Text>
          <Text style={[styles.statCardVal, { color: C.text }]}>24:12</Text>
        </View>
      </View>

      {/* HR Zone Distribution */}
      <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
        <Text style={[styles.metaText, { color: C.textMuted, marginBottom: 10 }]}>HR Zone Distribution · Last 4 Weeks</Text>
        <View style={[{ flexDirection: 'row', height: 18, borderRadius: 6, overflow: 'hidden', marginBottom: 8 }]}>
          {hrZones.map((z, i) => (
            <View key={i} style={[{ width: `${z.width}%`, backgroundColor: z.color }]} />
          ))}
        </View>
        <Text style={[{ fontSize: 12, color: C.textMuted, lineHeight: 18, marginBottom: 10 }]}>
          Aerobic base solid at 70% Z1–Z2. Ready for quality work.
        </Text>
      </View>

      {/* Adaptive Performance */}
      <TouchableOpacity
        style={[styles.card, styles.adaptiveCard, { backgroundColor: C.card, borderColor: C.border }]}
        onPress={() => router.push('/(tabs)/performance' as any)}
        activeOpacity={0.84}
      >
        <View style={styles.cardHeaderRow}>
          <Text style={[styles.metaText, { color: C.textMuted }]}>Adaptive Performance</Text>
          <Text style={[{ fontSize: 12, fontWeight: '700', color: C.primary }]}>Open →</Text>
        </View>
        <View style={styles.adaptiveTopRow}>
          <View>
            <Text style={[styles.adaptiveLabel, { color: C.textDim }]}>OVERALL SCORE</Text>
            <Text style={[styles.adaptiveScore, { color: C.text }]}>82</Text>
          </View>
          <Text style={[styles.adaptiveCopy, { color: C.textMuted }]}>
            Updates as you train and improve.
          </Text>
        </View>
        <View style={[styles.adaptiveBar, { backgroundColor: C.border }]}>
          <View style={[styles.adaptiveBarFill, { backgroundColor: C.primary, width: '82%' }]} />
        </View>
        <View style={styles.adaptiveMetricRow}>
          {[
            { label: 'Aerobic', value: 82, color: C.positive },
            { label: 'Anaerobic', value: 71, color: C.warning },
            { label: 'Processing', value: 88, color: C.accent },
          ].map(metric => (
            <View key={metric.label} style={[styles.adaptiveMetric, { backgroundColor: C.cardAlt }]}>
              <Text style={[styles.adaptiveMetricLabel, { color: C.textDim }]}>{metric.label}</Text>
              <Text style={[styles.adaptiveMetricValue, { color: metric.color }]}>{metric.value}</Text>
            </View>
          ))}
        </View>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  headerLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '700',
    fontFamily: 'CormorantGaramond_700Bold',
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 10,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  metaText: {
    fontSize: 12,
    fontWeight: '700',
  },
  barChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 80,
    gap: 5,
  },
  bar: {
    flex: 1,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  statRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  statCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    alignItems: 'center',
  },
  statCardLabel: {
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statCardVal: {
    fontSize: 22,
    fontWeight: '800',
  },
  adaptiveCard: {
    paddingBottom: 14,
  },
  adaptiveTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
    alignItems: 'flex-end',
    marginBottom: 12,
  },
  adaptiveLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  adaptiveScore: {
    fontSize: 54,
    fontWeight: '800',
    lineHeight: 58,
  },
  adaptiveCopy: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'right',
    marginBottom: 7,
  },
  adaptiveBar: {
    height: 8,
    borderRadius: 999,
    overflow: 'hidden',
    marginBottom: 12,
  },
  adaptiveBarFill: {
    height: '100%',
    borderRadius: 999,
  },
  adaptiveMetricRow: {
    flexDirection: 'row',
    gap: 8,
  },
  adaptiveMetric: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  adaptiveMetricLabel: {
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 2,
  },
  adaptiveMetricValue: {
    fontSize: 22,
    fontWeight: '800',
  },
});
