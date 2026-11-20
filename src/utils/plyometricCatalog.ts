import type { Exercise } from '../types/strength';

export type PlyometricTier = 'easy' | 'medium' | 'hard';
export type PlyometricTask = {
  exercise: Exercise;
  tier: PlyometricTier;
  role: 'ankle_reactive' | 'bilateral_forward' | 'vertical_reactive' | 'running_skip' | 'unilateral_forward' | 'unilateral_ankle' | 'bilateral_lateral' | 'unilateral_lateral';
  initialReps: number;
  maxReps: number;
  purpose: string;
  count: string;
};
const surface = 'Use a clear, level, non-slip surface and suitable footwear. Complete a dynamic warm-up first.';
const stop = 'Stop if contacts become painful or uncontrolled. Skip impact work if you do not want it today.';
function task(id:string,name:string,tier:PlyometricTier,role:PlyometricTask['role'],unilateral:boolean,purpose:string,cues:string[]):PlyometricTask {
  return { tier,role,initialReps:tier==='easy'?5:tier==='medium'?3:2,maxReps:tier==='easy'?8:tier==='medium'?5:4,
    purpose,count:unilateral?'Reps are per leg; complete both sides. Count each foot landing once.':'Reps are bilateral jump-landings; each landing contributes one contact per foot.',
    exercise:{id,name,pattern:'plyometric',equipment:['bodyweight'],unilateral,cnsLoad:tier==='hard'?'high':'medium',
      coachingCues:[surface,...cues,stop],contraindications:['current_lower_limb_pain','achilles_tendinopathy_reactive','ankle_sprain_acute'],
      rationale:`${purpose} Demand depends on amplitude, speed, direction, support and the person; the tier is a planning guide, not medical clearance or a guarantee of faster running.`} };
}

/** Familiar running-support tasks at graded demands. These relative tiers and
 * conservative doses are coaching choices informed by NSCA/ACSM principles,
 * not a validated universal intensity scale or rehabilitation protocol. */
export const PLYOMETRIC_CATALOG: readonly PlyometricTask[] = [
  task('plyo_low_pogo','Low Pogo Hops','easy','ankle_reactive',false,
    'Small bilateral ankle-reactive practice for repeated running contacts.', ['Keep both-foot hops small and quiet.','Reset fully between sets; do not chase jump height.']),
  task('plyo_line_hops','Low Forward-Back Line Hops','easy','ankle_reactive',false,
    'Small bilateral contacts with a short forward-back change of position.', ['Use an imaginary line; keep both feet together.','Cross only a small distance and keep contacts controlled.']),
  task('plyo_lateral_line_hops','Low Lateral Line Hops','easy','ankle_reactive',false,
    'Small bilateral lateral contacts supporting control across changing running terrain.', ['Use an imaginary line and a small side-to-side distance.','Keep the knees and trunk controlled; stop before the hops become rushed.']),
  task('plyo_quick_pogo','Quick Pogo Hops','medium','ankle_reactive',false,
    'Quicker bilateral ankle-reactive contacts after small quiet hops are tolerated.', ['Retain a small hop height and the same in-place direction.','Increase only the controlled contact rhythm; do not chase maximal speed.']),
  task('plyo_lateral_hops','Bilateral Lateral Hops','medium','bilateral_lateral',false,
    'Repeatable bilateral lateral propulsion and contact control for changing terrain.', ['Keep both feet together and use a short lateral distance.','Maintain the same controlled height; do not add speed and distance together.']),
  task('plyo_forward_hops','Bilateral Forward Hops','medium','bilateral_forward',false,
    'Repeatable low-amplitude forward propulsion and landing for running support.', ['Hop forward on both feet over a small distance.','Use controlled repeated contacts, not maximal broad jumps.']),
  task('plyo_squat_jumps','Low Repeated Squat Jumps','medium','vertical_reactive',false,
    'Controlled repeated vertical propulsion using the ankle, knee and hip together.', ['Use a shallow comfortable countermovement and low jump height.','Land quietly and rebound only while control is maintained; rest between sets.']),
  task('plyo_power_skips','Power Skips','medium','running_skip',true,
    'Alternating single-leg propulsion and rhythm that supports running coordination.', ['Use small, controlled skips, not maximum-height bounds.','Count the prescribed reps on each leg; coordination can make this harder for some people.']),
  task('plyo_single_forward','Small Single-Leg Forward Hops','hard','unilateral_forward',true,
    'Single-leg forward propulsion and repeated contact control for running.', ['Keep each forward hop short and low on one leg.','Complete one side, rest, then the other; reduce the distance before adding contacts.']),
  task('plyo_single_pogo','Single-Leg Pogo Hops','hard','unilateral_ankle',true,
    'Unilateral ankle-reactive practice for repeated running contacts.', ['Use very small hops in place on one leg.','Keep the same controlled contact quality on both sides; no added external load.']),
  task('plyo_single_lateral','Small Single-Leg Lateral Hops','hard','unilateral_lateral',true,
    'Single-leg lateral contact control supporting direction changes on varied terrain.', ['Keep the lateral distance short and hop height low.','Complete one side, rest, then the other; retain a controlled knee and trunk.']),
  task('plyo_alternating_bounds','Alternating Bounds','hard','unilateral_forward',true,
    'Controlled alternating forward propulsion with a running-specific direction.', ['Use short submaximal bounds, not maximum distance or speed.','Count the prescribed contacts per leg; stop when landing control changes.']),
];
export const INTRO_PLYOMETRIC = PLYOMETRIC_CATALOG[0]!.exercise;
export function plyometricTask(id:string):PlyometricTask|undefined {return PLYOMETRIC_CATALOG.find(task=>task.exercise.id===id);}
export function plyometricFootContacts(task:PlyometricTask,sets:number,reps:number):number {
  // Bilateral: two foot contacts per landing. Unilateral: reps per leg, two
  // legs, one foot per landing. Both conventions total sets × reps × 2.
  return sets*reps*2;
}


