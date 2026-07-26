// ─── Exercise Library Store ───────────────────────────────────────────────────
//
// Catalogue of built-in exercises + user-defined custom exercises.
// Each exercise has a category, primary muscles, and movement pattern.
// Used by LogWorkoutModal to provide searchable autocomplete.
//
// No business logic — pure storage + CRUD.

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createAppJSONStorage } from './persistStorage';
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { StrengthFocus } from '../types/customWorkout';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ExerciseCategory = StrengthFocus;

export type MovementPattern =
  | 'hinge'
  | 'squat'
  | 'push'
  | 'pull'
  | 'carry'
  | 'core_anti_extension'
  | 'core_anti_rotation'
  | 'core_anti_lateral'
  | 'isometric'
  | 'plyometric'
  | 'single_leg'
  | 'stretch';

export type Exercise = {
  id:              string;
  name:            string;
  category:        ExerciseCategory;
  movementPattern: MovementPattern;
  primaryMuscles:  string[];
  isCustom:        boolean;
  notes?:          string;
  photoUri?:        string;
};

type ExerciseStore = {
  exercises:    Exercise[];
  addExercise:  (ex: Omit<Exercise, 'id' | 'isCustom'>) => string;
  editExercise: (id: string, patch: Partial<Omit<Exercise, 'id' | 'isCustom'>>) => void;
  deleteExercise: (id: string) => void;
  getByCategory:  (cat: ExerciseCategory) => Exercise[];
  search:          (query: string) => Exercise[];
};

// ─── Built-in catalogue ───────────────────────────────────────────────────────
//
// Conservative list of well-established exercises appropriate for runners.
// Ordered roughly from highest to lowest evidence for running performance.

