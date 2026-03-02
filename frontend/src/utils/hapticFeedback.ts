/**
 * Haptic Feedback Utility
 * Provides vibration feedback for mobile devices using the Vibration API
 */

export type HapticPattern = 'light' | 'medium' | 'heavy' | 'success' | 'error' | 'warning';

/**
 * Check if the device supports vibration
 */
export const isVibrationSupported = (): boolean => {
  return 'vibrate' in navigator;
};

// Track if we're in a user gesture context
// Chrome requires vibration to be called within a user gesture
let hasUserInteracted = false;

// Initialize user interaction tracking
if (typeof window !== 'undefined') {
  const enableVibration = () => {
    hasUserInteracted = true;
    // Keep the flag active for a reasonable time window
    setTimeout(() => {
      hasUserInteracted = true; // Keep it true after user interaction
    }, 100);
  };

  // Listen for user interaction events to enable vibration
  ['touchstart', 'touchend', 'mousedown', 'click', 'keydown'].forEach(eventType => {
    window.addEventListener(eventType, enableVibration, { passive: true });
  });
}

/**
 * Trigger haptic feedback with a specific pattern
 * @param pattern - The type of haptic feedback pattern
 */
export const triggerHaptic = (pattern: HapticPattern = 'light'): void => {
  if (!isVibrationSupported()) {
    return; // Silently fail on unsupported devices
  }

  // Only vibrate if user has interacted with the page
  // This prevents the "blocked call" warning in Chrome
  if (!hasUserInteracted) {
    return;
  }

  const patterns: Record<HapticPattern, number | number[]> = {
    light: 10,           // Very short pulse for subtle feedback
    medium: 50,          // Medium pulse for standard actions
    heavy: 100,          // Longer pulse for important actions
    success: [50, 30, 50], // Pattern for success (pulse-pause-pulse)
    error: [100, 50, 100, 50, 100], // Pattern for errors (three pulses)
    warning: [50, 30, 50, 30, 50], // Pattern for warnings
  };

  try {
    navigator.vibrate(patterns[pattern]);
  } catch (error) {
    // Silently fail if vibration is blocked or unavailable
    // This can happen if the page doesn't have focus or user hasn't interacted
    console.debug('Haptic feedback not available:', error);
  }
};

/**
 * Trigger haptic feedback for navigation actions
 */
export const hapticNavigation = (): void => {
  triggerHaptic('light');
};

/**
 * Trigger haptic feedback for successful actions
 */
export const hapticSuccess = (): void => {
  triggerHaptic('success');
};

/**
 * Trigger haptic feedback for errors
 */
export const hapticError = (): void => {
  triggerHaptic('error');
};

/**
 * Trigger haptic feedback for warnings
 */
export const hapticWarning = (): void => {
  triggerHaptic('warning');
};

/**
 * Trigger haptic feedback for important actions (submissions, confirmations)
 */
export const hapticImportant = (): void => {
  triggerHaptic('medium');
};

