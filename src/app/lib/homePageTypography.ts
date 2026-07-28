import { HEADING_FONT_FAMILY } from './branding';

/**
 * Home page typography scale (~+25–30% vs. previous sizes).
 * Use these tokens on HomePage only — keeps booking flow pages unchanged.
 */
export const homePageType = {
  /** Hero — ~30% larger than previous text-2xl (24px) */
  heroTitle:
    'text-[1.875rem] leading-[1.15] sm:text-[2.125rem] md:text-[2.375rem] font-normal tracking-[0.03em] text-balance',
  heroSubtitle: 'text-base sm:text-lg leading-relaxed font-medium text-gray-500 mt-1.5',

  /** Promo banner — label < headline < body */
  offerLabel: 'text-sm font-bold uppercase tracking-wider px-3 py-1 rounded-full',
  offerHeadline: 'text-xl sm:text-2xl font-normal leading-snug',
  offerBody: 'text-base sm:text-lg leading-relaxed mt-1',

  /** Major section headers */
  sectionTitle: 'text-xl sm:text-2xl font-normal tracking-[0.03em]',
  sectionSubtitle: 'text-sm sm:text-base text-gray-500 leading-relaxed',

  /** Service cards — shared branch + mobile (tracking matches sectionTitle / Current Offers) */
  cardBadge: 'text-sm font-semibold px-3 py-1 rounded-full',
  cardTitle: 'text-xl sm:text-2xl font-normal leading-snug tracking-[0.03em]',
  cardBody: 'text-base sm:text-lg leading-snug',
  cardFeature: 'text-base leading-relaxed',
  cardStat: 'text-xl sm:text-2xl font-bold tabular-nums leading-tight',
  cardStatSuffix: 'text-lg font-medium',
  cardFooter: 'text-sm sm:text-base leading-normal',
  cardCta: 'text-sm sm:text-base font-semibold',

  /** Buttons & postcode input */
  input:
    'h-[3.25rem] sm:h-14 w-full rounded-xl border pl-10 pr-4 text-base leading-normal text-gray-900 outline-none transition-all focus:border-transparent focus:ring-2',
  btn: 'flex h-[3.25rem] sm:h-14 w-full shrink-0 items-center justify-center gap-2 rounded-xl text-base font-semibold leading-none transition-all disabled:cursor-not-allowed disabled:opacity-50',

  /** Marquee offer tiles */
  marqueeTitle: 'font-semibold text-gray-900 leading-snug text-base sm:text-lg mb-1',
  marqueeMeta: 'flex items-center gap-1.5 text-sm text-gray-500 mb-1',
  marqueeMetaMuted: 'flex items-center gap-1.5 text-sm text-gray-400',
  marqueeDiscount: 'rounded-full bg-white px-3 py-1 shadow-sm text-sm font-bold',
  marqueeScope: 'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold sm:text-sm',

  /** Form helpers on home mobile card */
  formHint: 'text-sm text-gray-600 leading-relaxed',
  formError: 'text-sm text-red-500 flex items-center gap-1.5 leading-snug',
  savedSectionLabel: 'text-sm font-semibold uppercase tracking-wider',
  savedAddrTitle: 'text-sm font-semibold',
  savedAddrLine: 'text-sm text-gray-500 mt-0.5 leading-snug',
  textLink: 'text-sm font-semibold underline-offset-2 hover:underline',

  emptyState: 'text-base text-gray-400',
} as const;

/** Bebas Neue for display headings on the home page */
export const homeHeadingStyle = {
  fontFamily: HEADING_FONT_FAMILY,
  letterSpacing: '0.03em',
} as const;
