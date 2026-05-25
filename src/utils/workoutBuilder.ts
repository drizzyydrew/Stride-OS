// ─── Workout Builder ──────────────────────────────────────────────────────────
//
// Constructs RichWorkout objects for all 16 session types. Each builder:
//   1. Derives pace targets from CalibrationOutput (VDOT-backed) or falls back
//      to race-profile constants when no calibration exists.
//   2. Generates a concrete execution plan (warmup, main set, cooldown, intervals).
//   3. Attaches physiological rationale grounded in exercise science literature.
//   4. Scores the session for load, fatigue cost, and adaptation signal strength.
//
// All functions are pure: same inputs always produce the same RichWorkout.
// No side effects, no external calls, no randomness.
//
// AI REPLACEMENT HOOK: Each builder function is a candidate for AI enhancement.
// The function signature (BuildContext → Omit<RichWorkout,'dayIndex'>) is the
// stable contract. A future Claude call returns the same shape with richer,
// personalized rationale and athlete-specific cue language.

import type { RichWorkoutType, PaceRange, WorkoutSegment, IntervalBlock,
  WorkoutScore, PhysiologicalRationale, ModificationGuidance,
  EnvironmentAdjustment, RichWorkout } from '../types/workout';
import type { CalibrationOutput } from '../types/athlete';
import type { TrainingPhase, ProgressionLevel, WorkoutType, WorkoutIntensity,
  PaceGuidance, TrainingZone, EnergySystem } from '../types/training';
import { formatPace } from './calibrationEngine';

// ─── Build context ────────────────────────────────────────────────────────────

export type BuildContext = {
  paceCtx:          PaceContext;
  mileage:          number;         // progressed weekly mileage
  multiplier:       number;         // phase intensity multiplier (0.4–1.15)
  weekInBlock:      number;         // 1–4 position within mesocycle
  trainingPhase:    TrainingPhase;
  progressionLevel: ProgressionLevel;
  calibration:      CalibrationOutput | null;
};

export type PaceContext = {
  recovery:  PaceRange;
  easy:      PaceRange;
  marathon:  PaceRange;
  threshold: PaceRange;
  vo2:       PaceRange;
  rep:       PaceRange;  // strides / hill reps
};

// ─── Pace context derivation ──────────────────────────────────────────────────

// Race profiles: all paces in minutes/mile
const RACE_PROFILES: Record<string, { racePace: number; rec: number; easy: number; thresh: number; vo2: number; rep: number }> = {
  sub_4_marathon:   { racePace: 9.16,  rec: 2.0,  easy: 1.5,  thresh: -1.0,  vo2: -1.75, rep: -2.25 },
  sub_430_marathon: { racePace: 10.31, rec: 2.0,  easy: 1.5,  thresh: -1.0,  vo2: -1.75, rep: -2.25 },
  sub_5_marathon:   { racePace: 11.45, rec: 2.0,  easy: 1.5,  thresh: -1.0,  vo2: -1.75, rep: -2.25 },
  sub_145_half:     { racePace: 8.02,  rec: 2.25, easy: 1.75, thresh: -0.5,  vo2: -1.25, rep: -1.75 },
  sub_2_half:       { racePace: 9.16,  rec: 2.25, easy: 1.75, thresh: -0.5,  vo2: -1.25, rep: -1.75 },
  sub_20_5k:        { racePace: 6.45,  rec: 2.75, easy: 2.25, thresh:  0.25, vo2: -0.25, rep: -0.75 },
  sub_25_5k:        { racePace: 8.07,  rec: 2.75, easy: 2.25, thresh:  0.25, vo2: -0.25, rep: -0.75 },
};
const DEFAULT_PROFILE = RACE_PROFILES['sub_5_marathon']!;

function matchProfile(goalRace: string) {
  const g = goalRace.toLowerCase();
  if (g.includes('marathon')) {
    if (g.includes('sub 4') && !g.includes('4:30')) return RACE_PROFILES['sub_4_marathon']!;
    if (g.includes('4:30') || g.includes('4.5'))    return RACE_PROFILES['sub_430_marathon']!;
    if (g.includes('sub 5'))                        return RACE_PROFILES['sub_5_marathon']!;
  }
  if (g.includes('half')) {
    if (g.includes('1:45') || g.includes('1.45')) return RACE_PROFILES['sub_145_half']!;
    if (g.includes('sub 2'))                       return RACE_PROFILES['sub_2_half']!;
  }
  if (g.includes('5k') || g.includes('5 k')) {
    if (g.includes('sub 20')) return RACE_PROFILES['sub_20_5k']!;
    if (g.includes('sub 25')) return RACE_PROFILES['sub_25_5k']!;
  }
  return DEFAULT_PROFILE;
}

function mpmRange(centerMpm: number, spreadMpm: number): PaceRange {
  const centerSec = centerMpm * 60;
  const spreadSec = spreadMpm * 60;
  return { minSecPerMi: centerSec + spreadSec, maxSecPerMi: centerSec - spreadSec };
}

export function buildPaceContext(calibration: CalibrationOutput | null, goalRace: string): PaceContext {
  if (calibration?.paceZones) {
    const z = calibration.paceZones;
    const toRange = (key: string, fallback: PaceRange): PaceRange => {
      const e = z[key];
      if (!e) return fallback;
      return { minSecPerMi: e.minSecPerMi, maxSecPerMi: e.maxSecPerMi };
    };
    return {
      recovery:  toRange('recovery',  { minSecPerMi: 690, maxSecPerMi: 630 }),
      easy:      toRange('easy',      { minSecPerMi: 630, maxSecPerMi: 570 }),
      marathon:  toRange('marathon',  { minSecPerMi: 570, maxSecPerMi: 540 }),
      threshold: toRange('threshold', { minSecPerMi: 510, maxSecPerMi: 480 }),
      vo2:       toRange('vo2',       { minSecPerMi: 465, maxSecPerMi: 435 }),
      rep:       toRange('rep',       { minSecPerMi: 435, maxSecPerMi: 405 }),
    };
  }
  const p = matchProfile(goalRace);
  return {
    recovery:  mpmRange(p.racePace + p.rec,    0.5),
    easy:      mpmRange(p.racePace + p.easy,   0.375),
    marathon:  mpmRange(p.racePace - 0.5,      0.25),
    threshold: mpmRange(p.racePace + p.thresh, 0.25),
    vo2:       mpmRange(p.racePace + p.vo2,    0.25),
    rep:       mpmRange(p.racePace + p.rep,    0.375),
  };
}

// ─── Formatting helpers ───────────────────────────────────────────────────────

function fmtRange(r: PaceRange): string {
  return `${formatPace(r.maxSecPerMi)}–${formatPace(r.minSecPerMi)}/mi`;
}

function paceGuidance(label: string, desc: string, r: PaceRange): PaceGuidance {
  return { label, description: desc, targetPace: fmtRange(r) };
}

function seg(
  label: string,
  duration: string,
  paceGuide: string,
  hrZone: number,
  rpe: [number, number],
  instructions: string,
): WorkoutSegment {
  return { label, duration, paceGuide, hrZone, rpe, instructions };
}

// ─── Workout scoring ──────────────────────────────────────────────────────────

