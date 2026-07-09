// ─── Pose Sequence Storage ──────────────────────────────────────────────────────
//
// Full frame-by-frame PoseSequenceResult (raw landmarks for every analyzed
// frame) is too large to keep inline in the zustand/AsyncStorage-persisted
// MovementAnalysis record — 60s at 12fps is ~720 frames × up to 15 joints.
// It's written once as JSON under the app's document directory and referenced
// by `poseSequenceUri` on the analysis; angle series / key frames (small,
// already smoothed + decimated) stay inline so most screens never need to
// read this file at all.

import * as FileSystem from 'expo-file-system/legacy';
import type { PoseSequenceResult } from 'stride-pose';

const POSE_SEQUENCE_DIR = `${FileSystem.documentDirectory}movement-pose/`;

function uriFor(analysisId: string): string {
  return `${POSE_SEQUENCE_DIR}${analysisId}.json`;
}

/** Writes the full pose sequence to disk and returns its URI. */
export async function savePoseSequence(analysisId: string, result: PoseSequenceResult): Promise<string> {
  await FileSystem.makeDirectoryAsync(POSE_SEQUENCE_DIR, { intermediates: true }).catch(() => {});
  const uri = uriFor(analysisId);
  await FileSystem.writeAsStringAsync(uri, JSON.stringify(result));
  return uri;
}

/** Loads a previously saved pose sequence. Resolves null (never throws) when
 *  the file is missing or unreadable — callers must fall back gracefully
 *  (overlay off, a note shown) rather than blocking the screen. */
export async function loadPoseSequence(uri: string | undefined | null): Promise<PoseSequenceResult | null> {
  if (!uri) return null;
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists) return null;
    const raw = await FileSystem.readAsStringAsync(uri);
    return JSON.parse(raw) as PoseSequenceResult;
  } catch {
    return null;
  }
}

/** Best-effort delete — never throws. Only removes files this module wrote. */
export async function deletePoseSequence(uri: string | undefined | null): Promise<void> {
  if (!uri || !uri.startsWith(POSE_SEQUENCE_DIR)) return;
  await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
}
