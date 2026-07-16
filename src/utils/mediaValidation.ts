// ─── Media Validation ────────────────────────────────────────────────────────
//
// Pure validation for a picked (ImagePicker) or recorded (TimedCaptureCamera)
// video before it enters the analysis pipeline. Returns a specific error code
// + user-facing message — never a generic "something went wrong". The
// file-info lookup is injectable so this stays testable with node:test and
// no Expo runtime.
//
// See docs/build36-fable-ticket.md ("Capture workflow (Agent B)").

import {
  MAX_CLIP_DURATION_MS,
  MAX_CLIP_SIZE_BYTES,
  SUPPORTED_VIDEO_EXTENSIONS,
  SUPPORTED_VIDEO_MIME_TYPES,
  type SupportedVideoExtension,
} from '../constants/captureConfig';

// ─── Types ────────────────────────────────────────────────────────────────────

export type MediaValidationErrorCode =
  | 'too_long'
  | 'unsupported_type'
  | 'too_large'
  | 'icloud_unavailable'
  | 'unreadable'
  | 'decode_failed';

export type MediaValidationError = {
  code:    MediaValidationErrorCode;
  message: string;
};

/** Minimal shape shared by ImagePicker assets and TimedCaptureCamera results. */
export type PickedVideoAsset = {
  uri:       string;
  fileName?: string | null;
  duration?: number | null;   // ms
  fileSize?: number | null;   // bytes
  mimeType?: string | null;
};

export type FileInfoResult = {
  exists: boolean;
  size?:  number;
};

export type FileInfoFn = (uri: string) => Promise<FileInfoResult>;

// ─── Messages ─────────────────────────────────────────────────────────────────

const MSG_TOO_LONG =
  `This clip is longer than the ${Math.round(MAX_CLIP_DURATION_MS / 1000)}-second maximum. Trim it or record a shorter clip.`;
const MSG_UNSUPPORTED_TYPE =
  `This file type isn't supported for analysis. Use a ${SUPPORTED_VIDEO_EXTENSIONS.map(e => `.${e}`).join(', ')} video.`;
const MSG_TOO_LARGE =
  `This video is larger than the ${Math.round(MAX_CLIP_SIZE_BYTES / (1024 * 1024))} MB limit. Choose a shorter or lower-resolution clip.`;
const MSG_ICLOUD_UNAVAILABLE =
  "This video could not be downloaded from iCloud. Check your connection and try again.";
const MSG_UNREADABLE =
  "This video file couldn't be read. Try picking it again or choose a different clip.";
const MSG_DECODE_FAILED =
  "This video couldn't be processed for analysis. Try a different clip or re-export it before importing.";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extensionFromPath(value: string): string | undefined {
  const clean = value.split('?')[0].split('#')[0];
  const ext = clean.split('.').pop()?.toLowerCase();
  return ext && /^[a-z0-9]+$/.test(ext) ? ext : undefined;
}

function isSupportedExtension(ext: string | undefined): boolean {
  return Boolean(ext && SUPPORTED_VIDEO_EXTENSIONS.includes(ext as SupportedVideoExtension));
}

function isSupportedMimeType(mimeType: string | null | undefined): boolean {
  if (!mimeType) return false;
  return SUPPORTED_VIDEO_MIME_TYPES.includes(mimeType.toLowerCase() as (typeof SUPPORTED_VIDEO_MIME_TYPES)[number]);
}

async function defaultGetFileInfo(uri: string): Promise<FileInfoResult> {
  // Lazy import: keeps this module require()-able in a pure node:test run
  // without pulling in the Expo runtime unless the real implementation is used.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const FileSystem = require('expo-file-system/legacy') as typeof import('expo-file-system/legacy');
  const info = await FileSystem.getInfoAsync(uri);
  return { exists: info.exists, size: 'size' in info ? info.size : undefined };
}

// ─── validatePickedVideo ───────────────────────────────────────────────────────

export async function validatePickedVideo(
  asset: PickedVideoAsset,
  getFileInfo: FileInfoFn = defaultGetFileInfo,
): Promise<MediaValidationError | null> {
  // 1. Duration — cheapest, most common rejection, no I/O needed.
  if (typeof asset.duration === 'number' && Number.isFinite(asset.duration) && asset.duration > MAX_CLIP_DURATION_MS) {
    return { code: 'too_long', message: MSG_TOO_LONG };
  }

  // 2. File type — extension is authoritative; mimeType is a fallback for
  //    picker assets that report an ambiguous/missing extension.
  const ext = extensionFromPath(asset.fileName ?? asset.uri);
  const extKnownBad = ext !== undefined && !isSupportedExtension(ext);
  const mimeKnownGood = isSupportedMimeType(asset.mimeType);
  if (extKnownBad && !mimeKnownGood) {
    return { code: 'unsupported_type', message: MSG_UNSUPPORTED_TYPE };
  }
  if (ext === undefined && asset.mimeType && !mimeKnownGood) {
    return { code: 'unsupported_type', message: MSG_UNSUPPORTED_TYPE };
  }

  // 3. Size reported directly by the picker — skip the filesystem round-trip.
  if (typeof asset.fileSize === 'number' && Number.isFinite(asset.fileSize) && asset.fileSize > MAX_CLIP_SIZE_BYTES) {
    return { code: 'too_large', message: MSG_TOO_LARGE };
  }

  // 4. Filesystem check — catches iCloud placeholders (not downloaded),
  //    missing/corrupt files, and size when the picker didn't report it.
  try {
    const info = await getFileInfo(asset.uri);
    if (!info.exists) {
      const cloudBacked = asset.uri.startsWith('ph://') || asset.uri.startsWith('assets-library://');
      return cloudBacked
        ? { code: 'icloud_unavailable', message: MSG_ICLOUD_UNAVAILABLE }
        : { code: 'unreadable', message: MSG_UNREADABLE };
    }
    if (typeof info.size === 'number') {
      if (info.size <= 0) {
        return { code: 'unreadable', message: MSG_UNREADABLE };
      }
      if (info.size > MAX_CLIP_SIZE_BYTES) {
        return { code: 'too_large', message: MSG_TOO_LARGE };
      }
    }
  } catch {
    return { code: 'unreadable', message: MSG_UNREADABLE };
  }

  return null;
}

// Exported so TimedCaptureCamera / analyze.tsx can surface a consistent
// message when detectPoseSequence/detectPose fails outright on an
// otherwise-valid file (a case validatePickedVideo cannot detect up front).
export function decodeFailedError(): MediaValidationError {
  return { code: 'decode_failed', message: MSG_DECODE_FAILED };
}
