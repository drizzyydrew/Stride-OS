import {
  clearVoiceCoachQueue,
  enqueueVoiceCoachCue,
} from './voiceCoach';
import type { VoiceCueCategory } from '../utils/voiceCoaching';

export function enqueueVoiceCue(
  text: string,
  category: VoiceCueCategory = 'motivation',
): ReturnType<typeof enqueueVoiceCoachCue> {
  return enqueueVoiceCoachCue(text, category);
}

export function clearVoiceCueQueue(): void {
  clearVoiceCoachQueue();
}
