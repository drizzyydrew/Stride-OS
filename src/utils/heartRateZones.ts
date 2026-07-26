// ─── Heart-Rate Zone Status ────────────────────────────────────────────────
//
// Pure helper extracted from the Running tab's live view so other live
// screens (indoor cycling, etc.) can compute a zone status without importing
// from that 3200+ line screen. Given a live heart rate reading, a target
// zone number, and the athlete's calibrated zones, returns a label/tone the
// UI can render directly.

import type { HRZoneEntry } from '../types/athlete';

export type LiveZoneStatus = {
  label: string;
  detail: string;
  tone: 'in' | 'near' | 'out' | 'unknown';
  guidance: 'high' | 'low' | null;
};

export function zoneStatusForHeartRate(
  heartRateBpm: number | null,
  targetZone: number,
  zones?: Pick<HRZoneEntry, 'zone' | 'label' | 'minBPM' | 'maxBPM'>[] | null,
): LiveZoneStatus {
  const target = zones?.find(z => z.zone === targetZone);
  if (!heartRateBpm || !target || target.minBPM == null || target.maxBPM == null) {
    return { label: `Z${targetZone}`, detail: 'TARGET', tone: 'unknown', guidance: null };
  }

  const current = zones?.find(z =>
    (z.minBPM == null || heartRateBpm >= z.minBPM) &&
    (z.maxBPM == null || heartRateBpm <= z.maxBPM),
  );
  const below = heartRateBpm < target.minBPM;
  const above = heartRateBpm > target.maxBPM;
  const delta = below ? target.minBPM - heartRateBpm : above ? heartRateBpm - target.maxBPM : 0;
  const tone: LiveZoneStatus['tone'] = delta === 0 ? 'in' : delta <= 5 ? 'near' : 'out';

  return {
    label: current ? `Z${current.zone}` : `Z${targetZone}`,
    detail: delta === 0 ? target.label : `${delta} bpm ${above ? 'high' : 'low'}`,
    tone,
    guidance: above ? 'high' : below ? 'low' : null,
  };
}
