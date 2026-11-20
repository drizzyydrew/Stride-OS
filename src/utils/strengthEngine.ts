// ─── Strength Engine ───────────────────────────────────────────────────────────
//
// Deterministic strength session generator for endurance athletes. All exercise
// selection, volume, and intensity are driven by running phase, weekly mileage,
// fatigue, and readiness signals.
//
// Science basis:
//   Rønnestad & Mujika (2014) — concurrent training optimisation for runners
//   Beattie et al. (2017) — strength training and running economy
//   Paavolainen et al. (1999) — neuromuscular training and 5k performance
//   Mikkola et al. (2011) — concurrent training timing and interference
//   Blagrove et al. (2018) — heavy resistance training and endurance performance
//
// AI REPLACEMENT HOOK: generateStrengthWeek() is the designated boundary.
// A Claude call can receive StrengthEngineInput and return an identical
// StrengthWeek — adding periodised loading, 1RM-based targets, and personalised
// cues — without any changes to downstream stores or UI components.

import type {
  Exercise, PlannedExercise, StrengthSession, StrengthWeek,
  StrengthGoal, StrengthSessionType, MovementPattern, StrengthEngineInput,
  StrengthProgressionState, RepScheme,
} from '../types/strength';
import type { TrainingPhase, ProgressionLevel } from '../types/training';
import { parsePrescriptionScheme } from './prescriptionFormat';
import { applyGoalPlyometrics, PLYOMETRIC_CATALOG } from './goalPlyometrics';
import { estimateStrengthSessionMinutes, fitStrengthSessionToTime, strengthExerciseReviewNote, strengthExerciseEquipment, strengthExercisesForEquipment, strengthProgressionLevel, strengthTimeBudget } from './strengthDesign';
import { trainingGoalBlend } from './trainingGoals';
import { applyGoalStrengthProgramming } from './goalStrengthProgramming';
import { getGoalMesocycle } from './plan/goalMesocycle';

// ─── Exercise library ─────────────────────────────────────────────────────────
//
// IDs are prefixed with their movement pattern so strengthHistory.ts can derive
// pattern from ID without needing the full Exercise object.

