// ─── Strength Preset Workout Bank (Build 36) ───────────────────────────────
//
// Self-contained static data — mirrors the pattern of mobilityBank.ts but
// does not import any store or engine. The adaptive training plan (see
// src/store/strengthStore.ts / src/utils/*) remains the primary, personalized
// strength recommendation; this bank is a browsable preset library sitting
// alongside it. Language stays evidence-safe: "may support", "estimated",
// no diagnosis or guarantee claims. Ids are stable (`sw_<slug>`) — once
// shipped, do not rename or remove an id; downstream logging may reference it.

export type StrengthEquipment =
  | 'barbell'
  | 'squat_rack'
  | 'bench'
  | 'dumbbell'
  | 'kettlebell'
  | 'band'
  | 'bodyweight';

export type StrengthPresetCategory =
  | 'recommended'
  | 'full_body'
  | 'upper_body'
  | 'lower_body'
  | 'runner_strength'
  | 'gym_barbell'
  | 'dumbbell'
  | 'kettlebell'
  | 'bodyweight'
  | 'pre_run'
  | 'post_run_recovery'
  | 'problem_area';

export type PresetStrengthExercise = {
  name:       string;
  sets:       number;
  reps:       string;
  equipment:  StrengthEquipment[];
  notes?:     string;
};

export type PresetStrengthWorkout = {
  id:           string;
  title:        string;
  description:  string;
  durationMin:  number;
  equipment:    StrengthEquipment[];
  categories:   StrengthPresetCategory[];
  exercises:    PresetStrengthExercise[];
};

function ex(name: string, sets: number, reps: string, equipment: StrengthEquipment[], notes?: string): PresetStrengthExercise {
  return notes ? { name, sets, reps, equipment, notes } : { name, sets, reps, equipment };
}

function workoutEquipment(exercises: PresetStrengthExercise[]): StrengthEquipment[] {
  const set = new Set<StrengthEquipment>();
  exercises.forEach(e => e.equipment.forEach(eq => set.add(eq)));
  return Array.from(set);
}

function preset(
  id: string,
  title: string,
  description: string,
  durationMin: number,
  categories: StrengthPresetCategory[],
  exercises: PresetStrengthExercise[],
): PresetStrengthWorkout {
  return { id, title, description, durationMin, equipment: workoutEquipment(exercises), categories, exercises };
}

// ─── Gym / Barbell (15 — barbell, squat rack, deadlift, and bench combinations) ──

