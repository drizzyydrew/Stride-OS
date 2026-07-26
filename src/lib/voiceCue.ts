import * as Speech from 'expo-speech';
import { useSettingsStore } from '../store/settingsStore';
import {
  shouldSpeakVoiceCue,
  type VoiceCueCategory,
} from '../utils/voiceCoaching';

const queue: string[] = [];
let speaking = false;

function drain() {
  if (speaking || queue.length === 0) return;
  const text = queue.shift();
  if (!text) return;
  speaking = true;
  Speech.speak(text, {
    rate: 0.92,
    pitch: 1,
    onDone: () => { speaking = false; drain(); },
    onStopped: () => { speaking = false; drain(); },
    onError: () => { speaking = false; drain(); },
  });
}

export function enqueueVoiceCue(
  text: string,
  category: VoiceCueCategory = 'motivation',
): void {
  const settings = useSettingsStore.getState();
  if (!shouldSpeakVoiceCue(
    settings.voiceCueMode,
    settings.voiceCuePreferences,
    category,
  )) return;
  const normalized = text.trim();
  if (!normalized || queue.at(-1) === normalized) return;
  queue.push(normalized);
  drain();
}

export function clearVoiceCueQueue(): void {
  queue.length = 0;
  speaking = false;
  void Speech.stop();
}
