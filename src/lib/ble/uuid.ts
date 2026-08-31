export function normalizeBleUuid(uuid: string | null | undefined): string {
  return String(uuid ?? '').trim().toUpperCase();
}

export function shortBleUuid(uuid: string | null | undefined): string {
  const normalized = normalizeBleUuid(uuid);
  if (!normalized) return '';
  const match = normalized.match(/^0000([0-9A-F]{4})-0000-1000-8000-00805F9B34FB$/);
  return match?.[1] ?? normalized;
}

export function hasBleService(services: readonly string[] | null | undefined, serviceUuid: string): boolean {
  const target = shortBleUuid(serviceUuid);
  return (services ?? []).some(service => shortBleUuid(service) === target);
}
