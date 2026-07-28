import type { CSSProperties } from 'react';
import { ArrowLeft } from 'lucide-react';
import { HEADING_FONT_FAMILY } from '../lib/branding';
import { AppLogo } from './AppLogo';
import { cn } from './ui/utils';

type Props = {
  title: string;
  subtitle: string;
  onBack?: () => void;
  backAriaLabel?: string;
  titleStyle?: CSSProperties;
  className?: string;
};

export function BookingFlowBrandedHeader({
  title,
  subtitle,
  onBack,
  backAriaLabel = 'Back',
  titleStyle,
  className,
}: Props) {
  return (
    <header className={cn('sticky top-0 z-40 border-b border-gray-100 bg-white/95 backdrop-blur-sm', className)}>
      <div className="max-w-4xl mx-auto flex items-center gap-3 px-4 py-4">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-600 transition hover:border-gray-300 hover:bg-gray-50"
            aria-label={backAriaLabel}
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        ) : null}
        <div className="min-w-0 flex-1">
          <h1
            className="text-xl font-bold text-gray-900"
            style={{ fontFamily: HEADING_FONT_FAMILY, ...titleStyle }}
          >
            {title}
          </h1>
          <p className="text-xs font-medium uppercase tracking-wider text-gray-500">{subtitle}</p>
        </div>
        <AppLogo variant="mark" className="hidden shrink-0 sm:block" />
      </div>
    </header>
  );
}