/** Retain the practiced direction/role when raising unilateral or reactive
 * demand. A vertical-jump route stays at its own dose instead of silently
 * becoming forward bounds just because both are labelled power. */
export function nextPlyometricTask(task:PlyometricTask):PlyometricTask|undefined {
 const next:Record<string,string>={plyo_low_pogo:'plyo_quick_pogo',plyo_line_hops:'plyo_forward_hops',plyo_lateral_line_hops:'plyo_lateral_hops',
  plyo_quick_pogo:'plyo_single_pogo',plyo_forward_hops:'plyo_single_forward',plyo_lateral_hops:'plyo_single_lateral',plyo_power_skips:'plyo_alternating_bounds'};
 return plyometricTask(next[task.exercise.id]??'');
}
export function easierPlyometricTask(task:PlyometricTask):PlyometricTask {
 const previous:Record<string,string>={plyo_single_pogo:'plyo_quick_pogo',plyo_single_forward:'plyo_forward_hops',plyo_single_lateral:'plyo_lateral_hops',
  plyo_alternating_bounds:'plyo_power_skips',plyo_quick_pogo:'plyo_low_pogo',plyo_forward_hops:'plyo_line_hops',plyo_lateral_hops:'plyo_lateral_line_hops'};
 return plyometricTask(previous[task.exercise.id]??'')??task;
}

/** A new compatible task starts from its own small target and cannot make
 * today's remaining contact count larger merely because the exercise changed. */
export function calibratePlyometricReplacement(task:PlyometricTask, remainingReps:readonly (number|undefined)[], reduce=false) {
 const known=remainingReps.filter((value):value is number=>typeof value==='number' && Number.isFinite(value) && value>0);
 const ceiling=known.length ? Math.min(...known) : task.initialReps;
 const reps=Math.max(1,Math.min(task.initialReps,reduce?Math.floor(ceiling*0.85):ceiling));
 return {repScheme:{kind:'reps' as const,repsMin:reps,repsMax:reps,perSide:task.exercise.unilateral},reps:`${reps}${task.exercise.unilateral?' per leg':''}`};
}
