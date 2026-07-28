import { fetchPublicJson } from './userPublicApi';
import { isBookableCatalogService } from './adminPortalBridge';
import type { AddonItem, ServiceItem } from './branchCatalogTypes';
import { mapService } from './branchMappers';
import { sortServicesByDisplayOrder } from './catalogServiceNormalize';
import { resolveOperatingCloseMinutes } from './operatingHours';

/** Same as backend `BASE_SLOT_MINUTES` / `snap_duration_to_base_slots` for total booking length. */
const BASE_SLOT_MINUTES = 30;

function snapBookingDurationToBaseSlots(minutes: number): number {
  let m = Math.max(BASE_SLOT_MINUTES, Math.round(Number(minutes) || 0));
  const rem = m % BASE_SLOT_MINUTES;
  return rem ? m + BASE_SLOT_MINUTES - rem : m;
}

const MOBILE_SNAPSHOT_KEY_PREFIX = 'carwash_user_mobile_snapshot_v1';
const MOBILE_SNAPSHOT_LAST_KEY = `${MOBILE_SNAPSHOT_KEY_PREFIX}_last`;

type MobileServiceItem = {
  id: string;
  name: string;
  price: number;
  free_coffee_count?: number;
  eligible_for_loyalty_points?: boolean;
  recommended?: boolean;
  description_points?: string[];
  active?: boolean;
};

type MobileAddonItem = {
  id: string;
  name: string;
  price: number;
  description_points?: string[];
  active?: boolean;
};

type MobileVehicleBlock = {
  id: string;
  vehicle_type: string;
  services: MobileServiceItem[];
  addons: MobileAddonItem[];
};

type MobilePromotion = {
  id: string;
  code_name: string;
  discount_type: 'percentage' | 'flat';
  discount_value: number;
  validity_start: string;
  validity_end: string;
  max_uses_per_customer: number;
  applicable_service_ids: string[];
  applicable_vehicle_types: string[];
};

type MobileDayRule = {
  id: string;
  title: string;
  description: string;
  discount_type: 'percentage' | 'flat';
  discount_value: number;
  applicable_service_ids: string[];
  applicable_vehicle_types: string[];
  applicable_days: string[];
  time_window_start: string;
  time_window_end: string;
  validity_start: string;
  validity_end: string;
};

type MobileSlotSettings = {
  /** Preferred: slot start interval from admin (mobile ops). */
  slot_duration_minutes?: number;
  manager_slot_duration_minutes?: number;
  open_time: string;
  close_time: string;
  slot_window_active_by_key: Record<string, boolean>;
};

type MobileServiceArea = {
  requested_pin_code: string;
  city_pin_code: string;
  manager_id: string;
  available_drivers: number;
};

export type MobileSnapshot = {
  service_area: MobileServiceArea;
  vehicle_blocks: MobileVehicleBlock[];
  /** When present, these add-ons apply to every vehicle (replaces per-block add-ons). */
  mobile_addons?: MobileAddonItem[];
  promotions: MobilePromotion[];
  day_time_rules: MobileDayRule[];
  loyalty?: {
    qualifying_service_count?: number;
    tiers?: unknown[];
  };
  slot_settings: MobileSlotSettings | null;
};

export type MobileServiceability = {
  serviceable: boolean;
  city_pin_code: string;
  available_drivers: number;
  requested_pin_code?: string;
};

export type MobileSlotOption = {
  startTime: string;
  endTime: string;
  label: string;
  capacity: number;
  booked: number;
  available: number;
};

function parseHHMM(v: string): number {
  const [hh, mm] = v.split(':');
  const h = Number.parseInt(hh ?? '0', 10);
  const m = Number.parseInt(mm ?? '0', 10);
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}

