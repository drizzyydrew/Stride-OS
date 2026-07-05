import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import Button from './Button';
import { useColors } from '../../theme/useColors';
import { spacing } from '../../theme/spacing';
import { FontSize, FontWeight } from '../../theme/tokens';

const ITEM_HEIGHT = 48;
const VISIBLE_ROWS = 5;

type Props = {
  visible:        boolean;
  title:          string;
  values:         number[];
  selectedValue:  number;
  formatValue?:   (v: number) => string;
  onConfirm:      (v: number) => void;
  onClose:        () => void;
};

// Generic iOS-style scrolling picker wheel: snap-to-interval FlatList with a
// highlighted center row. Pass any numeric value list (weight increments,
// RPE 1-10, reps, etc.) and an optional formatter for the display label.
export default function PickerWheel({
  visible, title, values, selectedValue, formatValue, onConfirm, onClose,
}: Props) {
  const C = useColors();
  const [selected, setSelected] = useState(selectedValue);
  const listRef = useRef<FlatList<number>>(null);

  useEffect(() => { setSelected(selectedValue); }, [selectedValue, visible]);

  useEffect(() => {
    if (!visible) return;
    const idx = values.indexOf(selected);
    if (idx >= 0) {
      setTimeout(() => {
        listRef.current?.scrollToIndex({ index: idx, animated: false, viewPosition: 0.5 });
      }, 50);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const format = formatValue ?? ((v: number) => String(v));

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: C.card }]}>
          <Text style={[styles.title, { color: C.text }]}>{title}</Text>

          <View style={styles.pickerContainer}>
            <View style={[styles.highlight, { borderColor: C.primary }]} />
            <FlatList
              ref={listRef}
              data={values}
              keyExtractor={item => String(item)}
              getItemLayout={(_, index) => ({
                length: ITEM_HEIGHT,
                offset: ITEM_HEIGHT * 2 + ITEM_HEIGHT * index,
                index,
              })}
              snapToInterval={ITEM_HEIGHT}
              decelerationRate="fast"
              showsVerticalScrollIndicator={false}
              style={{ height: ITEM_HEIGHT * VISIBLE_ROWS }}
              contentContainerStyle={{ paddingVertical: ITEM_HEIGHT * 2 }}
              onMomentumScrollEnd={e => {
                const idx = Math.round(e.nativeEvent.contentOffset.y / ITEM_HEIGHT);
                setSelected(values[Math.max(0, Math.min(idx, values.length - 1))]);
              }}
              renderItem={({ item }) => (
                <Pressable style={styles.item} onPress={() => setSelected(item)}>
                  <Text style={[
                    styles.itemText,
                    { color: C.textDim },
                    item === selected && [styles.itemTextActive, { color: C.text }],
                  ]}>
                    {format(item)}
                  </Text>
                </Pressable>
              )}
            />
          </View>

          <Text style={[styles.selectedLabel, { color: C.primary }]}>{format(selected)}</Text>

          <View style={styles.actions}>
            <Button label="Cancel" onPress={onClose} variant="secondary" style={{ flex: 1 }} />
            <Button label="Confirm" onPress={() => onConfirm(selected)} style={{ flex: 1 }} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing.xl,
    paddingBottom: 40,
  },
  title: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  pickerContainer: {
    height: ITEM_HEIGHT * VISIBLE_ROWS,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: spacing.sm,
  },
  highlight: {
    position: 'absolute',
    top: ITEM_HEIGHT * 2,
    left: 0,
    right: 0,
    height: ITEM_HEIGHT,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    zIndex: 1,
    pointerEvents: 'none',
  },
  item: {
    height: ITEM_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemText: {
    fontSize: FontSize.lg,
  },
  itemTextActive: {
    fontWeight: FontWeight.black,
    fontSize: FontSize.xl,
  },
  selectedLabel: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
});
