const DISPLAY_LABELS: Record<string, string> = {
  body_weight: 'Bodyweight',
  bodyweight: 'Bodyweight',
  cross_country_skiing: 'Cross-country skiing',
  downhill_skiing: 'Downhill skiing',
  heart_rate: 'Heart rate',
  indoor_cycling: 'Indoor cycling',
  mixed_modal: 'Mixed-modal',
  resistance_band: 'Resistance band',
  run_walk: 'Run / Walk',
  snowboarding: 'Snowboarding',
  squat_rack: 'Squat rack',
};

export function displayLabel(value: string | null | undefined): string {
  const normalized = value?.trim();
  if (!normalized) return '';
  const exact = DISPLAY_LABELS[normalized.toLowerCase()];
  if (exact) return exact;

  const words = normalized
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  if (!words) return '';
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function displayLabels(values: readonly string[]): string {
  return values.map(displayLabel).filter(Boolean).join(', ');
}

export const displayLabelMap = DISPLAY_LABELS;
