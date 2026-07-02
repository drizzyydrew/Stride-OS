import { StyleSheet, Text, View } from 'react-native';
import { useThemeColors } from '../../theme/ThemeContext';
import { FontSize } from '../../theme/tokens';

type Props = {
  label:       string;
  value:       string | number;
  valueColor?: string;
};

export default function StatRow({ label, value, valueColor }: Props) {
  const colors = useThemeColors();
  return (
    <View style={styles.row}>
      <Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.value, { color: valueColor ?? colors.textDim }]}>{value}</Text>
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
    fontSize: FontSize.sm,
  },
  value: {
    fontSize: FontSize.sm,
  },
});
