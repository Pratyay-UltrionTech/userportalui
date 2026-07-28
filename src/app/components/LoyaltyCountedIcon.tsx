import type { SVGProps } from 'react';
import { cn } from './ui/utils';

type Props = SVGProps<SVGSVGElement> & {
  size?: number;
  strokeWidth?: number;
};

/** Medal + ribbon — matches lucide `Award` used on the select-service cards. */
export function LoyaltyCountedIcon({
  className,
  size = 14,
  strokeWidth = 2,
  ...props
}: Props) {
  return (
    <svg
      className={cn('shrink-0', className)}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      {...props}
    >
      <circle
        cx="12"
        cy="8"
        r="6"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="m15.477 12.89 1.515 8.526a.5.5 0 0 1-.81.47l-3.58-2.687a1 1 0 0 0-1.197 0l-3.586 2.686a.5.5 0 0 1-.81-.469l1.514-8.526"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
