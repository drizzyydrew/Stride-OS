import type { RefObject } from 'react';
import { Share, type View } from 'react-native';
import { makeImageFromView } from '@shopify/react-native-skia';
import * as FileSystem from 'expo-file-system/legacy';

export type ShareCardFormat = 'story_9_16' | 'portrait_4_5' | 'square_1_1';

export type ShareCardResult =
  | { status: 'shared'; uri: string }
  | { status: 'unavailable'; reason: string };

export const SHARE_CARD_FORMATS: Record<ShareCardFormat, { width: number; height: number; label: string }> = {
  story_9_16: { width: 1080, height: 1920, label: 'Story 9:16' },
  portrait_4_5: { width: 1080, height: 1350, label: 'Portrait 4:5' },
  square_1_1: { width: 1080, height: 1080, label: 'Square 1:1' },
};

export function shareCardUnavailableReason(): string | null {
  return null;
}

export async function shareReportCard(
  viewRef: RefObject<View | null>,
  options: { fileName: string; message?: string },
): Promise<ShareCardResult> {
  if (!viewRef.current) {
    return { status: 'unavailable', reason: 'The share card preview is not ready yet.' };
  }

  const image = await makeImageFromView(viewRef);
  const base64 = image?.encodeToBase64();
  if (!base64) {
    return { status: 'unavailable', reason: 'StrideOS could not create the share-card image.' };
  }

  const safeName = options.fileName.replace(/[^a-z0-9_-]/gi, '-').toLowerCase();
  const uri = `${FileSystem.cacheDirectory ?? ''}${safeName}.png`;
  await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 });
  await Share.share({ url: uri, message: options.message ?? 'StrideOS training report' });
  return { status: 'shared', uri };
}