export const STRENGTH_EXERCISES: Record<string, Exercise> = {

  // ── Squat ──────────────────────────────────────────────────────────────────
  squat_goblet: {
    id: 'squat_goblet', name: 'Goblet Squat', pattern: 'squat',
    equipment: ['dumbbell', 'kettlebell'], unilateral: false, cnsLoad: 'medium',
    coachingCues: ['Chest tall, elbows inside knees', 'Drive knees out over toes', 'Use a repeatable depth you can control comfortably'],
    contraindications: ['severe_knee_pain'],
    rationale: 'Knee-dominant strength using a repeatable front-held setup. Choose a tolerated range and load that fits the intended effort.',
  },
  squat_bulgarian: {
    id: 'squat_bulgarian', name: 'Bulgarian Split Squat', pattern: 'squat',
    equipment: ['dumbbell', 'bodyweight'], unilateral: true, cnsLoad: 'high',
    coachingCues: ['Choose stride and support for comfortable knee and hip loading', 'Press through the whole front foot to stand', 'Use a controlled torso position that fits your setup'],
    contraindications: ['hip_flexor_injury', 'knee_ligament_injury'],
    rationale: 'One option for challenging single-leg knee and hip strength. Support, stance and range can change to fit the person; no variation is universally best.',
  },
  squat_box: {
    id: 'squat_box', name: 'Box Squat (Bodyweight)', pattern: 'squat',
    equipment: ['bodyweight'], unilateral: false, cnsLoad: 'low',
    coachingCues: ['Sit back onto box with control', 'Pause momentarily — no bounce', 'Push floor away through whole foot'],
    contraindications: [],
    rationale: 'A supported knee-dominant option for practicing a repeatable squat setup. Adjust box height and range to the person.',
  },

  // ── Hinge ─────────────────────────────────────────────────────────────────
  hinge_rdl: {
    id: 'hinge_rdl', name: 'Romanian Deadlift', pattern: 'hinge',
    equipment: ['barbell', 'dumbbell'], unilateral: false, cnsLoad: 'high',
    coachingCues: ['Hinge at hips — not waist', 'Bar/dumbbells stay close to legs', 'Soft knee, proud chest throughout'],
    contraindications: ['lower_back_pain_acute'],
    rationale: 'Hip-dominant strength with a repeatable hinge and external load. Record whether the setup uses a barbell or dumbbells.',
  },
  hinge_single_rdl: {
    id: 'hinge_single_rdl', name: 'Single-Leg RDL', pattern: 'hinge',
    equipment: ['dumbbell', 'bodyweight'], unilateral: true, cnsLoad: 'medium',
    coachingCues: ['Hip and shoulders square to floor', 'Trace a line — hip, spine, trailing leg aligned', 'Slow eccentric — 3 seconds down'],
    contraindications: ['hip_flexor_injury'],
    rationale: 'Single-leg hip-dominant work. Use support or a smaller range when that better matches the intended stimulus.',
  },
  hinge_hip_thrust: {
    id: 'hinge_hip_thrust', name: 'Hip Thrust', pattern: 'hinge',
    equipment: ['barbell', 'bodyweight', 'dumbbell'], unilateral: false, cnsLoad: 'medium',
    coachingCues: ['Drive through heels, not toes', 'Squeeze glutes at top — full hip extension', 'Chin tucked — don\'t hyperextend lumbar'],
    contraindications: [],
    rationale: 'Hip-extension strength using a stable setup. Bodyweight and externally loaded versions need their own starting calibration.',
  },
  hinge_nordic: {
    id: 'hinge_nordic', name: 'Nordic Hamstring Curl', pattern: 'hinge',
    equipment: ['bodyweight'], unilateral: false, cnsLoad: 'high',
    coachingCues: ['Control the fall for 3–5 seconds', 'Use hands to control final range — don\'t crash', 'Brace core throughout'],
    contraindications: ['hamstring_injury_acute'],
    rationale: 'A demanding eccentric knee-flexor option. Introduce only a controllable range and enough assistance to repeat the prescribed work.',
  },

  // ── Lunge ─────────────────────────────────────────────────────────────────
  lunge_reverse: {
    id: 'lunge_reverse', name: 'Reverse Lunge', pattern: 'lunge',
    equipment: ['dumbbell', 'bodyweight'], unilateral: true, cnsLoad: 'medium',
    coachingCues: ['Step back to a comfortable stance', 'Let the front knee track in line with the foot', 'Press through the whole front foot to return'],
    contraindications: ['knee_pain_anterior'],
    rationale: 'Single-leg knee and hip strength. Adjust stride, support and range for a repeatable, reasonably tolerated setup.',
  },
  lunge_lateral: {
    id: 'lunge_lateral', name: 'Lateral Lunge', pattern: 'lunge',
    equipment: ['dumbbell', 'bodyweight'], unilateral: true, cnsLoad: 'medium',
    coachingCues: ['Shift weight onto bending leg — straight leg stays straight', 'Foot flat, toes forward', 'Sit into the hip, not the knee'],
    contraindications: [],
    rationale: 'A single-leg strength option that includes side-to-side loading. Choose it when that role serves the goal and is reasonably tolerated.',
  },
  lunge_step_up: {
    id: 'lunge_step_up', name: 'Step-Up', pattern: 'lunge',
    equipment: ['dumbbell', 'bodyweight'], unilateral: true, cnsLoad: 'medium',
    coachingCues: ['Drive up through heel of top foot', 'Don\'t push off bottom foot', 'Control the lowering — 2 seconds down'],
    contraindications: [],
    rationale: 'Single-leg strength for activities such as hiking and running. Step height, support and load determine the challenge.',
  },

  // ── Push ──────────────────────────────────────────────────────────────────
  push_pushup: {
    id: 'push_pushup', name: 'Push-Up', pattern: 'push',
    equipment: ['bodyweight'], unilateral: false, cnsLoad: 'low',
    coachingCues: ['Body rigid — plank throughout', 'Elbows about 45 degrees from torso — not flared', 'Full ROM — chest grazes floor'],
    contraindications: ['shoulder_impingement'],
    rationale: 'A horizontal pushing option. Change hand elevation, range or assistance to match the intended effort.',
  },
  push_db_press: {
    id: 'push_db_press', name: 'Single-Arm DB Press', pattern: 'push',
    equipment: ['dumbbell'], unilateral: true, cnsLoad: 'low',
    coachingCues: ['Keep ribcage down — no arch', 'Controlled descent — 2 seconds', 'Feel the anti-rotation demand'],
    contraindications: ['shoulder_impingement'],
    rationale: 'A pressing option with a unilateral setup. Record the setup and use an appropriate range and load.',
  },

  // ── Pull ──────────────────────────────────────────────────────────────────
  pull_band_row: {
    id: 'pull_band_row', name: 'Resistance-Band Row', pattern: 'pull',
    equipment: ['band'], unilateral: false, cnsLoad: 'medium',
    coachingCues: ['Use a secure anchor and repeatable starting position', 'Pull toward the lower ribs with control', 'Record band resistance and setup rather than a guessed dumbbell weight'],
    contraindications: [],
    rationale: 'A horizontal pulling option when a band and secure anchor fit the available setup. It has its own resistance calibration rather than inheriting a dumbbell load.',
  },
  pull_row: {
    id: 'pull_row', name: 'Single-Arm DB Row', pattern: 'pull',
    equipment: ['dumbbell'], unilateral: true, cnsLoad: 'medium',
    coachingCues: ['Pull elbow to hip — not shoulder to ear', 'Rotate torso with the pull', 'Full hang at bottom — feel lat stretch'],
    contraindications: [],
    rationale: 'Horizontal pulling strength with a supported, repeatable setup. Record the load used per dumbbell.',
  },
  pull_band_pull: {
    id: 'pull_band_pull', name: 'Band Pull-Apart', pattern: 'pull',
    equipment: ['band'], unilateral: false, cnsLoad: 'low',
    coachingCues: ['Arms straight throughout', 'Squeeze shoulder blades together at end', 'Control return — don\'t snap forward'],
    contraindications: [],
    rationale: 'A light pulling option for shoulder and upper-back work. It does not automatically replace a challenging row or pulldown.',
  },
  pull_facepull: {
    id: 'pull_facepull', name: 'Face Pull (Band)', pattern: 'pull',
    equipment: ['band'], unilateral: false, cnsLoad: 'low',
    coachingCues: ['Pull toward forehead — elbows high', 'Externally rotate at end range', 'No forward head — stay tall'],
    contraindications: [],
    rationale: 'A light upper-back and shoulder pulling option. Use it for its intended role rather than as a universal substitute for heavier pulling.',
  },

  // ── Carry ─────────────────────────────────────────────────────────────────
  carry_farmers: {
    id: 'carry_farmers', name: 'Farmer\'s Carry', pattern: 'carry',
    equipment: ['dumbbell', 'kettlebell'], unilateral: false, cnsLoad: 'medium',
    coachingCues: ['Shoulders packed down and back', 'Tall spine — no lateral lean', 'Small steps, steady pace'],
    contraindications: [],
    rationale: 'A loaded carry for grip, trunk and whole-body support. Prescribe time or distance rather than a repetition-based maximum.',
  },
  carry_suitcase: {
    id: 'carry_suitcase', name: 'Suitcase Carry (Single-Arm)', pattern: 'carry',
    equipment: ['dumbbell', 'kettlebell'], unilateral: true, cnsLoad: 'medium',
    coachingCues: ['Resist the lean — stay perfectly upright', 'Think: push hip away from the weight', 'Breathe evenly'],
    contraindications: [],
    rationale: 'An asymmetrical loaded carry for trunk support and grip. Record the side, load and time or distance.',
  },

  // ── Trunk / Core ──────────────────────────────────────────────────────────
  trunk_dead_bug: {
    id: 'trunk_dead_bug', name: 'Dead Bug', pattern: 'trunk',
    equipment: ['bodyweight'], unilateral: false, cnsLoad: 'low',
    coachingCues: ['Lower back pressed into floor throughout', 'Exhale as limbs extend — brace core', 'Slow and controlled — 3s per rep'],
    contraindications: [],
    rationale: 'Trunk control while the limbs move. Adjust range and repetitions to keep the task repeatable.',
  },
  trunk_copenhagen: {
    id: 'trunk_copenhagen', name: 'Copenhagen Plank', pattern: 'trunk',
    equipment: ['bodyweight'], unilateral: true, cnsLoad: 'medium',
    coachingCues: ['Body in a straight line from head to heel', 'Top leg does the work — don\'t just hang', 'Start with short duration sets and build'],
    contraindications: ['groin_injury_acute'],
    rationale: 'An optional trunk and adductor loading task. Support and duration can be adjusted to the intended challenge.',
  },
  trunk_side_plank: {
    id: 'trunk_side_plank', name: 'Side Plank', pattern: 'trunk',
    equipment: ['bodyweight'], unilateral: true, cnsLoad: 'low',
    coachingCues: ['Stack feet or stagger for less challenge', 'Drive hip away from floor', 'No sagging at waist'],
    contraindications: [],
    rationale: 'A side-support trunk task. Adjust lever length and duration to a repeatable effort; it is not an injury prediction or prevention test.',
  },
  trunk_bird_dog: {
    id: 'trunk_bird_dog', name: 'Bird Dog', pattern: 'trunk',
    equipment: ['bodyweight'], unilateral: false, cnsLoad: 'low',
    coachingCues: ['Don\'t rotate the pelvis as limbs extend', 'Imagine a glass of water on your lower back', 'Slow — full extension, full control'],
    contraindications: [],
    rationale: 'A trunk-control task with opposing limb movement. Keep the setup consistent when comparing performance.',
  },

  // ── Calf / Ankle ──────────────────────────────────────────────────────────
  calf_single_standing: {
    id: 'calf_single_standing', name: 'Single-Leg Calf Raise', pattern: 'calf_ankle',
    equipment: ['bodyweight', 'dumbbell'], unilateral: true, cnsLoad: 'low',
    coachingCues: ['Full range — heel below step, full rise', '2 seconds up, 2 seconds down', 'Keep knee soft — don\'t lock out'],
    contraindications: ['achilles_tendinopathy_reactive'],
    rationale: 'Direct plantarflexor strength. Use a consistent range, support and load; record the work actually completed.',
  },
  calf_seated: {
    id: 'calf_seated', name: 'Seated Calf Raise', pattern: 'calf_ankle',
    equipment: ['dumbbell', 'machine'], unilateral: false, cnsLoad: 'low',
    coachingCues: ['Heavy load on top of quads', 'Full ROM — stretch and squeeze', 'Slow tempo isolates soleus'],
    contraindications: [],
    rationale: 'A bent-knee plantarflexor strength option. Use a repeatable setup and a load suited to the intended effort.',
  },
  ...Object.fromEntries(PLYOMETRIC_CATALOG.map(task=>[task.exercise.id,task.exercise])),
  calf_pogo: {
    id: 'calf_pogo', name: 'Pogo Hops', pattern: 'calf_ankle',
    equipment: ['bodyweight'], unilateral: false, cnsLoad: 'low',
    coachingCues: ['Land on forefeet — zero heel contact', 'Stiff ankles — minimal knee bend', 'Fast ground contact — think springs'],
    contraindications: ['achilles_tendinopathy_reactive', 'plantar_fasciitis_acute'],
    rationale: 'A reactive hopping option. Keep repetitions controllable and choose a lower-impact alternative if this stimulus does not fit.',
  },

  // ── Plyometric ────────────────────────────────────────────────────────────
  plyo_box_jump: {
    id: 'plyo_box_jump', name: 'Box Jump', pattern: 'plyometric',
    equipment: ['bodyweight'], unilateral: false, cnsLoad: 'high',
    coachingCues: ['Land softly — absorb into squat position', 'Step down — don\'t jump down', 'Full reset between reps — quality over speed'],
    contraindications: ['knee_pain_anterior', 'ankle_sprain_acute'],
    rationale: 'An optional power task with low repetition counts and full resets. Box height and landing control should suit the person.',
  },
  plyo_single_hop: {
    id: 'plyo_single_hop', name: 'Single-Leg Hop', pattern: 'plyometric',
    equipment: ['bodyweight'], unilateral: true, cnsLoad: 'high',
    coachingCues: ['Stick the landing — control for 2 seconds', 'Soft knee — don\'t land stiff-legged', 'Progress from small to large amplitude'],
    contraindications: ['knee_ligament_injury', 'ankle_sprain_acute'],
    rationale: 'A single-leg reactive task. Choose the amplitude, support and repetition count for a repeatable effort.',
  },

  // ── Mobility / Prehab ─────────────────────────────────────────────────────
  mobility_hip_90: {
    id: 'mobility_hip_90', name: 'Hip 90/90 Stretch', pattern: 'mobility',
    equipment: ['bodyweight'], unilateral: true, cnsLoad: 'low',
    coachingCues: ['Both shins at 90° — sit tall', 'Lean into the front hip\'s internal rotation', 'Exhale into each position'],
    contraindications: [],
    rationale: 'An optional hip movement task. Use a comfortable range when mobility work fits the goal.',
  },
  mobility_hip_flexor: {
    id: 'mobility_hip_flexor', name: 'Half-Kneeling Hip Flexor Stretch', pattern: 'mobility',
    equipment: ['bodyweight'], unilateral: true, cnsLoad: 'low',
    coachingCues: ['Posteriorly tilt pelvis before leaning forward', 'Don\'t lean — drive hip forward', 'Breathe into the front of the hip'],
    contraindications: [],
    rationale: 'An optional hip-flexor stretch. Choose a comfortable position and hold; a stretch is not a substitute for loaded strength.',
  },
  mobility_clamshell: {
    id: 'mobility_clamshell', name: 'Clamshell', pattern: 'mobility',
    equipment: ['bodyweight', 'band'], unilateral: true, cnsLoad: 'low',
    coachingCues: ['Feet stacked — pelvis still', 'Rotate the top knee open like a clamshell', 'Feel glute med — stop if you feel hip flexor'],
    contraindications: [],
    rationale: 'A light hip-rotation task. It serves a different stimulus from a challenging step-up, split squat or loaded hinge.',
  },
};

