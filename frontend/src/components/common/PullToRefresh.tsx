import React, { useState, useRef, useEffect, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

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
  const scrollTop = useRef<number>(0);
  const isDragging = useRef<boolean>(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || disabled) return;

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      touchStartY.current = touch.clientY;
      scrollTop.current = container.scrollTop;
      isDragging.current = false;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (isRefreshing) {
        // Only preventDefault if event is cancelable
        if (e.cancelable) {
          e.preventDefault();
        }
        return;
      }

      const touch = e.touches[0];
      const deltaY = touch.clientY - touchStartY.current;
      
      // Update scroll position
      scrollTop.current = container.scrollTop;
      
      // Only allow pull-to-refresh if scrolled to top and pulling down
      if (scrollTop.current <= 0 && deltaY > 0) {
        isDragging.current = true;
        // Only preventDefault if event is cancelable and we're actually pulling (not just starting)
        // This prevents the warning when scrolling is already in progress
        if (e.cancelable && deltaY > 10) {
          e.preventDefault();
        }
        
        // Calculate pull distance with resistance
        const resistance = 0.5; // Resistance factor for smoother feel
        const distance = Math.min(deltaY * resistance, threshold * 1.5);
        
        setPullDistance(distance);
        setIsPulling(distance > 0);
        setCanRefresh(distance >= threshold);
      } else if (scrollTop.current > 0 || deltaY <= 0) {
        // Reset if scrolled down or swiping up
        isDragging.current = false;
        setPullDistance(0);
        setIsPulling(false);
        setCanRefresh(false);
      }
    };

    const handleTouchEnd = async () => {
      if (isRefreshing) return;

      if (canRefresh && isDragging.current) {
        setIsRefreshing(true);
        setIsPulling(false);
        setPullDistance(0);
        setCanRefresh(false);
        
        try {
          await onRefresh();
        } catch (error) {
          console.error('Error refreshing:', error);
        } finally {
          setIsRefreshing(false);
        }
      } else {
        // Reset if not refreshing
        setPullDistance(0);
        setIsPulling(false);
        setCanRefresh(false);
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
  }, [disabled, isRefreshing, canRefresh, threshold, onRefresh]);

  // Calculate rotation for arrow icon
  const arrowRotation = Math.min((pullDistance / threshold) * 180, 180);
  const opacity = Math.min(pullDistance / threshold, 1);

  return (
    <div className={`relative ${className}`}>
      {/* Pull to refresh indicator */}
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
      
      {/* Content container */}
      <div
        ref={containerRef}
        className="overflow-auto"
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

