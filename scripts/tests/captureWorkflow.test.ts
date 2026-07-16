import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  anatomicalSideForSavedMedia,
  canFlipCamera,
  canStartCapture,
  captureMetadataForFacing,
  DEFAULT_CAMERA_FACING,
  isCurrentCameraSessionReady,
  shouldCommitCaptureOperation,
} from '../../src/utils/captureWorkflow';

test('front camera is the default and only setup permits camera flipping', () => {
  assert.equal(DEFAULT_CAMERA_FACING, 'front');
  assert.equal(canFlipCamera('setup'), true);
  assert.equal(canFlipCamera('countdown'), false);
  assert.equal(canFlipCamera('recording'), false);
  assert.equal(canFlipCamera('capturing_photo'), false);
});

test('countdown cannot begin before the athlete presses Start on a ready setup preview', () => {
  assert.equal(canStartCapture('requesting_permission', true, false), false);
  assert.equal(canStartCapture('setup', false, false), false);
  assert.equal(canStartCapture('setup', true, false), true);
  assert.equal(canStartCapture('countdown', true, false), false);
  assert.equal(canStartCapture('setup', true, true), false);
});

test('saved capture metadata makes facing and mirror state explicit', () => {
  assert.deepEqual(captureMetadataForFacing('front'), {
    cameraFacing: 'front',
    isMirrored: false,
    orientationConfirmed: true,
  });
  assert.deepEqual(captureMetadataForFacing('back'), {
    cameraFacing: 'back',
    isMirrored: false,
    orientationConfirmed: true,
  });
});

test('mirrored media explicitly swaps anatomical left and right', () => {
  assert.equal(anatomicalSideForSavedMedia('left', false), 'left');
  assert.equal(anatomicalSideForSavedMedia('left', true), 'right');
  assert.equal(anatomicalSideForSavedMedia('right', true), 'left');
});

test('repeated camera switches require readiness from the current native session', () => {
  assert.equal(isCurrentCameraSessionReady(1, 1), true);
  assert.equal(isCurrentCameraSessionReady(2, 1), false);
  assert.equal(isCurrentCameraSessionReady(2, 2), true);
  assert.equal(isCurrentCameraSessionReady(3, 2), false);
  assert.equal(isCurrentCameraSessionReady(3, 3), true);
  assert.equal(isCurrentCameraSessionReady(4, 4), true);
});

test('cancelled or interrupted capture operations cannot commit stale media', () => {
  assert.equal(shouldCommitCaptureOperation(4, 4), true);
  assert.equal(shouldCommitCaptureOperation(5, 4), false);
  assert.equal(shouldCommitCaptureOperation(7, 6), false);
});
