import { cn } from './ui/utils';

type Props = {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
};

/** Brand takeaway coffee SVG icon — hero pricing & service cards. */
export function TakeawayCoffeeIcon({ size = 20, className, style }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('shrink-0', className)}
      style={{ width: size, height: size, flexShrink: 0, ...style }}
    >
      <path d="M17 8h1a4 4 0 0 1 0 8h-1" />
      <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z" />
      <line x1="6" y1="2" x2="6" y2="4" />
      <line x1="10" y1="2" x2="10" y2="4" />
      <line x1="14" y1="2" x2="14" y2="4" />
    </svg>
  );
}
