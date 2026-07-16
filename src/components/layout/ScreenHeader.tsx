import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useColors } from '../../theme/useColors';

type Props = {
  title: string;
  eyebrow?: string;
  onBack?: () => void;
  backLabel?: string;
  right?: ReactNode;
  titleNumberOfLines?: number;
};

/**
 * Shared detail-screen title block. The parent remains responsible for the
 * safe-area inset; this component supplies consistent post-inset headspace,
 * typography, horizontal margins, and a 44-point back target.
 */
export default function ScreenHeader({
  title,
  eyebrow,
  onBack,
  backLabel = 'Back',
  right,
  titleNumberOfLines = 2,
}: Props) {
  const C = useColors();

  return (
    <View style={styles.header}>
      {onBack ? (
        <Pressable
          onPress={onBack}
          style={({ pressed }) => [styles.action, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={backLabel}
          hitSlop={4}
        >
          <Ionicons name="chevron-back" size={25} color={C.text} />
        </Pressable>
      ) : null}
      <View style={styles.copy}>
        {eyebrow ? (
          <Text style={[styles.eyebrow, { color: C.textDim }]} numberOfLines={1}>
            {eyebrow}
          </Text>
        ) : null}
        <Text
          style={[styles.title, { color: C.text }]}
          numberOfLines={titleNumberOfLines}
          ellipsizeMode="tail"
          adjustsFontSizeToFit={titleNumberOfLines === 1}
          minimumFontScale={0.84}
        >
          {title}
        </Text>
      </View>
      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    minHeight: 74,
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 16,
    paddingHorizontal: 14,
    gap: 6,
  },
  action: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  pressed: { opacity: 0.58 },
  copy: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  eyebrow: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '800',
    letterSpacing: 1.25,
    marginBottom: 2,
  },
  title: {
    fontSize: 31,
    lineHeight: 34,
    fontFamily: 'CormorantGaramond_700Bold',
    flexShrink: 1,
  },
  right: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'flex-end',
    justifyContent: 'center',
    flexShrink: 0,
  },
});
