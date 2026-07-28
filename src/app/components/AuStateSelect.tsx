import type { CSSProperties } from 'react';
import { AU_STATES } from '../lib/addressDetails';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { cn } from './ui/utils';

/** Sentinel — Radix Select requires a string value; maps to empty state. */
const EMPTY_VALUE = '__au_state_empty__';

type AuStateSelectProps = {
  value: string;
  onChange: (code: string) => void;
  onBlur?: () => void;
  className?: string;
  hasError?: boolean;
  focusStyle?: CSSProperties;
  /** e.g. `NSW (New South Wales)` for payment guest form */
  formatOption?: (state: { code: string; name: string }) => string;
};

export function AuStateSelect({
  value,
  onChange,
  onBlur,
  className,
  hasError,
  focusStyle,
  formatOption,
}: AuStateSelectProps) {
  const format = formatOption ?? ((s) => `${s.code} — ${s.name}`);

  return (
    <Select
      value={value || EMPTY_VALUE}
      onValueChange={(v) => onChange(v === EMPTY_VALUE ? '' : v)}
      onOpenChange={(open) => {
        if (!open) onBlur?.();
      }}
    >
      <SelectTrigger
        aria-label="State"
        style={focusStyle}
        className={cn(
          'h-auto w-full rounded-xl border bg-white px-4 py-3 text-sm shadow-none focus:ring-2 focus:ring-offset-0 [&>svg]:size-4 [&>svg]:opacity-60',
          !value ? 'text-gray-400' : 'text-gray-900',
          hasError ? 'border-red-400 bg-red-50' : 'border-gray-300 hover:border-gray-400',
          className,
        )}
      >
        <SelectValue placeholder="Select state" />
      </SelectTrigger>
      <SelectContent
        position="popper"
        sideOffset={6}
        align="start"
        className={cn(
          'z-[200] max-h-[min(18rem,var(--radix-select-content-available-height))] overflow-y-auto rounded-xl border border-gray-200 bg-white p-1.5 shadow-lg',
          'min-w-[var(--radix-select-trigger-width)]',
        )}
      >
        <SelectItem
          value={EMPTY_VALUE}
          className="cursor-pointer rounded-lg py-2.5 pl-3 pr-8 text-sm text-gray-500 outline-none data-[highlighted]:bg-[#e8eef8] data-[highlighted]:text-[#0c1d3a]"
        >
          Select state
        </SelectItem>
        {AU_STATES.map((s) => (
          <SelectItem
            key={s.code}
            value={s.code}
            className="cursor-pointer rounded-lg py-2.5 pl-3 pr-8 text-sm text-gray-900 outline-none data-[highlighted]:bg-[#e8eef8] data-[highlighted]:text-[#0c1d3a] data-[state=checked]:bg-[#f8f9fc] data-[state=checked]:font-semibold data-[state=checked]:text-[#0c1d3a]"
          >
            {format(s)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
