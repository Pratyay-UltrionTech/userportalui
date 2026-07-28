import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ArrowDownUp, ArrowUpDown, Award, Building2, CalendarClock, Car, Clock, Coffee, MapPin, RefreshCw } from 'lucide-react';
import { motion } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { useBooking } from '../context/BookingContext';
import { apiCustomerServiceHistory, type CustomerServiceHistoryItem } from '../lib/userApi';
import { getCatalogForVehicle, listBranches } from '../lib/adminPortalBridge';
import { getMobilePinFromBranchId, getCachedMobileSnapshot, getMobileCatalogForVehicle } from '../lib/mobilePublicBridge';
import { normalizeBookingStatus } from '../lib/bookingStatus';
import { HEADING_FONT_FAMILY } from '../lib/branding';

/* ── palette (matches ProfileSetup) ── */
const NAVY      = '#0c1d3a';
const NAVY_MID  = '#1a3560';
const NAVY_TINT = '#e8eef8';
const GOLD      = '#c9a84c';

function formatHistoryPrice(totalCents: number | undefined | null): string | null {
  if (totalCents === undefined || totalCents === null) return null;
  const n = Number(totalCents);
  if (!Number.isFinite(n) || n < 0) return null;
  return `$${(n / 100).toFixed(2)}`;
}

function statusConfig(status: string): { label: string; bg: string; text: string; ring: string } {
  const s = normalizeBookingStatus(status);
  if (s === 'completed')
    return { label: 'Completed', bg: '#f0fdf4', text: '#15803d', ring: '#86efac' };
  if (s === 'cancelled')
    return { label: 'Cancelled', bg: '#fff1f2', text: '#be123c', ring: '#fecdd3' };
  if (s === 'in_progress')
    return { label: 'In Progress', bg: '#fffbeb', text: '#92400e', ring: '#fcd34d' };
  if (s === 'arrived')
    return { label: 'Arrived', bg: '#eef2ff', text: '#3730a3', ring: '#a5b4fc' };
  if (s === 'assigned')
    return { label: 'Assigned', bg: '#f0f9ff', text: '#0369a1', ring: '#7dd3fc' };
  return { label: 'Scheduled', bg: NAVY_TINT, text: NAVY_MID, ring: '#bfdbfe' };
}

function formatDate(dateStr: string): string {
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch { return dateStr; }
}

function parseServiceSummary(summary: string): { service: string; addons: string[] } {
  const idx = summary.indexOf(' + ');
  if (idx === -1) return { service: summary, addons: [] };
  return {
    service: summary.slice(0, idx),
    addons: summary.slice(idx + 3).split(', ').filter(Boolean),
  };
}

function normalizeSlotTime(t: string | undefined | null): string {
  const s = (t ?? '').trim();
  if (!s) return '';
  return s.length >= 5 ? s.slice(0, 5) : s;
}