// ─── Session type definitions ──────────────────────────────────────────────────

type SessionTemplate = {
  title:        string;
  goal:         StrengthGoal;
  duration:     number;
  patterns:     MovementPattern[];
  exerciseIds:  string[];
  sets:         number;
  repRange:     [number, number];
  repSchemes?:   Partial<Record<string, RepScheme>>;
  rpe:          number;
  rationale:    string;
  purpose:      string;
};

export const SESSION_TEMPLATES: Record<StrengthSessionType, SessionTemplate> = {
  full_body: {
    title:       'Full Body Strength',
    goal:        'force_production',
    duration:    50,
    patterns:    ['squat', 'hinge', 'lunge', 'trunk', 'calf_ankle'],
    exerciseIds: ['squat_goblet', 'hinge_rdl', 'lunge_reverse', 'trunk_dead_bug', 'calf_single_standing'],
    sets: 3, repRange: [6, 10], rpe: 7,
    rationale: 'This template organizes repeatable strength work around selected movement roles. The chosen dose is a starting point to adjust from performance, available time and recovery.',
    purpose: 'Build structural strength across all running-relevant movement patterns. This is the session that makes every other adaptation possible.',
  },
  lower_power: {
    title:       'Lower Body Power',
    goal:        'force_production',
    duration:    55,
    patterns:    ['squat', 'hinge', 'trunk', 'calf_ankle'],
    exerciseIds: ['squat_bulgarian', 'hinge_hip_thrust', 'hinge_nordic', 'trunk_copenhagen', 'calf_single_standing'],
    sets: 3, repRange: [5, 8], rpe: 8,
    repSchemes: {
      trunk_copenhagen: { kind: 'duration', secondsMin: 20, secondsMax: 30, perSide: true },
      calf_single_standing: { kind: 'reps_hold', repsMin: 8, repsMax: 12, holdSeconds: 2, perSide: true },
    },
    rationale: 'A lower-body strength emphasis can support an endurance goal when the person can recover from its combined demands. Exercise selection and dose remain adjustable.',
    purpose: 'Develop lower-body strength while protecting time and recovery for the current training priority.',
  },
  running_economy: {
    title:       'Running Economy Session',
    goal:        'running_economy',
    duration:    45,
    patterns:    ['squat', 'hinge', 'plyometric', 'trunk', 'calf_ankle'],
    exerciseIds: ['squat_bulgarian', 'hinge_single_rdl', 'plyo_box_jump', 'trunk_bird_dog', 'calf_pogo'],
    sets: 3, repRange: [5, 8], rpe: 7,
    repSchemes: {
      squat_bulgarian: { kind: 'reps_tempo', repsMin: 5, repsMax: 8, tempo: '3:1:1', perSide: true },
      hinge_single_rdl: { kind: 'reps_tempo', repsMin: 5, repsMax: 8, tempo: '3:1:1', perSide: true },
    },
    rationale: 'An optional strength and reactive-work template for runners who are prepared for that stimulus. It is not a guarantee of a faster race or a required session for every runner.',
    purpose: 'Practice running-support strength and optional reactive tasks when their stimulus fits the athlete; transfer to running performance varies.',
  },
  prehab: {
    title:       'Prehab & Resilience',
    goal:        'injury_resilience',
    duration:    30,
    patterns:    ['trunk', 'calf_ankle', 'mobility', 'pull'],
    exerciseIds: ['trunk_side_plank', 'calf_single_standing', 'mobility_clamshell', 'pull_band_pull', 'mobility_hip_flexor'],
    sets: 2, repRange: [10, 15], rpe: 5,
    repSchemes: {
      trunk_side_plank: { kind: 'duration', secondsMin: 20, secondsMax: 30, perSide: true },
      calf_single_standing: { kind: 'reps_hold', repsMin: 10, repsMax: 15, holdSeconds: 2, perSide: true },
      mobility_hip_flexor: { kind: 'duration', secondsMin: 30, perSide: true },
    },
    rationale: 'A lower-demand supporting session for weeks when reduced loading fits the person and goal. It still contributes to the total work of the day.',
    purpose: 'Practice selected movement and supporting strength tasks with a lower planned demand.',
  },
  activation: {
    title:       'Neuromuscular Activation',
    goal:        'taper_support',
    duration:    20,
    patterns:    ['squat', 'hinge', 'trunk', 'calf_ankle'],
    exerciseIds: ['squat_box', 'hinge_hip_thrust', 'trunk_bird_dog', 'calf_single_standing'],
    sets: 2, repRange: [8, 10], rpe: 5,
    rationale: 'A reduced-volume template for practicing familiar movements near a race. It does not guarantee the absence of fatigue or fitness loss.',
    purpose: 'Practice familiar movements with a reduced dose while race preparation takes priority.',
  },
};

