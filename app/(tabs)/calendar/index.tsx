import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { LAYOUT } from '../../../src/constants/layout';
import { useSettingsStore } from '../../../src/store/settingsStore';
import { useColors } from '../../../src/theme/useColors';

type CalendarView = 'month' | 'week' | 'day';
type SessionType = 'run' | 'long' | 'intervals' | 'strength' | 'rest';

type CalendarCell = {
  date: Date | null;
  key: string;
  type: SessionType | null;
};

const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function startOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfWeek(date: Date): Date {
  return addDays(startOfDay(date), -date.getDay());
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function getSessionType(date: Date): SessionType {
  const day = date.getDay();
  if (day === 0 || day === 3) return 'rest';
  if (day === 1) return 'run';
  if (day === 2) return 'intervals';
  if (day === 4 || day === 5) return 'strength';
  return 'long';
}

function buildMonthCells(monthDate: Date): CalendarCell[] {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: CalendarCell[] = [];

  for (let i = 0; i < firstDay.getDay(); i += 1) {
    cells.push({ date: null, key: `blank-${i}`, type: null });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, month, day);
    cells.push({ date, key: date.toISOString(), type: getSessionType(date) });
  }

  while (cells.length % 7 !== 0) {
    cells.push({ date: null, key: `blank-end-${cells.length}`, type: null });
  }

  return cells;
}

function formatMonth(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function formatDayTitle(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'long' });
}

