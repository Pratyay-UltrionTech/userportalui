import { cn } from './ui/utils';
import { AppLogo } from './AppLogo';

type Props = {
  label?: string;
  className?: string;
};

export function BrandLoading({ label, className }: Props) {
  return (
    <div className={cn('flex flex-col items-center gap-4', className)}>
      <AppLogo variant="loader" className="opacity-[0.98]" />
      <div
        className="h-8 w-8 rounded-full border-[3px] border-slate-200 border-t-[#0c1d3a] animate-spin"
        aria-hidden
      />
      {label ? (
        <p className="text-[13px] font-medium text-slate-500 tracking-wide text-center">{label}</p>
      ) : null}
    </div>
  );
}
