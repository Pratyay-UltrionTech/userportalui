import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  CheckCircle,
  Calendar,
  Clock,
  MapPin,
  Car,
  Download,
  Share2,
  Coffee,
  Receipt,
  Sparkles,
  Award,
  ArrowLeft,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useBooking } from '../context/BookingContext';
import { useAdminBridgeSync } from '../hooks/useAdminBridgeSync';
import {
  fetchPublicBookingById,
  getFreeCoffeeCupsForLineItem,
  type PublicBookingRow,
} from '../lib/adminPortalBridge';
import {
  fetchMobileBookingById,
  getCachedMobileSnapshot,
  getMobileFreeCoffeeCupsForLineItem,
  type MobileBookingRow,
} from '../lib/mobilePublicBridge';
import { useAuth } from '../context/AuthContext';
import { apiCustomerLoyaltyOverview, type CustomerLoyaltyOverviewResponse } from '../lib/userApi';
import { HEADING_FONT_FAMILY } from '../lib/branding';
import { cn } from '../components/ui/utils';
import {
  BOOKING_NAVY as NAVY,
  BOOKING_NAVY_TINT as NAVY_TINT,
  BOOKING_GOLD as GOLD,
  BOOKING_BTN_BG as BTN_BG,
  BOOKING_BTN_TEXT as BTN_TEXT,
  BookingConfirmationBlock,
  BookingConfirmationCard,
  BookingFlowSection,
  BOOKING_SUMMARY_BODY_CLASS,
  BOOKING_PRICE_BODY_CLASS,
  formatShortBookingId,
  getPaymentMethodLabel,
} from '../components/bookingFlowSection';

