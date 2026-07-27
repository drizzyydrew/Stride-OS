import type { ReactNode } from 'react';

import { useExperienceModeAllows } from '../../hooks/useExperienceMode';
import type { ExperienceMode } from '../../store/settingsStore';

type Props = {
  min: ExperienceMode;
  children: ReactNode;
};

export default function ModeVisible({ min, children }: Props) {
  const visible = useExperienceModeAllows(min);
  return visible ? <>{children}</> : null;
}