function scoreWorkout(
  intensity: WorkoutIntensity,
  durationMinutes: number,
  multiplier: number,
  hasIntervals: boolean,
  confidenceSource: boolean,
): WorkoutScore {
  const INTENSITY_FACTOR: Record<WorkoutIntensity, number> = {
    rest: 0, very_easy: 0.3, easy: 0.55, moderate: 0.7, hard: 0.85, max: 1.0,
  };
  const factor = INTENSITY_FACTOR[intensity] ?? 0.55;
  const rawLoad = factor * durationMinutes * multiplier;
  const intendedLoad       = Math.min(100, Math.round(rawLoad * 1.2));
  const estimatedFatigue   = Math.min(100, Math.round(rawLoad * 0.9));
  const expectedAdaptation = Math.min(100, Math.round(rawLoad * (hasIntervals ? 1.3 : 1.0)));
  const recoveryDemandHours =
    intendedLoad > 70 ? 72 :
    intendedLoad > 50 ? 48 :
    intendedLoad > 30 ? 36 : 24;
  const executionDifficulty = hasIntervals
    ? Math.min(100, Math.round(factor * 90))
    : Math.min(100, Math.round(factor * 50));
  const confidenceScore = confidenceSource ? 90 : 70;

  return {
    intendedLoad, estimatedFatigueCost: estimatedFatigue,
    expectedAdaptation, recoveryDemandHours,
    confidenceScore, executionDifficulty,
  };
}

// ─── Shared base fields ───────────────────────────────────────────────────────

function base(
  richType: RichWorkoutType,
  workoutType: WorkoutType,
  zone: TrainingZone,
  intensity: WorkoutIntensity,
  energySystem: EnergySystem,
  title: string,
  description: string,
  paceRange: PaceRange,
  hrZoneTarget: number,
  rpeRange: [number, number],
  durationMinutes: number,
  targetDistance: number,
  ctx: BuildContext,
): Omit<RichWorkout, 'dayIndex' | 'warmup' | 'mainSet' | 'cooldown' | 'purpose' |
  'instructions' | 'executionCues' | 'failureConditions' | 'modifications' |
  'rationale' | 'score' | 'intervals' | 'progressionNote'> {
  return {
    id: richType,
    richType,
    type: workoutType,
    zone,
    intensity,
    energySystem,
    title,
    description,
    paceGuidance: paceGuidance(title, description, paceRange),
    paceRange,
    hrZoneTarget,
    rpeRange,
    durationMinutes,
    targetDistance: Math.max(1, Math.round(targetDistance)),
    recoveryCost: Math.round(durationMinutes * 0.6 * ctx.multiplier),
    fatigueScore: Math.round(durationMinutes * 0.5 * ctx.multiplier),
    completed: false,
  };
}

// ─── Individual builders ──────────────────────────────────────────────────────

export type BuiltWorkout = Omit<RichWorkout, 'dayIndex'>;

function buildEasyRun(ctx: BuildContext): BuiltWorkout {
  const { paceCtx, mileage, multiplier, weekInBlock, calibration } = ctx;
  const pace  = paceCtx.easy;
  const dur   = 45 + Math.round(mileage * 0.3);
  const dist  = mileage * 0.18;

  const rationale: PhysiologicalRationale = {
    adaptation:   'Mitochondrial density + aerobic enzyme activity',
    mechanism:    'Sustained Zone 2 upregulates PGC-1α, the master regulator of mitochondrial biogenesis. Slow-twitch fiber capillary density increases, improving oxygen delivery per gram of muscle. Fat-oxidation enzymes (β-HAD, citrate synthase) are upregulated, sparing glycogen at higher speeds.',
    timeframe:    '4–8 weeks of consistent Zone 2 training',
    scienceBasis: 'Holloszy (1967); Seiler (2010) 80/20 polarized model; Midgley et al. (2006) aerobic base review',
  };

  const mods: ModificationGuidance[] = [
    { condition: 'HR stays above Zone 3 for 5+ consecutive minutes', action: 'Slow pace by 30 sec/mi and reassess after 5 min' },
    { condition: 'Muscle tightness or joint pain arises', action: 'Stop and walk — do not push through structural discomfort' },
  ];

  const r = weekInBlock;
  return {
    ...base('easy_run', 'easy_run', 'aerobic', 'easy', 'aerobic_power',
      'Easy Aerobic Run',
      'Zone 2 aerobic development. Builds mitochondrial density, capillary bed, and fat-oxidation capacity.',
      pace, 2, [4, 6], dur, dist, ctx),
    warmup:  seg('Warmup', '5 min', 'Walk briskly', 1, [2, 3], 'Start with 5 min brisk walk or very slow jog.'),
    mainSet: [seg('Easy Run', `${dur - 10} min`, fmtRange(pace), 2, [4, 6], 'Maintain conversational pace throughout. Breathing should be comfortable through the nose.')],
    cooldown: seg('Cooldown', '5 min', 'Walk', 1, [1, 2], '5 min walk followed by light calf and hip flexor stretches.'),
    purpose: 'Build aerobic base through sustained low-intensity running — the foundation every other training type builds on.',
    instructions: [
      'Run at a pace where full sentences feel comfortable.',
      'Let heart rate settle naturally — do not force Zone 2 from the start.',
      'Focus on even effort over even pace — hills naturally slow you down.',
      'Check form: slight forward lean, foot strike under hips, relaxed shoulders.',
    ],
    executionCues: ['If you can\'t finish a sentence, slow down.', 'Nose breathing as the primary metric.', 'Aim for 170–180 spm cadence.'],
    failureConditions: ['HR > Zone 3 for 5+ consecutive minutes → reduce pace.', 'Pain (not soreness) in joints → stop.'],
    modifications: mods,
    rationale,
    score: scoreWorkout('easy', dur, multiplier, false, calibration !== null),
    progressionNote: r <= 3 ? `Week ${r}/3: aerobic base block` : 'Deload week: reduce duration by 30%.',
  };
}

function buildRecoveryRun(ctx: BuildContext): BuiltWorkout {
  const { paceCtx, mileage, multiplier, calibration } = ctx;
  const pace = paceCtx.recovery;
  const dur  = 30;
  const dist = mileage * 0.07;

  const rationale: PhysiologicalRationale = {
    adaptation:   'Metabolic waste clearance + blood flow without added training stress',
    mechanism:    'Very low intensity promotes muscle perfusion and lactate clearance without elevating cortisol or causing further microtrauma. Active recovery consistently outperforms passive rest for next-day readiness (Bogdanis et al.).',
    timeframe:    'Acute: next-session readiness within 12–24 hours',
    scienceBasis: 'Bogdanis et al. (1996) active recovery; Wahl et al. (2014) blood flow and clearance kinetics',
  };

  return {
    ...base('recovery_run', 'recovery_run', 'recovery', 'very_easy', 'aerobic_power',
      'Recovery Run',
      'Low-intensity aerobic work to promote blood flow and clear metabolic waste without adding meaningful training stress.',
      pace, 1, [2, 4], dur, dist, ctx),
    warmup:  seg('Warmup', '3 min', 'Very slow jog', 1, [1, 2], 'Begin at a walk and ease into a very slow jog.'),
    mainSet: [seg('Recovery Run', '24 min', fmtRange(pace), 1, [2, 4], 'Deliberately slow — this should feel almost too easy. That\'s the goal.')],
    cooldown: seg('Cooldown', '3 min', 'Walk', 1, [1, 2], '3 min walk. Light quad and calf stretches.'),
    purpose: 'Flush metabolic waste and restore muscle tissue without adding recovery debt — an investment in tomorrow\'s session.',
    instructions: [
      'This run should feel embarrassingly slow — that\'s correct.',
      'No HR monitor pressure: stay well within Zone 1.',
      'Relax your arms and shoulders completely.',
      'Prioritize stride quality over anything else.',
    ],
    executionCues: ['Slow down further if you feel any strain.', 'This is not junk miles — it\'s an active recovery protocol.'],
    failureConditions: ['Pain at any intensity → walk instead.', 'Heart rate above Zone 2 → slow immediately.'],
    modifications: [
      { condition: 'Any residual soreness above 7/10', action: 'Replace with 30 min walk at brisk pace' },
    ],
    rationale,
    score: scoreWorkout('very_easy', dur, multiplier, false, calibration !== null),
  };
}

