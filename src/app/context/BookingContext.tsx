import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import type { PaymentMethodId } from '../components/bookingFlowSection';
import type { AddressDetailsWithFullAddress } from '../lib/addressDetails';
import { type ActiveLoyaltyReward, apiGetActiveLoyaltyRewards } from '../lib/userApi';

interface Vehicle {
  id: string;
  type: string;
  number: string;
  model: string;
}

interface Branch {
  id: string;
  name: string;
  location: string;
  rating: number;
  image: string;
  openTime?: string;
  closeTime?: string;
}

interface Service {
  id: string;
  name: string;
  price: number;
  features: string[];
  recommended?: boolean;
  /** Branch / mobile catalog complimentary coffees for this line item (0 = none). */
  freeCoffeeCount?: number;
  /** Catalog flag: price counts toward loyalty spend window. */
  eligibleForLoyaltyPoints?: boolean;
  /** Base service duration (minutes); add-ons add +30 each server-side. */
  durationMinutes?: number;
}

interface AddOn {
  id: string;
  name: string;
  price: number;
}

type MobileVisitAddress = AddressDetailsWithFullAddress;

interface ConfirmedBooking {
  id: string;
  total: number;
  tax: number;
  subtotal: number;
  discounts: number;
  createdAt: string;
  /** From catalog `free_coffee_count` at confirm time (branch services). */
  freeCoffeeCount?: number;
  branchId?: string;
  /** Service job status from API (washer / manager updates). */
  status?: string;
  /** Gratuity in cents saved on the booking. */
  tipCents?: number;
  /** Loyalty points added for this booking line item (if eligible and completed policy permits). */
  loyaltyPointsAdded?: number;
  /** Customer UUID — used to build the XXXXXX-CCCC display reference. */
  customerId?: string | null;
  /** Payment option chosen on the payment page. */
  paymentMethod?: PaymentMethodId;
}

interface BookingContextType {
  user: {
    name: string;
    email: string;
    phone: string;
    address: string;
  } | null;
  vehicles: Vehicle[];
  selectedBranch: Branch | null;
  serviceType: 'branch' | 'onsite' | null;
  vehicleType: string | null;
  vehicleModel: string;
  registrationNumber: string;
  selectedService: Service | null;
  selectedAddOns: AddOn[];
  selectedDate: Date | null;
  selectedTime: string | null;
  selectedEndTime: string | null;
  /** Structured mobile onsite visit address captured on home card. */
  mobileVisitAddress: MobileVisitAddress | null;
  confirmedBooking: ConfirmedBooking | null;
  reschedulingBookingId: string | null;
  originalSlot: { date: string; startTime: string; endTime: string } | null;
  setUser: (user: any) => void;
  addVehicle: (vehicle: Vehicle) => void;
  setVehicles: (vehicles: Vehicle[]) => void;
  setSelectedBranch: (branch: Branch | null) => void;
  setServiceType: (type: 'branch' | 'onsite' | null) => void;
  setVehicleType: (type: string | null) => void;
  setVehicleModel: (model: string) => void;
  setRegistrationNumber: (reg: string) => void;
  setSelectedService: (service: Service | null) => void;
  toggleAddOn: (addon: AddOn) => void;
  setSelectedAddOns: (addons: AddOn[]) => void;
  setSelectedDate: (date: Date | null) => void;
  setSelectedTime: (time: string | null) => void;
  setSelectedEndTime: (time: string | null) => void;
  setMobileVisitAddress: (address: MobileVisitAddress | null) => void;
  setConfirmedBooking: (booking: ConfirmedBooking | null) => void;
  setReschedulingBookingId: (id: string | null) => void;
  setOriginalSlot: (slot: { date: string; startTime: string; endTime: string } | null) => void;
  getTotalPrice: () => number;
  resetBooking: () => void;
  /** Pending (unredeemed) loyalty rewards for the current logged-in user. */
  activeRewards: ActiveLoyaltyReward[];
  refreshActiveRewards: (token: string) => Promise<void>;
}

const BookingContext = createContext<BookingContextType | undefined>(undefined);
const BOOKING_STORAGE_KEY = 'carwash_user_booking_ctx_v3';
const LEGACY_SESSION_BOOKING_STORAGE_KEY = 'carwash_user_booking_ctx_v2';

