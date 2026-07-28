import { useMemo } from 'react';
import { Check, X } from 'lucide-react';
import { flattenStoredServiceLines, parseServiceDetailRows } from '../lib/serviceDetailsFormat';
import { LoyaltyCountedIcon } from './LoyaltyCountedIcon';
import { TakeawayCoffeeIcon } from './TakeawayCoffeeIcon';
import '../styles/servicePricingCard.css';

function CoffeeCupIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"
      stroke="#92650a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 8h1a4 4 0 0 1 0 8h-1" />
      <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z" />
      <line x1="6" y1="2" x2="6" y2="4" />
      <line x1="10" y1="2" x2="10" y2="4" />
      <line x1="14" y1="2" x2="14" y2="4" />
    </svg>
  );
}

const NAVY = '#0c1d3a';

function formatPrice(price: number) {
  return price % 1 === 0 ? `$${price.toFixed(0)}` : `$${price.toFixed(2)}`;
}

function formatDuration(durationMinutes?: number, durationLabel?: string) {
  if (durationLabel?.trim()) {
    return durationLabel
      .replace(/^duration:\s*/i, '')
      .replace(/\s*mins?\s*$/i, ' min')
      .trim();
  }
  const minutes = Number(durationMinutes ?? 0);
  return minutes > 0 ? `${minutes} min` : '';
}

export type ServicePricingCardProps = {
  title: string;
  price: number;
  durationMinutes?: number;
  /** Optional preformatted duration (e.g. from booking flow). */
  duration?: string;
  descriptionPoints?: string[];
  excludedPoints?: string[];
  features?: string[];
  excludedFeatures?: string[];
  recommended?: boolean;
  badge?: string;
  freeCoffeeCount?: number;
  eligibleForLoyaltyPoints?: boolean;
  takeawayCoffeeIcon?: boolean;
  isSelected: boolean;
  onClick: () => void;
};

function ServiceDetailRows({
  descriptionPoints,
  excludedPoints,
}: {
  descriptionPoints: string[];
  excludedPoints: string[];
}) {
  const rows = useMemo(
    () => parseServiceDetailRows(flattenStoredServiceLines(descriptionPoints, excludedPoints)),
    [descriptionPoints, excludedPoints],
  );

  if (!rows.length) return null;

  return (
    <div className="ps-detail-rows">
      {rows.map((row, i) => {
        const prev = i > 0 ? rows[i - 1] : null;
        if (row.kind === 'heading') {
          return (
            <div key={i} className={`ps-row-heading${i > 0 ? ' ps-row-heading--gap' : ''}`}>
              <p className="ps-row-heading-text">{row.text}</p>
            </div>
          );
        }
        if (row.kind === 'included') {
          return (
            <div
              key={i}
              className={`ps-row-item${prev?.kind === 'excluded' ? ' ps-row-item--gap-included-after-excluded' : ''}`}
            >
              <span className="ps-row-check">
                <Check size={14} color={NAVY} strokeWidth={3} aria-hidden />
              </span>
              <span className="ps-row-text">{row.text}</span>
            </div>
          );
        }
        return (
          <div
            key={i}
            className={`ps-row-item${prev?.kind === 'included' || prev?.kind === 'heading' ? ' ps-row-item--gap' : ''}`}
          >
            <span className="ps-row-check">
              <X size={14} color="#c4cad4" strokeWidth={2.5} aria-hidden />
            </span>
            <span className="ps-row-text ps-row-text--excluded">{row.text}</span>
          </div>
        );
      })}
    </div>
  );
}

export function ServicePricingCard({
  title,
  price,
  durationMinutes,
  duration,
  descriptionPoints,
  excludedPoints,
  features,
  excludedFeatures,
  recommended,
  badge,
  freeCoffeeCount = 0,
  eligibleForLoyaltyPoints = false,
  takeawayCoffeeIcon = false,
  isSelected,
  onClick,
}: ServicePricingCardProps) {
  const included = descriptionPoints ?? features ?? [];
  const excluded = excludedPoints ?? excludedFeatures ?? [];
  const showRecommended = recommended === true || Boolean(badge);
  const badgeLabel = badge ?? (recommended ? 'Recommended' : undefined);
  const coffeeCount = Math.max(0, Math.floor(Number(freeCoffeeCount ?? 0)));
  const hasCoffee = coffeeCount > 0;
  const hasLoyalty = eligibleForLoyaltyPoints === true;
  const priceDisplay = formatPrice(Number(price));
  const durationDisplay = formatDuration(durationMinutes, duration);

  return (
    <button
      type="button"
      className={`ps-card${isSelected ? ' ps-card--selected' : ''}${showRecommended ? ' ps-card--recommended' : ''}`}
      onClick={onClick}
      aria-pressed={isSelected}
      aria-label={`${title}, ${priceDisplay}${durationDisplay ? `, ${durationDisplay}` : ''}`}
    >
      {badgeLabel ? <span className="ps-card-badge">{badgeLabel}</span> : null}
      <div className="ps-card-head">
        <div className="ps-card-topline">
          <h3 className="ps-card-title">{title}</h3>
        </div>
        <div className="ps-card-price-row">
          <div className="ps-card-meta">
            <span className="ps-card-price">{priceDisplay}</span>
          </div>
          <div className="ps-card-perks">
            {hasCoffee ? (
              <span
                className="ps-card-perk ps-card-perk--coffee"
                title={`Complimentary takeaway coffee${coffeeCount > 1 ? ` (×${coffeeCount})` : ''}`}
                aria-label="Complimentary takeaway coffee"
              >
                {takeawayCoffeeIcon ? (
                  <TakeawayCoffeeIcon size={18} style={{ color: '#92650a' }} />
                ) : (
                  <CoffeeCupIcon />
                )}
              </span>
            ) : null}
            {hasLoyalty ? (
              <span className="ps-card-perk ps-card-perk--loyalty" title="Loyalty counted" aria-label="Loyalty counted">
                <LoyaltyCountedIcon size={14} style={{ color: '#92650a' }} />
              </span>
            ) : null}
            {!hasCoffee && !hasLoyalty ? (
              <span className="ps-card-perk ps-card-perk--placeholder" aria-hidden />
            ) : null}
          </div>
        </div>
      </div>

      <div className="ps-card-body">
        <ServiceDetailRows descriptionPoints={included} excludedPoints={excluded} />
        {durationDisplay ? (
          <div className="ps-card-duration-row">
            <span className="ps-card-duration-text">Duration: {durationDisplay}</span>
          </div>
        ) : null}
      </div>
    </button>
  );
}
