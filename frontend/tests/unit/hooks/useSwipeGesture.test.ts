import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { TouchEvent as ReactTouchEvent } from 'react';
import { useSwipeGesture } from '@/hooks/useSwipeGesture';

describe('useSwipeGesture', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('stops tracking when the gesture is clearly vertical', () => {
    const onSwipeLeft = vi.fn();
    const { result } = renderHook(() =>
      useSwipeGesture({
        onSwipeLeft,
        preventDefault: true,
      })
    );

    result.current.onTouchStart({
      touches: [{ clientX: 100, clientY: 100 }],
    } as unknown as ReactTouchEvent);

    result.current.onTouchMove({
      touches: [{ clientX: 102, clientY: 140 }],
      preventDefault: vi.fn(),
    } as unknown as ReactTouchEvent);

    result.current.onTouchEnd({} as ReactTouchEvent);

    expect(onSwipeLeft).not.toHaveBeenCalled();
  });
});
