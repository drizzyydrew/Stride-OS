import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { FontSize, FontWeight, Radius } from '../../theme/tokens';

type Props = {
  label:      string;
  display:    string;   // formatted value string, e.g. "42.6 mi"
  onIncrease: () => void;
  onDecrease: () => void;
};

export default function FieldStepper({ label, display, onIncrease, onDecrease }: Props) {
  return (
    <View style={styles.row}>
      <View style={styles.left}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.display}>{display}</Text>
      </View>

      <View style={styles.controls}>
        <Pressable onPress={onDecrease} style={styles.btn} hitSlop={8}>
          <Text style={styles.btnText}>−</Text>
        </Pressable>
        <Pressable onPress={onIncrease} style={styles.btn} hitSlop={8}>
          <Text style={styles.btnText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
  },
  left: {
    flex: 1,
  },
  label: {
    color:         colors.textMuted,
    fontSize:      11,
    fontWeight:    FontWeight.medium,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom:  4,
  },
  display: {
    color:      colors.text,
    fontSize:   FontSize.xl,
    fontWeight: FontWeight.bold,
  },
  controls: {
    flexDirection: 'row',
    gap:           spacing.sm,
    marginLeft:    spacing.lg,
  },
  btn: {
    width:           40,
    height:          40,
    borderRadius:    Radius.sm,
    backgroundColor: colors.border,
    alignItems:      'center',
    justifyContent:  'center',
  },
  btnText: {
    color:      colors.text,
    fontSize:   FontSize.md,
    fontWeight: FontWeight.bold,
    lineHeight: 20,
  },
});
