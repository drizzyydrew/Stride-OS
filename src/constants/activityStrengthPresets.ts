import type { GoalProfileId } from '../types/goalIntent';
import type { PresetStrengthExercise, PresetStrengthWorkout, StrengthEquipment, StrengthPresetCategory } from './strengthBank';
import { parsePrescriptionScheme } from '../utils/prescriptionFormat';

const exercise = (name: string, sets: number, reps: string, equipment: StrengthEquipment[], targetRpe: number | undefined, restSeconds: number, notes: string): PresetStrengthExercise =>
  ({ name, sets, reps, repScheme: parsePrescriptionScheme(reps, { exerciseName: name, notes }), equipment, targetRpe, restSeconds, notes });
const clock = () => exercise('Supported Single-Leg Clock Reach', 2, '3 per side', ['bodyweight', 'support'], 4, 30,
  'Each round is 1 reach in each of 3 directions per side: 6 reaches per side across both rounds. Reach far with control, tap lightly and return without pushing off. Balance practice is separate from loaded strength volume.');
const note = 'Use this instead of the matching accessories in your plan, not as extra work on top. The plan remains responsible for the combined weekly dose. Start the replacement exercise with its own load calibration. Progress one variable only after controlled performance and an acceptable later/next-day response.';
const workout = (id: string, title: string, description: string, durationMin: number, categories: StrengthPresetCategory[], exercises: PresetStrengthExercise[], trainingPurpose: PresetStrengthWorkout['trainingPurpose'] = 'strength'): PresetStrengthWorkout =>
  ({ id, title, description, durationMin, categories, exercises, equipment: [...new Set(exercises.flatMap(entry => entry.equipment))], trainingPurpose, goalProfiles: categories.includes('foot_ankle') ? ['running','aerobic_base','get_faster','race_prep','run_farther','hiking','downhill_skiing','snowboarding','cross_country_skiing','mountaineering'] : categories.filter(value=>['hiking','downhill_skiing','snowboarding','cross_country_skiing','mountaineering'].includes(value)) as GoalProfileId[], planningNote: note });

