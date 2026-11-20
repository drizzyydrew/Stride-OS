import { PLYOMETRIC_CATALOG, plyometricTask } from './plyometricCatalog';
import type { RepScheme } from '../types/strength';

export type ExerciseAdjustmentReason = 'too_easy' | 'too_hard' | 'dislike' | 'equipment';
export type ExerciseStimulus = 'strength' | 'power' | 'mobility' | 'capacity' | 'aerobic' | 'assessment';
export type AdaptationExercise = { id: string; name: string; equipment?: readonly string[]; repScheme?: RepScheme; stimulus?: ExerciseStimulus };
export type ExerciseStimulusProfile = { family: string; muscles: readonly string[]; stimulus: ExerciseStimulus; target: string };

// Roles deliberately distinguish tasks that share muscles but do not share a
// useful training purpose (row/pull-apart, hip hinge/knee flexion, jump/squat,
// straight/bent-knee ankle work, and the different trunk functions).
const FAMILIES: Array<[RegExp, string, string[], ExerciseStimulus, string]> = [
  [/running gait|walking gait|single.leg control|capacity drill/, 'assessment', [], 'assessment', 'a repeatable assessment'],
  [/running strides/, 'running_strides', ['calves', 'glutes'], 'power', 'relaxed faster running with full recovery'],
  [/single.leg pogo/, 'unilateral_ankle_power', ['calves'], 'power', 'controlled unilateral ankle-reactive contacts'],
  [/single.leg lateral hops/, 'unilateral_lateral_power', ['glutes', 'calves'], 'power', 'controlled unilateral lateral contacts'],
  [/bilateral lateral hops/, 'bilateral_lateral_power', ['glutes', 'calves'], 'power', 'controlled bilateral lateral contacts'],
  [/bilateral forward hops/, 'bilateral_horizontal_power', ['glutes', 'calves'], 'power', 'controlled bilateral forward propulsion'],
  [/power skips/, 'running_skip_power', ['glutes', 'calves'], 'power', 'alternating running coordination and propulsion'],
  [/line hops/, 'ankle_power', ['calves'], 'power', 'small repeatable ankle-reactive contacts'],
  [/pogo/, 'ankle_power', ['calves'], 'power', 'quick, repeatable ankle contacts'],
  [/bound|single.leg(?: forward)? hops?/, 'horizontal_power', ['glutes', 'calves'], 'power', 'controlled single-leg propulsion and landing'],
  [/box jump|depth jump|jump squat|repeated squat jumps/, 'vertical_power', ['quads', 'glutes', 'calves'], 'power', 'quality vertical force and landing'],
  [/kettlebell swing/, 'hip_power', ['glutes', 'hamstrings'], 'power', 'fast hip extension'],
  [/push press/, 'overhead_power', ['delts', 'triceps'], 'power', 'fast overhead pressing'],
  [/thruster/, 'whole_body_power', ['quads', 'glutes', 'delts'], 'power', 'coordinated lower-body and overhead work'],
  [/squat pry|lunge with rotation/, 'multi_joint_mobility', ['hips', 'legs'], 'mobility', 'comfortable dynamic hip and leg range'],
  [/nordic|leg curl/, 'knee_flexion', ['hamstrings'], 'strength', 'loaded knee flexion'],
  [/tibialis/, 'ankle_dorsiflexion', ['tibialis anterior'], 'strength', 'ankle dorsiflexor loading'],
  [/isometric calf/, 'ankle_isometric', ['calves'], 'capacity', 'repeatable calf isometric loading'],
  [/seated calf|bent.knee calf|soleus raise/, 'ankle_bent_knee', ['soleus'], 'strength', 'bent-knee plantarflexor loading'],
  [/calf raise|heel raise/, 'ankle_straight_knee', ['gastrocnemius', 'soleus'], 'strength', 'straight-knee plantarflexor loading'],
  [/isometric leg extension|reverse knee extension/, 'knee_extension_isometric', ['quads'], 'capacity', 'controlled knee-extension loading'],
  [/hip thrust|glute bridge/, 'hip_extension', ['glutes'], 'strength', 'hip extension with a supported trunk'],
  [/deadlift|\brdl\b|back extension/, 'hip_hinge', ['glutes', 'hamstrings'], 'strength', 'loaded hip hinging'],
  [/step.up|step.down|split squat|lunge|single.leg squat/, 'single_leg', ['quads', 'glutes'], 'strength', 'single-leg knee and hip strength'],
  [/squat/, 'squat', ['quads', 'glutes'], 'strength', 'knee-dominant lower-body strength'],
  [/pallof/, 'trunk_rotation', ['obliques'], 'capacity', 'resisting trunk rotation'],
  [/copenhagen/, 'adductor_trunk', ['adductors', 'obliques'], 'capacity', 'adductor and lateral trunk loading'],
  [/side plank/, 'trunk_lateral', ['obliques'], 'capacity', 'resisting lateral trunk movement'],
  [/dead bug|bird dog|\bplank\b/, 'trunk_extension', ['abdominals'], 'capacity', 'controlling trunk extension'],
  [/suitcase carry/, 'carry_lateral', ['obliques', 'grip'], 'capacity', 'loaded carrying with lateral trunk control'],
  [/farmer/, 'carry_bilateral', ['grip', 'traps'], 'capacity', 'bilateral loaded carrying'],
  [/clamshell|hip abduction|lateral walk/, 'hip_abduction', ['glute med'], 'strength', 'hip abductor loading'],
  [/pull.apart|face pull|reverse fly/, 'rear_shoulder', ['rear delts', 'rhomboids'], 'strength', 'rear-shoulder and scapular work'],
  [/pull.up|pulldown/, 'vertical_pull', ['lats', 'biceps'], 'strength', 'vertical pulling strength'],
  [/\brow\b/, 'horizontal_pull', ['lats', 'rhomboids'], 'strength', 'horizontal pulling strength'],
  [/shrug/, 'shoulder_elevation', ['traps'], 'strength', 'loaded shoulder elevation'],
  [/lateral raise/, 'shoulder_abduction', ['delts'], 'strength', 'shoulder abduction strength'],
  [/curl/, 'elbow_flexion', ['biceps'], 'strength', 'elbow flexion strength'],
  [/overhead press|shoulder press|single.arm press|\bdb press\b|single.arm db press|pike push.up/, 'vertical_push', ['delts', 'triceps'], 'strength', 'vertical pressing strength'],
  [/bench press|floor press|chest press|push.up|bodyweight dip/, 'horizontal_push', ['pecs', 'triceps'], 'strength', 'horizontal pressing strength'],
  [/knee.to.wall|ankle (mobility|rocks|alphabet)/, 'ankle_mobility', ['calves', 'ankle'], 'mobility', 'comfortable ankle range'],
  [/soleus stretch|bent.knee.*stretch/, 'soleus_mobility', ['soleus'], 'mobility', 'comfortable bent-knee calf range'],
  [/calf stretch/, 'calf_mobility', ['gastrocnemius', 'soleus'], 'mobility', 'comfortable calf range'],
  [/hip flexor|couch stretch/, 'hip_extension_mobility', ['hip flexors'], 'mobility', 'comfortable hip extension range'],
  [/90.90|90 90|figure.four|hip cars|hip circles/, 'hip_rotation_mobility', ['hip rotators'], 'mobility', 'comfortable hip rotation range'],
  [/hamstring floss/, 'hamstring_mobility', ['hamstrings'], 'mobility', 'comfortable hamstring movement'],
  [/quad stretch/, 'quad_mobility', ['quads'], 'mobility', 'comfortable quadriceps range'],
  [/it band stretch/, 'lateral_hip_mobility', ['lateral hip'], 'mobility', 'comfortable lateral hip range'],
  [/thoracic open|shoulder wall/, 'thoracic_mobility', ['thoracic spine', 'shoulders'], 'mobility', 'comfortable upper-back and shoulder movement'],
  [/cat.cow|spinal twist/, 'spinal_mobility', ['spinal muscles'], 'mobility', 'comfortable spinal movement'],
  [/adductor rock/, 'adductor_mobility', ['adductors'], 'mobility', 'comfortable adductor range'],
  [/leg swings|greatest stretch|squat pry|lunge with rotation/, 'multi_joint_mobility', ['hips', 'legs'], 'mobility', 'comfortable dynamic hip and leg range'],
  [/breathing|child.s pose/, 'breathing', ['breathing muscles'], 'mobility', 'comfortable breathing and relaxation'],
  [/foam roll/, 'soft_tissue', ['selected area'], 'mobility', 'comfortable self-massage'],
  [/brisk walk/, 'walk_aerobic', ['legs'], 'aerobic', 'comfortable walking endurance'],
  [/easy jog/, 'run_aerobic', ['legs'], 'aerobic', 'comfortable running endurance'],
];

