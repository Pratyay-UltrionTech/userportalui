import type { ComponentType, CSSProperties, ReactNode } from 'react';
import { Check } from 'lucide-react';
import { headingFontStyle } from '../lib/branding';
import { cn } from './ui/utils';

/** Shared palette — Home, Profile, Service history, Branch selection */
export const BOOKING_NAVY = '#0c1d3a';
export const BOOKING_NAVY_MID = '#1a3560';
export const BOOKING_NAVY_TINT = '#e8eef8';
export const BOOKING_GOLD = '#c9a84c';
export const BOOKING_BTN_BG = '#c9a84c';
export const BOOKING_BTN_TEXT = '#0c1d3a';

/** Uniform body copy for booking summary cards (summary + payment pages). */
export const BOOKING_SUMMARY_BODY_CLASS = 'text-sm font-medium leading-snug text-gray-900';

/** Price breakdown rows (summary + payment pages) — matches {@link BOOKING_SUMMARY_BODY_CLASS}. */
export const BOOKING_PRICE_BODY_CLASS = BOOKING_SUMMARY_BODY_CLASS;

/** Short display id (last 6 hex chars of UUID), e.g. #F853BF — matches admin/manager portals.
 *  When customerId is provided, appends the last 4 hex chars of the customer UUID: #F853BF-A12C
 *  When guestPhone is provided (guest user, no customerId), derives a 4-char base-36 suffix from the phone. */
export function formatShortBookingId(id: string, customerId?: string | null, guestPhone?: string | null): string {
  const raw = String(id ?? '').trim();
  if (!raw || raw === '—') return '—';
  const hex = raw.replace(/-/g, '').slice(-6).toUpperCase();
  if (customerId) {
    const cid = String(customerId).replace(/-/g, '').slice(-4).toUpperCase();
    return `#${hex}-${cid}`;
  }
  if (guestPhone) {
    const digits = String(guestPhone).replace(/\D/g, '');
    if (digits) {
      const num = parseInt(digits.slice(-9), 10);
      const suffix = num.toString(36).toUpperCase().slice(-4).padStart(4, '0');
      return `#${hex}-${suffix}`;
    }
  }
  return `#${hex}`;
}

export type PaymentMethodId = 'later' | 'card' | 'apple';

const PAYMENT_METHOD_LABELS: Record<PaymentMethodId, string> = {
  later: 'Pay After Service',
  card: 'Credit / Debit Card',
  apple: 'Apple Pay',
};

export function getPaymentMethodLabel(id?: string | null): string {
  if (!id) return PAYMENT_METHOD_LABELS.later;
  return PAYMENT_METHOD_LABELS[id as PaymentMethodId] ?? id;
}

/** Single consolidated confirmation / receipt body (sections separated by dividers). */
export function BookingConfirmationCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn('overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm', className)}
      style={{ borderLeftWidth: 4, borderLeftColor: BOOKING_NAVY, borderLeftStyle: 'solid' }}
    >
      <div className="divide-y divide-gray-100">{children}</div>
    </div>
  );
}

/** One titled block inside {@link BookingConfirmationCard}. */
export function BookingConfirmationBlock({
  title,
  badge,
  children,
  className,
}: {
  title: string;
  badge?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('px-5 py-4 sm:px-6 sm:py-5', className)}>
      <div className="mb-2.5 flex flex-wrap items-center gap-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">{title}</h3>
        {badge ? (
          <span
            className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
            style={{ background: BOOKING_NAVY_TINT, color: BOOKING_NAVY_MID }}
          >
            {badge}
          </span>
        ) : null}
      </div>
      {children}
    </div>
  );
}

const BOOKING_FLOW_STEPS = ['Vehicle', 'Details', 'Package'] as const;