export default function CalendarScreen() {
  const C = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { units } = useSettingsStore();
  const today = useMemo(() => startOfDay(new Date()), []);
  const [view, setView] = useState<CalendarView>('week');
  const [selectedDate, setSelectedDate] = useState(today);
  const [displayedMonth, setDisplayedMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const imp = units === 'imperial';
  const easy4 = imp ? '4 mi' : '6.4 km';
  const easy6 = imp ? '6 mi' : '9.7 km';
  const long12 = imp ? '12 mi' : '19.3 km';
  const paceUnit = imp ? '/mi' : '/km';
  const weightUnit = imp ? 'lb' : 'kg';

  const sessionColors: Record<SessionType, string> = {
    run: C.primary,
    long: C.positive,
    intervals: C.warning,
    strength: C.accent,
    rest: 'transparent',
  };

  const monthCells = useMemo(() => buildMonthCells(displayedMonth), [displayedMonth]);
  const weekStart = startOfWeek(selectedDate);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)), [weekStart.getTime()]);
  const completedThisWeek = weekDays.filter(day => day < today).length;

  function changePeriod(direction: -1 | 1) {
    if (view === 'month') {
      const next = new Date(displayedMonth);
      next.setMonth(next.getMonth() + direction);
      setDisplayedMonth(next);
      setSelectedDate(new Date(next.getFullYear(), next.getMonth(), Math.min(selectedDate.getDate(), 28)));
      return;
    }

    const offset = view === 'week' ? direction * 7 : direction;
    const next = addDays(selectedDate, offset);
    setSelectedDate(next);
    setDisplayedMonth(new Date(next.getFullYear(), next.getMonth(), 1));
  }

  function selectDate(date: Date) {
    setSelectedDate(date);
    setDisplayedMonth(new Date(date.getFullYear(), date.getMonth(), 1));
    setView('day');
  }

  function renderSegment(label: string, value: CalendarView) {
    const selected = view === value;
    return (
      <TouchableOpacity
        style={[styles.segment, selected && { backgroundColor: C.primaryDim }]}
        onPress={() => setView(value)}
        activeOpacity={0.75}
      >
        <Text style={[styles.segmentText, { color: selected ? C.primary : C.textDim }]}>{label}</Text>
      </TouchableOpacity>
    );
  }

  function renderMonthView() {
    return (
      <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border, padding: 14 }]}>
        <View style={styles.monthHeaderGrid}>
          {DAY_LABELS.map(label => (
            <Text key={label} style={[styles.monthDow, { color: C.textDim }]}>{label}</Text>
          ))}
        </View>
        <View style={styles.monthGrid}>
          {monthCells.map(cell => {
            const isToday = cell.date ? sameDay(cell.date, today) : false;
            const isSelected = cell.date ? sameDay(cell.date, selectedDate) : false;
            const dotColor = cell.type ? sessionColors[cell.type] : 'transparent';
            return (
              <TouchableOpacity
                key={cell.key}
                style={styles.monthCell}
                onPress={() => cell.date && selectDate(cell.date)}
                disabled={!cell.date}
                activeOpacity={0.75}
              >
                <View
                  style={[
                    styles.monthDateBubble,
                    {
                      backgroundColor: isSelected || isToday ? C.primaryDim : 'transparent',
                      borderColor: isSelected || isToday ? C.primary : 'transparent',
                    },
                  ]}
                >
                  <Text style={[styles.monthDateText, { color: isSelected || isToday ? C.primary : C.text }]}>
                    {cell.date ? cell.date.getDate() : ''}
                  </Text>
                </View>
                <View style={[styles.monthDot, { backgroundColor: dotColor }]} />
              </TouchableOpacity>
            );
          })}
        </View>
        <View style={[styles.legendRow, { borderTopColor: C.border }]}>
          {[
            ['Run', C.primary],
            ['Long Run', C.positive],
            ['Intervals', C.warning],
            ['Strength', C.accent],
          ].map(([label, color]) => (
            <View key={label} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: color }]} />
              <Text style={[styles.legendText, { color: C.textMuted }]}>{label}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  }

  function renderWeekView() {
    const weekItems = weekDays.map(day => {
      const type = getSessionType(day);
      const isToday = sameDay(day, today);
      const isPast = day < today;
      const titleByType: Record<SessionType, string> = {
        run: `Easy ${easy4}`,
        long: `Long Run ${long12}`,
        intervals: 'Intervals 8x400m',
        strength: day.getDay() === 4 ? `Easy ${easy6}` : 'Easy & Strides',
        rest: 'Rest & Recovery',
      };
      const zoneByType: Record<SessionType, string> = {
        run: 'Zone 2',
        long: 'Zone 2',
        intervals: 'Zone 4',
        strength: day.getDay() === 4 ? 'Zone 2' : 'Zone 3',
        rest: '',
      };

      return { day, type, isToday, isPast, title: titleByType[type], zone: zoneByType[type] };
    });

    return (
      <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
        <View style={styles.weekList}>
          {weekItems.map(item => (
            <TouchableOpacity
              key={item.day.toISOString()}
              style={[
                styles.weekItem,
                {
                  backgroundColor: item.isToday ? C.primaryDim : C.cardAlt,
                  borderColor: item.isToday ? C.primary : 'transparent',
                  opacity: item.day > today && !item.isToday ? 0.65 : 1,
                },
              ]}
              onPress={() => selectDate(item.day)}
              activeOpacity={0.75}
            >
              <Text style={[styles.weekDay, { color: item.isToday ? C.primary : item.isPast ? C.positive : C.textDim }]}>
                {item.day.toLocaleDateString('en-US', { weekday: 'short' })}
              </Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.weekTitle, { color: C.text }]}>{item.title}{item.isToday ? ' · Today' : ''}</Text>
                {item.zone ? <Text style={[styles.weekZone, { color: C.textMuted }]}>{item.zone}</Text> : null}
              </View>
              {item.isToday ? (
                <View style={[styles.todayBadge, { backgroundColor: C.primaryDim, borderColor: C.primary }]}>
                  <Text style={[styles.todayBadgeText, { color: C.primary }]}>TODAY</Text>
                </View>
              ) : item.isPast ? (
                <Text style={[styles.doneText, { color: C.positive }]}>Done</Text>
              ) : null}
            </TouchableOpacity>
          ))}
        </View>
        <View style={[styles.weekProgress, { borderTopColor: C.border }]}>
          <Text style={[styles.weekProgressText, { color: C.textMuted }]}>Weekly Progress · {completedThisWeek} / 7</Text>
          <View style={[styles.progressTrack, { backgroundColor: C.border }]}>
            <View style={[styles.progressFill, { backgroundColor: C.primary, width: `${Math.round((completedThisWeek / 7) * 100)}%` }]} />
          </View>
        </View>
      </View>
    );
  }

  function renderDayView() {
    const isToday = sameDay(selectedDate, today);
    const isPast = selectedDate < today && !isToday;
    const isFuture = selectedDate > today && !isToday;
    const monthShort = selectedDate.toLocaleDateString('en-US', { month: 'short' });

    return (
      <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
        <Text style={[styles.dayMeta, { color: C.textDim }]}>{monthShort} {selectedDate.getDate()} · {selectedDate.getFullYear()}</Text>
        <Text style={[styles.dayTitle, { color: C.text }]}>{formatDayTitle(selectedDate)}</Text>

        {isToday ? (
          <>
            <View style={styles.dayStatRow}>
              {[
                ['DISTANCE', easy6],
                ['ZONE', 'Z2'],
                ['MAX HR', '152'],
              ].map(([label, value]) => (
                <View key={label} style={[styles.dayStatBox, { backgroundColor: C.cardAlt }]}>
                  <Text style={[styles.dayStatLabel, { color: C.textDim }]}>{label}</Text>
                  <Text style={[styles.dayStatValue, { color: C.text }]}>{value}</Text>
                </View>
              ))}
            </View>
            <View style={[styles.targetCard, { backgroundColor: C.primaryDim, borderColor: C.primary }]}>
              <Text style={[styles.targetLabel, { color: C.text }]}>Target Pace</Text>
              <Text style={[styles.targetPace, { color: C.text }]}>9'14"<Text style={[styles.targetUnit, { color: C.textMuted }]}> {paceUnit}</Text></Text>
            </View>
          </>
        ) : null}

        {isPast ? (
          <>
            <View style={[styles.summaryBox, { backgroundColor: C.cardAlt }]}>
              <Text style={[styles.summaryLabel, { color: C.textDim }]}>SESSION SUMMARY</Text>
              <View style={styles.summaryStats}>
                <View>
                  <Text style={[styles.summaryTiny, { color: C.textDim }]}>Duration</Text>
                  <Text style={[styles.summaryValue, { color: C.text }]}>42 min</Text>
                </View>
                <View>
                  <Text style={[styles.summaryTiny, { color: C.textDim }]}>Avg RPE</Text>
                  <Text style={[styles.summaryValue, { color: C.text }]}>7.5</Text>
                </View>
                <View>
                  <Text style={[styles.summaryTiny, { color: C.textDim }]}>Volume</Text>
                  <Text style={[styles.summaryValue, { color: C.text }]}>3,840 {weightUnit}</Text>
                </View>
              </View>
            </View>
            <Text style={[styles.exerciseLabel, { color: C.textDim }]}>EXERCISES LOGGED</Text>
            {[
              ['Goblet Squat', '3x12 · RPE 7'],
              ['Squat', '4x8 · RPE 8'],
              ['Romanian Deadlift', '3x10 · RPE 7'],
              ['Push-up', '3x15 · RPE 6'],
            ].map(([name, detail]) => (
              <View key={name} style={[styles.exerciseRow, { backgroundColor: C.cardAlt }]}>
                <Text style={[styles.exerciseName, { color: C.text }]}>{name}</Text>
                <Text style={[styles.exerciseDetail, { color: C.textMuted }]}>{detail}</Text>
              </View>
            ))}
          </>
        ) : null}

        {isFuture ? (
          <>
            <View style={[styles.summaryBox, { backgroundColor: C.cardAlt }]}>
              <Text style={[styles.futureText, { color: C.textMuted }]}>Upcoming - tap Start when ready to begin this session.</Text>
            </View>
            <TouchableOpacity
              style={[styles.startButton, { backgroundColor: C.primary }]}
              onPress={() => router.push('/(tabs)/strength')}
              activeOpacity={0.8}
            >
              <Text style={[styles.startButtonText, { color: C.onPrimary }]}>Start This Workout →</Text>
            </TouchableOpacity>
          </>
        ) : null}
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: C.bg }}
      contentContainerStyle={{ paddingHorizontal: 18, paddingTop: insets.top + 6, paddingBottom: LAYOUT.screenPadBottom }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={20} color={C.primary} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={[styles.headerLabel, { color: C.textDim }]}>CALENDAR</Text>
          <Text style={[styles.headerTitle, { color: C.text }]}>{formatMonth(view === 'month' ? displayedMonth : selectedDate)}</Text>
        </View>
        <View style={styles.arrowGroup}>
          <TouchableOpacity
            style={[styles.arrowButton, { backgroundColor: C.card, borderColor: C.border }]}
            onPress={() => changePeriod(-1)}
            activeOpacity={0.75}
          >
            <Text style={[styles.arrowText, { color: C.text }]}>‹</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.arrowButton, { backgroundColor: C.card, borderColor: C.border }]}
            onPress={() => changePeriod(1)}
            activeOpacity={0.75}
          >
            <Text style={[styles.arrowText, { color: C.text }]}>›</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.segmentWrap, { backgroundColor: C.card, borderColor: C.border }]}>
        {renderSegment('Month', 'month')}
        {renderSegment('Week', 'week')}
        {renderSegment('Day', 'day')}
      </View>

      {view === 'month' ? renderMonthView() : null}
      {view === 'week' ? renderWeekView() : null}
      {view === 'day' ? renderDayView() : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  headerText: {
    flex: 1,
  },
  headerLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.9,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '700',
    fontFamily: 'CormorantGaramond_700Bold',
  },
  arrowGroup: {
    flexDirection: 'row',
    gap: 6,
  },
  arrowButton: {
    width: 32,
    height: 32,
    borderRadius: 9,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowText: {
    fontSize: 20,
    lineHeight: 22,
  },
  segmentWrap: {
    flexDirection: 'row',
    gap: 4,
    borderRadius: 12,
    borderWidth: 1,
    padding: 4,
    marginBottom: 14,
  },
  segment: {
    flex: 1,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentText: {
    fontSize: 11,
    fontWeight: '700',
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 10,
  },
  monthHeaderGrid: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  monthDow: {
    flex: 1,
    textAlign: 'center',
    fontSize: 10,
    fontWeight: '700',
  },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  monthCell: {
    width: `${100 / 7}%`,
    alignItems: 'center',
    paddingVertical: 1,
    marginBottom: 4,
  },
  monthDateBubble: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthDateText: {
    fontSize: 11,
    fontWeight: '600',
  },
  monthDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginTop: 2,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 10,
  },
  weekList: {
    gap: 6,
  },
  weekItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  weekDay: {
    width: 28,
    fontSize: 12,
    fontWeight: '700',
  },
  weekTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  weekZone: {
    fontSize: 11,
    marginTop: 2,
  },
  doneText: {
    fontSize: 11,
    fontWeight: '700',
  },
  todayBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  todayBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  weekProgress: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
  },
  weekProgressText: {
    fontSize: 12,
    marginBottom: 8,
  },
  progressTrack: {
    height: 7,
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
  dayMeta: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  dayTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 12,
  },
  dayStatRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  dayStatBox: {
    flex: 1,
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
  },
  dayStatLabel: {
    fontSize: 10,
    marginBottom: 3,
  },
  dayStatValue: {
    fontSize: 18,
    fontWeight: '800',
  },
  targetCard: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  targetLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 2,
  },
  targetPace: {
    fontSize: 24,
    fontWeight: '800',
  },
  targetUnit: {
    fontSize: 13,
    fontWeight: '400',
  },
  summaryBox: {
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  summaryStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  summaryTiny: {
    fontSize: 10,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  exerciseLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  exerciseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 5,
  },
  exerciseName: {
    fontSize: 12,
  },
  exerciseDetail: {
    fontSize: 11,
  },
  futureText: {
    fontSize: 11,
    lineHeight: 18,
  },
  startButton: {
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
