// ─── Assessment Engine ─────────────────────────────────────────────────────────
//
// Interprets movement/strength field test results against normative data.
// All norms are conservative estimates — confidence labels reflect evidence quality.
// DO NOT claim diagnostic precision. These are coaching reference ranges only.
//
// Key references (conservatively applied):
// - Hébert-Losier et al. (2017): Calf raise norms
// - McGill (2002): Core endurance hold times
// - Crossley et al. (2011): Single-leg squat quality
// - Maffiuletti et al. (2007): Hip abduction endurance

import type {
  AssessmentTestKey,
  AssessmentTestDef,
  AssessmentRating,
  AssessmentResult,
  NormativeRange,
} from '../types/assessment';

// ─── Static test catalogue ────────────────────────────────────────────────────

export const ASSESSMENT_TESTS: AssessmentTestDef[] = [
  {
    key:         'single_leg_calf_raise',
    label:       'Single-Leg Calf Raise',
    description: 'Maximal reps on one leg, full range, heel to floor',
    unit:        'reps',
    sides:       'unilateral',
    instructions: [
      'Stand on one foot, hold wall lightly for balance only',
      'Rise fully onto toes, lower until heel is 1 cm from floor',
      'Count each full up-down cycle as 1 rep',
      'Stop when unable to complete full range',
      'Test both sides',
    ],
    normRanges: {
      default:  { below: 20, above: 35 },
      over50:   { below: 15, above: 28 },
      beginner: { below: 15, above: 28 },
    },
    evidenceNote:  'Based on Hébert-Losier et al. (2017), adapted conservatively. Runners often present higher scores.',
    confidence:    'moderate',
    retestWeeks:   4,
    influencesScores: ['movement_capacity', 'durability', 'running_economy'],
  },
  {
    key:         'bent_knee_soleus',
    label:       'Bent-Knee Calf Raise (Soleus)',
    description: 'Calf raise with roughly 30 to 45 degrees of knee bend to isolate soleus',
    unit:        'reps',
    sides:       'unilateral',
    instructions: [
      'Stand on one foot with the knee bent roughly 30 to 45 degrees',
      'Hold bend constant throughout — this isolates the soleus',
      'Rise onto toes fully, lower to heel near floor',
      'Stop when form breaks or you cannot complete the rise',
    ],
    normRanges: {
      default:  { below: 15, above: 30 },
      over50:   { below: 10, above: 22 },
      beginner: { below: 10, above: 22 },
    },
    evidenceNote:  'Limited direct RCT data for runners. Norms extrapolated conservatively from clinical rehab studies.',
    confidence:    'low',
    retestWeeks:   4,
    influencesScores: ['movement_capacity', 'durability'],
  },
  {
    key:         'single_leg_squat',
    label:       'Single-Leg Squat Quality',
    description: 'Squat control: 1 (poor) to 5 (excellent)',
    unit:        'quality_1_5',
    sides:       'unilateral',
    instructions: [
      'Stand on one foot, hands on hips',
      'Squat to ~60° knee bend, then return',
      'Assess: trunk lean, pelvic drop, knee valgus, balance',
      '5 = no compensation | 4 = minor | 3 = moderate | 2 = significant | 1 = unsafe',
      'Score each side separately (enter 1–5)',
    ],
    normRanges: {
      default:  { below: 3, above: 4 },
      over50:   { below: 2, above: 4 },
      beginner: { below: 2, above: 4 },
    },
    evidenceNote:  'Based on Crossley et al. (2011) LESS quality scale, simplified for self-assessment.',
    confidence:    'moderate',
    retestWeeks:   4,
    influencesScores: ['movement_capacity', 'durability'],
  },
  {
    key:         'side_plank',
    label:       'Side Plank Hold',
    description: 'Maximum hold time on side plank, elbow-based',
    unit:        'seconds',
    sides:       'unilateral',
    instructions: [
      'Elbow under shoulder, feet stacked or staggered',
      'Body straight from head to heels',
      'Start timer when position is achieved',
      'Stop when hips drop or position breaks',
      'Test both sides',
    ],
    normRanges: {
      default:  { below: 30, above: 90 },
      over50:   { below: 20, above: 60 },
      beginner: { below: 15, above: 60 },
    },
    evidenceNote:  'McGill (2002) core endurance battery. Gender and age norms condensed to conservative single range.',
    confidence:    'moderate',
    retestWeeks:   4,
    influencesScores: ['movement_capacity', 'running_economy'],
  },
  {
    key:         'single_leg_bridge',
    label:       'Single-Leg Bridge Endurance',
    description: 'Maximal reps of single-leg hip bridge with control',
    unit:        'reps',
    sides:       'unilateral',
    instructions: [
      'Lie on back, one foot flat on floor, other leg extended or raised',
      'Bridge up until hip is fully extended and level',
      'Lower under control until hips nearly touch floor',
      'Stop when unable to maintain level pelvis',
    ],
    normRanges: {
      default:  { below: 15, above: 35 },
      over50:   { below: 10, above: 25 },
      beginner: { below: 10, above: 25 },
    },
    evidenceNote:  'Conservative estimate. No large normative dataset for runners specifically.',
    confidence:    'low',
    retestWeeks:   4,
    influencesScores: ['movement_capacity', 'durability'],
  },
  {
    key:         'hip_abduction',
    label:       'Side-Lying Hip Abduction',
    description: 'Reps of slow side-lying hip abduction',
    unit:        'reps',
    sides:       'unilateral',
    instructions: [
      'Lie on side, body straight',
      'Lift top leg ~30°, pause 1 second, lower under control',
      'Keep foot parallel to floor (no external rotation)',
      'Stop when unable to maintain control or range',
    ],
    normRanges: {
      default:  { below: 15, above: 30 },
      over50:   { below: 12, above: 25 },
      beginner: { below: 10, above: 25 },
    },
    evidenceNote:  'Informed by Maffiuletti et al. (2007) hip abductor endurance, conservatively adapted.',
    confidence:    'low',
    retestWeeks:   4,
    influencesScores: ['movement_capacity', 'durability'],
  },
  {
    key:         'plank',
    label:       'Plank Hold',
    description: 'Maximum elbow plank hold time',
    unit:        'seconds',
    sides:       'bilateral',
    instructions: [
      'Elbows under shoulders, forearms flat',
      'Body straight from head to heels',
      'Engage core and glutes',
      'Stop when hips drop more than 2 cm or position cannot be maintained',
    ],
    normRanges: {
      default:  { below: 45, above: 120 },
      over50:   { below: 30, above: 90 },
      beginner: { below: 20, above: 75 },
    },
    evidenceNote:  'McGill (2002) trunk endurance. Norms condensed from mixed-population data.',
    confidence:    'moderate',
    retestWeeks:   4,
    influencesScores: ['movement_capacity', 'running_economy'],
  },
  {
    key:         'step_down',
    label:       'Step-Down Control',
    description: 'Step-down quality 1–5 from 20–30 cm step',
    unit:        'quality_1_5',
    sides:       'unilateral',
    instructions: [
      'Stand on edge of a 20–30 cm step on one foot',
      'Slowly lower opposite heel to touch floor, then return',
      'Complete 3 reps, assess overall quality',
      '5 = no trunk/pelvic/knee compensation | 1 = significant compensation or pain',
    ],
    normRanges: {
      default:  { below: 3, above: 4 },
      over50:   { below: 2, above: 4 },
      beginner: { below: 2, above: 4 },
    },
    evidenceNote:  'Clinical movement screen, no large population norms. Score is self-assessed — conservative interpretation.',
    confidence:    'low',
    retestWeeks:   4,
    influencesScores: ['movement_capacity'],
  },
  {
    key:         'hop_landing',
    label:       'Hop & Landing Quality',
    description: 'Single-leg hop: landing quality 1–5 (optional)',
    unit:        'quality_1_5',
    sides:       'unilateral',
    instructions: [
      'Skip if you have current lower-limb injury or pain',
      'Single leg hop forward ~50 cm, stick the landing 3 seconds',
      'Assess: valgus, trunk lean, balance, wobble',
      '5 = stable, controlled | 1 = unstable, high compensation',
    ],
    normRanges: {
      default:  { below: 3, above: 4 },
      over50:   { below: 2, above: 4 },
      beginner: { below: 2, above: 4 },
    },
    evidenceNote:  'Functional hop battery, no validated runner norms. Use as directional indicator only.',
    confidence:    'low',
    retestWeeks:   6,
    influencesScores: ['movement_capacity'],
  },
];

