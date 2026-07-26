// ─── Workout-specific warm-up protocols ────────────────────────────────────
//
// Fills the gap when a session doesn't already carry its own prescribed
// warm-up (RichWorkout.warmup segments for runs, StrengthSession.warmupProtocol
// for training-block/preset strength) — this utility is the fallback, never
// the override. Mobility and active-recovery sessions get NO warm-up volume
// added; that's intentional, not an oversight.

export type WarmupSessionKind =
  | 'easy_run'
  | 'interval_run'
  | 'long_run'
  | 'run_walk'
  | 'treadmill_run'
  | 'strength_upper'
  | 'strength_lower'
  | 'strength_full_body'
  | 'strength_heavy_barbell'
  | 'strength_runner'
  | 'strength_general'
  | 'mobility'
  | 'active_recovery'
  | 'indoor_cycling'
  | 'outdoor_cycling'
  | 'other';

export type WarmupProtocol = {
  title: string;
  items: string[];
  durationMinutes: number;
};

const NONE: WarmupProtocol = { title: 'No added warm-up', items: [], durationMinutes: 0 };

const PROTOCOLS: Record<WarmupSessionKind, WarmupProtocol> = {
  easy_run: {
    title: 'Easy Run Warm-Up',
    items: ['3-5 minutes brisk walking or very easy jogging', 'A few relaxed strides if the legs feel stiff'],
    durationMinutes: 5,
  },
  interval_run: {
    title: 'Interval Warm-Up',
    items: [
      '10 minutes easy jogging',
      'Dynamic mobility: leg swings, walking lunges, high knees',
      '4-6 strides building to near-interval effort',
    ],
    durationMinutes: 15,
  },
  long_run: {
    title: 'Long Run Warm-Up',
    items: ['5 minutes easy walking into a gradual jog', 'Start conservatively — the first mile is part of the warm-up'],
    durationMinutes: 5,
  },
  run_walk: {
    title: 'Run/Walk Warm-Up',
    items: ['3-5 minutes easy walking before the first run interval'],
    durationMinutes: 5,
  },
  treadmill_run: {
    title: 'Treadmill Warm-Up',
    items: ['5 minutes walking, ramping to an easy jog pace', 'Increase speed gradually rather than jumping straight to target pace'],
    durationMinutes: 5,
  },
  strength_upper: {
    title: 'Upper-Body Warm-Up',
    items: ['3-5 minutes easy cardio to raise heart rate', 'Band pull-aparts, arm circles, scapular activation', 'A light warm-up set of the first pressing/pulling movement'],
    durationMinutes: 7,
  },
  strength_lower: {
    title: 'Lower-Body Warm-Up',
    items: ['3-5 minutes easy cardio', 'Bodyweight squats, leg swings, hip openers', 'A light warm-up set of the first squat/hinge movement'],
    durationMinutes: 7,
  },
  strength_full_body: {
    title: 'Full-Body Warm-Up',
    items: ['5 minutes easy movement to raise heart rate', 'Dynamic mobility through hips, shoulders, and ankles', 'A light warm-up set of the session’s heaviest compound lift'],
    durationMinutes: 8,
  },
  strength_heavy_barbell: {
    title: 'Heavy Barbell Warm-Up',
    items: [
      '5 minutes easy cardio',
      'Dynamic mobility for the working joints',
      'Progressive warm-up sets: bar only, ~50%, ~70%, ~85% of working weight',
    ],
    durationMinutes: 10,
  },
  strength_runner: {
    title: 'Runner Strength Warm-Up',
    items: ['3-5 minutes easy movement', 'Ankle, hip, and glute activation drills', 'A light warm-up set of the first unilateral movement'],
    durationMinutes: 6,
  },
  strength_general: {
    title: 'Warm-Up',
    items: ['Spend about five minutes on easy movement, joint-specific preparation, and lighter practice sets before the first working exercise.'],
    durationMinutes: 5,
  },
  mobility: NONE,
  active_recovery: NONE,
  indoor_cycling: {
    title: 'Spin-Up',
    items: ['3-5 minutes easy spinning at low resistance, building cadence gradually'],
    durationMinutes: 5,
  },
  outdoor_cycling: {
    title: 'Cycling Warm-Up',
    items: ['5-10 minutes easy spinning before the first hard effort'],
    durationMinutes: 8,
  },
  other: NONE,
};

export function warmupForSession(kind: WarmupSessionKind): WarmupProtocol {
  return PROTOCOLS[kind] ?? NONE;
}

// Best-effort mapping from the looser category/subtype strings used across
// scheduledSessions/strength screens onto a WarmupSessionKind. Callers that
// already know their exact kind should call warmupForSession() directly;
// this is for call sites (e.g. custom-session.tsx) working from a scheduled
// session's raw category.
export function warmupKindForCategory(category: string, subtype?: string): WarmupSessionKind {
  const cat = category.toLowerCase();
  const sub = subtype?.toLowerCase();
  if (cat === 'mobility') return 'mobility';
  if (cat === 'active_recovery' || cat === 'rest') return 'active_recovery';
  if (cat === 'run' || cat === 'running') {
    if (sub === 'treadmill') return 'treadmill_run';
    if (sub === 'long') return 'long_run';
    if (sub === 'intervals' || sub === 'hard' || sub === 'tempo' || sub === 'race_pace') return 'interval_run';
    return 'easy_run';
  }
  if (cat === 'run_walk') return 'run_walk';
  if (cat === 'cycling' || cat === 'indoor_cycling') return sub === 'indoor' || cat === 'indoor_cycling' ? 'indoor_cycling' : 'outdoor_cycling';
  if (cat === 'strength') {
    if (sub === 'upper' || sub === 'upper_body') return 'strength_upper';
    if (sub === 'lower' || sub === 'lower_body' || sub === 'lower_power') return 'strength_lower';
    if (sub === 'heavy_barbell' || sub === 'gym_barbell') return 'strength_heavy_barbell';
    if (sub === 'runner_strength' || sub === 'running_economy') return 'strength_runner';
    if (sub === 'full_body') return 'strength_full_body';
    return 'strength_general';
  }
  return 'other';
}
