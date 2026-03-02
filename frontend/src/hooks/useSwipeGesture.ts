import { useRef, useCallback } from 'react';

export interface SwipeGestureOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  threshold?: number; // Minimum distance in pixels to trigger swipe (default: 50)
  velocityThreshold?: number; // Minimum velocity to trigger swipe (default: 0.3)
  preventDefault?: boolean; // Prevent default touch behavior (default: true)
  enabled?: boolean; // Enable/disable swipe detection (default: true)
}

export interface SwipeGestureResult {
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onTouchEnd: (e: React.TouchEvent) => void;
}

export const useSwipeGesture = (options: SwipeGestureOptions = {}): SwipeGestureResult => {
  const {
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onSwipeDown,
    threshold = 50,
    velocityThreshold = 0.3,
    preventDefault = true,
    enabled = true
  } = options;

  const touchStart = useRef<{ x: number; y: number; time: number } | null>(null);
  const touchMove = useRef<{ x: number; y: number; time: number } | null>(null);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (!enabled) return;
    
    const touch = e.touches[0];
    touchStart.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now()
    };
    touchMove.current = null;
  }, [enabled]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!enabled || !touchStart.current) return;
    
    if (preventDefault) {
      e.preventDefault();
    }
    
    const touch = e.touches[0];
    touchMove.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now()
    };
  }, [enabled, preventDefault]);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!enabled || !touchStart.current) return;
    
    if (!touchMove.current) {
      touchStart.current = null;
      return;
    }

    const deltaX = touchMove.current.x - touchStart.current.x;
    const deltaY = touchMove.current.y - touchStart.current.y;
    const deltaTime = touchMove.current.time - touchStart.current.time;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    const velocity = distance / deltaTime;

    // Determine if horizontal or vertical swipe is dominant
    const isHorizontalSwipe = Math.abs(deltaX) > Math.abs(deltaY);
    
    // Check if swipe meets threshold requirements
    if (distance >= threshold && velocity >= velocityThreshold) {
      if (isHorizontalSwipe) {
        if (deltaX > 0 && onSwipeRight) {
          onSwipeRight();
        } else if (deltaX < 0 && onSwipeLeft) {
          onSwipeLeft();
        }
      } else {
        if (deltaY > 0 && onSwipeDown) {
          onSwipeDown();
        } else if (deltaY < 0 && onSwipeUp) {
          onSwipeUp();
        }
      }
    }

    touchStart.current = null;
    touchMove.current = null;
  }, [enabled, threshold, velocityThreshold, onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown]);

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd
  };
};

