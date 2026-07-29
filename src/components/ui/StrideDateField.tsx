import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TwoColumnPickerWheel } from './PickerWheel';
import { useColors } from '../../theme/useColors';
import { spacing } from '../../theme/spacing';
import { FontSize, FontWeight, Radius } from '../../theme/tokens';
import {
  compareDateOnly,
  dateOnlyFromParts,
  daysInMonth,
  formatDateOnly,
  isValidDateOnly,
  MONTH_NAMES,
  startOfMonth,
  todayDateOnly,
  type DateOnly,
} from '../../utils/dateOnly';
import { addDays, parseYMD, toYMD } from '../../utils/calendarEngine';

type Props = {
  label: string;
  value: DateOnly;
  onChange: (value: DateOnly) => void;
  title?: string;
  helper?: string;
  minDate?: DateOnly;
  maxDate?: DateOnly;
  disabled?: boolean;
  error?: string | null;
  accessibilityHint?: string;
};

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function monthLabel(date: Date): string {
  return `${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;
}

function clampDay(year: number, monthIndex: number, day: number): DateOnly {
  return dateOnlyFromParts(year, monthIndex, Math.min(day, daysInMonth(year, monthIndex))) ?? `${year}-01-01`;
}

function isAllowed(value: DateOnly, minDate?: DateOnly, maxDate?: DateOnly): boolean {
  if (!isValidDateOnly(value)) return false;
  if (minDate && compareDateOnly(value, minDate) < 0) return false;
  if (maxDate && compareDateOnly(value, maxDate) > 0) return false;
  return true;
}

export default function StrideDateField({
  label,
  value,
  onChange,
  title,
  helper,
  minDate,
  maxDate,
  disabled,
  error,
  accessibilityHint = 'Opens the StrideOS calendar selector.',
}: Props) {
  const C = useColors();
  const insets = useSafeAreaInsets();
  const today = todayDateOnly();
  const safeValue = isValidDateOnly(value) ? value : today;
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DateOnly>(safeValue);
  const [displayedMonth, setDisplayedMonth] = useState(() => startOfMonth(safeValue));
  const [monthYearOpen, setMonthYearOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDraft(safeValue);
    setDisplayedMonth(startOfMonth(safeValue));
  }, [open, safeValue]);

  const calendarCells = useMemo(() => {
    const first = startOfMonth(toYMD(displayedMonth));
    const start = addDays(first, -first.getDay());
    return Array.from({ length: 42 }, (_, index) => {
      const date = addDays(start, index);
      const ymd = toYMD(date);
      return {
        date,
        ymd,
        inMonth: date.getMonth() === displayedMonth.getMonth(),
        selected: ymd === draft,
        today: ymd === today,
        disabled: !isAllowed(ymd, minDate, maxDate),
      };
    });
  }, [displayedMonth, draft, maxDate, minDate, today]);

  const confirmDisabled = !isAllowed(draft, minDate, maxDate);
  const baseYear = displayedMonth.getFullYear();
  const years = Array.from({ length: 151 }, (_, index) => baseYear - 75 + index)
    .filter(year => {
      const yearStart = `${year}-01-01`;
      const yearEnd = `${year}-12-31`;
      if (maxDate && compareDateOnly(yearStart, maxDate) > 0) return false;
      if (minDate && compareDateOnly(yearEnd, minDate) < 0) return false;
      return true;
    });

  return (
    <>
      <View style={styles.wrap}>
        <Pressable
          onPress={() => !disabled && setOpen(true)}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityValue={{ text: formatDateOnly(safeValue) }}
          accessibilityHint={accessibilityHint}
          accessibilityState={{ disabled: Boolean(disabled) }}
          style={({ pressed }) => [
            styles.field,
            {
              backgroundColor: disabled ? C.card : C.cardAlt,
              borderColor: error ? C.critical : C.border,
              opacity: disabled ? 0.55 : pressed ? 0.78 : 1,
            },
          ]}
        >
          <View style={[styles.iconWrap, { backgroundColor: C.card }]}>
            <Ionicons name="calendar-outline" size={18} color={C.primary} />
          </View>
          <View style={styles.fieldCopy}>
            <Text style={[styles.fieldLabel, { color: C.textDim }]}>{label}</Text>
            <Text style={[styles.fieldValue, { color: C.text }]}>{formatDateOnly(safeValue)}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={C.textMuted} />
        </Pressable>
        {helper ? <Text style={[styles.helper, { color: C.textMuted }]}>{helper}</Text> : null}
        {error ? <Text style={[styles.error, { color: C.critical }]}>{error}</Text> : null}
      </View>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={styles.overlay}>
          <View style={[styles.sheet, { backgroundColor: C.card, borderColor: C.border, paddingBottom: Math.max(insets.bottom, 16) }]}>
            <View style={[styles.dragIndicator, { backgroundColor: C.border }]} />
            <View style={styles.sheetHeader}>
              <Pressable onPress={() => setOpen(false)} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Cancel ${label} selection`}>
                <Text style={[styles.headerAction, { color: C.textMuted }]}>Cancel</Text>
              </Pressable>
              <Text style={[styles.sheetTitle, { color: C.text }]}>{title ?? label}</Text>
              <Pressable
                onPress={() => {
                  if (confirmDisabled) return;
                  onChange(draft);
                  setOpen(false);
                }}
                disabled={confirmDisabled}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={`Confirm ${label} ${formatDateOnly(draft)}`}
                accessibilityState={{ disabled: confirmDisabled }}
              >
                <Text style={[styles.headerAction, { color: confirmDisabled ? C.textDim : C.primary }]}>Confirm</Text>
              </Pressable>
            </View>

            <View style={styles.monthNav}>
              <Pressable
                onPress={() => setDisplayedMonth(month => addMonths(month, -1))}
                style={[styles.navButton, { borderColor: C.border }]}
                accessibilityRole="button"
                accessibilityLabel="Previous month"
              >
                <Ionicons name="chevron-back" size={18} color={C.text} />
              </Pressable>
              <Pressable
                onPress={() => setMonthYearOpen(true)}
                style={({ pressed }) => [styles.monthButton, { backgroundColor: C.cardAlt, borderColor: C.border, opacity: pressed ? 0.78 : 1 }]}
                accessibilityRole="button"
                accessibilityLabel={`Choose month and year, currently ${monthLabel(displayedMonth)}`}
              >
                <Text style={[styles.monthText, { color: C.text }]}>{monthLabel(displayedMonth)} ˅</Text>
              </Pressable>
              <Pressable
                onPress={() => setDisplayedMonth(month => addMonths(month, 1))}
                style={[styles.navButton, { borderColor: C.border }]}
                accessibilityRole="button"
                accessibilityLabel="Next month"
              >
                <Ionicons name="chevron-forward" size={18} color={C.text} />
              </Pressable>
            </View>

            <View style={styles.weekHeader}>
              {WEEKDAYS.map(day => <Text key={day} style={[styles.weekday, { color: C.textDim }]}>{day}</Text>)}
            </View>
            <View style={styles.grid}>
              {calendarCells.map(cell => (
                <Pressable
                  key={cell.ymd}
                  onPress={() => {
                    if (!cell.disabled) setDraft(cell.ymd);
                  }}
                  disabled={cell.disabled}
                  accessibilityRole="button"
                  accessibilityLabel={`${formatDateOnly(cell.ymd)}${cell.today ? ', today' : ''}`}
                  accessibilityState={{ selected: cell.selected, disabled: cell.disabled }}
                  style={({ pressed }) => [
                    styles.day,
                    {
                      borderColor: cell.selected ? C.primary : cell.today ? C.textMuted : 'transparent',
                      backgroundColor: cell.selected ? C.primaryDim : 'transparent',
                      opacity: cell.disabled ? 0.28 : cell.inMonth ? (pressed ? 0.7 : 1) : 0.45,
                    },
                  ]}
                >
                  <Text style={[styles.dayText, { color: cell.selected ? C.primary : C.text }]}>{cell.date.getDate()}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      </Modal>

      <TwoColumnPickerWheel
        visible={monthYearOpen}
        title="Choose month and year"
        subtitle="Apply a month and year, then choose the exact day."
        confirmLabel="Apply"
        columns={[
          {
            id: 'month',
            title: 'Month',
            values: MONTH_NAMES.map((_, index) => index),
            selectedValue: displayedMonth.getMonth(),
            formatValue: value => MONTH_NAMES[value] ?? String(value),
          },
          {
            id: 'year',
            title: 'Year',
            values: years,
            selectedValue: displayedMonth.getFullYear(),
          },
        ]}
        onClose={() => setMonthYearOpen(false)}
        onConfirm={selection => {
          const month = selection.month;
          const year = selection.year;
          const nextDraft = clampDay(year, month, parseYMD(draft).getDate());
          setDisplayedMonth(new Date(year, month, 1));
          if (isAllowed(nextDraft, minDate, maxDate)) setDraft(nextDraft);
          setMonthYearOpen(false);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.xs,
  },
  field: {
    minHeight: 58,
    borderWidth: 1,
    borderRadius: Radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldCopy: {
    flex: 1,
    minWidth: 0,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: FontWeight.black,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  fieldValue: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.black,
    marginTop: 3,
  },
  helper: {
    fontSize: FontSize.xs,
    lineHeight: 16,
  },
  error: {
    fontSize: FontSize.xs,
    lineHeight: 16,
    fontWeight: FontWeight.bold,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  dragIndicator: {
    width: 44,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  sheetHeader: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  sheetTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: FontSize.base,
    fontWeight: FontWeight.black,
  },
  headerAction: {
    minWidth: 62,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.black,
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  navButton: {
    width: 44,
    height: 44,
    borderWidth: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthButton: {
    flex: 1,
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.black,
  },
  weekHeader: {
    flexDirection: 'row',
  },
  weekday: {
    width: `${100 / 7}%`,
    textAlign: 'center',
    fontSize: 10,
    fontWeight: FontWeight.black,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingTop: spacing.sm,
  },
  day: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.black,
  },
});
