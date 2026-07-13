import type { CameraType } from 'expo-camera';

export type CaptureStage =
  | 'requesting_permission'
  | 'permission_denied'
  | 'setup'
  | 'countdown'
  | 'recording'
  | 'capturing_photo'
  | 'review'
  | 'error';

export const DEFAULT_CAMERA_FACING: CameraType = 'front';

export function canFlipCamera(stage: CaptureStage): boolean {
  return stage === 'setup';
}

export function canStartCapture(stage: CaptureStage, cameraReady: boolean, capturePending: boolean): boolean {
  return stage === 'setup' && cameraReady && !capturePending;
}

export function captureMetadataForFacing(facing: CameraType) {
  // CameraView mirror=false is intentional: front captures are stored in a
  // known, unmirrored orientation so anatomical left/right never changes
  // silently between preview, saved analysis, and Coach context.
  return {
    cameraFacing: facing,
    isMirrored: false,
    orientationConfirmed: true,
  } as const;
}

export function anatomicalSideForSavedMedia(
  side: 'left' | 'right',
  isMirrored: boolean,
): 'left' | 'right' {
  if (!isMirrored) return side;
  return side === 'left' ? 'right' : 'left';
}
