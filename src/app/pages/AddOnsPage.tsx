import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { Check, Layers } from 'lucide-react';
import { motion } from 'motion/react';
import { useBooking } from '../context/BookingContext';
import { getCatalogForVehicle, listBranchAddons } from '../lib/adminPortalBridge';
import { getCachedMobileSnapshot, getMobileCatalogForVehicle } from '../lib/mobilePublicBridge';
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
} from '../components/bookingFlowSection';

const BODY_FONT_FAMILY = "'DM Sans', system-ui, sans-serif";

/** Matches landing `.ps-card-title` / `.ps-card-price` (PricingSection.css) */
const addonTitleStyle = {
  fontFamily: BODY_FONT_FAMILY,
  fontSize: '1.0625rem',
  fontWeight: 600,
  letterSpacing: 0,
  lineHeight: 1.35,
  color: NAVY,
} as const;

const addonPriceStyle = {
  fontFamily: BODY_FONT_FAMILY,
  fontSize: '13px',
  fontWeight: 600,
  letterSpacing: 0,
  lineHeight: 1.4,
  color: NAVY,
} as const;

/** Matches service package cards (`.ps-card` / `.ps-card--selected`) */
const ADDON_CARD_BORDER = 'rgba(107, 125, 151, 0.5)';
const ADDON_CARD_BG = '#e7edf6';
const ADDON_CARD_BORDER_SELECTED = 'rgba(64, 84, 116, 0.85)';
const ADDON_CARD_BG_SELECTED = '#c1d0e3';

