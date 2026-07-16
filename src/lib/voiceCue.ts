import * as Speech from 'expo-speech';

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

export function enqueueVoiceCue(text: string): void {
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
