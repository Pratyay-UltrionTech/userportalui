export type CanonicalBookingStatus = 'scheduled' | 'assigned' | 'arrived' | 'in_progress' | 'completed' | 'cancelled';

export function normalizeBookingStatus(raw: string | null | undefined): CanonicalBookingStatus {
  const s = String(raw ?? '').trim().toLowerCase();
  if (s === 'completed') return 'completed';
  if (s === 'cancelled' || s === 'canceled') return 'cancelled';
  if (s === 'in_progress') return 'in_progress';
  if (s === 'arrived' || s === 'checked_in') return 'arrived';
  if (s === 'assigned') return 'assigned';
  return 'scheduled';
}

export function isFinalBookingStatus(raw: string | null | undefined): boolean {
  const s = normalizeBookingStatus(raw);
  return s === 'completed' || s === 'cancelled';
}
