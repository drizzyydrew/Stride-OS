export type CyclingPowerMeasurement = {
  powerWatts: number;
};

export function parseCyclingPowerMeasurement(bytes: readonly number[]): CyclingPowerMeasurement | null {
  if (bytes.length < 4) return null;
  const powerWatts = readInt16LE(bytes, 2);
  if (!Number.isFinite(powerWatts)) return null;
  return { powerWatts };
}

function readInt16LE(bytes: readonly number[], offset: number): number {
  const value = (bytes[offset] ?? 0) | ((bytes[offset + 1] ?? 0) << 8);
  return value & 0x8000 ? value - 0x10000 : value;
}