function fmtHHMM(total: number): string {
  const mins = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function to12h(hhmm: string): string {
  const [hhRaw, mm] = hhmm.split(':');
  let hh = Number.parseInt(hhRaw ?? '0', 10);
  const suffix = hh >= 12 ? 'PM' : 'AM';
  if (hh === 0) hh = 12;
  else if (hh > 12) hh -= 12;
  return `${String(hh).padStart(2, '0')}:${mm ?? '00'} ${suffix}`;
}

function inDateRange(dateISO: string, start?: string, end?: string): boolean {
  if (start && dateISO < start) return false;
  if (end && dateISO > end) return false;
  return true;
}

function inTimeRange(timeHHMM: string, start?: string, end?: string): boolean {
  if (!start || !end) return true;
  const t = parseHHMM(timeHHMM);
  return t >= parseHHMM(start) && t < parseHHMM(end);
}

function dayShortName(dateISO: string): string {
  const date = new Date(`${dateISO}T00:00:00`);
  return date.toLocaleDateString('en-US', { weekday: 'short' });
}

export function getMobilePinFromBranchId(branchId?: string | null): string | null {
  if (!branchId) return null;
  if (!branchId.startsWith('mobile-')) return null;
  return branchId.slice('mobile-'.length) || null;
}

function snapshotKey(pinCode?: string): string {
  const pin = String(pinCode ?? '').trim();
  return pin ? `${MOBILE_SNAPSHOT_KEY_PREFIX}_${pin}` : MOBILE_SNAPSHOT_LAST_KEY;
}

export function getCachedMobileSnapshot(pinCode?: string): MobileSnapshot | null {
  try {
    const raw = sessionStorage.getItem(snapshotKey(pinCode));
    if (!raw) return null;
    return JSON.parse(raw) as MobileSnapshot;
  } catch {
    return null;
  }
}

/** Drop vehicle blocks that are no longer in the public admin catalog (stale session cache). */
export function pruneCachedMobileSnapshotsToAllowedTypes(allowedTypes: readonly string[]): void {
  const allowed = new Set(allowedTypes.map((t) => String(t).trim()).filter(Boolean));
  if (allowed.size === 0) return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k?.startsWith(MOBILE_SNAPSHOT_KEY_PREFIX)) keys.push(k);
    }
    for (const key of keys) {
      const raw = sessionStorage.getItem(key);
      if (!raw) continue;
      const snap = JSON.parse(raw) as MobileSnapshot;
      const prev = snap.vehicle_blocks ?? [];
      const nextBlocks = prev.filter((b) => allowed.has(String(b.vehicle_type ?? '').trim()));
      if (nextBlocks.length !== prev.length) {
        sessionStorage.setItem(key, JSON.stringify({ ...snap, vehicle_blocks: nextBlocks }));
      }
    }
  } catch {
    // ignore quota / parse errors
  }
}

function setCachedMobileSnapshot(pinCode: string, snapshot: MobileSnapshot): void {
  try {
    const key = snapshotKey(pinCode);
    sessionStorage.setItem(key, JSON.stringify(snapshot));
    sessionStorage.setItem(MOBILE_SNAPSHOT_LAST_KEY, JSON.stringify(snapshot));
  } catch {
    // ignore cache write errors
  }
}

export async function checkMobileServiceability(pinCode: string): Promise<MobileServiceability> {
  return fetchPublicJson<MobileServiceability>(
    `/public/mobile/serviceability/${encodeURIComponent(pinCode)}`
  );
}

export async function fetchMobileSnapshot(pinCode: string): Promise<MobileSnapshot> {
  const snapshot = await fetchPublicJson<MobileSnapshot>(
    `/public/mobile/snapshot?pin_code=${encodeURIComponent(pinCode)}`
  );
  setCachedMobileSnapshot(pinCode, snapshot);
  return snapshot;
}

