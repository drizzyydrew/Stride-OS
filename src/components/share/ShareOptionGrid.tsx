import { StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { useColors } from '../../theme/useColors';

export default function ShareOptionGrid<T extends string>({ options, value, onChange, disabled = false }: {
  options: readonly { id: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  const C = useColors();
  const { fontScale = 1 } = useWindowDimensions();
  return <View style={styles.grid}>
    {options.map(option => <TouchableOpacity key={option.id} onPress={() => onChange(option.id)} disabled={disabled}
      accessibilityRole="button" accessibilityState={{ selected: value === option.id, disabled }}
      style={[styles.option, { flexBasis: 150 * fontScale,
        opacity: disabled ? 0.5 : 1,
        backgroundColor: value === option.id ? C.primaryDim : C.cardAlt,
        borderColor: value === option.id ? C.primary : C.border }]}>
      <Text style={[styles.label, { color: C.text }]}>{option.label}</Text>
    </TouchableOpacity>)}
  </View>;
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: { flexGrow: 1, flexShrink: 1, maxWidth: '100%', minHeight: 56, borderRadius: 8, borderWidth: 1, padding: 12, justifyContent: 'center' },
  label: { fontSize: 14, fontWeight: '900' },
});
