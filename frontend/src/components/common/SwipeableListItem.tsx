import React, { useState, useRef, useEffect } from 'react';
import { useSwipeGesture } from '../../hooks/useSwipeGesture';
import { hapticNavigation } from '../../utils/hapticFeedback';

interface SwipeableListItemProps {
  children: React.ReactNode;
  leftActions?: React.ReactNode; // Actions shown when swiping right (revealing left side)
  rightActions?: React.ReactNode; // Actions shown when swiping left (revealing right side)
  onSwipeLeft?: () => void; // Callback when swiped left
  onSwipeRight?: () => void; // Callback when swiped right
  threshold?: number; // Minimum swipe distance (default: 80)
  enabled?: boolean; // Enable/disable swipe (default: true)
  className?: string;
  actionWidth?: number; // Width of action area (default: 80)
}

const SwipeableListItem: React.FC<SwipeableListItemProps> = ({
  children,
  leftActions,
  rightActions,
  onSwipeLeft,
  onSwipeRight,
  threshold = 80,
  enabled = true,
  className = '',
  actionWidth = 80
}) => {
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number>(0);
  const currentOffset = useRef<number>(0);
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  // Reset swipe when enabled changes
  useEffect(() => {
    if (!enabled) {
      setSwipeOffset(0);
      currentOffset.current = 0;
    }
  }, [enabled]);

  const handleSwipeLeft = () => {
    if (!enabled || !isMobile) return;
    
    if (rightActions && currentOffset.current >= 0) {
      // Swipe left to reveal right actions
      const targetOffset = -actionWidth;
      setSwipeOffset(targetOffset);
      currentOffset.current = targetOffset;
      hapticNavigation();
      onSwipeLeft?.();
    } else if (leftActions && currentOffset.current < 0) {
      // Already showing right actions, reset
      setSwipeOffset(0);
      currentOffset.current = 0;
      hapticNavigation();
    }
  };

  const handleSwipeRight = () => {
    if (!enabled || !isMobile) return;
    
    if (leftActions && currentOffset.current <= 0) {
      // Swipe right to reveal left actions
      const targetOffset = actionWidth;
      setSwipeOffset(targetOffset);
      currentOffset.current = targetOffset;
      hapticNavigation();
      onSwipeRight?.();
    } else if (rightActions && currentOffset.current > 0) {
      // Already showing left actions, reset
      setSwipeOffset(0);
      currentOffset.current = 0;
      hapticNavigation();
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!enabled || !isMobile) return;
    const touch = e.touches[0];
    touchStartX.current = touch.clientX;
    setIsSwiping(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!enabled || !isMobile || !isSwiping) return;
    
    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStartX.current;
    
    // Calculate new offset with resistance
    let newOffset = currentOffset.current + deltaX;
    
    // Apply boundaries with resistance
    if (rightActions && leftActions) {
      // Both actions available - allow swiping in both directions
      newOffset = Math.max(-actionWidth, Math.min(actionWidth, newOffset));
    } else if (rightActions) {
      // Only right actions - only allow left swipe
      newOffset = Math.max(-actionWidth, Math.min(0, newOffset));
    } else if (leftActions) {
      // Only left actions - only allow right swipe
      newOffset = Math.max(0, Math.min(actionWidth, newOffset));
    } else {
      // No actions - reset
      newOffset = 0;
    }
    
    setSwipeOffset(newOffset);
  };

  const handleTouchEnd = () => {
    if (!enabled || !isMobile) return;
    
    setIsSwiping(false);
    
    // Snap to nearest position
    const threshold = actionWidth * 0.3; // 30% of action width
    
    if (swipeOffset < -threshold && rightActions) {
      // Snap to show right actions
      setSwipeOffset(-actionWidth);
      currentOffset.current = -actionWidth;
      hapticNavigation();
      onSwipeLeft?.();
    } else if (swipeOffset > threshold && leftActions) {
      // Snap to show left actions
      setSwipeOffset(actionWidth);
      currentOffset.current = actionWidth;
      hapticNavigation();
      onSwipeRight?.();
    } else {
      // Snap back to center
      setSwipeOffset(0);
      currentOffset.current = 0;
    }
    
    touchStartX.current = 0;
  };

  const handleReset = () => {
    setSwipeOffset(0);
    currentOffset.current = 0;
  };

  // Auto-reset when clicking outside
  useEffect(() => {
    if (!enabled || !isMobile) return;
    
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        handleReset();
      }
    };
    
    if (swipeOffset !== 0) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [swipeOffset, enabled, isMobile]);

  if (!enabled || !isMobile || (!leftActions && !rightActions)) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden ${className}`}
      style={{ touchAction: 'pan-y' }}
    >
      {/* Left Actions */}
      {leftActions && (
        <div
          className="absolute left-0 top-0 bottom-0 flex items-center bg-gradient-to-r from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 z-10 shadow-lg"
          style={{
            width: `${actionWidth}px`,
            transform: `translateX(${swipeOffset > 0 ? 0 : swipeOffset}px)`,
            transition: isSwiping ? 'none' : 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
          }}
        >
          <div className="flex items-center justify-center w-full h-full gap-2 px-2">
            {leftActions}
          </div>
        </div>
      )}

      {/* Right Actions */}
      {rightActions && (
        <div
          className="absolute right-0 top-0 bottom-0 flex items-center bg-gray-100 dark:bg-gray-800 z-10"
          style={{
            width: `${actionWidth}px`,
            transform: `translateX(${swipeOffset < 0 ? 0 : swipeOffset}px)`,
            transition: isSwiping ? 'none' : 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
          }}
        >
          <div className="flex items-center justify-center w-full h-full gap-2 px-2">
            {rightActions}
          </div>
        </div>
      )}

      {/* Main Content */}
      <div
        className="relative bg-white dark:bg-gray-800 z-20"
        style={{
          transform: `translateX(${swipeOffset}px)`,
          transition: isSwiping ? 'none' : 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          boxShadow: swipeOffset !== 0 ? '0 2px 8px rgba(0, 0, 0, 0.1)' : 'none'
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {children}
      </div>
    </div>
  );
};

export default SwipeableListItem;

