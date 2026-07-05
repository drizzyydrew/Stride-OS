import { StyleSheet, Text, View } from 'react-native';
import { Radius } from '../../theme/tokens';

type Props = {
  label: string;
  bg:    string;
  color: string;
};

export default function Badge({ label, bg, color }: Props) {
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.label, { color }]}>{label.toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical:    4,
    borderRadius:      Radius.sm,
  },
  label: {
    fontSize:      10,
    fontWeight:    '700',
    letterSpacing: 0.5,
  },
});
