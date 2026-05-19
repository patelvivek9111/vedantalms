import React from 'react';
import { ds } from './tokens';

interface ErrorBannerProps {
  message: string;
  onRetry?: () => void;
  className?: string;
}

const ErrorBanner: React.FC<ErrorBannerProps> = ({ message, onRetry, className = '' }) => (
  <div
    className={`mb-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300 ${className}`}
    role="alert"
  >
    <span>{message}</span>
    {onRetry && (
      <button type="button" onClick={onRetry} className={ds.btn.primary}>
        Retry
      </button>
    )}
  </div>
);

export default ErrorBanner;
