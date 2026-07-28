import { useMemo } from 'react';
import { useNavigate } from 'react-router';
import { MapPin, Calendar, Clock, Car, Edit2, Coffee, Award, Receipt } from 'lucide-react';
import { motion } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { useBooking } from '../context/BookingContext';
import { apiCustomerRescheduleBooking } from '../lib/userApi';
import { BookingDisclaimerNotes } from '../components/BookingDisclaimerNotes';
import { listApplicableDiscounts } from '../lib/adminPortalBridge';
import { getCachedMobileSnapshot, listApplicableMobileDiscounts } from '../lib/mobilePublicBridge';
import { useAdminBridgeSync } from '../hooks/useAdminBridgeSync';
import { cn } from '../components/ui/utils';
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
} from '../components/bookingFlowSection';

function sectionEditButton(onClick: () => void, label = 'Edit') {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-gray-600 transition hover:border-gray-300 hover:bg-gray-50'
      )}
      style={{ color: NAVY }}
    >
      <Edit2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
      {label}
    </button>
  );
}

export function BookingSummary() {
  const navigate = useNavigate();
  const {
    selectedBranch,
    serviceType,
    vehicleType,
    selectedService,
    selectedAddOns,
    selectedDate,
    selectedTime,
    selectedEndTime,
    vehicleModel,
    registrationNumber,
    mobileVisitAddress,
    reschedulingBookingId,
    setConfirmedBooking,
  } = useBooking();
  const { session, hasCustomerSession } = useAuth();
  const syncSeed = useAdminBridgeSync(30000);
  const mobileSnapshot = getCachedMobileSnapshot();

  const toISO = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const dateISO = selectedDate ? toISO(selectedDate) : '';

  const booking = {
    branch: {
      name: selectedBranch?.name ?? '—',
      location: selectedBranch?.location ?? '—',
    },
    serviceType: serviceType === 'onsite' ? 'Mobile Service' : 'At Branch',
    vehicleType: vehicleType ?? '—',
    vehicleModel: vehicleModel ?? '',
    vehicle: vehicleType ?? '—',
    service: {
      name: selectedService?.name ?? '—',
      price: selectedService?.price ?? 0,
    },
    addOns: selectedAddOns,
    date: selectedDate
      ? selectedDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
      : '—',
    time: selectedTime ? `${selectedTime}${selectedEndTime ? ` - ${selectedEndTime}` : ''}` : '—',
  };

  const subtotal = booking.service.price + booking.addOns.reduce((sum, addon) => sum + addon.price, 0);
  const addonsTotal = booking.addOns.reduce((sum, addon) => sum + addon.price, 0);
  const total = subtotal;

  const isRescheduling = !!reschedulingBookingId;

  const rescheduleScheduleDiscount = useMemo(() => {
    if (!isRescheduling || !selectedBranch || !selectedService || !selectedTime || !vehicleType || !dateISO) {
      return 0;
    }
    const offers =
      serviceType === 'onsite'
        ? mobileSnapshot
          ? listApplicableMobileDiscounts(
              mobileSnapshot,
              dateISO,
              selectedTime,
              selectedService.id,
              vehicleType
            )
          : []
        : listApplicableDiscounts(selectedBranch.id, dateISO, selectedTime, selectedService.id, vehicleType);
    return offers.reduce((sum, o) => {
      const discount =
        o.discountType === 'percentage' ? (subtotal * o.discountValue) / 100 : o.discountValue;
      return sum + discount;
    }, 0);
  }, [
    isRescheduling,
    subtotal,
    selectedBranch,
    selectedService,
    selectedTime,
    vehicleType,
    dateISO,
    serviceType,
    mobileSnapshot,
    syncSeed,
  ]);

  const handleConfirm = async () => {
    if (isRescheduling) {
      if (!session?.accessToken || !reschedulingBookingId || !selectedDate || !selectedTime) return;
      try {
        await apiCustomerRescheduleBooking(session.accessToken, reschedulingBookingId, {
          slot_date: dateISO,
          start_time: selectedTime,
          end_time: selectedEndTime ?? '',
        });

        setConfirmedBooking({
          id: reschedulingBookingId,
          status: 'scheduled',
          subtotal,
          tax: 0,
          discounts: rescheduleScheduleDiscount,
          total: Math.max(0, subtotal - rescheduleScheduleDiscount),
          createdAt: new Date().toISOString(),
          branchId: selectedBranch?.id,
          loyaltyPointsAdded: selectedService?.eligibleForLoyaltyPoints ? 1 : 0,
        });

        navigate('/success', { replace: true });
      } catch (e) {
        alert(e instanceof Error ? e.message : 'Reschedule failed');
      }
    } else {
      navigate('/payment');
    }
  };

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
              Booking summary
            </h1>
            <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
              Review your visit before payment
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 pb-32">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
          {/* Branch bookings have a fixed location; only mobile (onsite) allows re-selection */}
          <BookingFlowSection
            icon={MapPin}
            title="Location"
            badge={booking.serviceType}
            headerTrailing={serviceType === 'onsite' ? sectionEditButton(() => navigate('/home')) : undefined}
          >
            {serviceType !== 'onsite' ? (
              <>
                <p className={BOOKING_SUMMARY_BODY_CLASS}>{booking.branch.name}</p>
                <p className={cn(BOOKING_SUMMARY_BODY_CLASS, 'mt-1')}>{booking.branch.location}</p>
              </>
            ) : mobileVisitAddress?.full_address?.trim() ? (
              <p className={BOOKING_SUMMARY_BODY_CLASS}>{mobileVisitAddress.full_address}</p>
            ) : null}
          </BookingFlowSection>

          <BookingFlowSection
            icon={Car}
            title="Service details"
            headerTrailing={sectionEditButton(() => navigate(-3))}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 space-y-1">
                <p className={BOOKING_SUMMARY_BODY_CLASS}>{booking.service.name}</p>
                <p className={BOOKING_SUMMARY_BODY_CLASS}>
                  {booking.vehicleType} {booking.vehicleModel ? `(${booking.vehicleModel})` : ''}
                </p>
                {registrationNumber?.trim() ? (
                  <p className={BOOKING_SUMMARY_BODY_CLASS}>
                    {registrationNumber.trim().toUpperCase()}
                  </p>
                ) : null}
                {((selectedService?.freeCoffeeCount ?? 0) > 0 || (hasCustomerSession && selectedService?.eligibleForLoyaltyPoints)) ? (
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-600">
                    {(selectedService?.freeCoffeeCount ?? 0) > 0 ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-900 ring-1 ring-amber-200/70">
                        <Coffee className="h-3.5 w-3.5" aria-hidden />
                        {(selectedService?.freeCoffeeCount ?? 0) === 1
                          ? '1 complimentary coffee'
                          : `${selectedService?.freeCoffeeCount} complimentary coffees`}
                      </span>
                    ) : null}
                    {hasCustomerSession && selectedService?.eligibleForLoyaltyPoints ? (
                      <span
                        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium ring-1"
                        style={{ background: NAVY_TINT, color: NAVY, borderColor: 'rgba(12,29,58,0.12)' }}
                      >
                        <Award className="h-3.5 w-3.5" aria-hidden />
                        Counts toward loyalty
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </div>
              <p className={cn(BOOKING_SUMMARY_BODY_CLASS, 'shrink-0 tabular-nums')}>
                ${Number(booking.service.price).toFixed(2)}
              </p>
            </div>

            {booking.addOns.length > 0 ? (
              <div className="mt-5 space-y-2 border-t border-gray-100 pt-4">
                {booking.addOns.map((addon, index) => (
                  <div key={index} className="flex items-center justify-between gap-3">
                    <p className={BOOKING_SUMMARY_BODY_CLASS}>{addon.name}</p>
                    <p className={cn(BOOKING_SUMMARY_BODY_CLASS, 'shrink-0 tabular-nums')}>
                      ${Number(addon.price).toFixed(2)}
                    </p>
                  </div>
                ))}
              </div>
            ) : null}
          </BookingFlowSection>

          <BookingFlowSection
            icon={Calendar}
            title="Date & time"
            headerTrailing={sectionEditButton(() => navigate(-1))}
          >
            <div className="flex flex-col gap-3 text-sm text-gray-700 sm:flex-row sm:items-center sm:gap-8">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 shrink-0" style={{ color: NAVY }} />
                <span className="font-medium text-gray-900">{booking.date}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 shrink-0" style={{ color: NAVY }} />
                <span className="font-medium text-gray-900">{booking.time}</span>
              </div>
            </div>
          </BookingFlowSection>

          <BookingFlowSection icon={Receipt} title="Price breakdown">
            <div className={cn('space-y-3', BOOKING_PRICE_BODY_CLASS)}>
              <div className="flex items-center justify-between">
                <span className={BOOKING_SUMMARY_BODY_CLASS}>Service price (inc GST)</span>
                <span className={cn(BOOKING_SUMMARY_BODY_CLASS, 'shrink-0 tabular-nums')}>
                  ${booking.service.price.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className={BOOKING_SUMMARY_BODY_CLASS}>Add-ons (inc GST)</span>
                <span className={cn(BOOKING_SUMMARY_BODY_CLASS, 'shrink-0 tabular-nums')}>${addonsTotal.toFixed(2)}</span>
              </div>
              <div className="border-t border-gray-100 pt-4">
                <div className="flex items-end justify-between gap-4">
                  <p className="text-base font-bold text-gray-900">Total (inc GST)</p>
                  <p className="text-2xl font-bold tabular-nums sm:text-3xl" style={{ color: NAVY }}>
                    ${total.toFixed(2)}
                  </p>
                </div>
                <p className="mt-2 text-right text-xs text-gray-500">
                  Service and add-on prices include GST.
                </p>
              </div>
            </div>
          </BookingFlowSection>
        </motion.div>

        <div
          className="mt-5 rounded-xl border px-4 py-4"
          style={{ background: NAVY_TINT, borderColor: 'rgba(12,29,58,0.12)' }}
        >
          <BookingDisclaimerNotes />
        </div>
      </main>

      <footer className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-100 bg-white/95 p-4 backdrop-blur-sm sm:p-6">
        <div className="mx-auto max-w-4xl">
          <button
            type="button"
            onClick={() => void handleConfirm()}
            className="w-full rounded-xl py-4 text-sm font-semibold transition-all"
            style={{
              background: BTN_BG,
              color: BTN_TEXT,
              boxShadow: '0 4px 14px rgba(201,168,76,0.4)',
            }}
          >
            {isRescheduling ? 'Complete reschedule' : 'Proceed to payment'}
          </button>
        </div>
      </footer>
    </div>
  );
}