/** Additional services from menu — flat rates (branch & mobile). */
export function AddOnsPage() {
  const formatAddonName = (raw: string) => {
    const trimmed = (raw ?? '').trim();
    if (!trimmed) return '';

    // UI wants a clean English display (e.g. "BUG/TAR REMOVING" → "Bug & Tar Removing")
    const withAmpersand = trimmed.replace(/\s*\/\s*/g, ' & ');

    const titleCase = (s: string) =>
      s
        .toLowerCase()
        .split(/\s+/)
        .map((word) => {
          if (!word) return word;
          // Keep apostrophes: "DOG'S" -> "Dog's"
          const [first, ...rest] = word;
          return first.toUpperCase() + rest.join('');
        })
        .join(' ');

    return withAmpersand
      .split(' & ')
      .map((part) => titleCase(part))
      .join(' & ');
  };

  const navigate = useNavigate();
  const {
    selectedBranch,
    serviceType,
    vehicleType,
    selectedAddOns: bookingAddOns,
    toggleAddOn: toggleBookingAddOn,
    setSelectedAddOns: setBookingAddOns,
  } = useBooking();
  const syncSeed = useAdminBridgeSync(30000);
  const [selectedAddOnIds, setSelectedAddOnIds] = useState<string[]>([]);
  const mobileSnapshot = getCachedMobileSnapshot();
  const ADDONS = useMemo(() => {
    if (!selectedBranch) return [];
    const source =
      serviceType === 'onsite' && mobileSnapshot && vehicleType
        ? getMobileCatalogForVehicle(mobileSnapshot, vehicleType).addons
        : (() => {
            const vehicleScoped = vehicleType ? getCatalogForVehicle(selectedBranch.id, vehicleType).addons : [];
            const branchScoped = listBranchAddons(selectedBranch.id);
            return vehicleScoped.length ? vehicleScoped : branchScoped;
          })();
    return source.map((a) => ({
      id: a.id,
      name: formatAddonName(a.name),
      price: a.price,
      description: (a.descriptionPoints ?? []).join(', '),
    }));
  }, [selectedBranch, serviceType, vehicleType, mobileSnapshot, syncSeed]);

  useEffect(() => {
    setSelectedAddOnIds(bookingAddOns.map((a) => a.id));
  }, [bookingAddOns]);

  useEffect(() => {
    if (!selectedBranch) {
      navigate(-1);
    }
  }, [selectedBranch, navigate]);

  const toggleAddOn = (id: string) => {
    setSelectedAddOnIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
    const addon = ADDONS.find((a) => a.id === id);
    if (addon) {
      toggleBookingAddOn({ id: addon.id, name: addon.name, price: addon.price });
    }
  };

  const handleContinue = () => {
    navigate('/datetime');
  };

  const count = selectedAddOnIds.length;

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
              className="text-xl font-normal leading-tight tracking-[0.04em] text-gray-900"
              style={{ ...headingFontStyle, color: NAVY }}
            >
              Add-ons
            </h1>
            <p className="mt-1 text-xs font-medium uppercase tracking-[0.16em] text-gray-500">
              Enhance your service (optional)
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 pb-32">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
          <BookingFlowSection
            icon={Layers}
            title="Select add-ons"
            titleClassName="font-normal tracking-[0.04em]"
            badge={count > 0 ? `${count} selected` : undefined}
            rootClassName="border border-white/70 shadow-[0_14px_36px_rgba(12,29,58,0.08),0_2px_8px_rgba(12,29,58,0.04)]"
          >
            <p className="-mt-1 mb-5 text-sm leading-relaxed text-gray-600">
              Customize your wash. Tap a card to include an add-on — you can pick several.
            </p>

            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-500">Quick actions</p>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const all = ADDONS.map((a) => ({ id: a.id, name: a.name, price: a.price }));
                    setSelectedAddOnIds(ADDONS.map((a) => a.id));
                    setBookingAddOns(all);
                  }}
                  className="rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all duration-200 hover:-translate-y-px active:translate-y-0"
                  style={{
                    background: NAVY_TINT,
                    color: NAVY,
                    borderColor: 'rgba(12,29,58,0.1)',
                    boxShadow: '0 2px 8px rgba(12,29,58,0.08)',
                  }}
                >
                  Select all
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedAddOnIds([]);
                    setBookingAddOns([]);
                  }}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 transition-all duration-200 hover:-translate-y-px hover:border-gray-300 hover:bg-gray-50 active:translate-y-0"
                >
                  Clear all
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {ADDONS.map((addon) => {
                const isSelected = selectedAddOnIds.includes(addon.id);
                return (
                  <button
                    key={addon.id}
                    type="button"
                    onClick={() => toggleAddOn(addon.id)}
                    aria-pressed={isSelected}
                    className={cn(
                      'group relative flex w-full flex-col rounded-2xl border p-5 text-left transition-all duration-200',
                      isSelected
                        ? 'shadow-[0_2px_10px_rgba(12,29,58,0.06)]'
                        : 'shadow-[0_1px_6px_rgba(12,29,58,0.04)] hover:-translate-y-0.5 hover:shadow-[0_8px_18px_rgba(12,29,58,0.07)]',
                    )}
                    style={{
                      borderWidth: 1,
                      borderColor: isSelected ? ADDON_CARD_BORDER_SELECTED : ADDON_CARD_BORDER,
                      background: isSelected ? ADDON_CARD_BG_SELECTED : ADDON_CARD_BG,
                    }}
                  >
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <span className="block break-words" style={addonTitleStyle}>
                          {addon.name}
                        </span>
                        {addon.description && (
                          <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-gray-500">
                            {addon.description}
                          </p>
                        )}
                      </div>
                      <span
                        className={cn(
                          'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-all duration-200',
                          !isSelected && 'border-gray-300 bg-white',
                        )}
                        style={
                          isSelected
                            ? { background: NAVY, borderColor: NAVY, borderWidth: 1 }
                            : { borderWidth: 1 }
                        }
                        aria-hidden
                      >
                        {isSelected ? (
                          <motion.span initial={{ scale: 0.85, opacity: 0.7 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.15 }}>
                            <Check className="h-4 w-4 text-white" strokeWidth={2.5} />
                          </motion.span>
                        ) : null}
                      </span>
                    </div>
                    <p className="tabular-nums" style={addonPriceStyle}>
                      +${Number(addon.price).toFixed(2)}
                    </p>
                  </button>
                );
              })}
            </div>
          </BookingFlowSection>
        </motion.div>
      </main>

      <footer className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-100 bg-white/95 p-4 shadow-[0_-10px_24px_rgba(12,29,58,0.08)] backdrop-blur-sm sm:p-6">
        <div className="mx-auto flex max-w-4xl flex-col gap-3 sm:flex-row sm:gap-4">
          <button
            type="button"
            onClick={() => {
              setSelectedAddOnIds([]);
              setBookingAddOns([]);
              handleContinue();
            }}
            className="w-full rounded-xl border border-gray-200 bg-white py-4 text-sm font-semibold text-gray-700 transition-all duration-200 hover:-translate-y-px hover:border-gray-300 hover:bg-gray-50 active:translate-y-0 sm:w-auto sm:min-w-[10rem] sm:flex-initial"
          >
            Skip add-ons
          </button>
          <button
            type="button"
            onClick={handleContinue}
            disabled={count === 0}
            className="w-full flex-1 rounded-xl py-4 text-sm font-semibold transition-all duration-200 hover:-translate-y-px active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50 sm:py-4"
            style={
              count > 0
                ? {
                    background: BTN_BG,
                    color: BTN_TEXT,
                    boxShadow: '0 8px 20px rgba(201,168,76,0.38)',
                  }
                : { background: '#f3f4f6', color: '#9ca3af' }
            }
          >
            {count > 0
              ? `Continue with ${count} item${count > 1 ? 's' : ''}`
              : 'Select an add-on or skip'}
          </button>
        </div>
      </footer>
    </div>
  );
}