const GYM_BARBELL: PresetStrengthWorkout[] = [
  preset('sw_barbell_full_body_strength_a', 'Full-Body Barbell Strength A', 'A classic barbell full-body session covering a squat, a press, and a hinge/pull pattern.', 45, ['recommended', 'gym_barbell', 'full_body'], [
    ex('Back Squat', 4, '6-8', ['barbell', 'squat_rack']),
    ex('Bench Press', 4, '6-8', ['barbell', 'bench']),
    ex('Bent-Over Row', 3, '8-10', ['barbell']),
    ex('Plank', 3, '30-45s', ['bodyweight']),
  ]),
  preset('sw_barbell_full_body_strength_b', 'Full-Body Barbell Strength B', 'A second full-body barbell session to rotate with Strength A across the week.', 45, ['gym_barbell', 'full_body'], [
    ex('Deadlift', 4, '5', ['barbell']),
    ex('Overhead Press', 4, '6-8', ['barbell']),
    ex('Front Squat', 3, '6-8', ['barbell', 'squat_rack']),
    ex('Barbell Row', 3, '8-10', ['barbell']),
  ]),
  preset('sw_barbell_lower_body_squat_focus', 'Lower Body — Squat Focus', 'A squat-centered lower-body session with posterior-chain and calf accessory work.', 45, ['gym_barbell', 'lower_body'], [
    ex('Back Squat', 4, '6-8', ['barbell', 'squat_rack']),
    ex('Romanian Deadlift', 3, '8-10', ['barbell'], 'Soft knee bend, hinge from the hips.'),
    ex('Walking Lunge', 3, '10 per leg', ['dumbbell']),
    ex('Standing Calf Raise', 3, '12-15', ['barbell']),
  ]),
  preset('sw_barbell_deadlift_day', 'Deadlift Day', 'A hinge-pattern session built around the deadlift with posterior-chain accessories.', 45, ['gym_barbell', 'lower_body'], [
    ex('Conventional Deadlift', 5, '5', ['barbell']),
    ex('Barbell Row', 4, '8-10', ['barbell']),
    ex('Barbell Hip Thrust', 3, '8-10', ['barbell', 'bench']),
    ex('Plank', 3, '30-45s', ['bodyweight']),
  ]),
  preset('sw_barbell_bench_press_day', 'Bench Press Day', 'A pressing-focused upper-body session built around bench press variations.', 40, ['gym_barbell', 'upper_body'], [
    ex('Bench Press', 5, '5', ['barbell', 'bench']),
    ex('Incline Bench Press', 3, '8-10', ['barbell', 'bench']),
    ex('Barbell Row', 3, '8-10', ['barbell']),
    ex('Bodyweight Dip', 3, '8-12', ['bodyweight']),
  ]),
  preset('sw_barbell_upper_body_push_pull', 'Upper Body Push/Pull', 'Balances pressing and pulling volume in one barbell upper-body session.', 40, ['gym_barbell', 'upper_body'], [
    ex('Bench Press', 4, '6-8', ['barbell', 'bench']),
    ex('Overhead Press', 3, '6-8', ['barbell']),
    ex('Barbell Row', 4, '8-10', ['barbell']),
    ex('Pull-Up', 3, 'AMRAP', ['bodyweight']),
  ]),
  preset('sw_barbell_squat_rack_strength', 'Squat Rack Strength', 'Three squat-rack variations in one session to build well-rounded lower-body strength.', 45, ['gym_barbell', 'lower_body'], [
    ex('Back Squat', 4, '6-8', ['barbell', 'squat_rack']),
    ex('Front Squat', 3, '6-8', ['barbell', 'squat_rack']),
    ex('Box Squat', 3, '5', ['barbell', 'squat_rack'], 'Sit back to the box, pause briefly, drive up.'),
    ex('Plank', 3, '30-45s', ['bodyweight']),
  ]),
  preset('sw_barbell_posterior_chain', 'Posterior Chain Builder', 'Targets the hamstrings, glutes, and low back with barbell hinge and row patterns.', 40, ['gym_barbell', 'lower_body'], [
    ex('Romanian Deadlift', 4, '8-10', ['barbell']),
    ex('Barbell Hip Thrust', 4, '8-10', ['barbell', 'bench']),
    ex('Barbell Row', 3, '8-10', ['barbell']),
    ex('Back Extension', 3, '10-12', ['bodyweight']),
  ]),
  preset('sw_barbell_runner_strength_gym', 'Runner Strength — Gym Session', 'Barbell strength work chosen for carryover to running: squat, single-leg hinge, and calf capacity.', 40, ['recommended', 'gym_barbell', 'runner_strength'], [
    ex('Back Squat', 4, '6-8', ['barbell', 'squat_rack']),
    ex('Single-Leg Romanian Deadlift', 3, '8 per leg', ['dumbbell'], 'Slow and controlled — balance first, load second.'),
    ex('Standing Calf Raise', 3, '12-15', ['barbell']),
    ex('Plank', 3, '30-45s', ['bodyweight']),
  ]),
  preset('sw_barbell_beginner_full_body', 'Beginner Barbell Full Body', 'An introductory full-body barbell session with lighter prescribed loads to build technique first.', 40, ['gym_barbell', 'full_body'], [
    ex('Back Squat', 3, '8-10', ['barbell', 'squat_rack'], 'Start light — this session is about groove, not load.'),
    ex('Bench Press', 3, '8-10', ['barbell', 'bench']),
    ex('Barbell Row', 3, '8-10', ['barbell']),
    ex('Plank', 2, '20-30s', ['bodyweight']),
  ]),
  preset('sw_barbell_strength_5x5', 'Classic 5x5 Strength', 'A straightforward 5x5 strength template across the three foundational barbell lifts.', 45, ['gym_barbell', 'full_body'], [
    ex('Back Squat', 5, '5', ['barbell', 'squat_rack']),
    ex('Bench Press', 5, '5', ['barbell', 'bench']),
    ex('Barbell Row', 5, '5', ['barbell']),
  ]),
  preset('sw_barbell_push_day', 'Barbell Push Day', 'A pressing-focused session for the chest, shoulders, and triceps.', 40, ['gym_barbell', 'upper_body'], [
    ex('Bench Press', 4, '6-8', ['barbell', 'bench']),
    ex('Overhead Press', 4, '6-8', ['barbell']),
    ex('Close-Grip Bench Press', 3, '8-10', ['barbell', 'bench']),
    ex('Plank', 3, '30-45s', ['bodyweight']),
  ]),
  preset('sw_barbell_pull_day', 'Barbell Pull Day', 'A pulling-focused session for the back, hamstrings, and grip.', 40, ['gym_barbell', 'upper_body'], [
    ex('Deadlift', 4, '5', ['barbell']),
    ex('Barbell Row', 4, '8-10', ['barbell']),
    ex('Barbell Shrug', 3, '10-12', ['barbell']),
    ex('Band Face Pull', 3, '12-15', ['band']),
  ]),
  preset('sw_barbell_leg_day', 'Barbell Leg Day', 'A complete lower-body barbell session covering squat, hinge, lunge, and calf patterns.', 45, ['gym_barbell', 'lower_body'], [
    ex('Back Squat', 4, '6-8', ['barbell', 'squat_rack']),
    ex('Romanian Deadlift', 3, '8-10', ['barbell']),
    ex('Barbell Walking Lunge', 3, '8 per leg', ['barbell']),
    ex('Standing Calf Raise', 3, '12-15', ['barbell']),
  ]),
  preset('sw_barbell_total_body_power', 'Total-Body Barbell Power', 'Hinge, press, squat, and row in one session for well-rounded barbell strength.', 45, ['gym_barbell', 'full_body'], [
    ex('Trap Bar Deadlift', 4, '5', ['barbell']),
    ex('Push Press', 3, '6-8', ['barbell']),
    ex('Front Squat', 3, '6-8', ['barbell', 'squat_rack']),
    ex('Barbell Row', 3, '8-10', ['barbell']),
  ]),
];

