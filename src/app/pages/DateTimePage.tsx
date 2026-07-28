import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { Calendar, Clock, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import { useBooking } from '../context/BookingContext';
import { BookingDisclaimerNotes } from '../components/BookingDisclaimerNotes';
import { cn } from '../components/ui/utils';
import {
  BOOKING_NAVY as NAVY,
  BOOKING_NAVY_TINT as NAVY_TINT,
  BOOKING_GOLD as GOLD,
  BOOKING_BTN_BG as BTN_BG,
  BOOKING_BTN_TEXT as BTN_TEXT,
  BookingFlowSection,
} from '../components/bookingFlowSection';
import {
  estimateBranchBookingMinutes,
  filterSlotsWithinBranchClose,
  listAvailableSlots,
  type SlotOption,
} from '../lib/adminPortalBridge';
import {
  getCachedMobileSnapshot,
  getMobilePinFromBranchId,
  listMobileSlotsFromApi,
  type MobileSnapshot,
} from '../lib/mobilePublicBridge';
import { resolveOperatingCloseMinutes } from '../lib/operatingHours';
import { headingFontStyle } from '../lib/branding';
/** Parse "HH:MM" to minutes — same logic as adminPortalBridge. */
function parseHHMMToMinutes(t: string): number {
  const [h, m] = t.split(':').map((x) => parseInt(x, 10));
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}

/** Drop mobile slots outside operating hours: before open_time or where startTime + duration exceeds close_time. */
function filterMobileSlotsWithinClose<T extends { startTime: string }>(
  snapshot: MobileSnapshot | null | undefined,
  slots: T[],
  bookingDurationMinutes: number
): T[] {
  const settings = snapshot?.slot_settings;
  if (!settings?.close_time) return slots;
  const openM = parseHHMMToMinutes(settings.open_time ?? '09:00');
  const closeM = resolveOperatingCloseMinutes(openM, parseHHMMToMinutes(settings.close_time));
  if (closeM > 24 * 60) return slots;
  const dur = Math.max(30, Math.round(bookingDurationMinutes));
  return slots.filter((s) => {
    const startM = parseHHMMToMinutes(s.startTime);
    return startM >= openM && startM + dur <= closeM;
  });
}

export function DateTimePage() {
  const navigate = useNavigate();
  const {
    selectedBranch,
    serviceType,
    selectedService,
    selectedAddOns,
    selectedDate,
    selectedTime,
    selectedEndTime,
    setSelectedDate,
    setSelectedTime,
    setSelectedEndTime,
    reschedulingBookingId,
    originalSlot,
  } = useBooking();

  const bookingDurationMinutes = useMemo(
    () => estimateBranchBookingMinutes(selectedService, selectedAddOns.length),
    [selectedService, selectedAddOns]
  );
  const toISO = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const normTime = (t: string) => (t && t.length >= 5 ? t.slice(0, 5) : t);
  const isOriginalSlot = (date: Date, startTime: string) => {
    if (!reschedulingBookingId || !originalSlot) return false;
    return (
      toISO(date) === originalSlot.date && normTime(startTime) === normTime(originalSlot.startTime)
    );
  };

  const isPastTime = (timeStr: string) => {
    if (!selectedDate) return false;
    const now = new Date();
    const isToday = toISO(selectedDate) === toISO(now);
    if (!isToday) return false;

    const [hours, minutes] = timeStr.split(':').map(Number);
    const slotTime = new Date(now);
    slotTime.setHours(hours, minutes, 0, 0);

    return slotTime < now;
  };

  const dates = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const max = new Date(today);
    max.setMonth(max.getMonth() + 1);
    return { today, max };
  }, [reschedulingBookingId, originalSlot?.date]);

  const weekdayShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
  const calendarMonths = useMemo(() => {
    const start = new Date(dates.today.getFullYear(), dates.today.getMonth(), 1);
    const end = new Date(dates.max.getFullYear(), dates.max.getMonth(), 1);
    const out: Array<{
      key: string;
      label: string;
      cells: Array<{ key: string; date: Date | null; disabled: boolean; outOfWindow: boolean; isToday: boolean }>;
    }> = [];
    const cursor = new Date(start);
    while (cursor <= end) {
      const year = cursor.getFullYear();
      const month = cursor.getMonth();
      const first = new Date(year, month, 1);
      const last = new Date(year, month + 1, 0);
      const leading = first.getDay();
      const daysInMonth = last.getDate();
      const cells: Array<{ key: string; date: Date | null; disabled: boolean; outOfWindow: boolean; isToday: boolean }> = [];
      for (let i = 0; i < leading; i++) {
        cells.push({ key: `blank-start-${i}`, date: null, disabled: true, outOfWindow: false, isToday: false });
      }
      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        date.setHours(0, 0, 0, 0);
        const beforeToday = date < dates.today;
        const afterMax = date > dates.max;
        const outOfWindow = beforeToday || afterMax;
        cells.push({
          key: toISO(date),
          date,
          disabled: outOfWindow,
          outOfWindow,
          isToday: toISO(date) === toISO(dates.today),
        });
      }
      const trailing = (7 - (cells.length % 7)) % 7;
      for (let i = 0; i < trailing; i++) {
        cells.push({ key: `blank-end-${i}`, date: null, disabled: true, outOfWindow: false, isToday: false });
      }
      out.push({
        key: `${year}-${month}`,
        label: first.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        cells,
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return out;
  }, [dates, toISO]);
  const [visibleMonthIndex, setVisibleMonthIndex] = useState(0);
  const visibleMonth = calendarMonths[visibleMonthIndex] ?? null;
  const canGoPrevMonth = visibleMonthIndex > 0;
  const canGoNextMonth = visibleMonthIndex < calendarMonths.length - 1;

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const isDateSelected = (date: Date) => {
    if (!selectedDate) return false;
    return (
      date.getDate() === selectedDate.getDate() &&
      date.getMonth() === selectedDate.getMonth() &&
      date.getFullYear() === selectedDate.getFullYear()
    );
  };

  const selectedISO = selectedDate ? toISO(selectedDate) : '';
  const prevDateISORef = useRef<string | null>(null);
  useEffect(() => {
    const cur = selectedDate ? toISO(selectedDate) : '';
    if (prevDateISORef.current !== null && prevDateISORef.current !== cur) {
      setSelectedTime(null);
      setSelectedEndTime(null);
    }
    prevDateISORef.current = cur || null;
  }, [selectedDate, setSelectedTime, setSelectedEndTime]);

  const [slots, setSlots] = useState<SlotOption[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsHint, setSlotsHint] = useState('');
  useEffect(() => {
    let mounted = true;
    const ac = new AbortController();
    const run = async () => {
      if (!selectedBranch || !selectedISO) {
        if (mounted) {
          setSlots([]);
          setSlotsLoading(false);
          setSlotsHint('');
        }
        return;
      }
      if (mounted) {
        setSlotsHint('');
      }

      if (mounted) {
        setSlotsLoading(true);
        setSlots([]);
      }

      try {
        if (serviceType === 'onsite') {
          const pin = getMobilePinFromBranchId(selectedBranch.id);
          const snapshot = getCachedMobileSnapshot();
          let next: SlotOption[] = [];
          if (pin) {
            next = await listMobileSlotsFromApi(pin, selectedISO, bookingDurationMinutes, {
              signal: ac.signal,
            });
          }
          if (!next.length) {
            next = snapshot ? listMobileSlots(snapshot, bookingDurationMinutes) : [];
          }
          next = filterMobileSlotsWithinClose(snapshot, next, bookingDurationMinutes);
          if (mounted) {
            setSlots(next);
            if (!next.length) {
              setSlotsHint('No mobile times for this day. Try another date or check connection.');
            } else {
              const hasFuture = next.some(s => !isPastTime(s.startTime));
              if (!hasFuture && selectedISO === toISO(new Date())) {
                setSlotsHint('All time slots for today have already passed. Please select a future date.');
              }
            }
          }
          return;
        }
        const apiSlots = await listAvailableSlots(selectedBranch.id, selectedISO, bookingDurationMinutes, {
          signal: ac.signal,
        });
        // Safety filter: drop any slot where startTime + totalDuration > branchCloseTime.
        // Uses closeTime from booking context (set at branch selection) or catalog fallback.
        const branchTimes = selectedBranch.openTime && selectedBranch.closeTime
          ? { openTime: selectedBranch.openTime, closeTime: selectedBranch.closeTime }
          : selectedBranch.id;
        const next = filterSlotsWithinBranchClose(branchTimes, apiSlots, bookingDurationMinutes);
        if (mounted) {
          setSlots(next);
          if (!next.length) {
            setSlotsHint(
              'No open start times for this day with your selected service length. Try another date or fewer add-ons.'
            );
          } else {
            const hasFuture = next.some(s => !isPastTime(s.startTime));
            if (!hasFuture && selectedISO === toISO(new Date())) {
              setSlotsHint('All time slots for today have already passed. Please select a future date.');
            }
          }
        }
      } catch (e: unknown) {
        if (!mounted) return;
        const aborted =
          (e instanceof DOMException && e.name === 'AbortError') ||
          (e instanceof Error && e.name === 'AbortError');
        if (aborted) return;
        setSlots([]);
        setSlotsHint('Could not load availability. Check your connection and try again.');
      } finally {
        if (mounted) setSlotsLoading(false);
      }
    };
    void run();
    return () => {
      mounted = false;
      ac.abort();
    };
  }, [selectedBranch, selectedISO, serviceType, bookingDurationMinutes]);

  useEffect(() => {
    if (slotsLoading || !selectedTime) return;
    if (!slots.length) {
      setSelectedTime(null);
      setSelectedEndTime(null);
      return;
    }
    const row = slots.find((s) => s.startTime === selectedTime);
    if (!row) {
      setSelectedTime(null);
      setSelectedEndTime(null);
      return;
    }
    if (row.endTime && row.endTime !== selectedEndTime) {
      setSelectedEndTime(row.endTime);
    }
  }, [slots, slotsLoading, selectedTime, selectedEndTime, setSelectedTime, setSelectedEndTime]);

  const isSlotAvailable = (time: string) => slots.some((s) => s.startTime === time && s.available > 0);

  /** Closed = schedule/off hours; full = all schedulable bays taken; available = at least one bay free. */
  const slotUiState = (s: SlotOption | undefined): 'available' | 'full' | 'closed' => {
    if (!s) return 'closed';
    const scheduleOpen = s.scheduleOpenBays ?? s.capacity;
    if (scheduleOpen <= 0) return 'closed';
    if (s.available <= 0) return 'full';
    return 'available';
  };
  useEffect(() => {
    if (!selectedBranch) {
      navigate(-1);
    }
  }, [selectedBranch, navigate]);

  const handleContinue = () => {
    if (selectedDate && selectedTime) {
      const picked = slots.find((s) => s.startTime === selectedTime);
      if (picked?.endTime) {
        setSelectedEndTime(picked.endTime);
      }
      navigate('/summary');
    }
  };

  const canContinue = selectedDate && selectedTime && !isPastTime(selectedTime);
  const buttonText = reschedulingBookingId ? 'Confirm Reschedule' : 'Continue to Summary';

  return (
    <div className="min-h-screen" style={{ background: '#eef3fa' }}>
      <div
        className="h-0.5 w-full"
        style={{ background: `linear-gradient(90deg, ${GOLD} 0%, #e8c97a 50%, transparent 100%)` }}
      />

      <header className="sticky top-0 z-40 border-b border-gray-100 bg-white/95 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto flex items-center gap-3 px-4 py-4">
          <div>
            <h1
              className="text-2xl font-normal leading-tight tracking-[0.04em] text-gray-900"
              style={{ ...headingFontStyle, color: NAVY }}
            >
              Date &amp; time
            </h1>
            <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
              Choose when you&apos;d like to visit
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 pb-32">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 gap-5 lg:grid-cols-2"
        >
          <BookingFlowSection icon={Calendar} title="Select date">
            {visibleMonth ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    disabled={!canGoPrevMonth}
                    onClick={() => setVisibleMonthIndex((idx) => Math.max(0, idx - 1))}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-sm font-semibold text-gray-600 transition-all hover:border-gray-300 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="Previous month"
                  >
                    ‹
                  </button>
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-600">{visibleMonth.label}</p>
                  <button
                    type="button"
                    disabled={!canGoNextMonth}
                    onClick={() => setVisibleMonthIndex((idx) => Math.min(calendarMonths.length - 1, idx + 1))}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-sm font-semibold text-gray-600 transition-all hover:border-gray-300 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="Next month"
                  >
                    ›
                  </button>
                </div>
                <div className="grid grid-cols-7 gap-1 text-[10px] font-medium uppercase tracking-wide text-gray-400">
                  {weekdayShort.map((day) => (
                    <span key={`${visibleMonth.key}-${day}`} className="text-center">{day}</span>
                  ))}
                </div>
                <motion.div
                  key={visibleMonth.key}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.18, ease: 'easeOut' }}
                  className="grid grid-cols-7 gap-1.5 sm:gap-2"
                >
                  {visibleMonth.cells.map((cell) => {
                    if (!cell.date) {
                      return <div key={`${visibleMonth.key}-${cell.key}`} className="h-11 rounded-lg sm:h-12" aria-hidden />;
                    }
                    const selected = isDateSelected(cell.date);
                    return (
                      <button
                        key={`${visibleMonth.key}-${cell.key}`}
                        type="button"
                        disabled={cell.disabled}
                        onClick={() => setSelectedDate(cell.date)}
                        className={cn(
                          'relative h-11 rounded-lg border bg-white px-1 text-center transition-all duration-150 sm:h-12',
                          selected
                            ? 'border shadow-sm text-[#0c1d3a]'
                            : cell.disabled
                              ? 'cursor-not-allowed border-gray-200 bg-gray-50 text-gray-400 opacity-60'
                              : 'border-gray-200 hover:-translate-y-px hover:border-gray-300 hover:shadow-sm',
                        )}
                        style={
                          selected
                            ? { borderColor: 'rgba(0, 0, 0, 0.92)', background: '#c1d0e3' }
                            : undefined
                        }
                      >
                        <div className="flex h-full flex-col items-center justify-center leading-none">
                          <span className={cn('tabular-nums text-sm font-medium', selected ? 'text-[#0c1d3a]' : 'text-gray-800')}>
                            {cell.date.getDate()}
                          </span>
                          <span className="mt-1 text-[10px] font-medium text-gray-500">
                            {cell.date.toLocaleDateString('en-US', { month: 'short' })}
                          </span>
                        </div>
                        {cell.outOfWindow ? (
                          <span className="absolute inset-x-2 top-1/2 h-px -translate-y-1/2 bg-gray-300/80" aria-hidden />
                        ) : null}
                        {cell.isToday ? (
                          <span
                            className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full"
                            style={{ background: GOLD }}
                            title="Today"
                          />
                        ) : null}
                      </button>
                    );
                  })}
                </motion.div>
              </div>
            ) : null}
          </BookingFlowSection>

          <BookingFlowSection
            icon={Clock}
            title="Select time"
            badge={selectedTime || undefined}
          >
            {!selectedDate ? (
              <div className="flex h-56 flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-[#f8f9fc] text-center text-gray-500">
                <Calendar className="mb-2 h-9 w-9 opacity-40" style={{ color: NAVY }} />
                <p className="text-sm font-medium text-gray-600">Choose a date to view times</p>
                <p className="mt-1 text-xs text-gray-500">Available slots will appear here.</p>
              </div>
            ) : (
              <>
                <div className="max-h-[22rem] overflow-y-auto pr-1">
                  {slotsLoading ? (
                    <div className="flex h-48 flex-col items-center justify-center gap-2 text-gray-500">
                      <Loader2 className="h-8 w-8 animate-spin" style={{ color: NAVY }} aria-hidden />
                      <p className="text-sm">Loading times…</p>
                    </div>
                  ) : !slots.length ? (
                    <div className="flex min-h-48 flex-col items-center justify-center gap-2 px-2 text-center text-sm text-gray-600">
                      <p>{slotsHint || 'No times available for this day.'}</p>
                    </div>
                  ) : null}
                  {!slotsLoading && slots.length > 0 ? (
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
                      {slots.map((slot) => {
                        const time = slot.startTime;
                        const isPast = isPastTime(time);
                        if (isPast) return null;

                        const pickable = isSlotAvailable(time);
                        const selected = selectedTime === time;
                        const isOriginal = selectedDate && isOriginalSlot(selectedDate, time);
                        const state = slotUiState(slot);

                        return (
                          <button
                            key={time}
                            type="button"
                            onClick={() => {
                              if (!pickable && !isOriginal) return;
                              setSelectedTime(time);
                              setSelectedEndTime(slot.endTime ?? null);
                            }}
                            className={cn(
                              'relative overflow-hidden rounded-xl border py-2.5 px-2 text-center text-xs tabular-nums transition-all sm:px-3 sm:text-sm',
                              isOriginal
                                ? 'border border-emerald-500 bg-emerald-50 font-semibold text-emerald-900'
                                : selected
                                  ? 'border font-medium shadow-sm text-[#0c1d3a]'
                                  : state === 'closed'
                                    ? 'border font-semibold cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
                                    : state === 'full'
                                      ? 'border font-semibold cursor-not-allowed border-amber-300 bg-amber-50 text-amber-950'
                                      : 'border border-gray-200 bg-white font-semibold text-gray-900 hover:border-gray-300',
                            )}
                            style={
                              selected && !isOriginal
                                ? { borderColor: 'rgba(0, 0, 0, 0.92)', background: '#c1d0e3' }
                                : undefined
                            }
                          >
                            {time}

                            {/* Closed: two diagonal cross lines */}
                            {state === 'closed' && !isOriginal ? (
                              <span className="pointer-events-none absolute inset-0" aria-hidden>
                                <svg width="100%" height="100%" viewBox="0 0 60 40" preserveAspectRatio="none">
                                  <line x1="4" y1="4" x2="56" y2="36" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />
                                  <line x1="56" y1="4" x2="4" y2="36" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />
                                </svg>
                              </span>
                            ) : null}

                            {isOriginal ? (
                              <span className="absolute -right-1 -top-2 rounded-full bg-emerald-600 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white shadow">
                                Original
                              </span>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>

                <div className="mt-5 border-t border-gray-100 pt-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">Legend</p>
                  <div className="flex flex-wrap gap-2">
                    {/* Available */}
                    <span className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-medium text-gray-700">
                      <span className="h-3 w-3 shrink-0 rounded-sm border border-gray-300 bg-white" aria-hidden />
                      Available
                    </span>

                    {/* Full */}
                    <span className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-medium text-gray-700">
                      <span className="h-3 w-3 shrink-0 rounded-sm border border-amber-300 bg-amber-50" aria-hidden />
                      Full
                    </span>

                    {/* Closed — X icon */}
                    <span className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-medium text-gray-700">
                      <span className="relative h-3 w-3 shrink-0 overflow-hidden rounded-sm border border-slate-200 bg-slate-100" aria-hidden>
                        <svg width="100%" height="100%" viewBox="0 0 12 12" className="absolute inset-0">
                          <line x1="2" y1="2" x2="10" y2="10" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />
                          <line x1="10" y1="2" x2="2" y2="10" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                      </span>
                      Closed
                    </span>

                    {/* Selected — navy border + tint (matches date picker) */}
                    <span className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-medium text-gray-700">
                      <span
                        className="h-3 w-3 shrink-0 rounded-sm border"
                        style={{ borderColor: 'rgba(0, 0, 0, 0.92)', background: '#c1d0e3' }}
                        aria-hidden
                      />
                      Selected
                    </span>
                  </div>
                </div>
              </>
            )}
          </BookingFlowSection>
        </motion.div>

        {selectedDate && selectedTime ? (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-5">
            <BookingFlowSection icon={Calendar} title="Your selection">
              <div className="flex flex-col gap-3 text-sm text-gray-700 sm:flex-row sm:items-center sm:gap-8">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 shrink-0" style={{ color: NAVY }} />
                  <span className="font-medium">{formatDate(selectedDate)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 shrink-0" style={{ color: NAVY }} />
                  <span className="font-medium">
                    {selectedTime}
                    {selectedEndTime ? ` – ${selectedEndTime}` : ''}
                  </span>
                </div>
              </div>
            </BookingFlowSection>
          </motion.div>
        ) : null}

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
            onClick={handleContinue}
            disabled={!canContinue}
            className="w-full rounded-xl py-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
            style={
              canContinue
                ? {
                    background: BTN_BG,
                    color: BTN_TEXT,
                    boxShadow: '0 4px 14px rgba(201,168,76,0.4)',
                  }
                : { background: '#f3f4f6', color: '#9ca3af' }
            }
          >
            {buttonText}
          </button>
        </div>
      </footer>
    </div>
  );
}