export function listMobileVehicleTypes(snapshot: MobileSnapshot): string[] {
  const set = new Set<string>();
  for (const b of snapshot.vehicle_blocks ?? []) {
    const type = String(b.vehicle_type ?? '').trim();
    if (!type) continue;
    if ((b.services ?? []).some(isBookableCatalogService)) set.add(type);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

export function getMobileCatalogForVehicle(
  snapshot: MobileSnapshot,
  vehicleType: string
): {
  services: ServiceItem[];
  addons: AddonItem[];
} {
  const block = (snapshot.vehicle_blocks ?? []).find((b) => b.vehicle_type === vehicleType);
  if (!block) return { services: [], addons: [] };
  const globalAddons = (snapshot.mobile_addons ?? []).filter((a) => a.active !== false);
  const legacyBlockAddons = (block.addons ?? []).filter((a) => a.active !== false);
  const addonRows = globalAddons.length > 0 ? globalAddons : legacyBlockAddons;
  const activeServices = (block.services ?? []).filter((s) => s && s.active !== false);
  return {
    services: sortServicesByDisplayOrder(activeServices.map((s) => mapService(s))),
    addons: addonRows.map((a) => ({
      id: a.id,
      name: a.name,
      price: Number(a.price ?? 0),
      descriptionPoints: Array.isArray(a.description_points) ? a.description_points.map(String) : [],
      active: a.active !== false,
    })),
  };
}

/** Complimentary coffees from the mobile catalog snapshot for the selected line item. */
export function getMobileFreeCoffeeCupsForLineItem(
  snapshot: MobileSnapshot | null,
  vehicleType: string | null | undefined,
  serviceId: string | null | undefined
): number {
  if (!snapshot || !vehicleType || !serviceId) return 0;
  const { services } = getMobileCatalogForVehicle(snapshot, vehicleType);
  const svc = services.find((s) => s.id === serviceId);
  return Math.max(0, Math.floor(Number(svc?.freeCoffeeCount ?? 0)));
}

export function listApplicableMobileDiscounts(
  snapshot: MobileSnapshot,
  dateISO: string,
  timeHHMM: string,
  serviceId: string,
  vehicleType: string
): Array<{ id: string; title: string; description: string; discountType: 'percentage' | 'flat'; discountValue: number }> {
  return (snapshot.day_time_rules ?? [])
    .filter((rule) => {
      const serviceOk =
        !rule.applicable_service_ids?.length || rule.applicable_service_ids.includes(serviceId);
      const vehicleOk =
        !rule.applicable_vehicle_types?.length || rule.applicable_vehicle_types.includes(vehicleType);
      const dateOk = inDateRange(dateISO, rule.validity_start, rule.validity_end);
      const dayOk =
        !rule.applicable_days?.length || rule.applicable_days.includes(dayShortName(dateISO));
      const timeOk = inTimeRange(timeHHMM, rule.time_window_start, rule.time_window_end);
      return serviceOk && vehicleOk && dateOk && dayOk && timeOk;
    })
    .map((rule) => ({
      id: rule.id,
      title: rule.title,
      description: rule.description,
      discountType: rule.discount_type,
      discountValue: Number(rule.discount_value ?? 0),
    }));
}

export function listMobilePromoCodes(
  snapshot: MobileSnapshot,
  dateISO?: string,
  vehicleType?: string,
  serviceId?: string,
): Array<{ id: string; codeName: string; discountType: 'percentage' | 'flat'; discountValue: number; maxUsesPerCustomer: number }> {
  return (snapshot.promotions ?? [])
    .filter((promo) => {
      if (dateISO && !inDateRange(dateISO, promo.validity_start, promo.validity_end)) return false;
      // Filter by applicable vehicle types (if the promo restricts to specific types)
      if (vehicleType && Array.isArray(promo.applicable_vehicle_types) && promo.applicable_vehicle_types.length > 0) {
        const selected = vehicleType.trim().toLowerCase();
        if (!promo.applicable_vehicle_types.some((vt: string) => vt.trim().toLowerCase() === selected)) return false;
      }
      // Filter by applicable service IDs (if the promo restricts to specific services)
      if (serviceId && Array.isArray(promo.applicable_service_ids) && promo.applicable_service_ids.length > 0) {
        if (!promo.applicable_service_ids.includes(serviceId)) return false;
      }
      return true;
    })
    .map((promo) => ({
      id: promo.id,
      codeName: promo.code_name,
      discountType: promo.discount_type,
      discountValue: Number(promo.discount_value ?? 0),
      maxUsesPerCustomer: Math.max(1, Number(promo.max_uses_per_customer ?? 1)),
    }));
}

/**
 * Offline fallback: 30-minute grid, `bookingDurationMinutes` total block length (snapped to 30).
 * Prefer {@link listMobileSlotsFromApi} when online.
 */
export function listMobileSlots(snapshot: MobileSnapshot, bookingDurationMinutes = 60): MobileSlotOption[] {
  const settings = snapshot.slot_settings;
  if (!settings) return [];
  const open = parseHHMM(settings.open_time);
  const close = resolveOperatingCloseMinutes(open, parseHHMM(settings.close_time));
  let dur = snapBookingDurationToBaseSlots(Math.round(Number(bookingDurationMinutes) || 60));
  dur = Math.min(480, dur);
  dur = Math.min(dur, Math.max(BASE_SLOT_MINUTES, close - open));
  const capacity = Math.max(0, Number(snapshot.service_area.available_drivers ?? 0));
  const out: MobileSlotOption[] = [];
  /** Public mobile slot list steps starts by 30 min (matches `mobile_slot_service.list_slot_availability`). */
  for (let t = open; t + dur <= close; t += BASE_SLOT_MINUTES) {
    const start = fmtHHMM(t);
    const end = fmtHHMM(t + dur);
    const key = `${start}|${end}`;
    const active = settings.slot_window_active_by_key?.[key] !== false;
    out.push({
      startTime: start,
      endTime: end,
      label: `${to12h(start)} - ${to12h(end)}`,
      capacity: active ? capacity : 0,
      booked: 0,
      available: active ? capacity : 0,
    });
  }
  return out;
}

export async function listMobileSlotsFromApi(
  pinCode: string,
  dateISO: string,
  bookingDurationMinutes?: number,
  opts?: { signal?: AbortSignal }
): Promise<MobileSlotOption[]> {
  const durForApi =
    bookingDurationMinutes != null && Number.isFinite(bookingDurationMinutes)
      ? snapBookingDurationToBaseSlots(Math.round(Number(bookingDurationMinutes)))
      : undefined;
  const durQ =
    durForApi != null
      ? `&duration_minutes=${encodeURIComponent(String(durForApi))}`
      : '';
  try {
    const rows = await fetchPublicJson<any[]>(
      `/public/mobile/slots?pin_code=${encodeURIComponent(pinCode)}&date=${encodeURIComponent(dateISO)}${durQ}`,
      opts?.signal ? { signal: opts.signal } : undefined
    );
    if (!Array.isArray(rows)) return [];
    return rows.map((s) => ({
      startTime: String(s.startTime ?? s.start_time ?? ''),
      endTime: String(s.endTime ?? s.end_time ?? ''),
      label: String(s.label ?? ''),
      capacity: Number(s.capacity ?? 0),
      booked: Number(s.booked ?? 0),
      available: Number(s.available ?? 0),
    }));
  } catch (e: unknown) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e;
    if (e instanceof Error && e.name === 'AbortError') throw e;
    const snapshot = getCachedMobileSnapshot(pinCode);
    return snapshot ? listMobileSlots(snapshot, bookingDurationMinutes) : [];
  }
}

export type MobileBookingCreateInput = {
  cityPinCode: string;
  customerName: string;
  phone: string;
  address: string;
  vehicleSummary: string;
  serviceId?: string | null;
  vehicleType: string;
  vehicleModel: string;
  registrationNumber?: string;
  selectedAddonIds: string[];
  slotDate: string;
  startTime: string;
  /** Omit so the API derives end time from service duration + add-ons (+30 min each). */
  endTime?: string;
  notes?: string;
  tipCents?: number;
  serviceChargedCents?: number;
  /** Guest / checkout contact email (persisted on booking for admin Customers). */
  customerEmail?: string;
  /** Optional customer bearer token for recording vehicle history. */
  token?: string;
  /** Active loyalty reward ID to consume atomically with this booking. */
  loyaltyRewardId?: string;
  /** Applied promo code (stored on booking for server-side usage tracking). */
  promoCode?: string;
  /** Payment method chosen by the customer (e.g. 'later', 'card', 'apple'). */
  paymentMethod?: string;
};

export type MobileBookingRow = {
  id: string;
  status: string;
  tip_cents?: number;
  customer_id?: string | null;
  /** Phone number — used to derive the guest booking ID suffix when customer_id is absent. */
  phone?: string;
  address?: string;
};

export async function fetchMobileBookingById(bookingId: string): Promise<MobileBookingRow | null> {
  try {
    return await fetchPublicJson<MobileBookingRow>(`/public/mobile/bookings/${bookingId}`);
  } catch {
    return null;
  }
}

export async function createMobileOnlineBooking(
  input: MobileBookingCreateInput
): Promise<{ ok: true; booking: MobileBookingRow } | { ok: false; error?: string }> {
  try {
    const tip = Math.min(50_000, Math.max(0, Math.floor(Number(input.tipCents ?? 0))));
    const body: Record<string, unknown> = {
      city_pin_code: input.cityPinCode,
      customer_name: input.customerName,
      phone: input.phone,
      customer_email: (input.customerEmail ?? '').trim(),
      address: input.address,
      vehicle_summary: input.vehicleSummary,
      service_id: input.serviceId ?? null,
      vehicle_type: input.vehicleType,
      selected_addon_ids: input.selectedAddonIds,
      slot_date: input.slotDate,
      start_time: input.startTime,
      source: 'online',
      notes: input.notes ?? '',
      tip_cents: tip,
      ...(input.serviceChargedCents != null
        ? { service_charged_cents: Math.max(0, Math.floor(Number(input.serviceChargedCents))) }
        : {}),
      vehicle_model: input.vehicleModel,
      registration_number: input.registrationNumber ?? '',
    };
    if (input.endTime) body.end_time = input.endTime;
    if (input.loyaltyRewardId) body.loyalty_reward_id = input.loyaltyRewardId;
    if (input.promoCode) body.promo_code = input.promoCode.trim().toUpperCase();
    if (input.paymentMethod) body.payment_method = input.paymentMethod;
    const headers: Record<string, string> = {};
    if (input.token) headers.Authorization = `Bearer ${input.token}`;

    const out = await fetchPublicJson<MobileBookingRow>('/public/mobile/bookings', {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    return { ok: true, booking: out };
  } catch (e) {
    const msg = e instanceof Error ? e.message : undefined;
    return { ok: false, error: msg };
  }
}
