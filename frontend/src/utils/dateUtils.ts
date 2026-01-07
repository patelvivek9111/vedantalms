import { format } from 'date-fns';

/**
 * Safely formats a date, handling null, undefined, and invalid dates
 * @param date - Date string, Date object, or null/undefined
 * @param formatStr - Format string for date-fns format function
 * @param fallback - Fallback text if date is invalid (default: 'Invalid date')
 * @returns Formatted date string or fallback
 */
export const safeFormatDate = (
  date: string | Date | null | undefined,
  formatStr: string = 'MMM d, yyyy h:mm a',
  fallback: string = 'Invalid date'
): string => {
  if (!date) return fallback;
  
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    // Check if date is valid
    if (!(dateObj instanceof Date) || isNaN(dateObj.getTime())) {
      return fallback;
    }
    
    return format(dateObj, formatStr);
  } catch (error) {
    return fallback;
  }
};

