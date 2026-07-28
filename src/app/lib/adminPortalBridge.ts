import type {
  AddonItem,
  AdminState,
  BranchData,
  DayTimePriceRule,
  PromoCode,
  ServiceItem,
  UserBranch,   
} from './branchCatalogTypes';
import { fetchPublicJson } from './userPublicApi';
import { getPublicCatalogState, hydratePublicCatalogFromApi } from './publicDataStore';
import { resolveOperatingCloseMinutes } from './operatingHours';
import { sortServicesByDisplayOrder } from './catalogServiceNormalize';

/** Same as backend `BASE_SLOT_MINUTES` — public slot duration & add-on blocks are 30-minute based. */
const SLOT_GRID_FALLBACK_MINUTES = 30;

export type {
  AddonItem,
  AdminState,
  BranchData,
  DayTimePriceRule,
  PromoCode,
  ServiceItem,
  UserBranch,
} from './branchCatalogTypes';

function loadAdminState(): AdminState {
  return getPublicCatalogState();
}

export interface SlotOption {
  startTime: string;
  endTime: string;
  label: string;
  capacity: number;
  booked: number;
  available: number;
  /** Bays open by schedule (ignores existing bookings). 0 means window closed / not bookable. */
  scheduleOpenBays?: number;
  durationMinutes?: number;
  slotsNeeded?: number;
}

export interface CatalogForVehicle {
  services: ServiceItem[];
  addons: AddonItem[];
}

export interface BranchAddonItem {
  id: string;
  name: string;
  price: number;
  descriptionPoints?: string[];
}

export interface ApplicableDiscount {
  id: string;
  title: string;
  description: string;
  discountType: 'percentage' | 'flat';
  discountValue: number;
}

export interface BranchOfferCard {
  id: string;
  title: string;
  discountLabel: string;
  timeLabel: string;
  branches: string[];
  serviceType: 'branch' | 'mobile' | 'both';
}

export interface BookingWriteInput {
  branchId: string;
  customerName: string;
  phone: string;
  address: string;
  vehicleType: string;
  vehicleModel: string;
  registrationNumber?: string;
  serviceSummary: string;
  /** Catalog service id — required for loyalty tracking on branch bookings. */
  serviceId?: string;
  selectedAddonIds?: string[];
  slotDate: string;
  startTime: string;
  /** Omit to let the API compute from service duration + add-ons. */
  endTime?: string;
  /** Optional gratuity in cents (stored on booking; max $500 server-side). */
  tipCents?: number;
  /** Service + add-ons in cents after discounts (excl. tip), as shown at payment. */
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
}

/** Matches backend `snap_duration_to_base_slots` — booking length is always in 30-minute increments. */
function snapBookingDurationToBaseSlots(minutes: number): number {
  let m = Math.max(SLOT_GRID_FALLBACK_MINUTES, Math.round(Number(minutes) || 0));
  const rem = m % SLOT_GRID_FALLBACK_MINUTES;
  return rem ? m + SLOT_GRID_FALLBACK_MINUTES - rem : m;
}

/** Total block length (service + 30 min per add-on), same rules as `total_minutes_for_service_and_addons` on the server. */
export function estimateBranchBookingMinutes(
  service: Pick<ServiceItem, 'durationMinutes'> | null | undefined,
  addonCount: number
): number {
  const rawBase = Math.max(
    SLOT_GRID_FALLBACK_MINUTES,
    Math.round(Number(service?.durationMinutes ?? 60) || 60)
  );
  let base = snapBookingDurationToBaseSlots(rawBase);
  base = Math.min(480, base);
  return base + Math.max(0, addonCount) * 30;
}

/** Shape returned by POST/GET public booking endpoints. */
export type PublicBookingRow = {
  id: string;
  branch_id?: string;
  status: string;
  tip_cents?: number;
  slot_date?: string;
  start_time?: string;
  end_time?: string;
  service_summary?: string;
  vehicle_type?: string;
  vehicle_model?: string;
  customer_id?: string | null;
  /** Phone number — present for guest bookings (no customer_id). Used to derive the guest booking ID suffix. */
  phone?: string;
};

export async function fetchPublicBookingById(
  branchId: string,
  bookingId: string
): Promise<PublicBookingRow | null> {
  try {
    return await fetchPublicJson<PublicBookingRow>(`/public/branches/${branchId}/bookings/${bookingId}`);
  } catch {
    return null;
  }
}