// ─── Dumbbell (10) ────────────────────────────────────────────────────────────

const DUMBBELL: PresetStrengthWorkout[] = [
  preset('sw_dumbbell_full_body_a', 'Full-Body Dumbbell A', 'A dumbbell-only full-body session hitting squat, press, and row patterns.', 35, ['recommended', 'dumbbell', 'full_body'], [
    ex('Goblet Squat', 4, '10-12', ['dumbbell']),
    ex('Dumbbell Bench Press', 3, '8-10', ['dumbbell', 'bench']),
    ex('One-Arm Dumbbell Row', 3, '10 per side', ['dumbbell']),
    ex('Plank', 3, '30s', ['bodyweight']),
  ]),
  preset('sw_dumbbell_full_body_b', 'Full-Body Dumbbell B', 'A second dumbbell full-body session to rotate through the week.', 35, ['dumbbell', 'full_body'], [
    ex('Dumbbell Romanian Deadlift', 4, '10-12', ['dumbbell']),
    ex('Dumbbell Shoulder Press', 3, '8-10', ['dumbbell']),
    ex('Reverse Lunge', 3, '10 per leg', ['dumbbell']),
    ex('Dumbbell Row', 3, '10 per side', ['dumbbell']),
  ]),
  preset('sw_dumbbell_upper_body', 'Dumbbell Upper Body', 'Upper-body pressing and pulling using only dumbbells.', 35, ['dumbbell', 'upper_body'], [
    ex('Dumbbell Bench Press', 4, '8-10', ['dumbbell', 'bench']),
    ex('Dumbbell Row', 4, '10 per side', ['dumbbell']),
    ex('Dumbbell Shoulder Press', 3, '8-10', ['dumbbell']),
    ex('Dumbbell Curl', 2, '10-12', ['dumbbell']),
  ]),
  preset('sw_dumbbell_lower_body', 'Dumbbell Lower Body', 'Lower-body strength using goblet, lunge, and single-leg dumbbell patterns.', 35, ['dumbbell', 'lower_body'], [
    ex('Goblet Squat', 4, '10-12', ['dumbbell']),
    ex('Dumbbell Romanian Deadlift', 3, '10-12', ['dumbbell']),
    ex('Walking Lunge', 3, '10 per leg', ['dumbbell']),
    ex('Dumbbell Calf Raise', 3, '15', ['dumbbell']),
  ]),
  preset('sw_dumbbell_runner_strength', 'Runner Strength — Dumbbell', 'Single-leg-biased dumbbell work chosen for running-relevant strength and balance.', 35, ['recommended', 'dumbbell', 'runner_strength'], [
    ex('Single-Leg Romanian Deadlift', 3, '8 per leg', ['dumbbell'], 'Balance first, load second.'),
    ex('Reverse Lunge', 3, '10 per leg', ['dumbbell']),
    ex('Dumbbell Calf Raise', 3, '15 per leg', ['dumbbell']),
    ex('Plank', 3, '30s', ['bodyweight']),
  ]),
  preset('sw_dumbbell_single_leg_focus', 'Single-Leg Focus — Dumbbell', 'A unilateral-emphasis session to build side-to-side strength and control.', 35, ['dumbbell', 'lower_body', 'problem_area'], [
    ex('Bulgarian Split Squat', 3, '8 per leg', ['dumbbell'], 'Rear foot elevated on a bench.'),
    ex('Single-Leg Romanian Deadlift', 3, '8 per leg', ['dumbbell']),
    ex('Single-Leg Calf Raise', 3, '12 per leg', ['dumbbell']),
  ]),
  preset('sw_dumbbell_core_and_stability', 'Core & Stability — Dumbbell', 'Anti-rotation and carry work to build trunk control with light dumbbell load.', 30, ['dumbbell', 'full_body'], [
    ex('Dumbbell Farmer Carry', 3, '30-40m', ['dumbbell']),
    ex('Dumbbell Suitcase Carry', 3, '20-30m per side', ['dumbbell']),
    ex('Plank', 3, '30-45s', ['bodyweight']),
    ex('Side Plank', 3, '20-30s per side', ['bodyweight']),
  ]),
  preset('sw_dumbbell_push_pull', 'Dumbbell Push/Pull', 'Balances pressing and pulling volume with dumbbells only.', 35, ['dumbbell', 'upper_body'], [
    ex('Dumbbell Bench Press', 4, '8-10', ['dumbbell', 'bench']),
    ex('Dumbbell Row', 4, '10 per side', ['dumbbell']),
    ex('Dumbbell Shoulder Press', 3, '8-10', ['dumbbell']),
    ex('Dumbbell Reverse Fly', 3, '12', ['dumbbell']),
  ]),
  preset('sw_dumbbell_beginner_full_body', 'Beginner Dumbbell Full Body', 'An introductory dumbbell full-body session for building base strength and technique.', 30, ['dumbbell', 'full_body'], [
    ex('Goblet Squat', 3, '10-12', ['dumbbell']),
    ex('Dumbbell Bench Press', 3, '10-12', ['dumbbell', 'bench']),
    ex('Dumbbell Row', 3, '10 per side', ['dumbbell']),
    ex('Plank', 2, '20s', ['bodyweight']),
  ]),
  preset('sw_dumbbell_glute_focus', 'Glute Focus — Dumbbell', 'Hip-hinge and single-leg dumbbell work to emphasize the glutes and hamstrings.', 35, ['dumbbell', 'lower_body'], [
    ex('Dumbbell Romanian Deadlift', 4, '10-12', ['dumbbell']),
    ex('Dumbbell Hip Thrust', 3, '10-12', ['dumbbell', 'bench']),
    ex('Reverse Lunge', 3, '10 per leg', ['dumbbell']),
  ]),
];

