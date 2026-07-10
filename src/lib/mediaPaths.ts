// ─── Media Paths ──────────────────────────────────────────────────────────────
//
// Thin expo-file-system binding over the pure logic in mediaPathsCore.ts.
// Movement records persist RELATIVE document paths (e.g.
// "movement-analyses/analysis_123.mp4") because iOS regenerates the app
// container UUID on every app update; every read resolves against the
// CURRENT document directory, and legacy absolute URIs are re-anchored.

import * as FileSystem from 'expo-file-system/legacy';

import {
  reanchorDocumentUriWithRoot,
  resolveDocumentUriWithRoot,
  toRelativeDocumentPathWithRoot,
} from './mediaPathsCore';

export { MOVEMENT_MEDIA_DIRS, isMovementDocumentPath } from './mediaPathsCore';

function documentRoot(): string {
  return FileSystem.documentDirectory ?? '';
}

export function toRelativeDocumentPath(uri: string | undefined | null): string | undefined {
  return toRelativeDocumentPathWithRoot(uri, documentRoot());
}

export function resolveDocumentUri(pathOrUri: string | undefined | null): string | undefined {
  return resolveDocumentUriWithRoot(pathOrUri, documentRoot());
}

export function reanchorDocumentUri(uri: string | undefined | null): string | undefined {
  return reanchorDocumentUriWithRoot(uri, documentRoot());
}