/** Refresh in-memory catalog from the API (database is source of truth). */
export async function syncAdminStateFromPortal(): Promise<boolean> {
  return hydratePublicCatalogFromApi();
}

export function listBranches(query = ''): UserBranch[] {
  const q = query.trim().toLowerCase();
  const branches = loadAdminState().branches;
  if (!q) return branches;
  return branches.filter(
    (b) =>
      b.name.toLowerCase().includes(q) ||
      b.location.toLowerCase().includes(q) ||
      b.zipCode.toLowerCase().includes(q)
  );
}

export function getBranchById(branchId: string): UserBranch | null {
  return loadAdminState().branches.find((b) => b.id === branchId) ?? null;
}

function getBranchData(branchId: string): BranchData | null {
  return loadAdminState().dataByBranchId[branchId] ?? null;
}

/** Active service created via admin Services catalog (excludes legacy placeholder rows). */
export function isBookableCatalogService(
  s: { active?: boolean; catalogGroupId?: string | null; catalog_group_id?: string | null },
): boolean {
  const groupId = s.catalogGroupId ?? s.catalog_group_id;
  return s.active !== false && !!groupId;
}

function bookableVehicleTypeFromBranchBlock(v: { vehicleType?: string; services?: ServiceItem[] }): string | null {
  const type = String(v.vehicleType ?? '').trim();
  if (!type) return null;
  if (!(v.services ?? []).some(isBookableCatalogService)) return null;
  return type;
}

function bookableVehicleTypeFromMobileBlock(b: {
  vehicle_type?: string;
  services?: { active?: boolean; catalog_group_id?: string | null; catalogGroupId?: string | null }[];
}): string | null {
  const type = String(b.vehicle_type ?? '').trim();
  if (!type) return null;
  if (!(b.services ?? []).some(isBookableCatalogService)) return null;
  return type;
}

