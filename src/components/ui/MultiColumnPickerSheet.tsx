import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import Button from './Button';
import { useColors } from '../../theme/useColors';
import { spacing } from '../../theme/spacing';
import { FontSize, FontWeight } from '../../theme/tokens';

export type PickerColumn<T extends string | number> = {
  key: string;
  title: string;
  values: T[];
  selectedValue: T;
  formatValue?: (value: T) => string;
};

type Props<T extends string | number> = {
  visible: boolean;
  title: string;
  columns: PickerColumn<T>[];
  onConfirm: (values: Record<string, T>) => void;
  onClose: () => void;
};

export default function MultiColumnPickerSheet<T extends string | number>({
  visible,
  title,
  columns,
  onConfirm,
  onClose,
}: Props<T>) {
  const C = useColors();
  const initial = useMemo(
    () => Object.fromEntries(columns.map(column => [column.key, column.selectedValue])) as Record<string, T>,
    [columns],
  );
  const [selected, setSelected] = useState<Record<string, T>>(initial);

  useEffect(() => {
    if (visible) setSelected(initial);
  }, [initial, visible]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: C.card, borderColor: C.border }]}>
          <Text style={[styles.title, { color: C.text }]}>{title}</Text>
          <View style={styles.columns}>
            {columns.map(column => {
              const format = column.formatValue ?? ((value: T) => String(value));
              return (
                <View key={column.key} style={styles.column}>
                  <Text style={[styles.columnTitle, { color: C.textDim }]}>{column.title}</Text>
                  <ScrollView
                    style={[styles.valueRail, { backgroundColor: C.cardAlt, borderColor: C.border }]}
                    contentContainerStyle={styles.valueRailContent}
                    showsVerticalScrollIndicator={false}
                    accessibilityRole="adjustable"
                    accessibilityLabel={column.title}
                    accessibilityValue={{ text: format(selected[column.key]) }}
                  >
                    {column.values.map(value => {
                      const active = selected[column.key] === value;
                      return (
                        <Pressable
                          key={`${column.key}-${value}`}
                          style={[styles.valueButton, active && { backgroundColor: C.primaryDim, borderColor: C.primary }]}
                          onPress={() => setSelected(prev => ({ ...prev, [column.key]: value }))}
                          accessibilityRole="button"
                          accessibilityState={{ selected: active }}
                        >
                          <Text style={[styles.valueText, { color: active ? C.primary : C.text }]}>
                            {format(value)}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>
              );
            })}
          </View>
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
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    padding: spacing.lg,
    paddingBottom: 38,
  },
  title: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.black,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  columns: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  column: {
    flex: 1,
    minWidth: 0,
  },
  columnTitle: {
    fontSize: 10,
    fontWeight: FontWeight.black,
    letterSpacing: 0.8,
    textAlign: 'center',
    marginBottom: 8,
  },
  valueRail: {
    maxHeight: 220,
    borderWidth: 1,
    borderRadius: 14,
  },
  valueRailContent: {
    padding: 6,
    gap: 5,
  },
  valueButton: {
    minHeight: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  valueText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
});
