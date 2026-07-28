import { useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useNavigate } from 'react-router';
import {
  CreditCard,
  Apple,
  Wallet,
  Check,
  Tag,
  X,
  Sparkles,
  TrendingDown,
  HandCoins,
  Calendar,
  Clock,
  Car,
  User,
  Receipt,
  Gift,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { useBooking } from '../context/BookingContext';
import {
  createOnlineBooking,
  getFreeCoffeeCupsForLineItem,
  listApplicableDiscounts,
  listBranchPromoCodes,
} from '../lib/adminPortalBridge';
import {
  createMobileOnlineBooking,
  getCachedMobileSnapshot,
  getMobileFreeCoffeeCupsForLineItem,
  listApplicableMobileDiscounts,
  listMobilePromoCodes,
} from '../lib/mobilePublicBridge';
import { useAdminBridgeSync } from '../hooks/useAdminBridgeSync';
import { apiListAddresses, apiCreateAddress, apiCheckFieldAvailability, FieldValidationError } from '../lib/userApi';
import { sanitizePostcode } from '../lib/addressDetails';
import { AuStateSelect } from '../components/AuStateSelect';
import { cn } from '../components/ui/utils';
import { API_BASE } from '../lib/apiBase';
import { headingFontStyle } from '../lib/branding';
import {
  BOOKING_NAVY as NAVY,
  BOOKING_NAVY_TINT as NAVY_TINT,
  BOOKING_GOLD as GOLD,
  BOOKING_BTN_BG as BTN_BG,
  BOOKING_BTN_TEXT as BTN_TEXT,
  BookingFlowSection,
  BOOKING_SUMMARY_BODY_CLASS,
  BOOKING_PRICE_BODY_CLASS,
  type PaymentMethodId,
} from '../components/bookingFlowSection';

const PAYMENT_METHODS = [
  {
    id: 'later',
    name: 'Pay After Service',
    icon: Wallet,
    description: 'Pay when service is completed',
  },
  {
    id: 'card',
    name: 'Credit / Debit Card',
    icon: CreditCard,
    description: 'Pay securely with your card',
  },
  {
    id: 'apple',
    name: 'Apple Pay',
    icon: Apple,
    description: 'Fast and secure payment',
  },
];

const PROMO_USAGE_KEY = 'carwash_promo_usage_by_user_v1';

const guestFieldInp =
  'w-full px-4 py-3 border border-gray-200 rounded-xl text-sm outline-none transition-all text-gray-900 placeholder:text-gray-400 placeholder:font-normal focus:ring-2 focus:ring-[#0c1d3a]/20 focus:border-[#0c1d3a]';

function composeGuestAddress(street: string, suburb: string, stateVal: string, postcode: string): string {
  const line2 = [stateVal.trim(), postcode.trim()].filter(Boolean).join(' ');
  const parts = [street.trim(), suburb.trim(), line2].filter(Boolean);
  return parts.join(', ') || '-';
}

/** Normalize AU mobile for stable promo identity (E.164-style digits without +). */
function normalizePromoPhoneDigits(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('61') && digits.length >= 11) return digits;
  if (digits.startsWith('0') && digits.length === 10) return `61${digits.slice(1)}`;
  if (digits.length === 9 && digits.startsWith('4')) return `61${digits}`;
  return digits.length >= 8 ? digits : '';
}

/** Email + legacy `guest:` keys (older builds stored guest usage under guest:email). */
function emailPromoIdentityKeys(email: string): string[] {
  const e = email.trim().toLowerCase();
  if (!e) return [];
  return [`email:${e}`, `guest:${e}`];
}

function buildPromoIdentityKeys(opts: {
  memberId?: string | null;
  email?: string | null;
  phone?: string | null;
}): string[] {
  const keys = new Set<string>();
  const memberId = opts.memberId?.trim();
  if (memberId) keys.add(`member:${memberId}`);
  for (const k of emailPromoIdentityKeys(opts.email ?? '')) keys.add(k);
  const phoneDigits = normalizePromoPhoneDigits(opts.phone ?? '');
  if (phoneDigits) keys.add(`phone:${phoneDigits}`);
  return [...keys];
}

function getPromoUsageCount(userKey: string, promoCode: string): number {
  if (!userKey || !promoCode) return 0;
  try {
    const raw = localStorage.getItem(PROMO_USAGE_KEY);
    if (!raw) return 0;
    const parsed = JSON.parse(raw) as Record<string, Record<string, number>>;
    return Math.max(0, Number(parsed[userKey]?.[promoCode.toUpperCase()] ?? 0));
  } catch {
    return 0;
  }
}

/** Max uses recorded on any identity (email, phone, or member) for this customer. */
function getPromoUsageCountForIdentities(identityKeys: string[], promoCode: string): number {
  if (!identityKeys.length || !promoCode) return 0;
  return Math.max(0, ...identityKeys.map((k) => getPromoUsageCount(k, promoCode)));
}

function isPromoUnderCustomerLimit(
  identityKeys: string[],
  promoCode: string,
  maxUsesPerCustomer: number,
): boolean {
  if (!identityKeys.length) return true;
  const limit = Math.max(1, Number(maxUsesPerCustomer ?? 1));
  return getPromoUsageCountForIdentities(identityKeys, promoCode) < limit;
}

function incrementPromoUsage(userKey: string, promoCode: string): void {
  if (!userKey || !promoCode) return;
  try {
    const raw = localStorage.getItem(PROMO_USAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, Record<string, number>>) : {};
    const byUser = { ...(parsed[userKey] ?? {}) };
    const code = promoCode.toUpperCase();
    byUser[code] = Math.max(0, Number(byUser[code] ?? 0)) + 1;
    localStorage.setItem(PROMO_USAGE_KEY, JSON.stringify({ ...parsed, [userKey]: byUser }));
  } catch {
    // ignore persistence errors
  }
}

function incrementPromoUsageForIdentities(identityKeys: string[], promoCode: string): void {
  const unique = [...new Set(identityKeys.filter(Boolean))];
  for (const key of unique) incrementPromoUsage(key, promoCode);
}

/** Fetch server-side promo usage count for an email and/or phone across all bookings. */
async function fetchServerPromoUsage(promoCode: string, email: string, phone: string): Promise<number> {
  if (!promoCode || (!email && !phone)) return 0;
  try {
    const params = new URLSearchParams({ promo_code: promoCode.trim().toUpperCase() });
    if (email.trim()) params.set('email', email.trim());
    if (phone.trim()) params.set('phone', phone.trim());
    const res = await fetch(`${API_BASE}/public/promo/usage?${params.toString()}`, { cache: 'no-store' });
    if (!res.ok) return 0;
    const data = await res.json() as { uses?: number };
    return Math.max(0, Number(data.uses ?? 0));
  } catch {
    return 0;
  }
}

