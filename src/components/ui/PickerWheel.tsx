import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Button from './Button';
import { useColors } from '../../theme/useColors';
import { spacing } from '../../theme/spacing';
import { FontSize, FontWeight } from '../../theme/tokens';
import { composeDistanceHundredths, decomposeDistanceHundredths } from '../../utils/units';

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
  renderExtra?:  (selectedValue: string) => ReactNode;
  onDraftChange?: (value: string) => void;
  onConfirm:     (value: string) => void;
  onClose:       () => void;
};

type DistanceHundredthsPickerWheelProps = {
  visible:       boolean;
  title:         string;
  unitLabel:     string;
  selectedValue: number;
  confirmLabel?: string;
  onConfirm:     (value: number) => void;
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
        accessibilityHint="Swipe up or down to adjust the selected value."
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
          style={styles.wheelList}
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

function PickerSheet({
  visible,
  title,
  subtitle,
  selectedLabel,
  children,
  footer,
  onClose,
}: {
  visible: boolean;
  title: string;
  subtitle?: string;
  selectedLabel?: string;
  children: ReactNode;
  footer: ReactNode;
  onClose: () => void;
}) {
  const C = useColors();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay} pointerEvents="auto">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboardWrap}>
          <View style={[styles.sheet, { backgroundColor: C.card, borderColor: C.border, paddingBottom: Math.max(insets.bottom, 16) }]}>
            <View style={[styles.dragIndicator, { backgroundColor: C.border }]} />
            <View style={styles.header}>
              <Text style={[styles.title, { color: C.text }]}>{title}</Text>
              {subtitle ? <Text style={[styles.subtitle, { color: C.textDim }]}>{subtitle}</Text> : null}
            </View>
            <View style={styles.viewport}>
              {children}
            </View>
            {selectedLabel ? (
              <Text accessibilityLiveRegion="polite" style={[styles.selectedLabel, { color: C.primary }]}>{selectedLabel}</Text>
            ) : null}
            <View style={[styles.divider, { backgroundColor: C.border }]} />
            <View style={styles.actions}>
              {footer}
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
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
    <PickerSheet
      visible={visible}
      title={title}
      selectedLabel={format(selected)}
      onClose={onClose}
      footer={(
        <>
          <Button label="Cancel" onPress={onClose} variant="secondary" style={{ flex: 1 }} />
          <Button label="Confirm" onPress={() => onConfirm(selected)} style={{ flex: 1 }} />
        </>
      )}
    >
      <WheelColumn
        values={values}
        selectedValue={selected}
        visible={visible}
        formatValue={value => format(Number(value))}
        onChange={value => setSelected(Number(value))}
      />
    </PickerSheet>
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
    <PickerSheet
      visible={visible}
      title={title}
      subtitle={subtitle}
      selectedLabel={columns.map(column => column.formatValue?.(selectedValues[column.id] ?? column.selectedValue) ?? String(selectedValues[column.id] ?? column.selectedValue)).join(' ')}
      onClose={onClose}
      footer={(
        <>
          <Button label="Cancel" onPress={onClose} variant="secondary" style={{ flex: 1 }} />
          <Button label={confirmLabel} onPress={() => onConfirm(selectedValues)} disabled={disabled} style={{ flex: 1 }} />
        </>
      )}
    >
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
    </PickerSheet>
  );
}

export function ChoicePickerWheel({
  visible, title, subtitle, values, selectedValue, confirmLabel = 'Confirm', renderExtra, onDraftChange, onConfirm, onClose,
}: ChoicePickerWheelProps) {
  const C = useColors();
  const [selected, setSelected] = useState<string>(selectedValue);

  useEffect(() => {
    if (visible) setSelected(selectedValue);
  }, [selectedValue, visible]);

  const labels = useMemo(() => new Map(values.map(value => [value.value, value.label])), [values]);
  const format = (value: PickerValue) => labels.get(String(value)) ?? String(value);
  const changeSelected = (value: PickerValue) => {
    const next = String(value);
    setSelected(next);
    onDraftChange?.(next);
  };

  return (
    <PickerSheet
      visible={visible}
      title={title}
      subtitle={subtitle}
      selectedLabel={format(selected)}
      onClose={onClose}
      footer={(
        <>
          <Button label="Cancel" onPress={onClose} variant="secondary" style={{ flex: 1 }} />
          <Button label={confirmLabel} onPress={() => onConfirm(selected)} style={{ flex: 1 }} />
        </>
      )}
    >
      <WheelColumn
        values={values.map(value => value.value)}
        selectedValue={selected}
        visible={visible}
        formatValue={format}
        onChange={changeSelected}
      />
      {renderExtra?.(selected)}
    </PickerSheet>
  );
}

