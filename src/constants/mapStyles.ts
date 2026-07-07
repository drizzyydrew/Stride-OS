// ─── Shared map styling ───────────────────────────────────────────────────────
//
// StrideOS map appearance for react-native-maps, matching the live-run map
// styles in app/(tabs)/training/index.tsx (kept duplicated there deliberately
// — that file is run-critical and wasn't churned for a constants move; new
// map surfaces should import from here).

import type { Region } from 'react-native-maps';

export const DEFAULT_MAP_REGION: Region = {
  latitude: 44.0582,
  longitude: -121.3153,
  latitudeDelta: 0.045,
  longitudeDelta: 0.045,
};

// Fit-to-content region for any lat/lng point list (route lines, waypoints).
export function regionForPoints(
  points: { latitude: number; longitude: number }[],
): Region {
  if (points.length === 0) return DEFAULT_MAP_REGION;
  const lats = points.map(p => p.latitude);
  const lngs = points.map(p => p.longitude);
  return {
    latitude: (Math.min(...lats) + Math.max(...lats)) / 2,
    longitude: (Math.min(...lngs) + Math.max(...lngs)) / 2,
    latitudeDelta: Math.max((Math.max(...lats) - Math.min(...lats)) * 1.6, 0.012),
    longitudeDelta: Math.max((Math.max(...lngs) - Math.min(...lngs)) * 1.6, 0.012),
  };
}

export const MAP_STYLE_DARK = [
  { elementType: 'geometry', stylers: [{ color: '#141414' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8B927C' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0a0a0a' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2a2a2a' }] },
  { featureType: 'road', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#111820' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#1a241a' }] },
];

export const MAP_STYLE_LIGHT = [
  { elementType: 'geometry', stylers: [{ color: '#EFE7DA' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#708489' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#f5ede0' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#FFF9EF' }] },
  { featureType: 'road', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#DDE7E2' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#DCE7CF' }] },
];
