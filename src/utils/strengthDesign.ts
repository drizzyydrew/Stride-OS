import type { EquipmentOption, Exercise, PlannedExercise } from '../types/strength';
import type { ProgressionLevel, StrengthLevel } from '../types/training';
import { strengthEquipmentSelection } from './strengthSessionFit';

/** Running experience is never used to infer lifting experience. */
export function strengthProgressionLevel(level: StrengthLevel | undefined): ProgressionLevel {
  return level === 'advanced' || level === 'intermediate' ? level : 'beginner';
}

export function strengthTimeBudget(value: number | undefined): number {
  return Number.isFinite(value) && value! > 0 ? Math.max(5, Math.min(180, Math.floor(value!))) : 60;
}

export function strengthWeightForDisplay(weight: unknown, unit: unknown, load: unknown, displayUnit: 'lb' | 'kg'): number | null {
  const parsed = typeof load === 'string' ? load.trim().match(/^(\d+(?:\.\d+)?)\s*(lb|lbs|kg)$/i) : null;
  const structured = typeof weight === 'number' && Number.isFinite(weight) && weight > 0;
  if (structured && unit !== 'lb' && unit !== 'kg') return null;
  const value = structured ? weight : parsed ? Number(parsed[1]) : null;
  const from = structured ? unit : parsed ? /^kg$/i.test(parsed[2]!) ? 'kg' : 'lb' : null;
  if (value === null || !from) return typeof load === 'string' && /^bw$/i.test(load.trim()) ? 0 : null;
  return Math.round(value * (from === displayUnit ? 1 : displayUnit === 'lb' ? 2.2046226218 : 1 / 2.2046226218) * 10) / 10;
}

/** Planning estimate, not measured duration. Includes both sides, rest, setup,
 * warm-up and cooldown. It must not label an untrimmed50-minute list as20min. */
export function estimateStrengthSessionMinutes(exercises: PlannedExercise[]): number {
  if (!exercises.length) return 0;
  const seconds = exercises.reduce((total, ex) => {
    const scheme = ex.repScheme;
    const perSide = scheme?.perSide ?? ex.exercise.unilateral;
    const sides = perSide ? 2 : 1;
    const work = scheme?.kind === 'duration' ? (scheme.secondsMax ?? scheme.secondsMin) * sides
      : scheme?.kind === 'distance' ? (scheme.metersMax ?? scheme.metersMin) / 0.8 * sides
      : ((ex.repRange[0] + ex.repRange[1]) / 2) * (3 + (scheme?.kind === 'reps_hold' ? scheme.holdSeconds : 0)) * sides;
    return total + ex.sets * (work + ex.restSeconds) + 15;
  }, 8 * 60);
  return Math.ceil(seconds / 60);
}

export function fitStrengthSessionToTime(exercises: PlannedExercise[], minutes: number): PlannedExercise[] {
  const fitted = exercises.map(ex => ({ ...ex }));
  for (let i = fitted.length - 1; i >= 0 && estimateStrengthSessionMinutes(fitted) > minutes; i--) {
    while (fitted[i]!.sets > 2 && estimateStrengthSessionMinutes(fitted) > minutes) fitted[i]!.sets--;
  }
  // The first three roles preserve a lower-body, push and pull stimulus when
  // possible. Supporting roles can move to another session in a short week.
  while (fitted.length > 3 && estimateStrengthSessionMinutes(fitted) > minutes) fitted.pop();
  for (let i = fitted.length - 1; i >= 0 && estimateStrengthSessionMinutes(fitted) > minutes; i--) {
    if (fitted[i]!.sets > 1) fitted[i]!.sets--;
  }
  while (fitted.length && estimateStrengthSessionMinutes(fitted) > minutes) fitted.pop();
  return fitted;
}

const EQUIPMENT_FALLBACK: Record<string, string> = {
  hike_step_up: 'lunge_reverse', hike_step_down: 'lunge_reverse',
  ski_split_squat: 'lunge_reverse', ski_lateral_lunge: 'lunge_reverse',
  snowboard_offset_squat: 'squat_box', snowboard_lateral_step: 'lunge_reverse', snowboard_pallof: 'trunk_dead_bug',
  xc_straight_arm_pull: 'pull_band_row', xc_single_leg_step: 'lunge_reverse',
  mountaineering_step_up: 'lunge_reverse',
  foot_loaded_single_calf: 'foot_supported_calf', foot_loaded_bent_knee: 'foot_supported_calf', foot_loaded_seated: 'foot_supported_calf',
  squat_goblet: 'squat_box', squat_bulgarian: 'lunge_reverse', hinge_rdl: 'hinge_hip_thrust',
  hinge_single_rdl: 'hinge_hip_thrust', push_db_press: 'push_pushup', pull_row: 'pull_band_row',
  calf_seated: 'calf_single_standing',
};

export function strengthExercisesForEquipment(ids: string[], equipment: EquipmentOption[] | undefined, library: Record<string, Exercise>): string[] {
  const selection = strengthEquipmentSelection(equipment);
  if (!selection) return [...ids]; // Unknown is not a claim of a specific gym setup.
  const available = new Set<EquipmentOption>(selection);
  const supports = (id: string) => library[id]?.equipment.some(item => available.has(item));
  return [...new Set(ids.flatMap(id => {
    if (supports(id)) return [id];
    const alternative = EQUIPMENT_FALLBACK[id];
    return alternative && supports(alternative) ? [alternative] : [];
  }))];
}

export function strengthExerciseEquipment(exercise: Exercise, equipment: EquipmentOption[] | undefined): EquipmentOption[] {
  const selection = strengthEquipmentSelection(equipment);
  return selection ? exercise.equipment.filter(option => selection.includes(option)) : [...exercise.equipment];
}

export function strengthExerciseReviewNote(week: number): string {
  const block = Math.floor((Math.max(1, week) - 1) / 6) + 1;
  return `Practice block ${block}: keep useful main lifts while performance improves. At a six-week review, consider same-role accessory alternatives for fit or enjoyment; a new exercise or setup needs its own starting load. Change dose from actual performance and recovery, not simply from the week number.`;
}
