import { StyleSheet, Text, View } from 'react-native';

import { useColors } from '../../theme/useColors';

type Props = {
  label: string;
  value: string;
  detail?: string;
};

export default function ReportStatPill({ label, value, detail }: Props) {
  const C = useColors();
  return (
    <View style={[s.pill, { backgroundColor: C.cardElevated, borderColor: C.border }]}>
      <Text style={[s.label, { color: C.textDim }]}>{label}</Text>
      <Text style={[s.value, { color: C.text }]}>{value}</Text>
      {detail ? <Text style={[s.detail, { color: C.textMuted }]}>{detail}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  pill: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 4,
    flexGrow: 1,
    flexBasis: '47%',
    minWidth: 130,
  },
  label: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  value: {
    fontSize: 24,
    fontWeight: '900',
  },
  detail: {
    fontSize: 12,
    lineHeight: 17,
  },
});
