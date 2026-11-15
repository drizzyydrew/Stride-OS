/** Display only: retain full-precision activity values in storage and calculations. */
export function formatHistoryNumber(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return (Math.abs(value) < 0.005 ? 0 : value).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  });
}