// ─── Kettlebell (8) ───────────────────────────────────────────────────────────

const KETTLEBELL: PresetStrengthWorkout[] = [
  preset('sw_kettlebell_full_body_a', 'Full-Body Kettlebell A', 'A kettlebell full-body session built around the swing, goblet squat, and row.', 30, ['recommended', 'kettlebell', 'full_body'], [
    ex('Kettlebell Swing', 4, '15', ['kettlebell']),
    ex('Kettlebell Goblet Squat', 3, '10-12', ['kettlebell']),
    ex('Kettlebell Row', 3, '10 per side', ['kettlebell']),
    ex('Plank', 3, '30s', ['bodyweight']),
  ]),
  preset('sw_kettlebell_full_body_b', 'Full-Body Kettlebell B', 'A second kettlebell full-body session with different movement patterns.', 30, ['kettlebell', 'full_body'], [
    ex('Kettlebell Deadlift', 4, '10-12', ['kettlebell']),
    ex('Kettlebell Single-Arm Press', 3, '8 per side', ['kettlebell']),
    ex('Kettlebell Reverse Lunge', 3, '8 per leg', ['kettlebell']),
  ]),
  preset('sw_kettlebell_swing_focus', 'Kettlebell Swing Focus', 'A conditioning-leaning session built around swing volume and hip-hinge power.', 25, ['kettlebell', 'full_body'], [
    ex('Kettlebell Swing', 5, '15-20', ['kettlebell']),
    ex('Kettlebell Goblet Squat', 3, '10', ['kettlebell']),
    ex('Plank', 3, '30s', ['bodyweight']),
  ]),
  preset('sw_kettlebell_lower_body', 'Kettlebell Lower Body', 'Squat, hinge, and lunge patterns using a single kettlebell.', 30, ['kettlebell', 'lower_body'], [
    ex('Kettlebell Goblet Squat', 4, '10-12', ['kettlebell']),
    ex('Kettlebell Deadlift', 3, '10-12', ['kettlebell']),
    ex('Kettlebell Reverse Lunge', 3, '8 per leg', ['kettlebell']),
  ]),
  preset('sw_kettlebell_core_and_carry', 'Core & Carry — Kettlebell', 'Loaded carries and anti-rotation core work with a kettlebell.', 25, ['kettlebell', 'full_body'], [
    ex('Kettlebell Farmer Carry', 3, '30-40m', ['kettlebell']),
    ex('Kettlebell Suitcase Carry', 3, '20-30m per side', ['kettlebell']),
    ex('Side Plank', 3, '20-30s per side', ['bodyweight']),
  ]),
  preset('sw_kettlebell_runner_strength', 'Runner Strength — Kettlebell', 'Hip-hinge and single-leg kettlebell work chosen for running-relevant power and control.', 30, ['recommended', 'kettlebell', 'runner_strength'], [
    ex('Kettlebell Swing', 4, '15', ['kettlebell']),
    ex('Kettlebell Single-Leg Deadlift', 3, '8 per leg', ['kettlebell']),
    ex('Kettlebell Reverse Lunge', 3, '8 per leg', ['kettlebell']),
  ]),
  preset('sw_kettlebell_beginner', 'Beginner Kettlebell Full Body', 'An introductory kettlebell session to build technique on the swing, squat, and row.', 25, ['kettlebell', 'full_body'], [
    ex('Kettlebell Goblet Squat', 3, '10', ['kettlebell']),
    ex('Kettlebell Swing', 3, '10-12', ['kettlebell'], 'Hinge from the hips, not a squat-and-lift.'),
    ex('Kettlebell Row', 3, '10 per side', ['kettlebell']),
  ]),
  preset('sw_kettlebell_conditioning_strength', 'Kettlebell Conditioning Strength', 'Higher-rep kettlebell circuit blending strength and light conditioning.', 30, ['kettlebell', 'full_body'], [
    ex('Kettlebell Swing', 4, '20', ['kettlebell']),
    ex('Kettlebell Goblet Squat', 4, '15', ['kettlebell']),
    ex('Kettlebell Row', 3, '12 per side', ['kettlebell']),
    ex('Plank', 3, '30-45s', ['bodyweight']),
  ]),
];

