export type BleHeartRateMeasurement = {
  bpm: number;
  contactDetected?: boolean;
  energyExpendedKj?: number;
};

export function parseHeartRateMeasurement(bytes: readonly number[]): BleHeartRateMeasurement | null {
  if (bytes.length < 2) return null;
  const flags = bytes[0];
  const isUint16 = (flags & 0x01) !== 0;
  let offset = 1;
  const bpm = isUint16
    ? readUInt16LE(bytes, offset)
    : bytes[offset];
  offset += isUint16 ? 2 : 1;
  if (!Number.isFinite(bpm) || bpm <= 0) return null;
  const contactSupported = (flags & 0x04) !== 0;
  const contactDetected = contactSupported ? (flags & 0x02) !== 0 : undefined;
  const energyExpendedKj = (flags & 0x08) !== 0 && bytes.length >= offset + 2
    ? readUInt16LE(bytes, offset)
    : undefined;
  return { bpm, contactDetected, energyExpendedKj };
}

function readUInt16LE(bytes: readonly number[], offset: number): number {
  return (bytes[offset] ?? 0) | ((bytes[offset + 1] ?? 0) << 8);
}
