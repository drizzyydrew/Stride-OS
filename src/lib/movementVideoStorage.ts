import * as FileSystem from 'expo-file-system/legacy';

import { resolveDocumentUri, toRelativeDocumentPath } from './mediaPaths';
import { getSupabaseAvailability, supabaseUnavailableMessage } from './supabase';

const VIDEO_DIR = `${FileSystem.documentDirectory}movement-videos/`;

function extensionFrom(value?: string): string {
  const clean = value?.split('?')[0].split('#')[0];
  const ext = clean?.split('.').pop()?.toLowerCase();
  return ext && /^[a-z0-9]+$/.test(ext) ? ext : 'mp4';
}

function contentTypeForExtension(ext: string): string {
  switch (ext.toLowerCase()) {
    case 'mov':
      return 'video/quicktime';
    case 'm4v':
      return 'video/x-m4v';
    case 'webm':
      return 'video/webm';
    default:
      return 'video/mp4';
  }
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const clean = base64.replace(/[\r\n=]/g, '');
  const bytes = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let buffer = 0;
  let bits = 0;
  let index = 0;

  for (let i = 0; i < clean.length; i += 1) {
    const value = alphabet.indexOf(clean[i]);
    if (value === -1) continue;
    buffer = (buffer << 6) | value;
    bits += 6;

    if (bits >= 8) {
      bits -= 8;
      bytes[index] = (buffer >> bits) & 0xff;
      index += 1;
    }
  }

  return bytes.slice(0, index).buffer;
}

export async function copyVideoToMovementStorage(
  sourceUri: string,
  videoId: string,
  fileNameOrUri?: string,
): Promise<{ localUri: string; ext: string; contentType: string }> {
  const ext = extensionFrom(fileNameOrUri ?? sourceUri);
  const localUri = `${VIDEO_DIR}${videoId}.${ext}`;

  await FileSystem.makeDirectoryAsync(VIDEO_DIR, { intermediates: true });
  await FileSystem.copyAsync({ from: sourceUri, to: localUri });

  return {
    localUri: toRelativeDocumentPath(localUri) ?? localUri,
    ext,
    contentType: contentTypeForExtension(ext),
  };
}

// ─── Analysis media (Movement Lab V1.5 stills/clips) ─────────────────────────
//
// ImagePicker and VideoThumbnails write into the OS cache directory, which the
// system may purge at any time. Saved analyses must keep their media, so the
// analyzed still (or clip) is copied into the app's document directory.

const ANALYSIS_DIR = `${FileSystem.documentDirectory}movement-analyses/`;

export async function copyAnalysisMediaToStorage(sourceUri: string, analysisKey: string): Promise<string> {
  const ext = extensionFrom(sourceUri);
  const localUri = `${ANALYSIS_DIR}${analysisKey}.${ext}`;

  await FileSystem.makeDirectoryAsync(ANALYSIS_DIR, { intermediates: true });
  await FileSystem.copyAsync({ from: sourceUri, to: localUri });

  return toRelativeDocumentPath(localUri) ?? localUri;
}

// Only removes files this module created — never touches library/cache URIs.
export async function deleteAnalysisMediaIfStored(uri: string): Promise<void> {
  const resolvedUri = resolveDocumentUri(uri);
  if (!resolvedUri?.startsWith(ANALYSIS_DIR)) return;
  await FileSystem.deleteAsync(resolvedUri, { idempotent: true }).catch(() => {});
}

export async function uploadMovementVideo(
  localUri: string,
  storagePath: string,
  contentType: string,
): Promise<void> {
  const supabaseState = getSupabaseAvailability();
  if (supabaseState.status !== 'available') {
    throw new Error(supabaseUnavailableMessage('Movement video upload'));
  }

  const { client: supabase } = supabaseState;
  const resolvedUri = resolveDocumentUri(localUri) ?? localUri;
  const base64 = await FileSystem.readAsStringAsync(resolvedUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const arrayBuffer = base64ToArrayBuffer(base64);

  const { error } = await supabase.storage
    .from('movement-videos')
    .upload(storagePath, arrayBuffer, { contentType, upsert: true });

  if (error) {
    throw new Error(error.message);
  }
}