// ─── Phase → session type selection ──────────────────────────────────────────

type PhaseConfig = {
  sessionTypes:  StrengthSessionType[];  // one type per session day
  sessionDays:   number[];               // 0=Mon…6=Sun
  goal:          StrengthGoal;
  phaseNote:     string;
  phaseRationale: string;
};

const PHASE_CONFIG: Record<TrainingPhase, Record<ProgressionLevel, PhaseConfig>> = {
  foundation: {
    beginner:     { sessionTypes: ['prehab'], sessionDays: [1], goal: 'injury_resilience', phaseNote: 'Foundation: 1×/week movement quality', phaseRationale: 'Brand new to structured training — a single low-load, low-RPE session builds movement quality and joint resilience while the aerobic engine develops. Use repeatable setup and submaximal effort; adjust after actual performance is recorded.' },
    intermediate: { sessionTypes: ['prehab'], sessionDays: [1], goal: 'injury_resilience', phaseNote: 'Foundation: 1×/week movement quality', phaseRationale: 'Foundation phase prioritises movement quality over load. One low-intensity session keeps CNS fatigue minimal while the running base is establishing itself.' },
    advanced:     { sessionTypes: ['prehab', 'prehab'], sessionDays: [1, 4], goal: 'injury_resilience', phaseNote: 'Foundation: 2×/week movement quality', phaseRationale: 'Even for experienced lifters returning to running, foundation phase stays light — two low-RPE movement-quality sessions keep the added lifting demand modest while new running volume is established.' },
  },
  base: {
    beginner:     { sessionTypes: ['full_body'], sessionDays: [1], goal: 'force_production', phaseNote: 'Base: 1×/week full body', phaseRationale: 'New to strength training — one full-body session builds structural foundation without interference with running adaptation.' },
    intermediate: { sessionTypes: ['full_body', 'prehab'], sessionDays: [1, 4], goal: 'force_production', phaseNote: 'Base: 2×/week — strength + prehab', phaseRationale: 'Two sessions per week in base phase: one compound strength session and one prehab/accessory session. This is when the largest strength gains occur before race-specific running volume climbs.' },
    advanced:     { sessionTypes: ['full_body', 'lower_power'], sessionDays: [1, 4], goal: 'force_production', phaseNote: 'Base: 2×/week — full body + lower power', phaseRationale: 'Advanced athletes can handle higher strength loads in base phase. Two sessions target both structural strength and early force development.' },
  },
  aerobic_development: {
    beginner:     { sessionTypes: ['full_body'], sessionDays: [1], goal: 'force_production', phaseNote: 'Aerobic development: 1×/week full body', phaseRationale: 'Maintain simple strength exposure while aerobic consistency is the priority.' },
    intermediate: { sessionTypes: ['full_body', 'prehab'], sessionDays: [1, 4], goal: 'force_production', phaseNote: 'Aerobic development: strength + prehab', phaseRationale: 'Strength supports durability without competing with aerobic volume.' },
    advanced:     { sessionTypes: ['full_body', 'lower_power'], sessionDays: [1, 4], goal: 'force_production', phaseNote: 'Aerobic development: force + power support', phaseRationale: 'Preserve force production while the run plan builds aerobic capacity.' },
  },
  threshold: {
    beginner:     { sessionTypes: ['prehab'], sessionDays: [2], goal: 'injury_resilience', phaseNote: 'Threshold: 1×/week prehab', phaseRationale: 'Keep strength low-fatigue while controlled run quality is introduced.' },
    intermediate: { sessionTypes: ['prehab', 'full_body'], sessionDays: [1, 4], goal: 'maintenance', phaseNote: 'Threshold: maintenance + prehab', phaseRationale: 'Maintain strength and tissue resilience without stealing recovery from threshold work.' },
    advanced:     { sessionTypes: ['running_economy', 'prehab'], sessionDays: [1, 4], goal: 'running_economy', phaseNote: 'Threshold: economy + prehab', phaseRationale: 'Low-volume economy work supports quality running while prehab manages load.' },
  },
  vo2: {
    beginner:     { sessionTypes: ['prehab'], sessionDays: [2], goal: 'injury_resilience', phaseNote: 'VO₂: 1×/week prehab', phaseRationale: 'High-end running work leaves no room for aggressive lower-body loading.' },
    intermediate: { sessionTypes: ['prehab'], sessionDays: [2], goal: 'maintenance', phaseNote: 'VO₂: prehab only', phaseRationale: 'Strength shifts to maintenance during high-intensity run exposure.' },
    advanced:     { sessionTypes: ['running_economy', 'prehab'], sessionDays: [1, 4], goal: 'maintenance', phaseNote: 'VO₂: reduced economy + prehab', phaseRationale: 'Maintain neuromuscular qualities with reduced volume and careful spacing.' },
  },
  race_specific: {
    beginner:     { sessionTypes: ['activation'], sessionDays: [2], goal: 'maintenance', phaseNote: 'Race specific: activation', phaseRationale: 'Strength supports readiness without adding new fatigue during race-specific work.' },
    intermediate: { sessionTypes: ['activation', 'prehab'], sessionDays: [1, 4], goal: 'maintenance', phaseNote: 'Race specific: activation + prehab', phaseRationale: 'Keep movement sharp and tissue resilient while run specificity dominates.' },
    advanced:     { sessionTypes: ['running_economy', 'activation'], sessionDays: [1, 4], goal: 'maintenance', phaseNote: 'Race specific: low-volume economy', phaseRationale: 'Preserve economy and power with minimal volume as run specificity rises.' },
  },
  build: {
    beginner:     { sessionTypes: ['prehab'], sessionDays: [2], goal: 'injury_resilience', phaseNote: 'Build: 1×/week prehab focus', phaseRationale: 'Running volume is climbing — one low-demand strength session keeps the added work manageable around key running sessions.' },
    intermediate: { sessionTypes: ['lower_power', 'prehab'], sessionDays: [1, 4], goal: 'running_economy', phaseNote: 'Build: 2×/week — power + prehab', phaseRationale: 'One high-intensity session converts base strength into race power; one prehab session manages the increased running load.' },
    advanced:     { sessionTypes: ['running_economy', 'lower_power'], sessionDays: [1, 4], goal: 'running_economy', phaseNote: 'Build: 2×/week — economy + power', phaseRationale: 'Two quality sessions in build phase: explosive/plyometric work for economy and heavy lower-body work for maximum force. Timed away from quality run sessions to minimise interference.' },
  },
  peak: {
    beginner:     { sessionTypes: ['prehab'], sessionDays: [2], goal: 'maintenance', phaseNote: 'Peak: 1×/week maintenance', phaseRationale: 'Maintaining acquired strength with minimal volume. Running quality sessions are the priority — strength is maintenance-only.' },
    intermediate: { sessionTypes: ['prehab'], sessionDays: [1], goal: 'maintenance', phaseNote: 'Peak: 1×/week prehab only', phaseRationale: 'Volume drops while running intensity peaks. A single prehab session maintains tissue health and neuromuscular patterns without adding fatigue.' },
    advanced:     { sessionTypes: ['running_economy', 'prehab'], sessionDays: [1, 4], goal: 'maintenance', phaseNote: 'Peak: 2×/week — economy + prehab', phaseRationale: 'Advanced athletes can maintain running economy work in peak phase with reduced volume. 2–3 sets at higher intensity maintains neuromuscular adaptations.' },
  },
  deload: {
    beginner:     { sessionTypes: ['prehab'], sessionDays: [3], goal: 'deload', phaseNote: 'Deload: 1×/week light prehab', phaseRationale: 'Deload week — tissue recovery priority. One light prehab session maintains movement patterns without any meaningful training stress.' },
    intermediate: { sessionTypes: ['prehab'], sessionDays: [3], goal: 'deload', phaseNote: 'Deload: 1×/week prehab', phaseRationale: 'Deload week — allow accumulated fatigue to dissipate. Light prehab work maintains mobility and joint health.' },
    advanced:     { sessionTypes: ['prehab'], sessionDays: [2], goal: 'deload', phaseNote: 'Deload: 1×/week mobility + prehab', phaseRationale: 'Even advanced athletes need a full deload from high-load strength work. One light session maintains patterns without adding CNS stress.' },
  },
  taper: {
    beginner:     { sessionTypes: ['activation'], sessionDays: [2], goal: 'taper_support', phaseNote: 'Taper: 1×/week activation only', phaseRationale: 'Taper: minimal loading to maintain neuromuscular potentiation. No new stimuli — preserve sharpness without adding fatigue.' },
    intermediate: { sessionTypes: ['activation'], sessionDays: [2], goal: 'taper_support', phaseNote: 'Taper: 1×/week activation', phaseRationale: 'Taper: maintain neuromuscular activation with very reduced volume. The goal is feel — not fitness.' },
    advanced:     { sessionTypes: ['activation'], sessionDays: [1], goal: 'taper_support', phaseNote: 'Taper: 1×/week early-week activation', phaseRationale: 'Single activation session early in the week preserves neuromuscular potentiation with full recovery before race day.' },
  },
  transition: {
    beginner:     { sessionTypes: ['prehab'], sessionDays: [2], goal: 'injury_resilience', phaseNote: 'Transition: movement quality', phaseRationale: 'Light movement quality restores rhythm without forcing progression.' },
    intermediate: { sessionTypes: ['prehab'], sessionDays: [2], goal: 'maintenance', phaseNote: 'Transition: low-load maintenance', phaseRationale: 'Reduce load while maintaining useful movement patterns.' },
    advanced:     { sessionTypes: ['prehab'], sessionDays: [2], goal: 'maintenance', phaseNote: 'Transition: low-load maintenance', phaseRationale: 'Keep structure light until normal training resumes.' },
  },
  recovery: {
    beginner:     { sessionTypes: ['prehab'], sessionDays: [3], goal: 'deload', phaseNote: 'Recovery: gentle prehab', phaseRationale: 'Recovery phase prioritizes restoration and symptom-safe movement.' },
    intermediate: { sessionTypes: ['prehab'], sessionDays: [3], goal: 'deload', phaseNote: 'Recovery: gentle prehab', phaseRationale: 'Recovery phase lowers strength stress and preserves mobility.' },
    advanced:     { sessionTypes: ['prehab'], sessionDays: [3], goal: 'deload', phaseNote: 'Recovery: gentle prehab', phaseRationale: 'Recovery phase is not a strength-building block; keep loading minimal.' },
  },
};

