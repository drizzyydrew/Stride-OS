import type { PresetStrengthWorkout } from '../constants/strengthBank';
import type { MobilityExercise, MobilityWorkout } from '../types/mobility';
import { resolveExerciseMetadata } from './exerciseCatalog';

export type WorkoutLibraryFilters = {
  categories: string[];
  muscles: string[];
  equipment: string[];
  maxMinutes: number | null;
};
export type WorkoutLibraryItem = {
  id: string;
  durationMin: number;
  categories: readonly string[];
  muscles: readonly string[];
  equipment: readonly string[];
};
export const emptyWorkoutLibraryFilters = (): WorkoutLibraryFilters => ({ categories: [], muscles: [], equipment: [], maxMinutes: null });
export function copyWorkoutLibraryFilters(value: WorkoutLibraryFilters): WorkoutLibraryFilters {
  return { categories: [...value.categories], muscles: [...value.muscles], equipment: [...value.equipment], maxMinutes: value.maxMinutes };
}
export function toggleLibraryFilter(values: readonly string[], key: string, checked: boolean): string[] {
  return checked ? [...new Set([...values, key])] : values.filter(value => value !== key);
}
export function libraryFilterCount(filters: WorkoutLibraryFilters): number {
  return filters.categories.length + filters.muscles.length + filters.equipment.length + (filters.maxMinutes == null ? 0 : 1);
}
export function matchesWorkoutLibraryFilters(item: WorkoutLibraryItem, filters: WorkoutLibraryFilters): boolean {
  if (filters.maxMinutes != null && (!Number.isFinite(item.durationMin) || item.durationMin <= 0 || item.durationMin > filters.maxMinutes)) return false;
  if (filters.categories.length && !filters.categories.some(value => item.categories.includes(value))) return false;
  if (!filters.muscles.every(value => item.muscles.includes(value))) return false;
  if (!filters.equipment.every(value => item.equipment.includes(value))) return false;
  return true;
}
export function uniqueLibraryTags(values: readonly string[]): string[] {
  return [...new Set(values.map(value => value.trim().toLowerCase()).filter(Boolean))].sort();
}
export function presetLibraryItem(workout: PresetStrengthWorkout): WorkoutLibraryItem {
  return { id: workout.id, durationMin: workout.durationMin, categories: workout.categories,
    muscles: uniqueLibraryTags(workout.exercises.flatMap(exercise => resolveExerciseMetadata({ name: exercise.name }).primaryMuscles)),
    equipment: uniqueLibraryTags(workout.equipment) };
}
export function mobilityLibraryItem(workout: MobilityWorkout, exercises: readonly MobilityExercise[]): WorkoutLibraryItem {
  const selected = workout.exercises.flatMap(planned => {
    const exercise = exercises.find(value => value.id === planned.exerciseId);
    if (!exercise) return [];
    const metadata = resolveExerciseMetadata({ id: exercise.id, name: exercise.name, targetArea: exercise.targetArea });
    return [...metadata.primaryMuscles, ...metadata.mobilityTargets];
  });
  return { id: workout.id, durationMin: workout.durationMin, categories: workout.categories, muscles: uniqueLibraryTags(selected), equipment: [] };
}
