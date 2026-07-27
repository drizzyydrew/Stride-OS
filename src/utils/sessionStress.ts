import type { ScheduledSession } from './scheduledSessions';
import type { RichWorkoutType } from '../types/workout';

export type StressClassification = 'recovery' | 'easy' | 'medium' | 'hard';

export type StressAxis = 0 | 1 | 2 | 3;

export type SessionStressProfile = {
  classification: StressClassification;
  axes: {
    cardio: StressAxis;
    lowerMuscular: StressAxis;
    upperMuscular: StressAxis;
    impact: StressAxis;
    neuromuscular: StressAxis;
    duration: StressAxis;
  };
  recoveryDemandHours: 12 | 24 | 36 | 48;
};

const ZERO_AXES: SessionStressProfile['axes'] = {
  cardio: 0,
  lowerMuscular: 0,
  upperMuscular: 0,
  impact: 0,
  neuromuscular: 0,
  duration: 0,
};

function axisForDuration(minutes: number): StressAxis {
  if (minutes >= 90) return 3;
  if (minutes >= 60) return 2;
  if (minutes >= 35) return 1;
  return 0;
}

function maxAxis(axes: SessionStressProfile['axes']): StressAxis {
  return Math.max(...Object.values(axes)) as StressAxis;
}

function classificationFromAxes(axes: SessionStressProfile['axes']): StressClassification {
  const max = maxAxis(axes);
  if (max >= 3) return 'hard';
  if (axes.duration >= 2 || axes.cardio >= 2 || axes.lowerMuscular >= 2 || axes.neuromuscular >= 2) return 'medium';
  if (max <= 0) return 'recovery';
  return 'easy';
}

function recoveryFor(classification: StressClassification, axes: SessionStressProfile['axes']): 12 | 24 | 36 | 48 {
  if (classification === 'recovery') return 12;
  if (classification === 'easy') return 24;
  if (classification === 'medium') return axes.duration >= 3 || axes.lowerMuscular >= 2 ? 36 : 24;
  return axes.lowerMuscular >= 3 || axes.neuromuscular >= 3 || axes.duration >= 3 ? 48 : 36;
}

function includesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some(pattern => pattern.test(text));
}

function classifyRun(session: ScheduledSession, text: string, richType?: RichWorkoutType): SessionStressProfile['axes'] {
  const duration = axisForDuration(session.durationMinutes);
  const runWalk = session.activityType === 'run_walk' || session.subtype === 'run_walk' || /run\s*\/\s*walk/.test(text);
  const recovery = richType === 'recovery_run' || richType === 'deload_session' || /recovery|deload|mobility|walk/.test(text);
  const quality = includesAny(text, [/interval/, /tempo/, /threshold/, /vo2/, /v̇o2/, /4x4/, /4×4/, /hill/, /sprint/, /speed/, /race[-\s]?specific/])
    || ['threshold', 'tempo', 'vo2', 'hill_repeats', 'fartlek', 'progression_run'].includes(richType ?? 'easy_run');
  const long = richType === 'long_run' || /\blong\b/.test(text) || session.durationMinutes >= 75;

  if (runWalk) {
    return { ...ZERO_AXES, cardio: 1, lowerMuscular: 1, impact: 1, duration };
  }
  if (quality) {
    return {
      ...ZERO_AXES,
      cardio: 3,
      lowerMuscular: /hill|sprint/.test(text) ? 2 : 1,
      impact: 3,
      neuromuscular: /stride|hill|sprint|interval|vo2|4x4|4×4/.test(text) ? 3 : 2,
      duration: Math.max(duration, 1) as StressAxis,
    };
  }
  if (long) {
    return { ...ZERO_AXES, cardio: 2, lowerMuscular: 2, impact: 2, duration: Math.max(duration, 2) as StressAxis };
  }
  if (recovery || richType === 'rest') {
    return { ...ZERO_AXES, cardio: session.durationMinutes > 0 ? 1 : 0, impact: session.activityType === 'run' ? 1 : 0, duration };
  }
  return { ...ZERO_AXES, cardio: 1, lowerMuscular: 1, impact: 1, duration };
}