export function PaymentPage() {
  const navigate = useNavigate();
  const {
    isAuthenticated,
    hasCustomerSession,
    session,
    customerLogin,
    customerRegisterGuest,
    updateCustomerProfile,
    refreshCustomerSession,
  } = useAuth();
  const {
    selectedBranch,
    serviceType,
    selectedService,
    selectedAddOns,
    selectedDate,
    selectedTime,
    selectedEndTime,
    vehicleType,
    vehicleModel,
    registrationNumber,
    getTotalPrice,
    setConfirmedBooking,
    mobileVisitAddress,
    setMobileVisitAddress,
    activeRewards,
    refreshActiveRewards,
  } = useBooking();
  const [selectedMethod, setSelectedMethod] = useState<string | null>('later');
  const [cardNumber, setCardNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [cvv, setCvv] = useState('');
  const [cardName, setCardName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [bookingError, setBookingError] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<{ code: string; discount: number; type: string } | null>(null);
  const [promoError, setPromoError] = useState('');
  const [applyingPromoCode, setApplyingPromoCode] = useState<string | null>(null);
  const applyingPromoRef = useRef(false);
  /** Server-side usage counts keyed by UPPER-CASE promo code — fetched when identity is known. */
  const [serverPromoUsages, setServerPromoUsages] = useState<Record<string, number>>({});
  const [selectedScheduleOfferIds, setSelectedScheduleOfferIds] = useState<string[]>([]);
  /** Optional tip in cents (shown to washer / branch; not included in GST-inclusive service total). */
  const [tipCents, setTipCents] = useState(0);
  const [tipInput, setTipInput] = useState('');
  const syncSeed = useAdminBridgeSync(30000);
  const mobileSnapshot = useMemo(() => getCachedMobileSnapshot(), [syncSeed]);

  // Load active loyalty rewards when an authenticated session is available
  useEffect(() => {
    if (session?.accessToken) {
      void refreshActiveRewards(session.accessToken);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.accessToken]);

  // Match a loyalty reward to the current service + channel
  const matchingReward = useMemo(() => {
    if (!selectedService || !serviceType || activeRewards.length === 0) return null;
    const channel = serviceType === 'onsite' ? 'mobile' : 'branch';
    return activeRewards.find(
      (r) => r.reward_service_id === selectedService.id && r.channel === channel
    ) ?? null;
  }, [activeRewards, selectedService, serviceType]);

  // User type and details
  const [userType, setUserType] = useState<'guest' | 'existing'>('guest');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [mobile, setMobile] = useState('');
  const [street, setStreet] = useState('');
  const [suburb, setSuburb] = useState('');
  const [stateVal, setStateVal] = useState('');
  const [postcode, setPostcode] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [createAccount, setCreateAccount] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // Existing customer login
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [paymentAuthError, setPaymentAuthError] = useState('');
  const [paymentAuthBusy, setPaymentAuthBusy] = useState(false);
  // Per-field duplicate errors from register-guest (email/phone already taken)
  const [duplicateErrors, setDuplicateErrors] = useState<Record<string, string>>({});

  const subtotal = getTotalPrice();
  const toISO = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };
  const dateISO = selectedDate ? toISO(selectedDate) : '';
  const liveOffers = useMemo(
    () =>
      selectedBranch && selectedService && selectedTime && vehicleType && dateISO
        ? serviceType === 'onsite'
          ? (mobileSnapshot
              ? listApplicableMobileDiscounts(
                  mobileSnapshot,
                  dateISO,
                  selectedTime,
                  selectedService.id,
                  vehicleType
                )
              : [])
          : listApplicableDiscounts(selectedBranch.id, dateISO, selectedTime, selectedService.id, vehicleType)
        : [],
    [selectedBranch, selectedService, selectedTime, vehicleType, dateISO, serviceType, mobileSnapshot, syncSeed]
  );
  const livePromos = useMemo(
    () =>
      selectedBranch
        ? serviceType === 'onsite'
          ? (mobileSnapshot ? listMobilePromoCodes(mobileSnapshot, dateISO || undefined, vehicleType || undefined, selectedService?.id || undefined) : [])
          : listBranchPromoCodes(selectedBranch.id, dateISO || undefined, vehicleType || undefined, selectedService?.id || undefined)
        : [],
    [selectedBranch, serviceType, mobileSnapshot, dateISO, vehicleType, selectedService?.id, syncSeed]
  );
  const promoIdentityKeys = useMemo(() => {
    if (session?.memberId || session?.email || session?.phone) {
      return buildPromoIdentityKeys({
        memberId: session.memberId,
        email: session.email,
        phone: session.phone,
      });
    }
    const email = userType === 'guest' ? guestEmail : '';
    const phone = userType === 'existing' ? loginIdentifier : mobile;
    return buildPromoIdentityKeys({ email, phone });
  }, [session?.memberId, session?.email, session?.phone, userType, guestEmail, loginIdentifier, mobile]);

  /** Resolved email and phone for server-side promo usage checks. */
  const promoCheckEmail = isAuthenticated
    ? (session?.email || '')
    : (userType === 'guest' ? guestEmail : '');
  const promoCheckPhone = isAuthenticated ? (session?.phone || '') : mobile;

  const visiblePromos = useMemo(
    () =>
      livePromos.filter((promo) => {
        if (!isPromoUnderCustomerLimit(promoIdentityKeys, promo.codeName, promo.maxUsesPerCustomer)) return false;
        const limit = Math.max(1, Number(promo.maxUsesPerCustomer ?? 1));
        const code = promo.codeName.toUpperCase();
        // If server data has been fetched for this code, apply it; otherwise show (will be blocked on apply)
        if (code in serverPromoUsages && serverPromoUsages[code] >= limit) return false;
        return true;
      }),
    [livePromos, promoIdentityKeys, serverPromoUsages]
  );

  const eligibleScheduleOffers = liveOffers.map((o) => ({
    id: o.id,
    name: o.title,
    description: o.description,
    discountType: o.discountType === 'percentage' ? 'percentage' : 'flat',
    discountValue: o.discountValue,
  }));

  const scheduleDiscountAmount = eligibleScheduleOffers
    .filter((o) => selectedScheduleOfferIds.includes(o.id))
    .reduce((sum, o) => {
      if (o.discountType === 'percentage') return sum + (subtotal * o.discountValue) / 100;
      return sum + o.discountValue;
    }, 0);

  const subtotalAfterSchedule = Math.max(0, subtotal - scheduleDiscountAmount);

  const promoDiscountAmount = (() => {
    if (!appliedPromo) return 0;
    if (appliedPromo.type === 'percentage') {
      return (subtotalAfterSchedule * appliedPromo.discount) / 100;
    }
    return Math.min(appliedPromo.discount, subtotalAfterSchedule);
  })();

  const servicePriceIncGst = selectedService?.price ?? 0;
  const addonsIncGst = selectedAddOns.reduce((sum, a) => sum + a.price, 0);
  // Loyalty reward zeroes the service price for this booking
  const loyaltyRewardDiscount = matchingReward ? servicePriceIncGst : 0;
  const servicesIncGst = Math.max(0, subtotalAfterSchedule - promoDiscountAmount - loyaltyRewardDiscount);
  const tax = 0;
  const finalTotal = servicesIncGst;
  const preDiscountTotal = subtotal;
  const tipDollars = tipCents / 100;
  const payAtBooking = finalTotal + tipDollars;

  const toggleScheduleOffer = (id: string) => {
    setSelectedScheduleOfferIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  useEffect(() => {
    if (!appliedPromo || !livePromos.length) return;
    const promo = livePromos.find((p) => p.codeName.toUpperCase() === appliedPromo.code);
    if (
      !promo ||
      !isPromoUnderCustomerLimit(promoIdentityKeys, promo.codeName, promo.maxUsesPerCustomer)
    ) {
      setAppliedPromo(null);
      setPromoError('Invalid promo code or usage limit reached');
    }
  }, [appliedPromo, livePromos, promoIdentityKeys]);

  const applyPromoCode = async (code: string) => {
    if (applyingPromoRef.current) return;
    const upper = code.toUpperCase().trim();
    if (!upper) return;

    const promo = livePromos.find((p) => p.codeName.toUpperCase() === upper);
    if (!promo) {
      setPromoError('Invalid promo code or usage limit reached');
      setTimeout(() => setPromoError(''), 3000);
      return;
    }
    // Local localStorage limit check
    if (!isPromoUnderCustomerLimit(promoIdentityKeys, promo.codeName, promo.maxUsesPerCustomer)) {
      setPromoError('Invalid promo code or usage limit reached');
      setTimeout(() => setPromoError(''), 3000);
      return;
    }

    applyingPromoRef.current = true;
    setApplyingPromoCode(upper);
    setPromoError('');

    try {
      // Server-side usage check against actual bookings (both branch + mobile)
      const email = (promoCheckEmail || '').trim();
      const phone = (promoCheckPhone || '').trim();
      if (email || phone) {
        const limit = Math.max(1, Number(promo.maxUsesPerCustomer ?? 1));
        let serverUses = serverPromoUsages[upper];
        if (serverUses === undefined) {
          serverUses = await fetchServerPromoUsage(promo.codeName, email, phone);
          setServerPromoUsages((prev) => ({ ...prev, [upper]: serverUses }));
        }
        if (serverUses >= limit) {
          setPromoError('Invalid promo code or usage limit reached');
          setTimeout(() => setPromoError(''), 3000);
          return;
        }
      }
      setAppliedPromo({
        code: upper,
        discount: promo.discountValue,
        type: promo.discountType === 'flat' ? 'fixed' : promo.discountType,
      });
      setPromoCode('');
    } finally {
      applyingPromoRef.current = false;
      setApplyingPromoCode(null);
    }
  };

  const handleApplyPromo = () => void applyPromoCode(promoCode);

  const handleRemovePromo = () => {
    setAppliedPromo(null);
    setPromoCode('');
    setPromoError('');
  };

  const handleConfirm = async () => {
    if (!selectedMethod || !selectedBranch || !selectedService || !selectedDate || !selectedTime || !vehicleType) return;
    if (profileIncomplete) return;
    if (serviceType === 'onsite' && !mobileVisitAddress?.full_address?.trim()) return;

    setIsProcessing(true);
    setBookingError('');
    const customerName =
      isAuthenticated && session
        ? session.fullName?.trim() || session.email
        : `${firstName} ${lastName}`.trim() || 'Online Customer';
    const phoneVal =
      isAuthenticated && session
        ? session.phone?.trim() || '-'
        : userType === 'guest'
          ? mobile.trim() || '-'
          : mobile.trim() || loginIdentifier.trim() || '-';
    const addressVal =
      serviceType === 'onsite'
        ? (mobileVisitAddress?.full_address?.trim() || '-')
        : isAuthenticated && session
          ? session.address?.trim() || '-'
          : composeGuestAddress(street, suburb, stateVal, postcode);

    const checkoutEmail = isAuthenticated
      ? (session?.email?.trim() ?? '')
      : userType === 'guest'
        ? guestEmail.trim()
        : '';

    const write =
      serviceType === 'onsite'
        ? await createMobileOnlineBooking({
            cityPinCode: selectedBranch.id.replace(/^mobile-/, ''),
            customerName,
            phone: phoneVal,
            address: addressVal,
            customerEmail: checkoutEmail,
            vehicleSummary: vehicleType,
            serviceId: selectedService.id,
            vehicleType,
            vehicleModel,
            registrationNumber,
            selectedAddonIds: selectedAddOns.map((a) => a.id),
            slotDate: dateISO,
            startTime: selectedTime,
            endTime: selectedEndTime ?? undefined,
            notes: `${selectedService.name}${selectedAddOns.length ? ` + ${selectedAddOns.map((a) => a.name).join(', ')}` : ''}`,
            tipCents,
            serviceChargedCents: Math.round(finalTotal * 100),
            token: session?.accessToken,
            loyaltyRewardId: matchingReward?.id,
            promoCode: appliedPromo?.code,
            paymentMethod: selectedMethod ?? undefined,
          })
        : await createOnlineBooking({
            branchId: selectedBranch.id,
            customerName,
            phone: phoneVal,
            address: addressVal,
            customerEmail: checkoutEmail,
            vehicleType,
            vehicleModel,
            registrationNumber,
            serviceSummary: `${selectedService.name}${selectedAddOns.length ? ` + ${selectedAddOns.map((a) => a.name).join(', ')}` : ''}`,
            serviceId: selectedService.id,
            selectedAddonIds: selectedAddOns.map((a) => a.id),
            slotDate: dateISO,
            startTime: selectedTime,
            endTime: selectedEndTime ?? undefined,
            tipCents,
            serviceChargedCents: Math.round(finalTotal * 100),
            token: session?.accessToken,
            loyaltyRewardId: matchingReward?.id,
            promoCode: appliedPromo?.code,
            paymentMethod: selectedMethod ?? undefined,
          });
    if (!write.ok) {
      setIsProcessing(false);
      const errMsg = 'error' in write && write.error ? write.error : 'Booking could not be created. Please try again.';
      setBookingError(errMsg);
      return;
    }
    
    // Save guest/user session info for a personalized home experience
    try {
      localStorage.setItem('carwash_last_customer_name', customerName);
      localStorage.setItem('carwash_last_customer_phone', phoneVal);
      if (isAuthenticated) {
        void refreshCustomerSession();
        // Refresh rewards so the consumed reward is removed from state
        if (session?.accessToken) void refreshActiveRewards(session.accessToken);
      }
    } catch { /* ignore */ }

    const b = write.booking;
    if (appliedPromo?.code) {
      const usageKeys =
        promoIdentityKeys.length > 0
          ? promoIdentityKeys
          : buildPromoIdentityKeys({
              memberId: session?.memberId,
              email: checkoutEmail,
              phone: phoneVal,
            });
      if (usageKeys.length > 0) {
        incrementPromoUsageForIdentities(usageKeys, appliedPromo.code);
      }
    }
    flushSync(() => {
      const loyaltyPointsAdded = selectedService.eligibleForLoyaltyPoints ? 1 : 0;
      setConfirmedBooking({
        id: b.id,
        branchId: serviceType === 'onsite' ? undefined : selectedBranch.id,
        status: b.status ?? 'scheduled',
        tipCents: typeof b.tip_cents === 'number' ? b.tip_cents : tipCents,
        subtotal,
        tax,
        discounts: scheduleDiscountAmount + promoDiscountAmount,
        total: finalTotal,
        createdAt: new Date().toISOString(),
        freeCoffeeCount:
          serviceType === 'onsite'
            ? getMobileFreeCoffeeCupsForLineItem(mobileSnapshot, vehicleType, selectedService.id)
            : getFreeCoffeeCupsForLineItem(selectedBranch.id, vehicleType, selectedService.id),
        loyaltyPointsAdded,
        customerId: (b as { customer_id?: string | null }).customer_id ?? null,
        paymentMethod: selectedMethod as PaymentMethodId,
      });
    });
    // Auto-save new mobile visit address to profile (silent, logged-in only)
    if (serviceType === 'onsite' && session?.accessToken && mobileVisitAddress?.street_address?.trim()) {
      void (async () => {
        try {
          const existing = await apiListAddresses(session.accessToken);
          const newPc = sanitizePostcode(mobileVisitAddress.postcode ?? '');
          const isDuplicate = existing.addresses.some(
            (a) =>
              a.street_address.trim().toLowerCase() === (mobileVisitAddress.street_address ?? '').trim().toLowerCase() &&
              a.suburb.trim().toLowerCase() === (mobileVisitAddress.suburb ?? '').trim().toLowerCase() &&
              sanitizePostcode(a.postcode) === newPc,
          );
          if (!isDuplicate) {
            await apiCreateAddress(session.accessToken, {
              label: 'Other',
              street_address: mobileVisitAddress.street_address ?? '',
              suburb: mobileVisitAddress.suburb ?? '',
              state: mobileVisitAddress.state ?? '',
              postcode: newPc,
              is_default: false,
            });
          }
        } catch { /* silent */ }
      })();
    }

    setIsProcessing(false);
    navigate('/success', { replace: true });
  };

  const profileIncomplete =
    !isAuthenticated &&
    hasCustomerSession &&
    session &&
    !session.profileCompleted &&
    !(serviceType === 'onsite' && !!mobileVisitAddress?.full_address?.trim());

  const getErrors = () => {
    const errs: Record<string, string> = {};
    if (userType !== 'guest') return errs;

    const nameRegex = /^[a-zA-Z\s-]+$/;

    if (!firstName) errs.firstName = 'First name is required';
    else if (!nameRegex.test(firstName)) errs.firstName = 'Enter a valid first name';

    if (!lastName) errs.lastName = 'Last name is required';
    else if (!nameRegex.test(lastName)) errs.lastName = 'Enter a valid last name';

    if (!mobile) errs.mobile = 'Mobile number is required';
    else if (!/^\d{9}$/.test(mobile.replace(/\s/g, ''))) {
      errs.mobile = 'Enter the remaining 9 digits of your mobile';
    }

    if (!guestEmail) errs.guestEmail = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(guestEmail)) errs.guestEmail = 'Enter a valid email address';

    const mobileVisitAddressFromEarlierStep =
      serviceType === 'onsite' && !!mobileVisitAddress?.full_address?.trim();
    // Address is only mandatory for mobile (onsite) service where a visit
    // address is needed to dispatch the team.  Branch bookings are walk-in —
    // address is always optional regardless of account-creation state.
    const requireGuestStructuredAddress =
      !mobileVisitAddressFromEarlierStep && serviceType === 'onsite';
    if (requireGuestStructuredAddress) {
      if (!street) errs.street = 'Street address is required';
      if (!suburb) errs.suburb = 'Suburb is required';
      if (!stateVal) errs.stateVal = 'State is required';
      if (!postcode) errs.postcode = 'Postcode is required';
      else if (!/^\d{4,6}$/.test(postcode)) errs.postcode = 'Enter 4-6 digits';
    } else if (postcode.trim() && !/^\d{4,6}$/.test(postcode)) {
      errs.postcode = 'Enter 4-6 digits';
    }

    if (createAccount) {
      const passRegex = /^(?=.*[A-Z])(?=.*\d).{8,}$/;
      if (!password) errs.password = 'Password is required';
      else if (!passRegex.test(password)) {
        errs.password = 'Password must be at least 8 characters with 1 uppercase letter and 1 number';
      }
      if (confirmPassword !== password) errs.confirmPassword = 'Passwords do not match';
    }

    return errs;
  };

  const fieldErrors = getErrors();

  // For branch bookings the customer is physically visiting — address is never
  // required, regardless of whether they are creating an account.
  // For mobile (onsite) bookings, address is always required for dispatch.
  const guestAddressOptional = userType === 'guest' && serviceType !== 'onsite';

  const isUserDetailsValid = () => {
    if (isAuthenticated) return true;
    if (profileIncomplete) return false;
    if (userType === 'existing') {
      return !!(loginIdentifier && loginPassword);
    }
    // Block if any field-level duplicate errors are present (phone/email already registered)
    if (Object.values(duplicateErrors).some(Boolean)) return false;
    return Object.keys(fieldErrors).length === 0;
  };

  // When the guest ticks "Create account" but hasn't clicked the Create account
  // button yet, the booking must not proceed — the account creation step must
  // be completed (or the checkbox unchecked) first.
  const accountCreationPending =
    !isAuthenticated &&
    userType === 'guest' &&
    createAccount;

  const onsiteMissingServiceAddress = serviceType === 'onsite' && !mobileVisitAddress?.full_address?.trim();

  const canConfirm =
    selectedMethod &&
    !profileIncomplete &&
    !onsiteMissingServiceAddress &&
    !accountCreationPending &&
    isUserDetailsValid() &&
    (selectedMethod !== 'card' ||
      (cardNumber && expiryDate && cvv && cardName));

  const showPromoSection =
    isAuthenticated ||
    (userType === 'guest' &&
      isUserDetailsValid() &&
      (serviceType !== 'onsite' ||
        Boolean(mobileVisitAddress?.full_address?.trim()) ||
        (street.trim() &&
          suburb.trim() &&
          stateVal.trim() &&
          /^\d{4,6}$/.test(postcode.trim()))));

  // Prefetch server usage when promo section is visible (debounce typing only while section hidden).
  useEffect(() => {
    if (!showPromoSection || !livePromos.length) return;
    const email = (promoCheckEmail || '').trim();
    const phone = (promoCheckPhone || '').trim();
    if (!email && !phone) return;

    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        const entries = await Promise.all(
          livePromos.map(async (p) => {
            const uses = await fetchServerPromoUsage(p.codeName, email, phone);
            return [p.codeName.toUpperCase(), uses] as [string, number];
          })
        );
        if (cancelled) return;
        setServerPromoUsages((prev) => ({ ...prev, ...Object.fromEntries(entries) }));
      })();
    }, 200);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [showPromoSection, livePromos, promoCheckEmail, promoCheckPhone]);

  return (
    <div className="min-h-screen" style={{ background: '#eef3fa' }}>
      <div
        className="h-0.5 w-full"
        style={{ background: `linear-gradient(90deg, ${GOLD} 0%, #e8c97a 50%, transparent 100%)` }}
      />

      <header className="sticky top-0 z-40 border-b border-gray-100/80 bg-white/95 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto flex items-center gap-3 px-4 py-4">
          <div>
            <h1
              className="text-2xl font-normal leading-tight tracking-[0.04em] text-gray-900"
              style={{ ...headingFontStyle, color: NAVY }}
            >
              Payment
            </h1>
            <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
              Confirm details &amp; pay
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 pb-32">
        <BookingFlowSection
          icon={Car}
          title="Booking summary"
          badge={serviceType === 'onsite' ? 'Mobile Service' : 'At Branch'}
        >
          <div className="-mt-1 space-y-1">
            <p className={BOOKING_SUMMARY_BODY_CLASS}>{selectedService?.name}</p>
            <p className={BOOKING_SUMMARY_BODY_CLASS}>
              {vehicleType}
              {vehicleModel ? ` (${vehicleModel})` : ''}
            </p>
            {registrationNumber?.trim() ? (
              <p className={BOOKING_SUMMARY_BODY_CLASS}>
                {registrationNumber.trim().toUpperCase()}
              </p>
            ) : null}
            {selectedAddOns.length > 0 ? (
              <div className="space-y-1 pt-1">
                {selectedAddOns.map((addon) => (
                  <p key={addon.id} className={BOOKING_SUMMARY_BODY_CLASS}>
                    {addon.name}
                  </p>
                ))}
              </div>
            ) : null}
            <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-gray-100 pt-4">
              <span className={cn('inline-flex items-center gap-1.5', BOOKING_SUMMARY_BODY_CLASS)}>
                <Calendar className="h-3.5 w-3.5 shrink-0" style={{ color: NAVY }} />
                {selectedDate?.toLocaleDateString()}
              </span>
              <span className={cn('inline-flex items-center gap-1.5', BOOKING_SUMMARY_BODY_CLASS)}>
                <Clock className="h-3.5 w-3.5 shrink-0" style={{ color: NAVY }} />
                {selectedTime}
              </span>
            </div>
            {serviceType === 'onsite' && mobileVisitAddress?.full_address?.trim() ? (
              <p className={cn('mt-4 border-t border-gray-100 pt-4', BOOKING_SUMMARY_BODY_CLASS)}>
                Service at {mobileVisitAddress.full_address.trim()}
              </p>
            ) : serviceType === 'onsite' ? (
              <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                Your visit address is missing. Go back to Home, use the Mobile Service card to enter your postcode and
                full address, then continue your booking.
              </p>
            ) : null}
          </div>
        </BookingFlowSection>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-5 space-y-5"
        >
          {/* User details: only when not already signed in (guest browser session) */}
          {!isAuthenticated && (
          <BookingFlowSection
            icon={User}
            title={profileIncomplete ? 'Complete your profile' : 'Your details'}
          >
            {profileIncomplete ? (
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  Add your contact details on the profile page, then return here to finish payment.
                </p>
                <button
                  type="button"
                  onClick={() => navigate('/profile-setup')}
                  className="w-full rounded-xl py-4 text-sm font-semibold transition-all"
                  style={{
                    background: BTN_BG,
                    color: BTN_TEXT,
                    boxShadow: '0 4px 14px rgba(201,168,76,0.4)',
                  }}
                >
                  Go to profile setup
                </button>
              </div>
            ) : (
              <>
            {paymentAuthError ? (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {paymentAuthError}
              </div>
            ) : null}

            {/* User Type Selection — existing customer first, guest second */}
            <div className="space-y-4 mb-6">
              <button
                type="button"
                onClick={() => {
                  setPaymentAuthError('');
                  setUserType('existing');
                }}
                className={cn(
                  'w-full rounded-2xl border-2 bg-white p-4 text-left transition-all',
                  userType === 'existing'
                    ? 'shadow-md ring-1 ring-[#0c1d3a]/10'
                    : 'border-gray-200 hover:border-gray-300',
                )}
                style={userType === 'existing' ? { borderColor: NAVY, background: NAVY_TINT } : undefined}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${
                        userType === 'existing' ? 'border-transparent' : 'border-gray-300'
                      }`}
                      style={
                        userType === 'existing'
                          ? { background: NAVY, borderColor: NAVY }
                          : undefined
                      }
                    >
                      {userType === 'existing' && <div className="w-2 h-2 bg-white rounded-full" />}
                    </div>
                    <div className="min-w-0">
                      <span className="font-medium text-gray-900">Log in as existing customer</span>
                      <p className="mt-1 text-xs font-semibold leading-snug text-gray-900">
                        (10th wash will be free if booked as a member)
                      </p>
                    </div>
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setPaymentAuthError('');
                  setUserType('guest');
                  setTouched((prev) => {
                    const next = { ...prev };
                    delete next.street;
                    delete next.suburb;
                    delete next.stateVal;
                    delete next.postcode;
                    return next;
                  });
                }}
                className={cn(
                  'w-full rounded-2xl border-2 bg-white p-4 text-left transition-all',
                  userType === 'guest'
                    ? 'shadow-md ring-1 ring-[#0c1d3a]/10'
                    : 'border-gray-200 hover:border-gray-300',
                )}
                style={userType === 'guest' ? { borderColor: NAVY, background: NAVY_TINT } : undefined}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${
                        userType === 'guest' ? 'border-transparent' : 'border-gray-300'
                      }`}
                      style={
                        userType === 'guest' ? { background: NAVY, borderColor: NAVY } : undefined
                      }
                    >
                      {userType === 'guest' && <div className="w-2 h-2 bg-white rounded-full" />}
                    </div>
                    <span className="font-medium text-gray-900">Continue as guest</span>
                  </div>
                </div>
                <p className="mt-2 text-xs text-gray-500 ml-8">
                  Note: Guest bookings do not earn loyalty points.
                </p>
              </button>
            </div>

            {/* Guest Checkout Form */}
            {userType === 'guest' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-4"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      First Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '' || /^[a-zA-Z\s-]*$/.test(val)) setFirstName(val);
                      }}
                      onBlur={() => setTouched(prev => ({ ...prev, firstName: true }))}
                      placeholder="e.g. Jane"
                      className={`${guestFieldInp} ${
                        touched.firstName && fieldErrors.firstName ? 'border-red-500 animate-pulse' : 'border-gray-300'
                      }`}
                      required
                    />
                    {touched.firstName && fieldErrors.firstName && (
                      <p className="text-xs text-red-500 mt-1">{fieldErrors.firstName}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Last Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '' || /^[a-zA-Z\s-]*$/.test(val)) setLastName(val);
                      }}
                      onBlur={() => setTouched(prev => ({ ...prev, lastName: true }))}
                      placeholder="e.g. Smith"
                      className={`${guestFieldInp} ${
                        touched.lastName && fieldErrors.lastName ? 'border-red-500 animate-pulse' : 'border-gray-300'
                      }`}
                      required
                    />
                    {touched.lastName && fieldErrors.lastName && (
                      <p className="text-xs text-red-500 mt-1">{fieldErrors.lastName}</p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Mobile <span className="text-red-500">*</span>
                  </label>
                  <div className="flex">
                    <span className="inline-flex items-center rounded-l-xl border border-r-0 border-gray-200 bg-gray-50 px-4 py-3 font-mono text-sm text-gray-500">
                      +61
                    </span>
                    <input
                      type="tel"
                      value={mobile}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\s/g, '');
                        if (val === '' || /^\d*$/.test(val)) setMobile(val.slice(0, 9));
                        if (duplicateErrors.phone) setDuplicateErrors(p => ({ ...p, phone: '' }));
                      }}
                      onBlur={async () => {
                        setTouched(prev => ({ ...prev, mobile: true }));
                        const digits = mobile.replace(/\s/g, '');
                        if (/^\d{9}$/.test(digits)) {
                          try {
                            const res = await apiCheckFieldAvailability({ phone: `+61${digits}` });
                            if (res.phone_taken) {
                              setDuplicateErrors(p => ({ ...p, phone: 'This phone number is already registered. Please log in instead.' }));
                            }
                          } catch { /* ignore network errors */ }
                        }
                      }}
                      placeholder="e.g. 412345678"
                      className={`flex-1 rounded-r-xl border border-l-0 border-gray-200 px-4 py-3 font-mono text-sm text-gray-900 outline-none transition-all placeholder:text-gray-400 focus:border-[#0c1d3a] focus:ring-2 focus:ring-[#0c1d3a]/20 ${
                        (touched.mobile && fieldErrors.mobile) || duplicateErrors.phone
                          ? 'border-red-500'
                          : 'border-gray-300'
                      }`}
                      required
                    />
                  </div>
                  {touched.mobile && fieldErrors.mobile && (
                    <p className="text-xs text-red-500 mt-1">{fieldErrors.mobile}</p>
                  )}
                  {duplicateErrors.phone && (
                    <p className="text-xs text-red-500 mt-1 flex items-center gap-1 flex-wrap">
                      <span>⚠</span> {duplicateErrors.phone}
                      <button type="button" className="underline font-semibold ml-1" onClick={() => setUserType('existing')}>
                        Log in
                      </button>
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Mobile number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={guestEmail}
                    onChange={(e) => {
                      setGuestEmail(e.target.value);
                      if (duplicateErrors.email) setDuplicateErrors(p => ({ ...p, email: '' }));
                    }}
                    onBlur={async () => {
                      setTouched(prev => ({ ...prev, guestEmail: true }));
                      const email = guestEmail.trim();
                      if (/\S+@\S+\.\S+/.test(email)) {
                        try {
                          const res = await apiCheckFieldAvailability({ email });
                          if (res.email_taken) {
                            setDuplicateErrors(p => ({ ...p, email: 'This email is already registered. Please log in instead.' }));
                          }
                        } catch { /* ignore network errors */ }
                      }
                    }}
                    placeholder="e.g. you@example.com"
                    autoComplete="username"
                    className={`${guestFieldInp} ${
                      (touched.guestEmail && fieldErrors.guestEmail) || duplicateErrors.email
                        ? 'border-red-500'
                        : 'border-gray-300'
                    }`}
                    required
                  />
                  {touched.guestEmail && fieldErrors.guestEmail && (
                    <p className="text-xs text-red-500 mt-1">{fieldErrors.guestEmail}</p>
                  )}
                  {duplicateErrors.email && (
                    <p className="text-xs text-red-500 mt-1 flex items-center gap-1 flex-wrap">
                      <span>⚠</span> {duplicateErrors.email}
                      <button type="button" className="underline font-semibold ml-1" onClick={() => setUserType('existing')}>
                        Log in
                      </button>
                    </p>
                  )}
                </div>

                {!(serviceType === 'onsite' && mobileVisitAddress?.full_address?.trim()) && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Address{' '}
                    {guestAddressOptional ? (
                      <span className="font-normal text-gray-500">(optional)</span>
                    ) : (
                      <span className="text-red-500">*</span>
                    )}
                  </label>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Street Address{guestAddressOptional ? ' (optional)' : ' *'}
                      </label>
                      <input
                        type="text"
                        value={street}
                        onChange={(e) => setStreet(e.target.value)}
                        onBlur={() => setTouched(prev => ({ ...prev, street: true }))}
                        placeholder="e.g. 123 Main St"
                        className={`${guestFieldInp} ${
                          !guestAddressOptional && touched.street && fieldErrors.street
                            ? 'border-red-500'
                            : 'border-gray-300'
                        }`}
                        required={!guestAddressOptional}
                      />
                      {!guestAddressOptional && touched.street && fieldErrors.street && (
                        <p className="text-xs text-red-500 mt-1">{fieldErrors.street}</p>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="min-w-0">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Suburb{guestAddressOptional ? ' (optional)' : ' *'}
                        </label>
                        <input
                          type="text"
                          value={suburb}
                          onChange={(e) => setSuburb(e.target.value)}
                          onBlur={() => setTouched(prev => ({ ...prev, suburb: true }))}
                          placeholder="e.g. West Pennant Hills"
                          className={`${guestFieldInp} ${
                            !guestAddressOptional && touched.suburb && fieldErrors.suburb
                              ? 'border-red-500'
                              : 'border-gray-300'
                          }`}
                          required={!guestAddressOptional}
                        />
                      </div>
                      <div className="min-w-0">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          State{guestAddressOptional ? ' (optional)' : ' *'}
                        </label>
                        <AuStateSelect
                          value={stateVal}
                          onChange={setStateVal}
                          onBlur={() => setTouched((prev) => ({ ...prev, stateVal: true }))}
                          className={guestFieldInp}
                          hasError={
                            !guestAddressOptional && Boolean(touched.stateVal && fieldErrors.stateVal)
                          }
                          formatOption={(s) => `${s.code} (${s.name})`}
                        />
                      </div>
                      <div className="min-w-0">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Postcode{guestAddressOptional ? ' (optional)' : ' *'}
                        </label>
                        <input
                          type="text"
                          maxLength={6}
                          value={postcode}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                            setPostcode(val);
                          }}
                          onBlur={() => setTouched(prev => ({ ...prev, postcode: true }))}
                          placeholder="e.g. 2125"
                          className={`${guestFieldInp} ${
                            !guestAddressOptional && touched.postcode && fieldErrors.postcode
                              ? 'border-red-500'
                              : 'border-gray-300'
                          }`}
                          required={!guestAddressOptional}
                        />
                      </div>
                    </div>
                    {!guestAddressOptional &&
                      (touched.suburb && fieldErrors.suburb ||
                        touched.stateVal && fieldErrors.stateVal ||
                        touched.postcode && fieldErrors.postcode) && (
                      <p className="text-xs text-red-500">
                        {fieldErrors.suburb || fieldErrors.stateVal || fieldErrors.postcode}
                      </p>
                    )}
                  </div>
                </div>
                )}

                {/* Create Account Checkbox */}
                <div className="pt-4 border-t border-gray-200">
                  <label className="flex items-start gap-3 cursor-pointer group">
                    <div className="relative flex items-center justify-center mt-0.5">
                      <input
                        type="checkbox"
                        checked={createAccount}
                        onChange={(e) => setCreateAccount(e.target.checked)}
                        className="h-5 w-5 cursor-pointer rounded border-2 border-gray-300 text-[#0c1d3a] focus:ring-2 focus:ring-[#0c1d3a]/25 focus:ring-offset-0"
                      />
                    </div>
                    <span className="text-sm text-gray-700 group-hover:text-gray-900 font-medium">
                      Create a customer account for faster checkout
                    </span>
                  </label>
                  <p className="ml-8 mt-1 text-xs" style={{ color: NAVY }}>
                    Account holders earn rewards & loyalty points on every booking!
                  </p>
                </div>

                {/* Account Creation Fields (shown when create account is checked) */}
                {createAccount && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-4 pt-4 border-t border-gray-200"
                  >
                    {/*
                      Hidden username input consumed by the browser's autofill heuristic.
                      Browsers pair the nearest username/email field with a password field
                      to trigger credential autofill.  Providing an explicit hidden username
                      here — in addition to autoComplete="new-password" on the visible
                      inputs — stops Chrome/Safari from pre-filling with saved credentials.
                    */}
                    <input type="text" autoComplete="username" aria-hidden="true"
                      tabIndex={-1} style={{ display: 'none' }} readOnly value={guestEmail} />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Password <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          onBlur={() => setTouched(prev => ({ ...prev, password: true }))}
                          placeholder="e.g. Abcdef12"
                          autoComplete="new-password"
                          className={`${guestFieldInp} ${
                            touched.password && fieldErrors.password ? 'border-red-500' : 'border-gray-300'
                          }`}
                          required
                        />
                        {touched.password && fieldErrors.password && (
                          <p className="text-xs text-red-500 mt-1">{fieldErrors.password}</p>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Confirm Password <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          onBlur={() => setTouched(prev => ({ ...prev, confirmPassword: true }))}
                          placeholder="e.g. Abcdef12"
                          autoComplete="new-password"
                          className={`${guestFieldInp} ${
                            touched.confirmPassword && fieldErrors.confirmPassword ? 'border-red-500' : 'border-gray-300'
                          }`}
                          required
                        />
                        {touched.confirmPassword && fieldErrors.confirmPassword && (
                          <p className="text-xs text-red-500 mt-1">{fieldErrors.confirmPassword}</p>
                        )}
                      </div>
                    </div>

                    {/* Duplicate-account error banner — shown near the button so the
                        user sees it without having to scroll back up */}
                    {(duplicateErrors.email || duplicateErrors.phone) && (
                      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 space-y-1">
                        {duplicateErrors.email && (
                          <p className="text-sm text-red-700 flex items-start gap-2">
                            <span className="shrink-0 mt-0.5">⚠</span>
                            {duplicateErrors.email}
                          </p>
                        )}
                        {duplicateErrors.phone && (
                          <p className="text-sm text-red-700 flex items-start gap-2">
                            <span className="shrink-0 mt-0.5">⚠</span>
                            {duplicateErrors.phone}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Create Account Button */}
                    <div className="pt-4">
                      <button
                        type="button"
                        onClick={async () => {
                          if (!isUserDetailsValid()) return;
                          setPaymentAuthError('');
                          setDuplicateErrors({});
                          setPaymentAuthBusy(true);
                          try {
                            // Register without OTP — backend checks email + phone uniqueness
                            // and returns structured field_errors if either is already taken.
                            const phone = `+61${mobile.trim()}`;
                            await customerRegisterGuest(guestEmail.trim(), password, phone);
                            // Profile patch: set name and phone (address optional for branch)
                            await updateCustomerProfile({
                              full_name: `${firstName} ${lastName}`.trim(),
                              phone,
                              address:
                                serviceType === 'onsite' && mobileVisitAddress?.full_address?.trim()
                                  ? mobileVisitAddress.full_address.trim()
                                  : composeGuestAddress(street, suburb, stateVal, postcode),
                              vehicles: [],
                            });
                          } catch (e) {
                            if (e instanceof FieldValidationError) {
                              // Show "Email already exists. Login to continue." etc.
                              // under the specific field — do NOT show a generic banner.
                              setDuplicateErrors(e.fields);
                            } else {
                              setPaymentAuthError(
                                e instanceof Error ? e.message : 'Could not create account'
                              );
                            }
                          } finally {
                            setPaymentAuthBusy(false);
                          }
                        }}
                        disabled={!isUserDetailsValid() || paymentAuthBusy}
                        className="w-full rounded-xl py-4 text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50"
                        style={
                          isUserDetailsValid() && !paymentAuthBusy
                            ? {
                                background: BTN_BG,
                                color: BTN_TEXT,
                                boxShadow: '0 4px 14px rgba(201,168,76,0.4)',
                              }
                            : { background: '#f3f4f6', color: '#9ca3af' }
                        }
                      >
                        {paymentAuthBusy ? 'Creating account…' : 'Create account'}
                      </button>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            )}

            {/* Existing Customer Login Form */}
            {userType === 'existing' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={loginIdentifier}
                    onChange={(e) => setLoginIdentifier(e.target.value)}
                    placeholder="+61 412 345 678"
                    autoComplete="username"
                    className={guestFieldInp}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Password <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="e.g. your password"
                    className={guestFieldInp}
                    required
                  />
                </div>

                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    className="text-sm font-semibold transition hover:opacity-80"
                    style={{ color: NAVY }}
                  >
                    Forgot password?
                  </button>
                </div>

                {/* Login Button */}
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={async () => {
                      if (!loginIdentifier || !loginPassword) return;
                      setPaymentAuthError('');
                      setPaymentAuthBusy(true);
                      try {
                        await customerLogin(loginIdentifier.trim(), loginPassword);
                      } catch (e) {
                        setPaymentAuthError(e instanceof Error ? e.message : 'Login failed');
                      } finally {
                        setPaymentAuthBusy(false);
                      }
                    }}
                    disabled={!loginIdentifier || !loginPassword || paymentAuthBusy}
                    className="w-full rounded-xl py-4 text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50"
                    style={
                      loginIdentifier && loginPassword && !paymentAuthBusy
                        ? {
                            background: BTN_BG,
                            color: BTN_TEXT,
                            boxShadow: '0 4px 14px rgba(201,168,76,0.4)',
                          }
                        : { background: '#f3f4f6', color: '#9ca3af' }
                    }
                  >
                    {paymentAuthBusy ? 'Signing in…' : 'Log in'}
                  </button>
                </div>
              </motion.div>
            )}
              </>
            )}
          </BookingFlowSection>
          )}

          <BookingFlowSection icon={CreditCard} title="Payment method">
            <div className="space-y-3">
            {PAYMENT_METHODS.map((method) => {
              const Icon = method.icon;
              const isSelected = selectedMethod === method.id;
              const isDisabled = method.id !== 'later';

              return (
                <button
                  key={method.id}
                  onClick={() => !isDisabled && setSelectedMethod(method.id)}
                  disabled={isDisabled}
                  className={cn(
                    'w-full rounded-2xl border-2 p-5 text-left transition-all',
                    isDisabled
                      ? 'cursor-not-allowed border-gray-100 bg-gray-50 opacity-60'
                      : isSelected
                        ? 'shadow-md ring-1 ring-[#0c1d3a]/10'
                        : 'border-gray-200 bg-white hover:border-gray-300',
                  )}
                  style={
                    !isDisabled && isSelected
                      ? { borderColor: NAVY, background: NAVY_TINT }
                      : undefined
                  }
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div
                        className={cn(
                          'flex h-12 w-12 items-center justify-center rounded-xl',
                          isSelected ? '' : 'bg-gray-100',
                        )}
                        style={isSelected ? { background: NAVY_TINT } : undefined}
                      >
                        <Icon
                          className={cn('h-6 w-6', !isSelected && 'text-gray-600')}
                          style={isSelected ? { color: NAVY } : undefined}
                        />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{method.name}</p>
                        <p className="text-sm text-gray-500">{method.description}</p>
                      </div>
                    </div>
                    <div
                      className={cn(
                        'flex h-6 w-6 items-center justify-center rounded-full border-2 transition-all',
                        isSelected ? '' : 'border-gray-300',
                      )}
                      style={
                        isSelected ? { background: NAVY, borderColor: NAVY } : undefined
                      }
                    >
                      {isSelected && <Check className="h-4 w-4 text-white" />}
                    </div>
                  </div>
                </button>
              );
            })}
            </div>
          </BookingFlowSection>

          {/* Card Details Form */}
          {selectedMethod === 'card' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <BookingFlowSection icon={CreditCard} title="Card details">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Card Number
                  </label>
                  <input
                    type="text"
                    value={cardNumber}
                    onChange={(e) => setCardNumber(e.target.value)}
                    placeholder="e.g. 4111 1111 1111 1111"
                    maxLength={19}
                    className={guestFieldInp}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Expiry Date
                    </label>
                    <input
                      type="text"
                      value={expiryDate}
                      onChange={(e) => setExpiryDate(e.target.value)}
                      placeholder="e.g. 12/28"
                      maxLength={5}
                      className={guestFieldInp}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      CVV
                    </label>
                    <input
                      type="text"
                      value={cvv}
                      onChange={(e) => setCvv(e.target.value)}
                      placeholder="e.g. 123"
                      maxLength={3}
                      className={guestFieldInp}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Cardholder Name
                  </label>
                  <input
                    type="text"
                    value={cardName}
                    onChange={(e) => setCardName(e.target.value)}
                    placeholder="e.g. Jane Doe"
                    className={guestFieldInp}
                  />
                </div>
              </div>
              </BookingFlowSection>
            </motion.div>
          )}

          {/* Day / time pricing & savings (optional selections) */}
          {eligibleScheduleOffers.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
              <BookingFlowSection icon={Sparkles} title="Save more on this visit">
                <p className="-mt-1 mb-4 text-sm text-gray-600">
                  Select any eligible day &amp; time offers for this booking. Add a promo code below if you have one.
                </p>

              <div className="space-y-3">
                {eligibleScheduleOffers.map((offer) => {
                  const checked = selectedScheduleOfferIds.includes(offer.id);
                  const amount = offer.discountType === 'percentage'
                    ? (subtotal * offer.discountValue) / 100
                    : offer.discountValue;
                  return (
                    <label
                      key={offer.id}
                      className={`flex items-center justify-between gap-3 p-3 bg-white rounded-lg border-2 cursor-pointer transition-all ${
                        checked ? 'border-green-500 ring-1 ring-green-200' : 'border-green-200 hover:border-green-300'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleScheduleOffer(offer.id)}
                          className="w-5 h-5 rounded border-gray-300 text-green-600 focus:ring-green-500 shrink-0"
                        />
                        <TrendingDown className="w-5 h-5 text-green-600 shrink-0" />
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900">{offer.name}</p>
                          <p className="text-xs text-gray-500">{offer.description}</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-semibold text-green-600">
                          {offer.discountType === 'percentage'
                            ? `${offer.discountValue}% OFF`
                            : `$${offer.discountValue} OFF`}
                        </p>
                        <p className="text-xs text-gray-500">-${amount.toFixed(2)}</p>
                      </div>
                    </label>
                  );
                })}
              </div>

              {scheduleDiscountAmount > 0 && (
                <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/80 p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-700">Day & time savings</p>
                    <p className="text-xl font-bold text-emerald-700 tabular-nums">-${scheduleDiscountAmount.toFixed(2)}</p>
                  </div>
                </div>
              )}
              </BookingFlowSection>
            </motion.div>
          )}

          {/* Promo Code Section — guests: after contact + address (mobile) */}
          {showPromoSection && (
          <BookingFlowSection icon={Tag} title="Promo code">
            <p className="-mt-1 mb-4 text-sm text-gray-500">
              Tap a coupon to apply it instantly, or type a code and press Apply.
            </p>

            {!appliedPromo ? (
              <div>
                <div className="mb-4 flex flex-col gap-3 sm:flex-row">
                  <input
                    type="text"
                    value={promoCode}
                    onChange={(e) => {
                      setPromoCode(e.target.value.toUpperCase());
                      setPromoError('');
                    }}
                    onKeyPress={(e) => e.key === 'Enter' && handleApplyPromo()}
                    placeholder="e.g. SAVE10"
                    className={`${guestFieldInp} min-w-0 flex-1 uppercase`}
                  />
                  <button
                    type="button"
                    onClick={handleApplyPromo}
                    disabled={!promoCode.trim() || applyingPromoCode !== null}
                    className="shrink-0 rounded-xl px-6 py-3 text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50"
                    style={
                      promoCode.trim()
                        ? { background: NAVY_TINT, color: NAVY, border: `1px solid rgba(12,29,58,0.2)` }
                        : { background: '#f3f4f6', color: '#9ca3af' }
                    }
                  >
                    Apply
                  </button>
                </div>
                {promoError && (
                  <motion.p
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-4 text-sm text-red-600"
                  >
                    {promoError}
                  </motion.p>
                )}
                
                {/* Available Promo Codes */}
                <div>
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Available promo codes</p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {visiblePromos.map((details) => {
                      const codeUpper = details.codeName.toUpperCase();
                      const isApplying = applyingPromoCode === codeUpper;
                      return (
                      <button
                        key={details.id}
                        type="button"
                        disabled={applyingPromoCode !== null}
                        aria-busy={isApplying}
                        onClick={() => void applyPromoCode(details.codeName)}
                        className={cn(
                          'group rounded-2xl border-2 border-dashed bg-white p-4 text-left transition-all',
                          isApplying
                            ? 'border-gray-300 opacity-70'
                            : 'border-gray-200 hover:border-gray-300',
                          applyingPromoCode !== null && !isApplying && 'opacity-60',
                        )}
                      >
                        <div className="mb-1 flex items-center justify-between">
                          <p className="text-sm font-semibold text-gray-900">{details.codeName}</p>
                          <div
                            className="flex h-8 w-8 items-center justify-center rounded-lg opacity-0 transition-opacity group-hover:opacity-100"
                            style={{ background: NAVY_TINT }}
                          >
                            <Check className="h-4 w-4" style={{ color: NAVY }} />
                          </div>
                        </div>
                        <p className="text-xs font-semibold" style={{ color: NAVY }}>
                          {details.discountType === 'percentage'
                            ? `${details.discountValue}% OFF`
                            : `$${details.discountValue} OFF`}
                        </p>
                      </button>
                    );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center justify-between p-4 bg-green-50 border-2 border-green-200 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center">
                    <Check className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{appliedPromo.code}</p>
                    <p className="text-sm text-green-700">
                      {appliedPromo.type === 'percentage'
                        ? `${appliedPromo.discount}% off`
                        : `$${appliedPromo.discount} off`}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleRemovePromo}
                  className="p-2 hover:bg-red-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-600" />
                </button>
              </motion.div>
            )}
          </BookingFlowSection>
          )}

          {/* Optional tip — stored on booking for branch / washer */}
          <BookingFlowSection icon={HandCoins} title="Add a tip (optional)">
            <p className="-mt-1 mb-4 text-sm text-gray-500">
              100% goes to the team at the branch. You can change this anytime before you confirm.
            </p>
            <div className="mb-4 flex flex-wrap gap-2">
              {[
                { label: 'No tip', cents: 0 },
                { label: '$5', cents: 500 },
                { label: '$10', cents: 1000 },
                { label: '$15', cents: 1500 },
                { label: '$20', cents: 2000 },
                { label: '$25', cents: 2500 },
              ].map((opt) => (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => {
                    setTipCents(opt.cents);
                    setTipInput(opt.cents === 0 ? '' : (opt.cents / 100).toString());
                  }}
                  className={cn(
                    'rounded-xl border-2 px-3 py-2.5 text-xs font-semibold tabular-nums transition-all sm:text-sm',
                    tipCents === opt.cents
                      ? 'shadow-sm ring-1 ring-[#0c1d3a]/10'
                      : 'border-gray-200 bg-white text-gray-800 hover:border-gray-300',
                  )}
                  style={
                    tipCents === opt.cents
                      ? { borderColor: NAVY, background: NAVY_TINT, color: NAVY }
                      : undefined
                  }
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-500">Custom tip ($)</label>
            <input
              type="text"
              inputMode="decimal"
              value={tipInput}
              placeholder="e.g. 7.50"
              onChange={(e) => {
                const v = e.target.value;
                // Allow only numbers and one decimal point
                if (v !== '' && !/^\d*\.?\d*$/.test(v)) return;
                
                setTipInput(v);
                if (v === '' || v === '.') {
                  setTipCents(0);
                  return;
                }
                const n = Number.parseFloat(v);
                if (!Number.isFinite(n) || n < 0) return;
                setTipCents(Math.min(50_000, Math.round(n * 100)));
              }}
              className={`${guestFieldInp} max-w-[12rem]`}
            />
          </BookingFlowSection>

          {/* Total Amount */}
          <BookingFlowSection icon={Receipt} title="Price breakdown">
            <div className={cn('-mt-1 space-y-3', BOOKING_PRICE_BODY_CLASS)}>
              {/* Loyalty reward applied banner */}
              {matchingReward && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5"
                >
                  <Gift className="h-5 w-5 shrink-0 text-amber-600" />
                  <div>
                    <p className="font-semibold text-amber-800">Loyalty Reward Applied</p>
                    <p className="text-xs text-amber-700">
                      {matchingReward.reward_service_name ?? selectedService?.name} — complimentary service
                    </p>
                  </div>
                </motion.div>
              )}
              <div className="flex items-center justify-between">
                <p className={BOOKING_SUMMARY_BODY_CLASS}>Service price (inc GST)</p>
                {matchingReward ? (
                  <p className={cn(BOOKING_SUMMARY_BODY_CLASS, 'shrink-0 tabular-nums')}>
                    <span className="line-through text-gray-400 mr-1">${servicePriceIncGst.toFixed(2)}</span>
                    <span className="text-emerald-600">$0.00</span>
                  </p>
                ) : (
                  <p className={cn(BOOKING_SUMMARY_BODY_CLASS, 'shrink-0 tabular-nums')}>${servicePriceIncGst.toFixed(2)}</p>
                )}
              </div>
              <div className="flex items-center justify-between">
                <p className={BOOKING_SUMMARY_BODY_CLASS}>Add-ons (inc GST)</p>
                <p className={cn(BOOKING_SUMMARY_BODY_CLASS, 'shrink-0 tabular-nums')}>${addonsIncGst.toFixed(2)}</p>
              </div>
              {matchingReward && loyaltyRewardDiscount > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center justify-between text-amber-700"
                >
                  <p className="flex items-center gap-2">
                    <Gift className="w-4 h-4" />
                    Loyalty reward
                  </p>
                  <p>-${loyaltyRewardDiscount.toFixed(2)}</p>
                </motion.div>
              )}
              {scheduleDiscountAmount > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center justify-between text-green-600"
                >
                  <p className="flex items-center gap-2">
                    <TrendingDown className="w-4 h-4" />
                    Day & time offers
                  </p>
                  <p>-${scheduleDiscountAmount.toFixed(2)}</p>
                </motion.div>
              )}
              {appliedPromo && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center justify-between text-green-600"
                >
                  <p className="flex items-center gap-2">
                    <Tag className="w-4 h-4" />
                    Promo ({appliedPromo.code})
                  </p>
                  <p>-${promoDiscountAmount.toFixed(2)}</p>
                </motion.div>
              )}
              <div className="flex items-center justify-between">
                <p className={cn(BOOKING_SUMMARY_BODY_CLASS, 'flex items-center gap-2')}>
                  <HandCoins className="h-4 w-4 shrink-0" style={{ color: NAVY }} />
                  Tip
                </p>
                <p className={cn(BOOKING_SUMMARY_BODY_CLASS, 'shrink-0 tabular-nums')}>${tipDollars.toFixed(2)}</p>
              </div>
              <div className="flex items-center justify-between border-t border-gray-200 pt-4">
                <p className={BOOKING_SUMMARY_BODY_CLASS}>Total due</p>
                <p className="text-3xl font-bold tabular-nums" style={{ color: NAVY }}>
                  ${payAtBooking.toFixed(2)}
                </p>
              </div>
              <p className="text-right text-xs text-gray-500">Service and add-on prices include GST.</p>
            </div>
          </BookingFlowSection>

          {/* Security Note */}
          <div
            className="rounded-xl border px-4 py-4"
            style={{ background: NAVY_TINT, borderColor: 'rgba(12,29,58,0.12)' }}
          >
            <p className="text-center text-sm leading-relaxed text-gray-700">
              <span className="font-semibold" style={{ color: NAVY }}>Secure payment:</span>{' '}
              Your payment information is encrypted and secure.
            </p>
          </div>
        </motion.div>
      </main>

      <footer className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-100 bg-white/95 p-4 backdrop-blur-sm sm:p-6">
        <div className="mx-auto max-w-4xl">
          {bookingError && (
            <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {bookingError}
            </div>
          )}
          {accountCreationPending && (
            <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800 text-center">
              Please click <strong>Create account</strong> above to continue, or uncheck the account option.
            </div>
          )}
            <button
              type="button"
              onClick={() => void handleConfirm()}
              disabled={!canConfirm || isProcessing}
              className="w-full rounded-xl py-4 text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50"
              style={
                canConfirm && !isProcessing
                  ? {
                      background: BTN_BG,
                      color: BTN_TEXT,
                      boxShadow: '0 4px 14px rgba(201,168,76,0.4)',
                    }
                  : { background: '#f3f4f6', color: '#9ca3af' }
              }
            >
              {isProcessing ? (
                <span className="flex items-center justify-center gap-2">
                  <svg
                    className="animate-spin h-5 w-5"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Processing...
                </span>
              ) : (
                'Confirm Booking'
              )}
            </button>
        </div>
      </footer>
    </div>
  );
}