function buildLongRun(ctx: BuildContext): BuiltWorkout {
  const { paceCtx, mileage, multiplier, weekInBlock, trainingPhase, calibration } = ctx;
  const pace = paceCtx.easy;
  const dur  = Math.min(180, Math.round(80 + mileage * 1.2));
  const dist = mileage * 0.30;

  const rationale: PhysiologicalRationale = {
    adaptation:   'Glycogen depletion resilience + fat oxidation at race intensity',
    mechanism:    'Duration-dependent adaptations: slow-twitch fiber glycogen stores increase, myoglobin concentration rises, and fat oxidation enzymes upregulate. Psychological resilience to extended effort also trains pacing judgment.',
    timeframe:    '6–10 weeks; glycogen storage increases begin within 2–3 weeks',
    scienceBasis: 'Costill & Miller (1980) glycogen adaptations; Coyle (1995) fat oxidation; Daniels (2004) long run prescriptions',
  };

  return {
    ...base('long_run', 'long_run', 'aerobic', 'easy', 'aerobic_power',
      'Long Run',
      'Extended aerobic stimulus for glycogen durability, fatigue resistance, and race-specific endurance adaptation.',
      pace, 2, [5, 7], dur, dist, ctx),
    warmup:  seg('Warmup', '10 min', 'Easy jog or walk', 1, [2, 3], 'Start 30–60 sec/mi slower than easy pace. Let the body warm up naturally.'),
    mainSet: [seg('Long Run', `${dur - 20} min`, fmtRange(pace), 2, [5, 7], 'Hold easy conversational pace. Eat every 30–40 min. Stay hydrated.')],
    cooldown: seg('Cooldown', '10 min', 'Walk', 1, [1, 2], '10 min walk. Prioritize hip flexor, hamstring, and calf stretches.'),
    purpose: 'Build the endurance foundation — the single most important session of the week for distance runners.',
    instructions: [
      'Begin conservatively — 60 sec/mi slower than easy pace for the first mile.',
      'Carry nutrition for sessions over 60 min (gel or chews every 30–40 min).',
      'Hydrate every 20–30 min regardless of thirst.',
      'Do not chase pace on hills — go by effort.',
    ],
    executionCues: ['Start slow, end steady.', 'You should feel good at mile 1 — if not, stop.', 'The last 20% of the run is where adaptation happens.'],
    failureConditions: ['Muscle fatigue forcing gait change → stop.', 'Dizziness, nausea, or GI distress → stop.', 'Pain (not fatigue) anywhere → stop.'],
    modifications: [
      { condition: 'Heavy legs from previous sessions', action: 'Reduce by 20 min and add 5 min walk breaks every 20 min' },
      { condition: 'HR elevated 10+ bpm above easy zone at same pace', action: 'Reduce pace by 30 sec/mi for remainder' },
    ],
    rationale,
    score: scoreWorkout('easy', dur, multiplier, false, calibration !== null),
    progressionNote: weekInBlock <= 3 ? `Week ${weekInBlock}/3 — ${dur} min target this block` : 'Deload week: reduce by 30 min.',
  };
}

function buildThreshold(ctx: BuildContext): BuiltWorkout {
  const { paceCtx, mileage, multiplier, weekInBlock, calibration } = ctx;
  const pace = paceCtx.threshold;

  // Threshold interval volume progresses weekly within a block
  const repMin = [12, 16, 20, 10][Math.min(weekInBlock - 1, 3)]!;
  const sets = repMin >= 20 ? 1 : 2;
  const setMin = sets === 1 ? repMin : Math.round(repMin / 2);
  const dur = 50;
  const dist = mileage * 0.20;

  const intervals: IntervalBlock = {
    setCount:      sets,
    workLabel:     `${setMin} min`,
    restLabel:     '3 min easy jog',
    workPaceGuide: fmtRange(pace),
    workHRZone:    4,
    workRPE:       [7, 8],
    restType:      'jog',
    totalWorkMin:  repMin,
    progressionNote: `Week ${weekInBlock}/3: ${sets} × ${setMin} min threshold. Build to 2 × 20 min by week 3.`,
  };

  const rationale: PhysiologicalRationale = {
    adaptation:   'Lactate threshold elevation + monocarboxylate transporter upregulation',
    mechanism:    'Training at or just below LT raises the maximal lactate steady state (MLSS). MCT1 and MCT4 transporters upregulate, improving lactate shuttling from muscle to blood to liver. Hydrogen ion buffering capacity increases, delaying acidosis at high speeds.',
    timeframe:    '4–6 weeks of consistent threshold work',
    scienceBasis: 'Daniels (2004) threshold guidelines; Billat (2003) MLSS review; Bishop et al. (1998) MCT upregulation',
  };

  return {
    ...base('threshold', 'threshold', 'threshold', 'hard', 'aerobic_power',
      'Threshold Run',
      `${sets} × ${setMin} min at lactate threshold. Raises sustainable race pace and delays fatigue onset.`,
      pace, 4, [7, 8], dur, dist, ctx),
    warmup:  seg('Warmup', '15 min', fmtRange(paceCtx.easy), 2, [4, 5], 'Easy jog for 15 min. Include 4 × 20s strides in the last 3 min to prime the system.'),
    mainSet: Array.from({ length: sets }, (_, i) => seg(
      `Threshold Rep ${i + 1}`,
      `${setMin} min`,
      fmtRange(pace),
      4, [7, 8],
      'Comfortably hard effort. Short phrases only. Resist the urge to go faster — precision matters more than pace.',
    )),
    cooldown: seg('Cooldown', '10 min', fmtRange(paceCtx.easy), 2, [3, 5], 'Easy jog for 10 min, then walk 3 min, then stretch.'),
    intervals,
    purpose: 'Directly raise the lactate threshold — the physiological governor of sustainable race pace.',
    instructions: [
      'Spend 10 min warming up at easy pace before the first interval.',
      'Target "comfortably hard" — you can say a word or two, not sentences.',
      'Start at the SLOWER end of the pace range; drift faster only if still controlled.',
      'Take the full 3 min jog recovery between intervals — do not shorten it.',
    ],
    executionCues: ['Short phrases only — not silence, not conversation.', 'Check HR: target Zone 4 (80–90% HRmax).', 'Rhythm running: smooth, not strained.'],
    failureConditions: ['HR > 90% HRmax → slow pace immediately.', 'Breathing becomes labored (can\'t say a word) → back off.', 'Legs feel like concrete → cut the set short.'],
    modifications: [
      { condition: 'Can\'t sustain pace after first interval', action: 'Reduce pace by 15 sec/mi for remaining intervals' },
      { condition: 'Heart rate spikes significantly above Zone 4', action: 'Convert second interval to easy run' },
    ],
    rationale,
    score: scoreWorkout('hard', dur, multiplier, true, calibration !== null),
    progressionNote: intervals.progressionNote,
  };
}