export function listVehicleTypes(branchId: string): string[] {
  const data = getBranchData(branchId);
  if (!data) return [];
  const set = new Set<string>();
  for (const v of data.vehicleServices) {
    const type = bookableVehicleTypeFromBranchBlock(v);
    if (type) set.add(type);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

/**
 * Every distinct vehicle type that has at least one active service across all
 * branch and mobile admin catalogs. Merged and deduplicated; exact admin labels.
 */
export function listAllBookableVehicleTypes(): string[] {
  const adminState = loadAdminState();
  const set = new Set<string>();

  for (const br of adminState.branches) {
    const data = getBranchData(br.id);
    if (!data) continue;
    for (const v of data.vehicleServices) {
      const type = bookableVehicleTypeFromBranchBlock(v);
      if (type) set.add(type);
    }
  }

  for (const type of adminState.mobileVehicleTypes ?? []) {
    const t = String(type).trim();
    if (t) set.add(t);
  }

  // Do not merge sessionStorage mobile snapshots here — they often contain stale
  // vehicle types from an older catalog and caused Profile Setup to show Hatch/sedan/SUV.

  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

export function getCatalogForVehicle(branchId: string, vehicleType: string): CatalogForVehicle {
  const data = getBranchData(branchId);
  if (!data) return { services: [], addons: [] };
  const block = data.vehicleServices.find((v) => v.vehicleType === vehicleType);
  const branchWideAddons =
    (data.branchAddons ?? []).filter((a) => a.active !== false).length > 0
      ? (data.branchAddons ?? []).filter((a) => a.active !== false)
      : Array.from(
          new Map(
            data.vehicleServices
              .flatMap((v) => v.addons ?? [])
              .filter((a) => a.active !== false)
              .map((a) => [a.id, a])
          ).values()
        );
  if (!block) {
    return { services: [], addons: branchWideAddons };
  }
  return {
    services: sortServicesByDisplayOrder((block.services ?? []).filter((s) => s.active !== false)),
    addons: branchWideAddons,
  };
}

/** Reward service ids selected in branch loyalty slabs. */
export function getBranchLoyaltyRewardServiceIds(branchId: string): string[] {
  const data = getBranchData(branchId);
  return (data?.loyaltyRewardServiceIds ?? []).filter(Boolean);
}

/**
 * Complimentary coffees for the selected catalog service (from API snapshot `free_coffee_count`).
 * Add-ons do not carry a coffee count in the public catalog.
 */
export function getFreeCoffeeCupsForLineItem(
  branchId: string,
  vehicleType: string | null | undefined,
  serviceId: string | null | undefined
): number {
  if (!branchId || !vehicleType || !serviceId) return 0;
  const { services } = getCatalogForVehicle(branchId, vehicleType);
  const svc = services.find((s) => s.id === serviceId);
  return Math.max(0, Math.floor(Number(svc?.freeCoffeeCount ?? 0)));
}

export function listBranchAddons(branchId: string): BranchAddonItem[] {
  const data = getBranchData(branchId);
  if (!data) return [];
  const branchLevel = (data.branchAddons ?? []).filter((a) => a.active !== false);
  if (branchLevel.length > 0) return branchLevel;
  return Array.from(
    new Map(
      data.vehicleServices
        .flatMap((v) => v.addons ?? [])
        .filter((a) => a.active !== false)
        .map((a) => [a.id, a])
    ).values()
  );
}

function parseTimeToMinutes(t: string): number {
  const [h, m] = t.split(':').map((x) => Number.parseInt(x, 10));
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}

function formatMinutesToHHMM(total: number): string {
  const m = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

function format12h(hhmm: string): string {
  const [hRaw, m] = hhmm.split(':');
  let h = Number.parseInt(hRaw, 10);
  const suffix = h >= 12 ? 'PM' : 'AM';
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return `${String(h).padStart(2, '0')}:${m} ${suffix}`;
}

function slotWindowKey(startTime: string, endTime: string): string {
  return `${startTime}|${endTime}`;
}

function dayWindowKey(isoDate: string, windowKey: string): string {
  return `${isoDate}|${windowKey}`;
}

function generateOperatingDaySlots(
  openTime: string,
  closeTime: string,
  bayCount: number,
  durationMinutes: number
): Array<{ startTime: string; endTime: string }> {
  const open = parseTimeToMinutes(openTime);
  const close = resolveOperatingCloseMinutes(open, parseTimeToMinutes(closeTime));
  const dur = Math.max(15, durationMinutes || 60);
  const slots: Array<{ startTime: string; endTime: string }> = [];
  for (let t = open; t + dur <= close; t += dur) {
    slots.push({
      startTime: formatMinutesToHHMM(t),
      endTime: formatMinutesToHHMM(t + dur),
    });
  }
  return slots;
}

function getOpenBaysForSlot(
  data: BranchData,
  dateISO: string,
  startTime: string,
  endTime: string,
  bayCount: number
): number {
  const wk = slotWindowKey(startTime, endTime);
  let slotActive = data.slotWindowActiveByKey?.[wk] !== false;
  let bays = Array.from({ length: Math.max(1, bayCount) }, () => true);
  const recurring = data.slotBayOpenByWindow?.[wk];
  if (Array.isArray(recurring)) {
    bays = bays.map((_, idx) => (idx < recurring.length ? recurring[idx] !== false : true));
  }
  const dayOverride = data.slotDayStates?.[dayWindowKey(dateISO, wk)];
  if (typeof dayOverride?.slotActive === 'boolean') slotActive = dayOverride.slotActive;
  if (Array.isArray(dayOverride?.baysOpen)) {
    bays = bays.map((open, idx) =>
      idx < dayOverride.baysOpen!.length ? open && dayOverride.baysOpen![idx] !== false : open
    );
  }
  if (!slotActive) return 0;
  return bays.filter(Boolean).length;
}

/** Admin-configured start-time step (minutes). Clamped for sensible UX. */
function slotStartStepMinutesFromBranchData(data: BranchData | null | undefined): number {
  const raw = Math.round(Number(data?.managerSlotDurationMinutes));
  if (Number.isFinite(raw) && raw >= 15 && raw <= 120) return raw;
  return SLOT_GRID_FALLBACK_MINUTES;
}

/** Longest continuous span inside branch hours (minutes). Used so slot listing never asks the API for an impossible duration. */
export function maxOperatingSpanMinutes(branch: Pick<UserBranch, 'openTime' | 'closeTime'>): number {
  const open = parseTimeToMinutes(branch.openTime);
  const close = resolveOperatingCloseMinutes(open, parseTimeToMinutes(branch.closeTime));
  return Math.max(SLOT_GRID_FALLBACK_MINUTES, close - open);
}

/** Drop API rows whose end time is past the branch's configured closing (same-day branches). */
function slotEndsWithinBranchConfiguredClose(branch: UserBranch, slot: SlotOption): boolean {
  const openM = parseTimeToMinutes(branch.openTime);
  const closeLim = resolveOperatingCloseMinutes(openM, parseTimeToMinutes(branch.closeTime));
  if (closeLim > 24 * 60) return true;
  const et = (slot.endTime || '').trim();
  const key = et.length >= 5 ? et.slice(0, 5) : et;
  const endM = parseTimeToMinutes(key);
  return endM <= closeLim;
}

/**
 * Client-side safety filter: drop any slot where startTime + bookingDurationMinutes would
 * exceed the branch's configured close time. Pass openTime/closeTime directly (preferred) or
 * fall back to looking up the branch by ID from the store.
 */
export function filterSlotsWithinBranchClose(
  branchIdOrTimes: string | { openTime: string; closeTime: string },
  slots: SlotOption[],
  bookingDurationMinutes: number
): SlotOption[] {
  let openTime: string;
  let closeTime: string;
  if (typeof branchIdOrTimes === 'string') {
    const branch = getBranchById(branchIdOrTimes);
    if (!branch) return slots;
    openTime = branch.openTime;
    closeTime = branch.closeTime;
  } else {
    openTime = branchIdOrTimes.openTime;
    closeTime = branchIdOrTimes.closeTime;
  }
  const openM = parseTimeToMinutes(openTime);
  const closeM = resolveOperatingCloseMinutes(openM, parseTimeToMinutes(closeTime));
  if (closeM > 24 * 60) return slots; // overnight branch — don't restrict
  const dur = Math.max(30, Math.round(bookingDurationMinutes));
  return slots.filter((s) => {
    const startM = parseTimeToMinutes(s.startTime);
    return startM + dur <= closeM;
  });
}

/**
 * Offline slot list when the public slots API fails (uses last synced catalog).
 * Same 30-minute start grid and duration snapping as the server.
 */
export function listAvailableSlotsFromCache(
  branchId: string,
  dateISO: string,
  bookingDurationMinutes?: number
): SlotOption[] {
  const branch = getBranchById(branchId);
  const data = getBranchData(branchId);
  if (!branch || !data) return [];
  const grid = slotStartStepMinutesFromBranchData(data);
  const raw =
    bookingDurationMinutes != null && Number.isFinite(bookingDurationMinutes)
      ? Math.round(Number(bookingDurationMinutes))
      : SLOT_GRID_FALLBACK_MINUTES;
  const snapped = snapBookingDurationToBaseSlots(raw);
  const maxSpan = maxOperatingSpanMinutes(branch);
  const dur = Math.min(snapped, maxSpan);
  const open = parseTimeToMinutes(branch.openTime);
  const close = resolveOperatingCloseMinutes(open, parseTimeToMinutes(branch.closeTime));
  const baysN = Math.max(1, branch.bayCount);
  const out: SlotOption[] = [];
  for (let t = open; t + dur <= close; t += grid) {
    const st = formatMinutesToHHMM(t);
    const et = formatMinutesToHHMM(t + dur);
    const openBays = getOpenBaysForSlot(data, dateISO, st, et, baysN);
    out.push({
      startTime: st,
      endTime: et,
      label: `${format12h(st)} – ${format12h(et)} (${dur} min)`,
      capacity: baysN,
      booked: Math.max(0, baysN - openBays),
      available: openBays,
      scheduleOpenBays: openBays,
      durationMinutes: dur,
    });
  }
  return out;
}

export async function listAvailableSlots(
  branchId: string,
  dateISO: string,
  bookingDurationMinutes?: number,
  opts?: { signal?: AbortSignal }
): Promise<SlotOption[]> {
  const raw =
    bookingDurationMinutes != null && Number.isFinite(bookingDurationMinutes)
      ? Math.round(Number(bookingDurationMinutes))
      : undefined;
  const branch = getBranchById(branchId);
  let capped =
    raw != null && branch != null ? Math.min(raw, maxOperatingSpanMinutes(branch)) : raw;
  if (capped != null && Number.isFinite(capped) && branch != null) {
    capped = Math.min(snapBookingDurationToBaseSlots(capped), maxOperatingSpanMinutes(branch));
  }

  const durQ =
    capped != null && Number.isFinite(capped)
      ? `&duration_minutes=${encodeURIComponent(String(capped))}`
      : '';

  const mapRow = (s: any): SlotOption => ({
    startTime: String(s.startTime ?? s.start_time ?? ''),
    endTime: String(s.endTime ?? s.end_time ?? ''),
    label: String(s.label ?? ''),
    capacity: Number(s.capacity ?? 0),
    booked: Number(s.booked ?? 0),
    available: Number(s.available ?? 0),
    scheduleOpenBays:
      s.scheduleOpenBays != null
        ? Number(s.scheduleOpenBays)
        : s.schedule_open_bays != null
          ? Number(s.schedule_open_bays)
          : undefined,
    durationMinutes: s.durationMinutes != null ? Number(s.durationMinutes) : undefined,
    slotsNeeded: s.slotsNeeded != null ? Number(s.slotsNeeded) : undefined,
  });

  try {
    const rows = await fetchPublicJson<any[]>(
      `/public/branches/${branchId}/slots?date=${encodeURIComponent(dateISO)}${durQ}`,
      opts?.signal ? { signal: opts.signal } : undefined
    );
    if (!Array.isArray(rows)) return [];
    const mapped = rows.map(mapRow);
    if (!branch) return mapped;
    return mapped.filter((s) => slotEndsWithinBranchConfiguredClose(branch, s));
  } catch (e: unknown) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e;
    if (e instanceof Error && e.name === 'AbortError') throw e;
    return listAvailableSlotsFromCache(branchId, dateISO, capped ?? raw);
  }
}

function inDateRange(dateISO: string, start?: string, end?: string): boolean {
  if (start && dateISO < start) return false;
  if (end && dateISO > end) return false;
  return true;
}

function inTimeRange(timeHHMM: string, start?: string, end?: string): boolean {
  if (!start || !end) return true;
  const t = parseTimeToMinutes(timeHHMM);
  return t >= parseTimeToMinutes(start) && t < parseTimeToMinutes(end);
}

function dayShortName(dateISO: string): string {
  const date = new Date(`${dateISO}T00:00:00`);
  return date.toLocaleDateString('en-US', { weekday: 'short' });
}

export function listApplicableDiscounts(
  branchId: string,
  dateISO: string,
  timeHHMM: string,
  serviceId: string,
  vehicleType: string
): ApplicableDiscount[] {
  const data = getBranchData(branchId);
  if (!data) return [];
  return (data.dayTimePricing ?? [])
    .filter((rule) => {
      const serviceOk =
        !rule.applicableServiceIds?.length || rule.applicableServiceIds.includes(serviceId);
      const vehicleOk =
        !rule.applicableVehicleTypes?.length || rule.applicableVehicleTypes.includes(vehicleType);
      const dateOk = inDateRange(dateISO, rule.validityStart, rule.validityEnd);
      const dayOk = !rule.applicableDays?.length || rule.applicableDays.includes(dayShortName(dateISO));
      const timeOk = inTimeRange(timeHHMM, rule.timeWindowStart, rule.timeWindowEnd);
      return serviceOk && vehicleOk && dateOk && dayOk && timeOk;
    })
    .map((rule) => ({
      id: rule.id,
      title: rule.title,
      description: rule.description,
      discountType: rule.discountType,
      discountValue: rule.discountValue,
    }));
}

export function listApplicablePromos(
  branchId: string,
  dateISO: string,
  serviceId: string,
  vehicleType: string
): PromoCode[] {
  const data = getBranchData(branchId);
  if (!data) return [];
  return (data.promotions ?? []).filter((promo) => {
    const serviceOk =
      !promo.applicableServiceIds?.length || promo.applicableServiceIds.includes(serviceId);
    const vehicleOk =
      !promo.applicableVehicleTypes?.length || promo.applicableVehicleTypes.includes(vehicleType);
    const dateOk = inDateRange(dateISO, promo.validityStart, promo.validityEnd);
    return serviceOk && vehicleOk && dateOk;
  });
}

export function listBranchPromoCodes(branchId: string, dateISO?: string, vehicleType?: string, serviceId?: string): PromoCode[] {
  const data = getBranchData(branchId);
  if (!data) return [];
  return (data.promotions ?? []).filter((promo) => {
    // Date filter
    if (dateISO && !inDateRange(dateISO, promo.validityStart, promo.validityEnd)) return false;
    // Vehicle-type filter: if the promo specifies vehicle types, only show it
    // when the customer's selected vehicle type is in that list.
    if (vehicleType && Array.isArray(promo.applicableVehicleTypes) && promo.applicableVehicleTypes.length > 0) {
      const selected = vehicleType.trim().toLowerCase();
      const matches = promo.applicableVehicleTypes.some(
        (vt) => vt.trim().toLowerCase() === selected,
      );
      if (!matches) return false;
    }
    // Service filter: if the promo specifies service IDs, only show it
    // when the customer's selected service is in that list.
    if (serviceId && Array.isArray(promo.applicableServiceIds) && promo.applicableServiceIds.length > 0) {
      if (!promo.applicableServiceIds.includes(serviceId)) return false;
    }
    return true;
  });
}

export function listHomeOffers(): BranchOfferCard[] {
  const state = loadAdminState();
  const cards: BranchOfferCard[] = [];

  for (const branch of state.branches) {
    const data = state.dataByBranchId[branch.id];
    if (!data) continue;

    // Branch day/time pricing rules
    for (const d of data.dayTimePricing ?? []) {
      cards.push({
        id: `day_${branch.id}_${d.id}`,
        title: d.title || 'Day / Time Offer',
        discountLabel: d.discountType === 'percentage' ? `${d.discountValue}% OFF` : `$${d.discountValue} OFF`,
        timeLabel:
          d.timeWindowStart && d.timeWindowEnd
            ? `${d.timeWindowStart} - ${d.timeWindowEnd}`
            : d.applicableDays?.length
              ? d.applicableDays.join(', ')
              : 'Selected days',
        branches: [branch.name],
        serviceType: 'branch',
      });
    }

    // Branch promotions (coupon codes)
    for (const p of data.promotions ?? []) {
      cards.push({
        id: `promo_${branch.id}_${p.id}`,
        title: p.codeName || 'Promotion',
        discountLabel: p.discountType === 'percentage' ? `${p.discountValue}% OFF` : `$${p.discountValue} OFF`,
        timeLabel: p.validityStart && p.validityEnd ? `Valid ${p.validityStart} – ${p.validityEnd}` : 'Limited time',
        branches: [branch.name],
        serviceType: 'branch',
      });
    }
  }

  // Mobile day/time pricing rules
  for (const d of state.mobileDayTimePricing ?? []) {
    cards.push({
      id: `mobile_day_${d.id}`,
      title: d.title || 'Day / Time Offer',
      discountLabel: d.discountType === 'percentage' ? `${d.discountValue}% OFF` : `$${d.discountValue} OFF`,
      timeLabel:
        d.timeWindowStart && d.timeWindowEnd
          ? `${d.timeWindowStart} - ${d.timeWindowEnd}`
          : d.applicableDays?.length
            ? d.applicableDays.join(', ')
            : 'Selected days',
      branches: ['Mobile wash'],
      serviceType: 'mobile',
    });
  }

  // Mobile promotions (coupon codes)
  for (const p of state.mobilePromotions ?? []) {
    cards.push({
      id: `mobile_promo_${p.id}`,
      title: p.codeName || 'Mobile Promotion',
      discountLabel: p.discountType === 'percentage' ? `${p.discountValue}% OFF` : `$${p.discountValue} OFF`,
      timeLabel: p.validityStart && p.validityEnd ? `Valid ${p.validityStart} – ${p.validityEnd}` : 'Limited time',
      branches: ['Mobile wash'],
      serviceType: 'mobile',
    });
  }

  return cards;
}

export async function createOnlineBooking(
  input: BookingWriteInput
): Promise<{ ok: true; booking: PublicBookingRow } | { ok: false }> {
  try {
    const tip = Math.min(50_000, Math.max(0, Math.floor(Number(input.tipCents ?? 0))));
    const body: Record<string, unknown> = {
      customer_name: input.customerName,
      phone: input.phone,
      customer_email: (input.customerEmail ?? '').trim(),
      address: input.address,
      vehicle_type: input.vehicleType,
      vehicle_model: input.vehicleModel,
      registration_number: input.registrationNumber ?? '',
      service_summary: input.serviceSummary,
      service_id: input.serviceId ?? null,
      selected_addon_ids: input.selectedAddonIds ?? [],
      slot_date: input.slotDate,
      start_time: input.startTime,
      tip_cents: tip,
    };
    if (input.serviceChargedCents != null) {
      body.service_charged_cents = Math.max(0, Math.floor(Number(input.serviceChargedCents)));
    }
    if (input.endTime) body.end_time = input.endTime;
    if (input.loyaltyRewardId) body.loyalty_reward_id = input.loyaltyRewardId;
    if (input.promoCode) body.promo_code = input.promoCode.trim().toUpperCase();
    if (input.paymentMethod) body.payment_method = input.paymentMethod;
    const headers: Record<string, string> = {};
    if (input.token) headers.Authorization = `Bearer ${input.token}`;

    const out = await fetchPublicJson<PublicBookingRow>(`/public/branches/${input.branchId}/bookings`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    void hydratePublicCatalogFromApi();
    return { ok: true, booking: out };
  } catch {
    return { ok: false };
  }
}
