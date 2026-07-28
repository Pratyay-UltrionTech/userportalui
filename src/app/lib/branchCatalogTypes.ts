/** Branch catalog + per-branch snapshot (matches API / public snapshot shape). */

export interface UserBranch {
  id: string;
  name: string;
  location: string;
  zipCode: string;
  bayCount: number;
  openTime: string;
  closeTime: string;
}

export interface ServiceItem {
  id: string;
  name: string;
  price: number;
  /** Optional grouping id when admin uses service-centric variants (same as API `catalog_group_id`). */
  catalogGroupId?: string | null;
  freeCoffeeCount?: number;
  /** When true, this service’s price counts toward loyalty spend for this branch/mobile area. */
  eligibleForLoyaltyPoints?: boolean;
  recommended?: boolean;
  descriptionPoints?: string[];
  excludedPoints?: string[];
  active?: boolean;
  /** Base wash duration in minutes (multiple of 30 from API). */
  durationMinutes?: number;
  category?: string;
  /** User portal display order; lower first. Omitted → treated as 999 when sorting. */
  sequence?: number;
}

export interface AddonItem {
  id: string;
  name: string;
  price: number;
  descriptionPoints?: string[];
  active?: boolean;
}

export interface VehicleServiceBlock {
  vehicleType: string;
  services: ServiceItem[];
  addons: AddonItem[];
}

export interface PromoCode {
  id: string;
  codeName: string;
  discountType: 'percentage' | 'flat';
  discountValue: number;
  validityStart: string;
  validityEnd: string;
  maxUsesPerCustomer: number;
  applicableServiceIds: string[];
  applicableVehicleTypes: string[];
}

export interface DayTimePriceRule {
  id: string;
  title: string;
  description: string;
  discountType: 'percentage' | 'flat';
  discountValue: number;
  applicableServiceIds: string[];
  applicableVehicleTypes: string[];
  applicableDays: string[];
  timeWindowStart: string;
  timeWindowEnd: string;
  validityStart: string;
  validityEnd: string;
}

export interface BranchBookingJob {
  id: string;
  customerName: string;
  address: string;
  phone: string;
  vehicleType: string;
  serviceSummary: string;
  slotDate: string;
  startTime: string;
  endTime: string;
  bayNumber: number | null;
  assignedWasherId: string | null;
  status: 'scheduled' | 'checked_in' | 'in_progress' | 'completed' | 'cancelled';
  source: 'walk_in' | 'online' | 'phone';
  notes: string;
  createdAt: string;
}

export interface SlotDayOverride {
  slotActive?: boolean;
  baysOpen?: boolean[];
}

export interface BranchData {
  vehicleServices: VehicleServiceBlock[];
  branchAddons: AddonItem[];
  promotions: PromoCode[];
  dayTimePricing: DayTimePriceRule[];
  /** Number of configured loyalty spend slabs (`tiers`) for this branch. */
  loyaltyTierCount?: number;
  /** Reward service ids selected in branch loyalty slabs. */
  loyaltyRewardServiceIds?: string[];
  slotBayOpenByWindow?: Record<string, boolean[]>;
  slotWindowActiveByKey?: Record<string, boolean>;
  slotDayStates?: Record<string, SlotDayOverride>;
  managerSlotDurationMinutes?: number;
  branchBookings: BranchBookingJob[];
}

export interface AdminState {
  branches: UserBranch[];
  dataByBranchId: Record<string, BranchData>;
  /** Mobile wash day/time rules from `/public/mobile/day-time-rules` (same shape as branch `DayTimePriceRule`). */
  mobileDayTimePricing: DayTimePriceRule[];
  /** Mobile wash promotions from `/public/mobile/promotions`. */
  mobilePromotions: PromoCode[];
  /** All vehicle types defined in the mobile catalog, fetched from `/public/mobile/vehicle-blocks`. */
  mobileVehicleTypes: string[];
}
