import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  MOVEMENT_VIDEO_PICKER_OPTIONS,
  prepareImportedMovementVideo,
} from '../../lib/movementMediaImport';

test('movement video picker opts into SDK 56 iCloud downloads', () => {
  assert.deepEqual(MOVEMENT_VIDEO_PICKER_OPTIONS.mediaTypes, ['videos']);
  assert.equal(MOVEMENT_VIDEO_PICKER_OPTIONS.allowsEditing, false);
  assert.equal(MOVEMENT_VIDEO_PICKER_OPTIONS.shouldDownloadFromNetwork, true);
});

test('valid picked video is copied to a stable staging URI', async () => {
  const source = 'file:///picker-cache/old-video.mov';
  const staged = 'file:///stable-cache/movement-import.mov';
  const result = await prepareImportedMovementVideo(
    { uri: source, duration: 12_000, mimeType: 'video/quicktime' },
    {
      getFileInfo: async uri => ({ exists: true, size: uri === staged ? 2_000_000 : 1_900_000 }),
      stageVideo: async asset => {
        assert.equal(asset.uri, source);
        return staged;
      },
    },
  );
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.video.uri, staged);
});

test('iCloud preparation failure is retryable', async () => {
  const result = await prepareImportedMovementVideo(
    { uri: 'ph://ICLOUD-ASSET', fileName: 'clip.mov', mimeType: 'video/quicktime' },
    { getFileInfo: async () => ({ exists: false }) },
  );
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'icloud_unavailable');
    assert.equal(result.retryable, true);
  }
});

test('invalid media is rejected before staging', async () => {
  let staged = false;
  const result = await prepareImportedMovementVideo(
    { uri: 'file:///clip.avi', mimeType: 'video/x-msvideo' },
    {
      getFileInfo: async () => ({ exists: true, size: 1000 }),
      stageVideo: async () => {
        staged = true;
        return 'file:///stable/clip.avi';
      },
    },
  );
  assert.equal(result.ok, false);
  assert.equal(staged, false);
});