export function getSessionTypeTitle(sessionType: StrengthSessionType): string {
  return SESSION_TEMPLATES[sessionType].title;
}

// Lightweight preview used by the calendar screen for future/past weeks —
// which day indices (0=Mon) carry a strength session for a given phase/level,
// without building full StrengthSession objects.
export function getPhaseSessionPreview(
  phase:            TrainingPhase,
  progressionLevel: ProgressionLevel,
): { sessionDays: number[]; title: string } {
  const config = PHASE_CONFIG[phase]?.[progressionLevel] ?? PHASE_CONFIG['base']!['intermediate']!;
  const title  = SESSION_TEMPLATES[config.sessionTypes[0] ?? 'prehab']!.title;
  return { sessionDays: config.sessionDays, title };
}

// ─── Adaptive overrides ───────────────────────────────────────────────────────

function applyStrengthAdaptations(
  config:        PhaseConfig,
  input:         StrengthEngineInput,
): PhaseConfig {
  let { sessionTypes, sessionDays, goal } = config;

  // Critical fatigue: drop to prehab/activation only
  if (input.fatigueScore > 82) {
    sessionTypes = sessionTypes.map(t =>
      t === 'lower_power' || t === 'full_body' || t === 'running_economy'
        ? 'prehab' : t,
    );
    goal = 'deload';
  }
  // High fatigue: no high-CNS sessions
  else if (input.fatigueScore > 70) {
    sessionTypes = sessionTypes.map(t =>
      t === 'lower_power' || t === 'running_economy' ? 'full_body' : t,
    );
  }

  // Critical recovery: drop one session if 2+ planned
  if (input.recoveryScore < 38 && sessionTypes.length > 1) {
    sessionTypes = sessionTypes.slice(0, 1);
    sessionDays  = sessionDays.slice(0, 1);
  }

  // ACWR spike: no plyometric sessions
  if (input.acwr > 1.4) {
    sessionTypes = sessionTypes.map(t => t === 'running_economy' ? 'prehab' : t);
  }

  // High soreness: prehab only
  if (input.soreness !== null && input.soreness >= 8) {
    sessionTypes = sessionTypes.map(() => 'prehab');
    goal = 'injury_resilience';
  }

  // High training stress: no high-CNS sessions
  if (input.injuryRisk) {
    sessionTypes = sessionTypes.map(t =>
      t === 'lower_power' || t === 'running_economy' ? 'prehab' : t,
    );
  }

  // Race proximity: taper support only in final 2 weeks
  if (input.weeksToRace <= 2 && input.weeksToRace > 0) {
    sessionTypes = sessionTypes.map(() => 'activation');
    goal = 'taper_support';
  }

  // Time constraint: drop to 1 session if very limited time
  if (input.availableTimeMin < 30 && sessionTypes.length > 1) {
    sessionTypes = sessionTypes.slice(0, 1);
    sessionDays  = sessionDays.slice(0, 1);
  }

  // Hybrid goal: cap CNS load so lifting doesn't compound with running-quality
  // fatigue — the only session template above RPE 7 is lower_power (RPE 8).
  if (input.hybridBalance) {
    sessionTypes = sessionTypes.map(t => t === 'lower_power' ? 'full_body' : t);
  }

  return { ...config, sessionTypes, sessionDays, goal };
}

