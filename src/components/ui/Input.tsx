import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { useTheme } from '../../theme';

type InputProps = TextInputProps & {
  label?: string;
  helperText?: string;
  errorText?: string;
};

export default function Input({ label, helperText, errorText, style, ...props }: InputProps) {
  const theme = useTheme();
  const describedBy = errorText ?? helperText;

  return (
    <View style={styles.wrap}>
      {label ? <Text style={[styles.label, { color: theme.colors.textMuted }]}>{label}</Text> : null}
      <TextInput
        {...props}
        accessibilityLabel={props.accessibilityLabel ?? label}
        accessibilityHint={describedBy}
        placeholderTextColor={theme.colors.textDim}
        style={[
          styles.input,
          {
            backgroundColor: theme.colors.card,
            borderColor: errorText ? theme.colors.critical : theme.colors.border,
            color: theme.colors.text,
          },
          style,
        ]}
      />
      {describedBy ? (
        <Text selectable style={[styles.helper, { color: errorText ? theme.colors.critical : theme.colors.textDim }]}>
          {describedBy}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
  },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    fontWeight: '600',
    borderCurve: 'continuous',
  },
  helper: {
    fontSize: 12,
    lineHeight: 16,
  },
});
