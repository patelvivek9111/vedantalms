import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useSwipeGesture } from '../../hooks/useSwipeGesture';
import { hapticNavigation } from '../../utils/hapticFeedback';

export interface BaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  showCloseButton?: boolean;
  closeOnOverlayClick?: boolean;
  closeOnEscape?: boolean;
  className?: string;
  overlayClassName?: string;
  headerClassName?: string;
  bodyClassName?: string;
  footer?: React.ReactNode;
  footerClassName?: string;
  loading?: boolean;
  ariaLabelledBy?: string;
  ariaDescribedBy?: string;
  enableSwipeToDismiss?: boolean; // Enable swipe down to dismiss (mobile only)
}

const sizeClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  full: 'max-w-full mx-2 sm:mx-4'
};

const BaseModal: React.FC<BaseModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  showCloseButton = true,
  closeOnOverlayClick = true,
  closeOnEscape = true,
  className = '',
  overlayClassName = '',
  headerClassName = '',
  bodyClassName = '',
  footer,
  footerClassName = '',
  loading = false,
  ariaLabelledBy,
  ariaDescribedBy,
  enableSwipeToDismiss = true // Default to true for mobile UX
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  // Swipe to dismiss (mobile only)
  const handleSwipeDown = () => {
    if (!loading && enableSwipeToDismiss) {
      hapticNavigation();
      onClose();
    }
  };

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const swipeEnabled = enableSwipeToDismiss && isOpen && !loading && isMobile;

  const swipeHandlers = useSwipeGesture({
    onSwipeDown: handleSwipeDown,
    threshold: 100, // Require more distance for dismiss
    velocityThreshold: 0.5,
    preventDefault: false,
    enabled: swipeEnabled
  });

  // Handle open/close animations
  useEffect(() => {
    if (isOpen) {
      // Store the previously focused element
      previousActiveElement.current = document.activeElement as HTMLElement;
      
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
      
      // Trigger animation
      setIsVisible(true);
      requestAnimationFrame(() => {
        setIsAnimating(true);
      });
    } else {
      setIsAnimating(false);
      // Allow body scroll when modal is closed
      document.body.style.overflow = '';
      
      // Restore focus to previous element
      if (previousActiveElement.current) {
        previousActiveElement.current.focus();
      }
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen || !closeOnEscape) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, closeOnEscape, loading, onClose]);

  // Focus trap - keep focus within modal
  useEffect(() => {
    if (!isOpen || !modalRef.current) return;

    const modal = modalRef.current;
    const focusableElements = modal.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    // Focus first element when modal opens
    if (firstElement && !loading) {
      firstElement.focus();
    }

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        // Tab
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    modal.addEventListener('keydown', handleTabKey);
    return () => modal.removeEventListener('keydown', handleTabKey);
  }, [isOpen, loading]);

  // Handle overlay click
  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (closeOnOverlayClick && !loading && e.target === overlayRef.current) {
      onClose();
    }
  };

  // Handle animation end
  const handleAnimationEnd = () => {
    if (!isOpen) {
      setIsVisible(false);
    }
  };

  if (!isVisible && !isOpen) return null;

  return (
    <div
      ref={overlayRef}
      className={`fixed inset-0 z-50 overflow-y-auto transition-opacity duration-300 ${
        isAnimating ? 'opacity-100' : 'opacity-0'
      } ${overlayClassName}`}
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby={ariaLabelledBy}
      aria-describedby={ariaDescribedBy}
    >
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        {/* Backdrop overlay */}
        <div
          className={`fixed inset-0 bg-black transition-opacity duration-300 ${
            isAnimating ? 'bg-opacity-50' : 'bg-opacity-0'
          }`}
          aria-hidden="true"
        />

        {/* Modal container */}
        <div
          ref={modalRef}
          className={`inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all duration-300 sm:my-8 sm:align-middle w-full ${sizeClasses[size]} ${
            isAnimating
              ? 'translate-y-0 opacity-100 scale-100'
              : 'translate-y-4 opacity-0 scale-95'
          } ${className}`}
          onAnimationEnd={handleAnimationEnd}
          onClick={(e) => e.stopPropagation()}
          {...(swipeEnabled ? {
            onTouchStart: swipeHandlers.onTouchStart,
            onTouchMove: swipeHandlers.onTouchMove,
            onTouchEnd: swipeHandlers.onTouchEnd
          } : {})}
        >
          {/* Header */}
          {(title || showCloseButton) && (
            <div
              className={`flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-700 ${headerClassName}`}
            >
              {title && (
                <h3
                  id={ariaLabelledBy}
                  className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-100 flex-1 pr-4"
                >
                  {title}
                </h3>
              )}
              {showCloseButton && (
                <button
                  type="button"
                  onClick={onClose}
                  disabled={loading}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg p-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 touch-manipulation active:scale-95"
                  aria-label="Close modal"
                >
                  <X className="w-5 h-5 sm:w-6 sm:h-6" />
                </button>
              )}
            </div>
          )}

          {/* Body */}
          <div
            className={`px-4 sm:px-6 py-4 sm:py-6 ${bodyClassName}`}
            id={ariaDescribedBy}
          >
            {children}
          </div>

          {/* Footer */}
          {footer && (
            <div
              className={`px-4 sm:px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 ${footerClassName}`}
            >
              {footer}
            </div>
          )}

          {/* Loading overlay */}
          {loading && (
            <div className="absolute inset-0 bg-white dark:bg-gray-800 bg-opacity-75 flex items-center justify-center z-10">
              <div className="flex flex-col items-center gap-2">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-400"></div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Loading...</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BaseModal;

