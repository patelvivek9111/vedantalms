/**
 * Utility functions for handling rate limit errors
 */

/**
 * Format retry time in a user-friendly way
 * @param seconds - Number of seconds until retry
 * @returns Formatted string like "2 minutes" or "45 seconds"
 */
export const formatRetryTime = (seconds: number): string => {
  if (seconds < 60) {
    return `${seconds} second${seconds !== 1 ? 's' : ''}`;
  }
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  
  if (minutes < 60) {
    if (remainingSeconds === 0) {
      return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
    }
    return `${minutes} minute${minutes !== 1 ? 's' : ''} and ${remainingSeconds} second${remainingSeconds !== 1 ? 's' : ''}`;
  }
  
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  
  if (remainingMinutes === 0) {
    return `${hours} hour${hours !== 1 ? 's' : ''}`;
  }
  return `${hours} hour${hours !== 1 ? 's' : ''} and ${remainingMinutes} minute${remainingMinutes !== 1 ? 's' : ''}`;
};

/**
 * Get user-friendly error message for rate limit errors
 * @param retryAfter - Number of seconds until retry (optional)
 * @returns User-friendly error message
 */
export const getRateLimitMessage = (retryAfter?: number): string => {
  if (retryAfter) {
    const timeString = formatRetryTime(retryAfter);
    return `Too many requests. Please try again in ${timeString}.`;
  }
  return 'Too many requests. Please try again later.';
};

/**
 * Extract retry-after information from an error object
 * @param error - Error object from API call
 * @returns Retry-after in seconds, or null if not available
 */
export const getRetryAfter = (error: any): number | null => {
  if (!error) return null;
  
  // Check various possible locations for retry-after
  const retryAfter = 
    error.retryAfter ||
    error.retryAfterSeconds ||
    error.response?.headers?.['retry-after'] ||
    error.response?.headers?.['Retry-After'] ||
    error.response?.data?.retryAfter ||
    error.response?.data?.retryAfterSeconds;
  
  if (retryAfter) {
    const parsed = parseInt(String(retryAfter), 10);
    return isNaN(parsed) ? null : parsed;
  }
  
  return null;
};


