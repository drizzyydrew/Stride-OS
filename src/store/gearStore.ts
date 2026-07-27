import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { createAppJSONStorage } from './persistStorage';

export type Shoe = {
  id: string;
  brand: string;
  model: string;
  addedAt: number;
  active: boolean;
  typicalUse?: string;
  surface?: string;
  notes?: string;
  reminderThresholdMiles?: number;
};

export type EquipmentItem = {
  id: string;
  kind:
    | 'hr_strap'
    | 'bike'
    | 'trainer'
    | 'treadmill'
    | 'foot_pod'
    | 'cadence_sensor'
    | 'power_meter'
    | 'other';
  name: string;
  notes?: string;
  blePeripheralId?: string;
  active: boolean;
  addedAt: number;
};

type GearStore = {
  shoes: Shoe[];
  equipment: EquipmentItem[];
  defaultShoeId?: string;
  addShoe: (shoe: Omit<Shoe, 'id' | 'addedAt' | 'active'> & { id?: string; addedAt?: number; active?: boolean }) => string;
  updateShoe: (id: string, patch: Partial<Omit<Shoe, 'id' | 'addedAt'>>) => void;
  retireShoe: (id: string) => void;
  setDefaultShoe: (id: string | undefined) => void;
  addEquipment: (item: Omit<EquipmentItem, 'id' | 'addedAt' | 'active'> & { id?: string; addedAt?: number; active?: boolean }) => string;
  updateEquipment: (id: string, patch: Partial<Omit<EquipmentItem, 'id' | 'addedAt'>>) => void;
  retireEquipment: (id: string) => void;
};

function makeId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export const useGearStore = create<GearStore>()(
  persist(
    (set) => ({
      shoes: [],
      equipment: [],
      defaultShoeId: undefined,

      addShoe: input => {
        const id = input.id ?? makeId('shoe');
        set(state => ({
          shoes: [
            ...state.shoes,
            {
              ...input,
              id,
              brand: input.brand.trim(),
              model: input.model.trim(),
              active: input.active ?? true,
              addedAt: input.addedAt ?? Date.now(),
            },
          ],
          defaultShoeId: state.defaultShoeId ?? id,
        }));
        return id;
      },
      updateShoe: (id, patch) => set(state => ({
        shoes: state.shoes.map(shoe => shoe.id === id ? { ...shoe, ...patch } : shoe),
      })),
      retireShoe: id => set(state => ({
        shoes: state.shoes.map(shoe => shoe.id === id ? { ...shoe, active: false } : shoe),
        defaultShoeId: state.defaultShoeId === id ? undefined : state.defaultShoeId,
      })),
      setDefaultShoe: defaultShoeId => set({ defaultShoeId }),

      addEquipment: input => {
        const id = input.id ?? makeId('equipment');
        set(state => ({
          equipment: [
            ...state.equipment,
            {
              ...input,
              id,
              name: input.name.trim(),
              active: input.active ?? true,
              addedAt: input.addedAt ?? Date.now(),
            },
          ],
        }));
        return id;
      },
      updateEquipment: (id, patch) => set(state => ({
        equipment: state.equipment.map(item => item.id === id ? { ...item, ...patch } : item),
      })),
      retireEquipment: id => set(state => ({
        equipment: state.equipment.map(item => item.id === id ? { ...item, active: false } : item),
      })),
    }),
    {
      name: 'gear-store',
      version: 1,
      storage: createAppJSONStorage(),
      merge: (persisted, current) => {
        const saved = persisted as Partial<GearStore> | undefined;
        return {
          ...current,
          ...saved,
          shoes: saved?.shoes ?? [],
          equipment: saved?.equipment ?? [],
        };
      },
    },
  ),
);