// ─── Build a single planned exercise ─────────────────────────────────────────

function buildExercise(
  id:       string,
  template: SessionTemplate,
  isDeload: boolean,
): PlannedExercise {
  const ex   = STRENGTH_EXERCISES[id];
  if (!ex) throw new Error(`Unknown exercise id: ${id}`);

  const sets     = isDeload ? Math.max(1, template.sets - 1) : template.sets;
  const rpe      = isDeload ? Math.max(3, template.rpe - 2) : template.rpe;
  const rir      = 10 - rpe;
  const rest     = ex.cnsLoad === 'high' ? 120 : ex.cnsLoad === 'medium' ? 90 : 60;
  const isStaticStretch = id === 'mobility_hip_flexor';
  const tempo    = isStaticStretch ? 'Gentle static hold' : ex.pattern === 'plyometric' ? 'Explosive: fast concentric' : '3:1:1';
  const repRange: [number, number] = isDeload
    ? [template.repRange[0] + 2, template.repRange[1] + 3]
    : template.repRange;
  const fallbackPrescription = `${repRange[0]}-${repRange[1]}`;
  const repScheme = template.repSchemes?.[id]
    ?? parsePrescriptionScheme(fallbackPrescription, { exerciseName: ex.name, tempo });
  const loadTarget =
    isStaticStretch ? 'Gentle stretch, no pain' :
    template.goal === 'force_production' ? `RPE ${rpe} — heavy, controlled` :
    template.goal === 'running_economy'  ? `RPE ${rpe} — moderate load, fast concentric` :
    template.goal === 'injury_resilience'? 'Light — technique focus' :
    template.goal === 'taper_support'    ? 'RPE 5 — sub-maximal, fresh feeling' :
    `RPE ${rpe}`;

  return {
    exerciseId:      id,
    exercise:        ex,
    sets,
    repRange,
    repScheme,
    loadTarget,
    rpe,
    rir,
    tempo,
    restSeconds:     rest,
    progressionRule: isStaticStretch
      ? 'Maintain a pain-free hold; add time only if the stretch stays gentle and controlled.'
      : ex.cnsLoad === 'high'
      ? 'When top of rep range is reached for all sets at good technique, increase load by 2.5–5kg next session.'
      : 'Repeat the prescribed reps at the intended effort. Consider a small rep or load increase only when actual working-set performance supports it.',
    regressionRule:  isStaticStretch ? 'If pain or symptoms appear, stop the stretch and use an easier position.' : 'If control or tolerance drops, reduce load, range or reps to a manageable effort. Reduce a working set when fatigue calls for less volume.',
    coachingCues:    ex.coachingCues,
    rationale:       ex.rationale,
  };
}

// ─── Build a complete session ─────────────────────────────────────────────────

