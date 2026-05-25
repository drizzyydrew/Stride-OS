import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../../theme/colors';
import { FontSize } from '../../theme/tokens';

type Props = {
  label:       string;
  value:       string | number;
  valueColor?: string;
};

export default function StatRow({ label, value, valueColor }: Props) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, valueColor ? { color: valueColor } : null]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
  },
  label: {
    color:    colors.textMuted,
    fontSize: FontSize.sm,
  },
  value: {
    color:    colors.textDim,
    fontSize: FontSize.sm,
  },
});