const BUILTIN: Omit<Exercise, 'isCustom'>[] = [
  // Lower
  { id: 'b_nordic_curl',     name: 'Nordic Hamstring Curl',   category: 'lower',           movementPattern: 'hinge',      primaryMuscles: ['hamstrings'] },
  { id: 'b_slr_calf',        name: 'Single-Leg Calf Raise',   category: 'lower',           movementPattern: 'single_leg', primaryMuscles: ['gastrocnemius', 'soleus'] },
  { id: 'b_soleus_raise',    name: 'Bent-Knee Calf Raise',    category: 'lower',           movementPattern: 'single_leg', primaryMuscles: ['soleus'] },
  { id: 'b_rdl',             name: 'Romanian Deadlift',        category: 'lower',           movementPattern: 'hinge',      primaryMuscles: ['hamstrings', 'glutes'] },
  { id: 'b_bss',             name: 'Bulgarian Split Squat',    category: 'lower',           movementPattern: 'squat',      primaryMuscles: ['quads', 'glutes'] },
  { id: 'b_hip_thrust',      name: 'Hip Thrust',               category: 'lower',           movementPattern: 'hinge',      primaryMuscles: ['glutes'] },
  { id: 'b_step_up',         name: 'Step-Up',                  category: 'lower',           movementPattern: 'single_leg', primaryMuscles: ['quads', 'glutes'] },
  { id: 'b_deadlift',        name: 'Deadlift',                 category: 'lower',           movementPattern: 'hinge',      primaryMuscles: ['hamstrings', 'glutes', 'back'] },
  { id: 'b_squat',           name: 'Barbell Squat',            category: 'lower',           movementPattern: 'squat',      primaryMuscles: ['quads', 'glutes'] },
  { id: 'b_goblet_squat',    name: 'Goblet Squat',             category: 'lower',           movementPattern: 'squat',      primaryMuscles: ['quads', 'glutes'] },
  { id: 'b_lunge',           name: 'Reverse Lunge',            category: 'lower',           movementPattern: 'single_leg', primaryMuscles: ['quads', 'glutes'] },
  { id: 'b_step_down',       name: 'Eccentric Step-Down',      category: 'lower',           movementPattern: 'single_leg', primaryMuscles: ['quads', 'glutes'] },
  { id: 'b_leg_curl',        name: 'Leg Curl',                 category: 'lower',           movementPattern: 'hinge',      primaryMuscles: ['hamstrings'] },
  { id: 'b_tibialis',        name: 'Tibialis Anterior Raise',  category: 'lower',           movementPattern: 'isometric',  primaryMuscles: ['tibialis anterior'] },
  // Upper
  { id: 'b_pushup',          name: 'Push-Up',                  category: 'upper',           movementPattern: 'push',       primaryMuscles: ['pecs', 'triceps'] },
  { id: 'b_row',             name: 'Dumbbell Row',             category: 'upper',           movementPattern: 'pull',       primaryMuscles: ['lats', 'rhomboids'] },
  { id: 'b_pull_apart',      name: 'Band Pull-Apart',          category: 'upper',           movementPattern: 'pull',       primaryMuscles: ['rear delts', 'rhomboids'] },
  { id: 'b_face_pull',       name: 'Face Pull',                category: 'upper',           movementPattern: 'pull',       primaryMuscles: ['rear delts', 'rotator cuff'] },
  { id: 'b_ohp',             name: 'Overhead Press',           category: 'upper',           movementPattern: 'push',       primaryMuscles: ['delts', 'triceps'] },
  { id: 'b_pullup',          name: 'Pull-Up',                  category: 'upper',           movementPattern: 'pull',       primaryMuscles: ['lats', 'biceps'] },
  { id: 'b_lat_raise',       name: 'Lateral Raise',            category: 'upper',           movementPattern: 'push',       primaryMuscles: ['delts'] },
  // Core
  { id: 'b_dead_bug',        name: 'Dead Bug',                 category: 'core',            movementPattern: 'core_anti_extension', primaryMuscles: ['transverse abdominis', 'obliques'] },
  { id: 'b_plank',           name: 'Plank',                    category: 'core',            movementPattern: 'isometric',  primaryMuscles: ['core'] },
  { id: 'b_side_plank',      name: 'Side Plank',               category: 'core',            movementPattern: 'core_anti_lateral', primaryMuscles: ['obliques', 'glute med'] },
  { id: 'b_bird_dog',        name: 'Bird Dog',                 category: 'core',            movementPattern: 'core_anti_extension', primaryMuscles: ['erectors', 'glutes', 'core'] },
  { id: 'b_pallof',          name: 'Pallof Press',             category: 'core',            movementPattern: 'core_anti_rotation', primaryMuscles: ['obliques', 'core'] },
  { id: 'b_copenhagen',      name: 'Copenhagen Plank',         category: 'core',            movementPattern: 'core_anti_lateral', primaryMuscles: ['adductors', 'obliques'] },
  { id: 'b_rke',             name: 'Reverse Knee Extension',   category: 'core',            movementPattern: 'isometric',  primaryMuscles: ['VMO', 'core'] },
  // Full body
  { id: 'b_kb_swing',        name: 'Kettlebell Swing',         category: 'full_body',       movementPattern: 'hinge',      primaryMuscles: ['hamstrings', 'glutes', 'core'] },
  { id: 'b_thruster',        name: 'Thruster',                 category: 'full_body',       movementPattern: 'squat',      primaryMuscles: ['quads', 'delts', 'core'] },
  { id: 'b_suitcase_carry',  name: 'Suitcase Carry',           category: 'full_body',       movementPattern: 'carry',      primaryMuscles: ['obliques', 'traps', 'glutes'] },
  // Power
  { id: 'b_box_jump',        name: 'Box Jump',                 category: 'power',           movementPattern: 'plyometric', primaryMuscles: ['quads', 'glutes', 'calves'] },
  { id: 'b_bound',           name: 'Plyometric Bound',         category: 'power',           movementPattern: 'plyometric', primaryMuscles: ['glutes', 'calves', 'hamstrings'] },
  { id: 'b_depth_jump',      name: 'Depth Jump',               category: 'power',           movementPattern: 'plyometric', primaryMuscles: ['quads', 'glutes', 'calves'] },
  { id: 'b_jump_squat',      name: 'Jump Squat',               category: 'power',           movementPattern: 'plyometric', primaryMuscles: ['quads', 'glutes'] },
  // Tendon capacity
  { id: 'b_isometric_calf',  name: 'Isometric Calf Hold',      category: 'tendon_capacity', movementPattern: 'isometric',  primaryMuscles: ['Achilles tendon', 'calves'] },
  { id: 'b_seated_calf',     name: 'Seated Calf Raise (Heavy)',category: 'tendon_capacity', movementPattern: 'isometric',  primaryMuscles: ['soleus', 'Achilles tendon'] },
  { id: 'b_patellar_iso',    name: 'Isometric Leg Extension',  category: 'tendon_capacity', movementPattern: 'isometric',  primaryMuscles: ['patellar tendon', 'quads'] },
  { id: 'b_hip_abduction',   name: 'Side-Lying Hip Abduction', category: 'tendon_capacity', movementPattern: 'single_leg', primaryMuscles: ['glute med', 'TFL'] },
  // Mobility / prehab
  { id: 'b_hip_9090',        name: 'Hip 90/90 Stretch',        category: 'mobility_prehab', movementPattern: 'stretch',    primaryMuscles: ['hip flexors', 'piriformis'] },
  { id: 'b_hip_flexor',      name: 'Hip Flexor Stretch',       category: 'mobility_prehab', movementPattern: 'stretch',    primaryMuscles: ['hip flexors', 'psoas'] },
  { id: 'b_calf_stretch',    name: 'Calf Stretch (Bent/Straight)', category: 'mobility_prehab', movementPattern: 'stretch', primaryMuscles: ['gastrocnemius', 'soleus'] },
  { id: 'b_clam',            name: 'Band Clamshell',           category: 'mobility_prehab', movementPattern: 'single_leg', primaryMuscles: ['glute med'] },
  { id: 'b_foam_roll',       name: 'Foam Roll (General)',       category: 'mobility_prehab', movementPattern: 'stretch',    primaryMuscles: ['IT band', 'quads', 'calves'] },
  { id: 'b_ankle_mob',       name: 'Ankle Mobility Drill',     category: 'mobility_prehab', movementPattern: 'stretch',    primaryMuscles: ['ankle', 'calves'] },
];

