// ─── Macro Planner ────────────────────────────────────────────────────────────
//
// Pure, date-anchored macro-cycle generator. Produces a MacroPlan — a Sunday-
// indexed sequence of MacroWeeks spanning the athlete's full training horizon —
// from goalType + programStartDate + races + experience signals.
//
// This sits ABOVE the weekly engines (workoutEngine/strengthEngine): it decides
// WHICH phase + week-number applies to any given calendar date. The weekly
// engines still decide WHAT that phase's sessions look like.
//
// All logic is deterministic and pure. No side effects, no store access.

import type { TrainingPhase, RaceDistance, ProgressionLevel } from '../../types/training';
import type { MacroPlan, MacroWeek, Race, RacePriority, TrainingGoalType } from '../../types/plan';
import { sundayOf, addDays, toYMD, parseYMD } from '../calendarEngine';
import { getPlanTemplateForDistance, type PlanTemplate } from '../periodization';

export const RACE_BLOCK_MAX_WEEKS = 22;

const DAY_MS          = 24 * 60 * 60 * 1000;
const MIN_TOTAL_WEEKS = 60;

// ─── Date helpers ─────────────────────────────────────────────────────────────

// Weeks run Sunday–Saturday to match calendarEngine.sundayOf. Returns null
// when `date` falls before the plan's start week (midnight-safe).
export function weekNumberForDate(startDate: string, date: Date): number | null {
  const start         = sundayOf(parseYMD(startDate));
  const targetSunday  = sundayOf(date);
  const diffDays      = Math.round((targetSunday.getTime() - start.getTime()) / DAY_MS);
  if (diffDays < 0) return null;
  return Math.floor(diffDays / 7) + 1;
}

function weekStartForNumber(startDate: string, weekNumber: number): Date {
  const start = sundayOf(parseYMD(startDate));
  return addDays(start, (weekNumber - 1) * 7);
}

// ─── Beginner gate ────────────────────────────────────────────────────────────

function isBeginnerGated(
  progressionLevel: ProgressionLevel,
  yearsRunning:     number,
  weeklyMileage:    number,
): boolean {
  return progressionLevel === 'beginner' || yearsRunning < 1 || weeklyMileage < 10;
}

function foundationLength(weeklyMileage: number): number {
  return weeklyMileage < 5 ? 6 : 4;
}

// ─── Focus copy ───────────────────────────────────────────────────────────────

function foundationFocus(goalType: TrainingGoalType): string {
  if (goalType === 'hybrid') {
    return 'Foundation — building the aerobic habit while introducing light strength work';
  }
  return 'Foundation — building the aerobic engine and letting tendons and bones adapt before intensity';
}

function baseFocus(goalType: TrainingGoalType): string {
  if (goalType === 'hybrid') return 'Aerobic base — consistency first, balanced with strength work';
  if (goalType === 'general_strength') return 'Strength-first — running supports the lifting program';
  return 'Aerobic base — consistency first';
}

function buildFocus(goalType: TrainingGoalType): string {
  if (goalType === 'hybrid') return 'Building block — light quality work, balanced against lifting load';
  return 'Building block — light quality work';
}

function focusForPhase(phase: TrainingPhase, goalType: TrainingGoalType, race?: Race): string {
  switch (phase) {
    case 'foundation': return foundationFocus(goalType);
    case 'base':        return baseFocus(goalType);
    case 'build':        return buildFocus(goalType);
    case 'peak':          return 'Peak — race-specific sharpening';
    case 'deload':        return 'Deload — recovery week, let the adaptations lock in';
    case 'taper':          return race ? `Taper — arriving fresh for ${race.name}` : 'Taper — arriving fresh for race day';
  }
}

// ─── Week factory ─────────────────────────────────────────────────────────────

function makeWeek(
  startDate:  string,
  weekNumber: number,
  phase:      TrainingPhase,
  opts: { focus: string; isRaceWeek?: boolean; raceId?: string },
): MacroWeek {
  return {
    weekNumber,
    startDate:  toYMD(weekStartForNumber(startDate, weekNumber)),
    phase,
    isDeload:   phase === 'deload',
    isTaper:    phase === 'taper',
    isRaceWeek: opts.isRaceWeek ?? false,
    raceId:     opts.raceId,
    focus:      opts.focus,
  };
}

function deloadOr(weekNumber: number, phase: TrainingPhase): TrainingPhase {
  return weekNumber % 4 === 0 ? 'deload' : phase;
}

// ─── Race selection ───────────────────────────────────────────────────────────

