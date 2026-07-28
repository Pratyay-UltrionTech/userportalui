import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  MapPin, Building2, Car, Clock, Calendar,
  Zap, TrendingDown, Sparkles, Check, ArrowRight,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useBooking } from '../context/BookingContext';
import { useAuth } from '../context/AuthContext';
import { listBranches, listHomeOffers, syncAdminStateFromPortal } from '../lib/adminPortalBridge';
import { checkMobileServiceability, fetchMobileSnapshot } from '../lib/mobilePublicBridge';
import { normalizePinDigits } from '../lib/mobileVisitAddress';
import { useAdminBridgeSync } from '../hooks/useAdminBridgeSync';
import { AddressDetailsFields } from '../components/AddressDetailsFields';
import {
  createEmptyAddressDetails,
  isAddressComplete,
  sanitizePostcode,
  validateRequiredAddress,
  withFullAddress,
  type AddressDetails,
} from '../lib/addressDetails';
import { apiListAddresses, type SavedAddress } from '../lib/userApi';
import { BrandLoading } from '../components/BrandLoading';
import { homeHeadingStyle, homePageType } from '../lib/homePageTypography';

const NAVY      = '#0c1d3a';
const NAVY_TINT = '#e8eef8';
const GOLD      = '#c9a84c';
const MOBILE_CARD_BG = '#E6F3F1';
const MOBILE_CARD_BORDER = '#9ECFC9';
const MOBILE_BADGE_BG = '#2FAE97';
const BTN_BG    = '#c9a84c';
const BTN_TEXT  = '#0c1d3a';

/** Booking tiles — content-sized rectangle; shared padding & vertical rhythm. */
const BOOKING_TILE = 'flex w-full flex-col overflow-hidden rounded-2xl border-2';
const BOOKING_TILE_BODY = 'flex min-h-0 flex-1 flex-col gap-3 px-5 py-4';
const BOOKING_LINE_GAP = 'space-y-3';

const BRANCH_PERKS = [
  'Trained detailing specialists',
  'Walk-in friendly',
  'Complimentary coffee on select services',
] as const;

const MOBILE_PIN_HIGHLIGHTS = [
  { icon: Clock, text: 'Flexible scheduling' },
  { icon: Sparkles, text: 'Premium finish' },
] as const;

const FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1680533749371-59c49b31fd74?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080';