export function DistanceHundredthsPickerWheel({
  visible, title, unitLabel, selectedValue, confirmLabel = 'Confirm', onConfirm, onClose,
}: DistanceHundredthsPickerWheelProps) {
  const C = useColors();
  const parts = decomposeDistanceHundredths(selectedValue);
  const [selectedValues, setSelectedValues] = useState<Record<string, number>>(() => ({
    whole: parts.whole,
    tenths: parts.tenths,
    hundredths: parts.hundredths,
  }));

  useEffect(() => {
    if (!visible) return;
    const next = decomposeDistanceHundredths(selectedValue);
    setSelectedValues({ whole: next.whole, tenths: next.tenths, hundredths: next.hundredths });
  }, [selectedValue, visible]);

  const composed = composeDistanceHundredths(
    selectedValues.whole ?? 0,
    selectedValues.tenths ?? 0,
    selectedValues.hundredths ?? 0,
  );
  const wholeValues = Array.from({ length: 101 }, (_, index) => index);
  const digitValues = Array.from({ length: 10 }, (_, index) => index);
  const change = (key: string, value: PickerValue) => {
    setSelectedValues(previous => ({ ...previous, [key]: Number(value) }));
  };

  return (
    <PickerSheet
      visible={visible}
      title={title}
      subtitle="Whole number, tenths, and hundredths compose the stored distance without floating-point accumulation."
      selectedLabel={`${composed.toFixed(2)} ${unitLabel}`}
      onClose={onClose}
      footer={(
        <>
          <Button label="Cancel" onPress={onClose} variant="secondary" style={{ flex: 1 }} />
          <Button label={confirmLabel} onPress={() => onConfirm(composed)} disabled={composed <= 0 || composed > 100} style={{ flex: 1 }} />
        </>
      )}
    >
      <View style={styles.distanceColumnsRow}>
        <WheelColumn title="Whole" values={wholeValues} selectedValue={selectedValues.whole ?? 0} visible={visible} onChange={value => change('whole', value)} />
        <View style={styles.decimalColumn} accessible={false}>
          <Text style={[styles.decimalText, { color: C.text }]}>.</Text>
        </View>
        <WheelColumn title="Tenths" values={digitValues} selectedValue={selectedValues.tenths ?? 0} visible={visible} onChange={value => change('tenths', value)} />
        <WheelColumn title="Hundredths" values={digitValues} selectedValue={selectedValues.hundredths ?? 0} visible={visible} onChange={value => change('hundredths', value)} />
        <View style={styles.unitColumn} accessible accessibilityLabel={`Distance unit ${unitLabel}`}>
          <Text style={[styles.unitText, { color: C.text }]}>{unitLabel}</Text>
        </View>
      </View>
    </PickerSheet>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  keyboardWrap: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    maxHeight: '88%',
  },
  dragIndicator: {
    width: 44,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  header: {
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  title: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: FontSize.sm,
    textAlign: 'center',
  },
  viewport: {
    minHeight: ITEM_HEIGHT * VISIBLE_ROWS,
    maxHeight: ITEM_HEIGHT * VISIBLE_ROWS + 96,
    justifyContent: 'center',
  },
  columnsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  distanceColumnsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
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
    marginBottom: 0,
  },
  wheelList: {
    height: ITEM_HEIGHT * VISIBLE_ROWS,
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
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  divider: {
    height: 1,
    marginBottom: spacing.md,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingBottom: spacing.xs,
  },
  decimalColumn: {
    width: 12,
    height: ITEM_HEIGHT * VISIBLE_ROWS,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing.lg,
  },
  decimalText: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.black,
  },
  unitColumn: {
    width: 34,
    height: ITEM_HEIGHT * VISIBLE_ROWS,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing.lg,
  },
  unitText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.black,
  },
});
