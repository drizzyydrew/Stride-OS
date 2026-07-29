import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import Button from './Button';
import { useColors } from '../../theme/useColors';
import { spacing } from '../../theme/spacing';
import { FontSize, FontWeight } from '../../theme/tokens';

const ITEM_HEIGHT = 48;
const VISIBLE_ROWS = 5;
type PickerValue = string | number;

type Props = {
  visible:        boolean;
  title:          string;
  values:         number[];
  selectedValue:  number;
  formatValue?:   (v: number) => string;
  onConfirm:      (v: number) => void;
  onClose:        () => void;
};

type WheelColumnProps = {
  title?:         string;
  values:         PickerValue[];
  selectedValue:  PickerValue;
  visible:        boolean;
  formatValue?:   (v: PickerValue) => string;
  onChange:       (v: PickerValue) => void;
};

type TwoColumnPickerWheelColumn = {
  id:             string;
  title:          string;
  values:         number[];
  selectedValue:  number;
  formatValue?:   (v: number) => string;
};

type TwoColumnPickerWheelProps = {
  visible:          boolean;
  title:            string;
  subtitle?:        string;
  columns:          [TwoColumnPickerWheelColumn, TwoColumnPickerWheelColumn];
  confirmLabel?:    string;
  confirmDisabled?: (values: Record<string, number>) => boolean;
  onConfirm:        (values: Record<string, number>) => void;
  onClose:          () => void;
};

type ChoicePickerWheelProps = {
  visible:       boolean;
  title:         string;
  subtitle?:     string;
  values:        { value: string; label: string }[];
  selectedValue: string;
  confirmLabel?: string;
  onConfirm:     (value: string) => void;
  onClose:       () => void;
};

function WheelColumn({
  title, values, selectedValue, visible, formatValue, onChange,
}: WheelColumnProps) {
  const C = useColors();
  const listRef = useRef<FlatList<PickerValue>>(null);
  const format = formatValue ?? ((v: PickerValue) => String(v));

  useEffect(() => {
    if (!visible) return;
    const idx = values.indexOf(selectedValue);
    if (idx >= 0) {
      setTimeout(() => {
        listRef.current?.scrollToIndex({ index: idx, animated: false, viewPosition: 0.5 });
      }, 50);
    }
  }, [selectedValue, values, visible]);

  const adjustSelection = (delta: number) => {
    const currentIndex = Math.max(0, values.indexOf(selectedValue));
    const nextIndex = Math.max(0, Math.min(values.length - 1, currentIndex + delta));
    const next = values[nextIndex];
    onChange(next);
    listRef.current?.scrollToIndex({ index: nextIndex, animated: true, viewPosition: 0.5 });
  };

  return (
    <View style={styles.column}>
      {title ? <Text style={[styles.columnTitle, { color: C.textDim }]}>{title}</Text> : null}
      <View
        style={styles.pickerContainer}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={title ?? 'Picker'}
        accessibilityValue={{ text: format(selectedValue) }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={event => {
          if (event.nativeEvent.actionName === 'increment') adjustSelection(1);
          if (event.nativeEvent.actionName === 'decrement') adjustSelection(-1);
        }}
      >
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
            onChange(values[Math.max(0, Math.min(idx, values.length - 1))]);
          }}
          renderItem={({ item }) => (
            <Pressable style={styles.item} onPress={() => onChange(item)}>
              <Text style={[
                styles.itemText,
                { color: C.textDim },
                item === selectedValue && [styles.itemTextActive, { color: C.text }],
              ]}>
                {format(item)}
              </Text>
            </Pressable>
          )}
        />
      </View>
    </View>
  );
}

