import type { EquipmentOption } from '../types/strength';
import type { OwnerLease } from '../lib/localDataOwner';

export const STRENGTH_EQUIPMENT_OPTIONS: readonly { value: EquipmentOption; label: string }[] = [
  { value: 'dumbbell', label: 'Dumbbells' }, { value: 'kettlebell', label: 'Kettlebells' },
  { value: 'barbell', label: 'Barbell and plates' }, { value: 'band', label: 'Resistance bands' },
  { value: 'machine', label: 'Gym machines' },
];

/** Undefined means unknown; an explicit empty selection means bodyweight only. */
export function strengthEquipmentSelection(value: unknown): EquipmentOption[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return ['bodyweight', ...STRENGTH_EQUIPMENT_OPTIONS.filter(option => value.includes(option.value)).map(option => option.value)];
}

export function toggleStrengthEquipment(current: unknown, equipment: EquipmentOption, enabled: boolean): EquipmentOption[] {
  const selected = strengthEquipmentSelection(current) ?? ['bodyweight'];
  const next = enabled ? [...selected, equipment] : selected.filter(item => item !== equipment);
  return strengthEquipmentSelection(next)!;
}

export function strengthSessionMinutes(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 15 && value <= 120 ? Math.round(value) : undefined;
}

/** A draft stays on screen until its write is durable for the same owner. */
export async function saveStrengthFitDraft<T>(draft: T, deps: {
  ready: () => boolean;
  capture: () => OwnerLease | null;
  isCurrent: (lease: OwnerLease) => boolean;
  write: (draft: T) => void | Promise<void>;
}): Promise<void> {
  const lease = deps.capture();
  if (!deps.ready() || !lease || !deps.isCurrent(lease)) throw new Error('Profile is not ready');
  await deps.write(draft);
  if (!deps.isCurrent(lease)) throw new Error('The account changed');
}