/* ─── offer style pools ─── */
const STYLE_POOL = [
  { icon: Clock,       grad: 'from-orange-500 to-rose-500',   bg: 'bg-orange-50',  border: 'border-orange-200'  },
  { icon: Calendar,    grad: 'from-sky-500 to-blue-600',       bg: 'bg-sky-50',     border: 'border-sky-200'     },
  { icon: TrendingDown, grad: 'from-emerald-500 to-teal-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
] as const;

export function HomePage() {
  const navigate = useNavigate();
  const { resetBooking, setSelectedBranch, setServiceType, mobileVisitAddress, setMobileVisitAddress } = useBooking();
  const { session } = useAuth();
  const [mobileLocation, setMobileLocation] = useState(() =>
    sanitizePostcode(mobileVisitAddress?.postcode ?? ''),
  );
  const [mobileBusy, setMobileBusy]         = useState(false);
  const [mobileError, setMobileError]       = useState('');
  /** After PIN is verified: collect full address in-card before continuing to booking. */
  const [mobileCardStep, setMobileCardStep] = useState<'pin' | 'address'>(() => (
    mobileVisitAddress?.postcode ? 'address' : 'pin'
  ));
  const [mobileCityPinCode, setMobileCityPinCode] = useState('');
  const [mobileAcceptedPins, setMobileAcceptedPins] = useState<string[]>([]);
  const [mobileAddress, setMobileAddress] = useState<AddressDetails>(() => (
    mobileVisitAddress
      ? {
          street_address: mobileVisitAddress.street_address ?? '',
          suburb: mobileVisitAddress.suburb ?? '',
          state: mobileVisitAddress.state ?? '',
          postcode: sanitizePostcode(mobileVisitAddress.postcode ?? ''),
        }
      : createEmptyAddressDetails()
  ));
  const [addressTouched, setAddressTouched] = useState(false);
  const [mobileAddressError, setMobileAddressError] = useState('');
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [selectedSavedId, setSelectedSavedId] = useState<string | null>(null);
  const streetInputRef = useRef<HTMLInputElement | null>(null);
  const syncSeed = useAdminBridgeSync(60000);
  const [isReady, setIsReady] = useState(false);

  const BRANCHES = useMemo(
    () =>
      listBranches('').map((b, idx) => ({
        ...b,
        rating: 4.6 + ((idx % 4) * 0.1),
        image: FALLBACK_IMAGE,
      })),
    [syncSeed]
  );

  const PROMOTIONS = useMemo(() => {
    return listHomeOffers().slice(0, 12).map((offer, idx) => ({
      ...offer,
      discount: offer.discountLabel,
      time: offer.timeLabel,
      ...STYLE_POOL[idx % STYLE_POOL.length],
    }));
  }, [syncSeed]);

  // Block the page until the initial catalog sync completes.
  // Falls back to showing the page after 6 s in case of a slow/failed network.
  useEffect(() => {
    let cancelled = false;
    const fallback = window.setTimeout(() => {
      if (!cancelled) setIsReady(true);
    }, 6000);
    void syncAdminStateFromPortal().finally(() => {
      if (!cancelled) {
        setIsReady(true);
        window.clearTimeout(fallback);
      }
    });
    return () => {
      cancelled = true;
      window.clearTimeout(fallback);
    };
  }, []);

  // Fetch saved addresses once for logged-in users (used in mobile flow)
  useEffect(() => {
    if (!session?.accessToken) return;
    apiListAddresses(session.accessToken)
      .then((res) => setSavedAddresses(Array.isArray(res?.addresses) ? res.addresses : []))
      .catch(() => {
        setSavedAddresses([]);
      });
  }, [session?.accessToken]);

  useEffect(() => {
    if (mobileCardStep !== 'address') return;
    const handle = window.setTimeout(() => streetInputRef.current?.focus(), 220);
    return () => window.clearTimeout(handle);
  }, [mobileCardStep]);

  const handleBranchSelect = (branchId: string) => {
    const b = BRANCHES.find(x => x.id === branchId);
    if (b) {
      resetBooking();
      setServiceType('branch');
      setSelectedBranch({ id: b.id, name: b.name, location: b.location, rating: b.rating, image: b.image });
    }
    navigate(`/branch/${branchId}?serviceType=branch`);
  };

  const handleMobileCheckPin = async () => {
    const pin = sanitizePostcode(mobileLocation);
    if (pin.length < 4 || pin.length > 6) {
      setMobileError('Enter a 4–6 digit postcode or PIN.');
      return;
    }
    setMobileBusy(true);
    setMobileError('');
    setMobileAddressError('');
    try {
      const serviceability = await checkMobileServiceability(pin);
      if (!serviceability.serviceable) {
        setMobileError('This postcode is outside our current mobile service coverage.');
        return;
      }
      const snapshot = await fetchMobileSnapshot(serviceability.city_pin_code);
      const hub = snapshot.service_area.city_pin_code;
      const requested = snapshot.service_area.requested_pin_code;
      setMobileCityPinCode(hub);
      setMobileAcceptedPins(
        [...new Set([hub, requested, pin].map((s) => String(s ?? '').trim()).filter(Boolean))],
      );
      const verifiedPostcode = sanitizePostcode(pin);
      const previousPostcode = sanitizePostcode(mobileAddress.postcode);
      const keepExisting = previousPostcode === verifiedPostcode && mobileAddress.street_address.trim().length > 0;

      // Find saved addresses whose postcode matches the verified postcode
      const matching = savedAddresses.filter(
        (a) => sanitizePostcode(a.postcode) === verifiedPostcode,
      );

      if (keepExisting) {
        setMobileAddress((prev) => ({ ...prev, postcode: verifiedPostcode }));
        setSelectedSavedId(null);
      } else if (matching.length === 1) {
        // Exactly one match — auto-fill it
        const a = matching[0];
        setMobileAddress({ street_address: a.street_address, suburb: a.suburb, state: a.state, postcode: verifiedPostcode });
        setSelectedSavedId(a.id);
      } else if (matching.length > 1) {
        // Multiple matches — show selector, pre-select the default if present
        const def = matching.find((a) => a.is_default) ?? matching[0];
        setMobileAddress({ street_address: def.street_address, suburb: def.suburb, state: def.state, postcode: verifiedPostcode });
        setSelectedSavedId(def.id);
      } else {
        // No saved match — clear fields, let user type manually
        setMobileAddress({ street_address: '', suburb: '', state: '', postcode: verifiedPostcode });
        setSelectedSavedId(null);
      }
      setAddressTouched(false);
      setMobileCardStep('address');
    } catch {
      setMobileError('Could not verify this location. Please try again.');
    } finally {
      setMobileBusy(false);
    }
  };

  const handleMobileAddressContinue = () => {
    setAddressTouched(true);
    setMobileAddressError('');
    const validation = validateRequiredAddress(mobileAddress);
    if (validation.street_address || validation.suburb || validation.state || validation.postcode) {
      setMobileAddressError('Please complete all required address fields before continuing.');
      return;
    }
    const normalizedInputPostcode = sanitizePostcode(mobileAddress.postcode);
    const accepted = new Set(mobileAcceptedPins.map((p) => sanitizePostcode(p)).filter(Boolean));
    if (accepted.size > 0 && !accepted.has(normalizedInputPostcode)) {
      const hint = [...new Set(mobileAcceptedPins.map((p) => normalizePinDigits(p)).filter(Boolean))].join(' or ');
      setMobileAddressError(hint ? `Postcode must match ${hint}.` : 'Postcode must match the verified postcode.');
      return;
    }
    const structuredAddress = withFullAddress(mobileAddress);
    resetBooking();
    setMobileVisitAddress(structuredAddress);
    setServiceType('onsite');
    setSelectedBranch({
      id: `mobile-${mobileCityPinCode}`,
      name: 'Mobile Service',
      location: `Postcode ${mobileCityPinCode}`,
      rating: 0,
      image: '',
    });
    navigate(`/branch/mobile?serviceType=onsite&pin=${encodeURIComponent(mobileCityPinCode)}`);
  };

  const firstName = session?.fullName?.split(' ')[0];
  const addressErrors = addressTouched ? validateRequiredAddress(mobileAddress) : {};
  const canContinueToBooking = isAddressComplete(mobileAddress) && !!mobileCityPinCode;

  const verifiedPostcode = sanitizePostcode(mobileLocation);
  const mobilePinValid = verifiedPostcode.length >= 4 && verifiedPostcode.length <= 6;
  const matchingAddresses = useMemo(
    () => savedAddresses.filter((a) => sanitizePostcode(a.postcode) === verifiedPostcode),
    [savedAddresses, verifiedPostcode],
  );

  return (
    <div className="relative min-h-screen" style={{ background: '#eef3fa' }}>
      {/* Loading overlay — sits above blurred content */}
      {!isReady && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="flex flex-col items-center gap-4 rounded-2xl px-10 py-8"
            style={{
              background: 'rgba(255,255,255,0.72)',
              backdropFilter: 'blur(18px)',
              WebkitBackdropFilter: 'blur(18px)',
              boxShadow: '0 8px 40px rgba(12,29,58,0.13)',
            }}
          >
            <BrandLoading label="Loading availability…" />
          </div>
        </div>
      )}

    <div
      className={!isReady ? 'pointer-events-none select-none blur-sm brightness-90 transition-[filter] duration-300' : 'transition-[filter] duration-300'}
    >
    <div className="min-h-screen" style={{ background: '#eef3fa' }}>
      {/* gold accent bar */}
      <div className="h-0.5 w-full" style={{ background: `linear-gradient(90deg, ${GOLD} 0%, #e8c97a 50%, transparent 100%)` }} />

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">

        {/* ── Welcome ── */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className={homePageType.heroTitle} style={{ ...homeHeadingStyle, color: NAVY }}>
            {firstName ? `Welcome back, ${firstName}` : 'Welcome to Lumi Car Spa'}
          </h1>
          <p className={homePageType.heroSubtitle}>
            Your Hills shine specialist — book a service in under two minutes.
          </p>
        </motion.div>

        {/* ── Promo banner (only if offers exist) ── */}
        {PROMOTIONS.length > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.08 }}
            className="relative overflow-hidden rounded-2xl p-5"
            style={{
              background: `linear-gradient(135deg, ${NAVY} 0%, #1a3560 100%)`,
              boxShadow: `0 8px 32px rgba(12,29,58,0.2)`,
            }}
          >
            {/* decorative rings */}
            <div className="absolute top-0 right-0 w-40 h-40 rounded-full -translate-y-1/2 translate-x-1/2 opacity-10"
              style={{ border: '30px solid #c9a84c' }} />
            <div className="absolute bottom-0 left-0 w-28 h-28 rounded-full translate-y-1/2 -translate-x-1/2 opacity-10"
              style={{ border: '20px solid #c9a84c' }} />

            <div className="relative z-10 flex items-start gap-4">
              <motion.div
                animate={{ rotate: [0, 360] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                className="shrink-0 mt-0.5"
              >
                <Sparkles className="h-6 w-6" style={{ color: GOLD }} />
              </motion.div>
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className={homePageType.offerLabel}
                    style={{ background: 'rgba(201,168,76,0.25)', color: GOLD }}
                  >
                    Active Offers
                  </span>
                </div>
                <h3 className={`${homePageType.offerHeadline} text-white`} style={homeHeadingStyle}>
                  Save with time-based pricing
                </h3>
                <p className={homePageType.offerBody} style={{ color: 'rgba(255,255,255,0.7)' }}>
                  Book during off-peak hours and enjoy exclusive savings across all services.
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── Active Offer tiles — infinite marquee ── */}
        {PROMOTIONS.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 }}
          >
            <div className="flex items-center gap-2.5 mb-4">
              <Zap className="h-5 w-5 shrink-0" style={{ color: NAVY }} />
              <h3 className={homePageType.sectionTitle} style={{ ...homeHeadingStyle, color: NAVY }}>
                Current Offers
              </h3>
            </div>

            {/* Inject keyframes once */}
            <style>{`
              @keyframes marquee-scroll {
                0%   { transform: translateX(0); }
                100% { transform: translateX(-50%); }
              }
              .marquee-track {
                animation: marquee-scroll ${Math.max(12, PROMOTIONS.length * 4)}s linear infinite;
              }
              .marquee-track:hover {
                animation-play-state: paused;
              }
            `}</style>

            {/* Outer mask — hides overflow, fades edges */}
            <div
              className="relative overflow-hidden"
              style={{
                maskImage: 'linear-gradient(to right, transparent 0%, black 6%, black 94%, transparent 100%)',
                WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 6%, black 94%, transparent 100%)',
              }}
            >
              {/* Inner track — contains 2× the cards for seamless loop */}
              <div className="marquee-track flex gap-3" style={{ width: 'max-content' }}>
                {[...PROMOTIONS, ...PROMOTIONS].map((promo, index) => {
                  const Icon = promo.icon;
                  return (
                    <div
                      key={`${promo.id}-${index}`}
                      className={`${promo.bg} border ${promo.border} group relative cursor-pointer overflow-hidden rounded-xl p-4 shrink-0 w-[260px] transition-transform duration-200 hover:-translate-y-1 hover:scale-[1.01]`}
                    >
                      {/* hover gradient overlay */}
                      <div className={`absolute inset-0 bg-gradient-to-br ${promo.grad} opacity-0 transition-opacity duration-300 group-hover:opacity-[0.08]`} />

                      <div className="relative z-10">
                        {/* icon + discount badge */}
                        <div className="flex items-start justify-between mb-3">
                          <div className={`flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br ${promo.grad} shadow-sm`}>
                            <Icon className="h-4 w-4 text-white" />
                          </div>
                          <motion.span
                            animate={{ scale: [1, 1.04, 1] }}
                            transition={{ duration: 2.5, repeat: Infinity }}
                            className={`${homePageType.marqueeDiscount} bg-gradient-to-r ${promo.grad} bg-clip-text text-transparent`}
                          >
                            {promo.discount}
                          </motion.span>
                        </div>

                        {/* service scope badge */}
                        <div className="mb-2 flex items-center gap-1.5">
                          <span
                            className={homePageType.marqueeScope}
                            style={{ background: NAVY_TINT, color: NAVY }}
                          >
                            {promo.serviceType === 'branch' ? (
                              <><Building2 className="h-2.5 w-2.5" />Branch only</>
                            ) : promo.serviceType === 'mobile' ? (
                              <><Car className="h-2.5 w-2.5" />Mobile only</>
                            ) : (
                              <><Check className="h-2.5 w-2.5" />All services</>
                            )}
                          </span>
                        </div>

                        <h4 className={homePageType.marqueeTitle}>{promo.title}</h4>
                        <p className={homePageType.marqueeMeta}>
                          <Clock className="h-3.5 w-3.5 shrink-0" />{promo.time}
                        </p>
                        <p className={homePageType.marqueeMetaMuted}>
                          <MapPin className="h-3.5 w-3.5 shrink-0" />
                          {promo.branches[0] === 'All Branches' ? 'All locations' : promo.branches.join(', ')}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}

        {/* ── Book Your Wash ── */}
        <motion.section
          id="home-booking"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18 }}
          className="scroll-mt-24"
        >
          <div className="mb-5">
            <h3 className={`${homePageType.sectionTitle} mb-1`} style={{ ...homeHeadingStyle, color: NAVY }}>
              Book Your Wash
            </h3>
            <p className={homePageType.sectionSubtitle}>Choose how you'd like your car serviced today.</p>
          </div>

          {/* ── Same-height rectangles side by side (PIN step); mobile grows on address step ── */}
          <div
            className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${
              mobileCardStep === 'pin' ? 'items-stretch' : 'items-start'
            }`}
          >

            {/* ── Tile 1: Coonara Wash (branch) ── */}
            {BRANCHES.length === 0 ? (
              <div
                className={`${BOOKING_TILE} border-dashed p-6 items-center justify-center text-center`}
                style={{ borderColor: NAVY_TINT }}
              >
                <Building2 className="w-8 h-8 mb-3 opacity-30" style={{ color: NAVY }} />
                <p className={homePageType.emptyState}>No locations available at this time.</p>
              </div>
            ) : (
              BRANCHES.map((branch, index) => (
                <motion.button
                  key={branch.id}
                  type="button"
                  onClick={() => handleBranchSelect(branch.id)}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.06 }}
                  whileHover={{ y: -3 }}
                  className={`group ${BOOKING_TILE} h-full text-left transition-all duration-200 hover:shadow-xl`}
                  style={{
                    background: 'linear-gradient(160deg, #183f6e 0%, #112f58 55%, #0c2244 100%)',
                    borderColor: '#28508a',
                    boxShadow: '0 6px 22px rgba(12,29,58,0.18)',
                  }}
                >
                  <div className={BOOKING_TILE_BODY}>
                    <div className="flex items-center justify-between">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl"
                        style={{ background: 'rgba(201,168,76,0.2)' }}>
                        <Building2 className="h-5 w-5" style={{ color: GOLD }} />
                      </span>
                      <span className={`${homePageType.cardBadge} !px-2.5 !py-0.5 !text-xs`}
                        style={{ background: 'rgba(201,168,76,0.15)', color: GOLD }}>
                        In-Bay Wash
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      <p className={`${homePageType.cardTitle} !text-lg sm:!text-xl text-white`} style={homeHeadingStyle}>
                        {branch.name}
                      </p>
                      <p className={`flex items-start gap-1.5 ${homePageType.cardBody} !text-sm sm:!text-base leading-relaxed`} style={{ color: 'rgba(255,255,255,0.72)' }}>
                        <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                        <span className="line-clamp-2">{branch.location}</span>
                      </p>
                    </div>

                    <div
                      className="flex items-center gap-3 rounded-xl border px-3 py-2"
                      style={{ borderColor: 'rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)' }}
                    >
                      <span
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                        style={{ background: 'rgba(201,168,76,0.15)' }}
                      >
                        <Sparkles className="h-4 w-4" style={{ color: GOLD }} />
                      </span>
                      <div className="min-w-0">
                        <p className="text-base sm:text-lg font-medium leading-tight text-white">
                          Premium Hand Wash
                        </p>
                      </div>
                    </div>

                    <div className={BOOKING_LINE_GAP}>
                      {BRANCH_PERKS.map(perk => (
                        <div key={perk} className="flex items-start gap-2.5">
                          <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full"
                            style={{ background: 'rgba(201,168,76,0.2)' }}>
                            <Check className="h-2.5 w-2.5" style={{ color: GOLD }} />
                          </span>
                          <p className="text-sm leading-relaxed sm:text-[15px]" style={{ color: 'rgba(255,255,255,0.78)' }}>{perk}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* footer */}
                  <div className="flex shrink-0 items-center justify-between px-5 py-3"
                    style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                    <span className={`flex items-center gap-1.5 ${homePageType.cardFooter} !text-sm`} style={{ color: 'rgba(255,255,255,0.65)' }}>
                      <Clock className="h-3.5 w-3.5 shrink-0" />
                      {branch.openTime} – {branch.closeTime}
                    </span>
                    <span className={`flex items-center gap-1.5 ${homePageType.cardCta} transition-all group-hover:gap-2`}
                      style={{ color: GOLD }}>
                      Book now <ArrowRight className="w-4 h-4" />
                    </span>
                  </div>
                </motion.button>
              ))
            )}

            {/* ── Tile 2: Mobile Service (rectangle, matches branch tile) ── */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.06 }}
              className={`${BOOKING_TILE} ${mobileCardStep === 'pin' ? 'h-full' : ''}`}
              style={{ background: MOBILE_CARD_BG, borderColor: MOBILE_CARD_BORDER }}
            >
              <div
                className={
                  mobileCardStep === 'pin'
                    ? BOOKING_TILE_BODY
                    : 'flex flex-col px-5 py-5'
                }
              >
                {mobileCardStep === 'pin' ? (
                <>
                  <div className="flex items-start justify-between gap-2 shrink-0">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                      style={{ background: NAVY_TINT }}>
                      <Car className="h-5 w-5" style={{ color: NAVY }} />
                    </span>
                    <div className="flex min-w-0 flex-col items-end gap-1.5 text-right">
                      <span
                        className="whitespace-nowrap rounded-full px-4 py-1.5 text-[12px] font-extrabold uppercase tracking-wider sm:text-sm"
                        style={{
                          background: MOBILE_BADGE_BG,
                          color: '#ffffff',
                          boxShadow: '0 2px 10px rgba(47,174,151,0.3)',
                        }}
                      >
                        Coming Soon
                      </span>
                    </div>
                  </div>

                  <div className="shrink-0 space-y-1.5">
                    <p className={`${homePageType.cardTitle} !text-lg sm:!text-xl`} style={{ ...homeHeadingStyle, color: NAVY }}>
                      Mobile Service
                    </p>
                    <p className={`${homePageType.cardBody} !text-sm sm:!text-base leading-relaxed text-slate-600`}>
                      Enter your postcode to check mobile availability.
                    </p>
                  </div>

                  <div className="flex min-h-0 flex-1 flex-col justify-between gap-3">
                    <div className="space-y-2.5">
                      <div className="relative">
                        <MapPin className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2"
                          style={{ color: NAVY }} />
                        <input
                          type="text"
                          inputMode="numeric"
                          autoComplete="postal-code"
                          maxLength={6}
                          value={mobileLocation}
                          onChange={(e) => {
                            setMobileLocation(sanitizePostcode(e.target.value));
                            setMobileError('');
                          }}
                          onKeyDown={e => { if (e.key === 'Enter' && mobilePinValid) void handleMobileCheckPin(); }}
                          placeholder="e.g. 2125 or 721101"
                          aria-label="Postcode or service PIN (4–6 digits)"
                          className="h-11 w-full rounded-xl border pl-11 pr-4 text-sm leading-normal text-gray-900 outline-none transition-all focus:border-transparent focus:ring-2"
                          style={{
                            borderColor: 'rgba(12,29,58,0.32)',
                            background: '#ffffff',
                            boxShadow: 'inset 0 1px 0 rgba(12,29,58,0.04)',
                            ['--tw-ring-color' as any]: NAVY,
                          }}
                        />
                      </div>

                      {mobileError && (
                        <p className={homePageType.formError}>
                          <span aria-hidden>⚠</span>{mobileError}
                        </p>
                      )}

                      <button
                        type="button"
                        onClick={() => void handleMobileCheckPin()}
                        disabled={!mobilePinValid || mobileBusy}
                        className="flex h-11 w-full shrink-0 items-center justify-center gap-2 rounded-xl text-sm font-semibold leading-none transition-all disabled:cursor-not-allowed disabled:opacity-50"
                        style={{
                          background: mobilePinValid && !mobileBusy ? BTN_BG : '#e5e7eb',
                          color:      mobilePinValid && !mobileBusy ? BTN_TEXT : '#9ca3af',
                          boxShadow:  mobilePinValid && !mobileBusy ? '0 4px 14px rgba(201,168,76,0.35)' : 'none',
                        }}
                      >
                        {mobileBusy ? (
                          <>
                            <svg className="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                            </svg>
                            Checking…
                          </>
                        ) : (
                          <>Check availability <ArrowRight className="h-4 w-4" /></>
                        )}
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2 border-t border-gray-100 pt-3">
                      {MOBILE_PIN_HIGHLIGHTS.map(({ icon: Icon, text }) => (
                        <div key={text} className="flex min-w-0 flex-col items-center gap-1.5 text-center">
                          <span
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                            style={{ background: NAVY_TINT }}
                          >
                            <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: NAVY }} />
                          </span>
                          <p className="min-w-0 text-xs font-semibold leading-relaxed sm:text-sm" style={{ color: NAVY }}>
                            {text}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
                ) : (
                <>
                <div className="mb-4 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                      style={{ background: NAVY_TINT }}>
                      <Car className="h-5 w-5" style={{ color: NAVY }} />
                    </span>
                    <div className="flex min-w-0 flex-col items-end gap-1.5 text-right">
                      <span
                        className="whitespace-nowrap rounded-full px-4 py-1.5 text-[12px] font-extrabold uppercase tracking-wider sm:text-sm"
                        style={{
                          background: MOBILE_BADGE_BG,
                          color: '#ffffff',
                          boxShadow: '0 2px 10px rgba(47,174,151,0.3)',
                        }}
                      >
                        Coming Soon
                      </span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className={`${homePageType.cardTitle} !text-lg sm:!text-xl`} style={{ ...homeHeadingStyle, color: NAVY }}>
                      Mobile Service
                    </p>
                    <p className={`${homePageType.cardBody} !text-sm sm:!text-base leading-relaxed text-slate-600`}>
                      Enter the full service address (same postcode).
                    </p>
                  </div>
                </div>

                <div
                  className="flex max-h-[min(52vh,22rem)] flex-col gap-2.5 overflow-y-auto overscroll-contain pr-0.5"
                >
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2, ease: 'easeOut' }}
                      className="space-y-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className={homePageType.formHint}>
                          Postcode checked:{' '}
                          <span className="font-semibold tabular-nums" style={{ color: NAVY }}>
                            {normalizePinDigits(mobileLocation) || mobileLocation}
                          </span>
                        </p>
                        <button
                          type="button"
                          className={homePageType.textLink}
                          style={{ color: NAVY }}
                          onClick={() => {
                            setMobileCardStep('pin');
                            setMobileAddressError('');
                          }}
                        >
                          Change postcode
                        </button>
                      </div>

                      {/* ── Saved address selector ── */}
                      {matchingAddresses.length > 0 && (
                        <div className="rounded-xl border p-3 space-y-2" style={{ borderColor: 'rgba(12,29,58,0.12)', background: NAVY_TINT }}>
                          <p className={homePageType.savedSectionLabel} style={{ color: NAVY }}>
                            Saved Addresses
                          </p>
                          {matchingAddresses.map((addr) => (
                            <button
                              key={addr.id}
                              type="button"
                              onClick={() => {
                                setSelectedSavedId(addr.id);
                                setMobileAddress({
                                  street_address: addr.street_address,
                                  suburb: addr.suburb,
                                  state: addr.state,
                                  postcode: sanitizePostcode(addr.postcode || mobileLocation),
                                });
                                setMobileAddressError('');
                                setAddressTouched(false);
                              }}
                              className="w-full text-left flex items-start gap-2.5 px-3 py-2.5 rounded-lg border-2 transition-all"
                              style={{
                                background: selectedSavedId === addr.id ? '#fff' : 'rgba(255,255,255,0.5)',
                                borderColor: selectedSavedId === addr.id ? NAVY : 'rgba(12,29,58,0.15)',
                              }}
                            >
                              <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-all"
                                style={{ borderColor: selectedSavedId === addr.id ? NAVY : '#cbd5e1' }}>
                                {selectedSavedId === addr.id && (
                                  <span className="h-2 w-2 rounded-full" style={{ background: NAVY }} />
                                )}
                              </span>
                              <div className="min-w-0">
                                <p className={homePageType.savedAddrTitle} style={{ color: NAVY }}>{addr.label}</p>
                                <p className={`${homePageType.savedAddrLine} truncate`}>
                                  {[addr.street_address, addr.suburb, [addr.state, addr.postcode].filter(Boolean).join(' ')].filter(Boolean).join(', ')}
                                </p>
                              </div>
                            </button>
                          ))}
                          {selectedSavedId && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedSavedId(null);
                                setMobileAddress({ street_address: '', suburb: '', state: '', postcode: sanitizePostcode(mobileLocation) });
                                setAddressTouched(false);
                                setMobileAddressError('');
                                setTimeout(() => streetInputRef.current?.focus(), 80);
                              }}
                              className={`${homePageType.textLink} font-medium`}
                              style={{ color: NAVY }}
                            >
                              Enter a different address
                            </button>
                          )}
                        </div>
                      )}

                      {/* ── Manual fields — always shown, pre-filled when saved address selected ── */}
                      <AddressDetailsFields
                        value={mobileAddress}
                        onChange={(next) => {
                          setMobileAddress(next);
                          setMobileAddressError('');
                          // If user edits away from the saved address, deselect it
                          if (selectedSavedId) setSelectedSavedId(null);
                        }}
                        postcodeLocked
                        required
                        size="lg"
                        errors={addressErrors}
                        focusStyle={{ ['--tw-ring-color' as any]: NAVY }}
                        streetInputRef={streetInputRef}
                      />
                    </motion.div>

                  {mobileAddressError && (
                    <p className={homePageType.formError}>
                      <span aria-hidden>⚠</span>{mobileAddressError}
                    </p>
                  )}

                  <button
                    type="button"
                    onClick={handleMobileAddressContinue}
                    disabled={!canContinueToBooking}
                    className="flex h-12 w-full shrink-0 items-center justify-center gap-2 rounded-xl text-sm font-semibold leading-none transition-all disabled:cursor-not-allowed disabled:opacity-50"
                    style={{
                      background: canContinueToBooking ? BTN_BG : '#e5e7eb',
                      color:      canContinueToBooking ? BTN_TEXT : '#9ca3af',
                      boxShadow:  canContinueToBooking ? '0 4px 14px rgba(201,168,76,0.35)' : 'none',
                    }}
                  >
                    Continue to booking <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
                </>
                )}
              </div>

              {/* footer — mirrors branch tile footer height */}
              <div className="flex shrink-0 items-center justify-between px-5 py-3"
                style={{ borderTop: '1px solid rgba(12,29,58,0.06)' }}>
                <span className={`${homePageType.cardFooter} !text-xs text-gray-400`}>
                  {mobileCardStep === 'pin' ? 'Mobile service · Postcode check' : 'Mobile service · Service address'}
                </span>
                <span className="w-2 h-2 rounded-full" style={{ background: GOLD }} />
              </div>
            </motion.div>

          </div>
        </motion.section>
      </div>
    </div>
    </div>
    </div>
  );
}
