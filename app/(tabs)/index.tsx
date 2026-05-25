import { StyleSheet, Text, View } from 'react-native';

export default function DashboardScreen() {
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0F14',
    paddingTop: 100,
    paddingHorizontal: 24,
  },

  logo: {
    color: '#FFFFFF',
    fontSize: 42,
    fontWeight: '800',
    marginBottom: 8,
  },

  headline: {
    color: '#8B9AAF',
    fontSize: 18,
    marginBottom: 40,
  },

  card: {
    backgroundColor: '#151C24',
    borderRadius: 24,
    padding: 24,
    marginBottom: 18,
  },

  cardTitle: {
    color: '#8B9AAF',
    fontSize: 16,
    marginBottom: 12,
  },

  metric: {
    color: '#FFFFFF',
    fontSize: 40,
    fontWeight: '800',
  },

  footer: {
    marginTop: 30,
  },

  footerText: {
    color: '#5F6B7A',
    fontSize: 14,
  },
});
