import { Modal as NativeModal, Pressable, StyleSheet, View, type ModalProps } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '../../theme/useColors';
import BrandChevrons from './BrandChevrons';

type Props = Omit<ModalProps, 'onRequestClose'> & { onRequestClose: () => void };

// Every exit uses the owner's cancellation/unsaved-work guard, never approval.
export default function RecoverableModal({ children, onRequestClose, ...props }: Props) {
  const C = useColors();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  return <NativeModal {...props} animationType={reduceMotion ? 'none' : 'slide'} onRequestClose={onRequestClose}>
    <View style={[styles.root, !props.transparent && { backgroundColor: C.bg }]} accessibilityViewIsModal onAccessibilityEscape={onRequestClose}>
      <View style={[styles.bar, { paddingTop: insets.top, backgroundColor: C.bg }]}>
        <Pressable onPress={onRequestClose} style={styles.close} accessibilityRole="button" accessibilityLabel="Close window">
          <BrandChevrons direction="down" />
        </Pressable>
      </View>
      <View style={styles.body}>{children}</View>
    </View>
  </NativeModal>;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { flex: 1 },
  bar: { paddingHorizontal: 12, paddingBottom: 2 },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
