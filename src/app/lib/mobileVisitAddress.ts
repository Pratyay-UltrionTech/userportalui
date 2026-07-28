/** Digits-only postcode / PIN (AU and similar). */
export function normalizePinDigits(raw: string): string {
  return String(raw ?? '').replace(/\D/g, '');
}

/** True if `pin` appears as its own numeric token in `address` (not part of a longer digit run). */
export function addressContainsServicePin(address: string, pin: string): boolean {
  const p = normalizePinDigits(pin);
  if (p.length < 3) return false;
  const esc = p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^0-9])${esc}([^0-9]|$)`).test(String(address ?? ''));
}

/** Address must include at least one of the accepted postcodes (e.g. service hub + user-checked PIN). */
export function addressMatchesAcceptedPins(address: string, pins: string[]): boolean {
  const seen = new Set<string>();
  for (const raw of pins) {
    const p = normalizePinDigits(raw);
    if (!p || seen.has(p)) continue;
    seen.add(p);
    if (addressContainsServicePin(address, p)) return true;
  }
  return false;
}