function buildTempo(ctx: BuildContext): BuiltWorkout {
  const { paceCtx, mileage, multiplier, weekInBlock, calibration } = ctx;
  const pace = { minSecPerMi: paceCtx.threshold.minSecPerMi + 15, maxSecPerMi: paceCtx.marathon.maxSecPerMi };
  const dur  = 55;
  const dist = mileage * 0.22;

  const rationale: PhysiologicalRationale = {
    adaptation:   'Sustained aerobic power + mental durability at race pace',
    mechanism:    'Continuous tempo runs target the upper aerobic zone just below LT. This trains the body to sustain effort across the lactate-threshold boundary, improving race pace tolerance and psychological resilience without the acute stress of interval sessions.',
    timeframe:    '4–6 weeks',
    scienceBasis: 'Billat & Koralsztein (1996) tempo physiology; Daniels (2004) continuous tempo',
  };

  return {
    ...base('tempo', 'tempo', 'threshold', 'hard', 'aerobic_power',
      'Tempo Run',
      `20–30 min continuous run at tempo effort — faster than easy, short of threshold pain. Sustained aerobic power.`,
      pace, 3, [6, 7], dur, dist, ctx),
    warmup:  seg('Warmup', '15 min', fmtRange(paceCtx.easy), 2, [4, 5], 'Easy jog 15 min. Include 3 × 20s strides.'),
    mainSet: [seg('Tempo Run', '25 min', fmtRange(pace), 3, [6, 7], 'Sustained effort between marathon and threshold pace. You can speak in 3–4 word phrases.')],
    cooldown: seg('Cooldown', '10 min', fmtRange(paceCtx.easy), 2, [3, 5], 'Easy jog 10 min. Walk 3 min. Stretch hips and calves.'),
    purpose: 'Develop sustained aerobic power at the upper boundary of comfortable effort — the pace you hold when nothing is easy anymore.',
    instructions: [
      'Settle into tempo pace by 2 min — do not start too fast.',
      'This is not threshold — it is one step slower. Maintain throughout.',
      'Focus on rhythm and form as fatigue builds.',
      'Finish the 25 min segment; do not add distance.',
    ],
    executionCues: ['3–4 word phrases max.', 'Steady rhythm — no surges.', 'Relaxed shoulders; tall posture.'],
    failureConditions: ['Can only say one word → too fast, slow down.', 'HR above Zone 4 → back off to easy.'],
    modifications: [
      { condition: 'Cannot maintain pace after 15 min', action: 'Reduce to marathon pace and finish the duration' },
    ],
    rationale,
    score: scoreWorkout('hard', dur, multiplier, false, calibration !== null),
    progressionNote: `Week ${weekInBlock}: ${25 + (weekInBlock - 1) * 2} min continuous tempo target.`,
  };
}

function buildMarathonPace(ctx: BuildContext): BuiltWorkout {
  const { paceCtx, mileage, multiplier, weekInBlock, calibration } = ctx;
  const pace = paceCtx.marathon;
  const dur  = 60;
  const dist = mileage * 0.25;

  const rationale: PhysiologicalRationale = {
    adaptation:   'Race-specific neuromuscular pattern + glycogen sparing at goal pace',
    mechanism:    'Running at marathon pace programs the neuromuscular firing patterns of race day. Fat oxidation is maximized at this intensity, sparing glycogen for the final miles. The body learns to recruit muscle fibers in the specific sequence needed for sustained output.',
    timeframe:    '4–6 weeks of weekly marathon-pace work',
    scienceBasis: 'Daniels (2004) race pace training; Noakes (2003) central governor; Jeukendrup (2004) substrate oxidation',
  };

  return {
    ...base('marathon_pace', 'marathon_pace', 'aerobic', 'moderate', 'aerobic_power',
      'Marathon Pace Run',
      `Sustained running at goal race pace — the single best race rehearsal between long runs.`,
      pace, 3, [6, 7], dur, dist, ctx),
    warmup:  seg('Warmup', '15 min', fmtRange(paceCtx.easy), 2, [4, 5], 'Easy jog 10–15 min.'),
    mainSet: [seg('Marathon Pace', `${weekInBlock * 5 + 10} min`, fmtRange(pace), 3, [6, 7], 'Run exactly at goal marathon pace. Practice race-day fueling: gel every 30 min.')],
    cooldown: seg('Cooldown', '10 min', fmtRange(paceCtx.easy), 2, [3, 5], 'Easy jog down to walking pace.'),
    purpose: 'Program race-day pace into neuromuscular memory while practicing fueling strategies.',
    instructions: [
      'Dial in the exact race pace using a GPS watch.',
      'Carry race nutrition — use the same gel/chew planned for race day.',
      'Notice how marathon pace feels at different fatigue levels throughout.',
      'Negative split preferred: start 5 sec/mi slower, build to pace.',
    ],
    executionCues: ['This is race effort — controlled, purposeful.', 'Check pace every mile, not every 30 seconds.'],
    failureConditions: ['Pace drifts 15+ sec/mi slower → the body is not ready for this today; convert to easy run.'],
    modifications: [
      { condition: 'Not feeling strong after warmup', action: 'Run first half at easy pace, then try marathon pace' },
    ],
    rationale,
    score: scoreWorkout('moderate', dur, multiplier, false, calibration !== null),
    progressionNote: `Week ${weekInBlock}: ${weekInBlock * 5 + 10} min at marathon pace.`,
  };
}

function buildVO2(ctx: BuildContext): BuiltWorkout {
  const { paceCtx, mileage, multiplier, weekInBlock, calibration } = ctx;
  const pace = paceCtx.vo2;
  const sets = Math.min(6, 4 + weekInBlock - 1);
  const dur  = 55;
  const dist = mileage * 0.18;

  const intervals: IntervalBlock = {
    setCount:      sets,
    workLabel:     '4 min',
    restLabel:     '3 min easy jog',
    workPaceGuide: fmtRange(pace),
    workHRZone:    5,
    workRPE:       [8, 9],
    restType:      'jog',
    totalWorkMin:  sets * 4,
    progressionNote: `Week ${weekInBlock}: ${sets} × 4 min. Build to 6 × 4 min by week 3.`,
  };

  const rationale: PhysiologicalRationale = {
    adaptation:   'VO2max elevation + cardiac output maximization',
    mechanism:    'Short maximal intervals above LT force the cardiovascular system to deliver oxygen at its upper limit. Stroke volume increases as the heart adapts to repeated demands. Central O2 delivery and peripheral extraction both improve, raising the aerobic ceiling that all race paces operate under.',
    timeframe:    '6–10 weeks; stroke volume increases visible in 4–6 weeks',
    scienceBasis: 'Helgerud et al. (2007) 4×4 VO2max; Midgley et al. (2006) VO2max intervals; Laursen & Jenkins (2002) HIIT review',
  };

  return {
    ...base('vo2', 'vo2', 'vo2', 'hard', 'aerobic_power',
      'VO2 Max Intervals',
      `${sets} × 4 min at 5K effort. Elevates aerobic ceiling and cardiac stroke volume.`,
      pace, 5, [8, 9], dur, dist, ctx),
    warmup:  seg('Warmup', '15 min', fmtRange(paceCtx.easy), 2, [4, 5], 'Easy jog 12 min + 4 × 20s strides with full recovery.'),
    mainSet: Array.from({ length: sets }, (_, i) => seg(
      `VO2 Interval ${i + 1}`,
      '4 min',
      fmtRange(pace),
      5, [8, 9],
      'Hard controlled effort — approach your 5K race effort. HR should climb to Zone 5 by minute 2.',
    )),
    cooldown: seg('Cooldown', '10 min', fmtRange(paceCtx.easy), 2, [3, 4], 'Easy jog 10 min. Walk 5 min. Stretch.'),
    intervals,
    purpose: 'Raise the aerobic ceiling — the highest VO2 you can sustain, which sets the upper limit of every race pace.',
    instructions: [
      'The 15 min warmup and strides are mandatory — do not skip them.',
      'Start each interval 5 sec/mi SLOWER than target. Let HR climb naturally.',
      'Each interval should feel like a controlled 5K race effort.',
      'Take exactly 3 min jog recovery — do not walk unless HR doesn\'t drop.',
    ],
    executionCues: ['Hard, not panicked.', 'First interval always feels easy — trust the process.', 'Final interval: dig, but don\'t sprint.'],
    failureConditions: ['HR won\'t recover below 75% between intervals → stop.', 'Pace drops > 20 sec/mi from rep 1 to rep 3 → cut session short.'],
    modifications: [
      { condition: 'Not recovering adequately between intervals', action: 'Extend rest to 4 min and reduce sets by 1' },
    ],
    rationale,
    score: scoreWorkout('hard', dur, multiplier, true, calibration !== null),
    progressionNote: intervals.progressionNote,
  };
}