function buildSession(
  sessionType: StrengthSessionType,
  index:       number,
  weekInBlock: number,
  phase:       TrainingPhase,
  input:       StrengthEngineInput,
): StrengthSession {
  const original = SESSION_TEMPLATES[sessionType];
  const personFirst = input.programmingVersion === 2;
  const level = strengthProgressionLevel(input.strengthLevel);
  const template: SessionTemplate = personFirst && sessionType === 'full_body' ? {
    ...original,
    patterns: ['squat', 'push', 'pull', 'hinge', 'lunge', 'calf_ankle', 'trunk'],
    exerciseIds: [index % 2 === 0 ? 'squat_goblet' : 'hinge_rdl', 'push_pushup', 'pull_row', index % 2 === 0 ? 'hinge_rdl' : 'squat_goblet', 'lunge_reverse', 'calf_single_standing', 'trunk_dead_bug'],
    sets: 2, rpe: level === 'beginner' ? 6 : 7,
    purpose: 'Build repeatable whole-body strength for your goal, with room to recover alongside aerobic training.',
    rationale: 'Knee-dominant, hip-dominant, push, pull, single-leg, calf and trunk roles organize the work. Exercises are adjustable tools; weekly coverage and a manageable dose matter more than filling every category in every session.',
  } : original;
  const isDeload  = phase === 'deload' || phase === 'taper' || input.fatigueScore > 75;
  const selectedIds = personFirst ? strengthExercisesForEquipment(template.exerciseIds, input.availableEquipment, STRENGTH_EXERCISES) : template.exerciseIds;
  let exercises = selectedIds.map(id =>
    buildExercise(id, template, isDeload),
  );
  let goalProgrammingNote = '';

  if (personFirst) {
    exercises = exercises.map(ex => ({
      ...ex,
      exercise: { ...ex.exercise, equipment: strengthExerciseEquipment(ex.exercise, input.availableEquipment) },
      tempo: ex.exercise.pattern === 'mobility' ? ex.tempo : ex.exercise.pattern === 'plyometric' ? 'Purposeful, quality repetitions with a full reset' : 'Controlled lowering; purposeful lifting',
      repScheme: ex.repScheme?.kind === 'reps_tempo' ? { kind: 'reps' as const, repsMin: ex.repScheme.repsMin, repsMax: ex.repScheme.repsMax, perSide: ex.repScheme.perSide } : ex.repScheme,
      progressionRule: 'First repeat the setup and prescribed reps at the intended effort. Consider a small rep or load change only from recorded working-set performance; keep failure optional.',
      loadTarget: ex.exercise.pattern === 'mobility' ? ex.loadTarget : `RPE ${ex.rpe} — choose a repeatable, submaximal effort; this is not a measured maximum`,
    }));
    const designed = applyGoalStrengthProgramming(exercises, input, sessionType, STRENGTH_EXERCISES);
    exercises = fitStrengthSessionToTime(designed.exercises, strengthTimeBudget(input.availableTimeMin));
    goalProgrammingNote = designed.note;
  }

  // Adjust duration for limited time
  const targetDuration = personFirst ? Math.min(strengthTimeBudget(input.availableTimeMin), estimateStrengthSessionMinutes(exercises)) : Math.min(input.availableTimeMin, template.duration);

  const id = personFirst ? `goal_${encodeURIComponent(input.goalScopeId ?? 'unscoped')}_w${input.currentWeek}_strength_slot_${index}` : `strength_${sessionType}_${weekInBlock}_${index}`;

  const progressionNote = personFirst ? strengthExerciseReviewNote(input.currentWeek) :
    phase === 'foundation' ? 'Foundation: movement quality — simple progressions, low RPE, no heavy loading yet' :
    phase === 'base'   ? `Block week ${weekInBlock}/4 — ${weekInBlock < 3 ? 'progressive loading' : 'peak volume week'}` :
    phase === 'build'  ? `Build phase — convert strength to power (${weekInBlock}/4)` :
    phase === 'peak'   ? 'Peak: maintenance — protect fitness, no new stimuli' :
    phase === 'deload' ? 'Deload: active recovery — movement quality over load' :
    'Taper: activation only — stay sharp, stay fresh';

  return {
    id,
    title:            personFirst && sessionType === 'full_body' && !['push', 'pull'].every(role => exercises.some(ex => ex.exercise.pattern === role)) ? 'Strength Priorities' : template.title,
    goal:             template.goal,
    sessionType,
    targetDuration,
    primaryPatterns:  personFirst ? [...new Set(exercises.map(ex => ex.exercise.pattern))] : template.patterns,
    exercises,
    warmupProtocol:   personFirst ? 'Allow about 5 minutes for easy movement and lighter rehearsal sets of the first exercises. Adjust setup, support and range before working sets; no maximum-strength test is required.' : 'Dynamic warm-up: 5 min — leg swings (front/lateral), hip circles, glute bridges (2×10), and a light set of the first exercise at 40% load.',
    cooldownProtocol: personFirst ? 'Allow about 3 minutes to finish with easy movement. Optional comfortable mobility can fit here; extra recovery exercises are not required just to fill categories.' : 'Foam roll legs (IT band, hamstrings, quads) 60–90s per side. Hip flexor and calf stretches 30s per side.',
    purpose:          exercises.length ? template.purpose : 'No complete working-set prescription fits this time window. Choose more time or a shorter custom session rather than rush the planned work.',
    rationale:        template.rationale,
    progressionNote: personFirst ? `${goalProgrammingNote} ${exercises.length < template.exerciseIds.length ? 'Some supporting roles were omitted to fit the stated time or equipment; review coverage across the week.' : ''}` : progressionNote,
  };
}

// ─── Earned progression ───────────────────────────────────────────────────────
//
// Looks at the last 21 days of logged strength sessions to decide whether the
// athlete has EARNED the right to push load higher, needs to hold steady, or
// should pull back. This never touches programmed weight directly — actual
// load targets always come from suggestProgression() at log time using the
// athlete's own last-logged performance. This is purely: "should the plan
// nudge harder, hold, or protect recovery this week?"

export type ProgressionDecision = {
  progressionState:  StrengthProgressionState;
  progressionReason: string;
};

const PROGRESSION_WINDOW_DAYS = 21;

function computeProgressionDecision(input: StrengthEngineInput): ProgressionDecision {
  const cutoff = Date.now() - PROGRESSION_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const recent = input.strengthHistory.filter(r => r.timestamp >= cutoff && !r.skipped);

  // No logged sessions in the window — a fresh start, not a failure. Never
  // read an empty log as "0% completion" and pull back on a new athlete.
  if (recent.length === 0) {
    return {
      progressionState:  'maintain',
      progressionReason: 'Starting from the programmed baseline — log your sessions and the plan will progress from what you actually do.',
    };
  }

  // Expected sessions over the window: liftDays/week × ~3 weeks in the window.
  const sessionsPerWeek  = Math.max(1, input.liftDays?.length ?? 2);
  const expectedSessions = sessionsPerWeek * 3;
  const completionRate   = Math.min(1, recent.length / expectedSessions);

  const rpeValues = recent
    .map(r => r.overallRpe)
    .filter((v): v is number => v !== undefined && Number.isFinite(v) && v >= 1 && v <= 10);
  const avgRpe = rpeValues.length > 0
    ? rpeValues.reduce((s, v) => s + v, 0) / rpeValues.length
    : null;

  const soreness = input.soreness ?? 0;

  if ((avgRpe !== null && avgRpe >= 8.5) || soreness >= 8) {
    const reasons: string[] = [];
    if (avgRpe !== null && avgRpe >= 8.5) reasons.push(`recent sessions averaging RPE ${avgRpe.toFixed(1)}`);
    if (soreness >= 8) reasons.push(`soreness at ${soreness}/10`);
    return {
      progressionState:  'regress',
      progressionReason: `Pulling back this week — ${reasons.join(' and ')}. Sets and RPE are reduced to protect recovery while the block resets.`,
    };
  }

  const workingSets = recent.flatMap(record => record.exercises.filter(ex => !ex.skipped).flatMap(ex => ex.sets.filter(set => set.completed && !set.isWarmup)));
  const reportedPerformance = workingSets.length > 0 && workingSets.every(set => Number.isFinite(set.rpe) && set.rpe! >= 1 && set.rpe! <= 7
    && ((set.reps ?? 0) > 0 || (set.holdSeconds ?? 0) > 0 || (set.distanceMeters ?? 0) > 0));
  if (completionRate >= 0.75 && reportedPerformance && input.recoveryScore >= 55) {
    return {
      progressionState:  'progress',
      progressionReason: 'Actual working-set performance and effort were recorded at a manageable level. Review each exercise against its prescribed reps and setup before considering a small progression; attendance or the week number does not establish a gain.',
    };
  }

  return {
    progressionState:  'maintain',
    progressionReason: completionRate < 0.4
      ? 'Repeat a manageable baseline and review your available training days. Attendance alone does not establish a strength gain or loss.'
      : 'Holding steady — record actual working-set performance and effort before considering more load. Completion alone is not a reason to increase weight.',
  };
}