export const TEST_BY_KEY: Record<AssessmentTestKey, AssessmentTestDef> =
  Object.fromEntries(ASSESSMENT_TESTS.map(t => [t.key, t])) as Record<AssessmentTestKey, AssessmentTestDef>;

// ─── Interpretation ───────────────────────────────────────────────────────────

function selectNorm(
  def:           AssessmentTestDef,
  age:           number,
  isBeginnerAth: boolean,
): NormativeRange {
  if (age > 50 && def.normRanges.over50) return def.normRanges.over50;
  if (isBeginnerAth && def.normRanges.beginner) return def.normRanges.beginner;
  return def.normRanges.default;
}

export function interpretResult(
  testKey:       AssessmentTestKey,
  value:         number,
  age:           number,
  isBeginner:    boolean,
): { rating: AssessmentRating; interpretation: string } {
  const def  = TEST_BY_KEY[testKey];
  const norm = selectNorm(def, age, isBeginner);

  let rating: AssessmentRating;
  if (value < norm.below) {
    rating = 'below_expected';
  } else if (value >= norm.above) {
    rating = 'above_expected';
  } else {
    rating = 'expected';
  }

  const label = def.label;
  const unit  = def.unit === 'reps' ? 'reps' : def.unit === 'seconds' ? 'sec' : '/5';

  const interp =
    rating === 'below_expected'
      ? `${label}: ${value}${unit} — below expected range (${norm.below}–${norm.above - 1}${unit}). Consider targeted work on this quality.`
      : rating === 'above_expected'
        ? `${label}: ${value}${unit} — above expected range. Solid capacity here.`
        : `${label}: ${value}${unit} — within expected range (${norm.below}–${norm.above - 1}${unit}).`;

  return { rating, interpretation: interp };
}