const PRIORITY_RANK: Record<RacePriority, number> = { A: 0, B: 1, tune_up: 2 };

export function pickTargetRace(races: Race[], startDate: string): Race | null {
  const eligible = races.filter(r => weekNumberForDate(startDate, parseYMD(r.date)) !== null);
  if (eligible.length === 0) return null;
  return [...eligible].sort((a, b) => {
    const pr = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    if (pr !== 0) return pr;
    return a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
  })[0]!;
}

// Any race (other than the excluded one) whose date falls within the week
// starting at `weekStart`. Used by the calendar to surface B/tune-up races.
export function raceForWeek(races: Race[], weekStart: Date): Race | null {
  const start = sundayOf(weekStart);
  const end   = addDays(start, 6);
  const found = races.find(r => {
    const d = parseYMD(r.date);
    return d.getTime() >= start.getTime() && d.getTime() <= end.getTime();
  });
  return found ?? null;
}

// ─── Phase-template scaling ───────────────────────────────────────────────────
//
// Proportionally compresses/stretches a PLAN_TEMPLATES phase shape to fit a
// specific number of weeks. Guarantees: every phase keeps at least 1 week,
// the total always equals targetWeeks exactly (rounding absorbed by the
// largest non-taper phase). Callers additionally force the final 2 weeks to
// taper — this function only sets up a reasonable starting shape.

function scalePhases(
  template:    PlanTemplate,
  targetWeeks: number,
): { phase: TrainingPhase; startWeek: number; endWeek: number }[] {
  const T = template.totalWeeks;
  const W = Math.max(1, targetWeeks);

  const scaled = template.phases.map(p => {
    const len = p.endWeek - p.startWeek + 1;
    return { phase: p.phase, len: Math.max(1, Math.round((len / T) * W)) };
  });

  const total = scaled.reduce((s, p) => s + p.len, 0);
  const diff  = W - total;

  if (diff !== 0) {
    const nonTaper = scaled
      .map((p, i) => ({ i, len: p.len, taper: p.phase === 'taper' }))
      .filter(c => !c.taper)
      .sort((a, b) => b.len - a.len);
    const target = nonTaper[0]?.i ?? 0;
    scaled[target]!.len = Math.max(1, scaled[target]!.len + diff);
  }

  let cursor = 1;
  return scaled.map(p => {
    const startWeek = cursor;
    const endWeek   = cursor + p.len - 1;
    cursor = endWeek + 1;
    return { phase: p.phase, startWeek, endWeek };
  });
}

// ─── Race block appender ──────────────────────────────────────────────────────
//
// Emits `blockLen` weeks starting at `startWeekNumber`, following the scaled
// phase shape but with hard guarantees layered on top: the last week is
// always the race (taper + isRaceWeek), the week before is always taper, and
// every 4th week outside taper becomes a deload. When `foundationLen` > 0,
// the leading base weeks are relabeled foundation (gated beginners still get
// a gentle on-ramp even when there's no separate lead-in block available).

function appendRaceBlock(
  weeks:            MacroWeek[],
  startDate:        string,
  startWeekNumber:  number,
  scaledPhases:     { phase: TrainingPhase; startWeek: number; endWeek: number }[],
  race:             Race,
  otherRaces:       Race[],
  foundationLen:    number = 0,
): number {
  const blockLen = scaledPhases[scaledPhases.length - 1]?.endWeek ?? 0;
  let foundationRemaining = foundationLen;

  for (let localWeek = 1; localWeek <= blockLen; localWeek++) {
    const globalWeek   = startWeekNumber + localWeek - 1;
    const isLastWeek    = localWeek === blockLen;
    const isSecondLast  = localWeek === blockLen - 1;

    let phase: TrainingPhase =
      scaledPhases.find(p => localWeek >= p.startWeek && localWeek <= p.endWeek)?.phase ?? 'base';

    if (phase === 'base' && foundationRemaining > 0) {
      phase = 'foundation';
      foundationRemaining--;
    }

    if (isLastWeek) {
      phase = 'taper';
    } else if (isSecondLast && phase !== 'taper') {
      phase = 'taper';
    } else if (phase !== 'taper' && globalWeek % 4 === 0) {
      phase = 'deload';
    }

    const otherRace = raceForWeek(otherRaces, weekStartForNumber(startDate, globalWeek));

    weeks.push(makeWeek(startDate, globalWeek, phase, {
      focus:      focusForPhase(phase, 'race_prep', race),
      isRaceWeek: isLastWeek,
      raceId:     isLastWeek ? race.id : otherRace?.id,
    }));
  }

  return startWeekNumber + blockLen;
}