export function classifyExerciseStimulus(exercise: Pick<AdaptationExercise, 'name' | 'repScheme' | 'stimulus'>): ExerciseStimulusProfile | null {
  if (typeof exercise?.name !== 'string') return null;
  const name = exercise.name.toLowerCase().replace(/[–—_-]+/g, ' ');
  const found = FAMILIES.find(([pattern]) => pattern.test(name));
  if (!found) return null;
  const scheme = exercise.repScheme;
  const fatigueDose = scheme?.kind === 'duration' || scheme?.kind === 'distance'
    || (scheme && 'repsMax' in scheme && (scheme.repsMax ?? 0) >= 12);
  const stimulus = exercise.stimulus ?? (found[3] === 'power' && fatigueDose ? 'capacity' : found[3]);
  return { family: found[1], muscles: found[2], stimulus,
    target: stimulus !== found[3] ? `${found[4]} with the prescribed ${stimulus} emphasis` : found[4] };
}

// All requirements must be available. Bodyweight never implies a bench, rack,
// secure band anchor or pull-up bar. The athlete confirms unrecorded setup.
export function supportsExerciseEquipment(required: readonly string[], available: readonly string[]): boolean {
  if (!Array.isArray(required) || !Array.isArray(available) || required.some(item => typeof item !== 'string') || available.some(item => typeof item !== 'string')) return false;
  const owned = new Set(['bodyweight', ...available.map(item => item === 'resistance_band' ? 'band' : item)]);
  return required.every(item => owned.has(item === 'resistance_band' ? 'band' : item));
}

