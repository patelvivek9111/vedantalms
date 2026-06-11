import React, { useState, useRef, useEffect, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { isAtScrollTop, isElementScrollable } from '../../utils/scrollPosition';

export { getEffectiveScrollTop } from '../../utils/scrollPosition';

interface PullToRefreshProps {
  onRefresh: () => Promise<void> | void;
  children: ReactNode;
  disabled?: boolean;
  threshold?: number; // Distance in pixels to trigger refresh (default: 80)
  pullDownText?: string;
  releaseText?: string;
  refreshingText?: string;
  className?: string;
}

const PullToRefresh: React.FC<PullToRefreshProps> = ({
  onRefresh,
  children,
  disabled = false,
  threshold = 80,
  pullDownText = 'Pull down to refresh',
  releaseText = 'Release to refresh',
  refreshingText = 'Refreshing...',
  className = ''
}) => {
  const [isPulling, setIsPulling] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [canRefresh, setCanRefresh] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef<number>(0);
  const isDragging = useRef<boolean>(false);
  const isRefreshingRef = useRef(false);
  const canRefreshRef = useRef(false);
  const onRefreshRef = useRef(onRefresh);
  const [usesInternalScroll, setUsesInternalScroll] = useState(false);

  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateScrollMode = () => {
      setUsesInternalScroll(isElementScrollable(container));
    };

    updateScrollMode();

    if (typeof ResizeObserver === 'undefined') {
      return;
    }

    const observer = new ResizeObserver(updateScrollMode);
    observer.observe(container);

    return () => observer.disconnect();
  }, [children]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || disabled) return;

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      touchStartY.current = touch.clientY;
      isDragging.current = false;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (isRefreshingRef.current) {
        if (e.cancelable) {
          e.preventDefault();
        }
        return;
      }

      const touch = e.touches[0];
      const deltaY = touch.clientY - touchStartY.current;
      const atTop = isAtScrollTop(e.target);

      // Only allow pull-to-refresh when actually at the top and pulling down
      if (atTop && deltaY > 0) {
        isDragging.current = true;
        if (e.cancelable && deltaY > 10) {
          e.preventDefault();
        }

        const resistance = 0.5;
        const distance = Math.min(deltaY * resistance, threshold * 1.5);
        const refreshReady = distance >= threshold;

        setPullDistance(distance);
        setIsPulling(distance > 0);
        setCanRefresh(refreshReady);
        canRefreshRef.current = refreshReady;
      } else if (!atTop || deltaY <= 0) {
        isDragging.current = false;
        setPullDistance(0);
        setIsPulling(false);
        setCanRefresh(false);
        canRefreshRef.current = false;
      }
    };

    const handleTouchEnd = async () => {
      if (isRefreshingRef.current) return;

      if (canRefreshRef.current && isDragging.current) {
        isRefreshingRef.current = true;
        setIsRefreshing(true);
        setIsPulling(false);
        setPullDistance(0);
        setCanRefresh(false);
        canRefreshRef.current = false;

        try {
          await onRefreshRef.current();
        } catch (error) {
          console.error('Error refreshing:', error);
        } finally {
          isRefreshingRef.current = false;
          setIsRefreshing(false);
        }
      } else {
        setPullDistance(0);
        setIsPulling(false);
        setCanRefresh(false);
        canRefreshRef.current = false;
      }

      isDragging.current = false;
    };

    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd);
    container.addEventListener('touchcancel', handleTouchEnd);

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
      container.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [disabled, threshold]);

  const arrowRotation = Math.min((pullDistance / threshold) * 180, 180);
  const opacity = Math.min(pullDistance / threshold, 1);

  return (
    <div className={`relative ${className}`}>
      {(isPulling || isRefreshing) && (
        <div
          className="absolute top-0 left-0 right-0 flex items-center justify-center z-50 bg-white dark:bg-gray-800 transition-all duration-200"
          style={{
            height: `${Math.min(pullDistance, threshold * 1.5)}px`,
            opacity: opacity
          }}
        >
          <div className="flex flex-col items-center justify-center gap-2">
            {isRefreshing ? (
              <>
                <Loader2 className="w-5 h-5 text-blue-600 dark:text-blue-400 animate-spin" />
                <span className="text-xs text-gray-600 dark:text-gray-400">{refreshingText}</span>
              </>
            ) : (
              <>
                <div
                  className="transition-transform duration-200"
                  style={{ transform: `rotate(${arrowRotation}deg)` }}
                >
                  <svg
                    className="w-5 h-5 text-blue-600 dark:text-blue-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 14l-7 7m0 0l-7-7m7 7V3"
                    />
                  </svg>
                </div>
                <span className="text-xs text-gray-600 dark:text-gray-400">
                  {canRefresh ? releaseText : pullDownText}
                </span>
              </>
            )}
          </div>
        </div>
      )}

      <div
        ref={containerRef}
        className={usesInternalScroll ? 'min-h-0 overflow-auto touch-pan-y' : 'touch-pan-y'}
        style={{
          transform: isPulling && !isRefreshing ? `translateY(${Math.min(pullDistance, threshold * 1.5)}px)` : 'translateY(0)',
          transition: isRefreshing ? 'transform 0.3s ease-out' : 'none'
        }}
      >
        {children}
      </div>
    </div>
  );
};

export default PullToRefresh;
