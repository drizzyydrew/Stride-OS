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
} from '../types/strength';
import type { TrainingPhase, ProgressionLevel } from '../types/training';

// ─── Exercise library ─────────────────────────────────────────────────────────
//
// IDs are prefixed with their movement pattern so strengthHistory.ts can derive
// pattern from ID without needing the full Exercise object.

const EXERCISES: Record<string, Exercise> = {

  // ── Squat ──────────────────────────────────────────────────────────────────
  squat_goblet: {
    id: 'squat_goblet', name: 'Goblet Squat', pattern: 'squat',
    equipment: ['dumbbell', 'kettlebell'], unilateral: false, cnsLoad: 'medium',
    coachingCues: ['Chest tall, elbows inside knees', 'Drive knees out over toes', 'Full depth — crease of hip below knee'],
    contraindications: ['severe_knee_pain'],
    rationale: 'Bilateral quad and glute loading with minimal spinal compression. Transfers directly to uphill running and the push-off phase.',
  },
  squat_bulgarian: {
    id: 'squat_bulgarian', name: 'Bulgarian Split Squat', pattern: 'squat',
    equipment: ['dumbbell', 'bodyweight'], unilateral: true, cnsLoad: 'high',
    coachingCues: ['Front shin vertical at bottom', 'Drive through heel to stand', 'Stay tall — don\'t lean forward'],
    contraindications: ['hip_flexor_injury', 'knee_ligament_injury'],
    rationale: 'The single most effective unilateral lower-body exercise for runners. Corrects symmetry imbalances, builds single-leg stability, and directly loads the push-off mechanics used in every stride.',
  },
  squat_box: {
    id: 'squat_box', name: 'Box Squat (Bodyweight)', pattern: 'squat',
    equipment: ['bodyweight'], unilateral: false, cnsLoad: 'low',
    coachingCues: ['Sit back onto box with control', 'Pause momentarily — no bounce', 'Push floor away through whole foot'],
    contraindications: [],
    rationale: 'Teaches correct hip hinge depth cue and reduces shear force on the knee. Ideal entry point for athletes new to strength training.',
  },

  // ── Hinge ─────────────────────────────────────────────────────────────────
  hinge_rdl: {
    id: 'hinge_rdl', name: 'Romanian Deadlift', pattern: 'hinge',
    equipment: ['barbell', 'dumbbell'], unilateral: false, cnsLoad: 'high',
    coachingCues: ['Hinge at hips — not waist', 'Bar/dumbbells stay close to legs', 'Soft knee, proud chest throughout'],
    contraindications: ['lower_back_pain_acute'],
    rationale: 'Primary posterior-chain developer. Hamstring and glute strength reduces injury risk and improves propulsive force in the late stance phase of running.',
  },
  hinge_single_rdl: {
    id: 'hinge_single_rdl', name: 'Single-Leg RDL', pattern: 'hinge',
    equipment: ['dumbbell', 'bodyweight'], unilateral: true, cnsLoad: 'medium',
    coachingCues: ['Hip and shoulders square to floor', 'Trace a line — hip, spine, trailing leg aligned', 'Slow eccentric — 3 seconds down'],
    contraindications: ['hip_flexor_injury'],
    rationale: 'Builds the hip stability and single-leg eccentric strength critical for controlling landing forces and preventing IT band and hamstring injuries.',
  },
  hinge_hip_thrust: {
    id: 'hinge_hip_thrust', name: 'Hip Thrust', pattern: 'hinge',
    equipment: ['barbell', 'bodyweight', 'dumbbell'], unilateral: false, cnsLoad: 'medium',
    coachingCues: ['Drive through heels, not toes', 'Squeeze glutes at top — full hip extension', 'Chin tucked — don\'t hyperextend lumbar'],
    contraindications: [],
    rationale: 'Maximum glute activation in hip-extended position mirrors the propulsive phase of running. Directly builds the glute power used in the toe-off phase.',
  },
  hinge_nordic: {
    id: 'hinge_nordic', name: 'Nordic Hamstring Curl', pattern: 'hinge',
    equipment: ['bodyweight'], unilateral: false, cnsLoad: 'high',
    coachingCues: ['Control the fall for 3–5 seconds', 'Use hands to control final range — don\'t crash', 'Brace core throughout'],
    contraindications: ['hamstring_injury_acute'],
    rationale: 'Gold-standard hamstring injury prevention. Eccentric overload builds tendon stiffness and reduces hamstring strain risk by ~50%. Requires careful progressive introduction.',
  },

  // ── Lunge ─────────────────────────────────────────────────────────────────
  lunge_reverse: {
    id: 'lunge_reverse', name: 'Reverse Lunge', pattern: 'lunge',
    equipment: ['dumbbell', 'bodyweight'], unilateral: true, cnsLoad: 'medium',
    coachingCues: ['Step back — not out', 'Front shin vertical — track over 2nd toe', 'Push through front heel to return'],
    contraindications: ['knee_pain_anterior'],
    rationale: 'Lower knee shear than forward lunge. Builds single-leg balance and quad/glute strength for the absorption phase when running downhill.',
  },
  lunge_lateral: {
    id: 'lunge_lateral', name: 'Lateral Lunge', pattern: 'lunge',
    equipment: ['dumbbell', 'bodyweight'], unilateral: true, cnsLoad: 'medium',
    coachingCues: ['Shift weight onto bending leg — straight leg stays straight', 'Foot flat, toes forward', 'Sit into the hip, not the knee'],
    contraindications: [],
    rationale: 'Develops frontal-plane hip stability — the key plane neglected by pure sagittal running. Prevents IT band syndrome and runner\'s knee through adductor/abductor balance.',
  },
  lunge_step_up: {
    id: 'lunge_step_up', name: 'Step-Up', pattern: 'lunge',
    equipment: ['dumbbell', 'bodyweight'], unilateral: true, cnsLoad: 'medium',
    coachingCues: ['Drive up through heel of top foot', 'Don\'t push off bottom foot', 'Control the lowering — 2 seconds down'],
    contraindications: [],
    rationale: 'Replicates the single-leg loading pattern of running with minimal knee stress. Excellent running economy transfer, especially for hill running.',
  },

  // ── Push ──────────────────────────────────────────────────────────────────
  push_pushup: {
    id: 'push_pushup', name: 'Push-Up', pattern: 'push',
    equipment: ['bodyweight'], unilateral: false, cnsLoad: 'low',
    coachingCues: ['Body rigid — plank throughout', 'Elbows 45° from torso — not flared', 'Full ROM — chest grazes floor'],
    contraindications: ['shoulder_impingement'],
    rationale: 'Upper body injury resilience for runners. Shoulder and chest strength protects against the postural fatigue that causes form breakdown in long races.',
  },
  push_db_press: {
    id: 'push_db_press', name: 'Single-Arm DB Press', pattern: 'push',
    equipment: ['dumbbell'], unilateral: true, cnsLoad: 'low',
    coachingCues: ['Keep ribcage down — no arch', 'Controlled descent — 2 seconds', 'Feel the anti-rotation demand'],
    contraindications: ['shoulder_impingement'],
    rationale: 'Unilateral pressing builds rotational core stability — the same stability runners need to prevent lateral trunk sway.',
  },

  // ── Pull ──────────────────────────────────────────────────────────────────
  pull_row: {
    id: 'pull_row', name: 'Single-Arm DB Row', pattern: 'pull',
    equipment: ['dumbbell'], unilateral: true, cnsLoad: 'medium',
    coachingCues: ['Pull elbow to hip — not shoulder to ear', 'Rotate torso with the pull', 'Full hang at bottom — feel lat stretch'],
    contraindications: [],
    rationale: 'Upper back strength prevents the forward rounding posture that restricts breathing efficiency in long runs.',
  },
  pull_band_pull: {
    id: 'pull_band_pull', name: 'Band Pull-Apart', pattern: 'pull',
    equipment: ['band'], unilateral: false, cnsLoad: 'low',
    coachingCues: ['Arms straight throughout', 'Squeeze shoulder blades together at end', 'Control return — don\'t snap forward'],
    contraindications: [],
    rationale: 'Posterior shoulder and rotator cuff health. Prevents the chronic shoulder pain many high-mileage runners develop from arm drive fatigue.',
  },
  pull_facepull: {
    id: 'pull_facepull', name: 'Face Pull (Band)', pattern: 'pull',
    equipment: ['band'], unilateral: false, cnsLoad: 'low',
    coachingCues: ['Pull toward forehead — elbows high', 'Externally rotate at end range', 'No forward head — stay tall'],
    contraindications: [],
    rationale: 'Maintains external rotation strength and rotator cuff balance — directly counters the internal rotation pattern of arm drive.',
  },

  // ── Carry ─────────────────────────────────────────────────────────────────
  carry_farmers: {
    id: 'carry_farmers', name: 'Farmer\'s Carry', pattern: 'carry',
    equipment: ['dumbbell', 'kettlebell'], unilateral: false, cnsLoad: 'medium',
    coachingCues: ['Shoulders packed down and back', 'Tall spine — no lateral lean', 'Small steps, steady pace'],
    contraindications: [],
    rationale: 'Full-body integration exercise that builds grip, core, and postural endurance simultaneously. Mirrors the total-body stability demands of race-paced running.',
  },
  carry_suitcase: {
    id: 'carry_suitcase', name: 'Suitcase Carry (Single-Arm)', pattern: 'carry',
    equipment: ['dumbbell', 'kettlebell'], unilateral: true, cnsLoad: 'medium',
    coachingCues: ['Resist the lean — stay perfectly upright', 'Think: push hip away from the weight', 'Breathe evenly'],
    contraindications: [],
    rationale: 'Anti-lateral flexion core strength directly transfers to the lateral stability runners need when fatigued in the late miles of a race.',
  },

  // ── Trunk / Core ──────────────────────────────────────────────────────────
  trunk_dead_bug: {
    id: 'trunk_dead_bug', name: 'Dead Bug', pattern: 'trunk',
    equipment: ['bodyweight'], unilateral: false, cnsLoad: 'low',
    coachingCues: ['Lower back pressed into floor throughout', 'Exhale as limbs extend — brace core', 'Slow and controlled — 3s per rep'],
    contraindications: [],
    rationale: 'Anti-extension core stability that mirrors the lumbo-pelvic control needed to maintain efficient form at high mileage. A foundational injury resilience exercise for all runners.',
  },
  trunk_copenhagen: {
    id: 'trunk_copenhagen', name: 'Copenhagen Plank', pattern: 'trunk',
    equipment: ['bodyweight'], unilateral: true, cnsLoad: 'medium',
    coachingCues: ['Body in a straight line from head to heel', 'Top leg does the work — don\'t just hang', 'Start with short duration sets and build'],
    contraindications: ['groin_injury_acute'],
    rationale: 'The most effective adductor loading exercise for runners. Reduces groin injury risk and builds the medial hip stability that controls knee tracking in single-leg stance.',
  },
  trunk_side_plank: {
    id: 'trunk_side_plank', name: 'Side Plank', pattern: 'trunk',
    equipment: ['bodyweight'], unilateral: true, cnsLoad: 'low',
    coachingCues: ['Stack feet or stagger for less challenge', 'Drive hip away from floor', 'No sagging at waist'],
    contraindications: [],
    rationale: 'Lateral core stability for the Trendelenburg control runners need on every single-leg stance phase. Weakness here = hip drop = IT band + knee overload.',
  },
  trunk_bird_dog: {
    id: 'trunk_bird_dog', name: 'Bird Dog', pattern: 'trunk',
    equipment: ['bodyweight'], unilateral: false, cnsLoad: 'low',
    coachingCues: ['Don\'t rotate the pelvis as limbs extend', 'Imagine a glass of water on your lower back', 'Slow — full extension, full control'],
    contraindications: [],
    rationale: 'Lumbar stability and anti-rotation. The diagonally-opposed limb pattern mirrors the cross-body coordination of running gait.',
  },

  // ── Calf / Ankle ──────────────────────────────────────────────────────────
  calf_single_standing: {
    id: 'calf_single_standing', name: 'Single-Leg Calf Raise', pattern: 'calf_ankle',
    equipment: ['bodyweight', 'dumbbell'], unilateral: true, cnsLoad: 'low',
    coachingCues: ['Full range — heel below step, full rise', '2 seconds up, 2 seconds down', 'Keep knee soft — don\'t lock out'],
    contraindications: ['achilles_tendinopathy_reactive'],
    rationale: 'Gastrocnemius and Achilles tendon loading. The single most important injury prevention exercise for runners — directly reduces plantar fasciitis and Achilles tendinopathy risk.',
  },
  calf_seated: {
    id: 'calf_seated', name: 'Seated Calf Raise', pattern: 'calf_ankle',
    equipment: ['dumbbell', 'machine'], unilateral: false, cnsLoad: 'low',
    coachingCues: ['Heavy load on top of quads', 'Full ROM — stretch and squeeze', 'Slow tempo isolates soleus'],
    contraindications: [],
    rationale: 'Soleus-dominant loading. The soleus absorbs 6–8× body weight per stride — its endurance is as important as its strength for late-race form maintenance.',
  },
  calf_pogo: {
    id: 'calf_pogo', name: 'Pogo Hops', pattern: 'calf_ankle',
    equipment: ['bodyweight'], unilateral: false, cnsLoad: 'low',
    coachingCues: ['Land on forefeet — zero heel contact', 'Stiff ankles — minimal knee bend', 'Fast ground contact — think springs'],
    contraindications: ['achilles_tendinopathy_reactive', 'plantar_fasciitis_acute'],
    rationale: 'Reactive strength and Achilles tendon stiffness. Running economy is largely determined by the ability to store and return elastic energy — pogos directly train this capacity.',
  },

  // ── Plyometric ────────────────────────────────────────────────────────────
  plyo_box_jump: {
    id: 'plyo_box_jump', name: 'Box Jump', pattern: 'plyometric',
    equipment: ['bodyweight'], unilateral: false, cnsLoad: 'high',
    coachingCues: ['Land softly — absorb into squat position', 'Step down — don\'t jump down', 'Full reset between reps — quality over speed'],
    contraindications: ['knee_pain_anterior', 'ankle_sprain_acute'],
    rationale: 'Maximal explosive power development. The rate of force development trained here directly improves stride power and the ability to maintain form when fatigued.',
  },
  plyo_single_hop: {
    id: 'plyo_single_hop', name: 'Single-Leg Hop', pattern: 'plyometric',
    equipment: ['bodyweight'], unilateral: true, cnsLoad: 'high',
    coachingCues: ['Stick the landing — control for 2 seconds', 'Soft knee — don\'t land stiff-legged', 'Progress from small to large amplitude'],
    contraindications: ['knee_ligament_injury', 'ankle_sprain_acute'],
    rationale: 'Single-leg reactive strength that mirrors the plyometric demands of fast running. Identifies and corrects asymmetries that can indicate overuse injury risk.',
  },

  // ── Mobility / Prehab ─────────────────────────────────────────────────────
  mobility_hip_90: {
    id: 'mobility_hip_90', name: 'Hip 90/90 Stretch', pattern: 'mobility',
    equipment: ['bodyweight'], unilateral: true, cnsLoad: 'low',
    coachingCues: ['Both shins at 90° — sit tall', 'Lean into the front hip\'s internal rotation', 'Exhale into each position'],
    contraindications: [],
    rationale: 'Hip internal and external rotation ROM that prevents the compensatory patterns (increased anterior pelvic tilt, medial knee collapse) that develop in high-mileage runners.',
  },
  mobility_hip_flexor: {
    id: 'mobility_hip_flexor', name: 'Half-Kneeling Hip Flexor Stretch', pattern: 'mobility',
    equipment: ['bodyweight'], unilateral: true, cnsLoad: 'low',
    coachingCues: ['Posteriorly tilt pelvis before leaning forward', 'Don\'t lean — drive hip forward', 'Breathe into the front of the hip'],
    contraindications: [],
    rationale: 'Restores hip extension ROM lost from prolonged sitting. Hip flexor tightness reduces stride length and increases lumbar extension stress during running.',
  },
  mobility_clamshell: {
    id: 'mobility_clamshell', name: 'Clamshell', pattern: 'mobility',
    equipment: ['bodyweight', 'band'], unilateral: true, cnsLoad: 'low',
    coachingCues: ['Feet stacked — pelvis still', 'Rotate the top knee open like a clamshell', 'Feel glute med — stop if you feel hip flexor'],
    contraindications: [],
    rationale: 'Glute medius activation and hip abductor endurance. Weakness here causes the lateral trunk sway and excessive Trendelenburg drop that overtax the IT band and knee.',
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
  rpe:          number;
  rationale:    string;
  purpose:      string;
};

const SESSION_TEMPLATES: Record<StrengthSessionType, SessionTemplate> = {
  full_body: {
    title:       'Full Body Strength',
    goal:        'force_production',
    duration:    50,
    patterns:    ['squat', 'hinge', 'lunge', 'trunk', 'calf_ankle'],
    exerciseIds: ['squat_goblet', 'hinge_rdl', 'lunge_reverse', 'trunk_dead_bug', 'calf_single_standing'],
    sets: 3, repRange: [6, 10], rpe: 7,
    rationale: 'Full-body compound loading in the base phase builds the structural foundation — bone density, tendon stiffness, motor unit recruitment — that all higher-intensity work builds upon. 3–4 sets at 70–80% 1RM optimises both hypertrophy and neural adaptations (Blagrove et al. 2018).',
    purpose: 'Build structural strength across all running-relevant movement patterns. This is the session that makes every other adaptation possible.',
  },
  lower_power: {
    title:       'Lower Body Power',
    goal:        'force_production',
    duration:    55,
    patterns:    ['squat', 'hinge', 'trunk', 'calf_ankle'],
    exerciseIds: ['squat_bulgarian', 'hinge_hip_thrust', 'hinge_nordic', 'trunk_copenhagen', 'calf_single_standing'],
    sets: 3, repRange: [5, 8], rpe: 8,
    rationale: 'High-intensity lower-body loading in the build phase converts aerobic base into race-specific power. Maximal force adaptations (Rønnestad & Mujika 2014) improve running economy by 2–8% — without any additional running volume.',
    purpose: 'Develop maximum lower-body force production to translate into faster race pace at lower RPE.',
  },
  running_economy: {
    title:       'Running Economy Session',
    goal:        'running_economy',
    duration:    45,
    patterns:    ['squat', 'hinge', 'plyometric', 'trunk', 'calf_ankle'],
    exerciseIds: ['squat_bulgarian', 'hinge_single_rdl', 'plyo_box_jump', 'trunk_bird_dog', 'calf_pogo'],
    sets: 3, repRange: [5, 8], rpe: 7,
    rationale: 'Explosive and reactive strength improves the elastic energy storage and return of the Achilles-calf complex. Paavolainen et al. (1999) demonstrated a 30-second 5k improvement with 9 weeks of explosive strength training, without any change in VO2max.',
    purpose: 'Improve running efficiency so the same effort produces more speed — targeting elastic energy return and neuromuscular firing rate.',
  },
  prehab: {
    title:       'Prehab & Resilience',
    goal:        'injury_resilience',
    duration:    30,
    patterns:    ['trunk', 'calf_ankle', 'mobility', 'pull'],
    exerciseIds: ['trunk_side_plank', 'calf_single_standing', 'mobility_clamshell', 'pull_band_pull', 'mobility_hip_flexor'],
    sets: 2, repRange: [10, 15], rpe: 5,
    rationale: 'Targeted prehabilitation maintains joint health and tissue resilience without adding meaningful fatigue. During deload and taper, this session protects the accumulated adaptations while allowing neuromuscular recovery.',
    purpose: 'Maintain tissue health, correct imbalances, and prepare for the next training block — without adding fatigue.',
  },
  activation: {
    title:       'Neuromuscular Activation',
    goal:        'taper_support',
    duration:    20,
    patterns:    ['squat', 'hinge', 'trunk', 'calf_ankle'],
    exerciseIds: ['squat_box', 'hinge_hip_thrust', 'trunk_bird_dog', 'calf_single_standing'],
    sets: 2, repRange: [8, 10], rpe: 5,
    rationale: 'Minimal-volume sessions during taper maintain neuromuscular potentiation without adding fatigue. The goal is to keep motor unit recruitment patterns "warm" so no fitness is lost in the final 10–14 days.',
    purpose: 'Stay sharp — keep the neuromuscular system primed without adding any meaningful fatigue before race day.',
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
  base: {
    beginner:     { sessionTypes: ['full_body'], sessionDays: [1], goal: 'force_production', phaseNote: 'Base: 1×/week full body', phaseRationale: 'New to strength training — one full-body session builds structural foundation without interference with running adaptation.' },
    intermediate: { sessionTypes: ['full_body', 'prehab'], sessionDays: [1, 4], goal: 'force_production', phaseNote: 'Base: 2×/week — strength + prehab', phaseRationale: 'Two sessions per week in base phase: one compound strength session and one prehab/accessory session. This is when the largest strength gains occur before race-specific running volume climbs.' },
    advanced:     { sessionTypes: ['full_body', 'lower_power'], sessionDays: [1, 4], goal: 'force_production', phaseNote: 'Base: 2×/week — full body + lower power', phaseRationale: 'Advanced athletes can handle higher strength loads in base phase. Two sessions target both structural strength and early force development.' },
  },
  build: {
    beginner:     { sessionTypes: ['prehab'], sessionDays: [2], goal: 'injury_resilience', phaseNote: 'Build: 1×/week prehab focus', phaseRationale: 'Running volume is climbing — one prehab session protects tissue health without adding CNS fatigue that would compromise key running sessions.' },
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
};

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

  // Injury risk: no high-CNS sessions
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

  return { ...config, sessionTypes, sessionDays, goal };
}

// ─── Build a single planned exercise ─────────────────────────────────────────

function buildExercise(
  id:       string,
  template: SessionTemplate,
  isDeload: boolean,
): PlannedExercise {
  const ex   = EXERCISES[id];
  if (!ex) throw new Error(`Unknown exercise id: ${id}`);

  const sets     = isDeload ? Math.max(1, template.sets - 1) : template.sets;
  const rpe      = isDeload ? Math.max(3, template.rpe - 2) : template.rpe;
  const rir      = 10 - rpe;
  const rest     = ex.cnsLoad === 'high' ? 120 : ex.cnsLoad === 'medium' ? 90 : 60;
  const tempo    = ex.pattern === 'plyometric' ? 'Explosive: fast concentric' : '3:1:1';
  const loadTarget =
    template.goal === 'force_production' ? `RPE ${rpe} — heavy, controlled` :
    template.goal === 'running_economy'  ? `RPE ${rpe} — moderate load, fast concentric` :
    template.goal === 'injury_resilience'? 'Light — technique focus' :
    template.goal === 'taper_support'    ? 'RPE 5 — sub-maximal, fresh feeling' :
    `RPE ${rpe}`;

  return {
    exerciseId:      id,
    exercise:        ex,
    sets,
    repRange:        isDeload
      ? [template.repRange[0] + 2, template.repRange[1] + 3]
      : template.repRange,
    loadTarget,
    rpe,
    rir,
    tempo,
    restSeconds:     rest,
    progressionRule: ex.cnsLoad === 'high'
      ? 'When top of rep range is reached for all sets at good technique, increase load by 2.5–5kg next session.'
      : 'Add 1 rep per set per week; once all sets hit top of range, increase load by 2.5kg and return to lower rep target.',
    regressionRule:  'If form deteriorates, reduce load by 10%. If fatigue prevents target reps, drop 1 set.',
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
  const template  = SESSION_TEMPLATES[sessionType];
  const isDeload  = phase === 'deload' || phase === 'taper' || input.fatigueScore > 75;
  const exercises = template.exerciseIds.map(id =>
    buildExercise(id, template, isDeload),
  );

  // Adjust duration for limited time
  const targetDuration = Math.min(input.availableTimeMin, template.duration);

  const id = `strength_${sessionType}_${weekInBlock}_${index}`;

  const progressionNote =
    phase === 'base'   ? `Block week ${weekInBlock}/4 — ${weekInBlock < 3 ? 'progressive loading' : 'peak volume week'}` :
    phase === 'build'  ? `Build phase — convert strength to power (${weekInBlock}/4)` :
    phase === 'peak'   ? 'Peak: maintenance — protect fitness, no new stimuli' :
    phase === 'deload' ? 'Deload: active recovery — movement quality over load' :
    'Taper: activation only — stay sharp, stay fresh';

  return {
    id,
    title:            template.title,
    goal:             template.goal,
    sessionType,
    targetDuration,
    primaryPatterns:  template.patterns,
    exercises,
    warmupProtocol:   'Dynamic warm-up: 5 min — leg swings (front/lateral), hip circles, glute bridges (2×10), and a light set of the first exercise at 40% load.',
    cooldownProtocol: 'Foam roll legs (IT band, hamstrings, quads) 60–90s per side. Hip flexor and calf stretches 30s per side.',
    purpose:          template.purpose,
    rationale:        template.rationale,
    progressionNote,
  };
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

  const baseConfig = PHASE_CONFIG[trainingPhase]?.[progressionLevel]
    ?? PHASE_CONFIG['base']!['intermediate']!;

  const config = applyStrengthAdaptations(baseConfig, input);

  const sessions = config.sessionTypes.map((sessionType, i) =>
    buildSession(sessionType, i, weekInBlock, trainingPhase, input),
  );

  const weeklyVolumeSets = sessions.reduce((s, sess) =>
    s + sess.exercises.reduce((es, ex) => es + ex.sets, 0), 0);

  return {
    sessions,
    sessionDays:      config.sessionDays,
    weeklyVolumeSets,
    primaryGoal:      config.goal,
    phaseNote:        config.phaseNote,
    phaseRationale:   config.phaseRationale,
    generatedAt:      Date.now(),
  };
}

// ─── Utility: look up exercise by ID ─────────────────────────────────────────

export function getExercise(id: string): Exercise | undefined {
  return EXERCISES[id];
}

// ─── Utility: strength load for a completed session ──────────────────────────
//
// Uses sets × reps × RPE factor (matching the scoring model above).

export function estimateSessionLoad(
  completedExercises: { sets: { reps: number; rpe?: number; completed: boolean }[] }[],
): number {
  return completedExercises.reduce((total, ex) => {
    return total + ex.sets.filter(s => s.completed).reduce((s, set) => {
      const rpe = set.rpe ?? 6;
      const factor = (rpe - 3) / 7;
      return s + set.reps * factor * 2;
    }, 0);
  }, 0);
}
