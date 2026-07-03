import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '../../theme';
import Icon, { type IconName } from './Icon';

type ListRowProps = {
  title: string;
  subtitle?: string;
  value?: string;
  leadingIcon?: IconName;
  trailing?: ReactNode;
  showChevron?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

export default function ListRow({
  title,
  subtitle,
  value,
  leadingIcon,
  trailing,
  showChevron,
  disabled,
  onPress,
  style,
}: ListRowProps) {
  const theme = useTheme();
  const rowStyle = [
    styles.row,
    {
      backgroundColor: theme.colors.card,
      borderColor: theme.colors.border,
      opacity: disabled ? 0.52 : 1,
    },
    style,
  ];

  const content = (
    <>
      {leadingIcon ? (
        <View style={[styles.iconWrap, { backgroundColor: theme.colors.cardAlt }]}>
          <Icon name={leadingIcon} size={20} />
        </View>
      ) : null}
      <View style={styles.textWrap}>
        <Text style={[styles.title, { color: theme.colors.text }]}>{title}</Text>
        {subtitle ? <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>{subtitle}</Text> : null}
      </View>
      {value ? <Text style={[styles.value, { color: theme.colors.textDim }]}>{value}</Text> : null}
      {trailing}
      {showChevron ? <Icon name="chevron-forward" size={18} color={theme.colors.textDim} /> : null}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        style={({ pressed }) => [
          rowStyle,
          !disabled && pressed ? { opacity: 0.78 } : null,
        ]}
      >
        {content}
      </Pressable>
    );
  }

  return (
    <View style={rowStyle}>
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderCurve: 'continuous',
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: {
    flex: 1,
    gap: 3,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  value: {
    fontSize: 13,
    fontWeight: '600',
  },
});