// ─── Bodyweight (8) ───────────────────────────────────────────────────────────

const BODYWEIGHT: PresetStrengthWorkout[] = [
  preset('sw_bodyweight_full_body_a', 'Full-Body Bodyweight A', 'A no-equipment full-body session for hotel rooms, travel, or equipment-free days.', 25, ['recommended', 'bodyweight', 'full_body'], [
    ex('Bodyweight Squat', 4, '15-20', ['bodyweight']),
    ex('Push-Up', 3, '10-15', ['bodyweight']),
    ex('Reverse Lunge', 3, '10 per leg', ['bodyweight']),
    ex('Plank', 3, '30-45s', ['bodyweight']),
  ]),
  preset('sw_bodyweight_full_body_b', 'Full-Body Bodyweight B', 'A second no-equipment full-body session to rotate with Bodyweight A.', 25, ['bodyweight', 'full_body'], [
    ex('Glute Bridge', 3, '15', ['bodyweight']),
    ex('Push-Up', 3, '10-15', ['bodyweight']),
    ex('Step-Up', 3, '10 per leg', ['bodyweight'], 'Use a stair or sturdy low bench.'),
    ex('Side Plank', 3, '20-30s per side', ['bodyweight']),
  ]),
  preset('sw_bodyweight_lower_body', 'Bodyweight Lower Body', 'Squat, lunge, and single-leg patterns with no equipment.', 25, ['bodyweight', 'lower_body'], [
    ex('Bodyweight Squat', 4, '15-20', ['bodyweight']),
    ex('Reverse Lunge', 3, '10 per leg', ['bodyweight']),
    ex('Single-Leg Glute Bridge', 3, '10 per leg', ['bodyweight']),
    ex('Calf Raise', 3, '15-20', ['bodyweight']),
  ]),
  preset('sw_bodyweight_upper_body', 'Bodyweight Upper Body', 'Push and pull patterns using only bodyweight.', 20, ['bodyweight', 'upper_body'], [
    ex('Push-Up', 4, '10-15', ['bodyweight']),
    ex('Pull-Up', 3, 'AMRAP', ['bodyweight'], 'Substitute inverted rows if no bar is available.'),
    ex('Pike Push-Up', 3, '8-10', ['bodyweight']),
  ]),
  preset('sw_bodyweight_core', 'Bodyweight Core', 'A core-focused circuit covering anti-extension, anti-rotation, and lateral stability.', 20, ['bodyweight', 'full_body'], [
    ex('Plank', 3, '30-45s', ['bodyweight']),
    ex('Side Plank', 3, '20-30s per side', ['bodyweight']),
    ex('Dead Bug', 3, '10 per side', ['bodyweight']),
    ex('Bird Dog', 3, '10 per side', ['bodyweight']),
  ]),
  preset('sw_bodyweight_single_leg_focus', 'Single-Leg Focus — Bodyweight', 'Unilateral bodyweight work to build side-to-side control without equipment.', 25, ['bodyweight', 'lower_body', 'problem_area'], [
    ex('Single-Leg Glute Bridge', 3, '10 per leg', ['bodyweight']),
    ex('Step-Up', 3, '10 per leg', ['bodyweight']),
    ex('Single-Leg Calf Raise', 3, '12 per leg', ['bodyweight']),
    ex('Bulgarian Split Squat (Bodyweight)', 3, '8 per leg', ['bodyweight']),
  ]),
  preset('sw_bodyweight_travel_friendly', 'Travel-Friendly Bodyweight Session', 'A compact, quiet, no-equipment session for small spaces and travel.', 20, ['bodyweight', 'full_body'], [
    ex('Bodyweight Squat', 3, '15', ['bodyweight']),
    ex('Push-Up', 3, '10-12', ['bodyweight']),
    ex('Glute Bridge', 3, '15', ['bodyweight']),
    ex('Plank', 3, '30s', ['bodyweight']),
  ]),
  preset('sw_bodyweight_beginner_full_body', 'Beginner Bodyweight Full Body', 'An introductory no-equipment session to build a strength-training habit.', 20, ['bodyweight', 'full_body'], [
    ex('Bodyweight Squat', 3, '10-12', ['bodyweight']),
    ex('Knee Push-Up', 3, '8-10', ['bodyweight'], 'Standard push-up progression — knees down.'),
    ex('Glute Bridge', 3, '12', ['bodyweight']),
    ex('Plank', 2, '15-20s', ['bodyweight']),
  ]),
];

