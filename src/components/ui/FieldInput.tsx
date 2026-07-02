import { useMemo } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { useThemeColors, type ThemeColors } from '../../theme/ThemeContext';
import { spacing } from '../../theme/spacing';
import { FontSize, FontWeight, Radius } from '../../theme/tokens';

type Props = {
  label:        string;
  value:        string;
  onChange:     (v: string) => void;
  onBlur?:      () => void;
  placeholder?: string;
  autoCapitalize?: TextInput['props']['autoCapitalize'];
};

export default function FieldInput({
  label,
  value,
  onChange,
  onBlur,
  placeholder,
  autoCapitalize = 'words',
}: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        onBlur={onBlur}
        placeholder={placeholder ?? label}
        placeholderTextColor={colors.textDim}
        autoCapitalize={autoCapitalize}
        returnKeyType="done"
        style={styles.input}
      />
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    label: {
      color:         colors.textMuted,
      fontSize:      11,
      fontWeight:    FontWeight.medium,
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      marginBottom:  spacing.sm,
    },
    input: {
      backgroundColor:   colors.border,
      borderRadius:      Radius.sm,
      paddingHorizontal: spacing.md,
      paddingVertical:   spacing.md,
      color:             colors.text,
      fontSize:          FontSize.md,
      fontWeight:        FontWeight.medium,
    },
  });
}
