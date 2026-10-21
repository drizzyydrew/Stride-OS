import { StyleSheet, Text, View } from 'react-native';

// Single source of the StrideOS wordmark + chevron row used by every share-card layout
// (ShareStudio's movable/fixed brand layer and AchievementShareCard's static brand rows).
export const SHARE_CHEVRON_COLORS = ['#B8C4A9', '#A6C0B4', '#E3CDB8', '#78A3BE', '#5E7E92'];

export default function ShareBrandMark({ darkInk = false, showChevrons = true }: { darkInk?: boolean; showChevrons?: boolean }) {
  return (
    <View style={[styles.logoMark, !showChevrons && styles.wordmarkOnly]} accessible accessibilityLabel="StrideOS logo">
      <Text allowFontScaling={false} style={styles.logoWord}>
        <Text style={[styles.logoStride, darkInk && { color: '#24201C' }]}>Stride</Text>
        <Text style={styles.logoOS}>OS</Text>
      </Text>
      {showChevrons ? <View style={styles.logoChevronRow}>
        {SHARE_CHEVRON_COLORS.map((color, index) => (
          <Text allowFontScaling={false} key={`${color}-${index}`} style={[styles.logoChevron, { color }]}>{'>'}</Text>
        ))}
      </View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  logoMark: { width: 112, minHeight: 74, alignItems: 'center', justifyContent: 'center' },
  wordmarkOnly: { minHeight: 30 },
  logoWord: { fontSize: 25, lineHeight: 30, fontWeight: '900', fontFamily: 'CormorantGaramond_700Bold' },
  logoStride: { color: '#F3F1EB' },
  logoOS: { color: '#6F97B0' },
  logoChevronRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 5 },
  logoChevron: { fontSize: 27, lineHeight: 28, fontWeight: '900' },
});
