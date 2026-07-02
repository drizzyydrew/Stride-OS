import { StyleSheet, Text } from 'react-native';
import { useThemeColors } from '../../theme/ThemeContext';
import { FontSize, FontWeight } from '../../theme/tokens';

type Props = {
  title: string;
};

export default function SectionHeader({ title }: Props) {
  const colors = useThemeColors();
  return <Text style={[styles.title, { color: colors.text }]}>{title}</Text>;
}

const styles = StyleSheet.create({
  title: {
    fontSize:     FontSize.hero,
    fontWeight:   FontWeight.black,
    marginBottom: 8,
  },
});
