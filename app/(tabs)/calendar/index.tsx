// ─── Calendar Screen ──────────────────────────────────────────────────────────
//
// Week and month view of planned + logged workouts.
// Tap any day to log a custom workout or view completed sessions.
// Business logic: customWorkoutStore, workoutStore, athleteStore.
// No calculations happen in this component.

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
import { useWorkoutStore }       from '../../../src/store/workoutStore';
import { generateTrainingWeek }  from '../../../src/utils/workoutGenerator';

import ScreenLayout              from '../../../src/layout/ScreenLayout';
import FloatingActionButton      from '../../../src/layout/FloatingActionButton';
import LogWorkoutModal           from '../../../src/components/shared/LogWorkoutModal';
import OverrideModal             from '../../../src/components/shared/OverrideModal';

import { colors }  from '../../../src/theme/colors';
import { spacing } from '../../../src/theme/spacing';
import { FontSize, FontWeight, Radius } from '../../../src/theme/tokens';

// ─── Date helpers ─────────────────────────────────────────────────────────────

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

function toYMD(d: Date): string {
  return d.toISOString().split('T')[0]!;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function mondayOf(d: Date): Date {
  const day = d.getDay(); // 0=Sun
  const offset = day === 0 ? -6 : 1 - day;
  return addDays(d, offset);
}

function weeksInMonth(year: number, month: number): Date[][] {
  const weeks: Date[][] = [];
  const first = new Date(year, month, 1);
  const start = mondayOf(first);
  let cursor = start;
  while (cursor.getMonth() <= month || cursor < first) {
    const week: Date[] = [];
    for (let i = 0; i < 7; i++) week.push(new Date(cursor.setDate(cursor.getDate() + (i === 0 ? 0 : 1))));
    // rebuild properly to avoid mutation issues
    const weekStart = addDays(start, weeks.length * 7);
    const cleanWeek = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
    if (cleanWeek[0]!.getMonth() > month && cleanWeek[0]!.getFullYear() >= year) break;
    weeks.push(cleanWeek);
    cursor = addDays(weekStart, 7);
    if (weeks.length > 6) break;
  }
  return weeks;
}

// ─── Entry dot ────────────────────────────────────────────────────────────────

type DayDot = {
  color: string;
  label: string;
};

// ─── Day Cell ─────────────────────────────────────────────────────────────────

function DayCell({
  date, isToday, isCurrentMonth, dots, selected, onPress,
}: {
  date:           Date;
  isToday:        boolean;
  isCurrentMonth: boolean;
  dots:           DayDot[];
  selected:       boolean;
  onPress:        () => void;
}) {
  return (
    <Pressable
      style={[
        s.dayCell,
        isToday   && s.dayCellToday,
        selected  && s.dayCellSelected,
      ]}
      onPress={onPress}
    >
      <Text style={[
        s.dayNum,
        !isCurrentMonth && s.dayNumFaded,
        isToday         && s.dayNumToday,
        selected        && s.dayNumSelected,
      ]}>
        {date.getDate()}
      </Text>
      <View style={s.dotRow}>
        {dots.slice(0, 3).map((dot, i) => (
          <View key={i} style={[s.dot, { backgroundColor: dot.color }]} />
        ))}
      </View>
    </Pressable>
  );
}

// ─── Day Detail Panel ─────────────────────────────────────────────────────────

function DayDetail({
  date,
  customLogs,
  onLogWorkout,
}: {
  date:         Date;
  customLogs:   ReturnType<ReturnType<typeof useCustomWorkoutStore>['getLogsForDate']>;
  onLogWorkout: () => void;
}) {
  const dateStr   = toYMD(date);
  const today     = toYMD(new Date());
  const isPast    = dateStr < today;
  const isToday   = dateStr === today;
  const isFuture  = dateStr > today;

  return (
    <View style={s.detailPanel}>
      <View style={s.detailHeader}>
        <Text style={s.detailDate}>
          {date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </Text>
        {(isToday || isPast) && (
          <Pressable style={s.logDayBtn} onPress={onLogWorkout}>
            <Text style={s.logDayTxt}>+ Log</Text>
          </Pressable>
        )}
      </View>

      {customLogs.length === 0 && (
        <Text style={s.emptyDayTxt}>
          {isFuture ? 'No workouts planned' : 'No workouts logged'}
        </Text>
      )}

      {customLogs.map(log => (
        <View key={log.id} style={s.logRow}>
          <View style={[s.logDot, { backgroundColor: categoryColor(log.category) }]} />
          <View style={s.logInfo}>
            <Text style={s.logTitle}>{categoryLabel(log.category)}</Text>
            <Text style={s.logMeta}>
              {log.durationMinutes ?? log.strengthDurationMin ?? log.crossDurationMin ?? log.mobilityDurationMin ?? log.otherDurationMin ?? 0} min
              {log.distanceMiles ? ` · ${log.distanceMiles.toFixed(1)} mi` : ''}
              {log.rpe ? ` · RPE ${log.rpe}` : ''}
            </Text>
            {log.notes ? <Text style={s.logNotes} numberOfLines={2}>{log.notes}</Text> : null}
          </View>
          <View style={s.logLoad}>
            <Text style={s.logLoadVal}>{Math.round(log.estimatedLoad)}</Text>
            <Text style={s.logLoadUnit}>load</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function categoryColor(cat: string): string {
  switch (cat) {
    case 'running':        return colors.primary;
    case 'strength':       return '#A855F7';
    case 'cross_training': return '#22D3EE';
    case 'mobility':       return colors.positive;
    default:               return colors.textDim;
  }
}

function categoryLabel(cat: string): string {
  switch (cat) {
    case 'running':        return 'Run';
    case 'strength':       return 'Strength';
    case 'cross_training': return 'Cross-Training';
    case 'mobility':       return 'Mobility';
    default:               return 'Other';
  }
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function CalendarScreen() {
  const today = new Date();

  const [viewYear,  setViewYear]  = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selected,  setSelected]  = useState<Date>(today);
  const [showLog,   setShowLog]   = useState(false);
  const [showOverride, setShowOverride] = useState(false);
  const [pendingOverrideId, setPendingOverrideId] = useState<string | undefined>();

  const {
    fatigueScore, recoveryScore,
    weeklyMileage, goalRace, currentWeek, trainingPhase, progressionLevel,
    setFatigueScore, setRecentEasyLoad, recentEasyLoad,
  } = useAthleteStore();

  const { addLog: addCustomLog, addOverride, getLogsForDate } = useCustomWorkoutStore();

  const weeks = useMemo(() => weeksInMonth(viewYear, viewMonth), [viewYear, viewMonth]);
  const todayStr   = toYMD(today);
  const selectedStr = toYMD(selected);

  // Build a map of date → logs for the visible month
  const firstDay = toYMD(new Date(viewYear, viewMonth, 1));
  const lastDay  = toYMD(new Date(viewYear, viewMonth + 1, 0));
  const monthLogs = useCustomWorkoutStore(s => s.getLogsForRange)(firstDay, lastDay);

  const logsByDate = useMemo(() => {
    const map = new Map<string, typeof monthLogs>();
    for (const log of monthLogs) {
      const arr = map.get(log.date) ?? [];
      arr.push(log);
      map.set(log.date, arr);
    }
    return map;
  }, [monthLogs]);

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

  const selectedLogs = getLogsForDate(selectedStr);

  return (
    <ScreenLayout
      title="Calendar"
      fab={
        <FloatingActionButton
          icon="add"
          onPress={handleLogPress}
        />
      }
    >
      {/* Month nav */}
      <View style={s.monthNav}>
        <Pressable onPress={prevMonth} style={s.navBtn} hitSlop={12}>
          <Text style={s.navArrow}>‹</Text>
        </Pressable>
        <Text style={s.monthTitle}>
          {MONTH_NAMES[viewMonth]} {viewYear}
        </Text>
        <Pressable onPress={nextMonth} style={s.navBtn} hitSlop={12}>
          <Text style={s.navArrow}>›</Text>
        </Pressable>
      </View>

      {/* Day-of-week header */}
      <View style={s.dowRow}>
        {DOW.map(d => (
          <Text key={d} style={s.dowLabel}>{d}</Text>
        ))}
      </View>

      {/* Calendar grid */}
      {weeks.map((week, wi) => (
        <View key={wi} style={s.weekRow}>
          {week.map((day, di) => {
            const dStr  = toYMD(day);
            const dots: DayDot[] = (logsByDate.get(dStr) ?? []).map(l => ({
              color: categoryColor(l.category),
              label: categoryLabel(l.category),
            }));
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

      {/* Selected day detail */}
      <DayDetail
        date={selected}
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
  navArrow:   { color: colors.text,     fontSize: FontSize.xl, fontWeight: FontWeight.bold },
  monthTitle: { color: colors.text,     fontSize: FontSize.md, fontWeight: FontWeight.bold },

  dowRow: {
    flexDirection:     'row',
    paddingHorizontal: spacing.sm,
    paddingBottom:     spacing.xs,
  },
  dowLabel: {
    flex:       1,
    textAlign:  'center',
    color:      colors.textMuted,
    fontSize:   FontSize.xs,
    fontWeight: FontWeight.black,
    letterSpacing: 0.5,
  },

  weekRow: {
    flexDirection:     'row',
    paddingHorizontal: spacing.sm,
    marginBottom:      2,
  },
  dayCell: {
    flex:            1,
    alignItems:      'center',
    paddingVertical: spacing.xs,
    borderRadius:    Radius.sm,
    minHeight:       44,
    gap:             2,
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
  dayNum: {
    color:      colors.text,
    fontSize:   FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  dayNumFaded:   { color: colors.textDim },
  dayNumToday:   { color: colors.primary, fontWeight: FontWeight.black },
  dayNumSelected:{ fontWeight: FontWeight.black },
  dotRow: {
    flexDirection: 'row',
    gap:           2,
    minHeight:     6,
  },
  dot: {
    width:        5,
    height:       5,
    borderRadius: 3,
  },

  // Day detail panel
  detailPanel: {
    marginTop:         spacing.md,
    marginHorizontal:  spacing.lg,
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
    alignItems:     'center',
    justifyContent: 'space-between',
  },
  detailDate:  { color: colors.text, fontSize: FontSize.base, fontWeight: FontWeight.bold },
  logDayBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.xs,
    backgroundColor:   colors.primaryDim,
    borderRadius:      Radius.sm,
    borderWidth:       1,
    borderColor:       colors.primary,
  },
  logDayTxt:   { color: colors.primary, fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  emptyDayTxt: { color: colors.textMuted, fontSize: FontSize.sm, textAlign: 'center', paddingVertical: spacing.md },

  logRow: {
    flexDirection: 'row',
    alignItems:    'flex-start',
    gap:           spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop:    spacing.md,
  },
  logDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  logInfo: { flex: 1, gap: 2 },
  logTitle: { color: colors.text, fontSize: FontSize.base, fontWeight: FontWeight.bold },
  logMeta:  { color: colors.textMuted, fontSize: FontSize.xs },
  logNotes: { color: colors.textMuted, fontSize: FontSize.xs, fontStyle: 'italic' },
  logLoad:  { alignItems: 'center' },
  logLoadVal:  { color: colors.text, fontSize: FontSize.md, fontWeight: FontWeight.bold },
  logLoadUnit: { color: colors.textMuted, fontSize: FontSize.xs },
});
