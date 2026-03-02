import React from 'react';
import { AlertTriangle } from 'lucide-react';
import BaseModal from './BaseModal';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
  isLoading?: boolean;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  isLoading = false
}) => {
  const variantStyles = {
    danger: {
      icon: 'text-red-600 dark:text-red-400',
      button: 'bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600 focus:ring-red-500',
      border: 'border-red-200 dark:border-red-800',
      iconBg: 'bg-red-100 dark:bg-red-900/20'
    },
    warning: {
      icon: 'text-yellow-600 dark:text-yellow-400',
      button: 'bg-yellow-600 hover:bg-yellow-700 dark:bg-yellow-500 dark:hover:bg-yellow-600 focus:ring-yellow-500',
      border: 'border-yellow-200 dark:border-yellow-800',
      iconBg: 'bg-yellow-100 dark:bg-yellow-900/20'
    },
    info: {
      icon: 'text-blue-600 dark:text-blue-400',
      button: 'bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 focus:ring-blue-500',
      border: 'border-blue-200 dark:border-blue-800',
      iconBg: 'bg-blue-100 dark:bg-blue-900/20'
    }
  };

  const styles = variantStyles[variant];

  const footer = (
    <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-3 space-y-3 sm:space-y-0">
      <button
        type="button"
        onClick={onClose}
        disabled={isLoading}
        className="w-full sm:w-auto min-h-[44px] inline-flex justify-center items-center rounded-md border border-gray-300 dark:border-gray-600 shadow-sm px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all touch-manipulation active:scale-95"
      >
        {cancelText}
      </button>
      <button
        type="button"
        onClick={onConfirm}
        disabled={isLoading}
        className={`w-full sm:w-auto min-h-[44px] inline-flex justify-center items-center rounded-md border border-transparent shadow-sm px-4 py-2.5 text-sm font-medium text-white ${styles.button} focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all touch-manipulation active:scale-95`}
      >
        {isLoading ? (
          <>
            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Processing...
          </>
        ) : (
          confirmText
        )}
      </button>
    </div>
  );

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      size="md"
      closeOnOverlayClick={!isLoading}
      closeOnEscape={!isLoading}
      loading={isLoading}
      className={`border-t-4 ${styles.border}`}
      ariaLabelledBy="confirmation-modal-title"
      ariaDescribedBy="confirmation-modal-message"
      footer={footer}
    >
      <div className="flex items-start">
        <div className={`flex-shrink-0 flex items-center justify-center h-10 w-10 sm:h-12 sm:w-12 rounded-full ${styles.iconBg}`}>
          <AlertTriangle className={`h-5 w-5 sm:h-6 sm:w-6 ${styles.icon}`} aria-hidden="true" />
        </div>
        <div className="ml-4 flex-1">
          <h3
            id="confirmation-modal-title"
            className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2"
          >
            {title}
          </h3>
          <p
            id="confirmation-modal-message"
            className="text-sm sm:text-base text-gray-500 dark:text-gray-400"
          >
            {message}
          </p>
        </div>
      </div>
    </BaseModal>
  );
};

export default ConfirmationModal;