export function ServiceHistoryPage() {
  const navigate = useNavigate();
  const { hasCustomerSession, session } = useAuth();
  const {
    setSelectedBranch, setServiceType, setVehicleType,
    setSelectedService, setSelectedAddOns, setReschedulingBookingId,
    setOriginalSlot, setSelectedDate, setSelectedTime, setSelectedEndTime, resetBooking,
  } = useBooking();
  const [items, setItems] = useState<CustomerServiceHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const loadRef = useRef<(() => Promise<void>) | null>(null);

  // Sort state
  type SortKey = 'status' | 'booking_date' | 'service_date';
  const [sortKey, setSortKey] = useState<SortKey>('status');
  const [sortAsc, setSortAsc] = useState(false); // false = newest first

  const displayedItems = (() => {
    const dir = sortAsc ? 1 : -1;
    const sorted = [...items];
    if (sortKey === 'booking_date') {
      sorted.sort((a, b) => {
        const ca = a.created_at ?? '';
        const cb = b.created_at ?? '';
        return dir * ca.localeCompare(cb);
      });
    } else if (sortKey === 'service_date') {
      sorted.sort((a, b) => {
        const dc = a.slot_date.localeCompare(b.slot_date);
        if (dc !== 0) return dir * dc;
        return dir * (a.start_time ?? '').localeCompare(b.start_time ?? '');
      });
    }
    // 'status' keeps the server-sorted order (already sorted by priority in loadHistory)
    return sorted;
  })();

  const handleSortKey = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(prev => !prev);
    } else {
      setSortKey(key);
      setSortAsc(false); // newest first by default when switching
    }
  };

  const handleReschedule = async (row: CustomerServiceHistoryItem) => {
    resetBooking();
    const isMobile = row.channel === 'mobile';
    setServiceType(isMobile ? 'onsite' : 'branch');
    const vType = row.vehicle_type || 'SUV';
    setVehicleType(vType);

    let bid = row.branch_id || '';
    if (!bid && !isMobile && row.location_label) {
      const branches = listBranches('');
      const found = branches.find(b => b.name === row.location_label || b.location === row.location_label);
      if (found) bid = found.id;
    }

    if (isMobile) {
      setSelectedBranch({ id: bid || 'mobile', name: 'Mobile Service', location: row.location_label, rating: 4.9, image: '' });
    } else if (bid) {
      const branch = listBranches('').find(b => b.id === bid);
      if (branch) setSelectedBranch({ id: branch.id, name: branch.name, location: branch.location, rating: 4.8, image: '', openTime: branch.openTime, closeTime: branch.closeTime });
    }

    if (row.service_id) {
      let services: any[] = [];
      let addons: any[] = [];
      if (isMobile) {
        const pin = getMobilePinFromBranchId(bid);
        let snapshot = getCachedMobileSnapshot(pin || undefined);
        if (!snapshot && pin) {
          const { fetchMobileSnapshot } = await import('../lib/mobilePublicBridge');
          try { snapshot = await fetchMobileSnapshot(pin); } catch { /* ignore */ }
        }
        if (snapshot) { const cat = getMobileCatalogForVehicle(snapshot, vType); services = cat.services; addons = cat.addons; }
      } else if (bid) {
        const branches = listBranches('');
        if (!branches.length) { const { syncAdminStateFromPortal } = await import('../lib/adminPortalBridge'); await syncAdminStateFromPortal(); }
        const cat = getCatalogForVehicle(bid, vType); services = cat.services; addons = cat.addons;
      }
      const svc = services.find(s => s.id === row.service_id);
      if (svc) setSelectedService({ id: svc.id, name: svc.name, price: Number(svc.price ?? 0), features: svc.descriptionPoints, durationMinutes: svc.durationMinutes, freeCoffeeCount: svc.freeCoffeeCount, eligibleForLoyaltyPoints: svc.eligibleForLoyaltyPoints, recommended: svc.recommended });
      if (row.selected_addon_ids?.length) {
        const picked = addons.filter(a => row.selected_addon_ids!.includes(a.id));
        setSelectedAddOns(picked.map(a => ({ id: a.id, name: a.name, price: Number(a.price ?? 0) })));
      }
    }

    const startT = normalizeSlotTime(row.start_time);
    const endT = normalizeSlotTime(row.end_time);
    setReschedulingBookingId(row.id);
    setOriginalSlot({ date: row.slot_date, startTime: startT, endTime: endT || startT });
    const ymd = row.slot_date.split('-').map(x => parseInt(x, 10));
    if (ymd.length === 3 && !ymd.some(n => Number.isNaN(n))) setSelectedDate(new Date(ymd[0], ymd[1] - 1, ymd[2]));
    if (startT) { setSelectedTime(startT); setSelectedEndTime(endT || null); }
    navigate('/datetime');
  };

  const isBookingPast = (dateStr: string, timeStr: string) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    const [h, min] = (timeStr || '00:00').split(':').map(Number);
    return new Date(y, m - 1, d, h, min) < new Date();
  };

  useEffect(() => {
    if (!hasCustomerSession || !session?.accessToken) { navigate('/login', { replace: true }); return; }
    let cancelled = false;
    let intervalId: number | null = null;
    setLoading(true);
    setError('');

    const STATUS_PRIORITY: Record<string, number> = {
      arrived: 1, in_progress: 2, assigned: 3, scheduled: 4, completed: 5, cancelled: 6,
    };
    const sortItems = (raw: CustomerServiceHistoryItem[]) =>
      [...raw].sort((a, b) => {
        const pa = STATUS_PRIORITY[normalizeBookingStatus(a.status)] ?? 5;
        const pb = STATUS_PRIORITY[normalizeBookingStatus(b.status)] ?? 5;
        if (pa !== pb) return pa - pb;
        const dc = b.slot_date.localeCompare(a.slot_date); // newest date first within same tier
        if (dc !== 0) return dc;
        return (b.start_time ?? '').localeCompare(a.start_time ?? '');
      });

    const loadHistory = async (showSpinner = false) => {
      if (showSpinner) setLoading(true);
      try {
        const res = await apiCustomerServiceHistory(session.accessToken);
        if (!cancelled) setItems(sortItems(res.items));
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load history.');
      } finally {
        if (!cancelled && showSpinner) setLoading(false);
      }
    };
    loadRef.current = loadHistory;
    void loadHistory(true);
    const onFocus = () => { void loadHistory(false); };
    window.addEventListener('focus', onFocus);
    intervalId = window.setInterval(() => { void loadHistory(false); }, 20000);
    return () => {
      cancelled = true;
      loadRef.current = null;
      window.removeEventListener('focus', onFocus);
      if (intervalId != null) window.clearInterval(intervalId);
    };
  }, [hasCustomerSession, session?.accessToken, navigate]);

  if (!hasCustomerSession) return null;

  return (
    <div className="min-h-screen" style={{ background: '#eef3fa' }}>
      {/* gold accent bar */}
      <div className="h-0.5 w-full" style={{ background: `linear-gradient(90deg, ${GOLD} 0%, #e8c97a 50%, transparent 100%)` }} />

      <div className="max-w-3xl mx-auto px-4 py-8">
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: 'easeOut' }}>

          {/* page header */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold" style={{ fontFamily: HEADING_FONT_FAMILY, color: NAVY }}>
              Booking History
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              View and manage all your past and upcoming bookings in one place.
            </p>
          </div>

          {/* content */}
          {loading ? (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-6 py-10 flex flex-col items-center gap-3">
              <svg className="animate-spin w-6 h-6" style={{ color: NAVY }} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              <p className="text-sm text-gray-500">Loading your bookings…</p>
            </div>
          ) : error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-start gap-2">
              <span className="shrink-0 mt-0.5">⚠</span>
              <span>{error}</span>
            </div>
          ) : items.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-6 py-4 flex items-center gap-3 border-b border-gray-100"
                style={{ borderLeftWidth: 4, borderLeftColor: NAVY, borderLeftStyle: 'solid' }}>
                <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: NAVY_TINT }}>
                  <CalendarClock className="w-4 h-4" style={{ color: NAVY }} />
                </span>
                <h2 className="font-semibold" style={{ fontFamily: HEADING_FONT_FAMILY, color: NAVY }}>No Bookings Yet</h2>
              </div>
              <div className="px-6 py-8 text-center">
                <p className="text-sm text-gray-500 leading-relaxed max-w-sm mx-auto">
                  No bookings are linked to your account yet. Book your next visit while signed in to see it here.
                  You can also check your{' '}
                  <Link to="/profile-setup" className="font-medium underline" style={{ color: NAVY }}>Profile</Link>.
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              {/* section header */}
              <div className="px-6 py-4 border-b border-gray-100"
                style={{ borderLeftWidth: 4, borderLeftColor: NAVY, borderLeftStyle: 'solid' }}>
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: NAVY_TINT }}>
                    <CalendarClock className="w-4 h-4" style={{ color: NAVY }} />
                  </span>
                  <h2 className="font-semibold" style={{ fontFamily: HEADING_FONT_FAMILY, color: NAVY }}>
                    Your Bookings
                  </h2>
                  <div className="ml-auto flex items-center gap-2">
                    <span className="text-xs font-medium px-2.5 py-0.5 rounded-full" style={{ background: NAVY_TINT, color: NAVY_MID }}>
                      {items.length} {items.length === 1 ? 'booking' : 'bookings'}
                    </span>
                    <button
                      type="button"
                      disabled={refreshing}
                      onClick={async () => {
                        if (!loadRef.current) return;
                        setRefreshing(true);
                        try { await loadRef.current(false); } finally { setRefreshing(false); }
                      }}
                      className="flex items-center justify-center w-7 h-7 rounded-lg border transition-all hover:opacity-80 disabled:opacity-50"
                      style={{ borderColor: 'rgba(12,29,58,0.15)', background: NAVY_TINT }}
                      title="Refresh bookings"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} style={{ color: NAVY }} />
                    </button>
                  </div>
                </div>

                {/* Sort controls */}
                <div className="mt-3 flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold uppercase tracking-wider text-gray-400 mr-1">Sort by</span>
                  {(
                    [
                      { key: 'status' as const, label: 'Status' },
                      { key: 'booking_date' as const, label: 'Booking Date' },
                      { key: 'service_date' as const, label: 'Service Date' },
                    ] as const
                  ).map(({ key, label }) => {
                    const active = sortKey === key;
                    const SortIcon = sortAsc ? ArrowUpDown : ArrowDownUp;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => handleSortKey(key)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all"
                        style={
                          active
                            ? { background: NAVY, color: '#fff', borderColor: NAVY }
                            : { background: '#fff', color: NAVY_MID, borderColor: 'rgba(12,29,58,0.18)' }
                        }
                      >
                        {label}
                        {active && <SortIcon className="w-3 h-3 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* booking list */}
              <ul className="divide-y divide-gray-200">
                {displayedItems.map((row, i) => {
                  const totalLabel = formatHistoryPrice(row.total_cents);
                  const sc = statusConfig(row.status);
                  const normalizedStatus = normalizeBookingStatus(row.status);
                  const isMobile = row.channel === 'mobile';
                  const canReschedule = (normalizedStatus === 'scheduled') && !isBookingPast(row.slot_date, row.start_time);
                  return (
                    <motion.li
                      key={`${row.channel}-${row.id}`}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(i * 0.04, 0.3) }}
                      className="px-6 py-5"
                    >
                      <div className="flex items-start gap-4">
                        {/* channel icon */}
                        <span
                          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                          style={{ background: isMobile ? '#f0fdf4' : NAVY_TINT }}
                        >
                          {isMobile
                            ? <Car className="w-5 h-5" style={{ color: '#166534' }} />
                            : <Building2 className="w-5 h-5" style={{ color: NAVY }} />}
                        </span>

                        {/* main content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-gray-900 truncate">{row.location_label}</p>
                            <span
                              className="shrink-0 text-xs font-mono font-medium px-2 py-0.5 rounded-md"
                              style={{ background: NAVY_TINT, color: NAVY_MID }}
                            >
                              {(() => {
                                const h = row.id.replace(/-/g, '').slice(-6).toUpperCase();
                                if (row.customer_id) {
                                  return `${h}-${String(row.customer_id).replace(/-/g, '').slice(-4).toUpperCase()}`;
                                }
                                if (row.phone) {
                                  const digits = row.phone.replace(/\D/g, '');
                                  if (digits) {
                                    const num = parseInt(digits.slice(-9), 10);
                                    const suffix = num.toString(36).toUpperCase().slice(-4).padStart(4, '0');
                                    return `${h}-${suffix}`;
                                  }
                                }
                                return h;
                              })()}
                            </span>
                          </div>

                          {/* date + time */}
                          <div className="flex items-center gap-1.5 mt-1">
                            <Clock className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                            <p className="text-sm text-gray-500">
                              {formatDate(row.slot_date)} · {normalizeSlotTime(row.start_time)}–{normalizeSlotTime(row.end_time)}
                            </p>
                          </div>

                          {/* service summary / vehicle */}
                          {row.service_summary ? (() => {
                            const { service, addons } = parseServiceSummary(row.service_summary);
                            return (
                              <div className="mt-1.5">
                                <p className="text-sm font-medium text-gray-700">{service}</p>
                                {addons.length > 0 && (
                                  <p className="text-xs text-gray-500 mt-0.5">
                                    <span className="font-medium">Add-ons:</span>{' '}{addons.join(', ')}
                                  </p>
                                )}
                              </div>
                            );
                          })() : row.vehicle_type ? (
                            <div className="flex items-center gap-1.5 mt-1.5">
                              <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                              <p className="text-sm text-gray-600">{row.vehicle_type}</p>
                            </div>
                          ) : null}

                          {/* price + loyalty */}
                          <div className="flex items-center gap-4 mt-2 flex-wrap">
                            {totalLabel && (
                              <span className="text-sm font-semibold" style={{ color: NAVY }}>
                                {totalLabel}
                              </span>
                            )}
                            {Number(row.loyalty_points_earned ?? 0) > 0 && (
                              <span className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
                                style={{ background: 'rgba(201,168,76,0.12)', color: '#92650a' }}>
                                <Award className="w-3 h-3" />
                                {Number(row.loyalty_points_earned)} pts earned
                              </span>
                            )}
                          </div>
                        </div>

                        {/* right column: status + reschedule stacked */}
                        <div className="flex shrink-0 flex-col items-stretch gap-2 w-28">
                          <span
                            className="text-xs font-semibold px-3 py-1.5 rounded-xl text-center capitalize whitespace-nowrap border"
                            style={{ background: sc.bg, color: sc.text, borderColor: sc.ring }}
                          >
                            {sc.label}
                          </span>
                          {canReschedule && (
                            <button
                              type="button"
                              onClick={e => { e.stopPropagation(); handleReschedule(row); }}
                              className="flex items-center justify-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl transition-all hover:opacity-80 whitespace-nowrap"
                              style={{ color: NAVY, background: NAVY_TINT }}
                            >
                              <CalendarClock className="w-3.5 h-3.5 shrink-0" />
                              Reschedule
                            </button>
                          )}
                        </div>
                      </div>
                    </motion.li>
                  );
                })}
              </ul>
            </div>
          )}

        </motion.div>
      </div>
    </div>
  );
}
