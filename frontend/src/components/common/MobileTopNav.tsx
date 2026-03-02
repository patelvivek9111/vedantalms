import React from 'react';
import { Menu, User as UserIcon } from 'lucide-react';
import BackButton from './BackButton';

interface MobileTopNavProps {
  /**
   * Title to display in the center
   */
  title: string;
  
  /**
   * Fallback path for back button navigation
   * If not provided, back button won't be shown
   */
  backButtonPath?: string;
  
  /**
   * Custom back button label for accessibility
   */
  backButtonLabel?: string;
  
  /**
   * Right side action button
   * 'menu' - Shows hamburger menu icon
   * 'user' - Shows user icon
   * 'custom' - Use customRightAction instead
   * 'none' - No right action
   */
  rightAction?: 'menu' | 'user' | 'custom' | 'none';
  
  /**
   * Custom right action element
   */
  customRightAction?: React.ReactNode;
  
  /**
   * Callback for right action click
   */
  onRightActionClick?: () => void;
  
  /**
   * Additional className for the nav element
   */
  className?: string;
  
  /**
   * Show navigation only on mobile devices
   * @default true
   */
  mobileOnly?: boolean;
}

/**
 * Standardized Mobile Top Navigation Component
 * Provides consistent top navigation bar across all pages
 * 
 * Layout: [Back Button] [Title] [Right Action]
 */
const MobileTopNav: React.FC<MobileTopNavProps> = ({
  title,
  backButtonPath,
  backButtonLabel = 'Go back',
  rightAction = 'none',
  customRightAction,
  onRightActionClick,
  className = '',
  mobileOnly = true,
}) => {
  const renderRightAction = () => {
    if (rightAction === 'none') {
      return <div className="w-10 flex-shrink-0"></div>; // Spacer for centering
    }
    
    if (rightAction === 'custom' && customRightAction) {
      return customRightAction;
    }
    
    const iconClass = "w-6 h-6";
    const buttonClass = "text-gray-700 dark:text-gray-300 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors touch-manipulation min-h-[44px] min-w-[44px] flex items-center justify-center flex-shrink-0";
    
    if (rightAction === 'menu') {
      return (
        <button
          onClick={onRightActionClick}
          className={buttonClass}
          aria-label="Open menu"
        >
          <Menu className={iconClass} />
        </button>
      );
    }
    
    if (rightAction === 'user') {
      return (
        <button
          onClick={onRightActionClick}
          className={buttonClass}
          aria-label="Open account menu"
        >
          <UserIcon className={iconClass} />
        </button>
      );
    }
    
    return <div className="w-10 flex-shrink-0"></div>; // Fallback spacer
  };

  return (
    <nav className={`${mobileOnly ? 'lg:hidden' : ''} fixed top-0 left-0 right-0 z-[150] bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm safe-area-inset-top ${className}`}>
      <div className="relative flex items-center justify-between px-4 py-3 gap-2">
        {/* Back Button */}
        {backButtonPath ? (
          <BackButton 
            fallbackPath={backButtonPath}
            className="flex-shrink-0"
            ariaLabel={backButtonLabel}
          />
        ) : (
          <div className="w-10 flex-shrink-0"></div> // Spacer when no back button
        )}
        
        {/* Title */}
        <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-100 flex-1 text-center truncate px-2">
          {title}
        </h1>
        
        {/* Right Action */}
        {renderRightAction()}
      </div>
    </nav>
  );
};

export default MobileTopNav;

