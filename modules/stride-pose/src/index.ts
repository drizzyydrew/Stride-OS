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

type StridePoseNativeModule = {
  isAvailable: () => boolean;
  detectPose: (uri: string) => Promise<PoseResult | null>;
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
