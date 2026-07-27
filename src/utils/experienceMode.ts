export type ExperienceMode = 'simple' | 'balanced' | 'data_rich';

const EXPERIENCE_MODE_RANK: Record<ExperienceMode, number> = {
  simple: 0,
  balanced: 1,
  data_rich: 2,
};

export function experienceModeAllows(mode: ExperienceMode, minimum: ExperienceMode): boolean {
  return EXPERIENCE_MODE_RANK[mode] >= EXPERIENCE_MODE_RANK[minimum];
}