// Applies the earned-progression decision to a built week: 'regress' trims
// one set (min 1) and one RPE point (min 3) per exercise; 'progress'/'maintain'
// leave the programmed sets/RPE untouched (the note alone communicates intent).
export function applyEarnedProgression(
  sessions: StrengthSession[],
  input:    StrengthEngineInput,
): { sessions: StrengthSession[]; decision: ProgressionDecision } {
  const decision = computeProgressionDecision(input);

  if (decision.progressionState !== 'regress') {
    return { sessions, decision };
  }

  const adjusted = sessions.map(s => ({
    ...s,
    exercises: s.exercises.map(ex => {
      const rpe = Math.max(3, ex.rpe - 1);
      return { ...ex, sets: Math.max(1, ex.sets - 1), rpe, rir: 10 - rpe,
        loadTarget: ex.loadTarget.replace(/RPE\s+\d+(?:\.\d+)?/, `RPE ${rpe}`) };
    }),
  }));

  return { sessions: adjusted, decision };
}

// ─── Strength week scoring ────────────────────────────────────────────────────

function estimateStrengthLoad(sessions: StrengthSession[]): number {
  return sessions.reduce((total, s) => {
    return total + s.exercises.reduce((sessLoad, ex) => {
      const avgReps = (ex.repRange[0] + ex.repRange[1]) / 2;
      const rpeFactor = (ex.rpe - 3) / 7;   // normalise RPE 3–10 → 0–1
      return sessLoad + ex.sets * avgReps * rpeFactor * 2;
    }, 0);
  }, 0);
}

// ─── Main engine ──────────────────────────────────────────────────────────────

export function generateStrengthWeek(input: StrengthEngineInput): StrengthWeek {
  const { trainingPhase, progressionLevel, currentWeek } = input;
  const weekInBlock = ((currentWeek - 1) % 4) + 1;

  const level = input.programmingVersion === 2 ? strengthProgressionLevel(input.strengthLevel) : progressionLevel;
  let baseConfig = PHASE_CONFIG[trainingPhase]?.[level]
    ?? PHASE_CONFIG['base']!['intermediate']!;

  const goalBlend = trainingGoalBlend(input.goalType ?? 'general_running', input.secondaryGoalTypes);
  if (input.programmingVersion === 2 && (trainingPhase === 'foundation'
    || (goalBlend.strengthSupport && (['base', 'aerobic_development', 'build'].includes(trainingPhase)
      || (input.goalType === 'general_strength' && goalBlend.speedSupport && trainingPhase === 'threshold'))))) {
    const count = Math.min(2, Math.max(1, input.liftDays?.length ?? (level === 'beginner' ? 1 : 2)));
    baseConfig = { ...baseConfig, sessionTypes: Array.from({ length: count }, () => 'full_body' as const),
      sessionDays: count > 1 ? [1, 4] : [1], goal: 'force_production',
      phaseNote: `${count} whole-body strength ${count === 1 ? 'session' : 'sessions'} — lifting experience: ${input.strengthLevel ?? 'not yet specified'}`,
      phaseRationale: 'Start with the person, goal and lifting experience separately from running experience. Repeat a manageable strength dose, then adjust from actual performance, recovery, time and equipment. The split serves that purpose; it is not a universal rule.',
    };
  }

  const config = applyStrengthAdaptations(baseConfig, input);
  const maxLiftDays = input.liftDays?.length;
  const sessionTypes = maxLiftDays
    ? config.sessionTypes.slice(0, Math.max(1, maxLiftDays))
    : config.sessionTypes;

  const builtSessions = sessionTypes.map((sessionType, i) =>
    buildSession(sessionType, i, weekInBlock, trainingPhase, input),
  );

  const { sessions: earnedSessions, decision } = applyEarnedProgression(builtSessions, input);
  const sessions = applyGoalPlyometrics(earnedSessions, input, decision.progressionState !== 'regress');

  const weeklyVolumeSets = sessions.reduce((s, sess) =>
    s + sess.exercises.reduce((es, ex) => es + ex.sets, 0), 0);

  const cycle = input.programmingVersion === 2 ? getGoalMesocycle(currentWeek, trainingPhase, input.goalType ?? 'general_running') : null;
  return {
    sessions,
    sessionDays:      config.sessionDays,
    weeklyVolumeSets,
    primaryGoal:      config.goal,
    phaseNote:        cycle ? `${config.phaseNote} · Practice block ${cycle.blockNumber}, ${cycle.weekInBlock}/6` : config.phaseNote,
    phaseRationale:   cycle ? `${cycle.focus}. The current phase and combined workload shape a manageable strength dose. Six-week exercise practice and the existing loading/recovery cycle are separate; actual performance determines progression.` : config.phaseRationale,
    generatedAt:      Date.now(),
    progressionState:  decision.progressionState,
    progressionReason: decision.progressionReason,
  };
}

// ─── Utility: look up exercise by ID ─────────────────────────────────────────

export function getExercise(id: string): Exercise | undefined {
  return STRENGTH_EXERCISES[id];
}

// ─── Utility: strength load for a completed session ──────────────────────────
//
// Uses sets × reps × RPE factor (matching the scoring model above).

export function estimateSessionLoad(
  completedExercises: { sets: { reps?: number; rpe?: number; completed: boolean }[] }[],
): number {
  return completedExercises.reduce((total, ex) => {
    return total + ex.sets.filter(s => s.completed).reduce((s, set) => {
      const rpe = set.rpe ?? 6;
      const factor = (rpe - 3) / 7;
      return s + (set.reps ?? 0) * factor * 2;
    }, 0);
  }, 0);
}
