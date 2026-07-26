import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import type { ActiveSetEntry, BandLevel, EquipmentType } from '../../utils/strengthSession';
import { useColors } from '../../theme/useColors';

const BAND_LEVELS: BandLevel[] = ['extra_light', 'light', 'medium', 'heavy', 'extra_heavy', 'custom'];

function nextBandLevel(current: BandLevel | undefined): BandLevel {
  const index = current ? BAND_LEVELS.indexOf(current) : -1;
  return BAND_LEVELS[(index + 1) % BAND_LEVELS.length] ?? 'light';
}

function bandLabel(level: BandLevel | undefined): string {
  if (!level) return 'Band';
  return level.replace('_', ' ').replace(/\b\w/g, character => character.toUpperCase());
}

function numericValue(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const parsed = Number(value.replace(/[^0-9.]/g, ''));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

export default function StrengthSetEditor({
  sets,
  equipmentType,
  weightUnit,
  onAdd,
  onDuplicate,
  onRemove,
  onEdit,
  onToggleWarmup,
  onToggleCompleted,
}: {
  sets: ActiveSetEntry[];
  equipmentType?: EquipmentType;
  weightUnit: 'lb' | 'kg';
  onAdd: () => void;
  onDuplicate: (setId: string) => void;
  onRemove: (setId: string) => void;
  onEdit: (setId: string, patch: Partial<Omit<ActiveSetEntry, 'id'>>) => void;
  onToggleWarmup: (setId: string) => void;
  onToggleCompleted: (setId: string) => void;
}) {
  const C = useColors();
  const isBand = equipmentType === 'resistance_band';

  return (
    <View style={styles.wrap}>
      <View style={styles.legend}>
        <Text style={[styles.legendText, { color: C.textDim }]}>SET</Text>
        <Text style={[styles.legendText, { color: C.textDim }]}>REPS</Text>
        <Text style={[styles.legendText, { color: C.textDim }]}>{isBand ? 'BAND' : weightUnit.toUpperCase()}</Text>
        <Text style={[styles.legendText, { color: C.textDim }]}>RPE</Text>
        <Text style={[styles.legendText, { color: C.textDim }]}>HOLD</Text>
      </View>
      {sets.map((set, index) => (
        <View
          key={set.id}
          style={[styles.row, {
            borderColor: set.completed ? C.primary : C.border,
            backgroundColor: set.isWarmup ? C.cardAlt : C.bg,
          }]}
        >
          <Text style={[styles.index, { color: C.textDim }]}>{set.isWarmup ? 'W' : index + 1}</Text>
          <TextInput
            value={set.reps == null ? '' : String(set.reps)}
            onChangeText={value => onEdit(set.id, { reps: numericValue(value) })}
            placeholder="—"
            placeholderTextColor={C.textDim}
            keyboardType="number-pad"
            accessibilityLabel={`Set ${index + 1} repetitions`}
            style={[styles.input, { color: C.text, borderColor: C.border }]}
          />
          {isBand ? (
            <TouchableOpacity
              onPress={() => onEdit(set.id, { bandLevel: nextBandLevel(set.bandLevel) })}
              style={[styles.bandButton, { borderColor: C.border }]}
              accessibilityLabel={`Set ${index + 1} band level ${bandLabel(set.bandLevel)}`}
            >
              <Text numberOfLines={1} style={[styles.bandText, { color: C.text }]}>{bandLabel(set.bandLevel)}</Text>
            </TouchableOpacity>
          ) : (
            <TextInput
              value={set.weight == null ? '' : String(set.weight)}
              onChangeText={value => onEdit(set.id, { weight: numericValue(value), weightUnit })}
              placeholder="—"
              placeholderTextColor={C.textDim}
              keyboardType="decimal-pad"
              accessibilityLabel={`Set ${index + 1} weight in ${weightUnit}`}
              style={[styles.input, { color: C.text, borderColor: C.border }]}
            />
          )}
          <TextInput
            value={set.rpe == null ? '' : String(set.rpe)}
            onChangeText={value => {
              const parsed = numericValue(value);
              onEdit(set.id, { rpe: parsed == null ? undefined : Math.max(1, Math.min(10, Math.round(parsed))) });
            }}
            placeholder="—"
            placeholderTextColor={C.textDim}
            keyboardType="number-pad"
            accessibilityLabel={`Set ${index + 1} RPE`}
            style={[styles.input, { color: C.text, borderColor: C.border }]}
          />
          <TextInput
            value={set.holdSeconds == null ? '' : String(set.holdSeconds)}
            onChangeText={value => onEdit(set.id, { holdSeconds: numericValue(value) })}
            placeholder="sec"
            placeholderTextColor={C.textDim}
            keyboardType="number-pad"
            accessibilityLabel={`Set ${index + 1} hold seconds`}
            style={[styles.input, { color: C.text, borderColor: C.border }]}
          />
          <View style={styles.actions}>
            <TouchableOpacity onPress={() => onToggleWarmup(set.id)} hitSlop={5} accessibilityLabel="Toggle warm-up set">
              <Ionicons name="flame-outline" size={17} color={set.isWarmup ? C.warning : C.textDim} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => onDuplicate(set.id)} hitSlop={5} accessibilityLabel="Duplicate set">
              <Ionicons name="copy-outline" size={17} color={C.textDim} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => onRemove(set.id)} hitSlop={5} accessibilityLabel="Remove set">
              <Ionicons name="trash-outline" size={17} color={C.critical} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => onToggleCompleted(set.id)} hitSlop={5} accessibilityLabel="Toggle set complete">
              <Ionicons
                name={set.completed ? 'checkmark-circle' : 'ellipse-outline'}
                size={21}
                color={set.completed ? C.primary : C.textDim}
              />
            </TouchableOpacity>
          </View>
        </View>
      ))}
      <TouchableOpacity
        style={[styles.addButton, { borderColor: C.border }]}
        onPress={onAdd}
        accessibilityRole="button"
      >
        <Ionicons name="add" size={16} color={C.primary} />
        <Text style={[styles.addText, { color: C.primary }]}>Add Set</Text>
      </TouchableOpacity>
      <Text style={[styles.help, { color: C.textDim }]}>
        W marks a warm-up set. Hold is recorded in seconds. Complete only sets you performed.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 12 },
  legend: { flexDirection: 'row', gap: 6, paddingHorizontal: 8, marginBottom: 4 },
  legendText: { flex: 1, fontSize: 8, fontWeight: '900', letterSpacing: 0.6 },
  row: { borderWidth: 1, borderRadius: 10, padding: 7, marginTop: 6, gap: 5, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  index: { width: 16, fontSize: 11, fontWeight: '900', textAlign: 'center' },
  input: { flex: 1, minWidth: 42, minHeight: 34, borderWidth: 1, borderRadius: 7, paddingHorizontal: 7, fontSize: 11 },
  bandButton: { flex: 1, minWidth: 52, minHeight: 34, borderWidth: 1, borderRadius: 7, paddingHorizontal: 6, justifyContent: 'center' },
  bandText: { fontSize: 9, fontWeight: '700' },
  actions: { width: '100%', flexDirection: 'row', justifyContent: 'flex-end', gap: 18, paddingHorizontal: 5, paddingTop: 2 },
  addButton: { minHeight: 38, marginTop: 8, borderRadius: 9, borderWidth: 1, borderStyle: 'dashed', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  addText: { fontSize: 12, fontWeight: '800' },
  help: { fontSize: 10, lineHeight: 15, marginTop: 6 },
});
