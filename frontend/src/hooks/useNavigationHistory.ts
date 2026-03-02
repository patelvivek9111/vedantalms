import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/**
 * Hook to track navigation history and provide back button functionality
 * Tracks navigation stack and provides methods to navigate back
 */
export const useNavigationHistory = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const historyStack = useRef<string[]>([]);
  const maxHistoryLength = 50; // Limit history stack size

  // Track navigation history
  useEffect(() => {
    const currentPath = location.pathname + location.search;
    
    // Don't add if it's the same as the last entry
    if (historyStack.current[historyStack.current.length - 1] !== currentPath) {
      historyStack.current.push(currentPath);
      
      // Limit history stack size
      if (historyStack.current.length > maxHistoryLength) {
        historyStack.current.shift();
      }
    }
  }, [location.pathname, location.search]);

  /**
   * Navigate back in history
   * @param fallbackPath - Path to navigate to if no history exists
   */
  const goBack = (fallbackPath: string = '/dashboard') => {
    if (historyStack.current.length > 1) {
      // Remove current path from stack
      historyStack.current.pop();
      // Get previous path
      const previousPath = historyStack.current[historyStack.current.length - 1];
      
      if (previousPath) {
        navigate(previousPath);
      } else {
        navigate(fallbackPath);
      }
    } else {
      // No history, navigate to fallback
      navigate(fallbackPath);
    }
  };

  /**
   * Check if there's navigation history available
   */
  const hasHistory = (): boolean => {
    return historyStack.current.length > 1;
  };

  /**
   * Get the previous path in history
   */
  const getPreviousPath = (): string | null => {
    if (historyStack.current.length > 1) {
      return historyStack.current[historyStack.current.length - 2];
    }
    return null;
  };

  /**
   * Clear navigation history
   */
  const clearHistory = () => {
    historyStack.current = [location.pathname + location.search];
  };

  return {
    goBack,
    hasHistory,
    getPreviousPath,
    clearHistory,
    historyLength: historyStack.current.length,
  };
};

