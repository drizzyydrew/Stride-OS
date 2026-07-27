import { useSettingsStore, type ExperienceMode } from '../store/settingsStore';
import { experienceModeAllows } from '../utils/experienceMode';

export { experienceModeAllows };

export function useExperienceMode(): ExperienceMode {
  return useSettingsStore(state => state.experienceMode);
}

export function useExperienceModeAllows(minimum: ExperienceMode): boolean {
  const mode = useExperienceMode();
  return experienceModeAllows(mode, minimum);
}
