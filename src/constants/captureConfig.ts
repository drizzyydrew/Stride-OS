// ─── Capture Config ──────────────────────────────────────────────────────────
//
// Single source of truth for TimedCaptureCamera durations, the countdown
// length, and the "Choose Video" import limits shown before/after picking.
// See docs/build36-fable-ticket.md ("Capture workflow (Agent B)").

import type { MovementAnalysisKind } from '../types/movement';

// ─── Countdown ───────────────────────────────────────────────────────────────

export const COUNTDOWN_SECONDS = 5;

// ─── Per-movement recording durations ─────────────────────────────────────────

export type CaptureDurationConfig = {
  /** Seconds the camera auto-records for a single take. */
  durationSec: number;
  /** True when the readiness/analyze flow records this movement once per side. */
  perSide: boolean;
  /** Shown before recording starts. */
  recommendedLengthCopy: string;
};

export const ANALYSIS_KIND_CAPTURE: Record<MovementAnalysisKind | 'lunge_single_leg', CaptureDurationConfig> = {
  running_gait: {
    durationSec: 12,
    perSide: false,
    recommendedLengthCopy: 'Records for about 12 seconds — enough for several full strides.',
  },
  squat: {
    durationSec: 10,
    perSide: false,
    recommendedLengthCopy: 'Records for about 10 seconds — enough for 3–5 controlled reps.',
  },
  deadlift: {
    durationSec: 12,
    perSide: false,
    recommendedLengthCopy: 'Records for about 12 seconds — enough for a full working set.',
  },
  single_leg_control: {
    durationSec: 10,
    perSide: true,
    recommendedLengthCopy: 'Records for about 10 seconds per side — enough for 3–5 controlled reps.',
  },
  lunge: {
    durationSec: 10,
    perSide: true,
    recommendedLengthCopy: 'Records for about 10 seconds per side — enough for 3–5 controlled reps.',
  },
  general: {
    durationSec: 30,
    perSide: false,
    recommendedLengthCopy: 'Records for up to 30 seconds — capture the movement plus a couple of reps.',
  },
  // Deprecated legacy kind — kept only so old param values still resolve to a
  // sane duration instead of throwing; new UI never targets this kind.
  lunge_single_leg: {
    durationSec: 10,
    perSide: true,
    recommendedLengthCopy: 'Records for about 10 seconds per side.',
  },
};

/**
 * Readiness-battery steps that record video, keyed by StepDef.key
 * (readiness-test.tsx). Heel raise and knee-to-wall stay fully manual —
 * see readiness-engine evidence contract — heelRaiseCapSec is defined for
 * forward compatibility with future automated rep counting only; no camera
 * flow is wired to it in this build.
 */
export const READINESS_STEP_DURATION_SEC: Record<string, number> = {
  squat_side:          ANALYSIS_KIND_CAPTURE.squat.durationSec,
  single_leg_squat:     ANALYSIS_KIND_CAPTURE.single_leg_control.durationSec * 2,
  split_stance_lunge:   ANALYSIS_KIND_CAPTURE.lunge.durationSec * 2,
  gait_side_view:       ANALYSIS_KIND_CAPTURE.running_gait.durationSec,
};

export const HEEL_RAISE_FUTURE_AUTOMATION_CAP_SEC = 25;

// ─── Import (Choose Video) limits ─────────────────────────────────────────────

export const MAX_CLIP_DURATION_SEC = 30;
export const MAX_CLIP_DURATION_MS  = MAX_CLIP_DURATION_SEC * 1000;
export const MAX_CLIP_SIZE_BYTES   = 500 * 1024 * 1024;

export const SUPPORTED_VIDEO_EXTENSIONS = ['mov', 'mp4', 'm4v'] as const;
export type SupportedVideoExtension = (typeof SUPPORTED_VIDEO_EXTENSIONS)[number];

export const SUPPORTED_VIDEO_MIME_TYPES = [
  'video/quicktime',
  'video/mp4',
  'video/x-m4v',
] as const;

export const IMPORT_LIMITS_COPY =
  `Recommended: 10–15 s, focused on the movement. Max ${MAX_CLIP_DURATION_SEC} s, ` +
  `500 MB. Supported types: .mov, .mp4, .m4v.`;
