/**
 * In-memory branch catalog for the USER app — always hydrated from the API.
 * No localStorage: source of truth is the database via /public/* endpoints.
 */

import type { AdminState, BranchData, DayTimePriceRule, PromoCode, SlotDayOverride } from './branchCatalogTypes';
import { mapAddon, mapBranch, mapService } from './branchMappers';
import { fetchPublicJson } from './userPublicApi';

let state: AdminState = { branches: [], dataByBranchId: {}, mobileDayTimePricing: [], mobileVehicleTypes: [] };
let revision = 0;
const listeners = new Set<() => void>();

function emit() {
  revision += 1;
  listeners.forEach((l) => l());
}

export function subscribePublicCatalog(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function getPublicCatalogState(): AdminState {
  return state;
}

export function getPublicCatalogRevision(): number {
  return revision;
}

let hydrateInFlight: Promise<boolean> | null = null;

export async function hydratePublicCatalogFromApi(): Promise<boolean> {
  if (hydrateInFlight) return hydrateInFlight;
  hydrateInFlight = (async () => {
    try {
      const branchRaw = await fetchPublicJson<any[]>('/public/branches');
      const branches = branchRaw.map(mapBranch);
      const dataByBranchId: Record<string, BranchData> = {};
      await Promise.all(
        branches.map(async (branch) => {
          const snapshot = await fetchPublicJson<{
            vehicle_blocks: any[];
            branch_addons?: any[];
            promotions: any[];
            day_time_rules: any[];
            slot_settings?: {
              manager_slot_duration_minutes?: number;
              slot_bay_open_by_window?: Record<string, boolean[]>;
              slot_window_active_by_key?: Record<string, boolean>;
              slot_day_states?: Record<string, SlotDayOverride>;
            };
          }>(`/public/branches/${branch.id}/snapshot`);
          dataByBranchId[branch.id] = {
            vehicleServices: (snapshot.vehicle_blocks ?? []).map((b: any) => ({
              vehicleType: String(b.vehicle_type ?? b.vehicleType ?? ''),
              services: Array.isArray(b.services) ? b.services.map(mapService) : [],
              addons: Array.isArray(b.addons) ? b.addons.map(mapAddon) : [],
            })),
            branchAddons: Array.isArray(snapshot.branch_addons) ? snapshot.branch_addons.map(mapAddon) : [],
            promotions: (snapshot.promotions ?? []).map((p: any) => ({
              id: String(p.id ?? ''),
              codeName: String(p.code_name ?? p.codeName ?? ''),
              discountType: (p.discount_type ?? p.discountType) === 'percentage' ? 'percentage' : 'flat',
              discountValue: Number(p.discount_value ?? p.discountValue ?? 0),
              validityStart: String(p.validity_start ?? p.validityStart ?? ''),
              validityEnd: String(p.validity_end ?? p.validityEnd ?? ''),
              maxUsesPerCustomer: Math.max(1, Number(p.max_uses_per_customer ?? p.maxUsesPerCustomer ?? 1)),
              applicableServiceIds: Array.isArray(p.applicable_service_ids ?? p.applicableServiceIds)
                ? (p.applicable_service_ids ?? p.applicableServiceIds)
                : [],
              applicableVehicleTypes: Array.isArray(
                p.applicable_vehicle_types ?? p.applicableVehicleTypes
              )
                ? (p.applicable_vehicle_types ?? p.applicableVehicleTypes)
                : [],
            })),
            dayTimePricing: (snapshot.day_time_rules ?? []).map((r: any) => ({
              id: String(r.id ?? ''),
              title: String(r.title ?? ''),
              description: String(r.description ?? ''),
              discountType: (r.discount_type ?? r.discountType) === 'percentage' ? 'percentage' : 'flat',
              discountValue: Number(r.discount_value ?? r.discountValue ?? 0),
              applicableServiceIds: Array.isArray(r.applicable_service_ids ?? r.applicableServiceIds)
                ? (r.applicable_service_ids ?? r.applicableServiceIds)
                : [],
              applicableVehicleTypes: Array.isArray(
                r.applicable_vehicle_types ?? r.applicableVehicleTypes
              )
                ? (r.applicable_vehicle_types ?? r.applicableVehicleTypes)
                : [],
              applicableDays: Array.isArray(r.applicable_days ?? r.applicableDays)
                ? (r.applicable_days ?? r.applicableDays)
                : [],
              timeWindowStart: String(r.time_window_start ?? r.timeWindowStart ?? ''),
              timeWindowEnd: String(r.time_window_end ?? r.timeWindowEnd ?? ''),
              validityStart: String(r.validity_start ?? r.validityStart ?? ''),
              validityEnd: String(r.validity_end ?? r.validityEnd ?? ''),
            })),
            loyaltyTierCount: Array.isArray(snapshot.loyalty?.tiers) ? snapshot.loyalty.tiers.length : 0,
            loyaltyRewardServiceIds: Array.isArray(snapshot.loyalty?.tiers)
              ? snapshot.loyalty.tiers
                  .map((t: any) => String(t?.reward_service_id ?? t?.rewardServiceId ?? '').trim())
                  .filter(Boolean)
              : [],
            branchBookings: [],
            managerSlotDurationMinutes: snapshot.slot_settings?.manager_slot_duration_minutes ?? 60,
            slotBayOpenByWindow: snapshot.slot_settings?.slot_bay_open_by_window,
            slotWindowActiveByKey: snapshot.slot_settings?.slot_window_active_by_key,
            slotDayStates: snapshot.slot_settings?.slot_day_states,
          };
        })
      );
      let mobileDayTimePricing: DayTimePriceRule[] = [];
      try {
        const mobileRulesRaw = await fetchPublicJson<any[]>('/public/mobile/day-time-rules');
        mobileDayTimePricing = (mobileRulesRaw ?? []).map((r: any) => ({
          id: String(r.id ?? ''),
          title: String(r.title ?? ''),
          description: String(r.description ?? ''),
          discountType: (r.discount_type ?? r.discountType) === 'percentage' ? 'percentage' : 'flat',
          discountValue: Number(r.discount_value ?? r.discountValue ?? 0),
          applicableServiceIds: Array.isArray(r.applicable_service_ids ?? r.applicableServiceIds)
            ? (r.applicable_service_ids ?? r.applicableServiceIds).map(String)
            : [],
          applicableVehicleTypes: Array.isArray(
            r.applicable_vehicle_types ?? r.applicableVehicleTypes
          )
            ? (r.applicable_vehicle_types ?? r.applicableVehicleTypes).map(String)
            : [],
          applicableDays: Array.isArray(r.applicable_days ?? r.applicableDays)
            ? (r.applicable_days ?? r.applicableDays).map(String)
            : [],
          timeWindowStart: String(r.time_window_start ?? r.timeWindowStart ?? ''),
          timeWindowEnd: String(r.time_window_end ?? r.timeWindowEnd ?? ''),
          validityStart: String(r.validity_start ?? r.validityStart ?? ''),
          validityEnd: String(r.validity_end ?? r.validityEnd ?? ''),
        }));
      } catch {
        mobileDayTimePricing = state.mobileDayTimePricing ?? [];
      }

      let mobilePromotions: PromoCode[] = [];
      try {
        const mobilePromosRaw = await fetchPublicJson<any[]>('/public/mobile/promotions');
        mobilePromotions = (mobilePromosRaw ?? []).map((p: any) => ({
          id: String(p.id ?? ''),
          codeName: String(p.code_name ?? p.codeName ?? ''),
          discountType: (p.discount_type ?? p.discountType) === 'percentage' ? 'percentage' : 'flat',
          discountValue: Number(p.discount_value ?? p.discountValue ?? 0),
          validityStart: String(p.validity_start ?? p.validityStart ?? ''),
          validityEnd: String(p.validity_end ?? p.validityEnd ?? ''),
          maxUsesPerCustomer: Math.max(1, Number(p.max_uses_per_customer ?? p.maxUsesPerCustomer ?? 1)),
          applicableServiceIds: Array.isArray(p.applicable_service_ids ?? p.applicableServiceIds)
            ? (p.applicable_service_ids ?? p.applicableServiceIds).map(String)
            : [],
          applicableVehicleTypes: Array.isArray(p.applicable_vehicle_types ?? p.applicableVehicleTypes)
            ? (p.applicable_vehicle_types ?? p.applicableVehicleTypes).map(String)
            : [],
        }));
      } catch {
        mobilePromotions = state.mobilePromotions ?? [];
      }

      let mobileVehicleTypes: string[] = [];
      try {
        const mobileBlocks = await fetchPublicJson<{ vehicle_type?: string; services?: { active?: boolean; catalog_group_id?: string | null }[] }[]>(
          '/public/mobile/vehicle-blocks',
        );
        const typeSet = new Set<string>();
        for (const block of mobileBlocks ?? []) {
          const type = String(block.vehicle_type ?? '').trim();
          if (!type) continue;
          const hasBookable = (block.services ?? []).some(
            (s) => s.active !== false && !!s.catalog_group_id,
          );
          if (hasBookable) typeSet.add(type);
        }
        mobileVehicleTypes = Array.from(typeSet).sort((a, b) => a.localeCompare(b));
      } catch {
        mobileVehicleTypes = state.mobileVehicleTypes ?? [];
      }

      const next: AdminState = { branches, dataByBranchId, mobileDayTimePricing, mobilePromotions, mobileVehicleTypes };
      const changed = JSON.stringify(state) !== JSON.stringify(next);
      if (changed) {
        state = next;
        emit();
      }
      return changed;
    } catch {
      return false;
    } finally {
      hydrateInFlight = null;
    }
  })();
  return hydrateInFlight;
}
