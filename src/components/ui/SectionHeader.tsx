import { StyleSheet, Text } from 'react-native';
import { colors } from '../../theme/colors';
import { FontSize, FontWeight } from '../../theme/tokens';

type Props = {
  title: string;
};

export default function SectionHeader({ title }: Props) {
  return <Text style={styles.title}>{title}</Text>;
}

const styles = StyleSheet.create({
  title: {
    color:        colors.text,
    fontSize:     FontSize.hero,
    fontWeight:   FontWeight.medium,
    marginBottom: 8,
  },
});