const BUILTIN_EXERCISES: Exercise[] = BUILTIN.map(e => ({ ...e, isCustom: false }));

// ─── Store ────────────────────────────────────────────────────────────────────

export const useExerciseStore = create<ExerciseStore>()(
  persist(
    (set, get) => ({
      exercises: BUILTIN_EXERCISES,

      addExercise: (ex) => {
        const id = `ex_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const record: Exercise = { ...ex, id, isCustom: true };
        set(state => ({ exercises: [...state.exercises, record] }));
        return id;
      },

      editExercise: (id, patch) =>
        set(state => ({
          exercises: state.exercises.map(e => e.id === id ? { ...e, ...patch } : e),
        })),

      deleteExercise: (id) =>
        set(state => ({
          exercises: state.exercises.filter(e => e.id !== id || !e.isCustom),
        })),

      getByCategory: (cat) =>
        get().exercises.filter(e => e.category === cat),

      search: (query) => {
        const q = query.toLowerCase();
        return get().exercises.filter(e =>
          e.name.toLowerCase().includes(q) ||
          e.primaryMuscles.some(m => m.toLowerCase().includes(q)),
        );
      },
    }),
    {
      name:    'exercise-store',
      storage: createAppJSONStorage(),
      partialize: (state) => ({
        // Only persist custom exercises — built-ins are always derived from code
        exercises: state.exercises.filter(e => e.isCustom),
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Merge persisted custom exercises with current built-ins
          const customIds = new Set(state.exercises.map(e => e.id));
          const builtins  = BUILTIN_EXERCISES.filter(e => !customIds.has(e.id));
          state.exercises = [...builtins, ...state.exercises];
        }
      },
    },
  ),
);
