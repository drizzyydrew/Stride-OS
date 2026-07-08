import type {
  TrainingPhase,
  RaceDistance,
  PhaseBlock,
  PeriodizationPlan,
} from '../types/training';

// ─── Race Distance Detection ──────────────────────────────────────────────────

export function resolveRaceDistance(goalRace: string): RaceDistance {
  const g = goalRace.toLowerCase();
  if (g.includes('marathon') && !g.includes('half')) return 'marathon';
  if (g.includes('half'))                             return 'half_marathon';
  if (g.includes('10k') || g.includes('10 k'))       return '10k';
  if (g.includes('5k')  || g.includes('5 k'))        return '5k';
  return 'marathon';
}

// ─── Plan Templates ───────────────────────────────────────────────────────────

// Phase week ranges are static per distance. Deload weeks are resolved dynamically
// (every 4th week) by resolveTrainingPhase rather than encoded in the template,
// which means the phase boundaries here reflect the gross training shape.
export type PlanTemplate = {
  totalWeeks: number;
  phases: { phase: TrainingPhase; startWeek: number; endWeek: number }[];
};

const PLAN_TEMPLATES: Record<RaceDistance, PlanTemplate> = {
  marathon: {
    totalWeeks: 18,
    phases: [
      { phase: 'base',  startWeek: 1,  endWeek: 6  },
      { phase: 'build', startWeek: 7,  endWeek: 13 },
      { phase: 'peak',  startWeek: 14, endWeek: 16 },
      { phase: 'taper', startWeek: 17, endWeek: 18 },
    ],
  },
  half_marathon: {
    totalWeeks: 12,
    phases: [
      { phase: 'base',  startWeek: 1,  endWeek: 3  },
      { phase: 'build', startWeek: 4,  endWeek: 9  },
      { phase: 'peak',  startWeek: 10, endWeek: 11 },
      { phase: 'taper', startWeek: 12, endWeek: 12 },
    ],
  },
  '10k': {
    totalWeeks: 10,
    phases: [
      { phase: 'base',  startWeek: 1,  endWeek: 3  },
      { phase: 'build', startWeek: 4,  endWeek: 7  },
      { phase: 'peak',  startWeek: 8,  endWeek: 9  },
      { phase: 'taper', startWeek: 10, endWeek: 10 },
    ],
  },
  '5k': {
    totalWeeks: 8,
    phases: [
      { phase: 'base',  startWeek: 1, endWeek: 2 },
      { phase: 'build', startWeek: 3, endWeek: 6 },
      { phase: 'peak',  startWeek: 7, endWeek: 7 },
      { phase: 'taper', startWeek: 8, endWeek: 8 },
    ],
  },
};

// ─── Plan Template Access ─────────────────────────────────────────────────────
//
// Exposes the static phase-shape template for a distance so the macro planner
// (src/utils/plan/macroPlanner.ts) can proportionally scale phase boundaries
// to fit a specific weeks-to-race window without duplicating the templates.

export function getPlanTemplateForDistance(distance: RaceDistance): PlanTemplate {
  return PLAN_TEMPLATES[distance];
}

// ─── Plan Builder ─────────────────────────────────────────────────────────────

export function buildPeriodizationPlan(
  goalRace: string,
  baseMileage: number,
): PeriodizationPlan {
  const raceDistance = resolveRaceDistance(goalRace);
  const template     = PLAN_TEMPLATES[raceDistance];

  const phases: PhaseBlock[] = template.phases.map(p => ({
    phase:     p.phase,
    startWeek: p.startWeek,
    endWeek:   p.endWeek,
  }));

  return {
    raceDistance,
    totalWeeks:  template.totalWeeks,
    peakMileage: Math.round(baseMileage * 1.25 * 10) / 10,
    phases,
  };
}

// ─── Phase Resolver ───────────────────────────────────────────────────────────

// Taper always wins — don't collapse it into a deload week.
// Outside taper, every 4th week becomes a deload regardless of planned phase.
export function resolveTrainingPhase(
  currentWeek: number,
  plan: PeriodizationPlan,
): TrainingPhase {
  const plannedPhase: TrainingPhase =
    plan.phases.find(
      b => currentWeek >= b.startWeek && currentWeek <= b.endWeek,
    )?.phase ?? 'base';

  if (plannedPhase === 'taper') return 'taper';

  if (currentWeek % 4 === 0) return 'deload';

  return plannedPhase;
}

// ─── Plan Summary Helpers ─────────────────────────────────────────────────────

export function getWeeksRemaining(
  currentWeek: number,
  plan: PeriodizationPlan,
): number {
  return Math.max(0, plan.totalWeeks - currentWeek + 1);
}

export function getPlanProgress(
  currentWeek: number,
  plan: PeriodizationPlan,
): number {
  return Math.min(1, (currentWeek - 1) / plan.totalWeeks);
}
