export type RscMeasurement = {
  speedMetersPerSecond: number;
  cadenceStepsPerMinute: number;
  strideLengthMeters?: number;
  distanceMeters?: number;
};

export function parseRscMeasurement(bytes: readonly number[]): RscMeasurement | null {
  if (bytes.length < 4) return null;
  const flags = bytes[0];
  let offset = 1;
  const speedMetersPerSecond = readUInt16LE(bytes, offset) / 256;
  offset += 2;
  const cadenceStepsPerMinute = bytes[offset] ?? 0;
  offset += 1;
  const strideLengthMeters = (flags & 0x01) !== 0 && bytes.length >= offset + 2
    ? readUInt16LE(bytes, offset) / 100
    : undefined;
  offset += (flags & 0x01) !== 0 ? 2 : 0;
  const distanceMeters = (flags & 0x02) !== 0 && bytes.length >= offset + 4
    ? readUInt32LE(bytes, offset) / 10
    : undefined;
  if (speedMetersPerSecond <= 0 && cadenceStepsPerMinute <= 0) return null;
  return { speedMetersPerSecond, cadenceStepsPerMinute, strideLengthMeters, distanceMeters };
}

function readUInt16LE(bytes: readonly number[], offset: number): number {
  return (bytes[offset] ?? 0) | ((bytes[offset + 1] ?? 0) << 8);
}

function readUInt32LE(bytes: readonly number[], offset: number): number {
  return ((bytes[offset] ?? 0)
    | ((bytes[offset + 1] ?? 0) << 8)
    | ((bytes[offset + 2] ?? 0) << 16)
    | ((bytes[offset + 3] ?? 0) << 24)) >>> 0;
}
