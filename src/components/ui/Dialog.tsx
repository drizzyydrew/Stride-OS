import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../../theme';
import Button from './Button';

type DialogAction = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
};

type DialogProps = {
  visible: boolean;
  title: string;
  message?: string;
  primaryAction?: DialogAction;
  secondaryAction?: DialogAction;
  onDismiss: () => void;
};

export default function Dialog({
  visible,
  title,
  message,
  primaryAction,
  secondaryAction,
  onDismiss,
}: DialogProps) {
  const theme = useTheme();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <Pressable style={[styles.backdrop, { backgroundColor: theme.colors.overlay }]} onPress={onDismiss}>
        <Pressable
          accessibilityRole="alert"
          style={[styles.dialog, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
        >
          <Text style={[styles.title, { color: theme.colors.text }]}>{title}</Text>
          {message ? <Text selectable style={[styles.message, { color: theme.colors.textMuted }]}>{message}</Text> : null}
          <View style={styles.actions}>
            {secondaryAction ? (
              <Button
                label={secondaryAction.label}
                onPress={secondaryAction.onPress}
                variant={secondaryAction.variant ?? 'secondary'}
                style={styles.action}
              />
            ) : null}
            {primaryAction ? (
              <Button
                label={primaryAction.label}
                onPress={primaryAction.onPress}
                variant={primaryAction.variant ?? 'primary'}
                style={styles.action}
              />
            ) : null}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  dialog: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 20,
    gap: 14,
    borderCurve: 'continuous',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  message: {
    fontSize: 13,
    lineHeight: 18,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  action: {
    flex: 1,
  },
});
