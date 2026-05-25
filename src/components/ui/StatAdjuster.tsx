import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { Radius, FontSize, FontWeight } from '../../theme/tokens';

type Props = {
  label:    string;
  value:    number;
  increase: () => void;
  decrease: () => void;
};

export default function StatAdjuster({ label, value, increase, decrease }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}: {value}</Text>

      <View style={styles.buttonRow}>
        <Pressable onPress={decrease} style={[styles.button, styles.minus]}>
          <Text style={styles.buttonText}>-</Text>
        </Pressable>

        <Pressable onPress={increase} style={[styles.button, styles.plus]}>
          <Text style={styles.buttonText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.xl,
  },
  label: {
    color:        colors.textMuted,
    marginBottom: spacing.md,
    fontSize:     FontSize.md,
  },
  buttonRow: {
    flexDirection: 'row',
    gap:           spacing.md,
  },
  button: {
    flex:         1,
    padding:      spacing.lg,
    borderRadius: Radius.md,
    alignItems:   'center',
  },
  minus: {
    backgroundColor: colors.danger,
  },
  plus: {
    backgroundColor: colors.primary,
  },
  buttonText: {
    color:      colors.text,
    fontWeight: FontWeight.black,
    fontSize:   20,
  },
});
