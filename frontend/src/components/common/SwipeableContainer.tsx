import React, { ReactNode } from 'react';
import { useSwipeGesture, SwipeGestureOptions } from '../../hooks/useSwipeGesture';

interface SwipeableContainerProps {
  children: ReactNode;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  threshold?: number;
  velocityThreshold?: number;
  enabled?: boolean;
  className?: string;
  preventScrollInterference?: boolean; // Prevent swipe from interfering with scrolling
}

const SwipeableContainer: React.FC<SwipeableContainerProps> = ({
  children,
  onSwipeLeft,
  onSwipeRight,
  onSwipeUp,
  onSwipeDown,
  threshold = 50,
  velocityThreshold = 0.3,
  enabled = true,
  className = '',
  preventScrollInterference = true
}) => {
  const swipeHandlers = useSwipeGesture({
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onSwipeDown,
    threshold,
    velocityThreshold,
    preventDefault: !preventScrollInterference, // Only prevent default if not preventing scroll interference
    enabled
  });

  return (
    <div
      className={className}
      onTouchStart={swipeHandlers.onTouchStart}
      onTouchMove={swipeHandlers.onTouchMove}
      onTouchEnd={swipeHandlers.onTouchEnd}
    >
      {children}
    </div>
  );
};

export default SwipeableContainer;