export function compatibleExerciseOptions<T extends AdaptationExercise>(
  source: AdaptationExercise,
  candidates: readonly T[],
  options: { availableEquipment?: readonly string[]; adaptation?: ExerciseStimulus } = {},
): T[] {
  const profile = classifyExerciseStimulus(source);
  if (!profile || profile.stimulus === 'assessment') return [];
  return candidates.filter(candidate => {
    if (candidate.id === source.id || candidate.name.toLowerCase() === source.name.toLowerCase()) return false;
    const other = classifyExerciseStimulus(candidate);
    return other?.family === profile.family && other.stimulus === profile.stimulus
      && (!options.adaptation || other.stimulus === options.adaptation)
      && (!options.availableEquipment || supportsExerciseEquipment(candidate.equipment ?? [], options.availableEquipment));
  });
}

const option = (name: string, equipment: string[], reps = '8–12', repScheme?: RepScheme): AdaptationExercise & { reps: string } =>
  ({ id: `adapt_${name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`, name, equipment, reps,
    repScheme: repScheme ?? { kind: 'reps', repsMin: 8, repsMax: 12 } });
const hold = (name: string, equipment: string[] = ['bodyweight']) => option(name, equipment, '20–30 sec', { kind: 'duration', secondsMin: 20, secondsMax: 30 });
export const EXERCISE_ADAPTATION_OPTIONS = [
  ...PLYOMETRIC_CATALOG.map(task=>({id:task.exercise.id,name:task.exercise.name,equipment:task.exercise.equipment,stimulus:'power' as const,reps:`${task.initialReps}${task.exercise.unilateral?' per leg':''}`,repScheme:{kind:'reps' as const,repsMin:task.initialReps,repsMax:task.maxReps,perSide:task.exercise.unilateral}})),
  option('Box Squat (Bodyweight)', ['bodyweight', 'bench']), option('Goblet Squat', ['dumbbell']), option('Front Squat', ['barbell', 'squat_rack']),
  option('Supported Reverse Lunge', ['bodyweight', 'support']), option('Step-Up', ['bodyweight', 'step']), option('Dumbbell Reverse Lunge', ['dumbbell']),
  option('Dumbbell Romanian Deadlift', ['dumbbell']), option('Kettlebell Deadlift', ['kettlebell']), option('Barbell Romanian Deadlift', ['barbell']),
  option('Glute Bridge', ['bodyweight']), option('Single-Leg Glute Bridge', ['bodyweight']), option('Dumbbell Hip Thrust', ['dumbbell', 'bench']),
  option('Assisted Nordic Hamstring Curl', ['bodyweight', 'secure_anchor']), option('Leg Curl', ['machine']),
  option('Double-Leg Calf Raise', ['bodyweight']), option('Single-Leg Calf Raise', ['bodyweight']), option('Dumbbell Calf Raise', ['dumbbell']),
  option('Bent-Knee Calf Raise', ['bodyweight']), option('Seated Calf Raise', ['dumbbell', 'bench']),
  option('Tibialis Anterior Raise', ['bodyweight', 'wall']), hold('Isometric Calf Hold'), hold('Isometric Leg Extension', ['machine']),
  option('Wall Push-Up', ['bodyweight', 'wall']), option('Knee Push-Up', ['bodyweight']), option('Push-Up', ['bodyweight']),
  option('Dumbbell Floor Press', ['dumbbell']), option('Dumbbell Bench Press', ['dumbbell', 'bench']), option('Band Chest Press', ['band', 'secure_anchor']),
  option('Dumbbell Shoulder Press', ['dumbbell']), option('Overhead Press', ['barbell']),
  option('Single-Arm DB Row', ['dumbbell', 'support']), option('Resistance-Band Row', ['band', 'secure_anchor']), option('Chest-Supported Dumbbell Row', ['dumbbell', 'bench']), option('Cable Row', ['cable']),
  option('Assisted Pull-Up', ['machine']), option('Lat Pulldown', ['machine']),
  option('Band Pull-Apart', ['band']), option('Dumbbell Reverse Fly', ['dumbbell']), option('Band Face Pull', ['band', 'secure_anchor']),
  option('Dumbbell Lateral Raise', ['dumbbell']), option('Band Lateral Raise', ['band']), option('Dumbbell Curl', ['dumbbell']), option('Band Curl', ['band']),
  option('Barbell Shrug', ['barbell']), option('Dumbbell Shrug', ['dumbbell']),
  hold('Plank'), option('Dead Bug', ['bodyweight']), option('Bird Dog', ['bodyweight']), hold('Side Plank'), hold('Knee Side Plank'),
  option('Pallof Press', ['band', 'secure_anchor']), option('Cable Pallof Press', ['cable']), hold('Supported Copenhagen Plank', ['bodyweight', 'bench']),
  hold('Dumbbell Suitcase Carry', ['dumbbell']), hold('Kettlebell Suitcase Carry', ['kettlebell']), hold('Dumbbell Farmers Carry', ['dumbbell']), hold('Kettlebell Farmer Carry', ['kettlebell']),
  option('Side-Lying Hip Abduction', ['bodyweight']), option('Band Clamshell', ['band']), option('Band Lateral Walk', ['band']),
  option('Low Jump Squat', ['bodyweight'], '3–5', { kind: 'reps', repsMin: 3, repsMax: 5 }),
  option('Low Box Jump', ['bodyweight', 'box'], '3–5', { kind: 'reps', repsMin: 3, repsMax: 5 }),
  option('Single-Leg Hop', ['bodyweight'], '3–5 per side', { kind: 'reps', repsMin: 3, repsMax: 5, perSide: true }),
  option('Plyometric Bound', ['bodyweight'], '3–5 per side', { kind: 'reps', repsMin: 3, repsMax: 5, perSide: true }),
  option('Low Pogo Hops', ['bodyweight'], '5–8', { kind: 'reps', repsMin: 5, repsMax: 8 }),
  option('Small Pogo Hops', ['bodyweight'], '5–8', { kind: 'reps', repsMin: 5, repsMax: 8 }),
  option('Pogo Hops', ['bodyweight'], '5–10', { kind: 'reps', repsMin: 5, repsMax: 10 }),
  option('Kettlebell Swing', ['kettlebell'], '5–8', { kind: 'reps', repsMin: 5, repsMax: 8 }),
  option('Push Press', ['barbell'], '3–5', { kind: 'reps', repsMin: 3, repsMax: 5 }),
  option('Thruster', ['dumbbell'], '3–5', { kind: 'reps', repsMin: 3, repsMax: 5 }),
  option('Ankle Rocks', ['bodyweight']), option('Knee-to-Wall', ['bodyweight', 'wall']),
  hold('Calf Stretch (Straight-Knee)', ['bodyweight', 'wall']), hold('Soleus Stretch (Bent-Knee)', ['bodyweight', 'wall']),
  hold('Hip Flexor Stretch'), hold('Couch Stretch', ['bodyweight', 'bench']), option('90/90 Hip Switches', ['bodyweight']), option('Controlled Hip CARs', ['bodyweight']),
  option('Hamstring Flossing', ['bodyweight']), hold('Standing Quad Stretch', ['bodyweight', 'support']), hold('Standing IT Band Stretch'),
  option('Thoracic Open Books', ['bodyweight']), option('Shoulder Wall Slides', ['bodyweight', 'wall']), option('Cat-Cow', ['bodyweight']), hold('Seated Spinal Twist'),
  option('Adductor Rockbacks', ['bodyweight']), option('Leg Swings', ['bodyweight', 'support']), option("World's Greatest Stretch", ['bodyweight']),
  hold('Diaphragmatic Breathing'), hold("Child's Pose Breathing"), hold('Foam Roll (General)', ['foam_roller']),
];

