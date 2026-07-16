import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { LAYOUT } from '../../../src/constants/layout';
import { useColors } from '../../../src/theme/useColors';
import InfoButton from '../../../src/components/shared/InfoButton';

import { useWeekPlan }      from '../../../src/hooks/useWeekPlan';
import { usePlanTimeline }  from '../../../src/hooks/usePlanTimeline';
import { useAthleteStore }  from '../../../src/store/athleteStore';
import { useActivityStore } from '../../../src/store/activityStore';
import { useBeginnerPlanStore } from '../../../src/store/beginnerPlanStore';

import { addDays, parseYMD, toYMD } from '../../../src/utils/calendarEngine';
import type { CalendarEntry }       from '../../../src/utils/calendarEngine';
import { getPhaseTypesForWeek }     from '../../../src/utils/workoutEngine';
import { getPhaseSessionPreview } from '../../../src/utils/strengthEngine';
import { RICH_TYPE_LABEL }          from '../../../src/utils/trainingEngine';
import type { MacroWeek, Race }     from '../../../src/types/plan';
import type { ActivityType } from '../../../src/types/activity';

type CalendarView = 'month' | 'week' | 'day';

type CalendarCell = {
  date: Date | null;
  key:  string;
};

const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function startOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function startOfWeek(date: Date): Date {
  return addDays(startOfDay(date), -date.getDay());
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function buildMonthCells(monthDate: Date): CalendarCell[] {
  const year  = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDay     = new Date(year, month, 1);
  const daysInMonth  = new Date(year, month + 1, 0).getDate();
  const cells: CalendarCell[] = [];

  for (let i = 0; i < firstDay.getDay(); i += 1) {
    cells.push({ date: null, key: `blank-${i}` });
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, month, day);
    cells.push({ date, key: date.toISOString() });
  }
  while (cells.length % 7 !== 0) {
    cells.push({ date: null, key: `blank-end-${cells.length}` });
  }
  return cells;
}

function formatMonth(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function formatDayTitle(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'long' });
}

function formatFriendlyDate(dateYMD: string): string {
  const [y, m, d] = dateYMD.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1)
    .toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

// Mon-first template index (0=Mon…6=Sun) for a JS Date (0=Sun…6=Sat).
function templateIndexFor(date: Date): number {
  return (date.getDay() + 6) % 7;
}

function weekBadge(mw: MacroWeek | null): { label: string; kind: 'race' | 'taper' | 'deload' } | null {
  if (!mw) return null;
  if (mw.isRaceWeek) return { label: 'RACE WEEK', kind: 'race' };
  if (mw.isTaper)    return { label: 'TAPER',     kind: 'taper' };
  if (mw.isDeload)   return { label: 'DELOAD',    kind: 'deload' };
  return null;
}