function appendPostRace(
  weeks:           MacroWeek[],
  startDate:       string,
  startWeekNumber: number,
  minTotal:        number,
  race:            Race,
): void {
  for (let weekNumber = startWeekNumber; weekNumber <= minTotal; weekNumber++) {
    const isFirst = weekNumber === startWeekNumber;
    const phase: TrainingPhase = weekNumber % 4 === 0 ? 'deload' : 'base';
    weeks.push(makeWeek(startDate, weekNumber, phase, {
      focus: isFirst
        ? `Post-race recovery — easy running only after ${race.name}`
        : (phase === 'deload' ? 'Deload — recovery week, let the adaptations lock in' : 'Aerobic base — rebuilding after the race'),
    }));
  }
}

// ─── Goal-specific builders ───────────────────────────────────────────────────

function buildGeneralRunningPlan(
  startDate:     string,
  foundationLen: number,
  goalType:      'general_running' | 'hybrid',
): MacroPlan {
  const weeks: MacroWeek[] = [];
  let weekNumber = 1;

  for (; weekNumber <= foundationLen; weekNumber++) {
    weeks.push(makeWeek(startDate, weekNumber, 'foundation', { focus: foundationFocus(goalType) }));
  }

  for (; weekNumber <= 8 && weekNumber <= MIN_TOTAL_WEEKS; weekNumber++) {
    const phase = deloadOr(weekNumber, 'base');
    weeks.push(makeWeek(startDate, weekNumber, phase, {
      focus: phase === 'deload' ? 'Deload — recovery week, let the adaptations lock in' : baseFocus(goalType),
    }));
  }

  let blockIsBuild = false;
  let blockCounter = 0;
  for (; weekNumber <= MIN_TOTAL_WEEKS; weekNumber++) {
    const phaseChoice = blockIsBuild ? 'build' : 'base';
    const phase = deloadOr(weekNumber, phaseChoice);
    weeks.push(makeWeek(startDate, weekNumber, phase, {
      focus: phase === 'deload'
        ? 'Deload — recovery week, let the adaptations lock in'
        : (phaseChoice === 'build' ? buildFocus(goalType) : baseFocus(goalType)),
    }));
    blockCounter++;
    if (blockCounter === 3) { blockCounter = 0; blockIsBuild = !blockIsBuild; }
  }

  return { goalType, startDate, totalWeeks: weeks.length, weeks, generatedAt: Date.now() };
}

function buildGeneralStrengthPlan(startDate: string, foundationLen: number): MacroPlan {
  const weeks: MacroWeek[] = [];
  let weekNumber = 1;

  for (; weekNumber <= foundationLen; weekNumber++) {
    weeks.push(makeWeek(startDate, weekNumber, 'foundation', {
      focus: 'Foundation — building movement quality and an aerobic habit before loading the strength program',
    }));
  }

  for (; weekNumber <= MIN_TOTAL_WEEKS; weekNumber++) {
    const phase: TrainingPhase = weekNumber % 4 === 0 ? 'deload' : 'base';
    weeks.push(makeWeek(startDate, weekNumber, phase, {
      focus: phase === 'deload' ? 'Deload — recovery week, let the adaptations lock in' : baseFocus('general_strength'),
    }));
  }

  return { goalType: 'general_strength', startDate, totalWeeks: weeks.length, weeks, generatedAt: Date.now() };
}

