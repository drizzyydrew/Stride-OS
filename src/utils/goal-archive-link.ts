/** Archive IDs are opaque storage keys, and can themselves contain percent escapes.
 * Expo Router decodes search values again in useLocalSearchParams. A hex token
 * keeps that decoding from changing the key; stored IDs and snapshots stay intact.
 */
export function goalArchiveLink(archiveId: string) {
  const token = Array.from({ length: archiveId.length }, (_, index) =>
    archiveId.charCodeAt(index).toString(16).padStart(4, '0')).join('');
  return { pathname: '/(tabs)/settings/goal-archive-detail' as const,
    params: { archiveKey: `v1_${token}` } };
}

function decodeToken(value: unknown): string | null {
  if (typeof value !== 'string' || !/^v1_(?:[0-9a-f]{4})+$/.test(value) || value.length > 32771) return null;
  let decoded = '';
  for (let offset = 3; offset < value.length; offset += 4) decoded += String.fromCharCode(parseInt(value.slice(offset, offset + 4), 16));
  return decoded;
}

/** Call only with the current owner's already-filtered archive collection.
 * Legacy links are accepted only if exactly one key survives Router's one decode.
 * Never infer an archive from its title, date, race, position or pending goal.
 */
export function archiveFromLink<T extends { id: string }>(
  archives: readonly T[], params: { archiveKey?: unknown; id?: unknown },
): T | undefined {
  if (params.archiveKey !== undefined) {
    const id = decodeToken(params.archiveKey);
    if (id === null) return undefined;
    const matches = archives.filter(archive => archive.id === id);
    return matches.length === 1 ? matches[0] : undefined;
  }
  if (typeof params.id !== 'string' || !params.id) return undefined;
  const matches = archives.filter(archive => {
    if (archive.id === params.id) return true;
    try { return decodeURIComponent(archive.id) === params.id; }
    catch { return false; }
  });
  return matches.length === 1 ? matches[0] : undefined;
}
