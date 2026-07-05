import { StyleSheet, Text } from 'react-native';
import Card from './Card';
import { colors } from '../../theme/colors';
import { FontSize, FontWeight } from '../../theme/tokens';

type Props = {
  label:   string;
  value:   string | number;
  helper?: string;
};

export default function MetricCard({ label, value, helper }: Props) {
  return (
    <Card>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
      {helper ? <Text style={styles.helper}>{helper}</Text> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  label: {
    color:        colors.textMuted,
    fontSize:     FontSize.xs,
    fontWeight:   FontWeight.bold,
    letterSpacing: 0.5,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  value: {
    color:      colors.text,
    fontSize:   FontSize.xl,
    fontWeight: FontWeight.black,
  },
  helper: {
    color:     colors.textDim,
    fontSize:  FontSize.base,
    marginTop: 8,
  },
});
