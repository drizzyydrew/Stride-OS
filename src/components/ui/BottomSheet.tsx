import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '../../theme';

type BottomSheetProps = {
  visible: boolean;
  children: ReactNode;
  onDismiss: () => void;
};

export default function BottomSheet({ visible, children, onDismiss }: BottomSheetProps) {
  const theme = useTheme();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
      <Pressable style={[styles.backdrop, { backgroundColor: theme.colors.overlay }]} onPress={onDismiss}>
        <Pressable style={[styles.sheet, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <View style={[styles.grabber, { backgroundColor: theme.colors.textDim }]} />
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    padding: 20,
    paddingBottom: 32,
    gap: 16,
    borderCurve: 'continuous',
  },
  grabber: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 999,
    opacity: 0.7,
  },
});
