import type { RichWorkout, WorkoutSegment } from '../../types/workout';
import type { SpecificityDecision } from './runningSpecificity';
import { formatPace } from '../calibrationEngine';

/** Exact ordered execution targets; recoveries are real segments, not text
 * inside an interval summary. Full 4x4 is never a shortened workout label. */
export function buildSpecificityWorkout(workout: RichWorkout, decision: SpecificityDecision, calibrated: boolean): RichWorkout {
  if (decision.stage === 'easy' || !['strides', 'fartlek', 'threshold', 'vo2'].includes(workout.richType)) return workout;
  const isNorwegian = decision.stage === 'norwegian_4x4';
  const isThreshold = decision.stage === 'tempo_threshold';
  const isStrides = decision.stage === 'strides';
  const isGentle = decision.stage === 'gentle_fartlek';
  const isRace = decision.target === 'race_pace';
  const rpe: [number, number] = isStrides || isGentle ? [5, 6] : isThreshold ? [6, 7] : [7, 8];
  const zone = isStrides || isGentle ? 3 : 4;
  const effort = isRace ? 'Current event-specific effort; finish each bout in control' : isStrides ? 'Relaxed acceleration, never an all-out sprint' : isGentle ? 'Comfortably quicker than easy; stay controlled'
    : isThreshold ? 'Controlled sustained effort; short phrases remain possible' : 'Controlled hard effort; repeatable through the final bout';
  const calibratedPace = isRace ? decision.calibratedRacePaceSecPerMile : undefined;
  const hasPace = isRace ? calibratedPace !== undefined : calibrated && !isStrides;
  const workPace = calibratedPace ? `${formatPace(calibratedPace)}/mi — current prediction, adjust by effort` : hasPace ? workout.paceGuidance.targetPace : effort;
  const segment = (label: string, seconds: number, work: boolean): WorkoutSegment => ({
    label, duration: seconds % 60 === 0 ? `${seconds / 60} min` : `${seconds} sec`, targetSeconds: seconds,
    paceGuide: work ? workPace : 'Easy jog or walk', hrZone: work ? zone : 2, rpe: work ? rpe : [2, 3],
    instructions: work ? effort : 'Recover comfortably. Extend recovery or end the quality work if needed.',
  });
  const mainSet: WorkoutSegment[] = [];
  for (let i = 0; i < decision.reps; i++) {
    mainSet.push(segment(`Work ${i + 1}`, decision.workSeconds, true));
    if (i < decision.reps - 1) mainSet.push(segment(`Recovery ${i + 1}`, decision.recoverySeconds, false));
  }
  const warmup = segment('Warmup', 600, false);
  const cooldown = segment('Cooldown', 300, false);
  const durationMinutes = (900 + decision.reps * decision.workSeconds + (decision.reps - 1) * decision.recoverySeconds) / 60;
  if (!Number.isFinite(workout.durationMinutes) || workout.durationMinutes < durationMinutes) {
    const seconds = Math.max(60, Math.round((Number.isFinite(workout.durationMinutes) ? Math.max(1, workout.durationMinutes) : 20) * 60));
    const warmSeconds = Math.floor(seconds * 0.2);
    const coolSeconds = Math.floor(seconds * 0.1);
    return { ...workout, richType: 'easy_run', type: 'easy_run', protocol: undefined, title: 'Easy Run — Time Fit',
      intensity: 'easy', durationMinutes: seconds / 60, rpeRange: [2, 4], hrZoneTarget: 2,
      recoveryCost: Math.round(seconds / 60 * 0.3), fatigueScore: Math.round(seconds / 60 * 0.25),
      paceTargetSource: 'effort', paceGuidance: { label: 'Easy effort', description: 'Comfortable conversation', targetPace: 'Easy, conversational effort' },
      warmup: segment('Warmup', warmSeconds, false), mainSet: [segment('Easy run', seconds - warmSeconds - coolSeconds, false)], cooldown: segment('Cooldown', coolSeconds, false),
      intervals: undefined, purpose: 'The full quality protocol does not fit this session. Keep the run easy rather than shorten a workout under the full protocol name.',
      instructions: ['Keep the session easy and conversational.', 'Walk or shorten the run if needed.'],
      executionCues: ['Comfortable conversation.'], failureConditions: ['Stop or shorten if symptoms or unusual difficulty arise.'],
      modifications: [{ condition: 'More effort than expected', action: 'Walk, slow down or shorten the run.' }],
      rationale: { adaptation: 'Repeatable aerobic practice', mechanism: 'An easy session fits the available time without claiming the full interval stimulus.', timeframe: 'Review actual response before more quality.', scienceBasis: 'Individualized training dose and recovery.' },
      score: { ...workout.score, intendedLoad: Math.round(seconds / 60 * 0.7), estimatedFatigueCost: Math.round(seconds / 60 * 0.3) },
      progressionNote: 'Review available time before scheduling this quality protocol.' };
  }
  const title = isRace ? 'Race-Specific Pace Practice' : isNorwegian ? 'Norwegian 4×4 — Aerobic Power' : isThreshold ? 'Controlled Sustained Intervals'
    : isStrides ? 'Easy Run + Relaxed Accelerations' : isGentle ? 'Gentle Faster Bouts' : 'Aerobic-Power Progression';
  return {
    ...workout,
    paceTargetSource: hasPace ? 'calibration' : 'effort',
    ...(calibratedPace ? { paceRange: { minSecPerMi: Math.round(calibratedPace * 1.025), maxSecPerMi: Math.round(calibratedPace * 0.975) } } : {}),
    title, description: decision.rationale,
    type: isNorwegian ? 'norwegian_4x4' : workout.type,
    protocol: isNorwegian ? 'norwegian_4x4' : undefined,
    durationMinutes, recoveryCost: Math.round(durationMinutes * 0.6), fatigueScore: Math.round(durationMinutes * 0.5),
    targetDistance: Math.round(durationMinutes * 60 / Math.max(300, workout.paceRange.minSecPerMi) * 10) / 10,
    warmup, mainSet, cooldown,
    intensity: isStrides || isGentle ? 'moderate' : 'hard', rpeRange: rpe, hrZoneTarget: zone,
    paceGuidance: { label: title, description: effort, targetPace: workPace },
    purpose: isNorwegian ? 'Train aerobic power after building tolerance to shorter intervals. This is distinct from lactate-threshold training.' : decision.rationale,
    intervals: { setCount: decision.reps, workLabel: `${decision.workSeconds / 60} min`, restLabel: `${decision.recoverySeconds / 60} min easy`,
      workPaceGuide: workPace, workHRZone: zone, workRPE: rpe, restType: 'jog', totalWorkMin: decision.reps * decision.workSeconds / 60,
      progressionNote: decision.rationale },
    instructions: ['Warm up with ten minutes of easy running or walking.',
      `Complete ${decision.reps} × ${decision.workSeconds / 60} minutes at the described effort, with easy recovery between bouts.`,
      'Build into each bout; pace follows current capacity rather than an aspirational race target.',
      'Finish with five minutes easy. Report the actual bouts, effort and recovery before the next progression.'],
    executionCues: ['Controlled and repeatable.', 'Heart rate responds with a delay; do not sprint to chase a number.', 'Shorten the quality work if recovery is not comfortable.'],
    failureConditions: ['Stop quality work for pain, dizziness, unusual breathlessness or inability to recover comfortably.'],
    modifications: [{ condition: 'Too demanding or poor recovery', action: 'Shorten work bouts, add easy recovery, or finish as an easy run.' },
      { condition: 'Comfortable completion', action: 'Record actual work and effort; review a small duration increase before increasing pace.' }],
    rationale: { adaptation: isRace ? 'Event-specific pace tolerance' : isNorwegian ? 'Aerobic power / VO₂ stimulus' : isThreshold ? 'Sustainable faster running' : 'Gradual exposure to faster running',
      mechanism: 'A purposeful faster-running stimulus follows actual tolerance and is separated by easy recovery. It does not guarantee a particular physiological response.',
      timeframe: 'Review across repeated tolerated exposures; no fixed improvement deadline.',
      scienceBasis: isNorwegian ? 'Helgerud et al. (2007), aerobic high-intensity intervals; eligibility and dose ramp are conservative coaching choices.' : 'Specificity, repeatable practice and individually adjusted training dose.' },
    score: { ...workout.score, intendedLoad: Math.round(durationMinutes * (isStrides || isGentle ? 1 : 1.5)),
      estimatedFatigueCost: Math.round(durationMinutes * (isStrides || isGentle ? 0.4 : 0.7)) },
    progressionNote: decision.rationale,
  };
}
