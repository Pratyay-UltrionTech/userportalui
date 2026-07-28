import { useCallback, useEffect, useMemo, useState, useRef, type CSSProperties } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { Car, CarFront, Truck, Check, ChevronLeft, ChevronRight, LayoutGrid, MapPin } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useBooking } from '../context/BookingContext';
import { useAuth } from '../context/AuthContext';
import {
  getBranchLoyaltyRewardServiceIds,
  getBranchById,
  getCatalogForVehicle,
  listVehicleTypes,
  listBranchAddons,
} from '../lib/adminPortalBridge';
import {
  fetchMobileSnapshot,
  getCachedMobileSnapshot,
  getMobileCatalogForVehicle,
  listMobileVehicleTypes,
  type MobileSnapshot,
} from '../lib/mobilePublicBridge';
import { useAdminBridgeSync } from '../hooks/useAdminBridgeSync';
import { apiGetCustomerMe, apiListAddresses, type SavedAddress } from '../lib/userApi';
import {
  BOOKING_NAVY as NAVY,
  BOOKING_NAVY_MID as NAVY_MID,
  BOOKING_NAVY_TINT as NAVY_TINT,
  BOOKING_GOLD as GOLD,
  BOOKING_BTN_BG as BTN_BG,
  BOOKING_BTN_TEXT as BTN_TEXT,
  BookingFlowSection,
} from '../components/bookingFlowSection';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { cn } from '../components/ui/utils';
import { addressMatchesAcceptedPins, normalizePinDigits } from '../lib/mobileVisitAddress';
import { createEmptyAddressDetails, sanitizePostcode, validateRequiredAddress, withFullAddress } from '../lib/addressDetails';
import { AddressDetailsFields } from '../components/AddressDetailsFields';
import { BookingDisclaimerNotes } from '../components/BookingDisclaimerNotes';
import { ServicePricingCard } from '../components/ServicePricingCard';
import { HEADING_FONT_FAMILY } from '../lib/branding';

type ServicePackage = {
  id: string;
  name: string;
  price: number;
  features: string[];
  excludedFeatures: string[];
  recommended?: boolean;
  freeCoffeeCount?: number;
  eligibleForLoyaltyPoints?: boolean;
  durationMinutes?: number;
  category: string;
};