function classifyStrength(session: ScheduledSession, text: string): SessionStressProfile['axes'] {
  const duration = axisForDuration(session.durationMinutes);
  const lower = includesAny(text, [/lower/, /leg/, /squat/, /deadlift/, /hinge/, /lunge/, /plyo/, /power/]);
  const upper = includesAny(text, [/upper/, /push/, /pull/, /press/, /row/]);
  const recovery = includesAny(text, [/mobility/, /recovery/, /prehab/, /activation/, /deload/]);
  if (recovery) return { ...ZERO_AXES, lowerMuscular: 1, upperMuscular: upper ? 1 : 0, duration };
  if (lower) return { ...ZERO_AXES, lowerMuscular: 3, upperMuscular: upper ? 2 : 0, neuromuscular: /plyo|power/.test(text) ? 3 : 1, duration };
  if (upper) return { ...ZERO_AXES, upperMuscular: 3, lowerMuscular: 0, neuromuscular: 1, duration };
  return { ...ZERO_AXES, lowerMuscular: 1, upperMuscular: 1, duration };
}

export function classifySessionStress(session: ScheduledSession): SessionStressProfile {
  const richType = session.richWorkout?.richType;
  const text = [
    session.activityType,
    session.subtype,
    session.title,
    session.purpose,
    session.target,
    session.mainSet,
    session.richWorkout?.type,
    richType,
    session.richWorkout?.intensity,
    session.strengthSession?.sessionType,
    session.strengthSession?.goal,
    session.strengthSession?.primaryPatterns?.join(' '),
    session.strengthSession?.exercises?.map(exercise => `${exercise.exercise.name} ${exercise.exercise.pattern}`).join(' '),
  ].filter(Boolean).join(' ').toLowerCase();

  let axes: SessionStressProfile['axes'];
  if (session.activityType === 'strength') axes = classifyStrength(session, text);
  else if (['run', 'run_walk', 'walk'].includes(session.activityType)) axes = classifyRun(session, text, richType);
  else if (['mobility', 'rest'].includes(session.activityType)) axes = { ...ZERO_AXES, duration: axisForDuration(session.durationMinutes) };
  else axes = { ...ZERO_AXES, cardio: 1, duration: axisForDuration(session.durationMinutes) };

  const classification = classificationFromAxes(axes);
  return { classification, axes, recoveryDemandHours: recoveryFor(classification, axes) };
}

export function isHardStress(session: ScheduledSession): boolean {
  return (session.stress ?? classifySessionStress(session)).classification === 'hard';
}

export function isLongStress(session: ScheduledSession): boolean {
  const stress = session.stress ?? classifySessionStress(session);
  return stress.axes.duration >= 2 || /\blong\b/i.test(`${session.subtype} ${session.title} ${session.richWorkout?.type ?? ''}`);
}

export function isHardLowerStrengthStress(session: ScheduledSession): boolean {
  const stress = session.stress ?? classifySessionStress(session);
  return session.activityType === 'strength' && stress.axes.lowerMuscular >= 3;
}

// Two hard sessions on adjacent days conflict only when they drain the same
// recovery-limited system. Lower-muscular and impact act as one shared "leg"
// system because running quality and lower-body strength both consume it —
// which is exactly why hard upper-body work followed by intervals is an
// acceptable pairing while heavy lower work followed by hills is not.
export function hasOverlappingHardStress(a: ScheduledSession, b: ScheduledSession): boolean {
  const axesA = (a.stress ?? classifySessionStress(a)).axes;
  const axesB = (b.stress ?? classifySessionStress(b)).axes;
  const legA = Math.max(axesA.lowerMuscular, axesA.impact);
  const legB = Math.max(axesB.lowerMuscular, axesB.impact);
  if (legA >= 2 && legB >= 2) return true;
  if (axesA.cardio >= 3 && axesB.cardio >= 3) return true;
  if (axesA.neuromuscular >= 3 && axesB.neuromuscular >= 3) return true;
  if (axesA.upperMuscular >= 3 && axesB.upperMuscular >= 3) return true;
  return false;
}
