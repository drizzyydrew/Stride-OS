// ─── Media Paths (pure core) ──────────────────────────────────────────────────
//
// Pure path logic for movement media persistence, separated from the
// expo-file-system binding in mediaPaths.ts so it can be unit-tested in
// plain node. iOS regenerates the app container UUID on every app update,
// so absolute document URIs persisted in AsyncStorage go stale — records
// store RELATIVE document paths and resolve against the current root at
// read time; legacy absolute URIs are re-anchored via the '/Documents/'
// marker.

const DOCUMENT_MARKER = '/Documents/';

export const MOVEMENT_MEDIA_DIRS = [
  'movement-analyses/',
  'movement-pose/',
  'movement-videos/',
] as const;

export function isRemoteOrExternalUri(value: string): boolean {
  return (
    value.startsWith('http://') ||
    value.startsWith('https://') ||
    value.startsWith('ph://') ||
    value.startsWith('assets-library://') ||
    value.startsWith('content://')
  );
}

export function isMovementDocumentPath(value: string | undefined | null): boolean {
  if (!value) return false;
  return MOVEMENT_MEDIA_DIRS.some(prefix => value.startsWith(prefix));
}

export function toRelativeDocumentPathWithRoot(
  uri: string | undefined | null,
  root: string,
): string | undefined {
  if (!uri) return undefined;
  if (isRemoteOrExternalUri(uri)) return uri;
  if (isMovementDocumentPath(uri)) return uri;

  if (root && uri.startsWith(root)) {
    return uri.slice(root.length);
  }

  if (uri.startsWith('file://')) {
    const markerIndex = uri.indexOf(DOCUMENT_MARKER);
    if (markerIndex !== -1) {
      return uri.slice(markerIndex + DOCUMENT_MARKER.length);
    }
  }

  return uri;
}

export function reanchorDocumentUriWithRoot(
  uri: string | undefined | null,
  root: string,
): string | undefined {
  if (!uri) return undefined;
  if (!root) return uri;

  if (uri.startsWith(root)) return uri;

  if (uri.startsWith('file://')) {
    const markerIndex = uri.indexOf(DOCUMENT_MARKER);
    if (markerIndex !== -1) {
      const relative = uri.slice(markerIndex + DOCUMENT_MARKER.length);
      return `${root}${relative}`;
    }
  }

  return uri;
}

export function resolveDocumentUriWithRoot(
  pathOrUri: string | undefined | null,
  root: string,
): string | undefined {
  if (!pathOrUri) return undefined;
  if (isRemoteOrExternalUri(pathOrUri)) return pathOrUri;

  if (isMovementDocumentPath(pathOrUri)) {
    return root ? `${root}${pathOrUri}` : pathOrUri;
  }

  return reanchorDocumentUriWithRoot(pathOrUri, root);
}
