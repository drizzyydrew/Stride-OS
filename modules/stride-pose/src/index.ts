import { Platform } from 'react-native';
import { requireNativeModule } from 'expo-modules-core';

// ─── stride-pose JS interface ─────────────────────────────────────────────────
//
// Thin, graceful wrapper over the native Apple Vision module. In Expo Go, on
// Android, or on any failure this resolves to null — callers must treat null
// as "pose unavailable" and keep the manual analysis path fully usable.

export type PoseJointName =
  | 'nose' | 'neck'
  | 'left_shoulder' | 'right_shoulder'
  | 'left_elbow' | 'right_elbow'
  | 'left_wrist' | 'right_wrist'
  | 'left_hip' | 'right_hip' | 'mid_hip'
  | 'left_knee' | 'right_knee'
  | 'left_ankle' | 'right_ankle';

export type PoseJoint = {
  name: PoseJointName;
  x: number;          // 0…1, normalized, origin top-left
  y: number;          // 0…1, normalized, origin top-left
  confidence: number; // 0…1
};

export type PoseResult = {
  imageWidth: number;
  imageHeight: number;
  joints: PoseJoint[];
};

// ─── Video sequence types ─────────────────────────────────────────────────────

export type PoseSequenceFrame = {
  timeMs: number;
  joints: PoseJoint[];   // empty array = no person confidently detected this frame
};

export type PoseSequenceResult = {
  durationMs:  number;   // full source video duration
  analyzedMs:  number;   // portion actually analyzed (capped by maxDurationMs)
  imageWidth:  number;   // upright display width
  imageHeight: number;   // upright display height
  frames:      PoseSequenceFrame[];
};

export type PoseSequenceOptions = {
  fps?: number;              // sampling rate, native clamps to 4–15
  maxDurationMs?: number;    // native clamps to 1_000–90_000
  onProgress?: (processed: number, total: number) => void;
};

type PoseSequenceProgressEvent = { processed: number; total: number };

/** Matches expo-modules-core's EventEmitter#addListener return shape without
 *  depending on its (ambiguously re-exported) generic NativeModule type. */
type EventSubscription = { remove: () => void };

type StridePoseNativeModule = {
  isAvailable: () => boolean;
  detectPose: (uri: string) => Promise<PoseResult | null>;
  detectPoseSequence: (
    uri: string,
    options: { fps?: number; maxDurationMs?: number },
  ) => Promise<PoseSequenceResult | null>;
  addListener: (
    eventName: 'onPoseSequenceProgress',
    listener: (event: PoseSequenceProgressEvent) => void,
  ) => EventSubscription;
};

let cached: StridePoseNativeModule | null | undefined;

function getModule(): StridePoseNativeModule | null {
  if (Platform.OS !== 'ios') return null;
  if (cached !== undefined) return cached;
  try {
    cached = requireNativeModule<StridePoseNativeModule>('StridePose');
  } catch {
    cached = null; // Expo Go / module not compiled — manual analysis still works
  }
  return cached;
}

export function isPoseEstimationAvailable(): boolean {
  const mod = getModule();
  if (!mod) return false;
  try {
    return mod.isAvailable();
  } catch {
    return false;
  }
}

// Resolves null when no person is detected, pose is unavailable on this
// build/platform, or detection fails — never throws into the UI.
export async function detectPose(imageUri: string): Promise<PoseResult | null> {
  const mod = getModule();
  if (!mod) return null;
  try {
    return await mod.detectPose(imageUri);
  } catch {
    return null;
  }
}

// Samples a recorded video at ~fps and runs on-device pose detection per
// sampled frame. Resolves null on non-iOS, an unavailable module, or any
// native failure — callers must keep the manual analysis path usable.
// Always removes its progress subscription, on success or failure.
export async function detectPoseSequence(
  videoUri: string,
  options?: PoseSequenceOptions,
): Promise<PoseSequenceResult | null> {
  const mod = getModule();
  if (!mod) return null;

  const subscription = options?.onProgress
    ? mod.addListener('onPoseSequenceProgress', (event) => {
        options.onProgress?.(event.processed, event.total);
      })
    : null;

  try {
    return await mod.detectPoseSequence(videoUri, {
      fps:           options?.fps,
      maxDurationMs: options?.maxDurationMs,
    });
  } catch {
    return null;
  } finally {
    subscription?.remove();
  }
}