function buildHillRepeats(ctx: BuildContext): BuiltWorkout {
  const { paceCtx, mileage, multiplier, weekInBlock, calibration } = ctx;
  const sets = Math.min(10, 6 + weekInBlock - 1);
  const dur  = 45;
  const dist = mileage * 0.15;

  const intervals: IntervalBlock = {
    setCount:      sets,
    workLabel:     '60s uphill (5–8% grade)',
    restLabel:     'Walk down + 30s',
    workPaceGuide: 'Hard uphill effort — perceived exertion, not pace',
    workHRZone:    4,
    workRPE:       [8, 9],
    restType:      'walk',
    totalWorkMin:  Math.round(sets * 1.5),
    progressionNote: `Week ${weekInBlock}: ${sets} repeats. Build to 10 by week 3.`,
  };

  const rationale: PhysiologicalRationale = {
    adaptation:   'Neuromuscular power + connective tissue stiffness + running economy',
    mechanism:    'Uphill running increases ground reaction forces and eccentric demands on tendons, driving connective tissue remodeling. Achilles and patellar tendons become stiffer and more elastic. Fast-twitch motor units are recruited fully, improving neuromuscular power output at all speeds.',
    timeframe:    '4–6 weeks; tendon adaptations require 6–8 weeks for structural completion',
    scienceBasis: 'Paavolainen et al. (1999) hill training and economy; Midgley et al. (2007) tendon stiffness; Bohm et al. (2014) tendon adaptation',
  };

  return {
    ...base('hill_repeats', 'hill_repeats', 'anaerobic', 'hard', 'processing_power',
      'Hill Repeats',
      `${sets} × 60s hard uphill. Builds neuromuscular power, tendon stiffness, and running economy with low injury risk.`,
      paceCtx.rep, 4, [8, 9], dur, dist, ctx),
    warmup:  seg('Warmup', '15 min', fmtRange(paceCtx.easy), 2, [4, 5], 'Easy jog 15 min on flat ground. Include 4 strides on flat.'),
    mainSet: Array.from({ length: sets }, (_, i) => seg(
      `Hill Rep ${i + 1}`,
      '60s',
      'Hard uphill — 5–8% grade',
      4, [8, 9],
      'Drive knees high, pump arms, shorten stride. Hard effort — not sprint. Walk down completely.',
    )),
    cooldown: seg('Cooldown', '10 min', fmtRange(paceCtx.easy), 2, [3, 4], 'Easy flat jog 10 min.'),
    intervals,
    purpose: 'Build leg power and tendon stiffness without high-velocity injury risk — the safest way to develop speed.',
    instructions: [
      'Find a consistent hill: 5–8% grade, 100–150m long.',
      'Drive arms aggressively on the uphill — they power your legs.',
      'Walk (not jog) the full descent — downhill running is where injuries happen.',
      'Each rep should feel like a controlled hard effort, not a sprint.',
    ],
    executionCues: ['High knees, short powerful stride.', 'Arms drive the hill.', 'Walk down — fully recover.'],
    failureConditions: ['Calf tightness or Achilles pain → stop immediately.', 'Pace drops > 50% from first rep → rest more and stop if it continues.'],
    modifications: [
      { condition: 'No hill available', action: 'Treadmill at 5% incline, or replace with strides on flat' },
    ],
    rationale,
    score: scoreWorkout('hard', dur, multiplier, true, calibration !== null),
    progressionNote: intervals.progressionNote,
  };
}

function buildStrides(ctx: BuildContext): BuiltWorkout {
  const { paceCtx, mileage, multiplier, calibration } = ctx;
  const sets = 6;
  const dur  = 25;
  const dist = mileage * 0.07;

  const intervals: IntervalBlock = {
    setCount:      sets,
    workLabel:     '20 sec',
    restLabel:     '90 sec easy jog',
    workPaceGuide: `${fmtRange(paceCtx.rep)} (relaxed, not sprinting)`,
    workHRZone:    4,
    workRPE:       [7, 8],
    restType:      'jog',
    totalWorkMin:  2,
    progressionNote: 'Volume stays fixed at 6–8 strides. Increase pace quality over time.',
  };

  const rationale: PhysiologicalRationale = {
    adaptation:   'Running economy + neuromuscular coordination + stride mechanics',
    mechanism:    'Brief accelerations recruit fast-twitch fiber motor units without causing significant fatigue accumulation. Repeated activation improves the neuromuscular firing sequence, increasing stride length and efficiency at all speeds.',
    timeframe:    '2–4 weeks to notice improved stride smoothness',
    scienceBasis: 'Saunders et al. (2004) running economy; Paavolainen et al. (1999) neuromuscular training',
  };

  return {
    ...base('strides', 'strides', 'anaerobic', 'moderate', 'processing_power',
      'Strides',
      `${sets} × 20s relaxed accelerations. Improves neuromuscular power, running economy, and stride mechanics.`,
      paceCtx.rep, 4, [7, 8], dur, dist, ctx),
    warmup:  seg('Warmup', '15 min', fmtRange(paceCtx.easy), 2, [4, 5], 'Easy jog 15 min to prime the system before accelerations.'),
    mainSet: Array.from({ length: sets }, (_, i) => seg(
      `Stride ${i + 1}`,
      '20 sec',
      fmtRange(paceCtx.rep),
      4, [7, 8],
      'Smooth, relaxed acceleration to fast-but-controlled pace. Not a sprint. Full recovery before the next.',
    )),
    cooldown: seg('Cooldown', '5 min', 'Easy jog or walk', 1, [2, 3], 'Easy jog 3 min then walk 2 min.'),
    intervals,
    purpose: 'Train fast-twitch fiber recruitment and stride efficiency with minimal fatigue cost — the highest ROI session in training.',
    instructions: [
      'Fully warm up with at least 15 min easy jog before the first stride.',
      'Accelerate smoothly over the first 5 sec, hold for 10 sec, decelerate for 5 sec.',
      'This is NOT a sprint — relaxed, tall, smooth.',
      'Take full 90 sec jog recovery between each stride.',
    ],
    executionCues: ['Relaxed face → relaxed body.', 'Think "fast" not "hard."', 'Decelerate gradually — never brake.'],
    failureConditions: ['Hamstring tightness at any point → stop.', 'Form breaks down → slow down and fix mechanics first.'],
    modifications: [
      { condition: 'Legs feel heavy from previous session', action: 'Reduce to 4 strides at 80% effort' },
    ],
    rationale,
    score: scoreWorkout('moderate', dur, multiplier, true, calibration !== null),
  };
}

