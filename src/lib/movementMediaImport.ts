import type * as ImagePicker from 'expo-image-picker';

import {
  validatePickedVideo,
  type FileInfoFn,
  type MediaValidationError,
  type PickedVideoAsset,
} from '../utils/mediaValidation';

export const MOVEMENT_VIDEO_PICKER_OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['videos'],
  allowsEditing: false,
  quality: 1,
  shouldDownloadFromNetwork: true,
};

export type PreparedMovementVideo = {
  uri: string;
  fileName?: string | null;
  duration?: number | null;
  fileSize?: number | null;
  mimeType?: string | null;
};

export type MovementVideoPreparationResult =
  | { ok: true; video: PreparedMovementVideo }
  | { ok: false; error: MediaValidationError; retryable: boolean };

type PreparationDependencies = {
  getFileInfo?: FileInfoFn;
  stageVideo?: (asset: PickedVideoAsset) => Promise<string>;
};

function extensionFrom(asset: PickedVideoAsset): string {
  const candidate = asset.fileName ?? asset.uri;
  const clean = candidate.split('?')[0].split('#')[0];
  const ext = clean.split('.').pop()?.toLowerCase();
  return ext && /^[a-z0-9]+$/.test(ext) ? ext : 'mov';
}

async function stageVideoInCache(asset: PickedVideoAsset): Promise<string> {
  // Lazy import keeps this module available to the pure node:test suite.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const FileSystem = require('expo-file-system/legacy') as typeof import('expo-file-system/legacy');
  const root = `${FileSystem.cacheDirectory}movement-imports/`;
  const destination = `${root}movement_import_${Date.now()}_${Math.random().toString(36).slice(2)}.${extensionFrom(asset)}`;
  await FileSystem.makeDirectoryAsync(root, { intermediates: true });
  await FileSystem.copyAsync({ from: asset.uri, to: destination });
  return destination;
}

export async function prepareImportedMovementVideo(
  asset: PickedVideoAsset,
  dependencies: PreparationDependencies = {},
): Promise<MovementVideoPreparationResult> {
  const validation = await validatePickedVideo(asset, dependencies.getFileInfo);
  if (validation) {
    return {
      ok: false,
      error: validation,
      retryable: validation.code === 'icloud_unavailable' || validation.code === 'unreadable',
    };
  }

  try {
    const uri = await (dependencies.stageVideo ?? stageVideoInCache)(asset);
    const stagedValidation = await validatePickedVideo(
      { ...asset, uri },
      dependencies.getFileInfo,
    );
    if (stagedValidation) {
      return {
        ok: false,
        error: stagedValidation,
        retryable: stagedValidation.code === 'icloud_unavailable' || stagedValidation.code === 'unreadable',
      };
    }
    return {
      ok: true,
      video: {
        uri,
        fileName: asset.fileName,
        duration: asset.duration,
        fileSize: asset.fileSize,
        mimeType: asset.mimeType,
      },
    };
  } catch {
    return {
      ok: false,
      error: {
        code: 'unreadable',
        message: "StrideOS couldn't prepare this video for analysis. Check the download and try again.",
      },
      retryable: true,
    };
  }
}
