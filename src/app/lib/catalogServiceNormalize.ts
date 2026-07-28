/**
 * Single normalization path for catalog services from `/public/*` JSON.
 * Keep in sync with `ADMIN/src/app/lib/catalogShapeTypes.ts` → `migrateServiceItem`.
 */

import type { ServiceItem } from './branchCatalogTypes';

const DISPLAY_SEQUENCE_FALLBACK = 999;

function coalesceDisplaySequence(raw: unknown): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const v = Math.floor(raw);
    if (v >= 1) return Math.min(v, 999999);
  }
  const p = parseInt(String(raw ?? '').trim(), 10);
  if (!Number.isNaN(p) && p >= 1) return Math.min(p, 999999);
  return DISPLAY_SEQUENCE_FALLBACK;
}

/** Sort catalog services for user-facing lists: sequence ascending, then name. */
export function sortServicesByDisplayOrder<T extends { sequence?: number; name?: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const da = coalesceDisplaySequence(a.sequence);
    const db = coalesceDisplaySequence(b.sequence);
    if (da !== db) return da - db;
    return String(a.name ?? '').localeCompare(String(b.name ?? ''), undefined, { sensitivity: 'base' });
  });
}

function coalesceNonNegativeInt(n: unknown, fallback: number): number {
  if (typeof n === 'number' && Number.isFinite(n)) return Math.max(0, Math.floor(n));
  const p = parseInt(String(n), 10);
  if (!Number.isNaN(p)) return Math.max(0, p);
  return fallback;
}

function snapDurationMinutes(raw: unknown): number {
  let v =
    typeof raw === 'number' && Number.isFinite(raw) ? Math.round(raw) : parseInt(String(raw ?? 60), 10);
  if (!Number.isFinite(v) || v < 30) v = 60;
  const rem = v % 30;
  if (rem) v += 30 - rem;
  return Math.min(480, v);
}

function readBooleanField(
  x: Record<string, unknown>,
  camel: string,
  snake: string,
  defaultIfMissing: boolean
): boolean {
  const v = x[camel] ?? x[snake];
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') {
    if (v === 1) return true;
    if (v === 0) return false;
  }
  if (typeof v === 'string') {
    const t = v.trim().toLowerCase();
    if (t === 'true' || t === '1' || t === 'yes') return true;
    if (t === 'false' || t === '0' || t === 'no') return false;
  }
  return defaultIfMissing;
}

export type NormalizeCatalogServiceOptions = {
  /** When false, loyalty icon/perks only show if admin explicitly enabled the flag. */
  loyaltyDefaultIfMissing?: boolean;
  /** When true, ignore legacy `includesFreeCoffee` and only use `free_coffee_count`. */
  coffeeFromCountFieldOnly?: boolean;
};

/** Normalize API / snapshot JSON into a `ServiceItem` (snake_case + camelCase + 0/1). */
export function normalizeCatalogServiceItem(
  s: unknown,
  options: NormalizeCatalogServiceOptions = {}
): ServiceItem {
  const x = s as Record<string, unknown>;
  const pts = x.descriptionPoints ?? x.description_points;
  const exPts = x.excludedPoints ?? x.excluded_points;
  const loyaltyDefault = options.loyaltyDefaultIfMissing ?? true;
  const coffeeFromCountOnly = options.coffeeFromCountFieldOnly === true;

  let freeCoffeeCount = 0;
  const rawFc = x.freeCoffeeCount ?? x.free_coffee_count;
  if (rawFc !== undefined && rawFc !== null) {
    freeCoffeeCount = coalesceNonNegativeInt(rawFc, 0);
  } else if (!coffeeFromCountOnly && x.includesFreeCoffee === true) {
    freeCoffeeCount = 1;
  }

  const eligibleForLoyaltyPoints = readBooleanField(
    x,
    'eligibleForLoyaltyPoints',
    'eligible_for_loyalty_points',
    loyaltyDefault
  );
  const recommended = readBooleanField(x, 'recommended', 'recommended', false);
  const active = readBooleanField(x, 'active', 'active', true);

  const rawGid = x.catalogGroupId ?? x.catalog_group_id;
  const catalogGroupId =
    typeof rawGid === 'string' && rawGid.trim() ? String(rawGid).trim() : undefined;

  return {
    id: String(x.id ?? ''),
    name: String(x.name ?? ''),
    price: typeof x.price === 'number' ? x.price : parseFloat(String(x.price)) || 0,
    ...(catalogGroupId ? { catalogGroupId } : {}),
    freeCoffeeCount,
    eligibleForLoyaltyPoints,
    recommended,
    descriptionPoints: Array.isArray(pts)
      ? pts.map(String)
      : typeof pts === 'string'
        ? pts.split('\n').map((l) => l.trim()).filter(Boolean)
        : [],
    excludedPoints: Array.isArray(exPts)
      ? exPts.map(String)
      : typeof exPts === 'string'
        ? exPts.split('\n').map((l) => l.trim()).filter(Boolean)
        : [],
    active,
    durationMinutes: snapDurationMinutes(x.durationMinutes ?? x.duration_minutes),
    category: String(x.category ?? x.type ?? 'Washing'),
    sequence: coalesceDisplaySequence(x.sequence ?? x.display_order ?? x.displayOrder),
  };
}

/** Landing hero pricing — only surface perks explicitly configured in admin catalog. */
export function normalizeLandingCatalogService(s: unknown): ServiceItem {
  return normalizeCatalogServiceItem(s, {
    loyaltyDefaultIfMissing: false,
    coffeeFromCountFieldOnly: true,
  });
}