export function getExerciseAdjustment(input: {
  exercise: AdaptationExercise;
  reason: ExerciseAdjustmentReason;
  availableEquipment?: readonly string[];
  candidates?: readonly AdaptationExercise[];
}) {
  const profile = classifyExerciseStimulus(input.exercise);
  const guidance = input.reason === 'too_easy'
    ? profile?.stimulus === 'power' ? 'Keep repetitions crisp with full recovery. Add a small amount of resistance or a little complexity only while speed and landing control stay repeatable.'
      : profile?.stimulus === 'mobility' ? 'Explore a little more comfortable range or hold time. More discomfort is not a progression target.'
      : 'First reach the prescribed top of the rep or time range at the intended effort. Then consider one small resistance increase; keep the setup repeatable.'
    : input.reason === 'too_hard'
      ? profile?.stimulus === 'power' ? 'Reduce contacts or height and take more recovery. Stop the power set when speed or landing control falls; do not turn it into a fatigue circuit.'
        : profile?.stimulus === 'mobility' ? 'Use support, a smaller comfortable range or a shorter hold. Stop for sharp or increasing symptoms.'
        : 'Reduce resistance, repetitions or one remaining set. Use support or a comfortable range while preserving the training purpose.'
      : input.reason === 'equipment' ? 'Choose only a setup you can actually use. The same muscles alone do not make two exercises equivalent.'
        : 'Choose a repeatable movement you are willing to practise while keeping its training purpose.';
  const sourceTask=plyometricTask(input.exercise.id) ?? PLYOMETRIC_CATALOG.find(task=>input.exercise.name.toLowerCase().startsWith(task.exercise.name.toLowerCase()));
  const tierRank={easy:0,medium:1,hard:2};
  const choices=compatibleExerciseOptions<AdaptationExercise>(input.exercise,input.candidates ?? EXERCISE_ADAPTATION_OPTIONS,{availableEquipment:input.availableEquipment}).filter(candidate=>{
    const candidateTask=plyometricTask(candidate.id.split(':')[0]!) ?? PLYOMETRIC_CATALOG.find(task=>candidate.name.toLowerCase().startsWith(task.exercise.name.toLowerCase()));
    if(sourceTask) return !!candidateTask && tierRank[candidateTask.tier]<=tierRank[sourceTask.tier];
    return !candidateTask || candidateTask.tier==='easy';
  });
  return {
    profile,
    guidance: sourceTask && input.reason==='too_easy' ? 'Keep this bodyweight task controlled with full recovery. Repeat or make a small contact change only from actual performance and response; report landing control and next-day symptoms before requesting a harder future tier. Do not add external load or jump height automatically.' : profile?.stimulus === 'assessment' ? 'This is an assessment, not a loading exercise. Keep the test setup consistent; use the relevant training session for progressions.' : guidance,
    options: choices,
    calibration: 'A new exercise or setup starts with its own load and effort calibration. Earlier weights and recorded RPE are not transferred.',
    fallback: profile ? `Keep the purpose: ${profile.target}. If no listed option fits your setup, modify the dose or choose a custom movement and review the purpose.`
      : 'The purpose of this custom movement is not confirmed. Edit its dose or choose a custom alternative after checking the movement, muscles and intended adaptation.',
  };
}