export function SuccessPage() {
  const navigate = useNavigate();
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
    mobileVisitAddress,
    confirmedBooking,
  } = useBooking();
  const syncSeed = useAdminBridgeSync(30000);
  const { hasCustomerSession, session } = useAuth();
  const branchIdForPoll = confirmedBooking?.branchId ?? selectedBranch?.id ?? '';
  const isMobileBooking = !confirmedBooking?.branchId && Boolean(selectedBranch?.id?.startsWith('mobile-'));
  const [liveBooking, setLiveBooking] = useState<PublicBookingRow | null>(null);
  const [liveMobileBooking, setLiveMobileBooking] = useState<MobileBookingRow | null>(null);
  const [loyaltyOverview, setLoyaltyOverview] = useState<CustomerLoyaltyOverviewResponse | null>(null);

  useEffect(() => {
    if (isMobileBooking) return;
    const bid = confirmedBooking?.id;
    if (!branchIdForPoll || !bid || bid === '—') return;
    let cancelled = false;
    const tick = async () => {
      const row = await fetchPublicBookingById(branchIdForPoll, bid);
      if (!cancelled && row) setLiveBooking(row);
    };
    void tick();
    const t = window.setInterval(() => void tick(), 8000);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, [branchIdForPoll, confirmedBooking?.id, isMobileBooking]);

  useEffect(() => {
    if (!isMobileBooking) return;
    const bid = confirmedBooking?.id;
    if (!bid || bid === '—') return;
    let cancelled = false;
    const tick = async () => {
      const row = await fetchMobileBookingById(bid);
      if (!cancelled && row) setLiveMobileBooking(row);
    };
    void tick();
    const t = window.setInterval(() => void tick(), 8000);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, [confirmedBooking?.id, isMobileBooking]);

  useEffect(() => {
    if (!hasCustomerSession || !session?.accessToken) return;
    let cancelled = false;
    void (async () => {
      try {
        const o = await apiCustomerLoyaltyOverview(session.accessToken);
        if (!cancelled) setLoyaltyOverview(o);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hasCustomerSession, session?.accessToken]);

  const freeCoffeeCount = useMemo(() => {
    if (typeof confirmedBooking?.freeCoffeeCount === 'number') {
      return Math.max(0, Math.floor(confirmedBooking.freeCoffeeCount));
    }
    if (!selectedBranch?.id || !vehicleType || !selectedService?.id) return 0;
    if (selectedBranch.id.startsWith('mobile-')) {
      return getMobileFreeCoffeeCupsForLineItem(getCachedMobileSnapshot(), vehicleType, selectedService.id);
    }
    return getFreeCoffeeCupsForLineItem(selectedBranch.id, vehicleType, selectedService.id);
  }, [
    confirmedBooking?.freeCoffeeCount,
    selectedBranch?.id,
    vehicleType,
    selectedService?.id,
    syncSeed,
  ]);

  const displayStatus = liveMobileBooking?.status ?? liveBooking?.status ?? confirmedBooking?.status ?? 'scheduled';
  const displayTipCents =
    typeof liveMobileBooking?.tip_cents === 'number'
      ? liveMobileBooking.tip_cents
      : typeof liveBooking?.tip_cents === 'number'
        ? liveBooking.tip_cents
        : typeof confirmedBooking?.tipCents === 'number'
          ? confirmedBooking.tipCents
          : 0;
  const tipDollars = displayTipCents / 100;
  const servicesTotalIncGst = confirmedBooking?.total ?? 0;
  const receiptServiceIncGst = selectedService?.price ?? 0;
  const receiptAddonsIncGst = selectedAddOns.reduce((sum, a) => sum + a.price, 0);
  const receiptDiscounts = confirmedBooking?.discounts ?? 0;
  const grandTotal = servicesTotalIncGst + tipDollars;
  const serviceTypeLabel = serviceType === 'onsite' ? 'Mobile Service' : 'At Branch';
  const paymentMethodLabel = getPaymentMethodLabel(confirmedBooking?.paymentMethod);

  const mobileServiceAddress = useMemo(() => {
    const fromVisit = mobileVisitAddress?.full_address?.trim();
    if (fromVisit) return fromVisit;
    const fromBooking = liveMobileBooking?.address?.trim();
    if (fromBooking) return fromBooking;
    return '';
  }, [mobileVisitAddress?.full_address, liveMobileBooking?.address]);

  const booking = {
    id: confirmedBooking?.id ?? '—',
    branch: {
      name: selectedBranch?.name ?? '—',
      location: selectedBranch?.location ?? '—',
      phone: '—',
    },
    serviceName: selectedService?.name ?? '—',
    vehicle: vehicleType ?? '—',
    vehicleModel: vehicleModel ?? '',
    registrationNumber: registrationNumber?.trim().toUpperCase() ?? '',
    date: selectedDate
      ? selectedDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
      : '—',
    time: selectedTime ? `${selectedTime}${selectedEndTime ? ` - ${selectedEndTime}` : ''}` : '—',
    servicesTotalIncGst,
    tipDollars,
    grandTotal,
    freeCoffeeCount,
    loyaltyPointsAdded: confirmedBooking?.loyaltyPointsAdded ?? 0,
  };

  // Resolve customer_id from live poll first, then from the booking response captured at confirm time
  const resolvedCustomerId =
    liveBooking?.customer_id ??
    liveMobileBooking?.customer_id ??
    confirmedBooking?.customerId ??
    null;

  // For guest bookings (no customer_id), use the booking's phone number to derive the suffix
  const resolvedGuestPhone = resolvedCustomerId
    ? null
    : (liveBooking?.phone ?? liveMobileBooking?.phone ?? null);

  const shortBookingRef = useMemo(
    () => formatShortBookingId(confirmedBooking?.id ?? '—', resolvedCustomerId, resolvedGuestPhone),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [confirmedBooking?.id, resolvedCustomerId, resolvedGuestPhone],
  );

  const [actionMessage, setActionMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!actionMessage) return;
    const t = window.setTimeout(() => setActionMessage(null), 4000);
    return () => window.clearTimeout(t);
  }, [actionMessage]);

  const receiptPlainText = useMemo(() => {
    const lines = [
      'BOOKING RECEIPT',
      '================',
      `Reference: ${shortBookingRef}`,
      '',
      'LOCATION',
      ...(serviceType === 'onsite' || isMobileBooking
        ? mobileServiceAddress
          ? [`  ${mobileServiceAddress}`]
          : []
        : [
            `  ${booking.branch.name}`,
            `  ${booking.branch.location}`,
            `  ${booking.branch.phone}`,
          ]),
      '',
      'SERVICE',
      `  ${booking.serviceName}`,
      ...(selectedAddOns.length
        ? ['  Add-ons:', ...selectedAddOns.map((a) => `    • ${a.name}`)]
        : []),
      `  Vehicle: ${booking.vehicle}${booking.vehicleModel ? ` (${booking.vehicleModel})` : ''}`,
      ...(booking.registrationNumber ? [`  Registration number: ${booking.registrationNumber}`] : []),
      '',
      'DATE & TIME',
      `  ${booking.date}`,
      `  ${booking.time}`,
      '',
      'PAYMENT',
      `  Payment method: ${paymentMethodLabel}`,
      `  Service (inc GST): $${receiptServiceIncGst.toFixed(2)}`,
      `  Add-ons (inc GST): $${receiptAddonsIncGst.toFixed(2)}`,
    ];
    if (receiptDiscounts > 0) {
      lines.push(`  Discounts: -$${receiptDiscounts.toFixed(2)}`);
    }
    lines.push(
      `  Tip: $${booking.tipDollars.toFixed(2)}`,
      `  Services total (inc GST): $${booking.servicesTotalIncGst.toFixed(2)}`,
      `  Total (inc GST): $${booking.grandTotal.toFixed(2)}`,
      '',
      'Service and add-on prices include GST.',
    );
    if (booking.freeCoffeeCount > 0) {
      lines.push(
        '',
        'COMPLIMENTARY COFFEE',
        `  ${booking.freeCoffeeCount} cup(s) — show this receipt at the lounge.`,
      );
    }
    lines.push('', 'Thank you for your booking.');
    return lines.join('\n');
  }, [
    booking.branch.location,
    booking.branch.name,
    booking.branch.phone,
    booking.date,
    booking.freeCoffeeCount,
    booking.grandTotal,
    booking.id,
    booking.serviceName,
    shortBookingRef,
    booking.time,
    booking.tipDollars,
    booking.servicesTotalIncGst,
    booking.vehicle,
    booking.vehicleModel,
    booking.registrationNumber,
    selectedAddOns,
    receiptAddonsIncGst,
    receiptDiscounts,
    receiptServiceIncGst,
    paymentMethodLabel,
    serviceType,
    isMobileBooking,
    mobileServiceAddress,
  ]);

  const handleDownloadReceipt = () => {
    const safeName = String(booking.id).replace(/[^\w.-]+/g, '_') || 'booking';
    const blob = new Blob([receiptPlainText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `carwash-receipt-${safeName}.txt`;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setActionMessage('Receipt saved to your device.');
  };

  const handleShareBooking = async () => {
    const shareText = [
      'Car wash booking confirmed',
      `Reference: ${shortBookingRef}`,
      `${booking.branch.name} — ${booking.branch.location}`,
      `${booking.date} · ${booking.time}`,
      `Total: $${booking.grandTotal.toFixed(2)}`,
    ].join('\n');

    const shareData: ShareData = {
      title: 'Booking confirmed',
      text: shareText,
      url: typeof window !== 'undefined' ? window.location.href : '',
    };

    try {
      if (typeof navigator.share === 'function') {
        const can = typeof navigator.canShare === 'function' ? navigator.canShare(shareData) : true;
        if (can) {
          await navigator.share(shareData);
          setActionMessage('Shared successfully.');
          return;
        }
      }
    } catch (err: unknown) {
      const name = err && typeof err === 'object' && 'name' in err ? String((err as { name?: string }).name) : '';
      if (name === 'AbortError') return;
    }

    try {
      await navigator.clipboard.writeText(shareText);
      setActionMessage('Booking details copied to clipboard.');
    } catch {
      setActionMessage('Unable to share or copy. Try downloading the receipt instead.');
    }
  };

  const goHome = () => {
    navigate('/home');
  };

  /**
   * Browser Back from confirmation should not return into payment/checkout.
   * Capture phase runs before React Router applies the pop so we can replace with /home.
   */
  useEffect(() => {
    const onPopState = () => {
      navigate('/home', { replace: true });
    };
    window.addEventListener('popstate', onPopState, true);
    return () => window.removeEventListener('popstate', onPopState, true);
  }, [navigate]);

  return (
    <div className="min-h-screen" style={{ background: '#eef3fa' }}>
      <div
        className="h-0.5 w-full"
        style={{ background: `linear-gradient(90deg, ${GOLD} 0%, #e8c97a 50%, transparent 100%)` }}
      />

      <header className="sticky top-0 z-40 border-b border-gray-100 bg-white/95 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto flex items-center gap-3 px-4 py-4">
          <button
            type="button"
            onClick={() => navigate('/home')}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-600 transition hover:border-gray-300 hover:bg-gray-50"
            aria-label="Back to home"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1
              className="text-xl font-bold text-gray-900"
              style={{ fontFamily: HEADING_FONT_FAMILY, color: NAVY }}
            >
              Booking confirmed
            </h1>
            <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
              You&apos;re all set — see your receipt below
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 pb-32">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
          <div className="text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
              className="mb-4 flex justify-center"
            >
              <div
                className="flex h-20 w-20 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50"
                aria-hidden
              >
                <CheckCircle className="h-12 w-12 text-emerald-600" />
              </div>
            </motion.div>
            <p className="text-sm text-gray-600">Your car wash has been successfully booked</p>
          </div>

          <BookingConfirmationCard>
            <BookingConfirmationBlock title="Booking reference">
              <p className={cn(BOOKING_SUMMARY_BODY_CLASS, 'tabular-nums')}>{shortBookingRef}</p>
            </BookingConfirmationBlock>

            <BookingConfirmationBlock title="Location" badge={serviceTypeLabel}>
              {serviceType === 'onsite' || isMobileBooking ? (
                mobileServiceAddress ? (
                  <p className={BOOKING_SUMMARY_BODY_CLASS}>{mobileServiceAddress}</p>
                ) : null
              ) : (
                <div className="space-y-1">
                  <p className={BOOKING_SUMMARY_BODY_CLASS}>{booking.branch.name}</p>
                  <p className={BOOKING_SUMMARY_BODY_CLASS}>{booking.branch.location}</p>
                </div>
              )}
            </BookingConfirmationBlock>

            <BookingConfirmationBlock title="Service details">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 space-y-1">
                <p className={BOOKING_SUMMARY_BODY_CLASS}>{booking.serviceName}</p>
                <p className={BOOKING_SUMMARY_BODY_CLASS}>
                  {booking.vehicle}
                  {booking.vehicleModel ? ` (${booking.vehicleModel})` : ''}
                </p>
                {booking.registrationNumber ? (
                  <p className={BOOKING_SUMMARY_BODY_CLASS}>{booking.registrationNumber}</p>
                ) : null}
              </div>
              <p className={cn(BOOKING_SUMMARY_BODY_CLASS, 'shrink-0 tabular-nums')}>
                ${Number(receiptServiceIncGst).toFixed(2)}
              </p>
            </div>
            {selectedAddOns.length > 0 ? (
              <div className="mt-5 space-y-2 border-t border-gray-100 pt-4">
                {selectedAddOns.map((addon) => (
                  <div key={addon.id} className="flex items-center justify-between gap-3">
                    <p className={BOOKING_SUMMARY_BODY_CLASS}>{addon.name}</p>
                    <p className={cn(BOOKING_SUMMARY_BODY_CLASS, 'shrink-0 tabular-nums')}>
                      ${Number(addon.price).toFixed(2)}
                    </p>
                  </div>
                ))}
              </div>
            ) : null}
            </BookingConfirmationBlock>

            <BookingConfirmationBlock title="Date & time">
              <p className={BOOKING_SUMMARY_BODY_CLASS}>{booking.date}</p>
              <p className={cn(BOOKING_SUMMARY_BODY_CLASS, 'tabular-nums')}>{booking.time}</p>
            </BookingConfirmationBlock>

            {hasCustomerSession && booking.freeCoffeeCount > 0 ? (
              <BookingConfirmationBlock title="Complimentary coffee">
                <p className="text-base font-semibold tabular-nums text-amber-950">
                  {booking.freeCoffeeCount} {booking.freeCoffeeCount === 1 ? 'cup' : 'cups'} on us
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-amber-900/90">
                  Show this receipt at the lounge to redeem.
                </p>
              </BookingConfirmationBlock>
            ) : null}

            {hasCustomerSession ? (
            <BookingConfirmationBlock title="Loyalty progress">
              {loyaltyOverview?.primary ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between" style={{ color: NAVY }}>
                    <span className="text-sm font-semibold">{loyaltyOverview.primary.branch_name}</span>
                    <span
                      className="rounded-full border px-2.5 py-0.5 text-sm font-bold shadow-sm"
                      style={{ background: NAVY_TINT, color: NAVY, borderColor: 'rgba(12,29,58,0.12)' }}
                    >
                      {loyaltyOverview.primary.eligible_services_in_window} of{' '}
                      {loyaltyOverview.primary.qualifying_service_count}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {(() => {
                      const n = Math.max(1, loyaltyOverview.primary.qualifying_service_count);
                      const cap = Math.min(12, n);
                      const filledBars = Math.min(
                        cap,
                        Math.floor((loyaltyOverview.primary.eligible_services_in_window / n) * cap),
                      );
                      return Array.from({ length: cap }).map((_, index) => {
                        const isCompleted = index < filledBars;
                        return (
                          <div
                            key={index}
                            className={cn(
                              'h-2 flex-1 rounded-full transition-all duration-300',
                              !isCompleted && 'bg-gray-200/80',
                            )}
                            style={
                              isCompleted
                                ? { background: `linear-gradient(90deg, ${GOLD}, ${NAVY})` }
                                : undefined
                            }
                          />
                        );
                      });
                    })()}
                  </div>
                  <p className="text-xs leading-relaxed text-gray-600">
                    This reward will be added once your service is completed.
                  </p>
                </div>
              ) : (
                <div>
                  <p className="mb-1 flex items-center gap-1.5 text-sm font-semibold" style={{ color: NAVY }}>
                    <Award className="h-4 w-4 shrink-0" />
                    +{Math.max(0, booking.loyaltyPointsAdded)} point
                    {Math.max(0, booking.loyaltyPointsAdded) === 1 ? '' : 's'} awaiting completion
                  </p>
                  <p className="text-xs leading-relaxed text-gray-600">
                    This reward will be added once your service is completed.
                  </p>
                </div>
              )}
            </BookingConfirmationBlock>
            ) : null}
          </BookingConfirmationCard>

          <BookingFlowSection icon={Receipt} title="Payment summary">
            <div className={cn('-mt-1 space-y-3', BOOKING_PRICE_BODY_CLASS)}>
              <div className="flex items-center justify-between">
                <span className={BOOKING_SUMMARY_BODY_CLASS}>Payment method</span>
                <span className={cn(BOOKING_SUMMARY_BODY_CLASS, 'shrink-0')}>{paymentMethodLabel}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className={BOOKING_SUMMARY_BODY_CLASS}>Service price (inc GST)</span>
                <span className={cn(BOOKING_SUMMARY_BODY_CLASS, 'shrink-0 tabular-nums')}>
                  ${receiptServiceIncGst.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className={BOOKING_SUMMARY_BODY_CLASS}>Add-ons (inc GST)</span>
                <span className={cn(BOOKING_SUMMARY_BODY_CLASS, 'shrink-0 tabular-nums')}>
                  ${receiptAddonsIncGst.toFixed(2)}
                </span>
              </div>
              {receiptDiscounts > 0 ? (
                <div className="flex items-center justify-between text-emerald-700">
                  <span className={BOOKING_SUMMARY_BODY_CLASS}>Discounts</span>
                  <span className={cn(BOOKING_SUMMARY_BODY_CLASS, 'shrink-0 tabular-nums')}>
                    -${receiptDiscounts.toFixed(2)}
                  </span>
                </div>
              ) : null}
              <div className="flex items-center justify-between">
                <span className={BOOKING_SUMMARY_BODY_CLASS}>Tip</span>
                <span className={cn(BOOKING_SUMMARY_BODY_CLASS, 'shrink-0 tabular-nums')}>
                  ${booking.tipDollars.toFixed(2)}
                </span>
              </div>
              <div className="flex items-end justify-between gap-4 border-t border-gray-100 pt-4">
                <p className={BOOKING_SUMMARY_BODY_CLASS}>Total due</p>
                <p className="text-3xl font-bold tabular-nums" style={{ color: NAVY }}>
                  ${booking.grandTotal.toFixed(2)}
                </p>
              </div>
              <p className="text-right text-xs text-gray-500">Service and add-on prices include GST.</p>
            </div>
          </BookingFlowSection>

          <div
            className="rounded-xl border px-4 py-4"
            style={{ background: NAVY_TINT, borderColor: 'rgba(12,29,58,0.12)' }}
          >
            <p className="text-center text-sm leading-relaxed text-gray-700">
              <span className="font-semibold" style={{ color: NAVY }}>
                Confirmation sent:
              </span>{' '}
              We&apos;ve sent booking details to your email and phone number.
            </p>
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={handleDownloadReceipt}
                className="flex items-center justify-center gap-2 rounded-xl border-2 border-gray-200 bg-white py-3 text-sm font-semibold text-gray-700 transition hover:border-gray-300 hover:bg-gray-50"
              >
                <Download className="h-5 w-5" />
                Receipt
              </button>
              <button
                type="button"
                onClick={() => void handleShareBooking()}
                className="flex items-center justify-center gap-2 rounded-xl border-2 border-gray-200 bg-white py-3 text-sm font-semibold text-gray-700 transition hover:border-gray-300 hover:bg-gray-50"
              >
                <Share2 className="h-5 w-5" />
                Share
              </button>
            </div>
            {actionMessage ? (
              <p className="text-center text-sm font-medium text-emerald-700" role="status">
                {actionMessage}
              </p>
            ) : null}
          </div>
        </motion.div>
      </main>

      <footer className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-100 bg-white/95 p-4 backdrop-blur-sm sm:p-6">
        <div className="mx-auto max-w-4xl">
          <button
            type="button"
            onClick={goHome}
            className="w-full rounded-xl py-4 text-sm font-semibold transition-all"
            style={{
              background: BTN_BG,
              color: BTN_TEXT,
              boxShadow: '0 4px 14px rgba(201,168,76,0.4)',
            }}
          >
            Book another service
          </button>
        </div>
      </footer>
    </div>
  );
}