function buildFartlek(ctx: BuildContext): BuiltWorkout {
  const { paceCtx, mileage, multiplier, weekInBlock, calibration } = ctx;
  const dur  = 50;
  const dist = mileage * 0.20;
  const surges = 8 + weekInBlock;

  const rationale: PhysiologicalRationale = {
    adaptation:   'Aerobic-anaerobic energy system integration + mental adaptability',
    mechanism:    'Unstructured speed surges train transitions between aerobic and anaerobic energy systems. The lack of rigid structure develops pace judgment and willingness to push at unknown fatigue states — critical for race tactics.',
    timeframe:    '3–6 weeks',
    scienceBasis: 'Billat (2001) fartlek physiology; Seiler (2010) unstructured vs structured intensity',
  };

  return {
    ...base('fartlek', 'fartlek', 'threshold', 'moderate', 'aerobic_power',
      'Fartlek Run',
      `${surges} × 90 sec surges within a 50 min easy run. Unstructured speed play — effort drives pace, not watch.`,
      paceCtx.threshold, 3, [6, 8], dur, dist, ctx),
    warmup:  seg('Warmup', '10 min', fmtRange(paceCtx.easy), 2, [4, 5], 'Easy jog 10 min to get comfortable before the surges.'),
    mainSet: [seg('Fartlek', '30 min', 'Easy + surges', 3, [6, 8], `Run easy, then every 3–4 min surge hard for 90 sec. No watch needed — run by feel. ${surges} surges total.`)],
    cooldown: seg('Cooldown', '10 min', fmtRange(paceCtx.easy), 2, [3, 5], 'Easy jog back to full recovery pace.'),
    intervals: {
      setCount:      surges,
      workLabel:     '90 sec hard surge',
      restLabel:     '3–4 min easy jog',
      workPaceGuide: 'By feel — somewhere between threshold and VO2 pace',
      workHRZone:    4,
      workRPE:       [7, 8],
      restType:      'jog',
      totalWorkMin:  Math.round(surges * 1.5),
      progressionNote: 'Surges by feel — do not check pace during the surge.',
    },
    purpose: 'Develop aerobic-anaerobic transitions and race-pace responsiveness through unstructured speed play.',
    instructions: [
      'Easy run with periodic hard surges — no strict interval structure.',
      'Choose surge opportunities naturally: on a hill, when you feel good, or at a landmark.',
      'Recover at easy pace until fully ready for the next surge.',
      'Do not use GPS for surge pace — pure effort.',
    ],
    executionCues: ['Surges: commit fully, not cautiously.', 'Recovery: actually recover.', 'Fun: runs by feel should feel like freedom.'],
    failureConditions: ['More than 3 failed surges (can\'t complete 90 sec) → too fatigued, convert to easy run.'],
    modifications: [
      { condition: 'Poor recovery today', action: 'Reduce surges to 5 and cut duration to 40 min' },
    ],
    rationale,
    score: scoreWorkout('moderate', dur, multiplier, true, calibration !== null),
    progressionNote: `Week ${weekInBlock}: ${surges} surges within 50 min fartlek.`,
  };
}

function buildProgressionRun(ctx: BuildContext): BuiltWorkout {
  const { paceCtx, mileage, multiplier, weekInBlock, calibration } = ctx;
  const dur  = 55;
  const dist = mileage * 0.22;

  const rationale: PhysiologicalRationale = {
    adaptation:   'Metabolic efficiency across intensity spectrum + pacing judgment',
    mechanism:    'Beginning easy and building to threshold teaches the body to recruit additional muscle fibers progressively while maintaining efficiency at earlier recruited fibers. Develops fatigue resistance and race-day pacing judgment.',
    timeframe:    '4–6 weeks',
    scienceBasis: 'Daniels (2004) progression runs; Noakes (2003) fatigue and pacing',
  };

  return {
    ...base('progression_run', 'progression_run', 'aerobic', 'moderate', 'aerobic_power',
      'Progression Run',
      'Start easy, build steadily to threshold. Develops pacing judgment and metabolic efficiency across intensity zones.',
      paceCtx.threshold, 3, [5, 8], dur, dist, ctx),
    warmup:  seg('Warmup', '5 min', 'Walk or very slow jog', 1, [2, 3], 'Ease in with a short warmup walk.'),
    mainSet: [
      seg('Easy Phase', '20 min', fmtRange(paceCtx.easy), 2, [4, 5], 'Easy conversational pace. Building from here.'),
      seg('Moderate Phase', '15 min', fmtRange(paceCtx.marathon), 3, [6, 7], 'Step up to marathon pace. Controlled effort.'),
      seg('Threshold Phase', '10 min', fmtRange(paceCtx.threshold), 4, [7, 8], 'Finish strong at threshold. Controlled, not sprint.'),
    ],
    cooldown: seg('Cooldown', '5 min', 'Easy jog', 2, [3, 4], 'Easy jog to bring HR down.'),
    purpose: 'Teach progressive intensity management — the skill that separates runners who finish strong from those who fade.',
    instructions: [
      'First 20 min must feel easy — no matter how good you feel.',
      'Middle 15 min: lift effort to marathon pace. Notice how it feels.',
      'Final 10 min: reach threshold effort. Controlled finish, not race effort.',
      'Negative split the entire run — never faster in the early miles.',
    ],
    executionCues: ['Build gradually — not abruptly.', 'Each phase should feel like a gear shift, not a jump.'],
    failureConditions: ['Can\'t hold threshold in final phase → stay at marathon pace for the finish.'],
    modifications: [
      { condition: 'Fatigue prevents threshold finish', action: 'Cap final phase at marathon pace and shorten by 5 min' },
    ],
    rationale,
    score: scoreWorkout('moderate', dur, multiplier, false, calibration !== null),
    progressionNote: `Week ${weekInBlock}: 20/15/10 min easy/moderate/threshold split.`,
  };
}