/** Optional modules: do not automatically schedule all three foot sessions. */
export const ACTIVITY_STRENGTH_PRESETS: PresetStrengthWorkout[] = [
  workout('sw_foot_foundation', 'Foot Control & Balance', 'A simple introduction to foot pressure, dynamic single-leg balance and supported calf loading.', 12,
    ['foot_ankle', 'bodyweight', 'runner_strength'], [
      exercise('Seated Toe Press', 2, '6 x 5s hold', ['bodyweight', 'bench'], 4, 30, 'Press the toe pads down as if leaving soft footprints; keep toes long. Short-Foot Arch Practice is optional if its small tent cue is clear. These are related, different tasks.'),
      clock(),
      exercise('Supported Standing Calf Raise', 2, '8-12', ['bodyweight', 'support'], 5, 60, 'Use firm support and a controlled range. If bodyweight is too easy for the intended effort, choose a loaded calf variation.'),
    ], 'running_support'),
  workout('sw_foot_calf_strength', 'Foot & Calf Strength', 'Meaningful straight- and bent-knee calf loading with a small balance preparation dose.', 23,
    ['foot_ankle', 'dumbbell', 'lower_body', 'runner_strength'], [
      clock(),
      exercise('Loaded Supported Single-Leg Calf Raise', 3, '6-8 per side', ['dumbbell', 'support'], 8, 90, 'Hand support allows calf strength to receive the load. Reduce to 2 sets or a supported bilateral version if this is new or recovery is limited.'),
      exercise('Loaded Seated Calf Raise', 2, '8-12', ['dumbbell', 'bench'], 7, 90, 'Secure padded loads on the thighs above the knees. Choose meaningful resistance for the target effort; light unloaded repetitions are a warm-up or lower-capacity option. A loaded supported bent-knee raise is an alternative.'),
    ], 'strength'),
  workout('sw_foot_reactive', 'Reactive Feet & Ankles', 'A low-volume practiced landing session after a warm-up and before fatigue.', 15,
    ['foot_ankle', 'bodyweight', 'runner_strength'], [
      exercise('Low Pogo Hops', 3, '5', ['bodyweight'], 5, 90, 'Small two-foot contacts on a clear level surface. Stop when rhythm, control or tolerance changes. For a first exposure use only 2 sets of 5 pogos and omit the line hops; this replaces the full dose.'),
      exercise('Low Forward-Back Line Hops', 2, '5', ['bodyweight'], 5, 90, '5 individual two-foot landings per set, not 5 out-and-back pairs. The full session totals 25 two-foot landing events (50 individual foot contacts). Replace existing plyometrics; do not stack extra hops or make this a fatigue circuit.'),
    ], 'power'),
  workout('sw_hiking_ascent_descent', 'Hiking — Ascent & Descent Strength', 'Train leg force for climbing, controlled lowering for descending, and carrying support.', 35,
    ['hiking', 'lower_body', 'dumbbell'], [
      clock(),
      exercise('Loaded Hiking Step-Up', 3, '6-8 per side', ['dumbbell', 'step', 'support'], 7, 120, 'Use a low stable step. Progress load separately from height; avoid pushing off the floor foot.'),
      exercise('Controlled Step-Down', 2, '6-8 per side', ['bodyweight', 'step', 'support'], 6, 90, 'Control the lowering. Begin with less descent range and volume when unaccustomed.'),
      exercise('Dumbbell Hiking Carry', 2, '30s', ['dumbbell'], 6, 60, 'Walk on a clear level path. Build actual terrain and pack exposure separately within the same weekly budget.'),
    ]),
  workout('sw_downhill_ski_strength', 'Downhill Skiing — Leg Strength', 'Unilateral leg loading, lateral movement and an optional local endurance task.', 35,
    ['downhill_skiing', 'lower_body', 'dumbbell'], [
      clock(),
      exercise('Supported Ski Split Squat', 3, '5-6 per side', ['dumbbell', 'support'], 8, 150, 'For practiced lifters. Rehearse and calibrate separately; a beginner can use 2 sets of 8-12 at RPE 6 in a supported setup.'),
      exercise('Supported Lateral Lunge', 2, '8 per side', ['bodyweight', 'support'], 6, 90, 'Start shallow; add load only when the bodyweight task is controlled and too easy.'),
      exercise('Ski Wall Sit', 2, '20-30s', ['bodyweight', 'wall'], 6, 60, 'Use a comfortable angle and keep breathing. This is optional local isometric work, not a substitute for dynamic strength or skiing.'),
    ]),
  workout('sw_snowboard_strength', 'Snowboarding — Legs & Trunk', 'A repeatable leg-strength base with lateral loading, balance and anti-rotation support.', 35,
    ['snowboarding', 'lower_body', 'dumbbell'], [
      clock(),
      exercise('Snowboard Offset Squat', 3, '6-8', ['dumbbell'], 7, 120, 'Change the loaded side between sets. Use a comfortable stance; do not force board stance in the gym.'),
      exercise('Supported Lateral Step-Up', 2, '8 per side', ['bodyweight', 'step', 'support'], 6, 90, 'Use support and a low step. Add load separately if the strength dose is too easy.'),
      exercise('Snowboard Pallof Press', 2, '8 per side', ['band', 'secure_anchor'], 6, 60, 'Use a rated anchor, press out and resist rotation. Actual riding remains the specific technique practice.'),
    ]),
  workout('sw_cross_country_ski_strength', 'Cross-Country Skiing — Legs & Poling', 'Combine unilateral leg strength with upper-body pulling and trunk support.', 35,
    ['cross_country_skiing', 'full_body', 'dumbbell'], [
      clock(),
      exercise('Cross-Country Step-Up', 3, '6-8 per side', ['dumbbell', 'step', 'support'], 7, 120, 'Use controlled strength repetitions. Classic/skate technique and aerobic skiing are separate parts of the plan.'),
      exercise('Band Straight-Arm Poling Pull', 3, '8-12', ['band', 'secure_anchor'], 7, 90, 'Secure an overhead rated anchor. Keep soft elbows and pull toward the hips without throwing the trunk.'),
      exercise('Side Plank', 2, '20-30s per side', ['bodyweight'], 6, 60, 'Choose a bent-knee or longer-lever version you can control.'),
    ]),
  workout('sw_mountaineering_strength', 'Mountaineering — Ascent & Carrying', 'Support sustained uphill work with unilateral strength, controlled descent and carrying capacity.', 35,
    ['mountaineering', 'full_body', 'dumbbell'], [
      clock(),
      exercise('Mountaineering Step-Up', 3, '6-8 per side', ['dumbbell', 'step', 'support'], 7, 120, 'Strength support for ascent. Sustained uphill aerobic work is progressed separately, not replaced by a gym circuit.'),
      exercise('Controlled Step-Down', 2, '6 per side', ['bodyweight', 'step', 'support'], 6, 90, 'Start with a small lowering range and dose, particularly when descent work is new.'),
      exercise('Mountaineering Dumbbell Carry', 2, '30-45s', ['dumbbell'], 6, 60, 'Keep a repeatable walk. Progress actual pack and equipment exposure gradually as a separate sport task.'),
    ]),
];
