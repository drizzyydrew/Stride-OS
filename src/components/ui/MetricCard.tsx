import { StyleSheet, Text } from 'react-native';
import Card from './Card';
import { useThemeColors } from '../../theme/ThemeContext';
import { FontSize, FontWeight } from '../../theme/tokens';

type Props = {
  label:   string;
  value:   string | number;
  helper?: string;
};

export default function MetricCard({ label, value, helper }: Props) {
  const colors = useThemeColors();
  return (
    <Card>
      <Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.value, { color: colors.text }]}>{value}</Text>
      {helper ? <Text style={[styles.helper, { color: colors.textDim }]}>{helper}</Text> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize:     FontSize.md,
    marginBottom: 12,
  },
  value: {
    fontSize:   FontSize.xxl,
    fontWeight: FontWeight.black,
  },
  helper: {
    fontSize:  FontSize.base,
    marginTop: 8,
  },
});
