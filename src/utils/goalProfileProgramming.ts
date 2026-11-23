import type { GoalIntent, GoalProfileId } from '../types/goalIntent';
import { estimateStrengthSessionMinutes, fitStrengthSessionToTime } from './strengthDesign';
import type { PlannedExercise, StrengthEngineInput, StrengthSession } from '../types/strength';
export const FOOT_BALANCE_PROFILES: readonly GoalProfileId[] = ['running','race_prep','get_faster','aerobic_base','run_farther','hybrid','hiking','downhill_skiing','snowboarding','cross_country_skiing','mountaineering'];
const SPORT_WORK: Partial<Record<GoalProfileId, string[]>> = {
 hiking: ['hike_step_up', 'hike_step_down', 'hike_pack_carry'],
 downhill_skiing: ['ski_split_squat', 'ski_lateral_lunge', 'ski_wall_hold'],
 snowboarding: ['snowboard_offset_squat', 'snowboard_lateral_step', 'snowboard_pallof'],
 cross_country_skiing: ['xc_single_leg_step', 'xc_straight_arm_pull', 'hinge_rdl'],
 mountaineering: ['mountaineering_step_up', 'mountaineering_carry', 'hike_step_down', 'xc_straight_arm_pull'],
};
export function profileExerciseIds(intent: GoalIntent, fallback: string[], sessionIndex: number): string[] {
 const primary = intent.priorities[0]!;
 const sport = SPORT_WORK[primary];
 let selected: string[];
 if (sport) {
   const first = [...sport]; if (sessionIndex % 2 && first.length > 1) [first[0], first[1]] = [first[1]!, first[0]!];
   selected = [...first, 'foot_supported_calf', sessionIndex % 2 ? 'pull_row' : 'push_pushup', 'foot_clock_reach'];
 } else selected = fallback.map(id => id === 'calf_single_standing' ? 'foot_supported_calf' : ['trunk_dead_bug','trunk_bird_dog','trunk_side_plank'].includes(id) && FOOT_BALANCE_PROFILES.includes(primary) ? 'foot_clock_reach' : id);
 // Replace the existing calf/trunk roles; these modules are never extra sessions.
 intent.priorities.slice(1).forEach((profile, index) => {
   const supporting = SPORT_WORK[profile]?.[0] ?? (['get_stronger', 'build_muscle', 'power', 'hybrid'].includes(profile) ? 'hinge_rdl' : 'foot_supported_calf');
   if (!selected.includes(supporting)) selected.splice(4 + index, 1, supporting);
 });
 if (FOOT_BALANCE_PROFILES.includes(primary)) {
   const primaryCount = SPORT_WORK[primary]?.length ?? 4;
   for (const id of ['foot_supported_calf','foot_clock_reach']) if (!selected.includes(id)) {
     const optional = selected.map((_,index)=>index).filter(index=>index>=primaryCount && !['foot_supported_calf','foot_clock_reach'].includes(selected[index]!));
     // Alternate which lower-priority supporting role yields across two sessions.
     const replace = sessionIndex % 2 ? optional[0] : optional[optional.length-1];
     if (replace !== undefined) selected[replace] = id;
   }
 }
 return [...new Set(selected)];
}
export function profileExerciseDose(exercise: PlannedExercise, input: StrengthEngineInput): PlannedExercise {
 const low = input.injuryRisk || !Number.isFinite(input.recoveryScore) || input.recoveryScore > 100 || !Number.isFinite(input.fatigueScore) || input.fatigueScore < 0 || !Number.isFinite(input.acwr) || input.acwr < 0 || input.acwr > 1.4 || input.soreness !== null && !Number.isFinite(input.soreness) || input.recoveryScore < 55 || input.fatigueScore > 70 || (input.soreness ?? 0) >= 7
   || ['deload', 'taper', 'recovery', 'transition'].includes(input.trainingPhase) || input.goalIntent?.season === 'in_season';
 if (exercise.exerciseId === 'foot_clock_reach' || exercise.exerciseId === 'foot_clock_supported') return { ...exercise,
  sets: low || input.availableTimeMin <= 35 ? 1 : 2, repRange: [3, 3], repScheme: { kind: 'reps', repsMin: 3, repsMax: 3, perSide: true, label: '3 controlled directions per side' },
  rpe: 4, rir: 6, restSeconds: 30, loadTarget: 'Bodyweight · reach only as far as control allows, heel grounded; use hand support or shorter reaches as needed',
  progressionRule: 'Reach a little farther only with stable control and a comfortable next-day response; balance does not replace loaded calf strength.',
  regressionRule: 'Use hand support, reduce reach distance or use fewer directions.' };
 if (exercise.exerciseId === 'foot_supported_calf') return { ...exercise, sets: low ? 1 : Math.min(2, exercise.sets), repRange: [8,12],
  repScheme: { kind: 'reps', repsMin: 8, repsMax: 12 }, rpe: low ? 5 : Math.min(7, exercise.rpe), rir: low ? 5 : 10-Math.min(7,exercise.rpe), restSeconds: 60,
  loadTarget: 'Controlled supported calf loading at the intended effort. Use hand support; choose a loaded variation separately when bilateral bodyweight is too easy.' };
 if (exercise.exercise.pattern === 'carry') return { ...exercise, sets: low ? 1 : 2, repRange: [20, 30],
  repScheme: { kind: 'duration', secondsMin: 20, secondsMax: 30 }, rpe: low ? 5 : 6, rir: low ? 5 : 4,
  loadTarget: 'Manageable loaded carry · stop before grip, posture or walking control fails', restSeconds: 60 };
 if (exercise.exerciseId === 'ski_wall_hold') return { ...exercise, sets: low ? 1 : 2, repRange: [20, 30],
  repScheme: { kind: 'duration', secondsMin: 20, secondsMax: 30 }, rpe: low ? 5 : 6, rir: low ? 5 : 4,
  loadTarget: 'Choose a comfortable squat depth for the prescribed hold and effort', restSeconds: 60 };
 return exercise;
}