function buildTaperSession(ctx: BuildContext): BuiltWorkout {
  const { paceCtx, mileage, multiplier, calibration } = ctx;
  const pace = paceCtx.easy;
  const dur  = Math.round(35 * multiplier);

  const rationale: PhysiologicalRationale = {
    adaptation:   'Supercompensation + neuromuscular potentiation',
    mechanism:    'Reduced volume with maintained intensity allows glycogen stores to replenish fully, muscle damage to repair, and neuromuscular potentiation to occur. Fatigue decreases while fitness is preserved — peak performance emerges 10–14 days after taper begins.',
    timeframe:    '10–14 days total taper for peak performance',
    scienceBasis: 'Mujika & Padilla (2003) taper physiology; Thomas & Busso (2005) mathematical taper model',
  };

  return {
    ...base('taper_session', 'taper_session', 'aerobic', 'easy', 'aerobic_power',
      'Taper Session',
      'Reduced-volume easy run during taper. Maintain running feel and movement quality without adding fatigue.',
      pace, 2, [4, 5], dur, mileage * 0.12, ctx),
    warmup:  seg('Warmup', '5 min', 'Walk', 1, [1, 2], 'Walk 5 min. No hurry.'),
    mainSet: [seg('Taper Run', `${dur - 10} min`, fmtRange(pace), 2, [4, 5], 'Easy jog. Legs should feel springy. If not, slow down.')],
    cooldown: seg('Cooldown', '5 min', 'Walk', 1, [1, 2], 'Walk and stretch.'),
    purpose: 'Maintain running rhythm and neuromuscular sharpness without adding fatigue — trust the taper.',
    instructions: [
      'Do not add distance or intensity because you feel good.',
      'Focus on form: high cadence, relaxed shoulders, smooth stride.',
      'This session is about feel, not fitness.',
    ],
    executionCues: ['Shorter and easier than it feels right.', 'Freshness is the goal.'],
    failureConditions: ['Any unexpected fatigue → replace with complete rest.'],
    modifications: [
      { condition: 'Feeling great and want to run more', action: 'Do not. Stick to the plan. Taper anxiety is real.' },
    ],
    rationale,
    score: scoreWorkout('easy', dur, multiplier, false, calibration !== null),
    progressionNote: 'Taper week: reduced volume, maintained intensity.',
  };
}

function buildDeloadSession(ctx: BuildContext): BuiltWorkout {
  const { paceCtx, mileage, multiplier, calibration } = ctx;
  const pace = paceCtx.recovery;
  const dur  = 30;

  const rationale: PhysiologicalRationale = {
    adaptation:   'Supercompensation + tissue repair + psychological recovery',
    mechanism:    'Deload week allows accumulated fatigue to dissipate while fitness adaptations consolidate. Cortisol levels normalize, anabolic processes dominate, and the nervous system recovers from high-volume training. Adherence increases with planned recovery.',
    timeframe:    '7–10 days for full physiological recovery',
    scienceBasis: 'Bompa & Haff (2009) periodization; Meeusen et al. (2013) overtraining syndrome prevention',
  };

  return {
    ...base('deload_session', 'deload_session', 'recovery', 'very_easy', 'aerobic_power',
      'Deload Run',
      'Reduced-load easy run during deload week. Maintain movement and blood flow without training stress.',
      pace, 1, [2, 4], dur, mileage * 0.07, ctx),
    warmup:  seg('Warmup', '5 min', 'Walk', 1, [1, 2], 'Slow walk to ease in.'),
    mainSet: [seg('Deload Run', '20 min', fmtRange(pace), 1, [2, 4], 'Very easy running. The goal is movement, not fitness.')],
    cooldown: seg('Cooldown', '5 min', 'Walk and stretch', 1, [1, 2], 'Walk and do full-body stretching.'),
    purpose: 'Allow physiological and psychological recovery — an investment in the next training block.',
    instructions: [
      'This is a recovery week. Resist the urge to train harder.',
      'Run at a pace where the conversation is completely effortless.',
      'Prioritize sleep and nutrition this week above everything else.',
    ],
    executionCues: ['No effort. Just movement.'],
    failureConditions: ['Any fatigue during the run → walk.'],
    modifications: [
      { condition: 'Feeling tired or sore', action: 'Replace with 30 min walk' },
    ],
    rationale,
    score: scoreWorkout('very_easy', dur, multiplier, false, calibration !== null),
    progressionNote: 'Deload week: 65% of normal volume. Prioritize sleep.',
  };
}

function buildCrossTraining(ctx: BuildContext): BuiltWorkout {
  const { mileage, multiplier, calibration } = ctx;

  const rationale: PhysiologicalRationale = {
    adaptation:   'Aerobic maintenance with reduced musculoskeletal load',
    mechanism:    'Non-impact cardiovascular exercise maintains central adaptations (cardiac output, blood volume) while giving running-specific muscles and connective tissue active recovery. Cycling and swimming recruit partially different fiber populations.',
    timeframe:    'Maintains base fitness; no new adaptations within 1–2 weeks',
    scienceBasis: 'Tanaka (1994) cross-training during injury; Hamer & Stamatakis (2009) cross-training VO2 maintenance',
  };

  return {
    ...base('cross_training', 'cross_training', 'aerobic', 'easy', 'aerobic_power',
      'Cross Training',
      'Non-running aerobic session (cycling, swimming, elliptical). Maintains cardiovascular fitness with reduced impact.',
      { minSecPerMi: 600, maxSecPerMi: 540 }, 2, [4, 6], 45, mileage * 0.12, ctx),
    warmup:  seg('Warmup', '10 min', 'Low intensity', 1, [2, 3], 'Begin at very low resistance/effort.'),
    mainSet: [seg('Cross Training', '30 min', 'Zone 2 effort', 2, [4, 6], 'Sustained aerobic effort. Same HR target as easy run (Zone 2). Cycling, swimming, or elliptical preferred.')],
    cooldown: seg('Cooldown', '5 min', 'Low intensity', 1, [1, 2], 'Drop effort completely. Stretch hip flexors and calves.'),
    purpose: 'Maintain cardiovascular fitness while reducing musculoskeletal stress — essential for injury prevention cycles.',
    instructions: [
      'Match Zone 2 heart rate target used in easy runs.',
      'Cycling (outdoor or indoor): 90–100 rpm cadence preferred.',
      'Swimming: continuous laps at steady state.',
      'Elliptical: no hands on rails to engage core.',
    ],
    executionCues: ['HR Zone 2 = same aerobic stimulus as easy run.'],
    failureConditions: ['Joint discomfort from the activity → switch modalities.'],
    modifications: [],
    rationale,
    score: scoreWorkout('easy', 45, multiplier, false, calibration !== null),
  };
}

function buildStrength(ctx: BuildContext): BuiltWorkout {
  const { mileage, multiplier, calibration } = ctx;

  const rationale: PhysiologicalRationale = {
    adaptation:   'Running economy via neuromuscular force production + tendon stiffness',
    mechanism:    'Heavy resistance training improves motor unit recruitment patterns, increases tendon stiffness (elastic energy storage), and elevates ground contact force production. Runners who strength train consistently show 2–8% improvements in running economy without changing VO2max.',
    timeframe:    '6–8 weeks for measurable economy improvements',
    scienceBasis: 'Rønnestad & Mujika (2014) meta-analysis; Blagrove et al. (2018) strength training for distance runners',
  };

  return {
    ...base('strength', 'strength', 'recovery', 'moderate', 'processing_power',
      'Strength Training',
      'Lower-body and core strength session. Improves running economy, injury resilience, and connective tissue health.',
      { minSecPerMi: 0, maxSecPerMi: 0 }, 1, [5, 7], 40, 0, ctx),
    warmup:  seg('Warmup', '10 min', 'Dynamic mobility', 1, [2, 3], 'Hip circles, leg swings, bodyweight squats × 10.'),
    mainSet: [
      seg('Compound Lifts', '20 min', 'Heavy (3–5 RM range)', 2, [6, 7], 'Bulgarian split squats 3×6, Romanian deadlifts 3×6, hip thrusts 3×8. Rest 90s between sets.'),
      seg('Running-Specific', '10 min', 'Plyometrics', 3, [5, 7], 'Box jumps 3×5, single-leg hops 3×8/side, calf raises 3×15.'),
    ],
    cooldown: seg('Cooldown', '10 min', 'Static stretching', 1, [1, 2], 'Hip flexors 60s each, hamstrings 60s, calves 60s.'),
    purpose: 'Build the structural and neuromuscular foundation that makes every running session more efficient.',
    instructions: [
      'Heavy, low-rep work for compound lifts (3–5 reps at 80–85% 1RM).',
      'Prioritize single-leg exercises: they mirror running mechanics more than bilateral lifts.',
      'Plyometrics go after the heavy lifts, never before.',
      'Running economy benefits take 6–8 weeks — be patient.',
    ],
    executionCues: ['Slow eccentric (3 sec down), explosive concentric.', 'Single-leg work: match strength left/right.'],
    failureConditions: ['Joint pain (not muscle burn) → stop immediately.'],
    modifications: [
      { condition: 'No gym access', action: 'Bodyweight protocol: Bulgarian squats, single-leg deadlifts, box jumps, calf raises' },
    ],
    rationale,
    score: scoreWorkout('moderate', 40, multiplier, false, calibration !== null),
  };
}

