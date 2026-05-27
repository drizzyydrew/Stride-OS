// ─── Calendar Screen ──────────────────────────────────────────────────────────
//
// Month calendar showing planned + logged workouts.
// Week starts on Sunday. Tapping a day shows planned sessions and logged sessions.
// Visual indicators: blue=run, purple=strength, green=mobility, orange=cross-training.
//
// Business logic: calendarEngine.ts (date mapping), customWorkoutStore, workoutGenerator.

import { useState, useMemo } from 'react';
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

const DOW_HEADERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

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

// ─── Day Cell ─────────────────────────────────────────────────────────────────

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
        isToday    && s.dayCellToday,
        selected   && !isToday && s.dayCellSelected,
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

// ─── Day Detail Panel ─────────────────────────────────────────────────────────

function EntryRow({ entry }: { entry: CalendarEntry }) {
  const durationMin =
    entry.workout?.durationMinutes ??
    entry.session?.exercises.length ? (entry.session!.exercises.length * 4) : 0;

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
            {entry.session.exercises.length} exercises · {entry.session.sessionType}
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

      {/* Planned sessions */}
      {plannedEntries.length > 0 && (
        <View style={s.sectionGroup}>
          <Text style={s.groupLabel}>PLANNED</Text>
          {plannedEntries.map((e, i) => <EntryRow key={i} entry={e} />)}
        </View>
      )}

      {/* Logged sessions */}
      {customLogs.length > 0 && (
        <View style={s.sectionGroup}>
          <Text style={s.groupLabel}>LOGGED</Text>
          {customLogs.map(log => <LogRow key={log.id} log={log} />)}
        </View>
      )}

      {/* Empty state */}
      {plannedEntries.length === 0 && customLogs.length === 0 && (
        <Text style={s.emptyTxt}>
          {isFuture ? 'No sessions planned' : 'No sessions logged'}
        </Text>
      )}
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function CalendarScreen() {
  const today = new Date();

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

  // ── Unified plan — single source of truth for run + strength calendar data ─
  const { calendarMap: plannedByDate } = useWeekPlan();

  // ── Month grid ─────────────────────────────────────────────────────────────
  const weeks = useMemo(() => weeksInMonth(viewYear, viewMonth), [viewYear, viewMonth]);

  const firstDay = toYMD(new Date(viewYear, viewMonth, 1));
  const lastDay  = toYMD(new Date(viewYear, viewMonth + 1, 0));
  const monthLogs = getLogsForRange(firstDay, lastDay);

  const logsByDate = useMemo(() => {
    const map = new Map<string, typeof monthLogs>();
    for (const log of monthLogs) {
      const arr = map.get(log.date) ?? [];
      arr.push(log);
      map.set(log.date, arr);
    }
    return map;
  }, [monthLogs]);

  const todayStr    = toYMD(today);
  const selectedStr = toYMD(selected);

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
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

  const selectedPlanned = plannedByDate.get(selectedStr) ?? [];
  const selectedLogs    = getLogsForDate(selectedStr);

  return (
    <ScreenLayout
      title="Calendar"
      fab={<FloatingActionButton icon="add" onPress={handleLogPress} />}
    >
      {/* Month navigation */}
      <View style={s.monthNav}>
        <Pressable onPress={prevMonth} style={s.navBtn} hitSlop={12}>
          <Text style={s.navArrow}>‹</Text>
        </Pressable>
        <Text style={s.monthTitle}>{MONTH_NAMES[viewMonth]} {viewYear}</Text>
        <Pressable onPress={nextMonth} style={s.navBtn} hitSlop={12}>
          <Text style={s.navArrow}>›</Text>
        </Pressable>
      </View>

      {/* Weekday headers — Sunday first */}
      <View style={s.dowRow}>
        {DOW_HEADERS.map(d => (
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
                onPress={() => setSelected(day)}
              />
            );
          })}
        </View>
      ))}

      {/* Legend */}
      <View style={s.legend}>
        {[
          { color: '#2563EB', label: 'Running'   },
          { color: '#A855F7', label: 'Strength'  },
          { color: '#F97316', label: 'Cross'     },
          { color: '#4ADE80', label: 'Mobility'  },
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
        plannedEntries={selectedPlanned}
        customLogs={selectedLogs}
        onLogWorkout={handleLogPress}
      />

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

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  monthNav: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical:   spacing.md,
  },
  navBtn:     { padding: spacing.sm },
  navArrow:   { color: colors.text,     fontSize: 24, fontWeight: FontWeight.bold },
  monthTitle: { color: colors.text,     fontSize: FontSize.md, fontWeight: FontWeight.bold },

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
  dayCellToday: {
    backgroundColor: colors.primaryDim,
    borderWidth:     1,
    borderColor:     colors.primary,
  },
  dayCellSelected: {
    backgroundColor: colors.card,
    borderWidth:     1,
    borderColor:     colors.border,
  },
  dayNum:        { color: colors.text,    fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  dayNumFaded:   { color: colors.textDim },
  dayNumToday:   { color: colors.primary, fontWeight: FontWeight.black },
  dayNumSelected:{ fontWeight: FontWeight.black },
  dotRow: { flexDirection: 'row', gap: 2, minHeight: 6 },
  dot:    { width: 5, height: 5, borderRadius: 3 },

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

  detailPanel: {
    marginHorizontal:  spacing.lg,
    marginTop:         spacing.sm,
    backgroundColor:   colors.card,
    borderRadius:      Radius.md,
    borderWidth:       1,
    borderColor:       colors.border,
    padding:           spacing.lg,
    gap:               spacing.md,
    marginBottom:      spacing.lg,
  },
  detailHeader: {
    flexDirection:  'row',
    alignItems:     'flex-start',
    justifyContent: 'space-between',
  },
  detailDate: {
    color:      colors.text,
    fontSize:   FontSize.base,
    fontWeight: FontWeight.bold,
  },
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

  sectionGroup:  { gap: spacing.sm },
  groupLabel: {
    color:         colors.textMuted,
    fontSize:      9,
    fontWeight:    FontWeight.black,
    letterSpacing: 0.6,
  },

  entryRow: {
    flexDirection: 'row',
    alignItems:    'flex-start',
    gap:           spacing.sm,
  },
  entryDot:   { width: 10, height: 10, borderRadius: 5, marginTop: 3, flexShrink: 0 },
  entryInfo:  { flex: 1, gap: 2 },
  entryLabel: { color: colors.text, fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  entryMeta:  { color: colors.textMuted, fontSize: FontSize.xs },
  entryNotes: { color: colors.textMuted, fontSize: FontSize.xs, fontStyle: 'italic' },
  entryDone:  { color: colors.positive, fontSize: FontSize.xs, fontWeight: FontWeight.bold },

  emptyTxt: {
    color:      colors.textMuted,
    fontSize:   FontSize.sm,
    textAlign:  'center',
    paddingVertical: spacing.md,
  },
});