export default function CalendarScreen() {
  const C = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const weekPlan  = useWeekPlan();
  const timeline  = usePlanTimeline();
  const progressionLevel = useAthleteStore(s => s.progressionLevel);
  const activities = useActivityStore(s => s.activities);
  const activeBeginnerPlan = useBeginnerPlanStore(s => s.activePlan);

  const today    = useMemo(() => startOfDay(new Date()), []);
  const todayYMD = useMemo(() => toYMD(today), [today]);

  const [view, setView] = useState<CalendarView>('week');
  const [selectedDate, setSelectedDate] = useState(today);
  const [displayedMonth, setDisplayedMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));

  const monthCells = useMemo(() => buildMonthCells(displayedMonth), [displayedMonth]);
  const weekStart  = startOfWeek(selectedDate);
  const weekDays   = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)),
    [weekStart.getTime()],
  );

  // ── Real entries for any date ──────────────────────────────────────────────

  function completedEntriesForDate(dateYMD: string): CalendarEntry[] {
    const typeFor = (type: ActivityType): CalendarEntry['type'] => {
      if (type === 'running') return 'run';
      if (type === 'walking') return 'walk';
      if (type === 'cycling' || type === 'indoor_cycling') return 'cycling';
      if (type === 'swimming') return 'swimming';
      if (type === 'hiking') return 'hiking';
      if (type.includes('skiing')) return 'skiing';
      if (type === 'hiit') return 'hiit';
      if (type === 'mixed_modal') return 'mixed';
      if (type === 'strength') return 'strength';
      if (type === 'mobility') return 'mobility';
      return 'custom';
    };
    return activities
      .filter(activity => toYMD(new Date(activity.startTime)) === dateYMD)
      .map(activity => ({
        date: dateYMD,
        type: activity.subtype === 'run_walk' ? 'run_walk' : typeFor(activity.activityType),
        label: activity.subtype === 'run_walk'
          ? 'Run / Walk'
          : activity.activityType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        color: activity.activityType === 'strength' ? C.accent : C.primary,
        completed: activity.status === 'completed',
        missed: activity.status === 'skipped',
      }));
  }

  function beginnerPlanEntriesForDate(dateYMD: string): CalendarEntry[] {
    if (!activeBeginnerPlan || dateYMD < activeBeginnerPlan.startDate || dateYMD > activeBeginnerPlan.targetDate) return [];
    const start = parseYMD(activeBeginnerPlan.startDate);
    const date = parseYMD(dateYMD);
    const dayOffset = Math.floor((date.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
    const week = activeBeginnerPlan.weeks[Math.floor(dayOffset / 7)];
    if (!week) return [];
    const dayIndex = dayOffset % 7;
    return week.sessions
      .filter(session => session.dayIndex === dayIndex)
      .map(session => ({
        date: dateYMD,
        type: session.kind === 'run_walk'
          ? 'run_walk'
          : session.kind === 'walk'
            ? 'walk'
            : session.kind === 'strength'
              ? 'strength'
              : session.kind === 'mobility'
                ? 'mobility'
                : session.kind === 'cross_training'
                  ? 'cycling'
                  : 'run',
        label: session.kind.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        color: session.kind === 'strength' ? C.accent : C.primary,
        completed: false,
      }));
  }

  function raceEntry(race: Race): CalendarEntry {
    return { date: race.date, type: 'race', label: `Race Day: ${race.name}`, color: '#DCC0A7', completed: false };
  }

  function entriesForDate(date: Date): { entries: CalendarEntry[]; macroWeek: MacroWeek | null; beforeStart: boolean } {
    const dateYMD = toYMD(date);

    if (!timeline.programStartDate || dateYMD < timeline.programStartDate) {
      return { entries: [], macroWeek: null, beforeStart: true };
    }

    const macroWeek = timeline.weekForDate(date);
    const race = timeline.races.find(r => r.date === dateYMD);

    if (!macroWeek) {
      return { entries: race ? [raceEntry(race)] : [], macroWeek: null, beforeStart: false };
    }

    const isCurrentWeek = weekPlan.metadata.currentWeek > 0 && macroWeek.weekNumber === weekPlan.metadata.currentWeek;

    // Current week is fully authoritative — whatever the real calendarMap says
    // (including "nothing", i.e. a genuine rest day) is final. Never fall back
    // to a template guess here, or a rest day could show a fabricated workout.
    if (isCurrentWeek) {
      return { entries: weekPlan.calendarMap.get(dateYMD) ?? [], macroWeek, beforeStart: false };
    }

    if (race) return { entries: [raceEntry(race)], macroWeek, beforeStart: false };

    const logged = completedEntriesForDate(dateYMD);
    if (logged.length > 0) return { entries: logged, macroWeek, beforeStart: false };
    const preset = beginnerPlanEntriesForDate(dateYMD);
    if (preset.length > 0) return { entries: preset, macroWeek, beforeStart: false };

    // Template preview — titles only, no rich generation.
    const isPast = dateYMD < todayYMD;
    const weekInBlock = ((macroWeek.weekNumber - 1) % 4) + 1;
    const templateTypes = getPhaseTypesForWeek(macroWeek.phase, progressionLevel, weekInBlock);
    const templateIdx = templateIndexFor(date);
    const runType = templateTypes[templateIdx];

    const entries: CalendarEntry[] = [];
    if (runType && runType !== 'rest') {
      entries.push({
        date: dateYMD, type: 'run',
        label: RICH_TYPE_LABEL[runType] ?? runType,
        color: C.primary, completed: false, missed: isPast,
      });
    }
    const strengthPreview = getPhaseSessionPreview(macroWeek.phase, progressionLevel);
    if (strengthPreview.sessionDays.includes(templateIdx)) {
      entries.push({
        date: dateYMD, type: 'strength',
        label: strengthPreview.title,
        color: C.accent, completed: false, missed: isPast,
      });
    }

    return { entries, macroWeek, beforeStart: false };
  }

  function rowState(date: Date, entries: CalendarEntry[], beforeStart: boolean): 'empty' | 'race' | 'completed' | 'missed' | 'today' | 'rest' | 'upcoming' {
    if (beforeStart) return 'empty';
    if (entries.some(e => e.type === 'race')) return 'race';
    if (sameDay(date, today)) return 'today';
    if (entries.length === 0) return 'rest';
    if (entries.some(e => e.missed)) return 'missed';
    if (entries.every(e => e.completed)) return 'completed';
    return toYMD(date) < todayYMD ? 'missed' : 'upcoming';
  }

  const STATE_COLOR: Record<string, string> = {
    empty:     C.textMuted,
    race:      '#DCC0A7',
    completed: C.positive,
    missed:    C.critical,
    today:     C.primary,
    rest:      C.textMuted,
    upcoming:  C.textDim,
  };

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
            const info = cell.date ? entriesForDate(cell.date) : null;
            const state = cell.date ? rowState(cell.date, info!.entries, info!.beforeStart) : 'empty';
            const dotColor = cell.date && info!.entries.length > 0 ? STATE_COLOR[state] : 'transparent';
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
            ['Upcoming', C.textDim],
            ['Completed', C.positive],
            ['Missed', C.critical],
            ['Race', '#DCC0A7'],
            ['Deload/Taper', C.warning],
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
      const info  = entriesForDate(day);
      const state = rowState(day, info.entries, info.beforeStart);
      const title = info.beforeStart
        ? 'Not started yet'
        : info.entries.length > 0
          ? info.entries.map(e => e.label).join('  +  ')
          : 'Rest';
      return { day, info, state, title };
    });

    const completedCount = weekItems.filter(i => i.state === 'completed').length;
    const totalPlanned   = weekItems.filter(i => i.info.entries.length > 0).length;
    const badge = weekBadge(weekItems.find(i => i.info.macroWeek)?.info.macroWeek ?? null);
    const focus = weekItems.find(i => i.info.macroWeek)?.info.macroWeek?.focus;

    return (
      <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
        {focus ? (
          <View style={styles.weekFocusRow}>
            <Text style={[styles.weekFocusText, { color: C.textMuted }]}>{focus}</Text>
            {badge ? (
              <View style={[styles.badge, { backgroundColor: badgeBg(badge.kind, C), borderColor: badgeFg(badge.kind, C) }]}>
                <Text style={[styles.badgeText, { color: badgeFg(badge.kind, C) }]}>{badge.label}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        <View style={styles.weekList}>
          {weekItems.map(item => {
            const isToday = sameDay(item.day, today);
            return (
              <TouchableOpacity
                key={item.day.toISOString()}
                style={[
                  styles.weekItem,
                  {
                    backgroundColor: isToday ? C.primaryDim : C.cardAlt,
                    borderColor: isToday ? C.primary : 'transparent',
                    opacity: item.info.beforeStart ? 0.55 : 1,
                  },
                ]}
                onPress={() => selectDate(item.day)}
                activeOpacity={0.75}
              >
                <Text style={[styles.weekDay, { color: STATE_COLOR[item.state] }]}>
                  {item.day.toLocaleDateString('en-US', { weekday: 'short' })}
                </Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.weekTitle, { color: C.text }]} numberOfLines={1}>
                    {item.title}{isToday ? ' · Today' : ''}
                  </Text>
                </View>
                {item.state === 'completed' ? (
                  <Text style={[styles.doneText, { color: C.positive }]}>Done</Text>
                ) : item.state === 'missed' ? (
                  <Text style={[styles.doneText, { color: C.critical }]}>Missed</Text>
                ) : item.state === 'race' ? (
                  <Ionicons name="flag" size={16} color="#DCC0A7" />
                ) : isToday ? (
                  <View style={[styles.todayBadge, { backgroundColor: C.primaryDim, borderColor: C.primary }]}>
                    <Text style={[styles.todayBadgeText, { color: C.primary }]}>TODAY</Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            );
          })}
        </View>

        {totalPlanned > 0 ? (
          <View style={[styles.weekProgress, { borderTopColor: C.border }]}>
            <Text style={[styles.weekProgressText, { color: C.textMuted }]}>
              Weekly Progress · {completedCount} / {totalPlanned}
            </Text>
            <View style={[styles.progressTrack, { backgroundColor: C.border }]}>
              <View style={[styles.progressFill, { backgroundColor: C.primary, width: `${Math.round((completedCount / totalPlanned) * 100)}%` }]} />
            </View>
          </View>
        ) : null}
      </View>
    );
  }

  function renderDayView() {
    const isToday   = sameDay(selectedDate, today);
    const isFuture  = toYMD(selectedDate) > todayYMD;
    const monthShort = selectedDate.toLocaleDateString('en-US', { month: 'short' });
    const info  = entriesForDate(selectedDate);
    const state = rowState(selectedDate, info.entries, info.beforeStart);
    const isCurrentWeek = info.macroWeek && weekPlan.metadata.currentWeek > 0 && info.macroWeek.weekNumber === weekPlan.metadata.currentWeek;

    return (
      <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
        <Text style={[styles.dayMeta, { color: C.textDim }]}>{monthShort} {selectedDate.getDate()} · {selectedDate.getFullYear()}</Text>
        <Text style={[styles.dayTitle, { color: C.text }]}>{formatDayTitle(selectedDate)}</Text>

        {info.beforeStart ? (
          <View style={[styles.summaryBox, { backgroundColor: C.cardAlt }]}>
            <Text style={[styles.futureText, { color: C.textMuted }]}>
              Your plan hasn't started yet{weekPlan.metadata.startsOn ? ` — it begins ${formatFriendlyDate(weekPlan.metadata.startsOn)}.` : '.'}
            </Text>
          </View>
        ) : info.entries.length === 0 ? (
          <View style={[styles.summaryBox, { backgroundColor: C.cardAlt }]}>
            <Text style={[styles.futureText, { color: C.textMuted }]}>Rest day. No structured session planned.</Text>
          </View>
        ) : (
          info.entries.map((entry, i) => (
            <View key={`${entry.type}-${i}`} style={[styles.summaryBox, { backgroundColor: C.cardAlt }]}>
              <Text style={[styles.summaryLabel, { color: C.textDim }]}>
                {entry.type === 'race' ? 'RACE DAY' : entry.type.replace(/_/g, ' ').toUpperCase()}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={[styles.dayEntryTitle, { color: C.text }]}>{entry.label}</Text>
                {entry.type !== 'race' && (
                  <InfoButton term={entry.workout?.type ?? (entry.type === 'strength' ? 'strength' : 'rest')} />
                )}
              </View>
              {entry.workout ? (
                <Text style={[styles.futureText, { color: C.textMuted, marginTop: 4 }]}>
                  {(entry.workout as any).purpose ?? entry.workout.description}
                </Text>
              ) : null}
              {entry.session ? (
                <Text style={[styles.futureText, { color: C.textMuted, marginTop: 4 }]}>{entry.session.purpose}</Text>
              ) : null}
              <Text style={[styles.futureText, { color: entry.completed ? C.positive : entry.missed ? C.critical : C.textMuted, marginTop: 6, fontWeight: '700' }]}>
                {entry.completed ? 'Completed' : entry.missed ? 'Missed' : isFuture ? 'Upcoming' : 'Planned'}
              </Text>
            </View>
          ))
        )}

        {isCurrentWeek && weekPlan.adaptations.length > 0 ? (
          <View style={[styles.summaryBox, { backgroundColor: C.cardAlt }]}>
            <Text style={[styles.summaryLabel, { color: C.textDim }]}>THIS WEEK'S ADAPTATIONS</Text>
            {weekPlan.adaptations.map((note, i) => (
              <Text key={i} style={[styles.futureText, { color: C.textMuted, marginTop: i === 0 ? 0 : 4 }]}>{note}</Text>
            ))}
          </View>
        ) : null}

        {!info.beforeStart && info.entries.some(e => !e.completed && e.type !== 'race') && (isToday || (isFuture && isCurrentWeek)) ? (
          <TouchableOpacity
            style={[styles.startButton, { backgroundColor: C.primary }]}
            onPress={() => router.push((
              info.entries.some(e => e.type === 'strength') && info.entries.every(e => e.type === 'strength')
                ? '/(tabs)/strength'
                : info.entries.some(e => ['walk', 'run_walk', 'cycling', 'swimming', 'hiking', 'skiing', 'hiit', 'mixed'].includes(e.type))
                  ? '/(tabs)/activity'
                  : '/(tabs)/training'
            ) as never)}
            activeOpacity={0.8}
          >
            <Text style={[styles.startButtonText, { color: C.onPrimary }]}>{isToday ? "Go to Today's Session →" : 'Preview Session →'}</Text>
          </TouchableOpacity>
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

function badgeBg(kind: 'race' | 'taper' | 'deload', C: ReturnType<typeof useColors>): string {
  if (kind === 'race') return 'rgba(220,192,167,0.18)';
  if (kind === 'taper') return C.warningDim;
  return C.positiveDim;
}
function badgeFg(kind: 'race' | 'taper' | 'deload', C: ReturnType<typeof useColors>): string {
  if (kind === 'race') return '#DCC0A7';
  if (kind === 'taper') return C.warning;
  return C.positive;
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
  weekFocusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 10,
  },
  weekFocusText: {
    fontSize: 12,
    flex: 1,
    lineHeight: 17,
  },
  badge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
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
  dayEntryTitle: {
    fontSize: 15,
    fontWeight: '700',
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
