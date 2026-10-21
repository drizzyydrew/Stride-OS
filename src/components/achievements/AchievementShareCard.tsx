import BadgeShareCanvas from '../share/BadgeShareCanvas';
import type { UnitSystem } from '../../store/settingsStore';
import type { AchievementDefinition } from '../../utils/achievements';

export type AchievementShareVariant = 'badge_square' | 'story_poster' | 'photo_overlay';

type Props = {
  achievement: AchievementDefinition;
  variant: AchievementShareVariant;
  detail?: string;
  units?: UnitSystem;
  canvasRef?: RefObject<View | null>;
};

// Retain the existing export filename IDs while sharing one badge-only renderer.
export const ACHIEVEMENT_SHARE_VARIANTS: Array<{ id: AchievementShareVariant; label: string; description: string }> = [
  { id: 'story_poster', label: 'Minimal', description: 'Badge and StrideOS' },
  { id: 'photo_overlay', label: 'Transparent Overlay', description: 'Transparent background' },
  { id: 'badge_square', label: 'Editorial', description: 'Light background' },
];

export default function AchievementShareCard({ achievement, variant, units = 'imperial', canvasRef }: Props) {
  return <BadgeShareCanvas achievement={{ ...achievement, state: 'earned' }} units={units}
    variant={variant === 'photo_overlay' ? 'transparent_overlay' : variant === 'badge_square' ? 'editorial_card' : 'minimal_card'}
    format={variant === 'story_poster' ? 'story' : 'square'} canvasRef={canvasRef} />;
}
import type { RefObject } from 'react';
import type { View } from 'react-native';
