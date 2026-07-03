import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../../theme';
import Button from './Button';
import Icon, { type IconName } from './Icon';

type EmptyStateProps = {
  title: string;
  message?: string;
  icon?: IconName;
  actionLabel?: string;
  onActionPress?: () => void;
  children?: ReactNode;
};

export default function EmptyState({
  title,
  message,
  icon = 'ellipse-outline',
  actionLabel,
  onActionPress,
  children,
}: EmptyStateProps) {
  const theme = useTheme();

  return (
    <View style={styles.wrap}>
      <View style={[styles.iconWrap, { backgroundColor: theme.colors.cardAlt }]}>
        <Icon name={icon} size={24} color={theme.colors.textMuted} />
      </View>
      <Text style={[styles.title, { color: theme.colors.text }]}>{title}</Text>
      {message ? <Text selectable style={[styles.message, { color: theme.colors.textMuted }]}>{message}</Text> : null}
      {children}
      {actionLabel && onActionPress ? (
        <Button label={actionLabel} onPress={onActionPress} variant="secondary" />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
});