type PersistedBooking = {
  user: {
    name: string;
    email: string;
    phone: string;
    address: string;
  } | null;
  vehicles: Vehicle[];
  selectedBranch: Branch | null;
  serviceType: 'branch' | 'onsite' | null;
  vehicleType: string | null;
  vehicleModel: string;
  registrationNumber: string;
  selectedService: Service | null;
  selectedAddOns: AddOn[];
  selectedDateISO: string | null;
  selectedTime: string | null;
  selectedEndTime: string | null;
  mobileVisitAddress: MobileVisitAddress | null;
  confirmedBooking: ConfirmedBooking | null;
  reschedulingBookingId: string | null;
  originalSlot: { date: string; startTime: string; endTime: string } | null;
};

function loadPersistedBooking(): PersistedBooking | null {
  try {
    const raw =
      sessionStorage.getItem(BOOKING_STORAGE_KEY) ??
      sessionStorage.getItem(LEGACY_SESSION_BOOKING_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedBooking>;
    return {
      user: parsed.user ?? null,
      vehicles: Array.isArray(parsed.vehicles) ? parsed.vehicles : [],
      selectedBranch: parsed.selectedBranch ?? null,
      serviceType: parsed.serviceType ?? null,
      vehicleType: parsed.vehicleType ?? null,
      vehicleModel: parsed.vehicleModel ?? '',
      registrationNumber: parsed.registrationNumber ?? '',
      selectedService: parsed.selectedService ?? null,
      selectedAddOns: Array.isArray(parsed.selectedAddOns) ? parsed.selectedAddOns : [],
      selectedDateISO: parsed.selectedDateISO ?? null,
      selectedTime: parsed.selectedTime ?? null,
      selectedEndTime: parsed.selectedEndTime ?? null,
      mobileVisitAddress:
        parsed.mobileVisitAddress &&
        typeof parsed.mobileVisitAddress === 'object' &&
        typeof parsed.mobileVisitAddress.full_address === 'string'
          ? (parsed.mobileVisitAddress as MobileVisitAddress)
          : null,
      confirmedBooking: parsed.confirmedBooking ?? null,
      reschedulingBookingId: parsed.reschedulingBookingId ?? null,
      originalSlot: parsed.originalSlot ?? null,
    };
  } catch {
    return null;
  }
}

export function BookingProvider({ children }: { children: ReactNode }) {
  const persisted = loadPersistedBooking();
  const [user, setUser] = useState<any>(persisted?.user ?? null);
  const [vehicles, setVehicles] = useState<Vehicle[]>(persisted?.vehicles ?? []);
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(persisted?.selectedBranch ?? null);
  const [serviceType, setServiceType] = useState<'branch' | 'onsite' | null>(persisted?.serviceType ?? null);
  const [vehicleType, setVehicleType] = useState<string | null>(persisted?.vehicleType ?? null);
  const [vehicleModel, setVehicleModel] = useState<string>(persisted?.vehicleModel ?? '');
  const [registrationNumber, setRegistrationNumber] = useState<string>(persisted?.registrationNumber ?? '');
  const [selectedService, setSelectedService] = useState<Service | null>(persisted?.selectedService ?? null);
  const [selectedAddOns, setSelectedAddOns] = useState<AddOn[]>(persisted?.selectedAddOns ?? []);
  const [selectedDate, setSelectedDate] = useState<Date | null>(
    persisted?.selectedDateISO ? new Date(`${persisted.selectedDateISO}T00:00:00`) : null
  );
  const [selectedTime, setSelectedTime] = useState<string | null>(persisted?.selectedTime ?? null);
  const [selectedEndTime, setSelectedEndTime] = useState<string | null>(persisted?.selectedEndTime ?? null);
  const [mobileVisitAddress, setMobileVisitAddress] = useState<MobileVisitAddress | null>(persisted?.mobileVisitAddress ?? null);
  const [confirmedBooking, setConfirmedBooking] = useState<ConfirmedBooking | null>(persisted?.confirmedBooking ?? null);
  const [reschedulingBookingId, setReschedulingBookingId] = useState<string | null>(persisted?.reschedulingBookingId ?? null);
  const [originalSlot, setOriginalSlot] = useState<{ date: string; startTime: string; endTime: string } | null>(persisted?.originalSlot ?? null);
  const [activeRewards, setActiveRewards] = useState<ActiveLoyaltyReward[]>([]);

  const refreshActiveRewards = useCallback(async (token: string) => {
    try {
      const rewards = await apiGetActiveLoyaltyRewards(token);
      setActiveRewards(rewards);
    } catch {
      // silently ignore — rewards just won't show
    }
  }, []);

  const addVehicle = (vehicle: Vehicle) => {
    setVehicles([...vehicles, vehicle]);
  };

  const toggleAddOn = (addon: AddOn) => {
    setSelectedAddOns(prev => {
      const exists = prev.find(a => a.id === addon.id);
      if (exists) {
        return prev.filter(a => a.id !== addon.id);
      }
      return [...prev, addon];
    });
  };

  const getTotalPrice = () => {
    const servicePrice = selectedService?.price || 0;
    const addOnsPrice = selectedAddOns.reduce((sum, addon) => sum + addon.price, 0);
    return servicePrice + addOnsPrice;
  };

  const resetBooking = () => {
    setUser(null);
    setVehicles([]);
    setSelectedBranch(null);
    setServiceType(null);
    setVehicleType(null);
    setVehicleModel('');
    setRegistrationNumber('');
    setSelectedService(null);
    setSelectedAddOns([]);
    setSelectedDate(null);
    setSelectedTime(null);
    setSelectedEndTime(null);
    setMobileVisitAddress(null);
    setConfirmedBooking(null);
    setReschedulingBookingId(null);
    setOriginalSlot(null);
  };

  useEffect(() => {
    try {
      sessionStorage.setItem(
        BOOKING_STORAGE_KEY,
        JSON.stringify({
          user,
          vehicles,
          selectedBranch,
          serviceType,
          vehicleType,
          vehicleModel,
          registrationNumber,
          selectedService,
          selectedAddOns,
          selectedDateISO: selectedDate
            ? `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(
                selectedDate.getDate()
              ).padStart(2, '0')}`
            : null,
          selectedTime,
          selectedEndTime,
          mobileVisitAddress,
          confirmedBooking,
          reschedulingBookingId,
          originalSlot,
        } as PersistedBooking)
      );
      sessionStorage.removeItem(LEGACY_SESSION_BOOKING_STORAGE_KEY);
      // Clean up old localStorage key from previous versions
      localStorage.removeItem(BOOKING_STORAGE_KEY);
    } catch {
      // ignore persistence failures
    }
  }, [
    user,
    vehicles,
    selectedBranch,
    serviceType,
    vehicleType,
    vehicleModel,
    registrationNumber,
    selectedService,
    selectedAddOns,
    selectedDate,
    selectedTime,
    selectedEndTime,
    mobileVisitAddress,
    confirmedBooking,
    reschedulingBookingId,
    originalSlot,
  ]);

  return (
    <BookingContext.Provider
      value={{
        user,
        vehicles,
        selectedBranch,
        serviceType,
        vehicleType,
        vehicleModel,
        registrationNumber,
        selectedService,
        selectedAddOns,
        selectedDate,
        selectedTime,
        selectedEndTime,
        mobileVisitAddress,
        confirmedBooking,
        reschedulingBookingId,
        originalSlot,
        setUser,
        addVehicle,
        setVehicles,
        setSelectedBranch,
        setServiceType,
        setVehicleType,
        setVehicleModel,
        setRegistrationNumber,
        setSelectedService,
        toggleAddOn,
        setSelectedAddOns,
        setSelectedDate,
        setSelectedTime,
        setSelectedEndTime,
        setMobileVisitAddress,
        setConfirmedBooking,
        setReschedulingBookingId,
        setOriginalSlot,
        getTotalPrice,
        resetBooking,
        activeRewards,
        refreshActiveRewards,
      }}
    >
      {children}
    </BookingContext.Provider>
  );
}

export function useBooking() {
  const context = useContext(BookingContext);
  if (context === undefined) {
    throw new Error('useBooking must be used within a BookingProvider');
  }
  return context;
}
