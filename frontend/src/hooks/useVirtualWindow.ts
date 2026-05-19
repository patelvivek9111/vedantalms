import { useCallback, useMemo, useState } from 'react';

export interface VirtualWindowOptions {
  itemCount: number;
  estimatedItemHeight: number;
  containerHeight: number;
  threshold?: number;
  buffer?: number;
}

/**
 * Lightweight row windowing (same approach as DataTable virtual scroll).
 */
export function useVirtualWindow({
  itemCount,
  estimatedItemHeight,
  containerHeight,
  threshold = 50,
  buffer = 5,
}: VirtualWindowOptions) {
  const [scrollTop, setScrollTop] = useState(0);
  const enabled = itemCount >= threshold;

  const range = useMemo(() => {
    if (!enabled) return { start: 0, end: itemCount, paddingTop: 0, paddingBottom: 0 };

    const visibleCount = Math.ceil(containerHeight / estimatedItemHeight);
    const start = Math.max(0, Math.floor(scrollTop / estimatedItemHeight) - buffer);
    const end = Math.min(itemCount, start + visibleCount + buffer * 2);
    const paddingTop = start * estimatedItemHeight;
    const paddingBottom = Math.max(0, (itemCount - end) * estimatedItemHeight);

    return { start, end, paddingTop, paddingBottom };
  }, [enabled, scrollTop, itemCount, estimatedItemHeight, containerHeight, buffer]);

  const onScroll = useCallback(
    (e: React.UIEvent<HTMLElement>) => {
      if (enabled) setScrollTop(e.currentTarget.scrollTop);
    },
    [enabled]
  );

  return { enabled, range, onScroll };
}
