// ─── Calendar Screen ──────────────────────────────────────────────────────────
//
// Three switchable views: Day, Week, Month.
// Day view:   full list of planned + logged workouts for one day, swipe left/right
// Week view:  7 columns with dot indicators, swipe to change week
// Month view: traditional grid, swipe left/right to change month
//
// Business logic: calendarEngine.ts (date mapping), customWorkoutStore, workoutGenerator.

import { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useAthleteStore }       from '../../../src/store/athleteStore';
import { useCustomWorkoutStore } from '../../../src/store/customWorkoutStore';
import { useWeekPlan }           from '../../../src/hooks/useWeekPlan';
import {
  toYMD,
  weeksInMonth,
  type CalendarEntry,
} from '../../../src/utils/calendarEngine';
import type { CustomWorkoutLog }  from '../../../src/types/customWorkout';

import ScreenLayout         from '../../../src/layout/ScreenLayout';
import FloatingActionButton from '../../../src/layout/FloatingActionButton';
import LogWorkoutModal      from '../../../src/components/shared/LogWorkoutModal';
import OverrideModal        from '../../../src/components/shared/OverrideModal';

import { colors }  from '../../../src/theme/colors';
import { spacing } from '../../../src/theme/spacing';
import { FontSize, FontWeight, Radius } from '../../../src/theme/tokens';

// ─── Constants ────────────────────────────────────────────────────────────────

const DOW_SHORT  = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DOW_ABBREV = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

type CalView = 'day' | 'week' | 'month';

function categoryColor(cat: string): string {
  switch (cat) {
    case 'running':        return '#2563EB';
    case 'strength':       return '#A855F7';
    case 'cross_training': return '#F97316';
    case 'mobility':       return '#4ADE80';
    default:               return '#8B9AAF';
  }
}

