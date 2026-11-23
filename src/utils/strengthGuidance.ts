import { getExerciseGuide } from '../constants/exerciseGuides';
import { resolveExerciseMetadata, type ExerciseMetadataInput } from './exerciseCatalog';
import type { ExerciseGuidanceContent } from '../components/strength/exercise-guidance';

/** Retain the existing detailed exercise guide; catalog coaching covers
 * recognized custom/preset movements without inventing a measured sensation. */
export function strengthGuidance(input: ExerciseMetadataInput, cues?: string, fallbackHow?: string): ExerciseGuidanceContent {
  const metadata = resolveExerciseMetadata(input);
  const guide = getExerciseGuide(input.id ?? '') ?? getExerciseGuide(metadata.canonicalId)
    ?? getExerciseGuide((input.name ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '_'));
  const targets = metadata.primaryMuscles.join(', ');
  return {
    how: guide ? `Start: ${guide.startPosition}\nFinish: ${guide.finishPosition}\n${guide.howTo}` : fallbackHow || metadata.setup,
    cues: [cues, ...(guide?.tips ?? []), guide?.mistakes.length ? `Avoid: ${guide.mistakes.join(' ')}` : undefined]
      .filter(Boolean).join('\n') || 'Keep the setup repeatable and use an effort appropriate for today.',
    feel: metadata.kind === 'mobility' ? 'A mild, comfortable stretch or controlled movement without sharp or escalating symptoms.'
      : `Controlled working effort${targets ? ` through ${targets}` : ''}, with steady breathing and a repeatable range.`,
    stop: 'Stop or choose an easier load or range for pain, dizziness, or meaningful loss of control. For power work, stop before speed or landing quality drops.',
    easier: metadata.adjustment,
  };
}
