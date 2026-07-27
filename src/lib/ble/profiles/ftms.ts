export type FtmsTreadmillData = {
  speedKph?: number;
  distanceMeters?: number;
  inclinePercent?: number;
};

export type FtmsIndoorBikeData = {
  speedKph?: number;
  cadenceRpm?: number;
  distanceMeters?: number;
  powerWatts?: number;
};

export function parseFtmsTreadmillData(bytes: readonly number[]): FtmsTreadmillData | null {
  if (bytes.length < 4) return null;
  const flags = readUInt16LE(bytes, 0);
  let offset = 2;
  const result: FtmsTreadmillData = {};
  const moreData = (flags & 0x0001) !== 0;
  if (!moreData) {
    result.speedKph = readUInt16LE(bytes, offset) / 100;
    offset += 2;
  }
  if ((flags & 0x0004) !== 0 && bytes.length >= offset + 3) {
    result.distanceMeters = readUInt24LE(bytes, offset);
    offset += 3;
  }
  if ((flags & 0x0008) !== 0 && bytes.length >= offset + 4) {
    result.inclinePercent = readInt16LE(bytes, offset) / 10;
  }
  return hasAny(result) ? result : null;
}

export function parseFtmsIndoorBikeData(bytes: readonly number[]): FtmsIndoorBikeData | null {
  if (bytes.length < 4) return null;
  const flags = readUInt16LE(bytes, 0);
  let offset = 2;
  const result: FtmsIndoorBikeData = {};
  const moreData = (flags & 0x0001) !== 0;
  if (!moreData) {
    result.speedKph = readUInt16LE(bytes, offset) / 100;
    offset += 2;
  }
  if ((flags & 0x0002) !== 0 && bytes.length >= offset + 2) {
    result.cadenceRpm = readUInt16LE(bytes, offset) / 2;
    offset += 2;
  }
  if ((flags & 0x0004) !== 0 && bytes.length >= offset + 3) {
    result.distanceMeters = readUInt24LE(bytes, offset);
    offset += 3;
  }
  if ((flags & 0x0040) !== 0 && bytes.length >= offset + 2) {
    result.powerWatts = readInt16LE(bytes, offset);
  }
  return hasAny(result) ? result : null;
}

function hasAny(value: Record<string, unknown>): boolean {
  return Object.values(value).some(item => item !== undefined && Number.isFinite(item as number));
}

function readUInt16LE(bytes: readonly number[], offset: number): number {
  return (bytes[offset] ?? 0) | ((bytes[offset + 1] ?? 0) << 8);
}

function readInt16LE(bytes: readonly number[], offset: number): number {
  const value = readUInt16LE(bytes, offset);
  return value & 0x8000 ? value - 0x10000 : value;
}

function readUInt24LE(bytes: readonly number[], offset: number): number {
  return (bytes[offset] ?? 0) | ((bytes[offset + 1] ?? 0) << 8) | ((bytes[offset + 2] ?? 0) << 16);
}