export const PROFILE_PREPARATION: Partial<Record<GoalProfileId, { warmup: string; cooldown: string }>> = {
 hiking: { warmup: 'Easy walking, ankle rocks, comfortable lunges with rotation and a low-step rehearsal. Use support and reduce range as needed.', cooldown: 'Finish with easy walking. Optional gentle calf and hip-flexor stretches; descent fatigue counts toward recovery.' },
 downhill_skiing: { warmup: 'Easy movement, ankle rocks, comfortable 90/90 hip switches and shallow lateral-lunge rehearsal. Follow with lighter split-squat sets.', cooldown: 'Finish easily. Optional comfortable calf, glute and quadriceps stretches; reduce the next leg dose after demanding skiing.' },
 snowboarding: { warmup: 'Easy movement, ankle rocks, comfortable hip switches and gentle trunk rotations, followed by lighter squat rehearsal.', cooldown: 'Finish easily. Optional gentle calf/glute mobility and relaxed breathing. Do not force a board stance or rotational range.' },
 cross_country_skiing: { warmup: 'Easy whole-body movement, ankle rocks, comfortable lunges with rotation and shoulder wall slides. Rehearse the poling pull with light tension.', cooldown: 'Finish with easy whole-body movement. Optional comfortable hip-flexor/calf range and gentle thoracic rotations.' },
 mountaineering: { warmup: 'Easy uphill walking or familiar easy ski movement, ankle rocks, comfortable lunges and shoulder wall slides. Rehearse step-up and carrying setup with lighter loads.', cooldown: 'Finish with easy movement. Optional gentle bent-knee calf and hip-flexor stretches. Include descent fatigue and equipment carrying in the later recovery check.' },
};

/** Keep a small fresh balance primer and direct calf loading in a short relevant
 * session by replacing accessories and trimming dose, never by hiding extra time.
 * Exact rounds are an app coaching choice; they are not a validated threshold. */
export function fitProfileStrengthSession(exercises: PlannedExercise[], input: StrengthEngineInput, minutes: number): PlannedExercise[] {
 const primary = input.goalIntent?.priorities[0];
 if (!primary || !FOOT_BALANCE_PROFILES.includes(primary)) return fitStrengthSessionToTime(exercises, minutes);
 const balance = exercises.find(exercise => exercise.exerciseId === 'foot_clock_reach' || exercise.exerciseId === 'foot_clock_supported');
 const calf = exercises.find(exercise => exercise.exercise.pattern === 'calf_ankle');
 if (!balance || !calf) return fitStrengthSessionToTime(exercises, minutes);
 const others = exercises.filter(exercise => exercise !== balance && exercise !== calf).map(exercise=>({...exercise}));
 const mainCount = Math.min(others.length, SPORT_WORK[primary]?.length ?? 4);
 const mains = others.slice(0,mainCount), optional = others.slice(mainCount);
 const primer = {...balance}, calfWork={...calf};
 const list = () => [primer,...mains,...optional,calfWork];
 while(optional.length && estimateStrengthSessionMinutes(list())>minutes) optional.pop();
 while(calfWork.sets>1 && estimateStrengthSessionMinutes(list())>minutes) calfWork.sets--;
 for(let index=mains.length-1;index>=0 && estimateStrengthSessionMinutes(list())>minutes;index--)
   while(mains[index]!.sets>1 && estimateStrengthSessionMinutes(list())>minutes)mains[index]!.sets--;
 if(estimateStrengthSessionMinutes(list())<=minutes)return list();
 // Very short windows cannot promise every role; protect the existing main-work priority.
 return fitStrengthSessionToTime([...mains,primer,calfWork],minutes);
}

/** Balance rounds are not loaded strength working sets. Historical plans retain their old tally. */
export function plannedStrengthWorkingSets(sessions: readonly Pick<StrengthSession,'exercises'>[], intent?: GoalIntent): number {
 return sessions.reduce((sum,session)=>sum+session.exercises.reduce((total,exercise)=>total+
  (intent && ['foot_clock_reach','foot_clock_supported'].includes(exercise.exerciseId)?0:exercise.sets),0),0);
}
