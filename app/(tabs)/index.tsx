import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useThemeColors, type ThemeColors } from '../../src/theme/ThemeContext';

export default function DashboardScreen() {
  const colors = useThemeColors();
  const styles  = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      <Text style={styles.logo}>StrideOS</Text>

      <Text style={styles.headline}>
        Adaptive Endurance Performance
      </Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Aerobic Power</Text>
        <Text style={styles.metric}>82</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Anaerobic Battery</Text>
        <Text style={styles.metric}>71</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Processing Power</Text>
        <Text style={styles.metric}>88</Text>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Science-driven performance coaching
        </Text>
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingTop: 100,
    paddingHorizontal: 24,
  },

  logo: {
    color: colors.text,
    fontSize: 42,
    fontWeight: '800',
    marginBottom: 8,
  },

  headline: {
    color: colors.textMuted,
    fontSize: 18,
    marginBottom: 40,
  },

  card: {
    backgroundColor: colors.card,
    borderRadius: 24,
    padding: 24,
    marginBottom: 18,
  },

  cardTitle: {
    color: colors.textMuted,
    fontSize: 16,
    marginBottom: 12,
  },

  metric: {
    color: colors.text,
    fontSize: 40,
    fontWeight: '800',
  },

  footer: {
    marginTop: 30,
  },

  footerText: {
    color: colors.textDim,
    fontSize: 14,
  },
  });
}