function buildMobility(ctx: BuildContext): BuiltWorkout {
  const { mileage, multiplier, calibration } = ctx;

  const rationale: PhysiologicalRationale = {
    adaptation:   'Range of motion preservation + injury risk reduction',
    mechanism:    'Repetitive running creates adaptive shortening in hip flexors, calves, and hamstrings. Regular mobility work counteracts this, maintaining optimal joint ROM for efficient stride mechanics and reducing injury risk from muscle-tendon imbalances.',
    timeframe:    'Acute improvements in ROM; injury risk reduction cumulative over weeks',
    scienceBasis: 'Behm & Chaouachi (2011) flexibility and injury prevention; Ryan et al. (2014) running and hip flexor mobility',
  };

  return {
    ...base('mobility', 'mobility', 'recovery', 'very_easy', 'aerobic_power',
      'Mobility & Recovery',
      'Active recovery and mobility work. Counteracts running-specific tightness and supports tissue repair.',
      { minSecPerMi: 0, maxSecPerMi: 0 }, 1, [1, 3], 30, 0, ctx),
    warmup:  seg('Warmup', '5 min', 'Light walk', 1, [1, 2], 'Walk 5 min to warm up tissues.'),
    mainSet: [
      seg('Hip Mobility', '10 min', 'Light movement', 1, [1, 3], '90/90 hip rotations, pigeon pose, hip circles. Hold 45–60s each side.'),
      seg('Leg Mobility', '10 min', 'Light movement', 1, [1, 3], 'Standing hamstring stretch, standing quad stretch, kneeling hip flexor stretch. 60s each.'),
      seg('Calf & Ankle', '5 min', 'Light movement', 1, [1, 2], 'Calf stretches (straight and bent knee), ankle circles. Focus on Achilles.'),
    ],
    cooldown: seg('Cooldown', '5 min', 'Breathing', 1, [1, 1], 'Diaphragmatic breathing for 5 min.'),
    purpose: 'Maintain joint mobility and tissue health — often neglected, always important.',
    instructions: [
      'Never stretch cold — always walk or lightly jog 5 min first.',
      'Hold each position 45–60 sec; avoid bouncing.',
      'Focus on where you feel tightest from recent runs.',
      'This counts as a training day — take it seriously.',
    ],
    executionCues: ['Breathe into the stretch.', 'Discomfort is OK; pain is not.'],
    failureConditions: ['Pain during any stretch → skip that position.'],
    modifications: [],
    rationale,
    score: scoreWorkout('very_easy', 30, multiplier, false, calibration !== null),
  };
}

function buildRestDay(): BuiltWorkout {
  const rationale: PhysiologicalRationale = {
    adaptation:   'Supercompensation — fitness adapts during rest, not training',
    mechanism:    'Muscle protein synthesis peaks 24–48 hours after training. Glycogen resynthesis requires 20–24 hours. Connective tissue remodeling continues for 48–72 hours after loading. The adaptations from the week\'s training are locked in during rest.',
    timeframe:    'Critical within every training week',
    scienceBasis: 'Bompa & Haff (2009) supercompensation theory; Gibala & McGee (2008) recovery adaptation',
  };

  return {
    id: 'rest_day',
    richType: 'rest',
    type: 'rest',
    zone: 'recovery',
    intensity: 'rest',
    energySystem: 'aerobic_power',
    title: 'Rest Day',
    description: 'Complete rest. No structured exercise. Prioritize sleep, nutrition, and stress management.',
    paceGuidance: { label: 'Rest', description: 'No running today.', targetPace: 'N/A' },
    paceRange: { minSecPerMi: 0, maxSecPerMi: 0 },
    hrZoneTarget: 1,
    rpeRange: [0, 0],
    durationMinutes: 0,
    targetDistance: 0,
    recoveryCost: -15,
    fatigueScore: -5,
    completed: false,
    warmup:  seg('Rest', '—', '—', 1, [0, 0], 'No activity.'),
    mainSet: [seg('Rest Day', 'All day', '—', 1, [0, 0], 'Prioritize 8+ hours of sleep. Hydrate well. Eat enough protein.')],
    cooldown: seg('Rest', '—', '—', 1, [0, 0], 'Consider light walking or foam rolling — nothing structured.'),
    purpose: 'Give the body time to adapt and rebuild — training is the stimulus, rest is the adaptation.',
    instructions: [
      'Sleep 8+ hours. Go to bed 30 min earlier than usual.',
      'Eat enough protein (1.6–2.0 g/kg bodyweight) for muscle repair.',
      'Light walking is fine — no structured exercise.',
      'Mental recovery matters: reduce screens, increase downtime.',
    ],
    executionCues: ['Rest is training.', 'Boredom during rest = signs you\'re training hard enough.'],
    failureConditions: [],
    modifications: [
      { condition: 'Feeling great and itching to run', action: 'Take a 30 min walk — preserve the adaptation window' },
    ],
    rationale,
    score: { intendedLoad: 0, estimatedFatigueCost: -5, expectedAdaptation: 85, recoveryDemandHours: 0, confidenceScore: 99, executionDifficulty: 0 },
  };
}

// ─── Main dispatch ────────────────────────────────────────────────────────────

export function buildRichWorkout(
  richType: RichWorkoutType,
  ctx: BuildContext,
  dayIndex: number,
): RichWorkout {
  const builders: Record<RichWorkoutType, (ctx: BuildContext) => BuiltWorkout> = {
    easy_run:        buildEasyRun,
    recovery_run:    buildRecoveryRun,
    long_run:        buildLongRun,
    progression_run: buildProgressionRun,
    threshold:       buildThreshold,
    tempo:           buildTempo,
    marathon_pace:   buildMarathonPace,
    vo2:             buildVO2,
    hill_repeats:    buildHillRepeats,
    strides:         buildStrides,
    fartlek:         buildFartlek,
    taper_session:   buildTaperSession,
    deload_session:  buildDeloadSession,
    cross_training:  buildCrossTraining,
    strength:        buildStrength,
    mobility:        buildMobility,
    rest:            () => buildRestDay(),
  };

  const fn = builders[richType];
  const built = fn(ctx);
  return { ...built, dayIndex };
}
