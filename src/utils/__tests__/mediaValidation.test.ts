// ─── mediaValidation tests ──────────────────────────────────────────────────
//
// Pure node:test coverage — no Expo runtime required. `getFileInfo` is
// injected so filesystem behavior (missing/iCloud/oversize files) is
// simulated without touching disk.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { validatePickedVideo, type FileInfoResult } from '../mediaValidation';

function okFileInfo(size = 1_000_000): (uri: string) => Promise<FileInfoResult> {
  return async () => ({ exists: true, size });
}

test('clip longer than 30s → too_long', async () => {
  const result = await validatePickedVideo(
    { uri: 'file:///clip.mp4', duration: 31_000, mimeType: 'video/mp4' },
    okFileInfo(),
  );
  assert.equal(result?.code, 'too_long');
  assert.match(result!.message, /30-second maximum/);
});

test('.avi file → unsupported_type with a specific message', async () => {
  const result = await validatePickedVideo(
    { uri: 'file:///clip.avi', duration: 5000, mimeType: 'video/x-msvideo' },
    okFileInfo(),
  );
  assert.equal(result?.code, 'unsupported_type');
  assert.match(result!.message, /mov.*mp4.*m4v/);
});

test('oversize file (picker-reported) → too_large', async () => {
  const result = await validatePickedVideo(
    { uri: 'file:///clip.mp4', duration: 5000, fileSize: 600 * 1024 * 1024, mimeType: 'video/mp4' },
    okFileInfo(),
  );
  assert.equal(result?.code, 'too_large');
  assert.match(result!.message, /500 MB/);
});

test('oversize file (filesystem-reported) → too_large', async () => {
  const result = await validatePickedVideo(
    { uri: 'file:///clip.mp4', duration: 5000, mimeType: 'video/mp4' },
    okFileInfo(600 * 1024 * 1024),
  );
  assert.equal(result?.code, 'too_large');
});

test('missing cloud-backed file → icloud_unavailable', async () => {
  const result = await validatePickedVideo(
    { uri: 'ph://ABCDEF-1234', fileName: 'clip.mov', duration: 5000, mimeType: 'video/quicktime' },
    async () => ({ exists: false }),
  );
  assert.equal(result?.code, 'icloud_unavailable');
  assert.match(result!.message, /iCloud/);
});

test('missing local file → unreadable', async () => {
  const result = await validatePickedVideo(
    { uri: 'file:///clip.mov', duration: 5000, mimeType: 'video/quicktime' },
    async () => ({ exists: false }),
  );
  assert.equal(result?.code, 'unreadable');
});

test('unreadable file (getFileInfo throws) → unreadable', async () => {
  const result = await validatePickedVideo(
    { uri: 'file:///clip.mov', duration: 5000, mimeType: 'video/quicktime' },
    async () => { throw new Error('boom'); },
  );
  assert.equal(result?.code, 'unreadable');
});

test('zero-byte file → unreadable', async () => {
  const result = await validatePickedVideo(
    { uri: 'file:///clip.mov', duration: 5000, mimeType: 'video/quicktime' },
    okFileInfo(0),
  );
  assert.equal(result?.code, 'unreadable');
});

test('happy path → null', async () => {
  const result = await validatePickedVideo(
    { uri: 'file:///clip.mp4', duration: 12_000, fileSize: 20 * 1024 * 1024, mimeType: 'video/mp4' },
    okFileInfo(20 * 1024 * 1024),
  );
  assert.equal(result, null);
});

test('extensionless uri falls back to mimeType when supported', async () => {
  const result = await validatePickedVideo(
    { uri: 'ph://ABCDEF-1234', duration: 5000, mimeType: 'video/quicktime' },
    okFileInfo(),
  );
  assert.equal(result, null);
});

test('older video is accepted without a creation-date restriction', async () => {
  const result = await validatePickedVideo(
    { uri: 'file:///video-from-2019.mov', duration: 5000, mimeType: 'video/quicktime' },
    okFileInfo(),
  );
  assert.equal(result, null);
});

test('video with missing creation metadata is accepted', async () => {
  const result = await validatePickedVideo(
    { uri: 'file:///video-without-date.mp4', duration: null, mimeType: 'video/mp4' },
    okFileInfo(),
  );
  assert.equal(result, null);
});
