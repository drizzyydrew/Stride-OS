export type AqiCategory =
  | 'Good'
  | 'Moderate'
  | 'Unhealthy for Sensitive Groups'
  | 'Unhealthy'
  | 'Very Unhealthy'
  | 'Hazardous';

export type AqiBand = {
  min: number;
  max: number;
  category: AqiCategory;
  color: string;
  guidance: string;
};

export const US_AQI_BANDS: AqiBand[] = [
  {
    min: 0,
    max: 50,
    category: 'Good',
    color: '#6CC24A',
    guidance: 'Air quality is generally suitable for most easy outdoor training.',
  },
  {
    min: 51,
    max: 100,
    category: 'Moderate',
    color: '#F4D35E',
    guidance: 'Most athletes can train normally; unusually sensitive athletes may choose easier effort.',
  },
  {
    min: 101,
    max: 150,
    category: 'Unhealthy for Sensitive Groups',
    color: '#F59E0B',
    guidance: 'Sensitive athletes may need easier intensity, more breaks, or an indoor option.',
  },
  {
    min: 151,
    max: 200,
    category: 'Unhealthy',
    color: '#EF4444',
    guidance: 'Consider moving harder or longer sessions indoors and reducing exposure.',
  },
  {
    min: 201,
    max: 300,
    category: 'Very Unhealthy',
    color: '#8B5CF6',
    guidance: 'Indoor training is usually the more conservative choice when practical.',
  },
  {
    min: 301,
    max: 500,
    category: 'Hazardous',
    color: '#7F1D1D',
    guidance: 'Avoid outdoor training when possible and follow local air-quality alerts.',
  },
];

export function normalizeAqiValue(value: number): number {
  return Math.min(500, Math.max(0, Math.round(value)));
}

export function getAqiBand(value: number): AqiBand {
  const normalized = normalizeAqiValue(value);
  return US_AQI_BANDS.find(band => normalized >= band.min && normalized <= band.max)
    ?? US_AQI_BANDS[US_AQI_BANDS.length - 1]!;
}

export function getAqiScalePosition(value: number): number {
  return normalizeAqiValue(value) / 500;
}

export function aqiVoiceOverLabel(value: number): string {
  const normalized = normalizeAqiValue(value);
  const band = getAqiBand(normalized);
  return `AQI ${normalized}, ${band.category}, range ${band.min} to ${band.max}. ${band.guidance}`;
}