function buildRacePrepPlan(
  startDate:     string,
  race:          Race,
  foundationLen: number,
  allRaces:      Race[],
): MacroPlan {
  const raceDate    = parseYMD(race.date);
  const raceWeekNum = weekNumberForDate(startDate, raceDate);
  if (raceWeekNum === null) {
    // Should not happen (race was pre-filtered as eligible) — safe fallback.
    return buildGeneralRunningPlan(startDate, foundationLen, 'general_running');
  }

  const weeks: MacroWeek[]      = [];
  const otherRaces               = allRaces.filter(r => r.id !== race.id);
  const minTotal                 = Math.max(MIN_TOTAL_WEEKS, raceWeekNum + 8);
  let limitationNote: string | undefined;

  if (raceWeekNum > RACE_BLOCK_MAX_WEEKS) {
    const leadWeeks       = raceWeekNum - RACE_BLOCK_MAX_WEEKS;
    const foundationUsed  = Math.min(foundationLen, leadWeeks);
    let weekNumber = 1;

    for (; weekNumber <= foundationUsed; weekNumber++) {
      weeks.push(makeWeek(startDate, weekNumber, 'foundation', { focus: foundationFocus('race_prep') }));
    }
    for (; weekNumber <= leadWeeks; weekNumber++) {
      const phase = deloadOr(weekNumber, 'base');
      weeks.push(makeWeek(startDate, weekNumber, phase, {
        focus: phase === 'deload'
          ? 'Deload — recovery week, let the adaptations lock in'
          : 'Aerobic base — building the engine before the race-specific block begins',
      }));
    }

    const template = getPlanTemplateForDistance(race.distance);
    const scaled   = scalePhases(template, RACE_BLOCK_MAX_WEEKS);
    weekNumber     = appendRaceBlock(weeks, startDate, weekNumber, scaled, race, otherRaces);
    appendPostRace(weeks, startDate, weekNumber, minTotal, race);

  } else if (raceWeekNum >= 6) {
    const template = getPlanTemplateForDistance(race.distance);
    const scaled   = scalePhases(template, raceWeekNum);
    const nextWeek = appendRaceBlock(weeks, startDate, 1, scaled, race, otherRaces, foundationLen);
    appendPostRace(weeks, startDate, nextWeek, minTotal, race);

  } else {
    limitationNote = `Only ${raceWeekNum} week${raceWeekNum === 1 ? '' : 's'} until ${race.name} — there isn't enough runway to build fitness safely. This plan focuses on arriving fresh and healthy rather than chasing gains.`;
    let weekNumber = 1;
    for (; weekNumber < raceWeekNum; weekNumber++) {
      const phase: TrainingPhase = weekNumber === raceWeekNum - 1
        ? 'taper'
        : (foundationLen > 0 ? 'foundation' : 'base');
      weeks.push(makeWeek(startDate, weekNumber, phase, {
        focus: phase === 'taper' ? `Taper — easing toward ${race.name}` : 'Maintain — steady, easy running, no heroics this close to race day',
      }));
    }
    weeks.push(makeWeek(startDate, raceWeekNum, 'taper', {
      focus:      `Race week — ${race.name}`,
      isRaceWeek: true,
      raceId:     race.id,
    }));
    appendPostRace(weeks, startDate, raceWeekNum + 1, minTotal, race);
  }

  return {
    goalType:     'race_prep',
    startDate,
    totalWeeks:   weeks.length,
    weeks,
    targetRaceId: race.id,
    limitationNote,
    generatedAt:  Date.now(),
  };
}

// ─── Main entry point ─────────────────────────────────────────────────────────

export function buildMacroPlan(input: {
  goalType:         TrainingGoalType;
  startDate:        string;
  races:            Race[];
  progressionLevel: ProgressionLevel;
  yearsRunning:      number;
  weeklyMileage:     number;
}): MacroPlan {
  const { goalType, startDate, races, progressionLevel, yearsRunning, weeklyMileage } = input;
  const gated        = isBeginnerGated(progressionLevel, yearsRunning, weeklyMileage);
  const foundationLen = gated ? foundationLength(weeklyMileage) : 0;

  if (goalType === 'race_prep') {
    const targetRace = pickTargetRace(races, startDate);
    if (targetRace) {
      return buildRacePrepPlan(startDate, targetRace, foundationLen, races);
    }
    const fallback = buildGeneralRunningPlan(startDate, foundationLen, 'general_running');
    return {
      ...fallback,
      goalType:        'race_prep',
      limitationNote:  'No upcoming race scheduled yet — training as general aerobic development until a race is added.',
    };
  }

  if (goalType === 'general_strength') {
    return buildGeneralStrengthPlan(startDate, foundationLen);
  }

  if (goalType === 'hybrid') {
    return buildGeneralRunningPlan(startDate, foundationLen, 'hybrid');
  }

  return buildGeneralRunningPlan(startDate, foundationLen, 'general_running');
}

// ─── Date lookup ──────────────────────────────────────────────────────────────

export function macroWeekForDate(plan: MacroPlan, date: Date): MacroWeek | null {
  const weekNum = weekNumberForDate(plan.startDate, date);
  if (weekNum === null) return null;

  const found = plan.weeks.find(w => w.weekNumber === weekNum);
  if (found) return found;

  // Clamp beyond generated horizon by extending the base/deload cadence.
  const phase: TrainingPhase = weekNum % 4 === 0 ? 'deload' : 'base';
  return {
    weekNumber: weekNum,
    startDate:  toYMD(weekStartForNumber(plan.startDate, weekNum)),
    phase,
    isDeload:   phase === 'deload',
    isTaper:    false,
    isRaceWeek: false,
    focus:      'Aerobic base — continuing steady training',
  };
}