/** Changes only today's unperformed targets. It never supplies measured RPE,
 * copies an unknown load, or changes the original captured prescription. */
export function remainingExerciseDoseEdits(exercise: { setEntries: readonly { id: string; completed: boolean; isWarmup?: boolean; reps?: number; holdSeconds?: number; distanceMeters?: number }[] }, reason: 'too_easy' | 'too_hard') {
  return exercise.setEntries.filter(set => !set.completed && !set.isWarmup).flatMap(set => {
    const patch: { reps?: number; holdSeconds?: number; distanceMeters?: number } = {};
    if (Number.isFinite(set.reps) && set.reps! > 0) patch.reps = reason === 'too_easy' ? set.reps! + 1 : Math.max(1, Math.floor(set.reps! * 0.85));
    else if (Number.isFinite(set.holdSeconds) && set.holdSeconds! > 0) patch.holdSeconds = reason === 'too_easy' ? Math.round((set.holdSeconds! + Math.min(5, Math.max(1, set.holdSeconds! * 0.05))) * 100) / 100
      : Math.min(set.holdSeconds!, Math.max(0.01, Math.round(set.holdSeconds! * 0.8 * 100) / 100));
    else if (Number.isFinite(set.distanceMeters) && set.distanceMeters! > 0) patch.distanceMeters = reason === 'too_easy' ? Math.round(set.distanceMeters! * 1.05 * 100) / 100
      : Math.min(set.distanceMeters!, Math.max(0.01, Math.round(set.distanceMeters! * 0.85 * 100) / 100));
    return Object.keys(patch).length ? [{ id: set.id, patch }] : [];
  });
}
