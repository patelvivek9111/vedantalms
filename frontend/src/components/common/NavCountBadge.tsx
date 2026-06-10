import React from 'react';

interface NavCountBadgeProps {
  count: number;
  /** Ring color tuned for the parent surface */
  variant?: 'sidebar' | 'light' | 'dark';
  className?: string;
}

function formatBadgeLabel(count: number): string {
  if (count > 99) return '99+';
  if (count > 9) return '9+';
  return String(count);
}

const ringByVariant: Record<NonNullable<NavCountBadgeProps['variant']>, string> = {
  sidebar: 'ring-blue-900 dark:ring-gray-900',
  light: 'ring-white dark:ring-gray-900',
  dark: 'ring-gray-900',
};

/** Compact unread/count pill for nav icons — scales for single digits and 9+. */
export function NavCountBadge({ count, variant = 'light', className = '' }: NavCountBadgeProps) {
  if (count <= 0) return null;

  const label = formatBadgeLabel(count);
  const isCompact = label.length === 1;

  return (
    <span
      className={[
        'pointer-events-none absolute top-0 right-0 z-10',
        'flex items-center justify-center rounded-full',
        'bg-gradient-to-br from-rose-500 to-red-600 text-white',
        'text-[9px] font-semibold leading-none tabular-nums tracking-tight',
        'shadow-[0_1px_4px_rgba(15,23,42,0.45)]',
        'ring-[1.5px]',
        ringByVariant[variant],
        isCompact ? 'h-[15px] w-[15px]' : 'h-[15px] min-w-[15px] px-[3px]',
        className,
      ].join(' ')}
      style={{ transform: 'translate(42%, -38%)' }}
      aria-hidden
    >
      {label}
    </span>
  );
}