function categoryLabel(cat: string): string {
  switch (cat) {
    case 'running':        return 'Run';
    case 'strength':       return 'Strength';
    case 'cross_training': return 'Cross';
    case 'mobility':       return 'Mobility';
    default:               return 'Other';
  }
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function startOfWeek(d: Date): Date {
  const copy = new Date(d);
  copy.setDate(d.getDate() - d.getDay()); // Sunday
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(d: Date, n: number): Date {
  const copy = new Date(d);
  copy.setDate(d.getDate() + n);
  return copy;
}

// ─── Entry rows ───────────────────────────────────────────────────────────────

function EntryRow({ entry }: { entry: CalendarEntry }) {
  const exercises     = entry.session?.exercises ?? [];
  const exerciseCount = exercises.length;

  return (
    <View style={s.entryRow}>
      <View style={[s.entryDot, { backgroundColor: entry.color }]} />
      <View style={s.entryInfo}>
        <Text style={s.entryLabel}>{entry.label}</Text>
        {entry.workout && (
          <Text style={s.entryMeta}>
            {entry.workout.durationMinutes} min
            {entry.workout.targetDistance ? ` · ${entry.workout.targetDistance} mi` : ''}
            {' · '}{entry.workout.intensity}
          </Text>
        )}
        {entry.session && (
          <Text style={s.entryMeta}>
            {exerciseCount > 0 ? `${exerciseCount} exercises` : (entry.session.sessionType ?? 'Strength')}
            {exerciseCount > 0 ? ` · ~${exerciseCount * 4} min` : ''}
          </Text>
        )}
      </View>
      {entry.completed && <Text style={s.entryDone}>✓</Text>}
    </View>
  );
}

function LogRow({ log }: { log: CustomWorkoutLog }) {
  const dur =
    log.durationMinutes ??
    log.strengthDurationMin ??
    log.crossDurationMin ??
    log.mobilityDurationMin ??
    log.otherDurationMin ?? 0;

  return (
    <View style={s.entryRow}>
      <View style={[s.entryDot, { backgroundColor: categoryColor(log.category) }]} />
      <View style={s.entryInfo}>
        <Text style={s.entryLabel}>{categoryLabel(log.category)}</Text>
        <Text style={s.entryMeta}>
          {dur} min
          {log.distanceMiles ? ` · ${log.distanceMiles.toFixed(1)} mi` : ''}
          {log.rpe ? ` · RPE ${log.rpe}` : ''}
        </Text>
        {log.notes ? <Text style={s.entryNotes} numberOfLines={1}>{log.notes}</Text> : null}
      </View>
      <Text style={s.entryDone}>✓ Logged</Text>
    </View>
  );
}

// ─── Day Detail Panel ─────────────────────────────────────────────────────────

function DayDetail({
  date, plannedEntries, customLogs, onLogWorkout,
}: {
  date:           Date;
  plannedEntries: CalendarEntry[];
  customLogs:     CustomWorkoutLog[];
  onLogWorkout:   () => void;
}) {
  const dateStr  = toYMD(date);
  const todayStr = toYMD(new Date());
  const isFuture = dateStr > todayStr;

  const totalDur = customLogs.reduce((sum, l) =>
    sum + (l.durationMinutes ?? l.strengthDurationMin ?? l.crossDurationMin ?? l.mobilityDurationMin ?? l.otherDurationMin ?? 0), 0);

  return (
    <View style={s.detailPanel}>
      <View style={s.detailHeader}>
        <View>
          <Text style={s.detailDate}>
            {date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </Text>
          {totalDur > 0 && (
            <Text style={s.detailMeta}>{totalDur} min logged</Text>
          )}
        </View>
        {!isFuture && (
          <Pressable style={s.logDayBtn} onPress={onLogWorkout}>
            <Text style={s.logDayTxt}>+ Log</Text>
          </Pressable>
        )}
      </View>

      {plannedEntries.length > 0 && (
        <View style={s.sectionGroup}>
          <Text style={s.groupLabel}>PLANNED</Text>
          {plannedEntries.map((e, i) => <EntryRow key={i} entry={e} />)}
        </View>
      )}

      {customLogs.length > 0 && (
        <View style={s.sectionGroup}>
          <Text style={s.groupLabel}>LOGGED</Text>
          {customLogs.map(log => <LogRow key={log.id} log={log} />)}
        </View>
      )}

      {plannedEntries.length === 0 && customLogs.length === 0 && (
        <Text style={s.emptyTxt}>
          {isFuture ? 'No sessions planned' : 'No sessions logged'}
        </Text>
      )}
    </View>
  );
}

// ─── Day View ─────────────────────────────────────────────────────────────────

function DayView({
  selected,
  onChangeDay,
  plannedByDate,
  getLogsForDate,
  onLogWorkout,
}: {
  selected:       Date;
  onChangeDay:    (d: Date) => void;
  plannedByDate:  Map<string, CalendarEntry[]>;
  getLogsForDate: (date: string) => CustomWorkoutLog[];
  onLogWorkout:   () => void;
}) {
  const selectedStr = toYMD(selected);
  const todayStr    = toYMD(new Date());

  return (
    <View style={{ flex: 1 }}>
      {/* Day nav header */}
      <View style={s.dayNavRow}>
        <Pressable hitSlop={12} onPress={() => onChangeDay(addDays(selected, -1))}>
          <Text style={s.navArrow}>‹</Text>
        </Pressable>
        <Text style={s.dayNavTitle}>
          {selected.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
          {toYMD(selected) === todayStr ? '  · Today' : ''}
        </Text>
        <Pressable hitSlop={12} onPress={() => onChangeDay(addDays(selected, 1))}>
          <Text style={s.navArrow}>›</Text>
        </Pressable>
      </View>

      {/* Scrollable day detail */}
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <DayDetail
          date={selected}
          plannedEntries={plannedByDate.get(selectedStr) ?? []}
          customLogs={getLogsForDate(selectedStr)}
          onLogWorkout={onLogWorkout}
        />
      </ScrollView>
    </View>
  );
}

// ─── Week View ────────────────────────────────────────────────────────────────

function WeekView({
  selected,
  onChangeDay,
  onChangeWeek,
  plannedByDate,
  getLogsForDate,
  onLogWorkout,
}: {
  selected:       Date;
  onChangeDay:    (d: Date) => void;
  onChangeWeek:   (delta: number) => void;
  plannedByDate:  Map<string, CalendarEntry[]>;
  getLogsForDate: (date: string) => CustomWorkoutLog[];
  onLogWorkout:   () => void;
}) {
  const weekStart  = startOfWeek(selected);
  const weekDays   = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const todayStr   = toYMD(new Date());
  const selectedStr = toYMD(selected);

  const weekStart2 = weekDays[0];
  const weekEnd    = weekDays[6];
  const rangeLabel = `${weekStart2.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

  return (
    <View style={{ flex: 1 }}>
      {/* Week nav header */}
      <View style={s.monthNav}>
        <Pressable hitSlop={12} onPress={() => onChangeWeek(-1)}>
          <Text style={s.navArrow}>‹</Text>
        </Pressable>
        <Text style={s.monthTitle}>{rangeLabel}</Text>
        <Pressable hitSlop={12} onPress={() => onChangeWeek(1)}>
          <Text style={s.navArrow}>›</Text>
        </Pressable>
      </View>

      {/* 7-column week grid */}
      <View style={s.weekGridRow}>
        {weekDays.map((day, i) => {
          const dStr   = toYMD(day);
          const isToday = dStr === todayStr;
          const isSel   = dStr === selectedStr;
          const planned = plannedByDate.get(dStr) ?? [];
          const logged  = getLogsForDate(dStr);
          const dots: { color: string }[] = [
            ...planned.map(e => ({ color: e.color })),
            ...logged.map(l => ({ color: categoryColor(l.category) })),
          ];

          return (
            <Pressable
              key={i}
              style={[
                s.weekDayCol,
                isToday && s.weekDayColToday,
                isSel && !isToday && s.weekDayColSelected,
              ]}
              onPress={() => onChangeDay(day)}
            >
              <Text style={[s.weekDowLabel, isToday && s.weekDowLabelToday]}>
                {DOW_ABBREV[i]}
              </Text>
              <Text style={[
                s.weekDayNum,
                isToday && s.weekDayNumToday,
                isSel && !isToday && s.weekDayNumSelected,
              ]}>
                {day.getDate()}
              </Text>
              <View style={s.dotRow}>
                {dots.slice(0, 3).map((d, di) => (
                  <View key={di} style={[s.dot, { backgroundColor: d.color }]} />
                ))}
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* Selected day detail */}
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <DayDetail
          date={selected}
          plannedEntries={plannedByDate.get(selectedStr) ?? []}
          customLogs={getLogsForDate(selectedStr)}
          onLogWorkout={onLogWorkout}
        />
      </ScrollView>
    </View>
  );
}

// ─── Month View ───────────────────────────────────────────────────────────────

function DayCell({
  date, isToday, isCurrentMonth, dots, selected, onPress,
}: {
  date:           Date;
  isToday:        boolean;
  isCurrentMonth: boolean;
  dots:           { color: string }[];
  selected:       boolean;
  onPress:        () => void;
}) {
  return (
    <Pressable
      style={[
        s.dayCell,
        isToday  && s.dayCellToday,
        selected && !isToday && s.dayCellSelected,
      ]}
      onPress={onPress}
      hitSlop={4}
    >
      <Text style={[
        s.dayNum,
        !isCurrentMonth && s.dayNumFaded,
        isToday         && s.dayNumToday,
        selected        && !isToday && s.dayNumSelected,
      ]}>
        {date.getDate()}
      </Text>
      <View style={s.dotRow}>
        {dots.slice(0, 3).map((d, i) => (
          <View key={i} style={[s.dot, { backgroundColor: d.color }]} />
        ))}
      </View>
    </Pressable>
  );
}

function MonthView({
  viewYear,
  viewMonth,
  selected,
  onSelectDay,
  onPrevMonth,
  onNextMonth,
  plannedByDate,
  logsByDate,
  onLogWorkout,
}: {
  viewYear:      number;
  viewMonth:     number;
  selected:      Date;
  onSelectDay:   (d: Date) => void;
  onPrevMonth:   () => void;
  onNextMonth:   () => void;
  plannedByDate: Map<string, CalendarEntry[]>;
  logsByDate:    Map<string, CustomWorkoutLog[]>;
  onLogWorkout:  () => void;
}) {
  const weeks      = useMemo(() => weeksInMonth(viewYear, viewMonth), [viewYear, viewMonth]);
  const todayStr   = toYMD(new Date());
  const selectedStr = toYMD(selected);

  return (
    <View style={{ flex: 1 }}>
      {/* Month navigation */}
      <View style={s.monthNav}>
        <Pressable onPress={onPrevMonth} style={s.navBtn} hitSlop={12}>
          <Text style={s.navArrow}>‹</Text>
        </Pressable>
        <Text style={s.monthTitle}>{MONTH_NAMES[viewMonth]} {viewYear}</Text>
        <Pressable onPress={onNextMonth} style={s.navBtn} hitSlop={12}>
          <Text style={s.navArrow}>›</Text>
        </Pressable>
      </View>

      {/* Weekday headers */}
      <View style={s.dowRow}>
        {DOW_SHORT.map(d => (
          <Text key={d} style={s.dowLabel}>{d}</Text>
        ))}
      </View>

      {/* Calendar grid */}
      {weeks.map((week, wi) => (
        <View key={wi} style={s.weekRow}>
          {week.map((day, di) => {
            const dStr    = toYMD(day);
            const planned = plannedByDate.get(dStr) ?? [];
            const logged  = logsByDate.get(dStr) ?? [];
            const dots: { color: string }[] = [
              ...planned.map(e => ({ color: e.color })),
              ...logged.map(l => ({ color: categoryColor(l.category) })),
            ];
            return (
              <DayCell
                key={di}
                date={day}
                isToday={dStr === todayStr}
                isCurrentMonth={day.getMonth() === viewMonth}
                dots={dots}
                selected={dStr === selectedStr}
                onPress={() => onSelectDay(day)}
              />
            );
          })}
        </View>
      ))}

      {/* Legend */}
      <View style={s.legend}>
        {[
          { color: '#2563EB', label: 'Running'  },
          { color: '#A855F7', label: 'Strength' },
          { color: '#F97316', label: 'Cross'    },
          { color: '#4ADE80', label: 'Mobility' },
        ].map(item => (
          <View key={item.label} style={s.legendItem}>
            <View style={[s.legendDot, { backgroundColor: item.color }]} />
            <Text style={s.legendTxt}>{item.label}</Text>
          </View>
        ))}
      </View>

      {/* Selected day detail */}
      <DayDetail
        date={selected}
        plannedEntries={plannedByDate.get(selectedStr) ?? []}
        customLogs={logsByDate.get(selectedStr) ?? []}
        onLogWorkout={onLogWorkout}
      />
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function CalendarScreen() {
  const today = new Date();

  const [view,      setView]      = useState<CalView>('month');
  const [viewYear,  setViewYear]  = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selected,  setSelected]  = useState<Date>(today);

  const [showLog,      setShowLog]      = useState(false);
  const [showOverride, setShowOverride] = useState(false);
  const [pendingOverrideId, setPendingOverrideId] = useState<string | undefined>();

  const {
    fatigueScore, recoveryScore,
    setFatigueScore, setRecentEasyLoad, recentEasyLoad,
  } = useAthleteStore();

  const { addLog: addCustomLog, addOverride, getLogsForDate, getLogsForRange } = useCustomWorkoutStore();
  const { calendarMap: plannedByDate } = useWeekPlan();

  // Month-range logs for the dot indicators
  const firstDay  = toYMD(new Date(viewYear, viewMonth, 1));
  const lastDay   = toYMD(new Date(viewYear, viewMonth + 1, 0));
  const monthLogs = getLogsForRange(firstDay, lastDay);

  const logsByDate = useMemo(() => {
    const map = new Map<string, CustomWorkoutLog[]>();
    for (const log of monthLogs) {
      const arr = map.get(log.date) ?? [];
      arr.push(log);
      map.set(log.date, arr);
    }
    return map;
  }, [monthLogs]);

  const selectedStr = toYMD(selected);

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  }

  function handleChangeWeek(delta: number) {
    const next = addDays(selected, delta * 7);
    setSelected(next);
  }

  function handleLogPress() {
    const isLowReadiness = fatigueScore > 60 || recoveryScore < 50;
    if (isLowReadiness) {
      setShowOverride(true);
    } else {
      setShowLog(true);
    }
  }

  function handleOverrideConfirmed(overrideId: string) {
    setShowOverride(false);
    setPendingOverrideId(overrideId);
    setShowLog(true);
  }

  return (
    <ScreenLayout
      title="Calendar"
      fab={<FloatingActionButton icon="add" onPress={handleLogPress} />}
    >
      {/* View switcher */}
      <View style={s.viewSwitcher}>
        {(['day', 'week', 'month'] as CalView[]).map(v => (
          <Pressable
            key={v}
            style={[s.switcherPill, view === v && s.switcherPillActive]}
            onPress={() => setView(v)}
          >
            <Text style={[s.switcherText, view === v && s.switcherTextActive]}>
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>

      {view === 'day' && (
        <DayView
          selected={selected}
          onChangeDay={setSelected}
          plannedByDate={plannedByDate}
          getLogsForDate={getLogsForDate}
          onLogWorkout={handleLogPress}
        />
      )}

      {view === 'week' && (
        <WeekView
          selected={selected}
          onChangeDay={setSelected}
          onChangeWeek={handleChangeWeek}
          plannedByDate={plannedByDate}
          getLogsForDate={getLogsForDate}
          onLogWorkout={handleLogPress}
        />
      )}

      {view === 'month' && (
        <MonthView
          viewYear={viewYear}
          viewMonth={viewMonth}
          selected={selected}
          onSelectDay={d => {
            setSelected(d);
            setViewYear(d.getFullYear());
            setViewMonth(d.getMonth());
          }}
          onPrevMonth={prevMonth}
          onNextMonth={nextMonth}
          plannedByDate={plannedByDate}
          logsByDate={logsByDate}
          onLogWorkout={handleLogPress}
        />
      )}

      {/* Override modal */}
      <OverrideModal
        visible={showOverride}
        onClose={() => setShowOverride(false)}
        onConfirmed={handleOverrideConfirmed}
        fatigueScore={fatigueScore}
        recoveryScore={recoveryScore}
        addOverride={addOverride}
      />

      {/* Log workout modal */}
      <LogWorkoutModal
        visible={showLog}
        onClose={() => { setShowLog(false); setPendingOverrideId(undefined); }}
        onSaved={() => { setShowLog(false); setPendingOverrideId(undefined); }}
        onAddLog={addCustomLog}
        currentFatigue={fatigueScore}
        currentRecovery={recoveryScore}
        recentEasyLoad={recentEasyLoad}
        setFatigueScore={setFatigueScore}
        setRecentEasyLoad={setRecentEasyLoad}
        defaultDate={selectedStr}
        overrideId={pendingOverrideId}
      />
    </ScreenLayout>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  // View switcher
  viewSwitcher: {
    flexDirection:     'row',
    marginHorizontal:  spacing.lg,
    marginBottom:      spacing.md,
    backgroundColor:   colors.card,
    borderRadius:      Radius.md,
    borderWidth:       1,
    borderColor:       colors.border,
    padding:           3,
    gap:               3,
  },
  switcherPill: {
    flex:              1,
    paddingVertical:   spacing.sm,
    borderRadius:      Radius.sm,
    alignItems:        'center',
  },
  switcherPillActive: {
    backgroundColor: colors.primary,
  },
  switcherText: {
    color:      colors.textDim,
    fontSize:   FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  switcherTextActive: {
    color:      colors.text,
    fontWeight: FontWeight.bold,
  },

  // Day view nav
  dayNavRow: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical:   spacing.md,
  },
  dayNavTitle: {
    color:      colors.text,
    fontSize:   FontSize.base,
    fontWeight: FontWeight.bold,
  },

  // Month / week nav
  monthNav: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical:   spacing.md,
  },
  navBtn:     { padding: spacing.sm },
  navArrow:   { color: colors.text, fontSize: 24, fontWeight: FontWeight.bold },
  monthTitle: { color: colors.text, fontSize: FontSize.md, fontWeight: FontWeight.bold },

  // Weekday header row (month view)
  dowRow: {
    flexDirection:     'row',
    paddingHorizontal: spacing.xs,
    paddingBottom:     spacing.xs,
  },
  dowLabel: {
    flex:          1,
    textAlign:     'center',
    color:         colors.textMuted,
    fontSize:      FontSize.xs,
    fontWeight:    FontWeight.black,
    letterSpacing: 0.3,
  },

  // Month grid
  weekRow: {
    flexDirection:     'row',
    paddingHorizontal: spacing.xs,
    marginBottom:      2,
  },
  dayCell: {
    flex:            1,
    alignItems:      'center',
    paddingVertical: 5,
    borderRadius:    Radius.sm,
    minHeight:       46,
    gap:             3,
  },
  dayCellToday:    { backgroundColor: colors.primaryDim, borderWidth: 1, borderColor: colors.primary },
  dayCellSelected: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  dayNum:          { color: colors.text,    fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  dayNumFaded:     { color: colors.textDim },
  dayNumToday:     { color: colors.primary, fontWeight: FontWeight.black },
  dayNumSelected:  { fontWeight: FontWeight.black },

  // Week view columns
  weekGridRow: {
    flexDirection:     'row',
    paddingHorizontal: spacing.xs,
    marginBottom:      spacing.sm,
  },
  weekDayCol: {
    flex:            1,
    alignItems:      'center',
    paddingVertical: 8,
    borderRadius:    Radius.sm,
    gap:             4,
  },
  weekDayColToday:    { backgroundColor: colors.primaryDim, borderWidth: 1, borderColor: colors.primary },
  weekDayColSelected: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  weekDowLabel:        { color: colors.textMuted, fontSize: 10, fontWeight: FontWeight.black },
  weekDowLabelToday:   { color: colors.primary },
  weekDayNum:          { color: colors.text, fontSize: FontSize.base, fontWeight: FontWeight.bold },
  weekDayNumToday:     { color: colors.primary, fontWeight: FontWeight.black },
  weekDayNumSelected:  { fontWeight: FontWeight.black },

  // Dots
  dotRow: { flexDirection: 'row', gap: 2, minHeight: 6 },
  dot:    { width: 5, height: 5, borderRadius: 3 },

  // Legend
  legend: {
    flexDirection:     'row',
    gap:               spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical:   spacing.sm,
    justifyContent:    'center',
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  legendDot:  { width: 8, height: 8, borderRadius: 4 },
  legendTxt:  { color: colors.textMuted, fontSize: FontSize.xs },

  // Detail panel
  detailPanel: {
    marginHorizontal: spacing.lg,
    marginTop:        spacing.sm,
    backgroundColor:  colors.card,
    borderRadius:     Radius.md,
    borderWidth:      1,
    borderColor:      colors.border,
    padding:          spacing.lg,
    gap:              spacing.md,
    marginBottom:     spacing.lg,
  },
  detailHeader: {
    flexDirection:  'row',
    alignItems:     'flex-start',
    justifyContent: 'space-between',
  },
  detailDate: { color: colors.text, fontSize: FontSize.base, fontWeight: FontWeight.bold },
  detailMeta: { color: colors.textMuted, fontSize: FontSize.xs, marginTop: 2 },
  logDayBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.xs,
    backgroundColor:   colors.primaryDim,
    borderRadius:      Radius.sm,
    borderWidth:       1,
    borderColor:       colors.primary,
  },
  logDayTxt: { color: colors.primary, fontSize: FontSize.sm, fontWeight: FontWeight.bold },

  sectionGroup: { gap: spacing.sm },
  groupLabel: {
    color:         colors.textMuted,
    fontSize:      9,
    fontWeight:    FontWeight.black,
    letterSpacing: 0.6,
  },

  entryRow:   { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  entryDot:   { width: 10, height: 10, borderRadius: 5, marginTop: 3, flexShrink: 0 },
  entryInfo:  { flex: 1, gap: 2 },
  entryLabel: { color: colors.text, fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  entryMeta:  { color: colors.textMuted, fontSize: FontSize.xs },
  entryNotes: { color: colors.textMuted, fontSize: FontSize.xs, fontStyle: 'italic' },
  entryDone:  { color: colors.positive, fontSize: FontSize.xs, fontWeight: FontWeight.bold },

  emptyTxt: {
    color:          colors.textMuted,
    fontSize:       FontSize.sm,
    textAlign:      'center',
    paddingVertical: spacing.md,
  },
});
