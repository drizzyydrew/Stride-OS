import type { MacroPlan } from '../../types/plan';
import type { GeneratedBeginnerPlan } from '../../types/beginnerPlan';
import { parseYMD, sundayOf } from '../calendarEngine';
import { getGoalMesocycle } from './goalMesocycle';

/** A saved beginner path owns its dated sessions. Do not advertise VO2 or
 * threshold phases from the general macro template over that easy path. */
export function alignStoredBeginnerMacro(macro: MacroPlan, stored: GeneratedBeginnerPlan | null | undefined): MacroPlan {
  if (macro.programmingVersion !== 2 || !stored) return macro;
  const start = sundayOf(parseYMD(stored.startDate)).getTime();
  const weeks = macro.weeks.flatMap(week => {
    const number = Math.round((parseYMD(week.startDate).getTime() - start) / 604800000) + 1;
    const prescribed = stored.weeks.find(item => item.weekNumber === number);
    if (!prescribed) return [];
    const phase = prescribed.isRecoveryWeek ? 'deload' as const
      : number <= Math.ceil(stored.durationWeeks * 0.35) ? 'foundation' as const : 'aerobic_development' as const;
    return [{ ...week, phase, isDeload: prescribed.isRecoveryWeek, isTaper: false,
      focus: prescribed.focus, mesocycle: getGoalMesocycle(number, phase, macro.goalType) }];
  });
  return { ...macro, totalWeeks: weeks.length, weeks };
}
