type ExpoExtra = {
  mapboxAccessToken?: unknown;
  mapboxStyleUrl?: unknown;
};

function expoExtra(): ExpoExtra | undefined {
  if (typeof process !== 'undefined' && process.versions?.node) return undefined;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const constantsModule = require('expo-constants') as {
      default?: { expoConfig?: { extra?: ExpoExtra } };
      expoConfig?: { extra?: ExpoExtra };
    };
    return (constantsModule.default ?? constantsModule).expoConfig?.extra;
  } catch {
    return undefined;
  }
}

function extraString(key: keyof ExpoExtra): string {
  const extra = expoExtra();
  const value = extra?.[key];
  return typeof value === 'string' ? value : '';
}

const envMapboxAccessToken = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN ?? '';
const envMapboxStyleUrl = process.env.EXPO_PUBLIC_MAPBOX_STYLE_URL ?? '';

export const MAPBOX_ACCESS_TOKEN = envMapboxAccessToken.trim()
  ? envMapboxAccessToken
  : extraString('mapboxAccessToken');

export const MAPBOX_STYLE_URL = envMapboxStyleUrl.trim()
  ? envMapboxStyleUrl
  : extraString('mapboxStyleUrl') || 'mapbox://styles/mapbox/outdoors-v11';

export function isMapboxConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  const token = env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN?.trim()
    ? env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN
    : MAPBOX_ACCESS_TOKEN;
  return token.trim().startsWith('pk.');
}
