import { Platform } from 'react-native';
import * as Speech from 'expo-speech';
import { setAudioModeAsync } from 'expo-audio';

import { useSettingsStore } from '../store/settingsStore';
import { useVoiceLogStore } from '../store/voiceLogStore';
import type { VoiceCueCategory } from '../utils/voiceCoaching';
import {
  planVoiceCueDelivery,
  VOICE_CATEGORY_PRIORITY,
  type VoiceDeliveryState,
} from '../utils/voiceCoachDelivery';

type QueueItem = {
  cueId: string;
  text: string;
  category: VoiceCueCategory;
  priority: number;
  at: number;
};

const queue: QueueItem[] = [];
const lastCategoryPlayedAt: Partial<Record<VoiceCueCategory, number>> = {};
let speaking = false;
let audioSessionReady = false;

function makeCueId(category: VoiceCueCategory, now: number): string {
  return `voice_${category}_${now}_${Math.random().toString(36).slice(2, 7)}`;
}

function record(item: QueueItem, state: VoiceDeliveryState, reason?: string): void {
  useVoiceLogStore.getState().record({
    cueId: item.cueId,
    category: item.category,
    text: item.text,
    state,
    at: Date.now(),
    reason,
  });
}

async function ensureAudioSession(): Promise<void> {
  if (audioSessionReady) return;
  // duckOthers lowers music while a cue plays; shouldPlayInBackground:true lets
  // cues speak while the screen is locked / app is backgrounded during a run
  // (requires the `audio` UIBackgroundMode in app.json). This ducked mode must
  // be released once the queue empties — see releaseAudioSession — otherwise
  // the session stays active with duckOthers and music never returns to full
  // volume for the rest of the run.
  await setAudioModeAsync({
    playsInSilentMode: true,
    interruptionMode: 'duckOthers',
    allowsRecording: false,
    shouldPlayInBackground: true,
    shouldRouteThroughEarpiece: false,
  });
  audioSessionReady = true;
}

async function releaseAudioSession(): Promise<void> {
  if (!audioSessionReady) return;
  audioSessionReady = false;
  // Switch to a non-ducking, mixable mode so other apps' audio (the user's
  // music/podcast) returns to full volume after the last cue finishes. The
  // next cue calls ensureAudioSession() again and re-ducks.
  await setAudioModeAsync({
    playsInSilentMode: true,
    interruptionMode: 'mixWithOthers',
    allowsRecording: false,
    shouldPlayInBackground: true,
    shouldRouteThroughEarpiece: false,
  }).catch(() => undefined);
}

function drain(): void {
  if (speaking) return;
  if (queue.length === 0) {
    // Nothing left to say — let ducked music recover.
    void releaseAudioSession();
    return;
  }
  queue.sort((a, b) => b.priority - a.priority || a.at - b.at);
  const item = queue.shift();
  if (!item) return;
  speaking = true;
  void ensureAudioSession()
    .then(() => {
      Speech.speak(item.text, {
        rate: 0.92,
        pitch: 1,
        onDone: () => {
          speaking = false;
          lastCategoryPlayedAt[item.category] = Date.now();
          record(item, 'played');
          drain();
        },
        onStopped: () => {
          speaking = false;
          lastCategoryPlayedAt[item.category] = Date.now();
          record(item, 'played', 'stopped');
          drain();
        },
        onError: () => {
          speaking = false;
          record(item, 'failed', 'speech_error');
          drain();
        },
      });
    })
    .catch(() => {
      speaking = false;
      record(item, 'failed', 'audio_session_failed');
      drain();
    });
}

export function enqueueVoiceCoachCue(
  text: string,
  category: VoiceCueCategory = 'motivation',
): VoiceDeliveryState {
  const settings = useSettingsStore.getState();
  const now = Date.now();
  const item: QueueItem = {
    cueId: makeCueId(category, now),
    text: text.trim(),
    category,
    priority: VOICE_CATEGORY_PRIORITY[category],
    at: now,
  };
  const plan = planVoiceCueDelivery({
    text,
    category,
    mode: settings.voiceCueMode,
    preferences: settings.voiceCuePreferences,
    now,
    lastCategoryPlayedAt,
    platform: Platform.OS,
  });
  if (plan.state !== 'queued') {
    record(item, plan.state, plan.reason);
    return plan.state;
  }
  if (queue.at(-1)?.text === item.text) {
    record(item, 'suppressed', 'duplicate_tail');
    return 'suppressed';
  }
  queue.push(item);
  record(item, 'queued');
  drain();
  return 'queued';
}

export function clearVoiceCoachQueue(): void {
  queue.length = 0;
  speaking = false;
  void Speech.stop();
  // Release the ducked session immediately so music recovers even if no
  // onStopped callback fires (e.g. nothing was speaking when the run ended).
  void releaseAudioSession();
}

export function testVoiceCoaching(): VoiceDeliveryState {
  return enqueueVoiceCoachCue('StrideOS voice coaching test. Audio cues are ready.', 'motivation');
}