// Generic iOS-style scrolling picker wheel: snap-to-interval FlatList with a
// highlighted center row. Pass any numeric value list (weight increments,
// RPE 1-10, reps, etc.) and an optional formatter for the display label.
export default function PickerWheel({
  visible, title, values, selectedValue, formatValue, onConfirm, onClose,
}: Props) {
  const C = useColors();
  const [selected, setSelected] = useState(selectedValue);

  useEffect(() => { setSelected(selectedValue); }, [selectedValue, visible]);

  const format = formatValue ?? ((v: number) => String(v));

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: C.card }]}>
          <Text style={[styles.title, { color: C.text }]}>{title}</Text>

          <WheelColumn
            values={values}
            selectedValue={selected}
            visible={visible}
            formatValue={value => format(Number(value))}
            onChange={value => setSelected(Number(value))}
          />

          <Text accessibilityLiveRegion="polite" style={[styles.selectedLabel, { color: C.primary }]}>{format(selected)}</Text>

          <View style={styles.actions}>
            <Button label="Cancel" onPress={onClose} variant="secondary" style={{ flex: 1 }} />
            <Button label="Confirm" onPress={() => onConfirm(selected)} style={{ flex: 1 }} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

export function TwoColumnPickerWheel({
  visible, title, subtitle, columns, confirmLabel = 'Confirm', confirmDisabled, onConfirm, onClose,
}: TwoColumnPickerWheelProps) {
  const C = useColors();
  const [selectedValues, setSelectedValues] = useState<Record<string, number>>(() => ({
    [columns[0].id]: columns[0].selectedValue,
    [columns[1].id]: columns[1].selectedValue,
  }));

  useEffect(() => {
    if (!visible) return;
    setSelectedValues({
      [columns[0].id]: columns[0].selectedValue,
      [columns[1].id]: columns[1].selectedValue,
    });
  }, [columns, visible]);

  const disabled = confirmDisabled?.(selectedValues) ?? false;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: C.card }]}>
          <Text style={[styles.title, { color: C.text }]}>{title}</Text>
          {subtitle ? <Text style={[styles.subtitle, { color: C.textDim }]}>{subtitle}</Text> : null}

          <View style={styles.columnsRow}>
            {columns.map(column => (
              <WheelColumn
                key={column.id}
                title={column.title}
                values={column.values}
                selectedValue={selectedValues[column.id] ?? column.selectedValue}
                visible={visible}
                formatValue={value => column.formatValue?.(Number(value)) ?? String(value)}
                onChange={value => setSelectedValues(previous => ({ ...previous, [column.id]: Number(value) }))}
              />
            ))}
          </View>

          <Text accessibilityLiveRegion="polite" style={[styles.selectedLabel, { color: C.primary }]}>
            {columns.map(column => column.formatValue?.(selectedValues[column.id] ?? column.selectedValue) ?? String(selectedValues[column.id] ?? column.selectedValue)).join(' ')}
          </Text>

          <View style={styles.actions}>
            <Button label="Cancel" onPress={onClose} variant="secondary" style={{ flex: 1 }} />
            <Button label={confirmLabel} onPress={() => onConfirm(selectedValues)} disabled={disabled} style={{ flex: 1 }} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

export function ChoicePickerWheel({
  visible, title, subtitle, values, selectedValue, confirmLabel = 'Confirm', onConfirm, onClose,
}: ChoicePickerWheelProps) {
  const C = useColors();
  const [selected, setSelected] = useState<string>(selectedValue);

  useEffect(() => {
    if (visible) setSelected(selectedValue);
  }, [selectedValue, visible]);

  const labels = useMemo(() => new Map(values.map(value => [value.value, value.label])), [values]);
  const format = (value: PickerValue) => labels.get(String(value)) ?? String(value);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: C.card }]}>
          <Text style={[styles.title, { color: C.text }]}>{title}</Text>
          {subtitle ? <Text style={[styles.subtitle, { color: C.textDim }]}>{subtitle}</Text> : null}
          <WheelColumn
            values={values.map(value => value.value)}
            selectedValue={selected}
            visible={visible}
            formatValue={format}
            onChange={value => setSelected(String(value))}
          />
          <Text accessibilityLiveRegion="polite" style={[styles.selectedLabel, { color: C.primary }]}>
            {format(selected)}
          </Text>
          <View style={styles.actions}>
            <Button label="Cancel" onPress={onClose} variant="secondary" style={{ flex: 1 }} />
            <Button label={confirmLabel} onPress={() => onConfirm(selected)} style={{ flex: 1 }} />
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
  subtitle: {
    fontSize: FontSize.sm,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  columnsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  column: {
    flex: 1,
    minWidth: 0,
  },
  columnTitle: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
    textAlign: 'center',
    textTransform: 'uppercase',
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