function normalizeVehicleTypeForMatch(type: string): string {
  const base = String(type ?? '').trim().toLowerCase();
  if (!base) return '';
  // Make type matching resilient to case/spacing/punctuation differences
  // (e.g. "SUV / 4WD" vs "SUV/4WD", "Hatchback" vs "Hatch back").
  return base
    .replace(/\s*\/\s*4wd\b/g, '')
    .replace(/\bback\b/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function getVehicleIconForType(type: string) {
  const key = normalizeVehicleTypeForMatch(type);
  if (/ute|truck|pickup|van|tempo/.test(key)) return Truck;
  if (/suv|4wd/.test(key)) return Car;
  if (/hatch|hatchback|sedan|saloon|coupe|buggy|mini/.test(key)) return CarFront;
  return Car;
}

const inp =
  'w-full px-4 py-3 border rounded-xl text-sm outline-none transition-all text-gray-900 placeholder:text-gray-400 placeholder:font-normal focus:ring-2 focus:border-transparent';

const inpFocus = { '--tw-ring-color': NAVY } as CSSProperties;
const VEHICLE_CARD_BG = '#e7edf6';
const VEHICLE_CARD_BORDER = 'rgba(107, 125, 151, 0.5)';
const VEHICLE_CARD_BG_SELECTED = '#c1d0e3';
const VEHICLE_CARD_BORDER_SELECTED = 'rgba(0, 0, 0, 0.9)';

// Services are now dynamically loaded and grouped from ALL_PACKAGES below

export function BranchSelection() {
  const navigate = useNavigate();
  const { branchId } = useParams();
  const [searchParams] = useSearchParams();
  const serviceTypeFromUrl = searchParams.get('serviceType') as 'branch' | 'onsite' | null;

  const {
    selectedBranch, setServiceType, setVehicleType, setSelectedService,
    setSelectedBranch, selectedAddOns, vehicleModel, setVehicleModel,
    registrationNumber, setRegistrationNumber,
    vehicleType, selectedService,
    mobileVisitAddress, setMobileVisitAddress,
  } = useBooking();
  const { session, updateCustomerProfile, hasCustomerSession } = useAuth();
  const syncSeed = useAdminBridgeSync(30000);

  /** True when "+ Add new model" is selected — show full type / number / model row like profile setup */
  const [addingNewVehicleMode, setAddingNewVehicleMode] = useState(false);
  const [newVehicleNumber, setNewVehicleNumber] = useState('');
  const [addVehicleTouched, setAddVehicleTouched] = useState(false);
  const [continueSaving, setContinueSaving] = useState(false);
  const [continueSaveError, setContinueSaveError] = useState('');
  const [apiProfileVehicles, setApiProfileVehicles] = useState<Array<{ type: string; number: string; model: string }>>([]);
  
  const [vehicleId, setVehicleId] = useState<string | null>(vehicleType || null);
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(selectedService?.id || null);
  const [activeTab, setActiveTab] = useState<'wash' | 'detail'>('wash');
  const [mobileSnapshot, setMobileSnapshot] = useState<MobileSnapshot | null>(getCachedMobileSnapshot());
  const [mobileError, setMobileError] = useState('');
  const [mobileAddrDraft, setMobileAddrDraft] = useState(createEmptyAddressDetails(mobileVisitAddress?.postcode ?? ''));
  const [mobileAddrErr, setMobileAddrErr] = useState('');
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [addrMode, setAddrMode] = useState<'saved' | 'manual'>('saved');
  const serviceScrollerRef = useRef<HTMLDivElement>(null);
  /** Target card to scroll to after a tab switch triggered by arrow navigation. */
  const pendingScrollTarget = useRef<'first' | 'last' | null>(null);
  /** Direction of the last tab switch: 1 = forward (wash→detail), -1 = backward. */
  const tabSwitchDirection = useRef<1 | -1>(1);
  const [canScrollServicePrev, setCanScrollServicePrev] = useState(false);
  const [canScrollServiceNext, setCanScrollServiceNext] = useState(false);
  const [visibleServiceCards, setVisibleServiceCards] = useState(1);

  const isMobileFlow = serviceTypeFromUrl === 'onsite' && branchId === 'mobile';
  const mobilePin = searchParams.get('pin')?.trim() ?? '';
  const branchLive = branchId ? getBranchById(branchId) : null;
  const branch = branchLive ?? selectedBranch ?? { name: 'CarWash Location', location: 'Select a branch' };
  // Always prefer the fresh API fetch; fall back to the session cache only while the fetch
  // hasn't resolved yet. This prevents stale localStorage data from seeding the vehicle picker.
  const effectiveProfileVehicles = useMemo(
    () => (apiProfileVehicles.length ? apiProfileVehicles : (session?.vehicles ?? [])),
    [apiProfileVehicles, session?.vehicles]
  );

  useEffect(() => {
    if (!session?.accessToken) return;
    let cancelled = false;
    (async () => {
      try {
        const me = await apiGetCustomerMe(session.accessToken);
        if (cancelled) return;
        const mapped = (me.vehicles ?? []).map((v) => ({
          type: String(v.type ?? ''),
          number: String(v.number ?? ''),
          model: String(v.model ?? ''),
        }));
        setApiProfileVehicles(mapped);
      } catch {
        if (!cancelled) setApiProfileVehicles([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session?.accessToken]);

  useEffect(() => {
    if (isMobileFlow && mobilePin) {
      fetchMobileSnapshot(mobilePin)
        .then(snap => {
          setMobileSnapshot(snap);
          setSelectedBranch({
            id: `mobile-${snap.service_area.city_pin_code}`,
            name: 'Mobile Service Area',
            location: `Serving PIN ${snap.service_area.city_pin_code}`,
            rating: 5,
            image: '',
          });
        })
        .catch(err => setMobileError('Service not available in this area'));
    }
  }, [isMobileFlow, mobilePin, setSelectedBranch]);

  const mobilePinsForAddress = useMemo(() => {
    if (!isMobileFlow || !mobileSnapshot) return [];
    const hub = mobileSnapshot.service_area.city_pin_code;
    const req = mobileSnapshot.service_area.requested_pin_code;
    return [...new Set([mobilePin, hub, req].map((s) => String(s ?? '').trim()).filter(Boolean))];
  }, [isMobileFlow, mobilePin, mobileSnapshot]);

  // Load saved addresses for signed-in mobile flow users
  useEffect(() => {
    if (!isMobileFlow || !session?.accessToken) return;
    apiListAddresses(session.accessToken)
      .then((res) => setSavedAddresses(res.addresses))
      .catch(() => {});
  }, [isMobileFlow, session?.accessToken]);

  useEffect(() => {
    if (!isMobileFlow) return;
    if (mobileVisitAddress?.full_address?.trim()) {
      setMobileAddrDraft({
        street_address: mobileVisitAddress.street_address ?? '',
        suburb: mobileVisitAddress.suburb ?? '',
        state: mobileVisitAddress.state ?? '',
        postcode: sanitizePostcode(mobileVisitAddress.postcode ?? mobilePin),
      });
      return;
    }
    setMobileAddrDraft(createEmptyAddressDetails(mobilePin));
  }, [isMobileFlow, mobilePin, mobileVisitAddress]);

  // Pre-select most recent vehicle for returning users
  useEffect(() => {
    if (effectiveProfileVehicles.length && !vehicleId && !vehicleModel) {
      const last = effectiveProfileVehicles[0];
      setVehicleId(last.type);
      setVehicleType(last.type);
      setVehicleModel(last.model);
      setRegistrationNumber(last.number ?? '');
    }
  }, [effectiveProfileVehicles, vehicleId, vehicleModel, setVehicleType, setVehicleModel, setRegistrationNumber]);

  const vehicleTypes = useMemo(() => {
    if (isMobileFlow) return mobileSnapshot ? listMobileVehicleTypes(mobileSnapshot) : [];
    return branchId ? listVehicleTypes(branchId) : [];
  }, [branchId, isMobileFlow, mobileSnapshot, syncSeed]);

  const VEHICLE_OPTIONS = useMemo(() =>
    vehicleTypes.map((v) => ({
      id: v,
      label: v,
      icon: getVehicleIconForType(v),
    })), [vehicleTypes]);

  // If persisted/profile type uses a different variant (spacing/case), snap it to an actual card id.
  useEffect(() => {
    if (!vehicleId || VEHICLE_OPTIONS.length === 0) return;
    const currentNorm = normalizeVehicleTypeForMatch(vehicleId);
    const match = VEHICLE_OPTIONS.find((opt) => normalizeVehicleTypeForMatch(opt.id) === currentNorm);
    if (match && match.id !== vehicleId) {
      setVehicleId(match.id);
      setVehicleType(match.label);
    }
  }, [vehicleId, VEHICLE_OPTIONS, setVehicleType]);

  /** Saved profile vehicles matching the selected body-style card (normalized type). */
  const modelsForSelectedBodyStyle = useMemo(() => {
    if (!effectiveProfileVehicles.length || !vehicleId) return [];
    const selectedNorm = normalizeVehicleTypeForMatch(vehicleId);
    return effectiveProfileVehicles.filter((v) => normalizeVehicleTypeForMatch(v.type) === selectedNorm);
  }, [effectiveProfileVehicles, vehicleId]);

  /** First-time or new body style on file: persist type / plate / model to profile on Continue. */
  const saveVehicleToProfileOnContinue = Boolean(
    session && vehicleId && modelsForSelectedBodyStyle.length === 0
  );

  // If this body style has no saved vehicles, clear "+ add new" flow (we use the 3-field profile-style row instead)
  useEffect(() => {
    if (!session || !vehicleId) return;
    if (modelsForSelectedBodyStyle.length === 0) {
      setAddingNewVehicleMode(false);
      setNewVehicleNumber('');
      setAddVehicleTouched(false);
    }
  }, [session, vehicleId, modelsForSelectedBodyStyle.length]);

  const ALL_PACKAGES: ServicePackage[] = useMemo(() => {
    if (!vehicleId) return [];
    const cat = isMobileFlow
      ? (mobileSnapshot ? getMobileCatalogForVehicle(mobileSnapshot, vehicleId) : { services: [], addons: [] })
      : (branchId ? getCatalogForVehicle(branchId, vehicleId) : { services: [], addons: [] });
    return cat.services.map((s) => ({
      id: s.id,
      name: s.name,
      price: s.price,
      features: s.descriptionPoints ?? [],
      excludedFeatures: (s as any).excludedPoints ?? [],
      recommended: s.recommended === true,
      freeCoffeeCount: Math.max(0, Math.floor(Number(s.freeCoffeeCount ?? 0))),
      eligibleForLoyaltyPoints: s.eligibleForLoyaltyPoints === true,
      durationMinutes: s.durationMinutes ?? 60,
      category: s.category || "Washing",
    }));
  }, [branchId, isMobileFlow, mobileSnapshot, vehicleId, syncSeed]);

  const loyaltyRewardServiceIdSet = useMemo(() => {
    if (isMobileFlow) {
      const tiers = mobileSnapshot?.loyalty?.tiers;
      if (!Array.isArray(tiers)) return new Set<string>();
      return new Set(
        tiers
          .map((t) => {
            const row = t as { reward_service_id?: unknown; rewardServiceId?: unknown };
            return String(row.reward_service_id ?? row.rewardServiceId ?? '').trim();
          })
          .filter(Boolean),
      );
    }
    if (!branchId) return new Set<string>();
    return new Set(getBranchLoyaltyRewardServiceIds(branchId));
  }, [isMobileFlow, mobileSnapshot, branchId, syncSeed]);

  const { washingGroups, detailingGroups } = useMemo(() => {
    const wash: ServicePackage[] = [];
    const detail: ServicePackage[] = [];

    ALL_PACKAGES.forEach(pkg => {
      const isDetailing = (pkg.category?.toLowerCase() || '') === 'detailing';

      if (isDetailing) {
        detail.push(pkg);
      } else {
        wash.push(pkg);
      }
    });

    return { washingGroups: wash, detailingGroups: detail };
  }, [ALL_PACKAGES]);

  const activeServiceList = activeTab === 'wash' ? washingGroups : detailingGroups;

  useEffect(() => {
    const updateVisibleServiceCards = () => {
      if (window.innerWidth >= 1024) {
        setVisibleServiceCards(3);
      } else if (window.innerWidth >= 768) {
        setVisibleServiceCards(2);
      } else {
        setVisibleServiceCards(1);
      }
    };
    updateVisibleServiceCards();
    window.addEventListener('resize', updateVisibleServiceCards);
    return () => window.removeEventListener('resize', updateVisibleServiceCards);
  }, []);

  // ---------------------------------------------------------------------------
  // Card-level scroll helpers
  // ---------------------------------------------------------------------------

  /** Read slide elements from the scroller (stable outer ref → motion track → grid → slides). */
  const getScrollCards = useCallback((): HTMLElement[] => {
    const el = serviceScrollerRef.current;
    if (!el) return [];
    const motionTrack = el.firstElementChild as HTMLElement | null;
    const grid = motionTrack?.firstElementChild as HTMLElement | null;
    if (!grid) return [];
    return Array.from(grid.children) as HTMLElement[];
  }, []);

  /**
   * Scroll directly to a card by index with smooth animation.
   * Uses offsetLeft so we never fight the CSS gap / scroll-snap arithmetic.
   */
  const scrollToCardIdx = useCallback((idx: number) => {
    const el = serviceScrollerRef.current;
    if (!el) return;
    const cards = getScrollCards();
    if (!cards.length) return;
    const clampedIdx = Math.max(0, Math.min(cards.length - 1, idx));
    // cards[0].offsetLeft equals the scroller's padding-left.
    const pad = cards[0].offsetLeft;
    el.scrollTo({ left: cards[clampedIdx].offsetLeft - pad, behavior: 'smooth' });
  }, [getScrollCards]);

  /** Which card index is currently visible at the left edge. */
  const getCurrentCardIdx = useCallback((): number => {
    const el = serviceScrollerRef.current;
    if (!el) return 0;
    const cards = getScrollCards();
    if (!cards.length) return 0;
    const pad = cards[0].offsetLeft;
    const cur = el.scrollLeft;
    let idx = 0;
    for (let i = 0; i < cards.length; i++) {
      if (cards[i].offsetLeft - pad <= cur + 1) idx = i;
      else break;
    }
    return idx;
  }, [getScrollCards]);

  // Minimum scroll distance (px) before we consider the carousel "scrollable".
  // 8 px absorbs browser sub-pixel rounding on all known desktop breakpoints,
  // while still detecting real card-to-card scrolls (which are hundreds of px).
  const SCROLL_THRESHOLD = 8;

  const updateServiceScrollButtons = useCallback(() => {
    const el = serviceScrollerRef.current;
    if (!el) { setCanScrollServicePrev(false); setCanScrollServiceNext(false); return; }
    setCanScrollServicePrev(el.scrollLeft > SCROLL_THRESHOLD);
    setCanScrollServiceNext(
      el.scrollLeft < el.scrollWidth - el.clientWidth - SCROLL_THRESHOLD,
    );
  }, []);

  /**
   * Navigate the carousel intelligently:
   * - If there is meaningful scroll room (> SCROLL_THRESHOLD px) → scroll within tab.
   * - LEFT edge of Detailing → switch to Wash, land on LAST card.
   * - RIGHT edge of Wash    → switch to Detailing, land on FIRST card.
   *
   * Reads scrollLeft directly (not the lagged canScroll* state) and uses a
   * generous threshold so sub-pixel rounding never blocks a tab switch.
   * Tab switching never requires el to be non-null.
   */
  const navigateCarousel = useCallback((direction: -1 | 1) => {
    const el = serviceScrollerRef.current;
    // Meaningful scroll room: only true when at least SCROLL_THRESHOLD px available.
    const canScrollLeft  = !!el && el.scrollLeft > SCROLL_THRESHOLD;
    const canScrollRight = !!el && el.scrollLeft < el.scrollWidth - el.clientWidth - SCROLL_THRESHOLD;

    if (direction === -1) {
      if (canScrollLeft) {
        scrollToCardIdx(getCurrentCardIdx() - 1);
      } else if (activeTab === 'detail' && washingGroups.length > 0) {
        tabSwitchDirection.current = -1;
        pendingScrollTarget.current = 'last';
        setActiveTab('wash');
      }
    } else {
      if (canScrollRight) {
        scrollToCardIdx(getCurrentCardIdx() + 1);
      } else if (activeTab === 'wash' && detailingGroups.length > 0) {
        tabSwitchDirection.current = 1;
        pendingScrollTarget.current = 'first';
        setActiveTab('detail');
      }
    }
  }, [getCurrentCardIdx, scrollToCardIdx, activeTab, washingGroups.length, detailingGroups.length]);

  // Composite enabled states
  const canGoLeft  = canScrollServicePrev || activeTab === 'detail';
  const canGoRight = canScrollServiceNext || (activeTab === 'wash' && detailingGroups.length > 0);

  // Reset scroll when tab/vehicle changes; honour arrow-driven cross-tab targets.
  useEffect(() => {
    const target = pendingScrollTarget.current;
    pendingScrollTarget.current = null;
    setCanScrollServicePrev(false);
    setCanScrollServiceNext(false);

    let cancelled = false;
    let rafId = 0;
    let attempts = 0;
    const maxAttempts = 24;

    const applyTarget = () => {
      if (cancelled) return;
      const cards = getScrollCards();
      if (!cards.length && attempts < maxAttempts) {
        attempts += 1;
        rafId = window.requestAnimationFrame(applyTarget);
        return;
      }

      const el = serviceScrollerRef.current;
      if (!el) return;

      if (target === 'last' && cards.length) {
        scrollToCardIdx(cards.length - 1);
      } else {
        el.scrollLeft = 0;
      }
      updateServiceScrollButtons();
    };

    rafId = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(applyTarget);
    });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(rafId);
    };
  }, [activeTab, vehicleId, washingGroups, detailingGroups, updateServiceScrollButtons, getScrollCards, scrollToCardIdx]);

  // Re-attach ResizeObserver and sync buttons whenever the scroller div is
  // replaced (tab switch, vehicle change) or the viewport changes size.
  // Including `activeTab` ensures we re-run after AnimatePresence mounts
  // the new div, even when both tabs have the same number of cards.
  useEffect(() => {
    let ro: ResizeObserver | null = null;
    // The new div may not be mounted yet (AnimatePresence mode="wait" exit
    // animation still running). Wait one frame for the new div to be committed.
    const t = window.requestAnimationFrame(() => {
      const el = serviceScrollerRef.current;
      if (!el) return;
      ro = new ResizeObserver(() => updateServiceScrollButtons());
      ro.observe(el);
      updateServiceScrollButtons();
    });
    return () => {
      window.cancelAnimationFrame(t);
      ro?.disconnect();
    };
  }, [activeTab, activeServiceList.length, vehicleId, updateServiceScrollButtons]);

  useEffect(() => { setServiceType(serviceTypeFromUrl ?? 'branch'); }, [serviceTypeFromUrl, setServiceType]);
  useEffect(() => {
    if (branchLive) setSelectedBranch({ id: branchLive.id, name: branchLive.name, location: branchLive.location, rating: 0, image: '', openTime: branchLive.openTime, closeTime: branchLive.closeTime });
  }, [branchLive, setSelectedBranch]);

  const selectedPackage = useMemo(() => ALL_PACKAGES.find(p => p.id === selectedPackageId), [selectedPackageId, ALL_PACKAGES]);

  const newPlateValid = newVehicleNumber === '' || /^[A-Z0-9]{2,7}$/.test(newVehicleNumber);

  const resolveRegistrationForBooking = (): string => {
    if (!session) return registrationNumber.trim();
    if (addingNewVehicleMode || saveVehicleToProfileOnContinue) return newVehicleNumber.trim();
    const fromContext = registrationNumber.trim();
    if (fromContext) return fromContext;
    const selectedNorm = normalizeVehicleTypeForMatch(vehicleId ?? '');
    const pick = effectiveProfileVehicles.find(
      (v) =>
        normalizeVehicleTypeForMatch(v.type) === selectedNorm &&
        v.model.trim() === vehicleModel.trim()
    );
    return (pick?.number ?? '').trim();
  };

  const handleContinue = async () => {
    if (!vehicleId || !selectedPackage) return;
    if (session && (addingNewVehicleMode || saveVehicleToProfileOnContinue)) {
      if (!newPlateValid) {
        setAddVehicleTouched(true);
        return;
      }
    }
    const regForBooking = resolveRegistrationForBooking();
    setRegistrationNumber(regForBooking);
    const vType = VEHICLE_OPTIONS.find(v => v.id === vehicleId)?.label ?? vehicleId;
    setVehicleType(vType);
    setSelectedService({ ...selectedPackage, features: [...selectedPackage.features] });
    
    if (!session) {
      localStorage.setItem('guestVehicle', JSON.stringify({
        type: vType,
        model: vehicleModel.trim(),
        registration: registrationNumber.trim(),
      }));
    } else if (addingNewVehicleMode || saveVehicleToProfileOnContinue) {
      setContinueSaveError('');
      setContinueSaving(true);
      try {
        const existing = effectiveProfileVehicles.map((v) => ({
          type: v.type,
          number: v.number ?? '',
          model: v.model,
        }));
        await updateCustomerProfile({
          full_name: session.fullName,
          phone: session.phone,
          address: session.address,
          email: session.email,
          vehicles: [
            ...existing,
            { type: vType, number: newVehicleNumber.trim(), model: vehicleModel.trim() },
          ],
        });
        setRegistrationNumber(newVehicleNumber.trim());
      } catch (e) {
        setContinueSaveError(
          e instanceof Error ? e.message : 'Could not save your vehicle. Try again.'
        );
        return;
      } finally {
        setContinueSaving(false);
      }
    }
    
    navigate('/addons');
  };

  const canContinue = Boolean(
    vehicleId &&
    selectedPackageId &&
    (!isMobileFlow || !!mobileVisitAddress?.full_address?.trim()) &&
    (!session ? true : (!addingNewVehicleMode && !saveVehicleToProfileOnContinue) || newPlateValid)
  );

  const saveMobileVisitAddressFromBranch = () => {
    const validation = validateRequiredAddress(mobileAddrDraft);
    setMobileAddrErr('');
    if (validation.street_address || validation.suburb || validation.state || validation.postcode) {
      setMobileAddrErr('Enter your full street address, suburb, state, and postcode.');
      return;
    }
    const structured = withFullAddress(mobileAddrDraft);
    if (!addressMatchesAcceptedPins(structured.full_address, mobilePinsForAddress)) {
      const hint = [...new Set(mobilePinsForAddress.map((p) => normalizePinDigits(p)).filter(Boolean))].join(' or ');
      setMobileAddrErr(hint ? `Address must include postcode ${hint}.` : 'Address must include your service postcode.');
      return;
    }
    setMobileVisitAddress(structured);
  };

  const selectedBodyLabel =
    VEHICLE_OPTIONS.find((v) => v.id === vehicleId)?.label ?? vehicleId ?? '';

  const vehicleDetailsReady = Boolean(
    vehicleId &&
      (!session
        ? true
        : (!addingNewVehicleMode && !saveVehicleToProfileOnContinue) || newPlateValid),
  );

  return (
    <div className="min-h-screen" style={{ background: '#eef3fa' }}>
      <div
        className="h-0.5 w-full"
        style={{ background: `linear-gradient(90deg, ${GOLD} 0%, #e8c97a 50%, transparent 100%)` }}
      />

      <main className="max-w-4xl mx-auto px-4 py-8 pb-32">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="space-y-5"
        >
          <div className="mb-1">
            <h1
              className="text-2xl font-normal tracking-[0.03em]"
              style={{ fontFamily: HEADING_FONT_FAMILY, color: NAVY }}
            >
              Vehicle &amp; service
            </h1>
            {!isMobileFlow ? (
              <p className="text-sm text-gray-500 mt-1">
                {branch.name}
                {branch.location ? ` · ${branch.location}` : ''}
              </p>
            ) : null}
          </div>

          {isMobileFlow && mobileError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {mobileError}
            </div>
          ) : null}

          {isMobileFlow && mobileSnapshot && !mobileError && !mobileVisitAddress?.full_address?.trim() ? (
            <BookingFlowSection icon={MapPin} title="Where we meet you" badge="Mobile">
              {(() => {
                const filteredSaved = savedAddresses.filter((a) =>
                  mobilePinsForAddress.length === 0 ||
                  addressMatchesAcceptedPins(
                    [a.street_address, a.suburb, [a.state, a.postcode].filter(Boolean).join(' ')].filter(Boolean).join(', '),
                    mobilePinsForAddress,
                  )
                );
                return (
                  <>
                    {filteredSaved.length > 0 && addrMode === 'saved' ? (
                      <div className="space-y-2">
                        <p className="text-sm text-gray-600 mb-2">Select a saved address or enter a new one.</p>
                        {filteredSaved.map((addr) => (
                          <button
                            key={addr.id}
                            type="button"
                            onClick={() => {
                              setMobileAddrDraft({
                                street_address: addr.street_address,
                                suburb: addr.suburb,
                                state: addr.state,
                                postcode: sanitizePostcode(addr.postcode || mobilePin),
                              });
                              setMobileAddrErr('');
                              const structured = withFullAddress({
                                street_address: addr.street_address,
                                suburb: addr.suburb,
                                state: addr.state,
                                postcode: sanitizePostcode(addr.postcode || mobilePin),
                              });
                              if (addressMatchesAcceptedPins(structured.full_address, mobilePinsForAddress)) {
                                setMobileVisitAddress(structured);
                              } else {
                                const hint = [...new Set(mobilePinsForAddress.map((p) => normalizePinDigits(p)).filter(Boolean))].join(' or ');
                                setMobileAddrErr(hint ? `Address must include postcode ${hint}.` : 'Address must include your service postcode.');
                              }
                            }}
                            className="w-full text-left flex items-start gap-3 px-4 py-3 rounded-xl border-2 border-gray-200 hover:border-blue-300 hover:bg-blue-50/40 transition-all"
                          >
                            <MapPin className="w-4 h-4 mt-0.5 shrink-0 text-gray-400" />
                            <div>
                              <p className="text-sm font-semibold text-gray-900">{addr.label}</p>
                              <p className="text-xs text-gray-500 mt-0.5">
                                {[addr.street_address, addr.suburb, [addr.state, addr.postcode].filter(Boolean).join(' ')].filter(Boolean).join(', ')}
                              </p>
                            </div>
                          </button>
                        ))}
                        {mobileAddrErr ? <p className="mt-1 text-xs text-red-600">{mobileAddrErr}</p> : null}
                        <button
                          type="button"
                          onClick={() => { setAddrMode('manual'); setMobileAddrErr(''); }}
                          className="mt-1 text-sm font-medium underline"
                          style={{ color: NAVY }}
                        >
                          + Enter a different address
                        </button>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm text-gray-600 mb-3">
                          Enter the full address for this visit (include postcode{' '}
                          <span className="font-semibold tabular-nums">{normalizePinDigits(mobilePin) || mobilePin}</span>
                          {mobilePinsForAddress.length > 1 ? ' or the area postcode shown when you booked' : ''}).
                        </p>
                        <AddressDetailsFields
                          value={mobileAddrDraft}
                          onChange={(next) => {
                            setMobileAddrDraft({ ...next, postcode: sanitizePostcode(next.postcode || mobilePin) });
                            setMobileAddrErr('');
                          }}
                          required
                          focusStyle={inpFocus}
                          postcodeLocked
                        />
                        {mobileAddrErr ? <p className="mt-2 text-xs text-red-600">{mobileAddrErr}</p> : null}
                        <button
                          type="button"
                          onClick={saveMobileVisitAddressFromBranch}
                          className="mt-4 w-full rounded-xl py-3 text-sm font-semibold transition-all"
                          style={{ background: BTN_BG, color: BTN_TEXT, boxShadow: '0 4px 14px rgba(201,168,76,0.35)' }}
                        >
                          Save service address
                        </button>
                        {filteredSaved.length > 0 && (
                          <button
                            type="button"
                            onClick={() => { setAddrMode('saved'); setMobileAddrErr(''); }}
                            className="mt-2 w-full text-sm font-medium underline"
                            style={{ color: NAVY }}
                          >
                            ← Back to saved addresses
                          </button>
                        )}
                      </>
                    )}
                  </>
                );
              })()}
            </BookingFlowSection>
          ) : null}

          <BookingFlowSection
            icon={Car}
            title="Step-1 Select your Vehicle"
            badge={vehicleId ? selectedBodyLabel : undefined}
            titleClassName="text-lg sm:text-xl"
          >
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wider">
                Body type
              </label>
                <div className="flex flex-wrap justify-center gap-3 sm:gap-4">
                  {VEHICLE_OPTIONS.map((v) => {
                    const Icon = v.icon;
                    const isSelected = vehicleId === v.id;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => {
                          setVehicleId(v.id);
                          setVehicleType(v.label);
                          setSelectedPackageId(null);
                          const targetNorm = normalizeVehicleTypeForMatch(v.id);
                          const history = effectiveProfileVehicles.find(
                            (h) => normalizeVehicleTypeForMatch(h.type) === targetNorm
                          );
                          setVehicleModel(history?.model ?? '');
                          setRegistrationNumber(history?.number ?? '');
                          setAddingNewVehicleMode(false);
                          setNewVehicleNumber('');
                          setAddVehicleTouched(false);
                          setContinueSaveError('');
                        }}
                        className={`flex w-36 shrink-0 flex-col items-center justify-center p-3 sm:w-40 sm:p-4 rounded-xl border transition-all duration-200 ${
                          isSelected
                            ? 'shadow-md'
                            : 'shadow-sm hover:shadow-md'
                        }`}
                        style={
                          isSelected
                            ? {
                                borderColor: VEHICLE_CARD_BORDER_SELECTED,
                                background: VEHICLE_CARD_BG_SELECTED,
                              }
                            : { borderColor: VEHICLE_CARD_BORDER, background: VEHICLE_CARD_BG }
                        }
                      >
                        <span
                          className="w-10 h-10 sm:w-11 sm:h-11 mb-2 rounded-full flex items-center justify-center transition-all duration-200"
                          style={
                            isSelected
                              ? { background: `${NAVY}20`, boxShadow: '0 0 0 1px rgba(12,29,58,0.12)' }
                              : { background: '#ffffff', boxShadow: '0 0 0 1px rgba(12,29,58,0.1)' }
                          }
                        >
                          <Icon
                            className="w-5 h-5 sm:w-6 sm:h-6"
                            style={{ color: isSelected ? NAVY : NAVY_MID }}
                          />
                        </span>
                        <span
                          className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wide text-center leading-tight"
                          style={{ color: isSelected ? NAVY : NAVY_MID }}
                        >
                          {v.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
            </div>
          </BookingFlowSection>

          <BookingFlowSection
            icon={Car}
            title="Step-2 Vehicle Details (Optional)"
            titleClassName="text-lg sm:text-xl"
          >
            {session ? (
                      <div className="flex flex-col gap-4">
                        {(() => {
                          const modelsForType = modelsForSelectedBodyStyle.filter(
                            (v) => String(v.model ?? '').trim().length > 0,
                          );

                          if (modelsForType.length === 0) {
                            return (
                              <div
                                className="rounded-xl border p-4"
                                style={{ background: '#f8f9fc', borderColor: NAVY_TINT }}
                              >
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                  <div>
                                    <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">
                                      Model
                                    </label>
                                    <input
                                      type="text"
                                      value={vehicleModel}
                                      onChange={(e) => setVehicleModel(e.target.value)}
                                      onBlur={() => setAddVehicleTouched(true)}
                                      placeholder="e.g. BMW X7"
                                      style={inpFocus}
                                      className={`${inp} border-gray-300 hover:border-gray-400`}
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">
                                      Registration number
                                    </label>
                                    <input
                                      type="text"
                                      value={newVehicleNumber}
                                      onChange={(e) => {
                                        const val = e.target.value.toUpperCase();
                                        if (val === '' || /^[A-Z0-9]*$/.test(val)) {
                                          setNewVehicleNumber(val);
                                        }
                                      }}
                                      onBlur={() => setAddVehicleTouched(true)}
                                      placeholder="e.g. ABC1234"
                                      style={inpFocus}
                                      className={`${inp} font-mono ${
                                        addVehicleTouched &&
                                        newVehicleNumber && !/^[A-Z0-9]{2,7}$/.test(newVehicleNumber)
                                          ? 'border-red-400 bg-red-50'
                                          : 'border-gray-300 hover:border-gray-400'
                                      }`}
                                    />
                                    {addVehicleTouched &&
                                      newVehicleNumber && !/^[A-Z0-9]{2,7}$/.test(newVehicleNumber) && (
                                        <p className="mt-1.5 text-xs text-red-500">2–7 letters or numbers only</p>
                                      )}
                                  </div>
                                </div>
                              </div>
                            );
                          }

                          return (
                            <>
                              <div className="max-w-lg space-y-1.5">
                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                  Profile vehicle details
                                </label>
                                <div
                                  className={`relative rounded-xl border bg-white shadow-sm transition-all duration-200 focus-within:border-gray-300 focus-within:shadow-md focus-within:ring-2 ${
                                    addingNewVehicleMode
                                      ? 'border-dashed border-amber-300/80 bg-amber-50/40 focus-within:ring-amber-200/70'
                                      : 'border-gray-200 hover:border-gray-300 focus-within:ring-[#0c1d3a]/10'
                                  }`}
                                >
                                  <Select
                                    value={
                                      addingNewVehicleMode
                                        ? 'new'
                                        : (() => {
                                            const i = modelsForType.findIndex((v) => v.model === vehicleModel);
                                            return i >= 0 ? String(i) : 'new';
                                          })()
                                    }
                                    onValueChange={(val) => {
                                      if (val === 'new') {
                                        setAddingNewVehicleMode(true);
                                        setVehicleModel('');
                                        setNewVehicleNumber('');
                                        setAddVehicleTouched(false);
                                        setContinueSaveError('');
                                      } else {
                                        const idx = Number.parseInt(val, 10);
                                        const pick = modelsForType[idx];
                                        if (pick) {
                                          setAddingNewVehicleMode(false);
                                          setNewVehicleNumber('');
                                          setVehicleModel(pick.model);
                                          setRegistrationNumber(pick.number || '');
                                        }
                                      }
                                    }}
                                  >
                                    <SelectTrigger
                                      aria-label="Choose a profile vehicle"
                                      className={cn(
                                        'h-auto min-h-[3.25rem] w-full border-0 bg-transparent py-3.5 pl-4 pr-2 shadow-none rounded-xl text-sm font-medium focus:ring-0 focus-visible:ring-2 focus-visible:ring-offset-0 [&>svg]:size-[1.125rem] [&>svg]:opacity-100',
                                        addingNewVehicleMode
                                          ? 'text-amber-950/90 [&>svg]:text-amber-900'
                                          : 'text-gray-900 [&>svg]:text-[#0c1d3a]',
                                      )}
                                    >
                                      <SelectValue placeholder="Select a vehicle" />
                                    </SelectTrigger>
                                    <SelectContent
                                      position="popper"
                                      sideOffset={6}
                                      align="start"
                                      className={cn(
                                        'z-[100] max-h-[min(22rem,var(--radix-select-content-available-height))] overflow-y-auto rounded-xl border border-gray-200 bg-white p-1.5 shadow-lg',
                                        'min-w-[var(--radix-select-trigger-width)]',
                                      )}
                                    >
                                      {modelsForType.map((v, i) => (
                                        <SelectItem
                                          key={`${v.model}-${v.number ?? ''}-${i}`}
                                          value={String(i)}
                                          className="cursor-pointer rounded-lg py-2.5 pl-3 pr-8 text-sm text-gray-900 outline-none data-[highlighted]:bg-[#e8eef8] data-[highlighted]:text-[#0c1d3a] data-[state=checked]:bg-[#f8f9fc] data-[state=checked]:font-semibold data-[state=checked]:text-[#0c1d3a]"
                                        >
                                          {v.model}
                                          {v.number ? ` · ${v.number}` : ''}
                                        </SelectItem>
                                      ))}
                                      <SelectSeparator className="my-1.5 bg-gray-200/90" />
                                      <SelectItem
                                        value="new"
                                        className="cursor-pointer rounded-lg py-2.5 pl-3 pr-8 text-sm font-medium text-amber-900 outline-none data-[highlighted]:bg-amber-50 data-[highlighted]:text-amber-950 data-[state=checked]:bg-amber-100/60 data-[state=checked]:text-amber-950"
                                      >
                                        + Add another for this body style
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                              {addingNewVehicleMode ? (
                                <div
                                  className="rounded-xl border p-4"
                                  style={{ background: '#f8f9fc', borderColor: NAVY_TINT }}
                                >
                                  <p className="text-xs font-semibold text-gray-700 mb-3">Add new vehicle</p>
                                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                    <div>
                                      <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">
                                        Model
                                      </label>
                                      <input
                                        type="text"
                                        value={vehicleModel}
                                        onChange={(e) => setVehicleModel(e.target.value)}
                                        onBlur={() => setAddVehicleTouched(true)}
                                        placeholder="e.g. BMW X7"
                                        style={inpFocus}
                                        className={`${inp} border-gray-300 hover:border-gray-400`}
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">
                                        Registration number
                                      </label>
                                      <input
                                        type="text"
                                        value={newVehicleNumber}
                                        onChange={(e) => {
                                          const val = e.target.value.toUpperCase();
                                          if (val === '' || /^[A-Z0-9]*$/.test(val)) {
                                            setNewVehicleNumber(val);
                                          }
                                        }}
                                        onBlur={() => setAddVehicleTouched(true)}
                                        placeholder="e.g. ABC1234"
                                        style={inpFocus}
                                        className={`${inp} font-mono ${
                                          addVehicleTouched &&
                                          newVehicleNumber && !/^[A-Z0-9]{2,7}$/.test(newVehicleNumber)
                                            ? 'border-red-400 bg-red-50'
                                            : 'border-gray-300 hover:border-gray-400'
                                        }`}
                                      />
                                      {addVehicleTouched &&
                                        newVehicleNumber && !/^[A-Z0-9]{2,7}$/.test(newVehicleNumber) && (
                                          <p className="mt-1.5 text-xs text-red-500">2–7 letters or numbers only</p>
                                        )}
                                    </div>
                                  </div>
                                </div>
                              ) : null}
                            </>
                          );
                        })()}
                      </div>
                    ) : (
                      <div className="grid gap-3 max-w-lg sm:grid-cols-2">
                        <div>
                          <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">
                            Model
                          </label>
                          <div className="relative">
                            <input
                              type="text"
                              value={vehicleModel}
                              onChange={(e) => setVehicleModel(e.target.value)}
                              placeholder="e.g. Toyota Corolla"
                              style={inpFocus}
                              className={`${inp} border-gray-300 hover:border-gray-400 pr-11`}
                            />
                            <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                              <Car className="w-5 h-5 text-gray-300" />
                            </div>
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">
                            Registration Number
                          </label>
                          <input
                            type="text"
                            value={registrationNumber}
                            onChange={(e) => setRegistrationNumber(e.target.value.toUpperCase())}
                            placeholder="e.g. ABC123"
                            style={inpFocus}
                            className={`${inp} border-gray-300 hover:border-gray-400`}
                          />
                        </div>
                      </div>
                    )}
          </BookingFlowSection>

          <BookingFlowSection
            icon={LayoutGrid}
            title="Step-3 Choose your Package"
            badge={vehicleId ? (activeTab === 'wash' ? 'Wash' : 'Detailing') : undefined}
            rootClassName="overflow-visible"
            bodyClassName="overflow-visible"
            titleClassName="text-lg sm:text-xl"
          >
                  <div className="space-y-6">
                    {vehicleId ? (
                      <>
                    <div className="flex justify-center">
                      <div
                        className="inline-flex p-1 rounded-xl border bg-gray-100/90 transition-shadow duration-300"
                        style={{ borderColor: 'rgba(12,29,58,0.08)' }}
                        role="tablist"
                        aria-label="Service category"
                      >
                        <button
                          type="button"
                          role="tab"
                          aria-selected={activeTab === 'wash'}
                          onClick={() => { tabSwitchDirection.current = -1; setActiveTab('wash'); }}
                          className={`relative px-5 sm:px-8 py-2.5 sm:py-3 text-[10px] sm:text-xs font-semibold uppercase tracking-wider transition-all rounded-lg ${
                            activeTab === 'wash'
                              ? 'bg-white text-gray-900 shadow-sm ring-1 ring-gray-200/80'
                              : 'text-gray-500 hover:text-gray-700'
                          }`}
                          style={activeTab === 'wash' ? { color: NAVY } : undefined}
                        >
                          Wash service
                        </button>
                        <button
                          type="button"
                          role="tab"
                          aria-selected={activeTab === 'detail'}
                          onClick={() => { tabSwitchDirection.current = 1; setActiveTab('detail'); }}
                          className={`relative px-5 sm:px-8 py-2.5 sm:py-3 text-[10px] sm:text-xs font-semibold uppercase tracking-wider transition-all rounded-lg ${
                            activeTab === 'detail'
                              ? 'bg-white text-gray-900 shadow-sm ring-1 ring-gray-200/80'
                              : 'text-gray-500 hover:text-gray-700'
                          }`}
                          style={activeTab === 'detail' ? { color: NAVY } : undefined}
                        >
                          Detailing service
                        </button>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {activeServiceList.length === 0 ? (
                        <p className="text-center text-sm text-gray-500 py-8 px-4">
                          No {activeTab === 'wash' ? 'wash' : 'detailing'} packages are available for this body style
                          right now. Try another vehicle type or check back later.
                        </p>
                      ) : null}
                      {/* Outer wrapper: px gives room for arrows to sit outside the cards */}
                      <div className="relative px-6 md:px-8">
                        {/* Clip only horizontal overflow so arrows are never clipped */}
                        <div className="overflow-hidden rounded-lg">
                          <div
                            ref={serviceScrollerRef}
                            onScroll={updateServiceScrollButtons}
                            className={cn(
                              'overflow-x-auto overflow-y-visible px-1 pt-5 pb-2 snap-x snap-mandatory',
                              '[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
                              activeServiceList.length === 0 && 'hidden',
                            )}
                          >
                            <AnimatePresence mode="wait" initial={false}>
                              <motion.div
                                key={activeTab}
                                initial={{ opacity: 0, x: tabSwitchDirection.current * 48 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: tabSwitchDirection.current * -48 }}
                                transition={{ duration: 0.24, ease: [0.4, 0, 0.2, 1] }}
                              >
                                <div className="grid min-w-full grid-flow-col auto-cols-[100%] gap-3 md:auto-cols-[calc((100%-0.75rem)/2)] md:gap-4 lg:auto-cols-[calc((100%-2rem)/3)] items-stretch">
                                  {activeServiceList.map((svc) => {
                                    const isSelected = selectedPackageId === svc.id;
                                    return (
                                      <div key={svc.id} className="h-full min-w-0 snap-start">
                                        <ServicePricingCard
                                          title={svc.name}
                                          price={svc.price}
                                          duration={`${svc.durationMinutes} mins`}
                                          features={svc.features}
                                          excludedFeatures={svc.excludedFeatures}
                                          badge={svc.recommended ? 'Recommended' : undefined}
                                          freeCoffeeCount={svc.freeCoffeeCount}
                                          eligibleForLoyaltyPoints={
                                            loyaltyRewardServiceIdSet.has(svc.id)
                                          }
                                          takeawayCoffeeIcon
                                          isSelected={isSelected}
                                          onClick={() => {
                                            setSelectedPackageId(svc.id);
                                            setSelectedService(svc);
                                          }}
                                        />
                                      </div>
                                    );
                                  })}
                                </div>
                              </motion.div>
                            </AnimatePresence>
                          </div>
                        </div>

                        {/* ── Floating nav arrows (outside the overflow-hidden clip) ── */}
                        <button
                          type="button"
                          aria-label="Previous services"
                          disabled={!canGoLeft}
                          onClick={() => navigateCarousel(-1)}
                          className={cn(
                            'absolute -left-4 top-[27%] z-20 sm:-left-5 sm:top-[29%]',
                            'flex h-11 w-11 items-center justify-center rounded-lg',
                            'bg-[#1d74d8] shadow-lg border border-[#1565c6]',
                            'transition-all duration-200 ease-out',
                            'hover:scale-110 hover:shadow-xl hover:bg-[#1669c8] active:scale-95',
                            'disabled:pointer-events-none disabled:opacity-30 disabled:shadow-none',
                            !canScrollServicePrev && activeTab === 'detail'
                              ? 'ring-2 ring-amber-400/70 ring-offset-1'
                              : '',
                          )}
                          style={{ color: '#ffffff' }}
                        >
                          <ChevronLeft className="h-6 w-6" strokeWidth={2.8} />
                        </button>
                        <button
                          type="button"
                          aria-label="Next services"
                          disabled={!canGoRight}
                          onClick={() => navigateCarousel(1)}
                          className={cn(
                            'absolute -right-4 top-[27%] z-20 sm:-right-5 sm:top-[29%]',
                            'flex h-11 w-11 items-center justify-center rounded-lg',
                            'bg-[#1d74d8] shadow-lg border border-[#1565c6]',
                            'transition-all duration-200 ease-out',
                            'hover:scale-110 hover:shadow-xl hover:bg-[#1669c8] active:scale-95',
                            'disabled:pointer-events-none disabled:opacity-30 disabled:shadow-none',
                            !canScrollServiceNext && activeTab === 'wash' && detailingGroups.length > 0
                              ? 'ring-2 ring-amber-400/70 ring-offset-1'
                              : '',
                          )}
                          style={{ color: '#ffffff' }}
                        >
                          <ChevronRight className="h-6 w-6" strokeWidth={2.8} />
                        </button>
                      </div>
                    </div>
                      </>
                    ) : (
                      <p className="py-8 text-center text-sm text-gray-500 px-4">
                        Select a vehicle type in Step 1 to view available packages.
                      </p>
                    )}
                  </div>
          </BookingFlowSection>

          {continueSaveError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-start gap-2">
              <span className="shrink-0 mt-0.5">⚠</span>
              <span>{continueSaveError}</span>
            </div>
          ) : null}

          <div
            className="rounded-xl border px-4 py-3"
            style={{ background: NAVY_TINT, borderColor: 'rgba(12,29,58,0.12)' }}
          >
            <BookingDisclaimerNotes />
          </div>
        </motion.div>
      </main>

      <footer className="fixed bottom-0 left-0 right-0 p-4 sm:p-6 bg-white/95 backdrop-blur-sm border-t border-gray-100 z-50">
        <div className="max-w-4xl mx-auto">
          <button
            type="button"
            onClick={() => void handleContinue()}
            disabled={!canContinue || continueSaving}
            className="w-full py-4 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            style={
              canContinue && !continueSaving
                ? {
                    background: BTN_BG,
                    color: BTN_TEXT,
                    boxShadow: '0 4px 14px rgba(201,168,76,0.4)',
                  }
                : { background: '#f3f4f6', color: '#9ca3af' }
            }
          >
            {continueSaving ? 'Saving…' : 'Continue'}
          </button>
        </div>
      </footer>
    </div>
  );
}

function AddOnsSection() {
  const { selectedBranch, serviceType, vehicleType, selectedAddOns, toggleAddOn } = useBooking();
  const syncSeed = useAdminBridgeSync(30000);
  const mobileSnapshot = getCachedMobileSnapshot();
  
  const addons = useMemo(() => {
    if (!selectedBranch) return [];
    const source = serviceType === 'onsite' && mobileSnapshot && vehicleType
      ? getMobileCatalogForVehicle(mobileSnapshot, vehicleType).addons
      : (() => {
          const vScoped = vehicleType ? getCatalogForVehicle(selectedBranch.id, vehicleType).addons : [];
          return vScoped.length ? vScoped : listBranchAddons(selectedBranch.id);
        })();
    return source.map(a => ({ id: a.id, name: a.name, price: a.price }));
  }, [selectedBranch, serviceType, vehicleType, mobileSnapshot, syncSeed]);

  const selectedIds = useMemo(() => selectedAddOns.map(a => a.id), [selectedAddOns]);

  return (
    <div className="flex flex-wrap gap-3">
      {addons.map((a) => {
        const isSelected = selectedIds.includes(a.id);
        return (
          <button
            key={a.id}
            onClick={() => toggleAddOn(a)}
            className={`flex items-center gap-3 px-6 py-4 rounded-xl border-2 transition-all duration-300 ${
              isSelected 
                ? 'border-blue-600 bg-blue-600 text-white shadow-md' 
                : 'border-gray-100 bg-gray-50 text-gray-600 hover:border-gray-200'
            }`}
          >
            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${isSelected ? 'bg-white border-white' : 'border-gray-300'}`}>
              {isSelected && <Check className="w-2.5 h-2.5 text-blue-600" strokeWidth={4} />}
            </div>
            <span className="text-sm font-bold">{a.name}</span>
            <span className={`text-sm font-bold ${isSelected ? 'text-blue-100' : 'text-gray-400'}`}>+${a.price}</span>
          </button>
        );
      })}
    </div>
  );
}
