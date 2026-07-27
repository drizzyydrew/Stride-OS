export type CscMeasurement = {
  wheelRevolutions?: number;
  wheelEventTimeSeconds?: number;
  crankRevolutions?: number;
  crankEventTimeSeconds?: number;
};

export type CscDelta = {
  distanceMeters?: number;
  cadenceRpm?: number;
};

export function parseCscMeasurement(bytes: readonly number[]): CscMeasurement | null {
  if (bytes.length < 1) return null;
  const flags = bytes[0];
  let offset = 1;
  const result: CscMeasurement = {};
  if ((flags & 0x01) !== 0 && bytes.length >= offset + 6) {
    result.wheelRevolutions = readUInt32LE(bytes, offset);
    result.wheelEventTimeSeconds = readUInt16LE(bytes, offset + 4) / 1024;
    offset += 6;
  }
  if ((flags & 0x02) !== 0 && bytes.length >= offset + 4) {
    result.crankRevolutions = readUInt16LE(bytes, offset);
    result.crankEventTimeSeconds = readUInt16LE(bytes, offset + 2) / 1024;
  }
  return Object.keys(result).length > 0 ? result : null;
}

export function cscDelta(
  previous: CscMeasurement,
  current: CscMeasurement,
  wheelCircumferenceMeters: number,
): CscDelta {
  const result: CscDelta = {};
  if (
    Number.isFinite(previous.wheelRevolutions)
    && Number.isFinite(current.wheelRevolutions)
    && wheelCircumferenceMeters > 0
  ) {
    result.distanceMeters = rolloverDelta(previous.wheelRevolutions!, current.wheelRevolutions!, 0x1_0000_0000)
      * wheelCircumferenceMeters;
  }
  if (
    Number.isFinite(previous.crankRevolutions)
    && Number.isFinite(current.crankRevolutions)
    && Number.isFinite(previous.crankEventTimeSeconds)
    && Number.isFinite(current.crankEventTimeSeconds)
  ) {
    const revs = rolloverDelta(previous.crankRevolutions!, current.crankRevolutions!, 0x1_0000);
    const seconds = rolloverDelta(previous.crankEventTimeSeconds!, current.crankEventTimeSeconds!, 64);
    if (seconds > 0) result.cadenceRpm = revs / seconds * 60;
  }
  return result;
}

function rolloverDelta(previous: number, current: number, modulus: number): number {
  return current >= previous ? current - previous : (modulus - previous) + current;
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
