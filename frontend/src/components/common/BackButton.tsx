import React from 'react';
import { useNavigationHistory } from '../../hooks/useNavigationHistory';
import { ArrowLeft } from 'lucide-react';
import { hapticNavigation } from '../../utils/hapticFeedback';

interface BackButtonProps {
  /**
   * Fallback path to navigate to if no history exists
   * @default '/dashboard'
   */
  fallbackPath?: string;
  
  /**
   * Custom className for styling
   */
  className?: string;
  
  /**
   * Show button even when no history exists
   * @default false
   */
  alwaysShow?: boolean;
  
  /**
   * Custom label for accessibility
   * @default 'Go back'
   */
  ariaLabel?: string;
}

/**
 * BackButton Component
 * Provides a back button with navigation history support
 * Only shows when navigation history exists (unless alwaysShow is true)
 */
const BackButton: React.FC<BackButtonProps> = ({
  fallbackPath = '/dashboard',
  className = '',
  alwaysShow = false,
  ariaLabel = 'Go back',
}) => {
  const { goBack, hasHistory } = useNavigationHistory();

  const handleBack = () => {
    hapticNavigation();
    goBack(fallbackPath);
  };

  // Don't show if no history and alwaysShow is false
  if (!alwaysShow && !hasHistory()) {
    return null;
  }

  return (
    <button
      onClick={handleBack}
      className={`
        flex items-center justify-center
        min-h-[44px] min-w-[44px]
        w-11 h-11
        rounded-full
        bg-white dark:bg-gray-800
        border border-gray-200 dark:border-gray-700
        shadow-md
        hover:bg-gray-50 dark:hover:bg-gray-700
        active:bg-gray-100 dark:active:bg-gray-600 active:scale-95
        transition-all
        focus:outline-none
        focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
        touch-manipulation
        ${className}
      `}
      aria-label={ariaLabel}
    >
      <ArrowLeft className="w-5 h-5 text-gray-700 dark:text-gray-300" />
    </button>
  );
};

export default BackButton;