// ─── Band, pre-run, post-run recovery, problem area (9) ───────────────────────

const OTHER: PresetStrengthWorkout[] = [
  preset('sw_band_activation_pre_run', 'Band Activation — Pre-Run', 'A short band-based activation circuit to prime the hips and glutes before running.', 10, ['pre_run'], [
    ex('Band Lateral Walk', 2, '10 per side', ['band']),
    ex('Band Glute Bridge', 2, '15', ['band']),
    ex('Band Clamshell', 2, '12 per side', ['band']),
  ]),
  preset('sw_band_glute_activation', 'Band Glute Activation', 'Targeted glute-activation work using a light resistance band, useful before lower-body sessions or runs.', 10, ['pre_run', 'problem_area'], [
    ex('Band Clamshell', 3, '12 per side', ['band']),
    ex('Band Lateral Walk', 3, '10 per side', ['band']),
    ex('Band Glute Bridge', 3, '15', ['band']),
  ]),
  preset('sw_band_upper_body', 'Band Upper Body', 'A light, joint-friendly upper-body session using only a resistance band.', 20, ['bodyweight', 'upper_body'], [
    ex('Band Row', 3, '12-15', ['band']),
    ex('Band Chest Press', 3, '12-15', ['band']),
    ex('Band Face Pull', 3, '15', ['band']),
    ex('Band Pull-Apart', 3, '15', ['band']),
  ]),
  preset('sw_post_run_recovery_bodyweight', 'Post-Run Recovery — Bodyweight', 'A light, low-fatigue bodyweight session appropriate on easy or recovery days.', 15, ['post_run_recovery', 'bodyweight'], [
    ex('Glute Bridge', 2, '15', ['bodyweight']),
    ex('Dead Bug', 2, '10 per side', ['bodyweight']),
    ex('Side Plank', 2, '20s per side', ['bodyweight']),
  ]),
  preset('sw_post_run_recovery_dumbbell', 'Post-Run Recovery — Light Dumbbell', 'A light dumbbell session with reduced volume for recovery days.', 20, ['post_run_recovery', 'dumbbell'], [
    ex('Goblet Squat', 2, '10', ['dumbbell'], 'Keep the load light — this is a recovery-day session.'),
    ex('Dumbbell Row', 2, '10 per side', ['dumbbell']),
    ex('Plank', 2, '30s', ['bodyweight']),
  ]),
  preset('sw_problem_area_calf_capacity', 'Problem Area — Calf Capacity', 'Loaded calf work for athletes whose readiness assessment flagged reduced calf capacity.', 20, ['problem_area', 'lower_body'], [
    ex('Standing Calf Raise', 4, '12-15', ['barbell'], 'Substitute bodyweight or dumbbell if no barbell is available.'),
    ex('Single-Leg Calf Raise', 3, '12 per leg', ['bodyweight']),
  ]),
  preset('sw_problem_area_single_leg_control', 'Problem Area — Single-Leg Control', 'Unilateral strength work for athletes flagged with reduced single-leg control.', 25, ['problem_area', 'runner_strength'], [
    ex('Single-Leg Romanian Deadlift', 3, '8 per leg', ['dumbbell']),
    ex('Bulgarian Split Squat', 3, '8 per leg', ['dumbbell']),
    ex('Single-Leg Glute Bridge', 3, '10 per leg', ['bodyweight']),
  ]),
  preset('sw_problem_area_hip_stability', 'Problem Area — Hip Stability', 'Band and bodyweight work targeting hip stability for athletes flagged on trunk/pelvic control.', 20, ['problem_area'], [
    ex('Band Clamshell', 3, '12 per side', ['band']),
    ex('Band Lateral Walk', 3, '10 per side', ['band']),
    ex('Side Plank', 3, '20-30s per side', ['bodyweight']),
  ]),
  preset('sw_runner_strength_hybrid', 'Runner Strength — Hybrid Session', 'A mixed-equipment session combining barbell, dumbbell, and bodyweight work chosen for running-relevant strength.', 35, ['recommended', 'runner_strength', 'full_body'], [
    ex('Back Squat', 3, '6-8', ['barbell', 'squat_rack']),
    ex('Single-Leg Romanian Deadlift', 3, '8 per leg', ['dumbbell']),
    ex('Standing Calf Raise', 3, '15', ['bodyweight']),
    ex('Plank', 3, '30-45s', ['bodyweight']),
  ]),
];

export const STRENGTH_PRESET_WORKOUTS: PresetStrengthWorkout[] = [
  ...GYM_BARBELL,
  ...DUMBBELL,
  ...KETTLEBELL,
  ...BODYWEIGHT,
  ...OTHER,
];

export function getStrengthPresetWorkout(id: string): PresetStrengthWorkout | undefined {
  return STRENGTH_PRESET_WORKOUTS.find(w => w.id === id);
}

export function getStrengthPresetWorkoutsByCategory(category: StrengthPresetCategory): PresetStrengthWorkout[] {
  return STRENGTH_PRESET_WORKOUTS.filter(w => w.categories.includes(category));
}

export const STRENGTH_PRESET_CATEGORY_LABELS: Record<StrengthPresetCategory, string> = {
  recommended:        'Recommended For You',
  full_body:          'Full Body',
  upper_body:         'Upper Body',
  lower_body:         'Lower Body',
  runner_strength:    'Runner Strength',
  gym_barbell:        'Gym & Barbell',
  dumbbell:           'Dumbbell',
  kettlebell:         'Kettlebell',
  bodyweight:         'Bodyweight',
  pre_run:            'Pre-Run',
  post_run_recovery:  'Post-Run Recovery',
  problem_area:       'Problem Area',
};
