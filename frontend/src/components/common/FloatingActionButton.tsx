import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';

export interface FABAction {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
}

interface FloatingActionButtonProps {
  mainIcon?: React.ReactNode;
  actions: FABAction[];
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  className?: string;
  disabled?: boolean;
  ariaLabel?: string;
}

const FloatingActionButton: React.FC<FloatingActionButtonProps> = ({
  mainIcon = <Plus className="w-5 h-5" strokeWidth={2.5} />,
  actions,
  position = 'bottom-right',
  className = '',
  disabled = false,
  ariaLabel = 'Quick actions'
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const positionClasses = {
    'bottom-right': 'bottom-20 right-3',
    'bottom-left': 'bottom-20 left-3',
    'top-right': 'top-20 right-3',
    'top-left': 'top-20 left-3'
  };

  const actionPositionClasses = {
    'bottom-right': 'bottom-24 right-3',
    'bottom-left': 'bottom-24 left-3',
    'top-right': 'top-24 right-3',
    'top-left': 'top-24 left-3'
  };

  const handleMainClick = () => {
    if (!disabled) {
      setIsOpen(!isOpen);
    }
  };

  const handleActionClick = (action: FABAction) => {
    if (!action.disabled) {
      action.onClick();
      setIsOpen(false);
    }
  };

  if (actions.length === 0) return null;

  // If only one action, render as single button
  if (actions.length === 1) {
    return (
      <button
        onClick={() => !disabled && actions[0].onClick()}
        disabled={disabled || actions[0].disabled}
        className={`lg:hidden fixed ${positionClasses[position]} w-12 h-12 bg-gradient-to-br from-blue-600 to-blue-500 dark:from-blue-500 dark:to-blue-600 text-white rounded-xl shadow-lg hover:shadow-blue-500/50 hover:from-blue-700 hover:to-blue-600 dark:hover:from-blue-600 dark:hover:to-blue-700 active:scale-95 transition-all flex items-center justify-center z-[100] touch-manipulation disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
        aria-label={actions[0].label || ariaLabel}
        type="button"
      >
        {actions[0].icon}
      </button>
    );
  }

  return (
    <div className={`lg:hidden fixed ${positionClasses[position]} z-[100]`}>
      {/* Action Buttons */}
      {isOpen && (
        <div className={`absolute ${actionPositionClasses[position]} flex flex-col-reverse gap-3 mb-3`}>
          {actions.map((action, index) => (
            <button
              key={index}
              onClick={() => handleActionClick(action)}
              disabled={action.disabled}
              className={`
                w-12 h-12 rounded-xl shadow-lg active:scale-95 transition-all flex items-center justify-center touch-manipulation
                disabled:opacity-50 disabled:cursor-not-allowed
                ${
                  action.variant === 'danger'
                    ? 'bg-gradient-to-br from-red-600 to-red-500 dark:from-red-500 dark:to-red-600 text-white hover:shadow-red-500/50'
                    : action.variant === 'secondary'
                    ? 'bg-gradient-to-br from-gray-600 to-gray-500 dark:from-gray-500 dark:to-gray-600 text-white hover:shadow-gray-500/50'
                    : 'bg-gradient-to-br from-blue-600 to-blue-500 dark:from-blue-500 dark:to-blue-600 text-white hover:shadow-blue-500/50'
                }
              `}
              style={{
                animation: `slideUp 0.2s ease-out ${index * 0.05}s forwards`,
                opacity: 0
              }}
              aria-label={action.label}
              type="button"
            >
              {action.icon}
            </button>
          ))}
        </div>
      )}

      {/* Main Button */}
      <button
        onClick={handleMainClick}
        disabled={disabled}
        className={`
          w-12 h-12 bg-gradient-to-br from-blue-600 to-blue-500 dark:from-blue-500 dark:to-blue-600 text-white rounded-xl shadow-lg 
          hover:shadow-blue-500/50 hover:from-blue-700 hover:to-blue-600 dark:hover:from-blue-600 dark:hover:to-blue-700 
          active:scale-95 transition-all flex items-center justify-center touch-manipulation
          disabled:opacity-50 disabled:cursor-not-allowed
          ${isOpen ? 'rotate-45' : 'rotate-0'}
          ${className}
        `}
        aria-label={ariaLabel}
        aria-expanded={isOpen}
        type="button"
      >
        {isOpen ? <X className="w-5 h-5" strokeWidth={2.5} /> : mainIcon}
      </button>

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 dark:bg-black/40 -z-10"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      <style>{`
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
};

export default FloatingActionButton;