// ─── Which tests need retesting ───────────────────────────────────────────────

export function getDueTests(
  results: AssessmentResult[],
  now:     number = Date.now(),
): AssessmentTestKey[] {
  const latestByKey = new Map<AssessmentTestKey, number>();
  for (const r of results) {
    const prev = latestByKey.get(r.testKey) ?? 0;
    if (r.testedAt > prev) latestByKey.set(r.testKey, r.testedAt);
  }

  return ASSESSMENT_TESTS
    .filter(def => {
      const last = latestByKey.get(def.key);
      if (!last) return true;  // never tested
      const dueMsFromNow = def.retestWeeks * 7 * 24 * 60 * 60 * 1000;
      return now - last >= dueMsFromNow;
    })
    .map(d => d.key);
}

// ─── Flag derivation for performance/movement scoring ────────────────────────

export function getAssessmentRiskFlags(results: AssessmentResult[]): string[] {
  const latestByKey = new Map<AssessmentTestKey, AssessmentResult>();
  for (const r of results) {
    const prev = latestByKey.get(r.testKey);
    if (!prev || r.testedAt > prev.testedAt) latestByKey.set(r.testKey, r);
  }

  const flags: string[] = [];
  for (const [, r] of latestByKey) {
    if (r.rating === 'below_expected') {
      flags.push(`assessment_${r.testKey}_deficit`);
    }
  }
  return flags;
}

// ─── Strength recommendation input from assessments ───────────────────────────

export function assessmentMovementCapacityScore(results: AssessmentResult[]): number {
  if (results.length === 0) return 50;  // no data → neutral

  const latestByKey = new Map<AssessmentTestKey, AssessmentResult>();
  for (const r of results) {
    const prev = latestByKey.get(r.testKey);
    if (!prev || r.testedAt > prev.testedAt) latestByKey.set(r.testKey, r);
  }

  const ratings = [...latestByKey.values()].map(r => r.rating);
  const scoreMap: Record<AssessmentRating, number> = {
    above_expected: 85,
    expected:       65,
    below_expected: 35,
  };

  const sum = ratings.reduce((acc, r) => acc + scoreMap[r], 0);
  return Math.round(sum / ratings.length);
}