/** Simple 1–2–3 progress row for vehicle & service selection. */
export function BookingStepIndicator({ currentStep }: { currentStep: 1 | 2 | 3 }) {
  return (
    <nav aria-label="Booking progress" className="flex items-start justify-center">
      {BOOKING_FLOW_STEPS.map((label, index) => {
        const step = (index + 1) as 1 | 2 | 3;
        const isComplete = step < currentStep;
        const isCurrent = step === currentStep;

        return (
          <div key={label} className="flex items-start">
            {index > 0 ? (
              <div
                className="mx-2 mt-[18px] h-0.5 w-8 shrink-0 rounded-full sm:w-12"
                style={{
                  background:
                    step <= currentStep ? 'rgba(12, 29, 58, 0.55)' : 'rgba(12, 29, 58, 0.12)',
                }}
                aria-hidden
              />
            ) : null}
            <div className="flex min-w-[4.75rem] flex-col items-center gap-1.5 sm:min-w-[5.25rem]">
              <span
                className={cn(
                  'flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold tabular-nums transition-colors',
                  isCurrent ? 'ring-2 ring-offset-2' : '',
                )}
                style={{
                  background: isComplete || isCurrent ? BOOKING_NAVY : BOOKING_NAVY_TINT,
                  color: isComplete || isCurrent ? '#fff' : BOOKING_NAVY_MID,
                  ...(isCurrent ? { boxShadow: '0 0 0 2px rgba(201,168,76,0.45)' } : {}),
                }}
                aria-current={isCurrent ? 'step' : undefined}
              >
                {isComplete ? <Check className="size-4" strokeWidth={3} aria-hidden /> : step}
              </span>
              <span
                className={cn(
                  'text-center text-[10px] font-semibold uppercase tracking-wider',
                  isCurrent ? 'text-gray-800' : 'text-gray-400',
                )}
              >
                {label}
              </span>
            </div>
          </div>
        );
      })}
    </nav>
  );
}

/** Section shell — white card, navy left accent, Bebas Neue title */
export function BookingFlowSection({
  icon: Icon,
  title,
  step,
  badge,
  headerTrailing,
  children,
  rootClassName,
  bodyClassName,
  titleClassName,
}: {
  icon: ComponentType<{ className?: string; style?: CSSProperties }>;
  title: string;
  /** Booking flow step number shown in the card header (e.g. 1, 2, 3). */
  step?: number;
  badge?: string;
  /** e.g. Edit control — rendered before the optional badge, right-aligned. */
  headerTrailing?: ReactNode;
  children: ReactNode;
  rootClassName?: string;
  bodyClassName?: string;
  /** Optional override for the section title (e.g. lighter Bebas Neue weight). */
  titleClassName?: string;
}) {
  return (
    <div className={cn('bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden', rootClassName)}>
      <div
        className="relative px-5 sm:px-6 py-4 flex items-center gap-3 border-b border-gray-100"
        style={{ borderLeftWidth: 4, borderLeftColor: BOOKING_NAVY, borderLeftStyle: 'solid' }}
      >
        <span
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: BOOKING_NAVY_TINT }}
        >
          <Icon className="w-4 h-4" style={{ color: BOOKING_NAVY }} />
        </span>
        <h2
          className={cn('min-w-0 flex-1 text-xl font-normal tracking-[0.04em]', titleClassName)}
          style={{ ...headingFontStyle, color: BOOKING_NAVY }}
        >
          {title}
        </h2>
        {step != null ? (
          <span
            className="pointer-events-none absolute left-1/2 top-1/2 inline-flex min-w-[4.25rem] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full px-2.5 py-0.5 text-center text-[11px] font-semibold tabular-nums tracking-wide"
            style={{ background: 'rgba(12, 29, 58, 0.14)', color: BOOKING_NAVY }}
            aria-label={`Step ${step}`}
          >
            Step {step}
          </span>
        ) : null}
        {badge || headerTrailing ? (
          <div className="flex shrink-0 items-center gap-2">
            {badge ? (
              <span
                className="rounded-full px-2.5 py-0.5 text-xs font-medium"
                style={{ background: BOOKING_NAVY_TINT, color: BOOKING_NAVY_MID }}
              >
                {badge}
              </span>
            ) : null}
            {headerTrailing}
          </div>
        ) : null}
      </div>
      <div className={cn('px-5 sm:px-6 py-6', bodyClassName)}>{children}</div>
    </div>
  );
}
