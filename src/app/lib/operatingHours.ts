/**
 * Resolve branch/mobile operating-day end when "close" is not after "open" on a 24h clock.
 * Handles PM close mis-keyed as AM (e.g. 09:00–05:00 meaning 09:00–17:00) before assuming overnight.
 */
export function resolveOperatingCloseMinutes(openM: number, closeM: number): number {
  if (closeM > openM) return closeM;
  const candidate = closeM + 12 * 60;
  if (candidate > openM) return candidate;
  return closeM + 24 * 60;
}
