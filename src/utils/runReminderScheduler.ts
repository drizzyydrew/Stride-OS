export type ReminderScheduleState = {
  lastHydrationCueSec: number;
  lastFuelCueSec: number;
};

export type RunReminderInput = ReminderScheduleState & {
  elapsedSeconds: number;
  isActive: boolean;
  isPaused: boolean;
  hydrationEnabled: boolean;
  hydrationIntervalMin: number;
  fuelEnabled: boolean;
  fuelIntervalMin: number;
  fluidOzPerHour: number;
  carbsGPerHour: number;
};

export type RunReminderCue = {
  kind: 'hydration' | 'fuel' | 'combined';
  spokenText: string;
  visualText: string;
  hydrationAmountOz?: number;
  fuelAmountG?: number;
  nextState: ReminderScheduleState;
};

function amountPerCue(hourly: number, intervalMin: number): number {
  return Math.max(0, hourly * intervalMin / 60);
}

export function evaluateRunReminders(input: RunReminderInput): RunReminderCue | null {
  if (!input.isActive || input.isPaused || input.elapsedSeconds <= 0) return null;
  const hydrationDue = input.hydrationEnabled
    && input.elapsedSeconds - input.lastHydrationCueSec >= input.hydrationIntervalMin * 60;
  const fuelDue = input.fuelEnabled
    && input.elapsedSeconds - input.lastFuelCueSec >= input.fuelIntervalMin * 60;
  if (!hydrationDue && !fuelDue) return null;

  const hydrationAmountOz = Math.max(1, Math.round(amountPerCue(input.fluidOzPerHour, input.hydrationIntervalMin)));
  const fuelAmountG = Math.max(1, Math.round(amountPerCue(input.carbsGPerHour, input.fuelIntervalMin) / 5) * 5);
  const nextState = {
    lastHydrationCueSec: hydrationDue ? input.elapsedSeconds : input.lastHydrationCueSec,
    lastFuelCueSec: fuelDue ? input.elapsedSeconds : input.lastFuelCueSec,
  };

  if (hydrationDue && fuelDue) {
    const text = `Hydration and fuel reminder. Drink approximately ${hydrationAmountOz} ounces and take approximately ${fuelAmountG} grams of carbohydrate.`;
    return { kind: 'combined', spokenText: text, visualText: text, hydrationAmountOz, fuelAmountG, nextState };
  }
  if (hydrationDue) {
    const text = `Hydration reminder. Drink approximately ${hydrationAmountOz} ounces.`;
    return { kind: 'hydration', spokenText: text, visualText: text, hydrationAmountOz, nextState };
  }
  const text = `Fuel reminder. Take approximately ${fuelAmountG} grams of carbohydrate.`;
  return { kind: 'fuel', spokenText: text, visualText: text, fuelAmountG, nextState };
}
