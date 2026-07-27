import type { RefObject } from 'react';
import type { View } from 'react-native';

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
  return 'Share-card image export is available on device. This web build keeps the report preview available without native sharing.';
}

export async function shareReportCard(
  _viewRef: RefObject<View | null>,
  _options: { fileName: string; message?: string },
): Promise<ShareCardResult> {
  return { status: 'unavailable', reason: shareCardUnavailableReason() ?? 'Share-card export is unavailable.' };
}
